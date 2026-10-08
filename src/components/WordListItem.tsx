import type { WordRecord } from '../types'
import { cn } from '../utils/cn'
import { humanizeDue } from '../utils/date'
import { IconCheck, IconChevron, IconTrash } from './icons'
import WordCard from './WordCard'

interface Props {
  record: WordRecord
  expanded: boolean
  onToggleExpand: () => void
  onToggleMastered: () => void
  onRemove: () => void
}

/** 列表里只露一行摘要，够判断这个词是什么就行 */
function summary(record: WordRecord): string {
  const entry = record.entry
  if (!entry) return '暂无释义'
  if (entry.translation) return entry.translation
  const sense = entry.senses[0]
  if (!sense) return '暂无释义'
  if (sense.translation) return sense.translation
  const first = sense.definitions[0]
  return first ? first.text : '暂无释义'
}

export default function WordListItem({
  record,
  expanded,
  onToggleExpand,
  onToggleMastered,
  onRemove
}: Props) {
  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-softer ring-1 ring-cream-200/70 dark:bg-night-800 dark:ring-night-700">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition duration-150 active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[17px] font-medium text-ink-900 dark:text-cream-50">
              {record.word}
            </span>
            {record.entry?.ukPhonetic ? (
              <span className="phonetic truncate">{record.entry.ukPhonetic}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-500 dark:text-cream-300">
            {summary(record)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              'block text-[11px]',
              record.mastered ? 'text-sage-600 dark:text-sage-300' : 'text-ink-300 dark:text-cream-300/80'
            )}
          >
            {record.mastered ? '已掌握' : humanizeDue(record.nextReviewAt)}
          </span>
          {record.spellWrong > 0 ? (
            <span className="mt-0.5 block text-[10px] text-apricot-400">
              拼错 {record.spellWrong} 次
            </span>
          ) : null}
        </span>
        <IconChevron
          className={cn('h-4 w-4 shrink-0 text-ink-300 transition duration-200', expanded && 'rotate-90')}
        />
      </button>

      {expanded ? (
        <div className="animate-fade-in border-t border-cream-200/70 px-3 pb-3 pt-3 dark:border-night-700">
          {record.entry ? (
            <WordCard entry={record.entry} bare />
          ) : (
            <p className="px-1 text-[13px] text-ink-500 dark:text-cream-300">
              这条记录还没有词典详情，回到查词页重新查一次就能补上。
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onToggleMastered}
              className={cn('btn flex-1', record.mastered ? 'btn-ghost' : 'btn-soft')}
            >
              <IconCheck className="h-4 w-4" />
              {record.mastered ? '取消已掌握' : '标记已掌握'}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="btn flex-1 bg-apricot-200 text-ink-900 hover:bg-apricot-300 dark:bg-night-700 dark:text-apricot-200"
            >
              <IconTrash className="h-4 w-4" />
              删除
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
