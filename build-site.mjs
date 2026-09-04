import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC = path.join(ROOT, 'src');
const CONTENT = path.join(ROOT, 'content', 'articles');
const IMAGES = path.join(ROOT, 'content', 'images');
const DIST = path.join(ROOT, 'dist');

const SITE = {
  origin: (process.env.SITE_ORIGIN || 'https://ocftw.github.io').replace(/\/$/, ''),
  base: normalizeBase(process.env.SITE_BASE || '/'),
  title: '臺灣數位生命線：海底電纜',
  description: '26 條通訊海纜，是臺灣對內對外的重要通訊管道，乘載了 99% 的網路流量',
};

marked.setOptions({ gfm: true, breaks: false });

function normalizeBase(base) {
  if (!base || base === '/') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}/`;
}

function joinUrl(...parts) {
  return parts
    .join('/')
    .replace(/([^:]\/)\/+/g, '$1')
    .replace(/^(https?:\/)([^/])/, '$1/$2');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function padOrder(order) {
  return String(order).padStart(2, '0');
}

function dateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function relativizeHtml(html, fromDir) {
  return html.replace(/(href|src)="(\/[^"]*)"/g, (match, attr, abs) => {
    if (abs.startsWith('//')) return match;
    const target = abs.replace(/^\//, '');
    let rel = path.posix.relative(fromDir, target) || '.';
    if (!rel.startsWith('.')) rel = `./${rel}`;
    if (abs.endsWith('/') && !rel.endsWith('/')) rel += '/';
    return `${attr}="${rel}"`;
  });
}

function loadArticles() {
  if (!fs.existsSync(CONTENT)) return [];
  return fs
    .readdirSync(CONTENT)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const raw = fs.readFileSync(path.join(CONTENT, name), 'utf8');
      const parsed = matter(raw);
      const slug = name.replace(/\.md$/, '');
      const data = parsed.data ?? {};
      return {
        slug,
        title: String(data.title ?? slug),
        subtitle: String(data.subtitle ?? ''),
        description: String(data.description ?? ''),
        order: Number(data.order ?? 99),
        pubDate: data.pubDate ?? null,
        draft: Boolean(data.draft),
        body: parsed.content,
        quote: data.quote ? String(data.quote) : '',
        image: data.image ? String(data.image) : '',
        chart: data.chart ? String(data.chart) : '',
        chartTitle: data.chartTitle ? String(data.chartTitle) : '',
        images: extractImages(parsed.content),
      };
    })
    .sort((a, b) => a.order - b.order);
}

function extractImages(markdown) {
  const images = [];
  const pattern = /!\[[^\]]*\]\((\/images\/[^)]+)\)/g;
  let match;
  while ((match = pattern.exec(markdown))) images.push(match[1]);
  return images;
}

function homeSrc(absPath) {
  return `.${absPath}`;
}

function renderArticleVisual(article) {
  if (article.chart) {
    const src = article.chart.replace(/^flourish:/, '');
    const title = article.chartTitle || article.title;
    return `<div class="article-visual article-visual--chart"><iframe src="https://flo.uri.sh/${src}/embed" title="${escapeHtml(title)}" loading="lazy" allowfullscreen></iframe></div>`;
  }
  const sceneImages = article.image ? [article.image] : article.images;
  if (sceneImages.length >= 2) {
    const figs = sceneImages
      .map(
        (src, i) =>
          `<img src="${homeSrc(src)}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">`,
      )
      .join('');
    return `<div class="article-visual article-visual--grid" data-count="${sceneImages.length}">${figs}</div>`;
  }
  if (sceneImages.length === 1) {
    return `<div class="article-visual article-visual--photo"><img src="${homeSrc(sceneImages[0])}" alt=""></div>`;
  }
  const quote = article.quote || article.description;
  return `<div class="article-visual article-visual--quote"><p class="article-quote">${escapeHtml(quote)}</p></div>`;
}

function renderArticleScenes(articles) {
  return articles
    .map((article, index) => {
      const sceneId = index === 0 ? 'articles' : `article-${padOrder(article.order)}`;
      const draft = article.draft ? '<span class="draft-tag">撰寫中</span>' : '';
      return `<section class="scene" id="${sceneId}" data-scene="${sceneId}" style="--scene-vh: 100">
  <div class="scene-sticky">
    <div class="article-stage">
      ${renderArticleVisual(article)}
      <div class="article-visual-veil" aria-hidden="true"></div>
      <aside class="panel article-panel">
        <p class="panel-kicker">${padOrder(article.order)}　${escapeHtml(article.subtitle)}${draft}</p>
        <h2>${escapeHtml(article.title)}</h2>
        <div class="panel-rule"></div>
        <p>${escapeHtml(article.description)}</p>
        <a class="article-read" href="./articles/${escapeHtml(article.slug)}/" data-article="${escapeHtml(article.slug)}">閱讀全文 →</a>
      </aside>
    </div>
  </div>
