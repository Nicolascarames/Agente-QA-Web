// El asistente de instalación guiada (Pieza 2 de la spec 2026-09-12). Mismo patrón de IO
// inyectable que doctor.ts e instalar.ts, testeado sin terminal real: `bin/agente-qa.mjs` conecta
// la terminal de verdad.
//
// No contiene lógica nueva: es un director de orquesta sobre lo que ya existe (`ejecutarDoctor`,
// `escribirConfigRaiz`, `escribirCredenciales`, `instalar`). Cualquier comprobación que faltase se
// añade a server/doctor.ts, no aquí, para que Configuración la herede sola.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { comprobarBinarioSdk, comprobarCredenciales, comprobarNode, comprobarPlaywright, ejecutarDoctor } from "./doctor.js";
import { instalar, type ResultadoInstalar } from "./instalar.js";
import { configRaizPath, credencialesPath, escribirConfigRaiz, escribirCredenciales, leerConfigRaiz, leerCredenciales } from "./proyecto.js";
import type { ConfigRaiz, ResultadoComprobacion } from "../shared/tipos.js";

/** Nombre en `package.json` de este mismo paquete (Pieza 1). Si el repo destino lo comparte, el
 *  asistente sabe que trabaja sobre su propio código y toma la rama B — hoy es literalmente el
 *  criterio que fija la spec ("hoy es qa-web-agent"); si el paquete se renombra otra vez, este
 *  literal se actualiza con él. */
const NOMBRE_PROPIO = "qa-web-agent";

export type Rama = "usuario" | "desarrollo";

export interface ResultadoAsistente {
  rama: Rama;
  /** false cuando el asistente ya imprimió todo lo necesario y el proceso debe terminar aquí (sin
   *  TTY, o un paso no arreglable de la rama A): quien llama no debe seguir con `app.listen`. */
  continuar: boolean;
  codigoSalida: number;
}

/** Las tres familias de dependencias que el asistente orquesta, agrupadas por origen — así un test
 *  puede pisar solo la que necesite y el resto sigue siendo el comportamiento real. */
export interface DependenciasAsistente {
  preguntar: (texto: string) => Promise<string>;
  confirmar: (mensaje: string) => Promise<boolean>;
  escribir: (linea: string) => void;
  esTty: boolean;
  ejecutar: (mandato: string, args: string[], cwd: string) => Promise<boolean>;
  existeDirectorio: (ruta: string) => Promise<boolean>;
  leerNombrePackageJson: (rootDir: string) => Promise<string | null>;
  doctor: {
    ejecutarDoctor: typeof ejecutarDoctor;
    comprobarNode: typeof comprobarNode;
    comprobarCredenciales: typeof comprobarCredenciales;
    comprobarBinarioSdk: typeof comprobarBinarioSdk;
    comprobarPlaywright: typeof comprobarPlaywright;
  };
  proyecto: {
    leerConfigRaiz: typeof leerConfigRaiz;
    escribirConfigRaiz: typeof escribirConfigRaiz;
    leerCredenciales: typeof leerCredenciales;
    escribirCredenciales: typeof escribirCredenciales;
  };
  instalarSkill: typeof instalar;
}

async function preguntarPorTerminal(texto: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(texto)).trim();
  } finally {
    rl.close();
  }
}

async function confirmarPorTerminal(mensaje: string): Promise<boolean> {
  const respuesta = await preguntarPorTerminal(`${mensaje} (s/N) `);
  return respuesta.toLowerCase().startsWith("s");
}

function ejecutarComando(mandato: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const hijo = spawn(mandato, args, { cwd, stdio: "inherit", shell: true });
    hijo.on("exit", (codigo) => {
      resolve(codigo === 0);
    });
    hijo.on("error", () => {
      resolve(false);
    });
  });
}

async function existeDirectorio(ruta: string): Promise<boolean> {
  try {
    return (await fs.stat(ruta)).isDirectory();
  } catch {
    return false;
  }
}

async function leerNombrePackageJson(rootDir: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8")) as { name?: unknown };
    return typeof raw.name === "string" ? raw.name : null;
  } catch {
    return null;
  }
}

function dependenciasPorDefecto(): DependenciasAsistente {
  return {
    preguntar: preguntarPorTerminal,
    confirmar: confirmarPorTerminal,
    escribir: (linea) => {
      console.log(linea);
    },
    esTty: Boolean(process.stdin.isTTY),
    ejecutar: ejecutarComando,
    existeDirectorio,
    leerNombrePackageJson,
    doctor: { ejecutarDoctor, comprobarNode, comprobarCredenciales, comprobarBinarioSdk, comprobarPlaywright },
    proyecto: { leerConfigRaiz, escribirConfigRaiz, leerCredenciales, escribirCredenciales },
    instalarSkill: instalar,
  };
}

