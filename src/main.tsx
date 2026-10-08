import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import { WordbookProvider } from './store/WordbookContext'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('找不到 #root 挂载点')

createRoot(container).render(
  <StrictMode>
    <WordbookProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WordbookProvider>
  </StrictMode>
)

// 生产环境注册 Service Worker：支持「添加到主屏幕」和离线打开
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => {
        // 注册失败不影响正常使用
      })
  })
}