</section>`;
    })
    .join('');
}

function renderArticleDots(articles) {
  return articles
    .map((article, index) => {
      const sceneId = index === 0 ? 'articles' : `article-${padOrder(article.order)}`;
      const label = escapeHtml(article.subtitle || article.title);
      return `<button type="button" data-target="${sceneId}" aria-label="${label}"><span class="nav-dot"></span><span class="nav-label">${label}</span></button>`;
    })
    .join('');
}
function embedFlourish(html) {
  return html.replace(
    /<div class="(flourish-embed[^"]*)" data-src="([^"]+)">[\s\S]*?<\/div>/g,
    (_, cls, src) =>
      `<div class="${cls}" data-src="${src}"><iframe src="https://flo.uri.sh/${src}/embed" title="互動圖表" loading="lazy" allowfullscreen></iframe></div>`,
  );
}

function articleBodyHtml(article, fromDir) {
  return embedFlourish(relativizeHtml(marked.parse(article.body) ?? '', fromDir));
}

function renderArticleInner(article, fromDir) {
  const draftNote = article.draft ? ' ／ 撰寫中' : '';
  return `<article class="article-wrap article-wrap--modal">
      <p class="article-kicker">${padOrder(article.order)}　${escapeHtml(article.subtitle)}</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="article-desc">${escapeHtml(article.description)}</p>
      <p class="article-meta">${escapeHtml(dateLabel(article.pubDate))}${draftNote}</p>
      <div class="prose">
        ${articleBodyHtml(article, fromDir)}
      </div>
    </article>`;
}

function renderCards(articles, hrefPrefix = './articles/') {
  return articles
    .map((article) => {
      const draft = article.draft ? '<span class="draft-tag">撰寫中</span>' : '';
      return `<a class="article-card" href="${hrefPrefix}${escapeHtml(article.slug)}/" data-article="${escapeHtml(article.slug)}">
              <div class="card-top">
                <span class="card-num">${padOrder(article.order)}</span>
                ${draft}
              </div>
              <h3>${escapeHtml(article.title)}</h3>
              <p class="article-card-sub">${escapeHtml(article.subtitle)}</p>
              <span class="card-arrow">→</span>
            </a>`;
    })
    .join('');
}

function renderArticleTemplates(articles) {
  return articles
    .map(
      (article) =>
        `<template data-article="${escapeHtml(article.slug)}">${renderArticleInner(article, '.')}</template>`,
    )
    .join('');
}

function injectHomeArticles(html, articles) {
  const scenes = renderArticleScenes(articles);
  let next = html.replace(/<div data-article-scenes><\/div>/, scenes);
  if (next === html) {
    throw new Error('homepage article-scenes marker missing');
  }
  const withDots = next.replace('<!--article-dots-->', renderArticleDots(articles));
  if (withDots === next) {
    throw new Error('homepage article-dots marker missing');
  }
  next = withDots;
  const withTemplates = next.replace(
    /<div id="article-templates"[^>]*>[\s\S]*?<\/div>/,
    `<div id="article-templates" hidden>${renderArticleTemplates(articles)}</div>`,
  );
  if (withTemplates === next) {
    throw new Error('homepage article-templates marker missing');
  }
  return withTemplates;
}

const CLOSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L10.94 12l-5.72 5.72a.75.75 0 1 0 1.06 1.06L12 13.06l5.72 5.72a.75.75 0 1 0 1.06-1.06L13.06 12l5.72-5.72a.75.75 0 0 0-1.06-1.06L12 10.94 6.28 5.22Z"/></svg>`;

