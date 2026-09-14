# Agente-QA-Web

## Qué es esto

Escribes en castellano lo que quieres probar. Sale un test de Playwright que **ya se ha ejecutado y
está verde**. Todo pasa por una consola de chat en una web local: sin YAML ni configuración manual
de Playwright, el agente redacta el escenario, genera el `.spec.ts`, lo ejecuta y, si falla, propone
la corrección.

> El estado interno del proyecto (qué bloques están cerrados, decisiones tomadas) vive en
> `ESTADO.md`; la cola de trabajo en `PROXIMOS-PASOS.md`. Esta página no se toca para eso — solo
> para "cómo arranco esto y qué hago".

## Usarlo en tu web

Necesitas Node.js 22+ y una sesión de Claude Code iniciada en el ordenador (`claude login`, una vez
— usa tu suscripción, no hace falta `ANTHROPIC_API_KEY` ni ninguna clave en el repo). Desde la raíz
del repo de la aplicación que quieres probar:

```bash
npx agente-qa
```

La primera vez, un asistente te lleva de la mano: comprueba Node, la sesión de Claude Code y
Playwright (lo instala si le dices que sí), pregunta la URL base de tu aplicación y si es un entorno
de pruebas o uno real (para encender la barrera de escrituras), si quieres guardar un usuario de
prueba, y si quieres instalar la skill para usarla también desde tu propia terminal sin pasar por la
web. Cada pregunta tiene un valor por defecto seguro; puedes repetirlo cuando quieras con:

```bash
npx agente-qa iniciar
```

Las siguientes veces (o si ya existe `agente-qa.config.json`), `npx agente-qa` arranca la web
directamente, sin volver a preguntar.

### El doctor

```bash
npx agente-qa doctor
```

Comprueba sesión de Claude Code, binario del SDK, versión de Node y Playwright. Si algo falta, te da
el comando exacto para arreglarlo. Es el mismo diagnóstico que ves en la pestaña Configuración.

### Instalar la skill en otro repo (para usarla desde su propia terminal, sin la web)

```bash
npx agente-qa instalar
```

Genera `.claude/skills/qa/`, `AGENTS.md` y `.github/copilot-instructions.md` en el repo destino.
`--solo claude|codex|copilot` para escribir solo uno.

## Cómo se usa la interfaz

Todo pasa por **una única consola de chat**, a la derecha de la pantalla, siempre a la vista junto a
la pestaña activa (sin botones para bajar/subir: las dos zonas caben ya en la misma fila). Escribes
ahí lo que quieres probar, en castellano y en una sola frase con todo lo necesario, por ejemplo:

> Añade un producto al carrito en SauceDemo

- Tu propio mensaje aparece al instante en el hilo; el chat baja solo hasta el último mensaje, no
  hace falta hacer scroll a mano.
- Las respuestas del agente aparecen en un bocadillo verde a la izquierda, el tuyo en uno naranja a
  la derecha — como cualquier chat.
- Mientras trabaja, se ve un indicador "🤖 trabajando…" y una narración legible de lo que va
  haciendo (no un volcado técnico).
- Si necesita decidir algo ambiguo, pregunta con opciones numeradas: elígela con el ratón, con las
  flechas ↑↓ + Enter, o pulsando su número — la primera opción llega con el foco puesto, como una
  respuesta por defecto. Si ninguna encaja, escribe tu propia respuesta en la caja de abajo.
- Al terminar, el resultado se resalta en un bloque aparte.
- **Puedes seguir la conversación**: un segundo mensaje recuerda lo que hablasteis antes, no hace
  falta repetir el contexto desde cero.

**La primera vez que abres la app aterrizas en la pestaña «Empezar»**, que te dice si te falta algo
por configurar y qué escribir primero. Cuando ya no la necesites, el botón «No volver a mostrar esta
pestaña al abrir» hace que la app arranque donde arrancaba antes; la pestaña sigue ahí por si
quieres volver.

Las ocho pestañas de la izquierda muestran lo que el agente va dejando en el repo. No tienen su
propia caja de texto de chat (toda la conversación va a la consola), pero en Redactar, Generar y
Reparar el contenido de cada fichero se ve completo y es editable a mano, guardes o no cambios; las
listas se refrescan solas en cuanto el agente termina un turno, no hace falta recargar la página:

