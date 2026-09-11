import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { instalar } from "./instalar.js";

const MARCADOR = "Generado por `agente-qa instalar`. No editar a mano: los cambios se pierden en la siguiente instalación.";

describe("instalar", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-instalar-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("sin destino previo, escribe los tres destinos con el contenido esperado", async () => {
    const resultado = await instalar(proyecto);

    expect(resultado.omitidos).toEqual([]);
    expect(resultado.escritos).toEqual(
      expect.arrayContaining([
        path.join(".claude", "skills", "qa", "SKILL.md"),
        path.join(".claude", "skills", "qa", "referencias", "localizadores.md"),
        path.join(".claude", "skills", "qa", "referencias", "plantillas.md"),
        "AGENTS.md",
        path.join(".github", "copilot-instructions.md"),
      ]),
    );

    const skillMd = await readFile(path.join(proyecto, ".claude", "skills", "qa", "SKILL.md"), "utf8");
    expect(skillMd).toContain("---\nname: qa");
    expect(skillMd).toContain(MARCADOR);

    const agentsMd = await readFile(path.join(proyecto, "AGENTS.md"), "utf8");
    expect(agentsMd).not.toContain("---\nname: qa");
    expect(agentsMd).toContain(MARCADOR);

    const copilotMd = await readFile(path.join(proyecto, ".github", "copilot-instructions.md"), "utf8");
    expect(copilotMd).not.toContain("---\nname: qa");
    expect(copilotMd).toContain(MARCADOR);
    expect(copilotMd).toBe(agentsMd);
  });

  it("--solo codex escribe solo AGENTS.md", async () => {
    const resultado = await instalar(proyecto, { solo: "codex" });

    expect(resultado.escritos).toEqual(["AGENTS.md"]);
    expect(resultado.omitidos).toEqual([]);
  });

  it("si el destino ya existe y lleva el marcador, se sobrescribe sin llamar a confirmar", async () => {
    await writeFile(path.join(proyecto, "AGENTS.md"), `<!-- ${MARCADOR} -->\ncontenido viejo`, "utf8");
    let llamado = false;

    const resultado = await instalar(proyecto, {
      solo: "codex",
      confirmar: (mensaje) => {
        llamado = true;
        return Promise.resolve(mensaje.length > 0);
      },
    });

    expect(llamado).toBe(false);
    expect(resultado.escritos).toEqual(["AGENTS.md"]);
    const contenido = await readFile(path.join(proyecto, "AGENTS.md"), "utf8");
    expect(contenido).not.toBe("contenido viejo");
  });

  it("destino ajeno existente, confirmar devuelve false → va a omitidos y no se toca", async () => {
    await writeFile(path.join(proyecto, "AGENTS.md"), "contenido de otra herramienta", "utf8");

    const resultado = await instalar(proyecto, { solo: "codex", confirmar: () => Promise.resolve(false) });

    expect(resultado.omitidos).toEqual(["AGENTS.md"]);
    expect(resultado.escritos).toEqual([]);
    const contenido = await readFile(path.join(proyecto, "AGENTS.md"), "utf8");
    expect(contenido).toBe("contenido de otra herramienta");
  });

  it("destino ajeno existente, confirmar devuelve true → se sobrescribe", async () => {
    await writeFile(path.join(proyecto, "AGENTS.md"), "contenido de otra herramienta", "utf8");

    const resultado = await instalar(proyecto, { solo: "codex", confirmar: () => Promise.resolve(true) });

    expect(resultado.escritos).toEqual(["AGENTS.md"]);
    expect(resultado.omitidos).toEqual([]);
    const contenido = await readFile(path.join(proyecto, "AGENTS.md"), "utf8");
    expect(contenido).not.toBe("contenido de otra herramienta");
  });

  it("sin función confirmar y fichero ajeno existente, va a omitidos sin lanzar", async () => {
    await mkdir(path.join(proyecto, ".github"), { recursive: true });
    await writeFile(path.join(proyecto, ".github", "copilot-instructions.md"), "contenido de otra herramienta", "utf8");

    const resultado = await instalar(proyecto, { solo: "copilot" });

    expect(resultado.omitidos).toEqual([path.join(".github", "copilot-instructions.md")]);
    expect(resultado.escritos).toEqual([]);
  });
});
