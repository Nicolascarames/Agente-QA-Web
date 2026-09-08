# PRUEBAS — Guía resumida para probar cada función a mano

Un sitio único con **todo lo que puedes probar tú mismo** en este repo, ordenado por bloque
entregable. Cada entrada sigue el mismo formato:

> **Qué es nuevo** → **Qué hace / qué genera** → **Cómo probarlo** (pasos resumidos)

Requisito común: `npm install` desde la raíz de este repo.

---

## Bloque 3 — El repo de la web y la cáscara

**Qué es nuevo**: servidor Fastify, `GET /api/estado`, `POST /api/init`, `GET/POST /api/proyecto`, 8
pestañas navegables con paneles con memoria, Dashboard real.

**Qué hace**: abre la web dentro de la carpeta de un proyecto de `Agente-QA-MCP` y enseña, de verdad,
cuántas pantallas y localizadores tiene su `map.json`, si hay `.agente-qa/`, `e2e/` y
`playwright-report/`. Las otras 6 pestañas se navegan y dicen qué les falta, sin datos inventados.

**Cómo probarlo**:
1. `npm run dev -- --project c:\ruta\a\tu\proyecto` y abrir `http://localhost:5173` en el navegador.
2. Pestaña Dashboard: el panel "Estado del proyecto" enseña el número real de pantallas y
   localizadores de tu `map.json` (si tu proyecto no tiene `.agente-qa/`, verás el aviso y un botón
   "ejecutar init" — pulsarlo lo crea y el panel se recarga solo).
3. El panel "Actividad reciente" dice que depende del Bloque 1 de `Agente-QA-MCP`, no inventa eventos.
4. Mover y redimensionar cualquier panel con la barra superior, recargar la página: sigue donde lo
   dejaste. El botón "restaurar disposición" de ese panel lo devuelve a su sitio de origen.
5. Entrar en Redactar, Generar, Ejecutar o Reparar: cada una explica su precondición y su botón
   principal está deshabilitado con el motivo (pásale el ratón por encima para verlo en el `title`).
6. Entrar en Reports: vacío, con el motivo (necesita al Ejecutor, que no existe).
7. Entrar en Configuración y Explorar: avisan "en construcción — Bloque 4/5".
8. En la cabecera, escribir otra ruta de proyecto y pulsar "Cambiar": el Dashboard recarga con el
   estado del nuevo proyecto y esa ruta aparece en el desplegable de "Recientes…" la próxima vez.

---

## Bloque 4 — Configuración funcional

**Qué es nuevo**: la pestaña Configuración de verdad, con las dos capas (proyecto/global), claves de
API enmascaradas, y los botones de probar proveedor y ejecutar diagnóstico.

**Qué hace**: lee y escribe la configuración por sus rutas reales en disco (nunca inventa nada);
marca cada valor con de dónde viene (variable de entorno, `.env` del proyecto, `.env` global) y no
deja editar lo que viene del entorno; las claves de API y las credenciales de la app bajo test se ven
enmascaradas hasta que pulsas el ojo, y solo entonces se piden completas al servidor.

**Cómo probarlo**:
1. En "Global", cambia el proveedor o el modelo del perfil `rápido` y pulsa "Guardar cambios
   globales" → abre el `.env` global (`%APPDATA%\agente-qa-mcp\.env`) y comprueba que cambió.
2. Pulsa "Probar proveedor" → responde de verdad (modelo, coste, duración), sin que tú tocaras nada
   por consola.
3. En "Este proyecto", pega una clave nueva y pulsa el ojo → la ves entera; recarga la página → vuelve
   enmascarada (solo los 4 últimos caracteres).
4. Exporta una de las variables como variable de entorno del sistema y recarga → aparece marcada como
   "viene del entorno" y el campo no deja editarla.
5. Pulsa "Ejecutar doctor" → sale el mismo diagnóstico que verías por consola con `agente-qa-mcp
   doctor`.
6. Cambia solo el modo de coste (sin tocar los perfiles) y guarda → si algún perfil está bloqueado por
   entorno, el guardado no falla por su culpa: solo se escribe lo que tocaste.

