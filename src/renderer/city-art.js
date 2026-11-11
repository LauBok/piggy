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

// An emoji drawn as text (class e: the emoji font; other text in the town uses the game font)
const emo = (x, y, size, ch, extra = '') => {
  // a class in extra joins e instead of being a second class attribute
  const cls = (extra.match(/class="([^"]*)"/) || [, ''])[1];
  const rest = extra.replace(/class="[^"]*"/, '');
  return `<text class="e ${cls}" x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${rest}>${ch}</text>`;
};

// ---------- scenery ----------

// The town's season while it's drawn (seasonOf, the town's calendar): the trees' and the grass's
// colours, the flowers, the water (frozen in winter, lotus in summer), what stands about outside
let TOWN_SEASON = seasonOf();
// the ground by season: base, hills, farm land, park, the lawn's two stripes, grass tufts, river bank
const GRASS = {
  spring: { base: '#d8f0b8', hills: '#cbe8a8', farm: '#ddf2c2', park: '#c6eba4', lawn: ['#d2eeac', '#c9e8a1'], tuft: '#a3d97f', bank: '#a8d38c' },
  summer: { base: '#cbe6a8', hills: '#bcdc98', farm: '#cfe8b0', park: '#b6de94', lawn: ['#c3e49c', '#b9dd90'], tuft: '#93c66f', bank: '#98c47c' },
  autumn: { base: '#e2dcae', hills: '#d8cf9a', farm: '#e6dfb6', park: '#d6cf98', lawn: ['#dfd8a6', '#d6ce98'], tuft: '#c4ae6a', bank: '#c9b57d' },
  winter: { base: '#e3ebe4', hills: '#dbe5dc', farm: '#e6ede6', park: '#d8e3d8', lawn: ['#e0e9e0', '#d8e2d8'], tuft: '#c3d1c4', bank: '#cdd8cf' },
};
const grass = () => GRASS[TOWN_SEASON];
const TREE_COLORS = {
  spring: [['#8ce99a', '#69db7c'], ['#fcc2d7', '#faa2c1'], ['#96f2d7', '#63e6be'], ['#ffc9c9', '#ffa8a8']],
  summer: [['#8ce99a', '#69db7c'], ['#a9e34b', '#94d82d'], ['#96f2d7', '#63e6be'], ['#ffc9c9', '#ffa8a8']],
  autumn: [['#ffc078', '#ffa94d'], ['#ffd43b', '#fcc419'], ['#ff8787', '#ff6b6b'], ['#ffa94d', '#ff922b']],
  winter: [['#e9ecef', '#ced4da'], ['#d0ebff', '#a5d8ff'], ['#e9ecef', '#dee2e6'], ['#f1f3f5', '#dee2e6']],
};

function treeSvg(x, y, k = 1, kind = 0) {
  const greens = TREE_COLORS[TOWN_SEASON][kind % 4];
  // spring blossom, snow on top in winter
  const top = { spring: '#fff0f6', winter: '#fff' }[TOWN_SEASON];
  return `<g class="tree"><ellipse cx="${x}" cy="${y}" rx="${14 * k}" ry="${4 * k}" fill="rgba(60,90,40,.13)"/>
    <rect x="${x - 3 * k}" y="${y - 16 * k}" width="${6 * k}" height="${16 * k}" rx="${2 * k}" fill="#c08a5b"/>
    <circle cx="${x}" cy="${y - 28 * k}" r="${16 * k}" fill="${greens[0]}"/>
    <circle cx="${x - 9 * k}" cy="${y - 20 * k}" r="${10 * k}" fill="${greens[1]}"/>
    <circle cx="${x + 9 * k}" cy="${y - 21 * k}" r="${11 * k}" fill="${greens[0]}"/>
    ${top === '#fff' ? `<path d="M${x - 15 * k} ${y - 30 * k} a${15 * k} ${14 * k} 0 0 1 ${30 * k} 0 q${-7 * k} ${4 * k} ${-15 * k} 0 q${-8 * k} ${4 * k} ${-15 * k} 0 Z" fill="#fff"/>` : ''}
    ${top === '#fff0f6' ? [[-7, -30], [6, -34], [8, -22], [-10, -19], [0, -24]].map(([dx, dy]) => `<circle cx="${x + dx * k}" cy="${y + dy * k}" r="${2.4 * k}" fill="#fff0f6"/>`).join('') : ''}
    <circle cx="${x - 5 * k}" cy="${y - 33 * k}" r="${4 * k}" fill="#fff" opacity=".35"/></g>`;
}

const flower = (x, y, c) => `<g><circle cx="${x}" cy="${y}" r="3.2" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.3" fill="#ffd43b"/></g>`;

const bush = (x, y, k = 1) => `<g><circle cx="${x - 8 * k}" cy="${y - 6 * k}" r="${8 * k}" fill="#8ce99a"/>
  <circle cx="${x + 6 * k}" cy="${y - 7 * k}" r="${9 * k}" fill="#69db7c"/><circle cx="${x}" cy="${y - 12 * k}" r="${7 * k}" fill="#8ce99a"/></g>`;

// What lights up after dark, noted while the town is drawn: every window ([x, y, w, h]), every
// lamp's bulb ([x, y]), and the pig's own house's windows (redrawn when he moves); see
// City.drawLights
const CITY_LIGHTS = { windows: [], lamps: [], home: [] };

const lampPost = (x, y) => {
  CITY_LIGHTS.lamps.push([x, y - 36]);
  return `<g><rect x="${x - 1.5}" y="${y - 34}" width="3" height="34" fill="#868e96"/>
  <circle cx="${x}" cy="${y - 36}" r="5" fill="#fff3bf" stroke="#adb5bd" stroke-width="1.5"/></g>`;
};

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
    ...PLACES.filter((p) => ['building', 'home', 'pavilion', 'stage', 'barn', 'funpark'].includes(p.kind)).map((p) => p.door),
    ...Object.values(HOMES).map((h) => h.door),
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
  <pattern id="pLawn" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="LAWN0"/><rect width="30" height="60" fill="LAWN1"/></pattern>
  <pattern id="pSoil" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#b88a5c"/><rect y="14" width="24" height="5" fill="#a87b4f"/></pattern>
