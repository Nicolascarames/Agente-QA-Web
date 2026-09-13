import { describe, expect, it } from "vitest";
import { ejecutarAsistente, type DependenciasAsistente } from "./asistente.js";

const OK: { ok: true; mensaje: string } = { ok: true, mensaje: "ok" };

/** Dependencias con todo en verde y sin tocar disco/red: cada test pisa solo lo que necesita. */
function depsBase(overrides: Partial<DependenciasAsistente> = {}): Partial<DependenciasAsistente> {
  return {
    esTty: true,
    escribir: () => {},
    preguntar: () => Promise.resolve(""),
    confirmar: () => Promise.resolve(false),
    ejecutar: () => Promise.resolve(true),
    existeDirectorio: () => Promise.resolve(false),
    leerNombrePackageJson: () => Promise.resolve("un-repo-cualquiera"),
    doctor: {
      ejecutarDoctor: () => Promise.resolve({ ok: true, comprobaciones: [{ nombre: "Versión de Node", ...OK }] }),
      comprobarNode: () => ({ nombre: "Versión de Node", ...OK }),
      comprobarCredenciales: () => Promise.resolve({ nombre: "Sesión de Claude Code", ...OK }),
      comprobarBinarioSdk: () => Promise.resolve({ nombre: "Binario nativo del SDK", ...OK }),
      comprobarPlaywright: () => Promise.resolve({ nombre: "Playwright en el proyecto", ...OK }),
    },
    proyecto: {
      leerConfigRaiz: () => Promise.resolve({ schemaVersion: 1, appUrl: "https://ejemplo.test", entorno: "pruebas", barrera: false, listaBlanca: [] }),
      escribirConfigRaiz: () => Promise.resolve(),
      leerCredenciales: () => Promise.resolve({ schemaVersion: 1, variables: [] }),
      escribirCredenciales: () => Promise.resolve(),
    },
    instalarSkill: () => Promise.resolve({ escritos: [], omitidos: [] }),
    ...overrides,
  };
}

describe("ejecutarAsistente — detección de rama", () => {
  it("rama A (usuario) cuando el package.json del cwd no es el propio", async () => {
    const resultado = await ejecutarAsistente(
      "C:/repo-del-usuario",
      depsBase({ esTty: false, leerNombrePackageJson: () => Promise.resolve("web-de-otro") }),
    );
    expect(resultado.rama).toBe("usuario");
  });

  it("rama B (desarrollo) cuando el package.json del cwd es qa-web-agent", async () => {
    const resultado = await ejecutarAsistente(
      "C:/GitHub/Agente-QA-Web",
      depsBase({ esTty: false, leerNombrePackageJson: () => Promise.resolve("qa-web-agent") }),
    );
    expect(resultado.rama).toBe("desarrollo");
  });
});

describe("ejecutarAsistente — sin TTY", () => {
  it("no pregunta, imprime el diagnóstico completo y sale sin colgarse", async () => {
    const lineas: string[] = [];
    let preguntoAlgo = false;
    const resultado = await ejecutarAsistente(
      "C:/repo-del-usuario",
      depsBase({
        esTty: false,
        escribir: (linea) => lineas.push(linea),
        preguntar: () => {
          preguntoAlgo = true;
          return Promise.resolve("");
        },
      }),
    );

    expect(preguntoAlgo).toBe(false);
    expect(resultado.continuar).toBe(false);
    expect(resultado.codigoSalida).toBe(0);
    expect(lineas.some((l) => l.includes("Versión de Node"))).toBe(true);
  });

  it("sale con código 1 si el doctor no está ok", async () => {
    const resultado = await ejecutarAsistente(
      "C:/repo-del-usuario",
      depsBase({
        esTty: false,
        doctor: {
          ...(depsBase().doctor as DependenciasAsistente["doctor"]),
          ejecutarDoctor: () => Promise.resolve({ ok: false, comprobaciones: [{ nombre: "Versión de Node", ok: false, mensaje: "falta" }] }),
        },
      }),
    );
    expect(resultado.codigoSalida).toBe(1);
  });
});

describe("ejecutarAsistente — rama A con TTY", () => {
  it("un paso ya hecho (config existente) se salta y avisa 'ya estaba', sin volver a preguntar la URL", async () => {
    const lineas: string[] = [];
    let sePreguntoUrl = false;
    const resultado = await ejecutarAsistente(
      "C:/repo-del-usuario",
      depsBase({
        escribir: (linea) => lineas.push(linea),
        preguntar: (texto) => {
          if (texto.includes("URL base")) sePreguntoUrl = true;
          return Promise.resolve("");
        },
      }),
    );

    expect(sePreguntoUrl).toBe(false);
    expect(lineas.some((l) => l.includes("✅ ya estaba: https://ejemplo.test"))).toBe(true);
    expect(resultado.continuar).toBe(true);
    expect(resultado.codigoSalida).toBe(0);
  });

  it("un 'no' en un paso opcional (Playwright) no aborta los siguientes pasos", async () => {
    const lineas: string[] = [];
    const resultado = await ejecutarAsistente(
      "C:/repo-del-usuario",
      depsBase({
        escribir: (linea) => lineas.push(linea),
        confirmar: () => Promise.resolve(false),
        doctor: {
          ...(depsBase().doctor as DependenciasAsistente["doctor"]),
          comprobarPlaywright: () => Promise.resolve({ nombre: "Playwright en el proyecto", ok: false, mensaje: "falta instalar" }),
        },
      }),
    );

    expect(lineas.some((l) => l.includes("⏭️  Playwright no instalado"))).toBe(true);
    // Llegó hasta el cierre (paso 9) pese al "no": la rama completa sin abortar.
    expect(resultado.continuar).toBe(true);
    expect(resultado.codigoSalida).toBe(0);
  });
});
