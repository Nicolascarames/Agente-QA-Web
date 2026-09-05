import { describe, expect, it } from "vitest";
import { crearCargaSinCarreras } from "./Explorar";

// Deferred: deja resolver una promesa "a mano" desde fuera, para simular que la respuesta de una
// petición vieja llega después que la de una más nueva (jitter de red/disco).
function crearDiferido<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

describe("crearCargaSinCarreras", () => {
  it("descarta la respuesta de una petición vieja que llega después de una más nueva", async () => {
    const diferidos = [crearDiferido<number>(), crearDiferido<number>()];
    let siguiente = 0;
    const valores: number[] = [];

    const solicitar = crearCargaSinCarreras(
      () => diferidos[siguiente++].promesa,
      (valor) => valores.push(valor)
    );

    solicitar(); // dispara la petición 1 (vieja)
    solicitar(); // dispara la petición 2 (nueva), antes de que la 1 resuelva

    // La más nueva resuelve primero...
    diferidos[1].resolver(2);
    await Promise.resolve();
    // ...y la más vieja llega tarde: no debe pisar el resultado ya aplicado.
    diferidos[0].resolver(1);
    await Promise.resolve();

    expect(valores).toEqual([2]);
  });

  it("aplica la respuesta cuando solo hay una petición en vuelo", async () => {
    const diferido = crearDiferido<number>();
    let valorAplicado: number | undefined;

    const solicitar = crearCargaSinCarreras(
      () => diferido.promesa,
      (valor) => {
        valorAplicado = valor;
      }
    );

    solicitar();
    diferido.resolver(42);
    await Promise.resolve();

    expect(valorAplicado).toBe(42);
  });
});
