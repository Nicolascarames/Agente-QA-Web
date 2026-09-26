# Capturas en cada validación e informe visual por ejecución

Fecha: 2026-09-26
Estado: pendiente de revisión del usuario

Hoy no se ve ningún informe. La skill y el botón Ejecutar lanzan Playwright con
`--reporter=list,json`, y lo que va en la línea de comandos pisa el `reporter: 'html'` del
`playwright.config.ts` del repo destino: `playwright-report/` no se regenera. Reports solo agrega
estadísticas (pass rate, fallos agrupados, inestables) y `server/reporter.ts` ignora los adjuntos.
Ningún config pide capturas, así que tampoco hay nada que enseñar.

## El objetivo

Cada vez que un test comprueba algo en la página, queda una captura con el elemento validado
recuadrado y el valor esperado al pie. Así el usuario ve con sus ojos que el test comprobó lo que
decía. Cada ejecución se guarda con su informe de Playwright y con un informe propio que reúne
pasos y capturas. Ese informe se ve en Reports y también como HTML suelto fuera de la app.

## Decisiones tomadas (entrevista del 2026-09-25/26)

| Cuestión | Decisión |
|---|---|
| Qué es una «validación» | Cada paso `Entonces …` del `.feature` (en el spec, cada `paso('Entonces …')`) |
| Cómo es la captura | Pantalla visible, elemento validado recuadrado; pie con el texto del paso y el valor esperado |
| Qué se captura | Cualquier combinación de `validaciones`, `fallos` y `pasos` (todos los pasos). Lista vacía = nada. **Por defecto `["validaciones"]`** |
| Dónde se elige | Configuración (persistente, `agente-qa.config.json`) + casillas en Ejecutar, que valen solo para esa ejecución |
| Historial | **Por defecto se guardan todas las ejecuciones.** En Configuración se puede limitar a las últimas N |
| Cómo captura el test | Opción A: fichero de apoyo `tests/soporte/agente-qa.ts` copiado por la skill al repo destino. Sin dependencia npm nueva |
| Tests ya existentes | Aviso «sin capturas» en Ejecutar + botón «Añadir capturas», que manda al agente a adaptarlo pasando por la puerta de confirmación habitual |
| Dónde se ve el informe | En Reports (lista de ejecuciones → informe) **y** como `informe.html` suelto por ejecución |
| Diseño del informe | **De momento imita el informe HTML de Playwright.** El diseño propio se hará más adelante, en otra tarea |

## Hechos que condicionan el diseño

- **La línea de comandos manda sobre el config.** `server/ejecutorTests.ts:37` y la sección 4 de
  `SKILL.md` (líneas 56-74) fijan `--reporter=list,json` y la variable
  `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json`. Por eso el HTML se añade también por
  línea de comandos y nunca editando el config ajeno, siguiendo la misma regla que ya aplica la skill.
- **Playwright vacía `test-results/` al empezar cada ejecución.** Las capturas adjuntas viven ahí,
  así que hay que copiarlas fuera antes de la siguiente ejecución para no perderlas.
- **El reporter HTML abre el navegador solo cuando hay fallos.** Hay que desactivarlo con
  `PLAYWRIGHT_HTML_OPEN=never`. Su carpeta de salida se fija con `PLAYWRIGHT_HTML_OUTPUT_DIR`.
  Ambos nombres se comprueban contra la versión instalada en `pruebas/sauce` (`^1.63.0`) antes de
  usarlos.
- **En el JSON de Playwright, los adjuntos cuelgan del resultado del test, no del paso.** Para
  saber a qué paso pertenece cada captura, el nombre del adjunto lleva el título del paso.
- **Los pasos ya se leen.** `aplanarPasos` (`server/reporter.ts:59-66`) aplana los `test.step`, y
  la trazabilidad (`server/trazabilidad.ts`) cruza por el título exacto del paso. `paso()` usa
  `test.step` por debajo con el mismo título, así que ninguna de las dos cosas cambia.
- **Los ajustes viajan por `agente-qa.config.json`.** Se leen y escriben en `server/proyecto.ts:38-78`
  y se editan en `src/Configuracion.tsx`. Al agente le llegan en `server/agente.ts:159-190`
  (`systemPrompt.append`).

## Pieza 1 — Ajustes

