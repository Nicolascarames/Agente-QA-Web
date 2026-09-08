import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Panel } from "./Panel";
import { enviarComando } from "./api";
import { Autocompletado } from "./consola/Autocompletado";
import { siguienteHueco } from "./consola/plantillas";
import { validarLinea } from "./consola/validarLinea";
import { catalogoResuelto } from "./catalogo/catalogo";
import type { EventoNdjson } from "../shared/tipos";
import type { ResumenFinalCorrida } from "./useCorridaGlobal";

function serializarDatos(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data);
}

function LineaEvento({ evento }: { evento: EventoNdjson }) {
  if (evento.type === "raw.stdout") {
    const datos = evento.data as { linea?: unknown };
    const linea = typeof datos?.linea === "string" ? datos.linea : serializarDatos(evento.data);
    return <li className="text-xs text-text-dim">{linea}</li>;
  }
  return (
    <li className="border-b border-border pb-1.5 text-xs text-text-faint">
      <span className="text-text-ghost">{evento.ts}</span> <span className="text-accent-soft">{evento.type}</span>{" "}
      <span className="text-text-faint">[{evento.agent}]</span>
      <pre className="whitespace-pre-wrap break-all text-2xs text-text-dim">{serializarDatos(evento.data)}</pre>
    </li>
  );
}

function TarjetaResumen({ resumen }: { resumen: ResumenFinalCorrida }) {
  const exito = resumen.evento.type === "operation.completed";
  const { pantallasNuevas, localizadoresNuevos, escenariosNuevos } = resumen.diff;
  const sinNovedades = pantallasNuevas.length === 0 && localizadoresNuevos.length === 0 && escenariosNuevos.length === 0;

  return (
    <div
      className={`rounded-8 border p-2.5 text-sm ${
        exito ? "border-success bg-success-bg text-success" : "border-danger bg-danger-bg text-danger"
      }`}
    >
      <div className="font-bold">{exito ? "✔ Corrida terminada" : `✖ ${resumen.evento.type}`}</div>
      {pantallasNuevas.length > 0 && <div>Pantallas nuevas: {pantallasNuevas.map((pantalla) => pantalla.name).join(", ")}</div>}
      {localizadoresNuevos.length > 0 && (
        <div>Localizadores nuevos: {localizadoresNuevos.map((item) => `${item.screenName}.${item.locator.name}`).join(", ")}</div>
      )}
      {escenariosNuevos.length > 0 && <div>Escenarios nuevos: {escenariosNuevos.map((escenario) => escenario.title).join(", ")}</div>}
      {sinNovedades && <div>Sin novedades en el mapa.</div>}
    </div>
  );
}

export interface ConsolaGlobalProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  resumenFinal: ResumenFinalCorrida | null;
  marcarCorridaActiva: (etiqueta: string | null) => void;
  /** Abre el cajón de detalle (Bloque 4) desde el autocompletado (Bloque 7), pulsando `?` sobre
   *  una sugerencia. El estado vive en `App.tsx`, igual que para `GuiaPestana`. `opcion` (solo
   *  cuando la sugerencia era una flag, p.ej. `--auto`) llega hasta `CajonFicha` para abrirlo con
   *  esa opción ya resaltada, en vez de siempre en reposo. */
  onAbrirFicha: (id: string, opcion?: string) => void;
  /** Ejemplo elegido en el cajón de detalle (Bloque 8): cada clic pone un objeto nuevo (con su
   *  propio `version`) aunque el texto se repita, para que el `useEffect` de más abajo se dispare
   *  también la segunda vez que se pulsa el mismo ejemplo. `null` en reposo. */
  ejemploAInsertar: { texto: string; version: number } | null;
}

