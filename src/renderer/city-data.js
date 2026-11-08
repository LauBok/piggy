// Pig City: where every place is, the regions, roads, river and cliff, what blocks walking, and
// where the pig is for each activity. World coordinates are pixels on the map; a place's door is
// the middle of its bottom edge.

const WORLD = { w: 3600, h: 2600 };

// A smooth curve through some points (Catmull-Rom), as a list of points about `step` apart
function smoothLine(pts, step = 16) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ---------- the land ----------

// The cliff along the north: the hills up there are reached by stone steps (gaps)
const CLIFF = { y: 420, h: 40, steps: [[468, 540], [1514, 1586]] };

// The river: from a waterfall off the cliff, down between the village and the town
const RIVER = smoothLine([[1150, 458], [1130, 640], [1185, 980], [1135, 1330], [1190, 1700], [1145, 2060], [1175, 2600]], 12);
const RIVER_W = 34; // half width
// the river's middle at every height, worked out once (walking checks it a lot)
const RIVER_X = (() => {
  const xs = new Float32Array(WORLD.h + 1).fill(NaN);
  for (let i = 1; i < RIVER.length; i++) {
    const [x1, y1] = RIVER[i - 1];
    const [x2, y2] = RIVER[i];
    for (let y = Math.ceil(y1); y <= Math.min(WORLD.h, Math.floor(y2)); y++) xs[y] = x1 + ((x2 - x1) * (y - y1)) / (y2 - y1 || 1);
  }
  return xs;
})();
const riverXAt = (y) => RIVER_X[clamp(Math.round(y), 0, WORLD.h)];
// wooden bridges where roads cross the river
const BRIDGES = [860, 1330, 2050].map((y) => ({ x: riverXAt(y), y }));
const BRIDGE_HALF = RIVER_W + 42; // half the deck's length: past the banks on both sides

// Regions, each with its own feel. ground: how its ground is drawn. sign: where its name board stands.
const DISTRICTS = [
  { id: 'hills', name: '北山', rect: [0, 0, 3600, 420], color: '#cfe8b4', ground: 'hills', sign: [560, 470] },
  { id: 'village', name: '小猪村', rect: [40, 470, 1100, 2560], color: '#e6f2c9', ground: 'farm', sign: [640, 1380] },
  { id: 'campus', name: '学园区', rect: [1230, 470, 2460, 880], color: '#f6efcf', ground: 'lawn', sign: [1290, 790] },
  { id: 'downtown', name: '市中心', rect: [1240, 920, 2440, 1730], color: '#ece6df', ground: 'stone', sign: [1212, 1280] },
  { id: 'park', name: '中央公园', rect: [2480, 470, 3560, 2000], color: '#c9ecb1', ground: 'park', sign: [2500, 1290] },
  { id: 'market', name: '商业街', rect: [1240, 1780, 2440, 2560], color: '#f5e1cf', ground: 'brick', sign: [1212, 2010] },
];

// Roads: smooth curves through these points. stone: paved town streets; otherwise dirt paths.
const ROAD_DEFS = [
  // village lane, from the forest steps down through the village
  { pts: [[504, 430], [480, 720], [520, 1000], [560, 1340], [520, 1700], [560, 2000], [600, 2560]] },
  // over the north bridge to the school walkway, on to the building site
  { pts: [[480, 760], [800, 830], [BRIDGES[0].x - BRIDGE_HALF, 860]] },
  { pts: [[BRIDGES[0].x + BRIDGE_HALF, 860], [1300, 790], [1900, 760], [2460, 770], [2830, 760]] },
  // up the steps to the hot spring
  { pts: [[1550, 790], [1550, 430], [1600, 360], [1700, 350]] },
  // over the middle bridge into town
  { pts: [[560, 1340], [880, 1320], [BRIDGES[1].x - BRIDGE_HALF, 1330]] },
  { pts: [[BRIDGES[1].x + BRIDGE_HALF, 1330], [1270, 1330]] },
  // over the south bridge onto the shopping street
  { pts: [[560, 2000], [880, 2050], [BRIDGES[2].x - BRIDGE_HALF, 2050]] },
  { pts: [[BRIDGES[2].x + BRIDGE_HALF, 2050], [1250, 2050]] },
  // up in the hills
  { pts: [[200, 380], [504, 400], [900, 360], [1454, 400], [2000, 360], [2600, 380]] },
  // the park's winding paths
  { pts: [[2440, 1240], [2650, 1200], [2760, 980], [3100, 900], [3450, 980]] },
  { pts: [[2650, 1200], [2760, 1560], [3150, 1700], [3450, 1600]] },
  // town streets, straight and paved
  { stone: true, pts: [[1250, 960], [2440, 960]] },
  { stone: true, pts: [[1250, 1240], [2440, 1240]] },
  { stone: true, pts: [[1250, 1520], [2440, 1520]] },
  { stone: true, pts: [[1250, 1765], [2440, 1765]] },
  { stone: true, pts: [[1250, 1330], [1250, 2370]] },
  { stone: true, pts: [[1700, 770], [1700, 2050]] },
  { stone: true, pts: [[2100, 770], [2100, 2050]] },
  { stone: true, pts: [[2440, 770], [2440, 2370]] },
  { stone: true, pts: [[1250, 2050], [2440, 2050]] },
  { stone: true, pts: [[1250, 2370], [2440, 2370]] },
  { stone: true, pts: [[2440, 2370], [2910, 2400]] },
  // on to the theme park's gate
  { pts: [[2910, 2400], [3120, 2470], [3360, 2500]] },
];
const ROADS = ROAD_DEFS.map((r) => ({ ...r, line: r.stone ? r.pts : smoothLine(r.pts) }));

