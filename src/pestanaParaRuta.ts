// Pieza 3 de docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md: a qué
// pestaña saltar cuando llega una pregunta de confirmación sobre un fichero que el agente acaba de
// escribir. Pura y testeable: no sabe nada de React ni del estado de la app. `file_path` de
// Write/Edit del SDK es siempre una ruta ABSOLUTA (ver sdk-tools.d.ts), así que el match es por
// segmento de ruta, no por prefijo — funciona igual con una ruta relativa en los tests.
export type PestanaDestino = "Redactar" | "Generar";

export function pestanaParaRuta(rutaFichero: string): PestanaDestino | null {
  const normalizada = rutaFichero.replaceAll("\\", "/");
  if (/(^|\/)tests\/features\/[^/]+\.feature$/.test(normalizada)) return "Redactar";
  if (/(^|\/)tests\/(pages\/[^/]+\.page\.ts|specs\/[^/]+\.spec\.ts)$/.test(normalizada)) return "Generar";
  return null;
}