function siteHead({ title, description, canonical, draft, published, extra = '' }) {
  const robots = draft ? '<meta name="robots" content="noindex,follow" />\n  ' : '';
  const ogType = published ? 'article' : 'website';
  const publishedMeta = published
    ? `<meta property="article:published_time" content="${escapeHtml(published)}" />\n  `
    : '';
  return `<script>(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  ${robots}<link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  ${publishedMeta}<link rel="icon" href="__ASSET__/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="__ASSET__/styles.css" />
  ${extra}`;
}

function navHtml(homeHref, active = '') {
  const item = (href, key, label, extra = '') => {
    const on = key === active;
    const current = on ? ' class="is-active" aria-current="page"' : '';
    return `<a href="${href}" data-nav="${key}"${current}> ${label} ${extra}</a>`;
  };
  return `<header class="site-nav" id="site-nav">
    <a class="site-nav-brand" href="${homeHref}">海纜韌性觀測站</a>
    <button class="theme-toggle" type="button" aria-label="切換成深色模式" aria-pressed="false">
      <svg class="theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.53 1.72a.75.75 0 0 1 .16.82A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.46-.69.75.75 0 0 1 .98.98A10.5 10.5 0 0 1 12.75 22C6.95 22 2.25 17.3 2.25 11.5c0-4.37 2.67-8.11 6.46-9.69a.75.75 0 0 1 .82.16Z"/></svg>
      <svg class="theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0-5.25a1 1 0 0 1 1 1V5.5a1 1 0 1 1-2 0V3.25a1 1 0 0 1 1-1Zm0 15.5a1 1 0 0 1 1 1v2.25a1 1 0 1 1-2 0V18.75a1 1 0 0 1 1-1ZM3.25 12a1 1 0 0 1 1-1H6.5a1 1 0 1 1 0 2H4.25a1 1 0 0 1-1-1Zm15.5 0a1 1 0 0 1 1-1h2.25a1 1 0 1 1 0 2H19.75a1 1 0 0 1-1-1ZM5.64 5.64a1 1 0 0 1 1.41 0l1.6 1.6a1 1 0 0 1-1.42 1.41l-1.59-1.59a1 1 0 0 1 0-1.42Zm9.9 9.9a1 1 0 0 1 1.42 0l1.59 1.6a1 1 0 0 1-1.41 1.41l-1.6-1.59a1 1 0 0 1 0-1.42ZM18.36 5.64a1 1 0 0 1 0 1.41l-1.6 1.6a1 1 0 1 1-1.41-1.42l1.59-1.59a1 1 0 0 1 1.42 0ZM8.46 15.54a1 1 0 0 1 0 1.42l-1.6 1.59a1 1 0 0 1-1.41-1.41l1.59-1.6a1 1 0 0 1 1.42 0Z"/></svg>
    </button>
    <button class="site-nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav-menu">
      <span class="visually-hidden">開啟選單</span>
      <span class="site-nav-burger" aria-hidden="true"></span>
    </button>
    <nav id="site-nav-menu" class="site-nav-links" aria-label="主要">
      ${item(`${homeHref}#intro`, 'intro', '海底電纜是什麼')}
      ${item(`${homeHref}#articles`, 'articles', '數位韌性準備')}
      ${item(`${homeHref}#portals`, 'portals', '更多海纜知識入口')}
    </nav>
  </header>`;
}

function renderArticlePage(article) {
  const pageTitle = `${article.title} — ${SITE.title}`;
  const canonical = joinUrl(SITE.origin, SITE.base, `articles/${article.slug}/`);
  const published = isoDate(article.pubDate);
  const head = siteHead({
    title: pageTitle,
    description: article.description || SITE.description,
    canonical,
    draft: article.draft,
    published,
  }).replaceAll('__ASSET__', '../..');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  ${head}
</head>
<body class="article-standalone" data-home="../../">
  <a class="skip-link" href="#main">跳到主要內容</a>
  ${navHtml('../../', 'articles')}
  <main id="main" class="article-modal-page">
    <a class="article-modal-page-backdrop" href="../../#articles" tabindex="-1" aria-label="關閉文章"></a>
    <div class="article-dialog article-dialog--page">
      <div class="article-dialog-bar">
        <a class="article-dialog-close" href="../../#articles" aria-label="關閉文章">${CLOSE_ICON}</a>
      </div>
      <div class="article-dialog-scroll">
        ${renderArticleInner(article, `articles/${article.slug}`)}
      </div>
    </div>
  </main>
  <script src="../../app.js"></script>
</body>
</html>
`;
}