---

## Bloque 5 — Explorar, las cuatro puertas en vivo

**Qué es nuevo**: la pestaña Explorar de verdad — lanzar el explorador y verlo trabajar en directo.

**Qué hace**: las cuatro puertas (instantánea, grabación humana, grabación conducida, bucle agéntico)
siempre visibles con su coste declarado en texto claro; al lanzar, el árbol del mapa va creciendo, el
registro muestra cada evento tal cual llega, y "Detener" corta la corrida en cualquier momento
conservando lo alcanzado hasta ahí.

**Cómo probarlo**:
1. Lanza "instantánea" contra una URL conocida → al terminar, aparece una pantalla nueva en el árbol.
2. Lanza el bucle agéntico con un objetivo en lenguaje normal → las pantallas van apareciendo solas y
   el coste sube mientras trabaja.
3. Lanza la grabación humana → se abre Chromium, navega a mano, pulsa "■ Detener" **en la web** (no en
   la ventana del navegador) → el mapa se escribe con lo que grabaste.
4. Lanza la grabación conducida (con un objetivo) → mismo resultado que la humana, pero sin que la
   conduzcas tú ni gastes ninguna clave de API.
5. Detén una corrida a mitad → lo alcanzado se queda en el árbol; el registro y el botón "Lanzar"
   vuelven a su estado normal (no se quedan "corriendo" para siempre, aunque detengas la puerta
   Instantánea, que no sabe pararse por dentro — la web lo resuelve igualmente por fuera).
6. Con una corrida en marcha, abre la misma web en otra pestaña del navegador (o recarga) → el árbol y
   el registro se enganchan a la corrida ya en marcha sin perder lo anterior; cuando esa corrida
   termine y lances otra, esa segunda pestaña sigue recibiendo eventos sin que tengas que recargarla.

---

## Bloque 6 — Hablarle al agente mientras trabaja

**Qué es nuevo**: la caja de chat dentro de Explorar.

**Qué hace**: siempre está activa. Si no hay nada corriendo, escribir en ella lanza una exploración
nueva en lenguaje libre (equivalente a pedirlo por consola con `run "..."`). Si hay una corrida en
marcha, lo que escribas se le manda al agente y aparece en el registro junto a lo que va haciendo,
sin duplicarse.

**Cómo probarlo**:
1. Sin nada corriendo, escribe "explora el login y el alta de usuarios" y pulsa enviar → arranca la
   exploración como si hubieras pulsado "Lanzar".
2. A mitad de una corrida del bucle agéntico, escribe "deja eso, ve al carrito" → el mensaje aparece
   una sola vez en el registro (no duplicado) y el turno siguiente del agente cambia de rumbo.
3. Deja que una corrida termine del todo y luego manda un mensaje → la web dice explícitamente que la
   corrida ya terminó (o lanza una nueva, según lo que hayas escrito), nunca se pierde en silencio.

---

## Bloque 7 — Corregir un localizador desde el árbol

**Qué es nuevo**: el editor de localizador en el panel de detalle de Explorar.

**Qué hace**: la única edición manual de datos estructurados de toda la web. Corrige el tipo, el
selector y la marca de desambiguación de un localizador ya resuelto, directamente desde el árbol, sin
abrir `map.json` a mano. Solo funciona cuando no hay ninguna corrida en marcha para ese proyecto (para
no pisarse con una fusión en curso).

**Cómo probarlo**:
1. Selecciona en el árbol un localizador marcado como "(ambiguo)" (uno que ya tenga desambiguación
   puesta) y corrígelo desde el panel: cambia el tipo o el selector y pulsa "Guardar corrección".
2. Abre el `map.json` del proyecto en un editor de texto: el cambio está, y el campo `producedBy` dice
   `"agent": "web-manual"`.
3. Con una corrida en marcha, intenta corregir un localizador → el botón está deshabilitado con el
   motivo visible ("no se puede corregir mientras hay una corrida en marcha").
4. Vuelve a explorar esa misma pantalla desde la consola (`agente-qa-mcp map ...`, fuera de la web): tu
   corrección manual no se pierde — la fusión del mapa no pisa lo que ya está verificado.

