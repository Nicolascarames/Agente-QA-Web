import type { Config } from "tailwindcss";

// Colores, tipografía, radios y animaciones leídos de las variables de
// src/tokens.css (portadas de inspiraciones/QA Agent (standalone).html en
// Agente-QA-MCP; ver design/README.md), nunca hardcodeados sueltos por los
// componentes. `fontSize` se REEMPLAZA (no se extiende): es la escala real
// medida sobre el mockup, para que ningún tamaño ajeno pueda colarse.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: "var(--bg)",
      "bg-sunken": "var(--bg-sunken)",
      "bg-panel": "var(--bg-panel)",
      "bg-elev": "var(--bg-elev)",
      "bg-row": "var(--bg-row)",
      "bg-row-alt": "var(--bg-row-alt)",
      border: "var(--border)",
      "border-soft": "var(--border-soft)",
      "border-strong": "var(--border-strong)",
      "scroll-thumb": "var(--scroll-thumb)",
      text: "var(--text)",
      "text-strong": "var(--text-strong)",
      "text-bright": "var(--text-bright)",
      "text-muted": "var(--text-muted)",
      "text-dim": "var(--text-dim)",
      "text-faint": "var(--text-faint)",
      "text-ghost": "var(--text-ghost)",
      accent: "var(--accent)",
      "accent-soft": "var(--accent-soft)",
      "accent-hover": "var(--accent-hover)",
      "accent-bg": "var(--accent-bg)",
      "on-accent": "var(--on-accent)",
      ok: "var(--ok)",
      "ok-bg": "var(--ok-bg)",
      agent: "var(--agent)",
      info: "var(--info)",
      "info-bg": "var(--info-bg)",
      // Alias heredados del intento anterior: Explorar.tsx y Configuracion.tsx
      // (fuera del alcance de este bloque, ver Bloques 3 y 4) siguen usando
      // `bg-panel`/`text-warning`/`border-warning` — se mantienen apuntando al
      // token real más cercano en vez de dejarlos sin estilo hasta que se
      // toquen esos ficheros.
      panel: "var(--bg-panel)",
      warning: "var(--accent)",
    },
    fontSize: {
      "2xs": "8px",
      xs: "9px",
      "9.5": "9.5px",
      sm: "10px",
      base: "10.5px",
      "11": "11px",
      md: "12px",
      lg: "13px",
      xl: "16px",
      "2xl": "20px",
      "3xl": "24px",
    },
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: {
        2: "2px",
        3: "3px",
        4: "4px",
        6: "6px",
        7: "7px",
        8: "8px",
        10: "10px",
      },
      keyframes: {
        pageFade: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200px 0" },
          "100%": { backgroundPosition: "200px 0" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "scale(.6)", opacity: ".4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "page-fade": "pageFade .35s ease",
        "fade-in": "fadeIn .2s ease",
        shimmer: "shimmer 1.3s infinite",
        spin: "spin 1s linear infinite",
        "bounce-dot": "bounceDot 1.2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
