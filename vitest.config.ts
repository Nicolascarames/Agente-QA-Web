import { defineConfig } from "vitest/config";

// Solo servidor y funciones puras: sin navegador. `dist-client/` y `dist-server/`
// se excluyen desde el día uno — es la trampa conocida del repo hermano
// (Agente-QA-MCP/memory.md): el glob por defecto recoge los .test.js compilados
// y tumba la suite entera con un fallo que parece transitorio. `pruebas/` (fuera de
// git, ver ESTADO.md) es un proyecto Playwright aparte con sus propios `*.spec.ts`:
// el glob por defecto de vitest los recoge igual y su `playwright.config.ts` no
// resuelve contra el tsconfig de este repo, tumbando la suite entera con él.
export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules/**", "dist-client/**", "dist-server/**", "pruebas/**"],
  },
});
