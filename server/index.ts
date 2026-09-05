import { buildApp } from "./app.js";
import { resolverProyectoInicial } from "./proyecto.js";

const PUERTO = Number(process.env.PORT) || 3939;

async function main(): Promise<void> {
  const proyectoInicial = resolverProyectoInicial(process.argv, process.cwd(), process.env);
  const app = buildApp({ proyectoInicial });

  try {
    // Solo 127.0.0.1: esta web nunca escucha en la red.
    await app.listen({ port: PUERTO, host: "127.0.0.1" });
    app.log.info(`proyecto activo: ${proyectoInicial}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
