# ESTADO — Agente-QA-Web

Actualizado: 2026-09-12 (plan de nueve bloques completo; tres deudas cerradas: reporter JSON, trazabilidad de nombres, `TS5055` en build)

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

**Los nueve bloques del plan están cerrados.** Queda lo de después del plan (publicar en npm,
gated a validar contra webs reales) y la deuda anotada en `PROXIMOS-PASOS.md`.
`npx agente-qa` (o `node bin/agente-qa.mjs` en local) arranca sobre `process.cwd()`, crea
`agente-qa.config.json` en la raíz preguntando solo la URL base si no existe, y levanta la web
mostrando ese repo. El subcomando `doctor` comprueba sesión/SDK/Node/Playwright y sale con el
código correspondiente. La consola global lanza el agente de verdad (SDK de Claude Code) sobre el
repo activo: escribes una petición, se ejecuta con Playwright MCP y la skill de QA, y los eventos
llegan por SSE. Redactar, Generar, Ejecutar y Reparar muestran datos reales del repo (Gherkin
editable, diff con aceptar/descartar, resultados de Playwright), cada una con su propio chat que
comparte la misma sesión de la consola global. Con la barrera de escrituras encendida en
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
| La caja de texto de la consola, conectada al agente: envía/encola peticiones, botones Parar/Interrumpir, renderiza preguntas del agente con botones + texto libre | `src/ConsolaGlobal.tsx` |
| La maqueta y el estilo de siete pestañas, todas vacías salvo la consola (Configuración incluida) | `src/App.tsx` |
| Envuelve `query()` del SDK de Claude Code: cola de entrada en modo streaming, difusor de eventos a N suscriptores SSE, `canUseTool` para `AskUserQuestion`, mapeo a los tres eventos terminales | `server/agente.ts` |
| Rutas `/api/comando` (lanza o encola), `/api/eventos` (SSE, un suscriptor por conexión), `/api/parar`, `/api/interrumpir`, `/api/pregunta/responder`; estado de la sesión activa en memoria del módulo | `server/app.ts` |
| La skill de QA reestructurada como plugin del SDK (manifiesto + `skills/qa/`), para que `plugins` la cargue sin copiar nada al repo del usuario | `skill/.claude-plugin/plugin.json`, `skill/skills/qa/` |
| Barrera de escrituras: compara cada llamada `mcp__playwright__*` de escritura contra la lista blanca del entorno activo (dentro de `canUseTool`, mismo canal `deny+message` del Bloque 4); redacción de secretos aplicada a toda emisión del difusor de eventos | `server/barrera.ts`, uso en `server/agente.ts` |
| `ConfigRaiz` con `entorno`/`barrera`/`listaBlanca`; formulario real en el panel "proyecto" de Configuración; rutas `GET/POST /api/config` | `shared/tipos.ts`, `server/proyecto.ts`, `src/Configuracion.tsx`, `server/app.ts` |
| `diff`/`commit`/`descartar` sobre `tests/{features,pages,specs}/` vía `git` del sistema (sin dependencias nuevas); rutas `/api/escenarios*` y `/api/generados*` | `server/git.ts`, `server/app.ts` |
| Redactar (lista+edición de `.feature`) y Generar (lista+diff con Aceptar/Descartar de `.page.ts`/`.spec.ts`), cada una con un chat propio (`ChatAgente`) que comparte el estado de la consola global | `src/Redactar.tsx`, `src/Generar.tsx` |
| Lector fiel del último reporte JSON de Playwright (`test-results/results.json`, verificado de punta a punta contra `pruebas/sauce/`); `sugerirVeredicto` es solo una etiqueta de badge, nunca un juez — la clasificación real la da el agente | `server/reporter.ts` |
| Ejecutar (lista+pasos+error de cada test) y Reparar (solo los rojos, badge de sugerencia, diff con Aplicar/Rechazar), cada una con su chat (`ChatCorrida`) | `src/Ejecutar.tsx`, `src/Reparar.tsx` |
| Trazabilidad: cruza cada `Escenario:` del `.feature` con los `test.step` del `.spec.ts` homónimo (mismo nombre base), por igualdad exacta de secuencia de frases; cruce con `leerReporte` para el color; ruta `GET /api/trazabilidad` | `server/trazabilidad.ts` |
| Historial de ejecuciones: coste/duración/turnos + resultados por test, acumulado en `agente-qa.historial.json` (recorte a 200), enganchado tras cada `operation.completed`/`operation.error`; ruta `GET /api/historial` | `server/costes.ts`, uso en `server/agente.ts` |
| Elementos frágiles: cuenta los comentarios `// FRÁGIL: <motivo>` reales de la skill en `tests/pages/` y `tests/specs/`; ruta `GET /api/fragiles` | `server/fragiles.ts` |
| Dashboard con seis cajas (escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, frágiles); Reports con datos reales (pass rate, flaky de las últimas 5 ejecuciones, fallos agrupados por `mensajeError`, historial); badge de cobertura por fichero en Redactar | `src/Dashboard.tsx`, `src/Reports.tsx`, `src/Redactar.tsx` |
| `agente-qa instalar`: genera `.claude/skills/qa/` (con referencias), `AGENTS.md` y `.github/copilot-instructions.md` desde `skill/skills/qa/SKILL.md`; marcador de propiedad para no pisar ficheros ajenos sin confirmar; `--solo claude\|codex\|copilot` | `server/instalar.ts`, subcomando en `bin/agente-qa.mjs` |

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

