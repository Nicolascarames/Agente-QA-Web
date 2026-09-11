import { execFile as execFileCb } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commit, descartar, diff, ficherosModificados } from "./git.js";

const execFile = promisify(execFileCb);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout;
}

describe("git.ts", () => {
  let repo: string;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), "agente-qa-web-git-"));
    await git(repo, ["init", "-q"]);
    await git(repo, ["config", "user.email", "test@test.com"]);
    await git(repo, ["config", "user.name", "test"]);
    // Sin esto, en Windows `git checkout --` reescribe LF a CRLF al volcar el blob y las
    // aserciones de contenido byte a byte del test se rompen sin que sea un fallo real de `git.ts`.
    await git(repo, ["config", "core.autocrlf", "false"]);
    await writeFile(path.join(repo, "tracked.txt"), "linea 1\n", "utf8");
    await git(repo, ["add", "tracked.txt"]);
    await git(repo, ["commit", "-q", "-m", "inicial"]);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it("diff incluye un fichero nuevo sin trackear gracias al intent-to-add previo", async () => {
    await writeFile(path.join(repo, "nuevo.txt"), "contenido nuevo\n", "utf8");
    const salida = await diff(repo, ["nuevo.txt"]);
    expect(salida).toContain("nuevo.txt");
    expect(salida).toContain("+contenido nuevo");
  });

  it("diff refleja los cambios de un fichero ya trackeado", async () => {
    await appendFile(path.join(repo, "tracked.txt"), "linea 2\n", "utf8");
    const salida = await diff(repo, ["tracked.txt"]);
    expect(salida).toContain("+linea 2");
  });

  it("ficherosModificados lista, relativas al repo, las rutas con cambios bajo tests/", async () => {
    await mkdir(path.join(repo, "tests"), { recursive: true });
    await writeFile(path.join(repo, "tests", "nuevo.spec.ts"), "// nuevo\n", "utf8");
    const rutas = await ficherosModificados(repo);
    expect(rutas).toEqual(["tests/nuevo.spec.ts"]);
  });

  it("commit añade las rutas dadas y crea un commit con el mensaje", async () => {
    await writeFile(path.join(repo, "nuevo.txt"), "hola\n", "utf8");
    await commit(repo, ["nuevo.txt"], "test: añade nuevo.txt");
    expect((await git(repo, ["log", "-1", "--format=%s"])).trim()).toBe("test: añade nuevo.txt");
    expect((await git(repo, ["status", "--porcelain"])).trim()).toBe("");
  });

  it("descartar borra del disco un fichero nuevo sin blob en HEAD (checkout lo dejaría en 0 bytes)", async () => {
    await writeFile(path.join(repo, "nuevo.txt"), "hola\n", "utf8");
    // Deja el `add -N` en el índice, como en el flujo real (GET /api/generados/diff antes de descartar).
    await diff(repo, ["nuevo.txt"]);
    await descartar(repo, ["nuevo.txt"]);
    await expect(readFile(path.join(repo, "nuevo.txt"), "utf8")).rejects.toThrow();
    expect((await git(repo, ["status", "--porcelain"])).trim()).toBe("");
  });

  it("descartar revierte al contenido de HEAD un fichero ya trackeado", async () => {
    await appendFile(path.join(repo, "tracked.txt"), "linea 2\n", "utf8");
    await descartar(repo, ["tracked.txt"]);
    expect(await readFile(path.join(repo, "tracked.txt"), "utf8")).toBe("linea 1\n");
  });
});
