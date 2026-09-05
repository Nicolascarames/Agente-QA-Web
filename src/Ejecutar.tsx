import { AccionDeshabilitada } from "./AccionDeshabilitada";

export function Ejecutar() {
  return (
    <AccionDeshabilitada
      titulo="Ejecutar"
      descripcion="Corre los tests Playwright de e2e/ y guarda sus resultados."
      motivo="Necesita tests en e2e/, que hoy no escribe ningún agente (el generador todavía no existe)."
      etiquetaBoton="Ejecutar tests"
    />
  );
}
