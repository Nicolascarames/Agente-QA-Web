# De cero a la web abierta — instalación guiada y publicación

Fecha: 2026-09-12
Estado: aprobado, pendiente de plan de implementación

Hoy, alguien que llega a este proyecto no tiene por dónde empezar: el paquete no arranca recién
instalado, no hay ningún comando que le guíe, y no existe ninguna versión publicada. Esta spec cubre
las dos caras del mismo problema —**cómo se instala** y **cómo se distribuye**— porque la segunda
determina la primera.

## El objetivo

Dos frases, una por tipo de persona:

- **Quien quiere probar su web**: ejecuta `npx agente-qa` en su repo y la consola le lleva de la mano
  hasta tener la interfaz abierta en el navegador, configurada, sin haber leído documentación.
- **Quien desarrolla este proyecto**: `git clone`, `npm install`, `npm run empezar`, y tiene el
  entorno levantado.

## Decisiones tomadas (entrevista del 2026-09-12)

| Cuestión | Decisión |
|---|---|
| A quién guía el asistente | A los dos, con un motor único y dos ramas |
| Autonomía del asistente | Arregla lo que puede, **preguntando antes de cada paso**. Lo que no puede arreglar, lo explica con el comando exacto |
| Relación con `npx agente-qa` | La primera vez (sin config) asiste y luego levanta la web; después arranca directo, como hoy. `npx agente-qa iniciar` lo repite a mano |
| Canal de distribución | npm como canal real; tag de git que dispara una GitHub Action que verifica, publica y crea la Release |
| Visibilidad del repo | Público el día de la primera publicación, no antes |
| Nombre y versión | `agente-qa`, empezando en **1.0.0** |

## Hechos verificados que condicionan el diseño

Comprobados contra el registro y la documentación oficial el 2026-09-12, no de memoria:

- **`agente-qa` está despublicado desde el 2026-09-12 a las 11:26 UTC.** Era el CLI del monorepo
  `Agente_QA` (`cli/package.json`, última versión `0.1.6`). La política de npm impone dos cosas: no
  se puede publicar nada con ese nombre **hasta que pasen 24 h** (≈ 2026-09-13, 13:26 hora
  peninsular), y las versiones `0.1.0`–`0.1.6` **no se pueden reutilizar jamás**. Por eso 1.0.0.
- **El trusted publishing de npm se configura desde la página del paquete**, que no existe mientras
  el paquete no esté publicado. La documentación no cubre el caso del paquete nuevo. Consecuencia
  práctica: **la 1.0.0 se publica a mano** y la Action se hace cargo desde la 1.0.1. La alternativa
  (guardar un `NPM_TOKEN` como secreto de GitHub para que la Action publique también la primera) se
  descarta: un token almacenado a cambio de ahorrarse un único comando manual.
- **La procedencia verificada (`provenance`) exige repositorio público y paquete público.** Un repo
  privado no la genera aunque el paquete sea público. Encaja con la decisión de abrir el repo el día
  de publicar.
- **Orden de hooks de npm en `npm install` de la raíz**: `preinstall` → `install` → `postinstall` →
  `prepublish` → `preprepare` → `prepare` → `postprepare`. `prepare` corre **después** de
  `postinstall`, y `postprepare` existe. Esto decide desde qué hook se imprime cada cartel: el de
  desarrollo tiene que ir en `postprepare` o quedaría sepultado bajo la salida del build.
- **`prepare` corre en tres situaciones**: `npm install` local sin argumentos, antes de empaquetar
  (`npm pack`/`npm publish`), y al instalar el paquete desde una URL de git (npm instala las
  devDependencies, ejecuta `prepare` y luego empaqueta). **No corre** al instalar desde el registro.
  Esa es exactamente la distribución de trabajo que necesitamos.
- **Preguntar desde un `postinstall` cuelga los procesos desatendidos** (CI, `npm ci`). El hook solo
  puede imprimir; toda interacción vive en un comando explícito.

---

## Pieza 1 — Empaquetado

Sin esto, nada de lo demás funciona: [`bin/agente-qa.mjs`](../../../bin/agente-qa.mjs) importa de
`dist-server/`, y `dist-client/`/`dist-server/` están en `.gitignore`.

En `package.json`:

- `name`: `agente-qa-web` → **`agente-qa`**.
- `version`: `0.1.0` → **`1.0.0`**.
- `files`: `["bin", "dist-client", "dist-server", "skill", "README.md"]`.
  **`skill/` tiene que viajar dentro del tarball.** Es de donde `server/agente.ts` carga el plugin
  del SDK y de donde `server/instalar.ts` copia al repo destino; las dos resuelven la ruta dos
  niveles por encima de `dist-server/server/`, es decir la raíz del paquete. Si `skill/` se queda
  fuera, el agente arranca sin skill y el fallo no aparece hasta la primera petición real.
- `repository`, `homepage`, `bugs`, `keywords`. `repository.url` debe coincidir **exactamente** con
  la URL del repo: el trusted publishing lo compara.
- `prepare`: `"npm run build"`.

Y `scripts/bienvenida.mjs`, un cartel de cuatro líneas que **no pregunta nada**:

| Hook | Cuándo | Qué imprime |
|---|---|---|
| `postinstall` | Solo si es instalación global (`npm_config_global === "true"`) | «Instalado. Ve al repo de tu web y ejecuta `agente-qa`» |
| `postprepare` | Solo si el proyecto raíz es este mismo repo (`INIT_CWD` === raíz del paquete) | «Compilado. Ahora `npm run empezar`» |
| — | Cualquier otro caso (dependencia de otro proyecto, caché de `npx`) | Nada. Silencio |

El cálculo de qué cartel toca es una función pura de las variables de entorno, separada del `console.log`,
para poder testear los tres casos sin instalar nada.

## Pieza 2 — El asistente

`server/asistente.ts`, con entrada/salida inyectable: el mismo patrón que ya usan
[`server/doctor.ts`](../../../server/doctor.ts) y [`server/instalar.ts`](../../../server/instalar.ts),
que se testean sin terminal real. `bin/agente-qa.mjs` conecta la terminal de verdad.

**No contiene lógica nueva.** Es un director de orquesta sobre lo que ya existe: `ejecutarDoctor`,
`escribirConfigRaiz`, `escribirCredenciales`, `instalar`. Cualquier comprobación que el asistente
necesite y el `doctor` no tenga, se añade al `doctor` —no al asistente—, para que la interfaz de
Configuración la herede sola.

La rama se elige mirando si el `cwd` es este mismo repo, por el `name` de su `package.json`.

### Rama A — el usuario, en su repo

Se dispara sola desde `npx agente-qa` cuando no existe `agente-qa.config.json`, y a mano con
`npx agente-qa iniciar`.

| # | Paso | Si falta |
|---|---|---|
| 1 | Node ≥ 22 | **No arreglable.** Dice la versión encontrada y de dónde bajar una válida. Aborta |
| 2 | Sesión de Claude Code | **No arreglable.** «Ejecuta `claude login` en otra terminal y pulsa Enter cuando termines», y vuelve a comprobar. Reintentos ilimitados |
| 3 | Binario nativo del SDK | Informativo: si falta, casi siempre es un `npm ci --omit=optional`. Da el comando |
| 4 | Playwright en el repo destino | «¿Lo instalo aquí? (s/N)» → `npm i -D @playwright/test` y `npx playwright install` |
| 5 | URL base de la aplicación | La pregunta y crea `agente-qa.config.json` (comportamiento actual de `asegurarConfigRaiz`) |
| 6 | Entorno y barrera de escrituras | «¿Es un entorno de pruebas o una aplicación real?» Si es real: enciende la barrera y pide la lista blanca |
| 7 | Credenciales de prueba | «¿Guardo un usuario de prueba? (s/N)» → `escribirCredenciales`, que ya añade sola la entrada al `.gitignore` del repo destino |
| 8 | Skill en el repo destino | «¿La instalo para poder usarla también desde tu terminal, sin la web? (s/N)» → `instalar` |
| 9 | Cierre | Resumen de lo configurado, levanta la web e imprime la URL |

### Rama B — desarrollo de este repo

`npm run empezar`:

1. Pasos 1–3 de la rama A, idénticos.
2. ¿Está compilado? Si no existe `dist-server/`, `npm run build`.
3. ¿Contra qué repo trabajamos? Ofrece `pruebas/sauce/` si existe; si no, explica en dos líneas qué
   es y que es opcional.
