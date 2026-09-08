import { useEffect, useRef, useState } from "react";
import { InsigniasEjes } from "./InsigniasEjes";
import type { FichaResuelta } from "./catalogo/catalogo";
import { DESCRIPCION_CONDUCTOR, DESCRIPCION_COSTE } from "./catalogo/ejes";
import { ejesConOpcion } from "./catalogo/ejesConOpcion";
import type { NotaFicha } from "./catalogo/tipos";

// Cajón de detalle (Bloque 4): la plantilla completa de una ficha, abierto por la derecha por
// encima de todo. `resuelta` vive en `App.tsx` (lo abrirán también el buscador y la consola
// asistida más adelante) — este componente solo pinta lo que le llega y no sabe de dónde sale.
//
// Se mantiene montado incluso con `resuelta === null` para poder animar la salida: guarda la
// última ficha no nula en `mostrada` y sigue pintándola mientras el cajón se desliza fuera.
export interface CajonFichaProps {
  resuelta: FichaResuelta | null;
  onCerrar: () => void;
  /** Pulsar un ejemplo con `plantilla: true` lo manda a la consola asistida (Bloque 8), que lo
   *  inserta con el primer hueco `<...>` ya seleccionado — ver `plantillas.ts`. */
  onInsertarEjemplo: (texto: string) => void;
  /** Opción (`--auto`, etc.) que debe aparecer ya resaltada al abrir, en vez de en reposo — la usa
   *  el `?` del autocompletado (Bloque 7) sobre una sugerencia de flag. `null`/`undefined` abre el
   *  cajón sin nada resaltado, igual que antes. */
  opcionInicial?: string | null;
}

// Igual que el `:not([tabindex="-1"])` del resto de la web: selector de "cosas que Tab visita",
// usado tanto para el primer foco al abrir como para el trampeo del propio Tab.
const SELECTOR_FOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focablesDe(nodo: HTMLElement): HTMLElement[] {
  return Array.from(nodo.querySelectorAll<HTMLElement>(SELECTOR_FOCABLES));
}

