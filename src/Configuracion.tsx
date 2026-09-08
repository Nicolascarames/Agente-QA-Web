import { useCallback, useEffect, useState } from "react";
import { Panel } from "./Panel";
import {
  ejecutarDoctor,
  guardarClave,
  guardarConfigProyecto,
  obtenerCli,
  obtenerClaves,
  obtenerConfigProyecto,
  probarProveedor,
  verClaveCompleta,
  verCredencialProyecto,
} from "./api";
import type {
  CambiosLlmProyecto,
  CapaConfig,
  ClaveInfo,
  ConfigProyectoRespuesta,
  EnvironmentApp,
  Modalidad,
  Proveedor,
  ResultadoCli,
  ResultadoSubproceso,
} from "../shared/tipos";

const ENTORNOS: EnvironmentApp[] = ["dev", "test", "staging", "production"];
const PROVEEDORES: Proveedor[] = ["anthropic", "openai", "google", "groq"];
const MODALIDADES: Modalidad[] = ["api", "suscripcion"];

const CLASE_CAMPO = "rounded-7 border border-border-soft bg-bg-sunken px-2 py-1.5 text-sm text-text-strong disabled:opacity-40";
const CLASE_FILA = "flex items-center justify-between gap-2 border-b border-bg-row py-2 last:border-b-0";
const CLASE_BOTON_SECUNDARIO =
  "w-fit rounded-7 border border-border-strong bg-bg-elev px-2.5 py-1.5 text-sm text-text-strong disabled:opacity-40";
const CLASE_BOTON_PRIMARIO =
  "w-fit rounded-7 border border-accent bg-accent px-3.5 py-1.5 text-sm font-bold text-on-accent disabled:opacity-50";

function EtiquetaCapa({ capa }: { capa: CapaConfig | null }) {
  if (!capa) return <span className="text-xs text-text-ghost">sin configurar</span>;
  const texto = capa === "entorno" ? "variable de entorno" : capa === "proyecto" ? "este proyecto" : "global";
  return <span className="text-xs text-text-faint">({texto})</span>;
}

function motivoNoEditable(capa: CapaConfig | null): string | undefined {
  return capa === "entorno" ? "Viene de una variable de entorno del sistema: no se puede editar desde la web." : undefined;
}

export function Configuracion() {
  return (
    // Geometría EXACTA de `panels.config` en design/mockup-design.js: mk(0,0,48,100) y
    // mk(51,0,49,100), los dos a 100% de alto — el mockup no tiene una tercera fila aquí,
    // así que "Diagnóstico" (antes un tercer panel, parche del Bloque 2) se funde dentro del
    // panel Global como su bloque "🩺 Estado del entorno" (ver SeccionDiagnostico más abajo).
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="configuracion" panelId="proyecto" titulo="📁 Este proyecto" disposicionPorDefecto={{ x: 0, y: 0, w: 48, h: 100, z: 1 }}>
          <SeccionProyecto />
        </Panel>
        <Panel tabId="configuracion" panelId="global" titulo="🌍 Global" disposicionPorDefecto={{ x: 51, y: 0, w: 49, h: 100, z: 1 }}>
          <SeccionGlobal />
        </Panel>
      </div>
    </div>
  );
}

// --- Este proyecto -------------------------------------------------------------------------

type CargaProyecto = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: ConfigProyectoRespuesta };

/**
 * `llm` de `CambiosConfigProyecto`: o `suscripcion` (nada más que decir) o `api` con proveedor y
 * modelo completos — nunca a medias, mismo criterio que el contrato (Spec B, Bloque 3). Devuelve
 * un mensaje de error en vez de lanzar: el formulario lo enseña y no manda el `PUT`.
 */
