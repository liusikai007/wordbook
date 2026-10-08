# 词簿 · 英语背单词

移动端优先的单页应用（React 18 + Vite 5 + TypeScript + Tailwind CSS 3）。
数据全部保存在浏览器本地（localStorage），不需要登录，不需要任何付费 key。

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 查词 | 顶部输入框回车即查；音标（英/美分列）、中文翻译、按词性分组的释义、近义词、反义词、常见搭配、2~3 条双语例句；查询中显示 loading，失败给友好提示与「重试」按钮，绝不白屏 |
| 记忆判定 | 每张卡片下方三档评分：没记住 / 有点模糊 / 记住了；另有「标记已掌握」和「删除单词」 |
| 复习调度 | 简化版 SM-2；首页与底部导航显示今日待复习数量；复习模式先只给单词和发音，点「显示答案」才展开全部信息 |
| 拼写测试 | 看中文拼英文，自动判对错；可切换「只练拼错的词」，拼对一次就退出错词队列 |
| 我的词库 | 按待复习 / 已掌握 / 全部 三种条件筛选，支持关键词搜索，展开行内查看详情 |
| 统计 | 累计学过、今日复习、连续打卡、待复习、已掌握、拼写正确率、最近 7 天柱状图 |
| 数据备份 | 导出 / 导入 JSON，一键清空；导入时按复习进度取更靠后的一份，旧备份不会把进度拉回去 |
| 体验 | 深色模式（跟随系统，可手动切换）、PWA 可添加到主屏幕并离线打开、44px 最小点击区域、安全区适配 |

---

## 快速开始

前置：Node.js 18 或更高版本（推荐 20 LTS）。

~~~bash
npm install
npm run dev
~~~

浏览器打开 http://localhost:5173 即可。首次查词需要联网（走免费的公开词典接口）。

开发服务器默认只监听本机。想在手机上真机测试时，用同一 WiFi 连上后用这条命令启动，再用手机访问终端里打印的 Network 地址：

~~~bash
npm run dev -- --host
~~~

其他命令：

~~~bash
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 本地预览 dist/ 的构建结果
npm run typecheck  # 只跑 TypeScript 类型检查
~~~

---

## 目录结构

~~~text
wordbook/
├─ index.html                  页面骨架、viewport(safe-area)、主题预加载脚本
├─ vite.config.ts              base 设为相对路径，产物可直接部署到子目录
├─ tailwind.config.cjs         奶油白 / 鼠尾草绿 / 淡杏 配色与动画
├─ postcss.config.cjs
├─ tsconfig.json
├─ public/
│  ├─ manifest.webmanifest     PWA 清单
│  ├─ sw.js                    Service Worker（导航网络优先、静态资源缓存优先）
│  └─ icons/                   应用图标（含 maskable）
└─ src/
   ├─ main.tsx                 入口 + 生产环境注册 Service Worker
   ├─ App.tsx                  布局、底部导航、深浅色切换
   ├─ index.css                Tailwind 指令 + .card/.btn/.chip 等复用类
   ├─ types.ts                 WordEntry / WordRecord / ReviewLog / Stats
   ├─ services/
   │  ├─ dictionary.ts         词典接口封装：归一化 + 双层缓存 + 并发去重
   │  ├─ translate.ts          中文翻译：缓存 + 失败熔断（失败不影响主流程）
   │  └─ speech.ts             发音：优先真人录音，失败回退浏览器 TTS
   ├─ store/
   │  ├─ storage.ts            localStorage 读写、结构校验、备份导出解析
   │  ├─ stats.ts              连续打卡、7 天活动统计
   │  └─ WordbookContext.tsx   词库状态与全部操作
   ├─ hooks/useDictionary.ts   查词状态机（idle/loading/success/error）
   ├─ utils/
   │  ├─ sm2.ts                ★ 间隔重复算法（含中文注释）
   │  ├─ date.ts               自然日边界、人类可读的到期时间
   │  └─ cn.ts                 拼 className
   ├─ components/              WordCard / ReviewCard / SpellingTest / RatingButtons
   │                           BottomNav / SearchBar / Toast / StatCard 等
   └─ pages/                   SearchPage / ReviewPage / WordbookPage / StatsPage
