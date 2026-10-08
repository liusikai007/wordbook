/**
 * 词典数据层：把几个免费接口拼成一个干净的数据结构，UI 直接消费。
 *
 * 数据来源（全部免费、无需 key）：
 * - 音标 / 释义 / 近反义词 / 例句：https://api.dictionaryapi.dev
 * - 常见搭配：https://api.datamuse.com （用前后邻词统计模拟搭配，比如 "make a decision"）
 * - 中文翻译：./translate （MyMemory）
 *
 * 缓存策略：内存去重（同一个词并发查询只发一次请求）+ localStorage 持久缓存（30 天）。
 */
import type { Example, Sense, WordEntry } from '../types'
import { translateBatch, translateToChinese } from './translate'

const DICT_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const DATAMUSE_ENDPOINT = 'https://api.datamuse.com/words'
const CACHE_PREFIX = 'wordbook:dict:v2:'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 10000
/** 最多展示几条例句 */
const MAX_EXAMPLES = 3
/** 每个词性最多留几条释义 */
const MAX_DEFS_PER_SENSE = 3

export type LookupErrorKind = 'invalid' | 'notfound' | 'network' | 'empty'

/** 带类型的查询错误，message 可以直接展示给用户 */
export class LookupError extends Error {
  kind: LookupErrorKind
  constructor(kind: LookupErrorKind, message: string) {
    super(message)
    this.name = 'LookupError'
    this.kind = kind
  }
}

interface DictPhonetic {
  text?: string
  audio?: string
}
interface DictDefinition {
  definition?: string
  example?: string
}
interface DictMeaning {
  partOfSpeech?: string
  definitions?: DictDefinition[]
  synonyms?: string[]
  antonyms?: string[]
}
interface DictEntry {
  word?: string
  phonetic?: string
  phonetics?: DictPhonetic[]
  meanings?: DictMeaning[]
}
interface DatamuseItem {
  word?: string
}

/** 同一个词的并发查询共用这一个 Promise */
const inflight = new Map<string, Promise<WordEntry>>()

/** 只接受英文单词，挡住空串、中文和整句话 */
export function normalizeWord(raw: string): string | null {
  const word = raw.trim().toLowerCase().replace(/\u2019/g, "'")
  if (!word) return null
  if (!/^[a-z][a-z'-]{0,44}$/.test(word)) return null
  return word
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list))
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** 词典里偶尔有协议相对地址（//ssl.gstatic.com/...），补上 https */
function normalizeAudioUrl(audio: string): string {
  if (audio.startsWith('//')) return 'https:' + audio
  return audio
}

/** 把 dictionaryapi.dev 的原始 JSON 拍平成我们自己的结构 */
function buildEntry(word: string, payload: DictEntry[]): WordEntry {
  const senses: Sense[] = []
  const synonyms = new Set<string>()
  const antonyms = new Set<string>()
  const examples: Example[] = []

  let ukPhonetic: string | undefined
  let usPhonetic: string | undefined
  let genericPhonetic: string | undefined
  let audioUk: string | undefined
  let audioUs: string | undefined

  for (const item of payload) {
    for (const p of item.phonetics ?? []) {
      const text = (p.text ?? '').trim()
      const audio = p.audio ? normalizeAudioUrl(p.audio.trim()) : ''
      if (audio) {
        // 文件名里带 -uk / -us 的就是对应口音的录音
        if (/-uk\./i.test(audio)) {
          if (!ukPhonetic && text) ukPhonetic = text
          if (!audioUk) audioUk = audio
        } else if (/-us\./i.test(audio)) {
          if (!usPhonetic && text) usPhonetic = text
          if (!audioUs) audioUs = audio
        }
      }
      if (text && !genericPhonetic) genericPhonetic = text
    }
    const top = (item.phonetic ?? '').trim()
    if (top && !genericPhonetic) genericPhonetic = top

    for (const meaning of item.meanings ?? []) {
      const pos = (meaning.partOfSpeech ?? '').trim()
      const defs = (meaning.definitions ?? []).filter((d) => (d.definition ?? '').trim())
      if (pos && defs.length) {
        let target = senses.find((s) => s.partOfSpeech === pos)
        if (!target) {
          target = { partOfSpeech: pos, definitions: [] }
          senses.push(target)
        }
        for (const d of defs) {
          if (target.definitions.length >= MAX_DEFS_PER_SENSE) break
          const text = (d.definition ?? '').trim()
          if (!text || target.definitions.some((x) => x.text === text)) continue
          const example = (d.example ?? '').trim() || undefined
          target.definitions.push({ text, example })
          if (example && examples.length < 12 && !examples.some((e) => e.en === example)) {
            examples.push({ en: example })
          }
        }
      }

      for (const s of meaning.synonyms ?? []) {
        const t = s.trim().toLowerCase()
        if (t && t !== word) synonyms.add(t)
      }
      for (const a of meaning.antonyms ?? []) {
        const t = a.trim().toLowerCase()
        if (t && t !== word) antonyms.add(t)
      }
    }
  }

  return {
    word,
    ukPhonetic: ukPhonetic ?? genericPhonetic,
    usPhonetic: usPhonetic ?? genericPhonetic,
    audioUk,
    audioUs,
    senses,
    synonyms: Array.from(synonyms).slice(0, 12),
    antonyms: Array.from(antonyms).slice(0, 12),
    phrases: [],
    examples: examples.slice(0, MAX_EXAMPLES),
    source: 'api',
    fetchedAt: Date.now()
  }
}

/** Datamuse 的「常见前后邻词」当搭配用；拿不到就返回空数组，UI 会隐藏这一块 */
async function fetchCollocations(word: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const [before, after] = await Promise.all([
      fetchJson<DatamuseItem[]>(
        DATAMUSE_ENDPOINT + '?rel_bgb=' + encodeURIComponent(word) + '&max=8',
        signal
      ),
      fetchJson<DatamuseItem[]>(
        DATAMUSE_ENDPOINT + '?rel_bga=' + encodeURIComponent(word) + '&max=8',
        signal
      )
    ])
    const list: string[] = []
    const isWord = (w: string) => /^[a-z][a-z'-]*$/i.test(w)
    for (const item of before ?? []) {
      const w = (item.word ?? '').trim()
      if (w && isWord(w)) list.push(w + ' ' + word)
    }
    for (const item of after ?? []) {
      const w = (item.word ?? '').trim()
      if (w && isWord(w)) list.push(word + ' ' + w)
    }
    return dedupe(list)
      .filter((p) => p.length <= 40)
      .slice(0, 8)
  } catch {
    return []
  }
}

function cacheKey(word: string): string {
  return CACHE_PREFIX + word
}

function readCache(word: string): WordEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(word))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; entry?: WordEntry }
    if (!parsed?.entry || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > CACHE_TTL) {
      localStorage.removeItem(cacheKey(word))
      return null
    }
    return parsed.entry
  } catch {
    return null
  }
}