export function ConsolaGlobal({ corridaActiva, eventos, resumenFinal, marcarCorridaActiva, onAbrirFicha, ejemploAInsertar }: ConsolaGlobalProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Catálogo calculado una vez, igual que en `Autocompletado.tsx`: `catalogoResuelto()` construye
  // árboles nuevos en cada llamada.
  const catalogo = useMemo(() => catalogoResuelto(), []);
  const problemas = useMemo(() => validarLinea(comando, catalogo), [comando, catalogo]);

  // Envuelve la caja de texto (Autocompletado + botón ▶️): de aquí se saca el `<input>` real para
  // enfocarlo y seleccionar huecos, sin tener que tocar `Autocompletado.tsx`.
  const cajaRef = useRef<HTMLDivElement | null>(null);
  // `true` mientras queda al menos un hueco `<...>` sin rellenar del último ejemplo insertado —
  // controla si `Tab` salta de hueco en hueco o hace lo de siempre (Bloque 8).
  const [modoPlantilla, setModoPlantilla] = useState(false);

  useEffect(() => {
    if (!ejemploAInsertar) return;
    setComando(ejemploAInsertar.texto);
    const hueco = siguienteHueco(ejemploAInsertar.texto);
    setModoPlantilla(hueco !== null);
    // El valor del input tarda un render en reflejar `setComando`: hay que fijar foco y selección
    // después, igual que hace `aceptar()` en `Autocompletado.tsx`.
    requestAnimationFrame(() => {
      const input = cajaRef.current?.querySelector("input");
      if (!input) return;
      input.focus();
      if (hueco) input.setSelectionRange(hueco.inicio, hueco.fin);
      else input.setSelectionRange(ejemploAInsertar.texto.length, ejemploAInsertar.texto.length);
    });
  }, [ejemploAInsertar]);

  // Intercepta `Tab` ANTES de que llegue al `onKeyDown` de `Autocompletado` (fase de captura, de
  // fuera hacia dentro): mientras haya un hueco pendiente, salta a él; en cuanto no quede
  // ninguno, se apaga `modoPlantilla` y se deja pasar el evento sin más — Autocompletado sigue
  // gestionando `Tab` con su propio criterio de siempre (aceptar sugerencia o salir del input).
  function alTeclearCaja(evento: KeyboardEvent<HTMLDivElement>) {
    if (!modoPlantilla || evento.key !== "Tab") return;
    const input = cajaRef.current?.querySelector("input");
    if (!input) return;
    const desde = input.selectionEnd ?? comando.length;
    const hueco = siguienteHueco(comando, desde);
    if (!hueco) {
      setModoPlantilla(false);
      return;
    }
    evento.preventDefault();
    input.setSelectionRange(hueco.inicio, hueco.fin);
  }

  const enviar = () => {
    const texto = comando.trim();
    if (!texto) return;
    if (problemas.length > 0) return; // ya se explica debajo de la caja; no se manda algo que se sabe roto
    if (corridaActiva) {
      setError("Ya hay una corrida activa. Detenla antes de lanzar otra.");
      return;
    }
    setError(null);
    setEnviando(true);
    enviarComando(texto)
      .then(() => {
        marcarCorridaActiva(texto);
        setComando("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnviando(false));
  };

  // La validación en vivo (Bloque 8) sale en el mismo sitio donde ya salía el error del envío,
  // no en uno nuevo — mientras hay algo mal escrito, manda ese aviso; el del servidor solo se ve
  // una vez la línea ya era válida y aun así falló al enviarla.
  const aviso = problemas.length > 0 ? problemas.map((problema) => problema.motivo).join(" ") : error;

  return (
    <Panel tabId="global" panelId="consola" titulo="Consola" disposicionPorDefecto={{ x: 2, y: 4, w: 96, h: 90, z: 10 }}>
      <div className="flex h-full flex-col gap-2">
        <ul className="flex-1 overflow-auto">
          {eventos.length === 0 ? (
            <p className="text-text-dim">Sin eventos todavía: lanza una puerta o escribe un comando.</p>
          ) : (
            eventos.map((evento, indice) => <LineaEvento key={`${evento.runId}-${String(indice)}`} evento={evento} />)
          )}
        </ul>
        {resumenFinal && <TarjetaResumen resumen={resumenFinal} />}
        {aviso && <p className="text-xs text-danger">{aviso}</p>}
        <div className="flex gap-1.5" ref={cajaRef} onKeyDownCapture={alTeclearCaja}>
          <Autocompletado
            valor={comando}
            onCambiarValor={setComando}
            onEnviar={enviar}
            onAbrirFicha={onAbrirFicha}
            disabled={enviando}
            placeholder="record --headed <url>"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="rounded-7 border border-accent bg-accent px-3 py-1 text-xs font-bold text-on-accent disabled:opacity-50"
          >
            ▶️
          </button>
        </div>
      </div>
    </Panel>
  );
}
