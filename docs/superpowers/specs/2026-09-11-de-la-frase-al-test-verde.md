# Spec — De la frase al test verde

**Fecha**: 2026-09-11
**Repo**: `Agente-QA-Web` (el único que sobrevive)
**Diseño de referencia**: el documento «De la frase al test verde»
**Sustituye a**: todo el plan anterior de `AGENTE-QA-MCP`

---

## En cristiano: qué va a hacer este plan

Hoy no existe ni un solo test generado que funcione. Este plan lo arregla cambiando quién hace el
trabajo.

Antes, un programa nuestro conducía y le hacía preguntas sueltas a un modelo. Ahora conduce el
agente entero — el mismo que acierta cuando se lo pides por fuera — y nuestro programa se dedica a
lanzarlo, enseñarte lo que hace y guardar el resultado.

Lo que vas a poder hacer al final: te pones en cualquier repo tuyo, escribes `npx agente-qa`, se
abre una página en tu navegador, escribes *«quiero probar que se puede añadir un producto al
carrito»*, y sale un test que ya se ha ejecutado y está verde. Por el camino te enseña en lenguaje
llano lo que ha entendido para que lo corrijas antes de que escriba código, y te pregunta con
botones cuando algo es ambiguo.

El primer bloque no construye nada de eso. El primer bloque consigue **un test verde**, a mano,
desde la terminal. Si eso no sale, el resto no importa y paramos ahí.

---

## Reglas de esta spec

1. **Nada se hereda sin haberse comprobado.** De `AGENTE-QA-MCP`, `Agente_QA` y
   `agente-qa-contract` no se copia ni una línea. Esos tres repos se borran.
2. **El código nunca juzga lo que produce el agente.** Lo ejecuta, lo enseña, y el usuario acepta o
   rechaza. Quien juzga es Playwright.
3. **Un bloque cerrado deja algo que se puede probar a mano.** Si no, no es un bloque.
4. **Verificación agrupada al cerrar cada bloque**: `lint` → `typecheck` → `test` → review del diff.
5. El hilo principal no escribe código: despacha, lee resúmenes y commitea.

---

## Vocabulario fijado

| Se dice | No se dice |
|---|---|
| ejecución | corrida |
| escenario | feature (cuando se habla del caso) |
| Page Object | page, POM |
| localizador | selector |

---

## Estructura final del repo

```
Agente-QA-Web/
  bin/agente-qa.mjs              NUEVO   punto de entrada del comando
  skill/
    SKILL.md                     NUEVO   el cerebro
    referencias/
      localizadores.md           NUEVO   los trece niveles
      plantillas.md              NUEVO   forma canónica de page object y spec
  server/
    agente.ts                    NUEVO   lanza el SDK, emite eventos
    barrera.ts                   NUEVO   hook PreToolUse
    doctor.ts                    NUEVO   credenciales, node, playwright
    reporter.ts                  NUEVO   lee el JSON de Playwright
    trazabilidad.ts              NUEVO   cruza .feature con test.step
    git.ts                       NUEVO   diff y commit
    app.ts                       PODAR   se quedan las rutas y el SSE
    proyecto.ts                  PODAR   solo la resolución por cwd
    estado.ts                    REESCRIBIR
    corridas.ts                  BORRAR
    mapa.ts                      BORRAR
    cli.ts                       BORRAR
  shared/
    eventos.ts                   NUEVO   constante única de tipos de evento
    tipos.ts                     PODAR
  src/
    tokens.css                   INTACTO
    App.tsx                      PODAR   fuera el selector de proyecto
    ConsolaGlobal.tsx            PODAR   fuera el autocompletado
    Redactar/Generar/Ejecutar/Reparar/Reports/Dashboard/Configuracion  RELLENAR
    Explorar.tsx                 BORRAR
    DetalleLocalizador.tsx       BORRAR
    diffMapa.ts                  BORRAR
    catalogo/                    BORRAR (carpeta entera)
  scripts/
    comprobar-estilos.mjs        INTACTO
    sincronizar-catalogo.mjs     BORRAR
```

---

# Bloque 1 — La skill y un test verde

**Sin web. Sin comando. Sin interfaz.** Este bloque existe para responder una sola pregunta: ¿el
agente, bien instruido, escribe un test de Playwright que se pone verde contra una web real?

