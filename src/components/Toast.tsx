import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { cn } from '../utils/cn'

type Tone = 'info' | 'good' | 'warn'

interface ToastItem {
  id: number
  message: string
  tone: Tone
}

interface ToastValue {
  show: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-ink-700/92 text-cream-50',
  good: 'bg-sage-500/95 text-white',
  warn: 'bg-apricot-300/95 text-ink-900'
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const show = useCallback((message: string, tone: Tone = 'info') => {
    seq.current += 1
    const id = seq.current
    setItems((prev) => [...prev, { id, message, tone }].slice(-3))
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }, 2200)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'animate-fade-up max-w-[420px] rounded-2xl px-4 py-2 text-center text-[13px] leading-snug shadow-soft',
              TONE_CLASS[item.tone]
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内部使用')
  return ctx
}