~~~

---

## 间隔重复算法（src/utils/sm2.ts）

每个单词保存 5 个调度字段：ease（默认 2.5）、interval（天）、repetitions、nextReviewAt、lastReviewedAt。

| 评分 | repetitions | interval | easiness |
| --- | --- | --- | --- |
| 没记住 | 归零 | 10 分钟后重来（内部存 10/1440 天） | -0.2 |
| 有点模糊 | 不变 | max(1, interval × 1.2) | -0.15 |
| 记住了 | +1 | 第 1 次 1 天、第 2 次 3 天、之后 interval × easiness | +0.1 |

边界处理：ease 夹在 [1.3, 3.0]，interval 上限 365 天，所以算法长期跑也不会失控。
「没记住」会自动取消「已掌握」标记；是否到期以当天 23:59:59 为界，所以「10 分钟后重来」的词当天仍会出现在待复习列表里。

---

## 数据来源

- 音标 / 释义 / 近反义词 / 例句：https://api.dictionaryapi.dev （免费、无需 key）
- 常见搭配：https://api.datamuse.com （免费、无需 key，用前后邻词统计模拟搭配）
- 中文翻译：https://api.mymemory.translated.net （免费、无需 key）

缓存策略：同一单词的并发查询只发一次请求（内存 Promise 去重）；词典结果写进 localStorage 缓存 30 天，翻译结果永久缓存；词典缓存写满时会自动清理旧缓存，不影响词库数据。

接口字段缺失怎么办：任何区块（音标、释义、例句、搭配、近反义词）为空时整块隐藏，页面永远不会出现 undefined；中文翻译失败时只显示英文内容，并触发 5 分钟熔断，避免拖慢后续查词。

---

## 部署

### Vercel（最省事）

1. 把项目推到 GitHub 仓库；
2. 在 https://vercel.com 用 GitHub 账号导入该仓库，框架会被自动识别为 Vite；
3. Build Command 保持 npm run build，Output Directory 保持 dist，直接 Deploy；
4. 完成后得到 https://你的项目.vercel.app。

命令行方式：

~~~bash
npm i -g vercel
vercel --prod
~~~

### GitHub Pages

因为 vite.config.ts 里设置了相对 base，产物用相对路径加载，放到 https://用户名.github.io/仓库名/ 这种子路径下也能直接用，不需要额外改配置。

在仓库里新建 .github/workflows/deploy.yml：

~~~yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
~~~

然后到仓库 Settings → Pages → Source 选择 GitHub Actions，推送到 main 分支就会自动发布。

### Netlify / Cloudflare Pages

Build command 填 npm run build，Publish directory 填 dist，其余保持默认即可。

### 纯静态托管

npm run build 之后，把 dist 目录整个上传到任意静态服务器（Nginx、对象存储、内网服务器都行）。

---

## 数据与隐私

所有数据都在你自己的浏览器里，不会上传到任何服务器：

| localStorage 键 | 内容 |
| --- | --- |
| wordbook:data:v1 | 词库（含 SM-2 调度字段）与复习记录 |
| wordbook:dict:v2:单词 | 词典缓存，30 天有效 |
| wordbook:translate:v1 | 翻译缓存 |
| wordbook:theme | 深浅色偏好 |

换设备、换浏览器或清理浏览器数据前，请到「统计 → 数据备份」导出 JSON。

---

## 已知边界

- 词典接口对生僻词、部分变形词可能查不到，界面会提示「没有找到，检查一下拼写」；
- MyMemory 匿名额度按字符计算（约 5000 字符/天），额度用尽或网络不稳时会短暂熔断，此时只显示英文释义；
- 中文释义取的是「该词性第一个义项的机翻」，只作提示，精确含义请看英文释义与例句；
- 浏览器语音合成需要系统里装有英文语音包，没有时发音按钮会静默失效（不报错）。
