# ESTADO — Agente-QA-Web

Actualizado: 2026-09-14 (puertas de confirmación con botones reales: la skill exige `AskUserQuestion`
en vez de prosa, política de puertas configurable en Configuración, la consola salta sola a la
pestaña del fichero, banner "Conversación reanudada" vs "Sesión iniciada" corregido; verificado en
vivo contra una app real. Antes de eso: probado el paquete tal cual se instalaría desde npm — un bug
de seguridad real (la barrera de escrituras nunca se ejecutaba) y credenciales en claro en los
ficheros generados, los dos corregidos; consola con bocadillos y gap; deuda técnica cerrada; snapshot
acotado cerrado con conclusión tras seis ciclos reales)

## Qué es esto

El repo del proyecto entero: la skill, el lanzador del agente y la interfaz.

Te pones en cualquier repo, escribes `npx agente-qa`, pides un test en castellano, y obtienes un
`.feature`, un `.page.ts` y un `.spec.ts` **ejecutados y en verde**.

- Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)
- Cola de trabajo: `PROXIMOS-PASOS.md`

## Las tres capas

| Capa | Qué hace | Dónde |
|---|---|---|
| **Código** | Lanzar, transmitir, pintar, leer ficheros, proteger, commitear | Este repo |
| **Agente** | Mirar, decidir, escribir, ejecutar, corregir, preguntar | Claude Code, embebido por SDK |
| **Skill** | Convenciones, orden de trabajo, qué significa «terminado» | `skill/` |

**Principio que ordena todo**: el código nunca juzga lo que produce el agente. Lo ejecuta, lo enseña,
y el usuario acepta o rechaza. Quien juzga es Playwright, ejecutando el test.

---

## Qué funciona hoy

**Los nueve bloques del plan están cerrados**, y también la instalación guiada. Queda publicar en
npm (Pieza 3 de su spec) y la deuda anotada en `PROXIMOS-PASOS.md`.
`npx agente-qa` (o `node bin/agente-qa.mjs` en local) arranca sobre `process.cwd()`. La primera vez
—cuando no existe `agente-qa.config.json`— corre el asistente, que comprueba Node, sesión de Claude,
binario del SDK y Playwright, pregunta la URL base, el entorno y la barrera, ofrece guardar
credenciales de prueba e instalar la skill, y después levanta la web; a partir de ahí arranca
directo. `npx agente-qa iniciar` repite el asistente a mano y `npm run empezar` hace lo propio para
desarrollar este repo. En la web, la pestaña «Empezar» recoge lo mismo en vivo para quien no ha
leído nada. El subcomando `doctor` comprueba sesión/SDK/Node/Playwright y sale con el
código correspondiente. La consola global lanza el agente de verdad (SDK de Claude Code) sobre el
repo activo: escribes una petición, se ejecuta con Playwright MCP y la skill de QA, y los eventos
llegan por SSE. Un segundo mensaje reanuda la conversación anterior (`resume` del SDK, `session_id`
guardado en memoria): no hace falta repetir el contexto. Redactar, Generar, Ejecutar y Reparar
muestran datos reales del repo (Gherkin/Page Object/spec con contenido completo editable, diff con
aceptar/descartar cuando lo hay, resultados de Playwright) pero **ya no tienen caja de texto
propia** — toda la conversación vive solo en la consola global, a la derecha de la misma ventana;
esas cuatro pestañas son de solo lectura sobre el mismo `eventos`/`corridaActiva` (no tienen chat,
pero sí escriben directamente en los ficheros del repo vía `guardar`). Con la barrera de escrituras
encendida en
Configuración, toda llamada de escritura de Playwright contra una URL fuera de la lista blanca se
deniega y cualquier secreto conocido (variables `PASSWORD`/`SECRET`/`TOKEN`/`KEY`/`CREDENCIAL`) se
redacta antes de salir por el canal de eventos.

