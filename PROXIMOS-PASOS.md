# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-13 (progreso en vivo al ejecutar, asistente de primer arranque, pestaña
«Empezar», y ocho fallos corregidos tras probar la app entera contra SauceDemo real)

Cola priorizada. **Una tarea = una línea.** El detalle vive en la spec.

Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)

## Dónde lo dejamos (2026-09-13)

El plan de nueve bloques y la instalación guiada están cerrados, y la app se probó entera contra
SauceDemo real: el ciclo frase → `.feature` → page object → `.spec.ts` → verde funciona de punta a
punta. **Lo único grande que queda es publicar en npm** (Pieza 3 de su spec: los dos workflows y los
cuatro pasos manuales). Antes de tocar eso hay que decidir una cosa que está a medias:
`package.json` dice hoy `qa-web-agent` / `0.1.0` y la spec decide `agente-qa` / `1.0.0`. npm liberó
el nombre `agente-qa` el 2026-09-13 sobre las 13:26 (hora peninsular); las versiones `0.1.0`–`0.1.6`
de ese nombre no se pueden reutilizar nunca.

Lo demás de la lista es deuda menor, ninguna bloquea nada.

---

# EL PLAN — nueve bloques, en este orden

- [x] **Bloque 1 — La skill y un test verde.** Cerrado 2026-09-11. `skill/SKILL.md` y sus dos
      referencias escritos; `pruebas/sauce/` monta Playwright contra SauceDemo real. Tres
      peticiones distintas, tres tests verdes a la primera, estables en dos ejecuciones. Detalle
      en `ESTADO.md`.
- [x] **Bloque 2 — Vaciar la web.** Cerrado 2026-09-11. Catálogo/mapa/CLI antiguo y la "guía
      integrada" no listada en la spec, fuera; `agente-qa-contract` retirada del todo;
      `shared/eventos.ts` creado. Siete pestañas navegan vacías, incluida Configuración. Detalle en
      `ESTADO.md`.
- [x] **Bloque 3 — `npx agente-qa` sobre el repo actual.** Cerrado 2026-09-11. `bin/agente-qa.mjs`,
      `server/doctor.ts` (cuatro comprobaciones), `agente-qa.config.json` en la raíz (`server/proyecto.ts`).
      Probado a mano desde `pruebas/sauce/`: crea el config preguntando la URL, levanta la web
      mostrando ese repo, no repregunta en la segunda ejecución, y `doctor` da el comando exacto
      cuando falta Playwright. De paso se purgó entero el sistema de configuración anterior
      (`server/config.ts`/`claves.ts`/`entornoMcp.ts`, rutas `/api/init|config/proyecto|claves`) —
      decisión explícita del usuario de no heredar nada. Detalle en `ESTADO.md`.
- [x] **Bloque 4 — La consola habla con el agente.** Cerrado 2026-09-11. `server/agente.ts` envuelve
      `query()` en modo streaming-input; `canUseTool` da botones + texto libre para `AskUserQuestion`
      (respondida vía `{behavior:"deny", message:...}`, único canal que funciona de verdad); botones
      Parar/Interrumpir; SSE con un suscriptor independiente por conexión. `skill/` reestructurada
      como plugin del SDK. Probado con dos peticiones reales contra `pruebas/sauce/` (una directa,
      una ambigua con pregunta respondida y verificada en el siguiente turno) y 40 tests. Detalle y
      hechos del SDK que no estaban documentados en ningún sitio, en `ESTADO.md`.
- [x] **Bloque 5 — La barrera de escrituras y los secretos.** Cerrado 2026-09-11. `server/barrera.ts`
      (puro, testeado) más su uso en `canUseTool` (`server/agente.ts`) — no un hook `PreToolUse`
      nativo del SDK, sin probar en modo headless; se reutilizó el canal ya validado en el Bloque 4.
      Interruptor + lista blanca reales en Configuración (`GET/POST /api/config`). Redacción de
      secretos en toda emisión del difusor. Detalle en `ESTADO.md`.
- [x] **Bloque 6 — Gherkin editable y visor de diff.** Cerrado 2026-09-11. `server/git.ts` (diff/
      commit/descartar vía `git` del sistema, sin dependencias nuevas); Redactar y Generar con datos
      reales de `tests/{features,pages,specs}/`. Hallazgo de revisión corregido antes de integrar:
      `GET/PUT /api/escenarios/:nombre` no saneaba el parámetro de ruta (path traversal, lectura/
      escritura de fichero arbitrario) — ahora rechaza cualquier `nombre` que no sea un fichero
      `.feature` suelto, con test de regresión. Detalle en `ESTADO.md`.
