// Tipos del catálogo editorial: la prosa y los cuatro ejes de cada comando (spec Bloque 2,
// "El HTML actual mete tres cosas distintas en un único chip agent-*" — aquí se separan).
// Deliberadamente sin importar `cli.generado.json` ni nada de `server/`: este módulo describe
// la ficha, `catalogo.ts` es quien la cruza con la forma real del CLI.

/** Quién mueve el ratón/teclado o decide el siguiente paso. */
export type Conductor = "humano" | "determinista" | "llm-api" | "claude-code";

/** Qué agente del ecosistema produce el resultado de este comando (o `"ninguno"` si es config/infra). */
export type Agente =
  | "mapeador-mcp"
  | "crawler"
  | "redactor"
  | "redactor-mcp"
  | "generador"
  | "generador-mcp"
  | "reparador"
  | "ejecutor"
  | "informador"
  | "agente-qa-web"
  | "ninguno";

/** Qué te cuesta lanzarlo. */
export type Coste = "cero" | "facturado" | "suscripcion";

/** Si ya se puede usar hoy, todavía no existe, o vive en otro repo del ecosistema. */
export type Estado = "construido" | "pendiente" | "otro-repo";

export interface EjesFicha {
  conductor: Conductor;
  agente: Agente;
  coste: Coste;
  estado: Estado;
}

export interface NotaFicha {
  tipo: "ok" | "aviso" | "peligro";
  texto: string;
}

export interface EjemploComando {
  /** Línea completa y realista, ya con valores de ejemplo — nunca un placeholder tipo `<url>`. */
  texto: string;
  /** Qué demuestra este ejemplo, en una frase. */
  explica: string;
  /** true si está pensado para insertarse tal cual en la consola asistida (Bloque 4); false si es solo ilustrativo. */
  plantilla: boolean;
}

/**
 * Documentación de una opción concreta del CLI. `matiz` añade contexto editorial por encima de
 * la `descripcion` real de `cli.generado.json` (no la repite); `ejes` solo se rellena cuando esa
 * opción concreta cambia alguno de los cuatro ejes de la ficha (hoy solo `record --auto`, que pasa
 * de conductor `humano`/coste `cero` a `claude-code`/`suscripcion`).
 */
export interface OpcionEditorial {
  matiz?: string;
  ejes?: Partial<EjesFicha>;
}

export interface FichaComando {
  /** Igual que `ruta` en `cli.generado.json` (`["llm", "ping"]`, nunca `"llm ping"`). Para las
   *  cuatro operaciones que aún no tienen comando, una ruta simbólica de un solo elemento. */
  ruta: string[];
  pestana: string;
  unaLinea: string;
  queHace: string[];
  queDeja: string[];
  cuandoUsarlo: string[];
  cuandoNo: string[];
  /** Clave = `larga` de la opción tal cual aparece en `cli.generado.json` (p.ej. `"--goal"`). */
  opciones: Record<string, OpcionEditorial>;
  ejemplos: EjemploComando[];
  notas: NotaFicha[];
  ejes: EjesFicha;
  palabrasClave: string[];
  /** Pares de flags que no tiene sentido combinar en la misma línea. Vacío en este bloque
   *  (se rellena en el Bloque 8); la función que lo valida ya existe en `catalogo.ts`. */
  incompatibles: string[][];
}
