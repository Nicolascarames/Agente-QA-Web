import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { gherkin } from "@codemirror/legacy-modes/mode/gherkin";
import { diff } from "@codemirror/legacy-modes/mode/diff";

// Editor con resaltado de sintaxis tipo VS Code para .feature/.page.ts/.spec.ts y diffs, en vez del
// textarea/pre plano anterior. Sin line wrapping (scroll horizontal, como VS Code): los ficheros ya
// vienen cortados a ~100 columnas, envolverlos además en el editor partía las líneas a mitad.
const EXTENSIONES_POR_LENGUAJE: Record<"gherkin" | "typescript" | "diff", Extension> = {
  typescript: javascript({ typescript: true }),
  gherkin: StreamLanguage.define(gherkin),
  diff: StreamLanguage.define(diff),
};

interface EditorCodigoProps {
  valor: string;
  onCambio?: (v: string) => void;
  lenguaje: "gherkin" | "typescript" | "diff";
  soloLectura?: boolean;
  className?: string;
}

export function EditorCodigo({ valor, onCambio, lenguaje, soloLectura = false, className = "min-h-0 flex-1" }: EditorCodigoProps) {
  return (
    <div className={`overflow-hidden rounded-7 border border-border-soft ${className}`}>
      <CodeMirror
        value={valor}
        onChange={onCambio}
        theme={vscodeDark}
        extensions={[EXTENSIONES_POR_LENGUAJE[lenguaje]]}
        editable={!soloLectura}
        readOnly={soloLectura}
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false }}
        // 12px es el tamaño 2xs de la escala (tailwind.config.ts) antes del ajuste — CodeMirror no
        // lee clases Tailwind, así que sigue la preferencia de texto (src/preferenciasUI.ts) a mano
        // con el mismo `--ajuste-texto` que aplica App.tsx en runtime.
        style={{ height: "100%", fontSize: "calc(12px + var(--ajuste-texto))" }}
      />
    </div>
  );
}
