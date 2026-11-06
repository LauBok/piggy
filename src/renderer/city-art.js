// Drawings for Pig City: the ground, roads, buildings, trees, the animal neighbours, room
// interiors seen through cut-away bubbles, and the pig's dollhouse. Everything is plain SVG
// strings with flat colours (only the pig itself uses gradients).

// Mix two hex colours: t = 0 gives a, 1 gives b
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const darker = (c, t = 0.22) => mixHex(c, '#4a2c38', t);
const lighter = (c, t = 0.5) => mixHex(c, '#ffffff', t);

// Same "random" layout every time the map is drawn
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

const emo = (x, y, size, ch, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${extra}>${ch}</text>`;

// ---------- scenery ----------

function treeSvg(x, y, k = 1, kind = 0) {
  const greens = [['#8ce99a', '#69db7c'], ['#a9e34b', '#94d82d'], ['#96f2d7', '#63e6be'], ['#ffc9c9', '#ffa8a8']][kind % 4];
  return `<g class="tree"><ellipse cx="${x}" cy="${y}" rx="${14 * k}" ry="${4 * k}" fill="rgba(60,90,40,.13)"/>
    <rect x="${x - 3 * k}" y="${y - 16 * k}" width="${6 * k}" height="${16 * k}" rx="${2 * k}" fill="#c08a5b"/>
    <circle cx="${x}" cy="${y - 28 * k}" r="${16 * k}" fill="${greens[0]}"/>
    <circle cx="${x - 9 * k}" cy="${y - 20 * k}" r="${10 * k}" fill="${greens[1]}"/>
    <circle cx="${x + 9 * k}" cy="${y - 21 * k}" r="${11 * k}" fill="${greens[0]}"/>
    <circle cx="${x - 5 * k}" cy="${y - 33 * k}" r="${4 * k}" fill="#fff" opacity=".35"/></g>`;
}

const flower = (x, y, c) => `<g><circle cx="${x}" cy="${y}" r="3.2" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.3" fill="#ffd43b"/></g>`;

const bush = (x, y, k = 1) => `<g><circle cx="${x - 8 * k}" cy="${y - 6 * k}" r="${8 * k}" fill="#8ce99a"/>
  <circle cx="${x + 6 * k}" cy="${y - 7 * k}" r="${9 * k}" fill="#69db7c"/><circle cx="${x}" cy="${y - 12 * k}" r="${7 * k}" fill="#8ce99a"/></g>`;

const lampPost = (x, y) => `<g><rect x="${x - 1.5}" y="${y - 34}" width="3" height="34" fill="#868e96"/>
  <circle cx="${x}" cy="${y - 36}" r="5" fill="#fff3bf" stroke="#adb5bd" stroke-width="1.5"/></g>`;

const bench = (x, y) => `<g><rect x="${x - 14}" y="${y - 10}" width="28" height="5" rx="2" fill="#c08a5b"/>
  <rect x="${x - 14}" y="${y - 17}" width="28" height="4" rx="2" fill="#d9a066"/>
  <path d="M${x - 11} ${y - 5} L${x - 11} ${y} M${x + 11} ${y - 5} L${x + 11} ${y}" stroke="#8c6239" stroke-width="2"/></g>`;

// ---------- the land: regions, roads, river, cliff ----------

const ptsD = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// Short paths from each door to the nearest road
function doorPaths() {
  const segs = ROADS.flatMap((r) => r.line.slice(1).map((b, i) => [r.line[i], b]));
  const nearest = (x, y) => {
    let best = null;
    for (const [[x1, y1], [x2, y2]] of segs) {
      const t = clamp(((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2 || 1), 0, 1);
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const d = Math.hypot(px - x, py - y);
      if (!best || d < best.d) best = { d, px, py };
    }
    return best;
  };
  const doors = [
    ...PLACES.filter((p) => ['building', 'home', 'pavilion', 'stage'].includes(p.kind)).map((p) => p.door),
    ...PLACE_BY_ID.neighbors.houses.map((h) => ({ x: h.x, y: h.y - 18 })),
  ];
  // in town the paving already reaches every door
  const paved = (d) => DISTRICTS.some((r) => ['stone', 'brick'].includes(r.ground) && d.x > r.rect[0] && d.x < r.rect[2] && d.y > r.rect[1] && d.y < r.rect[3]);
  return doors.filter((d) => !paved(d)).map((d) => {
    const n = nearest(d.x, d.y + 10);
    return n && n.d < 260 ? [[d.x, d.y - 4], [d.x, d.y + 14], [n.px, n.py]] : null;
  }).filter(Boolean);
}

const GROUND_DEFS = `<defs>
  <pattern id="pPave" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#ebe3d9"/>
    <path d="M0 20 H40 M20 0 V20 M0 0 V0 M10 20 V40 M30 20 V40" stroke="#d9cfc3" stroke-width="2"/></pattern>
  <pattern id="pBrick" width="36" height="18" patternUnits="userSpaceOnUse"><rect width="36" height="18" fill="#f3dccb"/>
    <path d="M0 9 H36 M0 18 H36 M12 0 V9 M30 9 V18" stroke="#e2c4ad" stroke-width="2"/></pattern>
  <pattern id="pLawn" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#cdeaa9"/><rect width="30" height="60" fill="#c4e49e"/></pattern>
  <pattern id="pSoil" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#b88a5c"/><rect y="14" width="24" height="5" fill="#a87b4f"/></pattern>
</defs>`;

const REGION_FILL = { hills: '#c6e3a6', farm: '#d6eebb', lawn: 'url(#pLawn)', stone: 'url(#pPave)', park: '#c1e6a3', brick: 'url(#pBrick)' };

function groundSvg() {
  const rnd = seeded(5);
  let svg = `${GROUND_DEFS}<rect width="${WORLD.w}" height="${WORLD.h}" fill="#d3ebb6"/>`;
  for (const d of DISTRICTS) {
    const [x1, y1, x2, y2] = d.rect;
    svg += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="${d.ground === 'hills' ? 0 : 50}" fill="${REGION_FILL[d.ground]}"/>`;
  }
  // grass tufts on the green regions
  for (let i = 0; i < 900; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const d = DISTRICTS.find((r) => x > r.rect[0] && x < r.rect[2] && y > r.rect[1] && y < r.rect[3]);
    if (d && ['stone', 'brick'].includes(d.ground)) continue;
    svg += `<path d="M${x} ${y} l-3 -7 M${x + 2} ${y} l1 -9 M${x + 4} ${y} l4 -6" stroke="#a9d18a" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // mountains behind the hills
  svg += `<path d="M2660 420 L2860 120 L3060 420 Z" fill="#c5d9ef"/><path d="M2825 172 L2860 120 L2895 172 L2878 162 L2860 178 L2842 162 Z" fill="#fff"/>
    <path d="M2960 420 L3200 60 L3440 420 Z" fill="#b7cbe6"/><path d="M3160 120 L3200 60 L3240 120 L3220 108 L3200 126 L3180 108 Z" fill="#fff"/>
    <path d="M3300 420 L3480 170 L3640 420 Z" fill="#c5d9ef"/>`;
  // roads: dirt paths with a darker edge; town streets paved with a kerb
  const dirt = ROADS.filter((r) => !r.stone);
  const stone = ROADS.filter((r) => r.stone);
  const doors = doorPaths();
  for (const r of stone) svg += `<path d="${ptsD(r.line)}" stroke="#cbbfb2" stroke-width="54" stroke-linecap="square" fill="none"/>`;
  for (const r of stone) svg += `<path d="${ptsD(r.line)}" stroke="#ddd3c8" stroke-width="44" stroke-linecap="square" fill="none"/>`;
  for (const r of dirt) svg += `<path d="${ptsD(r.line)}" stroke="#ccb48a" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  for (const p of doors) svg += `<path d="${ptsD(p)}" stroke="#ccb48a" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  for (const r of dirt) svg += `<path d="${ptsD(r.line)}" stroke="#e4d1aa" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  for (const p of doors) svg += `<path d="${ptsD(p)}" stroke="#e4d1aa" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  for (const r of dirt) {
    for (let i = 4; i < r.line.length; i += 5) {
      const [x, y] = r.line[i];
      svg += `<ellipse cx="${x + (rnd() - 0.5) * 18}" cy="${y + (rnd() - 0.5) * 14}" rx="5" ry="3" fill="#d6c193"/>`;
    }
  }
  svg += riverSvg() + cliffSvg();
  return svg;
}

function riverSvg() {
  const d = ptsD(RIVER);
  let svg = `<path d="${d}" stroke="#b8a37f" stroke-width="${RIVER_W * 2 + 14}" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#7cc4ea" stroke-width="${RIVER_W * 2}" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#a5d8ff" stroke-width="${RIVER_W}" fill="none" stroke-linecap="round" opacity=".6"/>
    <path class="ripple" d="${d}" stroke="#fff" stroke-width="2.5" fill="none" stroke-dasharray="10 40" opacity=".7"/>`;
  // wooden bridges
  for (const b of BRIDGES) {
    svg += `<g><rect x="${b.x - 72}" y="${b.y - 22}" width="144" height="44" rx="6" fill="#c08a5b" stroke="#8c6239" stroke-width="2"/>
      ${[...Array(9)].map((_, i) => `<path d="M${b.x - 64 + i * 16} ${b.y - 20} V${b.y + 20}" stroke="#a9744a" stroke-width="2"/>`).join('')}
      <rect x="${b.x - 74}" y="${b.y - 28}" width="148" height="7" rx="3" fill="#8c6239"/><rect x="${b.x - 74}" y="${b.y + 20}" width="148" height="7" rx="3" fill="#8c6239"/></g>`;
  }
  return svg;
}

function cliffSvg() {
  const { y, h, steps } = CLIFF;
  let svg = '';
  let x = 0;
  const face = (x1, x2) => {
    if (x2 <= x1) return '';
    let s = `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" fill="#b5916d"/>
      <rect x="${x1}" y="${y + h - 8}" width="${x2 - x1}" height="8" fill="#9c7a58"/>
      <rect x="${x1}" y="${y - 6}" width="${x2 - x1}" height="10" rx="5" fill="#a9d18a"/>`;
    for (let k = x1 + 20; k < x2 - 10; k += 46) s += `<path d="M${k} ${y + 10} l14 0 M${k + 22} ${y + 22} l16 0" stroke="#9c7a58" stroke-width="3" stroke-linecap="round"/>`;
    return s;
  };
  for (const [a, b] of steps) {
    svg += face(x, a);
    // stone steps up
    for (let i = 0; i < 5; i++) svg += `<rect x="${a}" y="${y - 6 + i * ((h + 6) / 5)}" width="${b - a}" height="${(h + 6) / 5}" fill="${i % 2 ? '#d6d0c8' : '#e3ded6'}" stroke="#b8b0a6"/>`;
    x = b;
  }
  svg += face(x, WORLD.w);
  // the waterfall where the river comes down the cliff
  const wx = riverXAt(y + h + 4);
  svg += `<rect x="${wx - RIVER_W}" y="${y - 30}" width="${RIVER_W * 2}" height="${h + 34}" fill="#a5d8ff"/>
    <g class="falls">${[0, 1, 2, 3].map((i) => `<path d="M${wx - 24 + i * 16} ${y - 26} V${y + h}" stroke="#fff" stroke-width="3" stroke-dasharray="8 10" opacity=".85"/>`).join('')}</g>
    <ellipse cx="${wx}" cy="${y + h + 6}" rx="${RIVER_W + 8}" ry="9" fill="#fff" opacity=".7"/>`;
  return svg;
}

// Fields with rows of crops, and the ranch's fenced pasture
function fence(x, y, w, h, gap = null) {
  let s = '';
  const posts = (x1, y1, x2, y2) => {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 22));
    let r = `<path d="M${x1} ${y1 - 8} L${x2} ${y2 - 8} M${x1} ${y1 - 15} L${x2} ${y2 - 15}" stroke="#a9744a" stroke-width="3"/>`;
    for (let i = 0; i <= n; i++) r += `<rect x="${x1 + ((x2 - x1) * i) / n - 2.5}" y="${y1 + ((y2 - y1) * i) / n - 20}" width="5" height="20" rx="1.5" fill="#c08a5b"/>`;
    return r;
  };
  s += posts(x, y, x + w, y) + posts(x, y, x, y + h) + posts(x + w, y, x + w, y + h);
  if (gap) s += posts(x, y + h, gap[0], y + h) + posts(gap[1], y + h, x + w, y + h);
  else s += posts(x, y + h, x + w, y + h);
  return s;
}

function farmSvg() {
  let svg = '';
  for (const f of FIELDS) {
    svg += `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="6" fill="url(#pSoil)"/>`;
    for (let y = f.y + 24; y < f.y + f.h - 6; y += 28) {
      for (let x = f.x + 18; x < f.x + f.w - 8; x += 30) svg += emo(x, y, 15, f.crop[Math.floor((x + y) / 30) % f.crop.length]);
    }
    svg += fence(f.x - 8, f.y - 4, f.w + 16, f.h + 10);
  }
  const p = PASTURE;
  svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10" fill="#bfe39c"/>
    <ellipse cx="${p.x + p.w - 90}" cy="${p.y + 70}" rx="44" ry="18" fill="#e9c46a" opacity=".85"/>${emo(p.x + p.w - 90, p.y + 62, 22, '🌾')}
    <rect x="${p.x + 30}" y="${p.y + p.h - 70}" width="70" height="16" rx="6" fill="#8ec5ff" stroke="#74c0fc"/>`;
  svg += fence(p.x - 6, p.y - 4, p.w + 12, p.h + 8);
  return svg;
}

// The town's name boards: one per region, by the road in
function signsSvg() {
  return DISTRICTS.map((d) => {
    const [x, y] = d.sign;
    const w = d.name.length * 22 + 26;
    return `<g class="sign"><rect x="${x - 3}" y="${y - 34}" width="6" height="36" fill="#8c6239"/>
      <rect x="${x - w / 2}" y="${y - 66}" width="${w}" height="34" rx="6" fill="#d9a066" stroke="#8c6239" stroke-width="2.5"/>
      <text class="signtext" x="${x}" y="${y - 48}">${d.name}</text></g>`;
  }).join('');
}

// Buildings you can't go in: town filler, the barn, the windmill, the ranch cottage
function decoSvg(d) {
  if (d.look) return facade({ ...d, icon: d.icon });
  const { x, y, w, h } = d;
  const cx = x + w / 2;
  if (d.kind === 'barn') {
    return `<path d="M${x + w} ${y + 60} L${x + w + 18} ${y + 72} L${x + w + 18} ${y + h + 8} L${x + 14} ${y + h + 8} L${x} ${y + h} Z" fill="rgba(70,50,40,.13)"/>
      <rect x="${x}" y="${y + 60}" width="${w}" height="${h - 60}" rx="4" fill="#e03131" stroke="#a51111" stroke-width="2"/>
      <path d="M${x - 10} ${y + 64} L${x + 20} ${y + 10} L${x + w - 20} ${y + 10} L${x + w + 10} ${y + 64} Z" fill="#868e96" stroke="#495057" stroke-width="2" stroke-linejoin="round"/>
      <rect x="${cx - 34}" y="${y + h - 74}" width="68" height="74" fill="#fff" stroke="#a51111" stroke-width="2"/>
      <path d="M${cx - 34} ${y + h - 74} L${cx + 34} ${y + h} M${cx + 34} ${y + h - 74} L${cx - 34} ${y + h}" stroke="#e03131" stroke-width="4"/>
      <rect x="${cx - 16}" y="${y + 74}" width="32" height="24" fill="#fff3bf" stroke="#a51111" stroke-width="2"/>`;
  }
  if (d.kind === 'windmill') {
    return `<path d="M${x + 20} ${y + h} L${x + 34} ${y + 70} L${x + w - 34} ${y + 70} L${x + w - 20} ${y + h} Z" fill="#fff4e6" stroke="#c9a77c" stroke-width="2"/>
      <path d="M${x + 28} ${y + 74} L${cx} ${y + 40} L${x + w - 28} ${y + 74} Z" fill="#a9805b" stroke="#8c6239" stroke-width="2"/>
      <rect x="${cx - 10}" y="${y + h - 30}" width="20" height="30" rx="8" fill="#a9805b"/>
      <g class="blades" style="transform-origin:${cx}px ${y + 66}px">${[0, 90, 180, 270].map((a) => `<rect x="${cx - 7}" y="${y - 6}" width="14" height="72" rx="3" fill="#fff" stroke="#c9a77c" stroke-width="2" transform="rotate(${a} ${cx} ${y + 66})"/>`).join('')}</g>
      <circle cx="${cx}" cy="${y + 66}" r="7" fill="#8c6239"/>`;
  }
  return cottage(x, y, w, h, '#fff4e6', '#c08a5b');
}

// Inside a place, on a road, or too close to a building: no tree there
const roadSegs = () => (roadSegs.cache ||= ROADS.flatMap((r) => r.line.slice(1).map((b, i) => [r.line[i], b])));
function freeForScenery(x, y, pad = 34) {
  for (const p of [...PLACES, ...DECOS, ...FIELDS, PASTURE]) if (x > p.x - pad && x < p.x + p.w + pad && y > p.y - 10 && y < p.y + p.h + pad + 30) return false;
  for (const [[x1, y1], [x2, y2]] of roadSegs()) {
    if (Math.abs(x - x1) > 300 && Math.abs(x - x2) > 300) continue;
    const t = clamp(((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2 || 1), 0, 1);
    if (Math.hypot(x - (x1 + (x2 - x1) * t), y - (y1 + (y2 - y1) * t)) < 42) return false;
  }
  for (const d of DISTRICTS) if (Math.abs(x - d.sign[0]) < 60 && Math.abs(y - d.sign[1]) < 50) return false;
  if (Math.abs(x - riverXAt(y)) < RIVER_W + 30) return false;
  if (y > CLIFF.y - 20 && y < CLIFF.y + CLIFF.h + 30) return false;
  return walkable(x, y) || (y < CLIFF.y && x < 2660);
}

// How thick the trees grow in each kind of region
const TREE_DENSITY = { hills: 1, farm: 0.45, lawn: 0.5, stone: 0.12, park: 0.9, brick: 0.1 };

// Trees, flowers, benches, lamps, rocks and barrels scattered on the open ground
function scenerySvg() {
  const rnd = seeded(7);
  const trees = [];
  for (let x = 30; x < WORLD.w; x += 70 + rnd() * 40) trees.push([x, WORLD.h - 6 - rnd() * 10, 1 + rnd() * 0.3, Math.floor(rnd() * 3)]);
  for (let y = 480; y < WORLD.h - 40; y += 80 + rnd() * 40) trees.push([20 + rnd() * 10, y, 1.1, 0], [WORLD.w - 20 - rnd() * 10, y, 1.1, 0]);
  for (let tries = 0, n = 0; tries < 9000 && n < 330; tries++) {
    const x = 40 + rnd() * (WORLD.w - 80);
    const y = 60 + rnd() * (WORLD.h - 100);
    const d = DISTRICTS.find((r) => x > r.rect[0] && x < r.rect[2] && y > r.rect[1] && y < r.rect[3]);
    if (rnd() > (d ? TREE_DENSITY[d.ground] : 0.6)) continue;
    if (!freeForScenery(x, y)) continue;
    if (trees.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 44)) continue;
    const kind = d?.id === 'park' && rnd() < 0.4 ? 3 : d?.ground === 'hills' ? 0 : Math.floor(rnd() * 3);
    trees.push([x, y, 0.85 + rnd() * 0.45, kind]);
    n++;
  }
  // the town's streets get a tree every so often
  for (const r of ROADS.filter((q) => q.stone)) {
    const [[x1, y1], [x2, y2]] = r.pts;
    if (y1 !== y2) continue;
    for (let x = x1 + 90; x < x2 - 40; x += 180) if (freeForScenery(x, y1 + 40, 4)) trees.push([x, y1 + 40, 0.75, 2]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  let svg = trees.map(([x, y, k, kind]) => treeSvg(x, y, k, kind)).join('');
  const colors = ['#ff8fab', '#ffd43b', '#b197fc', '#74c0fc', '#fff'];
  for (let tries = 0, n = 0; tries < 8000 && n < 520; tries++) {
    const x = 30 + rnd() * (WORLD.w - 60);
    const y = 60 + rnd() * (WORLD.h - 80);
    const d = DISTRICTS.find((r) => x > r.rect[0] && x < r.rect[2] && y > r.rect[1] && y < r.rect[3]);
    if (d && ['stone', 'brick'].includes(d.ground)) continue;
    if (!freeForScenery(x, y, 14)) continue;
    svg += flower(x, y, colors[n % colors.length]);
    n++;
  }
  // rocks and stumps in the countryside and hills
  for (let tries = 0, n = 0; tries < 2000 && n < 40; tries++) {
    const x = 60 + rnd() * 1100;
    const y = 100 + rnd() * 2400;
    if (!freeForScenery(x, y, 20)) continue;
    svg += rnd() < 0.5
      ? `<ellipse cx="${x}" cy="${y}" rx="13" ry="9" fill="#ced4da" stroke="#adb5bd" stroke-width="1.5"/><ellipse cx="${x - 3}" cy="${y - 3}" rx="5" ry="3" fill="#e9ecef"/>`
      : `<ellipse cx="${x}" cy="${y}" rx="12" ry="6" fill="#c08a5b"/><ellipse cx="${x}" cy="${y - 2}" rx="10" ry="4.5" fill="#e6c9a8" stroke="#a9805b"/>`;
    n++;
  }
  // barrels and crates by the shop doors
  for (const p of PLACES.filter((q) => q.kind === 'building' && (q.look.awning || q.sheet === 'canteen'))) {
    const x = p.x + 16;
    const y = p.y + p.h + 4;
    svg += `<rect x="${x - 10}" y="${y - 18}" width="20" height="18" rx="3" fill="#c08a5b" stroke="#8c6239"/><path d="M${x - 10} ${y - 9} H${x + 10}" stroke="#8c6239"/>`;
  }
  for (const [x, y] of [[700, 1360], [1210, 1420], [1830, 820], [2600, 1150], [3000, 1450], [2350, 2440], [900, 2030], [1350, 760]]) {
    if (freeForScenery(x, y, 0)) svg += bench(x, y);
  }
  for (const r of ROADS.filter((q) => q.stone)) {
    const [[x1, y1], [x2, y2]] = r.pts;
    if (y1 !== y2) continue;
    for (let x = x1 + 150; x < x2 - 30; x += 240) svg += lampPost(x, y1 + 34);
  }
  return svg;
}


// ---------- buildings ----------
// Seen from the front and a little above: the roof shows as a slope going back, the wall below,
// and a soft shadow falls to the lower right.

function facade(p) {
  const { x, y, w, h } = p;
  const L = p.look;
  const roofH = { gable: 58, dome: 46, flat: 34, tower: 62, pediment: 40 }[L.roof];
  const by = y + roofH;
  const bh = h - roofH;
  const cx = x + w / 2;
  const line = darker(L.body, 0.18);
  const rc = L.roofColor;
  let svg = `<path d="M${x + w} ${by + 6} L${x + w + 20} ${by + 20} L${x + w + 20} ${y + h + 10} L${x + 16} ${y + h + 10} L${x} ${y + h} Z" fill="rgba(70,50,40,.13)"/>`;

  // wall
  svg += `<rect x="${x}" y="${by}" width="${w}" height="${bh}" rx="5" fill="${L.body}" stroke="${line}" stroke-width="1.5"/>`;
  svg += `<rect x="${x}" y="${y + h - 8}" width="${w}" height="8" rx="3" fill="${darker(L.body, 0.08)}"/>`;

  // roof
  let signY = by - roofH / 2;
  if (L.roof === 'gable' || L.roof === 'tower' || L.roof === 'pediment') {
    const top = y + (L.roof === 'pediment' ? 8 : 4);
    // the slope going back, with rows of tiles, the ridge at the top and the eave at the front
    svg += `<path d="M${x - 10} ${by + 4} L${x + 8} ${top} L${x + w - 8} ${top} L${x + w + 10} ${by + 4} Z" fill="${rc}" stroke="${darker(rc)}" stroke-width="1.5" stroke-linejoin="round"/>`;
    const rows = Math.floor((by - top) / 11);
    for (let i = 1; i < rows; i++) {
      const ry = top + ((by + 4 - top) * i) / rows;
      const k = (ry - top) / (by + 4 - top);
      svg += `<path d="M${x + 8 - 18 * k} ${ry} L${x + w - 8 + 18 * k} ${ry}" stroke="${darker(rc, 0.12)}" stroke-width="1.2" opacity=".6"/>`;
    }
    svg += `<rect x="${x + 2}" y="${top - 5}" width="${w - 4}" height="9" rx="4" fill="${darker(rc, 0.15)}"/>
      <path d="M${x - 10} ${by + 4} L${x + w + 10} ${by + 4}" stroke="${darker(rc, 0.25)}" stroke-width="3" stroke-linecap="round"/>
      <path d="M${x + 14} ${top + 8} L${x + w * 0.4} ${top + 8}" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/>`;
    if (L.roof === 'tower') {
      svg += `<rect x="${cx - 16}" y="${y - 20}" width="32" height="34" fill="${L.body}" stroke="${line}" stroke-width="1.5"/>
        <path d="M${cx - 21} ${y - 18} L${cx} ${y - 50} L${cx + 21} ${y - 18} Z" fill="${darker(rc, 0.1)}" stroke="${darker(rc)}" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="${cx}" cy="${y - 3}" r="7" fill="#fff" stroke="${line}" stroke-width="1.2"/>`;
    }
  } else if (L.roof === 'dome') {
    // a flat roof with a dome sitting on it
    svg += `<rect x="${x - 6}" y="${by - 18}" width="${w + 12}" height="22" rx="4" fill="${lighter(rc, 0.45)}" stroke="${darker(rc)}" stroke-width="1.5"/>
      <path d="M${cx - w * 0.3} ${by - 10} A${w * 0.3} ${roofH - 8} 0 0 1 ${cx + w * 0.3} ${by - 10} Z" fill="${rc}" stroke="${darker(rc)}" stroke-width="1.5"/>
      <path d="M${cx - w * 0.18} ${by - 26} A${w * 0.2} ${roofH - 20} 0 0 1 ${cx} ${y + 4}" stroke="#fff" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>
      <rect x="${x - 6}" y="${by - 2}" width="${w + 12}" height="7" rx="3" fill="${darker(rc, 0.12)}"/>
      <circle cx="${cx}" cy="${y + 4}" r="4" fill="${darker(rc, 0.1)}"/>`;
    signY = by + 20;
  } else {
    // flat: the top of the roof seen from above, with a parapet at the front and a vent
    svg += `<rect x="${x - 5}" y="${y}" width="${w + 10}" height="${roofH}" rx="4" fill="${lighter(rc, 0.55)}" stroke="${darker(rc)}" stroke-width="1.5"/>
      <rect x="${x - 5}" y="${by - 9}" width="${w + 10}" height="12" rx="3" fill="${rc}" stroke="${darker(rc)}" stroke-width="1.2"/>
      <rect x="${x + w - 40}" y="${y + 6}" width="22" height="12" rx="2" fill="#dee2e6" stroke="#adb5bd"/>`;
    signY = by + 20;
  }

  // awning over the shop front
  let winTop = by + 12;
  if (L.awning) {
    const [c1, c2] = L.awning;
    const ay = by + 8;
    const n = Math.round(w / 16);
    const sw = w / n;
    let stripes = '';
    for (let i = 0; i < n; i++) {
      stripes += `<rect x="${x + i * sw}" y="${ay}" width="${sw}" height="14" fill="${i % 2 ? c2 : c1}"/>`;
      stripes += `<path d="M${x + i * sw} ${ay + 14} A${sw / 2} ${sw / 2.6} 0 0 0 ${x + (i + 1) * sw} ${ay + 14} Z" fill="${i % 2 ? c2 : c1}"/>`;
    }
    svg += `<g>${stripes}<rect x="${x}" y="${ay}" width="${w}" height="14" fill="none" stroke="${darker(c1)}" stroke-width="1"/></g>`;
    winTop = ay + 26;
  }

  // windows: a grid above the door, or (one row, or a shop front) a row beside the door
  const doorH = Math.min(34, bh * 0.38);
  const winBottom = y + h - 10;
  const [rows, cols] = L.win;
  const win = (wx, wy, ww, wh) => `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="4" fill="#e7f5ff" stroke="${line}" stroke-width="1.2"/>
    <path d="M${wx + 4} ${wy + wh - 4} L${wx + ww - 6} ${wy + 4}" stroke="#fff" stroke-width="2.4" opacity=".9" stroke-linecap="round"/>`;
  // between columns, if any: the three gaps, the middle one has the door
  const colX = L.extra === 'columns' ? [0, 1, 2].map((i) => x + 10 + (i + 0.5) * ((w - 20) / 3)) : null;
  const xs = (n) => colX || [...Array(n)].map((_, c) => x + 12 + ((w - 24) / n) * (c + 0.5));
  const aboveH = winBottom - doorH - 6 - winTop;
  if (rows === 1 || aboveH / rows < 20) {
    const wh = Math.min(24, winBottom - winTop - 12);
    const wy = winBottom - 4 - wh - Math.max(0, (doorH - wh) / 2);
    const list = xs(Math.max(2, cols + (cols % 2 ? 1 : 0))).filter((cx0) => Math.abs(cx0 - cx) > 24);
    const ww = Math.min(30, (w - 40) / list.length - 10);
    for (const cx0 of list) svg += win(cx0 - ww / 2, wy, ww, wh);
  } else {
    const ww = Math.min(24, (colX ? (w - 20) / 3 : (w - 24) / cols) - 12);
    const wh = Math.min(22, aboveH / rows - 8);
    for (let r = 0; r < rows; r++) {
      const wy = winTop + (aboveH / rows) * (r + 0.5) - wh / 2;
      for (const cx0 of xs(cols)) svg += win(cx0 - ww / 2, wy, ww, wh);
    }
  }

  // door
  const dw = Math.min(26, w * 0.2);
  const dy = y + h - 8 - doorH;
  if (L.extra === 'garage') {
    svg += `<rect x="${x + w - 62}" y="${y + h - 46}" width="52" height="38" rx="3" fill="#ffe066" stroke="${line}" stroke-width="1.2"/>`;
    for (let i = 1; i < 5; i++) svg += `<path d="M${x + w - 62} ${y + h - 46 + i * 7.6} h52" stroke="${line}" stroke-width="1"/>`;
  }
  svg += `<path d="M${cx - dw / 2} ${y + h - 8} V${dy + dw / 2} A${dw / 2} ${dw / 2} 0 0 1 ${cx + dw / 2} ${dy + dw / 2} V${y + h - 8} Z" fill="${darker(rc, 0.12)}" stroke="${darker(rc, 0.3)}" stroke-width="1.2"/>
    <circle cx="${cx + dw / 2 - 5}" cy="${y + h - 8 - doorH / 2.4}" r="1.8" fill="#fff3bf"/>`;

  // extras
  switch (L.extra) {
    case 'columns':
      for (let i = 0; i < 4; i++) {
        const px = x + 10 + i * ((w - 20) / 3) - 4;
        if (Math.abs(px + 4 - cx) < dw) continue;
        svg += `<rect x="${px}" y="${by + 6}" width="8" height="${bh - 14}" rx="2" fill="#fff" stroke="${line}" stroke-width="1"/>`;
      }
      break;
    case 'flag':
      svg += `<path d="M${cx} ${y + 2} V${y - 26}" stroke="#868e96" stroke-width="2"/><path d="M${cx} ${y - 26} L${cx + 18} ${y - 20} L${cx} ${y - 14} Z" fill="#ff6b6b" class="flag"/>`;
      break;
    case 'antenna':
      svg += `<path d="M${cx + 30} ${y} V${y - 22}" stroke="#868e96" stroke-width="2"/><circle cx="${cx + 30}" cy="${y - 24}" r="3" fill="#ff6b6b" class="blink-light"/>`;
      break;
    case 'clock':
      svg += `<circle cx="${cx}" cy="${y + 20}" r="8" fill="#fff" stroke="${darker(rc)}" stroke-width="1.5"/><path d="M${cx} ${y + 20} V${y + 15} M${cx} ${y + 20} H${cx + 4}" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`;
      break;
    case 'balloons':
      svg += `<path d="M${x + w - 8} ${by + 6} q-4 -16 -2 -30" stroke="#adb5bd" fill="none"/><ellipse cx="${x + w - 10}" cy="${by - 30}" rx="7" ry="8.5" fill="#ff8787" class="bob"/>
        <path d="M${x + w - 4} ${by + 6} q4 -14 6 -24" stroke="#adb5bd" fill="none"/><ellipse cx="${x + w + 2}" cy="${by - 22}" rx="6" ry="7.5" fill="#74c0fc" class="bob"/>`;
      break;
    case 'bubbles':
      svg += `<g class="rise"><circle cx="${x + 18}" cy="${y + 6}" r="6" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/><circle cx="${x + 30}" cy="${y - 8}" r="4" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/></g>`;
      break;
    case 'lantern':
      for (const lx of [x + 16, x + w - 16]) svg += `<ellipse cx="${lx}" cy="${by + 30}" rx="7" ry="9" fill="#ff6b6b" stroke="#c92a2a" stroke-width="1"/><rect x="${lx - 4}" y="${by + 19}" width="8" height="3" fill="#ffd43b"/>`;
      break;
    case 'note':
      svg += emo(x + w - 18, y + 6, 18, '🎵', 'class="bob"');
      break;
    case 'cross':
      svg += `<rect x="${cx - 4}" y="${by + 8}" width="8" height="22" rx="2" fill="#ff6b6b"/><rect x="${cx - 11}" y="${by + 15}" width="22" height="8" rx="2" fill="#ff6b6b"/>`;
      break;
  }

  // sign: a round badge with the place's emoji
  if (!['gable', 'tower', 'pediment'].includes(L.roof)) signY = dy - 14;
  if (L.extra !== 'cross' || L.roof !== 'flat') {
    svg += `<circle cx="${cx}" cy="${signY}" r="12" fill="#fff" stroke="${darker(rc, 0.1)}" stroke-width="1.5"/>${emo(cx, signY + 1, 14, p.icon)}`;
  }
  return svg;
}

// Places that aren't plain buildings
const PLACE_ART = {
  forest(p) {
    const rnd = seeded(3);
    let svg = `<ellipse cx="${p.x + p.w / 2}" cy="${p.y + p.h - 30}" rx="${p.w / 2 - 10}" ry="44" fill="#cfe9b6"/>
      <ellipse cx="${p.x + 120}" cy="${p.y + p.h - 26}" rx="70" ry="18" fill="#c9a77c" opacity=".55"/>`;
    const t = [];
    for (let i = 0; i < 16; i++) t.push([p.x + 10 + rnd() * (p.w - 20), p.y + 30 + rnd() * (p.h - 90), 0.9 + rnd() * 0.5]);
    t.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k] of t) svg += treeSvg(x, y, k, 0);
    for (let i = 0; i < 6; i++) svg += emo(p.x + 30 + rnd() * (p.w - 60), p.y + p.h - 40 + rnd() * 26, 13, '🍄');
    return svg + signPost(p.x + p.w - 40, p.y + p.h - 6, p.icon);
  },
  spring(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h - 70;
    let svg = `<ellipse cx="${cx}" cy="${cy}" rx="${p.w / 2 - 6}" ry="56" fill="#ced4da"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${p.w / 2 - 22}" ry="44" fill="#c69c6d"/>
      <ellipse cx="${cx}" cy="${cy - 4}" rx="${p.w / 2 - 34}" ry="32" fill="#d9b48f"/>
      <g class="steam">${[0, 1, 2].map((i) => `<path d="M${cx - 40 + i * 40} ${cy - 20} q-8 -14 0 -26 q8 -12 0 -24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7" style="animation-delay:${-i * 0.8}s"/>`).join('')}</g>`;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      svg += `<ellipse cx="${cx + Math.cos(a) * (p.w / 2 - 12)}" cy="${cy + Math.sin(a) * 52}" rx="11" ry="8" fill="#adb5bd" stroke="#868e96" stroke-width="1"/>`;
    }
    return svg + signPost(p.x + p.w - 20, p.y + p.h - 4, p.icon);
  },
  site(p) {
    const x = p.x;
    const y = p.y;
    let svg = `<rect x="${x}" y="${y + 40}" width="${p.w}" height="${p.h - 40}" rx="10" fill="#f1dcc0" stroke="#e0c3a0" stroke-width="2"/>`;
    // crane
    svg += `<g class="crane"><rect x="${x + 250}" y="${y - 10}" width="8" height="${p.h - 20}" fill="#fab005"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${x + 250} ${y + i * 24} l8 12 M${x + 258} ${y + i * 24} l-8 12" stroke="#e67700" stroke-width="1.3"/>`).join('')}
      <g class="jib"><rect x="${x + 150}" y="${y - 14}" width="160" height="7" fill="#fab005"/>
      <path d="M${x + 190} ${y - 7} V${y + 70}" stroke="#868e96" stroke-width="1.5"/><rect x="${x + 182}" y="${y + 70}" width="16" height="10" fill="#e67700"/></g></g>`;
    // brick pile, cones, unfinished wall
    svg += `<g>${[0, 1, 2].map((r) => [0, 1, 2, 3 - r].map((c) => `<rect x="${x + 22 + c * 15 + r * 7}" y="${y + p.h - 22 - r * 8}" width="14" height="7" rx="1.5" fill="#e8590c" stroke="#c2410c" stroke-width=".8"/>`).join('')).join('')}</g>`;
    for (const cx of [x + 100, x + 300]) svg += `<path d="M${cx - 7} ${y + p.h - 6} L${cx} ${y + p.h - 26} L${cx + 7} ${y + p.h - 6} Z" fill="#ff922b"/><rect x="${cx - 4}" y="${y + p.h - 18}" width="8" height="3" fill="#fff"/>`;
    return svg + signPost(x + 140, y + p.h - 4, p.icon);
  },
  pavilion(p) {
    const cx = p.x + p.w / 2;
    const top = p.y + 10;
    const base = p.y + p.h;
    return `<ellipse cx="${cx}" cy="${base}" rx="${p.w / 2}" ry="7" fill="rgba(90,60,40,.12)"/>
      <rect x="${p.x + 6}" y="${base - 14}" width="${p.w - 12}" height="12" rx="3" fill="#e9d8c4" stroke="#c9b08f"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${p.x + 18 + i * ((p.w - 44) / 3)}" y="${top + 34}" width="8" height="${p.h - 58}" fill="#e03131"/>`).join('')}
      <path d="M${p.x - 6} ${top + 40} Q${cx} ${top + 22} ${p.x + p.w + 6} ${top + 40} L${p.x + p.w - 16} ${top + 18} L${cx} ${top - 6} L${p.x + 16} ${top + 18} Z" fill="#2f9e44" stroke="#2b8a3e" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="${cx}" cy="${top - 8}" r="4" fill="#fcc419"/>
      <rect x="${cx - 26}" y="${base - 40}" width="52" height="8" rx="2" fill="#c08a5b"/><rect x="${cx - 3}" y="${base - 32}" width="6" height="18" fill="#a9805b"/>
      ${emo(cx, base - 46, 14, '♟️')}`;
  },
  stage(p) {
    const x = p.x;
    const base = p.y + p.h;
    return `<ellipse cx="${x + p.w / 2}" cy="${base}" rx="${p.w / 2}" ry="7" fill="rgba(90,60,40,.12)"/>
      <rect x="${x}" y="${base - 30}" width="${p.w}" height="28" rx="4" fill="#c08a5b" stroke="#8c6239"/>
      <rect x="${x + 6}" y="${p.y + 8}" width="${p.w - 12}" height="${p.h - 38}" rx="4" fill="#5f3dc4"/>
      <path d="M${x + 6} ${p.y + 8} q24 ${p.h * 0.4} 4 ${p.h - 38} h-4 Z M${x + p.w - 6} ${p.y + 8} q-24 ${p.h * 0.4} -4 ${p.h - 38} h4 Z" fill="#e03131"/>
      <path d="M${x} ${p.y + 2} H${x + p.w}" stroke="#e03131" stroke-width="10" stroke-linecap="round"/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${x + 20 + i * ((p.w - 40) / 4)}" cy="${p.y + 2}" r="3.5" fill="#fff3bf" class="twinkle" style="animation-delay:${-i * 0.3}s"/>`).join('')}
      ${emo(x + p.w / 2, p.y + 40, 18, '🎤')}`;
  },
  plaza(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2 + 10;
    let svg = `<ellipse cx="${cx}" cy="${cy}" rx="${p.w / 2 - 6}" ry="${p.h / 2 - 2}" fill="#f1e3d3" stroke="#e5d0bb" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${p.w / 3}" ry="${p.h / 3}" fill="none" stroke="#e5d0bb" stroke-width="2" stroke-dasharray="6 6"/>`;
    for (const [fx, fy] of [[p.x + 40, p.y + 40], [p.x + p.w - 40, p.y + 40]]) svg += bush(fx, fy, 1.2) + flower(fx - 10, fy + 6, '#ff8fab') + flower(fx + 10, fy + 4, '#ffd43b');
    return svg + bench(p.x + 60, p.y + p.h - 10) + bench(p.x + p.w - 60, p.y + p.h - 10);
  },
  field(p) {
    const { x, y, w, h } = p;
    return `<rect x="${x}" y="${y + 10}" width="${w}" height="${h - 10}" rx="8" fill="#8ce99a" stroke="#fff" stroke-width="3"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${x + 4 + i * ((w - 8) / 6)}" y="${y + 13}" width="${(w - 8) / 12}" height="${h - 16}" fill="#a9e9b3" opacity=".6"/>`).join('')}
      <path d="M${x + w / 2} ${y + 13} V${y + h - 3}" stroke="#fff" stroke-width="2"/>
      <circle cx="${x + w / 2}" cy="${y + h / 2 + 5}" r="18" fill="none" stroke="#fff" stroke-width="2"/>
      <rect x="${x + 2}" y="${y + h / 2 - 18}" width="10" height="44" fill="none" stroke="#fff" stroke-width="3"/>
      <rect x="${x + w - 12}" y="${y + h / 2 - 18}" width="10" height="44" fill="none" stroke="#fff" stroke-width="3"/>`;
  },
  lake(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2 + 6;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${p.w / 2}" ry="${p.h / 2 - 6}" fill="#a5d8ff" stroke="#d0ebff" stroke-width="5"/>
      <path d="M${cx - 50} ${cy - 10} q10 -5 20 0 M${cx + 10} ${cy + 20} q10 -5 20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
      <g class="paddle">${emo(cx - 30, cy + 4, 18, '🦆')}</g><g class="paddle" style="animation-delay:-2s">${emo(cx + 34, cy - 16, 14, '🦆')}</g>
      ${[0, 1, 2].map((i) => `<path d="M${p.x + 10 + i * 6} ${cy + 26} q-2 -16 2 -26" stroke="#69db7c" stroke-width="2.5" fill="none"/>`).join('')}`;
  },
  houses(p) {
    let svg = '';
    const colors = [['#ffe3e3', '#ff8787'], ['#e3fafc', '#3bc9db'], ['#fff3bf', '#fab005']];
    COTTAGES.forEach(([dx, dy], i) => (svg += cottage(p.x + dx, p.y + dy, COTTAGE_W, COTTAGE_H, colors[i][0], colors[i][1])));
    return svg;
  },
};

