# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-11 (Bloque 4 cerrado)

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
- [ ] **Bloque 5 — La barrera de escrituras y los secretos.** Hook `PreToolUse`, escrito desde cero.
      Interruptor por repo. Lo que permite apuntar a una aplicación real.
- [ ] **Bloque 6 — Gherkin editable y visor de diff.** Las dos puertas donde decide el usuario:
      corregir el escenario antes de que se escriba código, y aceptar o descartar el diff.
- [ ] **Bloque 7 — Ejecutar y Reparar con datos reales.** Lector del reporter JSON de Playwright y la
      distinción fallo-del-test / fallo-de-la-aplicación, esta última cubierta por test unitario.
- [ ] **Bloque 8 — Reports, Dashboard y trazabilidad.** Cruce de pasos del `.feature` con los
      `test.step`. Escenarios no cubiertos y desincronizados. Coste leído del SDK, sin base de datos.
- [ ] **Bloque 9 — El comando `instalar`.** Genera los envoltorios para Claude Code en terminal,
      Codex y Copilot desde el mismo `SKILL.md`. Para la consola de la web no hace falta.

Los bloques 5, 6 y 7 son independientes entre sí: se pueden despachar en paralelo una vez cerrado
el 4.

---

## Después del plan

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

- [ ] **`doctor` no comprueba el llavero de macOS.** `comprobarCredenciales` (`server/doctor.ts`)
      solo mira el fichero `.credentials.json`; en macOS la sesión puede vivir en el llavero. No se
      implementó `security find-generic-password` porque no hay máquina macOS a mano para verificar
      el nombre exacto del servicio, y adivinarlo daría falsos negativos silenciosos. Verificar y
      completar cuando haya acceso a macOS.
- [ ] **Bloque 9 (`instalar`) copiará desde la ruta nueva de la skill.** El Bloque 4 movió
      `skill/SKILL.md` a `skill/skills/qa/SKILL.md` (formato de plugin). Cuando se implemente el
      Bloque 9, usar esa ruta, no la antigua.

---

## Trámites

- [ ] **Borrar los tres repos retirados**: `AGENTE-QA-MCP`, `Agente_QA`, `agente-qa-contract`. Nada
      de esta spec los necesita.
