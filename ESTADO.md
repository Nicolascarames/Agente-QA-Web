# ESTADO — Agente-QA-Web

Actualizado: 2026-09-08

## Qué es esto

Interfaz web local para `Agente-QA-MCP`: se abre dentro de la carpeta de un proyecto QA, lee su estado
del disco y lanza el CLI como subproceso. Repo hermano nuevo, nace con el Bloque 3 de
`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`.

La spec de la interfaz web (`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`) está
**cerrada entera**: sus 7 bloques, más la revisión final de rama que encontró y corrigió 3 fallos de
interacción entre bloques.

## Qué funciona hoy

### La cáscara (Bloque 3)

- Servidor Fastify en `127.0.0.1:3939`, resuelve el proyecto activo por `--project <ruta>` (argv) →
  `AGENTE_QA_PROJECT` (env, lo usa `npm run dev`) → `cwd`.
- `GET /api/estado` lee el disco del proyecto activo con los tipos/parser de `agente-qa-contract`:
  cuenta pantallas, localizadores y candidatos de escenario de `map.json`, y el estado
  (`no existe`/`borrador`/`listo`) de `.agente-qa/features/`, `e2e/` y `playwright-report/`. Si no hay
  `.agente-qa/` en absoluto, lo dice explícitamente (`agenteQaInicializado: false`).
- `POST /api/init` lanza `agente-qa-mcp init` en la carpeta del proyecto y devuelve su salida.
- `GET/POST /api/proyecto` — lee/cambia el proyecto activo, mantiene recientes en
  `%APPDATA%/agente-qa-web/recientes.json`.
- Frontend con 8 pestañas navegables (Dashboard, Configuración, Explorar, Redactar, Generar, Ejecutar,
  Reparar, Reports), paneles arrastrables/redimensionables con memoria en `localStorage`
  (`Panel.tsx`, sobre `react-rnd`), paleta y tipografía portadas del standalone
  (`Agente-QA-MCP/inspiraciones/QA Agent (standalone).html`) en `src/tokens.css` + Tailwind.
- Dashboard lee `/api/estado` y `/api/actividad` de verdad; ofrece "ejecutar init" si falta
  `.agente-qa/`. Redactar/Generar/Ejecutar/Reparar muestran su precondición y el botón principal
  deshabilitado con el motivo. Reports está vacío con su motivo.

### Configuración funcional (Bloque 4)

- `GET/PUT /api/config/{proyecto,global}` leen y escriben las dos capas de configuración por las rutas
  canónicas (proyecto: `projectPaths()` del contrato; global: réplica propia, sin importar código de
  `Agente-QA-MCP`, de la fórmula de su carpeta de config). Cada valor viaja marcado con su capa
  (entorno/proyecto/global); lo que viene del entorno no se puede editar desde la web.
- `GET /api/claves`, `PUT /api/claves/:proveedor`, `POST /api/claves/:proveedor/ver` — claves de los 4
  proveedores enmascaradas (solo 4 últimos caracteres) en el listado; la clave completa solo viaja por
  la ruta `/ver`, explícita, nunca a un log.
- `server/cli.ts` localiza el binario `agente-qa-mcp` (PATH → repo hermano compilado al lado → ruta
  guardada en `%APPDATA%/agente-qa-web/`), usado por `POST /api/doctor` y `POST /api/llm-ping`.
- `src/Configuracion.tsx`: dos secciones ("Este proyecto" / "Global"), credenciales de la app bajo test
  con el mismo enmascarado que las claves, guardado que solo manda los campos que el usuario tocó (no
  inventa valores ni pisa campos bloqueados por entorno).

### Explorar en vivo, las cuatro puertas (Bloque 5)

- `server/corridas.ts` lanza `snapshot`/`record`/`record --auto`/`map` como subproceso con `--json`
  (canal NDJSON del Bloque 1 de `Agente-QA-MCP`), una corrida activa por proyecto, historial en
  memoria para quien se conecte tarde por `GET /api/eventos` (SSE).
- `POST /api/explorar` (puerta + ámbito + objetivo/URL), `POST /api/detener` (manda `control.stop` por
  el canal del Bloque 2, con 5s de gracia antes de matar el proceso).
- `src/Explorar.tsx`: árbol del mapa (pantallas + candidatos de escenario, de solo lectura) + detalle
  de la selección + registro en vivo, en paneles arrastrables. `src/BarraLanzamiento.tsx`: las cuatro
  puertas siempre visibles con su coste declarado en texto claro.
- `GET /api/mapa` expone localizadores/transiciones reales (vía `parseAppMap` del contrato) para el
  panel de detalle.

### Hablarle al agente (Bloque 6)

- `POST /api/mensaje`: con corrida activa, manda `user.message` por el canal del Bloque 2; sin
  corrida, lanza `run "<texto>"` como una corrida nueva (misma vía que `POST /api/explorar`).
- `src/Chat.tsx`: caja de texto siempre activa, integrada en `Explorar.tsx`, reutiliza el mismo SSE del
  registro (nunca una segunda conexión). El mensaje propio del usuario nunca se duplica en el
  registro.

### Corregir un localizador (Bloque 7)

