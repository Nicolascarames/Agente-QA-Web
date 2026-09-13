// Extraído de agente.ts: cola push + difusor de eventos, genéricos y sin nada específico del SDK del
// agente — `server/app.ts` los reutiliza para el canal de progreso en vivo de `/api/tests/eventos`
// (Ejecutar), no solo para la sesión del agente.

/**
 * Cola push genérica respaldada por un array + resolvers pendientes: sirve tanto para el prompt en
 * modo streaming (`enviarMensaje` empuja sin crear una `query()` nueva) como para cada suscriptor
 * individual del canal de eventos (difusión: una cola por suscriptor, ver `crearDifusor`).
 *
 * El iterador expone `return()` (parte del protocolo `AsyncIterator`, invocado por `for await`
 * cuando el consumidor rompe el bucle antes de agotarlo, o al llamarlo explícitamente) para poder
 * cancelar un suscriptor concreto desde fuera — p.ej. cuando la conexión SSE que lo consume se cierra.
 * `alCerrar` es el hook para darlo de baja del `Set` de suscriptores activos del difusor.
 */
export function crearCola<T>(alCerrar?: () => void): { iterable: AsyncIterable<T>; push: (valor: T) => void; cerrar: () => void } {
  const pendientes: T[] = [];
  const resolvers: ((resultado: IteratorResult<T>) => void)[] = [];
  let cerrada = false;

  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    for (const resolver of resolvers.splice(0)) {
      resolver({ value: undefined, done: true });
    }
    alCerrar?.();
  }

  return {
    push(valor: T) {
      if (cerrada) return;
      const resolver = resolvers.shift();
      if (resolver) {
        resolver({ value: valor, done: false });
      } else {
        pendientes.push(valor);
      }
    },
    cerrar,
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<T>> {
            const siguiente = pendientes.shift();
            if (siguiente !== undefined) return Promise.resolve({ value: siguiente, done: false });
            if (cerrada) return Promise.resolve({ value: undefined, done: true });
            return new Promise((resolve) => resolvers.push(resolve));
          },
          return(): Promise<IteratorResult<T>> {
            cerrar();
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    },
  };
}

/**
 * Difusor de eventos: cada `suscribirse()` crea una cola nueva e independiente; `emitir()` empuja a
 * todas las colas activas en ese momento (fan-out, no reparto); `cerrar()` cierra a todas las
 * suscritas y a cualquiera que llegue después. Reemplaza la cola única compartida que hacía que dos
 * `GET /api/eventos` sobre la misma sesión se repartieran los eventos en vez de ver el stream entero.
 */
export function crearDifusor<T>(): { suscribirse: () => AsyncIterable<T>; emitir: (valor: T) => void; cerrar: () => void } {
  const suscriptores = new Set<ReturnType<typeof crearCola<T>>>();
  let cerrado = false;

  return {
    suscribirse() {
      const cola = crearCola<T>(() => suscriptores.delete(cola));
      if (cerrado) {
        cola.cerrar();
      } else {
        suscriptores.add(cola);
      }
      return cola.iterable;
    },
    emitir(valor: T) {
      for (const cola of suscriptores) cola.push(valor);
    },
    cerrar() {
      cerrado = true;
      for (const cola of [...suscriptores]) cola.cerrar();
    },
  };
}
