# Agente-QA-Web

Escribes en castellano lo que quieres probar. Sale un test de Playwright que **ya se ha ejecutado y
está verde**.

> Esta guía es para levantar la app y probarla a mano en cada sesión. El estado interno del proyecto
> (qué bloques están cerrados, decisiones tomadas) vive en `ESTADO.md`; la cola de trabajo en
> `PROXIMOS-PASOS.md`. Esta página no se toca para eso — solo para "cómo arranco esto y qué hago".

## Qué necesitas antes de empezar

- **Node.js 22 o superior.**
- **Claude Code con sesión iniciada** en este ordenador (`claude login` una vez). Se usa tu
  suscripción: no hace falta `ANTHROPIC_API_KEY` ni ninguna clave en el repo.
- **Playwright** en el repo donde vayas a generar/ejecutar tests (`npx playwright install` si hace
  falta).

Para comprobar las tres cosas de golpe: ver el apartado "El doctor" más abajo.

## Levantar la app en local (modo desarrollo, este repo)

Desde la raíz de este repo:

```bash
npm install                 # una vez
npm run dev -- --project <ruta-a-un-repo-con-tests>
```

Ejemplo real usando el proyecto de pruebas incluido:

```bash
npm run dev -- --project "C:\GitHub\Agente-QA-Web\pruebas\sauce"
```

Esto levanta **dos procesos**: Vite (cliente, `http://localhost:5173`) y Fastify (servidor,
`http://localhost:3939`, con `/api/*` proxeado desde Vite). Abre `http://localhost:5173` en el
navegador. Los dos procesos escriben a la misma consola sin prefijo (`[vite]`/`[server]`): si ves
solo el arranque de Vite y nada del servidor, tarda unos segundos en aparecer, es normal.

**Si la página carga pero todo lo que empieza por `/api/` falla** (Dashboard vacío, consola sin
respuesta, "Error: /api/estado respondió 500"): el servidor (puerto 3939) no arrancó o quedó
zombi. Compruébalo con:

```bash
curl http://localhost:3939/api/proyecto
```

Si no responde nada, casi siempre son procesos `node` huérfanos de una sesión anterior (`npm run
dev` no imprime nada al morir, sigue "abierto" sin escuchar en el puerto). Ciérralos todos y vuelve
a lanzar `npm run dev` limpio:

```bash
# PowerShell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Si tras eso sigue sin arrancar, arranca el servidor aparte, en otra terminal, para ver el error real:

```bash
npx tsx server/index.ts
```

## Usarlo de verdad, sobre un repo cualquiera (no este)

Una vez publicado el paquete, será `npx agente-qa`. Hasta entonces, desde la raíz de **este** repo
pero apuntando a otro:

```bash
node bin/agente-qa.mjs          # arranca sobre process.cwd() — ejecútalo DESDE el repo destino
```

o, para probar sin moverte de aquí, usa `pruebas/sauce/` (repo de pruebas contra
[SauceDemo](https://www.saucedemo.com), ya montado, fuera de git):

```bash
cd pruebas/sauce
node ../../bin/agente-qa.mjs
```

La primera vez pregunta la URL base y crea `agente-qa.config.json` en la raíz de ese repo; las
siguientes veces no repregunta.

### El doctor

```bash
node bin/agente-qa.mjs doctor
```

Comprueba sesión de Claude Code, binario del SDK, versión de Node y Playwright. Si algo falta, te da
el comando exacto para arreglarlo.

### Instalar la skill en otro repo (para usarla desde su propia terminal, sin la web)

```bash
node bin/agente-qa.mjs instalar
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
- Las respuestas del agente se ven en verde claro, distintas del resto de líneas.
- Mientras trabaja, se ve un indicador "🤖 trabajando…" y una narración legible de lo que va
  haciendo (no un volcado técnico).
- Si necesita decidir algo ambiguo, pregunta con opciones numeradas: elígela con el ratón, con las
  flechas ↑↓ + Enter, o pulsando su número — la primera opción llega con el foco puesto, como una
  respuesta por defecto. Si ninguna encaja, escribe tu propia respuesta en la caja de abajo.
- Al terminar, el resultado se resalta en un bloque aparte.
- **Puedes seguir la conversación**: un segundo mensaje recuerda lo que hablasteis antes, no hace
  falta repetir el contexto desde cero.

Las siete pestañas de la izquierda muestran lo que el agente va dejando en el repo. No tienen su
propia caja de texto de chat (toda la conversación va a la consola), pero en Redactar, Generar y
Reparar el contenido de cada fichero se ve completo y es editable a mano, guardes o no cambios; las
listas se refrescan solas en cuanto el agente termina un turno, no hace falta recargar la página:

| Pestaña | Qué muestra |
|---|---|
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles |
| **Redactar** | Los `.feature` generados, editables a mano, con badge de cobertura por fichero |
| **Generar** | Los `.page.ts` y `.spec.ts`, contenido completo editable, con el visor de diff debajo (Aceptar/Descartar) cuando hay cambios pendientes frente al commit |
| **Ejecutar** | La lista de tests (título = fichero `.spec.ts`) con botón ▶ por fila y un "▶ Ejecutar todos" arriba para lanzar Playwright de verdad desde la web; el detalle junta los pasos del Gherkin con el código del spec, en la misma pestaña |
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

## Verificación del propio código de este repo

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Los cuatro deben salir en verde antes de dar por buena una sesión de cambios.