// kind: how the place is drawn (see city-art.js). sheet: what opens when it's entered.
// look: facade options for buildings. minLevel: greyed out with a lock until then.
const PLACES = [
  // the hills
  { id: 'truffle', name: '松露林', icon: '🍄', kind: 'forest', x: 90, y: 60, w: 680, h: 300, sheet: 'jobs' },
  { id: 'spring', name: '泥浴温泉', icon: '♨️', kind: 'spring', x: 1560, y: 110, w: 360, h: 210, sheet: 'spring' },
  { id: 'site', name: '工地', icon: '🏗️', kind: 'site', x: 2600, y: 470, w: 440, h: 260, sheet: 'jobs' },

  // school district: spaced out along a tree-lined walk
  { id: 'primary', name: '小学', icon: '🎒', kind: 'building', x: 1320, y: 530, w: 190, h: 170, sheet: 'school', stage: 'primary', minLevel: 6,
    look: { body: '#ffe8a3', roof: 'gable', roofColor: '#ff8787', win: [2, 3], extra: 'flag' } },
  { id: 'middle', name: '中学', icon: '📗', kind: 'building', x: 1600, y: 520, w: 190, h: 180, sheet: 'school', stage: 'middle', minLevel: 12,
    look: { body: '#d3f9d8', roof: 'gable', roofColor: '#51cf66', win: [2, 3], extra: 'clock' } },
  { id: 'college', name: '大学', icon: '🎓', kind: 'building', x: 1880, y: 490, w: 240, h: 210, sheet: 'school', stage: 'college', minLevel: 18,
    look: { body: '#f3d9fa', roof: 'tower', roofColor: '#be4bdb', win: [3, 4] } },
  { id: 'museum', name: '科技馆', icon: '🔭', kind: 'building', x: 2200, y: 540, w: 200, h: 160, sheet: 'jobs',
    look: { body: '#dbe4ff', roof: 'dome', roofColor: '#91a7ff', win: [1, 3] } },

  // downtown: packed close together
  { id: 'tower', name: '职业介绍所', icon: '🏢', kind: 'building', x: 1300, y: 990, w: 180, h: 230, sheet: 'tower',
    look: { body: '#c5f6fa', roof: 'flat', roofColor: '#66d9e8', win: [5, 3], extra: 'antenna' } },
  { id: 'office', name: '写字楼', icon: '🏙️', kind: 'building', x: 1500, y: 1000, w: 170, h: 220, sheet: 'jobs',
    look: { body: '#e7f5ff', roof: 'flat', roofColor: '#74c0fc', win: [5, 3] } },
  { id: 'cityhall', name: '市政厅', icon: '🏛️', kind: 'building', x: 1730, y: 1030, w: 340, h: 190, sheet: 'cityhall',
    look: { body: '#fff9db', roof: 'dome', roofColor: '#ffd43b', win: [1, 4], extra: 'columns' } },
  { id: 'bank', name: '存钱罐银行', icon: '🐷', kind: 'building', x: 2130, y: 1060, w: 210, h: 160, sheet: 'bank',
    look: { body: '#fff0f6', roof: 'pediment', roofColor: '#f783ac', win: [1, 3], extra: 'columns' } },
  { id: 'supermarket', name: '超市', icon: '🛒', kind: 'building', x: 1290, y: 1280, w: 180, h: 190, sheet: 'shop',
    look: { body: '#e7f5ff', roof: 'flat', roofColor: '#1c7ed6', awning: ['#fa5252', '#fff'], win: [1, 3], extra: ['carts'] } },
  { id: 'plaza', name: '中心广场', icon: '⛲', kind: 'plaza', x: 1720, y: 1268, w: 360, h: 236, sheet: 'jobs' },
  { id: 'artpalace', name: '艺术宫', icon: '🎻', kind: 'building', x: 2130, y: 1300, w: 280, h: 200, sheet: 'jobs',
    look: { body: '#fff0f6', roof: 'dome', roofColor: '#cc5de8', win: [2, 4], extra: 'columns' } },
  { id: 'canteen', name: '食堂', icon: '🍱', kind: 'building', x: 1290, y: 1560, w: 200, h: 140, sheet: 'canteen',
    look: { body: '#fff4e6', roof: 'gable', roofColor: '#ff922b', awning: ['#ff922b', '#fff'], win: [1, 3] } },
  { id: 'clinic', name: '诊所', icon: '🏥', kind: 'building', x: 1500, y: 1540, w: 190, h: 160, sheet: 'clinic',
    look: { body: '#ffffff', roof: 'flat', roofColor: '#ff8787', win: [2, 3], extra: 'cross' } },

  // the park: lots of room
  { id: 'chess', name: '棋亭', icon: '♟️', kind: 'pavilion', x: 2560, y: 820, w: 180, h: 150, sheet: 'chess' },
  { id: 'stage', name: '露天舞台', icon: '🎤', kind: 'stage', x: 3160, y: 700, w: 240, h: 170, sheet: 'jobs' },
  { id: 'lake', name: '鸭鸭湖', icon: '🦆', kind: 'lake', x: 2860, y: 1060, w: 440, h: 300, sheet: 'jobs' },
  { id: 'field', name: '球场', icon: '⚽', kind: 'field', x: 2500, y: 1650, w: 280, h: 190, sheet: 'field' },

  // the furniture warehouse, on its own big lot
  { id: 'furniture', name: '家具城', icon: '🛋️', kind: 'building', x: 2720, y: 2140, w: 380, h: 220, sheet: 'furniture',
    look: { body: '#f4ece4', roof: 'flat', roofColor: '#a9805b', awning: ['#94d82d', '#fff'], win: [1, 4], extra: ['warehouse', 'sofaout'] } },

  // pig village
  { id: 'home', name: '小猪的家', icon: '🏠', kind: 'home', x: 260, y: 1120, w: 210, h: 180, sheet: 'home' },
  { id: 'kinder', name: '幼儿园', icon: '🧸', kind: 'building', x: 700, y: 1530, w: 170, h: 150, sheet: 'jobs',
    look: { body: '#fff3bf', roof: 'gable', roofColor: '#ffa94d', win: [1, 2], extra: 'balloons' } },
  { id: 'farm', name: '农牧市场', icon: '🧺', kind: 'building', x: 620, y: 1150, w: 210, h: 140, sheet: 'shop',
    look: { body: '#fff4e6', roof: 'gable', roofColor: '#94d82d', awning: ['#ff922b', '#fff'], win: [1, 2], extra: ['stalls'] } },
  { id: 'garden', name: '菜园', icon: '🌱', kind: 'garden', x: 70, y: 1150, w: 170, h: 130, sheet: 'garden' },
  { id: 'neighbors', name: '邻居家', icon: '🏡', kind: 'houses', x: 100, y: 1620, w: 360, h: 330, sheet: 'jobs' },

  // shopping street: shoulder to shoulder
  { id: 'bakery', name: '面包房', icon: '🍞', kind: 'building', x: 1290, y: 1850, w: 170, h: 150, sheet: 'shop',
    look: { body: '#fff4e6', roof: 'gable', roofColor: '#e8a87c', awning: ['#ff8787', '#fff'], win: [1, 2] } },
  { id: 'bubble', name: '泡泡屋', icon: '🧼', kind: 'building', x: 1470, y: 1860, w: 160, h: 140, sheet: 'shop',
    look: { body: '#e3fafc', roof: 'dome', roofColor: '#74c0fc', awning: ['#4dabf7', '#fff'], win: [1, 2], extra: 'bubbles' } },
  { id: 'toy', name: '玩具店', icon: '🧸', kind: 'building', x: 1720, y: 1850, w: 170, h: 150, sheet: 'shop',
    look: { body: '#fff9db', roof: 'gable', roofColor: '#fcc419', awning: ['#ffa94d', '#fff'], win: [1, 2] } },
  { id: 'clothes', name: '服装店', icon: '🎀', kind: 'building', x: 1900, y: 1860, w: 180, h: 140, sheet: 'shop',
    look: { body: '#fff0f6', roof: 'flat', roofColor: '#f783ac', awning: ['#f783ac', '#fff'], win: [1, 2] } },

  { id: 'store', name: '小卖部', icon: '🏪', kind: 'building', x: 1280, y: 2190, w: 160, h: 140, sheet: 'shop',
    look: { body: '#ebfbee', roof: 'flat', roofColor: '#40c057', awning: ['#40c057', '#fff'], win: [1, 2] } },
  { id: 'restaurant', name: '小猪餐馆', icon: '🍜', kind: 'building', x: 1460, y: 2170, w: 220, h: 160, sheet: 'shop',
    look: { body: '#fff5f5', roof: 'gable', roofColor: '#e03131', awning: ['#e03131', '#fff'], win: [1, 3], extra: 'lantern' } },
  { id: 'artschool', name: '艺术培训', icon: '🎼', kind: 'building', x: 1720, y: 2180, w: 180, h: 150, sheet: 'jobs',
    look: { body: '#f8f0fc', roof: 'gable', roofColor: '#9775fa', win: [2, 2], extra: 'note' } },
  { id: 'salon', name: '理发店', icon: '💇', kind: 'building', x: 1915, y: 2185, w: 180, h: 145, sheet: 'salon',
    look: { body: '#f8f0fc', roof: 'gable', roofColor: '#f06595', awning: ['#f06595', '#fff'], win: [1, 2] } },
  { id: 'beauty', name: '美容店', icon: '💅', kind: 'building', x: 2140, y: 1855, w: 170, h: 145, sheet: 'beauty',
    look: { body: '#e6fcf5', roof: 'dome', roofColor: '#20c997', awning: ['#20c997', '#fff'], win: [1, 2] } },
  { id: 'courier', name: '快递站', icon: '📦', kind: 'building', x: 2120, y: 2190, w: 220, h: 140, sheet: 'jobs',
    look: { body: '#fff3bf', roof: 'flat', roofColor: '#f59f00', win: [1, 2], extra: 'garage' } },

  // in town: books, a film, a cup of something; the flats where four neighbours live
  { id: 'bookstore', name: '书店', icon: '📚', kind: 'building', x: 1490, y: 1300, w: 170, h: 170, sheet: 'shop',
    look: { body: '#fff4e6', roof: 'gable', roofColor: '#94d82d', awning: ['#2f9e44', '#fff'], win: [1, 2] } },
  { id: 'cinema', name: '电影院', icon: '🎬', kind: 'building', x: 1730, y: 1540, w: 220, h: 160, sheet: 'cinema',
    look: { body: '#f3f0ff', roof: 'flat', roofColor: '#7048e8', win: [1, 3] } },
  { id: 'cafe', name: '咖啡馆', icon: '☕', kind: 'building', x: 1962, y: 1580, w: 118, h: 120, sheet: 'shop',
    look: { body: '#f8f0e3', roof: 'gable', roofColor: '#a9805b', awning: ['#a9805b', '#fff'], win: [1, 2] } },
  { id: 'apt', name: '公寓', icon: '🏢', kind: 'building', x: 2140, y: 1520, w: 150, h: 190, sheet: 'apt',
    look: { body: '#e7f5ff', roof: 'flat', roofColor: '#339af0', win: [4, 2] } },
  // in the village: the barn buys the vegetable patch's harvest
  { id: 'barn', name: '谷仓', icon: '🌾', kind: 'barn', x: 640, y: 560, w: 200, h: 180, sheet: 'barn' },
  // past the furniture warehouse: the theme park, its gate at the bottom
  { id: 'funpark', name: '游乐园', icon: '🎡', kind: 'funpark', x: 3150, y: 2030, w: 420, h: 440, sheet: 'funpark' },
];
const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// Other buildings: the windmill, just part of the countryside, and the homes the pig can visit
const DECOS = [
  { name: '风车', icon: '🌀', kind: 'windmill', x: 900, y: 1000, w: 120, h: 220 },
  // three keepers' homes, which the pig can visit (home: whose)
  { name: '牧场小屋', icon: '🐄', kind: 'ranchhouse', home: 'cow', x: 620, y: 2130, w: 160, h: 140 },
  { name: '木工房', icon: '🪚', kind: 'woodshop', home: 'bear', x: 2770, y: 1950, w: 150, h: 130 },
  { name: '龟壳屋', icon: '🐢', kind: 'shellhouse', home: 'turtle', x: 2770, y: 1392, w: 130, h: 110 },
];

