# Plantillas — forma canónica de los tres ficheros

Ejemplo completo y verificado contra SauceDemo: añadir la mochila «Sauce Labs Backpack» al
carrito. Los localizadores de este ejemplo salieron de `browser_snapshot` real, no de memoria —
así se hace siempre.

## `.feature` — documento, no ejecutable

El `.feature` es Gherkin como **documento para que una persona lo lea y lo corrija**, no un
fichero que corra un runner de Cucumber. Las mismas frases, palabra por palabra, reaparecen luego
en los `test.step` del `.spec.ts` — así se cruzan entre sí (trazabilidad, Bloque 8).

`tests/features/anadir-al-carrito.feature`:

```gherkin
# language: es
Característica: Añadir un producto al carrito

  Escenario: Añadir la mochila Sauce Labs Backpack al carrito
    Dado que he iniciado sesión como standard_user
    Cuando añado "Sauce Labs Backpack" al carrito
    Entonces el contador del carrito muestra "1"
```

## `.page.ts` — Page Object con métodos de intención

Métodos que dicen **qué** se hace (`addToCart(producto)`), nunca **cómo** (`clickButton(3)`).
Cada Page Object expone lo que un test necesita para actuar y para leer estado; nunca al revés
—ningún `.spec.ts` construye un localizador propio.

`tests/pages/inventory.page.ts`:

```ts
import type { Locator, Page } from '@playwright/test';

export class InventoryPage {
  readonly page: Page;
  readonly cartBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartBadge = page.getByTestId('shopping-cart-badge');
  }

  private item(nombreProducto: string): Locator {
    // ENTIDAD → PADRE/CONTEXTO: el contenedor del producto, acotado por su nombre.
    return this.page.getByTestId('inventory-item').filter({ hasText: nombreProducto });
  }

  async addToCart(nombreProducto: string): Promise<void> {
    // → ACCIÓN: el botón, buscado solo dentro del contenedor ya acotado.
    await this.item(nombreProducto).getByRole('button', { name: 'Add to cart' }).click();
  }
}
```

`tests/pages/login.page.ts`, usado únicamente por el setup (ver más abajo):

```ts
import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async login(usuario: string, contrasena: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(usuario);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(contrasena);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }
}
```

## `.spec.ts` — un `test.step` por frase del Gherkin

Cada `test.step` lleva la frase **exacta** del escenario. Quien lea la ejecución en el reporter
de Playwright ve las mismas palabras que aprobó en la pestaña Redactar.

`tests/specs/anadir-al-carrito.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { InventoryPage } from '../pages/inventory.page';

test.describe('Añadir un producto al carrito', () => {
  test('añade la mochila Sauce Labs Backpack y el contador sube a 1', async ({ page }) => {
    const inventario = new InventoryPage(page);

    await test.step('Dado que he iniciado sesión como standard_user', async () => {
      // La sesión ya viene de storageState (proyecto de setup); aquí solo se confirma
      // que se arranca en la pantalla correcta.
      await page.goto('/inventory.html');
    });

    await test.step('Cuando añado "Sauce Labs Backpack" al carrito', async () => {
      await inventario.addToCart('Sauce Labs Backpack');
    });

    await test.step('Entonces el contador del carrito muestra "1"', async () => {
      await expect(inventario.cartBadge).toHaveText('1');
    });
  });
});
```

## El login vive en el setup, no en el test

Un proyecto de setup hace login **una vez** y guarda la sesión. Los demás proyectos declaran
`storageState` y arrancan ya autenticados — ver `dependencies` y `storageState` en
`playwright.config.ts`, sección «Repo de pruebas» de la spec.

`tests/setup/auth.setup.ts`:

```ts
import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

const authFile = '.auth/standard_user.json';

setup('iniciar sesión como standard_user', async ({ page }) => {
  await page.goto('/');
  const login = new LoginPage(page);
  await login.login(
    process.env.SAUCE_USERNAME ?? 'standard_user',
    process.env.SAUCE_PASSWORD ?? 'secret_sauce',
  );
  await expect(page).toHaveURL(/inventory\.html/);
  await page.context().storageState({ path: authFile });
});
```

## Detalle que no se adivina: el atributo de test de SauceDemo

SauceDemo marca sus elementos con `data-test`, no con el `data-testid` que Playwright usa por
defecto. `playwright.config.ts` lo declara una vez:

```ts
use: {
  testIdAttribute: 'data-test',
}
```

Sin esa línea, `getByTestId` no encuentra nada en esta aplicación concreta — y es exactamente el
tipo de comprobación que sale de mirar la página, no de suponer.
