# Agente-QA-Web

Una página que abres en tu ordenador, dentro de la carpeta de un proyecto de `Agente-QA-MCP`, para ver
de un vistazo qué sabe ya de tu aplicación y (más adelante) lanzar la exploración sin tocar la
consola.

## Qué hace hoy

- Se abre dentro de la carpeta de tu proyecto y te enseña de verdad cuántas pantallas y localizadores
  tiene el mapa que ya conoce, si tiene tests generados, y si le falta algo para empezar (`init`).
- Tiene 8 secciones (pestañas). Solo el Dashboard funciona de verdad por ahora; las otras 7 se pueden
  abrir y cada una te dice, con claridad, qué necesita para funcionar — nunca te enseña datos
  inventados.
- Los paneles de cada pantalla se pueden mover y redimensionar a tu gusto; la próxima vez que abras
  esa pestaña, siguen donde los dejaste.

## Qué le falta

- Configurar el proyecto (URL, proveedor de IA, claves) desde la propia web — hoy solo por consola en
  `Agente-QA-MCP`.
- Lanzar la exploración y verla ocurrir en vivo, con el coste subiendo y un botón para pararla.
- Hablarle al agente mientras trabaja y corregir un localizador desde la propia pantalla.

## Cómo se arranca

Necesitas Node.js instalado y haber hecho `npm install` una vez en esta carpeta.

```
npm run dev -- --project c:\ruta\a\tu\proyecto
```

Se abre en `http://localhost:5173`. Si no le das ninguna carpeta, usa la carpeta desde la que
lanzaste el comando.
