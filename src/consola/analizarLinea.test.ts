import { describe, expect, it } from "vitest";
import { catalogoResuelto } from "../catalogo/catalogo";
import { analizarLinea } from "./analizarLinea";

// Catálogo real (17 fichas, ya cruzadas con `cli.generado.json`): estos tests ejercitan comandos
// reales del CLI, no una fábrica a mano, así que un cambio de forma en el generado los rompe a la
// vez que al resto del catálogo — coherente con cómo se prueba `catalogo.test.ts`.
const catalogo = catalogoResuelto();

describe("analizarLinea", () => {
  it("tipo comando: sugiere nombres de comando por prefijo", () => {
    const analisis = analizarLinea("rec", 3, catalogo);
    expect(analisis).toMatchObject({ tokenActual: "rec", inicioToken: 0, tipo: "comando", comando: null });
    expect(analisis.sugerencias.map((sugerencia) => sugerencia.inserta)).toEqual(["record"]);
  });

  it("tipo subcomando: 'llm ' ofrece 'ping', no un comando suelto", () => {
    const analisis = analizarLinea("llm ", 4, catalogo);
    expect(analisis.tipo).toBe("subcomando");
    expect(analisis.comando).toEqual(["llm"]);
    expect(analisis.sugerencias.map((sugerencia) => sugerencia.inserta)).toEqual(["ping"]);
  });

  it("tipo flag: 'record --' ofrece las seis opciones reales de record más las dos globales", () => {
    const analisis = analizarLinea("record --", 9, catalogo);
    expect(analisis.tipo).toBe("flag");
    expect(analisis.comando).toEqual(["record"]);
    expect(analisis.sugerencias.map((sugerencia) => sugerencia.inserta)).toEqual([
      "--raw",
      "--headed",
      "--max-duration",
      "--auto",
      "--allow-writes",
      "--no-writes",
      "--version",
      "--json",
    ]);
    // `--auto` cambia de ejes (conductor claude-code / coste suscripción): se ve en su sugerencia.
    const auto = analisis.sugerencias.find((sugerencia) => sugerencia.inserta === "--auto");
    expect(auto?.ejes.conductor).toBe("claude-code");
    expect(auto?.ejes.coste).toBe("suscripcion");
  });

  it("tipo valor-de-flag: 'init --env ' ofrece los cuatro entornos", () => {
    const analisis = analizarLinea("init --env ", 11, catalogo);
    expect(analisis.tipo).toBe("valor-de-flag");
    expect(analisis.comando).toEqual(["init"]);
    expect(analisis.sugerencias.map((sugerencia) => sugerencia.inserta)).toEqual(["dev", "test", "staging", "production"]);
  });

  it("tipo argumento: texto libre tras el comando, sin sugerencias", () => {
    const analisis = analizarLinea("record https://ejemplo.com", 27, catalogo);
    expect(analisis.tipo).toBe("argumento");
    expect(analisis.comando).toEqual(["record"]);
    expect(analisis.sugerencias).toEqual([]);
  });

  it("cursor a mitad de token: sugiere sobre el token bajo el cursor, no sobre el final de la línea", () => {
    const texto = "map --goal login";
    const cursorEnGoal = texto.indexOf("--goal") + 3; // dentro de "--g|oal"
    const analisis = analizarLinea(texto, cursorEnGoal, catalogo);
    expect(analisis.tokenActual).toBe("--goal");
    expect(analisis.inicioToken).toBe(texto.indexOf("--goal"));
    expect(analisis.tipo).toBe("flag");
    expect(analisis.comando).toEqual(["map"]);
    expect(analisis.sugerencias.some((sugerencia) => sugerencia.inserta === "--goal")).toBe(true);
  });

  it("no sugiere una flag que 'validarLinea' (B8) rechazaría por incompatible con las ya puestas", () => {
    const analisis = analizarLinea("map --all --", 12, catalogo);
    expect(analisis.tipo).toBe("flag");
    const insertadas = analisis.sugerencias.map((sugerencia) => sugerencia.inserta);
    expect(insertadas).not.toContain("--goal");
  });

  it("incluye las opciones globales de Commander: 'map --js' sugiere '--json'", () => {
    const analisis = analizarLinea("map --js", 8, catalogo);
    expect(analisis.tipo).toBe("flag");
    expect(analisis.sugerencias.map((sugerencia) => sugerencia.inserta)).toContain("--json");
  });
});
