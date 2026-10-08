import { cn } from '../utils/cn'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

/** 移动端常用的分段选择器：整块 44px 高，点按有轻微缩放反馈 */
export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: Props<T>) {
  return (
    <div className="flex gap-1 rounded-2xl bg-cream-200/70 p-1 dark:bg-night-800">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'min-h-[44px] flex-1 rounded-xl text-[14px] font-medium transition duration-150 active:scale-[0.98]',
              active
                ? 'bg-white text-ink-900 shadow-softer dark:bg-night-600 dark:text-cream-50'
                : 'text-ink-500 dark:text-cream-300'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
