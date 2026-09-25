import { createContext, useContext } from "react";

// Preferencias de interfaz por navegador (Configuración → Apariencia): viven en localStorage, no en
// agente-qa.config.json/ConfigRaiz — ese fichero es del proyecto y se comparte por equipo, esto es
// solo "cómo veo yo la web en esta máquina". Cada lectura/escritura va envuelta en try/catch:
// localStorage puede lanzar (modo privado, cuota agotada) y eso no debe tumbar la app.

export type ModoPaneles = "fijos" | "movibles";

export interface PreferenciasUI {
  /** Desplazamiento en px sobre la escala de fuentes de tailwind.config.ts. Por defecto -2: la
   *  escala se subió +4px el 2026-09-14 y en uso real resultó demasiado grande. */
  ajusteTexto: number;
  /** "fijos": cada panel ocupa su hueco de mockup, sin arrastre ni redimensionado. "movibles": se
   *  pueden arrastrar y redimensionar por toda la banda (pestaña + consola), como antes de esta
   *  preferencia. */
  modoPaneles: ModoPaneles;
}

export const AJUSTE_TEXTO_MIN = -4;
export const AJUSTE_TEXTO_MAX = 4;

export const PREFERENCIAS_POR_DEFECTO: PreferenciasUI = {
  ajusteTexto: -2,
  modoPaneles: "fijos",
};

const CLAVE_STORAGE = "agente-qa-web:preferencias-ui";

/** Pura: castea/clampa cualquier valor bruto (JSON.parse de localStorage, o un patch parcial del
 *  formulario de Apariencia) a unas preferencias válidas. Un campo ausente, de tipo equivocado o
 *  fuera de rango cae a su valor por defecto — nunca lanza. */
export function normalizarPreferencias(bruto: unknown): PreferenciasUI {
  const objeto = typeof bruto === "object" && bruto !== null ? (bruto as Record<string, unknown>) : {};

  const ajusteBruto = objeto.ajusteTexto;
  const ajusteTexto =
    typeof ajusteBruto === "number" && Number.isFinite(ajusteBruto)
      ? Math.min(AJUSTE_TEXTO_MAX, Math.max(AJUSTE_TEXTO_MIN, Math.round(ajusteBruto)))
      : PREFERENCIAS_POR_DEFECTO.ajusteTexto;

  const modoPaneles: ModoPaneles = objeto.modoPaneles === "movibles" ? "movibles" : PREFERENCIAS_POR_DEFECTO.modoPaneles;

  return { ajusteTexto, modoPaneles };
}

/** Lee las preferencias guardadas; sin nada guardado, con JSON inválido o si `storage` lanza,
 *  devuelve las de por defecto. `storage` es parámetro (no `window.localStorage` fijo) para poder
 *  testear la normalización sin DOM. */
export function leerPreferencias(storage: Pick<Storage, "getItem">): PreferenciasUI {
  try {
    const bruto = storage.getItem(CLAVE_STORAGE);
    if (!bruto) return PREFERENCIAS_POR_DEFECTO;
    return normalizarPreferencias(JSON.parse(bruto));
  } catch {
    return PREFERENCIAS_POR_DEFECTO;
  }
}

export function guardarPreferencias(storage: Pick<Storage, "setItem">, preferencias: PreferenciasUI): void {
  try {
    storage.setItem(CLAVE_STORAGE, JSON.stringify(preferencias));
  } catch {
    // No es crítico: si falla, la próxima carga vuelve a los valores por defecto.
  }
}

export interface PreferenciasUIContextValor extends PreferenciasUI {
  setAjusteTexto: (ajusteTexto: number) => void;
  setModoPaneles: (modoPaneles: ModoPaneles) => void;
}

export const PreferenciasUIContext = createContext<PreferenciasUIContextValor | null>(null);

/** Solo usable bajo `<PreferenciasUIContext.Provider>` (App.tsx, dueño del estado) — lanza si no,
 *  para detectar en desarrollo un panel montado fuera del árbol en vez de fallar en silencio con
 *  valores inventados. */
export function usePreferenciasUI(): PreferenciasUIContextValor {
  const valor = useContext(PreferenciasUIContext);
  if (!valor) throw new Error("usePreferenciasUI debe usarse dentro de <PreferenciasUIContext.Provider>");
  return valor;
}
