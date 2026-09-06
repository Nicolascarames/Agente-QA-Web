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

// Los tres ámbitos posibles, para pintar el segmentado "🎯 Ámbito" del Bloque 3
// (cuáles están habilitados para la puerta activa lo decide `opcionesAmbito` más abajo).
const AMBITOS: AmbitoExploracion[] = ["todo", "seleccion", "objetivo"];

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
    <div className="flex flex-wrap items-center gap-5 rounded-10 border border-border bg-bg-panel px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xs uppercase tracking-[.04em] text-text-faint">🎯 Ámbito</span>
        <div className="flex overflow-hidden rounded-6 border border-border-soft">
          {AMBITOS.map((a) => {
            const disponible = info.llevaAmbito && opcionesAmbito.includes(a);
            const activo = disponible && ambito === a;
            return (
              <button
                key={a}
                type="button"
                disabled={!disponible || corriendo}
                onClick={() => setAmbito(a)}
                className={`px-2.5 py-1 text-xs ${activo ? "bg-bg-elev text-accent-soft" : "bg-bg-sunken text-text-muted"} disabled:opacity-40`}
              >
                {a === "seleccion" ? `${ETIQUETA_AMBITO[a]} (${String(unidadesSeleccionadas.length)})` : ETIQUETA_AMBITO[a]}
              </button>
            );
          })}
        </div>
        {info.llevaObjetivo && (
          <input
            className="w-48 rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-xs text-text-bright"
            value={objetivo}
            disabled={corriendo}
            placeholder="objetivo a explorar"
            onChange={(e) => setObjetivo(e.target.value)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xs uppercase tracking-[.04em] text-text-faint">🤖 Agente</span>
        {PUERTAS.map((p) => (
          <label
            key={p.id}
            title={p.coste}
            className={`flex cursor-pointer items-center gap-1.5 rounded-6 border px-2 py-1 text-xs ${
              puerta === p.id ? "border-accent bg-bg-elev text-accent-soft" : "border-border-soft bg-bg-sunken text-text-muted"
            } ${corriendo ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <input
              type="radio"
              name="puerta"
              className="sr-only"
              value={p.id}
              checked={puerta === p.id}
              disabled={corriendo}
              onChange={() => setPuerta(p.id)}
            />
            {p.etiqueta}
          </label>
        ))}
      </div>

      {info.llevaUrl && (
        <label className="flex flex-col gap-1">
          <span className="text-2xs uppercase tracking-[.04em] text-text-faint">URL</span>
          <input
            className="w-52 rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-xs text-text-bright"
            value={url}
            disabled={corriendo}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      )}

      {error && <p className="max-w-xs text-xs text-accent">{error}</p>}

      {/* Coste declarado: el texto real de la puerta elegida (Bloque 5 de la spec), no un
          importe en $ inventado — no hay dato de coste real antes de lanzar la corrida. */}
      <span className="ml-auto whitespace-nowrap text-xs text-accent-soft">💰 {info.coste}</span>

      {!corriendo ? (
        <button
          type="button"
          disabled={enCurso || faltaAlgo}
          onClick={lanzar}
          className="rounded-7 border border-accent bg-accent px-3.5 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
        >
          {enCurso ? "Explorando…" : "▶️ Explorar"}
        </button>
      ) : (
        <button
          type="button"
          disabled={enCurso}
          onClick={detener}
          className="rounded-7 border border-accent px-3.5 py-1.5 text-xs font-bold text-accent disabled:opacity-50"
        >
          {enCurso ? "deteniendo…" : "■ Detener"}
        </button>
      )}
    </div>
  );
}
