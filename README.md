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
navegador.

**Si la página carga pero todo lo que empieza por `/api/` falla** (Dashboard vacío, consola sin
respuesta): el servidor (puerto 3939) no arrancó. Compruébalo con:

```bash
curl http://localhost:3939/api/proyecto
```

Si no responde nada, para `npm run dev` del todo y arranca el servidor aparte, en otra terminal,
para ver el error real:

```bash
npx tsx server/index.ts
```

(Puede pasar tras muchos cambios de código seguidos en una misma sesión larga: el proceso que vigila
los ficheros se queda colgado sin avisar. La solución siempre es la misma: parar todo y volver a
lanzar `npm run dev` limpio.)

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

Todo pasa por **una única consola de chat**, fija al fondo de la pantalla (botón `↓ Consola` /
`↑ Arriba` para bajar y subir). Escribes ahí lo que quieres probar, en castellano y en una sola
frase con todo lo necesario, por ejemplo:

> Añade un producto al carrito en SauceDemo

- Tu propio mensaje aparece al instante en el hilo.
- Mientras trabaja, se ve un indicador "🤖 trabajando…" y una narración legible de lo que va
  haciendo (no un volcado técnico).
- Si necesita decidir algo ambiguo, pregunta — a veces con botones, a veces en una frase; contesta
  escribiendo en la misma caja.
- Al terminar, el resultado se resalta en un bloque aparte.
- **Puedes seguir la conversación**: un segundo mensaje recuerda lo que hablasteis antes, no hace
  falta repetir el contexto desde cero.

Las cinco pestañas de la izquierda muestran lo que el agente va dejando en el repo (son de solo
lectura, no tienen su propia caja de texto):

| Pestaña | Qué muestra |
|---|---|
| **Dashboard** | Escenarios cubiertos, verdes, rojos, última ejecución, coste acumulado, elementos frágiles |
| **Redactar** | Los `.feature` generados, editables a mano, con badge de cobertura por fichero |
| **Generar** | Los `.page.ts` y `.spec.ts`, con el visor de diff (Aceptar/Descartar) |
| **Ejecutar** | Los tests con su estado y el detalle paso a paso, con las frases del Gherkin |
| **Reparar** | Solo los tests en rojo, con el veredicto sugerido (fallo del test o de la app) y el diff de corrección |
| **Reports** | Historial de ejecuciones, fallos agrupados por causa, tests inestables, pass rate |
| **Configuración** | URL base, entornos, y el interruptor de la barrera de escrituras |

Los ficheros se generan en `tests/` del repo destino, así que se versionan junto a la aplicación que
prueban.

## Trabajando contra una aplicación real

Explorar significa pulsar botones de verdad: crear pedidos, mandar correos, borrar cosas. Por eso hay
un interruptor por repo, en **Configuración**:

- **Apagado** (por defecto en entornos de prueba): barra libre.
- **Encendido**: cualquier envío que no esté en tu lista blanca se detiene y te pregunta, diciéndote
  a qué entorno apunta.

Las credenciales salen siempre de variables de entorno y nunca aparecen en un log ni viajan al
modelo (se redactan automáticamente).

## Verificación del propio código de este repo

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Los cuatro deben salir en verde antes de dar por buena una sesión de cambios.