- `PUT /api/mapa/localizador` corrige `kind`/`ts`/`disambiguatedBy` de un localizador ya resuelto
  (referenciado por `screenId`+`locatorName`), revalida el `AppMap` completo antes de escribir (sin
  escritura parcial si queda inválido), y estampa `producedBy: {agent: "web-manual", ...}` — agente
  nuevo añadido a `agente-qa-contract` (0.1.0 → 0.2.0) específicamente para esto.
- `src/DetalleLocalizador.tsx`: editor estructurado (desplegable de `kind`, campo de `ts`,
  `disambiguatedBy`), resto de campos de solo lectura, deshabilitado con motivo mientras hay una
  corrida activa (evita pisarse con una fusión en marcha).
- Los candidatos **sin resolver** de `screen.ambiguous[]` quedan fuera de este bloque; su resolución es
  la Spec 6 de `Agente-QA-MCP` ("Localizadores que no se rinden"), todavía sin construir.

### Correcciones de la revisión final de rama

- Si el subproceso del CLI termina sin emitir un evento terminal real (p. ej. "Detener" sobre la
  puerta Instantánea, que no atiende `control.stop`; o cualquier crash), `corridas.ts` sintetiza y
  difunde `operation.stopped`/`operation.error` antes de limpiar su estado, para que la web nunca se
  quede "corriendo" para siempre.
- Al terminar una corrida, sus conexiones SSE se cierran explícitamente para que un observador en otra
  pestaña reconecte solo y enganche con la corrida siguiente.

### Catálogo editorial y guía integrada (spec `2026-09-07-guia-integrada-y-consola-asistida.md`, Bloques 2-9)

- `src/catalogo/` — 17 fichas editoriales escritas a mano (`comandos.ts`) cruzadas con
  `cli.generado.json` (generado por `npm run catalogo:sync` desde `agente-qa-mcp catalog --pretty`)
  en `catalogo.ts`. Un test guard vivo (`catalogo.cli-vivo.test.ts`) ejecuta el binario real de
  `agente-qa-mcp` y falla si el JSON se desincroniza del código; se salta con aviso si el binario no
  está localizable en esta máquina (`catalogo.test.ts` es el guard que corre siempre).
- Bajo cada pestaña, `<main>` apila tres bandas de la misma altura con scroll de rueda entre ellas
  (Bloque 3): la pestaña activa, la consola global, y `GuiaPestana` con la ficha plegada de cada
  comando de esa pestaña. Botones "↓ Consola y guía" / "↑ Arriba" saltan directamente entre bandas.
- `CajonFicha.tsx` (Bloque 4): cajón de detalle por la derecha con la plantilla completa de una
  ficha (una línea, "Qué hace"/"Qué deja"/"Cuándo usarlo"/"Cuándo NO", opciones reales con su matiz
  editorial, ejemplos, notas). Los ejes de cabecera cambian si el foco (ratón o teclado) está sobre
  una opción con efecto propio (`catalogo/ejesConOpcion.ts`). Foco atrapado, Escape cierra, el foco
  vuelve a quien abrió el cajón.
- `FiltrosGuia.tsx` (Bloque 5): chips por conductor/coste/estado (OR dentro del eje, AND entre ejes,
  semántica en `catalogo/filtrar.ts`) más un buscador de texto y el interruptor "todas las pestañas",
  que amplía el universo de búsqueda a las 17 fichas del catálogo en vez de solo las de la pestaña
  activa.
- Sección "Referencia" en la barra lateral (Bloque 6): `Motor.tsx` (perfiles rápido/experto, `record
  --auto`, modos de coste, precedencia, tabla rol→perfil, escalado, herramientas que ve el modelo, la
  escalera de localizadores, qué se guarda de cada elemento del mapa, la sesión, los frenos en
  producción) e `Instalar.tsx` (cómo instalar y lanzar los dos repos), sobre datos puros de
  `src/catalogo/secciones.ts` — sustituyen a `Agente-QA-MCP/docs/esquema-flujo.html`, archivado.
- `src/consola/analizarLinea.ts` + `Autocompletado.tsx` (Bloque 7): autocompletado de la consola
  global (comandos, subcomandos, flags y valores cerrados como `--env`/`--profile`/`--provider`/
  `--cost-mode`, verificados a mano contra el código de `agente-qa-mcp`), con los ejes de cada
  sugerencia visibles antes de aceptarla.
- `src/consola/validarLinea.ts` + `plantillas.ts` (Bloque 8): valida la línea ya escrita contra el
  catálogo real antes de dejar enviarla (opciones que no existen, con "¿querías decir...?" por
  distancia de Levenshtein); los ejemplos marcados `plantilla: true` se insertan con huecos `<...>`
  que se seleccionan y se van saltando con Tab.

## Qué está a medias

- **Las 4 pestañas sin agente** (Redactar, Generar, Ejecutar, Reparar) y **Reports** siguen honestas
  pero vacías: dependen de agentes que todavía no existen (`redactor`, `generador`, Ejecutor).
- **La resolución de candidatos ambiguos sin resolver** (`screen.ambiguous[]`) — Spec 6 de
  `Agente-QA-MCP`, contingente, con la premisa caducada (revisar antes de retomarla).

## Verificación

`npm run lint` / `typecheck` / `test`. Último estado conocido al cerrar la spec: 67/67 tests en
verde, lint y typecheck limpios (ver el histórico de commits para el detalle bloque a bloque).
