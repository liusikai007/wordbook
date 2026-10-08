import type { ReactNode } from 'react'
import type { TabKey } from '../types'
import { cn } from '../utils/cn'
import { IconBook, IconChart, IconReview, IconSearch } from './icons'

interface Props {
  tab: TabKey
  dueCount: number
  onChange: (tab: TabKey) => void
}

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: 'search', label: '查词', icon: <IconSearch /> },
  { key: 'review', label: '复习', icon: <IconReview /> },
  { key: 'wordbook', label: '词库', icon: <IconBook /> },
  { key: 'stats', label: '统计', icon: <IconChart /> }
]

export default function BottomNav({ tab, dueCount, onChange }: Props) {
  return (
    <nav className="safe-bottom fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-cream-200/70 bg-cream-50/95 backdrop-blur-md dark:border-night-700 dark:bg-night-900/95">
      <ul className="flex items-stretch px-1">
        {TABS.map((item) => {
          const active = item.key === tab
          return (
            <li key={item.key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 py-2 transition duration-150 active:scale-95',
                  active
                    ? 'text-sage-600 dark:text-sage-300'
                    : 'text-ink-300 dark:text-cream-300/70'
                )}
              >
                <span className="relative">
                  {item.icon}
                  {item.key === 'review' && dueCount > 0 ? (
                    <span className="tnum absolute -right-2.5 -top-1 min-w-[18px] rounded-full bg-apricot-300 px-1 text-center text-[10px] font-semibold leading-[18px] text-ink-900">
                      {dueCount > 99 ? '99+' : dueCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] leading-tight">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
