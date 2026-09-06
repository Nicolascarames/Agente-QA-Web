import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCorridaActiva, obtenerMapa } from "./api";
import { BarraLanzamiento } from "./BarraLanzamiento";
import { Chat } from "./Chat";
import { DetalleLocalizador } from "./DetalleLocalizador";
import { Panel } from "./Panel";
import type { EventoNdjson, MapaCompleto, RespuestaMensaje } from "../shared/tipos";

// Tipos que marcan el ciclo de vida de la operación (catálogo del Bloque 1 de Agente-QA-MCP):
// al verlos, la barra de lanzamiento vuelve a "Lanzar" y el registro sabe que la corrida acabó.
const TIPOS_FIN_CORRIDA = new Set(["operation.completed", "operation.stopped", "operation.error"]);

type Screen = Extract<MapaCompleto, { existe: true }>["screens"][number];
type ScenarioCandidate = Extract<MapaCompleto, { existe: true }>["scenarios"][number];

const MAPA_VACIO: MapaCompleto = { existe: true, screens: [], scenarios: [] };

// Cuánto se espera tras el último evento `map.*`/de fin de corrida antes de pedir el mapa: evita
// disparar una petición por cada evento cuando llegan en ráfaga (normal cerca del final de una corrida).
const DEBOUNCE_RECARGA_MAPA_MS = 400;

// Envuelve una carga asíncrona para que solo la respuesta de la petición más reciente pueda
// aplicarse: si dos llamadas se solapan (jitter de red/disco) y la más vieja resuelve después
// que la más nueva, se descarta en vez de pisar con un snapshot obsoleto.
export function crearCargaSinCarreras<T>(cargar: () => Promise<T>, aplicar: (valor: T) => void): () => void {
  let ultimoToken = 0;
  return () => {
    const token = ++ultimoToken;
    void cargar().then((valor) => {
      if (token === ultimoToken) aplicar(valor);
    });
  };
}

// Bloque 6: `POST /api/mensaje` devuelve `{enviado: true}` si redirigió una corrida ya en marcha,
// o `{runId}` si no había ninguna y esto lanzó una nueva (misma puerta "run" que la barra de
// arriba). Con corrida activa NO se pinta un eco local: el CLI vacía el `user.message` en su
// siguiente turno y emite su propio `chat.message` (origen "usuario") por el SSE ya abierto, así
// que pintarlo aquí también lo duplicaría en el registro (ver revisión del Bloque 6). Sin corrida
// activa no hay ese reflejo del CLI (es el arranque de una corrida nueva), así que ahí sí hace
// falta el eco local. Función pura para poder testearla sin montar el componente (sin jsdom).
export function eventosTrasEnviarMensaje(
  anteriores: EventoNdjson[],
  texto: string,
  resultado: RespuestaMensaje
): EventoNdjson[] {
  if (!("runId" in resultado)) return anteriores;
  const eco: EventoNdjson = {
    runId: resultado.runId,
    ts: new Date().toISOString(),
    agent: "web",
    type: "chat.message",
    data: { text: texto, origen: "usuario" },
  };
  return [...anteriores, eco];
}