// A little house with its gable to the front; the two roof slopes run back and up
function cottage(x, y, w, h, body, roof) {
  const cx = x + w / 2;
  const eave = y + 56;
  const peak = y + 26;
  return `<path d="M${x + w} ${eave} L${x + w + 16} ${eave + 12} L${x + w + 16} ${y + h + 8} L${x + 12} ${y + h + 8} L${x} ${y + h} Z" fill="rgba(70,50,40,.13)"/>
    <path d="M${x - 6} ${eave} L${cx} ${peak} L${cx} ${y} L${x - 6} ${eave - 26} Z" fill="${darker(roof, 0.12)}" stroke="${darker(roof)}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M${x + w + 6} ${eave} L${cx} ${peak} L${cx} ${y} L${x + w + 6} ${eave - 26} Z" fill="${roof}" stroke="${darker(roof)}" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="${x + 6}" y="${eave - 4}" width="${w - 12}" height="${y + h - eave + 4}" rx="5" fill="${body}" stroke="${darker(body, 0.18)}" stroke-width="1.5"/>
    <path d="M${x + 2} ${eave} L${cx} ${peak} L${x + w - 2} ${eave} Z" fill="${lighter(body, 0.3)}" stroke="${darker(body, 0.18)}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${eave - 10}" r="7" fill="#e7f5ff" stroke="${darker(body, 0.18)}"/>
    <rect x="${x + 20}" y="${eave + 14}" width="24" height="22" rx="4" fill="#e7f5ff" stroke="${darker(body, 0.18)}"/>
    <rect x="${x + w - 44}" y="${eave + 14}" width="24" height="22" rx="4" fill="#e7f5ff" stroke="${darker(body, 0.18)}"/>
    <path d="M${cx - 12} ${y + h} V${y + h - 30} a12 12 0 0 1 24 0 V${y + h} Z" fill="${darker(roof, 0.1)}"/>`;
}

