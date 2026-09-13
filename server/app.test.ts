import { execFile as execFileCb } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { EventoAgente, SesionAgente } from "./agente.js";
import type { EstadoCorridaActiva, EstadoProyecto, EstadoProyectoActivo, RespuestaComando } from "../shared/tipos.js";

const execFile = promisify(execFileCb);
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout;
}

/**
 * Sesión falsa: nunca lanza el SDK real — lento y no determinista, igual que en `agente.test.ts`.
 * Devuelve también los mocks sueltos como variables: `expect(sesion.enviarMensaje)` dispara
 * `@typescript-eslint/unbound-method` por ser un acceso a método de objeto.
 */
function crearSesionFalsa(eventos: EventoAgente[] = []): {
  sesion: SesionAgente;
  enviarMensaje: ReturnType<typeof vi.fn>;
  interrumpir: ReturnType<typeof vi.fn>;
  parar: ReturnType<typeof vi.fn>;
  responderPregunta: ReturnType<typeof vi.fn>;
} {
  const enviarMensaje = vi.fn();
  const interrumpir = vi.fn(() => Promise.resolve(undefined));
  const parar = vi.fn();
  const responderPregunta = vi.fn();
  const sesion: SesionAgente = {
    suscribirse: () =>
      (async function* () {
        for (const evento of eventos) yield await Promise.resolve(evento);
      })(),
    enviarMensaje,
    interrumpir,
    parar,
    responderPregunta,
  };
  return { sesion, enviarMensaje, interrumpir, parar, responderPregunta };
}

