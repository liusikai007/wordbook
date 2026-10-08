import { useEffect, useState } from 'react'
import BottomNav from './components/BottomNav'
import { IconMoon, IconSun } from './components/icons'
import ReviewPage from './pages/ReviewPage'
import SearchPage from './pages/SearchPage'
import StatsPage from './pages/StatsPage'
import WordbookPage from './pages/WordbookPage'
import { useWordbook } from './store/WordbookContext'
import { loadTheme, saveTheme } from './store/storage'
import type { TabKey } from './types'

function initialTheme(): 'light' | 'dark' {
  const saved = loadTheme()
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { stats } = useWordbook()
  const [tab, setTab] = useState<TabKey>('search')
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    saveTheme(theme)
  }, [theme])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 border-b border-cream-200/60 bg-cream-100/85 backdrop-blur-md dark:border-night-700/70 dark:bg-night-950/85">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold leading-tight text-ink-900 dark:text-cream-50">
              词簿
            </h1>
            <p className="mt-0.5 text-[11px] text-ink-300 dark:text-cream-300/80">
              {stats.dueToday > 0 ? '今天待复习 ' + stats.dueToday + ' 个' : '今天没有待复习的词'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            className="icon-btn bg-cream-200/70 text-ink-500 dark:bg-night-700 dark:text-cream-100"
          >
            {theme === 'dark' ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4">
        {tab === 'search' ? <SearchPage onGoReview={() => setTab('review')} /> : null}
        {tab === 'review' ? <ReviewPage onGoSearch={() => setTab('search')} /> : null}
        {tab === 'wordbook' ? <WordbookPage onGoSearch={() => setTab('search')} /> : null}
        {tab === 'stats' ? <StatsPage /> : null}
      </main>

      <BottomNav tab={tab} dueCount={stats.dueToday} onChange={setTab} />
    </div>
  )
}
