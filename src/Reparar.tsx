// Bloque 6 le da a esta pestaña el aspecto del mockup (Panel + BarraLanzamientoDeshabilitada,
// como Redactar/Generar en el Bloque 5); hasta entonces conserva el cartel suelto de antes,
// solo reescrito en línea porque AccionDeshabilitada.tsx cambió de forma en el Bloque 5.
const MOTIVO = "Necesita resultados de test fallidos del Ejecutor, que todavía no existe.";

export function Reparar() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-accent">Reparar</h2>
      <p className="max-w-2xl text-sm text-text/80">
        Cuando un test falla porque el propio test estaba mal, propone la corrección y vuelve a probar.
      </p>
      <div className="max-w-2xl rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">{MOTIVO}</div>
      <button
        type="button"
        disabled
        title={MOTIVO}
        className="w-fit cursor-not-allowed rounded-md border border-text/20 bg-text/5 px-4 py-2 text-sm text-text/40"
      >
        Reparar fallos
      </button>
    </div>
  );
}
