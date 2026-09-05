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
    <div className="flex h-full flex-col">
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
      <div className="relative flex-1">
        <Panel
          tabId="explorar"
          panelId="arbol"
          titulo="Árbol del mapa"
          disposicionPorDefecto={{ x: 16, y: 16, width: 380, height: 460 }}
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
          disposicionPorDefecto={{ x: 412, y: 16, width: 400, height: 460 }}
        >
          <DetalleSeleccion pantalla={pantalla} onCorregido={recargarMapa} corriendo={corriendo} />
        </Panel>

        <Panel
          tabId="explorar"
          panelId="registro"
          titulo="Registro en vivo"
          disposicionPorDefecto={{ x: 828, y: 16, width: 420, height: 460 }}
        >
          <RegistroEnVivo eventos={eventos} />
        </Panel>

        <Panel
          tabId="explorar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 828, y: 492, width: 420, height: 160 }}
        >
          <Chat onEnviado={alHablar} />
        </Panel>
      </div>
    </div>
  );
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
  if (!mapa.existe) {
    return <p className="text-text/50">Este proyecto no tiene map.json todavía: lanza una puerta para empezar.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs text-text/60">Pantallas ({mapa.screens.length})</p>
        {mapa.screens.length === 0 && <p className="text-xs text-text/40">Ninguna todavía.</p>}
        <ul className="flex flex-col gap-1">
          {mapa.screens.map((pantalla) => (
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
                className={`truncate text-left ${pantalla.id === pantallaSeleccionada ? "text-accent" : "text-text hover:text-accent"}`}
                title={pantalla.urlTemplate}
              >
                {pantalla.name}
                {pantalla.stale && <span className="ml-1 text-xs text-warning">(desactualizada)</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-xs text-text/60">Candidatos de escenario ({mapa.scenarios.length}) — solo lectura</p>
        {mapa.scenarios.length === 0 && <p className="text-xs text-text/40">Ninguno todavía.</p>}
        <ul className="flex flex-col gap-1">
          {mapa.scenarios.map((candidato: ScenarioCandidate) => (
            <li key={candidato.id} className="text-xs text-text/70" title={candidato.rationale}>
              {candidato.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
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
  if (!pantalla) return <p className="text-text/50">Selecciona una pantalla del árbol para ver su detalle.</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <p className="text-text/60">{pantalla.className}</p>
        <p className="break-all text-text/50">{pantalla.urlTemplate}</p>
      </div>

      <div>
        <DetalleLocalizador screenId={pantalla.id} locators={pantalla.locators} onGuardado={onCorregido} deshabilitado={corriendo} />
        {pantalla.ambiguous.length > 0 && (
          <p className="mt-1 text-warning">{pantalla.ambiguous.length} localizador(es) ambiguo(s) sin resolver.</p>
        )}
      </div>

      <div>
        <p className="mb-1 text-text/60">Transiciones ({pantalla.transitions.length})</p>
        <ul className="flex flex-col gap-0.5">
          {pantalla.transitions.map((t) => (
            <li key={t.id}>
              {t.action} {t.locatorName ? `(${t.locatorName})` : ""} → {t.toScreenId}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RegistroEnVivo({ eventos }: { eventos: EventoNdjson[] }) {
  if (eventos.length === 0) return <p className="text-text/50">Sin eventos todavía: lanza una puerta para ver la corrida.</p>;

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {eventos.map((evento, indice) => (
        <li key={`${evento.runId}-${String(indice)}`} className="border-b border-accent/10 pb-1">
          <span className="text-text/40">{evento.ts}</span> <span className="text-accent">{evento.type}</span>{" "}
          <span className="text-text/50">[{evento.agent}]</span>
          <pre className="whitespace-pre-wrap break-all text-text/60">{JSON.stringify(evento.data)}</pre>
        </li>
      ))}
    </ul>
  );
}
