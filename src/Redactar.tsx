import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { EditorCodigo } from "./EditorCodigo";
import { guardarEscenario, obtenerEscenario, obtenerEscenarios, obtenerTrazabilidad } from "./api";
import { pedirAlAgente, rutaUltimoFicheroEscrito } from "./ConsolaGlobal";
import { pestanaParaRuta } from "./pestanaParaRuta";
import type { CoberturaEscenario, EventoNdjson } from "../shared/tipos";

// GAP=1.5 entre lista y detalle, mismo patrón que Dashboard/Reports (ver ESTADO.md): un tercio para
// la lista, dos tercios para el detalle, sin dejar hueco ni sobrar ancho.
const GAP = 1.5;
const ANCHO_LISTA = (100 - GAP) / 3;
const ANCHO_DETALLE = ANCHO_LISTA * 2;

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

// Aviso de corrección (encima del textarea, panel "Detalle del escenario"): solo aplica a estos dos
// estados de `EstadoCobertura`, así que su color de borde vive aparte de `COLOR_COBERTURA`.
const BORDE_AVISO_COBERTURA: Record<"no-cubierto" | "desincronizado", string> = {
  "no-cubierto": "border-danger",
  desincronizado: "border-accent-soft",
};

function badgeDeFichero(escenarios: CoberturaEscenario[]): BadgeCobertura {
  if (escenarios.some((e) => e.estado === "no-cubierto")) return "no-cubierto";
  if (escenarios.some((e) => e.estado === "desincronizado")) return "desincronizado";
  if (escenarios.some((e) => e.resultado === "failed" || e.resultado === "timedOut")) return "rojo";
  if (escenarios.every((e) => e.resultado === "passed")) return "verde";
  return "pendiente";
}

/** Prompt que el botón de "corregir cobertura" del panel de detalle manda a la consola global vía
 *  `pedirAlAgente`: una frase por escenario sin cubrir o desincronizado, agrupadas por motivo
 *  (primero los desincronizados, luego los que no tienen spec), y el cierre pidiendo verde. */
export function promptCorreccionCobertura(featureFichero: string, escenarios: CoberturaEscenario[]): string {
  const nombreBase = featureFichero.replace(/\.feature$/, "");
  const lineas: string[] = [];
  for (const e of escenarios) {
    if (e.estado !== "desincronizado") continue;
    lineas.push(
      `El escenario «${e.escenario}» de tests/features/${featureFichero} está desincronizado con tests/specs/${e.specFichero}: sus test.step no coinciden exactamente con los pasos del escenario. Actualiza el spec (y su page object si hace falta) para que tenga un test.step por cada paso, con el mismo texto literal y en el mismo orden. El .feature es la referencia: no lo cambies.`,
    );
  }
  for (const e of escenarios) {
    if (e.estado !== "no-cubierto") continue;
    lineas.push(
      `El escenario «${e.escenario}» de tests/features/${featureFichero} no tiene spec todavía. Genera su page object y tests/specs/${nombreBase}.spec.ts siguiendo la skill.`,
    );
  }
  lineas.push("Ejecuta el test hasta que esté en verde.");
  return lineas.join("\n\n");
}

// Bloque 6: misma geometría que `panels.redactar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero ahora con datos reales de `tests/features/*.feature` bajo el proyecto
// activo, en vez de los tres paneles vacíos del Bloque 5.
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece: era un `🎯 Ámbito / 🤖 Agente / 💰
// coste` de mentira para un agente que no existía. Ahora el agente existe y se lanza escribiendo
// en el chat de la derecha — una segunda barra de "lanzar" sería redundante con esa caja de texto.

