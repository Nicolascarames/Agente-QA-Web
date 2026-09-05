import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import spawn from "cross-spawn";
import { leerEstadoProyecto } from "./estado.js";
import { anadirReciente, leerRecientes } from "./proyecto.js";
import type { EstadoProyectoActivo } from "../shared/tipos.js";

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
  let proyectoActivo = opts.proyectoInicial;

  // El estado no se guarda: se deriva del disco en cada petición.
  app.get("/api/estado", async () => leerEstadoProyecto(proyectoActivo));

  // Pendiente del Bloque 1 de Agente-QA-MCP (`agente-qa-mcp metrics --last N --json`):
  // hoy el CLI no emite NDJSON de actividad, así que no hay nada honesto que devolver.
  app.get("/api/actividad", async (_req, reply) => {
    await reply.status(501).send({ error: "pendiente del Bloque 1: agente-qa-mcp metrics --last N --json" });
  });

  app.get("/api/proyecto", async (): Promise<EstadoProyectoActivo> => {
    return { actual: proyectoActivo, recientes: await leerRecientes() };
  });

  app.post<{ Body: { ruta?: string } }>("/api/proyecto", async (req, reply) => {
    const ruta = req.body?.ruta;
    if (!ruta) {
      await reply.status(400).send({ error: "falta \"ruta\"" });
      return;
    }
    proyectoActivo = path.resolve(ruta);
    const recientes = await anadirReciente(proyectoActivo);
    const respuesta: EstadoProyectoActivo = { actual: proyectoActivo, recientes };
    await reply.send(respuesta);
  });

  // Lanza `agente-qa-mcp init` en la carpeta del proyecto activo. cross-spawn ya
  // resuelve el binario buscando en PATH (incluidos los .cmd de Windows).
  app.post("/api/init", async (_req, reply) => {
    const resultado = await ejecutar("agente-qa-mcp", ["init"], proyectoActivo);
    await reply.status(resultado.codigo === 0 ? 200 : 500).send(resultado);
  });

  if (existsSync(distClient)) {
    app.register(fastifyStatic, { root: distClient });
  }

  return app;
}
