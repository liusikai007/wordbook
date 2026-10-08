import { playPronunciation } from '../services/speech'
import type { Rating, WordRecord } from '../types'
import { IconSpeaker } from './icons'
import RatingButtons from './RatingButtons'
import WordCard from './WordCard'

interface Props {
  record: WordRecord
  revealed: boolean
  onReveal: () => void
  onRate: (rating: Rating) => void
}

/** 复习模式：先只给单词和发音，让用户主动回忆，点「显示答案」后再展开全部信息 */
export default function ReviewCard({ record, revealed, onReveal, onRate }: Props) {
  if (!revealed) {
    return (
      <div className="card animate-fade-up flex flex-col items-center px-5 py-10">
        <p className="text-center text-[34px] font-semibold leading-tight tracking-tight text-ink-900 dark:text-cream-50">
          {record.word}
        </p>
        <button
          type="button"
          onClick={() => playPronunciation(record.word, 'uk', record.entry?.audioUk)}
          aria-label="播放发音"
          className="icon-btn mt-5 bg-sage-100 text-sage-700 dark:bg-night-700 dark:text-sage-200"
        >
          <IconSpeaker />
        </button>
        <p className="mt-6 text-[13px] text-ink-300 dark:text-cream-300/80">
          先在心里回想它的意思，再看答案
        </p>
        <button type="button" onClick={onReveal} className="btn btn-primary mt-6 w-full">
          显示答案
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-3">
      {record.entry ? (
        <WordCard entry={record.entry} />
      ) : (
        <div className="card">
          <p className="text-[26px] font-semibold text-ink-900 dark:text-cream-50">{record.word}</p>
          <p className="mt-2 text-[13px] text-ink-500 dark:text-cream-300">
            这条记录没有缓存词典详情，回到查词页重新查一次就能补上。
          </p>
        </div>
      )}
      <RatingButtons onRate={onRate} />
    </div>
  )
}
