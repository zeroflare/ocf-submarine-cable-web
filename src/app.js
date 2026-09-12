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

function initSignalJourney() {
  const intro = document.getElementById('intro');
  const introStage = intro?.querySelector('.intro-stage');
  const introSvg = introStage?.querySelector('.intro-svg');
  const phone = introSvg?.querySelector('#iphone');
  const phoneScreen = phone?.querySelector('.intro-phone-screen');
  const baseStation = introSvg?.querySelector('#basestation');
  const introPanel = introStage?.querySelector(':scope > .panel');
  const journeyIntro = document.getElementById('journey-intro');
  const journey = document.getElementById('journey');
  const journeyPanel = journeyIntro?.querySelector('.journey-intro-panel');
  const journeySvg = journey?.querySelector('.journey-svg');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!intro || !introStage || !introSvg || !phone || !phoneScreen || !baseStation || !introPanel || !journeyPanel || !journeySvg) return;

  intro.style.setProperty('--scene-vh', '560');
  intro.classList.add('signal-journey');
  journeyIntro.classList.add('is-merged-journey-source');
  journey.classList.add('is-merged-journey-source');
  introPanel.classList.add('signal-panel', 'signal-panel--intro');
  journeyPanel.classList.add('signal-panel', 'signal-panel--journey');
  introStage.appendChild(journeyPanel);

  journeySvg.setAttribute('viewBox', '0 0 1440 860');
  journeySvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  journeySvg.classList.add('signal-journey-landscape');
  journeySvg.innerHTML = `
    <defs>
      <linearGradient id="journey-long-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--illus-sky-2)"></stop>
        <stop offset="100%" stop-color="var(--bg-stage)"></stop>
      </linearGradient>
      <linearGradient id="journey-long-sea" gradientUnits="userSpaceOnUse" x1="0" y1="690" x2="0" y2="860">
        <stop offset="0%" stop-color="var(--illus-sea-1)"></stop>
        <stop offset="100%" stop-color="var(--illus-sea-2)"></stop>
      </linearGradient>
      <linearGradient id="journey-long-depth" gradientUnits="userSpaceOnUse" x1="0" y1="690" x2="0" y2="840">
        <stop offset="0%" stop-color="var(--illus-sea-1)" stop-opacity="0.78"></stop>
        <stop offset="100%" stop-color="var(--illus-sea-2)" stop-opacity="0.94"></stop>
      </linearGradient>
      <filter id="journey-long-glow" x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="blur"></feGaussianBlur>
        <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
      </filter>
    </defs>
    <rect x="0" y="0" width="1440" height="860" fill="url(#journey-long-sky)"></rect>
    <g class="journey-world">
      <path d="M-700 690 H3700 V920 H-700 Z" fill="url(#journey-long-sea)"></path>
      <g class="journey-cable-landscape">
      <path d="M-700 690 H985 C1125 705 1450 830 1822 830 C2195 830 2520 705 2660 690 H3700 V920 H-700 Z" fill="url(#journey-long-sea)"></path>
      <path d="M985 690 C1125 705 1450 830 1822 830 C2195 830 2520 705 2660 690 Z" fill="url(#journey-long-depth)"></path>
      <path d="M-700 690 H985 C1125 705 1450 830 1822 830 C2195 830 2520 705 2660 690 H3700" fill="none" stroke="var(--illus-line)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M925 674 H985 C1125 690 1450 814 1822 814 C2195 814 2520 690 2660 674 H2720" fill="none" stroke="var(--warning)" stroke-width="10" stroke-linecap="round" opacity="0.3" filter="url(#journey-long-glow)"></path>
      <path d="M925 674 H985 C1125 690 1450 814 1822 814 C2195 814 2520 690 2660 674 H2720" fill="none" stroke="var(--warning)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path class="signal-flow" d="M925 674 H985 C1125 690 1450 814 1822 814 C2195 814 2520 690 2660 674 H2720 L3100 674" fill="none" stroke="var(--cyan)" stroke-width="2.4" stroke-dasharray="10 8" stroke-linecap="round"></path>
      <g fill="var(--illus-ink)" opacity="0.24">
        <ellipse cx="2720" cy="708" rx="70" ry="22"></ellipse>
        <ellipse cx="3100" cy="708" rx="84" ry="22"></ellipse>
      </g>
      <text x="1822" y="770" text-anchor="middle" fill="var(--text-dark)" font-size="22" font-weight="700">海纜</text>
      <image href="./journey-landing-station.png" x="2654" y="588" width="132" height="132" preserveAspectRatio="xMidYMax meet"></image>
      <text x="2720" y="752" text-anchor="middle" fill="var(--text-mid)" font-size="13" font-weight="600">海外海纜登陸站</text>
      <image href="./journey-overseas-server.png" x="3008" y="536" width="184" height="222" preserveAspectRatio="xMidYMax meet"></image>
      <text x="3100" y="752" text-anchor="middle" fill="var(--text-mid)" font-size="13" font-weight="600">海外伺服器</text>
      <text x="780" y="790" text-anchor="middle" fill="var(--text-dark)" font-size="28" font-weight="700" opacity="0.88">台灣</text>
      <text x="2920" y="790" text-anchor="middle" fill="var(--text-dark)" font-size="28" font-weight="700" opacity="0.88">國外</text>
      </g>
      <g class="journey-first-station">
        <ellipse cx="921" cy="708" rx="70" ry="22" fill="var(--illus-ink)" opacity="0.24"></ellipse>
        <image href="./journey-landing-station.png" x="859" y="588" width="132" height="132" preserveAspectRatio="xMidYMax meet"></image>
        <text x="925" y="752" text-anchor="middle" fill="var(--text-mid)" font-size="13" font-weight="600">台灣海纜登陸站</text>
      </g>
    </g>`;
  introStage.prepend(journeySvg);
  introSvg.classList.add('signal-journey-foreground');
  introSvg.querySelector(':scope > rect')?.classList.add('intro-background');
  introSvg.querySelector('.intro-background').style.opacity = '0';
  baseStation.querySelectorAll('.signal-flow, circle').forEach((element) => element.setAttribute('display', 'none'));

  const phoneOuter = phone.querySelector(':scope > rect:first-child');
  phoneOuter?.setAttribute('x', '622');
  phoneOuter?.setAttribute('y', '200');
  phoneOuter?.setAttribute('width', '276');
  phoneOuter?.setAttribute('height', '600');
  phoneOuter?.setAttribute('rx', '44');
  phoneScreen.setAttribute('x', '633');
  phoneScreen.setAttribute('y', '211');
  phoneScreen.setAttribute('width', '254');
  phoneScreen.setAttribute('height', '578');
  phoneScreen.setAttribute('rx', '35');
  Array.from(phone.children).slice(2).forEach((element) => element.setAttribute('display', 'none'));
  const screenshotClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  screenshotClip.id = 'intro-phone-screenshot-clip';
  const screenshotClipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  screenshotClipRect.setAttribute('x', '633');
  screenshotClipRect.setAttribute('y', '211');
  screenshotClipRect.setAttribute('width', '254');
  screenshotClipRect.setAttribute('height', '578');
  screenshotClipRect.setAttribute('rx', '35');
  screenshotClip.appendChild(screenshotClipRect);
  introSvg.querySelector('defs')?.appendChild(screenshotClip);
  const screenshot = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  screenshot.setAttribute('href', './mobile_screenshot.png');
  screenshot.setAttribute('x', '633');
  screenshot.setAttribute('y', '211');
  screenshot.setAttribute('width', '254');
  screenshot.setAttribute('height', '578');
  screenshot.setAttribute('preserveAspectRatio', 'xMidYMin meet');
  screenshot.setAttribute('clip-path', 'url(#intro-phone-screenshot-clip)');
  phone.appendChild(screenshot);

  const pairConnector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pairConnector.classList.add('signal-flow', 'phone-base-connector');
  pairConnector.setAttribute('d', 'M760 450 C850 450 940 438 1022 430');
  pairConnector.setAttribute('fill', 'none');
  pairConnector.setAttribute('stroke', 'var(--cyan)');
  pairConnector.setAttribute('stroke-width', '2.4');
  pairConnector.setAttribute('stroke-dasharray', '10 8');
  pairConnector.setAttribute('stroke-linecap', 'round');

  const pair = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pair.id = 'phone-base-pair';
  introSvg.insertBefore(pair, phone);
  pair.append(pairConnector, phone, baseStation);

  const chainConnector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chainConnector.classList.add('signal-flow', 'station-outbound-flow');
  chainConnector.setAttribute('fill', 'none');
  chainConnector.setAttribute('stroke', 'var(--cyan)');
  chainConnector.setAttribute('stroke-width', '2.4');
  chainConnector.setAttribute('stroke-dasharray', '10 8');
  chainConnector.setAttribute('stroke-linecap', 'round');
  const journeyWorld = journeySvg.querySelector('.journey-world');
  const journeyCableLandscape = journeyWorld?.querySelector('.journey-cable-landscape');
  journeyWorld?.insertBefore(chainConnector, journeyCableLandscape || null);

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const range = (value, start, end) => clamp01((value - start) / (end - start));
  const mix = (from, to, progress) => from + (to - from) * progress;
  const journeyVerticalOffset = -72;
  let raf = 0;

  const render = () => {
    raf = 0;
    const rect = intro.getBoundingClientRect();
    const travel = Math.max(1, intro.offsetHeight - window.innerHeight);
    const progress = reduceMotion.matches ? 1 : clamp01(-rect.top / travel);
    const pairMove = smooth(range(progress, 0.08, 0.28));
    const phoneFade = smooth(range(progress, 0.2, 0.29));
    const panelSwap = smooth(range(progress, 0.24, 0.36));
    const firstStationVisible = smooth(range(progress, 0.24, 0.34));
    const landscapeReveal = smooth(range(progress, 0.24, 0.34));
    const cameraMove = smooth(range(progress, 0.28, 0.92));
    const isSmallScreen = window.innerWidth <= 800;
    const pairScale = mix(1, 0.5, pairMove);
    const pairX = mix(0, -500, pairMove);
    const firstStationScale = pairScale * 2;
    const firstStationX = mix(1425, 925, pairMove);
    const camera = mix(0, isSmallScreen ? 2060 : 1850, cameraMove);
    const phoneOpacity = 1 - phoneFade;
    const transformPointX = (x) => 950 + (x - 950) * pairScale + pairX;
    const transformPointY = (y) => 690 + (y - 690) * pairScale;
    const baseFlowStartX = transformPointX(1220);
    const baseFlowStartY = transformPointY(638);
    const landingFlowEndX = firstStationX;
    const landingFlowEndY = 690 + (674 - 690) * firstStationScale;
    const connectorSpan = landingFlowEndX - baseFlowStartX;

    introStage.style.setProperty('--signal-canvas-width', `${(isSmallScreen ? mix(900, 600, pairMove) : window.innerWidth).toFixed(1)}px`);
    introSvg.setAttribute('preserveAspectRatio', isSmallScreen ? 'xMidYMid meet' : 'xMidYMid slice');
    journeySvg.setAttribute('preserveAspectRatio', isSmallScreen ? 'xMidYMid meet' : 'xMidYMid slice');
    pair.setAttribute('transform', `translate(${pairX.toFixed(1)} ${journeyVerticalOffset}) translate(950 690) scale(${pairScale.toFixed(3)}) translate(-950 -690)`);
    phone.style.opacity = phoneOpacity.toFixed(3);
    pairConnector.style.opacity = phoneOpacity.toFixed(3);
    baseStation.setAttribute('transform', `translate(${(-camera / pairScale).toFixed(1)} 0)`);
    journeySvg.querySelector('.journey-world')?.setAttribute('transform', `translate(${-camera.toFixed(1)} ${journeyVerticalOffset})`);
    journeySvg.querySelector('.journey-cable-landscape')?.style.setProperty('opacity', landscapeReveal.toFixed(3));
    const firstStation = journeySvg.querySelector('.journey-first-station');
    firstStation?.setAttribute('transform', `translate(${(firstStationX - 925).toFixed(1)} 0) translate(925 690) scale(${firstStationScale.toFixed(3)}) translate(-925 -690)`);
    firstStation?.style.setProperty('opacity', String(firstStationVisible));
    introPanel.style.opacity = (1 - panelSwap).toFixed(3);
    introPanel.setAttribute('aria-hidden', String(panelSwap > 0.5));
    journeyPanel.style.opacity = panelSwap.toFixed(3);
    journeyPanel.setAttribute('aria-hidden', String(panelSwap <= 0.5));
    journeySvg.style.opacity = '1';
    chainConnector.setAttribute('d', `M${baseFlowStartX.toFixed(1)} ${baseFlowStartY.toFixed(1)} C${(baseFlowStartX + connectorSpan * 0.35).toFixed(1)} ${baseFlowStartY.toFixed(1)}, ${(baseFlowStartX + connectorSpan * 0.72).toFixed(1)} ${landingFlowEndY.toFixed(1)}, ${landingFlowEndX.toFixed(1)} ${landingFlowEndY.toFixed(1)}`);
    chainConnector.style.opacity = landingFlowEndX - camera > -40 && baseFlowStartX - camera < 1480 ? '1' : '0';
    intro.dataset.signalPhase = progress < 0.08
      ? 'phone'
      : progress < 0.29
        ? 'pair-exit'
        : progress < 0.92
          ? 'journey'
          : 'complete';
  };

  const requestRender = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  render();
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender);
  reduceMotion.addEventListener?.('change', requestRender);
}