Si la respuesta es no, los ocho bloques siguientes no valen nada y esta spec se tira.

### Ficheros

| Fichero | Cambio |
|---|---|
| `skill/SKILL.md` | Nuevo. El documento entero |
| `skill/referencias/localizadores.md` | Nuevo. Los trece niveles y la regla de repetidos |
| `skill/referencias/plantillas.md` | Nuevo. Forma canónica de `.feature`, `.page.ts` y `.spec.ts` |
| `pruebas/sauce/` | Nuevo. Repo de pruebas desechable, fuera de git |

### Contenido de `SKILL.md`

Apartados obligatorios, en este orden:

1. **Quién eres**: ingeniero de QA senior que escribe Playwright en TypeScript.
2. **Orden de trabajo, innegociable**: mirar la página con `browser_snapshot` antes de escribir
   nada. Nunca al revés.
3. **Las tres puertas**: Gherkin → Page Objects → test. Se puede parar en cualquiera. Tras la
   primera, se espera confirmación antes de escribir código.
4. **Definición de terminado**: el test se ha ejecutado con `npx playwright test` y está verde.
   No hay otra definición. Decir «hecho» sin haber ejecutado es un fallo.
5. **Estructura de carpetas**: `tests/features/`, `tests/pages/`, `tests/specs/`.
6. **Localizadores**: remite a `referencias/localizadores.md`. Los trece niveles, sin desviarse.
7. **Elementos repetidos**: la regla `ENTIDAD → PADRE/CONTEXTO → ACCIÓN`, con el ejemplo literal.
8. **Login**: una sola vez, con `storageState`, en un proyecto de setup. Ningún test hace login.
9. **Esperas**: `expect` con auto-retry. `waitForTimeout` está prohibido.
10. **Ficheros existentes**: leerlos antes de tocarlos. Ampliar sin pisar métodos. Preguntar solo
    si hay conflicto real.
11. **Cuándo preguntar**: ambigüedad real de alcance. No para pedir permiso de cada paso.
12. **Cuando nada sirve**: usar la mejor salida de emergencia, marcarla como frágil, y reportarlo
    para el equipo de desarrollo.
13. **Fallo de la aplicación**: si la web hace algo distinto de lo esperado, **no se toca el
    test**. Se informa. Es un bug encontrado.
14. **Tres intentos**: si tras tres correcciones el test sigue rojo, se entrega igual, marcado,
    con la explicación. Nunca se borra el trabajo.

### Contenido de `referencias/localizadores.md`

Los trece niveles tal como quedaron fijados, con el ejemplo `NO`/`SÍ` de la regla de repetidos y
las reglas que la acompañan (unicidad e intención antes que brevedad; nada de posiciones,
estructura del DOM, clases generadas ni IDs dinámicos; `filter({ hasText })` y `filter({ has })`
para acotar).

### Contenido de `referencias/plantillas.md`

La forma canónica de los tres ficheros, con el ejemplo del carrito de SauceDemo completo: cada
`test.step` lleva la frase del Gherkin palabra por palabra, el Page Object expone métodos con
intención (`addToCart(producto)`, no `clickButton(3)`), y el login vive en el setup.

### Repo de pruebas

`pruebas/sauce/` con `playwright.config.ts` (baseURL `https://www.saucedemo.com`, proyecto de
setup para el login, `storageState` en `.auth/`), `package.json` con Playwright, y `.gitignore`.
Credenciales del demo público: `standard_user` / `secret_sauce`, desde variables de entorno.

### Verificación

```
cd pruebas/sauce
npx playwright test
```

### Cómo lo pruebas tú

1. Abre una terminal en `pruebas/sauce/` y lanza `claude`.
2. Escribe: `quiero probar que se puede añadir un producto al carrito`.
3. Debe: mirar la página, preguntarte si un producto concreto o cualquiera, enseñarte el Gherkin y
   esperar tu OK, escribir los ficheros, ejecutar los tests y enseñarte el verde.
4. Abre `tests/pages/inventory.page.ts` y comprueba que el localizador acota por contenedor y no
   usa `.nth()`.
5. Repite con: `haz un test de login con usuario bloqueado` y con un caso pegado en prosa.

### Criterio de cierre

**Tres peticiones distintas, tres tests en verde, sin que tú toques código.** Si hace falta más de
una corrección tuya por petición, el problema está en la skill y se itera aquí — no se avanza.