const signPost = (x, y, icon) => `<g><rect x="${x - 2}" y="${y - 30}" width="4" height="30" fill="#a9805b"/>
  <rect x="${x - 16}" y="${y - 42}" width="32" height="22" rx="5" fill="#fff4e6" stroke="#c08a5b" stroke-width="1.5"/>${emo(x, y - 31, 13, icon)}</g>`;

// ---------- the pig's home, by house tier ----------

function homeExterior(p, tier) {
  const { x, y, w, h } = p;
  const cx = x + w / 2;
  const base = y + h;
  const shadow = `<ellipse cx="${cx}" cy="${base}" rx="${w / 2 + 6}" ry="6" fill="rgba(90,60,40,.12)"/>`;
  const door = (dx, dh = 30) => `<path d="M${dx - 12} ${base - 6} V${base - dh} a12 12 0 0 1 24 0 V${base - 6} Z" fill="#e64980" stroke="#c2255c" stroke-width="1.2"/>
    <circle cx="${dx + 6}" cy="${base - dh / 2 - 4}" r="1.8" fill="#fff3bf"/>`;
  const win = (wx, wy, s = 18) => `<rect x="${wx}" y="${wy}" width="${s}" height="${s}" rx="5" fill="#fff3bf" stroke="#e599b4" stroke-width="1.2" class="homewin"/>
    <path d="M${wx + s / 2} ${wy} V${wy + s} M${wx} ${wy + s / 2} H${wx + s}" stroke="#e599b4" stroke-width="1"/>`;
  const chimney = (cxx, cy) => `<rect x="${cxx}" y="${cy}" width="12" height="22" fill="#ffa8a8" stroke="#e599b4"/>
    <circle class="puff" cx="${cxx + 6}" cy="${cy - 8}" r="5"/><circle class="puff" cx="${cxx + 10}" cy="${cy - 16}" r="4" style="animation-delay:-1.6s"/>`;
  let svg = shadow;
  if (tier === 0) {
    // round little pig hut
    svg += `${chimney(cx + 26, y + 34)}
      <path d="M${x + 14} ${base - 6} V${y + 80} A${w / 2 - 14} ${70} 0 0 1 ${x + w - 14} ${y + 80} V${base - 6} Z" fill="#ffd6e2" stroke="#f2a0b8" stroke-width="2"/>
      <path d="M${x + 14} ${y + 80} A${w / 2 - 14} 70 0 0 1 ${x + w - 14} ${y + 80}" fill="none" stroke="#ff8fab" stroke-width="10" stroke-linecap="round"/>
      <path d="M${cx - 36} ${y + 42} Q${cx} ${y + 26} ${cx + 30} ${y + 40}" stroke="#fff" stroke-width="4" fill="none" opacity=".5" stroke-linecap="round"/>
      ${win(x + 30, y + 76)}${win(x + w - 48, y + 76)}${door(cx)}
      <ellipse cx="${cx}" cy="${y + 66}" rx="9" ry="6" fill="#ff9fbc"/><circle cx="${cx - 3}" cy="${y + 66}" r="1.6" fill="#c94f76"/><circle cx="${cx + 3}" cy="${y + 66}" r="1.6" fill="#c94f76"/>`;
  } else if (tier === 1) {
    svg += `${chimney(x + w - 40, y + 2)}
      <rect x="${x + 14}" y="${y + 34}" width="${w - 28}" height="${h - 40}" rx="6" fill="#fff0f6" stroke="#f2a0b8" stroke-width="2"/>
      <path d="M${x + 4} ${y + 38} L${cx} ${y + 4} L${x + w - 4} ${y + 38} Z" fill="#ff8fab" stroke="#e64980" stroke-width="1.5" stroke-linejoin="round"/>
      ${win(x + 30, y + 46)}${win(x + w - 48, y + 46)}${win(x + 30, y + 92)}
      <rect x="${x + 20}" y="${y + 74}" width="${w - 40}" height="6" rx="2" fill="#f783ac"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${x + 24 + i * ((w - 50) / 5)}" y="${y + 66}" width="2.5" height="9" fill="#f783ac"/>`).join('')}
      ${door(cx)}`;
  } else if (tier === 2) {
    svg += `<rect x="${x - 6}" y="${base - 22}" width="${w + 12}" height="16" rx="3" fill="#b2f2bb"/>
      ${[...Array(12)].map((_, i) => `<rect x="${x - 4 + i * ((w + 8) / 11)}" y="${base - 26}" width="4" height="20" rx="2" fill="#fff" stroke="#dee2e6" stroke-width=".8"/>`).join('')}
      ${chimney(x + 30, y + 4)}
      <rect x="${x + 8}" y="${y + 36}" width="${w - 16}" height="${h - 58}" rx="6" fill="#fff9db" stroke="#f2c94c" stroke-width="2"/>
      <path d="M${x - 2} ${y + 40} L${x + w * 0.35} ${y + 6} L${x + w * 0.65} ${y + 6} L${x + w + 2} ${y + 40} Z" fill="#74c0fc" stroke="#4dabf7" stroke-width="1.5" stroke-linejoin="round"/>
      ${win(x + 20, y + 46)}${win(cx - 9, y + 46)}${win(x + w - 38, y + 46)}${win(x + 20, y + 80)}${win(x + w - 38, y + 80)}
      ${door(cx, 32)}${flower(x + 2, base - 12, '#ff8fab')}${flower(x + w - 2, base - 14, '#b197fc')}`;
  } else {
    // castle: two round towers with flags
    const tower = (tx) => `<rect x="${tx}" y="${y + 24}" width="34" height="${h - 30}" rx="4" fill="#ffd6e2" stroke="#f2a0b8" stroke-width="1.5"/>
      <path d="M${tx - 4} ${y + 26} L${tx + 17} ${y - 8} L${tx + 38} ${y + 26} Z" fill="#cc5de8" stroke="#ae3ec9" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M${tx + 17} ${y - 8} V${y - 24}" stroke="#868e96" stroke-width="1.5"/><path d="M${tx + 17} ${y - 24} l14 4 l-14 4 Z" fill="#ff6b9d" class="flag"/>
      ${win(tx + 10, y + 40, 14)}`;
    svg += `<rect x="${x + 26}" y="${y + 44}" width="${w - 52}" height="${h - 50}" fill="#fff0f6" stroke="#f2a0b8" stroke-width="1.5"/>
      ${[...Array(6)].map((_, i) => `<rect x="${x + 28 + i * ((w - 62) / 5)}" y="${y + 34}" width="10" height="12" fill="#fff0f6" stroke="#f2a0b8" stroke-width="1.2"/>`).join('')}
      ${tower(x)}${tower(x + w - 34)}
      ${win(cx - 26, y + 58, 16)}${win(cx + 10, y + 58, 16)}
      <path d="M${cx - 16} ${base - 6} V${base - 36} a16 16 0 0 1 32 0 V${base - 6} Z" fill="#e64980" stroke="#c2255c" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${y + 48}" r="8" fill="#ffd43b" stroke="#f59f00"/>${emo(cx, y + 49, 10, '🐷')}`;
  }
  return svg;
}

