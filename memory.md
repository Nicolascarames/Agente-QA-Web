# memory.md — Agente-QA-Web

Cómo trabajar en este repo. Las decisiones de producto viven en la spec, no aquí.

## Trampas conocidas

- **Subagentes que comparten árbol de trabajo (sin worktree) nunca deben ejecutar `git
  stash`/`git reset`/`git checkout -- <todo>` para "limpiar" un conflicto.** Arrastra también el
  trabajo en curso de los demás. Si algo de otro fichero estorba, se ignora — solo se toca el
  fichero propio del brief.
- **Un `npm run dev` puede quedarse zombi tras muchos reinicios seguidos** (sirve por el puerto pero
  ya no recompila ni imprime nada por su lado servidor). Si algo que debería funcionar no cambia de
  comportamiento en el navegador, sospechar del proceso antes que del código: matar por puerto y
  relanzar limpio.
- **`vitest.config.ts` debe excluir `dist-client/` y `dist-server/`.** Si no, los `.test.js`
  compilados se cuelan en el glob y `npm test` revienta entero con un `TypeError` que parece de
  entorno y no lo es. Ya está excluido; no lo quites.
- **`typescript ^7` no funciona con `typescript-eslint` type-aware.** Fijado a `^6.0.3` a propósito.
- **Dos tsconfig, no uno**: `tsconfig.server.json` (Node, NodeNext) y `tsconfig.app.json` (DOM,
  Bundler). El servidor necesita módulos ESM reales con extensión `.js` en los imports; el frontend
  los resuelve sin extensión vía Vite. `shared/` es neutral y lo importan los dos.
- **El banner «Sesión iniciada — modelo X, N herramientas» se pinta igual en una sesión reanudada**,
  así que no prueba que se haya perdido el contexto. Para saber si `resume` funcionó de verdad,
  contar los `.jsonl` de `~/.claude/projects/<cwd-con-guiones>/`: uno solo = misma sesión.

## Correcciones asimiladas

- **«Lo que NO entra» es para alcance que alguien podría añadir por error, no para nombrar cosas
  ajenas al plan.** Corregido dos veces: el mapa del sistema anterior y Cucumber. Si la decisión
  positiva ya está escrita («el Gherkin es documento más `test.step`»), listar además la alternativa
  descartada solo la mantiene viva. Antes de añadir una línea ahí, comprobar que no está dicho ya en
  positivo.
- **No conservar código «porque ya está escrito» sin comprobar a qué está atado.** Al planificar el
  replanteo dije que se rescataban la consola, el canal de eventos y siete pestañas; la auditoría
  redujo eso a siete ficheros. El autocompletado de la consola estaba atado 1:1 a los subcomandos de
  un CLI que desaparece. Antes de poner algo en la columna «se conserva», comprobar sus imports.
- **Verificar la premisa técnica de una opción ANTES de ponerla sobre la mesa.** Afirmé que una
  herramienta local que usa el Claude Code del propio usuario queda fuera de la restricción de
  Anthropic sobre el login de claude.ai; la documentación no distingue ese caso. Era razonamiento
  mío presentado como hecho.
- **Lo que `ESTADO.md` afirma de la interfaz no es prueba de que la interfaz lo haga.** Decía desde
  el 12/9 que la consola daba «narración legible, no JSON en bruto»; la primera vez que se abrió el
  navegador y se lanzó una petición real, volcaba el catálogo entero de herramientas MCP y un
  `hook_started` por hook. Un comportamiento de UI solo se da por bueno viéndolo en vivo; escribirlo
  en `ESTADO.md` no lo verifica.
- **El valor por defecto es siempre la mínima interrupción: una parada y el flujo sigue solo hasta
  el final.** Al ofrecer opciones de fricción (cuántos cortes, cuántas confirmaciones) propuse tres
  que paraban 2, 3 y 6 veces, y faltaba justo la de parar una sola vez. Ofrecer más control no es
  ofrecer mejor opción por defecto: la que se marca por defecto es la que menos interrumpe, y las
  demás quedan disponibles para quien las quiera.
- **Cada fichero que genere el agente se revisa en su pestaña y se confirma con un botón, nunca
  pidiendo confirmación en prosa.** Sin botón no hay puerta: el usuario ve «dime si confirmas», el
  turno se cierra con «Terminado.» y parece que la app se ha roto. Aplica a `.feature`, `.page.ts`,
  `.spec.ts` y a cualquier artefacto futuro; si se toca `SKILL.md` §3 o la consola, la confirmación
  va por `AskUserQuestion` con la pestaña correspondiente abierta y el contenido a la vista.
- **Una conclusión medida con el sistema roto no sobrevive al sistema nuevo.** El orden de
  localizadores tenía `getByTestId` primero porque el sistema anterior midió `getByRole` contra seis
  botones gemelos sin saber acotar por el contenedor padre. Con esa técnica disponible, la medición
  no vale y `getByRole` vuelve al primer puesto.