---

# Bloque 2 — Vaciar la web

Borrar todo lo que muere con `map.json` y con el CLI anterior. Al cerrar, la web arranca y navega,
con siete pestañas honestas y vacías.

### Ficheros

| Acción | Fichero |
|---|---|
| Borrar carpeta | `src/catalogo/` (`comandos.ts`, `catalogo.ts`, `cli.generado.json`) |
| Borrar | `scripts/sincronizar-catalogo.mjs`, y el script `catalogo:sync` de `package.json` |
| Borrar | `src/diffMapa.ts`, `src/diffMapa.test.ts` |
| Borrar | `src/DetalleLocalizador.tsx` |
| Borrar | `src/Explorar.tsx` y su entrada de navegación |
| Borrar | `server/mapa.ts` y su test, `server/cli.ts`, `server/corridas.ts` |
| Podar | `shared/tipos.ts`: fuera `MapaCompleto`, `EstadoMapa`, `CuerpoCorreccionLocalizador`, `RespuestaCorreccionLocalizador` |
| Podar | `src/ConsolaGlobal.tsx`: fuera `catalogoResuelto()`, el autocompletado, la validación en vivo y `TarjetaResumen`. **Se queda la caja de texto y el pintado de líneas** |
| Podar | `src/App.tsx`: fuera el selector de proyecto y la lista de recientes |
| Podar | `server/proyecto.ts`: se queda la resolución `--project` → env → `cwd`; fuera el registro de recientes en `%APPDATA%` |
| Quitar | La dependencia `agente-qa-contract` de `package.json` |
| Arreglar | `src/Explorar.tsx:104-106` desaparece con el fichero, pero el mismo patrón de efecto sin limpieza se repite en el indicador global: revisar y limpiar al desmontar |
| Crear | `shared/eventos.ts` con la constante única de tipos de evento |

### Detalle del fichero nuevo

`shared/eventos.ts` centraliza lo que hoy está escrito a mano en tres sitios
(`server/corridas.ts:73`, `src/Explorar.tsx:11`, `src/useCorridaGlobal.ts:6`). Exporta los tipos
terminales y un helper `esEventoTerminal(type)`. Todo consumidor lo importa de aquí.

### Verificación

```
npm run lint && npm run typecheck && npm test && npm run build
```

El guard `comprobar-estilos.mjs` debe seguir pasando.

### Cómo lo pruebas tú

1. `npm run dev` y abre la web.
2. Las siete pestañas navegan, no hay Explorar, y nada revienta en consola del navegador.
3. Busca en el código `catalogo`, `map.json`, `LocatorEntry`: no debe quedar ninguna referencia.

---

# Bloque 3 — `npx agente-qa` sobre el repo actual

El comando que arranca la web apuntando al repo donde estás.

### Ficheros

| Fichero | Cambio |
|---|---|
| `bin/agente-qa.mjs` | Nuevo. Punto de entrada, `bin` en `package.json` |
| `server/doctor.ts` | Nuevo |
| `server/proyecto.ts` | Leer el fichero de configuración de la raíz del repo |
| `agente-qa.config.json` | Formato nuevo, documentado |

### Comportamiento

- `npx agente-qa` arranca sobre `process.cwd()`. Sin argumentos, sin selector.
- `npx agente-qa doctor` comprueba y sale.
- Si no existe `agente-qa.config.json`, lo crea preguntando solo la URL base.

### El `doctor`

Cuatro comprobaciones, cada una con su mensaje accionable:

| Comprueba | Si falla dice |
|---|---|
| Fichero de credenciales en la ruta de la plataforma | `No has iniciado sesión en Claude Code en este ordenador. Ejecuta: claude login` |
| Binario nativo del SDK presente | `Falta el binario del SDK. Reinstala sin --omit=optional` |
| Node ≥ 18 | La versión encontrada y la mínima |
| Playwright instalado en el repo destino | `npm i -D @playwright/test && npx playwright install chromium` |

Rutas de credenciales: `%USERPROFILE%\.claude\.credentials.json` en Windows, llavero en macOS con
fallback a `~/.claude/.credentials.json`, `~/.claude/.credentials.json` en Linux. Respetar
`CLAUDE_CONFIG_DIR` si está definida.

### Verificación

