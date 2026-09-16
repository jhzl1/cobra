# Cobra — convenciones del panel

Lo que ya se decidió y no hay que volver a discutir. Todo esto vive en `apps/web`.

## Crear siempre abre un modal

**Cualquier acción que cree algo va en un diálogo, nunca en un formulario dentro
de la página.** La tarjeta lleva el botón en su encabezado (`CardAction`) y el
cuerpo solo muestra la lista o la tabla.

No es preferencia estética. Los formularios en línea iban alineados al borde
inferior, y en cuanto un campo llevaba dos líneas de pista empujaba a sus
vecinos: mientras más explicaba la etiqueta, más torcida quedaba la fila.
Dentro del modal cada campo ocupa su propia fila y la alineación deja de ser
algo que mantener a mano.

El envoltorio es `~/components/ui/form-dialog.tsx`. Trae el diálogo, el
formulario, el botón de cancelar y el de acción. No se repite a mano.

## El tema es solo oscuro

Los tokens viven en `:root` y no existe bloque `.dark`. No hay tema claro, ni
interruptor, ni `prefers-color-scheme`.

**`<html class="dark">` se queda aunque parezca inútil.** Los colores ya están en
`:root`, pero las variantes `outline`, `destructive` y `ghost` de shadcn traen
utilidades `dark:` propias, y sin la clase Tailwind nunca las emite. Quitarla no
cambia la paleta: degrada esas tres en silencio.

## El blanco es la acción primaria, y sale una vez por pantalla

El secundario es gris y **no puede leerse como deshabilitado**. En oscuro el
relleno no alcanza para distinguirlos —queda a 1,19:1 contra la tarjeta— así que
la separación la cargan el borde, el contraste del texto (14,3:1 contra 3,7:1),
un hover que sube en luminancia y el cursor. Está resuelto en
`~/components/ui/button.tsx`; si algo se ve apagado, se arregla ahí y no en el
sitio que lo usa.

Corolario: la burbuja saliente del chat es gris elevado, no blanca.

## Las rutas se escriben en inglés

`/settings`, no `/configuracion`. La ruta es un identificador; la etiqueta del
enlace sigue en español, como el resto de la interfaz.

## Los formularios validan con los esquemas de `@cobra/contracts`

Los mismos que corre la API. Cliente y servidor no pueden discrepar, y el
esquema tiene que cubrir **todos** los valores por defecto del formulario — un
`.pick()` que deje uno afuera no compila; se usa `.pick().extend()`.

El detalle por campo que devuelve la API se reparte sobre los campos con
`applyServerErrors`. Lo que no calce con ningún campo se muestra como un solo
mensaje.

## Los mensajes de validación se escriben, no se heredan

`packages/contracts/src/locale.ts` pone a Zod en español y lo importa **cada
módulo del paquete**, no solo el índice: importar un submódulo directo construye
sus esquemas antes y los mensajes vuelven en inglés.

Ese locale es la red, no la copia. Cada regla que el operador puede tocar lleva
su propio mensaje, porque el locale responde como un compilador. Ver uno de esos
en pantalla significa que a un campo le falta el suyo.
`packages/contracts/src/messages.spec.ts` lo verifica.

## Ninguna etiqueta es un nombre técnico

Ni de la base ni del proveedor. `phone_number_id` es "Identificador del número";
`forma_pago` es "Forma de pago". El nombre que usa Meta o Wisphub va en el `hint`
del campo, junto con dónde encontrarlo.

## Añadir un componente de shadcn

```bash
cd apps/web && pnpm dlx shadcn@latest add <componente>
```

Dos cosas que hay que corregir después, cada vez:

1. El CLI escribe `import { cn } from "cn"` y no reescribe el placeholder:
   `sd 'from "cn"' "from '~/lib/utils'" src/components/ui/*.tsx`.
2. Con `--overwrite`, un componente que dependa de `button` lo sobrescribe y se
   pierden los ajustes del secundario. Restaurarlo desde git.

El `baseUrl` de `apps/web/tsconfig.json` existe solo para que el CLI resuelva el
alias `~`. No puede moverse a `tsconfig.app.json`: TypeScript 6 lo deprecó y el
build falla.
