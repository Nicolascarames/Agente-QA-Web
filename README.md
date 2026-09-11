# Agente-QA-Web

Escribes en castellano lo que quieres probar. Sale un test de Playwright que **ya se ha ejecutado y
está verde**.

> **Todavía no funciona.** El plan está escrito y aprobado, la implementación no ha empezado. Lo que
> hay hoy es una cáscara de interfaz. Ver `ESTADO.md`.

## Qué va a hacer

Te pones en cualquier repo tuyo y escribes:

```
npx agente-qa
```

Se abre una página en tu navegador, trabajando sobre **ese** repo. Escribes lo que quieres probar:

> quiero probar que se puede añadir un producto al carrito

Y entonces:

1. **Mira tu web de verdad.** Abre el navegador y lee la pantalla.
2. **Te pregunta lo que sea ambiguo**, con botones. *«He encontrado 6 productos. ¿Un producto
   concreto o cualquiera?»*
3. **Te enseña lo que ha entendido**, en lenguaje llano, antes de escribir nada:

   > Dado que he iniciado sesión y estoy en el catálogo
   > Cuando añado "Sauce Labs Backpack" al carrito
   > Entonces el carrito muestra 1 artículo

   Lo lees en diez segundos. Si se ha equivocado, lo corriges ahí mismo. **Este es el momento de
   corregir barato.**
4. **Escribe el código**: el Page Object y el test.
5. **Lo ejecuta.** Si falla, lee el error, lo corrige y vuelve a ejecutar.
6. **Te enseña el diff.** Aceptas o descartas. Si aceptas, se commitea.

Los ficheros se generan en `tests/` de tu repo, así que se versionan junto a la aplicación que
prueban.

## Qué necesitas

- **Node.js 18 o superior.**
- **Claude Code instalado y con tu sesión iniciada** en ese ordenador. Se usa tu suscripción: no hace
  falta ninguna clave de API ni configurar nada en el repo.
- **Playwright** en el repo donde vayas a generar los tests.

`npx agente-qa doctor` comprueba las tres cosas y te dice el comando exacto que falta.

Un `claude login` por ordenador y todos tus repos de esa máquina funcionan.

## También desde la terminal

La misma inteligencia se puede usar sin la web, con Claude Code, Codex o Copilot:

```
npx agente-qa instalar
```

Deja las instrucciones donde cada uno las busca. A partir de ahí le pides el test directamente en tu
terminal o en VS Code. Los tests que generes así **también aparecen en la web**, porque la interfaz
lee la carpeta del repo.

## Trabajando contra una aplicación real

Explorar significa pulsar botones de verdad: crear pedidos, mandar correos, borrar cosas. Por eso hay
un interruptor por repo:

- **Apagado** (por defecto en entornos de prueba): barra libre.
- **Encendido**: cualquier envío que no esté en tu lista blanca se detiene y te pregunta, diciéndote a
  qué entorno apunta.

Las credenciales salen siempre de variables de entorno y nunca aparecen en un log ni viajan al
modelo.
