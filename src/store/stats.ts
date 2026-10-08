import type { ReviewLog, Stats, WordRecord } from '../types'
import { dayKey, endOfDay } from '../utils/date'

/**
 * 连续打卡天数：从今天（今天还没学就从昨天）往前数，连续有复习记录的天数。
 * 中午 12 点作为锚点，避免夏令时把日期算歪。
 */
export function computeStreak(logs: ReviewLog[], now: number = Date.now()): number {
  if (!logs.length) return 0
  const days = new Set(logs.map((l) => dayKey(l.at)))
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dayKey(cursor.getTime()))) return 0
  }
  let streak = 0
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function buildStats(
  words: WordRecord[],
  logs: ReviewLog[],
  now: number = Date.now()
): Stats {
  const today = dayKey(now)
  const limit = endOfDay(now)
  const mastered = words.filter((w) => w.mastered).length
  const dueToday = words.filter((w) => !w.mastered && w.nextReviewAt <= limit).length
  const reviewsToday = logs.filter((l) => dayKey(l.at) === today).length
  const spellLogs = logs.filter((l) => l.mode === 'spelling')
  const spellRight = spellLogs.filter((l) => l.rating === 'good').length

  return {
    total: words.length,
    mastered,
    learning: words.length - mastered,
    dueToday,
    reviewsToday,
    streak: computeStreak(logs, now),
    totalReviews: logs.length,
    spellAccuracy: spellLogs.length ? Math.round((spellRight / spellLogs.length) * 100) : null
  }
}

export interface DayActivity {
  key: string
  label: string
  count: number
  isToday: boolean
}

/** 最近 n 天每天的复习次数，用于统计页的柱状图 */
export function dailyActivity(
  logs: ReviewLog[],
  days: number,
  now: number = Date.now()
): DayActivity[] {
  const counts = new Map<string, number>()
  for (const log of logs) {
    const key = dayKey(log.at)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const out: DayActivity[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = dayKey(d.getTime())
    out.push({
      key,
      label: d.getMonth() + 1 + '/' + d.getDate(),
      count: counts.get(key) ?? 0,
      isToday: i === 0
    })
  }
  return out
}
