#!/usr/bin/env node
// `npm run dev -- --project <ruta>` no puede reenviar el flag directamente a los
// dos procesos que levanta `concurrently` sin ambigüedad (concurrently se
// quedaría los argumentos para sí). Lo leemos aquí una vez y lo pasamos como
// variable de entorno a los dos hijos: Vite lo ignora, `tsx watch
// server/index.ts` lo usa como fallback de `--project` (ver server/proyecto.ts).
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const flagIndex = args.indexOf("--project");
const env = { ...process.env };
if (flagIndex !== -1 && args[flagIndex + 1]) {
  env.AGENTE_QA_PROJECT = args[flagIndex + 1];
}

// Con shell: true, un array de argumentos con espacios dentro de cada elemento
// se concatena sin re-comillar (aviso DEP0190) y concurrently ve 4 comandos
// sueltos en vez de 2. Pasar la línea ya compuesta como un único string evita
// eso: cmd.exe la ejecuta tal cual, comillas incluidas.
const comando = 'npx concurrently -k -n vite,server "vite" "tsx watch server/index.ts"';
const child = spawn(comando, { stdio: "inherit", env, shell: true });

child.on("exit", (code) => process.exit(code ?? 0));
