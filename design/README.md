# `design/` — de dónde sale esto y cómo se regenera

Los dos ficheros de esta carpeta son extraídos de
`inspiraciones/QA Agent (standalone).html` en `Agente-QA-MCP`, no escritos a mano.
Son la referencia visual/funcional del mockup: se abren al lado del navegador para
comparar, no se editan ni se importan desde `src/`.

## Qué es el standalone

Es un **export de Claude Design autodesempaquetable**: un `<script>` en el `<head>`
lee dos `<script type="__bundler/...">` del `<body>` y reconstruye la página real en
tiempo de ejecución (crea blobs de JS/CSS/fuentes y los inyecta). El HTML de esos dos
`<script>` está serializado como **string JSON**, no como HTML plano, por eso no se
puede copiar y pegar directamente.

## Cómo se desempaquetaron `mockup.html` y `mockup-design.js`

Sobre `inspiraciones/QA Agent (standalone).html` (392 líneas, líneas largas):

1. **`design/mockup.html`** sale de la línea 390 (`<script type="__bundler/template">`):
   es un string JSON con el HTML real de la página, 1.126 líneas una vez desempaquetado.
   Para regenerarlo:

   ```powershell
   $lines = Get-Content 'inspiraciones\QA Agent (standalone).html'
   $template = $lines[389] | ConvertFrom-Json
   Set-Content design\mockup.html $template
   ```

   (o el equivalente en Node: `JSON.parse(lines[389])`, que es lo que se usó aquí).

2. **`design/mockup-design.js`** sale de dentro de ese HTML ya desempaquetado: el
   `<script type="text/x-dc" data-dc-script="">` de las líneas 866–1122 de
   `design/mockup.html` (256 líneas de código + las 2 etiquetas de apertura/cierre).
   Es el componente React del mockup — estado inicial, geometría de paneles por
   pestaña (`panels.<pestana>`, en % del contenedor) y los textos de atrezo (chats de
   ejemplo). No se ejecuta en este repo (`DCLogic`, su clase base, es el runtime del
   bundler y no existe fuera del standalone); es solo referencia para portar valores.

3. El **manifiesto de assets** vive en la línea 378
   (`<script type="__bundler/manifest">`), también como string JSON:
   `{ "<uuid>": { "mime": "...", "compressed": bool, "data": "<base64>" }, ... }`.
   Contiene 15 entradas: 3 paquetes de JS (`text/javascript`, `compressed: true`,
   gzip) y **12 fuentes** (`font/woff2`, `compressed: false` — las fuentes van tal
   cual, sin comprimir). Los 12 `.woff2` de `public/fonts/` son
   `Buffer.from(entry.data, 'base64')` de esas 12 entradas.

   Mapa uuid (8 primeros caracteres) → fichero, para volver a extraerlos si el
   mockup cambia:

   | uuid | subconjunto | estilo | fichero |
   |---|---|---|---|
   | `b11b679f` | cyrillic-ext | normal | `jetbrains-mono-normal-cyrillic-ext.woff2` |
   | `ba90fc6b` | cyrillic | normal | `jetbrains-mono-normal-cyrillic.woff2` |
   | `0b62e08e` | greek | normal | `jetbrains-mono-normal-greek.woff2` |
   | `acd67c18` | vietnamese | normal | `jetbrains-mono-normal-vietnamese.woff2` |
   | `ae49aa27` | latin-ext | normal | `jetbrains-mono-normal-latin-ext.woff2` |
   | `bc40f58a` | latin | normal | `jetbrains-mono-normal-latin.woff2` |
   | `a3c1822a` | cyrillic-ext | italic | `jetbrains-mono-italic-cyrillic-ext.woff2` |
   | `3c96941b` | cyrillic | italic | `jetbrains-mono-italic-cyrillic.woff2` |
   | `6555ff6e` | greek | italic | `jetbrains-mono-italic-greek.woff2` |
   | `fa8fb321` | vietnamese | italic | `jetbrains-mono-italic-vietnamese.woff2` |
   | `83b9661a` | latin-ext | italic | `jetbrains-mono-italic-latin-ext.woff2` |
   | `a237cc55` | latin | italic | `jetbrains-mono-italic-latin.woff2` |

   Los `@font-face` de `src/tokens.css` referencian estos ficheros por
   `unicode-range` (uno de los 12 hace de fuente real según el idioma del texto);
   se guardan los 12 aunque la interfaz esté en castellano porque el navegador solo
   descarga el subconjunto que usa, así que los otros no cuestan nada en ejecución.

## Cuándo se regenera

Solo si `inspiraciones/QA Agent (standalone).html` cambia (nueva versión del mockup).
No hay build automatizado para esto — es un desempaquetado manual de una vez, con el
resultado congelado en el repo.