```
npm run build && node bin/agente-qa.mjs doctor
```

### Cómo lo pruebas tú

1. Desde `pruebas/sauce/`: `node <ruta>/bin/agente-qa.mjs` → la web abre mostrando **ese** repo.
2. Desde otro repo cualquiera → muestra ese otro. Los tests no se mezclan.
3. `doctor` en un repo sin Playwright debe decirte el comando exacto que te falta.

---

# Bloque 4 — La consola habla con el agente

La caja de texto que ya existe deja de lanzar un CLI y pasa a lanzar el agente.

### Ficheros

| Fichero | Cambio |
|---|---|
| `server/agente.ts` | Nuevo. Envuelve `query()` del SDK |
| `server/app.ts` | Ruta nueva que arranca una ejecución y la sirve por SSE |
| `src/ConsolaGlobal.tsx` | Pinta los eventos del agente; botones; parar e interrumpir |
| `shared/eventos.ts` | Tipos de evento del agente |

### `server/agente.ts`

Superficie mínima: `lanzar(peticion) → AsyncIterable<Evento>`. Dentro:

- `cwd`: la raíz del repo destino.
- `mcpServers`: `playwright` por stdio (`npx @playwright/mcp@latest`).
- `plugins`: la carpeta `skill/` del propio paquete, por ruta absoluta desde `node_modules`.
  **No se copia nada al repo del usuario.**
- `systemPrompt`: preset `claude_code` con `append` del rol de QA.
- `allowedTools`: `mcp__playwright__*`, `Read`, `Write`, `Edit`, `Glob`, `Grep`,
  `Bash`, `AskUserQuestion`.
- `abortController`: expuesto hacia arriba para el botón de parar.
- **Sin `--bare`**, para que resuelva la suscripción.

### Preguntas con botones

`canUseTool` intercepta `AskUserQuestion`, emite el evento a la interfaz, espera la elección y
devuelve `{ behavior: "allow", updatedInput: { questions, answers } }`. La interfaz pinta un botón
por opción **más una caja de texto libre**.

### Parar e interrumpir

Dos botones distintos, porque hacen cosas distintas:

| Botón | Qué hace |
|---|---|
| **Parar** | `abortController.abort()`. Termina la ejecución |
| **Interrumpir** | Corta el turno en curso y entrega ya lo que hayas escrito |

Y lo que escribas sin pulsar nada se encola y se entrega al terminar el turno. La interfaz lo dice
con un aviso bajo la caja: `se enviará al terminar el paso actual`.

### Verificación

```
npm run lint && npm run typecheck && npm test
```

### Cómo lo pruebas tú

1. `npx agente-qa` en `pruebas/sauce/`.
2. Escribe `hazme el page object del login` y mira la consola: debe verse abrir el navegador,
   mirar la página y escribir el fichero.
3. Pide algo ambiguo (`hazme un test del menú`) → deben salir botones. Pulsa uno.
4. Vuelve a pedirlo y responde por la caja de texto libre en vez de pulsar.
5. Lanza algo largo y pulsa **parar** a mitad. Debe cortar sin dejar el navegador abierto.
6. Lanza algo largo, escribe un mensaje y pulsa **interrumpir**. Debe atenderte al momento.

---

# Bloque 5 — La barrera de escrituras y los secretos

Hasta aquí el agente solo ha apuntado a una web de pruebas. Este bloque es el que permite
apuntarlo a una aplicación real sin miedo.

### Ficheros

| Fichero | Cambio |
|---|---|
| `server/barrera.ts` | Nuevo. Hook `PreToolUse` |
| `server/agente.ts` | Registrar el hook |
| `src/Configuracion.tsx` | Interruptor y lista blanca |
| `agente-qa.config.json` | Campos `entorno`, `barrera`, `listaBlanca` |

### Comportamiento

Se escribe desde cero. **No se copia del repo anterior**: el punto de anclaje es distinto —el hook
corre antes de toda llamada a herramienta, no dentro de la página.

- Con la barrera apagada (por defecto en entorno `pruebas`): pasa todo.
- Con la barrera encendida: toda navegación o llamada que no sea de solo lectura se compara con la
  lista blanca. Lo que no case, se detiene y se pregunta, **diciendo a qué entorno apunta**.
