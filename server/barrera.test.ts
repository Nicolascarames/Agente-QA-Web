import { describe, expect, it } from "vitest";
import { coincideListaBlanca, escaparParaRegExp, redactarSecretos, verificarLlamada } from "./barrera.js";

describe("escaparParaRegExp / coincideListaBlanca", () => {
  it("trata un patrón con ? como literal, no como cuantificador regex", () => {
    // Ejemplo explícito de la spec: "?" en una URL de lista blanca es parte de la query string,
    // no "el carácter anterior es opcional".
    const patron = "https://staging.ejemplo.com/pagar?id=1";
    expect(coincideListaBlanca("https://staging.ejemplo.com/pagar?id=1", [patron])).toBe(true);
    // Sin escapar, "?" haría que la "r" de "pagar" fuera opcional y esto también matchearía: no debe.
    expect(coincideListaBlanca("https://staging.ejemplo.com/paga?id=1", [patron])).toBe(false);
  });

  it("escaparParaRegExp neutraliza los caracteres especiales de regex", () => {
    expect(escaparParaRegExp("a?b.c+d")).toBe("a\\?b\\.c\\+d");
  });
});

describe("verificarLlamada", () => {
  const baseArgs = {
    toolName: "mcp__playwright__browser_click",
    toolInput: {},
    urlActual: "https://staging.ejemplo.com/carrito",
    entorno: "produccion",
  };

  it("con la barrera apagada, permite cualquier llamada", () => {
    const resultado = verificarLlamada({ ...baseArgs, barreraActiva: false, listaBlanca: [] });
    expect(resultado).toEqual({ permitir: true });
  });

  it("con la barrera encendida y la URL fuera de la lista blanca, deniega la llamada", () => {
    const resultado = verificarLlamada({ ...baseArgs, barreraActiva: true, listaBlanca: ["https://pruebas.ejemplo.com"] });
    expect(resultado.permitir).toBe(false);
    if (!resultado.permitir) {
      expect(resultado.motivo).toContain("https://staging.ejemplo.com/carrito");
      expect(resultado.motivo).toContain("produccion");
    }
  });

  it("con la barrera encendida y la URL en la lista blanca, permite la llamada", () => {
    const resultado = verificarLlamada({ ...baseArgs, barreraActiva: true, listaBlanca: ["https://staging.ejemplo.com"] });
    expect(resultado).toEqual({ permitir: true });
  });

  it("las herramientas de solo lectura pasan siempre, aunque la URL no esté en la lista blanca", () => {
    const resultado = verificarLlamada({
      toolName: "mcp__playwright__browser_snapshot",
      toolInput: {},
      urlActual: "https://staging.ejemplo.com",
      barreraActiva: true,
      listaBlanca: [],
      entorno: "produccion",
    });
    expect(resultado).toEqual({ permitir: true });
  });

  it("sin URL conocida (ni urlActual ni navegación), deniega y lo dice", () => {
    const resultado = verificarLlamada({
      toolName: "mcp__playwright__browser_click",
      toolInput: {},
      urlActual: null,
      barreraActiva: true,
      listaBlanca: [],
      entorno: "produccion",
    });
    expect(resultado.permitir).toBe(false);
    if (!resultado.permitir) expect(resultado.motivo).toContain("no se sabe a qué URL");
  });

  it("una navegación usa la URL de su propio input, no urlActual", () => {
    const resultado = verificarLlamada({
      toolName: "mcp__playwright__browser_navigate",
      toolInput: { url: "https://staging.ejemplo.com/nuevo" },
      urlActual: null,
      barreraActiva: true,
      listaBlanca: ["https://staging.ejemplo.com"],
      entorno: "produccion",
    });
    expect(resultado).toEqual({ permitir: true });
  });

  it("las tools que no son de Playwright pasan siempre: la barrera es sobre la app bajo prueba, no sobre el repo", () => {
    const resultado = verificarLlamada({
      toolName: "Bash",
      toolInput: {},
      urlActual: null,
      barreraActiva: true,
      listaBlanca: [],
      entorno: "produccion",
    });
    expect(resultado).toEqual({ permitir: true });
  });
});

describe("redactarSecretos", () => {
  it("redacta una variable que matchea /PASSWORD/i sin tocar el resto del texto", () => {
    const env = { SAUCE_PASSWORD: "hunter2secreto", OTRA_VAR: "irrelevante" };
    const texto = `login con contraseña hunter2secreto en el formulario`;
    expect(redactarSecretos(texto, env)).toBe("login con contraseña «SAUCE_PASSWORD» en el formulario");
  });

  it("no redacta valores de menos de 4 caracteres, aunque el nombre matchee", () => {
    const env = { API_KEY: "ab" };
    expect(redactarSecretos("el valor es ab", env)).toBe("el valor es ab");
  });

  it("sustituye primero los valores más largos, para no romper uno más corto que los contiene", () => {
    const env = { TOKEN_CORTO: "abc123", TOKEN_LARGO: "abc123456" };
    expect(redactarSecretos("visto: abc123456", env)).toBe("visto: «TOKEN_LARGO»");
  });

  it("redacta credenciales de Configuración aunque su nombre no matchee PASSWORD/SECRET/TOKEN/KEY/CREDENCIAL", () => {
    // "usuario_admin" no pasa el filtro de nombre que sí aplica a `env` — son datos de prueba que el
    // propio usuario decidió llamar así, deben redactarse igual.
    const credenciales = { usuario_admin: "standard_user", clave_admin: "secret_sauce" };
    const texto = "he entrado con standard_user y secret_sauce";
    expect(redactarSecretos(texto, {}, credenciales)).toBe("he entrado con «usuario_admin» y «clave_admin»");
  });

  it("combina env y credenciales en la misma pasada, valores largos primero entre ambos", () => {
    const env = { API_TOKEN: "abcdef" };
    const credenciales = { usuario: "abcdefghij" };
    expect(redactarSecretos("visto: abcdefghij", env, credenciales)).toBe("visto: «usuario»");
  });
});
