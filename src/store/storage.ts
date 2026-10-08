/**
 * localStorage 读写层：所有持久化都集中在这里，方便以后换成 IndexedDB。
 * 读取时做一次结构校验 + 字段补全，手改过的 JSON 也不会把应用搞崩。
 */
import type { BackupData, ReviewLog, WordRecord } from '../types'
import { INITIAL_EASE } from '../utils/sm2'

export const DATA_KEY = 'wordbook:data:v1'
export const THEME_KEY = 'wordbook:theme'
export const STATE_VERSION = 1
/** 复习日志只留最近这么多条，避免 localStorage 无限膨胀 */
export const MAX_LOGS = 5000

export interface PersistedState {
  version: number
  words: WordRecord[]
  logs: ReviewLog[]
}

export const EMPTY_STATE: PersistedState = { version: STATE_VERSION, words: [], logs: [] }

/** 补齐缺失字段，兼容旧版本备份 */
export function normalizeRecord(input: Partial<WordRecord>): WordRecord {
  const word = String(input.word ?? input.id ?? '').trim()
  const now = Date.now()
  return {
    id: String(input.id ?? word).toLowerCase(),
    word,
    entry: input.entry ?? null,
    ease: typeof input.ease === 'number' ? input.ease : INITIAL_EASE,
    interval: typeof input.interval === 'number' ? input.interval : 0,
    repetitions: typeof input.repetitions === 'number' ? input.repetitions : 0,
    nextReviewAt: typeof input.nextReviewAt === 'number' ? input.nextReviewAt : now,
    lastReviewedAt: typeof input.lastReviewedAt === 'number' ? input.lastReviewedAt : null,
    mastered: Boolean(input.mastered),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
    reviewCount: typeof input.reviewCount === 'number' ? input.reviewCount : 0,
    lapseCount: typeof input.lapseCount === 'number' ? input.lapseCount : 0,
    spellWrong: typeof input.spellWrong === 'number' ? input.spellWrong : 0,
    spellCorrect: typeof input.spellCorrect === 'number' ? input.spellCorrect : 0
  }
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    const words = Array.isArray(parsed.words) ? parsed.words.map((w) => normalizeRecord(w)) : []
    const logs = Array.isArray(parsed.logs) ? parsed.logs : []
    return {
      version: STATE_VERSION,
      words: words.filter((w) => w.word),
      logs: logs.filter((l) => l && typeof l.wordId === 'string' && typeof l.at === 'number')
    }
  } catch {
    return EMPTY_STATE
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({ version: STATE_VERSION, words: state.words, logs: state.logs })
    )
  } catch {
    // 配额不足时静默失败：内存里的状态依然是对的
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(DATA_KEY)
  } catch {
    // 忽略
  }
}

export function buildBackup(words: WordRecord[], logs: ReviewLog[]): BackupData {
  return {
    app: 'wordbook',
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    words,
    logs
  }
}

export interface ImportResult {
  words: WordRecord[]
  logs: ReviewLog[]
}

/** 解析备份文件；格式不对时抛出可以直接展示给用户的错误 */
export function parseBackup(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('这个文件不是有效的 JSON')
  }
  const data = parsed as Partial<BackupData> | null
  if (!data || typeof data !== 'object' || !Array.isArray(data.words)) {
    throw new Error('文件里没有找到词库数据')
  }
  const words = data.words
    .map((w) => normalizeRecord(w))
    .filter((w) => w.word && /^[a-zA-Z][a-zA-Z'-]*$/.test(w.word))
  if (!words.length) throw new Error('文件里没有可用的单词')
  const logs = Array.isArray(data.logs)
    ? data.logs.filter(
        (l): l is ReviewLog =>
          Boolean(l) && typeof l.wordId === 'string' && typeof l.at === 'number'
      )
    : []
  return { words, logs }
}

/** 触发浏览器下载一个 JSON 文件 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function loadTheme(): 'light' | 'dark' | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 忽略
  }
}
