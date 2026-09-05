import { AccionDeshabilitada } from "./AccionDeshabilitada";

export function Redactar() {
  return (
    <AccionDeshabilitada
      titulo="Redactar"
      descripcion="Convierte los candidatos de escenario verificados del mapa en ficheros .feature legibles."
      motivo="Necesita candidatos de escenario verificados en map.json, que hoy no genera ningún agente (el redactor-mcp no existe todavía)."
      etiquetaBoton="Redactar escenarios"
    />
  );
}
