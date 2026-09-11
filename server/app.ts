import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import spawn from "cross-spawn";
import { leerEstadoProyecto } from "./estado.js";
import { escribirClave, listarClaves, verClave } from "./claves.js";
import { escribirConfigProyecto, leerConfigProyecto, verCredencialProyecto } from "./config.js";
import { esProveedor } from "./entornoMcp.js";
import type {
  CambiosConfigProyecto,
  ClaveInfo,
  ConfigProyectoRespuesta,
  EstadoCorridaActiva,
  EstadoProyectoActivo,
} from "../shared/tipos.js";

export interface AppOptions {
  proyectoInicial: string;
}

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// Este fichero compila a dist-server/app.js; dist-client/ es hermana de dist-server/
// en la raíz del repo, no del proyecto que se está inspeccionando.
const distClient = path.resolve(dirActual, "..", "dist-client");

interface ResultadoProceso {
  codigo: number | null;
  stdout: string;
  stderr: string;
}

function ejecutar(comando: string, args: string[], cwd: string): Promise<ResultadoProceso> {
  return new Promise((resolve) => {
    const proceso = spawn(comando, args, { cwd });
    let stdout = "";
    let stderr = "";
    proceso.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proceso.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proceso.on("error", (err) => {
      resolve({ codigo: null, stdout, stderr: `${stderr}\n${err.message}` });
    });
    proceso.on("close", (codigo) => resolve({ codigo, stdout, stderr }));
  });
}

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

  // Lanza `agente-qa-mcp init` en la carpeta del proyecto activo. cross-spawn ya
  // resuelve el binario buscando en PATH (incluidos los .cmd de Windows).
  app.post("/api/init", async (_req, reply) => {
    const resultado = await ejecutar("agente-qa-mcp", ["init"], proyectoActivo);
    await reply.status(resultado.codigo === 0 ? 200 : 500).send(resultado);
  });

  // --- Configuración (Bloque 4; `llm` desde Spec B/Bloque 3): todo vive en el proyecto -----

  app.get("/api/config/proyecto", async (): Promise<ConfigProyectoRespuesta> => leerConfigProyecto(proyectoActivo));

  app.put<{ Body: CambiosConfigProyecto }>("/api/config/proyecto", async (req, reply) => {
    const resultado = await escribirConfigProyecto(proyectoActivo, req.body ?? {});
    if (!resultado.ok) {
      await reply.status(400).send({ error: resultado.motivo });
      return;
    }
    await reply.send(await leerConfigProyecto(proyectoActivo));
  });

  // Única ruta que devuelve el valor completo de una credencial de proyecto, nunca en el listado ni logueada.
  app.post<{ Params: { campo: string } }>(
    "/api/config/proyecto/credenciales/:campo/ver",
    { logLevel: "silent" },
    async (req, reply) => {
      const { campo } = req.params;
      if (campo !== "usuario" && campo !== "password") {
        await reply.status(400).send({ error: `Campo no reconocido: ${campo}` });
        return;
      }
      const resultado = await verCredencialProyecto(proyectoActivo, campo);
      if (!resultado.ok) {
        await reply.status(404).send({ error: resultado.motivo });
        return;
      }
      await reply.send({ valor: resultado.valor });
    }
  );

  // --- Claves de API (decisión 8 de la entrevista: enmascaradas, la clave completa solo por /ver) --

  app.get("/api/claves", async (): Promise<ClaveInfo[]> => listarClaves(proyectoActivo));

  app.put<{ Params: { proveedor: string }; Body: { valor?: string; capa?: "proyecto" | "global" } }>(
    "/api/claves/:proveedor",
    async (req, reply) => {
      const { proveedor } = req.params;
      if (!esProveedor(proveedor)) {
        await reply.status(400).send({ error: `Proveedor no reconocido: ${proveedor}` });
        return;
      }
      const valor = req.body?.valor;
      const capa = req.body?.capa ?? "global";
      if (!valor) {
        await reply.status(400).send({ error: 'falta "valor"' });
        return;
      }
      const resultado = await escribirClave(proyectoActivo, proveedor, valor, capa);
      if (!resultado.ok) {
        await reply.status(400).send({ error: resultado.motivo });
        return;
      }
      await reply.send(await listarClaves(proyectoActivo));
    }
  );

  // Única ruta que devuelve la clave completa: nunca se loguea, ni en el access log de Fastify.
  app.post<{ Params: { proveedor: string } }>(
    "/api/claves/:proveedor/ver",
    { logLevel: "silent" },
    async (req, reply) => {
      const { proveedor } = req.params;
      if (!esProveedor(proveedor)) {
        await reply.status(400).send({ error: `Proveedor no reconocido: ${proveedor}` });
        return;
      }
      const resultado = await verClave(proyectoActivo, proveedor);
      if (!resultado.ok) {
        await reply.status(404).send({ error: resultado.motivo });
        return;
      }
      await reply.send({ valor: resultado.valor });
    }
  );

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
