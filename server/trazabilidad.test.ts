import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cruzarTrazabilidad } from "./trazabilidad.js";

const FEATURE_ANADIR = `Característica: añadir al carrito

Escenario: añade un producto
  Dado que estoy en el inventario
  Cuando añado el producto al carrito
  Entonces el contador muestra 1
`;

const SPEC_ANADIR_QUE_CALZA = `import { test } from '@playwright/test';

test('añade un producto', async ({ page }) => {
  await test.step('Dado que estoy en el inventario', async () => {});
  await test.step('Cuando añado el producto al carrito', async () => {});
  await test.step('Entonces el contador muestra 1', async () => {});
});
`;

const SPEC_ANADIR_DESINCRONIZADO = `import { test } from '@playwright/test';

test('añade un producto', async ({ page }) => {
  await test.step('Dado que estoy en el inventario', async () => {});
  await test.step('Cuando pulso el botón de comprar ya', async () => {});
});
`;

describe("cruzarTrazabilidad", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-trazabilidad-"));
    await mkdir(path.join(proyecto, "tests", "features"), { recursive: true });
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("no-cubierto: el feature no tiene .spec.ts homónimo", async () => {
    await writeFile(path.join(proyecto, "tests", "features", "anadir-al-carrito.feature"), FEATURE_ANADIR, "utf8");

    const cobertura = await cruzarTrazabilidad(proyecto);

    expect(cobertura).toEqual([{ featureFichero: "anadir-al-carrito.feature", escenario: "añade un producto", estado: "no-cubierto" }]);
  });

  it("cubierto: los test.step calzan palabra por palabra y en orden con los pasos del escenario", async () => {
    await writeFile(path.join(proyecto, "tests", "features", "anadir-al-carrito.feature"), FEATURE_ANADIR, "utf8");
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "anadir-al-carrito.spec.ts"), SPEC_ANADIR_QUE_CALZA, "utf8");

    const cobertura = await cruzarTrazabilidad(proyecto);

    expect(cobertura).toEqual([
      {
        featureFichero: "anadir-al-carrito.feature",
        escenario: "añade un producto",
        estado: "cubierto",
        specFichero: "anadir-al-carrito.spec.ts",
        resultado: undefined,
      },
    ]);
  });

  it("desincronizado: el .spec.ts existe pero ningún bloque test( calza con los pasos actuales", async () => {
    await writeFile(path.join(proyecto, "tests", "features", "anadir-al-carrito.feature"), FEATURE_ANADIR, "utf8");
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "anadir-al-carrito.spec.ts"), SPEC_ANADIR_DESINCRONIZADO, "utf8");

    const cobertura = await cruzarTrazabilidad(proyecto);

    expect(cobertura).toEqual([
      {
        featureFichero: "anadir-al-carrito.feature",
        escenario: "añade un producto",
        estado: "desincronizado",
        specFichero: "anadir-al-carrito.spec.ts",
      },
    ]);
  });

  it("cubierto + resultado: cruza con el último reporte de Playwright cuando existe", async () => {
    await writeFile(path.join(proyecto, "tests", "features", "anadir-al-carrito.feature"), FEATURE_ANADIR, "utf8");
    await mkdir(path.join(proyecto, "tests", "specs"), { recursive: true });
    await writeFile(path.join(proyecto, "tests", "specs", "anadir-al-carrito.spec.ts"), SPEC_ANADIR_QUE_CALZA, "utf8");
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(
      path.join(proyecto, "test-results", "results.json"),
      JSON.stringify({
        suites: [
          {
            file: "anadir-al-carrito.spec.ts",
            specs: [
              {
                title: "añade un producto",
                file: "anadir-al-carrito.spec.ts",
                tests: [
                  {
                    results: [
                      {
                        status: "passed",
                        duration: 100,
                        steps: [
                          { title: "Dado que estoy en el inventario" },
                          { title: "Cuando añado el producto al carrito" },
                          { title: "Entonces el contador muestra 1" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      "utf8",
    );

    const cobertura = await cruzarTrazabilidad(proyecto);

    expect(cobertura).toEqual([
      {
        featureFichero: "anadir-al-carrito.feature",
        escenario: "añade un producto",
        estado: "cubierto",
        specFichero: "anadir-al-carrito.spec.ts",
        resultado: "passed",
      },
    ]);
  });
});