// Farm fields and the ranch's pasture in the village: fenced, the pig walks round them
const FIELDS = [
  { x: 90, y: 560, w: 330, h: 330, crop: ['🥕', '🥬', '🌽'] },
  { x: 640, y: 910, w: 200, h: 150, crop: ['🎃'] },
];
const PASTURE = { x: 80, y: 2080, w: 420, h: 400, animals: ['🐄', '🐑', '🐑', '🐐', '🐄', '🐔'] };

// The little cottages of the neighbours: [x, y] offsets inside the place, each 150×130
const COTTAGES = [[0, 0], [200, 30], [40, 190]];
const COTTAGE_W = 150;
const COTTAGE_H = 130;

// Little touches that make buildings recognisable (see facade() in city-art.js)
const PLACE_EXTRAS = {
  bakery: ['chimney', 'breadwin'], toy: ['teddy', 'balloons'], clothes: ['mannequin'], restaurant: ['lantern', 'chimney'],
  canteen: ['chimney'], clinic: ['cross', 'ambulance'], courier: ['garage', 'truck'], artschool: ['note', 'keys'],
  office: ['glass'], tower: ['antenna', 'helipad', 'glass'], salon: ['pole'], beauty: ['vanity'],
};

for (const p of PLACES) {
  if (PLACE_EXTRAS[p.id]) p.look.extra = PLACE_EXTRAS[p.id];
  p.door = { x: p.x + p.w / 2, y: p.y + p.h };
  // where the pig stands to go in
  p.entry = { x: p.door.x, y: p.door.y + 18 };
}
// the neighbours' place is entered at the front cottage; each cottage has its own doorstep
const HN = PLACE_BY_ID.neighbors;
HN.houses = COTTAGES.map(([dx, dy]) => ({ x: HN.x + dx + COTTAGE_W / 2, y: HN.y + dy + COTTAGE_H + 18 }));
HN.door = { x: HN.houses[2].x, y: HN.houses[2].y - 18 };
HN.entry = HN.houses[2];