---

## Revisión final de rama

**Qué es nuevo**: nada visible en la línea de comandos — tres correcciones internas de robustez tras
cerrar los 7 bloques.

**Qué hace**: la web ya no se queda "corriendo" para siempre si el CLI muere sin avisar (p. ej. al
detener una instantánea, que no sabe atender "Detener" por dentro); una corrección de localizador y
una corrida en marcha ya no pueden pisarse; y un observador en otra pestaña del navegador ya no se
queda colgado cuando la corrida que estaba viendo termina y se lanza una nueva.

**Cómo probarlo**: ver los pasos 5 y 6 del Bloque 5, y el paso 3 del Bloque 7 — son justo los
escenarios que esta corrección cubre.

---

## Spec "Guía integrada y consola asistida"

El Bloque 1 de esta spec (`catalog [--pretty]`) toca `agente-qa-mcp`; su guía de pruebas vive en el
`PRUEBAS.md` de ese repo. Aquí, los Bloques 2 a 9, que construyen la guía integrada sobre la consola
global ya existente.

### Bloque 2 — Catálogo editorial de 17 fichas

**Qué es nuevo**: `src/catalogo/` — `comandos.ts` (17 fichas escritas a mano), `cli.generado.json`
(generado desde el CLI real) y `catalogo.ts`, que los cruza.

**Qué hace**: cada comando hoja del CLI (los namespaces `llm`/`mcp` no cuentan, son carpetas sin
acción propia) tiene una ficha editorial con su prosa — qué hace, qué deja, cuándo usarlo/no,
ejemplos, notas — que se cruza con su forma real (argumentos, opciones) leída de `agente-qa-mcp
catalog --pretty`. Un test guard ejecuta el binario real y falla si `cli.generado.json` se queda
atrás del código.

**Cómo probarlo**:
1. Con `agente-qa-mcp` compilado y localizable (en el PATH, como repo hermano compilado al lado, o
   con la ruta guardada), `npm run catalogo:sync` → reescribe `src/catalogo/cli.generado.json` con
   la forma real del CLI de hoy.
2. `npm test` → `catalogo.cli-vivo.test.ts` pasa si ya sincronizaste; si el binario no está
   disponible en esta máquina, se salta con un aviso claro (`catalogo.test.ts`, el guard que sí
   corre siempre, no depende del binario).
3. Cambia a mano el texto de una descripción en `agente-qa-mcp` sin correr `catalogo:sync` y repite
   el guard vivo → falla nombrando que hace falta resincronizar.
4. Abre `src/catalogo/comandos.ts`: 17 fichas, cada una con su `ruta` apuntando a un comando real.

### Bloque 3 — Tres bandas apiladas por pestaña

**Qué es nuevo**: bajo cada pestaña, `<main>` ya no muestra solo su contenido — apila tres bandas de
la misma altura: la pestaña activa, la consola global, y la guía de esa pestaña.

**Qué hace**: puedes bajar de una banda a la siguiente con la rueda del ratón (scroll normal, el
`<main>` es quien hace scroll) o con los botones de esquina "↓ Consola y guía" / "↑ Arriba", que
saltan directamente entre la banda 1 y la 2.

**Cómo probarlo**:
1. Abre cualquier pestaña con contenido (Dashboard, Explorar...) → ves la pestaña arriba, con el
   botón "↓ Consola y guía" en su esquina.
2. Baja con la rueda del ratón (o pulsa ese botón) → llegas a la consola global, ocupando toda la
   banda.
3. Sigue bajando → llegas a la guía de esa pestaña (aquí pintan los filtros y las fichas del Bloque
   5).
4. Desde la banda de la guía, pulsa "↑ Arriba" → vuelve suavemente a la banda 1.
5. Cambia de pestaña en la barra lateral → las tres bandas se repintan para la pestaña nueva; la
   consola global sigue siendo la misma corrida, no se reinicia al cambiar de pestaña.

### Bloque 4 — Cajón de detalle

