import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerMapa } from "./api";
import { diffMapa, type DiffMapa } from "./diffMapa";
import type { EventoNdjson, MapaCompleto } from "../shared/tipos";

const TIPOS_FIN_CORRIDA = new Set(["operation.completed", "operation.stopped", "operation.error"]);

export interface EstadoConsolaGlobal {
  eventos: EventoNdjson[];
  eventoFinal: EventoNdjson | null;
}

export const ESTADO_CONSOLA_INICIAL: EstadoConsolaGlobal = { eventos: [], eventoFinal: null };

export function reducirEventoConsola(estado: EstadoConsolaGlobal, evento: EventoNdjson): EstadoConsolaGlobal {
  const esFinDeCorrida = TIPOS_FIN_CORRIDA.has(evento.type);
  return {
    eventos: [...estado.eventos, evento],
    eventoFinal: esFinDeCorrida ? evento : estado.eventoFinal,
  };
}

export interface ResumenFinalCorrida {
  evento: EventoNdjson;
  diff: DiffMapa;
}

export interface EstadoCorridaGlobal {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  resumenFinal: ResumenFinalCorrida | null;
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

/**
 * Vive en `App.tsx` (nunca se desmonta al cambiar de pestaña): una única conexión SSE para toda
 * la app, en vez de una por pestaña como hacía `Explorar.tsx`. `marcarCorridaActiva` es lo que
 * tanto `BarraLanzamiento` (vía `Explorar`) como `ConsolaGlobal` llaman al lanzar una corrida:
 * limpia el historial, captura el mapa "antes" y fuerza reabrir el SSE (el servidor cierra la
 * conexión de la corrida anterior al terminar, así que hace falta una nueva por cada corrida).
 */
export function useCorridaGlobal(): EstadoCorridaGlobal {
  const [corridaActiva, setCorridaActiva] = useState<string | null>(null);
  const [intentoConexion, setIntentoConexion] = useState(0);
  const [estado, setEstado] = useState<EstadoConsolaGlobal>(ESTADO_CONSOLA_INICIAL);
  const [resumenFinal, setResumenFinal] = useState<ResumenFinalCorrida | null>(null);
  const mapaAntesRef = useRef<MapaCompleto | null>(null);

  useEffect(() => {
    if (corridaActiva === null) return;
    const fuente = new EventSource("/api/eventos");

    fuente.addEventListener("sin-corrida", () => {
      fuente.close();
    });

    fuente.onmessage = (mensaje: MessageEvent<string>) => {
      let evento: EventoNdjson;
      try {
        evento = JSON.parse(mensaje.data) as EventoNdjson;
      } catch {
        return;
      }
      setEstado((actual) => reducirEventoConsola(actual, evento));
      if (TIPOS_FIN_CORRIDA.has(evento.type)) {
        void obtenerMapa().then((mapaDespues) => {
          setResumenFinal({ evento, diff: diffMapa(mapaAntesRef.current, mapaDespues) });
        });
      }
    };

    return () => {
      fuente.close();
    };
  }, [intentoConexion, corridaActiva]);

  const marcarCorridaActiva = useCallback((etiqueta: string | null) => {
    setCorridaActiva(etiqueta);
    if (etiqueta !== null) {
      setEstado(ESTADO_CONSOLA_INICIAL);
      setResumenFinal(null);
      setIntentoConexion((n) => n + 1);
      void obtenerMapa().then((mapa) => {
        mapaAntesRef.current = mapa;
      });
    }
  }, []);

  return { corridaActiva, eventos: estado.eventos, resumenFinal, marcarCorridaActiva };
}