</defs>`;

const REGION_FILL = () => ({ hills: grass().hills, farm: grass().farm, lawn: 'url(#pLawn)', stone: 'url(#pPave)', park: grass().park, brick: 'url(#pBrick)' });

function groundSvg() {
  const rnd = seeded(5);
  const G = grass();
  const fills = REGION_FILL();
  let svg = `${GROUND_DEFS.replace('LAWN0', G.lawn[0]).replace('LAWN1', G.lawn[1])}<rect width="${WORLD.w}" height="${WORLD.h}" fill="${G.base}"/>`;
  for (const d of DISTRICTS) {
    const [x1, y1, x2, y2] = d.rect;
    svg += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="${d.ground === 'hills' ? 0 : 50}" fill="${fills[d.ground]}"/>`;
  }
  // grass tufts on the green regions
  for (let i = 0; i < 900; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const d = DISTRICTS.find((r) => x > r.rect[0] && x < r.rect[2] && y > r.rect[1] && y < r.rect[3]);
    if (d && ['stone', 'brick'].includes(d.ground)) continue;
    svg += `<path d="M${x} ${y} l-3 -7 M${x + 2} ${y} l1 -9 M${x + 4} ${y} l4 -6" stroke="${G.tuft}" stroke-width="1.6" stroke-linecap="round"/>`;
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

// The river: sandy banks, a wet edge, deeper water in the middle, with reeds, stones and lily pads.
// Frozen over in winter (no pads then, the reeds gone brown); more pads and lotus in summer.
function riverSvg() {
  const d = ptsD(RIVER);
  const rnd = seeded(17);
  const ice = TOWN_SEASON === 'winter';
  const line = (c, w, o = 1) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
  let svg = line('#e6d7ae', RIVER_W * 2 + 30) + line(grass().bank, RIVER_W * 2 + 10, 0.7);
  svg += ice
    ? line('#cfe6f5', RIVER_W * 2) + line('#e3f1fa', RIVER_W * 0.9, 0.9)
      + `<path d="${d}" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="40 90" opacity=".85" transform="translate(-10 0)"/>
        <path d="${d}" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="18 120" opacity=".7" transform="translate(12 0)"/>`
    : line('#6db6e2', RIVER_W * 2) + line('#5aa6d6', RIVER_W * 0.9, 0.55)
      + `<path class="ripple" d="${d}" stroke="#d6f0ff" stroke-width="2" fill="none" stroke-dasharray="6 54" opacity=".8" transform="translate(-12 0)"/>
        <path class="ripple slow" d="${d}" stroke="#d6f0ff" stroke-width="2" fill="none" stroke-dasharray="10 70" opacity=".6" transform="translate(13 0)"/>`;
  const reed = { autumn: '#b08d3c', winter: '#a0896b' }[TOWN_SEASON] || '#5c940d';
  const pads = { summer: 0.85, winter: 0 }[TOWN_SEASON] ?? 0.72;
  // things along the banks and on the water, away from the bridges
  const nearBridge = (y) => BRIDGES.some((b) => Math.abs(y - b.y) < 60);
  for (let i = 8; i < RIVER.length - 4; i += 7) {
    const [x, y] = RIVER[i];
    if (nearBridge(y) || y < CLIFF.y + CLIFF.h + 30) continue;
    const side = rnd() < 0.5 ? -1 : 1;
    const bx = x + side * (RIVER_W + 8 + rnd() * 6);
    const r = rnd();
    if (r < 0.3) {
      svg += [0, 1, 2, 3].map((k) => `<path d="M${bx + k * 4 - 6} ${y + 6} q${side * 2} -14 ${side * 4 - 2} -22" stroke="${reed}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')
        + `<ellipse cx="${bx + 4 * side}" cy="${y - 16}" rx="2.5" ry="6" fill="#8c6239"/>`;
    } else if (r < 0.5) {
      svg += `<ellipse cx="${bx}" cy="${y}" rx="10" ry="7" fill="#ced4da" stroke="#adb5bd"/><ellipse cx="${bx + side * 12}" cy="${y + 6}" rx="6" ry="4.5" fill="#dee2e6" stroke="#adb5bd"/>`;
    } else if (r < pads) {
      const lx = x + (rnd() - 0.5) * RIVER_W;
      const bloom = rnd() < (TOWN_SEASON === 'summer' ? 0.7 : 0.4);
      svg += `<path d="M${lx} ${y} m-9 0 a9 6 0 1 0 18 0 a9 6 0 1 0 -18 0 M${lx} ${y} l7 -3" fill="#82c91e" stroke="#5c940d" stroke-width="1.2"/>`
        + (bloom ? (TOWN_SEASON === 'summer' ? lotus(lx - 2, y - 3, 0.8) : `<circle cx="${lx - 2}" cy="${y - 2}" r="2.6" fill="#ffc9de"/>`) : '');
    }
  }
  // wooden bridges carrying the roads straight across, on stone footings
  for (const b of BRIDGES) {
    const L = BRIDGE_HALF;
    svg += `<g><ellipse cx="${b.x}" cy="${b.y + 26}" rx="${RIVER_W + 6}" ry="8" fill="#3d7fb0" opacity=".35"/>
      <rect x="${b.x - L - 8}" y="${b.y - 22}" width="20" height="46" rx="4" fill="#ced4da" stroke="#adb5bd"/>
      <rect x="${b.x + L - 12}" y="${b.y - 22}" width="20" height="46" rx="4" fill="#ced4da" stroke="#adb5bd"/>
      <rect x="${b.x - L + 6}" y="${b.y - 19}" width="${2 * L - 12}" height="38" fill="#c9935e" stroke="#8c6239" stroke-width="2"/>
      ${[...Array(Math.floor((2 * L - 16) / 12))].map((_, i) => `<path d="M${b.x - L + 14 + i * 12} ${b.y - 18} V${b.y + 18}" stroke="#a9744a" stroke-width="1.6"/>`).join('')}
      <rect x="${b.x - L + 4}" y="${b.y - 26}" width="${2 * L - 8}" height="6" rx="3" fill="#8c6239"/>
      <rect x="${b.x - L + 4}" y="${b.y + 18}" width="${2 * L - 8}" height="6" rx="3" fill="#8c6239"/>
      ${[-1, 0, 1].map((k) => `<rect x="${b.x + k * (L - 14) - 3}" y="${b.y - 32}" width="6" height="10" rx="2" fill="#6f4a2b"/>`).join('')}</g>`;
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
      <rect x="${x1}" y="${y - 6}" width="${x2 - x1}" height="10" rx="5" fill="${grass().tuft}"/>`;
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
  if (TOWN_SEASON === 'winter') {
    return svg + `<rect x="${wx - RIVER_W}" y="${y - 30}" width="${RIVER_W * 2}" height="${h + 34}" fill="#dbeefb"/>
      ${[0, 1, 2, 3, 4].map((i) => `<path d="M${wx - 30 + i * 15} ${y - 26} V${y + h - 6 - (i % 2) * 10} l-4 -10" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/>`).join('')}
      <ellipse cx="${wx}" cy="${y + h + 6}" rx="${RIVER_W + 8}" ry="9" fill="#fff" opacity=".8"/>`;
  }
  svg += `<rect x="${wx - RIVER_W}" y="${y - 30}" width="${RIVER_W * 2}" height="${h + 34}" fill="#a5d8ff"/>
    <g class="falls">${[0, 1, 2, 3].map((i) => `<path d="M${wx - 24 + i * 16} ${y - 26} V${y + h}" stroke="#fff" stroke-width="3" stroke-dasharray="8 10" opacity=".85"/>`).join('')}</g>
    <ellipse cx="${wx}" cy="${y + h + 6}" rx="${RIVER_W + 8}" ry="9" fill="#fff" opacity=".7"/>`;
  return svg;
}

// The shopping street dressed up: entrance arches, bunting over the street, billboards and stalls
function marketSvg() {
  let svg = '';
  // arches where the town's streets come in, with the street's name
  for (const x of [1700, 2100]) {
    const y = 1800;
    svg += `<g><rect x="${x - 40}" y="${y - 70}" width="10" height="74" rx="3" fill="#e03131"/><rect x="${x + 30}" y="${y - 70}" width="10" height="74" rx="3" fill="#e03131"/>
      <path d="M${x - 50} ${y - 70} Q${x} ${y - 96} ${x + 50} ${y - 70}" stroke="#c92a2a" stroke-width="10" fill="none" stroke-linecap="round"/>
      <rect x="${x - 34}" y="${y - 92}" width="68" height="24" rx="5" fill="#ffd43b" stroke="#e67700" stroke-width="2"/>
      <text class="boardtext" x="${x}" y="${y - 80}">商业街</text>
      <ellipse cx="${x - 35}" cy="${y - 54}" rx="7" ry="9" fill="#ff6b6b" stroke="#c92a2a"/><ellipse cx="${x + 35}" cy="${y - 54}" rx="7" ry="9" fill="#ff6b6b" stroke="#c92a2a"/></g>`;
  }
  // bunting strung along both shopping streets
  const colors = ['#ff8787', '#ffd43b', '#74c0fc', '#8ce99a', '#b197fc'];
  for (const y of [2016, 2336]) {
    for (let x = 1270; x < 2420; x += 230) {
      const x2 = Math.min(2430, x + 230);
      svg += `<path d="M${x} ${y} Q${(x + x2) / 2} ${y + 16} ${x2} ${y}" stroke="#868e96" stroke-width="1.2" fill="none"/>`;
      for (let k = 1; k < 10; k++) {
        const t = k / 10;
        const fx = x + (x2 - x) * t;
        const fy = y + 16 * 2 * t * (1 - t) * 2 * 0.5 * 2;
        svg += `<path d="M${fx - 5} ${fy} L${fx + 5} ${fy} L${fx} ${fy + 10} Z" fill="${colors[(k + x / 230) % colors.length | 0]}"/>`;
      }
      svg += `<rect x="${x - 2}" y="${y - 26}" width="4" height="30" fill="#868e96"/>`;
    }
  }
  // billboards
  const board = (x, y, ch, text, c) => `<g><rect x="${x - 3}" y="${y - 20}" width="6" height="22" fill="#868e96"/><rect x="${x + 41}" y="${y - 20}" width="6" height="22" fill="#868e96"/>
    <rect x="${x - 14}" y="${y - 66}" width="72" height="48" rx="6" fill="#fff" stroke="${c}" stroke-width="3"/>
    ${emo(x + 22, y - 52, 18, ch)}<text class="adtext" x="${x + 22}" y="${y - 30}" fill="${c}">${text}</text></g>`;
  svg += board(1420, 2150, '🍦', '买一送一', '#f06595') + board(1960, 2150, '🎉', '开业大吉', '#e8590c') + board(2300, 2150, '🥤', '新品上市', '#1c7ed6');
  // stalls along the street
  svg += `<g><rect x="1600" y="2112" width="56" height="30" rx="5" fill="#fff" stroke="#f783ac" stroke-width="2"/>
      <path d="M1594 2112 Q1628 2084 1662 2112 Z" fill="#ff8fab"/>${emo(1628, 2098, 18, '🍦')}
      <circle cx="1608" cy="2146" r="6" fill="#495057"/><circle cx="1648" cy="2146" r="6" fill="#495057"/></g>
    <g><path d="M1820 2150 V2096" stroke="#adb5bd" stroke-width="1.5"/>${['#ff6b6b', '#ffd43b', '#74c0fc', '#b197fc'].map((c, i) => `<path d="M1820 2100 L${1806 + i * 9} 2070" stroke="#ced4da"/><ellipse class="bob" cx="${1806 + i * 9}" cy="${2062 - (i % 2) * 6}" rx="7" ry="9" fill="${c}"/>`).join('')}${emo(1834, 2142, 18, '🐻')}</g>
    <g><rect x="2180" y="2116" width="70" height="26" rx="4" fill="#c08a5b" stroke="#8c6239"/>
      <path d="M2172 2116 L2258 2116 L2250 2096 L2180 2096 Z" fill="#40c057"/><path d="M2180 2096 L2190 2116 M2200 2096 L2205 2116 M2220 2096 L2220 2116 M2240 2096 L2235 2116" stroke="#fff" stroke-width="4"/>
      ${emo(2196, 2126, 14, '🍎')}${emo(2214, 2126, 14, '🍊')}${emo(2232, 2126, 14, '🍇')}</g>`;
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
  const homeArt = { ranchhouse: ranchHouseSvg, woodshop: woodshopSvg, shellhouse: shellHouseSvg }[d.kind];
  if (homeArt) return homeArt(x, y, w, h);
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
  const F = {
    spring: [760, ['#ff8fab', '#ffc9de', '#fff', '#b197fc', '#ffd43b']],
    summer: [520, ['#ff8fab', '#ffd43b', '#b197fc', '#74c0fc', '#fff']],
    autumn: [220, ['#ffa94d', '#ffd43b', '#e8590c', '#fff']],
    winter: [0, []],
  }[TOWN_SEASON];
  const colors = F[1];
  for (let tries = 0, n = 0; tries < 9000 && n < F[0]; tries++) {
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
  svg += seasonProps();
  for (const r of ROADS.filter((q) => q.stone)) {
    const [[x1, y1], [x2, y2]] = r.pts;
    if (y1 !== y2) continue;
    for (let x = x1 + 150; x < x2 - 30; x += 240) svg += lampPost(x, y1 + 34);
  }
  return svg;
}


// A lotus flower, for the lake and the river in summer
const lotus = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M0 2 C-9 0 -10 -7 -7 -9 C-4 -5 -2 -3 0 -2 C2 -3 4 -5 7 -9 C10 -7 9 0 0 2 Z" fill="#ff8fab" stroke="#e64980" stroke-width=".8"/>
  <path d="M0 0 C-4 -4 -3 -11 0 -13 C3 -11 4 -4 0 0 Z" fill="#ffc9de" stroke="#e64980" stroke-width=".8"/></g>`;

// What the season puts out on the grass, here and there: tulips in spring, sunflowers in summer,
// pumpkins and piles of leaves in autumn, snowmen in winter
const SEASON_PROP = {
  spring: (x, y) => [[-10, '#ff6b9d'], [0, '#ffd43b'], [10, '#ff8787']].map(([dx, c], i) => `<path d="M${x + dx} ${y} v-16" stroke="#5c940d" stroke-width="2"/>
      <path d="M${x + dx} ${y - 6} q-6 -2 -7 -9 q6 1 7 7" fill="#82c91e"/>
      <path d="M${x + dx - 5} ${y - 22 - i % 2 * 2} q0 8 5 9 q5 -1 5 -9 l-2.5 3 l-2.5 -4 l-2.5 4 Z" fill="${c}"/>`).join(''),
  summer: (x, y) => [[-8, 0], [8, 6]].map(([dx, dy]) => `<path d="M${x + dx} ${y + dy} v-40" stroke="#5c940d" stroke-width="3"/>
      <path d="M${x + dx} ${y + dy - 16} q-10 -2 -12 -10 q9 0 12 6 M${x + dx} ${y + dy - 24} q10 -2 12 -10 q-9 0 -12 6" fill="#69b34c"/>
      ${[...Array(10)].map((_, i) => { const a = (i / 10) * Math.PI * 2; return `<ellipse cx="${x + dx + Math.cos(a) * 9}" cy="${y + dy - 44 + Math.sin(a) * 9}" rx="5" ry="2.6" transform="rotate(${(a * 180) / Math.PI} ${x + dx + Math.cos(a) * 9} ${y + dy - 44 + Math.sin(a) * 9})" fill="#ffd43b" stroke="#f59f00" stroke-width=".6"/>`; }).join('')}
      <circle cx="${x + dx}" cy="${y + dy - 44}" r="6.5" fill="#8c5a2b"/>`).join(''),
  autumn: (x, y, i) => i % 2
    ? `<path d="M${x - 26} ${y} Q${x - 18} ${y - 18} ${x} ${y - 20} Q${x + 18} ${y - 18} ${x + 26} ${y} Z" fill="#d9480f" opacity=".9"/>
      ${[[-16, -3, '#ffa94d', -30], [-6, -12, '#ffd43b', 20], [6, -14, '#ff922b', -10], [16, -5, '#f76707', 35], [0, -4, '#fcc419', 70], [-10, -16, '#e8590c', -60], [12, -9, '#ffd43b', 50], [-20, 2, '#ff922b', 10], [22, 1, '#fab005', -40]]
    .map(([dx, dy, c, r]) => `<path d="M0 -6 Q5 -2 0 6 Q-5 -2 0 -6 Z M0 6 v3" fill="${c}" stroke="${darker(c, 0.3)}" stroke-width=".8" transform="translate(${x + dx} ${y + dy}) rotate(${r})"/>`).join('')}`
    : `<ellipse cx="${x}" cy="${y - 8}" rx="13" ry="10" fill="#ff922b" stroke="#d9480f" stroke-width="1.4"/><path d="M${x - 5} ${y - 17} q-2 9 0 17 M${x + 5} ${y - 17} q2 9 0 17" stroke="#d9480f" stroke-width="1.2" fill="none"/>
      <path d="M${x} ${y - 18} q1 -6 5 -7" stroke="#5c940d" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="${x + 18}" cy="${y - 5}" rx="8" ry="6" fill="#ffa94d" stroke="#d9480f" stroke-width="1.2"/><path d="M${x + 18} ${y - 11} v-3" stroke="#5c940d" stroke-width="2" stroke-linecap="round"/>`,
  winter: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="17" ry="5" fill="rgba(120,140,160,.18)"/>
      <circle cx="${x}" cy="${y - 13}" r="14" fill="#fff" stroke="#ced4da" stroke-width="1.4"/><circle cx="${x}" cy="${y - 34}" r="10" fill="#fff" stroke="#ced4da" stroke-width="1.4"/>
      <circle cx="${x - 3.5}" cy="${y - 36}" r="1.5" fill="#343a40"/><circle cx="${x + 3.5}" cy="${y - 36}" r="1.5" fill="#343a40"/>
      <path d="M${x} ${y - 33} l7 2 l-7 1 Z" fill="#ff922b"/><path d="M${x - 9} ${y - 27} q9 5 18 0" stroke="#e03131" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M${x - 13} ${y - 18} l-11 -8 M${x + 13} ${y - 18} l11 -8" stroke="#8c6239" stroke-width="2" stroke-linecap="round"/>
      <rect x="${x - 7}" y="${y - 50}" width="14" height="8" rx="2" fill="#343a40"/><rect x="${x - 10}" y="${y - 43}" width="20" height="3" rx="1.5" fill="#343a40"/>`,
};
function seasonProps() {
  const rnd = seeded(43);
  const draw = SEASON_PROP[TOWN_SEASON];
  let svg = '';
  for (let tries = 0, n = 0; tries < 4000 && n < 34; tries++) {
    const x = 200 + rnd() * (WORLD.w - 400);
    const y = 520 + rnd() * (WORLD.h - 620);
    const d = DISTRICTS.find((r) => x > r.rect[0] && x < r.rect[2] && y > r.rect[1] && y < r.rect[3]);
    if (!d || !['park', 'lawn', 'farm', 'hills'].includes(d.ground)) continue;
    if (!freeForScenery(x, y, 30)) continue;
    svg += draw(x, y, n);
    n++;
  }
  return svg;
}

// What the neighbours put on for the season: a ring of flowers in spring, a straw hat in summer,
// a knitted scarf in autumn, a scarf and a woolly hat in winter. Not over a cap, apron string or
// scarf they always wear, nor over long ears.
const SEASON_HAT = {
  spring: `<path d="M50 34 Q80 16 110 34" stroke="#8ce99a" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${[[54, 32, '#ff8fab'], [66, 25, '#fff'], [80, 22, '#ffd43b'], [94, 25, '#fff'], [106, 32, '#ff8fab']].map(([x, y, c]) => `<g>${[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return `<circle cx="${x + Math.cos(a) * 3.6}" cy="${y + Math.sin(a) * 3.6}" r="3" fill="${c}" stroke="#f3a5bd" stroke-width=".6"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="2.2" fill="#fab005"/></g>`).join('')}`,
  summer: `<ellipse cx="80" cy="28" rx="50" ry="10" fill="#f4d58d" stroke="#c9a04a" stroke-width="1.6"/>
    <path d="M56 28 Q57 4 80 2 Q103 4 104 28 Z" fill="#f4d58d" stroke="#c9a04a" stroke-width="1.6"/>
    <path d="M57 20 Q80 14 103 20 L104 26 Q80 20 56 26 Z" fill="#ff6b6b"/>
    <path d="M62 10 Q80 4 98 10 M40 28 Q80 36 120 28" stroke="#e3bd6a" stroke-width="1.2" fill="none"/>`,
  winter: `<path d="M54 32 Q55 4 80 2 Q105 4 106 32 Z" fill="#ff6b6b" stroke="#e03131" stroke-width="1.4"/>
    <path d="M64 30 V10 M72 30 V5 M80 30 V3 M88 30 V5 M96 30 V10" stroke="#fa5252" stroke-width="2" opacity=".8"/>
    <rect x="51" y="25" width="58" height="11" rx="5.5" fill="#fff" stroke="#dee2e6" stroke-width="1.2"/>
    <circle cx="80" cy="0" r="7.5" fill="#fff" stroke="#dee2e6" stroke-width="1.2"/>`,
};
const SEASON_SCARF = {
  autumn: ['#f0a43a', '#c27c1e', '#fff3bf'],
  winter: ['#e03131', '#a61e1e', '#fff'],
};
function seasonWear(species) {
  const sp = SPECIES[species];
  let svg = '';
  const hatOk = !['nurse', 'chef', 'bow', 'pencil'].includes(sp.acc) && sp.ears !== 'long';
  // a ring of flowers sits between long ears; a hat doesn't
  for (const [season, hat] of Object.entries(SEASON_HAT)) if (hatOk || (season === 'spring' && sp.ears === 'long')) svg += `<g class="ss ss-hat ss-${season}">${hat}</g>`;
  if (!['bell', 'scarf'].includes(sp.acc)) {
    for (const [season, [c, edge, stripe]] of Object.entries(SEASON_SCARF)) {
      svg += `<g class="ss ss-${season}"><path d="M48 100 Q80 116 112 100 L112 111 Q80 127 48 111 Z" fill="${c}" stroke="${edge}" stroke-width="1.3"/>
        <path d="M58 105 v9 M70 108 v9 M82 109 v9 M94 108 v9 M104 104 v8" stroke="${stripe}" stroke-width="2.6" opacity=".85"/>
        <path d="M96 110 l5 24 l9 -2 l-3 -22 Z" fill="${c}" stroke="${edge}" stroke-width="1.3"/><path d="M101 134 l1 5 M105 133 l1 5 M109 132 l1 5" stroke="${edge}" stroke-width="1.6" stroke-linecap="round"/></g>`;
    }
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
  const win = (wx, wy, ww, wh) => {
    CITY_LIGHTS.windows.push([wx, wy, ww, wh]);
    return `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="4" fill="#e7f5ff" stroke="${line}" stroke-width="1.2"/>
    <path d="M${wx + 4} ${wy + wh - 4} L${wx + ww - 6} ${wy + 4}" stroke="#fff" stroke-width="2.4" opacity=".9" stroke-linecap="round"/>`;
  };
  // between columns, if any: the three gaps, the middle one has the door
  const colX = [].concat(L.extra || []).includes('columns') ? [0, 1, 2].map((i) => x + 10 + (i + 0.5) * ((w - 20) / 3)) : null;
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
  if ([].concat(L.extra || []).includes('garage')) {
    svg += `<rect x="${x + w - 62}" y="${y + h - 46}" width="52" height="38" rx="3" fill="#ffe066" stroke="${line}" stroke-width="1.2"/>`;
    for (let i = 1; i < 5; i++) svg += `<path d="M${x + w - 62} ${y + h - 46 + i * 7.6} h52" stroke="${line}" stroke-width="1"/>`;
  }
  svg += `<path d="M${cx - dw / 2} ${y + h - 8} V${dy + dw / 2} A${dw / 2} ${dw / 2} 0 0 1 ${cx + dw / 2} ${dy + dw / 2} V${y + h - 8} Z" fill="${darker(rc, 0.12)}" stroke="${darker(rc, 0.3)}" stroke-width="1.2"/>
    <circle cx="${cx + dw / 2 - 5}" cy="${y + h - 8 - doorH / 2.4}" r="1.8" fill="#fff3bf"/>`;

  // decorations that make each building its own
  const extras = [].concat(L.extra || []);
  const ground = y + h;
  for (const ex of extras) {
    switch (ex) {
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
      case 'helipad':
        svg += `<circle cx="${x + 40}" cy="${y + roofH / 2 - 2}" r="12" fill="#fff" stroke="#fab005" stroke-width="2"/><text x="${x + 40}" y="${y + roofH / 2 - 1}" font-size="12" font-weight="bold" fill="#fab005" text-anchor="middle" dominant-baseline="central">H</text>`;
        break;
      case 'glass':
        svg += `<path d="M${x + 8} ${ground - 30} L${x + w * 0.55} ${by + 6} L${x + w * 0.7} ${by + 6} L${x + 22} ${ground - 30} Z" fill="#fff" opacity=".22"/>`;
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
      case 'pole':
        // a barber's pole by the door, stripes turning
        svg += `<rect x="${cx + dw / 2 + 8}" y="${ground - 50}" width="12" height="44" rx="6" fill="#fff" stroke="${line}"/>
          <g class="pole-stripes" clip-path="inset(0)">${[0, 1, 2, 3].map((i) => `<path d="M${cx + dw / 2 + 8} ${ground - 46 + i * 11} l12 -8" stroke="#fa5252" stroke-width="4"/>`).join('')}</g>
          <circle cx="${cx + dw / 2 + 14}" cy="${ground - 52}" r="5" fill="#ffd43b"/>`;
        break;
      case 'vanity':
        // bottles of fur dye in the windows
        svg += emo(x + 30, ground - 26, 16, '🧴') + emo(x + w - 30, ground - 26, 16, '🎨');
        break;
      case 'chimney':
        svg += `<rect x="${x + w - 46}" y="${y - 14}" width="16" height="26" fill="#c9a77c" stroke="${darker('#c9a77c')}"/>
          <circle class="puff" cx="${x + w - 38}" cy="${y - 22}" r="6"/><circle class="puff" cx="${x + w - 33}" cy="${y - 32}" r="5" style="animation-delay:-1.6s"/>`;
        break;
      case 'breadwin':
        svg += emo(x + 30, ground - 26, 16, '🥐') + emo(x + w - 30, ground - 26, 16, '🍞');
        break;
      case 'mannequin':
        svg += emo(x + 32, ground - 30, 20, '👗') + emo(x + w - 32, ground - 30, 20, '👒');
        break;
      case 'keys':
        svg += `<rect x="${x + 6}" y="${ground - 22}" width="${w - 12}" height="12" fill="#fff" stroke="${line}"/>`;
        for (let k = x + 12; k < x + w - 12; k += 10) svg += `<rect x="${k}" y="${ground - 22}" width="5" height="7" fill="#343a40"/>`;
        break;
      case 'teddy':
        svg += emo(x + 20, by - 8, 22, '🧸', 'class="bob"');
        break;
      case 'carts':
        svg += emo(x + w + 18, ground - 6, 20, '🛒') + emo(x + w + 40, ground - 4, 18, '🛒');
        break;
      case 'ambulance':
        svg += emo(x + w + 30, ground - 8, 30, '🚑');
        break;
      case 'truck':
        svg += emo(x - 30, ground - 8, 32, '🚚');
        break;
      case 'stalls':
        // crates of fresh produce out front
        for (const [ox, ch] of [[-24, '🍎'], [w + 4, '🥕'], [w + 34, '🌽']]) {
          svg += `<rect x="${x + ox}" y="${ground - 20}" width="26" height="18" rx="2" fill="#c08a5b" stroke="#8c6239"/>${emo(x + ox + 13, ground - 24, 15, ch)}`;
        }
        break;
      case 'warehouse':
        // wide roll-up doors and a loading dock
        for (const ox of [24, w - 104]) {
          svg += `<rect x="${x + ox}" y="${ground - 58}" width="80" height="50" rx="3" fill="#e9ecef" stroke="${line}"/>`;
          for (let i = 1; i < 6; i++) svg += `<path d="M${x + ox} ${ground - 58 + i * 8.3} h80" stroke="#ced4da"/>`;
        }
        svg += `<path d="M${x} ${ground - 4} H${x + w}" stroke="#fab005" stroke-width="5" stroke-dasharray="14 10"/>`;
        break;
      case 'sofaout':
        svg += emo(x + w + 34, ground - 12, 30, '🛋️') + emo(x + w + 70, ground - 14, 26, '🪴') + emo(x - 30, ground - 12, 28, '🪑');
        break;
    }
  }

  // a wooden name board across the front
  const nameW = p.name.length * 15 + 22;
  const boardY = L.awning ? by - 12 : by + 4;
  svg += `<rect x="${cx - nameW / 2}" y="${boardY}" width="${nameW}" height="22" rx="5" fill="#fff8e7" stroke="${darker(rc, 0.15)}" stroke-width="2"/>
    <text class="boardtext" x="${cx}" y="${boardY + 11.5}">${p.name}</text>`;

  // sign: a round badge with the place's emoji
  if (!['gable', 'tower', 'pediment'].includes(L.roof)) signY = Math.min(dy - 14, boardY - 18);
  if (!extras.includes('cross') || L.roof !== 'flat') {
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
    const rx = p.w / 2;
    const ry = p.h / 2 - 6;
    // winter: frozen white-blue, a few cracks and skate marks, the ducks stood on the ice
    if (TOWN_SEASON === 'winter') {
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#dcedf8" stroke="#fff" stroke-width="6"/>
        <ellipse cx="${cx - 30}" cy="${cy - 20}" rx="${rx * 0.55}" ry="${ry * 0.4}" fill="#eaf5fc"/>
        <path d="M${cx - 120} ${cy + 30} q40 -30 90 -10 t90 -6 M${cx - 60} ${cy - 50} q60 20 130 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
        <path d="M${cx + 60} ${cy + 40} l18 -12 l10 6 l16 -14 M${cx - 150} ${cy - 10} l14 8 l12 -6" stroke="#b9d9ee" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        ${emo(cx - 30, cy + 4, 18, '🦆')}${emo(cx + 34, cy - 16, 14, '🦆')}
        ${[0, 1, 2].map((i) => `<path d="M${p.x + 10 + i * 6} ${cy + 26} q-2 -16 2 -26" stroke="#a0896b" stroke-width="2.5" fill="none"/>`).join('')}`;
    }
    // summer: lotus leaves and flowers round the edge
    const rnd = seeded(31);
    const lotusRing = TOWN_SEASON !== 'summer' ? '' : [...Array(9)].map((_, i) => {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const x = cx + Math.cos(a) * rx * (0.72 + rnd() * 0.12);
      const y = cy + Math.sin(a) * ry * (0.7 + rnd() * 0.12);
      return `<ellipse cx="${x}" cy="${y}" rx="15" ry="9" fill="#69b34c" stroke="#4d8f36" stroke-width="1.2"/><path d="M${x} ${y} l12 -4" stroke="#4d8f36" stroke-width="1.2"/>`
        + (i % 2 ? lotus(x - 3, y - 6, 1.1) : '');
    }).join('');
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#a5d8ff" stroke="#d0ebff" stroke-width="5"/>${lotusRing}
      <path d="M${cx - 50} ${cy - 10} q10 -5 20 0 M${cx + 10} ${cy + 20} q10 -5 20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
      <g class="paddle">${emo(cx - 30, cy + 4, 18, '🦆')}</g><g class="paddle" style="animation-delay:-2s">${emo(cx + 34, cy - 16, 14, '🦆')}</g>
      ${[0, 1, 2].map((i) => `<path d="M${p.x + 10 + i * 6} ${cy + 26} q-2 -16 2 -26" stroke="${TOWN_SEASON === 'autumn' ? '#b08d3c' : '#69db7c'}" stroke-width="2.5" fill="none"/>`).join('')}`;
  },
  // the vegetable patch by the pig's home: six plots; what grows in them is drawn by gardenCrops()
  garden(p) {
    let svg = `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="#c9a27a"/>`;
    for (const b of gardenPlots(p)) svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="url(#pSoil)" stroke="#8c6239" stroke-width="1.5"/>`;
    svg += fence(p.x - 8, p.y - 4, p.w + 16, p.h + 8, [p.x + p.w / 2 - 22, p.x + p.w / 2 + 22]);
    return svg + `<g id="gardenCrops"></g>`;
  },
  // the red barn, its big doors open
  barn: (p) => decoSvg({ ...p, kind: 'barn' }),
  // the theme park: a striped fence round it with the gate at the front; the ferris wheel and the
  // carousel at the back, the haunted house, the sweet stall and the bumper cars at the front
  funpark(p) {
    const { x, y, w, h } = p;
    const cx = x + w / 2;
    const base = y + h;
    let svg = `<rect x="${x}" y="${y + 16}" width="${w}" height="${h - 16}" rx="26" fill="#fff4e6"/>
      <path d="M${cx} ${base} V${y + 296} M${x + 40} ${y + 292} H${x + w - 40}" stroke="#ffe3c2" stroke-width="28" stroke-linecap="round" fill="none"/>`;
    // the ferris wheel
    const fx = x + 115;
    const fy = y + 134;
    const r = 90;
    const cabins = ['#ff8787', '#ffd43b', '#74c0fc', '#b197fc', '#69db7c', '#ffa94d'];
    svg += `<path d="M${fx - 50} ${y + 282} L${fx} ${fy} L${fx + 50} ${y + 282} M${fx - 30} ${y + 230} H${fx + 30}" stroke="#adb5bd" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <g class="wheel-spin" style="transform-origin:${fx}px ${fy}px">
        <circle cx="${fx}" cy="${fy}" r="${r}" fill="none" stroke="#f783ac" stroke-width="6"/><circle cx="${fx}" cy="${fy}" r="${r * 0.55}" fill="none" stroke="#fcc2d7" stroke-width="3"/>
        ${[...Array(12)].map((_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const [ex, ey] = [fx + Math.cos(a) * r, fy + Math.sin(a) * r];
    return `<path d="M${fx} ${fy} L${ex} ${ey}" stroke="#fcc2d7" stroke-width="2.5"/><circle cx="${ex}" cy="${ey}" r="12" fill="${cabins[i % cabins.length]}" stroke="#fff" stroke-width="3"/>`;
  }).join('')}</g>
      <circle cx="${fx}" cy="${fy}" r="10" fill="#e64980" stroke="#fff" stroke-width="3"/>`;
    // the carousel: a striped tent roof on poles, horses going up and down
    const ox = x + 318;
    const top = y + 70;
    const rim = y + 140;
    const stripes = [...Array(8)].map((_, i) => {
      const a = ox - 84 + i * 21;
      return `<path d="M${ox} ${top} L${a} ${rim} L${a + 21} ${rim} Z" fill="${i % 2 ? '#fff' : '#ff6b6b'}"/>`;
    }).join('');
    svg += `<ellipse cx="${ox}" cy="${y + 236}" rx="90" ry="18" fill="#f08c00"/><ellipse cx="${ox}" cy="${y + 230}" rx="90" ry="18" fill="#ffd43b"/>
      ${[-58, -20, 20, 58].map((dx) => `<rect x="${ox + dx - 2.5}" y="${rim}" width="5" height="${y + 230 - rim}" fill="#fab005"/>`).join('')}
      ${[-58, -20, 20, 58].map((dx, i) => `<g class="bob" style="animation-delay:${-i * 0.5}s">${emo(ox + dx, y + 196 - (i % 2) * 14, 30, '🎠')}</g>`).join('')}
      ${stripes}<path d="M${ox - 84} ${rim} H${ox + 84}" stroke="#e03131" stroke-width="3"/>
      ${[...Array(8)].map((_, i) => `<circle cx="${ox - 74 + i * 21}" cy="${rim + 3}" r="8" fill="${i % 2 ? '#fff' : '#ff6b6b'}" stroke="#e03131" stroke-width="1.5"/>`).join('')}
      <path d="M${ox} ${top} V${top - 24}" stroke="#868e96" stroke-width="2.5"/><path d="M${ox} ${top - 24} l18 6 -18 6 Z" fill="#ffd43b"/>`;
    for (let i = 0; i < 8; i++) CITY_LIGHTS.lamps.push([ox - 74 + i * 21, rim + 3]);
    // the haunted house: crooked purple, a little tower, a friendly ghost at the window
    const hx = x + 28;
    const hy = y + 316;
    const hw = 124;
    const hb = y + 412;
    svg += `${houseShadow(hx, hy, hw, hb - hy, hy + 20)}
      <path d="M${hx} ${hb} V${hy + 34} L${hx + hw / 2} ${hy - 6} L${hx + hw} ${hy + 34} V${hb} Z" fill="#9775fa" stroke="#6741d9" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M${hx - 8} ${hy + 38} L${hx + hw / 2} ${hy - 10} L${hx + hw + 8} ${hy + 38}" fill="none" stroke="#5f3dc4" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M${hx + hw - 34} ${hy + 10} V${hy - 30} H${hx + hw - 12} V${hy + 26}" fill="#845ef7" stroke="#6741d9" stroke-width="2"/>
      <path d="M${hx + hw - 40} ${hy - 28} L${hx + hw - 23} ${hy - 56} L${hx + hw - 6} ${hy - 28} Z" fill="#5f3dc4"/>
      <path d="M${hx + hw / 2 - 16} ${hb} V${hb - 30} a16 16 0 0 1 32 0 V${hb} Z" fill="#3b2a6b"/>
      <path d="M${hx + 4} ${hy + 40} q14 4 18 18 M${hx + 4} ${hy + 50} q8 2 10 10 M${hx + 4} ${hy + 40} l14 14" stroke="#e5dbff" stroke-width="1.2" fill="none"/>`;
    for (const [wx, wy] of [[hx + 16, hy + 50], [hx + hw - 40, hy + 50]]) {
      svg += `<rect x="${wx}" y="${wy}" width="24" height="22" rx="4" fill="#3b2a6b" stroke="#6741d9" stroke-width="2"/>`;
      CITY_LIGHTS.windows.push([wx + 2, wy + 2, 20, 18]);
    }
    svg += `<g class="bob">${emo(hx + hw - 23, hy - 4, 22, '👻')}</g>${emo(hx + 28, hy + 61, 14, '👻', 'opacity=".85"')}`;
    // the sweet stall by the path
    const sx = x + 182;
    const sy = y + 228;
    svg += `<rect x="${sx}" y="${sy + 18}" width="40" height="34" rx="3" fill="#fff" stroke="#e64980" stroke-width="2"/>
      ${[0, 1, 2, 3].map((i) => `<path d="M${sx - 4 + i * 12} ${sy + 18} h12 l-2 -14 h-10 Z" fill="${i % 2 ? '#fff' : '#f783ac'}" stroke="#e64980" stroke-width="1"/>`).join('')}
      ${emo(sx + 10, sy - 6, 16, '🍭')}${emo(sx + 30, sy - 8, 16, '🍦')}${emo(sx + 20, sy + 34, 14, '🍿')}`;
    // the bumper cars: a fenced floor, little round cars
    const ax = x + 284;
    const ay = y + 318;
    svg += `<rect x="${ax}" y="${ay}" width="118" height="88" rx="14" fill="#495057" stroke="#fab005" stroke-width="5" stroke-dasharray="12 8"/>
      ${[[ax + 30, ay + 30, '#ff6b6b'], [ax + 80, ay + 46, '#4dabf7'], [ax + 46, ay + 66, '#ffd43b']].map(([bx, by, c]) => `<ellipse cx="${bx}" cy="${by + 4}" rx="17" ry="11" fill="#212529" opacity=".5"/>
        <ellipse cx="${bx}" cy="${by}" rx="17" ry="11" fill="${c}" stroke="#fff" stroke-width="2.5"/><rect x="${bx - 1.5}" y="${by - 30}" width="3" height="28" fill="#adb5bd"/>`).join('')}`;
    // the fence, open at the gate, and the gate itself
    const gap = 48;
    svg += `<path d="M${cx - gap} ${base} H${x + 26} Q${x} ${base} ${x} ${base - 26} V${y + 42} Q${x} ${y + 16} ${x + 26} ${y + 16} H${x + w - 26} Q${x + w} ${y + 16} ${x + w} ${y + 42} V${base - 26} Q${x + w} ${base} ${x + w - 26} ${base} H${cx + gap}"
        fill="none" stroke="#f783ac" stroke-width="6"/>
      <path d="M${cx - gap} ${base} H${x + 26} Q${x} ${base} ${x} ${base - 26} V${y + 42} Q${x} ${y + 16} ${x + 26} ${y + 16} H${x + w - 26} Q${x + w} ${y + 16} ${x + w} ${y + 42} V${base - 26} Q${x + w} ${base} ${x + w - 26} ${base} H${cx + gap}"
        fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="10 10"/>`;
    for (const gx of [cx - gap, cx + gap]) {
      svg += `<rect x="${gx - 8}" y="${base - 74}" width="16" height="78" rx="4" fill="#f06595" stroke="#c2255c" stroke-width="2"/><circle cx="${gx}" cy="${base - 80}" r="8" fill="#ffd43b" stroke="#f08c00" stroke-width="2"/>`;
      CITY_LIGHTS.lamps.push([gx, base - 80]);
    }
    const nameW = p.name.length * 17 + 30;
    svg += `<path d="M${cx - gap} ${base - 66} Q${cx} ${base - 104} ${cx + gap} ${base - 66}" fill="none" stroke="#f06595" stroke-width="8"/>
      <rect x="${cx - nameW / 2}" y="${base - 108}" width="${nameW}" height="26" rx="8" fill="#fff8e7" stroke="#c2255c" stroke-width="2"/>
      <text class="boardtext" x="${cx}" y="${base - 94.5}">${p.name}</text>
      ${[[-1, '#ff8787'], [1, '#74c0fc']].map(([s, c]) => `<path d="M${cx + s * (gap + 6)} ${base - 82} q${s * 6} -18 ${s * 2} -36" stroke="#adb5bd" fill="none"/><ellipse cx="${cx + s * (gap + 8)}" cy="${base - 126}" rx="9" ry="11" fill="${c}" class="bob"/>`).join('')}`;
    return svg;
  },
  // the neighbours' three houses, each its owner's own: the rabbit's burrow, the panda's bamboo
  // hut, the hedgehog's stump. Each is something to click: walking up to its door to visit.
  houses(p) {
    const art = [burrowSvg, bambooHutSvg, stumpSvg];
    return COTTAGES.map(([dx, dy], i) => `<g class="visit" data-home="${NPCS.find((n) => n.spot === i).id}">${art[i](p.x + dx, p.y + dy, COTTAGE_W, COTTAGE_H)}</g>`).join('');
  },
};

// ---------- homes to visit ----------
// Each drawn in the box (x, y, w, h), the door at the middle of the bottom edge, a shadow falling
// to the right like every other building's

const houseShadow = (x, y, w, h, top) => `<path d="M${x + w - 4} ${top} L${x + w + 16} ${top + 14} L${x + w + 16} ${y + h + 8} L${x + 12} ${y + h + 8} L${x} ${y + h} Z" fill="rgba(70,50,40,.13)"/>`;

// The rabbit's burrow: a grassy mound with a low round door between two carrot posts, two round
// skylights on top like eyes
function burrowSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  const top = y + 22;
  let s = `<ellipse cx="${cx + 10}" cy="${b + 3}" rx="${w / 2 + 6}" ry="9" fill="rgba(70,50,40,.13)"/>
    <path d="M${x + 2} ${b} C${x + 2} ${top + 10} ${x + 30} ${top} ${cx} ${top} C${x + w - 30} ${top} ${x + w - 2} ${top + 10} ${x + w - 2} ${b} Z" fill="#a9d97a" stroke="#74b04a" stroke-width="2"/>
    <path d="M${x + 22} ${top + 30} C${x + 34} ${top + 12} ${cx - 10} ${top + 6} ${cx + 8} ${top + 6}" stroke="#d3f0ae" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M${x + 14} ${b - 16} C${x + 40} ${b - 26} ${x + w - 40} ${b - 26} ${x + w - 14} ${b - 16} L${x + w - 6} ${b} L${x + 6} ${b} Z" fill="#c99a6b" stroke="#a37446" stroke-width="1.5"/>`;
  // grass tufts and a few flowers on the mound
  for (const [dx, dy] of [[-48, 40], [-20, 26], [30, 30], [52, 52], [-58, 70], [8, 54]]) s += `<path d="M${cx + dx - 4} ${top + dy} q2 -7 4 0 q2 -6 4 0" stroke="#74b04a" stroke-width="1.6" fill="none"/>`;
  for (const [dx, dy, c] of [[-34, 58, '#ff8fab'], [44, 66, '#fff3bf'], [16, 18, '#ffd43b']]) s += `<circle cx="${cx + dx}" cy="${top + dy}" r="3" fill="${c}" stroke="#fff" stroke-width="1"/>`;
  // the skylights
  for (const k of [-1, 1]) {
    CITY_LIGHTS.windows.push([cx + k * 26 - 9.5, top + 14.5, 19, 13]);
    s += `<ellipse cx="${cx + k * 26}" cy="${top + 22}" rx="12" ry="9" fill="#8a6a4a"/><ellipse cx="${cx + k * 26}" cy="${top + 21}" rx="9.5" ry="6.5" fill="#e7f5ff" stroke="#c4a27e" stroke-width="1.5"/>
      <path d="M${cx + k * 26 - 4} ${top + 19} l3 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  }
  // the low round door with stones round it
  s += `<path d="M${cx - 20} ${b} V${b - 14} a20 20 0 0 1 40 0 V${b} Z" fill="#8a6a4a"/>
    <path d="M${cx - 15} ${b} V${b - 14} a15 15 0 0 1 30 0 V${b} Z" fill="#e8925a" stroke="#b5683a" stroke-width="1.5"/>
    <path d="M${cx} ${b - 28} V${b}" stroke="#b5683a" stroke-width="1.2"/><circle cx="${cx + 7}" cy="${b - 12}" r="2" fill="#fff3bf"/>`;
  for (const [a, r] of [[200, 21], [235, 22], [270, 23], [305, 22], [340, 21]]) {
    const t = (a * Math.PI) / 180;
    s += `<ellipse cx="${cx + Math.cos(t) * r}" cy="${b - 14 + Math.sin(t) * r}" rx="5" ry="3.5" fill="#dcd3c6" stroke="#b5aa9a" stroke-width="1"/>`;
  }
  // carrot posts either side
  for (const k of [-1, 1]) {
    const px = cx + k * 36;
    s += `<path d="M${px - 6} ${b - 24} L${px + 6} ${b - 24} L${px + 1.5} ${b + 2} L${px - 1.5} ${b + 2} Z" fill="#ff922b" stroke="#e8590c" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M${px - 4} ${b - 17} h4 M${px + 1} ${b - 10} h3" stroke="#e8590c" stroke-width="1.2"/>
      <path d="M${px} ${b - 24} l-6 -9 M${px} ${b - 24} l0 -11 M${px} ${b - 24} l6 -9" stroke="#51cf66" stroke-width="3" stroke-linecap="round"/>`;
  }
  return s;
}

// The panda's bamboo hut: walls of bamboo poles, a thatched roof ridged with bamboo, a round
// moon window, a red lantern by the door, a clump of bamboo growing up beside it and a stool
function bambooHutSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  const eave = y + 52;
  let s = houseShadow(x, y, w, h, eave);
  // the bamboo behind, to the right
  const stalk = (sx, top, c) => {
    let t = `<rect x="${sx - 3}" y="${top}" width="6" height="${b - top}" rx="3" fill="${c}" stroke="${darker(c, 0.25)}" stroke-width="1"/>`;
    for (let yy = top + 16; yy < b - 4; yy += 16) t += `<path d="M${sx - 3} ${yy} h6" stroke="${darker(c, 0.3)}" stroke-width="1.4"/>`;
    for (const [dy, k] of [[6, 1], [24, -1], [44, 1]]) t += `<path d="M${sx} ${top + dy} q${k * 9} -4 ${k * 16} 2 q${-k * 8} 2 ${-k * 16} -2 Z" fill="#69db7c" stroke="#37b24d" stroke-width="1"/>`;
    return t;
  };
  s += stalk(x + w - 2, y - 6, '#8fd46a') + stalk(x + w + 9, y + 10, '#a3dc7c');
  // walls: poles side by side
  const wx = x + 10;
  const ww = w - 20;
  s += `<rect x="${wx}" y="${eave - 4}" width="${ww}" height="${b - eave + 4}" fill="#cfe39a" stroke="#93ad5a" stroke-width="1.5"/>`;
  for (let px = wx + 7; px < wx + ww; px += 9) s += `<path d="M${px} ${eave} V${b}" stroke="#a9c46e" stroke-width="1.6"/>`;
  for (const yy of [eave + 22, eave + 50]) s += `<path d="M${wx} ${yy} H${wx + ww}" stroke="#8aa356" stroke-width="2.2"/>`;
  // thatched roof with a bamboo ridge
  s += `<path d="M${x - 4} ${eave + 2} L${x + 22} ${y + 14} L${x + w - 22} ${y + 14} L${x + w + 4} ${eave + 2} Z" fill="#e2bf74" stroke="#b08a3e" stroke-width="1.8" stroke-linejoin="round"/>`;
  for (let px = x + 4; px < x + w; px += 8) s += `<path d="M${px} ${eave} L${px + (px - cx) * 0.12} ${y + 20}" stroke="#c9a253" stroke-width="1.3"/>`;
  s += `<path d="M${x - 4} ${eave + 2} H${x + w + 4}" stroke="#b08a3e" stroke-width="3" stroke-linecap="round"/>
    <rect x="${x + 16}" y="${y + 8}" width="${w - 32}" height="10" rx="5" fill="#8fd46a" stroke="#5c9e3a" stroke-width="1.5"/>
    ${[0.25, 0.5, 0.75].map((u) => `<path d="M${x + 16 + (w - 32) * u} ${y + 8} v10" stroke="#5c9e3a" stroke-width="1.2"/>`).join('')}`;
  // moon window with a lattice
  const mx = x + 36;
  const my = eave + 30;
  CITY_LIGHTS.windows.push([mx - 13, my - 13, 26, 26]);
  s += `<circle cx="${mx}" cy="${my}" r="16" fill="#fff9db" stroke="#8a6a3a" stroke-width="3"/>
    <path d="M${mx - 15} ${my} H${mx + 15} M${mx} ${my - 15} V${my + 15} M${mx - 10} ${my - 11} V${my + 11} M${mx + 10} ${my - 11} V${my + 11}" stroke="#8a6a3a" stroke-width="1.4"/>`;
  // door, lantern, stool
  const dx = cx + 18;
  s += `<rect x="${dx - 14}" y="${b - 38}" width="28" height="38" rx="2" fill="#a0673f" stroke="#7a4a2a" stroke-width="1.5"/>
    <path d="M${dx} ${b - 38} V${b}" stroke="#7a4a2a" stroke-width="1.2"/><circle cx="${dx - 4}" cy="${b - 18}" r="1.6" fill="#ffd43b"/><circle cx="${dx + 4}" cy="${b - 18}" r="1.6" fill="#ffd43b"/>
    <path d="M${dx + 24} ${eave + 2} V${eave + 10}" stroke="#7a4a2a" stroke-width="1.5"/>
    <ellipse cx="${dx + 24}" cy="${eave + 19}" rx="8" ry="10" fill="#fa5252" stroke="#c92a2a" stroke-width="1.5"/>
    <path d="M${dx + 18} ${eave + 13} h12 M${dx + 18} ${eave + 25} h12" stroke="#ffd43b" stroke-width="2"/><path d="M${dx + 24} ${eave + 29} v6" stroke="#ffd43b" stroke-width="1.5"/>
    <rect x="${x + 2}" y="${b - 12}" width="20" height="5" rx="2" fill="#cfe39a" stroke="#8aa356" stroke-width="1.2"/>
    <path d="M${x + 5} ${b - 7} V${b + 2} M${x + 19} ${b - 7} V${b + 2}" stroke="#8aa356" stroke-width="2.5"/>`;
  return s;
}

// The hedgehog's stump: a big hollow tree stump with a door cut in it, a roof of fallen leaves
// in reds and yellows, a knot-hole window, flowers round the front and a basket of apples
function stumpSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  const sx = x + 14;
  const sw = w - 28;
  const top = y + 40;
  let s = houseShadow(x, y, w, h, top);
  // the stump: bark sides, roots spreading at the foot
  s += `<path d="M${sx} ${top} V${b - 6} q-10 4 -16 6 H${sx + sw + 16} q-6 -2 -16 -6 V${top} Z" fill="#a47148" stroke="#7a4f2c" stroke-width="2" stroke-linejoin="round"/>`;
  for (let px = sx + 10; px < sx + sw - 4; px += 13) s += `<path d="M${px} ${top + 8} q3 ${(b - top) / 2} -1 ${b - top - 14}" stroke="#8a5c36" stroke-width="2" fill="none"/>`;
  // leaves piled on top for a roof
  const leaf = (lx, ly, r, c, a) => `<path d="M${lx - r} ${ly} Q${lx} ${ly - r * 1.1} ${lx + r} ${ly} Q${lx} ${ly + r * 0.7} ${lx - r} ${ly} Z" fill="${c}" stroke="${darker(c, 0.25)}" stroke-width="1.2" transform="rotate(${a} ${lx} ${ly})"/>
    <path d="M${lx - r * 0.8} ${ly} H${lx + r * 0.8}" stroke="${darker(c, 0.3)}" stroke-width="1" transform="rotate(${a} ${lx} ${ly})"/>`;
  const cols = ['#ff922b', '#fa5252', '#fcc419', '#e8590c', '#ffa94d'];
  const rows = [[top + 6, 9, 15, -8], [top - 6, 8, 16, 0], [top - 18, 6, 16, 6], [top - 28, 4, 15, -4]];
  rows.forEach(([ly, n, r, a], j) => {
    const span = sw + 26 - j * 26;
    for (let i = 0; i < n; i++) s += leaf(cx - span / 2 + (span * (i + 0.5)) / n, ly + (i % 2) * 3, r, cols[(i * 3 + j) % cols.length], a + (i % 3 - 1) * 14);
  });
  // knot-hole window and the arched door
  CITY_LIGHTS.windows.push([sx + 14, top + 25.5, 16, 13]);
  s += `<ellipse cx="${sx + 22}" cy="${top + 32}" rx="11" ry="9" fill="#6b4226"/><ellipse cx="${sx + 22}" cy="${top + 32}" rx="8" ry="6.5" fill="#fff3bf" stroke="#c99a6b" stroke-width="1.2"/>
    <path d="M${cx + 4} ${b - 4} V${b - 30} a14 14 0 0 1 28 0 V${b - 4} Z" fill="#5c3a21"/>
    <path d="M${cx + 8} ${b - 4} V${b - 29} a10 10 0 0 1 20 0 V${b - 4} Z" fill="#d39a5e" stroke="#9c6a3c" stroke-width="1.5"/>
    <circle cx="${cx + 24}" cy="${b - 16}" r="1.8" fill="#fff3bf"/>`;
  // flowers along the front and apples by the door
  for (const [fx, c] of [[x + 2, '#ff8fab'], [x + 12, '#ffd43b'], [x + 24, '#b197fc'], [x + w - 4, '#ff8fab'], [x + w + 6, '#ffd43b']]) {
    s += `<path d="M${fx} ${b + 4} V${b - 6}" stroke="#51cf66" stroke-width="1.6"/><circle cx="${fx}" cy="${b - 8}" r="3.6" fill="${c}" stroke="#fff" stroke-width="1"/>`;
  }
  s += `<path d="M${cx - 30} ${b - 10} h24 l-3 12 h-18 Z" fill="#d9a066" stroke="#a0673f" stroke-width="1.5"/>
    ${[[-24, -13], [-16, -14], [-10, -12], [-20, -18]].map(([ax, ay]) => `<circle cx="${cx + ax}" cy="${b + ay}" r="4" fill="#fa5252" stroke="#c92a2a" stroke-width="1"/>`).join('')}`;
  return s;
}

// The cow's ranch house: the little farmhouse with milk churns and a bale of hay by the door
function ranchHouseSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  let s = cottage(x, y, w, h, '#fff4e6', '#c0503a');
  for (const k of [0, 1]) {
    const mx = x + 18 + k * 16;
    s += `<path d="M${mx - 6} ${b + 4} V${b - 14} q0 -4 3 -6 h6 q3 2 3 6 V${b + 4} Z" fill="#dee2e6" stroke="#868e96" stroke-width="1.5"/>
      <rect x="${mx - 4}" y="${b - 24}" width="8" height="4" rx="1.5" fill="#ced4da" stroke="#868e96" stroke-width="1.2"/><path d="M${mx - 6} ${b - 4} h12" stroke="#adb5bd" stroke-width="1.5"/>`;
  }
  s += `<rect x="${cx + 26}" y="${b - 14}" width="34" height="20" rx="4" fill="#ffd43b" stroke="#e0a800" stroke-width="1.5"/>
    <path d="M${cx + 30} ${b - 8} h26 M${cx + 30} ${b - 2} h26" stroke="#f0b400" stroke-width="1.2"/><path d="M${cx + 38} ${b - 14} v20 M${cx + 48} ${b - 14} v20" stroke="#c99a2e" stroke-width="1.6"/>`;
  return s;
}

// The bear's woodshop: a log cabin, the log ends showing at the corners, planks stacked by the
// door, a saw hanging on the wall and curls of smoke from the chimney
function woodshopSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  const eave = y + 50;
  let s = houseShadow(x, y, w, h, eave);
  s += `<rect x="${x + w - 44}" y="${y + 6}" width="14" height="30" fill="#8c6239" stroke="#6b4423" stroke-width="1.5"/>
    <circle class="puff" cx="${x + w - 37}" cy="${y - 2}" r="5"/><circle class="puff" cx="${x + w - 32}" cy="${y - 11}" r="4" style="animation-delay:-1.6s"/>`;
  // logs, each a long rounded bar, ends round at both sides
  const n = 6;
  const lh = (b - eave) / n;
  for (let i = 0; i < n; i++) {
    const ly = eave + i * lh;
    s += `<rect x="${x + 6}" y="${ly}" width="${w - 12}" height="${lh}" rx="${lh / 2}" fill="${i % 2 ? '#c8945e' : '#d3a26c'}" stroke="#8c6239" stroke-width="1.4"/>`;
    for (const ex of [x + 8, x + w - 8]) s += `<circle cx="${ex}" cy="${ly + lh / 2}" r="${lh / 2 + 1}" fill="#e8c393" stroke="#8c6239" stroke-width="1.4"/><circle cx="${ex}" cy="${ly + lh / 2}" r="${lh / 5}" fill="none" stroke="#b5875a" stroke-width="1"/>`;
  }
  // a plank roof
  s += `<path d="M${x - 6} ${eave + 4} L${cx} ${y + 10} L${x + w + 6} ${eave + 4} Z" fill="#9c6b3e" stroke="#6b4423" stroke-width="2" stroke-linejoin="round"/>`;
  for (let k = 1; k < 4; k++) s += `<path d="M${x - 6 + (cx - x + 6) * (k / 4)} ${eave + 4 - (eave - y - 6) * (k / 4)} L${x + w + 6 - (x + w + 6 - cx) * (k / 4)} ${eave + 4 - (eave - y - 6) * (k / 4)}" stroke="#7d5330" stroke-width="1.3"/>`;
  // a window, the door, the saw, the planks
  CITY_LIGHTS.windows.push([x + 20, eave + 14, 26, 22]);
  s += `<rect x="${x + 20}" y="${eave + 14}" width="26" height="22" rx="3" fill="#fff3bf" stroke="#6b4423" stroke-width="2"/><path d="M${x + 33} ${eave + 14} v22 M${x + 20} ${eave + 25} h26" stroke="#6b4423" stroke-width="1.4"/>
    <rect x="${cx - 13}" y="${b - 40}" width="26" height="40" rx="3" fill="#8c6239" stroke="#5c3a1e" stroke-width="1.5"/><path d="M${cx - 13} ${b - 27} h26 M${cx - 13} ${b - 13} h26" stroke="#6b4423" stroke-width="1.2"/><circle cx="${cx + 7}" cy="${b - 20}" r="1.8" fill="#ffd43b"/>
    <path d="M${x + w - 46} ${eave + 16} h26 l-3 9 h-23 Z" fill="#ced4da" stroke="#868e96" stroke-width="1.2"/><path d="M${x + w - 44} ${eave + 25} ${[...Array(8)].map((_, i) => `l1.5 2.5 l1.5 -2.5`).join(' ')}" stroke="#868e96" stroke-width="1" fill="none"/>
    <rect x="${x + w - 26}" y="${eave + 12}" width="10" height="16" rx="3" fill="#a0673f" stroke="#6b4423" stroke-width="1.2"/>
    ${[0, 1, 2].map((i) => `<rect x="${x + w - 2 - i * 3}" y="${b - 8 - i * 6}" width="34" height="6" rx="1.5" fill="${i % 2 ? '#e0b07a' : '#d39a5e'}" stroke="#8c6239" stroke-width="1.2"/>`).join('')}`;
  return s;
}

// The turtle's shell house by the lake: a low dome patterned in green hexagons like a shell, a
// round door with a flat stone for a step, and a fishing rod leaning by it
function shellHouseSvg(x, y, w, h) {
  const cx = x + w / 2;
  const b = y + h;
  const r = w / 2 - 6;
  const ry = h - 18;
  const top = b - ry;
  let s = `<ellipse cx="${cx + 12}" cy="${b + 2}" rx="${w / 2 + 4}" ry="9" fill="rgba(70,50,40,.13)"/>
    <clipPath id="shellClip"><path d="M${cx - r} ${b} A${r} ${ry} 0 0 1 ${cx + r} ${b} Z"/></clipPath>
    <path d="M${cx - r} ${b} A${r} ${ry} 0 0 1 ${cx + r} ${b} Z" fill="#8fcf9f"/>
    <g clip-path="url(#shellClip)">`;
  // the hexagons: a big one on top, a ring round it
  const hex = (hx, hy, hr, c) => `<path d="M${[0, 1, 2, 3, 4, 5].map((i) => `${hx + hr * Math.cos((Math.PI / 3) * i)} ${hy + hr * 0.8 * Math.sin((Math.PI / 3) * i)}`).join(' L')} Z" fill="${c}" stroke="#4f8a62" stroke-width="2.2" stroke-linejoin="round"/>`;
  // a honeycomb of plates, squashed a little as the dome curves away
  const R = 19;
  const vs = Math.sqrt(3) * R * 0.8;
  for (let i = -3; i <= 3; i++) {
    for (let j = 0; j < 5; j++) {
      const hx = cx + i * 1.5 * R;
      const hy = top + 10 + j * vs + (Math.abs(i) % 2 ? vs / 2 : 0);
      s += hex(hx, hy, R - 1.5, (i + j) % 3 ? '#a9d6b5' : '#7fb991');
    }
  }
  s += `</g><path d="M${cx - r} ${b} A${r} ${ry} 0 0 1 ${cx + r} ${b}" fill="none" stroke="#4f8a62" stroke-width="2.5"/>
    <path d="M${cx - r * 0.6} ${top + 20} A${r * 0.8} ${r * 0.8} 0 0 1 ${cx - 6} ${top + 4}" stroke="#d3f0dc" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
    <rect x="${cx - r - 4}" y="${b - 8}" width="${2 * r + 8}" height="10" rx="5" fill="#e9c98f" stroke="#b5894e" stroke-width="1.6"/>`;
  // door and step
  s += `<path d="M${cx - 14} ${b - 6} V${b - 22} a14 14 0 0 1 28 0 V${b - 6} Z" fill="#a0673f" stroke="#6b4423" stroke-width="1.6"/><circle cx="${cx + 7}" cy="${b - 16}" r="1.8" fill="#ffd43b"/>
    <ellipse cx="${cx}" cy="${b + 6}" rx="18" ry="5" fill="#ced4da" stroke="#adb5bd" stroke-width="1.2"/>
    <path d="M${x + w - 4} ${b + 2} L${x + w + 26} ${y + 10}" stroke="#c99a2e" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M${x + w + 26} ${y + 10} q10 18 4 40" stroke="#868e96" stroke-width="1" fill="none"/><circle cx="${x + w + 30}" cy="${y + 52}" r="2.5" fill="#fa5252"/>
    <path d="M${x + w - 14} ${b + 4} h14 l-2 -10 h-10 Z" fill="#d9b26a" stroke="#a0673f" stroke-width="1.3"/>`;
  return s;
}

// A little house with its gable to the front; the two roof slopes run back and up
// The six plots of the vegetable patch, three by two
function gardenPlots(p) {
  const pw = (p.w - 28) / 3;
  const ph = (p.h - 26) / 2;
  return [...Array(GARDEN_PLOTS)].map((_, i) => ({ x: p.x + 8 + (i % 3) * (pw + 6), y: p.y + 8 + Math.floor(i / 3) * (ph + 10), w: pw, h: ph }));
}

// What's growing in each plot: a sprout, a leafy plant, or the ripe crop
function gardenCrops(farm) {
  return gardenPlots(PLACE_BY_ID.garden).map((b, i) => {
    const p = farm[i];
    if (!p) return '';
    const k = plotProgress(p);
    const seed = ITEM_BY_ID[p.seed];
    const ch = k >= 1 ? seed.icon : k < 0.4 ? '🌱' : '🌿';
    return emo(b.x + b.w / 2, b.y + b.h / 2, k >= 1 ? 24 : 14 + 8 * k, ch, k >= 1 ? 'class="bob"' : '');
  }).join('');
}

function cottage(x, y, w, h, body, roof) {
  const cx = x + w / 2;
  const eave = y + 56;
  const peak = y + 26;
  CITY_LIGHTS.windows.push([x + 20, eave + 14, 24, 22], [x + w - 44, eave + 14, 24, 22]);
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
  const win = (wx, wy, s = 18) => (CITY_LIGHTS.home.push([wx, wy, s, s]), '') + `<rect x="${wx}" y="${wy}" width="${s}" height="${s}" rx="5" fill="#fff3bf" stroke="#e599b4" stroke-width="1.2" class="homewin"/>
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
  // a little roller coaster: a wavy track on stilts, a cart on the first hill, flags at the gate
  park: ({ x, y }) => {
    const track = `M${x - 110} ${y - 20} C${x - 80} ${y - 110} ${x - 50} ${y - 110} ${x - 30} ${y - 50} S${x + 10} ${y - 10} ${x + 30} ${y - 70} S${x + 80} ${y - 100} ${x + 110} ${y - 20}`;
    const legs = [-100, -75, -50, -25, 0, 25, 50, 75, 100].map((dx) => `<path d="M${x + dx} ${y} v-${[20, 80, 90, 50, 25, 55, 85, 70, 20][(dx + 100) / 25]}" stroke="#adb5bd" stroke-width="3"/>`).join('');
    return `<ellipse cx="${x}" cy="${y + 4}" rx="125" ry="16" fill="#d3f9d8" opacity=".8"/>${legs}
      <path d="${track}" fill="none" stroke="#e64980" stroke-width="7" stroke-linecap="round"/>
      <path d="${track}" fill="none" stroke="#ffd43b" stroke-width="2" stroke-dasharray="6 6"/>
      <rect x="${x - 74}" y="${y - 108}" width="26" height="14" rx="4" fill="#74c0fc" stroke="#1c7ed6" stroke-width="1.5" transform="rotate(-25 ${x - 61} ${y - 101})"/>
      ${[-120, 120].map((dx) => `<path d="M${x + dx} ${y} v-46" stroke="#868e96" stroke-width="2.5"/><path d="M${x + dx} ${y - 46} l18 6 -18 6 Z" fill="${dx < 0 ? '#ff8787' : '#b197fc'}"/>`).join('')}`;
  },
  // the rocket on its launch pad, ready for the stars
  rocket: ({ x, y }) => `<rect x="${x - 50}" y="${y - 8}" width="100" height="12" rx="3" fill="#868e96"/>
    <path d="M${x + 34} ${y - 8} V${y - 150} M${x + 34} ${y - 60} H${x + 14} M${x + 34} ${y - 110} H${x + 14}" stroke="#ced4da" stroke-width="5" fill="none"/>
    <path d="M${x - 16} ${y - 20} V${y - 120} Q${x} ${y - 165} ${x + 16} ${y - 120} V${y - 20} Z" fill="#f8f9fa" stroke="#adb5bd" stroke-width="2"/>
    <path d="M${x - 16} ${y - 120} Q${x} ${y - 165} ${x + 16} ${y - 120} Z" fill="#e64980"/>
    <circle cx="${x}" cy="${y - 95}" r="8" fill="#74c0fc" stroke="#495057" stroke-width="2"/>
    <path d="M${x - 16} ${y - 50} l-16 32 h16 Z M${x + 16} ${y - 50} l16 32 h-16 Z" fill="#e64980"/>
    <g class="spray"><path d="M${x - 9} ${y - 18} q9 22 18 0" fill="#ffd43b" stroke="#ff922b" stroke-width="2"/></g>`,
  bridge: ({ x, y }) => `<path d="M${x - 90} ${y} Q${x} ${y - 70} ${x + 90} ${y}" fill="none" stroke="#ff8787" stroke-width="7"/>
    <path d="M${x - 82} ${y} Q${x} ${y - 60} ${x + 82} ${y}" fill="none" stroke="#ffd43b" stroke-width="7"/>
    <path d="M${x - 74} ${y} Q${x} ${y - 50} ${x + 74} ${y}" fill="none" stroke="#8ce99a" stroke-width="7"/>
    <path d="M${x - 66} ${y} Q${x} ${y - 40} ${x + 66} ${y}" fill="none" stroke="#74c0fc" stroke-width="7"/>
    <path d="M${x - 58} ${y} Q${x} ${y - 30} ${x + 58} ${y}" fill="none" stroke="#b197fc" stroke-width="7"/>`,
};

// ---------- festivals ----------
// The town dressed up for the day (FESTIVALS): red lanterns along the streets for 春节 and 元宵,
// a ring of coloured lanterns in the square for 元宵, dragon boats on the lake for 端午, little
// lanterns floating on it for 中秋, a big tree in the square for 圣诞

// (glow: lit up after dark; not for one that drifts, whose light would stay behind)
const lantern = (x, y, k = 1, c = '#fa5252', glow = true) => {
  if (glow) CITY_LIGHTS.lamps.push([x, y]);
  return `<g><path d="M${x} ${y - 13 * k} V${y - 18 * k}" stroke="#495057" stroke-width="${1.5 * k}"/>
    <rect x="${x - 6 * k}" y="${y - 13 * k}" width="${12 * k}" height="${3 * k}" rx="1" fill="#fcc419"/>
    <ellipse cx="${x}" cy="${y}" rx="${11 * k}" ry="${10 * k}" fill="${c}" stroke="${darker(c, 0.3)}" stroke-width="${1.2 * k}"/>
    <path d="M${x} ${y - 10 * k} V${y + 10 * k} M${x - 6 * k} ${y - 8 * k} q${-4 * k} ${8 * k} 0 ${16 * k} M${x + 6 * k} ${y - 8 * k} q${4 * k} ${8 * k} 0 ${16 * k}" stroke="${darker(c, 0.25)}" stroke-width="${0.8 * k}" fill="none"/>
    <rect x="${x - 6 * k}" y="${y + 9 * k}" width="${12 * k}" height="${3 * k}" rx="1" fill="#fcc419"/>
    <path d="M${x} ${y + 12 * k} v${8 * k}" stroke="#fcc419" stroke-width="${2 * k}"/></g>`;
};
// a lantern on its own little red post
const lanternPost = (x, y, c) => `<rect x="${x - 2}" y="${y - 40}" width="4" height="40" rx="2" fill="#c92a2a"/><path d="M${x} ${y - 40} h14" stroke="#c92a2a" stroke-width="3" stroke-linecap="round"/>${lantern(x + 14, y - 22, 0.9, c)}`;

function festiveSvg(fest) {
  if (!fest) return '';
  const plaza = PLACE_BY_ID.plaza;
  const pcx = plaza.x + plaza.w / 2;
  const pcy = plaza.y + plaza.h / 2 + 10;
  const lake = PLACE_BY_ID.lake;
  const lcx = lake.x + lake.w / 2;
  const lcy = lake.y + lake.h / 2 + 6;
  let svg = '';
  if (fest === 'newyear' || fest === 'lantern') {
    // red lanterns along the town's straight streets
    for (const r of ROADS.filter((q) => q.stone)) {
      const [[x1, y1], [x2, y2]] = r.pts;
      if (y1 !== y2) continue;
      for (let x = x1 + 30; x < x2 - 30; x += 240) svg += lanternPost(x, y1 + 40, '#fa5252');
    }
  }
  if (fest === 'newyear') {
    // couplets and big lanterns at the square's corners
    for (const [x, y] of [[plaza.x + 30, plaza.y + 40], [plaza.x + plaza.w - 30, plaza.y + 40]]) svg += lantern(x, y, 1.8);
    svg += `<rect x="${pcx - 40}" y="${plaza.y - 6}" width="80" height="26" rx="4" fill="#e03131" stroke="#fcc419" stroke-width="2"/>
      <text class="boardtext" x="${pcx}" y="${plaza.y + 7.5}" fill="#fff3bf" style="fill:#fff3bf">新春快乐</text>`;
  }
  if (fest === 'lantern') {
    // a ring of coloured lanterns round the square, riddles hanging under them
    const colors = ['#fa5252', '#ffa94d', '#ffd43b', '#ff8787', '#da77f2', '#74c0fc'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = pcx + Math.cos(a) * (plaza.w / 2 - 30);
      const y = pcy + Math.sin(a) * (plaza.h / 2 - 26);
      svg += `${lanternPost(x, y, colors[i % colors.length])}<rect x="${x + 10}" y="${y - 2}" width="9" height="13" fill="#fff9db" stroke="#e8590c" stroke-width=".8"/>`;
    }
  }
  if (fest === 'dragon') {
    // two dragon boats racing across the lake, paddles going
    for (const [dx, dy, c] of [[-60, -30, '#e03131'], [40, 30, '#1c7ed6']]) {
      const x = lcx + dx;
      const y = lcy + dy;
      svg += `<g class="boat-race"><path d="M${x - 70} ${y} Q${x} ${y + 16} ${x + 70} ${y} L${x + 60} ${y - 6} H${x - 62} Z" fill="${c}" stroke="${darker(c)}" stroke-width="2"/>
        <path d="M${x - 64} ${y - 6} H${x + 60}" stroke="#fcc419" stroke-width="2" stroke-dasharray="6 4"/>
        ${[-40, -20, 0, 20, 40].map((px) => `<path class="paddle-stroke" d="M${x + px} ${y - 4} l-8 14" stroke="#8c6239" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
        ${emo(x + 74, y - 10, 24, '🐲')}${emo(x - 60, y - 12, 14, '🥁')}</g>`;
    }
  }
  if (fest === 'moon') {
    // little lanterns floating on the lake, a ring of them round its shore
    const rnd = seeded(31);
    for (let i = 0; i < 9; i++) svg += `<g class="paddle" style="animation-delay:${-i * 0.7}s">${lantern(lcx - 150 + rnd() * 300, lcy - 70 + rnd() * 140, 0.7, '#ffa94d', false)}</g>`;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (0.15 + (i / 9) * 0.7);
      svg += lanternPost(lcx + Math.cos(a) * (lake.w / 2 + 20), lcy + Math.sin(a) * (lake.h / 2 + 4), '#ffd43b');
    }
  }
  if (fest === 'xmas') {
    // the big tree in the square: lights, presents, a star on top
    const x = pcx - 60;
    const y = pcy + 10;
    svg += `<ellipse cx="${x}" cy="${y + 2}" rx="46" ry="10" fill="rgba(60,60,40,.18)"/><rect x="${x - 7}" y="${y - 22}" width="14" height="22" fill="#8c6239"/>
      ${[[0, 60], [34, 50], [64, 40]].map(([up, half]) => `<path d="M${x - half} ${y - 18 - up} L${x} ${y - 78 - up} L${x + half} ${y - 18 - up} Z" fill="#2f9e44" stroke="#2b8a3e" stroke-width="2" stroke-linejoin="round"/>`).join('')}
      ${emo(x, y - 150, 24, '⭐')}${emo(x - 36, y - 6, 18, '🎁')}${emo(x + 34, y - 4, 16, '🎁')}`;
    const rnd = seeded(41);
    const bulbs = ['#ffd43b', '#ff6b6b', '#74c0fc', '#fff'];
    for (let i = 0; i < 18; i++) {
      const up = rnd();
      const bx = x + (rnd() - 0.5) * 90 * (1 - up * 0.75);
      const by = y - 24 - up * 110;
      svg += `<circle class="twinkle" style="animation-delay:${-i * 0.23}s" cx="${bx}" cy="${by}" r="3.5" fill="${bulbs[i % bulbs.length]}"/>`;
    }
    CITY_LIGHTS.lamps.push([x, y - 150]);
  }
  return svg;
}

// ---------- animal neighbours ----------

const SPECIES = {
  dog: { body: '#f2a65a', belly: '#fff4e6', ears: 'tri', inner: '#ffd8a8', snout: 'muzzle', tail: 'curl' },
  // pale: a face nearly white all over, outlined darker in the map's small faces so it doesn't wash out
  rabbit: { body: '#f8f9fa', line: '#dee2e6', belly: '#ffffff', ears: 'long', inner: '#ffc9c9', snout: 'bunny', acc: 'apron', pale: true },
  raccoon: { body: '#adb5bd', belly: '#e9ecef', ears: 'round', inner: '#495057', snout: 'muzzle', mask: true, tail: 'stripe' },
  squirrel: { body: '#e8833a', belly: '#ffe8cc', ears: 'tuft', inner: '#ffc078', snout: 'small', tail: 'bushy' },
  cat: { body: '#b8c0d8', belly: '#f1f3f5', ears: 'tri', inner: '#ffc9de', snout: 'cat', acc: 'bell' },
  bear: { body: '#b07d56', belly: '#e6c9a8', ears: 'round', inner: '#e6c9a8', snout: 'muzzle', acc: 'pencil' },
  sheep: { body: '#ffffff', line: '#dee2e6', belly: '#fff', head: '#ffe8d6', ears: 'floppy', inner: '#ffd8c2', snout: 'small', wool: true, acc: 'nurse' },
  owl: { body: '#a47148', belly: '#f1dcc5', ears: 'owl', snout: 'beak', discs: true, acc: 'specs' },
  turtle: { body: '#8ce99a', belly: '#d8f5a2', ears: 'none', snout: 'small', shell: true },
  duck: { body: '#fff9db', line: '#ffe066', belly: '#fff', ears: 'none', snout: 'bill', acc: 'chef' },
  fox: { body: '#ff922b', belly: '#fff4e6', ears: 'tri', inner: '#fff4e6', snout: 'muzzle', tail: 'fox', acc: 'apron' },
  panda: { body: '#ffffff', line: '#ced4da', belly: '#fff', ears: 'round', inner: '#343a40', earFill: '#343a40', snout: 'small', patches: true, limbs: '#343a40', acc: 'cane' },
  hedgehog: { body: '#c08a5b', belly: '#ffe8cc', head: '#ffe8cc', ears: 'round', inner: '#e6c9a8', snout: 'small', spikes: true, acc: 'bow' },
  cow: { body: '#ffffff', line: '#ced4da', belly: '#fff', ears: 'floppy', inner: '#ffc9de', snout: 'cow', cowSpots: true, horns: true },
  bunny: { body: '#ffffff', line: '#dee2e6', belly: '#fff', ears: 'long', inner: '#ffc9c9', snout: 'bunny' },
  // visitors passing through town: kinds no neighbour is
  chick: { body: '#ffe066', line: '#f0b429', belly: '#fff3bf', ears: 'none', snout: 'beak', tuft: true, feet: '#ff922b' },
  alpaca: { body: '#f3e3c9', line: '#d2b48c', belly: '#fff8ec', ears: 'alpaca', inner: '#e8c9a0', snout: 'alpaca', wool: true, fringe: true, acc: 'scarf' },
  penguin: { body: '#3d4b6b', line: '#26304a', belly: '#ffffff', ears: 'none', snout: 'beak', mask: 'penguin', feet: '#ff922b' },
  frog: { body: '#8ce99a', line: '#40c057', belly: '#ebfbee', ears: 'none', snout: 'frog', eyesUp: true },
};

// eyes: how they look (normal, happy, closed, surprised, love; see eyeSvg)
function animalSvg(species, eyes = 'normal', over = '') {
  const sp = SPECIES[species];
  const line = sp.line || darker(sp.body, 0.25);
  const head = sp.head || sp.body;
  const O = `stroke="${line}" stroke-width="1.6"`;
  let back = '';
  if (sp.tail === 'curl') back += `<path d="M112 118 q16 -6 14 -20 q-2 -8 -9 -2" fill="none" stroke="${sp.body}" stroke-width="7" stroke-linecap="round"/>`;
  if (sp.tail === 'stripe') back += `<path d="M110 126 q30 -4 30 -26" fill="none" stroke="#868e96" stroke-width="12" stroke-linecap="round"/><path d="M128 120 l6 -4 M135 110 l6 -2" stroke="#495057" stroke-width="5" stroke-linecap="round"/>`;
  if (sp.tail === 'fox') back += `<path d="M108 128 C148 132 154 96 140 84 C132 100 120 108 106 112 Z" fill="${sp.body}" ${O}/><path d="M146 92 C150 100 148 112 140 118 C138 108 140 100 146 92 Z" fill="#fff"/>`;
  if (sp.spikes) back += [...Array(11)].map((_, i) => { const a = Math.PI * (0.95 + (i / 10) * 1.1); return `<path d="M${80 + Math.cos(a) * 40} ${78 + Math.sin(a) * 44} L${80 + Math.cos(a) * 62} ${78 + Math.sin(a) * 64} L${80 + Math.cos(a + 0.18) * 40} ${78 + Math.sin(a + 0.18) * 44} Z" fill="#8c6239"/>`; }).join('');
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
      ears = `<circle cx="42" cy="32" r="15" fill="${sp.earFill || head}" ${O}/><circle cx="118" cy="32" r="15" fill="${sp.earFill || head}" ${O}/>
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
    case 'alpaca':
      // short banana ears, tipped outwards
      ears = `${earL('M42 40 C30 30 28 16 32 10 C40 14 48 26 54 34 Z')}${earL('M118 40 C130 30 132 16 128 10 C120 14 112 26 106 34 Z')}
        <path d="M42 34 C36 28 34 20 35 16 C40 20 44 26 48 32 Z M118 34 C124 28 126 20 125 16 C120 20 116 26 112 32 Z" fill="${sp.inner}"/>`;
      break;
  }
  const body = sp.shell
    ? `<ellipse cx="80" cy="114" rx="40" ry="28" fill="#94d82d" stroke="#5c940d" stroke-width="2"/>
       <path d="M62 100 l18 -10 l18 10 l0 18 l-18 10 l-18 -10 Z" fill="#a9e34b" stroke="#5c940d" stroke-width="1.5"/>
       <path d="M44 110 l18 -10 M98 100 l18 10 M62 118 l-18 6 M98 118 l18 6" stroke="#5c940d" stroke-width="1.5"/>`
    : `<ellipse cx="80" cy="116" rx="35" ry="25" fill="${sp.body}" ${O}/><ellipse cx="80" cy="122" rx="18" ry="11" fill="${sp.belly}" opacity=".9"/>`;
  const fleece = sp.body === '#ffffff' ? '#fff' : lighter(sp.body, 0.25);
  const wool = sp.wool
    ? [...Array(10)].map((_, i) => { const a = Math.PI + (i / 9) * Math.PI; return `<circle cx="${80 + Math.cos(a) * 40}" cy="${116 + Math.sin(a) * 22}" r="9" fill="${fleece}" ${O}/>`; }).join('') +
      `<circle cx="66" cy="28" r="10" fill="${fleece}" ${O}/><circle cx="80" cy="22" r="11" fill="${fleece}" ${O}/><circle cx="94" cy="28" r="10" fill="${fleece}" ${O}/>`
    : '';
  const tuft = sp.tuft ? `<path d="M76 26 Q70 8 78 4 Q80 14 82 24 M82 26 Q88 10 96 12 Q88 18 84 28" fill="${sp.body}" ${O}/>` : '';
  const foot = sp.feet || (sp.shell ? sp.body : darker(sp.body, 0.06));
  const limbs = `<ellipse cx="63" cy="137" rx="9.5" ry="7" fill="${foot}" ${sp.feet ? `stroke="${darker(sp.feet, 0.2)}" stroke-width="1.6"` : O}/>
    <ellipse cx="97" cy="137" rx="9.5" ry="7" fill="${foot}" ${sp.feet ? `stroke="${darker(sp.feet, 0.2)}" stroke-width="1.6"` : O}/>
    <ellipse cx="46" cy="114" rx="7" ry="9" fill="${sp.limbs || sp.body}" ${O}/><ellipse cx="114" cy="114" rx="7" ry="9" fill="${sp.limbs || sp.body}" ${O}/>`;
  let face = '';
  if (sp.cowSpots) face += '<ellipse cx="46" cy="50" rx="12" ry="9" fill="#343a40"/><ellipse cx="114" cy="44" rx="9" ry="7" fill="#343a40"/>';
  if (sp.horns) face += '<path d="M52 30 q-10 -14 -2 -22 M108 30 q10 -14 2 -22" stroke="#e9c46a" stroke-width="7" fill="none" stroke-linecap="round"/>';
  if (sp.patches) face += `<ellipse cx="58" cy="66" rx="14" ry="17" transform="rotate(-20 58 66)" fill="#343a40"/><ellipse cx="102" cy="66" rx="14" ry="17" transform="rotate(20 102 66)" fill="#343a40"/>`;
  if (sp.mask === true) face += `<path d="M30 62 Q58 40 80 58 Q102 40 130 62 Q120 82 100 74 Q80 66 60 74 Q40 82 30 62 Z" fill="#495057"/>`;
  // a penguin's white face, so the eyes show
  if (sp.mask === 'penguin') face += `<path d="M80 52 C70 38 36 42 38 70 C40 96 62 106 80 104 C98 106 120 96 122 70 C124 42 90 38 80 52 Z" fill="#fff"/>`;
  if (sp.discs) face += `<circle cx="58" cy="64" r="19" fill="${sp.belly}"/><circle cx="102" cy="64" r="19" fill="${sp.belly}"/>`;
  // an alpaca's big fluffy fringe
  if (sp.fringe) face += [[60, 34, 11], [70, 25, 12], [84, 22, 13], [98, 27, 12], [104, 37, 10], [80, 38, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fleece}" ${O}/>`).join('')
    + `<path d="M64 38 Q80 50 100 40" stroke="${fleece}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  // a frog's eyes sit up on top of its head
  if (sp.eyesUp) face += `<circle cx="56" cy="34" r="17" fill="${head}" ${O}/><circle cx="104" cy="34" r="17" fill="${head}" ${O}/>` + eyeSvg(56, 34, eyes) + eyeSvg(104, 34, eyes);
  // drawn lines (smiling, shut) show in white over a panda's dark patches
  else face += (eyeSvg(58, 64, eyes) + eyeSvg(102, 64, eyes)).replace(/class="line"/g, sp.patches ? 'class="line" style="stroke:#fff"' : 'class="line"');
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
    case 'cow':
      face += '<ellipse cx="80" cy="90" rx="22" ry="14" fill="#ffc9de" stroke="#f783ac" stroke-width="1.4"/><ellipse cx="72" cy="90" rx="3" ry="4" fill="#c2255c"/><ellipse cx="88" cy="90" rx="3" ry="4" fill="#c2255c"/>';
      break;
    case 'beak':
      face += `<path d="M72 80 L88 80 L80 96 Z" fill="#ff922b" stroke="#e8590c" stroke-width="1.2" stroke-linejoin="round"/>`;
      break;
    case 'alpaca':
      face += `<ellipse cx="80" cy="88" rx="17" ry="13" fill="${sp.belly}" ${O}/><path d="M75 81 Q80 85 85 81" stroke="#4a2c38" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path class="line thin" d="M80 84 V91 M73 93 Q76.5 97 80 91 Q83.5 97 87 93"/>`;
      break;
    case 'frog':
      face += `<circle cx="72" cy="66" r="1.8" fill="${darker(sp.body, 0.4)}"/><circle cx="88" cy="66" r="1.8" fill="${darker(sp.body, 0.4)}"/>
        <path d="M50 78 Q80 102 110 78" stroke="${darker(sp.body, 0.45)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
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
    case 'cane':
      acc = `<path d="M122 96 V140 M122 96 q0 -10 -9 -10" stroke="#8c6239" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      break;
    case 'bow':
      acc = `<g transform="translate(104 26) rotate(15)"><path d="M0 0 L-12 -8 Q-16 0 -12 8 Z M0 0 L12 -8 Q16 0 12 8 Z" fill="#ff6b9d"/><circle r="4" fill="#f03e83"/></g>`;
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
    case 'scarf':
      acc = `<path d="M50 100 Q80 114 110 100 L110 110 Q80 124 50 110 Z" fill="#ff8787" stroke="#e03131" stroke-width="1.2"/>
        <path d="M60 104 v9 M72 107 v9 M84 108 v9 M96 106 v9" stroke="#ffd43b" stroke-width="3"/><path d="M98 108 l6 22 l8 -2 l-4 -20 Z" fill="#ff8787" stroke="#e03131" stroke-width="1.2"/>`;
      break;
    case 'chef':
      acc = `<rect x="58" y="22" width="44" height="14" rx="3" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/>
        <circle cx="64" cy="14" r="11" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><circle cx="80" cy="8" r="13" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><circle cx="96" cy="14" r="11" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/>
        <rect x="59" y="22" width="42" height="10" fill="#fff"/>`;
      break;
  }
  return `<svg viewBox="-4 -26 168 178" width="168" height="178"><ellipse cx="80" cy="146" rx="34" ry="5" fill="rgba(90,60,40,.16)"/>
    <g class="breathe">${back}${wool}${body}${limbs}${ears}${tuft}<ellipse cx="80" cy="66" rx="48" ry="42" fill="${head}" ${O}/>${face}${acc}${over}</g></svg>`;
}

// ---------- room interiors (cut-away bubbles, 220×140) ----------
// items: [emoji, x, y, size]; pig: where the pig stands; pose: its pose class there.
// draw(ctx) adds anything that changes with progress.

// Whoever came along with the pig, at (left, top) in a room bubble
function roomMate(snap, left, top) {
  const mate = NPC_BY_ID[snap.s.activity?.with];
  if (!mate) return '';
  return `<div class="rm-npc" style="left:${left}px;top:${top + (mate.small ? 12 : 0)}px;width:${mate.small ? 40 : 50}px">${animalSvg(mate.species, 'happy')}</div>`;
}

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
    draw: ({ snap }) => {
      const mate = NPC_BY_ID[snap.s.activity?.with];
      // eating with a friend: they sit across the table (the cook comes out of the kitchen to join)
      const seat = mate ? `<div class="rm-npc" style="left:140px;top:${mate.small ? 82 : 70}px;width:${mate.small ? 40 : 50}px">${animalSvg(mate.species, 'happy')}</div>` : '';
      const cook = mate?.id === 'duck' ? '' : `<div class="rm-npc" style="left:${mate ? 178 : 156}px;top:${mate ? 40 : 46}px;${mate ? 'width:40px' : ''}">${animalSvg('duck')}</div>`;
      return `<div class="rm-counter"></div>${cook}<div class="rm-steam"></div>${seat}`;
    },
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
  // cooking at home: the hob, a pan on it, what's being made
  cook: {
    wall: '#fff4e6', floor: '#ffe8cc', pose: 'working', pig: { x: 90, y: 128 },
    items: [['🍳', 140, 96, 26], ['🔪', 170, 102, 16], ['🧂', 186, 100, 14], ['🥕', 30, 112, 18]],
    draw: ({ snap }) => `<div class="rm-table"></div><div class="rm-dish">${ITEM_BY_ID[snap.s.activity?.id]?.icon || ''}</div>`,
    fx: ['🔥', '😋', '✨'],
  },
  // shelves to fill at the supermarket: boxes on one side, tins and cartons going up
  shelf: {
    wall: '#fff9db', floor: '#ffec99', pose: 'working', pig: { x: 96, y: 128 },
    items: [['🥫', 30, 34, 16], ['🧃', 54, 34, 16], ['🥛', 78, 34, 16], ['🍎', 102, 34, 16], ['📦', 172, 112, 26], ['📦', 190, 92, 20]],
    draw: () => '<div class="rm-shelf"></div>',
    fx: ['📦', '✔️'],
  },
  // a picture book open, the little ones sat round on the mat
  story: {
    wall: '#fff3bf', floor: '#ffd8a8', pose: 'studying', pig: { x: 110, y: 120 },
    items: [['📖', 134, 104, 20], ['🐥', 50, 122, 20], ['🐰', 76, 130, 20], ['🐻', 160, 132, 20], ['🐱', 186, 120, 20], ['🧸', 30, 34, 16]],
    fx: ['📖', '💗', '😮'],
  },
  // behind the bookshop counter, shelves behind
  bookshop: {
    wall: '#fff4e6', floor: '#e9c99b', pose: 'working', pig: { x: 80, y: 126 },
    items: [['📚', 30, 40, 20], ['📕', 54, 42, 16], ['📗', 78, 42, 16], ['📘', 102, 42, 16], ['📖', 128, 98, 18], ['🐰', 180, 112, 22]],
    draw: () => '<div class="rm-shelf"></div><div class="rm-counter low"></div>',
    fx: ['📖', '🧾'],
  },
  // mending toys at a bench in the back of the toy shop
  repair: {
    wall: '#e7f5ff', floor: '#d0ebff', pose: 'working', pig: { x: 80, y: 128 },
    items: [['🧸', 128, 98, 20], ['🔧', 150, 104, 16], ['🪛', 168, 104, 16], ['🤖', 190, 96, 20], ['🔩', 30, 112, 14]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🔧', '⚡', '✨'],
  },
  // mixing soap and bubble bath at the bubble shop
  soap: {
    wall: '#e3fafc', floor: '#c5f6fa', pose: 'working', pig: { x: 76, y: 128 },
    items: [['🧴', 126, 96, 22], ['🧼', 150, 100, 18], ['🧪', 174, 96, 20], ['🫧', 40, 40, 18]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🫧', '✨'],
  },
  // two neighbours across a table, a cup of tea each, the pig in the middle
  mediate: {
    wall: '#fff0f6', floor: '#ffdeeb', pose: 'working', pig: { x: 110, y: 122 },
    items: [['🐻', 50, 112, 26], ['🐰', 170, 112, 26], ['☕', 84, 104, 14], ['☕', 140, 104, 14]],
    draw: () => '<div class="rm-table" style="left:70px;width:84px"></div>',
    fx: ['💬', '🤝', '😊'],
  },
  // the books at the bank
  ledger: {
    wall: '#fff0f6', floor: '#ffdeeb', pose: 'studying', pig: { x: 84, y: 128 },
    items: [['🧮', 128, 98, 22], ['📒', 154, 102, 18], ['🪙', 176, 104, 14], ['🐷', 186, 40, 28]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🧮', '🧾', '🪙'],
  },
  // translating at a desk in the office block
  translate: {
    wall: '#f1f3f5', floor: '#ced4da', pose: 'studying', pig: { x: 88, y: 128 },
    items: [['📄', 126, 102, 18], ['📖', 150, 100, 20], ['🌐', 178, 96, 20], ['🪴', 30, 112, 22]],
    draw: () => '<div class="rm-table"></div>',
    fx: ['🔤', '💬', '💡'],
  },
  // the weather station at the science museum
  weather: {
    wall: '#e7f5ff', floor: '#a5d8ff', pose: 'working', pig: { x: 80, y: 128 },
    items: [['🌡️', 140, 92, 28], ['🌤️', 36, 32, 22], ['🌧️', 186, 30, 20], ['🛰️', 110, 26, 18], ['📋', 170, 104, 18]],
    fx: ['☀️', '🌧️', '💨'],
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
  // the dark cinema: today's film lit up on the screen, a row of red seats, popcorn; a friend who
  // came along in the next seat
  cinema: {
    wall: '#2b2d54', floor: '#4a2c38', pose: 'studying', pig: { x: 100, y: 128 },
    items: [['🍿', 132, 116, 20]],
    draw: ({ snap }) => `<div class="rm-film"><span>${esc(filmToday())}</span></div>
      ${[24, 58, 150, 184].map((x) => `<div class="rm-seat" style="left:${x}px"></div>`).join('')}${roomMate(snap, 160, 72)}`,
    fx: ['😆', '🍿', '😮', '🥹'],
  },
  // a café table by the window, a cup each
  cafe: {
    wall: '#f8f0e3', floor: '#e9c99b', pose: 'dining', pig: { x: 74, y: 128 },
    items: [['☕', 104, 104, 18], ['🧁', 128, 104, 16]],
    draw: ({ snap }) => `<div class="rm-window"></div><div class="rm-table" style="left:96px;width:64px"></div>${roomMate(snap, 160, 70)}`,
    fx: ['☕', '😊', '💬'],
  },
  // a corner of the bookshop: shelves, a book open on the pig's lap
  books: {
    wall: '#fff4e6', floor: '#e9c99b', pose: 'studying', pig: { x: 84, y: 128 },
    items: [['📖', 108, 110, 18], ['📚', 30, 40, 20], ['📕', 54, 42, 16], ['📗', 176, 40, 18]],
    draw: ({ snap }) => `<div class="rm-shelf"></div>${roomMate(snap, 140, 72)}`,
    fx: ['📖', '💡', '😮'],
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
  // the theme park's rides. Up in the ferris wheel's cabin: sky all round, the town far below
  ferris: {
    wall: '#a5d8ff', floor: '#a5d8ff', window: false, pig: { x: 96, y: 112 },
    draw: ({ snap, progress }) => `<div class="rm-sky" style="--up:${Math.sin(progress * Math.PI).toFixed(2)}"><i class="cloud" style="left:20px;top:22px"></i><i class="cloud" style="left:150px;top:40px"></i>
      <div class="rm-roofs"></div></div><div class="rm-cabin"></div>${roomMate(snap, 116, 64)}`,
    fx: ['✨', '😆', '☁️'],
  },
  // round and round on the carousel, the horses going up and down
  carousel: {
    wall: '#fff3bf', floor: '#ffd8a8', pose: 'riding', pig: { x: 86, y: 116 },
    draw: ({ snap }) => `<div class="rm-tent"></div><div class="rm-horse" style="left:56px">🎠</div>
      <div class="rm-horse late" style="left:${snap.s.activity?.with ? 132 : 150}px">🎠</div>${roomMate(snap, 136, 52)}`,
    fx: ['🎵', '✨', '😄'],
  },
  // a dark corridor in the haunted house: cobwebs, a candle, friendly ghosts popping out
  haunted: {
    wall: '#2b1f47', floor: '#3b2a5c', window: false, pose: 'working', pig: { x: 90, y: 128 },
    items: [['🕯️', 30, 104, 18], ['🕸️', 22, 22, 22], ['🕸️', 200, 18, 18], ['🚪', 186, 88, 34]],
    draw: ({ snap }) => `<div class="rm-ghost" style="left:44px;top:30px">👻</div><div class="rm-ghost late" style="left:140px;top:16px">👻</div>${roomMate(snap, 124, 72)}`,
    fx: ['😱', '👻', '💦'],
  },
  // at home
  sleep: { wall: '#e5dbff', floor: '#d0bfff', pig: { x: 110, y: 130 }, items: [['🌙', 180, 28, 20], ['⭐', 40, 26, 12]], draw: () => '<div class="rm-bed wide"></div>', fx: ['💤'] },
  bath: { wall: '#e3fafc', floor: '#99e9f2', pig: { x: 110, y: 120 }, draw: () => '<div class="rm-tub"></div>', items: [['🧴', 34, 104, 18], ['🦆', 160, 104, 16]], fx: ['🫧', '✨'] },
};
ROOMS.paint = ROOMS.easel;

function roomHtml(kind, ctx) {
  const r = ROOMS[kind];
  const items = (r.items || []).map(([ch, x, y, size]) => `<span class="rm-item" style="left:${x}px;top:${y}px;font-size:${size}px">${ch}</span>`).join('');
  return `<div class="rm" style="--wall:${r.wall};--floor:${r.floor}">${r.window === false ? '' : '<div class="rm-window"></div>'}${r.draw ? r.draw(ctx) : ''}${items}</div>`;
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
// The house cut open at the front, 720×360: each room is a little box seen from the front and
// a bit above, with a back wall, side walls and a floor going back. Furniture stands on the
// floor at fixed spots (u: left to right, v: back to front), and the pig's diplomas hang on the
// study's back wall.

const DOLLHOUSE = [
  // 小猪窝: one cosy room under a round roof
  {
    roof: 'dome',
    rooms: [{ x: 150, y: 70, w: 420, h: 250, wall: '#ffe3ec', floor: '#e9b98f', study: true }],
    spots: { bed: [0, 0.16, 0.3], tub: [0, 0.4, 0.22], desk: [0, 0.64, 0.25], piano: [0, 0.88, 0.3], bubbler: [0, 0.42, 0.55],
      sofa: [0, 0.55, 0.85], easel: [0, 0.88, 0.8], kitchen: [0, 0.12, 0.8], pot: [0, 0.27, 0.88] },
  },
  // 公寓: bedroom and bath, living room and study
  {
    roof: 'gable',
    rooms: [{ x: 60, y: 90, w: 300, h: 230, wall: '#fff0f6', floor: '#e9b98f' }, { x: 360, y: 90, w: 300, h: 230, wall: '#e7f5ff', floor: '#d9b48c', study: true }],
    spots: { bed: [0, 0.25, 0.35], tub: [0, 0.75, 0.3], bubbler: [0, 0.78, 0.72], desk: [1, 0.22, 0.28], piano: [1, 0.78, 0.28],
      sofa: [1, 0.45, 0.82], easel: [1, 0.88, 0.78], kitchen: [0, 0.2, 0.85], pot: [1, 0.14, 0.86] },
  },
  // 别墅: two floors, four rooms
  {
    roof: 'gable',
    rooms: [{ x: 50, y: 40, w: 310, h: 145, wall: '#e5dbff', floor: '#d9b48c' }, { x: 360, y: 40, w: 310, h: 145, wall: '#e3fafc', floor: '#cfd8dc' },
      { x: 50, y: 185, w: 310, h: 145, wall: '#fff9db', floor: '#e9b98f', study: true }, { x: 360, y: 185, w: 310, h: 145, wall: '#fff0f6', floor: '#e9b98f' }],
    spots: { bed: [0, 0.3, 0.45], tub: [1, 0.35, 0.45], bubbler: [1, 0.72, 0.6], desk: [2, 0.25, 0.35], piano: [2, 0.75, 0.35], easel: [2, 0.88, 0.85],
      sofa: [3, 0.3, 0.75], kitchen: [3, 0.72, 0.35], pot: [3, 0.86, 0.8] },
  },
  // 城堡: the villa plus a stargazing room in the tower
  {
    roof: 'castle',
    rooms: [{ x: 280, y: 0, w: 160, h: 95, wall: '#2b2d54', floor: '#5c5f8f' },
      { x: 50, y: 95, w: 310, h: 118, wall: '#e5dbff', floor: '#d9b48c' }, { x: 360, y: 95, w: 310, h: 118, wall: '#e3fafc', floor: '#cfd8dc' },
      { x: 50, y: 213, w: 310, h: 118, wall: '#fff9db', floor: '#e9b98f', study: true }, { x: 360, y: 213, w: 310, h: 118, wall: '#fff0f6', floor: '#e9b98f' }],
    spots: { bed: [1, 0.3, 0.45], tub: [2, 0.35, 0.45], bubbler: [2, 0.72, 0.6], desk: [3, 0.25, 0.35], piano: [3, 0.75, 0.35], easel: [3, 0.88, 0.85],
      sofa: [4, 0.3, 0.75], kitchen: [4, 0.72, 0.35], pot: [4, 0.86, 0.8] },
  },
];

// Which spot the pig stands at for what it's doing at home
const HOME_SPOT_FOR = { sleep: 'bed', bath: 'tub', piano: 'piano', paint: 'easel', cook: 'kitchen' };
// decorations that hang on a wall rather than stand on the floor
const WALL_DECOR = ['painting', 'lamp', 'stars'];

// A room's box: where its back wall and floor are
function roomBox(r) {
  const d = Math.min(r.w, r.h) * 0.2;
  return { ...r, d, bx: r.x + d, bw: r.w - 2 * d, by: r.y + d * 0.55, fy: r.y + r.h - d * 1.25 };
}

// A spot on a room's floor (u across, v from the back wall to the front), with a size for things there
function floorPt(b, u, v) {
  const backX = b.bx + u * b.bw;
  const frontX = b.x + u * b.w;
  return { x: backX + (frontX - backX) * v, y: b.fy + (b.y + b.h - b.fy) * v, k: (0.72 + 0.35 * v) * clamp(b.h / 230, 0.6, 1) };
}

const wallPt = (b, u, t) => ({ x: b.bx + u * b.bw, y: b.by + t * (b.fy - b.by) });

function roomSvg(b) {
  const { x, y, w, h, bx, bw, by, fy } = b;
  const right = bx + bw;
  let svg = `<polygon points="${x},${y} ${x + w},${y} ${right},${by} ${bx},${by}" fill="${lighter(b.wall, 0.4)}"/>
    <polygon points="${x},${y} ${bx},${by} ${bx},${fy} ${x},${y + h}" fill="${darker(b.wall, 0.07)}"/>
    <polygon points="${x + w},${y} ${right},${by} ${right},${fy} ${x + w},${y + h}" fill="${darker(b.wall, 0.12)}"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${fy - by}" fill="${b.wall}"/>`;
  // a soft wallpaper stripe on the back wall
  for (let sx = bx + 14; sx < right; sx += 28) svg += `<rect x="${sx}" y="${by}" width="9" height="${fy - by}" fill="#fff" opacity=".18"/>`;
  svg += `<polygon points="${bx},${fy} ${right},${fy} ${x + w},${y + h} ${x},${y + h}" fill="${b.floor}"/>`;
  // floorboards running toward the back
  for (let i = 1; i < 8; i++) svg += `<path d="M${bx + (bw * i) / 8} ${fy} L${x + (w * i) / 8} ${y + h}" stroke="${darker(b.floor, 0.1)}" stroke-width="1.5"/>`;
  svg += `<rect x="${bx}" y="${fy - 6}" width="${bw}" height="6" fill="${darker(b.wall, 0.18)}"/>`;
  // a window on the back wall, except in the study where the diplomas hang
  if (!b.study) {
    const wx = bx + bw / 2;
    const wy = by + (fy - by) * 0.18;
    const ww = Math.min(60, bw * 0.3);
    const wh = (fy - by) * 0.42;
    svg += `<rect x="${wx - ww / 2}" y="${wy}" width="${ww}" height="${wh}" rx="6" fill="#d0ebff" stroke="#fff" stroke-width="4"/>
      <path d="M${wx} ${wy} V${wy + wh} M${wx - ww / 2} ${wy + wh / 2} H${wx + ww / 2}" stroke="#fff" stroke-width="3"/>`;
  }
  return svg;
}

// The outside of the house: thick walls around the rooms, the roof, a strip of garden
function houseShellSvg(D, boxes) {
  const x1 = Math.min(...boxes.map((b) => b.x));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const top = Math.min(...boxes.filter((b) => b.w > 200).map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const cx = (x1 + x2) / 2;
  let svg = `<rect x="0" y="${bottom}" width="720" height="${DH_VIEW.y + DH_VIEW.h - bottom}" fill="#b2f2bb"/>
    <rect x="0" y="${bottom}" width="720" height="6" fill="#8ce99a"/>`;
  for (let i = 0; i < 14; i++) svg += flower(20 + i * 52 + (i % 3) * 7, bottom + 16 + (i % 2) * 10, ['#ff8fab', '#ffd43b', '#b197fc'][i % 3]);
  if (D.roof === 'dome') {
    svg += `<path d="M${x1 - 16} ${top + 8} A${(x2 - x1) / 2 + 16} 70 0 0 1 ${x2 + 16} ${top + 8} Z" fill="#ff8fab" stroke="#e64980" stroke-width="3"/>
      <path d="M${x1 + 30} ${top - 22} Q${cx} ${top - 66} ${x2 - 60} ${top - 30}" stroke="#fff" stroke-width="5" fill="none" opacity=".4" stroke-linecap="round"/>`;
  } else if (D.roof === 'gable') {
    const peak = Math.max(4, top - 80);
    svg += `<path d="M${x1 - 24} ${top + 6} L${x1 + 30} ${peak} L${x2 - 30} ${peak} L${x2 + 24} ${top + 6} Z" fill="#ff8fab" stroke="#e64980" stroke-width="3" stroke-linejoin="round"/>`;
    for (let ry = peak + 14; ry < top; ry += 14) {
      const k = (ry - peak) / (top + 6 - peak);
      svg += `<path d="M${x1 + 30 - 54 * k} ${ry} L${x2 - 30 + 54 * k} ${ry}" stroke="#f06595" stroke-width="1.5" opacity=".6"/>`;
    }
    svg += `<rect x="${x1 + 26}" y="${peak - 6}" width="${x2 - x1 - 52}" height="10" rx="5" fill="#e64980"/>`;
  } else {
    // castle: pink towers with flags either side of the tower room
    for (const tx of [x1 - 10, x2 - 40]) {
      svg += `<rect x="${tx}" y="${top - 60}" width="50" height="${bottom - top + 60}" fill="#ffd6e2" stroke="#f2a0b8" stroke-width="3"/>
        <path d="M${tx - 8} ${top - 58} L${tx + 25} ${top - 110} L${tx + 58} ${top - 58} Z" fill="#cc5de8" stroke="#ae3ec9" stroke-width="3" stroke-linejoin="round"/>
        <path d="M${tx + 25} ${top - 110} V${top - 132}" stroke="#868e96" stroke-width="2"/><path d="M${tx + 25} ${top - 132} l18 5 l-18 5 Z" fill="#ff6b9d" class="flag"/>`;
    }
    svg += `<path d="M${270} ${8} L${360} ${-40} L${450} ${8} Z" fill="#cc5de8" stroke="#ae3ec9" stroke-width="3" stroke-linejoin="round"/>`;
  }
  // the house's cut walls between and around the rooms, drawn over the rooms
  const walls = boxes.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#f3a5bc" stroke-width="7" stroke-linejoin="round"/>`).join('');
  return { back: svg, walls };
}

// The drawing's area for each house: rooms sit at y 0–330, roofs and towers reach up above that
const DH_VIEWS = [{ y: -10, h: 370 }, { y: -10, h: 370 }, { y: -60, h: 420 }, { y: -140, h: 500 }];
let DH_VIEW = DH_VIEWS[0];

function dollhouseHtml(s, pigHtml) {
  const tier = homeTier(s);
  const D = DOLLHOUSE[tier];
  DH_VIEW = DH_VIEWS[tier];
  const boxes = D.rooms.map(roomBox);
  const shell = houseShellSvg(D, boxes);
  let svg = shell.back + boxes.map(roomSvg).join('') + shell.walls;
  if (tier === 3) svg += `<g opacity=".9">${[[310, 22], [350, 14], [400, 26], [330, 40], [420, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff3bf"/>`).join('')}</g>`;
  const pct = (p) => `left:${(p.x / 720) * 100}%;top:${((p.y - DH_VIEW.y) / DH_VIEW.h) * 100}%`;
  const item = (p, ch, size, title, cls = '') => `<span class="dh-item ${cls}" style="${pct(p)};font-size:${Math.round(size * p.k)}px" title="${esc(title)}">${ch}</span>`;

  // furniture: the best piece of each group, in its spot
  const best = {};
  for (const it of ITEMS) {
    if (it.cat !== 'furniture' || !s.inventory[it.id] || it.group === 'house') continue;
    if (!best[it.group] || it.price > best[it.group].price) best[it.group] = it;
  }
  const spot = (group) => {
    const [r, u, v] = D.spots[group];
    return floorPt(boxes[r], u, v);
  };
  const things = [];
  for (const it of Object.values(best)) if (D.spots[it.group]) things.push({ p: spot(it.group), html: (p) => item(p, it.icon, 54, it.name) });
  // empty spots for the basics show faintly, as a hint of what could go there
  for (const [group, ch] of [['bed', '🛏️'], ['tub', '🛁'], ['desk', '📝'], ['sofa', '🛋️']]) {
    if (!best[group]) things.push({ p: spot(group), html: (p) => `<span class="dh-item ghost" style="${pct(p)};font-size:${Math.round(46 * p.k)}px" title="家具城有卖">${ch}</span>` });
  }

  // decorations: wall ones on the back walls' sides, the rest in the floor's front corners
  const wallSpots = boxes.flatMap((b) => [wallPt(b, 0.14, 0.32), wallPt(b, 0.86, 0.32)].map((p) => ({ ...p, k: clamp(b.h / 230, 0.6, 1) })));
  const floorSpots = boxes.flatMap((b) => [floorPt(b, 0.06, 0.96), floorPt(b, 0.94, 0.96), floorPt(b, 0.5, 0.55)]);
  let decorHtml = '';
  for (const it of ownedDecor(s).slice(0, decorSlots(s))) {
    const onWall = WALL_DECOR.includes(it.id);
    const p = (onWall ? wallSpots : floorSpots).shift();
    if (!p) continue;
    if (onWall) decorHtml += item(p, it.icon, 40, it.name, 'on-wall');
    else things.push({ p, html: (q) => item(q, it.icon, 44, it.name) });
  }

  // diplomas, framed on the study wall: one per degree earned
  const study = boxes.find((b) => b.study);
  const degs = degrees(s);
  const shown = degs.slice(0, 10);
  const perRow = 5;
  const diplomas = shown.map((d, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, shown.length - row * perRow);
    const col = i % perRow;
    const p = wallPt(study, 0.5 + (col - (inRow - 1) / 2) * 0.17, 0.2 + row * 0.38);
    const k = clamp(study.h / 230, 0.6, 1);
    return `<div class="dh-diploma" style="${pct(p)};--k:${k}" title="${esc(d)}"><i>🎓</i><span>${esc(d.replace(/毕业$/, ''))}</span></div>`;
  }).join('') + (degs.length > shown.length ? `<div class="dh-diploma more" style="${pct(wallPt(study, 0.95, 0.6))}">+${degs.length - shown.length}</div>` : '');

  // the pig, by whatever it's using
  const a = s.activity;
  const spotKey = a && HOME_SPOT_FOR[a.type === 'hobby' ? a.id : a.type];
  const pigP = spotKey && best[spotKey] ? (() => {
    const [r, u, v] = D.spots[spotKey];
    return floorPt(boxes[r], clamp(u + 0.1, 0, 1), clamp(v + 0.25, 0, 1));
  })() : floorPt(boxes[tier === 3 ? 3 : tier === 2 ? 2 : 0], 0.5, 0.92);
  things.push({ p: pigP, html: (p) => `<div class="dh-pig" style="${pct(p)};width:${Math.round(96 * p.k)}px">${pigHtml}</div>` });

  // things further back are drawn first
  things.sort((m, n) => m.p.y - n.p.y);
  return `<div class="dollhouse" style="aspect-ratio:720 / ${DH_VIEW.h}"><svg viewBox="0 ${DH_VIEW.y} 720 ${DH_VIEW.h}" preserveAspectRatio="xMidYMid meet">${svg}</svg>
    ${diplomas}${decorHtml}${things.map((t) => t.html(t.p)).join('')}</div>`;
}
