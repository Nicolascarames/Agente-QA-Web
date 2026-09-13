# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-12 (plan de nueve bloques completo; tres deudas cerradas; después del plan:
continuidad de conversación, consola única, contenido editable en Generar/Reparar, ejecutar tests
desde la web, credenciales de prueba y diagnóstico del doctor en Configuración)

Cola priorizada. **Una tarea = una línea.** El detalle vive en la spec.

Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)

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
- [ ] **Publicar en npm** — cuando los nueve bloques estén implementados y validados contra webs
      reales. Hasta entonces se instala desde GitHub por SHA. Reservar `agente-qa` al publicar.

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
- [ ] **`doctor` no comprueba el llavero de macOS.** `comprobarCredenciales` (`server/doctor.ts`)
      solo mira el fichero `.credentials.json`; en macOS la sesión puede vivir en el llavero. No se
      implementó `security find-generic-password` porque no hay máquina macOS a mano para verificar
      el nombre exacto del servicio, y adivinarlo daría falsos negativos silenciosos. Verificar y
      completar cuando haya acceso a macOS.
- [ ] **"Ejecutar todos"/▶ por fila en Ejecutar es síncrono, sin progreso en vivo.** `POST
      /api/tests/ejecutar` espera a que Playwright termine y devuelve el resultado entero de una vez
      — no hay streaming paso a paso como en la consola del agente. Aceptable para una suite
      pequeña; una suite grande bloquea la pestaña (spinner) hasta el final. Revisar si compensa
      reusar el difusor de eventos de `server/agente.ts` para dar progreso en vivo.

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