- [x] **Bloque 7 — Ejecutar y Reparar con datos reales.** Cerrado 2026-09-11. `server/reporter.ts`
      lee `test-results/results.json` (convención asumida, sin `playwright.config.ts` de referencia
      en este repo — **verificar contra un proyecto real la primera vez que se use en serio**).
      `sugerirVeredicto` es solo la etiqueta del badge en Reparar, nunca un juez. Detalle en `ESTADO.md`.
- [x] **Bloque 8 — Reports, Dashboard y trazabilidad.** Cerrado 2026-09-12. `server/trazabilidad.ts`
      cruza cada `Escenario:` del `.feature` con los `test.step` del `.spec.ts` homónimo (mismo nombre
      base) por igualdad exacta de secuencia; `no-cubierto` si falta el spec, `desincronizado` si
      existe pero ningún bloque calza. `server/costes.ts` acumula coste/duración/turnos por ejecución
      en `agente-qa.historial.json` (recorte a 200 entradas), enganchado en `server/agente.ts` tras
      cada `operation.completed`/`operation.error`. `server/fragiles.ts` cuenta los comentarios
      `// FRÁGIL:` reales que ya escribe la skill. Dashboard con seis cajas nuevas, Reports con datos
      reales (pass rate, flaky, fallos agrupados, historial), Redactar con badge de cobertura por
      fichero. Detalle en `ESTADO.md`.
- [x] **Bloque 9 — El comando `instalar`.** Cerrado 2026-09-12. `npx agente-qa instalar` genera desde
      `skill/skills/qa/SKILL.md`: `.claude/skills/qa/` (con sus referencias), `AGENTS.md` y
      `.github/copilot-instructions.md`. Pregunta antes de sobrescribir un fichero ajeno (detectado
      por un marcador de propiedad), y no pregunta si no hay terminal interactiva (evita colgarse en
      CI). `--solo claude|codex|copilot` para escribir solo uno. Detalle en `ESTADO.md`.

**Plan de nueve bloques completo.** Queda lo de después del plan y los trámites, más abajo.

---

## Después del plan

- [x] **Continuidad de conversación y consola única.** Cerrado 2026-09-12. `server/agente.ts`/
      `server/app.ts`: `resume` del SDK reanuda el hilo anterior (bug real corregido: el agente
      perdía el contexto en cuanto terminaba un turno con una pregunta en texto plano). Se quitó el
      chat propio de Redactar/Generar/Ejecutar/Reparar y la barra deshabilitada de Ejecutar/Reparar:
      toda la conversación vive solo en la consola global (`src/ConsolaGlobal.tsx`), que ahora
      además muestra tu propio mensaje al instante, narración legible del agente (no JSON en bruto),
      indicador de "trabajando" y un bloque resaltado al terminar el turno. Verificado en vivo contra
      `pruebas/sauce/`: dos mensajes seguidos, el segundo recuerda el primero. Detalle en `ESTADO.md`.
- [x] **Contenido crudo editable en Generar y Reparar, no solo diff.** Cerrado 2026-09-12. Bug
      reportado por el usuario: si un `.page.ts`/`.spec.ts` coincidía con el commit, esas pestañas
      solo mostraban "sin cambios pendientes" sin enseñar el fichero. `GET/PUT
      /api/generados/contenido?ruta=` + `<textarea>` editable, igual patrón que ya tenía Redactar
      para `.feature`. De paso, contenido y diff se piden por separado (no con `Promise.all`) para
      que un diff roto no bloquee ver/editar el fichero — verificado en vivo: `git.diff` falla en
      `pruebas/sauce/` porque ese proyecto está fuera de git a propósito. Detalle en `ESTADO.md`.
- [x] **`npm run dev` no arrancaba el backend de forma fiable en Windows.** Cerrado 2026-09-12. Bug
      real reportado por el usuario (`/api/estado respondió 500`, luego `ECONNREFUSED`), no solo
      procesos zombis: `concurrently` lanzando `tsx watch server/index.ts` con `stdio: "pipe"` nunca
      arrancaba el proceso hijo que `tsx watch` respawnea, sin error visible. `scripts/dev.mjs`
      reescrito sin `concurrently` (retirada de `package.json`): dos `spawn` directos con
      `stdio: "inherit"`, verificado 3/3 con `npm run dev` real. Detalle en `ESTADO.md`.
- [x] **Título del test = fichero, ejecutar tests desde Ejecutar, pasos+código juntos.** Cerrado
      2026-09-12. Pedido por el usuario: el detalle de Ejecutar ya mostraba el `.spec.ts` en pequeño,
      ahora es el título del panel; botón ▶ por fila y "Ejecutar todos" lanzan Playwright de verdad
      (`server/ejecutorTests.ts`, `POST /api/tests/ejecutar`); el código del spec se ve junto a los
      pasos del Gherkin, sin cambiar de pestaña. Detalle en `ESTADO.md`.
