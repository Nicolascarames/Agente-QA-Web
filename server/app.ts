import { existsSync, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { lanzar, type SesionAgente } from "./agente.js";
import { leerConfigRaiz, escribirConfigRaiz, leerCredenciales, escribirCredenciales } from "./proyecto.js";
import * as git from "./git.js";
import { leerReporte, sugerirVeredicto } from "./reporter.js";
import { cruzarTrazabilidad } from "./trazabilidad.js";
import { leerHistorial, registrarEjecucion } from "./costes.js";
import { listarFragiles } from "./fragiles.js";
import { ejecutarDoctor } from "./doctor.js";
import { ejecutarPlaywright } from "./ejecutorTests.js";
import { crearDifusor } from "./difusor.js";
import { esEventoTerminal } from "../shared/eventos.js";
import type {
  ConfigRaiz,
  ConfigCredenciales,
  CoberturaEscenario,
  ElementoFragil,
  EstadoCorridaActiva,
  EstadoProyectoActivo,
  EventoNdjson,
  EventoTest,
  RegistroEjecucion,
  ResultadoDoctor,
  ResultadoEjecucionPlaywright,
  RespuestaComando,
  ResultadoTest,
  ResultadoTestRojo,
} from "../shared/tipos.js";

/** Defaults de `ConfigRaiz` cuando `agente-qa.config.json` todavía no existe o no tiene `appUrl`
 *  (Bloque 5): el panel de Configuración necesita algo que pintar antes de que el usuario guarde nada. */
const CONFIG_RAIZ_POR_DEFECTO: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [] };

/** Extrae `session_id` de un evento del agente si lo trae, para poder reanudar la conversación
 *  (`resume`) en el siguiente `/api/comando` sin acoplarse a la forma completa del mensaje del SDK. */
function extraerSessionId(data: unknown): string | undefined {
  if (data && typeof data === "object" && "session_id" in data) {
    const valor = (data as { session_id?: unknown }).session_id;
    if (typeof valor === "string") return valor;
  }
  return undefined;
}

export interface AppOptions {
  proyectoInicial: string;
  /** Inyectable para test — por defecto `lanzar()` real de `agente.ts`. */
  lanzarFn?: typeof lanzar;
  /** Inyectable para test — por defecto `ejecutarPlaywright()` real de `ejecutorTests.ts`, que lanza
   *  un proceso de verdad. Sin esto, testear `/api/tests/ejecutar` lanzaría Playwright en serio en
   *  cada corrida de `npm test`. */
  ejecutarFn?: (rootDir: string, rutaSpec?: string, credenciales?: Record<string, string>, onLinea?: (linea: string) => void) => Promise<ResultadoEjecucionPlaywright>;
}

/** Difusor del progreso en vivo de `/api/tests/ejecutar` (`GET /api/tests/eventos`): a nivel de
 *  módulo, no de instancia de `buildApp`, porque como `corridaActiva` de la consola global — una
 *  ejecución de tests a la vez por repo, sin base de datos. */
const difusorTests = crearDifusor<EventoTest>();

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// tsconfig.server.json no fija rootDir: preserva la estructura de carpetas, así que este fichero
// compila a dist-server/server/app.js (dos niveles bajo la raíz del repo, no uno). dist-client/ es
// hermana de dist-server/ en la raíz del repo, no del proyecto que se está inspeccionando.
const distClient = path.resolve(dirActual, "..", "..", "dist-client");