function mezclarDependencias(opciones: Partial<DependenciasAsistente>): DependenciasAsistente {
  const base = dependenciasPorDefecto();
  return {
    ...base,
    ...opciones,
    doctor: { ...base.doctor, ...opciones.doctor },
    proyecto: { ...base.proyecto, ...opciones.proyecto },
  };
}

function imprimirComprobacion(escribir: (linea: string) => void, comprobacion: ResultadoComprobacion): void {
  escribir(`${comprobacion.ok ? "✅" : "❌"} ${comprobacion.nombre}: ${comprobacion.mensaje}`);
}

/** Pasos 1–3 de la rama A, idénticos en la rama B (tabla de la spec). Devuelve `false` si el paso 1
 *  (Node), no arreglable, obliga a abortar; el paso 2 (sesión) tiene reintentos ilimitados y nunca
 *  aborta por sí solo. */
async function pasosComunes(deps: DependenciasAsistente): Promise<boolean> {
  const node = deps.doctor.comprobarNode();
  imprimirComprobacion(deps.escribir, node);
  if (!node.ok) return false;

  let sesion = await deps.doctor.comprobarCredenciales();
  while (!sesion.ok) {
    deps.escribir(`❌ ${sesion.mensaje}`);
    await deps.preguntar("Ejecuta `claude login` en otra terminal y pulsa Enter cuando termines... ");
    sesion = await deps.doctor.comprobarCredenciales();
  }
  deps.escribir(`✅ ${sesion.mensaje}`);

  imprimirComprobacion(deps.escribir, await deps.doctor.comprobarBinarioSdk());
  return true;
}

async function ejecutarRamaA(cwd: string, deps: DependenciasAsistente): Promise<ResultadoAsistente> {
  const { escribir, preguntar, confirmar, doctor, proyecto } = deps;

  if (!(await pasosComunes(deps))) {
    return { rama: "usuario", continuar: false, codigoSalida: 1 };
  }

  // 4. Playwright en el repo destino.
  const playwright = await doctor.comprobarPlaywright(cwd);
  if (playwright.ok) {
    escribir(`✅ ya estaba: ${playwright.mensaje}`);
  } else if (await confirmar("¿Instalo Playwright en este repo?")) {
    await deps.ejecutar("npm", ["i", "-D", "@playwright/test"], cwd);
    await deps.ejecutar("npx", ["playwright", "install"], cwd);
  } else {
    escribir(`⏭️  Playwright no instalado: ${playwright.mensaje}`);
  }

  // 5. URL base de la aplicación + 6. Entorno y barrera de escrituras: mismo fichero, un solo paso
  // en disco. Si `agente-qa.config.json` ya existe se consideran los dos ya resueltos: no hay forma
  // de distinguir "el usuario ya contestó pruebas" de "aún no se le ha preguntado" sin guardar un
  // marcador nuevo, y la spec no lo pide.
  const configPrevio = await proyecto.leerConfigRaiz(cwd);
  let config: ConfigRaiz;
  if (configPrevio) {
    escribir(`✅ ya estaba: ${configPrevio.appUrl} (${configPrevio.entorno})`);
    config = configPrevio;
  } else {
    const appUrl = await preguntar("URL base de la aplicación a probar: ");
    const esReal = (await preguntar("¿Es un entorno de pruebas o una aplicación real? (pruebas/real) ")).toLowerCase().startsWith("r");
    let listaBlanca: string[] = [];
    if (esReal) {
      const respuesta = await preguntar("Lista blanca de URLs permitidas, separadas por coma: ");
      listaBlanca = respuesta
        .split(",")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    }
    config = { schemaVersion: 1, appUrl, entorno: esReal ? "real" : "pruebas", barrera: esReal, listaBlanca };
    await proyecto.escribirConfigRaiz(cwd, config);
    escribir(`Creado ${configRaizPath(cwd)}`);
  }

  // 7. Credenciales de prueba.
  const credenciales = await proyecto.leerCredenciales(cwd);
  if (credenciales.variables.length > 0) {
    escribir(`✅ ya estaba: ${String(credenciales.variables.length)} credencial(es) guardada(s)`);
  } else if (await confirmar("¿Guardo un usuario de prueba?")) {
    const usuario = await preguntar("Usuario: ");
    const contrasena = await preguntar("Contraseña: ");
    await proyecto.escribirCredenciales(cwd, {
      schemaVersion: 1,
      variables: [
        { nombre: "USUARIO", valor: usuario },
        { nombre: "CONTRASENA", valor: contrasena },
      ],
    });
    escribir(`✅ Guardado en ${credencialesPath(cwd)}`);
  } else {
    escribir("⏭️  Sin credenciales de prueba");
  }

  // 8. Skill en el repo destino.
  const skillYaInstalada = await deps.existeDirectorio(path.join(cwd, ".claude", "skills", "qa"));
  if (skillYaInstalada) {
    escribir("✅ ya estaba: skill instalada en .claude/skills/qa");
  } else if (await confirmar("¿La instalo para poder usarla también desde tu terminal, sin la web?")) {
    const resultado: ResultadoInstalar = await deps.instalarSkill(cwd);
    for (const ruta of resultado.escritos) escribir(`✅ ${ruta}`);
  } else {
    escribir("⏭️  Skill no instalada");
  }

  // 9. Cierre. Levantar la web e imprimir su URL es cosa de quien llama (bin/agente-qa.mjs ya lo
  // hace tras `asegurarConfigRaiz`): aquí solo el resumen, para no acoplar este módulo a app.ts.
  escribir(`Listo. Aplicación configurada contra ${config.appUrl}. Levantando la web…`);
  return { rama: "usuario", continuar: true, codigoSalida: 0 };
}

