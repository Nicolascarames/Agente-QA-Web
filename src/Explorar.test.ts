import { describe, expect, it } from "vitest";
import { crearCargaSinCarreras, eventosTrasEnviarMensaje } from "./Explorar";
import type { EventoNdjson } from "../shared/tipos";

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

describe("eventosTrasEnviarMensaje", () => {
  it("no añade un eco local con corrida activa: el registro termina con una sola entrada del mensaje aunque el chat.message real llegue después por SSE", () => {
    // `enviado: true` = ya había corrida activa (POST /api/mensaje la redirigió, no lanzó una nueva).
    const trasEnviar = eventosTrasEnviarMensaje([], "sigue con el login", { enviado: true });
    expect(trasEnviar).toEqual([]); // sin eco local todavía: se confía en el reflejo real del CLI

    // Simula lo que llega después por el stream: el CLI vacía el `user.message` y reenvía su propio
    // `chat.message` (agent: "mapeador-mcp", origen "usuario") por el mismo SSE ya abierto.
    const eventoReal: EventoNdjson = {
      runId: "run-1",
      ts: new Date().toISOString(),
      agent: "mapeador-mcp",
      type: "chat.message",
      data: { text: "sigue con el login", origen: "usuario" },
    };
    const registroFinal = [...trasEnviar, eventoReal];

    const mensajesDeUsuario = registroFinal.filter(
      (e) => e.type === "chat.message" && (e.data as { origen?: string }).origen === "usuario"
    );
    expect(mensajesDeUsuario).toHaveLength(1);
  });

  it("sí añade el eco local cuando no había corrida activa: esto lanza una corrida nueva, conservando el registro de una corrida anterior", () => {
    const eventoAnterior: EventoNdjson = {
      runId: "run-1",
      ts: new Date().toISOString(),
      agent: "mapeador-mcp",
      type: "chat.message",
      data: { text: "corrida anterior ya terminada", origen: "usuario" },
    };
    const trasEnviar = eventosTrasEnviarMensaje(
      [eventoAnterior],
      "empieza a explorar",
      { runId: "run-2" }
    );

    expect(trasEnviar).toHaveLength(2);
    expect(trasEnviar[0]).toBe(eventoAnterior);
    expect(trasEnviar[1]).toMatchObject({
      runId: "run-2",
      agent: "web",
      type: "chat.message",
      data: { text: "empieza a explorar", origen: "usuario" },
    });
  });
});
