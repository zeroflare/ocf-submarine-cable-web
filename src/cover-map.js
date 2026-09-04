const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function mapStyleUrl() {
  return document.documentElement.dataset.theme === 'dark' ? STYLE_DARK : STYLE_LIGHT;
}

function onThemeChange(fn) {
  window.addEventListener('themechange', fn);
}

const CABLE_COLOR = '#7ebfd4';
const GOLD_CABLE = '#e8b84a';
const DEFAULT = { lng: 125.57498, lat: 23.70176, z: 6 };

function coverCableColor() {
  return CABLE_COLOR;
}

function restyleBaseMap(map) {
  try {
    const inlandWater = ['lake', 'pond', 'reservoir', 'basin', 'river', 'canal', 'ditch', 'stream', 'drain', 'swamp', 'wetland'];
    for (const layer of map.getStyle().layers ?? []) {
      const id = layer.id;
      const hide =
        layer.type === 'symbol' ||
        id === 'boundary_county' ||
        id === 'boundary_state' ||
        id === 'waterway' ||
        id.startsWith('road_') ||
        id.startsWith('tunnel_') ||
        id.startsWith('bridge_') ||
        id.startsWith('rail') ||
        id.startsWith('aeroway');
      if (hide) {
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
    const oceanOnly = ['all', ['==', '$type', 'Polygon'], ['!', ['in', 'class', ...inlandWater]]];
    if (map.getLayer('water')) map.setFilter('water', oceanOnly);
    if (map.getLayer('water_shadow')) map.setFilter('water_shadow', oceanOnly);
  } catch {
    /* Positron / Dark Matter 圖層名稱不完全相同 */
  }
}

let cablesCache = null;
const breathingMaps = new WeakSet();

async function loadCablesData() {
  if (!cablesCache) {
    cablesCache = await fetch('./cables.json').then((res) => res.json());
  }
  return cablesCache;
}

function applyMapStyle(map, onReady) {
  map.setStyle(mapStyleUrl(), {
    diff: false,
    transformStyle: (prev, next) => {
      if (!prev) return next;
      const sources = { ...next.sources };
      const layers = [...next.layers];
      if (prev.sources?.cables) sources.cables = prev.sources.cables;
      for (const layer of prev.layers ?? []) {
        if (layer.id === 'cables-glow' || layer.id === 'cables-line') layers.push(layer);
      }
      return { ...next, sources, layers };
    },
  });
  map.once('style.load', onReady);
}

function cableLayers(color) {
  const gold = color === GOLD_CABLE;
  return [
    {
      id: 'cables-glow',
      type: 'line',
      source: 'cables',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, gold ? 3.2 : 2.2, 7, gold ? 4.4 : 3.6, 10, gold ? 6 : 5],
        'line-opacity': gold ? 0.22 : 0.12,
        'line-blur': 1.2,
        'line-opacity-transition': { duration: 0 },
        'line-blur-transition': { duration: 0 },
      },
    },
    {
      id: 'cables-line',
      type: 'line',
      source: 'cables',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, gold ? 1.4 : 0.9, 7, gold ? 2.2 : 1.6, 10, gold ? 3 : 2.4],
        'line-opacity': gold ? 0.88 : 0.4,
        'line-opacity-transition': { duration: 0 },
      },
    },
  ];
}

async function addCables(map, { breathe = true, root, color = CABLE_COLOR } = {}) {
  const data = await loadCablesData();
  if (!map.getSource('cables')) {
    map.addSource('cables', { type: 'geojson', data });
  }
  for (const layer of cableLayers(color)) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
    else map.setPaintProperty(layer.id, 'line-color', color);
  }
  if (breathe && !breathingMaps.has(map)) {
    breathingMaps.add(map);
    breatheCables(map, root, color === GOLD_CABLE ? { line: [0.62, 1], glow: [0.16, 0.4] } : undefined);
  }
}

function breatheCables(map, root = document.getElementById('cover'), ranges) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const period = 3200;
  const line = ranges?.line ?? [0.22, 0.78];
  const glow = ranges?.glow ?? [0.06, 0.36];
  let visible = true;
  let raf = 0;

  const lerp = (range, t) => range[0] + (range[1] - range[0]) * t;

  const tick = (now) => {
    if (!visible) {
      raf = 0;
      return;
    }
    try {
      if (map.isStyleLoaded() && map.getLayer('cables-line') && map.getLayer('cables-glow')) {
        const t = (1 - Math.cos(((now % period) / period) * Math.PI * 2)) / 2;
        map.setPaintProperty('cables-line', 'line-opacity', lerp(line, t));
        map.setPaintProperty('cables-glow', 'line-opacity', lerp(glow, t));
        map.setPaintProperty('cables-glow', 'line-blur', 0.8 + 2.8 * t);
      }
    } catch {
      /* setStyle 期間圖層會暫時不在 */
    }
    raf = requestAnimationFrame(tick);
  };

  if (root && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }, { threshold: 0.08 });
    io.observe(root);
  }

  raf = requestAnimationFrame(tick);
}

