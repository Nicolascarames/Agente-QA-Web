# La puerta de confirmación, con botones y con el fichero delante

Fecha: 2026-09-14
Estado: pendiente de revisión del usuario

Hoy el agente escribe el escenario en disco y pide confirmación **en prosa**: «He dejado el escenario
en Redactar → `login.feature`, revísalo y dime si confirmas o lo edito yo». La consola cierra el turno
con «Terminado.» y pinta «Sesión iniciada» al responder. Para quien está delante, la app se ha roto:
no hay botones que pulsar, la pestaña que le nombran no se abre, y parece que la conversación se ha
perdido. Nada de eso es un fallo del backend — el ciclo acabó con el test en verde — pero la puerta
de confirmación, que es el corazón del producto, no se ejerce.

## El objetivo

Cuando el agente genera un fichero y necesita tu aprobación: la pestaña correspondiente se abre sola
con el fichero delante, la pregunta llega con botones, y hasta que no pulsas uno el flujo no sigue.
Cuántas veces se para es tuyo: lo eliges en Configuración, con el coste de cada parada escrito al
lado.

## Decisiones tomadas (entrevista del 2026-09-14)

| Cuestión | Decisión |
|---|---|
| Quién impone la puerta | **La skill**. `SKILL.md` obliga a `AskUserQuestion`; el código reacciona (abre pestaña, pinta botones) pero no bloquea ninguna herramienta |
| Cuántas puertas | Configurable, cuatro políticas. **Por defecto: una sola, tras el escenario** — se confirma y el flujo sigue solo hasta el final |
| Cuándo salta la pestaña | Al llegar la pregunta, no al escribir el fichero: el salto coincide con el momento de decidir y no mueve la vista mientras el agente trabaja |
| Dónde vive la preferencia | `agente-qa.config.json` (`ConfigRaiz`), editable en Configuración, junto a URL/entorno/barrera |
| Cómo lo sabe el agente | Inyectada en `systemPrompt.append`, donde ya viajan `ROL_QA` y las credenciales |

## Hechos verificados que condicionan el diseño

Comprobados en el repo y contra la ejecución real del 2026-09-14 en `pruebas/babia`, no de memoria:

- **La prosa no fue desobediencia del agente: la pide la skill.** `skill/skills/qa/SKILL.md` §3
  (líneas 39-45) dice que «un aviso corto que apunte al fichero basta» y da como ejemplo *la frase
  exacta* que el agente escribió. `AskUserQuestion` queda reservada allí para cuando hay varias ramas.
- **`resume` funciona; el banner miente.** Hay un único transcript del SDK para ese proyecto
  (`~/.claude/projects/C--GitHub-Agente-QA-Web-pruebas-babia/bc814c73-….jsonl`): el segundo turno
  continuó la misma sesión y acabó con `login.spec.ts` en verde. `resumenEventoSistema`
  (`src/ConsolaGlobal.tsx:106-113`) pinta «Sesión iniciada — modelo X, N herramientas» idéntico en una
  sesión reanudada, y no tiene forma de distinguirlas.
- **`Write` y `Edit` están en `allowedTools` a propósito** (`server/agente.ts:161-170`): el comentario
  de esas líneas explica que solo `AskUserQuestion` y `mcp__playwright__*` quedan fuera para caer en
  `canUseTool`. Una puerta impuesta por código exigiría sacarlos de la lista y hacer que cada escritura
  pase por `canUseTool`. **Descartado en la entrevista**: manda la skill.
- **El frontend ya recibe la ruta del fichero escrito.** Los `tool_use` llegan con sus parámetros
  completos en el campo `input` (`src/ConsolaGlobal.tsx:164`), así que la consola puede recordar el
  último `Write`/`Edit` sobre `tests/**` sin ningún evento nuevo en el protocolo.
- **Ya existe el precedente de comunicación entre consola y pestañas, en sentido inverso.** El botón de
  ejemplo de «Empezar» escribe en la consola vía `escribirEnConsola`/`setBorradorConsola`
  (`src/App.tsx:243`), y la pestaña activa es estado de `App.tsx` (`pestana`/`setPestana`, línea 86).
- **El coste de una parada, medido.** El ciclo del 2026-09-14 en `pruebas/babia` fueron dos turnos:
  22 turnos internos y $0.39 hasta el escenario, 31 turnos y $0.58 hasta el test en verde. Cada puerta
  añadida es un turno más que reanuda la sesión y relee contexto. Ese es el número que justifica el
  aviso de la Pieza 2.

---

## Pieza 1 — La skill abre la puerta con botones

`skill/skills/qa/SKILL.md` §3 deja de ofrecer el aviso en prosa. Cambios:

- Se elimina la frase «un aviso corto que apunte al fichero basta» y su ejemplo literal.
- Cada puerta se abre **siempre** con `AskUserQuestion`, con tres opciones canónicas: «Confirmo»,
  «Lo edito yo en la pestaña» y «Cámbialo tú» (esta última se contesta por texto libre, que la consola
  ya permite).