async function ejecutarRamaB(cwd: string, deps: DependenciasAsistente): Promise<ResultadoAsistente> {
  const { escribir, confirmar } = deps;

  if (!(await pasosComunes(deps))) {
    return { rama: "desarrollo", continuar: false, codigoSalida: 1 };
  }

  // 2. ¿Está compilado?
  const compilado = await deps.existeDirectorio(path.join(cwd, "dist-server"));
  if (compilado) {
    escribir("✅ ya estaba: dist-server/ existe");
  } else {
    escribir("Compilando (npm run build)…");
    await deps.ejecutar("npm", ["run", "build"], cwd);
  }

  // 3. ¿Contra qué repo trabajamos?
  const rutaSauce = path.join(cwd, "pruebas", "sauce");
  let proyectoElegido: string | undefined;
  if (await deps.existeDirectorio(rutaSauce)) {
    if (await confirmar("¿Usar pruebas/sauce/ como proyecto de pruebas?")) {
      proyectoElegido = rutaSauce;
    }
  } else {
    escribir("No existe pruebas/sauce/: es un repo de pruebas contra SauceDemo, fuera de git, opcional.");
    escribir("Puedes seguir sin él; el servidor arrancará igualmente sobre este repo.");
  }

  // 4. Arranca `npm run dev -- --project <elegido>`.
  const argsDev = proyectoElegido ? ["run", "dev", "--", "--project", proyectoElegido] : ["run", "dev"];
  escribir("Arrancando: http://localhost:5173 (cliente) y http://localhost:3939 (servidor).");
  escribir("Si algo bajo /api/ falla tras un reinicio, mata los procesos node huérfanos (ver README).");
  await deps.ejecutar("npm", argsDev, cwd);

  return { rama: "desarrollo", continuar: false, codigoSalida: 0 };
}

/**
 * Punto de entrada del asistente (Pieza 2). Elige rama por el `name` de `package.json` del `cwd`
 * recibido, y aplica las dos reglas transversales de la spec: sin TTY imprime el diagnóstico
 * completo del `doctor` y no pregunta nada; con TTY, cada paso es idempotente y un "no" en un paso
 * opcional no aborta los siguientes.
 */
export async function ejecutarAsistente(cwd: string, opciones: Partial<DependenciasAsistente> = {}): Promise<ResultadoAsistente> {
  const deps = mezclarDependencias(opciones);
  const nombre = await deps.leerNombrePackageJson(cwd);
  const rama: Rama = nombre === NOMBRE_PROPIO ? "desarrollo" : "usuario";

  if (!deps.esTty) {
    const resultado = await deps.doctor.ejecutarDoctor(cwd);
    for (const comprobacion of resultado.comprobaciones) imprimirComprobacion(deps.escribir, comprobacion);
    return { rama, continuar: false, codigoSalida: resultado.ok ? 0 : 1 };
  }

  return rama === "desarrollo" ? ejecutarRamaB(cwd, deps) : ejecutarRamaA(cwd, deps);
}
