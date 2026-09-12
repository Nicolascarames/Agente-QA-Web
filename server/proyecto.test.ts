import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  configRaizPath,
  credencialesPath,
  escribirConfigRaiz,
  escribirCredenciales,
  leerConfigRaiz,
  leerCredenciales,
  resolverProyectoInicial,
} from "./proyecto.js";

describe("resolverProyectoInicial", () => {
  it("usa --project del argv si viene", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js", "--project", "C:/proyectos/mi-app"], "C:/otra", {});
    expect(resuelto).toBe(path.resolve("C:/proyectos/mi-app"));
  });

  it("cae a AGENTE_QA_PROJECT si no hay --project en argv", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/otra", { AGENTE_QA_PROJECT: "C:/proyectos/dev" });
    expect(resuelto).toBe(path.resolve("C:/proyectos/dev"));
  });

  it("cae a cwd si no hay ni argv ni env", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/cwd", {});
    expect(resuelto).toBe("C:/cwd");
  });
});

describe("leerConfigRaiz / escribirConfigRaiz", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-config-raiz-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("devuelve null si agente-qa.config.json no existe", async () => {
    expect(await leerConfigRaiz(proyecto)).toBeNull();
  });

  it("devuelve null si el fichero no es JSON válido", async () => {
    await writeFile(configRaizPath(proyecto), "no es json", "utf8");
    expect(await leerConfigRaiz(proyecto)).toBeNull();
  });

  it("devuelve null si falta appUrl", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ schemaVersion: 1 }), "utf8");
    expect(await leerConfigRaiz(proyecto)).toBeNull();
  });

  it("escribe y relee la config raíz", async () => {
    await escribirConfigRaiz(proyecto, {
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "produccion",
      barrera: true,
      listaBlanca: ["http://localhost:3000"],
    });
    expect(await leerConfigRaiz(proyecto)).toEqual({
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "produccion",
      barrera: true,
      listaBlanca: ["http://localhost:3000"],
    });
  });

  it("rellena entorno/barrera/listaBlanca con sus defaults si faltan en el JSON leído", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ schemaVersion: 1, appUrl: "http://localhost:3000" }), "utf8");
    expect(await leerConfigRaiz(proyecto)).toEqual({
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "pruebas",
      barrera: false,
      listaBlanca: [],
    });
  });
});

describe("leerCredenciales / escribirCredenciales", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-credenciales-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("devuelve variables: [] si agente-qa.credenciales.json no existe todavía (no es un error)", async () => {
    expect(await leerCredenciales(proyecto)).toEqual({ schemaVersion: 1, variables: [] });
  });

  it("devuelve variables: [] si el fichero no es JSON válido", async () => {
    await writeFile(credencialesPath(proyecto), "no es json", "utf8");
    expect(await leerCredenciales(proyecto)).toEqual({ schemaVersion: 1, variables: [] });
  });

  it("escribe y relee las credenciales", async () => {
    await escribirCredenciales(proyecto, {
      schemaVersion: 1,
      variables: [
        { nombre: "USUARIO", valor: "admin" },
        { nombre: "CONTRASENA", valor: "secreto123" },
      ],
    });
    expect(await leerCredenciales(proyecto)).toEqual({
      schemaVersion: 1,
      variables: [
        { nombre: "USUARIO", valor: "admin" },
        { nombre: "CONTRASENA", valor: "secreto123" },
      ],
    });
  });

  it("ignora entradas mal formadas (sin nombre/valor string) al releer", async () => {
    await writeFile(
      credencialesPath(proyecto),
      JSON.stringify({ schemaVersion: 1, variables: [{ nombre: "OK", valor: "1" }, { nombre: 5, valor: "x" }, "no-es-objeto"] }),
      "utf8"
    );
    expect(await leerCredenciales(proyecto)).toEqual({ schemaVersion: 1, variables: [{ nombre: "OK", valor: "1" }] });
  });

  it("crea el .gitignore con la entrada si no existía, al guardar credenciales por primera vez", async () => {
    await escribirCredenciales(proyecto, { schemaVersion: 1, variables: [{ nombre: "A", valor: "1" }] });
    const gitignore = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    expect(gitignore.split(/\r?\n/)).toContain("agente-qa.credenciales.json");
  });

  it("añade la entrada a un .gitignore existente sin duplicarla en escrituras sucesivas", async () => {
    await writeFile(path.join(proyecto, ".gitignore"), "node_modules/\n", "utf8");
    await escribirCredenciales(proyecto, { schemaVersion: 1, variables: [{ nombre: "A", valor: "1" }] });
    await escribirCredenciales(proyecto, { schemaVersion: 1, variables: [{ nombre: "A", valor: "2" }] });
    const gitignore = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    const lineas = gitignore.split(/\r?\n/).filter((l) => l.trim() === "agente-qa.credenciales.json");
    expect(lineas).toHaveLength(1);
    expect(gitignore).toContain("node_modules/");
  });
});
