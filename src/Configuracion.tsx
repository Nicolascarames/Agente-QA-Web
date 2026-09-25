import { useEffect, useState } from "react";
import { Panel, restablecerDisposicionesGuardadas } from "./Panel";
import { guardarCredenciales, guardarConfig, obtenerConfig, obtenerCredenciales, obtenerDoctor } from "./api";
import {
  AJUSTE_TEXTO_MAX,
  AJUSTE_TEXTO_MIN,
  PREFERENCIAS_POR_DEFECTO,
  usePreferenciasUI,
  type ModoPaneles,
} from "./preferenciasUI";
import type { ConfigRaiz, CredencialVariable, ModeloAgente, PoliticaPuertas, ResultadoComprobacion } from "../shared/tipos";

const CONFIG_VACIA: ConfigRaiz = {
  schemaVersion: 1,
  appUrl: "",
  entorno: "pruebas",
  barrera: false,
  listaBlanca: [],
  puertas: "escenario",
  modelo: "sonnet",
  presupuestoUsd: 2,
};

// 3 columnas x 2 filas, mismo patrón GAP=1.5 que Dashboard (ver ESTADO.md): cada panel llega exacto
// a 0/100 sin dejar huecos ni sobrar ancho/alto. Solo la disposición inicial en modo movibles — en
// fijos es la geometría real (Panel.tsx); en movibles es arrastrable y redimensionable después
// (persiste por pestaña+panel en localStorage).
const GAP = 1.5;
const COL_W = (100 - 2 * GAP) / 3;
const FILA_H = (100 - GAP) / 2;
const FILA_2_Y = FILA_H + GAP;

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
          // `flex-wrap`: en un panel estrecho (movibles redimensionado a mínimos, o la columna de
          // 3 de Configuración) nombre+valor no caben en una fila sin recortarse — con `min-w` y
          // `flex-wrap` el valor baja a su propia fila en vez de comprimirse hasta ser ilegible.
          <div key={indice} className="flex flex-wrap gap-1.5">
            <input
              value={variable.nombre}
              onChange={(e) => {
                setVariables(variables.map((v, i) => (i === indice ? { ...v, nombre: e.target.value } : v)));
              }}
              placeholder="NOMBRE (p.ej. USUARIO_ADMIN)"
              className="min-w-[140px] flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
            />
            <input
              value={variable.valor}
              onChange={(e) => {
                setVariables(variables.map((v, i) => (i === indice ? { ...v, valor: e.target.value } : v)));
              }}
              type="password"
              placeholder="valor"
              className="min-w-[100px] flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
            />
            <button
              type="button"
              onClick={() => {
                setVariables(variables.filter((_, i) => i !== indice));
              }}
              className="shrink-0 rounded-7 border border-border-soft bg-bg-sunken px-2 text-text-faint"
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

const POLITICAS_PUERTAS: { valor: PoliticaPuertas; etiqueta: string; ayuda: string }[] = [
  {
    valor: "escenario",
    etiqueta: "Una vez, tras el escenario (recomendado)",
    ayuda: "Confirmas el Gherkin y el resto del ciclo — page objects, spec y ejecución — sigue solo hasta el test en verde.",
  },
  {
    valor: "escenario-y-codigo",
    etiqueta: "Dos veces: escenario y código",
    ayuda: "Además del Gherkin, confirmas tras los page objects y el spec juntos, antes de ejecutar.",
  },
  {
    valor: "por-artefacto",
    etiqueta: "Tres veces: cada artefacto por separado",
    ayuda: "Escenario, page objects y spec, cada uno con su propia parada.",
  },
  {
    valor: "por-fichero",
    etiqueta: "En cada fichero",
    ayuda: "Cualquier fichero que el agente escriba o modifique bajo tests/, incluidas las correcciones de un test en rojo.",
  },
];

/** Pieza 2 de la spec de puertas de confirmación: cuántas veces para el agente a pedir tu OK antes
 *  de seguir. Cada parada reanuda la sesión y el agente relee el contexto — eso se paga en tokens,
 *  por eso el párrafo de coste está siempre visible, no solo al pasar el ratón. */
