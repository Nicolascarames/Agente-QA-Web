import { useEffect, useState } from "react";
import { detenerExploracion, lanzarExploracion } from "./api";
import type { AmbitoExploracion, Puerta } from "../shared/tipos";

// Las cuatro puertas de la tabla de la spec (Bloque 5), siempre visibles: coste 0/teórico/facturado
// en texto claro, nunca un icono críptico.
interface InfoPuerta {
  id: Puerta;
  etiqueta: string;
  coste: string;
  llevaUrl: boolean;
  llevaObjetivo: boolean;
  llevaAmbito: boolean;
}

const PUERTAS: InfoPuerta[] = [
  { id: "instantanea", etiqueta: "Instantánea", coste: "coste: 0 tokens", llevaUrl: true, llevaObjetivo: false, llevaAmbito: false },
  {
    id: "grabacion-humana",
    etiqueta: "Grabación humana",
    coste: "coste: 0 tokens — abre Chromium, navegas tú",
    llevaUrl: true,
    llevaObjetivo: false,
    llevaAmbito: false,
  },
  {
    id: "grabacion-conducida",
    etiqueta: "Grabación conducida",
    coste: "coste: teórico, no facturado (suscripción de Claude Code)",
    llevaUrl: true,
    llevaObjetivo: true,
    llevaAmbito: true,
  },
  {
    id: "bucle-agentico",
    etiqueta: "Bucle agéntico",
    coste: "coste: facturado (LLM por API)",
    llevaUrl: false,
    llevaObjetivo: true,
    llevaAmbito: true,
  },
];

const ETIQUETA_AMBITO: Record<AmbitoExploracion, string> = {
  todo: "todo",
  seleccion: "esta selección",
  objetivo: "lo necesario para este objetivo",
};

export interface BarraLanzamientoProps {
  corriendo: boolean;
  /** Ids de pantallas ya conocidas marcadas en el árbol, para el ámbito "esta selección". */
  unidadesSeleccionadas: string[];
  onLanzado: () => void;
  onDetenido: () => void;
}

export function BarraLanzamiento({ corriendo, unidadesSeleccionadas, onLanzado, onDetenido }: BarraLanzamientoProps) {
  const [puerta, setPuerta] = useState<Puerta>("instantanea");
  const [ambito, setAmbito] = useState<AmbitoExploracion>("objetivo");
  const [objetivo, setObjetivo] = useState("");
  const [url, setUrl] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = PUERTAS.find((p) => p.id === puerta);
  if (!info) throw new Error(`Puerta no reconocida: ${puerta}`);

  // La grabación conducida solo tiene equivalente a "map --goal" (`record --auto`): no hay
  // `record --all` ni `record --units`, así que su único ámbito posible es "objetivo".
  const opcionesAmbito: AmbitoExploracion[] = puerta === "grabacion-conducida" ? ["objetivo"] : ["todo", "seleccion", "objetivo"];

  useEffect(() => {
    if (puerta === "grabacion-conducida") setAmbito("objetivo");
  }, [puerta]);

  const faltaAlgo =
    (info.llevaUrl && !url.trim()) ||
    (info.llevaObjetivo && !objetivo.trim()) ||
    (info.llevaAmbito && ambito === "seleccion" && unidadesSeleccionadas.length === 0);

  const lanzar = () => {
    setError(null);
    setEnCurso(true);
    void lanzarExploracion({
      puerta,
      ...(info.llevaUrl ? { url: url.trim() } : {}),
      ...(info.llevaAmbito ? { ambito } : {}),
      ...(info.llevaObjetivo ? { objetivo: objetivo.trim() } : {}),
      ...(info.llevaAmbito && ambito === "seleccion" ? { unidades: unidadesSeleccionadas } : {}),
    })
      .then(() => onLanzado())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnCurso(false));
  };

  const detener = () => {
    setError(null);
    setEnCurso(true);
    void detenerExploracion()
      .then(() => onDetenido())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnCurso(false));
  };

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-accent/30 bg-panel px-4 py-3 text-sm">
      <fieldset className="flex flex-col gap-1">
        <legend className="px-1 text-xs text-text/60">Puerta</legend>
        {PUERTAS.map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="puerta"
              value={p.id}
              checked={puerta === p.id}
              disabled={corriendo}
              onChange={() => setPuerta(p.id)}
            />
            <span>{p.etiqueta}</span>
            <span className="text-xs text-text/50">({p.coste})</span>
          </label>
        ))}
      </fieldset>

      {info.llevaUrl && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text/60">URL</span>
          <input
            className="w-56 rounded-md border border-accent/30 bg-bg px-2 py-1"
            value={url}
            disabled={corriendo}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${info.llevaAmbito ? "text-text/60" : "text-text/30"}`}>Ámbito</span>
        <select
          className="rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={ambito}
          disabled={!info.llevaAmbito || corriendo || opcionesAmbito.length === 1}
          onChange={(e) => setAmbito(e.target.value as AmbitoExploracion)}
        >
          {opcionesAmbito.map((a) => (
            <option key={a} value={a}>
              {a === "seleccion" ? `${ETIQUETA_AMBITO[a]} (${unidadesSeleccionadas.length} pantallas)` : ETIQUETA_AMBITO[a]}
            </option>
          ))}
        </select>
      </label>

      {info.llevaObjetivo && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text/60">Objetivo</span>
          <input
            className="w-64 rounded-md border border-accent/30 bg-bg px-2 py-1"
            value={objetivo}
            disabled={corriendo}
            placeholder="qué debe explorar"
            onChange={(e) => setObjetivo(e.target.value)}
          />
        </label>
      )}

      {error && <p className="max-w-md text-xs text-warning">{error}</p>}

      {!corriendo ? (
        <button
          type="button"
          disabled={enCurso || faltaAlgo}
          onClick={lanzar}
          className="rounded-md border border-accent/60 px-4 py-1.5 text-accent disabled:opacity-50"
        >
          {enCurso ? "lanzando…" : "Lanzar"}
        </button>
      ) : (
        <button
          type="button"
          disabled={enCurso}
          onClick={detener}
          className="rounded-md border border-warning/60 px-4 py-1.5 text-warning disabled:opacity-50"
        >
          {enCurso ? "deteniendo…" : "■ Detener"}
        </button>
      )}
    </div>
  );
}