| Pieza | Fichero |
|---|---|
| Punto de entrada de `npx agente-qa`: arranca la web sobre `cwd`, subcomando `doctor` | `bin/agente-qa.mjs` |
| Las cuatro comprobaciones del `doctor` (sesión, binario del SDK, Node, Playwright), cada una inyectable para test | `server/doctor.ts` |
| Lectura/escritura de `agente-qa.config.json` en la raíz del repo (`ConfigRaiz`: solo `appUrl` por ahora) | `server/proyecto.ts` |
| La skill de QA completa: rol, orden de trabajo, las tres puertas, definición de terminado | `skill/SKILL.md` |
| Los trece niveles de localizadores y la regla de repetidos, con ejemplo NO/SÍ real | `skill/referencias/localizadores.md` |
| Forma canónica de `.feature`/`.page.ts`/`.spec.ts`, verificada contra SauceDemo real | `skill/referencias/plantillas.md` |
| Tokens de color y tipografía, autocontenidos, fuente propia sin CDN | `src/tokens.css` |
| Guard de estilos en build — falla si el CSS usa una variable no definida | `scripts/comprobar-estilos.mjs` |
| Limpia `dist-server/` antes de compilarlo — evita `TS5055` si queda de un build anterior | `scripts/limpiar-dist-server.mjs` |
| Estructura Fastify + SSE (las rutas, no su contenido); rutas del sistema antiguo retiradas o convertidas en stubs 501 | `server/app.ts` |
| Canal de eventos: `EventoNdjson`, `type` como texto libre a propósito | `shared/tipos.ts` |
| Tipos de evento terminal centralizados, antes duplicados a mano en tres sitios | `shared/eventos.ts` |
| Resolución del proyecto por `--project` → env → `cwd`, sin `agente-qa-contract` | `server/proyecto.ts` |
| La única caja de texto de toda la app: envía/encola peticiones, botones Parar/Interrumpir, eco inmediato de tu propio mensaje, narración legible del agente (texto y `tool_use` extraídos de los mensajes del SDK, no JSON en bruto), indicador "trabajando", bloque resaltado de fin de turno/error, preguntas de `AskUserQuestion` con botones + texto libre | `src/ConsolaGlobal.tsx` |
| El hilo de la consola no se borra entre turnos (se acumula en `eventos` mientras la pestaña siga abierta); `agregarMensajeUsuario` inserta el eco local | `src/useCorridaGlobal.ts` |
| La maqueta y el estilo de siete pestañas; Redactar/Generar/Ejecutar/Reparar ya no montan su propio chat, solo la consola global | `src/App.tsx` |
| Envuelve `query()` del SDK de Claude Code: cola de entrada en modo streaming, difusor de eventos a N suscriptores SSE, `canUseTool` para `AskUserQuestion`, mapeo a los tres eventos terminales, `resume` opcional para reanudar el hilo anterior | `server/agente.ts` |
| Rutas `/api/comando` (lanza o encola), `/api/eventos` (SSE, un suscriptor por conexión), `/api/parar`, `/api/interrumpir`, `/api/pregunta/responder`; estado de la sesión activa y último `session_id` visto en memoria del módulo, pasado como `resume` a la siguiente corrida | `server/app.ts` |
| La skill de QA reestructurada como plugin del SDK (manifiesto + `skills/qa/`), para que `plugins` la cargue sin copiar nada al repo del usuario | `skill/.claude-plugin/plugin.json`, `skill/skills/qa/` |
| Barrera de escrituras: compara cada llamada `mcp__playwright__*` de escritura contra la lista blanca del entorno activo (dentro de `canUseTool`, mismo canal `deny+message` del Bloque 4); redacción de secretos aplicada a toda emisión del difusor de eventos | `server/barrera.ts`, uso en `server/agente.ts` |
| `ConfigRaiz` con `appUrl`/`entorno`/`barrera`/`listaBlanca`, los cuatro editables en el panel "proyecto" de Configuración (después del plan: `appUrl` ganó control propio, antes solo la creaba `npx agente-qa` por terminal); rutas `GET/POST /api/config` | `shared/tipos.ts`, `server/proyecto.ts`, `src/Configuracion.tsx`, `server/app.ts` |
| `diff`/`commit`/`descartar` sobre `tests/{features,pages,specs}/` vía `git` del sistema (sin dependencias nuevas); rutas `/api/escenarios*` y `/api/generados*` | `server/git.ts`, `server/app.ts` |
| Redactar (lista+edición de `.feature`) y Generar (lista, contenido completo editable de `.page.ts`/`.spec.ts`, con el diff debajo para Aceptar/Descartar); sin chat propio, solo lectura sobre el estado que ya trae la consola global | `src/Redactar.tsx`, `src/Generar.tsx` |
| Lectura/escritura de contenido crudo (no diff) de `tests/pages/*.page.ts` y `tests/specs/*.spec.ts`: `GET/PUT /api/generados/contenido?ruta=`, con la misma protección de path traversal que `/api/escenarios/:nombre` (`rutaGeneradaSegura`) | `server/app.ts` |
| Lector fiel del último reporte JSON de Playwright (`test-results/results.json`, verificado de punta a punta contra `pruebas/sauce/`); `sugerirVeredicto` es solo una etiqueta de badge, nunca un juez — la clasificación real la da el agente | `server/reporter.ts` |
Ejecutar (lista con título = `.spec.ts`, botón ▶ por fila y "Ejecutar todos", pasos + código del spec juntos en el detalle) y Reparar (solo los rojos, badge de sugerencia, `.spec.ts` completo editable, diff propuesto con Aplicar/Rechazar); sin chat propio (la `BarraLanzamientoDeshabilitada` del Bloque 5-6 se retiró por no describir la realidad — el botón de ejecutar de hoy es distinto: lanza Playwright de verdad, ver fila de abajo) | `src/Ejecutar.tsx`, `src/Reparar.tsx` |
| Runner real de Playwright desde la web (después del plan): `spawn("npx", ["playwright","test",...])`, `shell:true` en Windows, mismo `PLAYWRIGHT_JSON_OUTPUT_NAME` que ya exigía la skill; ruta de spec validada por regex (`rutaSpecSegura`, sin ella un valor con `;`/`&&` sería inyección de comandos vía shell); ruta `POST /api/tests/ejecutar`, inyectable en tests (`ejecutarFn`) | `server/ejecutorTests.ts`, uso en `server/app.ts` |
| Credenciales de prueba (usuario/contraseña o cualquier variable con nombre libre): fichero aparte de `agente-qa.config.json` a propósito (`agente-qa.credenciales.json`, nunca versionado — `escribirCredenciales` añade sola la entrada al `.gitignore` del proyecto destino la primera vez); llegan al agente por el `system prompt` y al `env` del MCP de Playwright y de la ejecución real de tests; se redactan de la salida por SSE igual que un secreto de `process.env`, sin depender de que el nombre matchee el patrón de secretos | `server/proyecto.ts`, `server/barrera.ts`, `server/agente.ts`, `server/ejecutorTests.ts`, rutas `/api/credenciales` en `server/app.ts`, `src/Configuracion.tsx` |
| Diagnóstico del `doctor` expuesto por API (antes solo por CLI) y mostrado de solo lectura en Configuración | `GET /api/doctor` en `server/app.ts`, `src/Configuracion.tsx` |
| Redactar y Generar recargan su lista sola cuando `corridaActiva` pasa de un id a `null` (fin de turno): antes, un escenario/spec escrito por el agente desde la consola no aparecía hasta recargar la página a mano — bug real reportado por el usuario | `src/Redactar.tsx`, `src/Generar.tsx` |
| Consola: scroll automático al último evento, gap entre líneas, bocadillo verde para el agente (a la izquierda) simétrico al bocadillo naranja del usuario (a la derecha), y las preguntas de `AskUserQuestion` con navegación por teclado (flechas/dígitos + Enter, primera opción con el foco por defecto) además de click | `src/ConsolaGlobal.tsx` |
| Trazabilidad: cruza cada `Escenario:` del `.feature` con los `test.step` del `.spec.ts` homónimo (mismo nombre base), por igualdad exacta de secuencia de frases; cruce con `leerReporte` para el color; ruta `GET /api/trazabilidad` | `server/trazabilidad.ts` |
| Historial de ejecuciones: coste/duración/turnos + resultados por test, acumulado en `agente-qa.historial.json` (recorte a 200), enganchado tras cada `operation.completed`/`operation.error`; ruta `GET /api/historial` | `server/costes.ts`, uso en `server/agente.ts` |
| Elementos frágiles: cuenta los comentarios `// FRÁGIL: <motivo>` reales de la skill en `tests/pages/` y `tests/specs/`; ruta `GET /api/fragiles` | `server/fragiles.ts` |
| Dashboard con seis cajas (escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, frágiles); Reports con datos reales (pass rate, flaky de las últimas 5 ejecuciones, fallos agrupados por `mensajeError`, historial); badge de cobertura por fichero en Redactar | `src/Dashboard.tsx`, `src/Reports.tsx`, `src/Redactar.tsx` |
| `agente-qa instalar`: genera `.claude/skills/qa/` (con referencias), `AGENTS.md` y `.github/copilot-instructions.md` desde `skill/skills/qa/SKILL.md`; marcador de propiedad para no pisar ficheros ajenos sin confirmar; `--solo claude\|codex\|copilot` | `server/instalar.ts`, subcomando en `bin/agente-qa.mjs` |
| Difusor genérico (cola por suscriptor + emisión a todos), sacado de `agente.ts` para poder tener dos canales SSE independientes sin acoplarlos | `server/difusor.ts` |
| Progreso en vivo de Playwright: `ejecutarPlaywright` acepta `onLinea`, trocea stdout por `\r?\n`, quita códigos ANSI y vuelca el resto al cerrar; `POST /api/tests/ejecutar` emite `inicio`/`linea`/`fin` y `GET /api/tests/eventos` los sirve por SSE (no se cierra con evento terminal: se limpia al desconectar el cliente) | `server/ejecutorTests.ts`, `server/app.ts`, `shared/tipos.ts` (`EventoTest`), `src/api.ts`, `src/Ejecutar.tsx` |
| Asistente de primer arranque, IO inyectable como `doctor`/`instalar`: nueve pasos en el repo del usuario, cuatro para desarrollar este; la rama se elige por el `name` del `package.json` del `cwd`; idempotente (cada paso detecta lo ya hecho) y sin preguntar si no hay TTY | `server/asistente.ts`, subcomando `iniciar` en `bin/agente-qa.mjs`, script `empezar` |
| Pestaña «Empezar»: estado de preparación, tres primeros pasos y tabla de pestañas; `decidirPestanaInicial` y `construirTextoEjemplo` son funciones puras testeadas; el botón de ejemplo escribe en la consola vía `borradorConsola`/`onBorradorAplicado` en `App.tsx`, sin acoplar los dos componentes | `src/Empezar.tsx`, `src/App.tsx`, `src/ConsolaGlobal.tsx` |
| Formateo de eventos de la consola: funciones puras (`describirEvento`, `formatearParametrosHerramienta`, `extraerTextoAsistente`, `resumenEventoSistema`, `textoBloqueFinal`) — el andamiaje del SDK no se pinta, las llamadas a herramienta muestran nombre y parámetros, y ningún tipo cae nunca a un volcado JSON | `src/ConsolaGlobal.tsx` |
| Puertas de confirmación con botones (2026-09-14): la skill exige `AskUserQuestion` en cada puerta (§3 de `SKILL.md`), nunca un aviso en prosa; `ConfigRaiz.puertas` (`"escenario"` por defecto — una sola parada y el resto del ciclo sigue solo — o `"escenario-y-codigo"`/`"por-artefacto"`/`"por-fichero"`) se inyecta en el `system prompt` vía `textoPoliticaPuertas`; panel nuevo en Configuración con las cuatro opciones y el coste en tokens de cada parada explicado | `skill/skills/qa/SKILL.md`, `shared/tipos.ts`, `server/puertas.ts`, `server/agente.ts`, `src/Configuracion.tsx` |
| La consola salta sola a la pestaña del fichero cuando llega la pregunta: `rutaUltimoFicheroEscrito` busca hacia atrás el último `Write`/`Edit` de este turno (corta en el `usuario.mensaje` más reciente, no cruza a un turno anterior) que mapee a una pestaña (`pestanaParaRuta`, ignora escrituras que no mapean, p.ej. `tests/setup/*.setup.ts`, y sigue buscando); `App.tsx` conecta `onAbrirPestana` a `setPestana` | `src/pestanaParaRuta.ts`, `src/ConsolaGlobal.tsx`, `src/App.tsx` |
| El banner de la consola distingue sesión nueva de conversación reanudada: `reanudada: boolean` viaja dentro del evento `agente.system` que ya existía (no un evento nuevo), calculado en `agente.ts` a partir de si `opciones.resume` estaba puesto; `resumenEventoSistema` dice «Conversación reanudada» en vez de «Sesión iniciada» | `server/agente.ts`, `src/ConsolaGlobal.tsx` |