- Se mantiene y se refuerza lo que §3 ya pedía: el fichero se escribe en disco **antes** de preguntar,
  porque lo que se revisa es el fichero de la pestaña, no el texto del chat. El Gherkin completo no se
  repite en la consola.
- El número de paradas no lo decide la skill: lo lee del bloque que le inyecta el `system prompt`
  (Pieza 2).

## Pieza 2 — La política de puertas, configurable

`ConfigRaiz` (`shared/tipos.ts`) gana el campo `puertas`, con cuatro valores:

| Valor | Dónde para | Coste |
|---|---|---|
| `"escenario"` **(por defecto)** | Una vez, tras el `.feature`. Confirmas y el flujo sigue solo hasta el test en verde | Como hoy |
| `"escenario-y-codigo"` | Dos: tras el `.feature` y tras los `.page.ts` + `.spec.ts` juntos, antes de ejecutar | +1 turno |
| `"por-artefacto"` | Tres: `.feature`, page objects, spec | +2 turnos |
| `"por-fichero"` | Cada fichero escrito o modificado bajo `tests/`, incluidas las correcciones tras un rojo | +4 turnos o más |

Piezas de código:

- `server/puertas.ts` (nuevo, puro y testeable como `server/barrera.ts`): `textoPoliticaPuertas(puertas)`
  devuelve el bloque en castellano que se le dice al agente. `server/agente.ts` lo concatena al
  `systemPrompt.append` existente, leyendo `ConfigRaiz` como ya lee entorno/barrera/lista blanca.
- Sección nueva en `src/Configuracion.tsx`: el selector de las cuatro políticas y un párrafo fijo que
  explica el coste — cada parada reanuda la sesión, el agente relee el contexto y eso se paga en
  tokens; con los números medidos arriba como referencia.
- `GET/POST /api/config` no cambia de forma: `puertas` viaja como un campo más. Un
  `agente-qa.config.json` antiguo sin ese campo vale como `"escenario"`, el valor por defecto.

## Pieza 3 — La pestaña se abre sola al preguntar

- `src/pestanaParaRuta.ts` (nuevo, función pura con test): dada una ruta de fichero devuelve la pestaña
  destino — `tests/features/*.feature` → Redactar; `tests/pages/*` y `tests/specs/*` → Generar;
  cualquier otra cosa → `null` (no salta).
- `src/ConsolaGlobal.tsx` recuerda la ruta del último `Write`/`Edit` sobre `tests/**` leyéndola del
  `input` del `tool_use` que ya recibe. Cuando entra la pregunta de `AskUserQuestion`, llama a una prop
  nueva `onAbrirPestana(pestana)` si `pestanaParaRuta` devuelve algo.
- `src/App.tsx` conecta esa prop a `setPestana`, simétrico a como ya pasa `escribirEnConsola` en
  sentido contrario. Ningún evento nuevo en el protocolo SSE.

## Pieza 4 — Que la consola deje de mentir

Los dos síntomas cosméticos que hicieron pensar que la app había tirado la conversación:

- `resumenEventoSistema` distingue sesión nueva de sesión reanudada. Quien sabe si la corrida se
  reanudó es el backend (`server/app.ts` pasa `resume` cuando hay un `session_id` previo), así que es
  él quien marca ese dato **como un campo más del evento de sistema que ya existe** — no es un evento
  nuevo, y por eso no choca con «Lo que NO entra». Con ese campo, el texto dice «Conversación
  reanudada» en vez de «Sesión iniciada».
- El bloque resaltado de cierre no dice «Terminado.» cuando el turno acabó con una puerta abierta:
  dice que espera tu confirmación. `textoBloqueFinal` ya es una función pura con tests, y ahí se decide.

---

## Lo que NO entra

- **Bloqueo por código.** Nada de sacar `Write`/`Edit` de `allowedTools` ni de interceptarlos en
  `canUseTool`. Descartado en la entrevista: la puerta la impone la skill.
- **Eventos nuevos en el canal SSE.** Todo lo que necesita el frontend ya viaja en el `input` de los
  `tool_use`.
- **Puertas sobre ficheros fuera de `tests/`.** Si el agente toca cualquier otra cosa del repo, no hay
  pestaña que abrir y no se para.

## Verificación

- Test unitario de las tres funciones puras nuevas o tocadas: `pestanaParaRuta`,
  `textoPoliticaPuertas`, y el par `resumenEventoSistema`/`textoBloqueFinal`.
- `npm run lint`, `typecheck`, `test` y `build` en verde.
- **Un ciclo real contra `pruebas/babia`, visto en el navegador**, con la política por defecto: la
  pestaña Redactar se abre sola con el `.feature` delante, la pregunta llega con botones, y al pulsar
  «Confirmo» el flujo sigue hasta el test en verde sin más paradas. `memory.md` ya recoge que lo que
  `ESTADO.md` afirma de la interfaz no la verifica: esta pieza no se cierra sin verlo en vivo.
- Una segunda pasada con `"por-artefacto"` para comprobar que el agente respeta el número de paradas
  que le inyecta el `system prompt`.
