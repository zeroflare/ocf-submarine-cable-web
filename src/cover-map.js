const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function mapStyleUrl() {
  return STYLE_DARK;
}

const CABLE_COLOR = '#66dff1';
const GOLD_CABLE = '#f4c96c';
const DOMESTIC_CABLE = '#54e3c2';
const OVERSEAS_CABLE = '#8aa7ff';
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
    const oceanOnly = ['all', ['==', '$type', 'Polygon'], ['!in', 'class', ...inlandWater]];
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

function initCoverMap() {
  const container = document.getElementById('cover-map');
  const cover = document.getElementById('cover');
  if (!container || !cover || container.querySelector('.maplibregl-canvas')) return;

  stripMapParams();
  const map = new maplibregl.Map({
    container,
    style: mapStyleUrl(),
    center: [DEFAULT.lng, DEFAULT.lat],
    zoom: DEFAULT.z,
    interactive: false,
    dragPan: false,
    dragRotate: false,
    touchPitch: false,
    scrollZoom: false,
    doubleClickZoom: false,
    attributionControl: false,
    fadeDuration: 0,
  });

  const paint = async () => {
    restyleBaseMap(map);
    await addCables(map, { color: coverCableColor() });
    map.resize();
  };

  map.on('load', paint);

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

const DOMESTIC_DESTINATIONS = new Set(['kinmen', 'matsu']);
const TAIWAN_ROUTE_ORIGIN = [120.97, 23.72];
const OUTBOUND_ROUTE_CURVES = {
  singapore: -0.08,
  hongkong: 0.12,
  manila: 0.1,
  tokyo: -0.08,
  guam: 0.08,
  losangeles: 0.05,
  kinmen: 0.16,
  matsu: -0.16,
  sanchong: -0.03,
  shanghai: 0.1,
};

function setSvgPathProgress(path, progress, reverse = false) {
  const fullPath = path.dataset.fullPath;
  if (!fullPath) return;
  path.setAttribute('d', fullPath);
  path.style.visibility = progress <= 0.001 ? 'hidden' : 'visible';
  if (progress <= 0.001 || progress >= 0.999) return;

  const length = path.getTotalLength();
  const visibleLength = length * progress;
  const steps = Math.max(8, Math.ceil(48 * progress));
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const visibleProgress = visibleLength * (index / steps);
    return path.getPointAtLength(reverse ? length - visibleProgress : visibleProgress);
  });
  path.setAttribute(
    'd',
    points
      .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' '),
  );
}

function viewportEdgePoint(start, target, width, height) {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const candidates = [];
  if (dx > 0) candidates.push((width - start.x) / dx);
  if (dx < 0) candidates.push((0 - start.x) / dx);
  if (dy > 0) candidates.push((height - start.y) / dy);
  if (dy < 0) candidates.push((0 - start.y) / dy);
  const progress = Math.min(...candidates.filter((value) => value > 0));
  return {
    x: start.x + dx * progress,
    y: start.y + dy * progress,
  };
}

