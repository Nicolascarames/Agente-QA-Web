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
