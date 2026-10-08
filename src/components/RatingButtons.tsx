import type { Rating } from '../types'
import { cn } from '../utils/cn'

const OPTIONS: { rating: Rating; label: string; hint: string; className: string }[] = [
  {
    rating: 'again',
    label: '没记住',
    hint: '10 分钟后',
    className:
      'bg-apricot-200 text-ink-900 hover:bg-apricot-300 dark:bg-night-700 dark:text-apricot-200 dark:hover:bg-night-600'
  },
  {
    rating: 'vague',
    label: '有点模糊',
    hint: '间隔小幅延长',
    className:
      'bg-cream-200 text-ink-900 hover:bg-cream-300 dark:bg-night-600 dark:text-cream-100 dark:hover:bg-night-600'
  },
  {
    rating: 'good',
    label: '记住了',
    hint: '按计划拉长',
    className: 'bg-sage-400 text-white hover:bg-sage-500'
  }
]

interface Props {
  onRate: (rating: Rating) => void
  disabled?: boolean
}

export default function RatingButtons({ onRate, disabled }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.rating}
          type="button"
          disabled={disabled}
          onClick={() => onRate(option.rating)}
          className={cn(
            'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 transition duration-150 active:scale-[0.97] disabled:opacity-50',
            option.className
          )}
        >
          <span className="text-[15px] font-medium leading-tight">{option.label}</span>
          <span className="text-[10px] leading-tight opacity-70">{option.hint}</span>
        </button>
      ))}
    </div>
  )
}
