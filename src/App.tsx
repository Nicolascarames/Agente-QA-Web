import { useCallback, useEffect, useState } from "react";
import { cambiarProyecto, obtenerConfigProyecto, obtenerProyecto } from "./api";
import { Dashboard } from "./Dashboard";
import { Configuracion } from "./Configuracion";
import { Explorar } from "./Explorar";
import { Redactar } from "./Redactar";
import { Generar } from "./Generar";
import { Ejecutar } from "./Ejecutar";
import { Reparar } from "./Reparar";
import { Reports } from "./Reports";

type Pestana = "Dashboard" | "Configuración" | "Explorar" | "Redactar" | "Generar" | "Ejecutar" | "Reparar" | "Reports";

function contenidoPestana(pestana: Pestana, onCorridaActivaCambiada: (descripcion: string | null) => void) {
  switch (pestana) {
    case "Dashboard":
      return <Dashboard />;
    case "Configuración":
      return <Configuracion />;
    case "Explorar":
      return <Explorar onCorridaActivaCambiada={onCorridaActivaCambiada} />;
    case "Redactar":
      return <Redactar />;
    case "Generar":
      return <Generar />;
    case "Ejecutar":
      return <Ejecutar />;
    case "Reparar":
      return <Reparar />;
    case "Reports":
      return <Reports />;
  }
}

