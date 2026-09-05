import { useCallback, useEffect, useState } from "react";
import { cambiarProyecto, obtenerProyecto } from "./api";
import { Dashboard } from "./Dashboard";
import { Configuracion } from "./Configuracion";
import { Explorar } from "./Explorar";
import { Redactar } from "./Redactar";
import { Generar } from "./Generar";
import { Ejecutar } from "./Ejecutar";
import { Reparar } from "./Reparar";
import { Reports } from "./Reports";

const PESTANAS = ["Dashboard", "Configuración", "Explorar", "Redactar", "Generar", "Ejecutar", "Reparar", "Reports"] as const;
type Pestana = (typeof PESTANAS)[number];

function contenidoPestana(pestana: Pestana) {
  switch (pestana) {
    case "Dashboard":
      return <Dashboard />;
    case "Configuración":
      return <Configuracion />;
    case "Explorar":
      return <Explorar />;
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

export default function App() {
  const [pestana, setPestana] = useState<Pestana>("Dashboard");
  const [proyectoActual, setProyectoActual] = useState<string>("");
  const [recientes, setRecientes] = useState<string[]>([]);
  const [rutaCampo, setRutaCampo] = useState("");

  useEffect(() => {
    void obtenerProyecto().then((datos) => {
      setProyectoActual(datos.actual);
      setRutaCampo(datos.actual);
      setRecientes(datos.recientes);
    });
  }, []);

  const cambiarA = useCallback((ruta: string) => {
    void cambiarProyecto(ruta).then((datos) => {
      setProyectoActual(datos.actual);
      setRutaCampo(datos.actual);
      setRecientes(datos.recientes);
    });
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex flex-col gap-2 border-b border-accent/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-accent">Agente QA Web</span>
          <form
            className="flex flex-1 items-center gap-2"
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
              className="flex-1 rounded-md border border-accent/30 bg-panel px-2 py-1 text-sm"
            />
            <button type="submit" className="rounded-md border border-accent/60 px-3 py-1 text-sm text-accent">
              Cambiar
            </button>
          </form>
          {recientes.length > 0 && (
            <select
              className="rounded-md border border-accent/30 bg-panel px-2 py-1 text-sm"
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
        </div>
        <p className="truncate text-xs text-text/50" title={proyectoActual}>
          {proyectoActual || "sin proyecto"}
        </p>
      </header>

      <nav className="flex gap-1 border-b border-accent/30 px-4 py-2 text-sm">
        {PESTANAS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPestana(p);
            }}
            className={`rounded-md px-3 py-1 ${p === pestana ? "bg-panel text-accent" : "text-text/60 hover:text-text"}`}
          >
            {p}
          </button>
        ))}
      </nav>

      <main className="relative flex-1 overflow-hidden">{contenidoPestana(pestana)}</main>
    </div>
  );
}
