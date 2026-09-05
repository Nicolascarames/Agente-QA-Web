# ESTADO — Agente-QA-Web

Actualizado: 2026-09-05

## Qué es esto

Interfaz web local para `Agente-QA-MCP`: se abre dentro de la carpeta de un proyecto QA, lee su estado
del disco y lanza el CLI como subproceso. Repo hermano nuevo, nace con el Bloque 3 de
`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`.

## Qué funciona hoy (Bloque 3 — la cáscara)

- Servidor Fastify en `127.0.0.1:3939`, resuelve el proyecto activo por `--project <ruta>` (argv) →
  `AGENTE_QA_PROJECT` (env, lo usa `npm run dev`) → `cwd`.
- `GET /api/estado` lee el disco del proyecto activo con los tipos/parser de `agente-qa-contract`:
  cuenta pantallas, localizadores y candidatos de escenario de `map.json`, y el estado
  (`no existe`/`borrador`/`listo`) de `.agente-qa/features/`, `e2e/` y `playwright-report/`. Si no hay
  `.agente-qa/` en absoluto, lo dice explícitamente (`agenteQaInicializado: false`).
- `POST /api/init` lanza `agente-qa-mcp init` en la carpeta del proyecto y devuelve su salida.
- `GET /api/actividad` devuelve `501` a propósito: depende del Bloque 1 de `Agente-QA-MCP`
  (`agente-qa-mcp metrics --last N --json`), que no está cerrado todavía.
- `GET/POST /api/proyecto` — lee/cambia el proyecto activo, mantiene recientes en
  `%APPDATA%/agente-qa-web/recientes.json`.
- Frontend con 8 pestañas navegables (Dashboard, Configuración, Explorar, Redactar, Generar, Ejecutar,
  Reparar, Reports), paneles arrastrables/redimensionables con memoria en `localStorage`
  (`Panel.tsx`, sobre `react-rnd`), paleta y tipografía portadas del standalone
  (`Agente-QA-MCP/inspiraciones/QA Agent (standalone).html`) en `src/tokens.css` + Tailwind.
- Dashboard lee `/api/estado` y `/api/actividad` de verdad; ofrece "ejecutar init" si falta
  `.agente-qa/`. Redactar/Generar/Ejecutar/Reparar muestran su precondición y el botón principal
  deshabilitado con el motivo. Reports está vacío con su motivo. Configuración y Explorar son
  placeholders navegables ("en construcción — Bloque 4/5").

## Qué está a medias

- **Configuración (Bloque 4)** — configurar proyecto/global, claves de API, doctor, prueba de
  proveedor: todo pendiente, la pestaña solo navega.
- **Explorar (Bloque 5)** — las cuatro puertas al mapa en vivo, con coste y "Detener": pendiente.
- **Bloques 6 y 7** — conversación con el agente a mitad de corrida, edición de localizadores desde el
  árbol: pendientes, dependen de 1/2 (en `Agente-QA-MCP`) y de 5.

## Verificación

`npm run lint` / `typecheck` / `test`. Estado de la última corrida: ver el mensaje de cierre de la
sesión que cerró el Bloque 3 (no hay histórico previo, este repo nace hoy).
