import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { Rating, ReviewLog, ReviewMode, Stats, WordEntry, WordRecord } from '../types'
import { clearDictionaryCache } from '../services/dictionary'
import { applyRating, createWordRecord, isDueToday } from '../utils/sm2'
import { buildStats } from './stats'
import {
  EMPTY_STATE,
  MAX_LOGS,
  buildBackup,
  clearState,
  loadState,
  parseBackup,
  saveState,
  type PersistedState
} from './storage'

interface WordbookValue {
  words: WordRecord[]
  logs: ReviewLog[]
  stats: Stats
  /** 今天该复习的单词 */
  dueWords: WordRecord[]
  /** 拼写错词队列 */
  wrongWords: WordRecord[]
  getWord: (id: string) => WordRecord | undefined
  addWord: (entry: WordEntry) => WordRecord
  rateWord: (id: string, rating: Rating, mode: ReviewMode) => void
  toggleMastered: (id: string) => void
  removeWord: (id: string) => void
  recordSpelling: (id: string, correct: boolean) => void
  exportBackup: () => ReturnType<typeof buildBackup>
  importBackup: (text: string) => { added: number; updated: number }
  resetAll: () => void
}

const WordbookContext = createContext<WordbookValue | null>(null)

function makeLogId(): string {
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8)
}

export function WordbookProvider({ children }: { children: ReactNode }) {
  // 同步读一次 localStorage：数据量很小，可以省掉「加载中」的闪烁
  const [state, setState] = useState<PersistedState>(() => loadState())
  // 每分钟滴答一次，让「今日待复习」随着时间自然刷新
  const [tick, setTick] = useState(0)
  // 用 ref 保存最新状态：多个 action 连续调用时不会互相覆盖
  const stateRef = useRef<PersistedState>(state)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 60000)
    return () => window.clearInterval(timer)
  }, [])

  // 每次变更立刻落盘：数据量很小，省掉防抖带来的丢数据风险
  useEffect(() => {
    saveState(state)
  }, [state])

  const commit = useCallback((updater: (prev: PersistedState) => PersistedState) => {
    const next = updater(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  const addWord = useCallback(
    (entry: WordEntry): WordRecord => {
      const id = entry.word.toLowerCase()
      const prev = stateRef.current
      const existing = prev.words.find((w) => w.id === id)
      // 重复查询不重复添加，也不重置复习进度，只刷新词典内容
      const record: WordRecord = existing
        ? { ...existing, word: entry.word, entry, updatedAt: Date.now() }
        : createWordRecord(entry)
      const next: PersistedState = existing
        ? { ...prev, words: prev.words.map((w) => (w.id === id ? record : w)) }
        : { ...prev, words: [record, ...prev.words] }
      stateRef.current = next
      setState(next)
      return record
    },
    []
  )

  const rateWord = useCallback(
    (id: string, rating: Rating, mode: ReviewMode) => {
      const now = Date.now()
      commit((prev) => {
        const target = prev.words.find((w) => w.id === id)
        if (!target) return prev
        const updated = applyRating(target, rating, now)
        const log: ReviewLog = { id: makeLogId(), wordId: id, rating, mode, at: now }
        return {
          ...prev,
          words: prev.words.map((w) => (w.id === id ? updated : w)),
          logs: [...prev.logs, log].slice(-MAX_LOGS)
        }
      })
    },
    [commit]
  )

  const recordSpelling = useCallback(
    (id: string, correct: boolean) => {
      commit((prev) => ({
        ...prev,
        words: prev.words.map((w) =>
          w.id === id
            ? {
                ...w,
                // 拼对一次就退出错词队列，拼错就累计错误次数
                spellWrong: correct ? 0 : w.spellWrong + 1,
                spellCorrect: w.spellCorrect + (correct ? 1 : 0),
                updatedAt: Date.now()
              }
            : w
        )
      }))
    },
    [commit]
  )

  const toggleMastered = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        words: prev.words.map((w) =>
          w.id === id ? { ...w, mastered: !w.mastered, updatedAt: Date.now() } : w
        )
      }))
    },
    [commit]
  )

  const removeWord = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, words: prev.words.filter((w) => w.id !== id) }))
    },
    [commit]
  )

  const importBackup = useCallback((text: string) => {
    const incoming = parseBackup(text)
    const prev = stateRef.current
    const map = new Map(prev.words.map((w) => [w.id, w]))
    let added = 0
    let updated = 0

    for (const word of incoming.words) {
      const old = map.get(word.id)
      if (!old) {
        map.set(word.id, word)
        added += 1
        continue
      }
      // 同一个词以复习进度更靠后的一方为准，导入旧备份不会把进度拉回去
      const keepCurrent = (old.lastReviewedAt ?? 0) >= (word.lastReviewedAt ?? 0)
      map.set(
        word.id,
        keepCurrent
          ? { ...word, ...old, entry: old.entry ?? word.entry }
          : { ...old, ...word }
      )
      updated += 1
    }

    const logMap = new Map(prev.logs.map((l) => [l.id, l]))
    for (const log of incoming.logs) logMap.set(log.id, log)
    const merged: PersistedState = {
      version: prev.version,
      words: Array.from(map.values()),
      logs: Array.from(logMap.values())
        .sort((a, b) => a.at - b.at)
        .slice(-MAX_LOGS)
    }
    stateRef.current = merged
    setState(merged)
    return { added, updated }
  }, [])

  const resetAll = useCallback(() => {
    clearState()
    clearDictionaryCache()
    stateRef.current = EMPTY_STATE
    setState(EMPTY_STATE)
  }, [])

  const words = useMemo(
    () => [...state.words].sort((a, b) => b.createdAt - a.createdAt),
    [state.words]
  )
  const wordMap = useMemo(() => new Map(state.words.map((w) => [w.id, w])), [state.words])
  const getWord = useCallback((id: string) => wordMap.get(id), [wordMap])

  const stats = useMemo(() => buildStats(state.words, state.logs), [state.words, state.logs, tick])
  const dueWords = useMemo(() => words.filter((w) => isDueToday(w)), [words, tick])
  const wrongWords = useMemo(
    () =>
      words
        .filter((w) => !w.mastered && w.spellWrong > 0)
        .sort((a, b) => b.spellWrong - a.spellWrong),
    [words]
  )

  const value = useMemo<WordbookValue>(
    () => ({
      words,
      logs: state.logs,
      stats,
      dueWords,
      wrongWords,
      getWord,
      addWord,
      rateWord,
      toggleMastered,
      removeWord,
      recordSpelling,
      exportBackup: () => buildBackup(words, state.logs),
      importBackup,
      resetAll
    }),
    [
      words,
      state.logs,
      stats,
      dueWords,
      wrongWords,
      getWord,
      addWord,
      rateWord,
      toggleMastered,
      removeWord,
      recordSpelling,
      importBackup,
      resetAll
    ]
  )

  return <WordbookContext.Provider value={value}>{children}</WordbookContext.Provider>
}

export function useWordbook(): WordbookValue {
  const ctx = useContext(WordbookContext)
  if (!ctx) throw new Error('useWordbook 必须在 WordbookProvider 内部使用')
  return ctx
}
