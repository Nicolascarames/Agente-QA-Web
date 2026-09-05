# CLAUDE.md — Agente-QA-Web

Interfaz web local para `Agente-QA-MCP`: se abre dentro de la carpeta de un proyecto QA, lee su estado
del disco y (en bloques futuros) lanza el CLI como subproceso. Repo hermano nuevo, nace en el Bloque 3
de `docs/superpowers/specs/2026-09-05-interfaz-web-v1.md` de `Agente-QA-MCP`.

Estado: solo la cáscara (8 pestañas navegables, paneles con memoria, Dashboard leyendo disco de
verdad). Las otras 6 pestañas son honestas: dicen qué les falta. Detalle en `ESTADO.md`.

## Idioma

Responde y pregunta SIEMPRE en castellano (España). Código e identificadores en inglés cuando el
término ya existe así en el ecosistema (`Fastify`, `estado`); en español cuando es propio del dominio
(`proyecto`, `recientes`). Commits en Conventional Commits (`feat(...): ...`, `fix(...): ...`).

## Qué es esto y qué no es

- **No importa código de `Agente-QA-MCP`**: solo los **tipos** (y el parser) de `agente-qa-contract`,
  vía `import type`/import normal de su paquete, nunca copiando su lógica.
- **Nunca abre `map.json` con código propio fuera de lo que expone el contrato.** `server/estado.ts`
  usa `parseAppMap` y `projectPaths` de `agente-qa-contract`, no interpreta el JSON a mano.
- **El estado no se guarda: se deriva del disco en cada petición** (`GET /api/estado`).
- **Fastify solo escucha en `127.0.0.1`.**
- El CLI (`agente-qa-mcp`) se lanza como subproceso (`cross-spawn`), nunca se importa como librería.

## Arquitectura (decisiones cerradas del Bloque 3, ver la spec)

- Backend: Fastify + TypeScript en `server/`, arrancado con `tsx watch` en dev, compilado a
  `dist-server/` con `tsc -p tsconfig.server.json` en build.
- Frontend: Vite + React + TypeScript en `src/`. En dev, Vite hace proxy de `/api/*` hacia
  `http://127.0.0.1:3939`. En build, `vite build` genera `dist-client/` y Fastify lo sirve como
  estático si existe.
- Un solo `package.json` en la raíz — no es un monorepo.
- Tipos compartidos entre `server/` y `src/` en `shared/tipos.ts` (sin dependencias de Node ni DOM, lo
  importan los dos lados con su propio tsconfig).
- Paneles arrastrables/redimensionables: `react-rnd`, persistencia en `localStorage` por
  pestaña+panel — nunca en el servidor.

## Sesión de EJECUCIÓN — el hilo principal no escribe código

Mismo protocolo que `Agente-QA-MCP`: el hilo principal despacha (`brain-scout`/`brain-implementer`/
`brain-reviewer`/`brain-final-reviewer`, cada uno con su `model`), lee resúmenes y commitea. No lee
código ni edita ficheros directamente. Bloques independientes se despachan en paralelo.

## Verificación — agrupada al cerrar la tarea

- Prohibido: Playwright, MCP de navegador, tests e2e, levantar la app "para comprobar" en el
  navegador. Las pruebas funcionales las hace el usuario.
- Al cerrar la tarea, una sola vez y en este orden: `lint` → `typecheck` → `test` (vitest, servidor y
  funciones puras — sin navegador) → `brain-reviewer` sobre el diff.
- `vitest.config.ts` excluye `dist-client/` y `dist-server/` desde el día uno: es la trampa conocida
  del repo hermano (`Agente-QA-MCP/memory.md`), no la repitas aquí.

## Commits

Un commit por bloque entregable terminado y verificado. Commitea el hilo principal; los subagentes
nunca — tampoco en este repo hermano.

## Cierre de cada sesión

1. Actualiza `ESTADO.md`: qué quedó hecho y funcionando.
2. Actualiza `PROXIMOS-PASOS.md`: tacha lo cerrado, deja arriba lo siguiente (Bloques 4/5 de la spec).
3. Actualiza `README.md` si cambió algo visible para el usuario final.
4. Si el bloque añade algo probable a mano, añade su sección a `PRUEBAS.md`.

## Memoria (`memory.md`)

Cuando el usuario corrija algo, regístralo ANTES de continuar. Un hecho, una entrada. Tope duro 10KB.

## Mapa del proyecto

| Qué | Dónde |
|---|---|
| El plan de origen | `Agente-QA-MCP/docs/plan-maestro.md` y `docs/superpowers/specs/2026-09-05-interfaz-web-v1.md` (viven en el repo hermano; este repo no los duplica) |
| Estado del repo | `ESTADO.md` |
| Cola de trabajo | `PROXIMOS-PASOS.md` |
| Cómo probar cada función a mano | `PRUEBAS.md` |
| Guía del usuario final | `README.md` |
| Cómo trabajar | `memory.md` |

Repo hermano del que depende, fuera de este árbol: `agente-qa-contract` en
`c:\GitHub\agente-qa-contract` (consumido pinneado por SHA, solo tipos y parser).