describe("buildApp", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-app-proyecto-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("GET /api/estado deriva el estado del proyecto activo del disco", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/estado" });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<EstadoProyecto>();
    expect(cuerpo.proyecto).toBe(proyecto);
    expect(cuerpo.agenteQaInicializado).toBe(false);
    await app.close();
  });

  it("GET /api/proyecto devuelve el proyecto activo, sin recientes (una instancia por repo)", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/proyecto" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<EstadoProyectoActivo>()).toEqual({ actual: proyecto });
    await app.close();
  });

  // --- Consola global (Bloque 2: vaciada) — rutas honestas sin nada detrás todavía ---------

  it("GET /api/corridas/activa dice honestamente que no hay ninguna corrida activa", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/corridas/activa" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<EstadoCorridaActiva>()).toEqual({ activa: false, runId: null });
    await app.close();
  });

  it('POST /api/comando con "texto" vacío responde 400', async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "  " } });
    expect(respuesta.statusCode).toBe(400);
    await app.close();
  });

  it("POST /api/comando sin sesión activa lanza una nueva y devuelve su runId", async () => {
    const { sesion } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazme el page object del login" } });
    expect(respuesta.statusCode).toBe(200);
    expect(lanzarFn).toHaveBeenCalledWith("hazme el page object del login", {
      cwd: proyecto,
      entorno: undefined,
      barreraActiva: undefined,
      listaBlanca: undefined,
      resume: undefined,
      credenciales: [],
    });
    expect(respuesta.json<RespuestaComando>().runId).toBeTruthy();
    await app.close();
  });

  it("POST /api/comando con sesión activa encola el mensaje en la misma sesión, sin lanzar otra", async () => {
    const { sesion, enviarMensaje } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    const primera = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "primero" } });
    const segunda = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "segundo" } });
    expect(lanzarFn).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("segundo");
    expect(segunda.json<RespuestaComando>().runId).toBe(primera.json<RespuestaComando>().runId);
    await app.close();
  });

  it("GET /api/eventos avisa de que no hay corrida activa y cierra", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(respuesta.body).toContain("sin-corrida");
    await app.close();
  });

  it("GET /api/eventos con sesión activa reenvía sus eventos por SSE sin `event:` nombrado y cierra en terminal", async () => {
    const { sesion } = crearSesionFalsa([
      { type: "agente.asistente", data: { texto: "mirando la página" } },
      { type: "operation.completed", data: { resultado: "ok" } },
    ]);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(respuesta.body).not.toContain("event:");
    expect(respuesta.body).toContain("agente.asistente");
    expect(respuesta.body).toContain("operation.completed");
    const activaTrasCerrar = await app.inject({ method: "GET", url: "/api/corridas/activa" });
    expect(activaTrasCerrar.json<EstadoCorridaActiva>().activa).toBe(false);
    await app.close();
  });

  it("reusa el último session_id conocido vía `resume` en la siguiente corrida", async () => {
    const { sesion: primeraSesion } = crearSesionFalsa([{ type: "operation.completed", data: { session_id: "sesion-123", result: "ok" } }]);
    const { sesion: segundaSesion } = crearSesionFalsa();
    const lanzarFn = vi.fn().mockReturnValueOnce(primeraSesion).mockReturnValueOnce(segundaSesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });

    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "primero" } });
    await app.inject({ method: "GET", url: "/api/eventos" }); // drena hasta el evento terminal y cierra la corrida activa

    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "segundo" } });

    expect(lanzarFn).toHaveBeenNthCalledWith(2, "segundo", expect.objectContaining({ resume: "sesion-123" }));
    await app.close();
  });

  it("POST /api/parar es idempotente: 200 tanto si hay sesión activa como si no", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    expect((await appSinSesion.inject({ method: "POST", url: "/api/parar" })).statusCode).toBe(200);
    await appSinSesion.close();

    const { sesion, parar } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/parar" });
    expect(respuesta.statusCode).toBe(200);
    expect(parar).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/interrumpir responde 400 sin sesión activa, 200 y corta el turno con una activa", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    const sinSesion = await appSinSesion.inject({ method: "POST", url: "/api/interrumpir" });
    expect(sinSesion.statusCode).toBe(400);
    expect(sinSesion.json<{ error: string }>().error).toContain("no hay ninguna corrida activa");
    await appSinSesion.close();

    const { sesion, interrumpir } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/interrumpir" });
    expect(respuesta.statusCode).toBe(200);
    expect(interrumpir).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/pregunta/responder responde 400 sin sesión activa, 200 y reenvía la respuesta con una activa", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    const sinSesion = await appSinSesion.inject({ method: "POST", url: "/api/pregunta/responder", payload: { opcionesElegidas: ["A"] } });
    expect(sinSesion.statusCode).toBe(400);
    await appSinSesion.close();

    const { sesion, responderPregunta } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/pregunta/responder", payload: { opcionesElegidas: ["A"] } });
    expect(respuesta.statusCode).toBe(200);
    expect(responderPregunta).toHaveBeenCalledWith({ opcionesElegidas: ["A"] });
    await app.close();
  });

  // --- Redactar / Generar (Bloque 6): rutas de escenarios, ficheros generados y diff ---------

  it("GET /api/escenarios devuelve [] sin tests/features/, y los .feature si los hay", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const vacio = await app.inject({ method: "GET", url: "/api/escenarios" });
    expect(vacio.json<string[]>()).toEqual([]);

    await mkdir(path.join(proyecto, "tests", "features"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "features", "login.feature"), "Feature: login\n", "utf8");
    const conFicheros = await app.inject({ method: "GET", url: "/api/escenarios" });
    expect(conFicheros.json<string[]>()).toEqual(["login.feature"]);
    await app.close();
  });

  it("GET /api/escenarios/:nombre devuelve el contenido, 404 si no existe", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const faltante = await app.inject({ method: "GET", url: "/api/escenarios/login.feature" });
    expect(faltante.statusCode).toBe(404);

    await mkdir(path.join(proyecto, "tests", "features"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "features", "login.feature"), "Feature: login\n", "utf8");
    const respuesta = await app.inject({ method: "GET", url: "/api/escenarios/login.feature" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ contenido: string }>().contenido).toBe("Feature: login\n");
    await app.close();
  });

  it("PUT /api/escenarios/:nombre escribe el fichero, creando tests/features/ si hace falta", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({
      method: "PUT",
      url: "/api/escenarios/nuevo.feature",
      payload: { contenido: "Feature: nuevo\n" },
    });
    expect(respuesta.statusCode).toBe(200);
    const leido = await app.inject({ method: "GET", url: "/api/escenarios/nuevo.feature" });
    expect(leido.json<{ contenido: string }>().contenido).toBe("Feature: nuevo\n");
    await app.close();
  });

  it("GET/PUT /api/escenarios/:nombre rechazan un nombre que se sale de tests/features/ (path traversal)", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const fueraDelProyecto = path.join(proyecto, "..", "secreto.txt");
    await writeFile(fueraDelProyecto, "no deberías poder leer esto", "utf8");

    const lectura = await app.inject({ method: "GET", url: "/api/escenarios/..%2Fsecreto.txt" });
    expect(lectura.statusCode).toBe(400);

    const escritura = await app.inject({
      method: "PUT",
      url: "/api/escenarios/..%2Fsecreto.txt",
      payload: { contenido: "pwned" },
    });
    expect(escritura.statusCode).toBe(400);

    const contenidoTrasIntento = await readFile(fueraDelProyecto, "utf8");
    expect(contenidoTrasIntento).toBe("no deberías poder leer esto");
    await rm(fueraDelProyecto);
    await app.close();
  });

  it("GET /api/generados devuelve pages y specs por separado, [] si no existen sus carpetas", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const vacio = await app.inject({ method: "GET", url: "/api/generados" });
    expect(vacio.json<{ pages: string[]; specs: string[] }>()).toEqual({ pages: [], specs: [] });

    await mkdir(path.join(proyecto, "tests", "pages"), { recursive: true });
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "pages", "login.page.ts"), "export class LoginPage {}\n", "utf8");
    await writeFile(path.join(proyecto, "tests", "specs", "login.spec.ts"), "test('login', () => {});\n", "utf8");
    const respuesta = await app.inject({ method: "GET", url: "/api/generados" });
    expect(respuesta.json<{ pages: string[]; specs: string[] }>()).toEqual({ pages: ["login.page.ts"], specs: ["login.spec.ts"] });
    await app.close();
  });

  it("GET /api/generados/contenido devuelve el contenido crudo de un page/spec, 404 si no existe", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const faltante = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/specs/login.spec.ts" });
    expect(faltante.statusCode).toBe(404);

    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "login.spec.ts"), "test('login', () => {});\n", "utf8");
    const respuesta = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/specs/login.spec.ts" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ contenido: string }>().contenido).toBe("test('login', () => {});\n");
    await app.close();
  });

  it("PUT /api/generados/contenido escribe el fichero, creando tests/pages/ si hace falta", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({
      method: "PUT",
      url: "/api/generados/contenido?ruta=tests/pages/login.page.ts",
      payload: { contenido: "export class LoginPage {}\n" },
    });
    expect(respuesta.statusCode).toBe(200);
    const leido = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/pages/login.page.ts" });
    expect(leido.json<{ contenido: string }>().contenido).toBe("export class LoginPage {}\n");
    await app.close();
  });

  it("GET/PUT /api/generados/contenido rechazan una ruta fuera de tests/pages|specs (path traversal, extensión ajena)", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const fueraDelProyecto = path.join(proyecto, "..", "secreto.txt");
    await writeFile(fueraDelProyecto, "no deberías poder leer esto", "utf8");

    const traversal = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/specs/../../secreto.txt" });
    expect(traversal.statusCode).toBe(400);

    const extensionAjena = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/specs/login.feature" });
    expect(extensionAjena.statusCode).toBe(400);

    const escritura = await app.inject({
      method: "PUT",
      url: "/api/generados/contenido?ruta=tests/specs/../../secreto.txt",
      payload: { contenido: "pwned" },
    });
    expect(escritura.statusCode).toBe(400);

    const sinRuta = await app.inject({ method: "GET", url: "/api/generados/contenido" });
    expect(sinRuta.statusCode).toBe(400);

    const contenidoTrasIntento = await readFile(fueraDelProyecto, "utf8");
    expect(contenidoTrasIntento).toBe("no deberías poder leer esto");
    await rm(fueraDelProyecto);
    await app.close();
  });

  it("GET /api/generados/contenido acepta tests/setup/*.setup.ts, y sigue rechazando el traversal", async () => {
    const app = buildApp({ proyectoInicial: proyecto });

    await mkdir(path.join(proyecto, "tests", "setup"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "setup", "auth.setup.ts"), "setup('auth', async () => {});\n", "utf8");
    const respuesta = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/setup/auth.setup.ts" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ contenido: string }>().contenido).toBe("setup('auth', async () => {});\n");

    const traversal = await app.inject({ method: "GET", url: "/api/generados/contenido?ruta=tests/setup/../../secreto.txt" });
    expect(traversal.statusCode).toBe(400);

    await app.close();
  });

  it("GET /api/generados/diff devuelve el diff de un fichero nuevo sin trackear del proyecto", async () => {
    await git(proyecto, ["init", "-q"]);
    await git(proyecto, ["config", "user.email", "test@test.com"]);
    await git(proyecto, ["config", "user.name", "test"]);
    await writeFile(path.join(proyecto, "base.txt"), "base\n", "utf8");
    await git(proyecto, ["add", "base.txt"]);
    await git(proyecto, ["commit", "-q", "-m", "inicial"]);
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "login.spec.ts"), "test('login', () => {});\n", "utf8");

    const app = buildApp({ proyectoInicial: proyecto });
    const sinRuta = await app.inject({ method: "GET", url: "/api/generados/diff" });
    expect(sinRuta.statusCode).toBe(400);

    const respuesta = await app.inject({ method: "GET", url: "/api/generados/diff?ruta=tests/specs/login.spec.ts" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ diff: string }>().diff).toContain("login.spec.ts");
    await app.close();
  });

  it("POST /api/generados/commit crea un commit con las rutas dadas", async () => {
    await git(proyecto, ["init", "-q"]);
    await git(proyecto, ["config", "user.email", "test@test.com"]);
    await git(proyecto, ["config", "user.name", "test"]);
    await writeFile(path.join(proyecto, "base.txt"), "base\n", "utf8");
    await git(proyecto, ["add", "base.txt"]);
    await git(proyecto, ["commit", "-q", "-m", "inicial"]);
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "login.spec.ts"), "test('login', () => {});\n", "utf8");

    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({
      method: "POST",
      url: "/api/generados/commit",
      payload: { rutas: ["tests/specs/login.spec.ts"], mensaje: "test: genera login.spec.ts" },
    });
    expect(respuesta.statusCode).toBe(200);
    expect((await git(proyecto, ["log", "-1", "--format=%s"])).trim()).toBe("test: genera login.spec.ts");
    await app.close();
  });

  it("POST /api/generados/descartar borra del árbol de trabajo un fichero nuevo", async () => {
    await git(proyecto, ["init", "-q"]);
    await git(proyecto, ["config", "user.email", "test@test.com"]);
    await git(proyecto, ["config", "user.name", "test"]);
    await writeFile(path.join(proyecto, "base.txt"), "base\n", "utf8");
    await git(proyecto, ["add", "base.txt"]);
    await git(proyecto, ["commit", "-q", "-m", "inicial"]);
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    const ruta = path.join(proyecto, "tests", "specs", "login.spec.ts");
    await writeFile(ruta, "test('login', () => {});\n", "utf8");

    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/generados/descartar", payload: { rutas: ["tests/specs/login.spec.ts"] } });
    expect(respuesta.statusCode).toBe(200);
    await expect(readFile(ruta, "utf8")).rejects.toThrow();
    await app.close();
  });

  // --- Reports, Dashboard y trazabilidad (Bloque 8) ---------------------------------------------

  it("GET /api/trazabilidad cruza los .feature con sus .spec.ts homónimos", async () => {
    await mkdir(path.join(proyecto, "tests", "features"), { recursive: true });
    await writeFile(
      path.join(proyecto, "tests", "features", "login.feature"),
      "Característica: login\n\nEscenario: entra con credenciales válidas\n  Dado que estoy en la página de login\n",
      "utf8",
    );

    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/trazabilidad" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ featureFichero: string; escenario: string; estado: string }[]>()).toEqual([
      { featureFichero: "login.feature", escenario: "entra con credenciales válidas", estado: "no-cubierto" },
    ]);
    await app.close();
  });

  it("GET /api/historial devuelve [] sin agente-qa.historial.json todavía", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/historial" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<unknown[]>()).toEqual([]);
    await app.close();
  });

  it("GET /api/fragiles devuelve [] sin tests/pages ni tests/specs, y las marcas si las hay", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const vacio = await app.inject({ method: "GET", url: "/api/fragiles" });
    expect(vacio.json<unknown[]>()).toEqual([]);

    await mkdir(path.join(proyecto, "tests", "pages"), { recursive: true });
    await writeFile(
      path.join(proyecto, "tests", "pages", "login.page.ts"),
      'boton = this.page.locator("button").nth(0); // FRÁGIL: sin atributo estable\n',
      "utf8",
    );
    const conMarca = await app.inject({ method: "GET", url: "/api/fragiles" });
    expect(conMarca.json<{ fichero: string; linea: number; motivo: string }[]>()).toEqual([
      { fichero: "tests/pages/login.page.ts", linea: 1, motivo: "sin atributo estable" },
    ]);
    await app.close();
  });

  it("GET /api/credenciales devuelve variables: [] por defecto; POST las guarda y las relee", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const vacio = await app.inject({ method: "GET", url: "/api/credenciales" });
    expect(vacio.json()).toEqual({ schemaVersion: 1, variables: [] });

    const guardado = await app.inject({
      method: "POST",
      url: "/api/credenciales",
      payload: { variables: [{ nombre: "USUARIO", valor: "admin" }] },
    });
    expect(guardado.statusCode).toBe(200);

    const releido = await app.inject({ method: "GET", url: "/api/credenciales" });
    expect(releido.json()).toEqual({ schemaVersion: 1, variables: [{ nombre: "USUARIO", valor: "admin" }] });
    await app.close();
  });

  it("POST /api/credenciales rechaza un body sin la forma {nombre, valor}[]", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/credenciales", payload: { variables: [{ nombre: "X" }] } });
    expect(respuesta.statusCode).toBe(400);
    await app.close();
  });

  it("GET /api/doctor devuelve las cuatro comprobaciones del doctor real", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/doctor" });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<{ ok: boolean; comprobaciones: { nombre: string; ok: boolean; mensaje: string }[] }>();
    expect(cuerpo.comprobaciones).toHaveLength(4);
    await app.close();
  });

  it("POST /api/tests/ejecutar rechaza una ruta que no sea un .spec.ts suelto (inyección/path traversal)", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    for (const ruta of ["../../evil.spec.ts", "a.spec.ts; rm -rf /", "a.spec.ts && echo hi", "a.ts"]) {
      const respuesta = await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: { ruta } });
      expect(respuesta.statusCode, `ruta rechazada: ${ruta}`).toBe(400);
    }
    await app.close();
  });

  it("POST /api/tests/ejecutar llama a ejecutarFn con la ruta pedida y las credenciales guardadas", async () => {
    const ejecutarFn = vi.fn(() => Promise.resolve({ ok: true, codigo: 0, salida: "" }));
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });
    await app.inject({
      method: "POST",
      url: "/api/credenciales",
      payload: { variables: [{ nombre: "USUARIO", valor: "admin" }] },
    });

    const respuesta = await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: { ruta: "login.spec.ts" } });
    expect(respuesta.statusCode).toBe(200);
    expect(ejecutarFn).toHaveBeenCalledWith(proyecto, "login.spec.ts", { USUARIO: "admin" }, expect.any(Function));
    await app.close();
  });

  it("POST /api/tests/ejecutar sin ruta corre toda la suite (ruta undefined)", async () => {
    const ejecutarFn = vi.fn(() => Promise.resolve({ ok: true, codigo: 0, salida: "" }));
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });
    const respuesta = await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: {} });
    expect(respuesta.statusCode).toBe(200);
    expect(ejecutarFn).toHaveBeenCalledWith(proyecto, undefined, {}, expect.any(Function));
    await app.close();
  });

  it("POST /api/tests/ejecutar registra la ejecución en el historial, sin inventar coste ni turnos", async () => {
    const ejecutarFn = vi.fn(() => Promise.resolve({ ok: true, codigo: 0, salida: "" }));
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });

    await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: {} });

    const historial = await app.inject({ method: "GET", url: "/api/historial" });
    const registros = historial.json<{ costeUsd: number; numTurnos: number; resultados: unknown[] }[]>();
    expect(registros).toHaveLength(1);
    // Esta vía no pasa por el SDK: no hay coste de LLM ni turnos que reportar. 0 es honesto, no
    // inventado — a diferencia de una ejecución del agente (`server/agente.ts`), que sí trae ambos.
    expect(registros[0]).toMatchObject({ costeUsd: 0, numTurnos: 0, resultados: [] });
    await app.close();
  });
});