function addLandingRoutes(map, sites) {
  const wrap = map.getContainer();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'landing-routes-svg');
  svg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(svg);
  let progress = 0;

  const applyProgress = () => {
    for (const path of svg.querySelectorAll('.landing-route-path')) {
      setSvgPathProgress(path, progress, true);
    }
  };

  const draw = () => {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const origin = wrap.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    const pins = [...wrap.querySelectorAll('.network-landing-pin')];
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
      const projectedC1 = map.project(exit.via[0]);
      const target = map.project(exit.out);
      const end = viewportEdgePoint(start, target, w, h);
      const c1 = {
        x: Math.max(0, Math.min(w, projectedC1.x)),
        y: Math.max(0, Math.min(h, projectedC1.y)),
      };
      const c2 = {
        x: c1.x + (end.x - c1.x) * 0.68,
        y: c1.y + (end.y - c1.y) * 0.68,
      };
      const gid = `${wrap.id}-route-${site.id}`;
      grads.push(
        `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${end.x}" y1="${end.y}" x2="${start.x}" y2="${start.y}">` +
          `<stop offset="0%" stop-color="${GOLD_CABLE}" stop-opacity="0.18"/>` +
          `<stop offset="46%" stop-color="${GOLD_CABLE}" stop-opacity="0.62"/>` +
          `<stop offset="100%" stop-color="${GOLD_CABLE}" stop-opacity="1"/>` +
          `</linearGradient>`,
      );
      const d = `M${start.x.toFixed(1)},${start.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
      paths.push(
        `<path class="landing-route-path" data-full-path="${d}" d="${d}" fill="none" stroke="${GOLD_CABLE}" stroke-width="6" stroke-linecap="round" opacity="0.18" filter="url(#${wrap.id}-blur)"></path>` +
          `<path class="landing-route-path" data-full-path="${d}" d="${d}" fill="none" stroke="url(#${gid})" stroke-width="2.6" stroke-linecap="round"></path>`,
      );
    }
    svg.innerHTML =
      `<defs><filter id="${wrap.id}-blur"><feGaussianBlur stdDeviation="1.6"/></filter>${grads.join('')}</defs>${paths.join('')}`;
    applyProgress();
  };

  map.on('move', draw);
  map.on('resize', draw);
  requestAnimationFrame(draw);
  return {
    svg,
    draw,
    setProgress(nextProgress) {
      progress = clamp01(nextProgress);
      applyProgress();
    },
  };
}

function addOutboundRoutes(map, destinations) {
  const wrap = map.getContainer();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'landing-routes-svg outbound-routes-svg');
  svg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(svg);
  let domesticProgress = 0;
  let overseasProgress = 0;
  let drawRaf = 0;

  const applyProgress = () => {
    for (const path of svg.querySelectorAll('.outbound-route-path')) {
      const progress = path.dataset.routeType === 'domestic'
        ? domesticProgress
        : overseasProgress;
      setSvgPathProgress(path, progress);
    }
  };

  const dotCenter = (siteId, origin) => {
    const dot = wrap.querySelector(
      `.network-destination-pin[data-site-id="${siteId}"] .land-pin-dot`,
    );
    if (!dot) return null;
    const box = dot.getBoundingClientRect();
    return {
      x: box.left + box.width / 2 - origin.left,
      y: box.top + box.height / 2 - origin.top,
    };
  };

  const visualTaiwanCenter = (origin) => {
    const centers = [...wrap.querySelectorAll('.network-landing-pin .land-pin-dot')]
      .map((dot) => {
        const box = dot.getBoundingClientRect();
        return {
          x: box.left + box.width / 2 - origin.left,
          y: box.top + box.height / 2 - origin.top,
        };
      });

    if (!centers.length) return map.project(TAIWAN_ROUTE_ORIGIN);

    const xs = centers.map(({ x }) => x);
    const ys = centers.map(({ y }) => y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };

  const draw = () => {
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (!width || !height) return;
    const origin = wrap.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const paths = [];
    const start = visualTaiwanCenter(origin);
    for (const site of destinations) {
      const curve = OUTBOUND_ROUTE_CURVES[site.id] ?? 0;
      const end = dotCenter(site.id, origin);
      if (!start || !end) continue;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const normal = { x: -dy / distance, y: dx / distance };
      const bend = distance * curve;
      const c1 = {
        x: start.x + dx * 0.34 + normal.x * bend,
        y: start.y + dy * 0.34 + normal.y * bend,
      };
      const c2 = {
        x: start.x + dx * 0.72 + normal.x * bend,
        y: start.y + dy * 0.72 + normal.y * bend,
      };
      const d = `M${start.x.toFixed(1)},${start.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
      const routeType = DOMESTIC_DESTINATIONS.has(site.id) ? 'domestic' : 'overseas';
      const color = routeType === 'domestic' ? DOMESTIC_CABLE : OVERSEAS_CABLE;
      paths.push(
        `<path class="outbound-route-path outbound-route-path--glow" data-route-type="${routeType}" data-full-path="${d}" d="${d}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" opacity="0.24" filter="url(#${wrap.id}-outbound-blur)"></path>` +
          `<path class="outbound-route-path" data-route-type="${routeType}" data-full-path="${d}" d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"></path>`,
      );
    }
    svg.innerHTML =
      `<defs><filter id="${wrap.id}-outbound-blur"><feGaussianBlur stdDeviation="2.2"/></filter></defs>${paths.join('')}`;
    applyProgress();
  };

  const requestDraw = () => {
    if (drawRaf) return;
    drawRaf = requestAnimationFrame(() => {
      drawRaf = 0;
      draw();
    });
  };

  map.on('move', requestDraw);
  map.on('resize', requestDraw);
  requestDraw();
  return {
    svg,
    draw,
    setProgress(nextDomesticProgress, nextOverseasProgress) {
      domesticProgress = clamp01(nextDomesticProgress);
      overseasProgress = clamp01(nextOverseasProgress);
      applyProgress();
    },
  };
}

