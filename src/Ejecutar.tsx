// Bloque 6 le da a esta pestaña el aspecto del mockup (Panel + BarraLanzamientoDeshabilitada,
// como Redactar/Generar en el Bloque 5); hasta entonces conserva el cartel suelto de antes,
// solo reescrito en línea porque AccionDeshabilitada.tsx cambió de forma en el Bloque 5.
const MOTIVO = "Necesita tests en e2e/, que hoy no escribe ningún agente (el generador todavía no existe).";

export function Ejecutar() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-accent">Ejecutar</h2>
      <p className="max-w-2xl text-sm text-text/80">Corre los tests Playwright de e2e/ y guarda sus resultados.</p>
      <div className="max-w-2xl rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">{MOTIVO}</div>
      <button
        type="button"
        disabled
        title={MOTIVO}
        className="w-fit cursor-not-allowed rounded-md border border-text/20 bg-text/5 px-4 py-2 text-sm text-text/40"
      >
        Ejecutar tests
      </button>
    </div>
  );
}
