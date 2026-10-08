import { useState } from 'react'
import EmptyState from '../components/EmptyState'
import RatingButtons from '../components/RatingButtons'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
import WordCard from '../components/WordCard'
import { useToast } from '../components/Toast'
import { IconSparkles } from '../components/icons'
import { useDictionary } from '../hooks/useDictionary'
import { useWordbook } from '../store/WordbookContext'
import type { Rating } from '../types'
import { RATING_LABEL, previewNextDue } from '../utils/sm2'

interface Props {
  onGoReview: () => void
}

export default function SearchPage({ onGoReview }: Props) {
  const { status, entry, error, errorKind, lookup, reset } = useDictionary()
  const { words, stats, addWord, rateWord, getWord, toggleMastered, removeWord } = useWordbook()
  const { show } = useToast()
  const [lastQuery, setLastQuery] = useState('')

  const search = async (word: string) => {
    setLastQuery(word)
    const result = await lookup(word)
    if (!result) return
    const existed = Boolean(getWord(result.word.toLowerCase()))
    // 查过的词自动进词库；重复查询不重复添加，也不动复习进度
    addWord(result)
    show(existed ? '已在词库中，复习进度不变' : '已加入词库 · ' + result.word, existed ? 'info' : 'good')
  }

  const record = entry ? getWord(entry.word.toLowerCase()) : undefined

  const handleRate = (rating: Rating) => {
    if (!record) return
    const next = previewNextDue(record, rating)
    rateWord(record.id, rating, 'memory')
    show(RATING_LABEL[rating] + ' · 下次复习：' + next, rating === 'good' ? 'good' : 'info')
  }

  const handleMastered = () => {
    if (!record) return
    toggleMastered(record.id)
    show(record.mastered ? '已恢复为学习中' : '已标记为掌握', 'good')
  }

  const handleRemove = () => {
    if (!record) return
    if (!window.confirm('把「' + record.word + '」从词库删除？')) return
    removeWord(record.id)
    reset()
    show('已从词库删除')
  }

  return (
    <div className="space-y-4">
      {stats.dueToday > 0 ? (
        <button
          type="button"
          onClick={onGoReview}
          className="card flex w-full items-center justify-between gap-3 text-left transition duration-150 active:scale-[0.99]"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-ink-900 dark:text-cream-50">
              今日待复习 {stats.dueToday} 个
            </span>
            <span className="mt-0.5 block text-[12px] text-ink-500 dark:text-cream-300">
              大约 {Math.max(1, Math.round(stats.dueToday * 0.4))} 分钟就能过完
            </span>
          </span>
          <span className="chip shrink-0 bg-sage-100 text-sage-700 dark:bg-night-700 dark:text-sage-200">
            开始复习
          </span>
        </button>
      ) : (
        <div className="card flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-night-700 dark:text-sage-300">
            <IconSparkles className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-ink-900 dark:text-cream-50">
              今天没有待复习的单词
            </span>
            <span className="mt-0.5 block text-[12px] text-ink-500 dark:text-cream-300">
              {words.length
                ? '可以查几个新词，或者去复习页挑几个再练一遍'
                : '先查一个单词，它会自动进入复习计划'}
            </span>
          </span>
        </div>
      )}

      <SearchBar loading={status === 'loading'} onSearch={search} />

      {status === 'loading' ? (
        <div className="card flex items-center justify-center gap-3 py-8 text-ink-500 dark:text-cream-300">
          <Spinner className="h-5 w-5" />
          <span className="text-[14px]">正在查「{lastQuery}」…</span>
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div className="card animate-fade-up bg-apricot-100 dark:bg-night-800">
          <p className="text-[15px] font-medium text-ink-900 dark:text-cream-50">{error}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500 dark:text-cream-300">
            {errorKind === 'network'
              ? '如果一直失败：先关掉广告拦截类插件试试，或者换个网络。'
              : '换个拼写试试，也可以用单词原形（比如 running 换成 run）。'}
          </p>
          <button type="button" className="btn btn-soft mt-3 w-full" onClick={() => search(lastQuery)}>
            重试
          </button>
        </div>
      ) : null}

      {status === 'success' && entry ? (
        <div className="space-y-4">
          <WordCard entry={entry} onPickWord={search} />
          {record ? (
            <div className="space-y-3">
              <p className="section-title px-1">这次记得怎么样？</p>
              <RatingButtons onRate={handleRate} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost flex-1" onClick={handleMastered}>
                  {record.mastered ? '取消已掌握' : '标记已掌握'}
                </button>
                <button
                  type="button"
                  className="btn flex-1 bg-apricot-200 text-ink-900 hover:bg-apricot-300 dark:bg-night-700 dark:text-apricot-200"
                  onClick={handleRemove}
                >
                  删除单词
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === 'idle' && words.length ? (
        <div>
          <p className="section-title mb-2 px-1">最近添加</p>
          <div className="flex flex-wrap gap-2">
            {words.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => search(item.word)}
                className="chip min-h-[44px]"
              >
                {item.word}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {status === 'idle' && !words.length ? (
        <EmptyState
          icon={<IconSparkles />}
          title="从第一个单词开始"
          description="输入英文单词后回车，音标、释义、近反义词和例句会自动整理好，并加入你的复习计划。"
        />
      ) : null}
    </div>
  )
}
