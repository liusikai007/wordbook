import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-night-800 dark:text-sage-300">
          {icon}
        </div>
      ) : null}
      <p className="text-[17px] font-medium text-ink-900 dark:text-cream-50">{title}</p>
      {description ? (
        <p className="mt-2 text-[14px] leading-relaxed text-ink-500 dark:text-cream-300">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 w-full max-w-[260px]">{action}</div> : null}
    </div>
  )
}
