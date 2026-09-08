// Fija la semántica "OR dentro del eje, AND entre ejes" con el mismo recorrido que el test manual
// de la spec (Bloque 5, pasos 1-4): universo = las fichas de "Explorar", que son browse/snapshot/
// record/map/run.
import { describe, expect, it } from "vitest";
import { fichasDePestana } from "./porPestana";
import { criterioVacio, filtrarFichas, hayFiltroActivo, type CriterioFiltro } from "./filtrar";

const explorar = fichasDePestana("Explorar");
const idsDe = (fichas: typeof explorar) => fichas.map((resuelta) => resuelta.ficha.ruta.join(" ")).sort();

describe("filtrarFichas", () => {
  it("criterio vacío no descarta nada", () => {
    expect(filtrarFichas(explorar, criterioVacio())).toEqual(explorar);
  });

  it("chip de coste 'facturado' deja solo map y run", () => {
    const criterio: CriterioFiltro = { ...criterioVacio(), coste: ["facturado"] };
    expect(idsDe(filtrarFichas(explorar, criterio))).toEqual(["map", "run"]);
  });

  it("OR dentro del eje: coste facturado o cero suma browse, record y snapshot", () => {
    const criterio: CriterioFiltro = { ...criterioVacio(), coste: ["facturado", "cero"] };
    expect(idsDe(filtrarFichas(explorar, criterio))).toEqual(["agarraderos", "browse", "map", "record", "run", "snapshot"]);
  });

  it("AND entre ejes: conductor llm-api + coste facturado sigue siendo solo map y run", () => {
    const criterio: CriterioFiltro = { ...criterioVacio(), conductor: ["llm-api"], coste: ["facturado"] };
    expect(idsDe(filtrarFichas(explorar, criterio))).toEqual(["map", "run"]);
  });

  it("AND entre ejes: conductor 'humano' + coste facturado no lo cumple nadie", () => {
    const criterio: CriterioFiltro = { ...criterioVacio(), conductor: ["humano"], coste: ["facturado"] };
    expect(filtrarFichas(explorar, criterio)).toEqual([]);
  });

  it("el texto busca en palabrasClave, no solo en el nombre del comando", () => {
    const configuracion = fichasDePestana("Configuración");
    const criterio: CriterioFiltro = { ...criterioVacio(), texto: "clave" };
    expect(idsDe(filtrarFichas(configuracion, criterio))).toContain("config");
  });

  it("el texto es insensible a mayúsculas y a espacios sobrantes", () => {
    const configuracion = fichasDePestana("Configuración");
    const criterio: CriterioFiltro = { ...criterioVacio(), texto: "  CLAVE  " };
    expect(idsDe(filtrarFichas(configuracion, criterio))).toContain("config");
  });

  it("hayFiltroActivo distingue un criterio vacío de uno con algo marcado", () => {
    expect(hayFiltroActivo(criterioVacio())).toBe(false);
    expect(hayFiltroActivo({ ...criterioVacio(), texto: "algo" })).toBe(true);
    expect(hayFiltroActivo({ ...criterioVacio(), coste: ["cero"] })).toBe(true);
  });
});
