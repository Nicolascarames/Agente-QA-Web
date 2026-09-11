# Localizadores — los trece niveles

Orden fijo, de más a menos estable. Se prueba desde el nivel 1; solo se baja de nivel cuando el
anterior no da un localizador único, o no existe en la página.

**Regla general, por encima de los trece niveles**: unicidad e intención antes que brevedad. Un
localizador más largo que expresa lo que el elemento *es* vale más que uno corto que solo
describe dónde está hoy en el DOM.

**Prohibido en cualquier nivel**:
- Posiciones (`.nth()`, `.first()`, `.last()`) como estrategia de selección.
- Estructura del DOM (`div > div > span:nth-child(3)`).
- Clases generadas por el build (`.css-1a2b3c`, cualquier clase con hash).
- IDs dinámicos (`#field-8f3ab21`, cualquier ID que cambie entre cargas).

## Los trece niveles

1. **`getByRole`** con `name` accesible — el nombre visible o el `aria-label`, nunca un id.
   `page.getByRole('button', { name: 'Add to cart' })`
2. **`getByLabel`** — campos de formulario con `<label>` asociado.
3. **`getByPlaceholder`** — cuando no hay `<label>` pero sí placeholder.
4. **`getByText`**, texto exacto (`exact: true`) — para elementos sin rol interactivo claro.
5. **`getByAltText`** — imágenes.
6. **`getByTitle`** — el atributo `title`.
7. **`getByTestId`** — solo si el `data-testid` ya existe en el código de la aplicación, puesto
   ahí por el equipo de desarrollo. **Nunca se inventa uno ni se pide que se añada como primer
   recurso**: si no está, se sigue bajando en la lista.
8. **Atributo de formulario estable** — `locator('[name="..."]')` o `[type="..."]` cuando el
   campo no tiene label ni placeholder localizable.
9. **Atributo `aria-*` semántico** — `[aria-label="..."]`, `[aria-describedby="..."]`, cuando no
   lo cubre ya `getByRole`.
10. **`getByText` parcial o por expresión regular** — cuando el texto exacto varía (precios,
    contadores, fechas) pero una parte es estable: `getByText(/Precio: \$\d+/)`.
11. **`.filter({ has: ... })`** — para bajar de un contenedor a un hijo concreto cuando ningún
    atributo propio del hijo es único por sí solo, pero sí lo es en combinación con otro elemento
    hermano que contiene.
12. **Selector CSS de un atributo propio y estable de la aplicación** — no generado por el build,
    no dinámico. Por ejemplo un atributo de dominio (`[data-product-id="sauce-labs-backpack"]`)
    que el propio código de negocio mantiene fijo.
13. **Salida de emergencia** — la menos mala disponible cuando ninguno de los doce niveles
    anteriores da un localizador único y estable. Se usa, se marca con
    `// FRÁGIL: <motivo>`, y se reporta al final de la tarea para que el equipo de desarrollo
    añada un atributo estable. Nunca se elige este nivel por comodidad habiendo un nivel anterior
    disponible.

## Acotar con `filter`

`filter({ hasText })` y `filter({ has })` son las herramientas para bajar de un contenedor amplio
a un elemento concreto sin recurrir a posiciones:

- **`filter({ hasText })`** acota por el texto que contiene el contenedor.
- **`filter({ has })`** acota por un localizador hijo que el contenedor debe contener.

Ambas se combinan con el nivel que corresponda dentro del contenedor ya acotado (normalmente
nivel 1, `getByRole`).

## Elementos repetidos: ENTIDAD → PADRE/CONTEXTO → ACCIÓN

Cuando la página repite el mismo tipo de elemento (una lista de productos, las filas de una
tabla), el localizador nunca elige "el tercero de la lista". Elige primero el contenedor que hace
única a la entidad, y dentro de ese contenedor, la acción.

### NO

```ts
// Frágil: depende del orden en que la página pinte los productos.
await page.getByRole('button', { name: 'Add to cart' }).nth(2).click();
```

### SÍ

```ts
// Acota primero por la entidad (el producto, por su nombre), y solo dentro
// de ese contenedor busca la acción.
await page
  .getByRole('listitem')
  .filter({ hasText: 'Sauce Labs Backpack' })
  .getByRole('button', { name: 'Add to cart' })
  .click();
```

El segundo sobrevive a que la tienda reordene los productos, añada uno nuevo, o cambie el precio
mostrado. El primero se rompe con cualquiera de los tres.
