# 台灣數位生命線：海底電纜

開放文化基金會（OCF）的海纜敘事網站。首頁是 `src/` 的 2D SVG 捲動敘事；延伸文章寫在 Markdown，編譯成靜態 HTML 以利 SEO。

源碼 MIT，內容 [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

## 本機開發

需要 Node.js 22。

```bash
npm install
npm run dev
```

開 http://127.0.0.1:3456/ 。改 `src/` 或 `content/articles/*.md` 存檔後重新整理即可。

建置靜態檔（GitHub Pages 也跑這步）：

```bash
npm run build
```

產出在 `dist/`。

## 新增或修改文章

1. 編輯或新增 [`content/articles/`](content/articles/) 裡的 Markdown，檔名即網址 slug（例如 `05-how-apps-were-tested.md` → `/articles/05-how-apps-were-tested/`）。
2. 開頭寫 frontmatter：

```yaml
---
title: 文章標題
subtitle: 切角名稱
order: 5
description: 列表與社群預覽用的一句話
pubDate: 2026-08-25
draft: true
---
```

3. `order` 決定首頁卡片順序。`draft: true` 仍會產生頁面，但卡片會標示「撰寫中」，並加上 `noindex`。
4. 圖片放 `content/images/`（不要再分子資料夾），Markdown 用根路徑引用，例如 `![說明](/images/apps-overview.png)`。

## 改首頁

日常改版只動 `src/`（HTML / CSS / JS）。首頁文章卡片不要手寫，編譯時會從 Markdown 填入。

## 目錄

- `src/` — 首頁介面（對齊 `ref/fast`）
- `content/articles/` — 文章 Markdown
- `content/images/` — 文章圖片（單層，不分子目錄）
- `build-site.mjs` — Markdown → HTML
- `ref/` — 規劃參考，不進入建置
