import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { InsigniasEjes } from "../InsigniasEjes";
import { catalogoResuelto } from "../catalogo/catalogo";
import { analizarLinea, type Sugerencia } from "./analizarLinea";

// Caja de texto de la consola global (Bloque 7) con autocompletado: pinta la lista de sugerencias
// (desplegada hacia arriba, porque la caja vive al pie del panel) y traduce las teclas de
// fig/warp/gh (↑↓ mueve, Tab/Enter acepta, Esc cierra, `?` abre la ficha). Toda la inteligencia de
// qué sugerir vive en `analizarLinea.ts`, puro y sin DOM: este componente solo lee
// `selectionStart` del `<input>` y aplica lo que esa función devuelve.
export interface AutocompletadoProps {
  valor: string;
  onCambiarValor: (texto: string) => void;
  /** Ejecuta el comando escrito; se llama con la lista de sugerencias cerrada (Enter normal). */
  onEnviar: () => void;
  /** Abre el cajón de detalle (Bloque 4) sobre la ficha de la sugerencia marcada. */
  onAbrirFicha: (id: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export function Autocompletado({ valor, onCambiarValor, onEnviar, onAbrirFicha, disabled, placeholder }: AutocompletadoProps) {
  // Catálogo calculado una vez: `catalogoResuelto()` construye árboles nuevos en cada llamada y la
  // consola se re-renderiza en cada evento de la corrida activa.
  const catalogo = useMemo(() => catalogoResuelto(), []);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [cursor, setCursor] = useState(valor.length);
  // Cerrada "a mano" con Esc, hasta que el texto vuelva a cambiar (escribir reabre la lista).
  const [cerrada, setCerrada] = useState(false);
  const [indiceMarcado, setIndiceMarcado] = useState(0);

  const analisis = useMemo(() => analizarLinea(valor, cursor, catalogo), [valor, cursor, catalogo]);
  const sugerencias = cerrada ? [] : analisis.sugerencias;

  // La marca vuelve a la primera sugerencia cada vez que cambia de qué se está sugiriendo (otro
  // token, otro tipo, otra lista) para no arrastrar un índice que ya no corresponde a nada.
  useEffect(() => {
    setIndiceMarcado(0);
  }, [analisis.tipo, analisis.inicioToken, analisis.sugerencias.length]);

  function leerCursor(evento: { currentTarget: HTMLInputElement }) {
    setCursor(evento.currentTarget.selectionStart ?? evento.currentTarget.value.length);
  }

  function aceptar(sugerencia: Sugerencia) {
    const antes = valor.slice(0, analisis.inicioToken);
    const despues = valor.slice(analisis.inicioToken + analisis.tokenActual.length).trimStart();
    const textoNuevo = `${antes}${sugerencia.inserta} ${despues}`;
    const cursorNuevo = antes.length + sugerencia.inserta.length + 1;
    onCambiarValor(textoNuevo);
    setCursor(cursorNuevo);
    setCerrada(false);
    // Cambiar `value` no mueve solo el cursor real del input: hay que fijarlo tras el re-render.
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorNuevo, cursorNuevo);
    });
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (sugerencias.length > 0) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        setIndiceMarcado((indice) => (indice + 1) % sugerencias.length);
        return;
      }
      if (evento.key === "ArrowUp") {
        evento.preventDefault();
        setIndiceMarcado((indice) => (indice - 1 + sugerencias.length) % sugerencias.length);
        return;
      }
      if (evento.key === "Tab" || evento.key === "Enter") {
        evento.preventDefault();
        aceptar(sugerencias[indiceMarcado]);
        return;
      }
      if (evento.key === "Escape") {
        evento.preventDefault();
        setCerrada(true);
        return;
      }
      if (evento.key === "?") {
        evento.preventDefault();
        onAbrirFicha(sugerencias[indiceMarcado].rutaFicha);
        return;
      }
    }
    if (evento.key === "Enter") {
      onEnviar();
    }
  }

  return (
    <div className="relative flex-1">
      {sugerencias.length > 0 && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 z-20 mb-1 max-h-64 w-full overflow-y-auto rounded-6 border border-border-strong bg-bg-elev shadow-[var(--sidebar-shadow)]"
        >
          {sugerencias.map((sugerencia, indice) => (
            <li
              key={`${sugerencia.rutaFicha}-${sugerencia.inserta}`}
              role="option"
              aria-selected={indice === indiceMarcado}
              onMouseEnter={() => setIndiceMarcado(indice)}
              onMouseDown={(evento) => {
                // `onMouseDown`, no `onClick`: dispara antes de que el input pierda el foco.
                evento.preventDefault();
                aceptar(sugerencia);
              }}
              className={`flex cursor-pointer items-center justify-between gap-2 border-b border-border-soft px-2 py-1.5 text-xs last:border-b-0 ${
                indice === indiceMarcado ? "bg-bg-panel" : ""
              }`}
            >
              <div className="min-w-0">
                <code className="text-text-strong">{sugerencia.titulo}</code>
                {sugerencia.descripcion && <p className="mt-0.5 truncate text-2xs text-text-muted">{sugerencia.descripcion}</p>}
              </div>
              <InsigniasEjes ejes={sugerencia.ejes} />
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        value={valor}
        onChange={(evento) => {
          onCambiarValor(evento.target.value);
          setCerrada(false);
          leerCursor(evento);
        }}
        onClick={leerCursor}
        onKeyUp={leerCursor}
        onSelect={leerCursor}
        onKeyDown={alTeclear}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-6 border border-border-strong bg-bg-panel px-2 py-1 text-sm text-text-strong"
      />
    </div>
  );
}
