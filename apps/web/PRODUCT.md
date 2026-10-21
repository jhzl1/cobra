# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Usuario principal: el operador del ISP.** Personal de cobranza o soporte de un
proveedor de internet que factura en Wisphub. Vigila las conversaciones que el
agente sostiene por WhatsApp con los clientes del ISP, toma el control de un chat
cuando hace falta, responde él mismo y se lo devuelve al bot.

Usa el panel en escritorio y en celular por igual: una pestaña abierta en el PC de
la oficina durante la jornada, y el teléfono cuando le llega el aviso de handoff
por WhatsApp fuera de ella. Las dos situaciones tienen que funcionar completas.

Otras audiencias, confirmadas en el código pero secundarias:

- **Miembros del cliente con tareas de configuración.** No hay jerarquía dentro de
  un cliente: todo miembro ve las conversaciones, hace handoff, carga credenciales
  y edita la configuración de su empresa (`SettingsPage`, `SetupPage`).
- **Administrador de plataforma.** Da de alta clientes, suspende empresas y otorga
  administradores por correo (`PlatformPage`). Es un eje de acceso distinto al de
  miembro de un cliente.

## Product Purpose

Cobra es un agente de cobros por WhatsApp, multi-cliente, para ISP que facturan en
Wisphub. El cliente final del ISP escribe, manda su comprobante de pago, y el agente
lo valida y registra el pago en Wisphub sin cobrar dos veces.

Reemplaza un workflow de n8n de un solo cliente (53 nodos, 5 subflujos) que sigue
vivo y es la línea base: el agente tiene que hacer exactamente lo mismo que hoy,
sin funcionalidad nueva en el flujo de cobro. Lo que Cobra agrega es la plataforma
alrededor: varios clientes sobre una instalación, cada uno con sus credenciales, y
un panel para supervisar.

Éxito: el operador puede dejar al agente cobrando solo porque ve lo que hace y puede
intervenir al instante cuando algo se sale del camino.

## Positioning

En este orden:

1. **El cobro automático contra Wisphub es el producto.** El agente valida el
   comprobante y registra el pago directo en la API de Wisphub, con defensa contra
   el doble cobro. Un bot de WhatsApp genérico o una bandeja tipo Chatwoot no hace
   esto: responden, no cobran.
2. **La supervisión en vivo es lo que da confianza para dejarlo solo.** El operador
   ve la conversación en tiempo real, un timeline de los pasos que da el agente
   ("llamando a LookupCustomer…") y le quita el control con un botón.

## Operating Context

- **Chat en vivo.** Carga inicial por HTTP y luego suscripción por Supabase
  Realtime.
- **Handoff.** `conversations.status` es `bot` (responde el agente) o `human`
  (el agente registra lo entrante pero no responde; escribe el operador). Para
  devolver el control hay dos acciones: volver a `bot`, y "reenviar al agente",
  que reprocesa los últimos mensajes.
- **Aviso de handoff por dos vías:** la bandeja del panel con contador y sonido, y
  un mensaje de WhatsApp al número del operador.
- **Ventana de 24 horas de Meta.** Pasadas 24 horas desde el último mensaje del
  cliente final, un mensaje libre se rechaza. El panel muestra el tiempo restante
  y bloquea el campo de texto cuando expira; sin eso el operador escribe, ve su
  mensaje en pantalla, y el cliente nunca lo recibe.
- **Timeline por conversación.** Cada paso muestra tipo, nombre, estado, duración
  y, desplegable, sus argumentos y su resultado.
- **Puesta en marcha de un cliente.** Cargar las tres credenciales (Meta,
  OpenRouter, Wisphub), copiar la URL del webhook y el verify token que genera el
  panel y pegarlos en Meta.

## Capabilities and Constraints

- **Flujo idéntico para todos los clientes.** Por cliente cambian solo las
  credenciales, el nombre de la empresa, el teléfono de soporte y el del
  administrador. Nada en la interfaz se ramifica por cliente.
- **Las credenciales nunca se muestran.** El panel ve los últimos cuatro
  caracteres (`last4`), nunca el valor cifrado.
- **Rutas en inglés** (`/settings`, `/platform`), aunque toda la interfaz sea en
  español.
- **Los formularios validan con los esquemas de `@cobra/contracts`**, los mismos
  que corre la API.
- **Facturación: solo Wisphub.** Es un producto vertical; no hay capa para otros
  sistemas de facturación.
- **Crear algo siempre abre un modal** (`~/components/ui/form-dialog.tsx`), nunca
  un formulario en la página.

## Brand Commitments

- **Idioma de la interfaz: español.** Todo lo que lee el operador está en español;
  los identificadores y las rutas, en inglés.
- **Ninguna etiqueta es un nombre técnico**, ni de la base ni del proveedor:
  `phone_number_id` es "Identificador del número", `forma_pago` es "Forma de pago".
  El nombre de Meta o Wisphub va en la pista del campo, junto con dónde encontrarlo.
- **Un error dice qué puede hacer el usuario**: "Toma el control de la conversación
  antes de escribir", no "Conflict". Cada regla de validación que el operador puede
  tocar lleva su propio mensaje en español.
- **Tema solo oscuro**, decisión vinculante registrada en `CLAUDE.md` §6: no hay
  tema claro ni interruptor.

## Evidence on Hand

- Línea base medida contra n8n el 15 de septiembre de 2026: 7.039 ejecuciones desde
  el 7 de agosto (unas 180 por día) y 14 errores en total (0,2 %). Fuente:
  `PLAN.md`, "Línea base medida".
- Un cliente piloto con un solo número en producción.
- No hay testimonios, casos de estudio, precios ni clientes adicionales
  confirmados: no se inventan.

## Product Principles

1. **El agente cobra; el panel vigila.** El panel existe para que el operador confíe
   en dejar al agente solo, no para reemplazarlo.
2. **Lo que el operador ve es lo que recibió el cliente.** Un mensaje que Meta va a
   rechazar no se puede escribir; un estado que no es el real no se muestra.
3. **Intervenir es inmediato.** Tomar el control y devolverlo están siempre a un
   gesto, en escritorio y en celular.
4. **Hablar en el idioma del operador.** Español claro, sin nombres de la base ni del
   proveedor, y cada error dice qué hacer después.
5. **Un solo flujo para todos.** Lo que cambia por cliente es data, nunca una
   pantalla distinta.