- Los patrones de lista blanca se escapan correctamente antes de convertirse en expresión regular
  (una URL con `?` es un literal, no un cuantificador).

### Secretos

Las credenciales salen de variables de entorno. Antes de que ningún texto llegue al modelo o a un
log, se sustituye cualquier valor que coincida con un secreto conocido por el nombre de su
variable. Test unitario explícito que lo demuestre.

### Verificación

```
npm run lint && npm run typecheck && npm test
```

Test unitario obligatorio: con la barrera encendida y una URL fuera de la lista blanca, la llamada
no se ejecuta.

### Cómo lo pruebas tú

1. Enciende la barrera en Configuración y pon el entorno en `produccion`.
2. Pide algo que implique enviar un formulario. Debe pararse y preguntar, nombrando el entorno.
3. Di que no. No debe enviarse nada.
4. Añade la URL a la lista blanca y repite. Debe pasar sin preguntar.
5. Mira los logs: la contraseña no aparece en ningún sitio.

---

# Bloque 6 — Las dos puertas: Gherkin editable y visor de diff

Las dos pantallas donde tú decides.

### Ficheros

| Fichero | Cambio |
|---|---|
| `src/Redactar.tsx` | Tres paneles con datos reales; edición inline del `.feature` |
| `src/Generar.tsx` | Árbol de ficheros, visor de diff, aceptar/descartar |
| `server/git.ts` | Nuevo. `diff` y `commit` |
| `server/app.ts` | Rutas de escenarios, ficheros y diff |

### Redactar

Panel izquierdo: los `.feature` del repo. Centro: el escenario seleccionado, **editable en sitio**.
Derecha: la conversación. Al terminar la primera puerta el agente se detiene y la interfaz muestra
el Gherkin propuesto con **Adelante** y **Corregir**.

### Generar

Panel izquierdo: los `.page.ts` y `.spec.ts`, marcando los nuevos y modificados. Centro: en modo
normal el fichero; tras una ejecución, **el diff**. Botones **Aceptar** (commit) y **Descartar**
(revertir en el árbol de trabajo).

### Verificación

```
npm run lint && npm run typecheck && npm test
```

### Cómo lo pruebas tú

1. Pide un test nuevo. Debe pararse en el Gherkin.
2. Edita una frase del escenario y pulsa **Adelante**. El `test.step` del `.spec.ts` debe llevar
   **tu** frase, no la suya.
3. Al terminar, revisa el diff y pulsa **Descartar**. Los ficheros deben desaparecer.
4. Repite y pulsa **Aceptar**. `git log` debe tener el commit.

---

# Bloque 7 — Ejecutar y Reparar con datos reales

### Ficheros

| Fichero | Cambio |
|---|---|
| `server/reporter.ts` | Nuevo. Lee el JSON de Playwright |
| `src/Ejecutar.tsx` | Lista de tests, detalle paso a paso, captura y traza |
| `src/Reparar.tsx` | Solo los rojos, con el veredicto |

### Reparar: la distinción que importa

Por cada test rojo, el agente clasifica **antes de tocar nada**:

| Veredicto | Qué pasa |
|---|---|
| Fallo del test | Corrige el localizador y reejecuta |
| **Fallo de la aplicación** | **No se toca ningún fichero.** Se informa con el motivo |

Esa garantía va cubierta por test unitario: con veredicto de fallo de aplicación, ninguna escritura.

Cada test rojo se procesa aislado: un error reparando uno no puede abortar la reparación de los
demás.

### Verificación

```
npm run lint && npm run typecheck && npm test
```

### Cómo lo pruebas tú

1. Rompe a mano un localizador de un Page Object ya generado.
2. Pestaña Reparar → debe decir **fallo del test**, arreglarlo y ponerlo verde.
3. Ahora cambia la aserción para que espere algo que la web no hace (`toHaveText('9')`).
4. Debe decir **fallo de la aplicación** y **no modificar nada**. Comprueba con `git status`.

---

# Bloque 8 — Reports, Dashboard y trazabilidad

### Ficheros

| Fichero | Cambio |
|---|---|
| `server/trazabilidad.ts` | Nuevo. Cruza pasos del `.feature` con `test.step` |
| `src/Redactar.tsx` | Cada escenario muestra qué test lo cubre y de qué color está |
| `src/Reports.tsx` | Historial, fallos agrupados, tests inestables, coste |
| `src/Dashboard.tsx` | Números nuevos |