function renderArticleIndex(articles) {
  const canonical = joinUrl(SITE.origin, SITE.base, 'articles/');
  const cards = articles
    .map((article) => {
      const draft = article.draft ? '<span class="draft-tag">撰寫中</span>' : '';
      return `<a class="article-card" href="../#article/${escapeHtml(article.slug)}" data-article="${escapeHtml(article.slug)}">
              <div class="card-top">
                <span class="card-num">${padOrder(article.order)}</span>
                ${draft}
              </div>
              <h3>${escapeHtml(article.title)}</h3>
              <p class="article-card-sub">${escapeHtml(article.subtitle)}</p>
              <span class="card-arrow">→</span>
            </a>`;
    })
    .join('');
  const head = siteHead({
    title: `文章 — ${SITE.title}`,
    description: '從認知、韌性檢測、災害準備與公民觀測，看見臺灣海纜與網路韌性。',
    canonical,
  }).replaceAll('__ASSET__', '..');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  ${head}
</head>
<body>
  <a class="skip-link" href="#main">跳到主要內容</a>
  ${navHtml('../', 'articles')}
  <main id="main" class="article-page">
    <div class="article-list">
      <a class="back-home" href="../">← 回到首頁</a>
      <h1>我們應該如何準備網路韌性風險？</h1>
      <div class="articles-grid">${cards}</div>
    </div>
  </main>
  <script src="../app.js"></script>
</body>
</html>
`;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

export function buildSite() {
  const articles = loadArticles();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyDir(SRC, DIST);
  copyDir(IMAGES, path.join(DIST, 'images'));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  const homePath = path.join(DIST, 'index.html');
  const home = fs.readFileSync(homePath, 'utf8');
  const compiledHome = injectHomeArticles(home, articles);
  if (compiledHome === home) {
    throw new Error('homepage articles-grid not found');
  }
  const homeCanonical = joinUrl(SITE.origin, SITE.base);
  const homeWithSeo = compiledHome.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(SITE.description)}" />
  <link rel="canonical" href="${escapeHtml(homeCanonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:title" content="${escapeHtml(SITE.title)}" />
  <meta property="og:description" content="${escapeHtml(SITE.description)}" />
  <meta property="og:url" content="${escapeHtml(homeCanonical)}" />`,
  );
  fs.writeFileSync(homePath, homeWithSeo);

  fs.mkdirSync(path.join(DIST, 'articles'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'articles', 'index.html'), renderArticleIndex(articles));
  for (const article of articles) {
    const dir = path.join(DIST, 'articles', article.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderArticlePage(article));
  }

  return { articles: articles.length, dist: DIST };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = buildSite();
  console.log(`built ${result.articles} articles → dist/`);
}
