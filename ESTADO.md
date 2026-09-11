# ESTADO — Agente-QA-Web

Actualizado: 2026-09-11

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

**Nada del plan nuevo está implementado.** Lo que existe es una cáscara de interfaz de la que se
aprovecha esto:

| Pieza | Fichero |
|---|---|
| Tokens de color y tipografía, autocontenidos, fuente propia sin CDN | `src/tokens.css` |
| Guard de estilos en build — falla si el CSS usa una variable no definida | `scripts/comprobar-estilos.mjs` |
| Estructura Fastify + SSE (las rutas, no su contenido) | `server/app.ts` |
| Canal de eventos: `EventoNdjson`, `type` como texto libre a propósito | `shared/tipos.ts:191` |
| Resolución del proyecto por `cwd` | `server/proyecto.ts:24-33` |
| La caja de texto de la consola y el pintado de líneas | `src/ConsolaGlobal.tsx` |
| La maqueta y el estilo de siete pestañas | — |

El resto se borra en el Bloque 2. La lista exacta está en la spec.

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