// The homes the pig can visit: whose, the house's door, and where he stands to knock
const HOMES = {};
COTTAGES.forEach(([dx, dy], i) => {
  const door = { x: HN.x + dx + COTTAGE_W / 2, y: HN.y + dy + COTTAGE_H };
  HOMES[NPCS.find((n) => n.spot === i).id] = { door, entry: { x: door.x, y: door.y + 18 }, h: COTTAGE_H };
});
for (const d of DECOS) {
  if (d.home) HOMES[d.home] = { door: { x: d.x + d.w / 2, y: d.y + d.h }, entry: { x: d.x + d.w / 2, y: d.y + d.h + 18 }, h: d.h };
}

// A point next to a place: its door moved by (dx, dy)
const near = (id, dx = 0, dy = 0) => ({ x: PLACE_BY_ID[id].door.x + dx, y: PLACE_BY_ID[id].door.y + dy });

// Where donated monuments go on the map
const DONATION_SPOTS = {
  fountain: near('plaza', -90, -80),
  statue: near('plaza', 100, -70),
  ferris: { x: 3260, y: 1900 },
  bridge: near('lake', 0, -130),
  park: { x: 3010, y: 1820 },
  rocket: { x: 3470, y: 1500 },
};

// ---------- what blocks walking ----------

const PIG_R = 18; // half the pig's width at its feet

// Rectangles [x1, y1, x2, y2] and ellipses { cx, cy, rx, ry } the pig can't walk into
const BLOCKERS = (() => {
  const rects = [];
  const ellipses = [];
  for (const p of PLACES) {
    if (['building', 'home', 'pavilion', 'stage', 'garden', 'barn', 'funpark'].includes(p.kind)) rects.push([p.x, p.y, p.x + p.w, p.y + p.h - 4]);
    if (p.kind === 'lake') ellipses.push({ cx: p.x + p.w / 2, cy: p.y + p.h / 2 + 6, rx: p.w / 2, ry: p.h / 2 - 6 });
    if (p.kind === 'spring') ellipses.push({ cx: p.x + p.w / 2, cy: p.y + p.h - 70, rx: p.w / 2 - 10, ry: 56 });
  }
  for (const [dx, dy] of COTTAGES) rects.push([HN.x + dx, HN.y + dy + 20, HN.x + dx + COTTAGE_W, HN.y + dy + COTTAGE_H - 4]);
  for (const d of DECOS) rects.push([d.x, d.y, d.x + d.w, d.y + d.h - 4]);
  for (const f of [...FIELDS, PASTURE]) rects.push([f.x, f.y, f.x + f.w, f.y + f.h]);
  // the cliff, except where the steps go up
  let x = 0;
  for (const [a, b] of CLIFF.steps) {
    rects.push([x, CLIFF.y - 6, a, CLIFF.y + CLIFF.h]);
    x = b;
  }
  rects.push([x, CLIFF.y - 6, WORLD.w, CLIFF.y + CLIFF.h]);
  rects.push([2700, 0, 3600, CLIFF.y]); // mountains
  return { rects, ellipses };
})();