- [x] **Configuración: URL editable, credenciales de prueba, diagnóstico del doctor.** Cerrado
      2026-09-12. Pedido por el usuario ("todo lo que sea configurable... todo lo que mira doctor").
      `appUrl` ganó control propio; nuevo fichero `agente-qa.credenciales.json` (nunca versionado,
      `.gitignore` del proyecto destino actualizado solo) para usuario/contraseña o cualquier
      variable libre, redactada del chat igual que un secreto; `GET /api/doctor` expone las cuatro
      comprobaciones ya existentes. Detalle en `ESTADO.md`.
- [x] **Redactar/Generar no refrescaban su lista tras generar desde la consola.** Cerrado 2026-09-12.
      Bug real reportado por el usuario. Fix: recargan al detectar que `corridaActiva` pasó de un id
      a `null` (fin de turno). Detalle en `ESTADO.md`.
- [x] **Consola: scroll automático, respuestas en verde, preguntas con teclado.** Cerrado 2026-09-12.
      Pedido por el usuario, estilo Claude Code: el chat baja solo al último evento; texto del agente
      en verde claro; las opciones de `AskUserQuestion` se eligen con flechas/dígitos + Enter además
      de click, con la primera como opción por defecto. Detalle en `ESTADO.md`.
- [x] **Instalación guiada: el asistente de primer arranque y la pestaña «Empezar».** Cerrado
      2026-09-13. Piezas 2 y 4 de
      [`docs/superpowers/specs/2026-09-12-instalacion-guiada-y-publicacion.md`](docs/superpowers/specs/2026-09-12-instalacion-guiada-y-publicacion.md):
      `server/asistente.ts` (IO inyectable, 9 pasos en el repo del usuario y 4 para desarrollar este,
      idempotente, sin preguntar si no hay TTY); `npx agente-qa` sin config asiste y luego levanta la
      web; `npx agente-qa iniciar` y `npm run empezar` lo repiten; README reordenado. Además, pedido
      por el usuario y fuera de la spec: octava pestaña **Empezar** en la web (estado de preparación
      en vivo, tres primeros pasos con botón que escribe el ejemplo en la consola, qué hace cada
      pestaña), auto-seleccionada la primera vez y descartable. Detalle en `ESTADO.md`.
- [x] **Ocho fallos encontrados probando la app entera en vivo.** Cerrado 2026-09-13. La consola
      volcaba JSON crudo y duplicaba el mensaje final; Dashboard y Reports arrastraban tres paneles
      del sistema retirado; ejecutar tests desde la web no entraba en el historial; el fichero de
      setup de Playwright daba 400; faltaba el favicon. Detalle en `ESTADO.md`.
- [ ] **Publicar en npm** — Piezas 1 y 3 de la spec de instalación guiada. La 1 (empaquetado) está
      hecha; falta la 3: `.github/workflows/ci.yml` y `publicar.yml`, más los cuatro pasos manuales
      (esperar a que npm libere el nombre, repo público, publicar la 1.0.0 a mano, configurar el
      trusted publisher). Ojo: `package.json` dice hoy `qa-web-agent` y `0.1.0`; la spec decide
      `agente-qa` y `1.0.0` — hay que cerrar esa discrepancia antes de publicar.

---

## Lo que NO entra

- **Multi-proyecto.** Una instancia por repo. Sin lista, sin selector, sin recientes.
- **Otros proveedores de LLM.** Solo Claude. El hueco para añadir otro queda hecho en `agente.ts`.
- **Codex y Copilot desde la consola de la web.** Se usan en su entorno; sus resultados sí aparecen
  en la interfaz, porque la web lee la carpeta del repo.

---

## Deuda anotada

