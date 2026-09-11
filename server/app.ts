import { existsSync, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { leerEstadoProyecto } from "./estado.js";
import { lanzar, type SesionAgente } from "./agente.js";
import * as git from "./git.js";
import { esEventoTerminal } from "../shared/eventos.js";
import type { EstadoCorridaActiva, EstadoProyectoActivo, EventoNdjson, RespuestaComando } from "../shared/tipos.js";

export interface AppOptions {
  proyectoInicial: string;
  /** Inyectable para test — por defecto `lanzar()` real de `agente.ts`. */
  lanzarFn?: typeof lanzar;
}

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

  // Estado en memoria del módulo: una corrida activa como mucho, sin base de datos (una instancia
  // por repo, igual que `proyectoActivo`). `sesion` y `runId` van juntos para que TypeScript sepa
  // que uno no puede existir sin el otro.
  let corridaActiva: { sesion: SesionAgente; runId: string } | null = null;

  // El estado no se guarda: se deriva del disco en cada petición.
  app.get("/api/estado", async () => leerEstadoProyecto(proyectoActivo));

  // Pendiente del Bloque 1 de Agente-QA-MCP (`agente-qa-mcp metrics --last N --json`):
  // hoy el CLI no emite NDJSON de actividad, así que no hay nada honesto que devolver.
  app.get("/api/actividad", async (_req, reply) => {
    await reply.status(501).send({ error: "pendiente del Bloque 1: agente-qa-mcp metrics --last N --json" });
  });

  // Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin selector ni recientes.
  app.get("/api/proyecto", (): EstadoProyectoActivo => ({ actual: proyectoActivo }));

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
    corridaActiva = { sesion: lanzarFn(texto, { cwd: proyectoActivo }), runId };
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

  // Directorio inexistente (proyecto sin ningún `.feature`/`.spec.ts` generado todavía) → lista
  // vacía, nunca se crea aquí: solo escribir crea carpetas.
  async function listarFicheros(dir: string, extension: string): Promise<string[]> {
    let entradas;
    try {
      entradas = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entradas.filter((entrada) => entrada.isFile() && entrada.name.endsWith(extension)).map((entrada) => entrada.name);
  }

  app.get("/api/escenarios", async () => listarFicheros(featuresDir, ".feature"));

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
    const [pages, specs] = await Promise.all([listarFicheros(pagesDir, ".page.ts"), listarFicheros(specsDir, ".spec.ts")]);
    return { pages, specs };
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
