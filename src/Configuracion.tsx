import { useCallback, useEffect, useState } from "react";
import { Panel } from "./Panel";
import {
  ejecutarDoctor,
  guardarClave,
  guardarConfigGlobal,
  guardarConfigProyecto,
  obtenerCli,
  obtenerClaves,
  obtenerConfigGlobal,
  obtenerConfigProyecto,
  probarProveedor,
  verClaveCompleta,
  verCredencialProyecto,
} from "./api";
import type {
  CambiosConfigGlobal,
  CapaConfig,
  ClaveInfo,
  ConfigGlobal,
  ConfigProyectoRespuesta,
  EnvironmentApp,
  ModoCoste,
  Perfil,
  Proveedor,
  ResultadoCli,
  ResultadoSubproceso,
  Rol,
} from "../shared/tipos";

const ENTORNOS: EnvironmentApp[] = ["dev", "test", "staging", "production"];
const PROVEEDORES: Proveedor[] = ["anthropic", "openai", "google", "groq"];
const PERFILES: Perfil[] = ["rapido", "experto"];
const MODOS_COSTE: ModoCoste[] = ["ahorro", "equilibrado", "calidad"];
const ROLES: { id: Rol; etiqueta: string }[] = [
  { id: "map-loop", etiqueta: "Bucle de mapeo (map/run)" },
  { id: "run-translate", etiqueta: 'Traducción de run "..."' },
  { id: "login-fallback", etiqueta: "Login sin receta declarada" },
  { id: "web-chat", etiqueta: "Chat de esta web" },
  { id: "diagnosis", etiqueta: "Diagnóstico (futuro Reparar)" },
];

function EtiquetaCapa({ capa }: { capa: CapaConfig | null }) {
  if (!capa) return <span className="text-xs text-text/40">sin configurar</span>;
  const texto = capa === "entorno" ? "variable de entorno" : capa === "proyecto" ? "este proyecto" : "global";
  return <span className="text-xs text-text/50">({texto})</span>;
}

function motivoNoEditable(capa: CapaConfig | null): string | undefined {
  return capa === "entorno" ? "Viene de una variable de entorno del sistema: no se puede editar desde la web." : undefined;
}

export function Configuracion() {
  return (
    <div className="relative h-full w-full overflow-auto">
      <Panel tabId="configuracion" panelId="proyecto" titulo="Este proyecto" disposicionPorDefecto={{ x: 16, y: 16, width: 520, height: 460 }}>
        <SeccionProyecto />
      </Panel>
      <Panel
        tabId="configuracion"
        panelId="global"
        titulo="Global — todos tus proyectos"
        disposicionPorDefecto={{ x: 560, y: 16, width: 520, height: 460 }}
      >
        <SeccionGlobal />
      </Panel>
      <Panel tabId="configuracion" panelId="diagnostico" titulo="Diagnóstico" disposicionPorDefecto={{ x: 16, y: 500, width: 1064, height: 260 }}>
        <SeccionDiagnostico />
      </Panel>
    </div>
  );
}

// --- Este proyecto -------------------------------------------------------------------------

type CargaProyecto = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: ConfigProyectoRespuesta };

