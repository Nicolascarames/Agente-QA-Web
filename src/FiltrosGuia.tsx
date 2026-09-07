import { DESCRIPCION_CONDUCTOR, DESCRIPCION_COSTE, DESCRIPCION_ESTADO } from "./catalogo/ejes";
import type { CriterioFiltro } from "./catalogo/filtrar";
import type { Conductor, Coste, Estado } from "./catalogo/tipos";

// Fila de filtros de la guía (Bloque 5): chips de eje (OR dentro del eje, AND entre ejes — la
// semántica vive en `catalogo/filtrar.ts`, aquí solo se pintan y se alternan) más la caja de texto
// y el interruptor "todas las pestañas". Sin chip de `agente`: con un solo agente construido hoy
// no discrimina nada, se añade cuando exista el segundo.
export interface FiltrosGuiaProps {
  criterio: CriterioFiltro;
  onCambiarCriterio: (criterio: CriterioFiltro) => void;
  todasLasPestanas: boolean;
  onCambiarTodasLasPestanas: (valor: boolean) => void;
}

const CONDUCTORES: Conductor[] = ["humano", "determinista", "llm-api", "claude-code"];
const COSTES: Coste[] = ["cero", "facturado", "suscripcion"];
const ESTADOS: Estado[] = ["construido", "pendiente", "otro-repo"];

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

function FilaChips<T extends string>({
  valores,
  seleccionados,
  descripcion,
  onAlternar,
}: {
  valores: T[];
  seleccionados: T[];
  descripcion: Record<T, { etiqueta: string; icono: string }>;
  onAlternar: (valor: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {valores.map((valor) => {
        const activo = seleccionados.includes(valor);
        return (
          <button
            key={valor}
            type="button"
            onClick={() => {
              onAlternar(valor);
            }}
            aria-pressed={activo}
            className={`rounded-full border px-2 py-0.5 text-2xs transition-colors ${
              activo ? "border-accent-soft bg-accent-bg text-accent-soft" : "border-border-soft text-text-dim hover:border-border-strong"
            }`}
          >
            <span aria-hidden="true">{descripcion[valor].icono}</span> {descripcion[valor].etiqueta}
          </button>
        );
      })}
    </div>
  );
}

export function FiltrosGuia({ criterio, onCambiarCriterio, todasLasPestanas, onCambiarTodasLasPestanas }: FiltrosGuiaProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border-soft pb-2.5">
      <FilaChips
        valores={CONDUCTORES}
        seleccionados={criterio.conductor}
        descripcion={DESCRIPCION_CONDUCTOR}
        onAlternar={(valor) => {
          onCambiarCriterio({ ...criterio, conductor: alternar(criterio.conductor, valor) });
        }}
      />
      <FilaChips
        valores={COSTES}
        seleccionados={criterio.coste}
        descripcion={DESCRIPCION_COSTE}
        onAlternar={(valor) => {
          onCambiarCriterio({ ...criterio, coste: alternar(criterio.coste, valor) });
        }}
      />
      <FilaChips
        valores={ESTADOS}
        seleccionados={criterio.estado}
        descripcion={DESCRIPCION_ESTADO}
        onAlternar={(valor) => {
          onCambiarCriterio({ ...criterio, estado: alternar(criterio.estado, valor) });
        }}
      />
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={criterio.texto}
          onChange={(e) => {
            onCambiarCriterio({ ...criterio, texto: e.target.value });
          }}
          placeholder="Buscar comando, opción o palabra clave…"
          className="min-w-0 flex-1 rounded-4 border border-border bg-bg-sunken px-1.5 py-1 text-2xs text-text"
        />
        <label className="flex shrink-0 items-center gap-1 text-2xs text-text-dim">
          <input
            type="checkbox"
            checked={todasLasPestanas}
            onChange={(e) => {
              onCambiarTodasLasPestanas(e.target.checked);
            }}
          />
          Todas las pestañas
        </label>
      </div>
    </div>
  );
}
