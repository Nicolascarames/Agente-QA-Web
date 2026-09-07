// Contenido de las dos pestañas de "Referencia" (Motor, Instalar) como datos estructurados —
// nunca marcado. Bloque 6 de la spec de guía integrada: sustituye a `docs/esquema-flujo.html`,
// que vivía fuera de la herramienta y se había desviado del código (su sección de localizadores
// describía el mecanismo anterior a la spec de "localizadores conscientes del DOM"). Cada dato de
// aquí está verificado contra el código o contra `agente-qa-mcp config --show`/`mcp tools` reales,
// no copiado del HTML.
import type { NotaFicha } from "./tipos";

export type ElementoSeccion =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "tabla"; encabezados: string[]; filas: string[][] }
  | { tipo: "nota"; nota: NotaFicha };

export interface Seccion {
  titulo: string;
  elementos: ElementoSeccion[];
}

export interface PaginaReferencia {
  titulo: string;
  intro: string;
  secciones: Seccion[];
}

export const SECCION_MOTOR: PaginaReferencia = {
  titulo: "Motor",
  intro:
    "Cómo decide el motor de `Agente-QA-MCP` quién conduce, cuánto cuesta y de dónde sale cada localizador. Las fichas de `mcp tools` y `catalog` están al pie, en la guía de esta pestaña.",
  secciones: [
    {
      titulo: "Perfiles: rápido y experto",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "El motor no tiene «un modelo»: tiene dos perfiles con nombre, cada uno con su propio proveedor, modelo y clave de API. Se pueden mezclar entre sí (por ejemplo, rápido con Groq y experto con Anthropic).",
        },
        {
          tipo: "lista",
          items: [
            "rapido — pensado para lo barato y mecánico: hoy solo traduce la frase libre de run \"...\" al objetivo concreto que entiende map.",
            "experto — el que de verdad decide: de fábrica es quien conduce el navegador (explorar con map/run, pasar el login). Si no está configurado, cae automáticamente en rapido, avisando una vez por proceso.",
          ],
        },
        {
          tipo: "nota",
          nota: { tipo: "ok", texto: "Se configuran con `agente-qa-mcp config`; `config --show` enseña los dos sin preguntar nada, con la clave enmascarada." },
        },
      ],
    },
    {
      titulo: "record --auto: una naturaleza aparte",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "record --auto no pasa por ningún perfil ni por ningún rol: en vez de un proveedor de API, delega en el CLI claude (Claude Code) instalado en la máquina, con sesión iniciada de pago. Por eso sus ejes son distintos a los del resto: conductor «Claude Code», coste «tu suscripción» — frente a record a mano, que es «humano»/«0 tokens».",
        },
        {
          tipo: "lista",
          items: [
            "Antes de que Claude Code pueda hacer clic, escribir o enviar un formulario, el programa pregunta una vez por consola si se lo autorizas (--allow-writes lo concede sin preguntar, --no-writes lo deniega siempre).",
            "En un proyecto marcado \"environment\": \"production\", se le permite escribir igual que a una grabación a mano —ni hace falta --allow-writes— pero avisa dos veces por consola de que está grabando contra el entorno real.",
            "Queda anotado en metrics con un coste teórico: no es un cargo real, porque corre contra la suscripción de Claude Code, no contra una clave de API.",
          ],
        },
      ],
    },
    {
      titulo: "Los tres modos de coste",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "Modulan la tabla rol → perfil, no la sustituyen. Se cambian con `config --cost-mode` o la variable AGENTE_QA_MCP_COST_MODE; de fábrica está en equilibrado.",
        },
        {
          tipo: "tabla",
          encabezados: ["Modo", "Qué hace"],
          filas: [
            ["ahorro", "Fuerza rapido en todos los roles, sin excepción — solo suben a experto si el bucle escala de verdad."],
            ["equilibrado (de fábrica)", "No fuerza nada: cada rol usa el perfil que le toque en la tabla rol → perfil."],
            ["calidad", "Fuerza experto en todos los roles."],
          ],
        },
      ],
    },
    {
      titulo: "Quién gana cuando hay conflicto",
      elementos: [
        { tipo: "parrafo", texto: "Cuatro niveles de precedencia, de mayor a menor:" },
        {
          tipo: "lista",
          items: [
            "1. Un --profile explícito en esa invocación concreta: siempre gana, pase lo que pase en el modo de coste o la tabla de roles.",
            "2. El modo de coste, si no es equilibrado: ahorro fuerza rapido, calidad fuerza experto.",
            "3. La tabla rol → perfil vigente (de fábrica o con el override de --role-<rol>), si el modo de coste es equilibrado.",
            "4. Si no hay ni perfil explícito ni rol conocido: rapido por defecto.",
          ],
        },
      ],
    },
    {
      titulo: "La tabla rol → perfil, de fábrica",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "Qué perfil arranca cada tarea que llama al LLM; se reasigna por rol con --role-<rol> o la variable AGENTE_QA_MCP_ROLE_<ROL>, sin tocar código. Todo lo que toca el navegador arranca en experto; la única conversión trivial (traducir una frase) arranca en rapido.",
        },
        {
          tipo: "tabla",
          encabezados: ["Rol", "Perfil de fábrica", "Qué hace"],
          filas: [
            ["map-loop", "experto", "El bucle de mapeo (map/run): decide qué explorar y cómo."],
            ["run-translate", "rapido", "Traduce la frase libre de run \"...\" al objetivo concreto de map."],
            ["login-fallback", "experto", "Pasar un login cuando no hay receta declarada."],
            ["web-chat", "experto", "Chat de esta web (sin uso real todavía)."],
            ["diagnosis", "experto", "Diagnóstico, futuro Reparar (sin uso real todavía)."],
          ],
        },
        {
          tipo: "nota",
          nota: {
            tipo: "aviso",
            texto: "El proveedor y el modelo concretos de cada perfil son los que hayas configurado tú: compara esta tabla, ya con los overrides aplicados, en `agente-qa-mcp config --show`.",
          },
        },
      ],
    },
    {
      titulo: "Escalar en vez de rendirse",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "El bucle de mapeo no se rinde ni repite ciegamente: si detecta una de cuatro señales, escala de rapido a experto para ese turno, y vuelve al perfil de partida en el primer turno limpio.",
        },
        {
          tipo: "lista",
          items: [
            "Fallos consecutivos repetidos.",
            "El propio modelo declara alta complejidad.",
            "El propio modelo declara confianza baja.",
            "Bucle detectado: repetir la misma acción sin avanzar.",
          ],
        },
      ],
    },
    {
      titulo: "Las herramientas que ve el modelo",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "@playwright/mcp expone 59 herramientas en total. El propio código de agente-qa-mcp usa 3 de ellas por su cuenta, sin pasar por el modelo. Al modelo solo se le enseña un catálogo reducido y seguro — 15 herramientas, las que sirven para navegar, interactuar y verificar, nunca las de borrar cookies, tracing o vídeo. `agente-qa-mcp mcp tools` imprime la lista completa con quién llama a cada una.",
        },
      ],
    },
    {
      titulo: "De dónde sale cada localizador",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "Cada localizador del mapa lee la página real antes de decidir: nunca se adivina un selector a partir del nombre o del propósito del elemento. El código prueba una escalera de ocho peldaños, y solo baja al siguiente si el anterior no distingue un único elemento:",
        },
        {
          tipo: "lista",
          items: [
            "recorded — el localizador que generó Playwright al pulsar durante una grabación.",
            "generated — browser_generate_locator, el generador nativo del motor de Playwright.",
            "role — getByRole con el nombre accesible.",
            "testid — un data-testid real leído del DOM (nunca un slug adivinado).",
            "label — getByLabel / placeholder / texto.",
            "attribute — un atributo estable (#id, [name]).",
            "container — acotado por un contenedor con nombre estable, hasta dos niveles.",
            "positional — posicional, acotado al contenedor con un índice real, nunca .nth() global.",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "Cada entrada del mapa guarda con qué peldaño se obtuvo (strategy) y de ahí sale su confianza (confidenceForStrategy): alta para recorded/generated/role/testid/human, media para label/attribute/container, baja para positional.",
        },
        {
          tipo: "parrafo",
          texto:
            "map --revisar repasa un mapa ya existente arreglando solo las pantallas con localizadores dudosos, sin reexplorar toda la app. --ask (combinable con --revisar) resalta en el navegador y pregunta por consola cuando ni el código sabe distinguir entre varios candidatos — desambiguación humana, no un intento más del modelo.",
        },
      ],
    },
    {
      titulo: "Qué se guarda de cada elemento del mapa",
      elementos: [
        { tipo: "parrafo", texto: "Además del propio localizador, cada entrada del mapa lleva:" },
        {
          tipo: "lista",
          items: [
            "name / kind — cómo se llama en el mapa y qué es (input, button, link, select, text, heading).",
            "accessibleName — el nombre accesible real, si lo tiene.",
            "count — cuántos elementos matchea en la página real (normalmente 1; mayor solo cuando la entrada representa un grupo verificado de elementos idénticos, como una fila de tabla repetida).",
            "disambiguatedBy — la región que se usó para acotarlo, si el candidato en bruto matcheaba más de uno.",
            "stateId — si el localizador solo existe en un estado no-por-defecto de la pantalla.",
            "producedBy / verifiedAt — quién lo produjo y cuándo se verificó por última vez contra la página real.",
            "fragile — presente y con motivo si usa un selector posicional.",
            "strategy — el peldaño de la escalera de arriba.",
          ],
        },
      ],
    },
    {
      titulo: "La sesión",
      elementos: [
        {
          tipo: "parrafo",
          texto:
            "La sesión autenticada usa el mecanismo nativo del MCP: se obtiene con browser_storage_state y se restaura con browser_set_storage_state, no con un cookie-jar propio. Se guarda en .agente-qa/state/ y, antes de fiarse de una sesión guardada, el bucle navega para revalidarla — nunca asume que sigue viva.",
        },
      ],
    },
    {
      titulo: "Los frenos en producción",
      elementos: [
        {
          tipo: "nota",
          nota: {
            tipo: "peligro",
            texto:
              "En un proyecto marcado \"environment\": \"production\", el bucle agéntico nunca escribe ni hace login — ni siquiera con --allow-writes, no hay excepción para ese entorno.",
          },
        },
        {
          tipo: "parrafo",
          texto:
            "Grabar sí escribe en producción (a mano o con --auto), porque ahí decide una persona, con aviso doble por consola. Son dos mecanismos distintos: uno protege al bucle automático, el otro deja a una persona decidir con los ojos abiertos.",
        },
      ],
    },
    {
      titulo: "Las cuatro piezas del sistema",
      elementos: [
        {
          tipo: "tabla",
          encabezados: ["Pieza", "Qué es"],
          filas: [
            ["agente-qa-contract", "Librería npm: esquema compartido de map.json y de la configuración, lanzador y parser de tests. No es un agente: es una dependencia, como zod."],
            ["Agente_QA", "Pipeline determinista con checkpoints humanos — el otro motor del ecosistema, repo hermano."],
            ["Agente-QA-MCP", "Este motor: el bucle agéntico sobre Playwright MCP (mapeador-mcp), más los agentes crawler/redactor/generador, que todavía no existen."],
            ["Agente-QA-Web", "Esta interfaz: orquestadora local que elige quién hace cada paso y lo lanza."],
          ],
        },
      ],
    },
  ],
};

