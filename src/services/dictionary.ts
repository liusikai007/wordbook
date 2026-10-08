/**
 * 词典数据层：把几个免费接口拼成一个干净的数据结构，UI 直接消费。
 *
 * 数据来源（全部免费、无需 key）：
 * - 主源 https://api.dictionaryapi.dev  音标 / 真人发音 / 释义 / 近反义词 / 例句
 * - 备用源 https://api.datamuse.com     释义 / 词性 / 近反义词 / 常见搭配 / 发音
 * - 中文翻译 ./translate（MyMemory）
 *
 * 为什么必须要有备用源：实测 api.dictionaryapi.dev 对部分常用词（happy、run 等）会返回 404，
 * 而且它的 404 响应不带 CORS 头 —— 浏览器里根本读不到状态码，只能看到「请求失败」；
 * 它在国内还会偶发超时。所以两个源并行发起，主源拿不到内容就立刻用备用源的结果，用户无感。
 *
 * 缓存策略：内存去重（同一个词的并发查询只发一次请求）+ localStorage 持久缓存（30 天）。
 */
import type { Example, Sense, WordEntry } from '../types'
import { translateBatch, translateToChinese } from './translate'

const DICT_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const DATAMUSE_ENDPOINT = 'https://api.datamuse.com/words'
const CACHE_PREFIX = 'wordbook:dict:v2:'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
/** 主源超时时间。它偶尔会整个挂住，6 秒拿不到就交给备用源 */
const PRIMARY_TIMEOUT_MS = 6000
/** 备用源很快（实测 70~120ms），给 5 秒足够 */
const FALLBACK_TIMEOUT_MS = 5000
/** 最多展示几条例句 */
const MAX_EXAMPLES = 3
/** 每个词性最多留几条释义 */
const MAX_DEFS_PER_SENSE = 3
/** 备用源的释义来自 Wiktionary，个别条目很长，截断一下 */
const MAX_DEF_TEXT = 220

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
  tags?: string[]
  defs?: string[]
}

/** 备用源一次拿回来的所有东西 */
interface DatamuseBundle {
  definitions: { pos: string; text: string }[]
  tags: string[]
  synonyms: string[]
  antonyms: string[]
  before: string[]
  after: string[]
  /**
   * 备用源有没有正常响应（哪怕是空结果）。
   * 用它区分「这个词真的不存在」和「网络整个不通」——只看有没有数据是分不出来的。
   */
  reachable: boolean
}

/** 同一个词的并发查询共用这一个 Promise */
const inflight = new Map<string, Promise<WordEntry>>()

/**
 * ARPAbet → IPA。备用源的发音是 ARPAbet（如 "HH AE1 P IY0"），
 * 直接给用户看没有意义，这里做一次标准转写，数字 1/2 表示重音。
 */
const ARPABET_IPA: Record<string, string> = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ',
  IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l',
  M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v',
  W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ'
}

/** 备用源的词性缩写映射成完整词性名，UI 里统一显示 n. / v. / adj. */
const DATAMUSE_POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'other'
}

function arpabetToIpa(pron: string): string | undefined {
  const tokens = pron.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return undefined
  let out = ''
  for (const token of tokens) {
    const last = token.slice(-1)
    const hasStress = last === '0' || last === '1' || last === '2'
    const phoneme = ARPABET_IPA[(hasStress ? token.slice(0, -1) : token).toUpperCase()]
    if (!phoneme) continue
    if (last === '1') out += 'ˈ'
    else if (last === '2') out += 'ˌ'
    out += phoneme
  }
  return out ? '/' + out + '/' : undefined
}

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

function truncate(text: string): string {
  if (text.length <= MAX_DEF_TEXT) return text
  return text.slice(0, MAX_DEF_TEXT).trim() + '…'
}

async function fetchJson<T>(url: string, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
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

/* ------------------------------------------------------------------ */
/* 主源：api.dictionaryapi.dev                                          */
/* ------------------------------------------------------------------ */

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
    provider: 'dictionaryapi',
    fetchedAt: Date.now()
  }
}

