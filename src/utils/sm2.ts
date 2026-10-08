import type { Rating, WordEntry, WordRecord } from '../types'
import { DAY, endOfDay, humanizeDue } from './date'

/** 初始难度系数 */
export const INITIAL_EASE = 2.5
/** 难度系数下限，防止间隔彻底不增长 */
export const MIN_EASE = 1.3
/** 难度系数上限，防止个别词间隔爆炸 */
export const MAX_EASE = 3.0
/** 「没记住」的词 10 分钟后再出现 */
export const RELEARN_MINUTES = 10
/** 内部统一用「天」保存间隔，所以 10 分钟要换算成天 */
const RELEARN_INTERVAL_DAYS = RELEARN_MINUTES / (24 * 60)
/** 间隔上限，避免算出一个几百年后的日期 */
const MAX_INTERVAL_DAYS = 365

export const RATING_LABEL: Record<Rating, string> = {
  again: '没记住',
  vague: '有点模糊',
  good: '记住了'
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number(ease.toFixed(2))))
}

/** 新建一条单词记忆档案：立刻到期，等用户来复习 */
export function createWordRecord(entry: WordEntry, now: number = Date.now()): WordRecord {
  return {
    id: entry.word.toLowerCase(),
    word: entry.word,
    entry,
    ease: INITIAL_EASE,
    interval: 0,
    repetitions: 0,
    nextReviewAt: now,
    lastReviewedAt: null,
    mastered: false,
    createdAt: now,
    updatedAt: now,
    reviewCount: 0,
    lapseCount: 0,
    spellWrong: 0,
    spellCorrect: 0
  }
}

/**
 * 简化版 SM-2 间隔重复算法。
 *
 * 三档评分对应的调度规则：
 * - again（没记住）：repetitions 归零，10 分钟后重新出现，easiness -0.2
 * - vague（有点模糊）：repetitions 不变，interval = max(1, interval * 1.2)，easiness -0.15
 * - good（记住了）：repetitions + 1，interval 依次为 1 天、3 天，之后 interval * easiness，easiness +0.1
 *
 * 所有字段都会被夹在合理区间内，保证算法长期运行不会失控。
 */
export function applyRating(record: WordRecord, rating: Rating, now: number = Date.now()): WordRecord {
  let ease = record.ease
  let interval = record.interval
  let repetitions = record.repetitions
  let lapseCount = record.lapseCount

  if (rating === 'again') {
    repetitions = 0
    interval = RELEARN_INTERVAL_DAYS
    ease = clampEase(ease - 0.2)
    lapseCount += 1
  } else if (rating === 'vague') {
    interval = Math.max(1, interval * 1.2)
    ease = clampEase(ease - 0.15)
  } else {
    repetitions += 1
    ease = clampEase(ease + 0.1)
    if (repetitions <= 1) interval = 1
    else if (repetitions === 2) interval = 3
    else interval = Math.max(1, Math.round(interval * ease))
  }

  interval = Math.min(interval, MAX_INTERVAL_DAYS)

  return {
    ...record,
    ease,
    interval,
    repetitions,
    lapseCount,
    lastReviewedAt: now,
    nextReviewAt: now + interval * DAY,
    reviewCount: record.reviewCount + 1,
    updatedAt: now,
    // 说「没记住」时自动取消「已掌握」；其他评分保持用户的手动标记
    mastered: rating === 'again' ? false : record.mastered
  }
}

/** 这个单词今天要不要复习（今天之内到期的都算，不要求此刻已过点） */
export function isDueToday(record: WordRecord, now: number = Date.now()): boolean {
  return !record.mastered && record.nextReviewAt <= endOfDay(now)
}

/** 评分前先预览一下「下次什么时候见」，用于给出温柔的正反馈 */
export function previewNextDue(record: WordRecord, rating: Rating, now: number = Date.now()): string {
  const next = applyRating(record, rating, now)
  return humanizeDue(next.nextReviewAt, now)
}
