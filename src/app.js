function initNav() {
  const nav = document.getElementById('site-nav');
  const btn = nav?.querySelector('.site-nav-toggle');
  const label = btn?.querySelector('.visually-hidden');
  if (!nav || !btn) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? '關閉選單' : '開啟選單';
  };

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  nav.querySelectorAll('.site-nav-links a[href*="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const url = new URL(link.href, location.href);
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target || url.pathname !== location.pathname) return;

      event.preventDefault();
      history.pushState(null, '', url.hash);
      target.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  });
}

function syncChrome() {
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

  window.addEventListener('scroll', syncChrome, { passive: true });
  window.addEventListener('resize', syncChrome);
  syncChrome();
}

function initReducedMotion() {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('#sea animate, #sea animateMotion, #sea animateTransform').forEach((el) => el.remove());
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

  function resetModalScroll() {
    dialog.scrollTop = 0;
    content.scrollTop = 0;
  }

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
    resetModalScroll();
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
    resetModalScroll();
    content.querySelector('h1')?.focus({ preventScroll: true });
    requestAnimationFrame(resetModalScroll);
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
    resetModalScroll();
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

function init() {
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
