import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `ejecutarPlaywright` lanza un proceso de verdad (`npx playwright test`) — aquí solo se prueba el
// troceado de líneas de `onLinea` sobre stdout/stderr, así que `spawn` se sustituye por un
// `EventEmitter` de mentira con `stdout`/`stderr` también `EventEmitter`, sin lanzar nada real.
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

const { spawn } = await import("node:child_process");
const { ejecutarPlaywright } = await import("./ejecutorTests.js");

interface ProcesoFalso extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function crearProcesoFalso(): ProcesoFalso {
  const proceso = new EventEmitter() as ProcesoFalso;
  proceso.stdout = new EventEmitter();
  proceso.stderr = new EventEmitter();
  return proceso;
}

describe("ejecutarPlaywright — troceado de líneas por onLinea", () => {
  let procesoFalso: ProcesoFalso;

  beforeEach(() => {
    procesoFalso = crearProcesoFalso();
    vi.mocked(spawn).mockReturnValue(procesoFalso as never);
  });

  it("no emite una línea hasta que el buffer trae su salto, aunque llegue partida a mitad", async () => {
    const lineas: string[] = [];
    const promesa = ejecutarPlaywright("/proyecto", undefined, {}, (linea) => lineas.push(linea));

    procesoFalso.stdout.emit("data", Buffer.from("Running 3 tests\nPASS te"));
    expect(lineas).toEqual(["Running 3 tests"]);

    procesoFalso.stdout.emit("data", Buffer.from("st1.spec.ts\n"));
    expect(lineas).toEqual(["Running 3 tests", "PASS test1.spec.ts"]);

    procesoFalso.emit("close", 0);
    const resultado = await promesa;
    expect(resultado).toEqual({ ok: true, codigo: 0, salida: "Running 3 tests\nPASS test1.spec.ts\n" });
  });

  it("elimina los códigos ANSI de cada línea emitida, pero los conserva en `salida`", async () => {
    const lineas: string[] = [];
    const promesa = ejecutarPlaywright("/proyecto", undefined, {}, (linea) => lineas.push(linea));

    procesoFalso.stdout.emit("data", Buffer.from("[32m✓ test1[0m\n"));
    procesoFalso.emit("close", 0);
    const resultado = await promesa;

    expect(lineas).toEqual(["✓ test1"]);
    expect(resultado.salida).toBe("[32m✓ test1[0m\n");
  });

  it("vuelca lo que quede en el buffer sin salto de línea al cerrar el proceso", async () => {
    const lineas: string[] = [];
    const promesa = ejecutarPlaywright("/proyecto", undefined, {}, (linea) => lineas.push(linea));

    procesoFalso.stdout.emit("data", Buffer.from("1 passed"));
    expect(lineas).toEqual([]);

    procesoFalso.emit("close", 0);
    await promesa;
    expect(lineas).toEqual(["1 passed"]);
  });

  it("no vuelca nada extra al cerrar si el buffer ya quedó vacío", async () => {
    const lineas: string[] = [];
    const promesa = ejecutarPlaywright("/proyecto", undefined, {}, (linea) => lineas.push(linea));

    procesoFalso.stdout.emit("data", Buffer.from("todo completo\n"));
    procesoFalso.emit("close", 0);
    await promesa;
    expect(lineas).toEqual(["todo completo"]);
  });

  it("sin onLinea, se comporta exactamente igual que antes (no revienta)", async () => {
    const promesa = ejecutarPlaywright("/proyecto", undefined, {});
    procesoFalso.stdout.emit("data", Buffer.from("línea sin oyente\n"));
    procesoFalso.emit("close", 0);
    const resultado = await promesa;
    expect(resultado).toEqual({ ok: true, codigo: 0, salida: "línea sin oyente\n" });
  });
});