// Grupos e iconos de la barra lateral, calcados de `navMeta` en
// design/mockup-design.js. "Operaciones" son las seis puertas de trabajo;
// "Proyecto" son las dos pantallas de lectura/ajuste del proyecto activo.
const NAV_OPERACIONES: { pestana: Pestana; icon: string }[] = [
  { pestana: "Dashboard", icon: "📊" },
  { pestana: "Explorar", icon: "🗺️" },
  { pestana: "Redactar", icon: "✍️" },
  { pestana: "Generar", icon: "🧪" },
  { pestana: "Ejecutar", icon: "▶️" },
  { pestana: "Reparar", icon: "🔧" },
];
const NAV_PROYECTO: { pestana: Pestana; icon: string }[] = [
  { pestana: "Reports", icon: "📈" },
  { pestana: "Configuración", icon: "⚙️" },
];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>("Dashboard");
  const [proyectoActual, setProyectoActual] = useState<string>("");
  const [recientes, setRecientes] = useState<string[]>([]);
  const [rutaCampo, setRutaCampo] = useState("");
  const [sidebarAbierta, setSidebarAbierta] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  // El indicador "● en curso" lo enciende Explorar (única pestaña con corridas hoy) subiendo
  // su estado real por esta callback — nunca se inventa una corrida aquí arriba.
  const [corridaActiva, setCorridaActiva] = useState<string | null>(null);

  const cargarAppUrl = useCallback(() => {
    void obtenerConfigProyecto().then((datos) => {
      setAppUrl(datos.inicializado ? datos.config.appUrl.valor : null);
    });
  }, []);

  useEffect(() => {
    void obtenerProyecto().then((datos) => {
      setProyectoActual(datos.actual);
      setRutaCampo(datos.actual);
      setRecientes(datos.recientes);
    });
    cargarAppUrl();
  }, [cargarAppUrl]);

  const cambiarA = useCallback(
    (ruta: string) => {
      void cambiarProyecto(ruta).then((datos) => {
        setProyectoActual(datos.actual);
        setRutaCampo(datos.actual);
        setRecientes(datos.recientes);
      });
      cargarAppUrl();
    },
    [cargarAppUrl]
  );

  const ir = useCallback((p: Pestana) => {
    setPestana(p);
    setSidebarAbierta(false);
  }, []);

  const claseItemNav = (p: Pestana) =>
    `flex w-full items-center gap-1.5 rounded-8 border-0 bg-transparent px-2.5 py-2 text-left text-md font-normal text-text-muted transition-colors ${
      p === pestana ? "bg-accent-bg font-semibold text-accent-soft" : "hover:text-text"
    }`;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {sidebarAbierta && (
        <div
          className="fixed inset-0 z-[55] animate-fade-in bg-[var(--backdrop)] min-[900px]:hidden"
          onClick={() => {
            setSidebarAbierta(false);
          }}
        />
      )}

      <aside
        className={`sidebar-mobile-shadow flex w-[230px] flex-shrink-0 flex-col border-r border-bg-row bg-bg-elev max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-[60] max-[899px]:transition-transform max-[899px]:duration-200 ${
          sidebarAbierta ? "max-[899px]:translate-x-0" : "max-[899px]:-translate-x-full"
        }`}
      >
        <div className="px-3 pb-2.5 pt-3.5">
          <div className="flex items-center gap-1.5 text-xl font-extrabold">
            🤖 QA <span className="text-accent-soft">AGENT</span>
          </div>
          <div className="mt-1 text-2xs text-text-faint">Agente-QA-Web · tema oscuro</div>
        </div>

        <div className="mx-3 mb-3.5 rounded-8 border border-border-soft bg-bg-panel p-2.5">
          <div className="text-2xs uppercase tracking-[.05em] text-text-faint">📁 Proyecto</div>
          <form
            className="mt-1 flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (rutaCampo.trim()) cambiarA(rutaCampo.trim());
            }}
          >
            <input
              value={rutaCampo}
              onChange={(e) => {
                setRutaCampo(e.target.value);
              }}
              placeholder="Carpeta del proyecto"
              className="min-w-0 flex-1 rounded-4 border border-border bg-bg-sunken px-1.5 py-1 text-2xs text-text"
            />
            <button type="submit" className="rounded-4 border border-border-strong px-1.5 py-1 text-2xs text-accent-soft">
              Ir
            </button>
          </form>
          {recientes.length > 0 && (
            <select
              className="mt-1.5 w-full rounded-4 border border-border bg-bg-sunken px-1.5 py-1 text-2xs text-text"
              value=""
              onChange={(e) => {
                if (e.target.value) cambiarA(e.target.value);
              }}
            >
              <option value="">Recientes…</option>
              {recientes.map((ruta) => (
                <option key={ruta} value={ruta}>
                  {ruta}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1.5 truncate text-2xs text-text-faint" title={proyectoActual}>
            {proyectoActual || "sin proyecto"}
          </p>
          <p className="mt-1 text-2xs text-text-ghost">URL objetivo: {appUrl && appUrl.trim() ? appUrl : "sin configurar"}</p>
        </div>

        <div className="px-3 pb-1.5 pt-1.5 text-2xs uppercase tracking-[.05em] text-text-faint">Operaciones</div>
        <div className="flex flex-col gap-1 px-2">
          {NAV_OPERACIONES.map((n) => (
            <button
              key={n.pestana}
              type="button"
              onClick={() => {
                ir(n.pestana);
              }}
              className={claseItemNav(n.pestana)}
            >
              <span>{n.icon}</span>
              <span>{n.pestana}</span>
            </button>
          ))}
        </div>

        <div className="px-3 pb-1.5 pt-3.5 text-2xs uppercase tracking-[.05em] text-text-faint">Proyecto</div>
        <div className="flex flex-col gap-1 px-2">
          {NAV_PROYECTO.map((n) => (
            <button
              key={n.pestana}
              type="button"
              onClick={() => {
                ir(n.pestana);
              }}
              className={claseItemNav(n.pestana)}
            >
              <span>{n.icon}</span>
              <span>{n.pestana}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[48px] items-center justify-between gap-2.5 border-b border-bg-row bg-bg-elev px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSidebarAbierta((v) => !v);
              }}
              className="hidden rounded-7 border border-border-strong bg-bg-panel px-2 py-1.5 text-lg text-text-strong max-[899px]:inline-block"
            >
              ☰
            </button>
            <div className="truncate text-md text-text-faint">
              QA Agent / <b className="text-text-bright">{pestana}</b>
            </div>
          </div>
          {corridaActiva && (
            <div className="whitespace-nowrap rounded-6 bg-info-bg px-2.5 py-1 text-sm font-semibold text-info">
              ● en curso: {corridaActiva}
            </div>
          )}
        </header>

        <div key={pestana} className="relative flex-1 animate-page-fade overflow-hidden">
          {contenidoPestana(pestana, setCorridaActiva)}
        </div>
      </main>
    </div>
  );
}
