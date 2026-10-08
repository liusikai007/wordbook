import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface Props {
  label: string
  value: ReactNode
  hint?: string
  accent?: boolean
}

export default function StatCard({ label, value, hint, accent }: Props) {
  return (
    <div
      className={cn(
        'card-flat flex flex-col justify-between gap-1',
        accent && 'bg-sage-100 ring-sage-200/70 dark:bg-night-700 dark:ring-night-600'
      )}
    >
      <span className="text-[12px] text-ink-500 dark:text-cream-300">{label}</span>
      <span className="tnum text-[26px] font-semibold leading-tight text-ink-900 dark:text-cream-50">
        {value}
      </span>
      {hint ? <span className="text-[11px] text-ink-300 dark:text-cream-300/80">{hint}</span> : null}
    </div>
  )
}