/** Construye el servidor sin arrancarlo — separado de index.ts para poder probarlo con `.inject()`. */
export function buildApp(opts: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const proyectoActivo = opts.proyectoInicial;
  const lanzarFn = opts.lanzarFn ?? lanzar;
  const ejecutarFn = opts.ejecutarFn ?? ejecutarPlaywright;

  // Estado en memoria del módulo: una corrida activa como mucho, sin base de datos (una instancia
  // por repo, igual que `proyectoActivo`). `sesion` y `runId` van juntos para que TypeScript sepa
  // que uno no puede existir sin el otro.
  let corridaActiva: { sesion: SesionAgente; runId: string } | null = null;
  // Último session_id visto por el difusor de eventos, para reanudar la conversación en el
  // próximo /api/comando — en memoria, se pierde al reiniciar el servidor, decisión explícita.
  let ultimaSesionId: string | null = null;

  // Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin selector ni recientes.
  app.get("/api/proyecto", (): EstadoProyectoActivo => ({ actual: proyectoActivo }));

  // --- Config raíz (Bloque 3, formulario real en Bloque 5) --------------------------------

  app.get("/api/config", async (): Promise<ConfigRaiz> => (await leerConfigRaiz(proyectoActivo)) ?? CONFIG_RAIZ_POR_DEFECTO);

  app.post<{ Body: Partial<ConfigRaiz> }>("/api/config", async (req, reply) => {
    const actual = (await leerConfigRaiz(proyectoActivo)) ?? CONFIG_RAIZ_POR_DEFECTO;
    const siguiente: ConfigRaiz = { ...actual, ...req.body };
    await escribirConfigRaiz(proyectoActivo, siguiente);
    await reply.send(siguiente);
  });

  // --- Credenciales de prueba (después del plan): fichero aparte de agente-qa.config.json a
  // propósito — ese sí se versiona, `agente-qa.credenciales.json` nunca debe hacerlo (ver proyecto.ts).

  app.get("/api/credenciales", async (): Promise<ConfigCredenciales> => leerCredenciales(proyectoActivo));

  app.post<{ Body: { variables?: { nombre: string; valor: string }[] } }>("/api/credenciales", async (req, reply) => {
    const variables = req.body?.variables;
    if (!Array.isArray(variables) || variables.some((v) => typeof v?.nombre !== "string" || typeof v?.valor !== "string")) {
      await reply.status(400).send({ error: 'falta "variables" (lista de {nombre, valor})' });
      return;
    }
    const siguiente: ConfigCredenciales = { schemaVersion: 1, variables };
    await escribirCredenciales(proyectoActivo, siguiente);
    await reply.send(siguiente);
  });

  // --- Doctor (Bloque 3), expuesto ahora también por API para la pestaña Configuración -----------

  app.get("/api/doctor", async (): Promise<ResultadoDoctor> => ejecutarDoctor(proyectoActivo));

  // --- Ejecutar / Reparar (Bloque 7): lectura fiel del último reporte de Playwright --------------
  // `sugerencia` es solo la etiqueta del badge de Reparar (`reporter.ts`, regla 2 de la spec): la
  // clasificación real la hace el agente, no esta ruta.

  app.get("/api/tests", async (): Promise<ResultadoTest[]> => leerReporte(proyectoActivo));

  app.get("/api/tests/rojos", async (): Promise<ResultadoTestRojo[]> => {
    const resultados = await leerReporte(proyectoActivo);
    return resultados
      .filter((resultado) => resultado.estado !== "passed")
      .map((resultado) => ({ ...resultado, sugerencia: sugerirVeredicto(resultado) }));
  });

  // `ruta`, si se pasa, limita a un único `.spec.ts` (botón por fila en Ejecutar); sin ella, corre
  // toda la suite (botón "Ejecutar todos"). Se valida como un nombre de fichero suelto porque llega
  // directo a un `spawn` con `shell: true` en Windows (ejecutorTests.ts): sin esto, un valor con
  // `;`/`&&`/backticks sería inyección de comandos, no solo un path traversal como en
  // `rutaGeneradaSegura` (que además exige el prefijo `tests/specs/`, distinto del valor que reporta
  // Playwright en `ResultadoTest.ficheroSpec`).
  function rutaSpecSegura(ruta: string): string | null {
    return /^[a-zA-Z0-9_\-./]+\.spec\.ts$/.test(ruta) && !ruta.includes("..") ? ruta : null;
  }

  app.post<{ Body: { ruta?: string } }>("/api/tests/ejecutar", async (req, reply): Promise<void> => {
    const rutaPedida = req.body?.ruta;
    if (rutaPedida !== undefined && rutaSpecSegura(rutaPedida) === null) {
      await reply.status(400).send({ error: "ruta de spec inválida" });
      return;
    }
    const credenciales = Object.fromEntries((await leerCredenciales(proyectoActivo)).variables.map((v) => [v.nombre, v.valor]));
    // Canal paralelo para la pestaña Ejecutar (`GET /api/tests/eventos`): el contrato de esta
    // respuesta no cambia, esto solo da progreso en vivo mientras Playwright corre.
    difusorTests.emitir({ tipo: "inicio", ruta: rutaPedida });
    const inicio = Date.now();
    let resultado: ResultadoEjecucionPlaywright | undefined;
    try {
      resultado = await ejecutarFn(proyectoActivo, rutaPedida, credenciales, (texto) => {
        difusorTests.emitir({ tipo: "linea", texto });
      });
    } finally {
      difusorTests.emitir({ tipo: "fin", ok: resultado?.ok ?? false, codigo: resultado?.codigo ?? null });
    }
    // Historial (Bloque 8, `server/costes.ts`): antes solo se enganchaba tras un turno del agente
    // (`operation.completed`/`operation.error` en `agente.ts`), así que una ejecución lanzada desde
    // aquí no dejaba rastro — ni el "última ejecución"/"coste acumulado" del Dashboard ni el flaky de
    // Reports se enteraban. No hay coste de LLM ni turnos en esta vía (no pasa por el SDK): se
    // registran como 0, honesto en vez de inventar un número — el resto del contrato de
    // `RegistroEjecucion` (que Dashboard/Reports ya suman/recorren) sigue cumpliéndose igual.
    // `resultados` sale de releer el reporte de Playwright ya actualizado por esta corrida, filtrado
    // al spec pedido cuando lo hay (botón por fila), para no atribuir a esta ejecución tests que no
    // corrieron ahora.
    const reporte = await leerReporte(proyectoActivo);
    const resultadosEjecucion = (rutaPedida ? reporte.filter((r) => r.ficheroSpec === rutaPedida) : reporte).map((r) => ({
      nombre: r.nombre,
      ficheroSpec: r.ficheroSpec,
      estado: r.estado,
    }));
    await registrarEjecucion(proyectoActivo, {
      costeUsd: 0,
      duracionMs: Date.now() - inicio,
      numTurnos: 0,
      resultados: resultadosEjecucion,
    });
    await reply.send(resultado);
  });

  // Progreso en vivo de `/api/tests/ejecutar` (líneas del reporter `list` de Playwright): a
  // diferencia de `/api/eventos`, no hay un evento terminal que cierre la conexión — se queda
  // abierta entre ejecuciones y se limpia solo cuando el cliente desconecta.
  app.get("/api/tests/eventos", (_req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const suscripcion = difusorTests.suscribirse()[Symbol.asyncIterator]();
    reply.raw.on("close", () => {
      void suscripcion.return?.();
    });
    void (async () => {
      for (let resultado = await suscripcion.next(); !resultado.done; resultado = await suscripcion.next()) {
        reply.raw.write(`data: ${JSON.stringify(resultado.value)}\n\n`);
      }
    })();
  });

  // --- Reports, Dashboard y trazabilidad (Bloque 8) -----------------------------------------------

  app.get("/api/trazabilidad", async (): Promise<CoberturaEscenario[]> => cruzarTrazabilidad(proyectoActivo));

  app.get("/api/historial", async (): Promise<RegistroEjecucion[]> => leerHistorial(proyectoActivo));

  app.get("/api/fragiles", async (): Promise<ElementoFragil[]> => listarFragiles(proyectoActivo));

  // --- Consola global (Bloque 4: conectada al agente real vía el SDK) --------------------

  app.get("/api/corridas/activa", (): EstadoCorridaActiva => ({ activa: corridaActiva !== null, runId: corridaActiva?.runId ?? null }));

  app.post<{ Body: { texto?: string } }>("/api/comando", async (req, reply): Promise<void> => {
    const texto = req.body?.texto?.trim();
    if (!texto) {
      await reply.status(400).send({ error: 'falta "texto"' });
      return;
    }
    if (corridaActiva) {
      // Ya hay una corrida en marcha: no se bloquea, se encola en la misma sesión.
      corridaActiva.sesion.enviarMensaje(texto);
      await reply.send({ runId: corridaActiva.runId } satisfies RespuestaComando);
      return;
    }
    const runId = randomUUID();
    const config = await leerConfigRaiz(proyectoActivo);
    const credenciales = await leerCredenciales(proyectoActivo);
    corridaActiva = {
      sesion: lanzarFn(texto, {
        cwd: proyectoActivo,
        entorno: config?.entorno,
        barreraActiva: config?.barrera,
        listaBlanca: config?.listaBlanca,
        resume: ultimaSesionId ?? undefined,
        credenciales: credenciales.variables,
      }),
      runId,
    };
    await reply.send({ runId } satisfies RespuestaComando);
  });

  // Sin ninguna ejecución en marcha, esta conexión no tiene nada que reenviar: avisa y cierra en
  // vez de dejar al cliente esperando eventos que nunca van a llegar.
  app.get("/api/eventos", (_req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    if (!corridaActiva) {
      reply.raw.write(`event: sin-corrida\ndata: ${JSON.stringify({ motivo: "No hay ninguna corrida activa para este proyecto." })}\n\n`);
      reply.raw.end();
      return;
    }

    const { sesion, runId } = corridaActiva;
    // Suscriptor propio de ESTA conexión (fan-out, no una cola compartida): así dos `GET
    // /api/eventos` sobre la misma sesión —p.ej. tras la reconexión del `EventSource` nativo del
    // cliente— ven cada uno el stream completo en vez de repartirse los eventos entre sí.
    const suscripcion = sesion.suscribirse()[Symbol.asyncIterator]();
    // Sin este listener, una conexión abandonada (red cortada, portátil suspendido) sigue suscrita
    // e intentando escribir en un socket cerrado indefinidamente.
    reply.raw.on("close", () => {
      void suscripcion.return?.();
    });
    void (async () => {
      for (let resultado = await suscripcion.next(); !resultado.done; resultado = await suscripcion.next()) {
        const evento = resultado.value;
        ultimaSesionId = extraerSessionId(evento.data) ?? ultimaSesionId;
        const envoltorio: EventoNdjson = { runId, ts: new Date().toISOString(), agent: "agente-qa", type: evento.type, data: evento.data };
        reply.raw.write(`data: ${JSON.stringify(envoltorio)}\n\n`);
        if (esEventoTerminal(evento.type)) {
          await suscripcion.return?.();
          break;
        }
      }
      reply.raw.end();
      corridaActiva = null;
    })();
  });

  app.post("/api/parar", async (_req, reply) => {
    corridaActiva?.sesion.parar();
    await reply.status(200).send({ ok: true });
  });

  app.post("/api/interrumpir", async (_req, reply) => {
    if (!corridaActiva) {
      await reply.status(400).send({ error: "no hay ninguna corrida activa" });
      return;
    }
    await corridaActiva.sesion.interrumpir();
    await reply.status(200).send({ ok: true });
  });

  app.post<{ Body: { textoLibre?: string; opcionesElegidas?: string[] } }>("/api/pregunta/responder", async (req, reply) => {
    if (!corridaActiva) {
      await reply.status(400).send({ error: "no hay ninguna corrida activa" });
      return;
    }
    corridaActiva.sesion.responderPregunta(req.body ?? {});
    await reply.status(200).send({ ok: true });
  });

  // --- Redactar / Generar (Bloque 6) --------------------------------------------------------
  // Convención confirmada en `skill/skills/qa/SKILL.md` (no la de `projectPaths()`, que mira
  // `.agente-qa/` para el Dashboard — inconsistencia previa del repo, fuera de este bloque).
  const featuresDir = path.join(proyectoActivo, "tests", "features");
  const pagesDir = path.join(proyectoActivo, "tests", "pages");
  const specsDir = path.join(proyectoActivo, "tests", "specs");
  const setupDir = path.join(proyectoActivo, "tests", "setup");

  app.get("/api/escenarios", async () => git.listarFicheros(featuresDir, ".feature"));

  // `nombre` llega de la URL: sin esta validación, un `..%2f..` se sale de `featuresDir` y permite
  // leer/escribir cualquier fichero del sistema (hallazgo de la revisión del Bloque 6).
  function nombreEscenarioSeguro(nombre: string): string | null {
    if (!nombre || nombre !== path.basename(nombre) || !nombre.endsWith(".feature")) {
      return null;
    }
    return nombre;
  }

  app.get<{ Params: { nombre: string } }>("/api/escenarios/:nombre", async (req, reply) => {
    const nombre = nombreEscenarioSeguro(req.params.nombre);
    if (!nombre) {
      await reply.status(400).send({ error: "nombre de fichero inválido" });
      return;
    }
    try {
      const contenido = await fs.readFile(path.join(featuresDir, nombre), "utf8");
      await reply.send({ contenido });
    } catch {
      await reply.status(404).send({ error: `no existe ${nombre}` });
    }
  });

  app.put<{ Params: { nombre: string }; Body: { contenido?: string } }>("/api/escenarios/:nombre", async (req, reply) => {
    const nombre = nombreEscenarioSeguro(req.params.nombre);
    if (!nombre) {
      await reply.status(400).send({ error: "nombre de fichero inválido" });
      return;
    }
    const contenido = req.body?.contenido;
    if (typeof contenido !== "string") {
      await reply.status(400).send({ error: 'falta "contenido"' });
      return;
    }
    await fs.mkdir(featuresDir, { recursive: true });
    await fs.writeFile(path.join(featuresDir, nombre), contenido, "utf8");
    await reply.send({ ok: true });
  });

  app.get("/api/generados", async () => {
    const [pages, specs] = await Promise.all([git.listarFicheros(pagesDir, ".page.ts"), git.listarFicheros(specsDir, ".spec.ts")]);
    return { pages, specs };
  });

  // `ruta` llega de la querystring como `tests/pages/<nombre>.page.ts`, `tests/specs/<nombre>.spec.ts`
  // o `tests/setup/<nombre>.setup.ts` (mismo formato que ya usan diff/commit/descartar para los dos
  // primeros; el tercero se añadió porque Ejecutar lista también el fichero de setup de Playwright
  // que reporta el JSON, y pedía su contenido con 400). A diferencia de esas rutas, que solo pasan
  // `ruta` a un comando `git`, estas hacen `fs.readFile`/`writeFile` directo — sin esta validación,
  // un `../../secreto.txt` se sale del proyecto igual que el path traversal ya cerrado en
  // `nombreEscenarioSeguro`.
  function rutaGeneradaSegura(ruta: string): string | null {
    const normalizada = ruta.replaceAll("\\", "/");
    const base = normalizada.startsWith("tests/pages/") && normalizada.endsWith(".page.ts")
      ? pagesDir
      : normalizada.startsWith("tests/specs/") && normalizada.endsWith(".spec.ts")
        ? specsDir
        : normalizada.startsWith("tests/setup/") && normalizada.endsWith(".setup.ts")
          ? setupDir
          : null;
    if (!base) return null;
    const resuelta = path.resolve(proyectoActivo, normalizada);
    if (resuelta !== path.join(base, path.basename(resuelta))) return null;
    return normalizada;
  }

  app.get<{ Querystring: { ruta?: string } }>("/api/generados/contenido", async (req, reply) => {
    const ruta = req.query.ruta;
    if (!ruta) {
      await reply.status(400).send({ error: 'falta "ruta"' });
      return;
    }
    const segura = rutaGeneradaSegura(ruta);
    if (!segura) {
      await reply.status(400).send({ error: "ruta de fichero inválida" });
      return;
    }
    try {
      const contenido = await fs.readFile(path.join(proyectoActivo, segura), "utf8");
      await reply.send({ contenido });
    } catch {
      await reply.status(404).send({ error: `no existe ${segura}` });
    }
  });

  app.put<{ Querystring: { ruta?: string }; Body: { contenido?: string } }>("/api/generados/contenido", async (req, reply) => {
    const ruta = req.query.ruta;
    if (!ruta) {
      await reply.status(400).send({ error: 'falta "ruta"' });
      return;
    }
    const segura = rutaGeneradaSegura(ruta);
    if (!segura) {
      await reply.status(400).send({ error: "ruta de fichero inválida" });
      return;
    }
    const contenido = req.body?.contenido;
    if (typeof contenido !== "string") {
      await reply.status(400).send({ error: 'falta "contenido"' });
      return;
    }
    const destino = path.join(proyectoActivo, segura);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, contenido, "utf8");
    await reply.send({ ok: true });
  });

  app.get<{ Querystring: { ruta?: string } }>("/api/generados/diff", async (req, reply) => {
    const ruta = req.query.ruta;
    if (!ruta) {
      await reply.status(400).send({ error: 'falta "ruta"' });
      return;
    }
    const contenido = await git.diff(proyectoActivo, [ruta]);
    await reply.send({ diff: contenido });
  });

  app.post<{ Body: { rutas?: string[]; mensaje?: string } }>("/api/generados/commit", async (req, reply) => {
    const { rutas, mensaje } = req.body ?? {};
    if (!rutas || rutas.length === 0 || !mensaje) {
      await reply.status(400).send({ error: 'faltan "rutas" o "mensaje"' });
      return;
    }
    await git.commit(proyectoActivo, rutas, mensaje);
    await reply.send({ ok: true });
  });

  app.post<{ Body: { rutas?: string[] } }>("/api/generados/descartar", async (req, reply) => {
    const rutas = req.body?.rutas;
    if (!rutas || rutas.length === 0) {
      await reply.status(400).send({ error: 'falta "rutas"' });
      return;
    }
    await git.descartar(proyectoActivo, rutas);
    await reply.send({ ok: true });
  });

  if (existsSync(distClient)) {
    app.register(fastifyStatic, { root: distClient });
  }

  return app;
}
