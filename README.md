# Agente-QA-Web

Una página que abres en tu ordenador, dentro de la carpeta de un proyecto de `Agente-QA-MCP`, para ver
de un vistazo qué sabe ya de tu aplicación y (más adelante) lanzar la exploración sin tocar la
consola.

## Qué hace hoy

- Se abre dentro de la carpeta de tu proyecto y te enseña de verdad cuántas pantallas y localizadores
  tiene el mapa que ya conoce, si tiene tests generados, y si le falta algo para empezar (`init`).
- **Configuración**: cambia el proveedor de IA, el modelo de cada perfil, el modo de coste y las
  claves de API sin salir de la web — cada campo dice de dónde viene (variable de entorno, `.env` del
  proyecto o global) y las claves se ven enmascaradas hasta que pulsas el botón de ver. También puedes
  probar el proveedor y ejecutar el diagnóstico (`doctor`) desde aquí.
- **Explorar**: lanza el explorador por cualquiera de sus cuatro puertas (instantánea, grabación a
  mano, grabación conducida por Claude Code, o el bucle agéntico con un objetivo) y ve la corrida
  ocurrir: el árbol del mapa creciendo, el coste subiendo, y "Detener" siempre a mano. Puedes
  escribirle al agente a mitad de corrida para redirigirlo, o lanzar una exploración nueva
  simplemente escribiendo lo que quieres en lenguaje normal. Si un localizador quedó marcado como
  ambiguo, lo corriges desde el propio árbol, sin tocar `map.json` a mano.
- Las otras 4 secciones (Redactar, Generar, Ejecutar, Reparar) y Reports se pueden abrir y cada una te
  dice, con claridad, qué necesita para funcionar — todavía no existen los agentes que las llenarían,
  y la web nunca te enseña datos inventados mientras tanto.
- Los paneles de cada pantalla se pueden mover y redimensionar a tu gusto; la próxima vez que abras
  esa pestaña, siguen donde los dejaste.
- **Guía integrada**: bajo cada pestaña hay una ficha por cada comando que se puede usar ahí — qué
  hace, sus opciones reales y ejemplos que se insertan solos en la consola con los huecos ya
  marcados para rellenar. Se filtra por quién lo conduce, lo que cuesta o si ya está construido, y
  se busca por texto. En la barra lateral, "Referencia" (Motor/Instalar) explica todo lo que no es un
  comando en sí: perfiles, modos de coste, cómo se eligen los localizadores, cómo instalar los dos
  repos.
- **Consola global asistida**: la caja de comandos autocompleta mientras escribes (comandos, flags y
  sus valores válidos) y te avisa antes de que pulses Enter si algo de la línea está mal, en vez de
  dejarte descubrirlo al fallar.

## Qué le falta

- Las 4 secciones sin agente (Redactar, Generar, Ejecutar, Reparar) y Reports — necesitan agentes que
  todavía no existen en el resto del ecosistema.
- Resolver desde la web los candidatos de localizador que el sistema no pudo distinguir solo (hoy solo
  se corrige un localizador ya resuelto, no los que quedaron sin decidir).

## Cómo se arranca

Necesitas Node.js instalado y haber hecho `npm install` una vez en esta carpeta.

```
npm run dev -- --project c:\ruta\a\tu\proyecto
```

Se abre en `http://localhost:5173`. Si no le das ninguna carpeta, usa la carpeta desde la que
lanzaste el comando.