function stripMapParams() {
  const url = new URL(location.href);
  if (!url.searchParams.has('lng') && !url.searchParams.has('lat') && !url.searchParams.has('z')) return;
  url.searchParams.delete('lng');
  url.searchParams.delete('lat');
  url.searchParams.delete('z');
  history.replaceState(null, '', url);
}

function mountTools(cover) {
  if (cover.querySelector('.cover-map-tools')) return;
  const tools = document.createElement('div');
  tools.className = 'cover-map-tools';
  tools.innerHTML = `
    <div class="cover-map-zoom">
      <button type="button" id="cover-zoom-in" aria-label="放大">+</button>
      <button type="button" id="cover-zoom-out" aria-label="縮小">−</button>
    </div>
  `;
  cover.appendChild(tools);
}

function initCoverMap() {
  const container = document.getElementById('cover-map');
  const cover = document.getElementById('cover');
  if (!container || !cover || container.querySelector('.maplibregl-canvas')) return;

  stripMapParams();
  mountTools(cover);

  const map = new maplibregl.Map({
    container,
    style: mapStyleUrl(),
    center: [DEFAULT.lng, DEFAULT.lat],
    zoom: DEFAULT.z,
    interactive: true,
    dragRotate: false,
    touchPitch: false,
    scrollZoom: false,
    doubleClickZoom: true,
    attributionControl: false,
    fadeDuration: 0,
  });

  const paint = async () => {
    restyleBaseMap(map);
    await addCables(map, { color: coverCableColor() });
    map.resize();
  };

  map.on('load', paint);
  onThemeChange(() => applyMapStyle(map, paint));

  document.getElementById('cover-zoom-in')?.addEventListener('click', () => {
    map.zoomIn({ duration: 0 });
  });
  document.getElementById('cover-zoom-out')?.addEventListener('click', () => {
    map.zoomOut({ duration: 0 });
  });

  window.addEventListener('resize', () => map.resize());
}

