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
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs text-text-faint">
        Con una corrida en marcha, redirige al agente a mitad de turno. Sin ninguna, lo que escribas aquí lanza una nueva.
      </p>
      {error && <p className="text-xs text-accent">{error}</p>}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2 py-2 text-text-bright"
          value={texto}
          disabled={enCurso}
          placeholder="Habla con el agente activo…"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
        />
        <button
          type="button"
          disabled={enCurso || !texto.trim()}
          onClick={enviar}
          className="rounded-7 border border-accent bg-accent px-3 py-2 font-bold text-on-accent disabled:opacity-50"
        >
          {enCurso ? "…" : "📤"}
        </button>
      </div>
    </div>
  );
}