export function Redactar({ corridaActiva, eventos }: { corridaActiva?: string | null; eventos?: EventoNdjson[] }) {
  const [escenarios, setEscenarios] = useState<string[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [contenido, setContenido] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coberturaPorFichero, setCoberturaPorFichero] = useState<Map<string, CoberturaEscenario[]> | null>(null);
  // Fichero .feature -> firma de los escenarios problemáticos en el momento de pulsar "corregir": si
  // la cobertura recargada sigue dando la misma firma, el botón sigue deshabilitado; en cuanto cambia
  // (el agente ya corrigió algo, o rompió otra cosa), se vuelve a habilitar.
  const [firmaCorreccionEnviada, setFirmaCorreccionEnviada] = useState<Record<string, string>>({});

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

  // La pregunta de confirmación de una puerta (Pieza 3) llega a MEDIA corrida, antes del flanco de
  // bajada de arriba — y `ConsolaGlobal` salta de pestaña llamando a `setPestana`, que en `App.tsx`
  // solo remonta el componente si la pestaña activa CAMBIA. Si ya se estaba en Redactar (p.ej. tras
  // revisar un fichero anterior en la misma conversación), ese salto es un no-op y la lista se queda
  // congelada sin el `.feature` que el agente acaba de escribir — bug real reportado por el usuario.
  // Recargar aquí también, en cuanto llega la pregunta, con el mismo criterio de qué pestaña le toca.
  const requestIdVisto = useRef<unknown>(undefined);
  useEffect(() => {
    if (!eventos) return;
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type !== "agente.pregunta") return;
    const requestId = (ultimo.data as { requestId?: unknown } | undefined)?.requestId;
    if (requestId === requestIdVisto.current) return;
    requestIdVisto.current = requestId;
    const ruta = rutaUltimoFicheroEscrito(eventos);
    if (ruta && pestanaParaRuta(ruta) === "Redactar") cargarLista();
  }, [eventos]);

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
    setGuardado(false);
  }, [seleccionado]);

  const guardar = () => {
    if (!seleccionado) return;
    setGuardando(true);
    setGuardado(false);
    setError(null);
    guardarEscenario(seleccionado, contenido)
      .then(() => {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  // Escenarios sin cubrir/desincronizados del fichero abierto — vacío si está todo cubierto y en
  // verde, o si aún no ha llegado la trazabilidad.
  const coberturaSeleccionada = seleccionado ? (coberturaPorFichero?.get(seleccionado) ?? []) : [];
  const escenariosACorregir = coberturaSeleccionada.filter((e) => e.estado === "no-cubierto" || e.estado === "desincronizado");
  const firmaACorregir = escenariosACorregir.map((e) => `${e.estado}:${e.escenario}`).join("|");
  const correccionEnviada = seleccionado !== null && firmaACorregir !== "" && firmaCorreccionEnviada[seleccionado] === firmaACorregir;
  const hayNoCubierto = escenariosACorregir.some((e) => e.estado === "no-cubierto");
  const hayDesincronizado = escenariosACorregir.some((e) => e.estado === "desincronizado");
  const etiquetaBotonCorregir = hayNoCubierto && hayDesincronizado ? "Corregir con el agente" : hayNoCubierto ? "Generar el test" : "Sincronizar el spec";

  const corregirCobertura = () => {
    if (!seleccionado || escenariosACorregir.length === 0) return;
    pedirAlAgente(promptCorreccionCobertura(seleccionado, escenariosACorregir));
    setFirmaCorreccionEnviada((actual) => ({ ...actual, [seleccionado]: firmaACorregir }));
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="redactar" panelId="lista" titulo="Features y escenarios" disposicionPorDefecto={{ x: 0, y: 0, w: ANCHO_LISTA, h: 100, z: 1 }}>
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
                      {/* `truncate` por sí solo no basta en un item flex-row: sin `min-w-0` su
                          mínimo sigue siendo el ancho completo del texto (min-width:auto), así que
                          nunca llega a encogerse lo bastante para que el ellipsis entre en juego —
                          el badge (`shrink-0`) queda empujado fuera de la vista con nombres largos. */}
                      <span title={nombre} className="min-w-0 flex-1 truncate">
                        {nombre}
                      </span>
                      {badge && <span className={`shrink-0 text-2xs ${COLOR_COBERTURA[badge]}`}>{ETIQUETA_COBERTURA[badge]}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          tabId="redactar"
          panelId="detalle"
          titulo="Detalle del escenario"
          disposicionPorDefecto={{ x: ANCHO_LISTA + GAP, y: 0, w: ANCHO_DETALLE, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un escenario de la lista.</p>
            ) : (
              <>
                {escenariosACorregir.length > 0 && (
                  <div
                    className={`flex flex-col gap-1.5 rounded-7 border p-2 text-xs ${BORDE_AVISO_COBERTURA[hayNoCubierto ? "no-cubierto" : "desincronizado"]}`}
                  >
                    <ul className="flex flex-col gap-1">
                      {escenariosACorregir.map((e) => (
                        <li key={e.escenario} className={COLOR_COBERTURA[e.estado === "no-cubierto" ? "no-cubierto" : "desincronizado"]}>
                          <p className="whitespace-normal break-words font-semibold">{e.escenario}</p>
                          <p className="whitespace-normal break-words text-text-dim">
                            {e.estado === "no-cubierto"
                              ? "Todavía no hay spec para este escenario."
                              : `Los pasos del spec ${e.specFichero} no coinciden con los del escenario.`}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={corregirCobertura}
                      disabled={correccionEnviada}
                      className="self-start rounded-7 border border-accent bg-accent px-3 py-1 text-2xs font-bold text-on-accent disabled:opacity-50"
                    >
                      {correccionEnviada ? "Enviado a la consola" : etiquetaBotonCorregir}
                    </button>
                  </div>
                )}
                <EditorCodigo lenguaje="gherkin" valor={contenido} onCambio={setContenido} soloLectura={cargando} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || cargando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar"}
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
