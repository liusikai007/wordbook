import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让构建产物全部使用相对路径，
// 这样同一份 dist 既能在 Vercel 根路径部署，也能放到 GitHub Pages 的 /repo/ 子路径下。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    // 默认只监听本机，避免把开发服务器暴露到局域网/公网。
    // 需要用手机在同一 WiFi 下测试时：npm run dev -- --host
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 移动端首屏体积敏感，把 React 单独分包便于浏览器缓存
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom']
        }
      }
    }
  }
})
