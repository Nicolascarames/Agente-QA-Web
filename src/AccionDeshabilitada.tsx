// Bloque 5: patrón compartido de las pestañas de operación cuyo agente todavía no existe. El
// cromo del panel — asa ⠿, título en ámbar, borde, fondo, radio 10 — ya lo pone Panel.tsx: este
// fichero solo aporta el contenido vacío que va dentro (el motivo, centrado).
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
