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
  title: '台灣數位生命線：海底電纜',
  description: '25 條通訊海纜，是臺灣對內對外的重要通訊管道，乘載了 99% 的網路流量',
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
      };
    })
    .sort((a, b) => a.order - b.order);
}

function renderCards(articles) {
  return articles
    .map((article) => {
      const draft = article.draft ? '<span class="draft-tag">撰寫中</span>' : '';
      return `<a class="article-card" href="./articles/${escapeHtml(article.slug)}/">
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

function injectHomeArticles(html, articles) {
  const cards = renderCards(articles);
  const next = html.replace(
    /<div class="articles-grid" data-from-markdown>[\s\S]*?<\/div>(?=\s*<\/section>)/,
    `<div class="articles-grid" data-from-markdown>${cards}</div>`,
  );
  if (next === html) {
    throw new Error('homepage articles-grid marker missing');
  }
  return next;
}

function siteHead({ title, description, canonical, draft, published, extra = '' }) {
  const robots = draft ? '<meta name="robots" content="noindex,follow" />\n  ' : '';
  const ogType = published ? 'article' : 'website';
  const publishedMeta = published
    ? `<meta property="article:published_time" content="${escapeHtml(published)}" />\n  `
    : '';
  return `<meta charset="UTF-8" />
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
  const htmlBody = relativizeHtml(marked.parse(article.body) ?? '', `articles/${article.slug}`);
  const draftNote = article.draft ? ' ／ 撰寫中' : '';
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
<body>
  <a class="skip-link" href="#main">跳到主要內容</a>
  ${navHtml('../../', 'articles')}
  <main id="main" class="article-page">
    <article class="article-wrap">
      <a class="back-home" href="../../#articles">← 回到首頁文章區</a>
      <p class="article-kicker">${padOrder(article.order)}　${escapeHtml(article.subtitle)}</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="article-desc">${escapeHtml(article.description)}</p>
      <p class="article-meta">${escapeHtml(dateLabel(article.pubDate))}${draftNote}</p>
      <div class="prose">
        ${htmlBody}
      </div>
    </article>
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
      return `<a class="article-card" href="./${escapeHtml(article.slug)}/">
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
    description: '從認知、韌性檢測、災害準備與公民觀測，看見台灣海纜與網路韌性。',
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