Nada de esto se toca por debajo del alcance real necesario para los bloques siguientes.

### Bloque 1 — cómo se validó

`pruebas/sauce/` (fuera de git, desechable) monta Playwright contra `https://www.saucedemo.com`
con login único vía `storageState`. Tres peticiones distintas, siguiendo solo `skill/SKILL.md`,
dieron tres tests verdes a la primera y estables en dos ejecuciones seguidas:

- Añadir un producto al carrito (con pregunta real por `AskUserQuestion` sobre qué producto).
- Login con `locked_out_user` — descubrimos mirando la página que esta versión de SauceDemo no
  expone ningún mensaje de error accesible para este caso (ni texto ni `aria-invalid`); el test
  se escribió contra lo que de verdad se puede comprobar (no se llega al inventario), no contra
  un mensaje inventado. Queda anotado como comentario en el propio test.
- Quitar un producto del carrito tras añadir dos, comprobando que el contador baja.

`skill/` se copia (no symlink, por Windows) a `pruebas/sauce/.claude/skills/qa/` para que un
`claude` lanzado ahí la descubra solo — el mismo mecanismo que generaliza `agente-qa instalar`
(Bloque 9) para cualquier repo destino.

### Las ocho pestañas — qué muestra cada una hoy

| Pestaña | Qué muestra |
|---|---|
| **Empezar** | Estado de preparación en vivo (las cuatro del `doctor` + URL base + credenciales), tres primeros pasos con un botón que escribe la petición de ejemplo en la consola, y qué hace cada pestaña. Auto-seleccionada la primera vez; descartable |
| **Redactar** | Los `.feature`, editables, con badge de cobertura por fichero. La primera puerta: corriges el escenario antes de que se escriba código |
| **Generar** | Los `.page.ts` y `.spec.ts`, contenido completo editable, y debajo el visor de diff con aceptar/descartar cuando hay cambios pendientes |
| **Ejecutar** | Tests con su estado, título = `.spec.ts`, botón ▶ por fila y "Ejecutar todos" (lanza Playwright de verdad), y el detalle junta los pasos del Gherkin con el código del spec |
| **Reparar** | Solo los rojos, con el veredicto: fallo del test o fallo de la aplicación; `.spec.ts` completo editable y diff de corrección propuesto |
| **Reports** | Historial de ejecuciones, fallos agrupados por causa, tests inestables, pass rate, fallos abiertos |
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles |
| **Configuración** | URL base, entorno y barrera de escrituras; credenciales de prueba; diagnóstico en vivo del `doctor`; política de puertas de confirmación (cuántas veces para el agente a pedir tu OK) |

Las ocho son de solo lectura sobre el repo: la única conversación con el agente vive en la consola
global, a la derecha de la misma ventana, no en las pestañas. Pestaña activa (70 % de ancho) y
consola (30 %) están siempre las dos a la vista, sin scroll entre ellas — cada pestaña reserva ese
70 % como el 100 % de su propio lienzo de paneles movibles, así que sus geometrías por defecto (en
Redactar/Generar/Ejecutar/Reparar/Configuración/Dashboard/Reports) no cambiaron, solo el ancho real
que ocupan.

---

## Decisiones cerradas