async function loadLandings() {
  const res = await fetch('./landings.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('landings.json missing');
  return res.json();
}

function fitLandingMap(map) {
  const pad = window.matchMedia('(max-width: 800px)').matches
    ? { top: 64, bottom: 400, left: 20, right: 20 }
    : { top: 80, bottom: 72, left: 460, right: 88 };
  map.fitBounds(
    [
      [119.95, 21.88],
      [122.08, 25.38],
    ],
    { padding: pad, duration: 0, maxZoom: 8.2 },
  );
}

const LANDING_EXITS = {
  toucheng: { via: [[122.18, 24.88], [124.85, 25.28]], out: [127.4, 25.75] },
  bali: { via: [[121.32, 25.42], [122.05, 26.85]], out: [123.55, 28.25] },
  tamsui: { via: [[121.58, 25.52], [123.55, 26.72]], out: [126.35, 27.55] },
  fangshan: { via: [[120.42, 22.28], [118.75, 20.75]], out: [117.15, 19.25] },
  dawu: { via: [[121.18, 22.48], [123.45, 21.15]], out: [125.9, 19.7] },
};

function addLandingRoutes(map, sites) {
  const wrap = map.getContainer();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'landing-routes-svg');
  svg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(svg);

  const draw = () => {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const origin = wrap.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    const pins = [...wrap.querySelectorAll('.land-pin')];
    const grads = [];
    const paths = [];
    for (const site of sites) {
      const el = pins.find((pin) => pin.querySelector('.land-pin-label')?.textContent === site.name);
      const dot = el?.querySelector('.land-pin-dot');
      if (!dot) continue;
      const box = dot.getBoundingClientRect();
      const start = {
        x: box.left + box.width / 2 - origin.left,
        y: box.top + box.height / 2 - origin.top,
      };
      const exit = LANDING_EXITS[site.id];
      if (!exit) continue;
      const c1 = map.project(exit.via[0]);
      const c2 = map.project(exit.via[1]);
      const end = map.project(exit.out);
      const gid = `${wrap.id}-route-${site.id}`;
      grads.push(
        `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">` +
          `<stop offset="0%" stop-color="#e8b84a" stop-opacity="1"/>` +
          `<stop offset="62%" stop-color="#e8b84a" stop-opacity="0.55"/>` +
          `<stop offset="100%" stop-color="#e8b84a" stop-opacity="0"/>` +
          `</linearGradient>`,
      );
      const d = `M${start.x.toFixed(1)},${start.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
      paths.push(
        `<path d="${d}" fill="none" stroke="#e8b84a" stroke-width="6" stroke-linecap="round" opacity="0.18" filter="url(#${wrap.id}-blur)"></path>` +
          `<path d="${d}" fill="none" stroke="url(#${gid})" stroke-width="2.6" stroke-linecap="round"></path>`,
      );
    }
    svg.innerHTML =
      `<defs><filter id="${wrap.id}-blur"><feGaussianBlur stdDeviation="1.6"/></filter>${grads.join('')}</defs>${paths.join('')}`;
  };

  map.on('move', draw);
  map.on('resize', draw);
  requestAnimationFrame(draw);
}

function addLandingPins(map, sites, className = 'land-pin') {
  for (const site of sites) {
    const el = document.createElement('div');
    el.className = `${className} land-pin--${site.anchor}`;
    el.innerHTML = `<span class="land-pin-dot"></span><span class="land-pin-label">${site.name}</span>`;
    new maplibregl.Marker({ element: el, anchor: 'center', draggable: false })
      .setLngLat([site.lng, site.lat])
      .addTo(map);
  }
}

async function loadDestinations() {
  const res = await fetch('./destinations.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('destinations.json missing');
  return res.json();
}

async function postConfig(path, payload) {
  const urls = [path];
  if (location.port !== '3456') urls.push(`http://127.0.0.1:3456${path}`);
  let lastErr = '寫檔服務沒開（請用 npm run dev）';
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return payload;
      lastErr = (await res.text()) || `HTTP ${res.status}`;
    } catch {
      lastErr = '寫檔服務沒開（請用 npm run dev）';
    }
  }
  throw new Error(lastErr);
}

async function saveDestinations(sites) {
  const payload = sites.map((site) => ({
    id: site.id,
    name: site.name,
    lng: Number(Number(site.lng).toFixed(5)),
    lat: Number(Number(site.lat).toFixed(5)),
    anchor: site.anchor,
  }));
  return postConfig('/__save-destinations', payload);
}

