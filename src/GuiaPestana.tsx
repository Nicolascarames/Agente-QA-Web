import { useEffect, useMemo, useState } from "react";
import { Panel } from "./Panel";
import { InsigniasEjes } from "./InsigniasEjes";
import { FiltrosGuia } from "./FiltrosGuia";
import { fichasDePestana, idFicha } from "./catalogo/porPestana";
import { catalogoResuelto } from "./catalogo/catalogo";
import type { FichaResuelta } from "./catalogo/catalogo";
import { criterioVacio, filtrarFichas, hayFiltroActivo } from "./catalogo/filtrar";
import type { CriterioFiltro } from "./catalogo/filtrar";

// Guía de la pestaña activa: un panel flotante más (banda 3, `src/App.tsx`) con la ficha plegada
// de cada comando de esa pestaña. La ficha plegada es completa por sí misma (nombre, resumen,
// insignias y opciones reales del CLI); pulsarla abre el cajón de detalle (Bloque 4) con el resto
// de la plantilla. Bloque 5 añade encima los chips de eje y el buscador (`FiltrosGuia`): el
// criterio vive aquí, no se guarda entre pestañas.
export interface GuiaPestanaProps {
  pestana: string;
  /** Abre el cajón sobre esta ficha; el estado vive en `App.tsx` (Bloque 4). */
  onAbrirFicha: (id: string) => void;
}

function FichaPlegada({
  resuelta,
  onAbrir,
  etiquetaPestana,
}: {
  resuelta: FichaResuelta;
  onAbrir: () => void;
  /** Solo se pinta con "todas las pestañas" activo: en qué pestaña vive este resultado. */
  etiquetaPestana?: string;
}) {
  const { ficha } = resuelta;
  const opciones = resuelta.tipo === "comando" ? resuelta.cli.opciones : [];
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="rounded-8 border border-border-soft bg-bg-panel p-2.5 text-left transition-colors hover:border-border-strong"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="text-sm font-bold text-accent-soft">{ficha.ruta.join(" ")}</code>
        <InsigniasEjes ejes={ficha.ejes} />
      </div>
      {etiquetaPestana && <p className="mt-0.5 text-2xs text-text-faint">{etiquetaPestana}</p>}
      <p className="mt-1 text-xs text-text-muted">{ficha.unaLinea}</p>
      {opciones.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border-soft pt-2">
          {opciones.map((opcion) => (
            <li key={opcion.flags} className="text-2xs text-text-dim">
              <code className="text-text-faint">{opcion.flags}</code> — {opcion.descripcion}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function GuiaPestana({ pestana, onAbrirFicha }: GuiaPestanaProps) {
  const [criterio, setCriterio] = useState<CriterioFiltro>(criterioVacio());
  const [todasLasPestanas, setTodasLasPestanas] = useState(false);

  // Filtros de vista, no del catálogo: este componente no se remonta al cambiar de pestaña (solo
  // cambia la prop `pestana`), así que sin este efecto un filtro puesto en "Explorar" seguiría
  // activo al entrar en "Redactar".
  useEffect(() => {
    setCriterio(criterioVacio());
    setTodasLasPestanas(false);
  }, [pestana]);

  const limpiarFiltros = () => {
    setCriterio(criterioVacio());
    setTodasLasPestanas(false);
  };

  // `catalogoResuelto()` construye árboles nuevos en cada llamada (misma trampa ya corregida para
  // `resueltaAbierta` en `App.tsx`, Bloque 4): sin memoizar, cada render con "todas las pestañas"
  // encendido le daba a `universo` una identidad nueva aunque el contenido fuera el mismo, e
  // invalidaba de más el `useMemo` de `fichas` de abajo.
  const catalogoCompleto = useMemo(() => catalogoResuelto(), []);

  // Universo sobre el que se filtra: solo la pestaña activa, o las 18 fichas del catálogo cuando
  // el interruptor "todas las pestañas" está encendido.
  const universo = todasLasPestanas ? catalogoCompleto : fichasDePestana(pestana);
  const fichas = useMemo(() => filtrarFichas(universo, criterio), [universo, criterio]);
  const filtrosActivos = hayFiltroActivo(criterio);

  return (
    <Panel tabId={pestana} panelId="guia" titulo="Guía" disposicionPorDefecto={{ x: 2, y: 4, w: 96, h: 90, z: 10 }}>
      <div className="flex flex-col gap-2">
        <FiltrosGuia
          criterio={criterio}
          onCambiarCriterio={setCriterio}
          todasLasPestanas={todasLasPestanas}
          onCambiarTodasLasPestanas={setTodasLasPestanas}
        />
        {fichas.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-text-dim">
            <p>{filtrosActivos ? "No hay comandos que cumplan estos filtros." : "Esta pestaña no tiene fichas todavía."}</p>
            {filtrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="rounded-6 border border-border-strong bg-bg-panel px-2 py-1 text-xs text-accent-soft"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          fichas.map((resuelta) => (
            <FichaPlegada
              key={idFicha(resuelta.ficha)}
              resuelta={resuelta}
              etiquetaPestana={todasLasPestanas ? resuelta.ficha.pestana : undefined}
              onAbrir={() => {
                onAbrirFicha(idFicha(resuelta.ficha));
              }}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
