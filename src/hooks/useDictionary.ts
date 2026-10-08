import { useCallback, useRef, useState } from 'react'
import { LookupError, lookupWord } from '../services/dictionary'
import type { WordEntry } from '../types'

export type LookupStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 查词状态机：idle -> loading -> success / error。
 * 用 requestId 丢弃过期请求的返回，避免快速连查时结果串台。
 */
export function useDictionary() {
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [entry, setEntry] = useState<WordEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [word, setWord] = useState('')
  const requestId = useRef(0)

  const lookup = useCallback(async (raw: string): Promise<WordEntry | null> => {
    const text = raw.trim()
    if (!text) return null
    const id = requestId.current + 1
    requestId.current = id
    setWord(text)
    setStatus('loading')
    setError(null)

    try {
      const result = await lookupWord(text)
      if (id !== requestId.current) return null
      setEntry(result)
      setStatus('success')
      return result
    } catch (err) {
      if (id !== requestId.current) return null
      const message =
        err instanceof LookupError ? err.message : '查询失败了，检查一下网络再试试'
      setError(message)
      setStatus('error')
      return null
    }
  }, [])

  const reset = useCallback(() => {
    requestId.current += 1
    setStatus('idle')
    setEntry(null)
    setError(null)
    setWord('')
  }, [])

  return { status, entry, error, word, lookup, reset }
}