**Qué es nuevo**: `CajonFicha.tsx`, un panel que se abre por la derecha con la plantilla completa de
una ficha.

**Qué hace**: pulsar cualquier ficha plegada de la guía abre el cajón con su una-línea, "Qué hace" /
"Qué deja" / "Cuándo usarlo" / "Cuándo NO", sus opciones reales (con el matiz editorial si lo tiene)
y sus ejemplos (los marcados como plantilla se pueden insertar en la consola, ver Bloque 8). Pasar el
ratón o el foco de teclado por una opción concreta actualiza los ejes de cabecera al efecto real de
esa opción — por ejemplo, `--auto` en `record` cambia el conductor mostrado. Se cierra con la `X`,
con Escape, o pulsando fuera; el foco queda atrapado dentro mientras está abierto y vuelve a quien lo
abrió al cerrarlo.

**Cómo probarlo**:
1. En la guía de cualquier pestaña, pulsa una ficha → se abre el cajón por la derecha con la
   plantilla completa.
2. Pasa el ratón sobre una opción con efecto propio en los ejes (p. ej. `--auto` de `record`) → la
   cabecera del cajón muestra "con esta opción: ..." y cambian el conductor/coste mostrados.
3. Pulsa Tab varias veces dentro del cajón → el foco nunca se escapa a lo que hay detrás; Shift+Tab
   desde el primer elemento salta al último.
4. Pulsa Escape → el cajón se cierra y el foco vuelve exactamente al botón que lo abrió.
5. Si la ficha tiene un ejemplo marcado como plantilla, púlsalo → el cajón se cierra y el texto
   aparece en la consola global con el primer hueco `<...>` ya seleccionado (enlaza con el Bloque 8).

### Bloque 5 — Filtros por eje y buscador

**Qué es nuevo**: `FiltrosGuia.tsx`, encima de la lista de fichas de la guía.

**Qué hace**: chips por conductor (humano/determinista/llm-api/claude-code), coste
(cero/facturado/suscripción) y estado (construido/pendiente/otro-repo) — varios chips del mismo eje
se combinan con OR, y entre ejes distintos con AND — más una caja de texto que busca por comando,
opción o palabra clave, y un interruptor "todas las pestañas" que amplía la búsqueda a las 17 fichas
del catálogo en vez de solo la pestaña activa. El criterio no se guarda entre pestañas: cambiar de
pestaña lo limpia.

**Cómo probarlo**:
1. En la guía de una pestaña con varios comandos, activa el chip "facturado" → solo quedan las
   fichas con ese coste.
2. Activa además "humano" (otro eje) → ahora exige los dos a la vez (AND entre ejes); activa un
   segundo chip de coste (p. ej. "cero") → se suma al primero (OR dentro del eje), vuelven a
   aparecer fichas con cualquiera de los dos.
3. Escribe algo en el buscador → filtra por texto sobre lo que ya dejaron pasar los chips.
4. Activa "todas las pestañas" → el universo pasa a ser las 17 fichas del catálogo, no solo las de
   la pestaña activa.
5. Cambia de pestaña → los chips y el texto vuelven a su estado vacío.

### Bloque 6 — Sección "Referencia": Motor e Instalar

**Qué es nuevo**: dos pestañas nuevas en la barra lateral, "Motor" e "Instalar" (`Motor.tsx`,
`Instalar.tsx`), sobre datos puros de `src/catalogo/secciones.ts`.

**Qué hace**: sustituyen al antiguo `docs/esquema-flujo.html` de `Agente-QA-MCP` (archivado). "Motor"
explica el funcionamiento interno que no es un comando en sí: los perfiles `rápido`/`experto`,
`record --auto` como caso aparte, los tres modos de coste y quién gana cuando hay conflicto, la tabla
rol→perfil de fábrica, el escalado, las herramientas que ve el modelo, de dónde sale cada localizador
(la escalera de estrategias), qué se guarda de cada elemento del mapa, la sesión, y los frenos en
producción. "Instalar" explica cómo instalar y lanzar los dos repos.

