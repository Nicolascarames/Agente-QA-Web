import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import spawn from "cross-spawn";
import { leerEstadoProyecto, leerMapaCompleto } from "./estado.js";
import { anadirReciente, leerRecientes } from "./proyecto.js";
import { escribirClave, listarClaves, verClave } from "./claves.js";
import { escribirConfigGlobal, escribirConfigProyecto, leerConfigGlobal, leerConfigProyecto, verCredencialProyecto } from "./config.js";
import { aResultadoCli, ejecutarCli, localizarCli } from "./cli.js";
import { esProveedor } from "./entornoMcp.js";
import { construirArgsCorrida, detenerCorrida, hayCorridaActiva, historialActivo, lanzarCorrida, runIdActivo, suscribirseAEventos } from "./corridas.js";
import type {
  CambiosConfigGlobal,
  CambiosConfigProyecto,
  ClaveInfo,
  ConfigGlobal,
  ConfigProyectoRespuesta,
  CuerpoExplorar,
  EstadoCorridaActiva,
  EstadoProyectoActivo,
  MapaCompleto,
  ResultadoCli,
  RespuestaExplorar,
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

  // --- Configuración (Bloque 4): dos capas, proyecto y global ---------------------------

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

  app.get("/api/config/global", async (): Promise<ConfigGlobal> => leerConfigGlobal(proyectoActivo));

  app.put<{ Body: CambiosConfigGlobal }>("/api/config/global", async (req, reply) => {
    const resultado = await escribirConfigGlobal(proyectoActivo, req.body ?? {});
    if (!resultado.ok) {
      await reply.status(400).send({ error: resultado.motivo });
      return;
    }
    await reply.send(await leerConfigGlobal(proyectoActivo));
  });

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

  // --- Localización del CLI, doctor y prueba de proveedor --------------------------------

  app.get("/api/cli", async (): Promise<ResultadoCli> => aResultadoCli(await localizarCli()));

  app.post("/api/doctor", async (_req, reply) => {
    const resultado = await ejecutarCli(["doctor"], proyectoActivo);
    await reply.status(resultado.codigo === 0 ? 200 : 500).send(resultado);
  });

  app.post<{ Body: { provider?: string; model?: string; profile?: string } }>("/api/llm-ping", async (req, reply) => {
    const args = ["llm", "ping"];
    if (req.body?.provider) args.push("--provider", req.body.provider);
    if (req.body?.model) args.push("--model", req.body.model);
    if (req.body?.profile) args.push("--profile", req.body.profile);
    const resultado = await ejecutarCli(args, proyectoActivo);
    await reply.status(resultado.codigo === 0 ? 200 : 500).send(resultado);
  });

  // --- Explorar (Bloque 5): las cuatro puertas al mapeador-mcp, en vivo ------------------

  app.get("/api/mapa", async (): Promise<MapaCompleto> => leerMapaCompleto(proyectoActivo));

  app.get("/api/corridas/activa", (): EstadoCorridaActiva => ({
    activa: hayCorridaActiva(proyectoActivo),
    runId: runIdActivo(proyectoActivo),
  }));

  app.post<{ Body: CuerpoExplorar }>("/api/explorar", async (req, reply) => {
    const args = construirArgsCorrida(req.body ?? { puerta: "instantanea" });
    if (!args.ok) {
      await reply.status(400).send({ error: args.motivo });
      return;
    }
    const resultado = await lanzarCorrida(proyectoActivo, args.args);
    if (!resultado.ok) {
      await reply.status(409).send({ error: resultado.motivo });
      return;
    }
    const respuesta: RespuestaExplorar = { runId: resultado.runId };
    await reply.send(respuesta);
  });

  app.post("/api/detener", async (_req, reply) => {
    const resultado = detenerCorrida(proyectoActivo);
    if (!resultado.ok) {
      await reply.status(409).send({ error: resultado.motivo });
      return;
    }
    await reply.send({ ok: true });
  });

  // SSE: reenvía el historial acumulado de la corrida activa y luego sigue en vivo — así
  // recargar el navegador con una corrida en marcha no pierde lo anterior. Sin corrida activa,
  // cierra la conexión con un mensaje claro en vez de dejarla colgada.
  app.get("/api/eventos", (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    if (!hayCorridaActiva(proyectoActivo)) {
      reply.raw.write(`event: sin-corrida\ndata: ${JSON.stringify({ motivo: "No hay ninguna corrida activa para este proyecto." })}\n\n`);
      reply.raw.end();
      return;
    }

    for (const evento of historialActivo(proyectoActivo)) {
      reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
    }

    const cancelar = suscribirseAEventos(proyectoActivo, (evento) => {
      reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
    });
    req.raw.on("close", () => {
      cancelar?.();
    });
  });

  if (existsSync(distClient)) {
    app.register(fastifyStatic, { root: distClient });
  }

  return app;
}
