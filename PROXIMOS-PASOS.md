# PRÓXIMOS PASOS — Agente-QA-Web

Actualizado: 2026-09-05

Cola priorizada. **Una tarea = una línea.** El detalle vive en
`Agente-QA-MCP/docs/superpowers/specs/2026-09-05-interfaz-web-v1.md`.

## Siguiente

La spec de la interfaz web está cerrada entera (7 bloques). Este repo no tiene tarea propia asignada
todavía — la siguiente pieza del ecosistema (Spec 9, `crawler`, segundo agente) es principalmente
trabajo de `Agente-QA-MCP`; en cuanto ese agente exista, esta web necesitará que aparezca en el mismo
selector de puertas de Explorar. Hasta entonces, ver "Deuda anotada" para lo pendiente dentro de este
repo.

## Deuda anotada

Hallazgos reales aparcados por escrito, ninguno bloqueante. De la revisión final de rama de la spec
de la interfaz web, severidad baja, no arreglados en esa sesión:

- [ ] **`corridas.ts` descarta defensivamente cualquier línea de stdout del CLI que no parsee como el
      envoltorio NDJSON** (`continue` silencioso) — funciona hoy porque `record.ts`/`snapshot.ts` de
      `Agente-QA-MCP` todavía imprimen alguna línea de texto humano con `--json` activo (anotado como
      deuda en ese repo), pero es frágil: una línea humana que por casualidad sea JSON válido colaría
      un evento falso en el registro/árbol.
- [ ] **La resolución de candidatos de localizador sin resolver (`screen.ambiguous[]`)** no tiene
      editor en la web — el Bloque 7 solo corrige localizadores ya resueltos. Depende de la Spec 6 de
      `Agente-QA-MCP` ("Localizadores que no se rinden"), todavía sin construir y con la premisa
      caducada.

## Hechas

- [x] **La interfaz web, primera versión — Bloques 3 a 7** (2026-09-05) — repo nacido en esta spec:
      cáscara con 8 pestañas y paneles con memoria (Bloque 3), Configuración funcional con claves
      enmascaradas (Bloque 4), Explorar en vivo por las cuatro puertas con SSE y "Detener" fiable
      (Bloque 5), chat con el agente sin duplicar mensajes (Bloque 6), corrección manual de
      localizador con el agente nuevo `web-manual` del contrato (Bloque 7). Cierra con una revisión
      final de rama que encontró y corrigió 3 fallos reales de interacción entre bloques (estado
      "corriendo" pegado si el CLI muere sin evento terminal, carrera entre una corrida activa y una
      corrección manual de `map.json`, observador en otra pestaña que se queda colgado al terminar y
      relanzar una corrida). Detalle bloque a bloque en `ESTADO.md` y en el histórico de commits.