const onBridge = (x, y) => BRIDGES.some((b) => Math.abs(x - b.x) < BRIDGE_HALF && Math.abs(y - b.y) < 22);

function walkable(x, y) {
  if (x < 20 || y < 30 || x > WORLD.w - 20 || y > WORLD.h - 12) return false;
  for (const [x1, y1, x2, y2] of BLOCKERS.rects) if (x > x1 - PIG_R && x < x2 + PIG_R && y > y1 && y < y2 + 6) return false;
  for (const e of BLOCKERS.ellipses) if (((x - e.cx) / (e.rx + PIG_R)) ** 2 + ((y - e.cy) / (e.ry + 6)) ** 2 < 1) return false;
  // the river, except on a bridge
  const rx = riverXAt(y);
  if (rx === rx && Math.abs(x - rx) < RIVER_W + PIG_R && !onBridge(x, y)) return false;
  return true;
}

// ---------- finding the way ----------

const GRID = 20;
const GW = Math.ceil(WORLD.w / GRID);
const GH = Math.ceil(WORLD.h / GRID);
const OPEN = (() => {
  const g = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) g[j * GW + i] = walkable(i * GRID + GRID / 2, j * GRID + GRID / 2) ? 1 : 0;
  return g;
})();

// Nothing in the way along a straight line
function clearLine(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 6);
  for (let k = 1; k < n; k++) if (!walkable(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false;
  return true;
}

// A walking route from a to b around buildings and water (A* on a grid, then straightened)
function findPath(a, b) {
  if (clearLine(a, b)) return [a, b];
  const cell = (p) => [clamp(Math.floor(p.x / GRID), 0, GW - 1), clamp(Math.floor(p.y / GRID), 0, GH - 1)];
  // the nearest open cell to a point (start/goal might sit right on an edge)
  const openNear = ([i, j]) => {
    for (let r = 0; r < 6; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const x = i + di;
        const y = j + dj;
        if (x >= 0 && y >= 0 && x < GW && y < GH && OPEN[y * GW + x]) return [x, y];
      }
    }
    return [i, j];
  };
  const [si, sj] = openNear(cell(a));
  const [gi, gj] = openNear(cell(b));
  const start = sj * GW + si;
  const goal = gj * GW + gi;
  const g = new Float32Array(GW * GH).fill(Infinity);
  const from = new Int32Array(GW * GH).fill(-1);
  const h = (k) => Math.hypot((k % GW) - gi, Math.floor(k / GW) - gj);
  const heap = [[h(start), start]];
  g[start] = 0;
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (heap[pi][0] <= heap[i][0]) break;
      [heap[pi], heap[i]] = [heap[i], heap[pi]];
      i = pi;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, k] = pop();
    if (k === goal) break;
    const i = k % GW;
    const j = Math.floor(k / GW);
    for (const [di, dj, c] of STEPS) {
      const x = i + di;
      const y = j + dj;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const n = y * GW + x;
      if (!OPEN[n] || (di && dj && (!OPEN[j * GW + x] || !OPEN[y * GW + i]))) continue;
      const ng = g[k] + c;
      if (ng < g[n]) {
        g[n] = ng;
        from[n] = k;
        push([ng + h(n), n]);
      }
    }
  }
  if (from[goal] === -1 && goal !== start) return [a, b];
  const cells = [];
  for (let k = goal; k !== -1; k = from[k]) cells.push({ x: (k % GW) * GRID + GRID / 2, y: Math.floor(k / GW) * GRID + GRID / 2 });
  const raw = [a, ...cells.reverse(), b];
  // straighten: from each point jump to the farthest one still in plain view
  const out = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !clearLine(raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  return out;
}

const pathLength = (pts) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

// The point a share t (0–1) of the way along a path, and which way it's heading there
function pointAlong(pts, t) {
  const total = pathLength(pts);
  let left = clamp(t, 0, 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= d || i === pts.length - 1) {
      const k = d ? Math.min(1, left / d) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: b.x < a.x ? -1 : b.x > a.x ? 1 : 0 };
    }
    left -= d;
  }
  return { ...pts[pts.length - 1], dir: 0 };
}

// ---------- what the pig is doing where ----------
// tpl: how the job is shown
//   room   – inside the building, seen through a cut-away bubble (room: which interior)
//   stand  – outside at a spot, doing the job on the spot
//   patrol – walking back and forth between a and b
//   route  – riding a round of stops (vehicle), position follows progress
//   haul   – carrying things from a to b: one pile shrinks, the other grows
// hold: what's in the pig's hands; fx: little things popping up now and then


