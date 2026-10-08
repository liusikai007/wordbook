import { useCallback, useEffect, useRef, useState } from 'react'
import EmptyState from '../components/EmptyState'
import ReviewCard from '../components/ReviewCard'
import SegmentedControl from '../components/SegmentedControl'
import SpellingTest from '../components/SpellingTest'
import { useToast } from '../components/Toast'
import { IconSparkles } from '../components/icons'
import { useWordbook } from '../store/WordbookContext'
import type { Rating, ReviewMode } from '../types'
import { cn } from '../utils/cn'
import { endOfDay } from '../utils/date'
import { RATING_LABEL, previewNextDue } from '../utils/sm2'

interface Props {
  onGoSearch: () => void
}

const MODE_OPTIONS: { value: ReviewMode; label: string }[] = [
  { value: 'memory', label: '记忆模式' },
  { value: 'spelling', label: '拼写测试' }
]

export default function ReviewPage({ onGoSearch }: Props) {
  const { words, wrongWords, getWord, rateWord, recordSpelling } = useWordbook()
  const { show } = useToast()
  const [mode, setMode] = useState<ReviewMode>('memory')
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [queue, setQueue] = useState<string[]>([])
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)

  // 用 ref 读取最新的词库，这样 startSession 的引用是稳定的：
  // 每评一次分词库都会变，如果直接依赖 words，队列会被不断重置。
  const wordsRef = useRef(words)
  const wrongRef = useRef(wrongWords)
  wordsRef.current = words
  wrongRef.current = wrongWords

  /** 开一轮复习：把要练的单词快照下来，途中评分不影响队列顺序 */
  const startSession = useCallback((nextMode: ReviewMode, nextOnlyWrong: boolean) => {
    const all = wordsRef.current
    const pool =
      nextMode === 'spelling'
        ? nextOnlyWrong
          ? wrongRef.current
          : all.filter((w) => !w.mastered)
        : all.filter((w) => !w.mastered && w.nextReviewAt <= endOfDay(Date.now()))
    setQueue(pool.map((w) => w.id))
    setPos(0)
    setRevealed(false)
  }, [])

  // 切换模式或错词筛选时重开一轮
  useEffect(() => {
    startSession(mode, onlyWrong)
  }, [mode, onlyWrong, startSession])

  const currentId = pos < queue.length ? queue[pos] : undefined
  const record = currentId ? getWord(currentId) : undefined

  // 复习途中单词被删掉了就往后跳
  useEffect(() => {
    if (currentId && !record) setPos((p) => p + 1)
  }, [currentId, record])

  const total = queue.length
  const finished = total > 0 && pos >= total

  const advance = () => {
    setRevealed(false)
    setPos((p) => p + 1)
  }

  const handleRate = (rating: Rating) => {
    if (!record) return
    const next = previewNextDue(record, rating)
    rateWord(record.id, rating, 'memory')
    show(RATING_LABEL[rating] + ' · 下次复习：' + next, rating === 'good' ? 'good' : 'info')
    advance()
  }

  const handleAnswer = (correct: boolean) => {
    if (!record) return
    // 拼对按「记住了」推进，拼错按「没记住」重来，同时更新错词队列
    rateWord(record.id, correct ? 'good' : 'again', 'spelling')
    recordSpelling(record.id, correct)
  }

  return (
    <div className="space-y-4">
      <SegmentedControl value={mode} options={MODE_OPTIONS} onChange={setMode} />

      {mode === 'spelling' ? (
        <button
          type="button"
          onClick={() => setOnlyWrong((v) => !v)}
          aria-pressed={onlyWrong}
          className={cn(
            'chip min-h-[44px] w-full justify-center',
            onlyWrong && 'bg-sage-100 text-sage-700 dark:bg-night-700 dark:text-sage-200'
          )}
        >
          {onlyWrong ? '只练拼错的词 · 已开启' : '只练拼错的词'}
        </button>
      ) : null}

      {total > 0 && !finished ? (
        <div className="flex items-center gap-3 px-1">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200 dark:bg-night-700">
            <div
              className="h-full rounded-full bg-sage-400 transition-all duration-300"
              style={{ width: (pos / total) * 100 + '%' }}
            />
          </div>
          <span className="tnum text-[12px] text-ink-500 dark:text-cream-300">
            {Math.min(pos + 1, total)} / {total}
          </span>
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState
          icon={<IconSparkles />}
          title={mode === 'spelling' && onlyWrong ? '还没有拼错过的词' : '这一轮没有要练的词'}
          description={
            mode === 'spelling' && onlyWrong
              ? '拼错过的词会自动进这里，先把拼写测试过一轮吧。'
              : words.length
                ? '今天到期的词都复习完了，可以去查几个新词。'
                : '词库还是空的，先查一个单词吧。'
          }
          action={
            <button type="button" className="btn btn-soft w-full" onClick={onGoSearch}>
              去查词
            </button>
          }
        />
      ) : finished ? (
        <div className="card animate-fade-up flex flex-col items-center px-5 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-night-700 dark:text-sage-300">
            <IconSparkles />
          </span>
          <p className="mt-4 text-[18px] font-medium text-ink-900 dark:text-cream-50">
            这一轮过完了
          </p>
          <p className="mt-2 text-[14px] text-ink-500 dark:text-cream-300">
            一共练了 {total} 个单词，慢慢来，明天见。
          </p>
          <div className="mt-6 flex w-full gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => startSession(mode, onlyWrong)}
            >
              再来一轮
            </button>
            <button type="button" className="btn btn-ghost flex-1" onClick={onGoSearch}>
              去查词
            </button>
          </div>
        </div>
      ) : record ? (
        mode === 'memory' ? (
          <ReviewCard
            record={record}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onRate={handleRate}
          />
        ) : (
          <SpellingTest record={record} onAnswer={handleAnswer} onNext={advance} />
        )
      ) : null}
    </div>
  )
}