export function construirCambiosLlm(modalidad: Modalidad, proveedor: Proveedor | "", modelo: string): CambiosLlmProyecto | { error: string } {
  if (modalidad === "suscripcion") return { modalidad: "suscripcion" };
  if (!proveedor || modelo.trim() === "") {
    return { error: 'Con modalidad "api" hacen falta proveedor y modelo: no se ha guardado nada.' };
  }
  return { modalidad: "api", proveedor, modelo: modelo.trim() };
}

function SeccionProyecto() {
  const [carga, setCarga] = useState<CargaProyecto>({ estado: "cargando" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [appUrl, setAppUrl] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentApp>("dev");
  const [modalidad, setModalidad] = useState<Modalidad>("api");
  const [proveedorLlm, setProveedorLlm] = useState<Proveedor | "">("");
  const [modeloLlm, setModeloLlm] = useState("");
  const [maxIterations, setMaxIterations] = useState(40);
  const [maxScreens, setMaxScreens] = useState(25);
  const [maxCostUsd, setMaxCostUsd] = useState(2);
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [memoriaTexto, setMemoriaTexto] = useState("{}");
  const [usuarioVisto, setUsuarioVisto] = useState<string | null>(null);
  const [passwordVisto, setPasswordVisto] = useState<string | null>(null);

  const recargar = useCallback(() => {
    setCarga({ estado: "cargando" });
    void obtenerConfigProyecto()
      .then((datos) => {
        setCarga({ estado: "listo", datos });
        if (datos.inicializado) {
          setAppUrl(datos.config.appUrl.valor);
          setEnvironment(datos.config.environment.valor);
          setModalidad(datos.config.llm.modalidad);
          setProveedorLlm(datos.config.llm.proveedor ?? "");
          setModeloLlm(datos.config.llm.modelo ?? "");
          setMaxIterations(datos.config.limits.maxIterations.valor);
          setMaxScreens(datos.config.limits.maxScreens.valor);
          setMaxCostUsd(datos.config.limits.maxCostUsd.valor);
          setMemoriaTexto(JSON.stringify(datos.config.memoria, null, 2));
        }
        setUsuarioVisto(null);
        setPasswordVisto(null);
      })
      .catch((err: unknown) => {
        setCarga({ estado: "error", mensaje: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const guardar = useCallback(() => {
    setMensaje(null);
    let memoria: unknown;
    try {
      memoria = JSON.parse(memoriaTexto) as unknown;
    } catch {
      setMensaje('La memoria del proyecto no es JSON válido: no se ha guardado nada.');
      return;
    }
    const llm = construirCambiosLlm(modalidad, proveedorLlm, modeloLlm);
    if ("error" in llm) {
      setMensaje(llm.error);
      return;
    }
    setGuardando(true);
    void guardarConfigProyecto({
      appUrl,
      environment,
      llm,
      limits: { maxIterations, maxScreens, maxCostUsd },
      credenciales: {
        ...(nuevoUsuario ? { usuario: nuevoUsuario } : {}),
        ...(nuevoPassword ? { password: nuevoPassword } : {}),
      },
      memoria,
    })
      .then(() => {
        setMensaje("Guardado.");
        setNuevoUsuario("");
        setNuevoPassword("");
        recargar();
      })
      .catch((err: unknown) => {
        setMensaje(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  }, [appUrl, environment, modalidad, proveedorLlm, modeloLlm, maxIterations, maxScreens, maxCostUsd, nuevoUsuario, nuevoPassword, memoriaTexto, recargar]);

  // "🧠 Memoria del proyecto" del mockup pinta filas de reglas ya escritas más "➕ Añadir
  // regla" — memory.json no tiene un esquema fijo en el contrato (`memoria: unknown`), así
  // que esa vista de lista solo se activa cuando el JSON real ya es un array (el caso que
  // documenta el plan maestro: frases sueltas). Si no lo es, se mantiene el editor JSON de
  // siempre — ninguna dato se inventa ni se fuerza a una forma que no tiene.
  let memoriaComoReglas: unknown[] | null = null;
  try {
    const parseado: unknown = JSON.parse(memoriaTexto);
    if (Array.isArray(parseado)) memoriaComoReglas = parseado;
  } catch {
    memoriaComoReglas = null;
  }

  if (carga.estado === "cargando") return <p className="text-text-dim">Cargando…</p>;
  if (carga.estado === "error") return <p className="text-accent">Error: {carga.mensaje}</p>;
  if (!carga.datos.inicializado) {
    return <p className="text-accent">Este proyecto no tiene .agente-qa/ todavía: ejecuta init desde el Dashboard.</p>;
  }
  const { config } = carga.datos;

  return (
    <div className="flex flex-col gap-1">
      <label className={CLASE_FILA}>
        <span className="text-text-muted">
          URL objetivo <EtiquetaCapa capa={config.appUrl.capa} />
        </span>
        <input
          className={`w-44 ${CLASE_CAMPO}`}
          value={appUrl}
          disabled={!config.appUrl.editable}
          title={motivoNoEditable(config.appUrl.capa)}
          onChange={(e) => setAppUrl(e.target.value)}
        />
      </label>

      <div className={CLASE_FILA}>
        <span className="text-text-muted">
          Entorno <EtiquetaCapa capa={config.environment.capa} />
        </span>
        {/*
          El mockup solo enseña dos opciones (staging/producción) en este segmentado; la
          funcionalidad real admite las cuatro de EnvironmentApp — manda la real (regla de
          fidelidad 4/6), se anota en el informe del bloque.
        */}
        <div className="flex overflow-hidden rounded-6 border border-border-soft">
          {ENTORNOS.map((valor) => {
            const activo = environment === valor;
            return (
              <button
                key={valor}
                type="button"
                disabled={!config.environment.editable}
                onClick={() => setEnvironment(valor)}
                className={`px-2.5 py-1 text-sm ${activo ? "bg-bg-elev text-accent-soft" : "bg-bg-sunken text-text-muted"} disabled:opacity-40`}
              >
                {valor}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modalidad de LLM (Spec B, Bloque 1): una sola activa, nunca perfiles ni roles. Vive en
          `llm` de config.json, siempre editable desde aquí — no tiene capa "entorno". */}
      <p className="mb-0.5 mt-3 text-xs uppercase tracking-[.04em] text-text-faint">Modalidad de LLM</p>
      <div className={CLASE_FILA}>
        <span className="text-text-muted">Modalidad</span>
        <div className="flex overflow-hidden rounded-6 border border-border-soft">
          {MODALIDADES.map((valor) => {
            const activo = modalidad === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setModalidad(valor)}
                className={`px-2.5 py-1 text-sm ${activo ? "bg-bg-elev text-accent-soft" : "bg-bg-sunken text-text-muted"}`}
              >
                {valor}
              </button>
            );
          })}
        </div>
      </div>
      {modalidad === "api" && (
        <>
          <label className={CLASE_FILA}>
            <span className="text-text-muted">Proveedor</span>
            <select className={CLASE_CAMPO} value={proveedorLlm} onChange={(e) => setProveedorLlm(e.target.value as Proveedor)}>
              <option value="">— elige uno —</option>
              {PROVEEDORES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className={CLASE_FILA}>
            <span className="text-text-muted">Modelo</span>
            <input
              className={`w-40 ${CLASE_CAMPO}`}
              placeholder="modelo"
              value={modeloLlm}
              onChange={(e) => setModeloLlm(e.target.value)}
            />
          </label>
        </>
      )}

      {/* Límites de la corrida: no están en el mockup (su pantalla de Configuración no los
          enseña), pero son funcionalidad real ya en uso — se conservan (regla de fidelidad 4/6). */}
      <p className="mb-0.5 mt-3 text-xs uppercase tracking-[.04em] text-text-faint">Límites</p>
      <label className={CLASE_FILA}>
        <span className="text-text-muted">
          Iteraciones máximas <EtiquetaCapa capa={config.limits.maxIterations.capa} />
        </span>
        <input
          type="number"
          className={`w-24 ${CLASE_CAMPO}`}
          value={maxIterations}
          onChange={(e) => setMaxIterations(Number(e.target.value))}
        />
      </label>
      <label className={CLASE_FILA}>
        <span className="text-text-muted">
          Pantallas máximas <EtiquetaCapa capa={config.limits.maxScreens.capa} />
        </span>
        <input
          type="number"
          className={`w-24 ${CLASE_CAMPO}`}
          value={maxScreens}
          onChange={(e) => setMaxScreens(Number(e.target.value))}
        />
      </label>
      <label className={CLASE_FILA}>
        <span className="text-text-muted">
          Coste máximo (USD) <EtiquetaCapa capa={config.limits.maxCostUsd.capa} />
        </span>
        <input
          type="number"
          step="0.1"
          className={`w-24 ${CLASE_CAMPO}`}
          value={maxCostUsd}
          onChange={(e) => setMaxCostUsd(Number(e.target.value))}
        />
      </label>

      <p className="mb-0.5 mt-3 text-md font-bold text-text-bright">🔑 Credenciales de test</p>
      <CampoSecretoProyecto
        etiqueta="Usuario"
        campo={config.credenciales.usuario}
        nuevoValor={nuevoUsuario}
        onCambiar={setNuevoUsuario}
        visto={usuarioVisto}
        onVer={() => {
          void verCredencialProyecto("usuario")
            .then((r) => setUsuarioVisto(r.valor))
            .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)));
        }}
      />
      <CampoSecretoProyecto
        etiqueta="Contraseña"
        campo={config.credenciales.password}
        nuevoValor={nuevoPassword}
        onCambiar={setNuevoPassword}
        visto={passwordVisto}
        onVer={() => {
          void verCredencialProyecto("password")
            .then((r) => setPasswordVisto(r.valor))
            .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)));
        }}
      />

      <h2 className="mb-0.5 mt-3 text-md font-bold text-text-bright">🧠 Memoria del proyecto</h2>
      <p className="mb-1.5 text-xs text-text-faint">.agente-qa/memory.json — editable, no caja negra</p>
      {memoriaComoReglas ? (
        <ul className="flex flex-col text-sm text-text">
          {memoriaComoReglas.length === 0 && <li className="py-1.5 text-text-dim">Ninguna todavía.</li>}
          {memoriaComoReglas.map((regla, indice) => (
            <li key={indice} className={CLASE_FILA}>
              <input
                className={`flex-1 ${CLASE_CAMPO}`}
                value={typeof regla === "string" ? regla : JSON.stringify(regla)}
                onChange={(e) => {
                  const siguiente = [...memoriaComoReglas];
                  siguiente[indice] = e.target.value;
                  setMemoriaTexto(JSON.stringify(siguiente, null, 2));
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <textarea
          className={`h-24 font-mono ${CLASE_CAMPO}`}
          value={memoriaTexto}
          onChange={(e) => setMemoriaTexto(e.target.value)}
        />
      )}
      <button
        type="button"
        disabled={!memoriaComoReglas}
        title={memoriaComoReglas ? undefined : "La memoria de este proyecto no es una lista de reglas: edítala como JSON arriba."}
        onClick={() => setMemoriaTexto(JSON.stringify([...(memoriaComoReglas ?? []), ""], null, 2))}
        className={`mt-2 ${CLASE_BOTON_SECUNDARIO}`}
      >
        ➕ Añadir regla
      </button>

      {mensaje && <p className="mt-3 text-sm text-accent">{mensaje}</p>}
      <button type="button" disabled={guardando} onClick={guardar} className={`mt-2 ${CLASE_BOTON_PRIMARIO}`}>
        {guardando ? "guardando…" : "Guardar cambios de este proyecto"}
      </button>
    </div>
  );
}

function CampoSecretoProyecto({
  etiqueta,
  campo,
  nuevoValor,
  onCambiar,
  visto,
  onVer,
}: {
  etiqueta: string;
  campo: { hayValor: boolean; ultimos4: string | null; capa: CapaConfig | null; editable: boolean };
  nuevoValor: string;
  onCambiar: (valor: string) => void;
  visto: string | null;
  onVer: () => void;
}) {
  return (
    <div className={CLASE_FILA}>
      <span className="text-text-muted">
        {etiqueta} <EtiquetaCapa capa={campo.capa} />
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-strong">{visto ?? (campo.hayValor ? `****${campo.ultimos4 ?? ""}` : "sin configurar")}</span>
        {campo.hayValor && (
          <button type="button" onClick={onVer} className="text-xs text-accent-soft hover:text-accent-hover">
            {visto ? "ocultar" : "ver"}
          </button>
        )}
        <input
          className={`w-44 ${CLASE_CAMPO} text-xs`}
          placeholder={`Nuevo valor (vacío = sin cambios)`}
          value={nuevoValor}
          disabled={!campo.editable}
          title={motivoNoEditable(campo.capa)}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </div>
    </div>
  );
}

// --- Global ---------------------------------------------------------------------------------
// La modalidad de LLM ya no vive aquí (Spec B, Bloque 1: es `llm` de `config.json` de cada
// proyecto — ver "Este proyecto" arriba). Lo único global de verdad son las claves de API
// (compartidas entre proyectos) y el diagnóstico del entorno.

type CargaClaves = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: ClaveInfo[] };

function SeccionGlobal() {
  const [claves, setClaves] = useState<CargaClaves>({ estado: "cargando" });
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [clavesNuevas, setClavesNuevas] = useState<Record<Proveedor, string>>({ anthropic: "", openai: "", google: "", groq: "" });
  const [clavesVistas, setClavesVistas] = useState<Partial<Record<Proveedor, string>>>({});

  const recargar = useCallback(() => {
    setClavesVistas({});
    void obtenerClaves()
      .then((datos) => setClaves({ estado: "listo", datos }))
      .catch((err: unknown) => setClaves({ estado: "error", mensaje: err instanceof Error ? err.message : String(err) }));
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const guardarClaveDe = useCallback(
    (proveedor: Proveedor) => {
      const valor = clavesNuevas[proveedor];
      if (!valor) return;
      void guardarClave(proveedor, valor, "global")
        .then((datos) => {
          setClaves({ estado: "listo", datos });
          setClavesNuevas((anterior) => ({ ...anterior, [proveedor]: "" }));
          setMensaje(`Clave de ${proveedor} guardada.`);
        })
        .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)));
    },
    [clavesNuevas]
  );

  const verClave = useCallback((proveedor: Proveedor) => {
    if (clavesVistas[proveedor] !== undefined) {
      setClavesVistas((anterior) => ({ ...anterior, [proveedor]: undefined }));
      return;
    }
    void verClaveCompleta(proveedor)
      .then((r) => setClavesVistas((anterior) => ({ ...anterior, [proveedor]: r.valor })))
      .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)));
  }, [clavesVistas]);

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-1.5 text-xs text-text-faint">%APPDATA%/agente-qa-mcp/</p>

      <h2 className="mb-1 mt-3 text-md font-bold text-text-bright">Claves de API</h2>
      {claves.estado === "cargando" && <p className="text-text-dim">Cargando…</p>}
      {claves.estado === "error" && <p className="text-accent">{claves.mensaje}</p>}
      {claves.estado === "listo" &&
        claves.datos.map((info) => (
          <div key={info.proveedor} className={CLASE_FILA}>
            <span className="w-20 text-text-muted">{info.proveedor}</span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <span className="font-mono text-xs text-text-strong">
                {clavesVistas[info.proveedor] ?? (info.hayClave ? `****${info.ultimos4 ?? ""}` : "sin configurar")}
              </span>
              <EtiquetaCapa capa={info.capa} />
              {info.hayClave && (
                <button type="button" onClick={() => verClave(info.proveedor)} className="text-xs text-accent-soft hover:text-accent-hover">
                  {clavesVistas[info.proveedor] !== undefined ? "ocultar" : "ver"}
                </button>
              )}
              <input
                className={`w-40 ${CLASE_CAMPO} text-xs`}
                placeholder="pegar clave nueva"
                value={clavesNuevas[info.proveedor]}
                onChange={(e) => setClavesNuevas((a) => ({ ...a, [info.proveedor]: e.target.value }))}
              />
              <button type="button" onClick={() => guardarClaveDe(info.proveedor)} className="text-xs text-accent-soft hover:text-accent-hover">
                guardar
              </button>
            </div>
          </div>
        ))}

      {mensaje && <p className="mt-3 text-sm text-accent">{mensaje}</p>}

      <SeccionDiagnostico />
    </div>
  );
}

// --- Diagnóstico: CLI localizado, doctor, prueba de proveedor -------------------------------
// Antes un tercer panel aparte (parche del Bloque 2); en la geometría real de
// `panels.config` es el bloque "🩺 Estado del entorno" dentro del panel Global.

function SeccionDiagnostico() {
  const [cli, setCli] = useState<ResultadoCli | null>(null);
  const [ejecutando, setEjecutando] = useState<"doctor" | "ping" | null>(null);
  const [resultado, setResultado] = useState<ResultadoSubproceso | null>(null);

  useEffect(() => {
    void obtenerCli().then(setCli);
  }, []);

  const lanzarDoctor = useCallback(() => {
    setEjecutando("doctor");
    void ejecutarDoctor()
      .then(setResultado)
      .finally(() => setEjecutando(null));
  }, []);

  // Sin argumentos: prueba la modalidad ya configurada en el proyecto (Spec B, Bloque 1 —
  // ya no hay perfiles que elegir, solo la modalidad activa de "Este proyecto").
  const lanzarPing = useCallback(() => {
    setEjecutando("ping");
    void probarProveedor({})
      .then(setResultado)
      .finally(() => setEjecutando(null));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-1 mt-3 flex items-center justify-between text-md font-bold text-text-bright">
        <span>🩺 Estado del entorno</span>
        <button
          type="button"
          disabled={ejecutando !== null}
          onClick={lanzarDoctor}
          className={`${CLASE_BOTON_SECUNDARIO} text-9.5`}
        >
          {ejecutando === "doctor" ? "ejecutando…" : "Ejecutar doctor"}
        </button>
      </h2>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">CLI:</span>
        {cli === null && <span className="text-text-dim">buscando…</span>}
        {cli && cli.encontrado && (
          <span className="text-text">
            encontrado por <strong className="text-text-strong">{cli.origen}</strong> ({cli.ruta})
          </span>
        )}
        {cli && !cli.encontrado && (
          <span className="text-accent" title={cli.diagnostico.join("\n")}>
            no encontrado — {cli.diagnostico[0]}
          </span>
        )}
      </div>

      {/* "Probar proveedor" no está en el mockup (su "Estado del entorno" solo trae el botón
          doctor); se conserva porque ya funcionaba antes de este bloque — la real manda
          (regla de fidelidad 4/6), y quitarla habría sido perder funcionalidad sin motivo. */}
      <div className="flex items-center gap-2">
        <button type="button" disabled={ejecutando !== null} onClick={lanzarPing} className={CLASE_BOTON_SECUNDARIO}>
          {ejecutando === "ping" ? "probando…" : "Probar proveedor"}
        </button>
      </div>

      {resultado && (
        <pre className="max-h-40 overflow-auto rounded-7 border border-border-soft bg-bg-sunken p-2 text-xs text-text">
          {`código: ${String(resultado.codigo)}\n\n${resultado.stdout}${resultado.stderr ? `\n--- stderr ---\n${resultado.stderr}` : ""}`}
        </pre>
      )}
    </div>
  );
}
