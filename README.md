# resilience.ocf.tw

公開網站：[https://resilience.ocf.tw/](https://resilience.ocf.tw/)

本 repo 是 **GitHub Pages 上的網路韌性入口網**：根路徑為海纜敘事首頁與數位韌性報導；網站韌性檢測結果與研究報告則透過 submodule 掛在 `/web`。檢測、建置、研究報告的詳細說明請見下方連結的各上游專案。

---

## 本 repo 負責什麼

| 項目     | 說明                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 部署分支 | `gh-pages`（GitHub Pages）                                             |
| 自訂網域 | `CNAME` → `resilience.ocf.tw`                                         |
| 入口首頁 | `index.html`：海纜故事、報導導讀、工具入口；樣式與互動見 `assets/` |
| 報導頁   | `articles/`：獨立文章頁；首頁 modal 內容同步於 `index.html` 的 `<template>` |
| 靜態資源 | `assets/`、`data/`、`images/`（樣式／腳本、地圖 JSON、圖檔）       |
| 404      | `404.html`：將 `/web/...` 錯誤路徑轉為 `/web/?url=...` 查詢參數        |
| SEO      | `robots.txt` 指向入口網 `sitemap.xml` 與 `/web/sitemap.xml`；`_headers` 設定 Cloudflare Pages 快取 |
| 網站檢測 | submodule `web/`（來自 [web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) 的 `gh-pages` 分支） |

本 repo **不**執行檢測或靜態頁建置；`/web` 內容更新流程請見 [跨專案上線流程](#跨專案上線流程)。

---

## 對外 URL 結構

| URL                  | 內容                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `/`                  | 網路韌性入口首頁（海纜敘事、報導、工具入口）                      |
| `/articles/`         | 報導列表                                                          |
| `/articles/<slug>/`  | 單篇報導                                                          |
| `/sitemap.xml`       | 入口網 sitemap（首頁與報導）                                      |
| `/web/`              | 網站韌性檢測：網址搜尋、整體統計圖表                              |
| `/web/<domain>/`     | 單一網站檢測結果（靜態頁，約 1800+ 網域）                         |
| `/web/report/`       | 研究方法與彙整報告（來自 `web-resilience-test` 的 `report` 分支） |
| `/web/sitemap.xml`   | 檢測站 sitemap                                                    |

---

## Repo 與 submodule 結構

```
resilience.ocf.tw/          ← 本 repo（入口網 + Pages 殼層）
├── index.html, 404.html, CNAME, robots.txt, sitemap.xml, _headers, favicon.ico, favicon.svg
├── assets/                 ← styles.css、app.js、cover-map.js
├── data/                   ← 地圖／場景用 JSON
├── images/                 ← 首頁與文章用圖檔
├── articles/               ← 數位韌性報導
│   ├── index.html
│   └── <slug>/index.html
└── web/                    ← submodule: web-resilience-test-profile @ gh-pages
    ├── index.html, app.js, statistic.*.tsv, sitemap.xml, …
    ├── <domain>/index.html （各站靜態頁）
    └── report/             ← 嵌套 submodule: web-resilience-test @ report
```

| Submodule 名稱                | 路徑          | 來源 repo                                                                                 | 分支       |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------- | ---------- |
| `web-resilience-test-profile` | `web/`        | [irvin/web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) | `gh-pages` |
| `report`（嵌套於 `web/`）     | `web/report/` | [irvin/web-resilience-test](https://github.com/irvin/web-resilience-test)                 | `report`   |

---

## 跨專案上線流程

從「新增／更新一個網站」到「在 resilience.ocf.tw/web 看到頁面」的完整步驟，請直接閱讀：

- **[web-resilience-test-profile/add-new-sites.zh-TW.md](https://github.com/irvin/web-resilience-test-profile/blob/main/add-new-sites.zh-TW.md)**
- 英文版：[add-new-sites.md](https://github.com/irvin/web-resilience-test-profile/blob/main/add-new-sites.md)

---

## 本 repo 操作

上游已完成 `web-resilience-test-profile` 的 `npm run deploy` 後，在本 repo 執行：

```bash
git submodule update --remote web-resilience-test-profile
git add web
git commit -m "update web submodule"
git push
```

> submodule 名稱為 `web-resilience-test-profile`，實際目錄為 `web/`。

入口網（`index.html`、`articles/`、`assets/`、`data/`、`images/` 等）的變更則直接在本 repo 的 `dev` 分支開發，再開 PR 合併至 `gh-pages`。

發布後建議（詳見 [add-new-sites.zh-TW.md §5](https://github.com/irvin/web-resilience-test-profile/blob/main/add-new-sites.zh-TW.md)）：

- 確認 [GitHub Actions workflow](https://github.com/ocftw/resilience.ocf.tw/actions/workflows/gh-pages.yml) 已完成
- 依 [TESTING.zh-TW.md](https://github.com/irvin/web-resilience-test-profile/blob/main/TESTING.zh-TW.md) 做回歸測試（含 §3-2 的 `404.html` 行為）
- 若使用 Cloudflare，部署後可手動 purge `resilience.ocf.tw` hostname（`_headers` 的 `s-maxage` 會讓 edge 留存較久）
- 使用者端網站清單可能因 `statistic.tsv` 在瀏覽器 localStorage 快取 **24 小時**而延遲更新（見上游文件 §5-3）

---

## 授權

本網站所呈現之檢測資料與衍生頁面，在 ISIF 研究專案期間（2026 年 12 月 31 日前）採用 [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)（姓名標示─非商業性─禁止改作 4.0 國際）。2026 年 12 月 31 日後將釋出至公有領域（Public Domain）。

作者為 Irvin Chen（Open Culture Foundation；ORCID：[https://orcid.org/0009-0002-1059-7130](https://orcid.org/0009-0002-1059-7130)），聯絡信箱為 irvin@ocf.tw（請 cc hi@ocf.tw）。

完整條款與建議署名格式請見 [LICENSE](LICENSE)。機器可讀引用資訊見 [`CITATION.cff`](CITATION.cff)。