const COLOR_NOTA: Record<NotaFicha["tipo"], string> = {
  ok: "border-ok text-ok",
  aviso: "border-accent text-accent",
  peligro: "border-danger text-danger",
};

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-2xs font-semibold uppercase tracking-[.05em] text-text-faint">{titulo}</h3>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-xs text-text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function CajonFicha({ resuelta, onCerrar, onInsertarEjemplo, opcionInicial }: CajonFichaProps) {
  const abierto = resuelta !== null;

  // Se conserva la última ficha no nula para que el cajón siga mostrando su contenido mientras
  // la transición de salida se anima; `resuelta === null` solo mueve `abierto` a false.
  const [mostrada, setMostrada] = useState<FichaResuelta | null>(null);
  useEffect(() => {
    if (resuelta) setMostrada(resuelta);
  }, [resuelta]);

  // Flag (`"--auto"`) sobre el que está el ratón o el foco de teclado; `null` en reposo. Al abrir
  // arranca en `opcionInicial` en vez de siempre `null`, para que `?` sobre una sugerencia de flag
  // del autocompletado (Bloque 7) abra el cajón con esa opción ya resaltada.
  const [flagFoco, setFlagFoco] = useState<string | null>(null);
  useEffect(() => {
    setFlagFoco(opcionInicial ?? null);
  }, [resuelta, opcionInicial]);

  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  // Foco atrapado + Esc + devolver el foco a quien abrió el cajón, todo en un único efecto que
  // solo vive mientras `abierto` es true.
  useEffect(() => {
    if (!abierto) return;
    disparadorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodo = contenedorRef.current;
    focablesDe(nodo ?? document.createElement("div"))[0]?.focus();

    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== "Tab" || !nodo) return;
      const focables = focablesDe(nodo);
      if (focables.length === 0) return;
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      disparadorRef.current?.focus();
    };
  }, [abierto, onCerrar]);

  if (!mostrada) return null;

  const { ficha } = mostrada;
  const opciones = mostrada.tipo === "comando" ? mostrada.cli.opciones : [];
  const opcionEnfocada = flagFoco ? (ficha.opciones[flagFoco] ?? null) : null;
  const ejesEfectivos = ejesConOpcion(ficha, opcionEnfocada);

  return (
    <>
      {/* Velo: mismo papel que el de la sidebar móvil en App.tsx, pero por encima de toda la
          app (z-[80]), no solo de la sidebar. */}
      <div
        className={`fixed inset-0 z-[80] bg-[var(--backdrop)] transition-opacity duration-200 ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <div
        ref={contenedorRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={!abierto}
        // Mientras está cerrado (incluida la transición de salida) queda fuera del árbol de
        // accesibilidad y del orden de Tab, aunque siga montado para poder animarlo.
        inert={!abierto}
        aria-label={`Detalle de ${ficha.ruta.join(" ")}`}
        className={`fixed inset-y-0 right-0 z-[90] flex w-[min(40vw,560px)] min-w-[420px] flex-col overflow-hidden border-l border-border-soft bg-bg-elev shadow-[var(--sidebar-shadow)] transition-transform duration-200 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border-soft px-4 pb-3 pt-4">
          <div className="min-w-0">
            <code className="text-md font-bold text-accent-soft">{ficha.ruta.join(" ")}</code>
            <div className="mt-1.5">
              <InsigniasEjes ejes={ejesEfectivos} />
            </div>
            {opcionEnfocada?.ejes && (
              <p className="mt-1 text-2xs text-agent">
                con esta opción: {DESCRIPCION_CONDUCTOR[ejesEfectivos.conductor].etiqueta} ·{" "}
                {DESCRIPCION_COSTE[ejesEfectivos.coste].etiqueta}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="rounded-6 border border-border-strong bg-bg-panel px-2 py-1 text-sm text-text-strong"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <p className="text-sm text-text">{ficha.unaLinea}</p>

          <Lista titulo="Qué hace" items={ficha.queHace} />
          <Lista titulo="Qué deja" items={ficha.queDeja} />
          <Lista titulo="Cuándo usarlo" items={ficha.cuandoUsarlo} />
          <Lista titulo="Cuándo NO" items={ficha.cuandoNo} />

          {opciones.length > 0 && (
            <section>
              <h3 className="text-2xs font-semibold uppercase tracking-[.05em] text-text-faint">Opciones</h3>
              <ul className="mt-1 flex flex-col gap-2">
                {opciones.map((opcion) => {
                  const editorial = ficha.opciones[opcion.larga];
                  return (
                    <li
                      key={opcion.flags}
                      tabIndex={0}
                      onMouseEnter={() => setFlagFoco(opcion.larga)}
                      onMouseLeave={() => setFlagFoco((actual) => (actual === opcion.larga ? null : actual))}
                      onFocus={() => setFlagFoco(opcion.larga)}
                      onBlur={() => setFlagFoco((actual) => (actual === opcion.larga ? null : actual))}
                      className="rounded-6 border border-border-soft bg-bg-panel px-2 py-1.5 text-xs text-text-dim"
                    >
                      <code className="text-text-faint">{opcion.flags}</code> — {opcion.descripcion}
                      {editorial?.matiz && <p className="mt-0.5 text-2xs text-text-muted">{editorial.matiz}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {ficha.ejemplos.length > 0 && (
            <section>
              <h3 className="text-2xs font-semibold uppercase tracking-[.05em] text-text-faint">Ejemplos</h3>
              <ul className="mt-1 flex flex-col gap-2">
                {ficha.ejemplos.map((ejemplo) =>
                  ejemplo.plantilla ? (
                    <li key={ejemplo.texto}>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertarEjemplo(ejemplo.texto);
                        }}
                        title="Insertar en la consola"
                        className="w-full rounded-6 border border-border-soft bg-bg-sunken p-2 text-left hover:border-accent"
                      >
                        <code className="block break-all text-2xs text-accent-soft">{ejemplo.texto}</code>
                        <p className="mt-1 text-2xs text-text-muted">{ejemplo.explica}</p>
                      </button>
                    </li>
                  ) : (
                    <li key={ejemplo.texto} className="rounded-6 border border-border-soft bg-bg-sunken p-2">
                      <code className="block break-all text-2xs text-accent-soft">{ejemplo.texto}</code>
                      <p className="mt-1 text-2xs text-text-muted">{ejemplo.explica}</p>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          {ficha.notas.length > 0 && (
            <section>
              <h3 className="text-2xs font-semibold uppercase tracking-[.05em] text-text-faint">Notas</h3>
              <ul className="mt-1 flex flex-col gap-1.5">
                {ficha.notas.map((nota) => (
                  <li key={nota.texto} className={`rounded-6 border-l-2 pl-2 text-xs ${COLOR_NOTA[nota.tipo]}`}>
                    {nota.texto}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