4. Arranca `npm run dev -- --project <elegido>` e imprime las dos URLs (5173 y 3939) y el aviso de
   procesos zombis que ya está documentado en el README.

### Dos reglas que cruzan las dos ramas

- **Idempotente.** Volver a ejecutarlo nunca rompe nada: cada paso detecta lo ya hecho, imprime un
  `✅ ya estaba` y sigue. Un «no» del usuario en un paso opcional no aborta los siguientes.
- **Sin terminal interactiva no pregunta.** Si `process.stdin.isTTY` es falso, imprime el
  diagnóstico completo y sale con 0 o 1 sin bloquear. Es el criterio que ya tomó el Bloque 9 para
  `instalar`, por la misma razón: no colgar un CI.

## Pieza 3 — Publicación

### `.github/workflows/ci.yml`

En cada push y cada pull request a `main`: `npm ci`, y luego `lint`, `typecheck`, `test`, `build`.

Nota conocida y aceptada: `npm ci` dispara `prepare`, así que el build corre dos veces. Se asume —
el segundo pase verifica el camino de build limpio, que es justo el que falló con `TS5055`.

### `.github/workflows/publicar.yml`

Se dispara **solo** con tags `v*`:

1. Los cuatro comandos de verificación.
2. `npm publish` con `permissions: {id-token: write, contents: read}`, npm ≥ 11.5.1 y Node ≥ 22.14.
   La procedencia se genera sola.
3. Crear la Release de GitHub sobre el tag, con las notas derivadas de los commits.

Si cualquier paso falla, no se publica nada: el tag queda empujado, se corrige y sale la siguiente.

### Ciclo de trabajo resultante

```
npm version minor          # sube package.json y crea el tag
git push --follow-tags     # empuja commit y tag
        ↓
lint → typecheck → test → build → npm publish → Release
```

### Los cuatro pasos manuales, en orden, para mañana

1. **Esperar** a que npm libere `agente-qa` (≈ 2026-09-13, 13:26 hora peninsular).
2. **Poner el repositorio público.**
3. **Publicar la 1.0.0 a mano**: `npm login` y `npm publish`. Es la única vez.
4. **Configurar el trusted publisher** en npmjs.com → página del paquete → Settings → Trusted
   Publisher → GitHub Actions, con organización `Nicolascarames`, repositorio `Agente-QA-Web` y
   fichero de workflow `publicar.yml`.

A partir de ahí, `npm version` + `git push --follow-tags` y nada más.

## Pieza 4 — README

Se invierte el orden. Hoy empieza por el desarrollo de este repo y el usuario final aparece de
pasada, en un apartado que además dice «una vez publicado el paquete, será `npx agente-qa`». Pasa a:

1. **Qué es esto**, en tres líneas.
2. **Usarlo en tu web**: `npx agente-qa` y lo que va preguntando el asistente.
3. **Cómo se usa la interfaz** (el contenido actual, que es bueno, sin tocar).
4. **Desarrollar este proyecto**: `npm run empezar` y los cuatro comandos de verificación.

---

## Verificación

- `npm run lint`, `typecheck`, `test`, `build` en verde.
- Tests nuevos: el cálculo del cartel de bienvenida (los tres casos de entorno); el asistente con IO
  inyectable (rama detectada, paso ya hecho que se salta, «no» que no aborta, `isTTY` falso que no
  pregunta).
- **`npm pack --dry-run`**: confirmar que el tarball lleva `skill/`, `dist-client/` y `dist-server/`.
  Es el fallo silencioso más probable de toda esta tarea.
- Prueba a mano de las dos ramas: la A desde `pruebas/sauce/`, la B desde un clon limpio.
- El primer `npm publish` (paso manual 3) es la verificación real de la Pieza 1.

## Lo que NO entra

- Publicar en otros registros (GitHub Packages) o instalar por URL de git como canal principal. El
  `prepare` deja esa vía funcionando, pero no se documenta como camino recomendado.
- Un `CHANGELOG.md` en el repo. Las notas de cada Release son el registro de cambios.
- Cambiar nada del comportamiento actual de la web, del agente o de la skill. Esta tarea es
  empaquetado, primer arranque y publicación.