function initSeaHazardStory() {
  const scene = document.getElementById('sea');
  const viewport = scene?.querySelector('.sea-hazard-viewport');
  const track = viewport?.querySelector('.sea-hazard-grid');
  const slides = track ? Array.from(track.querySelectorAll('.sea-hazard-slide')) : [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!scene || !viewport || !track || slides.length !== 3) return;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const range = (value, start, end) => clamp01((value - start) / (end - start));
  let raf = 0;

  const render = () => {
    raf = 0;
    const rect = scene.getBoundingClientRect();
    const travel = Math.max(1, scene.offsetHeight - window.innerHeight);
    const progress = clamp01(-rect.top / travel);
    const slideProgress = reduceMotion.matches
      ? Math.round(progress * 2)
      : range(progress, 0.08, 0.86) * 2;
    const viewportWidth = viewport.clientWidth;
    const x = -slideProgress * viewportWidth;

    track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    scene.dataset.seaPhase = slideProgress < 0.5
      ? 'trawl'
      : slideProgress < 1.5
        ? 'anchor'
        : 'dredging';

    const activeIndex = Math.min(2, Math.max(0, Math.round(slideProgress)));
    slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', String(index !== activeIndex));
    });
  };

  const requestRender = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  render();
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender);
  reduceMotion.addEventListener?.('change', requestRender);
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
  initSignalJourney();
  initSeaHazardStory();
  initScrollStory();
  initReducedMotion();
  initArticleModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
