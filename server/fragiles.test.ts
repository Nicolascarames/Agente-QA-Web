import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listarFragiles } from "./fragiles.js";

describe("listarFragiles", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-fragiles-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("[] si no hay carpetas tests/pages ni tests/specs todavía", async () => {
    await expect(listarFragiles(proyecto)).resolves.toEqual([]);
  });

  it("[] si los ficheros no tienen ninguna marca FRÁGIL", async () => {
    await mkdir(path.join(proyecto, "tests", "pages"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "pages", "login.page.ts"), "export class LoginPage {}\n", "utf8");

    await expect(listarFragiles(proyecto)).resolves.toEqual([]);
  });

  it("encuentra una marca FRÁGIL con su línea y motivo en tests/pages", async () => {
    await mkdir(path.join(proyecto, "tests", "pages"), { recursive: true });
    const contenido = ["export class LoginPage {", '  boton = this.page.locator("button").nth(2); // FRÁGIL: sin atributo estable', "}", ""].join("\n");
    await writeFile(path.join(proyecto, "tests", "pages", "login.page.ts"), contenido, "utf8");

    const fragiles = await listarFragiles(proyecto);

    expect(fragiles).toEqual([{ fichero: "tests/pages/login.page.ts", linea: 2, motivo: "sin atributo estable" }]);
  });

  it("encuentra varias marcas, en tests/pages y tests/specs, con rutas relativas separadas por /", async () => {
    await mkdir(path.join(proyecto, "tests", "pages"), { recursive: true });
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(
      path.join(proyecto, "tests", "pages", "carrito.page.ts"),
      ["export class CarritoPage {", "  a = 1; // FRÁGIL: motivo uno", "  b = 2; // FRÁGIL: motivo dos", "}", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(proyecto, "tests", "specs", "carrito.spec.ts"),
      ["test('x', async () => {", "  // FRÁGIL: motivo tres", "});", ""].join("\n"),
      "utf8",
    );

    const fragiles = await listarFragiles(proyecto);

    expect(fragiles).toEqual([
      { fichero: "tests/pages/carrito.page.ts", linea: 2, motivo: "motivo uno" },
      { fichero: "tests/pages/carrito.page.ts", linea: 3, motivo: "motivo dos" },
      { fichero: "tests/specs/carrito.spec.ts", linea: 2, motivo: "motivo tres" },
    ]);
  });
});