**Cómo probarlo**:
1. Abre "Motor" en la barra lateral → cada sección de la lista de arriba aparece como un bloque con
   su tabla o su prosa (nada de datos inventados: compáralo con `ESTADO.md`/`README.md` de
   `Agente-QA-MCP`).
2. Abre "Instalar" → los pasos para instalar y lanzar `Agente-QA-MCP` y `Agente-QA-Web` coinciden con
   sus propios README.
3. Ninguna de las dos pestañas tiene guía de comandos al pie (no ejecutan nada, solo documentan).

### Bloque 7 — Autocompletado en la consola global

**Qué es nuevo**: `Autocompletado.tsx` sobre la caja de texto de la consola global.

**Qué hace**: mientras escribes, sugiere comandos, subcomandos, flags y, para los flags de valor
cerrado (`--env`, `--profile`, `--provider`, `--cost-mode`, los `--role-*`...), sus valores válidos —
cada sugerencia muestra sus ejes (conductor/coste) antes de aceptarla, para saber lo que implica sin
tener que pulsar Enter.

**Cómo probarlo**:
1. Empieza a escribir un nombre de comando (p. ej. `rec`) → aparece `record` en la lista, con sus
   ejes.
2. Tras aceptarlo, escribe `--` → aparecen los flags reales de `record` (y las opciones globales
   como `--json`).
3. Escribe `--env ` → aparecen exactamente `dev`/`test`/`staging`/`production`, nada inventado.
4. Con la lista abierta: ↑/↓ mueve la marca, Tab o Enter la acepta, Escape la cierra (y volver a
   escribir la reabre), `?` sobre una sugerencia marcada abre su ficha en el cajón de detalle.

### Bloque 8 — Validación en vivo y ejemplos como plantilla

**Qué es nuevo**: `validarLinea.ts` (valida antes de enviar) y `plantillas.ts` (huecos rellenables).

**Qué hace**: antes de dejarte enviar, compara la línea ya escrita contra el catálogo real —un flag
que no existe se avisa con "¿querías decir...?" (por distancia de edición) si hay uno parecido— y
muestra el motivo en el mismo sitio donde antes solo salía el error del servidor; mientras el aviso
esté ahí, ni Enter ni el botón ▶️ mandan nada. Un ejemplo marcado como plantilla en el cajón de
detalle (Bloque 4) se inserta en la consola con el primer hueco `<...>` ya seleccionado; Tab salta al
siguiente hueco sin perder lo que ya escribiste, y en cuanto no queda ninguno, Tab vuelve a
comportarse como siempre (aceptar sugerencia o salir del campo).

**Cómo probarlo**:
1. Escribe un comando real con un flag mal escrito (p. ej. `map --godl "..."`) → aparece un aviso
   rojo bajo la caja con "¿querías decir --goal?" (o similar) y ni Enter ni ▶️ hacen nada.
2. Corrige el flag → el aviso desaparece y el comando se puede enviar.
3. En el cajón de detalle de una ficha con ejemplos, pulsa uno marcado como plantilla (p. ej. de
   `record --auto "<objetivo>"`) → el texto aparece en la consola con `<objetivo>` seleccionado.
4. Escribe encima del hueco seleccionado y pulsa Tab → salta al siguiente hueco si lo hay, o deja de
   interceptar Tab si ya no queda ninguno.

---

## Bloque 9 — Archivar el HTML y cerrar (spec "Guía integrada y consola asistida")

**Qué es nuevo**: nada de código en este repo — cierre de documentación de la spec entera.

**Qué hace**: `Agente-QA-MCP/docs/esquema-flujo.html` se archiva (`git mv` a
`docs/historico/2026-09-07-esquema-flujo.html`, con una nota visible de archivado en su cabecera); la
información que traía vive ya, de verdad, en la guía de los Bloques 2-8 de arriba.

**Cómo probarlo**:
1. `grep -rn "esquema-flujo" .` en los dos repos (fuera de `node_modules`/`dist*`) → solo aparece
   dentro de `docs/historico/` de `AGENTE-QA-MCP` y en las notas que dicen que está archivado.
2. Abre el `README.md` de cada repo: lo que dice de la guía integrada coincide con lo que ves en la
   app.
