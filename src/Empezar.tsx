import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { obtenerConfig, obtenerCredenciales, obtenerDoctor } from "./api";
import type { ConfigRaiz, ResultadoComprobacion } from "../shared/tipos";

// GAP=1.5 entre los tres paneles, mismo patrón que Configuracion/Dashboard (ver ESTADO.md): cada
// uno llega exacto a 0/100 sin dejar huecos ni sobrar ancho.
const GAP = 1.5;
const ANCHO_PANEL = (100 - GAP * 2) / 3;

/** Pura: la petición de ejemplo se construye con la `appUrl` real del proyecto si ya está
 *  configurada; si no, cae a un ejemplo genérico. Extraída para poder testearla sin montar
 *  infraestructura de test de componentes (no existe hoy en el repo). */
export function construirTextoEjemplo(appUrl: string): string {
  const base = appUrl.trim() !== "" ? appUrl.trim() : "https://tu-web-de-pruebas.com";
  return `Entra en ${base} y comprueba que se puede iniciar sesión con un usuario válido`;
}

interface FilaPreparacion {
  nombre: string;
  ok: boolean;
  mensaje: string;
}

/** Las cuatro comprobaciones del `doctor` (server/doctor.ts) más "URL base configurada" y
 *  "credenciales de prueba guardadas" (`GET /api/config` y `GET /api/credenciales`, ya
 *  consumidos por `PanelProyecto`/`PanelCredenciales` en Configuracion.tsx). A diferencia del
 *  diagnóstico de Configuración, aquí solo se muestra el texto de arreglo cuando la fila está en
 *  rojo — es una guía de "qué falta", no un panel de estado permanente. */
