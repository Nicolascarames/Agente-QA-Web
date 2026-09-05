import { AccionDeshabilitada } from "./AccionDeshabilitada";

export function Generar() {
  return (
    <AccionDeshabilitada
      titulo="Generar"
      descripcion="Convierte los ficheros .feature de Redactar en tests Playwright en TypeScript."
      motivo="Necesita ficheros .feature en .agente-qa/features/, que hoy no escribe ningún agente (el generador-mcp no existe todavía)."
      etiquetaBoton="Generar tests"
    />
  );
}