- [ ] **Snapshot acotado (`browser_find`/`browser_snapshot({target})`) en vez del árbol
      completo — vigilar si compensa con el tiempo.** Cambiado el §2 de
      `skill/skills/qa/SKILL.md` (2026-09-12): medido a mano en `pruebas/sauce/` que un snapshot
      acotado a una fila de producto pesa ~89% menos que el árbol completo (629 vs 5.637 bytes,
      ~4 car./token) y que `browser_find` no siempre trae el `ref` accionable (se corta antes del
      botón; hay que completar con `browser_snapshot({target})`). Medido el mecanismo aislado, no
      una ejecución real de punta a punta: falta ver si acotar esconde algo relevante fuera del
      target (un modal, un banner de cookies) y obliga a más intentos de reparación de los que
      ahorra en tokens. Revisar tras un número real de ejecuciones — si genera más rojos que
      antes, volver a exigir el árbol completo salvo para el caso de "reparar con mensaje de
      error concreto".
      **Primera medida real (2026-09-13)**: un ciclo completo contra SauceDemo (frase → `.feature` →
      page object ampliado → `.spec.ts` → verde) costó $0.42 en 25 turnos y **cero intentos de
      reparación**, verde a la primera. La banda de coste de los ciclos del 12/9 era $0.13–$0.44, así
      que no empeora. **No es concluyente**: no se pudo confirmar desde la consola si el agente llamó
      a `browser_snapshot` con `target` o sin él. Eso ya no bloquea — la consola pinta ahora los
      parámetros de cada herramienta (arreglado el mismo día), así que la próxima ejecución real sí
      es medible. Anotar 3-4 ciclos más y decidir.
- [ ] **El panel de salida en vivo de Ejecutar queda apretado dentro del panel de la lista**, y las
      listas de Redactar/Generar/Ejecutar se cortan en horizontal por debajo de ~1100px de ancho. A
      1440px (el ancho con el que se validó la maqueta) se ve bien. Decisión de diseño pendiente:
      mover la salida en vivo al panel de detalle o dejarla donde está.
- [ ] **El resumen de resultado de herramienta en la consola muestra solo la primera línea.** Un
      `Glob` que devuelve tres ficheros se pinta como `← Glob: tests\pages\login.page.ts`, que se lee
      como si hubiera devuelto uno. Mejor sería contar (`← Glob: 3 resultados`) cuando el resultado
      tiene varias líneas. Cosmético, en `src/ConsolaGlobal.tsx` (`resumenResultadoHerramienta`).
- [ ] **El asistente no puede ayudar a quien aún no ha compilado.** `bin/agente-qa.mjs` importa de
      `dist-server/`, así que el paso «¿está compilado?» de la rama B llega tarde: si falta
      `dist-server/`, el import revienta antes. Hoy no muerde (el hook `prepare` compila en
      `npm install`, y el tarball de npm lleva `dist-server/` dentro), y es preexistente — afecta
      igual a `doctor` e `instalar`. Si alguna vez se rompe el `prepare`, el mensaje de error será
      incomprensible: convendría que `bin/` detecte la ausencia de `dist-server/` y lo diga antes de
      importar nada.
- [ ] **Restos del sistema anterior: `estado`/`obtenerEstado`/`agenteQaInicializado`** (`server/estado.ts`,
      `shared/tipos.ts`). El Dashboard solo usa `/api/estado` para un mensaje de error genérico.
      Revisar si queda algo vivo ahí o se puede borrar como se borraron `/api/actividad` y
      `AccionDeshabilitada` el 2026-09-13.
- [ ] **`doctor` no comprueba el llavero de macOS.** `comprobarCredenciales` (`server/doctor.ts`)
      solo mira el fichero `.credentials.json`; en macOS la sesión puede vivir en el llavero. No se
      implementó `security find-generic-password` porque no hay máquina macOS a mano para verificar
      el nombre exacto del servicio, y adivinarlo daría falsos negativos silenciosos. Verificar y
      completar cuando haya acceso a macOS.
### Cerradas 2026-09-13

- [x] **"Ejecutar todos"/▶ por fila era síncrono, sin progreso en vivo.** `ejecutarPlaywright` trocea
      stdout por líneas (sin ANSI) hacia un difusor propio y `GET /api/tests/eventos` las sirve por
      SSE; la pestaña las pinta según salen. Verificado en vivo: 3 → 14 → 20 líneas en los tres
      primeros segundos de una corrida real. Detalle en `ESTADO.md`.

### Cerradas 2026-09-12

- [x] **`server/reporter.ts` no tenía quién generara `test-results/results.json`.** La skill ahora
      obliga al reporter `json` por variable de entorno. Detalle en `ESTADO.md`.
- [x] **Nombre base compartido `.feature`/`.spec.ts` (trazabilidad), verificado contra proyecto
      real.** Se cumple en los tres pares de `pruebas/sauce/`. Detalle en `ESTADO.md`.
- [x] **`TS5055` en `npm run build` con `dist-server/` preexistente.** `scripts/limpiar-dist-server.mjs`
      antes de `tsc`. Detalle en `ESTADO.md`.

---

## Trámites

- [ ] **Borrar los tres repos retirados**: `AGENTE-QA-MCP`, `Agente_QA`, `agente-qa-contract`. Nada
      de esta spec los necesita.
