import { useRef, type ChangeEvent } from 'react'
import StatCard from '../components/StatCard'
import { useToast } from '../components/Toast'
import { IconDownload, IconTrash, IconUpload } from '../components/icons'
import { useWordbook } from '../store/WordbookContext'
import { dailyActivity } from '../store/stats'
import { downloadJson } from '../store/storage'
import { cn } from '../utils/cn'
import { dayKey, formatDateTime } from '../utils/date'

export default function StatsPage() {
  const { words, logs, stats, exportBackup, importBackup, resetAll } = useWordbook()
  const { show } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const activity = dailyActivity(logs, 7)
  const max = Math.max(1, activity.reduce((acc, day) => Math.max(acc, day.count), 0))
  const lastActive = Math.max(
    0,
    words.reduce((acc, w) => Math.max(acc, w.updatedAt), 0),
    logs.reduce((acc, l) => Math.max(acc, l.at), 0)
  )

  const handleExport = () => {
    downloadJson(exportBackup(), 'wordbook-backup-' + dayKey(Date.now()) + '.json')
    show('备份文件已导出', 'good')
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 清空 value，这样同一个文件可以再次选择
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = importBackup(text)
      show('导入完成：新增 ' + result.added + ' 个，更新 ' + result.updated + ' 个', 'good')
    } catch (err) {
      show(err instanceof Error ? err.message : '导入失败，检查一下文件格式', 'warn')
    }
  }

  const handleReset = () => {
    if (!window.confirm('会清空词库、复习记录和词典缓存，且无法恢复。继续吗？')) return
    if (!window.confirm('再确认一次：真的要清空全部数据吗？')) return
    resetAll()
    show('已清空全部数据')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="累计学过" value={stats.total} hint="个单词" accent />
        <StatCard label="今日复习" value={stats.reviewsToday} hint="次评分" accent />
        <StatCard label="连续打卡" value={stats.streak} hint="天" accent />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="待复习" value={stats.dueToday} hint="今天到期" />
        <StatCard label="已掌握" value={stats.mastered} hint="手动标记" />
        <StatCard
          label="拼写正确率"
          value={stats.spellAccuracy === null ? '—' : stats.spellAccuracy + '%'}
          hint={stats.spellAccuracy === null ? '还没练过' : '拼写测试'}
        />
      </div>

      <div className="card">
        <h3 className="section-title mb-3">最近 7 天复习次数</h3>
        <div className="flex items-end justify-between gap-2">
          {activity.map((day) => (
            <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="tnum text-[11px] text-ink-300 dark:text-cream-300/80">
                {day.count ? day.count : ''}
              </span>
              <div className="flex h-24 w-full items-end overflow-hidden rounded-lg bg-cream-100 dark:bg-night-700/60">
                <div
                  className={cn(
                    'w-full rounded-lg transition-all duration-300',
                    day.isToday ? 'bg-sage-400' : 'bg-sage-300'
                  )}
                  style={{ height: (day.count ? Math.round((day.count / max) * 100) : 4) + '%' }}
                />
              </div>
              <span className="text-[10px] text-ink-300 dark:text-cream-300/80">{day.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-500 dark:text-cream-300">
          累计复习 {stats.totalReviews} 次，学习中 {stats.learning} 个单词。
        </p>
      </div>

      <div className="card space-y-3">
        <div>
          <h3 className="text-[15px] font-medium text-ink-900 dark:text-cream-50">数据备份</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500 dark:text-cream-300">
            所有数据只保存在这个浏览器的 localStorage 里，不会上传到任何服务器。
            换设备、换浏览器或清理缓存前，记得先导出。
            {lastActive ? '最后活动：' + formatDateTime(lastActive) : '还没有学习记录。'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-soft flex-1" onClick={handleExport}>
            <IconDownload className="h-4 w-4" />
            导出 JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload className="h-4 w-4" />
            导入 JSON
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          type="button"
          className="btn w-full bg-apricot-100 text-ink-700 hover:bg-apricot-200 dark:bg-night-700 dark:text-apricot-200"
          onClick={handleReset}
        >
          <IconTrash className="h-4 w-4" />
          清空全部数据
        </button>
      </div>

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-ink-300 dark:text-cream-300/70">
        词典数据来自 dictionaryapi.dev 与 datamuse.com，中文翻译来自 MyMemory，全部免费且无需 key。
      </p>
    </div>
  )
}
