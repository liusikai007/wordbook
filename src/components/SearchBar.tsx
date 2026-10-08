import { useState, type FormEvent } from 'react'
import { IconClose, IconSearch } from './icons'
import Spinner from './Spinner'

interface Props {
  loading: boolean
  onSearch: (word: string) => void
}

export default function SearchBar({ loading, onSearch }: Props) {
  const [value, setValue] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const word = value.trim()
    if (!word || loading) return
    onSearch(word)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
          <IconSearch className="h-5 w-5" />
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="input pl-11 pr-12"
          placeholder="输入英文单词，如 serendipity"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="查询英文单词"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="清空输入"
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 transition active:scale-90"
          >
            <IconClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="btn btn-primary min-w-[80px] px-5"
      >
        {loading ? <Spinner className="h-5 w-5" /> : '查询'}
      </button>
    </form>
  )
}
