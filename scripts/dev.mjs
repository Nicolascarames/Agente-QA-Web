#!/usr/bin/env node
// `npm run dev -- --project <ruta>` no puede reenviar el flag directamente a los dos procesos sin
// ambigüedad, así que se lee aquí una vez y se pasa como variable de entorno a los dos hijos: Vite
// lo ignora, `tsx watch server/index.ts` lo usa como fallback de `--project` (ver server/proyecto.ts).
//
// Antes esto lanzaba los dos procesos con `concurrently`. En Windows, `concurrently` arrancando
// `tsx watch server/index.ts` falla en silencio de forma determinista: el proceso arranca, nunca
// imprime nada (ni siquiera un error) y nunca llega a escuchar en el puerto — reproducido 10/10
// veces aislando el comando fuera de `concurrently`. La causa raíz no es `concurrently` en sí sino
// el `stdio: "pipe"` que usa para poder prefijar cada línea con `[vite]`/`[server]`: `tsx watch`
// lanza un proceso hijo propio para ejecutar el script y respawnearlo en cada cambio, y ese hijo
// nunca llega a arrancar si el `stdio` de `tsx watch` no es `"inherit"` (probado también aquí: el
// mismo `spawn` con `stdio: "pipe"` + reenvío manual de `data` falla igual, sin `concurrently` de
// por medio). Con `stdio: "inherit"` arranca siempre a la primera — el precio es perder el
// prefijo `[vite]`/`[server]` por línea; ambos procesos escriben a la misma consola sin distinguir.
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const flagIndex = args.indexOf("--project");
const env = { ...process.env };
if (flagIndex !== -1 && args[flagIndex + 1]) {
  env.AGENTE_QA_PROJECT = args[flagIndex + 1];
}

const vite = spawn("npx", ["vite"], { stdio: "inherit", env, shell: true });
const servidor = spawn("npx", ["tsx", "watch", "server/index.ts"], { stdio: "inherit", env, shell: true });

let cerrando = false;
/** @param {number | null} [codigo] */
function pararTodo(codigo) {
  if (cerrando) return;
  cerrando = true;
  vite.kill();
  servidor.kill();
  process.exit(codigo ?? 0);
}

vite.on("exit", (codigo) => {
  pararTodo(codigo);
});
servidor.on("exit", (codigo) => {
  pararTodo(codigo);
});
process.on("SIGINT", () => {
  pararTodo(0);
});
process.on("SIGTERM", () => {
  pararTodo(0);
});