| Pestaña | Qué muestra |
|---|---|
| **Empezar** | Si te falta algo por configurar (sesión, Playwright, URL, credenciales) y cómo se arregla; tus tres primeros pasos, con un botón que escribe la petición de ejemplo en la consola; y qué hace cada pestaña |
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles |
| **Redactar** | Los `.feature` generados, editables a mano, con badge de cobertura por fichero |
| **Generar** | Los `.page.ts` y `.spec.ts`, contenido completo editable, con el visor de diff debajo (Aceptar/Descartar) cuando hay cambios pendientes frente al commit |
| **Ejecutar** | La lista de tests (título = fichero `.spec.ts`) con botón ▶ por fila y un "▶ Ejecutar todos" arriba para lanzar Playwright de verdad desde la web, viendo la salida aparecer línea a línea mientras corre; el detalle junta los pasos del Gherkin con el código del spec, en la misma pestaña |
| **Reparar** | Solo los tests en rojo: veredicto sugerido (fallo del test o de la app), el `.spec.ts` completo editable, y el diff de corrección propuesto (Aplicar y reejecutar/Rechazar) |
| **Reports** | Historial de ejecuciones, fallos agrupados por causa, tests inestables, pass rate |
| **Configuración** | URL base, entorno y barrera de escrituras; credenciales de prueba (usuario/contraseña o cualquier variable con nombre libre); diagnóstico en vivo de las cuatro comprobaciones del `doctor` |

Los ficheros se generan en `tests/` del repo destino, así que se versionan junto a la aplicación que
prueban.

## Trabajando contra una aplicación real

Explorar significa pulsar botones de verdad: crear pedidos, mandar correos, borrar cosas. Por eso hay
un interruptor por repo, en **Configuración**:

- **Apagado** (por defecto en entornos de prueba): barra libre.
- **Encendido**: cualquier envío que no esté en tu lista blanca se detiene y te pregunta, diciéndote
  a qué entorno apunta.

### Credenciales de prueba

En **Configuración → Credenciales** puedes guardar usuario/contraseña o cualquier otra variable con
nombre libre (p.ej. `USUARIO_ADMIN`). El agente las recibe directamente: pídeselas por su nombre en
la petición ("entra como admin") sin tener que pegarlas en el chat. Viven en
`agente-qa.credenciales.json`, en la raíz del repo destino, **nunca versionado** (esta app se
asegura de que su `.gitignore` lo excluya en cuanto guardas la primera). Nunca salen en claro por el
chat ni por ningún log: se redactan igual que cualquier secreto de entorno.

Al ejecutar tests desde la pestaña **Ejecutar**, esas mismas variables se pasan también como entorno
del proceso de Playwright — si el `.spec.ts` las lee con `process.env.<NOMBRE>` en vez de tenerlas
escritas a fuego, la ejecución real las encuentra igual.

## Desarrollar este proyecto

```bash
git clone https://github.com/Nicolascarames/Agente-QA-Web.git
cd Agente-QA-Web
npm install
npm run empezar
```

`npm run empezar` repite los mismos pasos 1–3 del asistente de arriba (Node, sesión, binario del
SDK), compila si hace falta y te deja elegir `pruebas/sauce/` (repo de pruebas contra
[SauceDemo](https://www.saucedemo.com), ya montado, fuera de git) como proyecto de tests antes de
levantar **dos procesos**: Vite (cliente, `http://localhost:5173`) y Fastify (servidor,
`http://localhost:3939`, con `/api/*` proxeado desde Vite). Abre `http://localhost:5173` en el
navegador. Los dos procesos escriben a la misma consola sin prefijo (`[vite]`/`[server]`): si ves
solo el arranque de Vite y nada del servidor, tarda unos segundos en aparecer, es normal.

**Si la página carga pero todo lo que empieza por `/api/` falla** (Dashboard vacío, consola sin
respuesta, "Error: /api/proyecto respondió 500"): el servidor (puerto 3939) no arrancó o quedó
zombi. Compruébalo con:

```bash
curl http://localhost:3939/api/proyecto
```

Si no responde nada, casi siempre son procesos `node` huérfanos de una sesión anterior (ni `npm run
empezar` ni `npm run dev` imprimen nada al morir, siguen "abiertos" sin escuchar en el puerto).
Ciérralos todos y vuelve a lanzar limpio:

```bash
# PowerShell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Si tras eso sigue sin arrancar, arranca el servidor aparte, en otra terminal, para ver el error real:

```bash
npx tsx server/index.ts
```

### Verificación del propio código de este repo

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Los cuatro deben salir en verde antes de dar por buena una sesión de cambios.
