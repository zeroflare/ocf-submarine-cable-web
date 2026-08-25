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
  const end = document.getElementById('articles');
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

function init() {
  initNav();
  initScrollStory();
  initReducedMotion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
