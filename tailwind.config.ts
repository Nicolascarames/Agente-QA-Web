import type { Config } from "tailwindcss";

// Colores y tipografía leídos de las variables de src/tokens.css (portadas de
// inspiraciones/QA Agent (standalone).html en Agente-QA-MCP), nunca hardcodeados
// sueltos por los componentes.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        text: "var(--color-text)",
        panel: "var(--color-panel)",
        accent: "var(--color-accent)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