| Cuestión | Decisión |
|---|---|
| Vocabulario | **Ejecución**, nunca «corrida» |
| Orden de localizadores | Trece niveles con `getByRole` primero. Detalle en la spec |
| Elementos repetidos | `ENTIDAD → PADRE/CONTEXTO → ACCIÓN`. Nunca por índice |
| Gherkin | Documento `.feature` + `test.step` con las mismas frases |
| Alcance | Una instancia por repo. Sin lista de proyectos |
| El fichero ya existe | Ampliar sin pisar métodos. Preguntar solo si hay conflicto real |
| El test no llega a verde | Tres intentos, luego se entrega en rojo con la explicación. Nunca se borra el trabajo |
| Fallo de la aplicación | No se toca nada. Se informa. Es un bug encontrado |
| Proveedor | Solo Claude, por la suscripción del usuario. El hueco para otro queda hecho |
| Convenciones de la skill | Buenas prácticas estándar, afinadas con lo que se rechace |
| Alcance real del Bloque 2 | Más amplio que la lista literal de la spec: se aplicó el criterio de ESTADO.md («todo lo que no está en "se conserva" se borra»). Se borró entera una función de "guía integrada" no listada en la spec (`GuiaPestana`, `CajonFicha`, `FiltrosGuia`, `InsigniasEjes`, `Motor`, `Instalar.tsx`, `src/consola/*`). **Corrección (Bloque 3)**: pese a lo que decía esta fila antes, `src/Configuracion.tsx`, `src/Dashboard.tsx` (botón "ejecutar init") y `/api/init` en `server/app.ts` seguían con lógica completa de un sistema anterior — no se vaciaron en el Bloque 2 pese a que este fichero decía que sí. Se ha corregido de verdad en el Bloque 3 |
| `agente-qa-contract` | Retirada del todo en el Bloque 2, no en el 3/5. La resolución de proyecto se reescribió a mano y mínima en `server/proyecto.ts` |
| Sistema de configuración de proyecto anterior (`server/config.ts`/`claves.ts`/`entornoMcp.ts`, `.agente-qa/config.json` con credenciales/LLM/claves de API) | Pertenecía a una "Spec B" anterior, no a la spec vigente. Decisión explícita del usuario en el Bloque 3: **borrado entero, sin heredar nada** — se reconstruye de cero sobre `agente-qa.config.json` en la raíz (`server/proyecto.ts`), mínimo (solo `appUrl` hoy) |
| `skill/` como plugin (Bloque 4) | `plugins` del SDK exige `.claude-plugin/plugin.json` + `skills/<nombre>/SKILL.md`, no un `SKILL.md` suelto — se movió (`git mv`) de `skill/SKILL.md` a `skill/skills/qa/SKILL.md`. Afecta al Bloque 9 (`instalar`): las rutas de origen que copie ya no son las del Bloque 1 |
| Respuesta a `AskUserQuestion` (Bloque 4) | No hay canal documentado que funcione con `{behavior:"allow", updatedInput:{questions,answers}}` (verificado: el modelo nunca ve la respuesta). Funciona `{behavior:"deny", message:<respuesta formateada>}` — verificado en vivo contra `pruebas/sauce/` |
| Una corrida = una sesión `query()`, no una petición (Bloque 4) | Mensajes escritos mientras hay una corrida activa se encolan en la misma sesión (modo streaming-input) en vez de lanzar una `query()` nueva — necesario porque `Query.interrupt()` solo existe en ese modo y porque Playwright MCP no soporta dos sesiones concurrentes sobre el mismo navegador |
| Barrera de escrituras (Bloque 5): `canUseTool`, no un hook nativo del SDK | El SDK expone `hooks.PreToolUse` pero su interacción con `permissionDecision:"ask"` en modo headless (sin terminal) no está probada en este repo. Se reutilizó `canUseTool` — ya validado en el Bloque 4 para `AskUserQuestion` — añadiendo la comprobación de lista blanca antes de esa rama, con el mismo canal `{behavior:"deny", message}` |
| Fallo del test vs fallo de la aplicación (Bloque 7) | `server/reporter.ts` nunca judge: `sugerirVeredicto` es una heurística de badge (patrones de error típicos de localizador vs de aserción de valor), marcada en la UI como sugerencia. La clasificación real la hace el agente en el chat, coherente con el principio de ESTADO.md de que el código nunca juzga lo que produce el agente |
| Chat propio por pestaña (Bloques 6 y 7) — **revertido después del plan (2026-09-12)** | Redactar/Generar/Ejecutar/Reparar tuvieron cada una su chat ligero (`ChatAgente`/`ChatCorrida`) hasta que, en uso real, confundía dónde escribir (parecía una cuarta caja junto a las dos reales). Se quitaron los cuatro y la `BarraLanzamientoDeshabilitada` con ellos; la única conversación vive en `<ConsolaGlobal>` (banda 2), que sigue montando su propio `<Panel tabId="global" panelId="consola">` |
| Continuidad de la conversación con `resume` (después del plan, 2026-09-12) | Si el agente terminaba un turno con una pregunta en texto plano (no vía `AskUserQuestion`), `server/agente.ts` cerraba la sesión igual que si hubiera acabado de verdad — el siguiente mensaje lanzaba una `query()` nueva sin memoria de nada, verificado en producción (contestar "sí, confirmo" a una propuesta del agente producía "no tengo contexto"). Fix: `server/app.ts` guarda el último `session_id` visto en cualquier evento del difusor (en memoria, se pierde al reiniciar el servidor) y lo pasa como `resume` a la siguiente `lanzar()`. El SDK sí soporta `resume` con `prompt` en modo streaming-input (verificado con un script aislado antes de dar el fix por bueno) — el fallo inicial en pruebas fue un servidor de desarrollo zombi (ver "Hechos verificados"), no el código |
| Contrato `/api/generados/diff\|commit\|descartar` (Bloques 6 y 7) | Fijado por el Bloque 6 (`?ruta=` en el diff, `{rutas: string[], mensaje}` en el commit, `{rutas: string[]}` en el descarte) porque ahí vive `server/git.ts`. El Bloque 7 se implementó en paralelo sin verlo y asumió nombres distintos (`?fichero=`, `{fichero}`) — se corrigió al integrar; si se vuelve a tocar este contrato, `Reparar.tsx` es el único consumidor a revisar |
| Emparejamiento feature↔spec para trazabilidad (Bloque 8) | Por nombre base igual (`X.feature` ↔ `X.spec.ts`), inferido del único ejemplo de `plantillas.md` (`anadir-al-carrito.feature`/`anadir-al-carrito.spec.ts`) — no hay una regla escrita en la spec que lo exija. Si se genera un spec con otro nombre, saldría "no cubierto" pese a existir el test. Anotado en `PROXIMOS-PASOS.md` para verificar contra un proyecto real |
| "Elementos frágiles" del Dashboard (Bloque 8) | Cuenta comentarios `// FRÁGIL: <motivo>` reales (convención ya escrita en `skill/skills/qa/referencias/localizadores.md` desde antes del Bloque 8), no una señal inventada — coherente con el principio de que el código nunca juzga, solo cuenta lo que el agente ya marcó |
| "Tests inestables" en Reports (Bloque 8) | Un test es flaky si, entre las últimas 5 entradas de `agente-qa.historial.json`, aparece tanto en verde como en rojo. El historial se guarda de más antiguo a más nuevo (`server/costes.ts`) — el primer intento del frontend cogió `slice(0, 5)` (las 5 más antiguas de siempre) en vez de `slice(-5)`; corregido en revisión antes de cerrar el bloque |
| Ruta a `skill/` en `instalar.ts` (Bloque 9) | Prueba primero la resolución a dos niveles (`../..`, válida para el código compilado en `dist-server/server/instalar.js`, el caso real de `npx agente-qa instalar`) y cae a un nivel (`..`) solo si esa carpeta no existe — necesario porque los tests de Vitest importan el `.ts` fuente directamente desde `server/`, un nivel menos que el compilado. `server/agente.ts` no necesita este fallback porque solo pasa la ruta a `plugins` del SDK, nunca lee ficheros de ahí él mismo |
| Confirmación antes de sobrescribir en `instalar` (Bloque 9) | Un marcador de propiedad (cadena fija en un comentario HTML) en el fichero generado decide si es "nuestro" (se sobrescribe sin preguntar) o ajeno (pide confirmación). Sin terminal interactiva (`process.stdin.isTTY` falso, p.ej. CI) nunca pregunta: asume que no hay que tocarlo y sigue, para no colgar el proceso |
| Cómo llega `test-results/results.json` a existir (deuda cerrada 2026-09-12) | `server/reporter.ts` siempre asumió esa ruta pero nada la generaba: verificado contra `pruebas/sauce/` (`playwright.config.ts` real, `reporter: 'html'`) que tras `npx playwright test` el fichero **no existe** — `leerReporte` habría devuelto `[]` siempre en cualquier proyecto real, dejando Ejecutar/Reparar/Reports/Dashboard vacíos. Se descartó tocar el `reporter` del `playwright.config.ts` del repo destino (fichero ajeno, ver principio de "Ficheros existentes"); en su lugar `skill/skills/qa/SKILL.md` §4 obliga a `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json` por variable de entorno, que no requiere tocar nada del repo destino. Verificado de punta a punta: ese comando genera el JSON en `pruebas/sauce/`, y `leerReporte`/`cruzarTrazabilidad` reales (ejecutados a mano con `tsx`, no solo leídos) devuelven los cuatro resultados y los tres escenarios "cubierto" con el veredicto correcto |
| Nombre base compartido `.feature`/`.spec.ts` para trazabilidad (deuda cerrada 2026-09-12) | La sospecha del Bloque 8 (regla inferida, no escrita) se verificó contra los tres pares reales de `pruebas/sauce/` (`anadir-al-carrito`, `login-usuario-bloqueado`, `quitar-del-carrito`): la convención se cumple y el cruce de pasos palabra por palabra calza en los tres. Sigue sin estar escrita como regla en la skill — si algún día el agente nombra un spec distinto del feature, ese escenario saldría "no-cubierto" pese a existir el test — pero no bloquea nada con el uso real de hoy |
| `TS5055` en `npm run build` (deuda cerrada 2026-09-12) | Reproducido: `tsc -p tsconfig.server.json` falla con `dist-server/` de un build anterior presente, compila limpio si se borra antes. No es un bug del código servidor, es un build compuesto (`composite: true`) sin limpieza previa. Fix: `scripts/limpiar-dist-server.mjs` (borra `dist-server/`) enganchado en `npm run build` antes de `tsc`. Verificado con dos `npm run build` seguidos, el caso exacto que fallaba |
| Pestaña activa + consola en una sola fila, sin bandas apiladas (2026-09-12) | Las dos bandas verticales (Bloque 3, cada una un viewport completo con botones "↓ Consola"/"↑ Arriba" para saltar entre ellas) se sustituyeron por una única fila en `App.tsx`: pestaña activa a la izquierda (70 % de ancho) y `<ConsolaGlobal>` a la derecha (30 %), mismo alto (viewport menos topbar). Como la geometría de los paneles de cada pestaña es en % de su propio `[data-canvas]` anidado (no del viewport), estrechar ese contenedor al 70 % reescala sola la disposición por defecto de las siete pestañas sin tocar sus ficheros — solo `ConsolaGlobal.tsx` necesitó `flex-wrap` en la fila de botones (Enviar/Parar/Interrumpir), que desbordaba al perder el 70 % de ancho que tenía antes. Verificado en vivo (Playwright) en Dashboard/Redactar/Reports/Ejecutar a 1440px y 1024px: las tres secciones movibles caben siempre sin scroll de página |
| Geometrías por defecto realineadas a un `GAP` único de 1.5 (2026-09-12) | Corrección tras revisar en vivo: varias disposiciones por defecto no llenaban su `[data-canvas]` ni compartían huecos entre sí (Dashboard: las seis cajas de estadística solo ocupaban la mitad izquierda, dejando vacía toda la mitad derecha por encima de "En curso"/"Actividad reciente"; Reports: huecos verticales de 2/4 sin patrón y las dos filas inferiores no llegaban al borde inferior; Redactar/Generar/Ejecutar/Reparar: el panel de detalle acababa en x=99, no en 100; Configuración: huecos de 3 en vez de 1.5; consola: márgenes fijos en px-equivalente `{x:2,y:4,w:96,h:90}` en vez de llenar su lienzo). Redefinidas todas para que cada fila/columna llegue exactamente a 0 y 100 con un único hueco de 1.5 entre paneles — `Dashboard.tsx`/`Reports.tsx` calculan las coordenadas desde una constante `GAP` en vez de llevarlas sueltas. `App.tsx` le dio a la consola el mismo `p-4` + `[data-canvas]` anidado que ya usa cada pestaña, para que su panel (ahora `{x:0,y:0,w:100,h:100}`) quede al mismo margen del borde que los demás. Verificado en vivo (Playwright) en Dashboard/Reports/Configuración/Redactar |
| Contenido crudo de `.page.ts`/`.spec.ts` siempre visible y editable en Generar/Reparar, no solo cuando hay diff (2026-09-12) | Antes, si el fichero coincidía con el commit, Generar/Reparar solo mostraban "sin cambios pendientes" sin enseñar el fichero ni dejar editarlo — bug real reportado por el usuario. Fix: `GET/PUT /api/generados/contenido?ruta=` (`server/app.ts`, validado con `rutaGeneradaSegura` contra `tests/pages/`/`tests/specs/`, mismo patrón que `nombreEscenarioSeguro`) + `<textarea>` editable en `Generar.tsx`/`Reparar.tsx` (`PropuestaDiff`), igual que ya tenía Redactar para `.feature`. El diff sigue debajo, aparte, con Aceptar/Descartar |
| Contenido y diff se piden por separado en Generar/Reparar, no con `Promise.all` (2026-09-12) | Verificado en vivo contra `pruebas/sauce/`: `git.diff` falla con 500 ahí porque ese proyecto está fuera de git a propósito (ver Bloque 1) y `git add -N` resuelve hacia el repo padre, donde `pruebas/` está en `.gitignore`. Con `Promise.all`, ese fallo del diff bloqueaba también la carga del contenido — justo lo que se acababa de arreglar. Cada `fetch` tiene ahora su propio estado de carga/error; un diff roto muestra su propio mensaje sin impedir ver ni editar el fichero |
| `npm run dev` no arrancaba el servidor de forma fiable en Windows — bug real, no solo procesos zombis (2026-09-12) | Reportado por el usuario: tras cerrar los procesos huérfanos, `npm run dev` seguía sin levantar el backend (`ECONNREFUSED`/500 en `/api/*`). Aislado y reproducido de forma determinista (10/10) fuera de este repo: `concurrently` lanzando `tsx watch server/index.ts` con Windows nunca llega a arrancar el proceso hijo que `tsx watch` respawnea en cada cambio — sin error, sin log, sin puerto abierto. La causa no es `concurrently` en sí sino su `stdio: "pipe"` (necesario para prefijar `[vite]`/`[server]`): reproducido el mismo fallo con `spawn` directo y `stdio: "pipe"` + reenvío manual, sin `concurrently` de por medio. Con `stdio: "inherit"` arranca siempre a la primera (3/3 verificado con `npm run dev` real, incluida comprobación en navegador). Fix en `scripts/dev.mjs`: dos `spawn` directos con `stdio: "inherit"`, sin `concurrently` (dependencia retirada de `package.json`). Se pierde el prefijo `[vite]`/`[server]` por línea — los dos procesos comparten la misma consola sin distinguir |
| Credenciales de prueba: fichero aparte de `agente-qa.config.json`, nunca versionado (después del plan, 2026-09-12) | `agente-qa.config.json` SÍ se versiona (decisión del Bloque 3). Guardar ahí una contraseña real las mandaría al historial de git del repo destino en el primer `git add -A` descuidado. Se creó `agente-qa.credenciales.json` aparte, y `escribirCredenciales` (`server/proyecto.ts`) añade la línea al `.gitignore` del proyecto destino la primera vez que se guarda algo — no se puede asumir que ese repo ya la tenga. Además, `redactarSecretos`/`redactarSecretosProfundo` (`server/barrera.ts`) redactaban antes solo valores de `process.env` cuyo NOMBRE matcheaba `PASSWORD\|SECRET\|TOKEN\|KEY\|CREDENCIAL`: una credencial nombrada libremente por el usuario (p.ej. `usuario_admin`) no habría pasado ese filtro. Se añadió un segundo parámetro (`credenciales: Record<string,string>`) que redacta esos valores SIN filtrar por nombre |
| Cómo llegan las credenciales al agente (después del plan, 2026-09-12) | El modelo necesita ver el VALOR para poder escribirlo en un formulario (no hay forma de que `browser_type` rellene "la variable X" sin que el modelo la conozca), así que van también al `system prompt` (`systemPrompt.append` en `server/agente.ts`), no solo al `env` del MCP de Playwright. Lo que protege la redacción de `barrera.ts` es que no salgan en claro por el canal de eventos SSE hacia el navegador — no que el modelo no las vea, las necesita para actuar |
| ~~"Ejecutar todos" / botón por fila en Ejecutar es síncrono, sin progreso en vivo~~ (2026-09-12) — **superado el 2026-09-13** | Era cierto: `POST /api/tests/ejecutar` esperaba a que Playwright terminara y una suite grande dejaba la pestaña con un spinner ciego. Resuelto con el canal SSE propio (ver la fila "Progreso en vivo de los tests"). El POST sigue devolviendo el resultado entero; lo que se añadió es el stream |
| §2 de la skill: snapshot acotado en vez del árbol completo (2026-09-12) | Se descartó construir una "memoria" de localizadores tipo el `map.json` retirado en el Bloque 2 (`agente-qa-contract`/`server/mapa.ts`) — ese caché ya se probó y salió mal: dos fuentes de verdad que se desincronizan. En su lugar, spike medido directamente contra `pruebas/sauce/` (sin correr el agente completo, para no gastar dinero midiendo si se ahorra dinero): un snapshot acotado a una fila de producto (`browser_snapshot({target})`) pesa ~89% menos que el árbol completo (629 vs 5.637 bytes). Hallazgo real: `browser_find` por sí solo no siempre trae el `ref` accionable (corta el contexto antes del botón), así que la vía fiable es `browser_find` para ubicar el contenedor + `browser_snapshot({target})` sobre ese ref. `SKILL.md` §2 reescrito: árbol completo solo la primera vez que se ve una pantalla; acotado para confirmar tras un click, buscar un elemento conocido o reparar un rojo. El principio no cambia: el localizador sigue saliendo de la página real, nunca de un fichero cacheado. **Pendiente de verificar con uso real** si acotar esconde algo relevante y genera más reparaciones de las que ahorra — anotado en `PROXIMOS-PASOS.md` |
| Progreso en vivo de los tests: canal SSE propio, no el difusor del agente (2026-09-13) | Se sacó `crearCola`/`crearDifusor` a `server/difusor.ts` y `POST /api/tests/ejecutar` emite a una instancia aparte. Mezclarlo con el difusor del agente habría metido líneas de Playwright en el hilo de la conversación y obligado a que `/api/eventos` distinguiera dos orígenes. El contrato del POST no cambió: sigue devolviendo el resultado entero, el stream es un añadido. `/api/tests/eventos` no se cierra con evento terminal (una sesión de tests no tiene "fin de conversación"): se limpia cuando el cliente desconecta |
| Node mínimo real: 22, no 18 (2026-09-13) | `server/doctor.ts` fijaba `NODE_MINIMO = 18` mientras `package.json` (`engines`), el README y el paso 1 del asistente exigen 22. Con Node 20 el `doctor` daba un ✅ falso y la app fallaba después por otro sitio. Corregido el mínimo y los dos tests que fijaban el contrato antiguo |
| La consola volcaba JSON crudo y duplicaba el mensaje final (2026-09-13) | Encontrado probando la app entera en vivo, pese a que este fichero afirmaba lo contrario desde el 12/9. Causa 1: `LineaEvento` no tenía rama para `agente.system` ni `agente.user`, así que caían al volcado crudo — incluido el catálogo entero de herramientas MCP del evento `init` y todos los `hook_started` de los hooks del usuario. Causa 2: el mensaje `result` del SDK **repite literalmente el texto final del asistente** (confirmado en los tipos del propio SDK), y se pintaba además de la burbuja ya pintada. Fix en el render, no censurando datos: el andamiaje del SDK se resume o se calla, las llamadas a herramienta muestran nombre y parámetros, el bloque resaltado de cierre se conserva pero dice "Terminado." si el texto ya salió, y un tipo sin rama propia cae a una línea corta — nunca al objeto. Que los parámetros de herramienta se vean era además requisito para poder medir la deuda del snapshot acotado |
| Paneles muertos del sistema retirado, borrados (2026-09-13) | Encontrados en la prueba en vivo: el Dashboard pintaba «En curso ahora» buscando `.agente-qa/` (carpeta borrada entera en el Bloque 3) y «Actividad reciente» con el texto marcador literal `pendiente del Bloque 1: agente-qa-mcp metrics --last N --json` contra `/api/actividad`, un stub 501; Reports reservaba una banda entera para «Filtros» («llegan más adelante»). Borrados los tres con su fetch, su función de `src/api.ts`, la ruta stub y `src/AccionDeshabilitada.tsx` (sin usos tras el borrado), recolocando las geometrías con la regla del `GAP` único |
| Ejecutar tests desde la web sí entra en el historial, con coste 0 (2026-09-13) | Bug real: tras lanzar los cinco tests con "Ejecutar todos", el Dashboard seguía diciendo que la última ejecución era del día anterior, porque `server/costes.ts` solo se enganchaba a `operation.completed`/`error` del agente. Ahora `POST /api/tests/ejecutar` registra también, reusando `registrarEjecucion`. Una corrida lanzada desde la web no pasa por el SDK: se guarda `costeUsd: 0, numTurnos: 0` — honesto; inventar un coste no lo sería. Los `resultados` salen de releer `test-results/results.json`, filtrados al spec pedido cuando se usa el botón ▶ de una fila, para no atribuir tests que no corrieron |
| Prefijo de ruta del spec: la causa estaba en el cliente, no en el reporter (2026-09-13) | `GET /api/generados/contenido?ruta=tests/specs/auth.setup.ts` daba 400 y la pestaña Ejecutar decía "No se pudo cargar el código de este spec". `rutaSpecDesdeFichero` (`src/Ejecutar.tsx`) forzaba `tests/specs/` para cualquier fichero, pero Playwright reporta rutas relativas a `testDir` (`setup/auth.setup.ts`, `specs/x.spec.ts`) y el setup vive en `tests/setup/`. Arreglado el prefijo en el cliente y ampliado `rutaGeneradaSegura` para aceptar `tests/setup/*.setup.ts` **sin aflojar** la protección de path traversal del Bloque 6 — verificado en vivo: el setup da 200, y `evil.ts` y tres formas de traversal siguen dando 400 |
| **La barrera de escrituras nunca se ejecutaba — bug de seguridad real (2026-09-14)** | Encontrado probando el paquete tal cual se instalaría desde npm (`npm pack` + `npm install` en un repo consumidor limpio): `mcp__playwright__*` estaba en `allowedTools` (`server/agente.ts`) como entrada "pelada", y el SDK la auto-aprueba antes de consultar `canUseTool` — confirmado en vivo por el propio aviso `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` del log del servidor, nombrando `mcp__playwright__*`. Es exactamente el mismo problema ya conocido y arreglado para `AskUserQuestion` (ver fila del Bloque 4), pero no se aplicó el mismo arreglo aquí pese a que `canUseTool` sí trae la comprobación de lista blanca de `verificarLlamada` — código muerto que nunca llegaba a ejecutarse. Fix: sacar también `mcp__playwright__*` de `allowedTools` |
| Credenciales en claro en `.feature`/`.spec.ts` generados (2026-09-14) | La causa raíz era la propia plantilla canónica (`skill/skills/qa/referencias/plantillas.md`), que enseñaba `process.env.X ?? 'standard_user'` — el agente copiaba ese patrón literalmente. Verificado leyendo los ficheros en disco tras un ciclo real. La redacción de `barrera.ts` protege el canal SSE hacia el navegador, no lo que se escribe en los ficheros versionados. Fix: plantilla reescrita sin fallback literal (falla con error explícito si falta la variable, no sigue con un secreto hardcodeado) y regla explícita en `SKILL.md` §8: ninguna credencial se escribe en claro, ni en el Gherkin (por rol, no por valor) ni en el spec |
| El escenario debe aparecer en Redactar, editable, antes de escribir Page Objects/spec — parcialmente conseguido el 2026-09-13, **cerrado de verdad el 2026-09-14** | Motivo del "parcialmente": `SKILL.md` §3 pedía escribir el fichero antes de preguntar, pero dejaba a la skill decidir CÓMO preguntar — y el agente seguía usando prosa («revísalo y dime si confirmas»), sin botones, sin salto de pestaña. `AskUserQuestion` opcional no bastaba: hacía falta obligarlo. Fix (spec `2026-09-14-puertas-de-confirmacion-con-botones.md`): `SKILL.md` §3 exige `AskUserQuestion` siempre, nunca texto suelto; la consola salta sola a la pestaña del fichero; la política de cuántas veces para (una, dos, tres o por fichero) es configurable. **Verificado en vivo contra una app real** (no `pruebas/sauce`): tres paradas exactas con la política `por-artefacto`, botones reales en las tres, salto a Redactar y a Generar correcto, test en verde al terminar |
| **Hallazgo del ciclo en vivo (2026-09-14): una skill instalada (`agente-qa instalar` / el asistente) se desincroniza cuando se edita `skill/skills/qa/SKILL.md` en el repo fuente** | El primer intento del ciclo en vivo de la verificación de arriba falló exactamente como el bug que se estaba arreglando (prosa, sin botones) porque `pruebas/babia/.claude/skills/qa/SKILL.md` era una copia de una instalación anterior, sin el fix. `agente.ts` carga el plugin desde el repo fuente (`rutaSkill`), pero el SDK además autodescubre `.claude/skills/` del `cwd` del proyecto activo, y esa copia local gana. No hay mecanismo que la mantenga al día: cada vez que se edite la skill, hay que volver a correr `agente-qa instalar` en cualquier proyecto que ya la tuviera instalada (`pruebas/sauce/`, `pruebas/babia/`, y cualquier repo real donde se haya usado). Anotado en `PROXIMOS-PASOS.md` |
| Consola: gap entre líneas y bocadillo verde para el agente (2026-09-14) | Pedido por el usuario tras verlo en uso: el `<ul>` de eventos no tenía ningún hueco (`gap`) entre `<li>`, así que el bocadillo propio y la respuesta del agente quedaban pegados. `textoAsistente` pasó de ser solo texto verde (`text-ok`) a un bocadillo real (`border-ok bg-ok-bg`, alineado a la izquierda, tokens ya existentes en `tokens.css`/`tailwind.config.ts`), simétrico al del usuario (`border-accent bg-accent-bg`, a la derecha) |
| Deuda técnica cerrada (2026-09-14) | Tres arreglos directos del apartado "Deuda anotada" de `PROXIMOS-PASOS.md`: (1) `resumenResultadoHerramienta` (`ConsolaGlobal.tsx`) contaba mal un resultado de varias líneas (`← Glob: primerFichero` en vez de `← Glob: 3 resultados`) — el test existente afirmaba el bug como correcto, corregido también; (2) `bin/agente-qa.mjs` revienta con un `ERR_MODULE_NOT_FOUND` en crudo si falta `dist-server/`, porque los `import` estáticos se evalúan antes que cualquier comprobación propia (hoisting de ESM) — pasados a `import()` dinámico tras comprobar `existsSync`, verificado renombrando la carpeta a mano; (3) `server/estado.ts`/`obtenerEstado`/`agenteQaInicializado` y `ActividadNoDisponible` eran restos muertos del sistema anterior (comprobaban `.agente-qa/`, `e2e/`, `playwright-report/`, estructura que ya no existe) — el Dashboard solo usaba el fallo para un mensaje de error genérico, nunca los datos; borrado entero (fichero, test, ruta, tipos), las seis cajas de estadística ahora se pintan siempre con su propio error por caja |
| Snapshot acotado — deuda cerrada con conclusión (2026-09-14) | Seis ciclos reales medidos en total (tres del 12-13/9 más tres de hoy, estos últimos incluyendo un flujo largo de checkout con cuatro pantallas nuevas): **6/6 verdes a la primera, cero reparaciones**. En los seis, el agente usó `browser_snapshot` completo solo la primera vez que veía una pantalla (login, inventario, carrito, checkout paso 1, checkout paso 2) y herramientas acotadas (`browser_find`, `browser_snapshot({target})`, y en la práctica también `browser_run_code_unsafe` para leer un atributo concreto) para todo lo demás — nunca al revés. Ningún ciclo mostró síntoma de "algo escondido" (modal, banner) que obligara a reparar. Coste en banda con lo ya medido ($0.10–$0.52; el máximo se explica por cuatro pantallas nuevas en un único ciclo, no por desperdicio). **Decisión: se mantiene snapshot acotado tal cual está en `SKILL.md` §2, sin volver al árbol completo por defecto** |