`ConfigRaiz` gana dos campos:

- `capturas: ("validaciones" | "fallos" | "pasos")[]`. Por defecto `["validaciones"]`. Si el campo
  no existe en el config, vale el defecto; si es una lista vacía, no se hacen capturas.
- `historial: number | null`. `null` (el valor por defecto) guarda todo; un número N ≥ 1 guarda
  solo las N ejecuciones más recientes.

En Configuración:

- Tres casillas para las capturas: «En cada validación», «Cuando falla un test» y «En todos los
  pasos».
- Un interruptor «Guardar todas las ejecuciones». Al apagarlo aparece un campo numérico que
  empieza en 10.

En Ejecutar, las mismas tres casillas vienen marcadas según Configuración. Cambiarlas afecta solo a
la siguiente ejecución lanzada desde el botón y no se guarda. `POST /api/tests/ejecutar` acepta un
`capturas` opcional; si no llega, usa el del config.

## Pieza 2 — El fichero de apoyo en el repo destino

La skill copia `tests/soporte/agente-qa.ts` al repo destino si todavía no existe. La plantilla vive
en `skill/skills/qa/plantillas/agente-qa.ts`. El fichero exporta:

- **`test`**: el `test` de Playwright ampliado con un fixture automático. Si el ajuste incluye
  `fallos` y el test ha fallado, adjunta una captura de página completa llamada
  `agente-qa:fallo`.
- **`expect`**: se reexporta tal cual.
- **`paso(titulo, fn)`**: envuelve `test.step(titulo, fn)`. Si el ajuste incluye `pasos`, al
  terminar el paso adjunta una captura llamada `agente-qa:paso:<titulo>`.
- **`validar(locator, esperado)`**: se usa dentro de un paso `Entonces`, después de sus `expect`.
  Si el ajuste incluye `validaciones`:
  1. recuadra el elemento con un `outline` inyectado;
  2. captura la pantalla visible;
  3. quita el recuadro;
  4. adjunta la imagen como `agente-qa:validacion:<titulo del paso>`, con el valor esperado en un
     adjunto de texto hermano.

  Si el elemento no es visible, no captura y no falla: la aserción ya la hizo `expect`.

El ajuste se lee de `AGENTE_QA_CAPTURAS`, una lista separada por comas (`validaciones,fallos`). Si
la variable no está definida, vale `validaciones`. Si está definida pero vacía, no se captura nada.

Cambios en `SKILL.md`:

- **Sección 3/4**: los specs importan `test`, `expect`, `paso` y `validar` desde
  `../soporte/agente-qa`. Usan `paso()` en lugar de `test.step`, y cada `Entonces` termina con
  `validar(...)` sobre el elemento que comprueba.
- **Sección 4**: el comando pasa a ser
  `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json PLAYWRIGHT_HTML_OPEN=never npx playwright test --reporter=list,json,html`.
- **Sección 5**: la estructura de carpetas incluye `tests/soporte/`.

## Pieza 3 — Ejecución y archivo (servidor)

**El ejecutor** (`server/ejecutorTests.ts`) lanza los tests con `--reporter=list,json,html`, añade
`PLAYWRIGHT_HTML_OPEN=never` y pasa `AGENTE_QA_CAPTURAS` con el valor recibido o el del config.

**Un módulo nuevo, `server/informes.ts`**, expone `archivarUltimaEjecucion(rootDir, config)`:

1. Lee `test-results/results.json`. Si no existe, no hace nada.
2. Calcula el id de la ejecución a partir de `stats.startTime` (formato `AAAA-MM-DD_HH-mm-ss`). Si
   ya existe `agente-qa-informes/<id>/`, no hace nada: así puede llamarse las veces que haga falta.
3. Copia a `agente-qa-informes/<id>/`:
   - `results.json`;
   - los adjuntos `agente-qa:*` que aparezcan en el JSON, a `capturas/`;
   - `playwright-report/` entero, a `playwright/`.
4. Genera `agente-qa-informes/<id>/informe.html` (Pieza 4) y un `resumen.json` con fecha,
   duración, número de verdes y rojos, y specs ejecutados.
5. Si `historial` es un número N, borra las carpetas de ejecución más antiguas hasta dejar N.

**Cuándo se llama**:

