import { promises as fs } from "node:fs";
import { AppMapSchema, LocatorEntrySchema, parseAppMap, type LocatorEntry } from "agente-qa-contract";
import { projectPaths } from "agente-qa-contract/project";
import type { CuerpoCorreccionLocalizador } from "../shared/tipos.js";

/**
 * Subconjunto editable de un `LocatorEntry` desde el panel de detalle (Bloque 7): `kind`, `ts` y
 * `disambiguatedBy`, tal como los define el contrato — sin reinventar su validación a mano.
 */
const CampoEditableLocalizadorSchema = LocatorEntrySchema.pick({ kind: true, ts: true, disambiguatedBy: true });

export type CorregirLocalizadorResultado = { ok: true; locator: LocatorEntry } | { ok: false; motivo: string };

/**
 * Corrige un localizador ya existente de `map.json` desde la web (`web-manual`): valida el
 * subconjunto editable, revalida el `AppMap` completo con el cambio aplicado ANTES de escribir a
 * disco, y solo entonces escribe. Si la corrección deja el mapa inválido, no toca el fichero.
 */
export async function corregirLocalizador(
  rootDir: string,
  cuerpo: CuerpoCorreccionLocalizador,
  versionAgenteQaWeb: string
): Promise<CorregirLocalizadorResultado> {
  const camposValidados = CampoEditableLocalizadorSchema.safeParse({
    kind: cuerpo.kind,
    ts: cuerpo.ts,
    disambiguatedBy: cuerpo.disambiguatedBy,
  });
  if (!camposValidados.success) {
    const motivo = camposValidados.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return { ok: false, motivo: `Localizador inválido: ${motivo}` };
  }
  if (camposValidados.data.ts.trim().length === 0) {
    return { ok: false, motivo: 'Localizador inválido: "ts" no puede estar vacío.' };
  }

  const paths = projectPaths(rootDir);
  let contenido: string;
  try {
    contenido = await fs.readFile(paths.mapPath, "utf8");
  } catch {
    return { ok: false, motivo: "Este proyecto no tiene map.json todavía." };
  }

  let json: unknown;
  try {
    json = JSON.parse(contenido);
  } catch {
    return { ok: false, motivo: "map.json no es JSON válido." };
  }

  const actual = parseAppMap(json);
  if (!actual.ok) {
    return { ok: false, motivo: "map.json no cumple el contrato: no se puede corregir desde aquí." };
  }

  const pantalla = actual.map.screens.find((screen) => screen.id === cuerpo.screenId);
  if (!pantalla) {
    return { ok: false, motivo: `No existe la pantalla "${cuerpo.screenId}".` };
  }
  const indiceLocalizador = pantalla.locators.findIndex((locator) => locator.name === cuerpo.locatorName);
  if (indiceLocalizador === -1) {
    return { ok: false, motivo: `La pantalla "${cuerpo.screenId}" no tiene el localizador "${cuerpo.locatorName}".` };
  }

  const anterior = pantalla.locators[indiceLocalizador];
  const ahora = new Date().toISOString();
  const localizadorActualizado: LocatorEntry = {
    name: anterior.name,
    kind: camposValidados.data.kind,
    ...(anterior.accessibleName !== undefined ? { accessibleName: anterior.accessibleName } : {}),
    ts: camposValidados.data.ts,
    count: anterior.count,
    ...(camposValidados.data.disambiguatedBy ? { disambiguatedBy: camposValidados.data.disambiguatedBy } : {}),
    ...(anterior.stateId !== undefined ? { stateId: anterior.stateId } : {}),
    ...(anterior.attributes !== undefined ? { attributes: anterior.attributes } : {}),
    producedBy: { agent: "web-manual", version: versionAgenteQaWeb, at: ahora },
    verifiedAt: ahora,
    ...(anterior.fragile !== undefined ? { fragile: anterior.fragile } : {}),
  };

  const screensActualizadas = actual.map.screens.map((screen) =>
    screen.id === cuerpo.screenId
      ? { ...screen, locators: screen.locators.map((locator, i) => (i === indiceLocalizador ? localizadorActualizado : locator)) }
      : screen
  );
  const mapaActualizado = { ...actual.map, screens: screensActualizadas };

  const revalidado = AppMapSchema.safeParse(mapaActualizado);
  if (!revalidado.success) {
    const motivo = revalidado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return { ok: false, motivo: `La corrección deja map.json inválido, no se ha escrito nada: ${motivo}` };
  }

  await fs.writeFile(paths.mapPath, JSON.stringify(revalidado.data, null, 2) + "\n", "utf8");
  return { ok: true, locator: localizadorActualizado };
}