---

## Hechos verificados que condicionan la arquitectura

Comprobados contra documentación oficial, no de memoria:

- El SDK trae un **binario nativo propio** como dependencia opcional: no hace falta instalar Claude
  Code aparte. Salvo con `npm ci --omit=optional`, que el `doctor` detecta.
- Sin `ANTHROPIC_API_KEY` en el entorno, usa **las credenciales de la suscripción** del usuario
  (`%USERPROFILE%\.claude\.credentials.json` en Windows, llavero en macOS, `~/.claude/` en Linux).
- **No usar `--bare`**: es el modo que la documentación recomienda para scripts y es precisamente el
  que nunca lee esas credenciales.
- **No existe función documentada** para comprobar credenciales antes de lanzar. Hay que construir el
  `doctor`.
- La opción `plugins` carga skills **desde una ruta arbitraria**: para la consola de la web no hay que
  copiar nada al repo del usuario.
- `abortController` para parar. Los mensajes escritos a media ejecución **se encolan** hasta el final
  del turno; para que lleguen ya hay que interrumpir. No hay «háblale mientras trabaja» concurrente.
- Si esto se distribuye o se vende algún día, **hay que preguntar a Anthropic**: la documentación
  prohíbe a terceros ofrecer login de claude.ai en su producto y no distingue el caso de una
  herramienta local. Para uso propio no hay nada que discutir.