const JOB_SCENES = {
  bottles: { place: 'truffle', tpl: 'haul', a: near('truffle', -190, -60), b: near('truffle', 80, -20), item: '🍄', pose: 'dig', basket: '🧺' },
  flyer: { place: 'bakery', tpl: 'patrol', a: near('bakery', 0, 40), b: near('clothes', 0, 40), hold: 'flyer', fx: ['📄', '💦'], walkers: true },
  dishes: { place: 'restaurant', tpl: 'room', room: 'dishes' },
  ballboy: { place: 'field', tpl: 'haul', a: near('field', -90, -60), b: near('field', 100, -10), item: '🎾', basket: '🗑️' },
  paper: { place: 'courier', tpl: 'route', vehicle: 'bike', item: '📰', stops: [...HN.houses, PLACE_BY_ID.kinder.entry, PLACE_BY_ID.home.entry] },
  busker: { place: 'plaza', tpl: 'stand', spot: near('plaza', -40, -50), hold: '🪗', fx: ['🎵', '🎶', '🪙'], hat: true },
  portrait: { place: 'lake', tpl: 'stand', spot: near('lake', -40, 34), hold: '🖌️', fx: ['🎨'], easel: true },
  museum: { place: 'museum', tpl: 'room', room: 'museum' },
  mover: { place: 'site', tpl: 'haul', a: near('site', -150, -30), b: near('site', 40, -30), item: '🧱', wall: true },
  cashier: { place: 'store', tpl: 'room', room: 'shop' },
  courier: {
    place: 'courier', tpl: 'route', vehicle: 'scooter', item: '📦',
    stops: ['furniture', 'office', 'tower', 'college', 'home'].map((id) => PLACE_BY_ID[id].entry),
  },
  pianoaide: { place: 'artschool', tpl: 'room', room: 'piano' },
  artaide: { place: 'artschool', tpl: 'room', room: 'easel' },
  tutor: { place: 'neighbors', tpl: 'room', room: 'tutor' },
  coach: { place: 'field', tpl: 'patrol', a: near('field', -90, -50), b: near('field', 90, -50), hold: '📣', fx: ['💨'], followers: true },
  band: { place: 'stage', tpl: 'stand', spot: near('stage', 0, -22), hold: '🎸', fx: ['🎵', '🎶', '🎤'], audience: true },
  illustrator: { place: 'office', tpl: 'room', room: 'draw' },
  guide: { place: 'spring', tpl: 'patrol', a: near('spring', -130, 24), b: near('spring', 130, 24), hold: '🚩', fx: ['♨️'], ducklings: true },
  labtech: { place: 'college', tpl: 'room', room: 'lab' },
  reporter: { place: 'plaza', tpl: 'patrol', a: near('plaza', -160, 20), b: near('plaza', 160, 20), hold: '🎤', fx: ['📸', '❓'] },
  teacher: { place: 'kinder', tpl: 'room', room: 'kinder' },
  banker: { place: 'bank', tpl: 'room', room: 'bank' },
  engineer: { place: 'site', tpl: 'stand', spot: near('site', 10, -24), hold: '📐', fx: ['📏', '💡'] },
  designer: { place: 'office', tpl: 'room', room: 'design' },
  coder: { place: 'office', tpl: 'room', room: 'code' },
  lawyer: { place: 'cityhall', tpl: 'room', room: 'court' },
  doctor: { place: 'clinic', tpl: 'room', room: 'ward' },
  architect: { place: 'office', tpl: 'room', room: 'code' },
  fund: { place: 'bank', tpl: 'room', room: 'fund' },
  orchestra: { place: 'artpalace', tpl: 'room', room: 'concert' },
  artist: { place: 'artpalace', tpl: 'room', room: 'gallery' },
  professor: { place: 'college', tpl: 'room', room: 'lecture' },
  surgeon: { place: 'clinic', tpl: 'room', room: 'ward' },
  scientist: { place: 'museum', tpl: 'room', room: 'rocket' },
  judge: { place: 'cityhall', tpl: 'room', room: 'court' },
  justice: { place: 'cityhall', tpl: 'room', room: 'court' },
  bridgeeng: { place: 'site', tpl: 'stand', spot: near('site', -30, -24), hold: '📐', fx: ['🌉', '💡'] },
  planner: { place: 'cityhall', tpl: 'stand', spot: near('cityhall', 40, 20), hold: '🗺️', fx: ['📐', '💡'] },
  principal: { place: 'primary', tpl: 'room', room: 'lecture' },
  specialist: { place: 'clinic', tpl: 'room', room: 'ward' },
  governor: { place: 'bank', tpl: 'room', room: 'fund' },
};

// A delivery round's full route: from the depot through every stop, along open ground.
// stopAt: how far along the route (0–1) each stop is.
for (const sc of Object.values(JOB_SCENES)) {
  if (sc.tpl !== 'route') continue;
  let pts = [PLACE_BY_ID[sc.place].entry];
  const at = [];
  for (const stop of sc.stops) {
    pts = [...pts, ...findPath(pts[pts.length - 1], stop).slice(1)];
    at.push(pathLength(pts));
  }
  sc.path = pts;
  sc.stopAt = at.map((d) => d / pathLength(pts));
}

// Which school building teaches a stage
const STAGE_PLACE = { primary: 'primary', middle: 'middle', high: 'middle', college: 'college', master: 'college', phd: 'college' };

// soaking in the middle of the hot spring, steam rising
const SOAK_SCENE = { tpl: 'stand', spot: near('spring', 0, -62), pose: 'soaking', fx: ['♨️', '😌', '💤'] };

const SOCCER_SCENE = { tpl: 'patrol', a: near('field', -80, -70), b: near('field', 80, -70), hold: '⚽', fx: ['⚽', '💨'] };

