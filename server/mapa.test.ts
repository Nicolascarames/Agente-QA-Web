import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectPaths } from "agente-qa-contract/project";
import { corregirLocalizador } from "./mapa.js";
import { lanzarCorrida } from "./corridas.js";
import type { ResultadoLocalizarCli } from "./cli.js";
import type { EventoNdjson } from "../shared/tipos.js";

const fixtureMapa = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "map-valido.json");
const VERSION_FAKE = "0.0.0-test";

const LOCALIZADO_OK: ResultadoLocalizarCli = {
  encontrado: true,
  cli: { comando: "agente-qa-mcp", argsPrevios: [], origen: "PATH", ruta: "agente-qa-mcp" },
};

/** Mismo fake de `ChildProcess` que `corridas.test.ts`. */
function crearProcesoFake() {
  const proceso = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
  proceso.stdout = new EventEmitter() as ChildProcess["stdout"];
  proceso.stderr = new EventEmitter() as ChildProcess["stderr"];
  proceso.stdin = { write: vi.fn() } as unknown as ChildProcess["stdin"];
  proceso.kill = vi.fn() as ChildProcess["kill"];
  return proceso;
}

function lineaEvento(evento: Partial<EventoNdjson> & { runId: string; type: string }): string {
  const completo: EventoNdjson = { ts: new Date().toISOString(), agent: "mapeador-mcp", data: {}, ...evento };
  return `${JSON.stringify(completo)}\n`;
}

function esperarUnTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("corregirLocalizador", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-mapa-proyecto-"));
    const paths = projectPaths(proyecto);
    await mkdir(paths.mapDir, { recursive: true });
    await writeFile(paths.mapPath, await readFile(fixtureMapa, "utf8"), "utf8");
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("corrige el localizador cuando no hay ninguna corrida activa para el proyecto", async () => {
    const resultado = await corregirLocalizador(
      proyecto,
      { screenId: "home", locatorName: "submitButton", kind: "button", ts: "page.getByTestId('enviar')" },
      VERSION_FAKE
    );
    expect(resultado.ok).toBe(true);
  });

  it("rechaza la corrección con un motivo claro mientras hay una corrida activa para el proyecto, sin tocar map.json", async () => {
    const proceso = crearProcesoFake();
    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-mapa-1", type: "operation.started" })));
    await p1;

    const paths = projectPaths(proyecto);
    const antes = await readFile(paths.mapPath, "utf8");

    const resultado = await corregirLocalizador(
      proyecto,
      { screenId: "home", locatorName: "submitButton", kind: "button", ts: "page.getByTestId('enviar')" },
      VERSION_FAKE
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toContain("se puede corregir un localizador mientras hay una corrida en marcha");
    expect(await readFile(paths.mapPath, "utf8")).toBe(antes);

    // Termina la corrida para no dejar el estado activo entre tests.
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-mapa-1", type: "operation.completed" })));
  });
});
