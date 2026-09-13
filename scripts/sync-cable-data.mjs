import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_REPO = process.env.CABLE_DATA_REPO || 'seadog007/tw-submarine-cable-public';
const UPSTREAM_REF = process.env.CABLE_DATA_REF || 'main';
const OUTPUTS = [
  path.join(ROOT, 'data', 'cables.json'),
  path.join(ROOT, 'src', 'cables.json'),
];
const FALLBACK_COLORS = [
  '#74B8FF', '#52F8FF', '#129BFF', '#42CAFF', '#818FFF', '#16DFFF', '#78DEFF',
  '#10FFFF', '#7386FF', '#89B6FF', '#65D7FF', '#857FFF', '#717DFF', '#3488FF',
  '#65DAFF', '#23E6FF', '#477BFF', '#8796FF', '#88A6FF', '#7868FF', '#69BBFF',
  '#16B6FF', '#699DFF', '#798DFF', '#22EAFF', '#33ADFF', '#94DCFF',
];

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ocf-submarine-cable-web',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} 回傳 HTTP ${response.status}`);
  return response.json();
}

async function readExistingPalette() {
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUTS[0], 'utf8'));
    return new Map((existing.meta?.cables ?? []).map((cable) => [cable.id, cable.color]));
  } catch {
    return new Map();
  }
}

function includesTaiwan(pathTokens) {
  return pathTokens.some((token) => /^TW(?:-|$)/.test(String(token)));
}

function validSegment(segment) {
  return segment
    && segment.hidden !== true
    && Array.isArray(segment.coordinates)
    && segment.coordinates.length >= 2
    && segment.coordinates.every(
      (coordinate) => Array.isArray(coordinate)
        && coordinate.length >= 2
        && Number.isFinite(coordinate[0])
        && Number.isFinite(coordinate[1]),
    );
}

function convertCable(cable, color) {
  const allSegments = Array.isArray(cable.segments) ? cable.segments : [];
  const segmentIds = new Set(allSegments.map((segment) => segment.id));
  const routes = (Array.isArray(cable.available_path) ? cable.available_path : [])
    .filter((route) => Array.isArray(route) && includesTaiwan(route));
  const referencedIds = new Set(
    routes.flatMap((route) => route.filter((token) => segmentIds.has(token))),
  );
  if (cable.building && referencedIds.size === 0) {
    allSegments.forEach((segment) => referencedIds.add(segment.id));
  }
  const segments = allSegments.filter(
    (segment) => referencedIds.has(segment.id) && validSegment(segment),
  );
  const metadata = {
    id: cable.id,
    name: cable.name,
    color,
    building: Boolean(cable.building),
    routes,
    segments: segments.map((segment) => segment.id),
  };
  const features = segments.map((segment) => ({
    type: 'Feature',
    properties: {
      id: segment.id,
      cable: cable.id,
      name: cable.name,
      color,
      building: Boolean(cable.building),
    },
    geometry: {
      type: 'LineString',
      coordinates: segment.coordinates,
    },
  }));
  return { metadata, features };
}

function validateCollection(collection) {
  if (collection.type !== 'FeatureCollection') throw new Error('輸出不是 GeoJSON FeatureCollection');
  if (collection.meta.cableCount < 20) throw new Error(`海纜數量異常：${collection.meta.cableCount}`);
  if (collection.features.length < 50) throw new Error(`海纜線段數量異常：${collection.features.length}`);
  const ids = new Set();
  for (const feature of collection.features) {
    const id = feature.properties?.id;
    if (!id || ids.has(id)) throw new Error(`海纜線段 ID 缺漏或重複：${id}`);
    ids.add(id);
  }
}

async function writeIfChanged(filePath, content) {
  let current = '';
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch {
    /* 第一次產生檔案 */
  }
  if (current === content) return false;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return true;
}

async function main() {
  const api = `https://api.github.com/repos/${UPSTREAM_REPO}`;
  const headers = githubHeaders();
  const commit = await fetchJson(`${api}/commits/${encodeURIComponent(UPSTREAM_REF)}`, { headers });
  const upstreamSha = commit.sha;
  const entries = await fetchJson(
    `${api}/contents/cables?ref=${encodeURIComponent(upstreamSha)}`,
    { headers },
  );
  const files = entries
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (!files.length) throw new Error('上游沒有找到海纜 JSON');

  const cables = await Promise.all(
    files.map((entry) => fetchJson(entry.download_url, { headers })),
  );
  const existingPalette = await readExistingPalette();
  const metadata = [];
  const features = [];
  cables.forEach((cable, index) => {
    const color = existingPalette.get(cable.id) ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    const converted = convertCable(cable, color);
    metadata.push(converted.metadata);
    features.push(...converted.features);
  });

  const collection = {
    type: 'FeatureCollection',
    meta: {
      source: `https://github.com/${UPSTREAM_REPO}`,
      upstreamCommit: upstreamSha,
      generatedAt: commit.commit?.committer?.date ?? null,
      cableCount: metadata.length,
      segmentCount: features.length,
      cables: metadata,
    },
    features,
  };
  validateCollection(collection);
  const content = `${JSON.stringify(collection)}\n`;
  const changed = [];
  for (const output of OUTPUTS) {
    if (await writeIfChanged(output, content)) changed.push(path.relative(ROOT, output));
  }
  console.log(
    `${metadata.length} 條海纜、${features.length} 段路徑，來源 ${upstreamSha.slice(0, 7)}；`
      + (changed.length ? `已更新 ${changed.join('、')}` : '資料無變更'),
  );
}

await main();
