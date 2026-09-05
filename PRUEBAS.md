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