### Trazabilidad

Cruce por texto: cada paso del `.feature` contra los `test.step` del `.spec.ts`. Un escenario sin
test aparece **no cubierto**. Un escenario cuyos pasos ya no casan aparece **desincronizado**.

### Dashboard

Las seis cajas pasan a: escenarios cubiertos · tests en verde · tests en rojo · última ejecución ·
coste acumulado · elementos marcados como frágiles. Y se retira el texto que hoy menciona «Bloque
3» al usuario (`src/Dashboard.tsx:110`).

### Coste

El SDK reporta lo gastado al final de cada ejecución. Se lee ese campo y se acumula en un JSON del
repo. **Sin base de datos.**

### Verificación

```
npm run lint && npm run typecheck && npm test
```

### Cómo lo pruebas tú

1. Redactar: cada escenario debe decir qué test lo cubre y su color.
2. Escribe un `.feature` a mano sin test → aparece **no cubierto**.
3. Cambia una frase de un escenario ya cubierto → **desincronizado**.
4. Reports debe tener datos reales tras dos o tres ejecuciones.

---

# Bloque 9 — El comando `instalar`

Para trabajar desde la terminal, Codex o Copilot con la misma skill.

### Ficheros

| Fichero | Cambio |
|---|---|
| `bin/agente-qa.mjs` | Subcomando `instalar` |
| `server/instalar.ts` | Nuevo. Genera los cuatro envoltorios |

### Comportamiento

`npx agente-qa instalar` escribe, desde el mismo `skill/SKILL.md`:

| Destino | Fichero |
|---|---|
| Claude Code | `.claude/skills/qa/SKILL.md` y sus referencias |
| Codex | `AGENTS.md` |
| Copilot | `.github/copilot-instructions.md` |

Con `--solo claude|codex|copilot` se escribe uno. Si un fichero existe y no lo generó este comando,
**pregunta antes de tocarlo**.

Recordatorio: para la consola de la web **esto no hace falta**, porque el paquete apunta a su propia
skill por la opción `plugins`.

### Verificación

```
npm run lint && npm run typecheck && npm test && node bin/agente-qa.mjs instalar --solo codex
```

### Cómo lo pruebas tú

1. `npx agente-qa instalar` en `pruebas/sauce/`.
2. Abre una terminal ahí y lanza `claude`. Pide un test. Debe comportarse igual que en la web.
3. Si tienes Codex o Copilot a mano, la misma petición con el `AGENTS.md` generado.

---

## Lo que NO entra en esta spec

Anotado para que no se cuele por la puerta de atrás:

- **Cucumber real.** El Gherkin es documento más `test.step`. Si alguna vez hace falta, es otra spec.
- **Multi-proyecto.** Una instancia por repo. Sin lista, sin selector, sin recientes.
- **Otros proveedores de LLM.** Solo Claude. El hueco para añadir otro queda hecho en `agente.ts`.
- **Codex y Copilot desde la consola de la web.** Se usan en su entorno, no desde aquí.
- **Publicar en npm.** Mientras tanto se instala desde GitHub por SHA.
- **Cualquier forma de mapa persistente de la aplicación.** Si más adelante se demuestra que el
  agente pierde tiempo reexplorando, se abre una spec para eso, con el dato delante.

---

## Orden y dependencias

```
1 (skill, test verde)  ── puerta: si falla, se para todo
      │
      ├──► 2 (vaciar) ──► 3 (npx) ──► 4 (consola) ──┬──► 5 (barrera)
      │                                              ├──► 6 (puertas)
      │                                              └──► 7 (ejecutar/reparar)
      │                                                        │
      └────────────────────────────────────────────────────────┴──► 8 (reports) ──► 9 (instalar)
```

Los bloques 5, 6 y 7 son independientes entre sí y se pueden despachar en paralelo una vez cerrado
el 4.

---

## Criterio de «hecho» para la spec entera

Desde un repo limpio, con Claude Code logueado y nada más:

```
npm i -D agente-qa
npx agente-qa
```

Escribir *«quiero probar que se puede añadir un producto al carrito»* y obtener un `.feature`, un
`.page.ts` y un `.spec.ts` ejecutados y en verde, revisados en un diff y commiteados — sin tocar
código en ningún momento.
