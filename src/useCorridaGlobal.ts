import { useCallback, useEffect, useState } from "react";
import { obtenerCorridaActiva } from "./api";
import { esEventoTerminal } from "../shared/eventos";
import type { EventoNdjson } from "../shared/tipos";

export interface EstadoConsolaGlobal {
  eventos: EventoNdjson[];
  eventoFinal: EventoNdjson | null;
}

export const ESTADO_CONSOLA_INICIAL: EstadoConsolaGlobal = { eventos: [], eventoFinal: null };

export function reducirEventoConsola(estado: EstadoConsolaGlobal, evento: EventoNdjson): EstadoConsolaGlobal {
  return {
    eventos: [...estado.eventos, evento],
    eventoFinal: esEventoTerminal(evento.type) ? evento : estado.eventoFinal,
  };
}

export interface EstadoCorridaGlobal {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

/**
 * Vive en `App.tsx` (nunca se desmonta al cambiar de pestaña): una única conexión SSE para toda
 * la app. `marcarCorridaActiva` es lo que `ConsolaGlobal` llama al lanzar una corrida: limpia el
 * historial y fuerza reabrir el SSE (el servidor cierra la conexión de la corrida anterior al
 * terminar, así que hace falta una nueva por cada corrida).
 *
 * Bloque 2: el backend que lanzaba corridas de verdad (`server/corridas.ts`) se borró. Lo que
 * queda es la estructura (esta misma conexión SSE, honesta sobre que no hay nada activo) para que
 * el Bloque 4 la conecte al agente real sin tener que rehacerla.
 */
export function useCorridaGlobal(): EstadoCorridaGlobal {
  const [corridaActiva, setCorridaActiva] = useState<string | null>(null);
  const [intentoConexion, setIntentoConexion] = useState(0);
  const [estado, setEstado] = useState<EstadoConsolaGlobal>(ESTADO_CONSOLA_INICIAL);

  // Al montar (o recargar el navegador), se pregunta si ya hay una corrida en marcha antes de que
  // llegue ningún evento por SSE: solo actualiza `corridaActiva` (lo que abre el SSE vía el efecto
  // de abajo) sin tocar `eventos`, que sí se reinicia en un lanzamiento genuino (`marcarCorridaActiva`).
  useEffect(() => {
    void obtenerCorridaActiva().then((estadoActivo) => {
      if (estadoActivo.activa) setCorridaActiva(estadoActivo.runId ?? "activa");
    });
  }, []);

  useEffect(() => {
    if (corridaActiva === null) return;
    const fuente = new EventSource("/api/eventos");

    fuente.addEventListener("sin-corrida", () => {
      fuente.close();
      setCorridaActiva(null);
    });

    fuente.onmessage = (mensaje: MessageEvent<string>) => {
      let evento: EventoNdjson;
      try {
        evento = JSON.parse(mensaje.data) as EventoNdjson;
      } catch {
        return;
      }
      setEstado((actual) => reducirEventoConsola(actual, evento));
      if (esEventoTerminal(evento.type)) {
        setCorridaActiva(null);
      }
    };

    return () => {
      fuente.close();
    };
  }, [intentoConexion, corridaActiva]);

  const marcarCorridaActiva = useCallback((etiqueta: string | null) => {
    setCorridaActiva((actual) => {
      if (etiqueta !== null && actual === null) {
        setEstado(ESTADO_CONSOLA_INICIAL);
        setIntentoConexion((n) => n + 1);
      }
      return etiqueta;
    });
  }, []);

  return { corridaActiva, eventos: estado.eventos, marcarCorridaActiva };
}
