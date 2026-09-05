import { AccionDeshabilitada } from "./AccionDeshabilitada";

export function Reparar() {
  return (
    <AccionDeshabilitada
      titulo="Reparar"
      descripcion="Cuando un test falla porque el propio test estaba mal, propone la corrección y vuelve a probar."
      motivo="Necesita resultados de test fallidos del Ejecutor, que todavía no existe."
      etiquetaBoton="Reparar fallos"
    />
  );
}