// ---------- donated monuments ----------

const DONATION_ART = {
  fountain: ({ x, y }) => `<ellipse cx="${x}" cy="${y}" rx="42" ry="14" fill="#d0ebff" stroke="#a5d8ff" stroke-width="3"/>
    <rect x="${x - 5}" y="${y - 30}" width="10" height="28" fill="#e9ecef"/><ellipse cx="${x}" cy="${y - 30}" rx="18" ry="5" fill="#d0ebff" stroke="#a5d8ff" stroke-width="2"/>
    <g class="spray"><path d="M${x} ${y - 34} q-14 -20 -26 4 M${x} ${y - 34} q14 -20 26 4 M${x} ${y - 34} v-18" stroke="#74c0fc" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`,
  statue: ({ x, y }) => `<rect x="${x - 26}" y="${y - 24}" width="52" height="24" rx="4" fill="#e9ecef" stroke="#ced4da" stroke-width="1.5"/>
    <g class="gold-pig" transform="translate(${x - 34} ${y - 84}) scale(.42)"></g>`,
  ferris: ({ x, y }) => `<path d="M${x - 30} ${y} L${x} ${y - 70} L${x + 30} ${y}" stroke="#adb5bd" stroke-width="4" fill="none"/>
    <g class="wheel-spin" style="transform-origin:${x}px ${y - 70}px"><circle cx="${x}" cy="${y - 70}" r="58" fill="none" stroke="#f783ac" stroke-width="4"/>
    ${[...Array(8)].map((_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M${x} ${y - 70} L${x + Math.cos(a) * 58} ${y - 70 + Math.sin(a) * 58}" stroke="#faa2c1" stroke-width="2"/>
      <circle cx="${x + Math.cos(a) * 58}" cy="${y - 70 + Math.sin(a) * 58}" r="9" fill="${['#ff8787', '#ffd43b', '#74c0fc', '#b197fc'][i % 4]}" stroke="#fff" stroke-width="2"/>`; }).join('')}</g>
    <circle cx="${x}" cy="${y - 70}" r="6" fill="#e64980"/>`,
  bridge: ({ x, y }) => `<path d="M${x - 90} ${y} Q${x} ${y - 70} ${x + 90} ${y}" fill="none" stroke="#ff8787" stroke-width="7"/>
    <path d="M${x - 82} ${y} Q${x} ${y - 60} ${x + 82} ${y}" fill="none" stroke="#ffd43b" stroke-width="7"/>
    <path d="M${x - 74} ${y} Q${x} ${y - 50} ${x + 74} ${y}" fill="none" stroke="#8ce99a" stroke-width="7"/>
    <path d="M${x - 66} ${y} Q${x} ${y - 40} ${x + 66} ${y}" fill="none" stroke="#74c0fc" stroke-width="7"/>
    <path d="M${x - 58} ${y} Q${x} ${y - 30} ${x + 58} ${y}" fill="none" stroke="#b197fc" stroke-width="7"/>`,
};

// ---------- animal neighbours ----------

const SPECIES = {
  dog: { body: '#f2a65a', belly: '#fff4e6', ears: 'tri', inner: '#ffd8a8', snout: 'muzzle', tail: 'curl' },
  rabbit: { body: '#f8f9fa', line: '#dee2e6', belly: '#ffffff', ears: 'long', inner: '#ffc9c9', snout: 'bunny', acc: 'apron' },
  raccoon: { body: '#adb5bd', belly: '#e9ecef', ears: 'round', inner: '#495057', snout: 'muzzle', mask: true, tail: 'stripe' },
  squirrel: { body: '#e8833a', belly: '#ffe8cc', ears: 'tuft', inner: '#ffc078', snout: 'small', tail: 'bushy' },
  cat: { body: '#b8c0d8', belly: '#f1f3f5', ears: 'tri', inner: '#ffc9de', snout: 'cat', acc: 'bell' },
  bear: { body: '#b07d56', belly: '#e6c9a8', ears: 'round', inner: '#e6c9a8', snout: 'muzzle', acc: 'pencil' },
  sheep: { body: '#ffffff', line: '#dee2e6', belly: '#fff', head: '#ffe8d6', ears: 'floppy', inner: '#ffd8c2', snout: 'small', wool: true, acc: 'nurse' },
  owl: { body: '#a47148', belly: '#f1dcc5', ears: 'owl', snout: 'beak', discs: true, acc: 'specs' },
  turtle: { body: '#8ce99a', belly: '#d8f5a2', ears: 'none', snout: 'small', shell: true },
  duck: { body: '#fff9db', line: '#ffe066', belly: '#fff', ears: 'none', snout: 'bill', acc: 'chef' },
};

function animalSvg(species) {
  const sp = SPECIES[species];
  const line = sp.line || darker(sp.body, 0.25);
  const head = sp.head || sp.body;
  const O = `stroke="${line}" stroke-width="1.6"`;
  let back = '';
  if (sp.tail === 'curl') back += `<path d="M112 118 q16 -6 14 -20 q-2 -8 -9 -2" fill="none" stroke="${sp.body}" stroke-width="7" stroke-linecap="round"/>`;
  if (sp.tail === 'stripe') back += `<path d="M110 126 q30 -4 30 -26" fill="none" stroke="#868e96" stroke-width="12" stroke-linecap="round"/><path d="M128 120 l6 -4 M135 110 l6 -2" stroke="#495057" stroke-width="5" stroke-linecap="round"/>`;
  if (sp.tail === 'bushy') back += `<path d="M108 132 C150 130 152 70 128 52 C112 42 104 62 120 72 C134 84 126 112 106 116 Z" fill="${sp.body}" ${O}/><path d="M120 66 C134 80 132 106 114 114" fill="none" stroke="${sp.belly}" stroke-width="5" stroke-linecap="round" opacity=".7"/>`;
  let ears = '';
  const earL = (d) => `<path d="${d}" fill="${head}" ${O}/>`;
  switch (sp.ears) {
    case 'tri':
      ears = `${earL('M38 48 L40 12 L68 30 Z')}${earL('M122 48 L120 12 L92 30 Z')}<path d="M44 40 L45 22 L60 32 Z M116 40 L115 22 L100 32 Z" fill="${sp.inner}"/>`;
      break;
    case 'long':
      ears = `<g class="ear ear-l">${earL('M52 32 C40 -10 56 -24 64 -4 C68 8 66 22 64 30 Z')}<path d="M55 26 C48 0 56 -12 60 -2 C62 8 61 18 60 24 Z" fill="${sp.inner}"/></g>
        <g class="ear ear-r">${earL('M108 32 C120 -10 104 -24 96 -4 C92 8 94 22 96 30 Z')}<path d="M105 26 C112 0 104 -12 100 -2 C98 8 99 18 100 24 Z" fill="${sp.inner}"/></g>`;
      break;
    case 'round':
      ears = `<circle cx="42" cy="32" r="15" fill="${head}" ${O}/><circle cx="118" cy="32" r="15" fill="${head}" ${O}/>
        <circle cx="42" cy="32" r="8" fill="${sp.inner}"/><circle cx="118" cy="32" r="8" fill="${sp.inner}"/>`;
      break;
    case 'tuft':
      ears = `${earL('M42 42 L44 8 L50 0 L52 10 L66 30 Z')}${earL('M118 42 L116 8 L110 0 L108 10 L94 30 Z')}<path d="M47 34 L48 16 L58 30 Z M113 34 L112 16 L102 30 Z" fill="${sp.inner}"/>`;
      break;
    case 'floppy':
      ears = `<ellipse cx="28" cy="60" rx="16" ry="8" transform="rotate(-25 28 60)" fill="${sp.inner}" ${O}/><ellipse cx="132" cy="60" rx="16" ry="8" transform="rotate(25 132 60)" fill="${sp.inner}" ${O}/>`;
      break;
    case 'owl':
      ears = `<path d="M40 40 L36 10 L60 28 Z M120 40 L124 10 L100 28 Z" fill="${darker(sp.body, 0.1)}" ${O}/>`;
      break;
  }
  const body = sp.shell
    ? `<ellipse cx="80" cy="114" rx="40" ry="28" fill="#94d82d" stroke="#5c940d" stroke-width="2"/>
       <path d="M62 100 l18 -10 l18 10 l0 18 l-18 10 l-18 -10 Z" fill="#a9e34b" stroke="#5c940d" stroke-width="1.5"/>
       <path d="M44 110 l18 -10 M98 100 l18 10 M62 118 l-18 6 M98 118 l18 6" stroke="#5c940d" stroke-width="1.5"/>`
    : `<ellipse cx="80" cy="116" rx="35" ry="25" fill="${sp.body}" ${O}/><ellipse cx="80" cy="122" rx="18" ry="11" fill="${sp.belly}" opacity=".9"/>`;
  const wool = sp.wool
    ? [...Array(10)].map((_, i) => { const a = Math.PI + (i / 9) * Math.PI; return `<circle cx="${80 + Math.cos(a) * 40}" cy="${116 + Math.sin(a) * 22}" r="9" fill="#fff" ${O}/>`; }).join('') +
      `<circle cx="66" cy="28" r="10" fill="#fff" ${O}/><circle cx="80" cy="22" r="11" fill="#fff" ${O}/><circle cx="94" cy="28" r="10" fill="#fff" ${O}/>`
    : '';
  const limbs = `<ellipse cx="63" cy="137" rx="9.5" ry="7" fill="${sp.shell ? sp.body : darker(sp.body, 0.06)}" ${O}/>
    <ellipse cx="97" cy="137" rx="9.5" ry="7" fill="${sp.shell ? sp.body : darker(sp.body, 0.06)}" ${O}/>
    <ellipse cx="46" cy="114" rx="7" ry="9" fill="${sp.body}" ${O}/><ellipse cx="114" cy="114" rx="7" ry="9" fill="${sp.body}" ${O}/>`;
  let face = '';
  if (sp.mask) face += `<path d="M30 62 Q58 40 80 58 Q102 40 130 62 Q120 82 100 74 Q80 66 60 74 Q40 82 30 62 Z" fill="#495057"/>`;
  if (sp.discs) face += `<circle cx="58" cy="64" r="19" fill="${sp.belly}"/><circle cx="102" cy="64" r="19" fill="${sp.belly}"/>`;
  face += eyeSvg(58, 64, 'normal') + eyeSvg(102, 64, 'normal');
  face += `<ellipse cx="42" cy="84" rx="10" ry="6" fill="#ff8fab" opacity=".45"/><ellipse cx="118" cy="84" rx="10" ry="6" fill="#ff8fab" opacity=".45"/>`;
  switch (sp.snout) {
    case 'muzzle':
      face += `<ellipse cx="80" cy="88" rx="18" ry="13" fill="${sp.belly}" ${O}/><ellipse cx="80" cy="82" rx="6" ry="4.5" fill="#4a2c38"/>
        <path class="line thin" d="M74 93 Q77 97 80 93 Q83 97 86 93"/>`;
      break;
    case 'bunny':
      face += `<path d="M76 82 L84 82 L80 87 Z" fill="#ff8fab"/><path class="line thin" d="M80 87 V91 M74 92 Q77 96 80 91 Q83 96 86 92"/>
        <rect x="77" y="92" width="6" height="6" rx="1.5" fill="#fff" stroke="#dee2e6"/>`;
      break;
    case 'cat':
      face += `<path d="M76 82 L84 82 L80 87 Z" fill="#ff8fab"/><path class="line thin" d="M74 92 Q77 96 80 90 Q83 96 86 92"/>
        <path d="M60 86 L40 82 M60 90 L40 92 M100 86 L120 82 M100 90 L120 92" stroke="#868e96" stroke-width="1.3" stroke-linecap="round"/>`;
      break;
    case 'beak':
      face += `<path d="M72 80 L88 80 L80 96 Z" fill="#ff922b" stroke="#e8590c" stroke-width="1.2" stroke-linejoin="round"/>`;
      break;
    case 'bill':
      face += `<ellipse cx="80" cy="88" rx="20" ry="9" fill="#ff922b" stroke="#e8590c" stroke-width="1.2"/><path d="M64 88 Q80 93 96 88" stroke="#e8590c" stroke-width="1.2" fill="none"/>`;
      break;
    default:
      face += `<ellipse cx="80" cy="84" rx="4.5" ry="3.2" fill="#4a2c38"/><path class="line thin" d="M74 91 Q77 95 80 91 Q83 95 86 91"/>`;
  }
  let acc = '';
  switch (sp.acc) {
    case 'apron':
      acc = `<path d="M64 104 H96 L92 132 Q80 136 68 132 Z" fill="#ffc9de" stroke="#f783ac" stroke-width="1.2"/><path d="M72 116 h16" stroke="#fff" stroke-width="2"/>`;
      break;
    case 'bell':
      acc = `<path d="M60 104 Q80 112 100 104" stroke="#e64980" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="80" cy="112" r="5" fill="#fcc419" stroke="#f59f00"/>`;
      break;
    case 'pencil':
      acc = `<rect x="100" y="22" width="30" height="6" rx="2" transform="rotate(-20 115 25)" fill="#fcc419" stroke="#f59f00"/>`;
      break;
    case 'nurse':
      acc = `<path d="M58 30 Q80 12 102 30 L98 40 Q80 34 62 40 Z" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><rect x="77" y="22" width="6" height="14" fill="#ff6b6b"/><rect x="73" y="26" width="14" height="6" fill="#ff6b6b"/>`;
      break;
    case 'specs':
      acc = `<g fill="none" stroke="#4a2c38" stroke-width="2"><circle cx="58" cy="64" r="13"/><circle cx="102" cy="64" r="13"/><path d="M71 62 Q80 58 89 62"/></g>`;
      break;
    case 'chef':
      acc = `<rect x="58" y="22" width="44" height="14" rx="3" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/>
        <circle cx="64" cy="14" r="11" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><circle cx="80" cy="8" r="13" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><circle cx="96" cy="14" r="11" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/>
        <rect x="59" y="22" width="42" height="10" fill="#fff"/>`;
      break;
  }
  return `<svg viewBox="-4 -26 168 178" width="168" height="178"><ellipse cx="80" cy="146" rx="34" ry="5" fill="rgba(90,60,40,.16)"/>
    <g class="breathe">${back}${wool}${body}${limbs}${ears}<ellipse cx="80" cy="66" rx="48" ry="42" fill="${head}" ${O}/>${face}${acc}</g></svg>`;
}

// ---------- room interiors (cut-away bubbles, 220×140) ----------
// items: [emoji, x, y, size]; pig: where the pig stands; pose: its pose class there.
// draw(ctx) adds anything that changes with progress.

const ROOMS = {
  class: {
    wall: '#fff9db', floor: '#e9c99b', pose: 'studying', pig: { x: 96, y: 128 },
    draw: ({ snap }) => {
      const c = COURSE_BY_ID[snap.s.activity.id];
      return `<div class="rm-board">${c.icon}<small>${esc(c.name)}</small></div>
        <div class="rm-npc" style="left:168px;top:56px">${animalSvg('owl')}</div>`;
    },
    items: [['🪑', 70, 118, 22]],
    fx: ['💡', '✏️', '📖'],
  },
  canteen: {
    wall: '#fff4e6', floor: '#e9c99b', pose: 'dining', pig: { x: 80, y: 128 },
    items: [['🍱', 112, 112, 22], ['🥢', 130, 104, 14]],
    draw: () => `<div class="rm-counter"></div><div class="rm-npc" style="left:156px;top:46px">${animalSvg('duck')}</div><div class="rm-steam"></div>`,
    fx: ['😋', '♨️'],
  },
  clinic: {
    wall: '#f1f9ff', floor: '#d0ebff', pig: { x: 86, y: 128 },
    items: [['💊', 30, 40, 18], ['🩹', 52, 40, 16]],
    draw: () => `<div class="rm-bed"></div><div class="rm-npc" style="left:150px;top:52px">${animalSvg('sheep')}</div>`,
    fx: ['💗', '🌡️'],
  },
  dishes: {
    wall: '#e3fafc', floor: '#c5f6fa', pose: 'working', pig: { x: 110, y: 130 },
    draw: ({ progress }) => {
      const dirty = Math.round((1 - progress) * 6);
      const clean = Math.round(progress * 6);
      const stack = (n, cls) => [...Array(n)].map((_, i) => `<i class="${cls}" style="bottom:${i * 6}px"></i>`).join('');
      return `<div class="rm-sink"><span class="soap-b"></span><span class="soap-b"></span><span class="soap-b"></span></div>
        <div class="rm-stack" style="left:22px">${stack(dirty, 'dirty')}</div>
        <div class="rm-stack" style="left:172px">${stack(clean, 'clean')}${clean ? '<b class="sparkle">✨</b>' : ''}</div>`;
    },
    fx: ['🫧', '💦'],
  },
  museum: {
    wall: '#edf2ff', floor: '#bac8ff', pose: 'working', pig: { x: 90, y: 128 },
    items: [['🔭', 150, 92, 40], ['🪐', 40, 34, 22], ['⭐', 80, 24, 14], ['🌙', 180, 26, 16], ['🐰', 36, 116, 18], ['🐻', 56, 120, 18]],
    fx: ['❓', '💡'],
  },
  rocket: {
    wall: '#1c2541', floor: '#3a506b', pose: 'working', pig: { x: 70, y: 128 },
    items: [['⭐', 30, 30, 12], ['✨', 180, 22, 12], ['🌍', 190, 70, 20]],
    draw: ({ progress }) => `<div class="rm-rocket" style="transform:translateY(${-progress * 60}px)">🚀</div>`,
    fx: ['💡', '🔥'],
  },
  shop: {
    wall: '#ebfbee', floor: '#d8f5a2', pose: 'working', pig: { x: 80, y: 126 },
    items: [['🥤', 30, 34, 16], ['🍫', 54, 34, 16], ['🍪', 78, 34, 16], ['🧃', 102, 34, 16], ['💰', 122, 98, 18], ['🐰', 176, 110, 22]],
    draw: () => '<div class="rm-shelf"></div><div class="rm-counter low"></div>',
    fx: ['🪙', '🧾'],
  },
  piano: {
    wall: '#f8f0fc', floor: '#e5dbff', pose: 'studying', pig: { x: 80, y: 128 },
    items: [['🎹', 130, 100, 42], ['🐥', 186, 118, 18], ['🐱', 170, 122, 16]],
    fx: ['🎵', '🎶'],
  },
  easel: {
    wall: '#fff0f6', floor: '#fcc2d7', pose: 'studying', pig: { x: 80, y: 128 },
    items: [['🖼️', 140, 84, 40], ['🎨', 180, 110, 22], ['🐰', 30, 120, 18]],
    fx: ['🖍️', '✨'],
  },
  tutor: {
    wall: '#fff9db', floor: '#ffe8cc', pose: 'studying', pig: { x: 80, y: 128 },
    items: [['📚', 130, 98, 22], ['✏️', 150, 104, 16], ['🐻', 170, 112, 26]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['✏️', '💡', '✔️'],
  },
  draw: {
    wall: '#fff4e6', floor: '#ffe8cc', pose: 'studying', pig: { x: 90, y: 128 },
    items: [['📚', 150, 98, 24], ['🖍️', 128, 102, 16], ['☕', 174, 102, 14]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🖍️', '🌈'],
  },
  lab: {
    wall: '#e6fcf5', floor: '#c3fae8', pose: 'working', pig: { x: 76, y: 128 },
    items: [['🧪', 126, 96, 22], ['⚗️', 150, 94, 22], ['🔬', 176, 96, 22]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🫧', '💥', '💡'],
  },
  kinder: {
    wall: '#fff3bf', floor: '#ffd8a8', pose: 'working', pig: { x: 110, y: 120 },
    items: [['🐥', 50, 116, 20], ['🐰', 76, 128, 20], ['🐻', 146, 128, 20], ['🐱', 170, 116, 20], ['🧩', 30, 30, 16], ['🎈', 190, 30, 18]],
    fx: ['🎵', '💗'],
  },
  bank: {
    wall: '#fff0f6', floor: '#ffdeeb', pose: 'working', pig: { x: 80, y: 126 },
    items: [['🐷', 166, 42, 34], ['🪙', 120, 96, 16], ['🪙', 132, 94, 16], ['💰', 150, 96, 18], ['🐻', 188, 116, 20]],
    draw: () => '<div class="rm-counter low"></div>',
    fx: ['🪙', '🧾'],
  },
  fund: {
    wall: '#e7f5ff', floor: '#a5d8ff', pose: 'studying', pig: { x: 70, y: 128 },
    draw: () => `<div class="rm-screen"><svg viewBox="0 0 90 46"><polyline class="chart" points="2,40 14,34 26,36 38,24 50,28 62,16 74,18 88,6" fill="none" stroke="#40c057" stroke-width="3" stroke-linejoin="round"/></svg></div>`,
    items: [['📈', 190, 100, 18], ['☕', 120, 104, 14]],
    fx: ['📈', '🪙'],
  },
  code: {
    wall: '#f1f3f5', floor: '#ced4da', pose: 'studying', pig: { x: 90, y: 128 },
    items: [['💻', 148, 96, 30], ['☕', 180, 104, 14], ['🪴', 30, 112, 22]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['⌨️', '💡', '🐛'],
  },
  design: {
    wall: '#fff0f6', floor: '#fcc2d7', pose: 'studying', pig: { x: 90, y: 128 },
    items: [['🎨', 150, 96, 26], ['🖌️', 176, 102, 16], ['📐', 34, 40, 18]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['✨', '🌈'],
  },
  court: {
    wall: '#fff9db', floor: '#e9c99b', pose: 'working', pig: { x: 80, y: 128 },
    items: [['⚖️', 150, 66, 30], ['📜', 120, 104, 18], ['🦊', 190, 112, 22]],
    draw: () => '<div class="rm-counter low"></div>',
    fx: ['❗', '📜'],
  },
  ward: {
    wall: '#f1f9ff', floor: '#d0ebff', pose: 'working', pig: { x: 70, y: 128 },
    items: [['🩺', 100, 100, 18], ['💉', 34, 38, 16]],
    draw: () => '<div class="rm-bed right"><b>🐰</b></div>',
    fx: ['💗', '🩹'],
  },
  concert: {
    wall: '#2b1a3a', floor: '#5f3dc4', pose: 'working', pig: { x: 110, y: 126 },
    items: [['🎻', 140, 104, 24], ['🎼', 70, 98, 20], ['🐰', 30, 128, 16], ['🐻', 190, 128, 16]],
    draw: () => '<div class="rm-spot"></div>',
    fx: ['🎵', '🎶', '👏'],
  },
  gallery: {
    wall: '#f8f9fa', floor: '#e9ecef', pose: 'studying', pig: { x: 70, y: 128 },
    items: [['🖼️', 30, 32, 18], ['🖼️', 190, 30, 18]],
    draw: ({ progress }) => `<div class="rm-canvas"><i style="clip-path:inset(0 ${100 - progress * 100}% 0 0)"></i></div>`,
    fx: ['🎨', '✨'],
  },
  lecture: {
    wall: '#f3f0ff', floor: '#d0bfff', pose: 'working', pig: { x: 60, y: 120 },
    items: [['🐰', 120, 128, 18], ['🐻', 146, 128, 18], ['🐥', 172, 128, 18], ['🐱', 198, 128, 18]],
    draw: () => '<div class="rm-board wide">E=mc²</div>',
    fx: ['💡', '📖'],
  },
  // at home
  sleep: { wall: '#e5dbff', floor: '#d0bfff', pig: { x: 110, y: 130 }, items: [['🌙', 180, 28, 20], ['⭐', 40, 26, 12]], draw: () => '<div class="rm-bed wide"></div>', fx: ['💤'] },
  bath: { wall: '#e3fafc', floor: '#99e9f2', pig: { x: 110, y: 120 }, draw: () => '<div class="rm-tub"></div>', items: [['🧴', 34, 104, 18], ['🦆', 160, 104, 16]], fx: ['🫧', '✨'] },
};
ROOMS.paint = ROOMS.easel;

function roomHtml(kind, ctx) {
  const r = ROOMS[kind];
  const items = (r.items || []).map(([ch, x, y, size]) => `<span class="rm-item" style="left:${x}px;top:${y}px;font-size:${size}px">${ch}</span>`).join('');
  return `<div class="rm" style="--wall:${r.wall};--floor:${r.floor}"><div class="rm-window"></div>${r.draw ? r.draw(ctx) : ''}${items}</div>`;
}

// ---------- vehicles under the pig on a delivery round ----------

const VEHICLES = {
  bike: `<svg viewBox="0 0 90 50" class="vehicle"><g class="wheel"><circle cx="18" cy="36" r="12" fill="none" stroke="#495057" stroke-width="3.5"/><path d="M18 26 V46 M8 36 H28" stroke="#adb5bd" stroke-width="1.5"/></g>
    <g class="wheel"><circle cx="72" cy="36" r="12" fill="none" stroke="#495057" stroke-width="3.5"/><path d="M72 26 V46 M62 36 H82" stroke="#adb5bd" stroke-width="1.5"/></g>
    <path d="M18 36 L36 18 L62 18 L72 36 M36 18 L46 36 L62 18" fill="none" stroke="#4dabf7" stroke-width="4" stroke-linejoin="round"/>
    <rect x="64" y="6" width="22" height="13" rx="3" fill="#c08a5b" stroke="#8c6239"/></svg>`,
  scooter: `<svg viewBox="0 0 90 50" class="vehicle"><rect x="10" y="26" width="64" height="10" rx="5" fill="#fcc419" stroke="#f59f00" stroke-width="1.5"/>
    <path d="M72 30 L78 4" stroke="#495057" stroke-width="4" stroke-linecap="round"/><path d="M72 4 H86" stroke="#495057" stroke-width="4" stroke-linecap="round"/>
    <rect x="6" y="6" width="26" height="20" rx="3" fill="#c08a5b" stroke="#8c6239"/>
    <g class="wheel"><circle cx="20" cy="40" r="8" fill="#495057"/><circle cx="20" cy="40" r="3" fill="#dee2e6"/></g>
    <g class="wheel"><circle cx="72" cy="40" r="8" fill="#495057"/><circle cx="72" cy="40" r="3" fill="#dee2e6"/></g></svg>`,
};

// ---------- the dollhouse in the home sheet ----------
// 720×300 drawing. Furniture groups and decorations sit in fixed spots per house tier.

const DOLLHOUSE = [
  // 小猪窝: one round room, everything squeezed in
  {
    rooms: [{ x: 160, y: 40, w: 400, h: 240, wall: '#ffe3ec', floor: '#f3c7a5', dome: true }],
    spots: { bed: [210, 236], tub: [290, 242], desk: [370, 236], sofa: [450, 240], piano: [510, 232], easel: [250, 176], bubbler: [320, 196], pot: [480, 182], kitchen: [430, 176] },
    decor: [[200, 120], [520, 120]],
    pig: [360, 294],
  },
  // 公寓: two rooms side by side
  {
    rooms: [{ x: 70, y: 60, w: 290, h: 220, wall: '#fff0f6', floor: '#f3c7a5' }, { x: 360, y: 60, w: 290, h: 220, wall: '#e7f5ff', floor: '#d8c2a8' }],
    spots: { bed: [120, 238], tub: [200, 244], desk: [290, 236], sofa: [420, 240], piano: [520, 232], easel: [600, 232], bubbler: [160, 180], pot: [470, 180], kitchen: [560, 178] },
    decor: [[110, 110], [240, 110], [420, 110], [600, 110], [330, 180]],
    pig: [360, 294],
  },
  // 别墅: two floors, four rooms, a strip of garden
  {
    rooms: [{ x: 40, y: 20, w: 320, h: 130, wall: '#e5dbff', floor: '#d8c2a8' }, { x: 360, y: 20, w: 320, h: 130, wall: '#e3fafc', floor: '#d8c2a8' },
      { x: 40, y: 150, w: 320, h: 130, wall: '#fff0f6', floor: '#f3c7a5' }, { x: 360, y: 150, w: 320, h: 130, wall: '#fff9db', floor: '#f3c7a5' }],
    spots: { bed: [100, 120], tub: [440, 120], desk: [250, 120], bubbler: [520, 112], sofa: [120, 250], piano: [230, 244], easel: [310, 244], kitchen: [450, 244], pot: [540, 248] },
    decor: [[80, 64], [180, 64], [320, 64], [400, 64], [620, 64], [80, 194], [330, 194], [620, 194], [640, 250]],
    pig: [360, 294],
  },
  // 城堡: the villa plus a tower room on top
  {
    rooms: [{ x: 290, y: 0, w: 140, h: 70, wall: '#1c2541', floor: '#3a506b' },
      { x: 40, y: 70, w: 320, h: 105, wall: '#e5dbff', floor: '#d8c2a8' }, { x: 360, y: 70, w: 320, h: 105, wall: '#e3fafc', floor: '#d8c2a8' },
      { x: 40, y: 175, w: 320, h: 105, wall: '#fff0f6', floor: '#f3c7a5' }, { x: 360, y: 175, w: 320, h: 105, wall: '#fff9db', floor: '#f3c7a5' }],
    spots: { bed: [100, 150], tub: [440, 150], desk: [250, 150], bubbler: [520, 146], sofa: [120, 256], piano: [230, 250], easel: [310, 250], kitchen: [450, 252], pot: [540, 256] },
    decor: [[320, 40], [400, 40], [80, 104], [180, 104], [320, 104], [400, 104], [620, 104], [80, 208], [330, 208], [620, 208], [640, 256], [580, 104], [180, 208], [470, 208]],
    pig: [360, 294],
  },
];

// Which spot the pig stands at for what it's doing at home
const HOME_SPOT_FOR = { sleep: 'bed', bath: 'tub', piano: 'piano', paint: 'easel' };

function dollhouseHtml(s, pigHtml) {
  const tier = homeTier(s);
  const D = DOLLHOUSE[tier];
  let rooms = D.rooms.map((r) => r.dome
    ? `<path d="M${r.x} ${r.y + r.h} V${r.y + 90} A${r.w / 2} 100 0 0 1 ${r.x + r.w} ${r.y + 90} V${r.y + r.h} Z" fill="${r.wall}" stroke="#f2a0b8" stroke-width="4"/>
       <rect x="${r.x}" y="${r.y + r.h - 34}" width="${r.w}" height="34" fill="${r.floor}"/>`
    : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.wall}" stroke="#f2a0b8" stroke-width="4"/>
       <rect x="${r.x + 2}" y="${r.y + r.h - 26}" width="${r.w - 4}" height="24" fill="${r.floor}"/>
       <rect x="${r.x + r.w / 2 - 22}" y="${r.y + 16}" width="44" height="30" rx="6" fill="#d0ebff" stroke="#f2a0b8" stroke-width="2"/>`).join('');
  if (tier === 2 || tier === 3) rooms += `<rect x="0" y="280" width="720" height="20" rx="6" fill="#b2f2bb"/>`;
  else rooms += `<rect x="0" y="280" width="720" height="20" rx="6" fill="#d3f9d8"/>`;
  // the best piece of each furniture group, in its spot
  const best = {};
  for (const it of ITEMS) {
    if (it.cat !== 'furniture' || !s.inventory[it.id] || it.group === 'house') continue;
    if (!best[it.group] || it.price > best[it.group].price) best[it.group] = it;
  }
  const at = ([x, y], ch, size, title) => `<span class="dh-item" style="left:${(x / 720) * 100}%;top:${(y / 300) * 100}%;font-size:${size}px" title="${esc(title)}">${ch}</span>`;
  let items = Object.values(best).map((it) => (D.spots[it.group] ? at(D.spots[it.group], it.icon, 34, it.name) : '')).join('');
  // empty spots for the basics show faintly, as a hint of what could go there
  for (const [group, ch] of [['bed', '🛏️'], ['tub', '🛁'], ['desk', '📝'], ['sofa', '🛋️']]) {
    if (!best[group]) items += `<span class="dh-item ghost" style="left:${(D.spots[group][0] / 720) * 100}%;top:${(D.spots[group][1] / 300) * 100}%" data-action="fly" data-id="furniture">${ch}</span>`;
  }
  items += ownedDecor(s).slice(0, D.decor.length).map((it, i) => at(D.decor[i], it.icon, 26, it.name)).join('');
  const a = s.activity;
  const spotKey = a && HOME_SPOT_FOR[a.type === 'hobby' ? a.id : a.type];
  const pigAt = spotKey && best[spotKey] ? D.spots[spotKey] : D.pig;
  const pig = `<div class="dh-pig" style="left:${(pigAt[0] / 720) * 100}%;top:${(pigAt[1] / 300) * 100}%">${pigHtml}</div>`;
  return `<div class="dollhouse"><svg viewBox="0 0 720 300" preserveAspectRatio="xMidYMax meet">${rooms}</svg>${items}${pig}</div>`;
}
