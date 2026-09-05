// Extraído de Redactar/Generar/Ejecutar/Reparar: las cuatro pestañas de operación
// sin agente comparten exactamente el mismo patrón — botón principal
// deshabilitado con el motivo visible, nunca datos inventados.
export interface AccionDeshabilitadaProps {
  titulo: string;
  descripcion: string;
  motivo: string;
  etiquetaBoton: string;
}

export function AccionDeshabilitada({ titulo, descripcion, motivo, etiquetaBoton }: AccionDeshabilitadaProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-accent">{titulo}</h2>
      <p className="max-w-2xl text-sm text-text/80">{descripcion}</p>
      <div className="max-w-2xl rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
        {motivo}
      </div>
      <button
        type="button"
        disabled
        title={motivo}
        className="w-fit cursor-not-allowed rounded-md border border-text/20 bg-text/5 px-4 py-2 text-sm text-text/40"
      >
        {etiquetaBoton}
      </button>
    </div>
  );
}