async function requestDictionary(word: string, signal?: AbortSignal): Promise<DictEntry[]> {
  let data: unknown
  try {
    data = await fetchJson<unknown>(
      DICT_ENDPOINT + '/' + encodeURIComponent(word),
      PRIMARY_TIMEOUT_MS,
      signal
    )
  } catch (err) {
    // 浏览器里读不到 404 的状态码（响应没有 CORS 头），所以这里统一按「主源不可用」处理，
    // 由上层决定用备用源还是报「查无此词」。
    if (err instanceof Error && err.message.indexOf('404') >= 0) {
      throw new LookupError('notfound', '没有找到「' + word + '」的释义')
    }
    throw new LookupError('network', '连不上词典服务，稍后重试一下')
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new LookupError('empty', '词典里没有「' + word + '」的释义')
  }
  return data as DictEntry[]
}

async function fetchPrimary(word: string, signal?: AbortSignal): Promise<WordEntry> {
  const payload = await requestDictionary(word, signal)
  return buildEntry(word, payload)
}

/* ------------------------------------------------------------------ */
/* 备用源：api.datamuse.com                                             */
/* ------------------------------------------------------------------ */

function datamuseWords(items: DatamuseItem[] | undefined, limit: number): string[] {
  const out: string[] = []
  const isWord = (w: string) => /^[a-z][a-z'-]*$/i.test(w)
  for (const item of items ?? []) {
    const w = (item.word ?? '').trim().toLowerCase()
    if (w && isWord(w) && out.indexOf(w) < 0) out.push(w)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 一次并发拿齐备用源的全部信息。
 * 任何一个子请求失败都不影响其余的（allSettled），最差返回空 bundle。
 */
async function fetchDatamuse(word: string, signal?: AbortSignal): Promise<DatamuseBundle> {
  const bundle: DatamuseBundle = {
    definitions: [],
    tags: [],
    synonyms: [],
    antonyms: [],
    before: [],
    after: [],
    reachable: false
  }
  const enc = encodeURIComponent(word)
  const settled = await Promise.allSettled([
    fetchJson<DatamuseItem[]>(DATAMUSE_ENDPOINT + '?sp=' + enc + '&md=dprs&max=1', FALLBACK_TIMEOUT_MS, signal),
    fetchJson<DatamuseItem[]>(DATAMUSE_ENDPOINT + '?rel_syn=' + enc + '&max=12', FALLBACK_TIMEOUT_MS, signal),
    fetchJson<DatamuseItem[]>(DATAMUSE_ENDPOINT + '?rel_ant=' + enc + '&max=12', FALLBACK_TIMEOUT_MS, signal),
    fetchJson<DatamuseItem[]>(DATAMUSE_ENDPOINT + '?rel_bgb=' + enc + '&max=8', FALLBACK_TIMEOUT_MS, signal),
    fetchJson<DatamuseItem[]>(DATAMUSE_ENDPOINT + '?rel_bga=' + enc + '&max=8', FALLBACK_TIMEOUT_MS, signal)
  ])

  bundle.reachable = settled.some((r) => r.status === 'fulfilled')

  const pick = (index: number): DatamuseItem[] => {
    const r = settled[index]
    return r.status === 'fulfilled' ? r.value : []
  }

  const self = pick(0)[0]
  if (self) {
    for (const raw of self.defs ?? []) {
      const tab = raw.indexOf('\t')
      const pos = tab > 0 ? raw.slice(0, tab).trim() : 'u'
      const text = truncate((tab > 0 ? raw.slice(tab + 1) : raw).trim())
      if (text) bundle.definitions.push({ pos, text })
    }
    bundle.tags = self.tags ?? []
  }

  bundle.synonyms = datamuseWords(pick(1), 12).filter((w) => w !== word)
  bundle.antonyms = datamuseWords(pick(2), 12).filter((w) => w !== word)
  bundle.before = datamuseWords(pick(3), 8)
  bundle.after = datamuseWords(pick(4), 8)
  return bundle
}

function buildPhrases(word: string, bundle: DatamuseBundle): string[] {
  const list: string[] = []
  for (const w of bundle.before) list.push(w + ' ' + word)
  for (const w of bundle.after) list.push(word + ' ' + w)
  return dedupe(list)
    .filter((p) => p.length <= 40)
    .slice(0, 8)
}

/** 主源查不到时，用备用源拼出一张「没有例句」的卡片 */
function buildEntryFromDatamuse(word: string, bundle: DatamuseBundle): WordEntry | null {
  if (!bundle.definitions.length) return null

  const senses: Sense[] = []
  for (const item of bundle.definitions) {
    const pos = DATAMUSE_POS[item.pos] ?? item.pos ?? 'other'
    let target = senses.find((s) => s.partOfSpeech === pos)
    if (!target) {
      target = { partOfSpeech: pos, definitions: [] }
      senses.push(target)
    }
    if (target.definitions.length >= MAX_DEFS_PER_SENSE) continue
    if (target.definitions.some((d) => d.text === item.text)) continue
    target.definitions.push({ text: item.text })
  }

  const pronTag = bundle.tags.find((t) => t.indexOf('pron:') === 0)
  const phonetic = pronTag ? arpabetToIpa(pronTag.slice(5)) : undefined

  return {
    word,
    ukPhonetic: phonetic,
    usPhonetic: phonetic,
    senses,
    synonyms: bundle.synonyms,
    antonyms: bundle.antonyms,
    phrases: buildPhrases(word, bundle),
    examples: [],
    source: 'api',
    provider: 'datamuse',
    fetchedAt: Date.now()
  }
}

/* ------------------------------------------------------------------ */
/* 缓存                                                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 对外入口                                                             */
/* ------------------------------------------------------------------ */

async function fetchFresh(word: string, signal?: AbortSignal): Promise<WordEntry> {
  // 主源和备用源同时发出：主源慢或挂掉时，备用源早就把结果准备好了
  const [primaryResult, bundle] = await Promise.all([
    fetchPrimary(word, signal).then(
      (entry) => ({ ok: true as const, entry }),
      (error: unknown) => ({ ok: false as const, error })
    ),
    fetchDatamuse(word, signal)
  ])

  let base: WordEntry | null = primaryResult.ok ? primaryResult.entry : null
  const fallbackEntry = buildEntryFromDatamuse(word, bundle)

  if (base && !base.senses.length && fallbackEntry) {
    // 主源只有音标没有释义时，用备用源的释义补上，音标和真人发音仍然用主源的
    base = {
      ...fallbackEntry,
      ukPhonetic: base.ukPhonetic ?? fallbackEntry.ukPhonetic,
      usPhonetic: base.usPhonetic ?? fallbackEntry.usPhonetic,
      audioUk: base.audioUk,
      audioUs: base.audioUs
    }
  } else if (!base) {
    base = fallbackEntry
  }

  if (!base) {
    // 两个源都没内容：只有「主源网络失败 + 备用源完全没响应」才算网络问题，
    // 其余情况（主源 404、主源返回空、备用源答了但没这个词）都是「查无此词」
    const reason = primaryResult.ok ? null : primaryResult.error
    if (reason instanceof LookupError && reason.kind === 'network' && !bundle.reachable) {
      throw reason
    }
    throw new LookupError('notfound', '没有找到「' + word + '」的释义，检查一下拼写？')
  }

  // 主源缺少近反义词或搭配时，用备用源补齐
  const merged: WordEntry = {
    ...base,
    synonyms: base.synonyms.length ? base.synonyms : bundle.synonyms,
    antonyms: base.antonyms.length ? base.antonyms : bundle.antonyms,
    phrases: base.phrases.length ? base.phrases : buildPhrases(word, bundle)
  }

  // 中文翻译全部「尽力而为」：失败就留空，由 UI 隐藏
  const [translation, senseTranslations, exampleTranslations] = await Promise.all([
    translateToChinese(word, signal),
    translateBatch(
      merged.senses.map((s) => (s.definitions[0] ? s.definitions[0].text : '')),
      signal
    ),
    translateBatch(
      merged.examples.map((e) => e.en),
      signal
    )
  ])

  const full: WordEntry = {
    ...merged,
    translation: translation ?? undefined,
    senses: merged.senses.map((sense, i) => ({
      ...sense,
      translation: senseTranslations[i] ?? undefined
    })),
    examples: merged.examples.map((ex, i) => ({ ...ex, zh: exampleTranslations[i] ?? undefined })),
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
