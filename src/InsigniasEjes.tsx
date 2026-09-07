import { DESCRIPCION_AGENTE, DESCRIPCION_CONDUCTOR, DESCRIPCION_COSTE, DESCRIPCION_ESTADO } from "./catalogo/ejes";
import type { DescripcionEje } from "./catalogo/ejes";
import type { EjesFicha } from "./catalogo/tipos";

// Fila de las cuatro insignias (conductor, agente, coste, estado) de una ficha. Presentacional y
// puro: solo pinta el `EjesFicha` que le pasan, nunca busca el catálogo por su cuenta. Así el
// cajón de detalle (Bloque 4) puede pasarle los ejes "efectivos" de la opción con foco, y la
// consola asistida (Bloque 7) los del comando autocompletado, sin que este componente sepa de
// dónde salen.
export interface InsigniasEjesProps {
  ejes: EjesFicha;
}

function Insignia({ descripcion }: { descripcion: DescripcionEje }) {
  // El color es siempre un token de tokens.css (p.ej. "--ok"), nunca un valor literal: el fondo
  // traslúcido se deriva de él con color-mix en vez de sumar un token "-bg" por cada eje.
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs"
      style={{
        color: `var(${descripcion.color})`,
        borderColor: `var(${descripcion.color})`,
        backgroundColor: `color-mix(in srgb, var(${descripcion.color}) 16%, transparent)`,
      }}
    >
      <span aria-hidden="true">{descripcion.icono}</span>
      {descripcion.etiqueta}
    </span>
  );
}

export function InsigniasEjes({ ejes }: InsigniasEjesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Insignia descripcion={DESCRIPCION_CONDUCTOR[ejes.conductor]} />
      <Insignia descripcion={DESCRIPCION_AGENTE[ejes.agente]} />
      <Insignia descripcion={DESCRIPCION_COSTE[ejes.coste]} />
      <Insignia descripcion={DESCRIPCION_ESTADO[ejes.estado]} />
    </div>
  );
}
