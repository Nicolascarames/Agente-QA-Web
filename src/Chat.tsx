import { useState } from "react";
import { enviarMensaje } from "./api";
import type { RespuestaMensaje } from "../shared/tipos";

// Bloque 6 de la spec: la caja siempre está activa, nunca deshabilitada por si hay o no corrida —
// eso lo decide el servidor (`POST /api/mensaje`), no esta caja. El eco del propio mensaje del
// usuario se pinta en el registro de `Explorar.tsx` (mismo stream SSE, ver `alHablar` allí);
// este componente solo manda y avisa del resultado, no mantiene su propia lista de mensajes.
export interface ChatProps {
  onEnviado: (texto: string, resultado: RespuestaMensaje) => void;
}

export function Chat({ onEnviado }: ChatProps) {
  const [texto, setTexto] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = () => {
    const mensaje = texto.trim();
    if (!mensaje || enCurso) return;
    setError(null);
    setEnCurso(true);
    void enviarMensaje(mensaje)
      .then((resultado) => {
        setTexto("");
        onEnviado(mensaje, resultado);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnCurso(false));
  };

  return (
    <div className="flex h-full flex-col gap-2 text-sm">
      <p className="text-xs text-text/60">
        Con una corrida en marcha, redirige al agente a mitad de turno. Sin ninguna, lo que escribas aquí lanza una nueva.
      </p>
      {error && <p className="text-xs text-warning">{error}</p>}
      <div className="mt-auto flex gap-2">
        <input
          className="flex-1 rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={texto}
          disabled={enCurso}
          placeholder="habla con el agente…"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
        />
        <button
          type="button"
          disabled={enCurso || !texto.trim()}
          onClick={enviar}
          className="rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
        >
          {enCurso ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