function SeccionProyecto() {
  const [carga, setCarga] = useState<CargaProyecto>({ estado: "cargando" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [appUrl, setAppUrl] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentApp>("dev");
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
    setGuardando(true);
    void guardarConfigProyecto({
      appUrl,
      environment,
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
  }, [appUrl, environment, maxIterations, maxScreens, maxCostUsd, nuevoUsuario, nuevoPassword, memoriaTexto, recargar]);

  if (carga.estado === "cargando") return <p>Cargando…</p>;
  if (carga.estado === "error") return <p className="text-warning">Error: {carga.mensaje}</p>;
  if (!carga.datos.inicializado) {
    return <p className="text-warning">Este proyecto no tiene .agente-qa/ todavía: ejecuta init desde el Dashboard.</p>;
  }
  const { config } = carga.datos;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-text/60">URL de la app <EtiquetaCapa capa={config.appUrl.capa} /></span>
        <input
          className="rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={appUrl}
          disabled={!config.appUrl.editable}
          title={motivoNoEditable(config.appUrl.capa)}
          onChange={(e) => setAppUrl(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text/60">Entorno <EtiquetaCapa capa={config.environment.capa} /></span>
        <select
          className="rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={environment}
          disabled={!config.environment.editable}
          onChange={(e) => setEnvironment(e.target.value as EnvironmentApp)}
        >
          {ENTORNOS.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2 rounded-md border border-accent/20 p-2">
        <legend className="px-1 text-text/60">Límites</legend>
        <label className="flex items-center justify-between gap-2">
          <span>Iteraciones máximas <EtiquetaCapa capa={config.limits.maxIterations.capa} /></span>
          <input
            type="number"
            className="w-24 rounded-md border border-accent/30 bg-bg px-2 py-1"
            value={maxIterations}
            onChange={(e) => setMaxIterations(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Pantallas máximas <EtiquetaCapa capa={config.limits.maxScreens.capa} /></span>
          <input
            type="number"
            className="w-24 rounded-md border border-accent/30 bg-bg px-2 py-1"
            value={maxScreens}
            onChange={(e) => setMaxScreens(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Coste máximo (USD) <EtiquetaCapa capa={config.limits.maxCostUsd.capa} /></span>
          <input
            type="number"
            step="0.1"
            className="w-24 rounded-md border border-accent/30 bg-bg px-2 py-1"
            value={maxCostUsd}
            onChange={(e) => setMaxCostUsd(Number(e.target.value))}
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-accent/20 p-2">
        <legend className="px-1 text-text/60">Credenciales de la app bajo test</legend>
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
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-text/60">Memoria del proyecto (memory.json)</span>
        <textarea
          className="h-24 rounded-md border border-accent/30 bg-bg px-2 py-1 font-mono text-xs"
          value={memoriaTexto}
          onChange={(e) => setMemoriaTexto(e.target.value)}
        />
      </label>

      {mensaje && <p className="text-sm text-accent">{mensaje}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={guardar}
        className="w-fit rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
      >
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span>
          {etiqueta} <EtiquetaCapa capa={campo.capa} />
        </span>
        <span className="font-mono text-xs">
          {visto ?? (campo.hayValor ? `****${campo.ultimos4 ?? ""}` : "sin configurar")}
          {campo.hayValor && !visto && (
            <button type="button" onClick={onVer} className="ml-2 text-accent hover:underline">
              ver
            </button>
          )}
          {visto && (
            <button type="button" onClick={() => onVer()} className="ml-2 text-accent hover:underline">
              ocultar
            </button>
          )}
        </span>
      </div>
      <input
        className="rounded-md border border-accent/30 bg-bg px-2 py-1"
        placeholder={`Nuevo valor de ${etiqueta.toLowerCase()} (vacío = sin cambios)`}
        value={nuevoValor}
        disabled={!campo.editable}
        title={motivoNoEditable(campo.capa)}
        onChange={(e) => onCambiar(e.target.value)}
      />
    </div>
  );
}

// --- Global ---------------------------------------------------------------------------------

type CargaGlobal = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: ConfigGlobal };
type CargaClaves = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: ClaveInfo[] };

type EstadoPerfiles = Record<Perfil, { provider: Proveedor | null; model: string }>;
type EstadoGlobalForm = { modoCoste: ModoCoste; perfiles: EstadoPerfiles; roles: Record<Rol, Perfil> };

/**
 * Diff puro entre lo que hay en el formulario y lo cargado en el último GET: solo lo que el
 * usuario tocó de verdad viaja en el `PUT`. Nunca manda un `provider` que siga en `null` (sin
 * configurar) y nunca reescribe un campo bloqueado por entorno que nadie tocó.
 */
export function calcularCambiosGlobal(actual: EstadoGlobalForm, inicial: EstadoGlobalForm): CambiosConfigGlobal {
  const cambios: CambiosConfigGlobal = {};
  if (actual.modoCoste !== inicial.modoCoste) cambios.modoCoste = actual.modoCoste;

  const perfilesCambiados: NonNullable<CambiosConfigGlobal["perfiles"]> = {};
  for (const perfil of PERFILES) {
    const cambiosPerfil: { provider?: Proveedor; model?: string } = {};
    if (actual.perfiles[perfil].provider !== inicial.perfiles[perfil].provider && actual.perfiles[perfil].provider !== null) {
      cambiosPerfil.provider = actual.perfiles[perfil].provider;
    }
    if (actual.perfiles[perfil].model !== inicial.perfiles[perfil].model) cambiosPerfil.model = actual.perfiles[perfil].model;
    if (Object.keys(cambiosPerfil).length > 0) perfilesCambiados[perfil] = cambiosPerfil;
  }
  if (Object.keys(perfilesCambiados).length > 0) cambios.perfiles = perfilesCambiados;

  const rolesCambiados: NonNullable<CambiosConfigGlobal["roles"]> = {};
  for (const rol of ROLES) {
    if (actual.roles[rol.id] !== inicial.roles[rol.id]) rolesCambiados[rol.id] = actual.roles[rol.id];
  }
  if (Object.keys(rolesCambiados).length > 0) cambios.roles = rolesCambiados;

  return cambios;
}

function SeccionGlobal() {
  const [carga, setCarga] = useState<CargaGlobal>({ estado: "cargando" });
  const [claves, setClaves] = useState<CargaClaves>({ estado: "cargando" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [modoCoste, setModoCoste] = useState<ModoCoste>("equilibrado");
  const [perfiles, setPerfiles] = useState<Record<Perfil, { provider: Proveedor | null; model: string }>>({
    rapido: { provider: null, model: "" },
    experto: { provider: null, model: "" },
  });
  const [roles, setRoles] = useState<Record<Rol, Perfil>>({
    "map-loop": "experto",
    "run-translate": "rapido",
    "login-fallback": "experto",
    "web-chat": "experto",
    diagnosis: "experto",
  });
  // Instantánea de lo recibido en el último GET: `guardar` compara contra esto para mandar solo lo que cambió.
  const [modoCosteInicial, setModoCosteInicial] = useState<ModoCoste>("equilibrado");
  const [perfilesInicial, setPerfilesInicial] = useState<Record<Perfil, { provider: Proveedor | null; model: string }>>({
    rapido: { provider: null, model: "" },
    experto: { provider: null, model: "" },
  });
  const [rolesInicial, setRolesInicial] = useState<Record<Rol, Perfil>>({
    "map-loop": "experto",
    "run-translate": "rapido",
    "login-fallback": "experto",
    "web-chat": "experto",
    diagnosis: "experto",
  });
  const [clavesNuevas, setClavesNuevas] = useState<Record<Proveedor, string>>({ anthropic: "", openai: "", google: "", groq: "" });
  const [clavesVistas, setClavesVistas] = useState<Partial<Record<Proveedor, string>>>({});

  const recargar = useCallback(() => {
    setCarga({ estado: "cargando" });
    void obtenerConfigGlobal()
      .then((datos) => {
        setCarga({ estado: "listo", datos });
        setModoCoste(datos.modoCoste.valor);
        setModoCosteInicial(datos.modoCoste.valor);
        const perfilesCargados = {} as Record<Perfil, { provider: Proveedor | null; model: string }>;
        for (const perfil of PERFILES) {
          perfilesCargados[perfil] = {
            provider: datos.perfiles[perfil].provider.valor,
            model: datos.perfiles[perfil].model.valor ?? "",
          };
        }
        setPerfiles(perfilesCargados);
        setPerfilesInicial(perfilesCargados);
        const rolesCargados = {} as Record<Rol, Perfil>;
        for (const rol of ROLES) rolesCargados[rol.id] = datos.roles[rol.id].valor;
        setRoles(rolesCargados);
        setRolesInicial(rolesCargados);
      })
      .catch((err: unknown) => setCarga({ estado: "error", mensaje: err instanceof Error ? err.message : String(err) }));

    setClavesVistas({});
    void obtenerClaves()
      .then((datos) => setClaves({ estado: "listo", datos }))
      .catch((err: unknown) => setClaves({ estado: "error", mensaje: err instanceof Error ? err.message : String(err) }));
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const guardar = useCallback(() => {
    setGuardando(true);
    setMensaje(null);

    const cambios = calcularCambiosGlobal({ modoCoste, perfiles, roles }, { modoCoste: modoCosteInicial, perfiles: perfilesInicial, roles: rolesInicial });

    void guardarConfigGlobal(cambios)
      .then(() => {
        setMensaje("Guardado.");
        recargar();
      })
      .catch((err: unknown) => setMensaje(err instanceof Error ? err.message : String(err)))
      .finally(() => setGuardando(false));
  }, [modoCoste, modoCosteInicial, perfiles, perfilesInicial, roles, rolesInicial, recargar]);

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

  if (carga.estado === "cargando") return <p>Cargando…</p>;
  if (carga.estado === "error") return <p className="text-warning">Error: {carga.mensaje}</p>;
  const datos = carga.datos;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text/50">
        Modalidad LLM: clave de API (única implementada hoy; la modalidad de suscripción no existe en agente-qa-mcp).
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-text/60">
          Modo de coste <EtiquetaCapa capa={datos.modoCoste.capa} />
        </span>
        <select
          className="rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={modoCoste}
          disabled={!datos.modoCoste.editable}
          onChange={(e) => setModoCoste(e.target.value as ModoCoste)}
        >
          {MODOS_COSTE.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-md border border-accent/20 p-2">
        <legend className="px-1 text-text/60">Perfiles</legend>
        {PERFILES.map((perfil) => (
          <div key={perfil} className="flex items-center gap-2">
            <span className="w-16">{perfil}</span>
            <select
              className="rounded-md border border-accent/30 bg-bg px-2 py-1"
              value={perfiles[perfil].provider ?? ""}
              disabled={!datos.perfiles[perfil].provider.editable}
              onChange={(e) =>
                setPerfiles((a) => ({
                  ...a,
                  [perfil]: { ...a[perfil], provider: e.target.value === "" ? null : (e.target.value as Proveedor) },
                }))
              }
            >
              <option value="">— sin configurar —</option>
              {PROVEEDORES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <EtiquetaCapa capa={datos.perfiles[perfil].provider.capa} />
            <input
              className="flex-1 rounded-md border border-accent/30 bg-bg px-2 py-1"
              placeholder="modelo"
              value={perfiles[perfil].model}
              disabled={!datos.perfiles[perfil].model.editable}
              onChange={(e) => setPerfiles((a) => ({ ...a, [perfil]: { ...a[perfil], model: e.target.value } }))}
            />
            <EtiquetaCapa capa={datos.perfiles[perfil].model.capa} />
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-accent/20 p-2">
        <legend className="px-1 text-text/60">Claves de API</legend>
        {claves.estado === "cargando" && <p>Cargando…</p>}
        {claves.estado === "error" && <p className="text-warning">{claves.mensaje}</p>}
        {claves.estado === "listo" &&
          claves.datos.map((info) => (
            <div key={info.proveedor} className="flex items-center gap-2">
              <span className="w-20">{info.proveedor}</span>
              <span className="w-40 font-mono text-xs">
                {clavesVistas[info.proveedor] ?? (info.hayClave ? `****${info.ultimos4 ?? ""}` : "sin configurar")}
                <EtiquetaCapa capa={info.capa} />
              </span>
              {info.hayClave && (
                <button type="button" onClick={() => verClave(info.proveedor)} className="text-xs text-accent hover:underline">
                  {clavesVistas[info.proveedor] !== undefined ? "ocultar" : "ver"}
                </button>
              )}
              <input
                className="flex-1 rounded-md border border-accent/30 bg-bg px-2 py-1 text-xs"
                placeholder="pegar clave nueva"
                value={clavesNuevas[info.proveedor]}
                onChange={(e) => setClavesNuevas((a) => ({ ...a, [info.proveedor]: e.target.value }))}
              />
              <button type="button" onClick={() => guardarClaveDe(info.proveedor)} className="text-xs text-accent hover:underline">
                guardar
              </button>
            </div>
          ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-accent/20 p-2">
        <legend className="px-1 text-text/60">Rol → perfil</legend>
        {ROLES.map((rol) => (
          <div key={rol.id} className="flex items-center justify-between gap-2">
            <span>{rol.etiqueta}</span>
            <div className="flex items-center gap-1">
              <select
                className="rounded-md border border-accent/30 bg-bg px-2 py-1"
                value={roles[rol.id]}
                disabled={!datos.roles[rol.id].editable}
                onChange={(e) => setRoles((a) => ({ ...a, [rol.id]: e.target.value as Perfil }))}
              >
                {PERFILES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <EtiquetaCapa capa={datos.roles[rol.id].capa} />
            </div>
          </div>
        ))}
      </fieldset>

      {mensaje && <p className="text-sm text-accent">{mensaje}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={guardar}
        className="w-fit rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
      >
        {guardando ? "guardando…" : "Guardar cambios globales"}
      </button>
    </div>
  );
}

// --- Diagnóstico: CLI localizado, doctor, prueba de proveedor -------------------------------

function SeccionDiagnostico() {
  const [cli, setCli] = useState<ResultadoCli | null>(null);
  const [perfilPrueba, setPerfilPrueba] = useState<Perfil>("rapido");
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

  const lanzarPing = useCallback(() => {
    setEjecutando("ping");
    void probarProveedor({ profile: perfilPrueba })
      .then(setResultado)
      .finally(() => setEjecutando(null));
  }, [perfilPrueba]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-text/60">CLI:</span>
        {cli === null && <span>buscando…</span>}
        {cli && cli.encontrado && (
          <span>
            encontrado por <strong>{cli.origen}</strong> ({cli.ruta})
          </span>
        )}
        {cli && !cli.encontrado && (
          <span className="text-warning" title={cli.diagnostico.join("\n")}>
            no encontrado — {cli.diagnostico[0]}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          className="rounded-md border border-accent/30 bg-bg px-2 py-1"
          value={perfilPrueba}
          onChange={(e) => setPerfilPrueba(e.target.value as Perfil)}
        >
          {PERFILES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={ejecutando !== null}
          onClick={lanzarPing}
          className="rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
        >
          {ejecutando === "ping" ? "probando…" : "Probar proveedor"}
        </button>
        <button
          type="button"
          disabled={ejecutando !== null}
          onClick={lanzarDoctor}
          className="rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
        >
          {ejecutando === "doctor" ? "ejecutando…" : "Ejecutar doctor"}
        </button>
      </div>

      {resultado && (
        <pre className="flex-1 overflow-auto rounded-md border border-accent/20 bg-bg p-2 text-xs">
          {`código: ${String(resultado.codigo)}\n\n${resultado.stdout}${resultado.stderr ? `\n--- stderr ---\n${resultado.stderr}` : ""}`}
        </pre>
      )}
    </div>
  );
}
