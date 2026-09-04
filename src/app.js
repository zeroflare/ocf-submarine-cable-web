function initNav() {
  const nav = document.getElementById('site-nav');
  const btn = nav?.querySelector('.site-nav-toggle');
  const label = btn?.querySelector('.visually-hidden');
  if (!nav || !btn) return;

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? '關閉選單' : '開啟選單';
  };

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
}

function syncChrome() {
  const sections = [...document.querySelectorAll('.scene[data-scene]')];
  const cover = document.getElementById('cover');
  const end = document.getElementById('portals');
  const onCover = cover ? cover.getBoundingClientRect().bottom > window.innerHeight * 0.55 : false;
  const pastStory = end ? end.getBoundingClientRect().top < window.innerHeight * 0.85 : false;
  const dots = document.querySelector('.nav-dots');
  const index = document.querySelector('.scene-index');
  const showStoryChrome = !onCover && !pastStory;
  dots?.classList.toggle('is-visible', showStoryChrome);
  index?.classList.toggle('is-visible', showStoryChrome);

  let activeId = null;
  let best = -1;
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    const visible =
      Math.min(window.innerHeight, Math.max(0, window.innerHeight - rect.top)) -
      Math.max(0, window.innerHeight - rect.bottom);
    if (visible > best && rect.top < window.innerHeight && rect.bottom > 0) {
      best = visible;
      activeId = section.dataset.scene ?? null;
    }
  }
  if (pastStory) activeId = null;

  document.querySelectorAll('.nav-dots [data-target]').forEach((btn, i) => {
    const on = btn.dataset.target === activeId;
    btn.classList.toggle('on', on);
    if (on) {
      const numEl = document.querySelector('[data-scene-index]');
      const nameEl = document.querySelector('[data-scene-name]');
      if (numEl) numEl.textContent = String(i + 1).padStart(2, '0');
      if (nameEl) nameEl.textContent = btn.querySelector('.nav-label')?.textContent ?? '';
    }
  });

  const articles = document.getElementById('articles');
  const portals = document.getElementById('portals');
  let navKey = 'intro';
  if (portals && portals.getBoundingClientRect().top < window.innerHeight * 0.42) navKey = 'portals';
  else if (articles && articles.getBoundingClientRect().top < window.innerHeight * 0.42) navKey = 'articles';
  document.querySelectorAll('.site-nav-links [data-nav]').forEach((link) => {
    const on = link.dataset.nav === navKey;
    link.classList.toggle('is-active', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initScrollStory() {
  if (!document.querySelector('.scene[data-scene]')) return;

  document.querySelectorAll('.nav-dots [data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.target ?? '')?.scrollIntoView({ behavior: 'auto' });
    });
  });

  window.addEventListener('scroll', syncChrome, { passive: true });
  window.addEventListener('resize', syncChrome);
  syncChrome();
}

function initReducedMotion() {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('#sea animate, #sea animateTransform').forEach((el) => el.remove());
}

function articleSlugFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, location.href);
    const hash = url.hash.match(/^#article\/([^/?#]+)/);
    if (hash) return decodeURIComponent(hash[1]);
    const path = url.pathname.match(/\/articles\/([^/]+)\/?$/);
    if (path) return decodeURIComponent(path[1]);
  } catch {
    /* ignore */
  }
  return null;
}

function initStandaloneArticle() {
  if (!document.body.classList.contains('article-standalone')) return;
  const home = document.body.dataset.home || '../';
  const goHome = () => {
    location.href = `${home}#articles`;
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      goHome();
    }
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank') return;
    const slug = articleSlugFromHref(link.getAttribute('href'));
    if (!slug) return;
    event.preventDefault();
    location.href = `${home}#article/${slug}`;
  });
}

function initArticleModal() {
  const dialog = document.getElementById('article-modal');
  const content = document.getElementById('article-modal-content');
  const templatesRoot = document.getElementById('article-templates');
  if (!dialog || !content || !templatesRoot) {
    initStandaloneArticle();
    return;
  }

  const templates = new Map();
  templatesRoot.querySelectorAll('template[data-article]').forEach((tpl) => {
    templates.set(tpl.dataset.article, tpl);
  });

  let lastFocus = null;
  let scrollY = 0;
  let sessionPushed = false;

  const articleUrl = (slug) => `${location.pathname}${location.search}#article/${slug}`;
  const currentSlug = () => {
    const match = location.hash.match(/^#article\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  function fill(slug) {
    const tpl = templates.get(slug);
    if (!tpl) return false;
    content.replaceChildren(tpl.content.cloneNode(true));
    const title = content.querySelector('h1');
    if (title) {
      title.id = 'article-modal-title';
      title.tabIndex = -1;
      dialog.setAttribute('aria-labelledby', 'article-modal-title');
    }
    content.scrollTop = 0;
    return true;
  }

  function openArticle(slug, reason) {
    if (!fill(slug)) {
      location.href = `./articles/${slug}/`;
      return;
    }
    const wasOpen = dialog.open;
    if (!wasOpen) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      scrollY = window.scrollY;
      document.getElementById('site-nav')?.classList.remove('is-open');
      dialog.showModal();
      document.documentElement.classList.add('is-modal-open');
    }
    content.querySelector('h1')?.focus({ preventScroll: true });
    if (reason === 'click') {
      const url = articleUrl(slug);
      if (wasOpen) history.replaceState({ article: slug }, '', url);
      else {
        history.pushState({ article: slug }, '', url);
        sessionPushed = true;
      }
    } else if (reason === 'boot') {
      history.replaceState({ article: slug }, '', articleUrl(slug));
      sessionPushed = false;
    }
  }

  function reallyClose() {
    if (dialog.open) dialog.close();
  }

  function requestClose() {
    if (sessionPushed) {
      sessionPushed = false;
      history.back();
      return;
    }
    if (currentSlug()) {
      history.replaceState({}, '', `${location.pathname}${location.search}#articles`);
    }
    reallyClose();
    document.getElementById('articles')?.scrollIntoView({ block: 'start' });
  }

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('is-modal-open');
    content.replaceChildren();
    lastFocus?.focus?.();
    window.scrollTo(0, scrollY);
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose();
  });

  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) requestClose();
  });

  dialog.querySelector('[data-article-close]')?.addEventListener('click', requestClose);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank') return;
    const slug = link.dataset.article || articleSlugFromHref(link.getAttribute('href'));
    if (!slug || !templates.has(slug)) return;
    event.preventDefault();
    openArticle(slug, 'click');
  });

  window.addEventListener('popstate', () => {
    const slug = currentSlug();
    if (slug && templates.has(slug)) {
      sessionPushed = false;
      openArticle(slug, 'pop');
      return;
    }
    sessionPushed = false;
    if (dialog.open) reallyClose();
  });

  const initial = currentSlug();
  if (initial && templates.has(initial)) openArticle(initial, 'boot');
}

const THEME_KEY = 'theme';

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function syncThemeToggle() {
  const dark = currentTheme() === 'dark';
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? '切換成淺色模式' : '切換成深色模式');
  });
}

function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }
  syncThemeToggle();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function initTheme() {
  syncThemeToggle();
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    try {
      if (localStorage.getItem(THEME_KEY)) return;
    } catch {
      /* ignore */
    }
    applyTheme(event.matches ? 'dark' : 'light', false);
  });
}

function init() {
  initTheme();
  initNav();
  initScrollStory();
  initReducedMotion();
  initArticleModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
