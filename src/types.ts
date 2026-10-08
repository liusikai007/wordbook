/** 用户对一次记忆的评分档位 */
export type Rating = 'again' | 'vague' | 'good'

/** 底部导航的四个页面 */
export type TabKey = 'search' | 'review' | 'wordbook' | 'stats'

/** 复习模式：看答案回忆 / 拼写测试 */
export type ReviewMode = 'memory' | 'spelling'

/** 一条释义 */
export interface Definition {
  text: string
  example?: string
}

/** 按词性分组的一组释义 */
export interface Sense {
  /** 原始词性，如 noun / verb / adjective */
  partOfSpeech: string
  definitions: Definition[]
  /** 该词性的中文释义（接口没返回就是 undefined，UI 会隐藏） */
  translation?: string
}

/** 一条双语例句 */
export interface Example {
  en: string
  zh?: string
}

/** 归一化之后的词典数据：所有字段都可能缺失，UI 必须优雅隐藏空区块 */
export interface WordEntry {
  word: string
  ukPhonetic?: string
  usPhonetic?: string
  /** 英式发音音频地址 */
  audioUk?: string
  /** 美式发音音频地址 */
  audioUs?: string
  /** 中文翻译 */
  translation?: string
  senses: Sense[]
  synonyms: string[]
  antonyms: string[]
  /** 常见搭配 / 词组 */
  phrases: string[]
  examples: Example[]
  /** api = 刚走网络拿到，cache = 本地缓存命中 */
  source: 'api' | 'cache'
  fetchedAt: number
}

/** 词库里的一条单词记录，含 SM-2 调度字段 */
export interface WordRecord {
  /** 小写单词，作为唯一 id */
  id: string
  word: string
  /** 词典详情，可能为 null（离线添加等情况） */
  entry: WordEntry | null
  /** easiness 难度系数，默认 2.5 */
  ease: number
  /** 当前间隔（天），小于 1 表示分钟级重学 */
  interval: number
  /** 连续记住的次数 */
  repetitions: number
  /** 下次复习时间戳 */
  nextReviewAt: number
  lastReviewedAt: number | null
  mastered: boolean
  createdAt: number
  updatedAt: number
  reviewCount: number
  lapseCount: number
  /** 拼写测试里的累计错误次数（大于 0 就在「错词队列」里） */
  spellWrong: number
  spellCorrect: number
}

/** 一次复习记录，用于统计与打卡 */
export interface ReviewLog {
  id: string
  wordId: string
  rating: Rating
  mode: ReviewMode
  at: number
}

/** 导出 / 导入的 JSON 结构 */
export interface BackupData {
  app: 'wordbook'
  version: number
  exportedAt: string
  words: WordRecord[]
  logs: ReviewLog[]
}

/** 统计页要用的汇总数据 */
export interface Stats {
  total: number
  mastered: number
  learning: number
  dueToday: number
  reviewsToday: number
  streak: number
  totalReviews: number
  /** 拼写正确率百分比，没练过就是 null */
  spellAccuracy: number | null
}
