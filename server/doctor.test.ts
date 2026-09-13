import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { comprobarBinarioSdk, comprobarCredenciales, comprobarNode, comprobarPlaywright, ejecutarDoctor } from "./doctor.js";

describe("comprobarNode", () => {
  it("ok con Node 22 o superior", () => {
    expect(comprobarNode("22.5.0").ok).toBe(true);
    expect(comprobarNode("24.0.0").ok).toBe(true);
  });

  it("falla con Node menor de 22 y lo dice en el mensaje", () => {
    const resultado = comprobarNode("18.20.0");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("18.20.0");
  });
});

describe("comprobarCredenciales", () => {
  let dirFalso: string;

  beforeEach(async () => {
    dirFalso = await mkdtemp(path.join(tmpdir(), "agente-qa-web-creds-"));
  });

  afterEach(async () => {
    await rm(dirFalso, { recursive: true, force: true });
  });

  it("falla con el mensaje de `claude login` si no hay fichero de credenciales", async () => {
    const resultado = await comprobarCredenciales({ CLAUDE_CONFIG_DIR: dirFalso });
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("claude login");
  });

  it("ok si existe .credentials.json bajo CLAUDE_CONFIG_DIR", async () => {
    await writeFile(path.join(dirFalso, ".credentials.json"), "{}", "utf8");
    const resultado = await comprobarCredenciales({ CLAUDE_CONFIG_DIR: dirFalso });
    expect(resultado.ok).toBe(true);
  });

  it("cae al homedir inyectado si no hay CLAUDE_CONFIG_DIR", async () => {
    await mkdir(path.join(dirFalso, ".claude"), { recursive: true });
    await writeFile(path.join(dirFalso, ".claude", ".credentials.json"), "{}", "utf8");
    const resultado = await comprobarCredenciales({}, dirFalso);
    expect(resultado.ok).toBe(true);
  });
});

describe("comprobarBinarioSdk", () => {
  let paquete: string;

  beforeEach(async () => {
    paquete = await mkdtemp(path.join(tmpdir(), "agente-qa-web-sdk-nativo-"));
    const nombreBinario = process.platform === "win32" ? "claude.exe" : "claude";
    await writeFile(path.join(paquete, nombreBinario), "", "utf8");
    await writeFile(path.join(paquete, "package.json"), "{}", "utf8");
  });

  afterEach(async () => {
    await rm(paquete, { recursive: true, force: true });
  });

  it("ok si el resolver inyectado encuentra el package.json y el binario existe junto a él", async () => {
    const resultado = await comprobarBinarioSdk(() => path.join(paquete, "package.json"));
    expect(resultado.ok).toBe(true);
  });

  it("falla con el mensaje de reinstalar si el resolver no encuentra ningún paquete", async () => {
    const resultado = await comprobarBinarioSdk(() => {
      throw new Error("no encontrado");
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("--omit=optional");
  });
});

describe("comprobarPlaywright", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-playwright-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("falla con el comando exacto si no está instalado", async () => {
    const resultado = await comprobarPlaywright(proyecto);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("npm i -D @playwright/test && npx playwright install chromium");
  });

  it("ok si node_modules/@playwright/test existe", async () => {
    const dir = path.join(proyecto, "node_modules", "@playwright", "test");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "package.json"), "{}", "utf8");
    const resultado = await comprobarPlaywright(proyecto);
    expect(resultado.ok).toBe(true);
  });
});

describe("ejecutarDoctor", () => {
  it("ok solo si las cuatro comprobaciones pasan", async () => {
    const proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-doctor-"));
    try {
      const resultado = await ejecutarDoctor(proyecto, {});
      expect(resultado.comprobaciones).toHaveLength(4);
      expect(resultado.ok).toBe(resultado.comprobaciones.every((c) => c.ok));
    } finally {
      await rm(proyecto, { recursive: true, force: true });
    }
  });
});
