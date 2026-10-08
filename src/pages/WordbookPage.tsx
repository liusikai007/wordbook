import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import SegmentedControl from '../components/SegmentedControl'
import { useToast } from '../components/Toast'
import WordListItem from '../components/WordListItem'
import { IconBook } from '../components/icons'
import { useWordbook } from '../store/WordbookContext'
import { cn } from '../utils/cn'
import { endOfDay } from '../utils/date'

type Filter = 'due' | 'mastered' | 'all'

interface Props {
  onGoSearch: () => void
}

export default function WordbookPage({ onGoSearch }: Props) {
  const { words, toggleMastered, removeWord } = useWordbook()
  const { show } = useToast()
  const [filter, setFilter] = useState<Filter>('due')
  const [keyword, setKeyword] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const dueWords = useMemo(
    () => words.filter((w) => !w.mastered && w.nextReviewAt <= endOfDay(Date.now())),
    [words]
  )
  const masteredWords = useMemo(() => words.filter((w) => w.mastered), [words])

  const list = useMemo(() => {
    const base = filter === 'due' ? dueWords : filter === 'mastered' ? masteredWords : words
    const key = keyword.trim().toLowerCase()
    return key ? base.filter((w) => w.word.includes(key)) : base
  }, [filter, keyword, words, dueWords, masteredWords])

  const handleRemove = (id: string, word: string) => {
    if (!window.confirm('把「' + word + '」从词库删除？')) return
    removeWord(id)
    setExpandedId(null)
    show('已从词库删除')
  }

  const emptyText =
    filter === 'due'
      ? { title: '没有待复习的词', description: '今天到期的都过完了，休息一下也挺好。' }
      : filter === 'mastered'
        ? { title: '还没有已掌握的单词', description: '在词库里展开一个单词，点「标记已掌握」就会出现在这里。' }
        : { title: '词库还是空的', description: '查过的单词会自动进来，不需要手动添加。' }

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'due', label: '待复习 ' + dueWords.length },
          { value: 'mastered', label: '已掌握 ' + masteredWords.length },
          { value: 'all', label: '全部 ' + words.length }
        ]}
      />

      {words.length ? (
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className={cn('input', 'text-[15px]')}
          placeholder="在词库里搜索"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="在词库里搜索"
        />
      ) : null}

      {list.length ? (
        <ul className="space-y-2">
          {list.map((record) => (
            <WordListItem
              key={record.id}
              record={record}
              expanded={expandedId === record.id}
              onToggleExpand={() => setExpandedId(expandedId === record.id ? null : record.id)}
              onToggleMastered={() => toggleMastered(record.id)}
              onRemove={() => handleRemove(record.id, record.word)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<IconBook />}
          title={keyword.trim() ? '没有匹配的单词' : emptyText.title}
          description={keyword.trim() ? '换个关键词试试。' : emptyText.description}
          action={
            words.length ? null : (
              <button type="button" className="btn btn-soft w-full" onClick={onGoSearch}>
                去查词
              </button>
            )
          }
        />
      )}
    </div>
  )
}
