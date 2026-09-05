# memory.md — Agente-QA-Web

Cómo trabajar en este repo. Decisiones de producto viven en la spec de origen
(`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`), no aquí.

## Trampas conocidas

- **`vitest.config.ts` debe excluir `dist-client/` y `dist-server/` desde el día uno.** El repo hermano
  (`Agente-QA-MCP`) tardó en hacerlo y `npm test` reventaba entero con un `TypeError` que parecía
  transitorio pero eran `.test.js` compilados colándose en el glob. Aquí ya está excluido; no lo quites.
- **`typescript ^7` no funciona con `typescript-eslint` type-aware** en este ecosistema — fijado a
  `^6.0.3`, igual que `Agente-QA-MCP` y `agente-qa-contract`.
- **`agente-qa-contract` expone `map.json` en `.agente-qa/map/map.json`, no en la raíz del proyecto.**
  Usa siempre `projectPaths(rootDir)` del contrato para esa ruta (y las de `features/`, `.env`, etc.);
  no la hardcodees a mano en un segundo sitio.
- **Dos tsconfig, no uno**: `tsconfig.server.json` (Node, NodeNext) y `tsconfig.app.json` (DOM,
  Bundler) — el servidor necesita módulos ESM reales con extensión `.js` en los imports; el frontend
  los resuelve sin extensión vía Vite. `shared/tipos.ts` es neutral y lo importan los dos.
- **`npm run dev -- --project <ruta>`** no puede reenviar el flag a los dos procesos que levanta
  `concurrently` sin ambigüedad — se resuelve en `scripts/dev.mjs`, que lo pasa como
  `AGENTE_QA_PROJECT` por entorno. `server/proyecto.ts` lo lee como fallback de `--project`.

## Correcciones asimiladas

(Vacío por ahora — este repo nace en 2026-09-05.)
