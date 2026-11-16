/**
 * The agent's answer on its way: three dots where its bubble is about to be.
 *
 * Without it the operator watching the chat saw nothing between the
 * customer's message and the reply, and could not tell a slow turn from one
 * that would never come. It shows from the moment the turn starts until its
 * reply lands — the burst window and a receipt being read come before that.
 */
export const ThinkingBubble = () => (
  <div className="flex justify-end" role="status" aria-live="polite">
    <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 150, 300].map((delayMs) => (
          <span
            key={delayMs}
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        El agente está redactando una respuesta
      </span>
    </div>
  </div>
)
