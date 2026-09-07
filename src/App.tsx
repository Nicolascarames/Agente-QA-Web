import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cambiarProyecto, obtenerConfigProyecto, obtenerProyecto } from "./api";
import { Dashboard } from "./Dashboard";
import { Configuracion } from "./Configuracion";
import { Explorar } from "./Explorar";
import { Redactar } from "./Redactar";
import { Generar } from "./Generar";
import { Ejecutar } from "./Ejecutar";
import { Reparar } from "./Reparar";
import { Reports } from "./Reports";
import { Motor } from "./Motor";
import { Instalar } from "./Instalar";
import { useCorridaGlobal } from "./useCorridaGlobal";
import { ConsolaGlobal } from "./ConsolaGlobal";
import { GuiaPestana } from "./GuiaPestana";
import { CajonFicha } from "./CajonFicha";
import { catalogoResuelto } from "./catalogo/catalogo";
import { idFicha } from "./catalogo/porPestana";

type Pestana =
  | "Dashboard"
  | "Configuración"
  | "Explorar"
  | "Redactar"
  | "Generar"
  | "Ejecutar"
  | "Reparar"
  | "Reports"
  | "Motor"
  | "Instalar";

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
    case "Motor":
      return <Motor />;
    case "Instalar":
      return <Instalar />;
  }
}

// Grupos e iconos de la barra lateral, calcados de `navMeta` en
// design/mockup-design.js. "Operaciones" son las seis puertas de trabajo;
// "Proyecto" son las dos pantallas de lectura/ajuste del proyecto activo.
// "Referencia" (Bloque 6 de la spec de guía integrada) es la sección nueva que sustituye a
// `docs/esquema-flujo.html`: material de consulta, no trabajo sobre un proyecto concreto.
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
const NAV_REFERENCIA: { pestana: Pestana; icon: string }[] = [
  { pestana: "Motor", icon: "🧠" },
  { pestana: "Instalar", icon: "📦" },
];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>("Dashboard");
  const [proyectoActual, setProyectoActual] = useState<string>("");
  const [recientes, setRecientes] = useState<string[]>([]);
  const [rutaCampo, setRutaCampo] = useState("");
  const [sidebarAbierta, setSidebarAbierta] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  // Id de la ficha con el cajón de detalle abierto (Bloque 4), o `null` si está cerrado. Vive
  // aquí (no en GuiaPestana) porque el cajón se pinta por encima de todo el árbol y lo abrirán
  // también el buscador y la consola asistida de bloques futuros.
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  // Memoizado por identidad: `CajonFicha` reinicia efectos internos (mostrada/flagFoco) cuando
  // `resuelta` cambia de identidad, y `catalogoResuelto()` construye un array/objetos nuevos en
  // cada llamada — sin este `useMemo`, cualquier re-render de `App` con el cajón abierto (p. ej.
  // los que dispara `useCorridaGlobal` en cada evento SSE) los reiniciaría de más.
  const resueltaAbierta = useMemo(
    () => (fichaAbierta ? (catalogoResuelto().find((resuelta) => idFicha(resuelta.ficha) === fichaAbierta) ?? null) : null),
    [fichaAbierta],
  );
  const cerrarFicha = useCallback(() => {
    setFichaAbierta(null);
  }, []);

  // El indicador "● en curso" y el panel de consola global comparten el mismo hook: vive aquí
  // (nunca se desmonta al cambiar de pestaña), a diferencia del antiguo estado que solo subía
  // desde Explorar.
  const { corridaActiva, eventos, resumenFinal, marcarCorridaActiva } = useCorridaGlobal();

  // Tres bandas apiladas dentro de `<main>` (Bloque 3): cada una es su propio `[data-canvas]` de
  // un viewport de alto menos la topbar, así los paneles flotantes de cada banda quedan acotados a
  // ella. La altura de la topbar se mide en runtime (no se adivina) porque su contenido (el aviso
  // "en curso") puede cambiar su alto real entre pestañas.
  const topbarRef = useRef<HTMLElement | null>(null);
  const banda1Ref = useRef<HTMLDivElement | null>(null);
  const banda2Ref = useRef<HTMLDivElement | null>(null);
  const [alturaTopbar, setAlturaTopbar] = useState(48);

  useLayoutEffect(() => {
    const nodo = topbarRef.current;
    if (!nodo) return;
    const medir = () => setAlturaTopbar(nodo.getBoundingClientRect().height);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const alturaBanda = `calc(100vh - ${String(alturaTopbar)}px)`;

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
    <div className="min-h-screen w-screen bg-bg text-text">
      <div className="flex h-screen w-screen overflow-hidden">
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

        <div className="px-3 pb-1.5 pt-3.5 text-2xs uppercase tracking-[.05em] text-text-faint">Referencia</div>
        <div className="flex flex-col gap-1 px-2">
          {NAV_REFERENCIA.map((n) => (
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

      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <header ref={topbarRef} className="sticky top-0 z-20 flex min-h-[48px] items-center justify-between gap-2.5 border-b border-bg-row bg-bg-elev px-4">
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
          <div className="flex items-center gap-2.5">
            {corridaActiva && (
              <div className="whitespace-nowrap rounded-6 bg-info-bg px-2.5 py-1 text-sm font-semibold text-info">
                ● en curso: {corridaActiva}
              </div>
            )}
          </div>
        </header>

        {/* Banda 1 — la pestaña activa. */}
        <div ref={banda1Ref} className="relative" data-canvas="true" style={{ height: alturaBanda }}>
          <div key={pestana} className="relative h-full animate-page-fade overflow-hidden">
            {contenidoPestana(pestana, marcarCorridaActiva)}
          </div>
          <button
            type="button"
            onClick={() => {
              banda2Ref.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="absolute bottom-3 right-3 z-10 rounded-6 border border-border-strong bg-bg-panel px-2.5 py-1 text-xs font-semibold text-text-strong shadow-[var(--sidebar-shadow)]"
          >
            ↓ Consola y guía
          </button>
        </div>

        {/* Banda 2 — la consola global, igual que antes pero acotada a su propio lienzo. */}
        <div ref={banda2Ref} className="relative" data-canvas="true" style={{ height: alturaBanda }}>
          <ConsolaGlobal
            corridaActiva={corridaActiva}
            eventos={eventos}
            resumenFinal={resumenFinal}
            marcarCorridaActiva={marcarCorridaActiva}
          />
        </div>

        {/* Banda 3 — la guía de la pestaña activa. */}
        <div className="relative" data-canvas="true" style={{ height: alturaBanda }}>
          <GuiaPestana pestana={pestana} onAbrirFicha={setFichaAbierta} />
          <button
            type="button"
            onClick={() => {
              banda1Ref.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="absolute bottom-3 right-3 z-10 rounded-6 border border-border-strong bg-bg-panel px-2.5 py-1 text-xs font-semibold text-text-strong shadow-[var(--sidebar-shadow)]"
          >
            ↑ Arriba
          </button>
        </div>
      </main>
      </div>

      {/* Fuera del `<main>`/`<aside>` a propósito: ningún panel (react-rnd usa `transform` para
          posicionarse) debe quedar entre este cajón y el viewport, o su `position: fixed` dejaría
          de calcularse contra la ventana. */}
      <CajonFicha resuelta={resueltaAbierta} onCerrar={cerrarFicha} />
    </div>
  );
}
