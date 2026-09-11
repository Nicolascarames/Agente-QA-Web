# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-11 (replanteo completo; spec nueva escrita, sin empezar)

Cola priorizada. **Una tarea = una línea.** El detalle vive en la spec.

Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)

---

# EL PLAN — nueve bloques, en este orden

- [ ] **Bloque 1 — La skill y un test verde.** Sin web, sin comando, sin interfaz. Escribir
      `skill/SKILL.md` y sus dos referencias, montar `pruebas/sauce/`, y conseguir desde la terminal
      que tres peticiones distintas den tres tests en verde contra SauceDemo.
      **Es una puerta, no un primer paso**: si no sale, se itera aquí y no se avanza. Si la skill no
      consigue un test verde, los ocho bloques siguientes no valen nada.
- [ ] **Bloque 2 — Vaciar la web.** Borrar `src/catalogo/`, `diffMapa`, `DetalleLocalizador`,
      `Explorar`, `server/mapa.ts`, `server/corridas.ts`, `server/cli.ts`, los tipos de mapa, el
      selector de proyecto y la dependencia del contrato. Crear `shared/eventos.ts` con la constante
      única. Al cerrar: la web arranca y navega con siete pestañas honestas y vacías.
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

## Lo que NO entra

Anotado para que no se cuele por la puerta de atrás:

- **Cucumber real.** El Gherkin es documento más `test.step`.
- **Multi-proyecto.** Una instancia por repo. Sin lista, sin selector, sin recientes.
- **Otros proveedores de LLM.** Solo Claude. El hueco queda hecho en `agente.ts`.
- **Codex y Copilot desde la consola de la web.** Se usan en su entorno.
- **Publicar en npm.** Mientras tanto se instala desde GitHub por SHA.
- **Cualquier mapa persistente de la aplicación.** Si se demuestra que el agente pierde tiempo
  reexplorando, se abre una spec para eso con el dato delante. No antes.

---

## Trámites

- [ ] **Este repo no tiene remote.** `git remote -v` sale vacío: hay que crear el repositorio en
      GitHub y enlazarlo antes de poder hacer push.
- [ ] **Este repo no tiene `CLAUDE.md` propio.** El que gobernaba este trabajo vivía en
      `AGENTE-QA-MCP`, que se borra. Hay que escribir uno aquí antes de empezar el Bloque 1 — o
      instalarlo con `/iniciar-claude`.
- [ ] **Borrar los tres repos retirados**: `AGENTE-QA-MCP`, `Agente_QA`, `agente-qa-contract`.
      Nada de esta spec los necesita.

---

## Deuda anotada

Solo lo que sobrevive al Bloque 2. Todo lo demás muere con el código que lo contenía.

- [ ] **El indicador «● en curso» se queda encendido al terminar una ejecución** — efecto de React que
      no limpia al desmontar. Se arregla al rellenar las pestañas.
- [ ] **`operation.completed/stopped/error` escrito a mano en tres sitios** (`server/corridas.ts:73`,
      `src/Explorar.tsx:11`, `src/useCorridaGlobal.ts:6`) — deriva silenciosa esperando a ocurrir. Lo
      cierra el Bloque 2 con `shared/eventos.ts`.
- [ ] **`npm start` roto** — `package.json` apunta a `dist-server/index.js` y `tsc` compila a
      `dist-server/server/index.js`. Lo resuelve el Bloque 3, que reescribe el arranque como `bin`.

---

## Hechas

- [x] **Replanteo completo y spec nueva** (2026-09-11) — diagnóstico de por qué quince specs no dieron
      un solo test, arquitectura de tres capas (código / agente / skill), auditoría de acoplamiento de
      este repo fichero a fichero, y verificación contra documentación oficial de las capacidades del
      Agent SDK (MCP propio, system prompt, permisos, hooks, streaming, suscripción, `plugins`,
      `abortController`). Resultado: la spec de nueve bloques enlazada arriba.
- [x] **Catálogo editorial y guía integrada**, 9 bloques (2026-09-08) — *se retira entero en el
      Bloque 2: estaba atado 1:1 a los subcomandos del CLI que desaparece.*
- [x] **La interfaz web, fiel al standalone** (2026-09-06) — tokens, tipografía y layout, con guard de
      estilos en build. *Es de lo poco que se conserva tal cual.*
- [x] **La interfaz web, primera versión**, 7 bloques (2026-09-05) — cáscara de 8 pestañas,
      Configuración funcional, Explorar en vivo, chat, corrección manual de localizador. *Solo
      sobreviven la cáscara y el estilo.*
