import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { guardarRutaCli, localizarCli } from "./cli.js";

describe("localizarCli", () => {
  let appDataTmp: string;

  beforeEach(async () => {
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-cli-appdata-"));
    process.env.APPDATA = appDataTmp;
  });

  afterEach(async () => {
    await rm(appDataTmp, { recursive: true, force: true });
  });

  it("diagnostica los tres pasos cuando no se encuentra en ningún sitio", async () => {
    const resultado = await localizarCli({
      comprobarPath: () => false,
      rutaRepoHermano: path.join(appDataTmp, "no-existe", "dist", "cli", "index.js"),
    });

    expect(resultado.encontrado).toBe(false);
    if (!resultado.encontrado) {
      expect(resultado.diagnostico).toHaveLength(3);
      expect(resultado.diagnostico[0]).toContain("PATH");
      expect(resultado.diagnostico[1]).toContain("Repo hermano");
      expect(resultado.diagnostico[2]).toContain("Ruta guardada");
    }
  });

  it("encuentra el binario por PATH cuando el seam de comprobación dice que sí", async () => {
    const resultado = await localizarCli({ comprobarPath: () => true });
    expect(resultado.encontrado).toBe(true);
    if (resultado.encontrado) {
      expect(resultado.cli.origen).toBe("PATH");
    }
  });

  it("encuentra el repo hermano si su ruta compilada existe", async () => {
    const rutaHermano = path.join(appDataTmp, "hermano.js");
    await writeFile(rutaHermano, "// falso dist/cli/index.js", "utf8");
    const resultado = await localizarCli({ comprobarPath: () => false, rutaRepoHermano: rutaHermano });
    expect(resultado.encontrado).toBe(true);
    if (resultado.encontrado) {
      expect(resultado.cli.origen).toBe("repo-hermano");
      expect(resultado.cli.ruta).toBe(rutaHermano);
    }
  });

  it("encuentra la ruta guardada a mano si ni PATH ni el repo hermano aparecen", async () => {
    const rutaGuardada = path.join(appDataTmp, "guardado.js");
    await writeFile(rutaGuardada, "// ruta guardada a mano", "utf8");
    await guardarRutaCli(rutaGuardada);

    const resultado = await localizarCli({
      comprobarPath: () => false,
      rutaRepoHermano: path.join(appDataTmp, "no-existe", "dist", "cli", "index.js"),
    });

    expect(resultado.encontrado).toBe(true);
    if (resultado.encontrado) {
      expect(resultado.cli.origen).toBe("guardado");
      expect(resultado.cli.ruta).toBe(rutaGuardada);
    }
  });
});
