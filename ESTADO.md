# ESTADO — Agente-QA-Web

Actualizado: 2026-09-11 (Bloque 4 cerrado)

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

**Bloques 1, 2, 3 y 4 cerrados.** El resto del plan nuevo no está implementado. `npx agente-qa` (o
`node bin/agente-qa.mjs` en local) arranca sobre `process.cwd()`, crea `agente-qa.config.json` en
la raíz preguntando solo la URL base si no existe, y levanta la web mostrando ese repo. El
subcomando `doctor` comprueba sesión/SDK/Node/Playwright y sale con el código correspondiente. La
consola global lanza el agente de verdad (SDK de Claude Code) sobre el repo activo: escribes una
petición, se ejecuta con Playwright MCP y la skill de QA, y los eventos llegan por SSE.

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
| Estructura Fastify + SSE (las rutas, no su contenido); rutas del sistema antiguo retiradas o convertidas en stubs 501 | `server/app.ts` |
| Canal de eventos: `EventoNdjson`, `type` como texto libre a propósito | `shared/tipos.ts` |
| Tipos de evento terminal centralizados, antes duplicados a mano en tres sitios | `shared/eventos.ts` |
| Resolución del proyecto por `--project` → env → `cwd`, sin `agente-qa-contract` | `server/proyecto.ts` |
| La caja de texto de la consola, conectada al agente: envía/encola peticiones, botones Parar/Interrumpir, renderiza preguntas del agente con botones + texto libre | `src/ConsolaGlobal.tsx` |
| La maqueta y el estilo de siete pestañas, todas vacías salvo la consola (Configuración incluida) | `src/App.tsx` |
| Envuelve `query()` del SDK de Claude Code: cola de entrada en modo streaming, difusor de eventos a N suscriptores SSE, `canUseTool` para `AskUserQuestion`, mapeo a los tres eventos terminales | `server/agente.ts` |
| Rutas `/api/comando` (lanza o encola), `/api/eventos` (SSE, un suscriptor por conexión), `/api/parar`, `/api/interrumpir`, `/api/pregunta/responder`; estado de la sesión activa en memoria del módulo | `server/app.ts` |
| La skill de QA reestructurada como plugin del SDK (manifiesto + `skills/qa/`), para que `plugins` la cargue sin copiar nada al repo del usuario | `skill/.claude-plugin/plugin.json`, `skill/skills/qa/` |

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
`claude` lanzado ahí la descubra solo — mecanismo que reutilizará el Bloque 9 (`instalar`).

### Las siete pestañas y qué será cada una

| Pestaña | Qué mostrará |
|---|---|
| **Redactar** | Los `.feature`, editables. La primera puerta: corriges el escenario antes de que se escriba código |
| **Generar** | Los `.page.ts` y `.spec.ts`, y el visor de diff con aceptar/descartar |
| **Ejecutar** | Tests con su estado y el detalle paso a paso, con las frases del Gherkin |
| **Reparar** | Solo los rojos, con el veredicto: fallo del test o fallo de la aplicación |
| **Reports** | Historial, fallos agrupados, tests inestables, coste |
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste, elementos frágiles |
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
