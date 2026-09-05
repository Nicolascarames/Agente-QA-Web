export function Reports() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-accent">Reports</h2>
      <p className="max-w-2xl text-sm text-text/80">Vista de los resultados de la última corrida de tests.</p>
      <div className="max-w-2xl rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
        Vacío: necesita resultados de test, que solo llena el Ejecutor, y el Ejecutor todavía no existe.
      </div>
    </div>
  );
}