// Things done outdoors with a friend: where the pig stands, and (mate) where the friend stands
// beside him, as an offset, with what they hold
const OUTDOOR_SCENES = {
  ducks: { place: 'lake', scene: { tpl: 'stand', spot: { x: 2944, y: 1384 }, hold: '🍞', fx: ['🦆', '🍞', '💕'] } },
  kite: { place: 'field', scene: { tpl: 'stand', spot: { x: 2616, y: 1722 }, hold: '🪁', fx: ['🪁', '💨', '😄'] } },
  stars: { place: 'museum', scene: { tpl: 'stand', spot: { x: 2272, y: 730 }, hold: '🔭', fx: ['⭐', '🌙', '✨'] } },
  garden: { place: 'garden', scene: { tpl: 'stand', spot: { x: 128, y: 1302 }, pose: 'dig', hold: '🌱', fx: ['💦', '🌱'] } },
  // fireworks, watched from outside the theme park's gate; the festivals in the square or by the lake
  fireworks: { place: 'funpark', scene: { tpl: 'stand', spot: { x: 3290, y: 2512 }, fx: ['🎆', '🎇', '✨'] } },
  newyear: { place: 'plaza', scene: { tpl: 'stand', spot: { x: 1860, y: 1446 }, hold: '🧧', fx: ['🧧', '🎊', '🏮'] } },
  lantern: { place: 'plaza', scene: { tpl: 'stand', spot: { x: 1830, y: 1452 }, hold: '🏮', fx: ['🏮', '❓', '💡'] } },
  dragon: { place: 'lake', scene: { tpl: 'stand', spot: { x: 3230, y: 1384 }, fx: ['🐉', '🥁', '💦'] } },
  moon: { place: 'lake', scene: { tpl: 'stand', spot: { x: 2990, y: 1396 }, hold: '🥮', fx: ['🌕', '✨', '🥮'] } },
  xmas: { place: 'plaza', scene: { tpl: 'stand', spot: { x: 1840, y: 1452 }, fx: ['🎄', '⭐', '🎁'] } },
};
const OUTING_MATES = {
  soak: { dx: 54, dy: 2, act: 'soak' }, soccer: { dx: 200, dy: 6 }, ducks: { dx: -44, dy: 2, hold: '🍞' }, kite: { dx: 62, dy: 6, hold: '🪁' },
  stars: { dx: 62, dy: 2 }, garden: { dx: 52, dy: 4, hold: '💦' },
  fireworks: { dx: 56, dy: 2 }, newyear: { dx: 56, dy: 2, hold: '🍡' }, lantern: { dx: 56, dy: 2, hold: '🏮' }, dragon: { dx: -52, dy: 2 },
  moon: { dx: 56, dy: 2, hold: '🥮' }, xmas: { dx: 56, dy: 2 },
};

// The theme park's rides, seen through a cut-away bubble over each ride (at: where its tail points)
const RIDE_SCENES = {
  ferris: { tpl: 'room', room: 'ferris', at: { x: 3265, y: 2040 } },
  carousel: { tpl: 'room', room: 'carousel', at: { x: 3465, y: 2110 } },
  haunted: { tpl: 'room', room: 'haunted', at: { x: 3235, y: 2330 } },
};

// Where the pig is for what it's doing: { place, scene }, or no place when it's free to roam
function sceneOf(snap) {
  const a = snap.s.activity;
  if (!a) return { place: null, scene: null };
  switch (a.type) {
    case 'study':
      return { place: STAGE_PLACE[COURSE_BY_ID[a.id].stage], scene: { tpl: 'room', room: 'class' } };
    case 'work':
      return { place: JOB_SCENES[a.id].place, scene: JOB_SCENES[a.id] };
    case 'kinder':
      return { place: 'kinder', scene: { tpl: 'room', room: 'kinder' } };
    case 'help':
      if (a.id === 'soak') return { place: 'spring', scene: SOAK_SCENE };
      if (a.id === 'movie') return { place: 'cinema', scene: { tpl: 'room', room: 'cinema' } };
      if (a.id === 'cafe') return { place: 'cafe', scene: { tpl: 'room', room: 'cafe' } };
      if (a.id === 'read') return { place: 'bookstore', scene: { tpl: 'room', room: 'books' } };
      if (RIDE_SCENES[a.id]) return { place: 'funpark', scene: RIDE_SCENES[a.id] };
      if (OUTDOOR_SCENES[a.id]) return OUTDOOR_SCENES[a.id];
      return a.id === 'meal'
        ? { place: 'canteen', scene: { tpl: 'room', room: 'canteen' } }
        : { place: 'clinic', scene: { tpl: 'room', room: 'clinic' } };
    case 'hobby':
      return a.id === 'soccer' ? { place: 'field', scene: SOCCER_SCENE } : { place: 'home', scene: { tpl: 'room', room: a.id } };
    case 'bath':
      return { place: 'home', scene: { tpl: 'room', room: 'bath' } };
    default:
      return { place: 'home', scene: { tpl: 'room', room: 'sleep' } };
  }
}

// Jobs done at a place, for its sheet
const jobsAt = (placeId) => JOBS.filter((j) => JOB_SCENES[j.id].place === placeId);

// Where a stat ring in the bar takes you: somewhere that helps with it
const STAT_PLACE = { hunger: 'supermarket', clean: 'bubble', energy: 'home', health: 'clinic', mood: 'chess' };

// The old pages of the home window (tray menu, right-click), as places
const TAB_TO_PLACE = { status: null, bag: 'bag', shop: 'supermarket', school: 'primary', work: 'tower', games: 'chess', more: 'settings' };

// What passers-by and the farm animals say when you click them. The passers are visitors to
// town, of kinds no neighbour is, so nobody takes one for a friend: a hello, nothing more.
const PASSER_LINES = {
  chick: ['叽叽！小猪你好！', '叽？你也出来散步呀？', '我在找小虫子，你看见了吗？', '叽叽叽，走得我腿都酸了。'],
  alpaca: ['嗯？你好。', '今天的风好舒服啊。', '别怕，我不吐口水的。', '我从山那边来，走了好久。'],
  penguin: ['好热好热……你好呀！', '摇摇摆摆，摇摇摆摆~', '你们这儿没有冰吗？', '我是来旅游的🐧'],
  frog: ['呱！你好！', '呱呱，是不是要下雨了？', '我刚从湖边跳过来的。', '呱……别踩到我哦。'],
  '🐄': ['哞~', '哞——今天的草真香', '哞？'],
  '🐑': ['咩~', '咩咩咩', '要摸摸我的毛吗？'],
  '🐐': ['咩咩！', '我什么都能吃！'],
  '🐔': ['咯咯哒🥚', '咯咯？', '下了个蛋！'],
};

