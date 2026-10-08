import { useEffect, useRef, useState, type FormEvent } from 'react'
import { playPronunciation } from '../services/speech'
import type { WordRecord } from '../types'
import { cn } from '../utils/cn'
import { IconCheck, IconClose, IconSpeaker } from './icons'

interface Props {
  record: WordRecord
  /** 判定结果回调：true = 拼对了 */
  onAnswer: (correct: boolean) => void
  onNext: () => void
}

/** 拼写测试的提示语：优先中文翻译，没有就退回英文释义 */
function buildPrompt(record: WordRecord): string | null {
  const entry = record.entry
  if (!entry) return null
  if (entry.translation) return entry.translation
  const sense = entry.senses.find((s) => s.translation) ?? entry.senses[0]
  if (!sense) return null
  if (sense.translation) return sense.translation
  const first = sense.definitions[0]
  return first ? first.text : null
}

function buildHint(word: string): string {
  const rest = word.length - 1
  if (rest <= 0) return word.charAt(0)
  return word.charAt(0) + ' ' + new Array(rest).fill('·').join(' ')
}

export default function SpellingTest({ record, onAnswer, onNext }: Props) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // 换到下一个单词时清空输入并自动聚焦
  useEffect(() => {
    setValue('')
    setResult('idle')
    inputRef.current?.focus()
  }, [record.id])

  const prompt = buildPrompt(record)
  const answer = record.word.toLowerCase()
  const example = record.entry?.examples[0]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (result !== 'idle') {
      onNext()
      return
    }
    const typed = value.trim().toLowerCase()
    if (!typed) return
    const correct = typed === answer
    setResult(correct ? 'correct' : 'wrong')
    onAnswer(correct)
  }

  return (
    <div className="space-y-3">
      <div className="card animate-fade-up px-5 py-7">
        <p className="text-center text-[13px] text-ink-300 dark:text-cream-300/80">
          看中文，拼出英文
        </p>
        <p className="mt-3 text-center text-[22px] font-semibold leading-snug text-ink-900 dark:text-cream-50">
          {prompt ?? '暂无中文提示，先凭记忆拼写'}
        </p>
        {result === 'idle' ? (
          <p className="mt-3 text-center text-[13px] tracking-[0.2em] text-ink-300 dark:text-cream-300/70">
            {buildHint(record.word)}
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={result !== 'idle'}
            className={cn(
              'input text-center tracking-wide',
              result === 'correct' && 'text-sage-700 ring-2 ring-sage-300 dark:text-sage-200',
              result === 'wrong' && 'text-ink-700 ring-2 ring-apricot-300 dark:text-cream-100'
            )}
            placeholder="在这里拼写英文单词"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="拼写答案"
          />
          {result === 'idle' ? (
            <button type="submit" disabled={!value.trim()} className="btn btn-primary w-full">
              提交
            </button>
          ) : (
            <button type="button" onClick={onNext} className="btn btn-primary w-full">
              {result === 'correct' ? '下一个' : '知道了，下一个'}
            </button>
          )}
        </form>
      </div>

      {result !== 'idle' ? (
        <div
          className={cn(
            'card animate-fade-up',
            result === 'correct' ? 'bg-sage-100 dark:bg-night-800' : 'bg-apricot-100 dark:bg-night-800'
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-white',
                result === 'correct' ? 'bg-sage-400' : 'bg-apricot-400'
              )}
            >
              {result === 'correct' ? (
                <IconCheck className="h-4 w-4" />
              ) : (
                <IconClose className="h-4 w-4" />
              )}
            </span>
            <p className="text-[15px] font-medium text-ink-900 dark:text-cream-50">
              {result === 'correct' ? '拼对啦' : '正确拼写：' + record.word}
            </p>
          </div>

          {record.entry?.translation ? (
            <p className="mt-2 text-[14px] text-ink-700 dark:text-cream-100">
              {record.entry.translation}
            </p>
          ) : null}

          {example ? (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-500 dark:text-cream-300">
              {example.en}
              {example.zh ? <span className="mt-0.5 block">{example.zh}</span> : null}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => playPronunciation(record.word, 'uk', record.entry?.audioUk)}
            className="chip mt-3 min-h-[44px] gap-1.5 px-3"
          >
            <IconSpeaker className="h-4 w-4 text-sage-600 dark:text-sage-300" />
            听发音
          </button>
        </div>
      ) : null}
    </div>
  )
}
