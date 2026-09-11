# ESTADO — Agente-QA-Web

Actualizado: 2026-09-11

## Qué es esto

**El repo del proyecto entero.** Hasta el 2026-09-10 era la interfaz de un CLI hermano
(`AGENTE-QA-MCP`); desde el replanteo del 2026-09-11 ese repo desaparece y este pasa a contener todo:
la skill, el lanzador del agente y la interfaz.

El objetivo: te pones en cualquier repo, escribes `npx agente-qa`, pides un test en castellano y
obtienes un `.feature`, un `.page.ts` y un `.spec.ts` **ejecutados y en verde**.

- Diseño de referencia: el documento «De la frase al test verde»
- Plan vigente: [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md)
- Cola de trabajo: `PROXIMOS-PASOS.md`

---

## El replanteo del 2026-09-11

Quince specs y cero tests generados. El diagnóstico, en una línea: **se convirtió al modelo en una
función** — el programa conducía y le hacía preguntas cerradas por localizador, validaba la respuesta
con `count === 1` y la descartaba si no pasaba. El agente entero, que es lo que funciona, nunca
condujo.

Las tres inversiones del diseño nuevo:

| Antes | Ahora |
|---|---|
| El programa conduce y el modelo contesta | El agente conduce de principio a fin |
| El código juzga el localizador antes de escribirlo | Playwright juzga el test ejecutándolo |
| Hace falta un mapa antes de generar nada | Hace falta una URL |

**Principio que ordena todo**: el código nunca juzga lo que produce el agente. Lo ejecuta, lo enseña,
y el usuario acepta o rechaza.

### Tres repos desaparecen

`AGENTE-QA-MCP`, `Agente_QA` y `agente-qa-contract`. **De ellos no se copia ni una línea.** La
barrera de escrituras y la redacción de secretos se reescriben aquí desde cero (Bloque 5): la barrera
cambia de punto de anclaje, así que copiarla no serviría.

---

## Qué hay en este repo hoy

Nada de la spec nueva está implementado todavía. Esto es el inventario de lo que existe y qué le pasa
a cada pieza.

### Se conserva (verificado fichero a fichero)

| Pieza | Fichero |
|---|---|
| Tokens de color y tipografía, autocontenidos, fuente propia sin CDN | `src/tokens.css` |
| Guard de estilos en build — falla si el CSS usa una variable no definida | `scripts/comprobar-estilos.mjs` |
| Estructura Fastify + SSE (las rutas, no su contenido) | `server/app.ts` |
| Canal de eventos: `EventoNdjson`, declarado en local, `type` como texto libre a propósito | `shared/tipos.ts:191` |
| Resolución del proyecto por `cwd` | `server/proyecto.ts:24-33` |
| La caja de texto de la consola y el pintado de líneas | `src/ConsolaGlobal.tsx` |
| La maqueta y el estilo de siete pestañas | — |

El guard de estilos existe porque la web salió una vez literalmente sin estilos y nadie lo vio. Es de
lo poco que merece heredarse tal cual.

### Se borra en el Bloque 2

| Pieza | Motivo |
|---|---|
| `src/catalogo/` entero + `scripts/sincronizar-catalogo.mjs` | Atado 1:1 a los subcomandos del CLI que desaparece |
| `src/diffMapa.ts`, `src/DetalleLocalizador.tsx`, `server/mapa.ts` | Trabajan sobre `map.json` |
| `src/Explorar.tsx` | Es el árbol del mapa y las cuatro puertas |
| `server/corridas.ts`, `server/cli.ts` | Lanzan y localizan el CLI |
| `TarjetaResumen` en la consola | Cuenta pantallas y localizadores |
| Tipos de mapa de `shared/tipos.ts` | — |
| Selector de proyecto y recientes en `%APPDATA%` | Lo sustituye la instancia por repo |
| Dependencia `agente-qa-contract` | Son cuatro símbolos y los cuatro son de `map.json` |

### Hay que arreglar a propósito

Casi toda la deuda documentada muere sola con lo anterior. **Dos cosas sobreviven:**

- El indicador «● en curso» se queda encendido al terminar — efecto de React sin limpieza al
  desmontar.
- `operation.completed/stopped/error` escrito a mano en tres sitios (`server/corridas.ts:73`,
  `src/Explorar.tsx:11`, `src/useCorridaGlobal.ts:6`). Pasa a ser una constante compartida en
  `shared/eventos.ts`.

---

## Decisiones cerradas

| Cuestión | Decisión |
|---|---|
| Vocabulario | **Ejecución**, nunca «corrida» |
| Orden de localizadores | Trece niveles con `getByRole` primero. Detalle en la spec |
| Elementos repetidos | `ENTIDAD → PADRE/CONTEXTO → ACCIÓN`. Nunca por índice |
| Gherkin | Documento `.feature` + `test.step` con las mismas frases. Sin Cucumber |
| Alcance | Una instancia por repo. Sin lista de proyectos |
| El fichero ya existe | Ampliar sin pisar métodos. Preguntar solo si hay conflicto real |
| El test no llega a verde | Tres intentos, luego se entrega en rojo con la explicación. Nunca se borra el trabajo |
| Fallo de la aplicación | No se toca nada. Se informa. Es un bug encontrado |
| Proveedor | Solo Claude, por la suscripción del usuario. El hueco para otro queda hecho |
| Convenciones de la skill | Buenas prácticas estándar, afinadas con lo que se rechace |

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

---

## Verificación

`npm run lint` / `typecheck` / `test` / `build`. El guard `comprobar-estilos.mjs` corre tras
`vite build` y no se toca.

Último estado conocido (2026-09-05, antes del replanteo): 67/67 tests en verde, lint y typecheck
limpios. **Ese número va a bajar mucho en el Bloque 2**, que borra código y sus tests con él.
