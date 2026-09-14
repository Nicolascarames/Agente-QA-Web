import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { guardarCredenciales, guardarConfig, obtenerConfig, obtenerCredenciales, obtenerDoctor } from "./api";
import type { ConfigRaiz, CredencialVariable, ResultadoComprobacion } from "../shared/tipos";

const CONFIG_VACIA: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [], puertas: "escenario" };

// GAP=1.5 entre los tres paneles, mismo patrón que Dashboard/Reports (ver ESTADO.md): cada uno
// llega exacto a 0/100 sin dejar huecos ni sobrar ancho.
const GAP = 1.5;
const ANCHO_PANEL = (100 - GAP * 2) / 3;

/** Bloque 5: entorno, barrera de escrituras y lista blanca. Después del plan: `appUrl` gana control
 *  propio aquí (antes solo la creaba `npx agente-qa` al arrancar, preguntando por terminal). */
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
    guardarConfig({ appUrl: config.appUrl, entorno: config.entorno, barrera: config.barrera, listaBlanca })
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
        <span className="text-text-faint">URL base de la web bajo prueba</span>
        <input
          value={config.appUrl}
          onChange={(e) => {
            setConfig({ ...config, appUrl: e.target.value });
          }}
          placeholder="https://…"
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
        />
      </label>

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
          rows={5}
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
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/** Credenciales de prueba (usuario/contraseña o cualquier otra variable con nombre libre): viven en
 *  `agente-qa.credenciales.json`, aparte de `agente-qa.config.json` porque ESE sí se versiona y este
 *  fichero nunca debe hacerlo (`server/proyecto.ts` se asegura de que el `.gitignore` del proyecto
 *  lo cubra la primera vez que se guarda algo aquí). El agente las recibe directamente para poder
 *  usarlas en login/formularios — se pide por su nombre en la petición ("entra como admin"), no hace
 *  falta pegarlas en el chat cada vez. */
function PanelCredenciales() {
  const [variables, setVariables] = useState<CredencialVariable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCredenciales()
      .then((recibida) => {
        setVariables(recibida.variables);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const guardar = () => {
    setError(null);
    setGuardando(true);
    const limpias = variables.filter((v) => v.nombre.trim() !== "");
    guardarCredenciales(limpias)
      .then((guardada) => {
        setVariables(guardada.variables);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  if (cargando) return <p className="text-xs text-text-dim">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="text-text-faint">
        Usuario, contraseña o cualquier variable que el agente pueda necesitar. Nunca se versionan ni salen en claro
        por el chat.
      </p>
      <div className="flex flex-col gap-1.5">
        {variables.map((variable, indice) => (
          <div key={indice} className="flex gap-1.5">
            <input
              value={variable.nombre}
              onChange={(e) => {
                setVariables(variables.map((v, i) => (i === indice ? { ...v, nombre: e.target.value } : v)));
              }}
              placeholder="NOMBRE (p.ej. USUARIO_ADMIN)"
              className="w-2/5 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
            />
            <input
              value={variable.valor}
              onChange={(e) => {
                setVariables(variables.map((v, i) => (i === indice ? { ...v, valor: e.target.value } : v)));
              }}
              type="password"
              placeholder="valor"
              className="flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
            />
            <button
              type="button"
              onClick={() => {
                setVariables(variables.filter((_, i) => i !== indice));
              }}
              className="rounded-7 border border-border-soft bg-bg-sunken px-2 text-text-faint"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setVariables([...variables, { nombre: "", valor: "" }]);
        }}
        className="self-start rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1 text-text-bright"
      >
        + Añadir variable
      </button>

      {error && <p className="text-danger">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="self-start rounded-7 border border-accent bg-accent px-3 py-1 font-bold text-on-accent disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/** Las cuatro comprobaciones de `npx agente-qa doctor` (server/doctor.ts), de solo lectura: antes
 *  solo se veían por terminal, el usuario pidió tenerlas también aquí. */
function PanelDiagnostico() {
  const [comprobaciones, setComprobaciones] = useState<ResultadoComprobacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setError(null);
    obtenerDoctor()
      .then((resultado) => {
        setComprobaciones(resultado.comprobaciones);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  useEffect(cargar, []);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <button
        type="button"
        onClick={cargar}
        className="self-start rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1 text-text-bright"
      >
        ↻ Volver a comprobar
      </button>
      {error && <p className="text-danger">{error}</p>}
      {!comprobaciones ? (
        <p className="text-text-dim">Comprobando…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comprobaciones.map((c) => (
            <li key={c.nombre} className={`rounded-7 border px-2.5 py-1.5 ${c.ok ? "border-ok" : "border-danger"}`}>
              <p className={`font-semibold ${c.ok ? "text-ok" : "text-danger"}`}>
                {c.ok ? "✅" : "❌"} {c.nombre}
              </p>
              <p className="text-2xs text-text-faint">{c.mensaje}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Configuracion() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="configuracion"
          panelId="proyecto"
          titulo="📁 Este proyecto"
          disposicionPorDefecto={{ x: 0, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelProyecto />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="credenciales"
          titulo="🔑 Credenciales"
          disposicionPorDefecto={{ x: ANCHO_PANEL + GAP, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelCredenciales />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="diagnostico"
          titulo="🩺 Diagnóstico (doctor)"
          disposicionPorDefecto={{ x: (ANCHO_PANEL + GAP) * 2, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelDiagnostico />
        </Panel>
      </div>
    </div>
  );
}
