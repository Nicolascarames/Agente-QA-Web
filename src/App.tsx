import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { obtenerProyecto } from "./api";
import { Dashboard } from "./Dashboard";
import { Configuracion } from "./Configuracion";
import { Empezar } from "./Empezar";
import { Redactar } from "./Redactar";
import { Generar } from "./Generar";
import { Ejecutar } from "./Ejecutar";
import { Reparar } from "./Reparar";
import { Reports } from "./Reports";
import { useCorridaGlobal, type EstadoCorridaGlobal } from "./useCorridaGlobal";
import { ConsolaGlobal } from "./ConsolaGlobal";

// Las siete pestañas de ESTADO.md más "Empezar" (guía de primeros pasos). Bloque 2: fuera Explorar
// (el mapeador antiguo) y fuera Motor/Instalar (la guía integrada, atada al mismo catálogo del CLI
// que se borró con él) — "Empezar" es su reemplazo, ya dentro del catálogo de pestañas actual.
type Pestana = "Empezar" | "Dashboard" | "Configuración" | "Redactar" | "Generar" | "Ejecutar" | "Reparar" | "Reports";

// Wiring propio de "Empezar": no forma parte de `EstadoCorridaGlobal` (esa es la consola de chat,
// esto es "escribe un texto en la consola" y "recuerda que ya vi la guía"), así que viaja aparte.
interface WiringEmpezar {
  escribirEnConsola: (texto: string) => void;
  descartarGuia: () => void;
}

// Redactar/Generar (Bloque 6) y Ejecutar/Reparar (Bloque 7) traen cada una su propio chat ligero
// que reutiliza el mismo estado de corrida que la consola global de la banda 2, así que las cuatro
// necesitan las mismas tres piezas que recibe `<ConsolaGlobal>`.
function contenidoPestana(pestana: Pestana, corrida: EstadoCorridaGlobal, wiringEmpezar: WiringEmpezar) {
  switch (pestana) {
    case "Empezar":
      return <Empezar onEscribirEjemplo={wiringEmpezar.escribirEnConsola} onGuiaDescartada={wiringEmpezar.descartarGuia} />;
    case "Dashboard":
      return <Dashboard />;
    case "Configuración":
      return <Configuracion />;
    case "Redactar":
      return <Redactar {...corrida} />;
    case "Generar":
      return <Generar {...corrida} />;
    case "Ejecutar":
      return <Ejecutar {...corrida} />;
    case "Reparar":
      return <Reparar {...corrida} />;
    case "Reports":
      return <Reports />;
  }
}

// Grupos e iconos de la barra lateral. "Operaciones" son las cinco puertas de trabajo;
// "Proyecto" son las tres pantallas de lectura/ajuste del proyecto activo (Empezar delante: es la
// primera parada de quien no ha leído nada).
const NAV_OPERACIONES: { pestana: Pestana; icon: string }[] = [
  { pestana: "Dashboard", icon: "📊" },
  { pestana: "Redactar", icon: "✍️" },
  { pestana: "Generar", icon: "🧪" },
  { pestana: "Ejecutar", icon: "▶️" },
  { pestana: "Reparar", icon: "🔧" },
];
const NAV_PROYECTO: { pestana: Pestana; icon: string }[] = [
  { pestana: "Empezar", icon: "🚀" },
  { pestana: "Reports", icon: "📈" },
  { pestana: "Configuración", icon: "⚙️" },
];

// Clave de localStorage que marca que ya se ha visto la guía — puesta solo por el botón "No volver
// a mostrar" de Empezar.tsx. Envuelta en try/catch en todos sus usos: localStorage puede lanzar
// (modo privado, cuota agotada).
const CLAVE_GUIA_DESCARTADA = "agente-qa:guia-descartada";

/** Pura: qué pestaña abre la app según lo que hubiera en `CLAVE_GUIA_DESCARTADA`. Extraída (en vez
 *  de inline en el `useState`) para poder testearla sin montar la app entera. */
