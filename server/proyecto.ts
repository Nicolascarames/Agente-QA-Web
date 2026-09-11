import path from "node:path";

/** Resuelve el proyecto activo: `--project <ruta>` del argv gana, si no, la ruta de `npm run dev` (env), si no, cwd. */
export function resolverProyectoInicial(argv: readonly string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const index = argv.indexOf("--project");
  if (index !== -1 && argv[index + 1]) {
    return path.resolve(argv[index + 1]);
  }
  if (env.AGENTE_QA_PROJECT) {
    return path.resolve(env.AGENTE_QA_PROJECT);
  }
  return cwd;
}

/**
 * Reemplaza a mano `projectPaths` de `agente-qa-contract/project` (Bloque 2: esa dependencia se
 * quita del todo). Mismas rutas que el contrato calculaba bajo `.agente-qa/`; solo los campos que
 * este repo usa hoy (config/credenciales/features) — el resto (mapa, estado, capturas) pertenecía
 * al CLI/mapa antiguo que este bloque borra.
 */
export function projectPaths(rootDir: string): {
  root: string;
  dir: string;
  configPath: string;
  envPath: string;
  featuresDir: string;
  memoryPath: string;
} {
  const dir = path.join(rootDir, ".agente-qa");
  return {
    root: rootDir,
    dir,
    configPath: path.join(dir, "config.json"),
    envPath: path.join(dir, ".env"),
    featuresDir: path.join(dir, "features"),
    memoryPath: path.join(dir, "memory.json"),
  };
}
