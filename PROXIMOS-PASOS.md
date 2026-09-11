# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-11

Cola priorizada. **Una tarea = una línea.** El detalle vive en la spec.

Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)

---

# EL PLAN — nueve bloques, en este orden

- [ ] **Bloque 1 — La skill y un test verde.** Sin web, sin comando, sin interfaz. Escribir
      `skill/SKILL.md` y sus dos referencias, montar `pruebas/sauce/`, y conseguir desde la terminal
      que tres peticiones distintas den tres tests en verde contra SauceDemo.
      **Es una puerta, no un primer paso**: si no sale, se itera aquí y no se avanza.
- [ ] **Bloque 2 — Vaciar la web.** Borrar todo lo que no aparece en la lista de «se conserva» de
      `ESTADO.md`. Crear `shared/eventos.ts` con la constante única de tipos de evento. Al cerrar: la
      web arranca y navega con siete pestañas honestas y vacías.
- [ ] **Bloque 3 — `npx agente-qa` sobre el repo actual.** `bin/agente-qa.mjs`, `server/doctor.ts`,
      lectura de `agente-qa.config.json`. Sin argumentos, sin selector: `cwd` es el proyecto.
- [ ] **Bloque 4 — La consola habla con el agente.** `server/agente.ts` envuelve `query()` del SDK.
      Preguntas con botones vía `canUseTool`, caja de texto libre, y **dos botones distintos** para
      parar e interrumpir.
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

- **Cucumber.** El Gherkin es documento `.feature` más `test.step`. No se quiere, ni ahora ni después.
- **Multi-proyecto.** Una instancia por repo. Sin lista, sin selector, sin recientes.
- **Otros proveedores de LLM.** Solo Claude. El hueco para añadir otro queda hecho en `agente.ts`.
- **Codex y Copilot desde la consola de la web.** Se usan en su entorno; sus resultados sí aparecen
  en la interfaz, porque la web lee la carpeta del repo.

---

## Deuda anotada

**Ninguna.** Todo lo que había apuntado en este repo pertenecía a código que se borra en el Bloque 2
o que reescribe el Bloque 3.

Esta sección arranca vacía a propósito y se llena solo con lo que encontremos construyendo el plan
nuevo.

---

## Trámites

- [ ] **Borrar los tres repos retirados**: `AGENTE-QA-MCP`, `Agente_QA`, `agente-qa-contract`. Nada
      de esta spec los necesita.