### Las siete pestañas — qué muestra cada una hoy

| Pestaña | Qué muestra |
|---|---|
| **Redactar** | Los `.feature`, editables, con badge de cobertura por fichero. La primera puerta: corriges el escenario antes de que se escriba código |
| **Generar** | Los `.page.ts` y `.spec.ts`, y el visor de diff con aceptar/descartar |
| **Ejecutar** | Tests con su estado y el detalle paso a paso, con las frases del Gherkin |
| **Reparar** | Solo los rojos, con el veredicto: fallo del test o fallo de la aplicación |
| **Reports** | Historial de ejecuciones, fallos agrupados por causa, tests inestables, pass rate, fallos abiertos |
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles |
| **Configuración** | URL base, entornos, credenciales y el interruptor de la barrera de escrituras |

El chat es el mismo desde las cuatro primeras: una sola conversación, cuatro vistas.

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
| Chat propio por pestaña (Bloques 6 y 7) | `<ConsolaGlobal>` monta su propio `<Panel tabId="global" panelId="consola">` con key fija: no se puede anidar dentro de otro panel sin duplicarla. Redactar/Generar/Ejecutar/Reparar montan un componente de chat ligero propio (`ChatAgente`/`ChatCorrida`) que reutiliza el mismo estado (`corridaActiva`/`eventos`/`marcarCorridaActiva`) que `App.tsx` ya pasa a la consola global — no hay dos sesiones ni dos suscripciones SSE, solo dos vistas del mismo estado |
| Contrato `/api/generados/diff\|commit\|descartar` (Bloques 6 y 7) | Fijado por el Bloque 6 (`?ruta=` en el diff, `{rutas: string[], mensaje}` en el commit, `{rutas: string[]}` en el descarte) porque ahí vive `server/git.ts`. El Bloque 7 se implementó en paralelo sin verlo y asumió nombres distintos (`?fichero=`, `{fichero}`) — se corrigió al integrar; si se vuelve a tocar este contrato, `Reparar.tsx` es el único consumidor a revisar |
| Emparejamiento feature↔spec para trazabilidad (Bloque 8) | Por nombre base igual (`X.feature` ↔ `X.spec.ts`), inferido del único ejemplo de `plantillas.md` (`anadir-al-carrito.feature`/`anadir-al-carrito.spec.ts`) — no hay una regla escrita en la spec que lo exija. Si se genera un spec con otro nombre, saldría "no cubierto" pese a existir el test. Anotado en `PROXIMOS-PASOS.md` para verificar contra un proyecto real |
| "Elementos frágiles" del Dashboard (Bloque 8) | Cuenta comentarios `// FRÁGIL: <motivo>` reales (convención ya escrita en `skill/skills/qa/referencias/localizadores.md` desde antes del Bloque 8), no una señal inventada — coherente con el principio de que el código nunca juzga, solo cuenta lo que el agente ya marcó |
| "Tests inestables" en Reports (Bloque 8) | Un test es flaky si, entre las últimas 5 entradas de `agente-qa.historial.json`, aparece tanto en verde como en rojo. El historial se guarda de más antiguo a más nuevo (`server/costes.ts`) — el primer intento del frontend cogió `slice(0, 5)` (las 5 más antiguas de siempre) en vez de `slice(-5)`; corregido en revisión antes de cerrar el bloque |
| Ruta a `skill/` en `instalar.ts` (Bloque 9) | Prueba primero la resolución a dos niveles (`../..`, válida para el código compilado en `dist-server/server/instalar.js`, el caso real de `npx agente-qa instalar`) y cae a un nivel (`..`) solo si esa carpeta no existe — necesario porque los tests de Vitest importan el `.ts` fuente directamente desde `server/`, un nivel menos que el compilado. `server/agente.ts` no necesita este fallback porque solo pasa la ruta a `plugins` del SDK, nunca lee ficheros de ahí él mismo |
| Confirmación antes de sobrescribir en `instalar` (Bloque 9) | Un marcador de propiedad (cadena fija en un comentario HTML) en el fichero generado decide si es "nuestro" (se sobrescribe sin preguntar) o ajeno (pide confirmación). Sin terminal interactiva (`process.stdin.isTTY` falso, p.ej. CI) nunca pregunta: asume que no hay que tocarlo y sigue, para no colgar el proceso |
| Cómo llega `test-results/results.json` a existir (deuda cerrada 2026-09-12) | `server/reporter.ts` siempre asumió esa ruta pero nada la generaba: verificado contra `pruebas/sauce/` (`playwright.config.ts` real, `reporter: 'html'`) que tras `npx playwright test` el fichero **no existe** — `leerReporte` habría devuelto `[]` siempre en cualquier proyecto real, dejando Ejecutar/Reparar/Reports/Dashboard vacíos. Se descartó tocar el `reporter` del `playwright.config.ts` del repo destino (fichero ajeno, ver principio de "Ficheros existentes"); en su lugar `skill/skills/qa/SKILL.md` §4 obliga a `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json` por variable de entorno, que no requiere tocar nada del repo destino. Verificado de punta a punta: ese comando genera el JSON en `pruebas/sauce/`, y `leerReporte`/`cruzarTrazabilidad` reales (ejecutados a mano con `tsx`, no solo leídos) devuelven los cuatro resultados y los tres escenarios "cubierto" con el veredicto correcto |
| Nombre base compartido `.feature`/`.spec.ts` para trazabilidad (deuda cerrada 2026-09-12) | La sospecha del Bloque 8 (regla inferida, no escrita) se verificó contra los tres pares reales de `pruebas/sauce/` (`anadir-al-carrito`, `login-usuario-bloqueado`, `quitar-del-carrito`): la convención se cumple y el cruce de pasos palabra por palabra calza en los tres. Sigue sin estar escrita como regla en la skill — si algún día el agente nombra un spec distinto del feature, ese escenario saldría "no-cubierto" pese a existir el test — pero no bloquea nada con el uso real de hoy |
| `TS5055` en `npm run build` (deuda cerrada 2026-09-12) | Reproducido: `tsc -p tsconfig.server.json` falla con `dist-server/` de un build anterior presente, compila limpio si se borra antes. No es un bug del código servidor, es un build compuesto (`composite: true`) sin limpieza previa. Fix: `scripts/limpiar-dist-server.mjs` (borra `dist-server/`) enganchado en `npm run build` antes de `tsc`. Verificado con dos `npm run build` seguidos, el caso exacto que fallaba |

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