export function decidirPestanaInicial(guiaDescartada: string | null): Pestana {
  return guiaDescartada ? "Dashboard" : "Empezar";
}

function leerGuiaDescartada(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_GUIA_DESCARTADA);
  } catch {
    return null;
  }
}

export default function App() {
  const [pestana, setPestana] = useState<Pestana>(() => decidirPestanaInicial(leerGuiaDescartada()));
  const [proyectoActual, setProyectoActual] = useState<string>("");
  const [sidebarAbierta, setSidebarAbierta] = useState(false);
  // Borrador que Empezar quiere dejar escrito (no enviado) en la consola global — null cuando no
  // hay nada pendiente. Vive aquí porque `<Empezar>` y `<ConsolaGlobal>` no se conocen entre sí.
  const [borradorConsola, setBorradorConsola] = useState<string | null>(null);

  const descartarGuia = () => {
    try {
      window.localStorage.setItem(CLAVE_GUIA_DESCARTADA, "1");
    } catch {
      // No es crítico: si falla, la guía volverá a abrirse la próxima vez, nada más.
    }
  };

  // El indicador "● en curso" y el panel de consola global comparten el mismo hook: vive aquí
  // (nunca se desmonta al cambiar de pestaña).
  const corridaGlobal = useCorridaGlobal();
  const { corridaActiva, eventos, marcarCorridaActiva, agregarMensajeUsuario } = corridaGlobal;

  // Una sola fila dentro de `<main>`: la pestaña activa a la izquierda y la consola pegada al
  // borde derecho, ambas del mismo alto (viewport menos la topbar) — así las secciones movibles
  // de la pestaña y la consola caben las tres en pantalla sin scroll entre bandas. La altura de la
  // topbar se mide en runtime (no se adivina) porque su contenido (el aviso "en curso") puede
  // cambiar su alto real entre pestañas.
  const topbarRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    void obtenerProyecto().then((datos) => {
      setProyectoActual(datos.actual);
    });
  }, []);

  const ir = (p: Pestana) => {
    setPestana(p);
    setSidebarAbierta(false);
  };

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

        {/* Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin selector ni recientes. */}
        <div className="mx-3 mb-3.5 rounded-8 border border-border-soft bg-bg-panel p-2.5">
          <div className="text-2xs uppercase tracking-[.05em] text-text-faint">📁 Proyecto</div>
          <p className="mt-1 truncate text-2xs text-text-faint" title={proyectoActual}>
            {proyectoActual || "sin proyecto"}
          </p>
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

        {/* La pestaña activa (izquierda) y la consola global (derecha), en la misma fila y al
            mismo alto — cada una mide su propio `[data-canvas]`: la pestaña trae el suyo anidado
            (ver Redactar/Dashboard/etc.) tras su propio `p-4`; la consola no, así que este
            contenedor le da el mismo `p-4` + `[data-canvas]` interior, para que el panel de la
            consola quede al mismo margen del borde que los de cualquier otra pestaña. */}
        <div className="flex" style={{ height: alturaBanda }}>
          <div className="relative h-full w-[70%] shrink-0 overflow-hidden">
            <div key={pestana} className="relative h-full w-full animate-page-fade overflow-hidden">
              {contenidoPestana(pestana, corridaGlobal, {
                escribirEnConsola: setBorradorConsola,
                descartarGuia,
              })}
            </div>
          </div>

          <div className="flex h-full w-[30%] shrink-0 flex-col p-4">
            <div className="relative flex-1" data-canvas="true">
              <ConsolaGlobal
                corridaActiva={corridaActiva}
                eventos={eventos}
                marcarCorridaActiva={marcarCorridaActiva}
                agregarMensajeUsuario={agregarMensajeUsuario}
                borradorConsola={borradorConsola}
                onBorradorAplicado={() => {
                  setBorradorConsola(null);
                }}
                onAbrirPestana={setPestana}
              />
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
