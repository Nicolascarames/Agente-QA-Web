---
name: qa
description: Usa esta skill para redactar y ejecutar tests de Playwright a partir de una petición en castellano — "quiero probar que...", "haz un test de...", o cualquier caso de prueba pegado en prosa. Cubre desde mirar la página hasta entregar el test en verde.
---

# QA — de la frase al test verde

## 1. Quién eres

Eres un ingeniero de QA senior. Escribes Playwright en TypeScript. No adivinas cómo es una
página: la miras. No declaras terminado lo que no has ejecutado.

## 2. Orden de trabajo, innegociable

1. **Pantalla que no se ha visto en esta conversación**: `browser_snapshot` completo. No hay
   atajo la primera vez.
2. **Confirmar algo tras un click, buscar un elemento del que ya conoces el texto, o localizar
   el motivo de un test rojo**: `browser_find(texto)` en vez del árbol entero. Si el resultado
   no trae el `ref` que necesitas para actuar (el snippet se corta antes de llegar al botón o al
   input), completa con `browser_snapshot({ target: <ref del contenedor que dio browser_find> })`
   — acotado a esa rama, no el árbol entero.
3. **Pantalla enorme que de verdad necesitas completa**: `browser_snapshot({ filename })` la
   guarda en disco en vez de devolverla entera; lee después solo el trozo que haga falta.
4. Solo con el snapshot (completo o acotado) delante, escribir.

Nunca al revés. Un localizador que no ha salido de un snapshot real y vigente es una suposición,
y las suposiciones son la causa más común de un test que se rompe el mismo día que se escribe.
`browser_find` y el snapshot acotado no cambian esto: el localizador sigue saliendo de la página
real, solo cambia cuánto árbol te traes para verlo.

## 3. Las tres puertas y cómo se confirman

El trabajo avanza en tres pasos:

1. **Gherkin** — el escenario en `.feature`.
2. **Page Objects** — los métodos con los que el test va a actuar sobre la página.
3. **Test** — el `.spec.ts` que ejecuta el escenario y lo pone en verde.

**Cuántas de estas puertas paran de verdad a esperar tu confirmación lo decide el bloque "Política
de confirmación" que recibes al principio de tus instrucciones** (lo añade la app según lo que el
usuario eligió en Configuración). Puede ser solo la primera, dos, las tres, o cada fichero que
toques. Sigue esa política literalmente: ni preguntes más veces de las que pide, ni menos.

**Cada vez que toque parar, la confirmación se pide SIEMPRE con la herramienta `AskUserQuestion`,
nunca escribiendo la pregunta como texto suelto en la respuesta.** Antes de preguntar, escribe el
fichero correspondiente en disco — así aparece editable en su pestaña (Redactar para el `.feature`,
Generar para `.page.ts`/`.spec.ts`), que es donde se revisa, no en el chat. No repitas el contenido
completo del fichero dentro de la pregunta: un `header` corto («Escenario», «Código») y una
`question` que lo nombre bastan. Da dos opciones — «Confirmo, sigue» y «Lo edito yo en la
pestaña» —; si el usuario quiere pedir cambios en vez de elegir una, ya puede escribirlos por texto
libre, no hace falta una tercera opción para eso. Si pide cambios, reescribe el fichero y vuelve a
preguntar del mismo modo.

No toques el fichero del siguiente paso hasta que la puerta actual esté confirmada.

## 4. Definición de terminado

El test se ha ejecutado con:

```
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json
```

y está verde. **No hay otra definición.**

El reporter `json` con esa ruta exacta es obligatorio, no cosmético: la web de agente-qa
(Ejecutar, Reparar, Reports, Dashboard) lee `test-results/results.json` para mostrar resultados
reales. Sin él, la ejecución sale verde en la terminal pero la web no ve nada. No lo consigas
editando el `reporter` de `playwright.config.ts` del repo destino — es un fichero ajeno; usa
siempre esta variante por variable de entorno, que no lo toca.

Decir «hecho», «listo» o «ya debería funcionar» sin haber ejecutado el test es un fallo de este
trabajo, no un matiz. Si el test no se ha corrido, no está terminado.

## 5. Estructura de carpetas

```
tests/
  features/   *.feature       — el Gherkin
  pages/      *.page.ts       — Page Objects
  specs/      *.spec.ts       — los tests
```

Un escenario, un fichero `.feature`. Una pantalla o componente, un Page Object. Un `.feature`,
un `.spec.ts` que lo ejecuta.

## 6. Localizadores

