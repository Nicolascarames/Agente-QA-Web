import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { leerEstadoProyecto } from "./estado.js";
import type { EstadoCorridaActiva, EstadoProyectoActivo } from "../shared/tipos.js";

export interface AppOptions {
  proyectoInicial: string;
}

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// Este fichero compila a dist-server/app.js; dist-client/ es hermana de dist-server/
// en la raíz del repo, no del proyecto que se está inspeccionando.
const distClient = path.resolve(dirActual, "..", "dist-client");

/** Construye el servidor sin arrancarlo — separado de index.ts para poder probarlo con `.inject()`. */
export function buildApp(opts: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const proyectoActivo = opts.proyectoInicial;

  // El estado no se guarda: se deriva del disco en cada petición.
  app.get("/api/estado", async () => leerEstadoProyecto(proyectoActivo));

  // Pendiente del Bloque 1 de Agente-QA-MCP (`agente-qa-mcp metrics --last N --json`):
  // hoy el CLI no emite NDJSON de actividad, así que no hay nada honesto que devolver.
  app.get("/api/actividad", async (_req, reply) => {
    await reply.status(501).send({ error: "pendiente del Bloque 1: agente-qa-mcp metrics --last N --json" });
  });

  // Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin selector ni recientes.
  app.get("/api/proyecto", (): EstadoProyectoActivo => ({ actual: proyectoActivo }));

  // --- Consola global (Bloque 2: vaciada) ------------------------------------------------
  // El CLI/mapa antiguo que lanzaba corridas y las transmitía por SSE se borró entero en este
  // bloque (`server/corridas.ts`, `server/mapa.ts`, `server/cli.ts`). Lo que queda es la
  // ESTRUCTURA de rutas (Fastify + SSE), honesta sobre que todavía no hay nada detrás: el
  // Bloque 4 la conecta al agente de verdad vía el SDK.

  app.get("/api/corridas/activa", (): EstadoCorridaActiva => ({ activa: false, runId: null }));

  app.post<{ Body: { texto?: string } }>("/api/comando", async (req, reply) => {
    const texto = req.body?.texto?.trim();
    if (!texto) {
      await reply.status(400).send({ error: 'falta "texto"' });
      return;
    }
    await reply.status(501).send({ error: "pendiente del Bloque 4: todavía no hay ningún agente que ejecute esto" });
  });

  // Sin ninguna ejecución que pueda estar en marcha, esta conexión no tiene nada que reenviar:
  // avisa y cierra en vez de dejar al cliente esperando eventos que nunca van a llegar.
  app.get("/api/eventos", (_req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    reply.raw.write(`event: sin-corrida\ndata: ${JSON.stringify({ motivo: "No hay ninguna corrida activa para este proyecto." })}\n\n`);
    reply.raw.end();
  });

  if (existsSync(distClient)) {
    app.register(fastifyStatic, { root: distClient });
  }

  return app;
}