function addDestinationPins(map, sites, { editable = false, hint } = {}) {
  for (const site of sites) {
    const el = document.createElement('div');
    el.className = `land-pin dest-pin land-pin--${site.anchor}`;
    el.innerHTML = `<span class="land-pin-dot"></span><span class="land-pin-label">${site.name}</span>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: false })
      .setLngLat([site.lng, site.lat])
      .addTo(map);
    if (editable) enableDestPinDrag(map, marker, site, sites, hint);
  }
}

function enableDestPinDrag(map, marker, site, sites, hint) {
  const el = marker.getElement();
  el.classList.add('is-draggable');
  let dragging = false;

  const toLngLat = (event) => {
    const box = map.getContainer().getBoundingClientRect();
    return map.unproject([event.clientX - box.left, event.clientY - box.top]);
  };

  el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    marker.setLngLat(toLngLat(event));
  });

  const finish = async () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    const ll = marker.getLngLat();
    site.lng = ll.lng;
    site.lat = ll.lat;
    try {
      const saved = await saveDestinations(sites);
      const current = saved.find((item) => item.id === site.id) ?? site;
      if (hint) {
        hint.textContent = `已存 ${site.name} ${current.lng}, ${current.lat}`;
        hint.dataset.state = 'saved';
      }
    } catch (err) {
      if (hint) {
        hint.textContent = `存檔失敗：${err instanceof Error ? err.message : '未知錯誤'}`;
        hint.dataset.state = 'error';
      }
    }
  };

  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

function isLocalDev() {
  const host = location.hostname;
  return host === '127.0.0.1' || host === 'localhost';
}

async function loadTaiwanView() {
  try {
    const res = await fetch('./taiwan-view.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const view = await res.json();
    const lng = Number(view.lng);
    const lat = Number(view.lat);
    const zoom = Number(view.zoom);
    if (![lng, lat, zoom].every(Number.isFinite)) return null;
    return { lng, lat, zoom };
  } catch {
    return null;
  }
}

function applyTaiwanView(map, view) {
  if (view) {
    map.jumpTo({ center: [view.lng, view.lat], zoom: view.zoom, bearing: 0, pitch: 0 });
    return;
  }
  fitLandingMap(map);
}

async function saveTaiwanView(map) {
  const center = map.getCenter();
  return postConfig('/__save-taiwan-view', {
    lng: Number(center.lng.toFixed(5)),
    lat: Number(center.lat.toFixed(5)),
    zoom: Number(map.getZoom().toFixed(3)),
  });
}

function mountTaiwanEditTools(scene, map) {
  const stage = scene.querySelector('.tw-stage');
  if (!stage || stage.querySelector('.taiwan-map-tools')) return;

  const tools = document.createElement('div');
  tools.className = 'taiwan-map-tools';
  tools.innerHTML = `
    <p class="taiwan-view-hint">開發模式：拖曳城市點寫入 destinations.json</p>
    <div class="cover-map-zoom">
      <button type="button" data-taiwan-zoom="in" aria-label="放大">+</button>
      <button type="button" data-taiwan-zoom="out" aria-label="縮小">−</button>
    </div>`;
  stage.appendChild(tools);

  const hint = tools.querySelector('.taiwan-view-hint');
  tools.querySelector('[data-taiwan-zoom="in"]')?.addEventListener('click', () => {
    map.zoomIn({ duration: 0 });
  });
  tools.querySelector('[data-taiwan-zoom="out"]')?.addEventListener('click', () => {
    map.zoomOut({ duration: 0 });
  });

  let ready = false;
  let timer = 0;
  const persist = () => {
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const view = await saveTaiwanView(map);
        hint.textContent = `已存 ${view.lng}, ${view.lat} · z${view.zoom}`;
        hint.dataset.state = 'saved';
      } catch (err) {
        hint.textContent = `存檔失敗：${err instanceof Error ? err.message : '未知錯誤'}`;
        hint.dataset.state = 'error';
      }
    }, 220);
  };

  map.on('moveend', persist);
  setTimeout(() => {
    ready = true;
  }, 500);
}

async function initPaleTaiwanMap(containerId, sceneId, { routes = true, cables = false, savedView = false, pins = true, destinations = false } = {}) {
  const container = document.getElementById(containerId);
  const scene = document.getElementById(sceneId);
  if (!container || !scene || container.querySelector('.maplibregl-canvas')) return;

  const view = savedView ? await loadTaiwanView() : null;
  const editView = savedView && isLocalDev();
  const map = new maplibregl.Map({
    container,
    style: mapStyleUrl(),
    center: view ? [view.lng, view.lat] : [121.05, 23.72],
    zoom: view ? view.zoom : 7,
    interactive: false,
    dragPan: false,
    dragRotate: false,
    touchPitch: false,
    scrollZoom: false,
    boxZoom: false,
    doubleClickZoom: false,
    attributionControl: false,
    fadeDuration: 0,
  });

  const paint = async ({ first = false } = {}) => {
    restyleBaseMap(map);
    if (cables) await addCables(map, { breathe: true, root: scene, color: GOLD_CABLE });
    if (first && (pins || routes)) {
      const sites = await loadLandings();
      if (pins) addLandingPins(map, sites);
      if (routes) addLandingRoutes(map, sites);
    }
    if (first && editView) mountTaiwanEditTools(scene, map);
    if (first && destinations) {
      addDestinationPins(map, await loadDestinations(), {
        editable: editView,
        hint: scene.querySelector('.taiwan-view-hint'),
      });
    }
    if (savedView) applyTaiwanView(map, view);
    else fitLandingMap(map);
    map.resize();
  };

  map.on('load', () => paint({ first: true }));
  onThemeChange(() => applyMapStyle(map, () => paint()));

  window.addEventListener('resize', () => {
    map.resize();
    if (!savedView) fitLandingMap(map);
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        map.resize();
        if (!savedView) fitLandingMap(map);
      }
    }, { threshold: 0.12 });
    io.observe(scene);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCoverMap();
    initPaleTaiwanMap('landing-map', 'landing');
    initPaleTaiwanMap('taiwan-map', 'taiwan', { routes: false, cables: true, savedView: true, pins: false, destinations: true });
  });
} else {
  initCoverMap();
  initPaleTaiwanMap('landing-map', 'landing');
  initPaleTaiwanMap('taiwan-map', 'taiwan', { routes: false, cables: true, savedView: true, pins: false, destinations: true });
}
