# memory.md — Agente-QA-Web

Cómo trabajar en este repo. Las decisiones de producto viven en la spec, no aquí.

## Trampas conocidas

- **`vitest.config.ts` debe excluir `dist-client/` y `dist-server/`.** Si no, los `.test.js`
  compilados se cuelan en el glob y `npm test` revienta entero con un `TypeError` que parece de
  entorno y no lo es. Ya está excluido; no lo quites.
- **`typescript ^7` no funciona con `typescript-eslint` type-aware.** Fijado a `^6.0.3` a propósito.
- **Dos tsconfig, no uno**: `tsconfig.server.json` (Node, NodeNext) y `tsconfig.app.json` (DOM,
  Bundler). El servidor necesita módulos ESM reales con extensión `.js` en los imports; el frontend
  los resuelve sin extensión vía Vite. `shared/` es neutral y lo importan los dos.

## Correcciones asimiladas

- **No conservar código «porque ya está escrito» sin comprobar a qué está atado.** Al planificar el
  replanteo dije que se rescataban la consola, el canal de eventos y siete pestañas; la auditoría
  redujo eso a siete ficheros. El autocompletado de la consola estaba atado 1:1 a los subcomandos de
  un CLI que desaparece. Antes de poner algo en la columna «se conserva», comprobar sus imports.
- **Verificar la premisa técnica de una opción ANTES de ponerla sobre la mesa.** Afirmé que una
  herramienta local que usa el Claude Code del propio usuario queda fuera de la restricción de
  Anthropic sobre el login de claude.ai; la documentación no distingue ese caso. Era razonamiento
  mío presentado como hecho.
- **Una conclusión medida con el sistema roto no sobrevive al sistema nuevo.** El orden de
  localizadores tenía `getByTestId` primero porque el sistema anterior midió `getByRole` contra seis
  botones gemelos sin saber acotar por el contenedor padre. Con esa técnica disponible, la medición
  no vale y `getByRole` vuelve al primer puesto.