export const SECCION_INSTALAR: PaginaReferencia = {
  titulo: "Instalar",
  intro: "Las dos entradas de instalación del ecosistema, actualizadas a los comandos de hoy.",
  secciones: [
    {
      titulo: "Instalar Agente-QA-MCP",
      elementos: [
        {
          tipo: "parrafo",
          texto: "Todavía no hay paquete publicado en npm: hoy se corre dentro del propio repo mientras se construye el resto del ecosistema.",
        },
        {
          tipo: "lista",
          items: [
            "npm install",
            "npm run build",
            "node dist/cli/index.js config — configura los perfiles rápido y experto (proveedor, modelo, clave).",
            "node dist/cli/index.js init — prepara la carpeta del proyecto (.agente-qa/).",
            "node dist/cli/index.js doctor — comprueba que los dos perfiles están listos para usarse.",
            "npx playwright install chromium (una sola vez) — el navegador que usa Playwright.",
          ],
        },
        {
          tipo: "nota",
          nota: {
            tipo: "aviso",
            texto: "Cuando exista un paquete publicado, se podrá instalar en todo el ordenador o dentro de un proyecto concreto (fijando la versión), pero no mezclar las dos formas.",
          },
        },
        {
          tipo: "nota",
          nota: {
            tipo: "ok",
            texto: "Para grabar con record --auto además hace falta el CLI claude (Claude Code) instalado y con sesión iniciada, con una cuenta de pago.",
          },
        },
      ],
    },
    {
      titulo: "Instalar y lanzar Agente-QA-Web",
      elementos: [
        {
          tipo: "parrafo",
          texto: "Esta misma interfaz: se abre en tu ordenador, dentro de la carpeta de un proyecto de Agente-QA-MCP ya inicializado.",
        },
        {
          tipo: "lista",
          items: [
            "npm install (una sola vez, en esta carpeta).",
            "npm run dev -- --project c:\\ruta\\a\\tu\\proyecto — la lanza contra ese proyecto. Sin --project, usa la carpeta desde la que se lanzó el comando.",
            "Se abre en http://localhost:5173.",
          ],
        },
        {
          tipo: "nota",
          nota: { tipo: "ok", texto: "Es la misma herramienta por dentro: la web lanza el CLI de Agente-QA-MCP como subproceso, nunca importa su código." },
        },
      ],
    },
  ],
};