export function Explorar() {
  const [mapa, setMapa] = useState<MapaCompleto>(MAPA_VACIO);
  const [pantallaSeleccionada, setPantallaSeleccionada] = useState<string | null>(null);
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState<string[]>([]);
  const [eventos, setEventos] = useState<EventoNdjson[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  // Cada lanzamiento incrementa esto: fuerza a reabrir el SSE aunque ya hubiera uno cerrado.
  const [intentoConexion, setIntentoConexion] = useState(0);
  const fuenteRef = useRef<EventSource | null>(null);
  const cargaMapaSinCarrerasRef = useRef(crearCargaSinCarreras(obtenerMapa, setMapa));
  const debounceMapaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargarMapa = useCallback(() => {
    if (debounceMapaRef.current) clearTimeout(debounceMapaRef.current);
    debounceMapaRef.current = setTimeout(() => {
      debounceMapaRef.current = null;
      cargaMapaSinCarrerasRef.current();
    }, DEBOUNCE_RECARGA_MAPA_MS);
  }, []);

  useEffect(() => {
    recargarMapa();
    return () => {
      if (debounceMapaRef.current) clearTimeout(debounceMapaRef.current);
    };
  }, [recargarMapa]);

  // Al cargar la pestaña (o recargar el navegador), se pregunta si ya hay una corrida en marcha
  // para este proyecto antes de que llegue ningún evento por SSE — así el botón nace correcto.
  useEffect(() => {
    void obtenerCorridaActiva().then((estado) => setCorriendo(estado.activa));
  }, []);

  // El SSE reenvía primero el historial acumulado de la corrida activa y luego sigue en vivo: por
  // eso recargar el navegador a mitad de una corrida no pierde lo anterior. Sin corrida activa, el
  // servidor manda "sin-corrida" y cierra — aquí no se reintenta solo, hace falta un nuevo lanzamiento.
  useEffect(() => {
    const fuente = new EventSource("/api/eventos");
    fuenteRef.current = fuente;

    fuente.addEventListener("sin-corrida", () => {
      fuente.close();
    });

    fuente.onmessage = (mensaje: MessageEvent<string>) => {
      let evento: EventoNdjson;
      try {
        evento = JSON.parse(mensaje.data) as EventoNdjson;
      } catch {
        return;
      }
      setEventos((anteriores) => [...anteriores, evento]);
      setCorriendo(!TIPOS_FIN_CORRIDA.has(evento.type));
      // El árbol se refresca leyendo `map.json` de nuevo en vez de intentar fusionar a mano el
      // `data` (sin forma cerrada) de cada evento — es la única fuente que ya valida el contrato.
      // También se refresca al cerrar la corrida (completed/stopped/error): así queda consistente
      // incluso si el último `map.*` no llegó a tiempo o su recarga se descartó por ser vieja.
      if (evento.type.startsWith("map.") || TIPOS_FIN_CORRIDA.has(evento.type)) recargarMapa();
    };

    return () => fuente.close();
  }, [intentoConexion, recargarMapa]);

  const alternarUnidad = useCallback((id: string) => {
    setUnidadesSeleccionadas((anteriores) => (anteriores.includes(id) ? anteriores.filter((u) => u !== id) : [...anteriores, id]));
  }, []);

  const alHablar = useCallback((texto: string, resultado: RespuestaMensaje) => {
    setEventos((anteriores) => eventosTrasEnviarMensaje(anteriores, texto, resultado));
    if ("runId" in resultado) {
      // No había corrida activa: esto lanzó una corrida nueva, mismo efecto que "Lanzar".
      setCorriendo(true);
      setIntentoConexion((n) => n + 1);
    }
  }, []);

  const pantalla = useMemo(
    () => (mapa.existe ? mapa.screens.find((s) => s.id === pantallaSeleccionada) : undefined),
    [mapa, pantallaSeleccionada]
  );

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      {/*
        Geometría EXACTA de `panels.explorar` en design/mockup-design.js: izquierda 25%,
        centro 46% (arranca en 26.5%), derecha 26% (arranca en 74%), los tres a 100% de alto.
        El mockup solo tiene tres paneles aquí (left/mid/right) — el antiguo cuarto panel
        "Registro en vivo" se funde dentro del panel de chat (ver RegistroEnVivo más abajo):
        no hay una cuarta columna en la geometría real del mockup para mantenerlo separado.
      */}
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="explorar"
          panelId="arbol"
          titulo="🌐 Application Map"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          <ArbolMapa
            mapa={mapa}
            pantallaSeleccionada={pantallaSeleccionada}
            unidadesSeleccionadas={unidadesSeleccionadas}
            onSeleccionar={setPantallaSeleccionada}
            onAlternarUnidad={alternarUnidad}
          />
        </Panel>

        <Panel
          tabId="explorar"
          panelId="detalle"
          titulo="Detalle de la selección"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          <DetalleSeleccion pantalla={pantalla} onCorregido={recargarMapa} corriendo={corriendo} />
        </Panel>

        <Panel
          tabId="explorar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2">
            <div className="flex-1 overflow-auto">
              <RegistroEnVivo eventos={eventos} />
            </div>
            <Chat onEnviado={alHablar} />
          </div>
        </Panel>
      </div>

      <BarraLanzamiento
        corriendo={corriendo}
        unidadesSeleccionadas={unidadesSeleccionadas}
        onLanzado={() => {
          setEventos([]);
          setCorriendo(true);
          setIntentoConexion((n) => n + 1);
        }}
        onDetenido={() => {
          // No se apaga aquí: se espera al evento de cierre real (operation.stopped/completed)
          // para no decir "parado" antes de que el CLI haya terminado de escribir map.json.
        }}
      />
    </div>
  );
}