- Si `AskUserQuestion` está en `allowedTools`, el SDK la auto-aprueba (`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`)
  sin llamar nunca a `canUseTool` — hay que dejarla fuera de `allowedTools` (y fuera de
  `disallowedTools`) para que caiga en `canUseTool`, único cauce posible en modo SDK/headless (no
  hay terminal donde el usuario responda).
- `abortController.abort()` hace que el `Query` real rechace con "Operation aborted": sin un `catch`
  alrededor de la iteración, esa promesa rechazada escapa como *unhandled rejection* y tumba el
  proceso Node entero del servidor, no solo la ejecución en curso.
- **Los worktrees aislados (`isolation: "worktree"` del subagente) en esta máquina pueden crearse
  anclados a un commit viejo de `main`, no a la punta actual** — pasó dos veces seguidas al
  despachar los Bloques 5/6/7 en paralelo, con un worktree hasta 8 commits detrás (código de antes
  del Bloque 2, con `agente-qa-contract`/`src/Explorar.tsx` que ya no existen). Cualquier trabajo
  despachado a un worktree debe empezar comprobando `git log -1` contra el `main` real y haciendo
  `git merge --ff-only main` si no coincide, antes de leer o tocar nada. Además, un worktree sin
  commitear puede desaparecer solo (limpieza automática del harness) aunque el agente haya hecho
  cambios reales: hay que commitear dentro del propio worktree en cuanto el trabajo esté verificado,
  no confiar en que el directorio sobreviva hasta la fusión.
