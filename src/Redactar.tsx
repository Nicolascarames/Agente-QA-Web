import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { guardarEscenario, obtenerEscenario, obtenerEscenarios, obtenerTrazabilidad } from "./api";
import type { CoberturaEscenario } from "../shared/tipos";

// Badge de cobertura por fichero .feature (Bloque 8), junto al nombre en la lista de la izquierda:
// resume todos los `Escenario:` de ese fichero en un único estado, por prioridad — un fichero con
// algo sin cubrir importa más que uno cubierto pero en rojo, y un rojo importa más que uno verde.
type BadgeCobertura = "no-cubierto" | "desincronizado" | "rojo" | "verde" | "pendiente";

const ETIQUETA_COBERTURA: Record<BadgeCobertura, string> = {
  "no-cubierto": "no cubierto",
  desincronizado: "desincronizado",
  rojo: "rojo",
  verde: "verde",
  pendiente: "pendiente",
};

const COLOR_COBERTURA: Record<BadgeCobertura, string> = {
  "no-cubierto": "text-danger",
  desincronizado: "text-accent-soft",
  rojo: "text-danger",
  verde: "text-ok",
  pendiente: "text-text-dim",
};

function badgeDeFichero(escenarios: CoberturaEscenario[]): BadgeCobertura {
  if (escenarios.some((e) => e.estado === "no-cubierto")) return "no-cubierto";
  if (escenarios.some((e) => e.estado === "desincronizado")) return "desincronizado";
  if (escenarios.some((e) => e.resultado === "failed" || e.resultado === "timedOut")) return "rojo";
  if (escenarios.every((e) => e.resultado === "passed")) return "verde";
  return "pendiente";
}

// Bloque 6: misma geometría que `panels.redactar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero ahora con datos reales de `tests/features/*.feature` bajo el proyecto
// activo, en vez de los tres paneles vacíos del Bloque 5.
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece: era un `🎯 Ámbito / 🤖 Agente / 💰
// coste` de mentira para un agente que no existía. Ahora el agente existe y se lanza escribiendo
// en el chat de la derecha — una segunda barra de "lanzar" sería redundante con esa caja de texto.

export function Redactar({ corridaActiva }: { corridaActiva?: string | null }) {
  const [escenarios, setEscenarios] = useState<string[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [contenido, setContenido] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coberturaPorFichero, setCoberturaPorFichero] = useState<Map<string, CoberturaEscenario[]> | null>(null);

  const cargarLista = () => {
    void obtenerEscenarios()
      .then(setEscenarios)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    void obtenerTrazabilidad()
      .then((datos) => {
        const mapa = new Map<string, CoberturaEscenario[]>();
        for (const cobertura of datos) {
          const lista = mapa.get(cobertura.featureFichero) ?? [];
          lista.push(cobertura);
          mapa.set(cobertura.featureFichero, lista);
        }
        setCoberturaPorFichero(mapa);
      })
      .catch(() => {
        setCoberturaPorFichero(null);
      });
  };

  useEffect(cargarLista, []);

  // El agente escribe ficheros .feature directamente en disco (sin pasar por `guardarEscenario` de
  // esta pestaña) cuando genera un escenario desde la consola global. Sin esto, la lista de la
  // izquierda se queda congelada en lo que había al abrir la pestaña — bug real reportado por el
  // usuario. `corridaActiva` pasa de un id a `null` cuando el turno termina: ese flanco de bajada es
  // la señal de "puede haber ficheros nuevos", así que se recarga la lista y la trazabilidad ahí.
  const corridaActivaAnterior = useRef(corridaActiva ?? null);
  useEffect(() => {
    if (corridaActivaAnterior.current && !corridaActiva) {
      cargarLista();
    }
    corridaActivaAnterior.current = corridaActiva ?? null;
  }, [corridaActiva]);

  useEffect(() => {
    if (!seleccionado) {
      setContenido("");
      return;
    }
    setCargando(true);
    setError(null);
    obtenerEscenario(seleccionado)
      .then((respuesta) => {
        setContenido(respuesta.contenido);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, [seleccionado]);

  const guardar = () => {
    if (!seleccionado) return;
    setGuardando(true);
    setError(null);
    guardarEscenario(seleccionado, contenido)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="redactar" panelId="lista" titulo="Features y escenarios" disposicionPorDefecto={{ x: 0, y: 0, w: 30, h: 100, z: 1 }}>
          {escenarios.length === 0 ? (
            <p className="p-3 text-xs text-text-dim">Sin ficheros .feature todavía en tests/features/.</p>
          ) : (
            <ul className="flex flex-col gap-0.5 overflow-auto p-1.5">
              {escenarios.map((nombre) => {
                const cobertura = coberturaPorFichero?.get(nombre);
                const badge = cobertura ? badgeDeFichero(cobertura) : undefined;
                return (
                  <li key={nombre}>
                    <button
                      type="button"
                      onClick={() => {
                        setSeleccionado(nombre);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-6 px-2 py-1.5 text-left text-xs ${
                        nombre === seleccionado ? "bg-accent-bg font-semibold text-accent-soft" : "text-text-muted hover:text-text"
                      }`}
                    >
                      <span className="truncate">{nombre}</span>
                      {badge && <span className={`shrink-0 text-2xs ${COLOR_COBERTURA[badge]}`}>{ETIQUETA_COBERTURA[badge]}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel tabId="redactar" panelId="detalle" titulo="Detalle del escenario" disposicionPorDefecto={{ x: 31.5, y: 0, w: 68.5, h: 100, z: 1 }}>
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un escenario de la lista.</p>
            ) : (
              <>
                <textarea
                  value={contenido}
                  onChange={(e) => {
                    setContenido(e.target.value);
                  }}
                  disabled={cargando}
                  spellCheck={false}
                  className="flex-1 resize-none rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-xs text-text-bright disabled:opacity-50"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || cargando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
