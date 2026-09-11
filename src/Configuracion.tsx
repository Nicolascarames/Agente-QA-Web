import { useEffect, useState } from "react";
import { AccionDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";
import { obtenerConfig, guardarConfig } from "./api";
import type { ConfigRaiz } from "../shared/tipos";

const MOTIVO_GLOBAL =
  "El sistema de configuración se reconstruye desde cero en el Bloque 3 (agente-qa.config.json en la raíz del repo, gestionado por `npx agente-qa`). La interfaz web para editarlo todavía no existe.";

const CONFIG_VACIA: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [] };

/** Bloque 5: entorno, barrera de escrituras y lista blanca — los tres campos que `agente-qa.config.json`
 *  gana en este bloque. `appUrl` sigue siendo del Bloque 3 y no tiene control propio aquí todavía. */
function PanelProyecto() {
  const [config, setConfig] = useState<ConfigRaiz>(CONFIG_VACIA);
  const [listaBlancaTexto, setListaBlancaTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig()
      .then((recibida) => {
        setConfig(recibida);
        setListaBlancaTexto(recibida.listaBlanca.join("\n"));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const guardar = () => {
    setError(null);
    setGuardando(true);
    const listaBlanca = listaBlancaTexto
      .split("\n")
      .map((linea) => linea.trim())
      .filter((linea) => linea !== "");
    guardarConfig({ entorno: config.entorno, barrera: config.barrera, listaBlanca })
      .then((guardada) => {
        setConfig(guardada);
        setListaBlancaTexto(guardada.listaBlanca.join("\n"));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  if (cargando) return <p className="text-xs text-text-dim">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <label className="flex flex-col gap-1">
        <span className="text-text-faint">Entorno</span>
        <input
          value={config.entorno}
          onChange={(e) => {
            setConfig({ ...config, entorno: e.target.value });
          }}
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.barrera}
          onChange={(e) => {
            setConfig({ ...config, barrera: e.target.checked });
          }}
        />
        <span className="text-text-faint">Barrera de escrituras activa</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-faint">Lista blanca (una URL por línea)</span>
        <textarea
          value={listaBlancaTexto}
          onChange={(e) => {
            setListaBlancaTexto(e.target.value);
          }}
          rows={6}
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
        />
      </label>

      {error && <p className="text-danger">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="self-start rounded-7 border border-accent bg-accent px-3 py-1 font-bold text-on-accent disabled:opacity-50"
      >
        Guardar
      </button>
    </div>
  );
}

export function Configuracion() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="configuracion" panelId="proyecto" titulo="📁 Este proyecto" disposicionPorDefecto={{ x: 0, y: 0, w: 48, h: 100, z: 1 }}>
          <PanelProyecto />
        </Panel>
        <Panel tabId="configuracion" panelId="global" titulo="🌍 Global" disposicionPorDefecto={{ x: 51, y: 0, w: 49, h: 100, z: 1 }}>
          <AccionDeshabilitada motivo={MOTIVO_GLOBAL} />
        </Panel>
      </div>
    </div>
  );
}
