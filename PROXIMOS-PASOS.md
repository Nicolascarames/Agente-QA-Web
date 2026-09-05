# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-05

Cola priorizada. **Una tarea = una línea.** El detalle vive en
`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`.

## Siguiente

- [ ] **Bloque 4 — Configuración funcional** — `server/config.ts`, `server/claves.ts`, `server/cli.ts`
      (localización del binario), `POST /api/doctor` y `/api/llm-ping`, `src/Configuracion.tsx` de
      verdad. Independiente del Bloque 5, se puede despachar en paralelo con él.
- [ ] **Bloque 5 — Explorar, las cuatro puertas en vivo** — `server/corridas.ts`, SSE, `src/Explorar.tsx`
      y `src/BarraLanzamiento.tsx`. Depende de los Bloques 1 y 2 de `Agente-QA-MCP` (canal NDJSON y
      canal de entrada), que se ejecutan en ese repo.
- [ ] **Bloque 6 — Hablarle al agente mientras trabaja** — depende del Bloque 5.
- [ ] **Bloque 7 — Corregir un localizador desde el árbol** (candidato a recortar si hay que cerrar
      antes) — depende del Bloque 5.

## Deuda anotada

Ninguna todavía — el repo nace con este bloque.

## Hechas

- [x] **Bloque 3 — el repo y la cáscara** (2026-09-05) — servidor Fastify, `GET /api/estado` leyendo el
      disco con los tipos del contrato, `POST /api/init`, 8 pestañas navegables con paneles con
      memoria, Dashboard real.