/** 缓存写满时清掉旧的词典缓存再试一次（用户词库数据不受影响） */
function writeCache(word: string, entry: WordEntry): void {
  const payload = JSON.stringify({ savedAt: Date.now(), entry })
  try {
    localStorage.setItem(cacheKey(word), payload)
  } catch {
    clearDictionaryCache()
    try {
      localStorage.setItem(cacheKey(word), payload)
    } catch {
      // 还是写不下就算了，下次重新请求
    }
  }
}

/** 清空全部词典缓存（「清空数据」时调用） */
export function clearDictionaryCache(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) keys.push(key)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // 忽略
  }
}

async function requestDictionary(word: string, signal?: AbortSignal): Promise<DictEntry[]> {
  let data: unknown
  try {
    data = await fetchJson<unknown>(DICT_ENDPOINT + '/' + encodeURIComponent(word), signal)
  } catch (err) {
    if (err instanceof Error && err.message.indexOf('404') >= 0) {
      throw new LookupError('notfound', '没有找到「' + word + '」，检查一下拼写？')
    }
    throw new LookupError('network', '网络好像不太顺畅，稍后重试一下')
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new LookupError('empty', '词典里没有「' + word + '」的释义')
  }
  return data as DictEntry[]
}

/** 真正走网络的那条路径 */
async function fetchFresh(word: string, signal?: AbortSignal): Promise<WordEntry> {
  const payload = await requestDictionary(word, signal)
  const base = buildEntry(word, payload)

  // 中文相关的内容全部「尽力而为」：失败就留空，由 UI 决定隐藏
  const [translation, senseTranslations, exampleTranslations, phrases] = await Promise.all([
    translateToChinese(word, signal),
    translateBatch(
      base.senses.map((s) => (s.definitions[0] ? s.definitions[0].text : '')),
      signal
    ),
    translateBatch(
      base.examples.map((e) => e.en),
      signal
    ),
    fetchCollocations(word, signal)
  ])

  const full: WordEntry = {
    ...base,
    translation: translation ?? undefined,
    senses: base.senses.map((sense, i) => ({
      ...sense,
      translation: senseTranslations[i] ?? undefined
    })),
    examples: base.examples.map((ex, i) => ({ ...ex, zh: exampleTranslations[i] ?? undefined })),
    phrases,
    source: 'api',
    fetchedAt: Date.now()
  }

  writeCache(word, full)
  return full
}

/**
 * 查词入口：缓存命中直接返回，否则走网络。
 * 失败时抛出 LookupError，UI 直接把 message 展示给用户即可。
 */
export async function lookupWord(rawWord: string, signal?: AbortSignal): Promise<WordEntry> {
  const word = normalizeWord(rawWord)
  if (!word) {
    throw new LookupError('invalid', '请输入一个英文单词（只支持字母、连字符和撇号）')
  }

  const cached = readCache(word)
  if (cached) return { ...cached, source: 'cache' }

  const pending = inflight.get(word)
  if (pending) return pending

  const task = fetchFresh(word, signal).finally(() => {
    inflight.delete(word)
  })
  inflight.set(word, task)
  return task
}