- **Tres agentes en paralelo sin worktree (mismo árbol de trabajo, ficheros disjuntos) pueden pisarse
  igualmente si uno de ellos ejecuta `git stash`/`git reset`** al toparse con conflictos aparentes:
  un `git stash` de "por si acaso" agarra TODO lo no comiteado, incluido el trabajo en curso de los
  otros dos agentes, no solo el suyo. Pasó real al despachar el fix de `resume` + la consola única +
  la limpieza de pestañas (2026-09-12): dos `git reset` de por medio borraron el arreglo del backend
  ya verificado. Se detectó por `git log -g` (dos entradas seguidas "reset: moving to HEAD" sin
  commit real entre medias) y se recuperó a mano. Regla para subagentes que comparten árbol de
  trabajo: nunca `git stash`/`git reset`/`git checkout -- <todo>` para "limpiar" un conflicto —
  identificar el fichero propio y tocar solo ese.
- **Un `npm run dev` puede quedarse zombi tras muchos reinicios seguidos en una sesión larga**:
  sigue "abierto" como proceso pero ya no escucha en ningún puerto ni imprime nada — señal de alarma:
  cero líneas de log del lado servidor durante varios minutos con actividad real. Solución siempre
  igual: matar los procesos Node huérfanos (`Get-Process node | Stop-Process -Force` en Windows) y
  relanzar limpio.
