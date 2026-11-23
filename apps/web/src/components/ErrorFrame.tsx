import type { ReactNode } from 'react'

interface ErrorFrameProps {
  icon: ReactNode
  title: string
  children: ReactNode
}

/** The frame of a screen that replaces what could not be shown. */
export const ErrorFrame = ({ icon, title, children }: ErrorFrameProps) => (
  <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="text-muted-foreground">{icon}</div>
    <h1 className="text-xl font-semibold">{title}</h1>
    {children}
  </div>
)