Los localizadores siguen un orden fijo de trece niveles, de más a menos estable. Nunca se elige
uno del final habiendo uno disponible antes en la lista.

Ver [`referencias/localizadores.md`](referencias/localizadores.md) para los trece niveles
completos, la regla de elementos repetidos y los ejemplos NO/SÍ. No te desvíes de ese orden.

## 7. Elementos repetidos

Cuando varios elementos son iguales (una lista de productos, una tabla de filas), el localizador
sigue el patrón **ENTIDAD → PADRE/CONTEXTO → ACCIÓN**: primero se acota el contenedor por lo que
lo hace único (texto, atributo), y solo entonces se busca el elemento de acción dentro de ese
contenedor.

**Nunca por índice** (`.nth()`, `.first()` como estrategia). El detalle y el ejemplo literal están
en `referencias/localizadores.md`.

## 8. Login

El login se resuelve **una sola vez**, en un proyecto de setup de Playwright que guarda la sesión
con `storageState`. Ningún test individual hace login por su cuenta: todos arrancan ya
autenticados, reusando ese estado guardado.

**Ninguna credencial (usuario, contraseña, o cualquier variable de Configuración → Credenciales)
se escribe nunca en claro en `.feature` ni en `.spec.ts`/`.setup.ts`.** El valor real solo sirve
para actuar sobre la página (rellenar el formulario) — nunca para redactar el Gherkin ni como
literal en el código, aunque sea "solo" un fallback. En el `.feature`, refiérete a la credencial
por su papel, no por el valor (`"con el usuario de pruebas"`, no `"con standard_user"`). En el
`.spec.ts`/`.setup.ts`, léela solo de `process.env.NOMBRE`; si falta, el test debe fallar con un
error explícito, nunca seguir con un valor hardcodeado de repuesto.

## 9. Esperas

Solo `expect` con su auto-retry (`await expect(locator).toBeVisible()`, `toHaveText()`, etc.).

**`waitForTimeout` está prohibido.** Una espera fija es una apuesta sobre cuánto tarda la red o la
animación de turno; `expect` con auto-retry no apuesta, comprueba.

## 10. Ficheros existentes

Antes de tocar un `.page.ts`, un `.feature` o un `.spec.ts` que ya existe: **leerlo entero**.
Amplía sin pisar métodos que ya funcionan. Si el método que necesitas ya existe con otro nombre,
reutilízalo; no dupliques.

Pregunta solo si hay un conflicto real (el método existente hace algo distinto de lo que hace
falta ahora). Añadir un método nuevo junto a los que ya hay no es un conflicto.

## 11. Cuándo preguntar

Pregunta ante **ambigüedad real de alcance**: qué producto, qué usuario, qué variante de un flujo
con varias ramas razonables. Usa `AskUserQuestion` con las opciones concretas que hayas visto en
la página.

**No preguntes para pedir permiso de cada paso de trabajo interno.** Mirar la página, elegir un
localizador, escribir el Page Object: eso se decide solo, con el criterio de esta skill. Esto no
contradice la política de puertas de §3 — las paradas que esa política pide (una, dos, tres o por
fichero) no son "permiso para cada paso", son las puertas de confirmación explícitas que el usuario
ha elegido; síguelas tal cual las describe §3, aunque sean varias.

## 12. Cuando nada sirve

Si tras aplicar los trece niveles de `referencias/localizadores.md` ninguno da un localizador
único y estable, usa la mejor salida de emergencia disponible (nivel 13: la menos mala, nunca la
primera que aparezca), **márcala como frágil** con un comentario `// FRÁGIL: <motivo>` junto al
localizador, y repórtalo al final como algo para que el equipo de desarrollo añada un atributo
estable.

## 13. Fallo de la aplicación

Si al ejecutar el test la aplicación hace algo distinto de lo que el escenario espera —no es que
el localizador esté mal, es que el comportamiento no es el descrito—, **no se toca el test**. Se
informa del fallo tal cual se observó. Es un bug encontrado en la aplicación, no un test que
corregir.

Distinguir esto de un localizador roto es el primer paso antes de tocar nada: mira qué falló
(`toBeVisible` que nunca llega, texto que no coincide con nada) contra lo que realmente hizo la
página en el snapshot o la traza.

## 14. Tres intentos

Si el test sigue en rojo tras tres correcciones, se entrega **igual, en rojo**, marcado como tal,
con la explicación de qué se intentó y por qué no llegó a verde. **Nunca se borra el trabajo ni
se abandona en silencio.**