// Agrupa las pantallas por su primer segmento de `urlTemplate` (dato real, no inventado) para
// pintar el árbol con ramas expandibles/colapsables que pide el Bloque 3 — el mapa no trae una
// jerarquía propia, así que esta es la única agrupación real disponible sin fabricar datos.
function agruparPorRuta(screens: Screen[]): Map<string, Screen[]> {
  const grupos = new Map<string, Screen[]>();
  for (const pantalla of screens) {
    const primerSegmento = pantalla.urlTemplate.split("/").filter(Boolean)[0];
    const clave = primerSegmento ? `/${primerSegmento}` : "/";
    const lista = grupos.get(clave) ?? [];
    lista.push(pantalla);
    grupos.set(clave, lista);
  }
  return grupos;
}

function ArbolMapa({
  mapa,
  pantallaSeleccionada,
  unidadesSeleccionadas,
  onSeleccionar,
  onAlternarUnidad,
}: {
  mapa: MapaCompleto;
  pantallaSeleccionada: string | null;
  unidadesSeleccionadas: string[];
  onSeleccionar: (id: string) => void;
  onAlternarUnidad: (id: string) => void;
}) {
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  const alternarGrupo = (clave: string) => {
    setColapsados((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  };

  if (!mapa.existe) {
    return <p className="text-text-dim">Este proyecto no tiene map.json todavía: lanza una puerta para empezar.</p>;
  }

  const grupos = agruparPorRuta(mapa.screens);
  const claves = [...grupos.keys()].sort();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-2xs uppercase tracking-[.04em] text-text-faint">Pantallas ({mapa.screens.length})</p>
        {mapa.screens.length === 0 && <p className="text-xs text-text-dim">Ninguna todavía.</p>}
        <ul className="flex flex-col gap-0.5">
          {claves.map((clave) => {
            const abierto = !colapsados.has(clave);
            return (
              <li key={clave}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(clave)}
                  className="block w-full rounded-6 px-2 py-1.5 text-left text-text-muted hover:bg-bg-row"
                >
                  {abierto ? "▾" : "▸"} {clave}
                </button>
                {abierto && (
                  <ul className="flex flex-col gap-0.5 pl-4">
                    {(grupos.get(clave) ?? []).map((pantalla) => (
                      <li key={pantalla.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          title='Marca para el ámbito "esta selección" del bucle agéntico'
                          checked={unidadesSeleccionadas.includes(pantalla.id)}
                          onChange={() => onAlternarUnidad(pantalla.id)}
                        />
                        <button
                          type="button"
                          onClick={() => onSeleccionar(pantalla.id)}
                          className={`truncate rounded-6 px-1.5 py-1 text-left ${
                            pantalla.id === pantallaSeleccionada ? "bg-bg-row text-accent-soft" : "text-text hover:text-accent-soft"
                          }`}
                          title={pantalla.urlTemplate}
                        >
                          {pantalla.name}
                          {pantalla.stale && <span className="ml-1 text-2xs text-accent">(desactualizada)</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-2xs uppercase tracking-[.04em] text-text-faint">Candidatos de escenario ({mapa.scenarios.length})</p>
        {mapa.scenarios.length === 0 && <p className="text-xs text-text-dim">Ninguno todavía.</p>}
        <ul className="flex flex-col gap-0.5">
          {mapa.scenarios.map((candidato: ScenarioCandidate) => (
            <li key={candidato.id} className="truncate text-xs text-text-muted" title={candidato.rationale}>
              {candidato.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Badge por elemento de la tabla "Elementos": localizador ya resuelto (✅, --ok) o candidato
// ambiguo sin resolver todavía (⚠️, --accent) — igual que pide el Bloque 3.
function BadgeElemento({ texto, tono }: { texto: string; tono: "ok" | "ambiguo" }) {
  return (
    <span
      className={`whitespace-nowrap rounded-6 px-2 py-0.5 text-xs ${
        tono === "ok" ? "bg-ok-bg text-ok" : "bg-accent-bg text-accent"
      }`}
    >
      {texto}
    </span>
  );
}

function DetalleSeleccion({
  pantalla,
  onCorregido,
  corriendo,
}: {
  pantalla: Screen | undefined;
  onCorregido: () => void;
  corriendo: boolean;
}) {
  if (!pantalla) return <p className="text-text-dim">Selecciona una pantalla del árbol para ver su detalle.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-md font-bold text-text-bright">{pantalla.name}</h2>
        <BadgeElemento texto={pantalla.stale ? "⚠️ STALE" : "✅ MAPPED"} tono={pantalla.stale ? "ambiguo" : "ok"} />
      </div>
      <p className="break-all text-xs text-text-faint">{pantalla.urlTemplate}</p>
      <p className="text-xs text-text-faint">
        producedBy: {pantalla.producedBy.agent} · {pantalla.stale ? "stale" : "no stale"}
      </p>

      <div>
        <h3 className="mb-1.5 text-md font-semibold text-text-bright">Elementos</h3>
        {pantalla.locators.length === 0 && pantalla.ambiguous.length === 0 ? (
          <p className="text-xs text-text-dim">Ninguno todavía.</p>
        ) : (
          <ul className="flex flex-col text-xs">
            {pantalla.locators.map((loc) => (
              <li key={loc.name} className="flex items-center justify-between gap-2 border-b border-bg-row py-2">
                <span className="truncate text-text">{loc.name}</span>
                <BadgeElemento texto="✅ locator ready" tono="ok" />
              </li>
            ))}
            {pantalla.ambiguous.map((amb) => (
              <li key={amb.name} className="flex items-center justify-between gap-2 border-b border-bg-row py-2 last:border-b-0">
                <span className="truncate text-text">{amb.name}</span>
                <BadgeElemento texto={`⚠️ ${String(amb.count)} matches — ambiguo`} tono="ambiguo" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <DetalleLocalizador screenId={pantalla.id} locators={pantalla.locators} onGuardado={onCorregido} deshabilitado={corriendo} />

      <div>
        <h3 className="mb-1 text-md font-semibold text-text-bright">Transiciones ({pantalla.transitions.length})</h3>
        {pantalla.transitions.length === 0 ? (
          <p className="text-xs text-text-dim">Ninguna todavía.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
            {pantalla.transitions.map((t) => (
              <li key={t.id}>
                {t.action} {t.locatorName ? `(${t.locatorName})` : ""} → {t.toScreenId}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function serializarDatos(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function esMensajeDeChat(evento: EventoNdjson): evento is EventoNdjson & { data: { text: string; origen?: string } } {
  return (
    evento.type === "chat.message" &&
    typeof evento.data === "object" &&
    evento.data !== null &&
    typeof (evento.data as { text?: unknown }).text === "string"
  );
}

// Fusiona lo que antes eran dos paneles ("Hablar con el agente" + "Registro en vivo") en el
// único panel de chat de la geometría real del mockup (`panels.explorar` no tiene cuarta
// columna): los `chat.message` se pintan como burbujas 🤖/🧑, y el resto de eventos NDJSON
// (map.*, operation.*, cost.update…) siguen visibles como una línea de registro compacta debajo
// — nada de lo que ya se veía ayer desaparece, solo cambia de forma.
function RegistroEnVivo({ eventos }: { eventos: EventoNdjson[] }) {
  if (eventos.length === 0) return <p className="text-text-dim">Sin eventos todavía: lanza una puerta para ver la corrida.</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {eventos.map((evento, indice) => {
        const clave = `${evento.runId}-${String(indice)}`;
        if (esMensajeDeChat(evento)) {
          const esUsuario = evento.data.origen === "usuario";
          return (
            <li key={clave} className="text-sm leading-normal">
              <div className="mb-1 text-2xs uppercase tracking-[.04em]">
                {esUsuario ? (
                  <span className="text-accent-soft">🧑 Tú</span>
                ) : (
                  <span className="text-agent">🤖 {evento.agent}</span>
                )}
              </div>
              {esUsuario ? (
                <div className="pl-3.5 text-text-strong">{evento.data.text}</div>
              ) : (
                <div className="rounded-8 border border-border-soft bg-bg-elev p-2.5 text-text-strong">{evento.data.text}</div>
              )}
            </li>
          );
        }
        return (
          <li key={clave} className="border-b border-border pb-1.5 text-xs text-text-faint">
            <span className="text-text-ghost">{evento.ts}</span> <span className="text-accent-soft">{evento.type}</span>{" "}
            <span className="text-text-faint">[{evento.agent}]</span>
            <pre className="whitespace-pre-wrap break-all text-2xs text-text-dim">{serializarDatos(evento.data)}</pre>
          </li>
        );
      })}
    </ul>
  );
}