function PanelPuertas() {
  const [puertas, setPuertas] = useState<PoliticaPuertas>("escenario");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig()
      .then((recibida) => {
        setPuertas(recibida.puertas);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const elegir = (valor: PoliticaPuertas) => {
    setError(null);
    setGuardando(true);
    guardarConfig({ puertas: valor })
      .then((guardada) => {
        setPuertas(guardada.puertas);
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
        Cada parada reanuda la sesión: el agente relee el contexto, y eso se paga en tokens. La opción marcada por
        defecto es la que menos interrumpe.
      </p>
      <div className="flex flex-col gap-1.5">
        {POLITICAS_PUERTAS.map((p) => (
          <label
            key={p.valor}
            className={`flex flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 ${
              puertas === p.valor ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
            }`}
          >
            <span className="flex items-center gap-2 text-text-bright">
              <input
                type="radio"
                name="puertas"
                checked={puertas === p.valor}
                disabled={guardando}
                onChange={() => {
                  elegir(p.valor);
                }}
              />
              {p.etiqueta}
            </span>
            <span className="pl-5 text-2xs text-text-faint">{p.ayuda}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}

const MODELOS_AGENTE: { valor: ModeloAgente; etiqueta: string }[] = [
  { valor: "sonnet", etiqueta: "Sonnet — recomendado: buen equilibrio, gasta varias veces menos límite que Opus" },
  { valor: "opus", etiqueta: "Opus — solo para casos difíciles: consume mucho más" },
  { valor: "haiku", etiqueta: "Haiku — el más barato, puede fallar en flujos largos" },
];

/** Qué modelo del SDK lanza el agente y cuánto puede gastar como mucho una sola petición
 *  (`maxBudgetUsd`, server/agente.ts): sin tope, un turno largo en Opus puede consumir gran parte
 *  del límite de suscripción de golpe. El modelo se guarda al elegir radio, igual que las puertas;
 *  el tope necesita su propio botón porque es texto libre, no una opción cerrada. */
function PanelModelo() {
  const [modelo, setModelo] = useState<ModeloAgente>("sonnet");
  const [presupuestoTexto, setPresupuestoTexto] = useState("2");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig()
      .then((recibida) => {
        // Fallback a los defaults: un agente-qa.config.json guardado antes de este bloque no trae
        // `modelo` ni `presupuestoUsd`.
        setModelo(recibida.modelo ?? "sonnet");
        setPresupuestoTexto(String(recibida.presupuestoUsd ?? 2));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const elegirModelo = (valor: ModeloAgente) => {
    setError(null);
    setGuardando(true);
    guardarConfig({ modelo: valor })
      .then((guardada) => {
        setModelo(guardada.modelo ?? valor);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  const guardarPresupuesto = () => {
    setError(null);
    setGuardando(true);
    const presupuestoUsd = Number(presupuestoTexto);
    guardarConfig({ presupuestoUsd: Number.isFinite(presupuestoUsd) ? presupuestoUsd : 0 })
      .then((guardada) => {
        setPresupuestoTexto(String(guardada.presupuestoUsd ?? 2));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  if (cargando) return <p className="text-xs text-text-dim">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="text-text-faint">Opus gasta varias veces más límite de suscripción que Sonnet por el mismo turno.</p>
      <div className="flex flex-col gap-1.5">
        {MODELOS_AGENTE.map((m) => (
          <label
            key={m.valor}
            className={`flex items-center gap-2 rounded-7 border px-2.5 py-1.5 ${
              modelo === m.valor ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
            }`}
          >
            <input
              type="radio"
              name="modelo"
              checked={modelo === m.valor}
              disabled={guardando}
              onChange={() => {
                elegirModelo(m.valor);
              }}
            />
            <span className="text-text-bright">{m.etiqueta}</span>
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-text-faint">Tope de gasto por petición (USD, 0 = sin tope)</span>
        <input
          type="number"
          min={0}
          step="0.5"
          value={presupuestoTexto}
          onChange={(e) => {
            setPresupuestoTexto(e.target.value);
          }}
          className="w-24 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
        />
      </label>

      {error && <p className="text-danger">{error}</p>}

      <button
        type="button"
        onClick={guardarPresupuesto}
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

const MODOS_PANELES: { valor: ModoPaneles; etiqueta: string; ayuda: string }[] = [
  { valor: "fijos", etiqueta: "Fijos (recomendado)", ayuda: "Cada panel ocupa su hueco de mockup, sin arrastre ni redimensionado." },
  { valor: "movibles", etiqueta: "Movibles", ayuda: "Arrastrables y redimensionables por toda la banda, incluida la consola." },
];

/** Configuración → Apariencia: dos preferencias por navegador (src/preferenciasUI.ts), nunca en
 *  agente-qa.config.json — no hay `guardar`/`cargando` como en los demás paneles de esta pestaña
 *  porque no hay red de por medio, cada cambio se aplica y persiste al vuelo. */
function PanelApariencia() {
  const { ajusteTexto, modoPaneles, setAjusteTexto, setModoPaneles } = usePreferenciasUI();
  // "base" de tailwind.config.ts (14.5px) es la referencia visible de esta pestaña — las demás son
  // proporcionales a ella, así que mover esta ya deja ver el efecto en el resto de paneles.
  const tamanoBase = 14.5 + ajusteTexto;
  const esPorDefecto = ajusteTexto === PREFERENCIAS_POR_DEFECTO.ajusteTexto;

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex flex-col gap-1.5">
        <span className="text-text-faint">Tamaño del texto</span>
        <input
          type="range"
          min={AJUSTE_TEXTO_MIN}
          max={AJUSTE_TEXTO_MAX}
          step={1}
          value={ajusteTexto}
          onChange={(e) => {
            setAjusteTexto(Number(e.target.value));
          }}
        />
        <span className="text-2xs text-text-faint">
          {tamanoBase.toFixed(1).replace(".", ",")} px{esPorDefecto ? " (por defecto)" : ""}
        </span>
        <p
          style={{ fontSize: `${String(tamanoBase)}px` }}
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-text-bright"
        >
          Vista previa del tamaño de texto.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-text-faint">Paneles</span>
        <div className="flex flex-col gap-1.5">
          {MODOS_PANELES.map((m) => (
            <label
              key={m.valor}
              className={`flex flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 ${
                modoPaneles === m.valor ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
              }`}
            >
              <span className="flex items-center gap-2 text-text-bright">
                <input
                  type="radio"
                  name="modoPaneles"
                  checked={modoPaneles === m.valor}
                  onChange={() => {
                    setModoPaneles(m.valor);
                  }}
                />
                {m.etiqueta}
              </span>
              <span className="pl-5 text-2xs text-text-faint">{m.ayuda}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={restablecerDisposicionesGuardadas}
          className="self-start rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1 text-text-bright"
        >
          ↺ Restablecer posiciones
        </button>
      </div>
    </div>
  );
}

export function Configuracion() {
  // El `overflow-auto` de este wrapper es lo que le da scroll a la pestaña cuando el contenido no
  // cabe en fijos — pero en movibles ese mismo `overflow-auto` recorta cualquier panel arrastrado
  // fuera de esta caja (p.ej. sobre la consola): queda invisible aunque su posición sea correcta.
  // En movibles no hace falta scroll aquí (los paneles están acotados a la banda vía `bounds`).
  const { modoPaneles } = usePreferenciasUI();
  return (
    <div className={`flex h-full w-full flex-col p-4 ${modoPaneles === "fijos" ? "overflow-auto" : "overflow-visible"}`}>
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="configuracion"
          panelId="proyecto"
          titulo="📁 Este proyecto"
          disposicionPorDefecto={{ x: 0, y: 0, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelProyecto />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="credenciales"
          titulo="🔑 Credenciales"
          disposicionPorDefecto={{ x: COL_W + GAP, y: 0, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelCredenciales />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="diagnostico"
          titulo="🩺 Diagnóstico (doctor)"
          disposicionPorDefecto={{ x: (COL_W + GAP) * 2, y: 0, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelDiagnostico />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="puertas"
          titulo="🚪 Puertas de confirmación"
          disposicionPorDefecto={{ x: 0, y: FILA_2_Y, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelPuertas />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="modelo"
          titulo="Modelo y gasto"
          disposicionPorDefecto={{ x: COL_W + GAP, y: FILA_2_Y, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelModelo />
        </Panel>
        <Panel
          tabId="configuracion"
          panelId="apariencia"
          titulo="🎨 Apariencia"
          disposicionPorDefecto={{ x: (COL_W + GAP) * 2, y: FILA_2_Y, w: COL_W, h: FILA_H, z: 1 }}
        >
          <PanelApariencia />
        </Panel>
      </div>
    </div>
  );
}
