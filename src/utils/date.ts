/** 一天的毫秒数 */
export const DAY = 24 * 60 * 60 * 1000

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** 当天 00:00:00 的时间戳 */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 当天 23:59:59.999 的时间戳：判断「今天之内到期」时用 */
export function endOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** 本地日期键，如 2026-10-08；统计打卡天数时以自然日为单位 */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 两个时间相差几个自然日 */
export function diffDays(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY)
}

/** 把「下次复习时间」说成人话 */
export function humanizeDue(nextReviewAt: number, now: number = Date.now()): string {
  const diff = nextReviewAt - now
  if (diff <= 0) return '现在就该复习'
  if (diff < 60 * 60 * 1000) return Math.max(1, Math.round(diff / 60000)) + ' 分钟后'
  const days = diffDays(now, nextReviewAt)
  if (days <= 0) return '今天晚些时候'
  if (days === 1) return '明天'
  if (days === 2) return '后天'
  if (days < 30) return days + ' 天后'
  if (days < 365) return Math.round(days / 30) + ' 个月后'
  return (days / 365).toFixed(1) + ' 年后'
}

/** 2026-10-08 14:30 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return dayKey(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}