function PanelPreparacion() {
  const [comprobaciones, setComprobaciones] = useState<ResultadoComprobacion[] | null>(null);
  const [config, setConfig] = useState<ConfigRaiz | null>(null);
  const [credencialesGuardadas, setCredencialesGuardadas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setError(null);
    Promise.all([obtenerDoctor(), obtenerConfig(), obtenerCredenciales()])
      .then(([doctor, configRecibida, credenciales]) => {
        setComprobaciones(doctor.comprobaciones);
        setConfig(configRecibida);
        setCredencialesGuardadas(credenciales.variables.some((v) => v.nombre.trim() !== ""));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  useEffect(cargar, []);

  const filas: FilaPreparacion[] = comprobaciones
    ? [
        ...comprobaciones,
        {
          nombre: "URL base configurada",
          ok: (config?.appUrl.trim() ?? "") !== "",
          mensaje: "Ve a Configuración → Este proyecto y rellena la URL base de la web bajo prueba.",
        },
        {
          nombre: "Credenciales de prueba guardadas",
          ok: credencialesGuardadas,
          mensaje: "Ve a Configuración → Credenciales y añade al menos un usuario de prueba.",
        },
      ]
    : [];

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
          {filas.map((f) => (
            <li key={f.nombre} className={`rounded-7 border px-2.5 py-1.5 ${f.ok ? "border-ok" : "border-danger"}`}>
              <p className={`font-semibold ${f.ok ? "text-ok" : "text-danger"}`}>
                {f.ok ? "✅" : "❌"} {f.nombre}
              </p>
              {!f.ok && <p className="text-2xs text-text-faint">{f.mensaje}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PanelPasosProps {
  onEscribirEjemplo: (texto: string) => void;
}

/** El paso 2 lee su propia `appUrl` (igual que `PanelPreparacion`, sin compartir estado entre
 *  paneles — el mismo criterio que ya siguen los paneles de Configuracion.tsx). */
function PanelPasos({ onEscribirEjemplo }: PanelPasosProps) {
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    obtenerConfig()
      .then((config) => {
        setAppUrl(config.appUrl);
      })
      .catch(() => {
        // Sin URL configurada todavía: el botón cae al ejemplo genérico, no bloquea la guía.
      });
  }, []);

  return (
    <ol className="flex flex-col gap-3 text-xs">
      <li>
        <p className="font-semibold text-text-bright">1. Deja el estado de preparación en verde</p>
        <p className="mt-0.5 text-text-faint">Sigue el texto de arreglo de cada fila roja del panel de la izquierda.</p>
      </li>
      <li>
        <p className="font-semibold text-text-bright">2. Escribe tu primera petición en la consola</p>
        <p className="mt-0.5 text-text-faint">La consola de la derecha es la única conversación con el agente.</p>
        <button
          type="button"
          onClick={() => {
            onEscribirEjemplo(construirTextoEjemplo(appUrl));
          }}
          className="mt-1.5 self-start rounded-7 border border-accent bg-accent px-3 py-1 font-bold text-on-accent"
        >
          Escribir el ejemplo en la consola
        </button>
      </li>
      <li>
        <p className="font-semibold text-text-bright">3. Revísala en Redactar → Generar → Ejecutar</p>
        <p className="mt-0.5 text-text-faint">Cada pestaña es una puerta de revisión antes de que se escriba o corra código.</p>
      </li>
    </ol>
  );
}

// Una línea por pestaña, tomada literalmente de la tabla "Las siete pestañas" de ESTADO.md.
const PESTANAS_INFO: { nombre: string; descripcion: string }[] = [
  {
    nombre: "Redactar",
    descripcion:
      "Los .feature, editables, con badge de cobertura por fichero. La primera puerta: corriges el escenario antes de que se escriba código.",
  },
  {
    nombre: "Generar",
    descripcion:
      "Los .page.ts y .spec.ts, contenido completo editable, y debajo el visor de diff con aceptar/descartar cuando hay cambios pendientes.",
  },
  {
    nombre: "Ejecutar",
    descripcion:
      'Tests con su estado, título = .spec.ts, botón ▶ por fila y "Ejecutar todos" (lanza Playwright de verdad), y el detalle junta los pasos del Gherkin con el código del spec.',
  },
  {
    nombre: "Reparar",
    descripcion: "Solo los rojos, con el veredicto: fallo del test o fallo de la aplicación; .spec.ts completo editable y diff de corrección propuesto.",
  },
  {
    nombre: "Reports",
    descripcion: "Historial de ejecuciones, fallos agrupados por causa, tests inestables, pass rate, fallos abiertos.",
  },
  {
    nombre: "Dashboard",
    descripcion: "Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles.",
  },
  {
    nombre: "Configuración",
    descripcion: "URL base, entorno y barrera de escrituras; credenciales de prueba; diagnóstico en vivo del doctor.",
  },
];

function PanelPestanas() {
  return (
    <div className="overflow-auto text-xs">
      <table className="w-full border-collapse text-left">
        <tbody>
          {PESTANAS_INFO.map((p) => (
            <tr key={p.nombre} className="border-b border-border-soft align-top">
              <td className="whitespace-nowrap py-1.5 pr-2.5 font-semibold text-text-bright">{p.nombre}</td>
              <td className="py-1.5 text-text-faint">{p.descripcion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface EmpezarProps {
  onEscribirEjemplo: (texto: string) => void;
  onGuiaDescartada: () => void;
}

/** Primeros pasos dentro de la web, para quien acaba de instalar y no ha leído nada. No hay
 *  cuarto panel para el botón de abajo: es una acción de la pestaña, no un dato movible. */
export function Empezar({ onEscribirEjemplo, onGuiaDescartada }: EmpezarProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2.5 overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="empezar"
          panelId="preparacion"
          titulo="✅ Estado de preparación"
          disposicionPorDefecto={{ x: 0, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelPreparacion />
        </Panel>
        <Panel
          tabId="empezar"
          panelId="pasos"
          titulo="🚀 Tus primeros pasos"
          disposicionPorDefecto={{ x: ANCHO_PANEL + GAP, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelPasos onEscribirEjemplo={onEscribirEjemplo} />
        </Panel>
        <Panel
          tabId="empezar"
          panelId="pestanas"
          titulo="🗺️ Qué hace cada pestaña"
          disposicionPorDefecto={{ x: (ANCHO_PANEL + GAP) * 2, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelPestanas />
        </Panel>
      </div>
      <button
        type="button"
        onClick={onGuiaDescartada}
        className="self-start rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1 text-2xs text-text-faint"
      >
        No volver a mostrar esta pestaña al abrir
      </button>
    </div>
  );
}
