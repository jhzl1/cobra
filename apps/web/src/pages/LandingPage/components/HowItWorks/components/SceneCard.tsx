interface SceneCardProps {
  title: string
  meta: React.ReactNode
  children: React.ReactNode
}

/** A panel card as the console draws it: a label strip, then its content. */
export const SceneCard = ({ title, meta, children }: SceneCardProps) => (
  <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-sm">
    <div className="flex h-10 items-center justify-between border-b border-border px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {title}
      <span className="font-mono tracking-normal normal-case">{meta}</span>
    </div>
    {children}
  </div>
)
