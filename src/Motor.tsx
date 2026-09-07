import { Panel } from "./Panel";
import { SECCION_MOTOR } from "./catalogo/secciones";
import type { ElementoSeccion, PaginaReferencia, Seccion } from "./catalogo/secciones";
import type { NotaFicha } from "./catalogo/tipos";

// Sección "Referencia" (Bloque 6 de la spec de guía integrada): sustituye a `docs/esquema-flujo.html`,
// que vivía fuera de la herramienta. El contenido es dato puro (`catalogo/secciones.ts`); este
// componente y `Instalar.tsx` (que reutiliza `ContenidoReferencia`) solo lo pintan.
const COLOR_NOTA: Record<NotaFicha["tipo"], string> = {
  ok: "border-ok text-ok",
  aviso: "border-accent text-accent",
  peligro: "border-danger text-danger",
};

function Elemento({ elemento }: { elemento: ElementoSeccion }) {
  switch (elemento.tipo) {
    case "parrafo":
      return <p className="text-xs text-text-muted">{elemento.texto}</p>;
    case "lista":
      return (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-text-muted">
          {elemento.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "tabla":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {elemento.encabezados.map((encabezado) => (
                  <th key={encabezado} className="border-b border-border-soft px-2 py-1 text-left text-2xs uppercase tracking-[.05em] text-text-faint">
                    {encabezado}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elemento.filas.map((fila) => (
                <tr key={fila.join("|")}>
                  {fila.map((celda, i) => (
                    <td key={`${fila[0] ?? ""}-${String(i)}`} className="border-b border-border-soft px-2 py-1 align-top text-text-dim">
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "nota":
      return <p className={`rounded-6 border-l-2 pl-2 text-xs ${COLOR_NOTA[elemento.nota.tipo]}`}>{elemento.nota.texto}</p>;
  }
}

function BloqueSeccion({ seccion }: { seccion: Seccion }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-faint">{seccion.titulo}</h3>
      {seccion.elementos.map((elemento, i) => (
        // Los elementos de una sección no tienen id propio y son estáticos (no se reordenan ni
        // se añaden/quitan en runtime), así que el índice es una clave estable de sobra.
        <Elemento key={`${seccion.titulo}-${String(i)}`} elemento={elemento} />
      ))}
    </section>
  );
}

/** Pinta una `PaginaReferencia` entera (intro + secciones); la reutiliza `Instalar.tsx`. */
export function ContenidoReferencia({ pagina }: { pagina: PaginaReferencia }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text">{pagina.intro}</p>
      {pagina.secciones.map((seccion) => (
        <BloqueSeccion key={seccion.titulo} seccion={seccion} />
      ))}
    </div>
  );
}

// La ficha de `mcp tools` y de `catalog` no se pintan aquí: `App.tsx` monta `GuiaPestana` una vez
// por pestaña activa (banda 3, bajo la consola), y las dos ya llevan `pestana: "Motor"` en
// `catalogo/comandos.ts` (Bloque 2) — aparecen solas al entrar en esta pestaña.
export function Motor() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="motor" panelId="contenido" titulo="⚙️ Motor" disposicionPorDefecto={{ x: 0, y: 0, w: 100, h: 100, z: 1 }}>
          <ContenidoReferencia pagina={SECCION_MOTOR} />
        </Panel>
      </div>
    </div>
  );
}
