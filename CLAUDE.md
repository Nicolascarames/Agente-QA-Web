# CLAUDE.md — Agente-QA-Web

Escribes en castellano lo que quieres probar y sale un test de Playwright ejecutado y en verde.

**El plan vigente es [`docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md`](docs/superpowers/specs/2026-09-11-de-la-frase-al-test-verde.md).**
Si algo no está ahí, no está decidido.

## Idioma

Responde y pregunta SIEMPRE en castellano (España). Código e identificadores en inglés.

## Los documentos que se mantienen

Al empezar la sesión, lee enteros `ESTADO.md` y `PROXIMOS-PASOS.md`, en ese orden. No leas nada más
del repo hasta saber qué tarea toca.

Al cerrarla, actualiza los tres:

| Fichero | Qué contiene |
|---|---|
| `ESTADO.md` | Qué funciona hoy y qué se conserva. Sin histórico |
| `PROXIMOS-PASOS.md` | Cola priorizada, una línea por tarea. Tacha lo cerrado, deja arriba lo siguiente |
| `README.md` | Guía de usuario, no técnica: cómo instalar, levantar y usar la app hoy mismo. El usuario la usa para probar en cada sesión — si un comando, una pestaña o un flujo cambia, este fichero se actualiza en el mismo cierre, nunca se deja para luego |

**Los dos primeros son de poda**: entra lo vigente y sale lo que deja de serlo. No crecen.
`README.md` no es de poda en el mismo sentido — es la puerta de entrada para alguien que no ha
seguido la sesión — pero tampoco acumula histórico de bloques ni decisiones: solo describe cómo usar
lo que hay *hoy*.

El apartado «Lo que NO entra» de `PROXIMOS-PASOS.md` es vinculante: no se amplía el alcance por
iniciativa propia.