function addLandingPins(map, sites, className = 'land-pin') {
  const elements = [];
  for (const site of sites) {
    const el = document.createElement('div');
    el.className = `${className} land-pin--${site.anchor}`;
    el.dataset.siteId = site.id;
    el.innerHTML = `<span class="land-pin-dot"></span><span class="land-pin-label">${site.name}</span>`;
    new maplibregl.Marker({ element: el, anchor: 'center', draggable: false })
      .setLngLat([site.lng, site.lat])
      .addTo(map);
    elements.push(el);
  }
  return elements;
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
  const elements = [];
  for (const site of sites) {
    const el = document.createElement('div');
    const routeType = DOMESTIC_DESTINATIONS.has(site.id) ? 'domestic' : 'overseas';
    el.className = `land-pin dest-pin network-destination-pin network-destination-pin--${routeType} land-pin--${site.anchor}`;
    el.dataset.siteId = site.id;
    el.innerHTML = `<span class="land-pin-dot"></span><span class="land-pin-label">${site.name}</span>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: false })
      .setLngLat([site.lng, site.lat])
      .addTo(map);
    if (editable) enableDestPinDrag(map, marker, site, sites, hint);
    elements.push(el);
  }
  return elements;
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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function rangeProgress(value, start, end) {
  return clamp01((value - start) / (end - start));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function mix(from, to, progress) {
  return from + (to - from) * progress;
}

function landingCameraFor(map) {
  const mobile = window.matchMedia('(max-width: 800px)').matches;
  const padding = mobile
    ? { top: 64, bottom: 360, left: 20, right: 20 }
    : { top: 80, bottom: 72, left: 460, right: 88 };
  const camera = map.cameraForBounds(
    [
      [119.95, 21.88],
      [122.08, 25.38],
    ],
    { padding, maxZoom: 8.2 },
  );
  return {
    lng: camera?.center.lng ?? 121.05,
    lat: camera?.center.lat ?? 23.72,
    zoom: camera?.zoom ?? 7,
  };
}

function globalCameraFor(view) {
  const mobile = window.matchMedia('(max-width: 800px)').matches;
  if (mobile) {
    return {
      lng: 129,
      lat: 22.5,
      zoom: Math.min(view?.zoom ?? 3.5, 1.9),
    };
  }
  const viewportZoom = mix(3.15, 3.5, clamp01((window.innerHeight - 720) / 330));
  return {
    lng: view?.lng ?? 119.05946,
    lat: view?.lat ?? 21.64738,
    zoom: Math.min(view?.zoom ?? 3.5, viewportZoom),
  };
}

function setPanelState(panel, opacity, shift) {
  if (!panel) return;
  panel.style.opacity = opacity.toFixed(3);
  panel.style.setProperty('--network-shift', `${shift.toFixed(1)}px`);
  panel.style.pointerEvents = opacity > 0.55 ? 'auto' : 'none';
  panel.setAttribute('aria-hidden', String(opacity < 0.08));
}

async function initNetworkStoryMap() {
  const container = document.getElementById('network-map');
  const scene = document.getElementById('landing');
  if (!container || !scene || container.querySelector('.maplibregl-canvas')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const globalView = await loadTaiwanView();
  const map = new maplibregl.Map({
    container,
    style: mapStyleUrl(),
    center: [121.05, 23.72],
    zoom: 7,
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

  map.on('load', async () => {
    restyleBaseMap(map);
    const [landings, destinations] = await Promise.all([loadLandings(), loadDestinations()]);
    addLandingPins(map, landings, 'land-pin network-landing-pin');
    const landingRoutes = addLandingRoutes(map, landings);
    addDestinationPins(map, destinations);
    const outboundRoutes = addOutboundRoutes(map, destinations);
    const landingPanel = scene.querySelector('[data-network-panel="landing"]');
    const globalPanel = scene.querySelector('[data-network-panel="global"]');
    let landingCamera;
    let globalCamera;
    let raf = 0;

    const updateCameras = () => {
      map.resize();
      landingCamera = landingCameraFor(map);
      globalCamera = globalCameraFor(globalView);
    };

    const scrollProgress = () => {
      const rect = scene.getBoundingClientRect();
      const travel = Math.max(1, scene.offsetHeight - window.innerHeight);
      return clamp01(-rect.top / travel);
    };

    const render = () => {
      raf = 0;
      if (!landingCamera || !globalCamera) return;
      const progress = scrollProgress();
      const incomingProgress = reduceMotion.matches
        ? 1
        : smoothstep(rangeProgress(progress, 0.02, 0.3));
      const cameraProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.3, 0.54));
      const routeProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.42, 0.56));
      const domesticRouteProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.56, 0.78));
      const overseasRouteProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.62, 0.94));
      const landingPinProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.42, 0.56));
      const destinationPinProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.5, 0.56));
      const landingPanelProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.43, 0.55));
      const globalPanelProgress = reduceMotion.matches
        ? Number(progress >= 0.56)
        : smoothstep(rangeProgress(progress, 0.52, 0.66));

      map.jumpTo({
        center: [
          mix(landingCamera.lng, globalCamera.lng, cameraProgress),
          mix(landingCamera.lat, globalCamera.lat, cameraProgress),
        ],
        zoom: mix(landingCamera.zoom, globalCamera.zoom, cameraProgress),
        bearing: 0,
        pitch: 0,
      });

      landingRoutes.svg.style.opacity = (1 - routeProgress).toFixed(3);
      landingRoutes.setProgress(incomingProgress);
      scene.style.setProperty('--landing-pin-opacity', (1 - landingPinProgress).toFixed(3));
      scene.style.setProperty('--domestic-pin-opacity', destinationPinProgress.toFixed(3));
      scene.style.setProperty('--overseas-pin-opacity', destinationPinProgress.toFixed(3));
      outboundRoutes.setProgress(domesticRouteProgress, overseasRouteProgress);

      setPanelState(landingPanel, 1 - landingPanelProgress, -12 * landingPanelProgress);
      setPanelState(globalPanel, globalPanelProgress, 14 * (1 - globalPanelProgress));
      scene.dataset.networkProgress = progress.toFixed(3);
      scene.dataset.incomingProgress = incomingProgress.toFixed(3);
      scene.dataset.destinationProgress = destinationPinProgress.toFixed(3);
      scene.dataset.domesticProgress = domesticRouteProgress.toFixed(3);
      scene.dataset.overseasProgress = overseasRouteProgress.toFixed(3);
    };

    const requestRender = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    updateCameras();
    render();

    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', () => {
      updateCameras();
      requestRender();
    });
    reduceMotion.addEventListener?.('change', requestRender);

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        updateCameras();
        requestRender();
      }, { threshold: 0.02 });
      observer.observe(scene);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCoverMap();
    initNetworkStoryMap();
  });
} else {
  initCoverMap();
  initNetworkStoryMap();
}
