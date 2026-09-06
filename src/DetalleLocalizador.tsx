import { useCallback, useEffect, useState } from "react";
import type { LocatorEntry } from "agente-qa-contract";
import { corregirLocalizador } from "./api";

const KIND_OPCIONES: LocatorEntry["kind"][] = ["input", "button", "link", "select", "text", "heading"];

/**
 * Editor estructurado del único dato editable de toda la web (Bloque 7): `kind`/`ts`/
 * `disambiguatedBy` de un localizador ya existente. El resto de campos son de solo lectura.
 *
 * "Ambiguo" no tiene hoy un campo propio en el contrato para un localizador ya resuelto (el
 * `ambiguous` de la pantalla son candidatos SIN resolver, con otra forma — sin `count: 1` ni
 * `verifiedAt` — así que no encajan en este editor). La marca se deriva de `disambiguatedBy`
 * presente: si un localizador lo tiene, es porque hizo falta desambiguarlo entre varios
 * candidatos. Ya viaja en `GET /api/mapa` (parte de `LocatorEntry`), no hace falta un campo nuevo.
 */
export function DetalleLocalizador({
  screenId,
  locators,
  onGuardado,
  deshabilitado = false,
}: {
  screenId: string;
  locators: LocatorEntry[];
  onGuardado: () => void;
  /** `true` mientras hay una corrida en marcha (Explorar.tsx, estado `corriendo`): el servidor
   * rechaza la corrección en ese caso (hallazgo 2 de la revisión final de rama), así que el botón
   * se deshabilita también aquí para no dejar que el usuario pierda el cambio en un 400. */
  deshabilitado?: boolean;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [kind, setKind] = useState<LocatorEntry["kind"]>("button");
  const [ts, setTs] = useState("");
  const [disambiguatedBy, setDisambiguatedBy] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Cambiar de pantalla deja sin seleccionar: el localizador seleccionado era de la anterior.
  useEffect(() => {
    setSeleccionado(null);
    setMensaje(null);
  }, [screenId]);

  const seleccionar = useCallback((loc: LocatorEntry) => {
    setSeleccionado(loc.name);
    setKind(loc.kind);
    setTs(loc.ts);
    setDisambiguatedBy(loc.disambiguatedBy ?? "");
    setMensaje(null);
  }, []);

  const localizador = locators.find((loc) => loc.name === seleccionado);

  const guardar = useCallback(() => {
    if (!localizador) return;
    setMensaje(null);
    setGuardando(true);
    void corregirLocalizador({
      screenId,
      locatorName: localizador.name,
      kind,
      ts,
      ...(disambiguatedBy.trim() ? { disambiguatedBy: disambiguatedBy.trim() } : {}),
    })
      .then(() => {
        setMensaje("Guardado.");
        onGuardado();
      })
      .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)))
      .finally(() => setGuardando(false));
  }, [localizador, screenId, kind, ts, disambiguatedBy, onGuardado]);

  return (
    <div>
      <p className="mb-1 text-2xs uppercase tracking-[.04em] text-text-faint">Localizadores ({locators.length})</p>
      <ul className="flex flex-col gap-0.5">
        {locators.map((loc) => (
          <li key={loc.name}>
            <button
              type="button"
              onClick={() => seleccionar(loc)}
              className={`text-left text-xs ${loc.name === seleccionado ? "text-accent-soft" : "text-text hover:text-accent-soft"}`}
            >
              <span className="font-mono">{loc.name}</span> — {loc.kind}
              {loc.fragile && (
                <span className="ml-1 text-accent" title={loc.fragile.reason}>
                  (frágil)
                </span>
              )}
              {loc.disambiguatedBy && (
                <span className="ml-1 text-accent" title={`Desambiguado por: ${loc.disambiguatedBy}`}>
                  (ambiguo)
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {localizador && (
        <div className="mt-2 flex flex-col gap-2 rounded-8 border border-info bg-bg-sunken p-2.5">
          <div className="text-2xs text-info">Editar localizador (mismo widget se reutiliza dentro de Generar)</div>
          <div className="flex flex-col gap-0.5 text-xs text-text-dim">
            <p>
              <span className="text-text-muted">name</span> <span className="font-mono">{localizador.name}</span>
            </p>
            {localizador.accessibleName !== undefined && (
              <p>
                <span className="text-text-muted">accessibleName</span> {localizador.accessibleName}
              </p>
            )}
            <p>
              <span className="text-text-muted">count</span> {localizador.count}
            </p>
            {localizador.attributes !== undefined && (
              <p className="break-all">
                <span className="text-text-muted">attributes</span> {JSON.stringify(localizador.attributes)}
              </p>
            )}
            {localizador.fragile !== undefined && (
              <p>
                <span className="text-text-muted">fragile</span> {localizador.fragile.reason}
              </p>
            )}
            <p>
              <span className="text-text-muted">producedBy</span> {localizador.producedBy.agent} ({localizador.producedBy.at})
            </p>
            <p>
              <span className="text-text-muted">verifiedAt</span> {localizador.verifiedAt}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">kind</span>
            <select
              className="rounded-7 border border-border-soft bg-bg-sunken px-2 py-1 text-text-bright"
              value={kind}
              onChange={(e) => setKind(e.target.value as LocatorEntry["kind"])}
            >
              {KIND_OPCIONES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">ts — selector (texto libre)</span>
            <input
              className="rounded-7 border border-border-soft bg-bg-sunken px-2 py-1 font-mono text-text-bright"
              value={ts}
              onChange={(e) => setTs(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">disambiguatedBy (opcional)</span>
            <input
              className="rounded-7 border border-border-soft bg-bg-sunken px-2 py-1 text-text-bright"
              value={disambiguatedBy}
              onChange={(e) => setDisambiguatedBy(e.target.value)}
            />
          </label>

          <button
            type="button"
            disabled={guardando || deshabilitado || ts.trim().length === 0}
            onClick={guardar}
            className="self-start rounded-7 border border-accent bg-accent px-2.5 py-1 text-xs font-bold text-on-accent disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "💾 Guardar"}
          </button>
          {deshabilitado && (
            <p className="text-xs text-accent">Hay una corrida en marcha: espera a que termine para corregir un localizador.</p>
          )}
          {mensaje && <p className="text-xs text-text-faint">{mensaje}</p>}
        </div>
      )}
    </div>
  );
}
