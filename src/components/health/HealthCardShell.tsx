import { CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface HealthCardShellProps {
  icon: ReactNode
  title: string
  filled: boolean
  children: ReactNode
}

export default function HealthCardShell({ icon, title, filled, children }: HealthCardShellProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">{icon}</div>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {filled && <CheckCircle2 size={18} className="shrink-0 text-primary" />}
      </div>
      {children}
    </div>
  )
}