- **`concurrently` lanzando `tsx watch server/index.ts` en Windows tenía un bug real, no solo
  zombis** (corregido 2026-09-12): con `stdio: "pipe"` (el modo que usaba `concurrently` para poder
  prefijar `[vite]`/`[server]`), el proceso hijo que `tsx watch` respawnea en cada cambio nunca
  llegaba a arrancar — sin error, sin log, sin puerto abierto, de forma determinista (10/10
  reproducido aislado). `npx tsx watch server/index.ts` suelto, con `stdio` heredado de una consola
  real, arrancaba siempre a la primera. `scripts/dev.mjs` ya no usa `concurrently`: dos `spawn`
  directos con `stdio: "inherit"` — se pierde el prefijo por proceso, pero arranca siempre.

### El agente — cómo se implementó (Bloque 4)

`server/agente.ts` envuelve `query()` en modo streaming-input (una cola push de `SDKUserMessage`,
no un string suelto) porque `Query.interrupt()` solo funciona así y porque el propio CLI ya sabe
encolar turnos de usuario que llegan mientras hay uno en marcha (`SDKResultMessage.queued_turn_count`
— no hay que reimplementar esa cola). `SesionAgente.eventos` es un difusor (`crearDifusor`):
`suscribirse()` da a cada conexión SSE su propia cola independiente y cada evento se emite a
todos los suscriptores activos, porque `EventSource` del navegador reconecta solo tras cualquier
corte de red y dos conexiones no pueden repartirse un único cursor compartido. La ruta al plugin
`skill/` se resuelve desde `import.meta.url` con dos `..` (el fichero compilado vive en
`dist-server/server/agente.js`, dos niveles bajo la raíz del repo — `tsconfig.server.json` no fija
`rootDir` y preserva la estructura de carpetas).

**Corregido tras el cierre del bloque**: `server/app.ts` calculaba `distClient` con un `..` de
menos (`path.resolve(dirActual, "..", "dist-client")`), el mismo error que tenía `agente.ts` antes
de corregirse en este bloque. Confirmado real, no solo teórico: `bin/agente-qa.mjs` importa
directamente de `dist-server/server/app.js` (el camino real de `npx agente-qa`, no solo de tests),
así que en el build compilado `existsSync` fallaba en silencio, `fastifyStatic` nunca se registraba
y la web no se servía. Arreglado a `path.resolve(dirActual, "..", "..", "dist-client")`, verificado
levantando el servidor compilado de verdad (`node bin/agente-qa.mjs` desde `pruebas/sauce/`,
`GET /` → 200).

### El `doctor` — cómo se implementó (Bloque 3)

`server/doctor.ts` hace las cuatro comprobaciones de la spec, cada una con parámetros inyectables
para poder testearlas sin depender de la máquina real. El binario nativo del SDK se localiza
resolviendo el paquete opcional por plataforma (`@anthropic-ai/claude-agent-sdk-<plataforma>-<arco>`,
con sufijo `-musl` en Linux) y comprobando que el ejecutable (`claude`/`claude.exe`) existe junto a
su `package.json` — comprobado instalando el SDK de verdad e inspeccionando `node_modules/`.

**Deuda conocida**: la comprobación de sesión solo mira el fichero (`.credentials.json`, con
`CLAUDE_CONFIG_DIR` si está definida) en las tres plataformas. En macOS la sesión puede vivir en el
llavero en vez de en ese fichero — no se implementa el `security find-generic-password` real porque
no hay forma de verificar aquí el nombre exacto del servicio sin una máquina macOS a mano, y
adivinarlo daría falsos negativos silenciosos. Queda en `PROXIMOS-PASOS.md`.

---

## Verificación

`npm run lint` / `typecheck` / `test` / `build`. El guard `comprobar-estilos.mjs` corre tras
`vite build` y no se toca.
