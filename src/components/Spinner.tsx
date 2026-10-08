import { cn } from '../utils/cn'

interface Props {
  className?: string
}

export default function Spinner({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('h-6 w-6 animate-spin', className)}
      role="status"
      aria-label="加载中"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
