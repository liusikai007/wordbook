/**
 * 免费中文翻译（MyMemory，无需 API key）。
 *
 * 三条设计原则：
 * 1. 翻译只是「锦上添花」：任何失败都返回 null，绝不让查词整体失败；
 * 2. 内存 + localStorage 双层缓存，同一个句子一辈子只请求一次；
 * 3. 连续失败触发熔断，短时间内不再拖慢查词速度（国内访问境外接口偶尔会不稳）。
 */
const ENDPOINT = 'https://api.mymemory.translated.net/get'
const CACHE_KEY = 'wordbook:translate:v1'
const TIMEOUT_MS = 8000
/** 连续失败几次就熔断 */
const FAILURE_LIMIT = 3
const COOLDOWN_MS = 5 * 60 * 1000

const memory = new Map<string, string | null>()
let disk: Record<string, string> | null = null
let failures = 0
let cooldownUntil = 0

function loadDisk(): Record<string, string> {
  if (disk) return disk
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    disk = raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    disk = {}
  }
  return disk
}

function persist(key: string, value: string): void {
  const store = loadDisk()
  store[key] = value
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store))
  } catch {
    // 配额写满就放弃持久化，内存缓存依然有效
  }
}

/** MyMemory 偶尔返回 HTML 实体或原样返回英文，这些都算「没翻出来」 */
function sanitize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  // 一个汉字都没有，说明它把英文原样丢回来了
  if (!/[\u4e00-\u9fa5]/.test(text)) return null
  return text
}

export async function translateToChinese(text: string, signal?: AbortSignal): Promise<string | null> {
  const source = text.trim()
  if (!source) return null
  const key = source.toLowerCase()

  if (memory.has(key)) return memory.get(key) ?? null
  const cached = loadDisk()[key]
  if (cached) {
    memory.set(key, cached)
    return cached
  }
  if (Date.now() < cooldownUntil) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const url =
      ENDPOINT +
      '?q=' +
      encodeURIComponent(source) +
      '&langpair=' +
      encodeURIComponent('en|zh-CN')
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = (await res.json()) as { responseData?: { translatedText?: unknown } }
    const result = sanitize(json?.responseData?.translatedText)
    if (result) {
      failures = 0
      memory.set(key, result)
      persist(key, result)
    } else {
      memory.set(key, null)
    }
    return result
  } catch {
    failures += 1
    if (failures >= FAILURE_LIMIT) {
      cooldownUntil = Date.now() + COOLDOWN_MS
      failures = 0
    }
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * 批量翻译：最多 3 个并发。
 * 串行执行时一个新词要等 2~4 秒（每个请求 0.4~1s），并发后一般 1 秒内就能出结果；
 * 3 是折中值，既快又不会触发 MyMemory 的限流。
 */
export async function translateBatch(
  texts: string[],
  signal?: AbortSignal
): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(texts.length).fill(null)
  const queue = texts.map((text, index) => ({ text, index }))
  const workers: Promise<void>[] = []
  const workerCount = Math.min(3, queue.length)

  for (let i = 0; i < workerCount; i += 1) {
    workers.push(
      (async () => {
        for (;;) {
          const item = queue.shift()
          if (!item || signal?.aborted) return
          out[item.index] = await translateToChinese(item.text, signal)
        }
      })()
    )
  }

  await Promise.all(workers)
  return out
}