// ---------- where the neighbours are ----------
// Spots in town that aren't places to go into, for the neighbours' days (NPC_DAYS): a name and
// icon for the friends page, the door they go in and out of (and the pig walks to, to find
// them), and where they stand there.
const NPC_PLACES = {
  meadow: { name: '草地', icon: '🌼', door: { x: 2960, y: 1560 }, spots: [[2950, 1556], [2994, 1566], [2900, 1520], [3040, 1540]] },
  park: { name: '中央公园', icon: '🌳', door: { x: 2650, y: 1200 } },
  tree: { name: '大树', icon: '🌳', door: { x: 2706, y: 1430 } },
  boat: { name: '小船屋', icon: '⛵', door: { x: 3332, y: 1236 } },
  shell: { name: '龟壳屋', icon: '🐢', door: HOMES.turtle.entry },
  woodshop: { name: '木工房', icon: '🪚', door: HOMES.bear.entry },
  ranch: { name: '牧场', icon: '🐄', door: { x: 700, y: 2288 }, spots: [[532, 2210], [532, 2320]] },
};
// the cottages next door: each neighbour's own, with room for a visitor or two
HN.houses.forEach((h, i) => {
  const owner = NPCS.find((n) => n.spot === i);
  NPC_PLACES[`cottage${i}`] = { name: `${owner.name}家`, icon: '🏡', door: h, spots: [[h.x + 44, h.y - 6], [h.x - 40, h.y - 4], [h.x + 84, h.y + 4]] };
});

// Where someone stands at a place, by what they're doing (_: anything else there). Keepers at
// work stand by their door; anyone inside is out of sight, at the door.
const NPC_SPOTS = {
  plaza: {
    rest: [[1766, 1490], [1800, 1490], [2004, 1490], [2038, 1490]],
    taichi: [[1840, 1352], [1880, 1346]],
    hop: [[1966, 1440]],
    play: [[1972, 1426], [2014, 1430]],
    fountain: [[1948, 1362], [1986, 1370]],
  },
  lake: {
    ducks: [[2992, 1378], [3030, 1382]],
    wash: [[3164, 1374]],
    rest: [[3108, 1386], [3146, 1384]],
    swim: [[3030, 1326], [3070, 1300]],
  },
  chess: { chess: [[2612, 980]] },
  // the raccoon won't go into the crowded café: she sits at its door
  cafe: { rest: [[1990, 1722], [2054, 1724]] },
  field: { ball: [[2604, 1746], [2690, 1748]], kite: [[2566, 1700]], rest: [[2528, 1806]] },
  museum: { stars: [[2346, 722]] },
  kinder: { class: [[742, 1702]] },
  site: { site: [[2742, 692]] },
  garden: { garden: [[206, 1300]] },
  spring: { soak: [[1690, 334]] },
};
// Ones who walk about while they're at it: back and forth along these (and how fast, px a second)
const NPC_LOOPS = {
  'park:run': { pts: [[2440, 1240], [2650, 1200], [2760, 980], [3100, 900], [3450, 980]], speed: 70 },
  'lake:walk': { pts: [[2884, 1332], [2960, 1374], [3080, 1388], [3200, 1374], [3290, 1324]], speed: 18 },
  'primary:patrol': { pts: [[1330, 786], [1500, 772], [1660, 764]], speed: 22 },
};
// how fast each one walks across town, px a second
const NPC_SPEED = { turtle: 16, rabbit: 46, _: 38 };
// how far ahead (town time) a shop keeper may set off, to be behind the counter on the hour
const KEEPER_LEAD = 45 * 60000;
// what they hold or do while at it
const NPC_HOLD = { kite: '🪁', ducks: '🍞', stars: '🔭', wash: '🧸', swim: '💦', pine: '🌰', ball: '⚽', site: '🔨', flowers: '🌷', soak: '♨️', rest: '', cafe: '☕' };
// the little faces that pop up between two who are there together
const NPC_PAIR_FX = { chess: ['♟️', '🤔', '😄'], play: ['😄', '🎈'], visit: ['😊', '🍪', '🍵'], porch: ['😊', '🍵'], rest: ['😊', '💬'], kite: ['🪁', '😄'], _: ['😊'] };

// The place nearest a point (where a photo was taken): the one whose ground it's on or closest to
function nearestPlace({ x, y }) {
  let best = PLACES[0];
  let bd = Infinity;
  for (const p of PLACES) {
    const d = Math.hypot(Math.max(p.x - x, 0, x - p.x - p.w), Math.max(p.y - y, 0, y - p.y - p.h));
    if (d < bd) [best, bd] = [p, d];
  }
  return best.id;
}

// A place's name and icon, and where to walk to find someone there
function npcPlace(where) {
  const p = PLACE_BY_ID[where];
  if (p) return { name: p.name, icon: p.icon, door: p.entry };
  return NPC_PLACES[where];
}

// One line under each place's name on its screen
const PLACE_TAGLINES = {
  truffle: '在树下拱松露', spring: '泡温泉恢复体力', site: '新城区建设中', primary: '小学课程', middle: '初中和高中课程',
  college: '学士、硕士、博士课程', museum: '天文、航天与恐龙化石', tower: '全城的工作', office: '办公室工作', cityhall: '猪猪城市政',
  bank: '存款每日计息', supermarket: '食物与日用品', plaza: '城市中心广场', artpalace: '音乐会与画展', canteen: '免费餐食',
  clinic: '看病与健康', chess: '下棋', stage: '演出', lake: '钓鱼与划船', field: '足球场', home: '小猪的家', kinder: '幼儿园',
  farm: '新鲜蔬果', garden: '自家菜园', neighbors: '邻居们的家', bakery: '面包与点心', bubble: '洗护用品', toy: '玩具',
  clothes: '服装与配饰', furniture: '家具与装饰', salon: '发型', beauty: '毛色', store: '日用杂货', restaurant: '餐食',
  artschool: '音乐与美术课程', courier: '快递配送', bookstore: '图书', cinema: '每日放映', cafe: '咖啡与茶点', apt: '四户人家',
  barn: '收购蔬菜与鱼',
};
