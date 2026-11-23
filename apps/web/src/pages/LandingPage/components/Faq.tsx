import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'

export const Faq = () => {
  const QUESTIONS = [
    {
      id: 'billing-systems',
      question: '¿Wispay funciona con otros sistemas de facturación?',
      answer:
        'No. Wispay funciona exclusivamente con Wisphub: consulta el saldo de cada cliente y registra los pagos a través de su API.',
    },
    {
      id: 'requirements',
      question: '¿Qué se necesita para empezar?',
      answer:
        'Una cuenta de Wisphub con acceso a la API y un número de WhatsApp para atender a tus clientes. Nuestro equipo te acompaña durante la configuración.',
    },
    {
      id: 'duplicate-receipt',
      question: '¿Qué ocurre si un cliente envía el mismo comprobante dos veces?',
      answer:
        'El agente identifica que el pago ya fue registrado, no lo aplica de nuevo y se lo informa al cliente.',
    },
    {
      id: 'forged-receipt',
      question: '¿Qué ocurre si un cliente envía un comprobante falso?',
      answer:
        'Estamos desarrollando mecanismos para verificar que la imagen del comprobante no fue editada ni generada con IA. Hoy la validación tiene una confiabilidad superior al 90 %, pero no es infalible. Por eso el panel te da las herramientas para supervisar cada pago: revisar los comprobantes y los pagos registrados, y tomar el control de la conversación cuando algo no cuadre.',
    },
    {
      id: 'advisor-reply',
      question: '¿Un asesor puede responderle directamente a un cliente?',
      answer:
        'Sí. Al tomar el control de la conversación, el agente deja de responder y el asesor escribe desde el panel. Al terminar, puede devolverle la conversación al agente.',
    },
    {
      id: 'service-window',
      question: '¿Por qué en ocasiones no es posible escribirle a un cliente?',
      answer:
        'WhatsApp solo permite enviar mensajes durante las 24 horas siguientes al último mensaje del cliente. El panel muestra el tiempo restante y bloquea el envío cuando la ventana se cierra, para evitar mensajes que no serían entregados.',
    },
    {
      id: 'credentials',
      question: '¿Quién tiene acceso a las credenciales?',
      answer:
        'Nadie puede consultarlas desde el panel. Se almacenan cifradas y solo se muestran sus últimos cuatro caracteres, para identificar cuál está configurada.',
    },
    {
      id: 'mobile',
      question: '¿El panel se puede usar desde el celular?',
      answer:
        'Sí. Desde el celular puedes revisar las conversaciones, tomar el control y responderles a tus clientes.',
    },
  ] as const

  return (
    <section id="faq" className="scroll-mt-15 pt-20 sm:pt-36">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-10">
        <h2
          data-reveal
          className="text-[clamp(32px,4.2vw,52px)] leading-[1.04] font-[650] tracking-[-0.03em]"
        >
          Preguntas frecuentes
        </h2>

        <Accordion type="single" collapsible className="mt-12 max-w-[880px] border-t border-border">
          {QUESTIONS.map((faqEntry) => (
            <AccordionItem key={faqEntry.id} value={faqEntry.id} className="last:border-b">
              <AccordionTrigger className="items-center py-5.5 font-display text-lg font-medium hover:no-underline">
                {faqEntry.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-[64ch] pb-5.5 text-base text-muted-foreground">
                {faqEntry.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
