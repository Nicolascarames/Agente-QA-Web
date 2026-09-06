// Bloque 5: patrón compartido de las cuatro pestañas de operación cuyo agente todavía no existe
// (Redactar y Generar en este bloque; Ejecutar y Reparar en el Bloque 6). El cromo del panel —
// asa ⠿, título en ámbar, borde, fondo, radio 10 — ya lo pone Panel.tsx: este fichero solo aporta
// el contenido vacío que va dentro (el motivo, centrado) y la barra de lanzamiento del mockup en
// su variante inerte, para no fingir un lanzamiento que no existe.
export interface AccionDeshabilitadaProps {
  motivo: string;
}

export function AccionDeshabilitada({ motivo }: AccionDeshabilitadaProps) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center">
      <p className="max-w-xs text-xs text-text-dim">{motivo}</p>
    </div>
  );
}

export interface BarraLanzamientoDeshabilitadaProps {
  motivo: string;
  etiquetaBoton: string;
}

// Misma silueta que BarraLanzamiento.tsx (🎯 Ámbito / 🤖 Agente / 💰 coste / botón de lanzar),
// pero sin ninguno de sus datos reales: aquí no hay puerta ni agente que lanzar, así que cada
// control queda en un marcador neutro (—) en vez de fabricar opciones ("todo/selección/objetivo",
// nombres de subagente…) que no corresponden a ningún agente que exista todavía. El motivo va en
// el `title` del botón de lanzar, que es el único control con algo que decir.
export function BarraLanzamientoDeshabilitada({ motivo, etiquetaBoton }: BarraLanzamientoDeshabilitadaProps) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-10 border border-border bg-bg-panel px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xs uppercase tracking-[.04em] text-text-faint">🎯 Ámbito</span>
        <div className="flex overflow-hidden rounded-6 border border-border-soft">
          <button type="button" disabled className="cursor-not-allowed px-2.5 py-1 text-xs text-text-ghost">
            —
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xs uppercase tracking-[.04em] text-text-faint">🤖 Agente</span>
        <span className="text-xs text-text-ghost">—</span>
      </div>

      <span className="ml-auto whitespace-nowrap text-xs text-text-ghost">💰 —</span>

      <button
        type="button"
        disabled
        title={motivo}
        className="cursor-not-allowed rounded-7 border border-border-soft bg-bg-sunken px-3.5 py-1.5 text-xs font-bold text-text-ghost"
      >
        {etiquetaBoton}
      </button>
    </div>
  );
}
