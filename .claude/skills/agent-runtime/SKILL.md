---
name: agent-runtime
description: 'Trigger: prompts, tools, reglas de validación de comprobantes, steering, cualquier cambio en packages/agent. El runtime del agente de cobros y las reglas que salieron de incidentes reales.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Editar el prompt del agente o el del extractor de comprobantes'
    - 'Agregar o cambiar una tool del agente'
    - 'Cambiar las reglas de validación de un comprobante'
    - 'Tocar la lógica de RegisterPayment o ApplyCredit'
    - 'Cambiar el steering o la ventana de ráfaga'
    - 'Agregar una dependencia a packages/agent'
---

## Activation Contract

Cargar esta skill antes de tocar cualquier archivo bajo `packages/agent/src`, y
antes de cambiar cómo el worker invoca un turno.

No aplica a `apps/web` ni a las migraciones.

## La regla que define el paquete

`packages/agent` **no sabe dónde corre**. Recibe una conversación y sus mensajes,
y devuelve una respuesta y los pasos que dio.

```
runTurn(conversación) ──→ { reply, steps }
```

No importa NestJS, no importa pg-boss, no abre conexiones y no lee variables de
entorno. Todo lo externo entra como puerto: `WisphubPort`, `ReceiptPort`,
`MessagingPort`, `StepRecorder`, `SteeringPort`.

Esa frontera mantiene abierta la decisión que `PLAN.md` dejó abierta: si el
agente termina viviendo en un Durable Object de Cloudflare en vez de en el worker
de Railway, cambia el worker, no el agente. Una importación de `@nestjs/common`
aquí la cierra sin que nadie lo decida.

**El paquete es ESM puro.** `ai` v7 no publica build de CommonJS, así que
`format: ['esm']` en `tsup.config.ts` no es un detalle de empaquetado: un build
CJS compila y luego falla en el primer import en producción.

## Los prompts son transcripciones, no redacciones

El prompt del sistema y el del extractor salieron del workflow de n8n
`Netplus Pagos v4` (`UBzsVy2q0l228DVo`). **Cada regla que traen se escribió
después de un incidente.**

- No los reescribas "para que lean mejor". Si una frase suena redundante, lo es a
  propósito: el modelo la necesitaba repetida.
- Lo único parametrizado es lo que cambia por cliente: `companyName`,
  `supportPhone` y el administrador. Todo lo demás es literal.
- Si hay que cambiar una regla de negocio, primero confirma contra n8n qué hace
  hoy — el sistema viejo sigue vivo y es la línea base.

## Las cinco reglas de validación, y su orden

El orden **es** la regla. Son excluyentes y gana la primera que aplique:

| #   | Condición                                   | `alertReason`            |
| --- | ------------------------------------------- | ------------------------ |
| 1   | `isVoucher == false`                        | `not_a_voucher`          |
| 2   | fecha legible pero de más de 7 días         | `older_than_7_days`      |
| 3   | cuenta destino no está en `payment_methods` | `destination_not_ours`   |
| 4   | referencia ya usada                         | `reference_already_used` |
| 5   | fecha ilegible                              | `unreadable_date`        |

Un comprobante viejo **y** pagado a una cuenta ajena se reporta como viejo. El
operador hace triage por ese motivo, así que moverlo de lugar le cambia el
trabajo a alguien.

Rechazar **saltea al agente por completo**: el cliente recibe el texto fijo
`MANUAL_REVIEW_REPLY` y el motivo va al administrador. El `alertReason` es
interno y nunca se le manda al cliente.

## Lo que no se toca sin leer el incidente que lo originó

- **Una llamada a Wisphub por factura, por su monto exacto.** El excedente se
  abona aparte con el `PUT` del perfil. Wisphub solo convierte un sobrepago en
  saldo a favor cuando hay una sola factura; con varias se lo come sin devolver
  error. Es la ejecución 7030 de n8n y $45.000 perdidos. Hay test.
- **La ráfaga conserva todas las imágenes.** n8n hace
  `conImagen[conImagen.length - 1]` y descarta la primera sin error ni alerta —
  justo lo que manda quien paga dos cuentas. Hay test.
- **`fecha_pago` que va a Wisphub es `now()` en `America/Bogota`**, no la fecha
  del comprobante. Esa se guarda en `receipts.paid_at` y es la que lee la regla 2.
- **Las barras finales de Wisphub son inconsistentes a propósito**: `/saldo` sin
  barra, `/perfil/` y `/registrar-pago/` con barra. Wisphub responde 301 a la otra
  forma y el redirect pierde el body en un POST: el pago no se registra y nadie
  se entera.
- **En Wisphub el saldo negativo es plata a favor del cliente**: `nuevo = actual -
abono`, enviado como string con dos decimales.

## Steering

El chequeo ocurre **antes** de lanzar cada tool, nunca durante. Por eso
`RegisterPayment` o se lanza entera o no se lanza.

Cuando dispara, se traba: la tool que ya corría termina, y todas las que no
habían arrancado se saltan con el resultado sintético
`Skipped due to queued user message.` Sin ese resultado el historial queda
desparejado y la siguiente llamada al modelo falla.

## Tests

Toda regla de negocio de este paquete se prueba sin red: los puertos se pasan
como dobles. `planPayment`, `validateReceipt`, `resolvePaymentMethod`,
`consolidateBurst` y `Steering` son puros justamente para eso.

```bash
pnpm --filter @cobra/agent test
```

Una regla que solo se puede probar con una cuenta de Wisphub es una regla que va
a dejar de probarse.