- al terminar `ejecutarPlaywright`;
- al terminar cada turno del agente, porque el agente ejecuta los tests desde su propia terminal.

**Si falla la copia**, el error se registra en el log del servidor y no se propaga. La ejecución y
la lectura actual de `results.json` siguen igual.

La primera vez que se archiva una ejecución, `agente-qa-informes/` se añade al `.gitignore` del repo
destino. Se reutiliza el mismo mecanismo que ya lo hace con `agente-qa.credenciales.json`
(`server/proyecto.ts:117-130`), generalizado para aceptar cualquier entrada.

**Rutas nuevas**:

- `GET /api/informes`: lista los `resumen.json`, del más reciente al más antiguo.
- `GET /informes/<id>/*`: sirve de forma estática los ficheros de esa ejecución. El id se valida
  con una regex para que no se pueda salir de la carpeta.

## Pieza 4 — El informe propio (`informe.html`)

- Es un HTML autocontenido: CSS y JS van dentro del propio fichero, y las imágenes se enlazan con
  rutas relativas a `capturas/`. La carpeta de una ejecución se puede abrir con doble clic o
  comprimir y enviar.
- **Aspecto: imita el informe HTML de Playwright.**
  - Cabecera con los contadores de todos, verdes, rojos y omitidos, y la duración.
  - Tests agrupados por fichero, con una insignia de estado.
  - Al desplegar un test se ven sus pasos con su duración.
  - Bajo cada paso, las miniaturas de sus capturas con su pie; al pulsarlas se amplían.
  - Los fallos muestran el mensaje de error y su captura `agente-qa:fallo`.
- Un enlace «Informe de Playwright» abre `playwright/index.html`.
- Lo genera una función pura, `generarInformeHtml(resultados, capturas) → string`, dentro de
  `server/informes.ts` o en un fichero hermano si crece.

## Pieza 5 — En la app

**Reports**:

- Añade una sección «Ejecuciones» con una lista de fecha, verdes y rojos, y duración.
- Al pulsar una ejecución, se abre su `informe.html` en un iframe servido desde
  `/informes/<id>/informe.html`.
- Tiene dos botones: «Abrir informe de Playwright» y «Abrir HTML suelto». Los dos abren una pestaña
  nueva del navegador.

**Ejecutar**:

- Muestra las tres casillas de capturas.
- Al terminar una ejecución, muestra un enlace «Ver informe» que lleva a Reports con esa ejecución
  abierta.
- Si el spec seleccionado no contiene `validar(`, que se comprueba leyendo su contenido, aparece el
  aviso «Este test no saca capturas» junto al botón «Añadir capturas». El botón envía a la consola
  global un mensaje prefijado para que el agente adapte ese spec a `paso`/`validar`. El agente
  pasa por la puerta de confirmación del spec, como en cualquier otra edición.

## Lo que NO entra

- El diseño visual propio del informe. Se deja para una tarea posterior; de momento se imita el de
  Playwright.
- El vídeo y la traza de Playwright.
- Comparar capturas entre ejecuciones (regresión visual).
- Editar el `playwright.config.ts` del repo destino.

## Verificación

- **Tests unitarios de `server/informes.ts`**, con un `results.json` de ejemplo con adjuntos:
  - archiva la ejecución y copia las capturas;
  - no duplica una ejecución ya archivada;
  - poda hasta N;
  - no hace nada si falta `results.json`;
  - `generarInformeHtml` incluye los pasos y los `<img>` con rutas relativas.
- **Tests del ejecutor**: argumentos `list,json,html`, `PLAYWRIGHT_HTML_OPEN=never` y
  `AGENTE_QA_CAPTURAS` (el del config por defecto, el recibido cuando llega uno).
- **Tests de config**: valores por defecto de `capturas` e `historial`, lectura y escritura.
- **Test de la ruta estática**: rechaza ids con `..`.
- **Prueba en vivo contra `pruebas/sauce`**:
  1. adaptar un spec con «Añadir capturas»;
  2. ejecutarlo desde Ejecutar;
  3. ver en Reports las capturas recuadradas de cada `Entonces`;
  4. abrir el HTML suelto fuera de la app;
  5. abrir el informe de Playwright;
  6. repetir con `fallos` + `validaciones` y un test roto a propósito.
