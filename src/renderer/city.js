// The Pig City map in the home window. The player walks the pig around town (WASD, or by
// clicking), goes into places, and sees it doing its activities on the spot; neighbours stand
// at their shops and people stroll the paths. Game state only comes in as snapshots; clicks and
// entering go out through the callbacks given to City.init().

const PIG_SCALE = 0.52;
const NPC_SCALE = 0.42;
const WALKER_SCALE = 0.34;
const WALK_SPEED = 190; // px per second
const FX_EVERY = 2600;
// how close the camera is: world pixels are drawn this many screen pixels big
const ZOOM = 1.45;
const KEY_DIRS = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };
// places you go into through a door, by walking up into it
const DOOR_KINDS = ['building', 'home', 'pavilion', 'stage', 'houses', 'barn'];

// A place's colour on the maps: its roof, or one for its kind
const KIND_COLOR = { forest: '#69db7c', spring: '#c9a27a', site: '#e0b97c', pavilion: '#51cf66', stage: '#9775fa', plaza: '#d8c3a5', field: '#69db7c', lake: '#74c0fc', home: '#ff8fab', houses: '#ffa8a8', garden: '#8ce99a', barn: '#e03131', funpark: '#f06595' };
// The sky over the town at a moment of the town's day: color and tint (how strongly it washes over
// the town), light (how bright the windows and lamps are, 0 by day) and late (the small hours,
// when half the windows have gone dark). Between these hours it shades from one to the next.
const SKY = [
  [0, '#28306e', 0.55, 1], [4.5, '#28306e', 0.55, 1], [5.5, '#6d4f9a', 0.38, 0.7], [6.5, '#ffb37a', 0.18, 0.15], [7.5, '#ffffff', 0, 0],
  [16.5, '#ffffff', 0, 0], [17.5, '#ffad6b', 0.2, 0.1], [18.5, '#c25b7d', 0.34, 0.6], [19.5, '#28306e', 0.55, 1], [24, '#28306e', 0.55, 1],
];
function townSky(d) {
  const h = d.getHours() + d.getMinutes() / 60;
  const i = SKY.findIndex((k, j) => h >= k[0] && h < SKY[j + 1][0]);
  const [h0, c0, t0, l0] = SKY[i];
  const [h1, c1, t1, l1] = SKY[i + 1];
  const u = (h - h0) / (h1 - h0);
  return { color: mixHex(c0, c1, u), tint: t0 + (t1 - t0) * u, light: l0 + (l1 - l0) * u, late: h >= 23 || h < 5 };
}

// how many faces the big map shows on the corner of one place
const MAP_FACES = 4;

const placeColor = (p) => p.look?.roofColor || KIND_COLOR[p.kind] || '#ced4da';// the colour of a building that's just part of town (or someone's home), from its roof
const DECO_COLOR = { barn: '#e03131', windmill: '#a9805b', ranchhouse: '#c0503a', woodshop: '#9c6b3e', shellhouse: '#6fa883' };
const decoColor = (d) => d.look?.roofColor || DECO_COLOR[d.kind] || '#ced4da';

// A pig drawing that follows the pet's look: face, growth form, dirt, wear and accessories
class PigSprite {
  constructor(mount, crop = false) {
    mount.innerHTML = PIG_SVG;
    this.root = mount;
    this.svg = mount.querySelector('svg');
    if (crop) this.svg.setAttribute('viewBox', '18 2 124 108');
    this.eyes = mount.querySelector('#eyes');
    this.mouth = mount.querySelector('#mouth');
    this.dirt = mount.querySelector('#dirt');
    this.acc = mount.querySelector('#acc');
    this.face = null;
    this.form = null;
    this.accKey = undefined;
    this.blink();
  }

  blink() {
    setTimeout(() => {
      if (!this.root.isConnected && this.face) return;
      if (this.face && FACES[this.face].eyes === 'normal') {
        this.eyes.classList.add('blink');
        setTimeout(() => this.eyes.classList.remove('blink'), 140);
      }
      this.blink();
    }, 2500 + Math.random() * 3000);
  }

  update(s, sleeping, face) {
    face = face || moodFace(s, sleeping);
    if (face !== this.face) {
      this.face = face;
      renderFace(this.eyes, this.mouth, face);
    }
    const form = formFor(s.level).id;
    if (form !== this.form) {
      this.form = form;
      applyForm(this.root, form);
    }
    this.dirt.setAttribute('opacity', s.clean < 50 ? ((50 - s.clean) / 50).toFixed(2) : 0);
    this.root.classList.toggle('sick', s.health < 40);
    this.root.classList.toggle('sleeping', sleeping);
    const accKey = accKeyFor(s);
    renderWear(this.root, s.wear, accKey);
    renderLook(this.root, s.look);
    if (accKey !== this.accKey) {
      this.accKey = accKey;
      this.acc.innerHTML = accKey ? ACCESSORIES[accKey] : '';
    }
  }
}

// A neighbour's face for the map's little discs; a pale one gets a darker outline to show up
function mapFace(species) {
  const sp = SPECIES[species];
  let svg = animalSvg(species).replace(/^<svg[^>]*>/, '<svg x="-15" y="-14" width="30" height="30" viewBox="10 -4 140 140">');
  if (sp.pale) svg = svg.split(sp.line).join('#b9a3ad').replace(/stroke-width="1.6"/g, 'stroke-width="3"');
  return svg;
}

// worn on their birthday
const PARTY_HAT = '<svg viewBox="0 0 20 28"><path d="M10 3 L18 26 H2 Z" fill="#ff8fab" stroke="#e64980" stroke-width="1.2" stroke-linejoin="round"/><path d="M7.4 12 H12.6 M5.2 19 H14.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="10" cy="3.5" r="3.2" fill="#ffd43b"/></svg>';

const POSES = ['walking', 'working', 'studying', 'dining', 'dig', 'riding', 'jump', 'soaking'];

// The pig using an item where it stands (in town or at home): food goes to its mouth and it
// chews, a toy makes it jump about, soap and medicine sparkle. root: the pig drawing; host: where
// the item and the little effects float.
function playUse(root, host, it) {
  const kind = { food: 'eating', toy: 'jump', hygiene: 'washing', medicine: 'eating' }[it.cat];
  clearTimeout(root.useTimer);
  root.classList.remove('eating', 'jump', 'washing');
  void root.offsetWidth;
  root.classList.add(kind);
  host.querySelector('.use-prop')?.remove();
  const prop = document.createElement('div');
  prop.className = `use-prop use-${kind}`;
  prop.textContent = it.icon;
  host.appendChild(prop);
  const fx = { eating: it.cat === 'medicine' ? '💗' : '😋', jump: '🎵', washing: '✨' }[kind];
  setTimeout(() => {
    const f = document.createElement('div');
    f.className = 'use-fx';
    f.textContent = fx;
    host.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }, 900);
  root.useTimer = setTimeout(() => {
    root.classList.remove(kind);
    prop.remove();
  }, 1700);
}

const City = {
  cam: { x: 0, y: 0 },
  snap: null,
  at: null, // { place, scene } of the current activity; place is null while free to roam
  pos: null, // pig's feet in world coordinates
  sceneKey: '',
  progressKey: '',
  route: null, // { pts, i, done } while walking somewhere by itself
  keys: new Set(),
  follow: true, // camera follows the pig
  locked: false, // a sheet or the big map is open: no walking around
  lastStart: null,

  init(cb) {
    this.cb = cb;
    this.vp = document.getElementById('viewport');
    this.world = document.getElementById('world');
    this.world.style.width = `${WORLD.w}px`;
    this.world.style.height = `${WORLD.h}px`;
    this.world.innerHTML = `<svg id="cityBase" width="${WORLD.w}" height="${WORLD.h}" viewBox="0 0 ${WORLD.w} ${WORLD.h}"></svg>
      <div id="sceneProps"></div><div id="walkers"></div><div id="nightTint" style="width:${WORLD.w}px;height:${WORLD.h}px"></div><svg id="cityLights" width="${WORLD.w}" height="${WORLD.h}" viewBox="0 0 ${WORLD.w} ${WORLD.h}"></svg><div id="npcLayer"></div>
      <div id="bubbleLayer"></div><div id="pigActor" class="actor"></div><div id="cityFx"></div><div id="placeTip"></div>`;
    this.drawBase();
    this.drawWalkers();
    this.drawNpcs();
    this.makePig();
    this.drawMinimap();
    this.bindInput();
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('pigPos'));
    } catch {}
    const start = saved && walkable(saved.x, saved.y) ? saved : PLACE_BY_ID.home.entry;
    this.placePig(start.x, start.y);
    this.centerOnPig();
    setInterval(() => this.popFx(), FX_EVERY);
    setInterval(() => this.pairFx(), 3200);
    setInterval(() => this.buddyTick(Date.now()), 1000);
    setInterval(() => this.paintSky(), 3000);
    setInterval(() => this.seasonTick(), 700);
    setInterval(() => this.savePos(), 5000);
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  savePos() {
    if (this.at?.place || !this.pos) return;
    try {
      localStorage.setItem('pigPos', JSON.stringify({ x: Math.round(this.pos.x), y: Math.round(this.pos.y) }));
    } catch {}
  },

  // ---------- the town itself ----------

  drawBase() {
    const placeSvg = (p) => {
      const art = p.kind === 'building' ? facade(p) : p.kind === 'home' ? '' : PLACE_ART[p.kind](p);
      const lock = p.minLevel
        ? `<g class="pl-lock"><rect x="${p.x + p.w - 52}" y="${p.y + 4}" width="48" height="20" rx="10" fill="#fff" stroke="#dee2e6"/>
           <text x="${p.x + p.w - 28}" y="${p.y + 15}" font-size="11" text-anchor="middle" dominant-baseline="central" fill="#868e96">🔒 ${p.minLevel}</text></g>`
        : '';
      return `<g class="pl" data-place="${p.id}"><rect class="pl-hit" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10"/>
        <g class="pl-art" ${p.kind === 'home' ? 'id="homeArt"' : ''}>${art}</g>${lock}</g>`;
    };
    const svg = document.getElementById('cityBase');
    CITY_LIGHTS.windows.length = 0;
    CITY_LIGHTS.lamps.length = 0;
    const decoSvgG = (d) => `<g class="deco${d.home ? ' visit' : ''}" ${d.home ? `data-home="${d.home}"` : ''}><title>${d.name}</title>${decoSvg(d)}</g>`;
    const all = [...PLACES.map((p) => ({ p, svg: placeSvg })), ...DECOS.map((p) => ({ p, svg: decoSvgG }))]
      .sort((a, b) => a.p.y + a.p.h - (b.p.y + b.p.h));
    // the season (snow lies on the ground in winter) and a festival's decorations
    TOWN_SEASON = seasonOf();
    for (const s of SEASON_IDS) this.world.classList.toggle(`season-${s}`, s === TOWN_SEASON);
    this.fest = festivalOn()?.id || '';
    const snow = TOWN_SEASON === 'winter' ? `<rect width="${WORLD.w}" height="${WORLD.h}" fill="#fff" opacity=".42"/>` : '';
    svg.innerHTML = `${groundSvg()}${farmSvg()}${snow}${all.map((o) => o.svg(o.p)).join('')}<g id="donations"></g>${scenerySvg()}${marketSvg()}${festiveSvg(this.fest)}${signsSvg()}`;
    this.homeTier = -1;
    this.donated = '';
    this.drawLights();
    this.drawWeather();
  },

  // ---------- seasons, festivals and fireworks ----------

  // Falling over the whole view: snow in winter, petals in spring, leaves in autumn
  drawWeather() {
    const el = document.getElementById('weather');
    if (!el) return;
    const kind = { winter: 'snow', spring: 'petal', autumn: 'leaf' }[TOWN_SEASON];
    const rnd = seeded(23);
    const n = { snow: 46, petal: 16, leaf: 14 }[kind] || 0;
    el.className = kind || '';
    el.innerHTML = [...Array(n)].map(() => `<i style="--x:${(rnd() * 100).toFixed(1)}%;--d:${(7 + rnd() * 8).toFixed(1)}s;--t:${(-rnd() * 15).toFixed(1)}s;--s:${(0.6 + rnd() * 0.8).toFixed(2)};--sway:${(10 + rnd() * 30).toFixed(0)}px"></i>`).join('');
  },

  // Redraw the town when the season or the day's festival changes; fireworks over the theme park
  // while they're on, if it's anywhere near the view
  seasonTick() {
    if (seasonOf() !== TOWN_SEASON || (festivalOn()?.id || '') !== this.fest) {
      this.drawBase();
      if (this.snap) this.updateTown(this.snap.s);
    }
    if (document.hidden || !fireworksOn()) return;
    const p = PLACE_BY_ID.funpark;
    const x = p.x + 40 + Math.random() * (p.w - 80);
    const y = p.y - 120 + Math.random() * 260;
    if (x < this.cam.x - 200 || x > this.cam.x + this.viewW + 200 || y < this.cam.y - 200 || y > this.cam.y + this.viewH + 200) return;
    const colors = ['#ffd43b', '#ff6b6b', '#74c0fc', '#b197fc', '#69db7c', '#ff8fab'];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const el = document.createElement('div');
    el.className = 'firework';
    el.style.cssText = `left:${x}px;top:${y}px;--c:${c};--r:${80 + Math.random() * 50}px`;
    el.innerHTML = [...Array(22)].map((_, i) => `<i style="--a:${(i * 360) / 22}deg"></i>`).join('');
    document.getElementById('cityFx').appendChild(el);
    setTimeout(() => el.remove(), 1800);
  },

  // ---------- day and night ----------
  // A wash of colour over the town that follows the town's clock (townSky), with warm light in
  // every window and round every lamp once it's dark. The people only dim a little, and what
  // they say stays bright.

  drawLights() {
    const rnd = seeded(17);
    let s = `<defs><radialGradient id="lampGlow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset=".35" stop-color="#ffd36b" stop-opacity=".45"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient></defs>`;
    for (const [x, y, w, h] of CITY_LIGHTS.windows) {
      // late at night some windows go dark: those carry the class "late"
      s += `<rect class="${rnd() < 0.45 ? 'late' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffb84d"/>`;
    }
    // the pig's own house always has a light on for him
    for (const [x, y, w, h] of CITY_LIGHTS.home) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#ffb84d"/>`;
    for (const [x, y] of CITY_LIGHTS.lamps) s += `<circle cx="${x}" cy="${y}" r="70" fill="url(#lampGlow)"/><circle cx="${x}" cy="${y}" r="5" fill="#fff6c9"/>`;
    document.getElementById('cityLights').innerHTML = s;
    this.paintSky();
  },

  paintSky() {
    const k = townSky(townDate());
    const tint = document.getElementById('nightTint');
    tint.style.background = k.color;
    tint.style.opacity = k.tint;
    const lights = document.getElementById('cityLights');
    lights.style.opacity = k.light;
    lights.classList.toggle('late', k.late);
    this.world.style.setProperty('--dim', 1 - k.tint * 0.45);
  },

  // Things on the map that change with the save: house tier, donations, locks
  updateTown(s) {
    const tier = homeTier(s);
    if (tier !== this.homeTier) {
      this.homeTier = tier;
      CITY_LIGHTS.home.length = 0;
      document.getElementById('homeArt').innerHTML = homeExterior(PLACE_BY_ID.home, tier);
      this.drawLights();
    }
    const owned = ITEMS.filter((it) => it.cat === 'city' && s.inventory[it.id]).map((it) => it.id);
    const key = owned.join() + (owned.includes('statue') ? JSON.stringify(s.wear) : '');
    if (key !== this.donated) {
      this.donated = key;
      const g = document.getElementById('donations');
      g.innerHTML = owned.map((id) => `<g class="donation">${DONATION_ART[id](DONATION_SPOTS[id])}</g>`).join('');
      const gold = g.querySelector('.gold-pig');
      if (gold) {
        gold.innerHTML = PIG_SVG;
        applyForm(gold, 'adult');
        renderWear(gold, s.wear, null);
        renderFace(gold.querySelector('#eyes'), gold.querySelector('#mouth'), 'cheerful');
      }
    }
    // the vegetable patch, redrawn when a plot changes stage
    const crops = (s.farm || []).map((p) => (p ? `${p.seed}:${plotProgress(p) >= 1 ? 2 : plotProgress(p) >= 0.4 ? 1 : 0}` : '')).join();
    if (crops !== this.crops) {
      this.crops = crops;
      document.getElementById('gardenCrops').innerHTML = gardenCrops(s.farm || []);
    }
    for (const p of PLACES) {
      if (!p.minLevel) continue;
      this.world.querySelector(`[data-place="${p.id}"]`).classList.toggle('locked', s.level < p.minLevel);
    }
  },

  // Visitors strolling along the paths, just for life (no neighbour is one of their kind)
  drawWalkers() {
    const lanes = [
      { y: 2058, x1: 1270, x2: 2420, sp: 'chick' }, { y: 1248, x1: 1270, x2: 2420, sp: 'alpaca' },
      { y: 780, x1: 1300, x2: 2440, sp: 'penguin' }, { y: 2378, x1: 1270, x2: 2420, sp: 'frog' },
      { y: 968, x1: 1270, x2: 2420, sp: 'chick' }, { y: 1528, x1: 1270, x2: 2420, sp: 'frog' },
    ];
    this.walkerLines = [];
    document.getElementById('walkers').innerHTML = lanes.map((l, i) => {
      const dx = l.x2 - l.x1;
      const dur = dx / 30;
      this.walkerLines.push(PASSER_LINES[l.sp]);
      return `<div class="actor walker" data-walker="${i}" style="transform:translate(${l.x1}px,${l.y}px)">
        <div class="a-move patrol" style="--dx:${dx}px;--dur:${dur}s;animation-delay:${-i * 13}s">
          <div class="npc-say"></div>
          <div class="a-face patrol-face" style="--dur:${dur}s;animation-delay:${-i * 13}s"><div class="w-turn"><div class="a-sprite hop" style="--k:${WALKER_SCALE}">${animalSvg(l.sp)}</div></div></div>
        </div></div>`;
    }).join('') + this.pastureAnimals();
  },

  // Click a passer-by or a farm animal: it stops, turns to the pig and says hello
  chat(el) {
    const lines = this.walkerLines[el.dataset.walker];
    const body = el.querySelector('.a-sprite, .farm-animal').getBoundingClientRect();
    const vr = this.vp.getBoundingClientRect();
    const x = (body.left + body.width / 2 - vr.left) / ZOOM + this.cam.x;
    const turned = new DOMMatrix(getComputedStyle(el.querySelector('.a-face')).transform).a < 0 ? -1 : 1;
    el.querySelector('.w-turn').style.transform = `scaleX(${(this.pos.x < x ? -1 : 1) * turned})`;
    const say = el.querySelector('.npc-say');
    say.textContent = lines[Math.floor(Math.random() * lines.length)];
    say.classList.remove('on');
    void say.offsetWidth;
    say.classList.add('on');
    el.classList.add('talking');
    clearTimeout(el.timer);
    el.timer = setTimeout(() => {
      el.classList.remove('talking');
      el.querySelector('.w-turn').style.transform = '';
      say.classList.remove('on');
    }, 3000);
  },

  // The ranch animals ambling about their pasture
  pastureAnimals() {
    const p = PASTURE;
    return p.animals.map((a, i) => {
      const x = p.x + 40 + ((i * 97) % (p.w - 120));
      const y = p.y + 80 + ((i * 131) % (p.h - 120));
      const dx = 40 + ((i * 37) % 60);
      const dur = 9 + i * 2;
      this.walkerLines.push(PASSER_LINES[a]);
      return `<div class="actor walker farm" data-walker="${this.walkerLines.length - 1}" style="transform:translate(${x}px,${y}px)">
        <div class="a-move patrol" style="--dx:${dx}px;--dy:${(i % 3) * 10 - 10}px;--dur:${dur}s;animation-delay:${-i * 3}s">
          <div class="npc-say"></div>
          <div class="a-face patrol-face" style="--dur:${dur}s;--f:-1;animation-delay:${-i * 3}s"><div class="w-turn"><span class="farm-animal">${a}</span></div></div></div></div>`;
    }).join('');
  },

  // ---------- neighbours ----------
  // Everyone is wherever their day (NPC_DAYS) says, worked out from the clock every frame: at a
  // spot, on the way there from the last one, or out of sight indoors. Clicking one walks the pig
  // up to them; they stop, turn round and talk in a bubble over their head.

  drawNpcs() {
    document.getElementById('npcLayer').innerHTML = NPCS.map((n) => {
      const k = n.small ? NPC_SCALE * 0.72 : NPC_SCALE;
      return `<div class="actor npc gone ${n.small ? 'small' : ''}" data-npc="${n.id}">
        <div class="npc-bubble" data-wish="${n.id}"></div><div class="npc-say" data-say="${n.id}"></div>
        <div class="a-face"><div class="a-sprite" style="--k:${k}">${animalSvg(n.species, 'normal', seasonWear(n.species))}</div><i class="npc-hat" style="bottom:${Math.round(118 * k)}px">${PARTY_HAT}</i></div>
        <div class="a-hold"></div></div>`;
    }).join('');
    this.npcEl = Object.fromEntries(NPCS.map((n) => [n.id, this.world.querySelector(`[data-npc="${n.id}"]`)]));
    this.npcParts = Object.fromEntries(NPCS.map((n) => [n.id, { face: this.npcEl[n.id].querySelector('.a-face'), hold: this.npcEl[n.id].querySelector('.a-hold') }]));
    this.npcAt = {}; // where each one is this frame: { x, y, dir, moving, shown, plan }
    this.npcHold = {}; // stopped by the pig (talking, walking along): { x, y, dir, gone, untilFree }
    this.detour = {}; // setting off again from where they stopped: { key, from, t0 }
    this.routes = {};
    this.plans = {};
    for (const l of Object.values(NPC_LOOPS)) l.path ||= l.pts.map(([x, y]) => ({ x, y }));
  },

  // what someone is doing at a town moment (now, by default)
  planOf(id, now = townNow()) {
    const c = this.plans[id];
    if (c && now >= c.from && now < c.until) return c;
    const plan = npcPlan(id, now);
    // a shift behind their own counter: on their way a little before, so they're in on the hour
    const n = NPC_BY_ID[id];
    const next = npcPlan(id, plan.end);
    const atWork = (p) => p.act === 'work' && p.where === n.place;
    const early = atWork(next) && !atWork(plan);
    if (early && next.at - now < KEEPER_LEAD) return (this.plans[id] = { ...next, from: next.at - KEEPER_LEAD, until: next.end });
    return (this.plans[id] = { ...plan, from: plan.at, until: early ? next.at - KEEPER_LEAD : plan.end });
  },

  // Where someone stands for an entry of their day; k: how many got to that place before them
  spotOf(n, plan, k = 0) {
    const pl = npcPlace(plan.where);
    if (npcInside(plan)) return pl.door;
    if (plan.act === 'work' && plan.where === n.place) {
      const d = PLACE_BY_ID[n.place].door;
      return { x: d.x + 50, y: d.y + 8 };
    }
    const loop = NPC_LOOPS[`${plan.where}:${plan.act}`];
    if (loop) return loop.path[0];
    const list = NPC_SPOTS[plan.where]?.[plan.act] || pl.spots;
    if (list) {
      const [x, y] = list[k % list.length];
      return { x, y };
    }
    return { x: pl.door.x + 40 + k * 40, y: pl.door.y };
  },

  // The way from the last spot to this one (or from where they stopped to chat)
  routeOf(n, plan, dest) {
    const det = this.detour[n.id]?.key === plan.key ? this.detour[n.id] : null;
    const key = `${plan.key}:${Math.round(dest.x)},${Math.round(dest.y)}`;
    const r = this.routes[n.id];
    if (r?.key === key && r.det === det) return r;
    const from = det ? det.from : this.spotOf(n, plan.prev);
    // when they set off, in real time: they walk at their own pace however fast the town's clock
    // goes. To their own counter they leave early enough to get there right on time.
    const speed = NPC_SPEED[n.id] || NPC_SPEED._;
    const d = Math.hypot(from.x - dest.x, from.y - dest.y);
    if (!det && plan.act === 'work' && plan.where === n.place && d >= 4) {
      const pts = findPath({ ...from }, { ...dest });
      const len = pathLength(pts);
      return (this.routes[n.id] = { key, det, pts, len, t0: realOf(plan.at) - (len / speed) * 1000 });
    }
    const t0 = det ? det.t0 : realOf(plan.at);
    // long since there (no way round is three times the straight line): no need to find the way
    const there = d < 4 || ((Date.now() - t0) / 1000) * speed > d * 3;
    const pts = there ? [dest] : findPath({ ...from }, { ...dest });
    return (this.routes[n.id] = { key, det, pts, len: pathLength(pts), t0 });
  },

  npcState(n, plan, k, now) {
    const hold = this.npcHold[n.id];
    if (hold) return { ...hold, shown: !hold.gone };
    const dest = this.spotOf(n, plan, k);
    const r = this.routeOf(n, plan, dest);
    const speed = NPC_SPEED[n.id] || NPC_SPEED._;
    const walked = ((now - r.t0) / 1000) * speed;
    // not off yet: still where they were
    if (walked < 0) return { ...r.pts[0], dir: 0, moving: false, shown: !npcInside(plan.prev) };
    if (r.len > 4 && walked < r.len) {
      const pt = pointAlong(r.pts, walked / r.len);
      return { x: pt.x, y: pt.y, dir: pt.dir, moving: true, shown: true };
    }
    // walking about while at it: back and forth along the loop
    const loop = NPC_LOOPS[`${plan.where}:${plan.act}`];
    if (loop) {
      const total = pathLength(loop.path);
      const d = ((((now - r.t0) / 1000 - r.len / speed) * loop.speed) % (2 * total) + 2 * total) % (2 * total);
      const back = d > total;
      const pt = pointAlong(loop.path, back ? 2 - d / total : d / total);
      return { x: pt.x, y: pt.y, dir: back ? -pt.dir : pt.dir, moving: true, shown: true };
    }
    return { ...dest, dir: 0, shown: !npcInside(plan) };
  },

  // Every frame: everyone to where they are now. Two at the same place face each other.
  moveNpcs(now) {
    const town = townNow();
    const plans = NPCS.map((n) => ({ n, plan: this.planOf(n.id, town) }));
    // who's at each place, in the order they got there (whoever lives there first)
    const at = {};
    for (const o of plans) if (!npcInside(o.plan)) (at[o.plan.where] ||= []).push(o);
    for (const list of Object.values(at)) list.sort((a, b) => (b.n.home === b.plan.where) - (a.n.home === a.plan.where) || a.plan.at - b.plan.at);
    const states = plans.map(({ n, plan }) => ({ n, plan, st: this.npcState(n, plan, at[plan.where]?.findIndex((o) => o.n === n) ?? 0, now) }));
    for (const o of states) {
      const { n, plan, st } = o;
      if (!st.dir && st.shown) {
        const mate = states.find((x) => x !== o && x.st.shown && !x.st.moving && x.plan.where === plan.where && Math.abs(x.st.x - st.x) < 120);
        st.dir = mate ? Math.sign(mate.st.x - st.x) || 1 : 1;
        st.mate = mate?.n.id;
      }
      this.npcAt[n.id] = { ...st, plan };
      const el = this.npcEl[n.id];
      const tf = `translate(${Math.round(st.x)}px,${Math.round(st.y)}px)`;
      if (el.style.transform !== tf) el.style.transform = tf;
      el.classList.toggle('gone', !st.shown);
      el.classList.toggle('walking', !!st.moving);
      // what they're doing shows a little: hopscotch hops, tai chi sways
      const act = st.moving ? '' : this.npcHold[n.id] ? this.npcHold[n.id].act || '' : plan.act;
      if (el.dataset.act !== act) el.dataset.act = act;
      const { face, hold: h } = this.npcParts[n.id];
      const sx = `scaleX(${st.dir < 0 ? -1 : 1})`;
      if (face.style.transform !== sx) face.style.transform = sx;
      // what they hold: what they're doing, or what they're doing with the pig (OUTING_MATES)
      const held = this.npcHold[n.id];
      const hold = st.moving ? '' : held ? held.hold || '' : NPC_HOLD[plan.act] || '';
      if (h.dataset.v !== hold) {
        h.dataset.v = hold;
        h.innerHTML = hold ? `<span>${hold}</span>` : '';
      }
    }
  },

  updateNpcs(s) {
    for (const n of NPCS) {
      const el = this.world.querySelector(`[data-wish="${n.id}"]`);
      const wish = npcWish(n.id);
      const show = wish && !wishDone(s, n.id);
      const key = show ? `${wish}:${!!s.inventory[wish]}` : '';
      this.npcEl[n.id].classList.toggle('bday', isBirthday(n.id));
      if (el.dataset.key === key) continue;
      el.dataset.key = key;
      el.innerHTML = show ? ITEM_BY_ID[wish].icon : '';
      el.classList.toggle('on', !!show);
      el.classList.toggle('have', !!(show && s.inventory[wish]));
    }
    if (this.talk) this.renderTalk();
  },

  npcSay(id, text, ms = 3600) {
    const el = this.world.querySelector(`[data-say="${id}"]`);
    el.textContent = text;
    el.style.setProperty('--ms', `${ms}ms`);
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(el.timer);
    el.timer = setTimeout(() => el.classList.remove('on'), ms);
  },

  // An emoji floating up from someone's head (💗 when they like the pig more)
  npcFx(id, ch, delay = 0) {
    setTimeout(() => {
      const st = this.npcAt[id];
      if (!st?.shown) return;
      const f = document.createElement('div');
      f.className = 'city-fx';
      f.textContent = ch;
      // talking, the bubble is over their head: beside it then
      const side = this.talk?.id === id;
      f.style.left = `${st.x + (side ? (st.dir || 1) * -30 : 0)}px`;
      f.style.top = `${st.y - (NPC_BY_ID[id].small ? 58 : 76) + (side ? 26 : 0)}px`;
      document.getElementById('cityFx').appendChild(f);
      setTimeout(() => f.remove(), 1600);
    }, delay);
  },

  // Little faces between two who are somewhere together (♟️ at the chess table, 😄 at play)
  pairFx() {
    if (document.hidden) return;
    for (const [id, st] of Object.entries(this.npcAt)) {
      if (!st.mate || st.moving || this.npcHold[id] || id > st.mate || Math.random() > 0.35) continue;
      const list = NPC_PAIR_FX[st.plan.act] || NPC_PAIR_FX._;
      this.npcFx(Math.random() < 0.5 ? id : st.mate, list[Math.floor(Math.random() * list.length)]);
    }
  },

  onScreen({ x, y }) {
    return x > this.cam.x && x < this.cam.x + this.viewW && y > this.cam.y && y < this.cam.y + this.viewH + 40;
  },

  // ---------- talking to someone ----------

  // Someone walking whose body is close to where the screen was pressed (a moving one is easy to
  // just miss): their id, or null
  npcNear(cx, cy) {
    const r = this.vp.getBoundingClientRect();
    const x = (cx - r.left) / ZOOM + this.cam.x;
    const y = (cy - r.top) / ZOOM + this.cam.y;
    let best = null;
    let bd = Infinity;
    for (const [id, st] of Object.entries(this.npcAt)) {
      if (!st.shown || !st.moving) continue;
      const h = NPC_BY_ID[id].small ? 46 : 62;
      const dx = Math.abs(x - st.x);
      if (dx > 30 || y < st.y - h - 6 || y > st.y + 8) continue;
      if (dx < bd) [best, bd] = [id, dx];
    }
    return best;
  },

  // Click on a neighbour: they stop, the pig walks up beside them, they turn round and say hello
  meetNpc(id) {
    const st = this.npcAt[id];
    if (!st?.shown || Story.open || this.talk?.id === id) return;
    if (!this.canWalk(true)) return;
    this.endTalk();
    if (this.buddy) this.endBuddy();
    this.npcHold[id] = { x: st.x, y: st.y, dir: st.dir || 1 };
    const side = this.pos.x <= st.x ? -1 : 1;
    const spots = [{ x: st.x + side * 60, y: st.y + 2 }, { x: st.x - side * 60, y: st.y + 2 }, { x: st.x + side * 30, y: st.y + 34 }];
    const at = spots.find((p) => walkable(p.x, p.y)) || spots[0];
    const arrive = () => {
      if (this.talk?.id !== id) return;
      Object.assign(this.talk, { at: { ...this.pos }, met: true });
      this.faceEach(id);
      this.renderTalk();
      this.cb.act('meet', id);
    };
    // walking somewhere else on the way there calls it off (see walkTo)
    const far = Math.hypot(this.pos.x - at.x, this.pos.y - at.y) >= 12;
    if (far) this.walkTo(at, arrive);
    this.talk = { id, at, mode: 'line', line: null };
    if (!far) {
      this.route = null;
      arrive();
    }
  },

  faceEach(id) {
    const h = this.npcHold[id];
    const d = Math.sign(this.pos.x - h.x) || 1;
    h.dir = d;
    this.face(-d);
  },

  // Someone inside the place the pig was in steps out of the door to talk (a face on its banner)
  callOut(id, placeId) {
    if (!this.canWalk(true)) return;
    const e = PLACE_BY_ID[placeId].entry;
    this.endTalk();
    // in front of the door, the pig on the side away from the keeper
    this.placePig(e.x - 66, e.y);
    this.npcHold[id] = { x: e.x - 6, y: e.y + 2, dir: -1 };
    this.talk = { id, at: { ...this.pos }, mode: 'line', line: null, met: true };
    this.faceEach(id);
    this.renderTalk();
    this.cb.act('meet', id);
  },

  // Go and find someone (the friends page, an empty counter): up to them if they're out and
  // about, else to the door of wherever they are
  findNpc(id) {
    if (!this.canWalk(true)) return;
    if (this.npcAt[id]?.shown) return this.meetNpc(id);
    const plan = this.planOf(id);
    // at home: knock on their door (or the door of whoever they're visiting)
    const host = Object.keys(HOMES).find((h) => NPC_BY_ID[h].home === plan.where);
    if (host) return this.goVisit(host);
    if (PLACE_BY_ID[plan.where]?.sheet) return this.goInto(plan.where);
    this.walkTo(npcPlace(plan.where).door);
  },

  // What they said, from the pet window (Game.meet and the rest). false: nobody here can show
  // it, so it becomes a toast.
  onTalk(t) {
    if (t.story != null) {
      this.endTalk(false);
      Story.play(t.id, t.story, () => this.release(t.id));
      return true;
    }
    if (t.face) this.npcFx(t.id, t.face);
    if (t.gain && t.face !== '💗💗') this.npcFx(t.id, '💗', t.face ? 500 : 0);
    // the thing they love doing most: a little more to say, a moment later
    if (t.fav) setTimeout(() => this.onTalk({ id: t.id, line: t.fav }) || this.cb.onSay(t.id, t.fav), 4200);
    if (t.together === 'walk') {
      this.endTalk(false);
      this.startBuddy(t.id, t.line);
      return true;
    }
    if (t.together === 'play') {
      this.endTalk();
      return true;
    }
    if (this.talk?.id === t.id && !t.together) {
      Object.assign(this.talk, { line: t.line, ask: t.ask || null, mode: t.ask ? 'ask' : t.rps ? 'hands' : 'line' });
      this.renderTalk();
      return true;
    }
    const st = this.npcAt[t.id];
    if (t.line && st?.shown && this.onScreen(st)) {
      this.npcSay(t.id, t.line);
      return true;
    }
    return false;
  },

  // The bubble over the one the pig is talking to: what they said, and round buttons under it.
  // 🎁 and 🤝 open a row of choices in the same place; a question shows its two answers.
  renderTalk() {
    const t = this.talk;
    const el = this.npcEl[t.id];
    let box = el.querySelector('.talk');
    if (!box) {
      box = document.createElement('div');
      box.className = 'talk';
      el.appendChild(box);
    }
    el.classList.add('talking');
    const html = talkHtml(t, this.snap);
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
  },

  talkAction(btn) {
    const t = this.talk;
    if (!t || btn.disabled) return;
    const tk = btn.dataset.tk;
    if (tk === 'chat') this.cb.act('chat', t.id);
    else if (tk === 'gift' || tk === 'together' || tk === 'go') t.mode = tk;
    else if (tk === 'rps') Object.assign(t, { mode: 'hands', line: RPS_CALL });
    else if (tk === 'hand') this.cb.act('rps', `${t.id}:${btn.dataset.hand}`);
    // back one step: from the places to go, to the things to do together
    else if (tk === 'back') t.mode = t.mode === 'go' ? 'together' : 'line';
    else if (tk === 'give') {
      t.mode = 'line';
      this.cb.act('gift', `${t.id}:${btn.dataset.item}`);
    } else if (tk === 'answer') {
      const k = t.ask.k;
      Object.assign(t, { ask: null, mode: 'line' });
      this.cb.act('answer', `${t.id}:${k}:${btn.dataset.i}`);
    } else if (tk === 'walk' || tk === 'play') this.cb.act('together', `${t.id}:${tk}`);
    else if (tk === 'outing') return this.goOuting(t.id, btn.dataset.kind);
    // a photo together, where they are (or by the pig, walking along)
    else if (tk === 'snap') this.cb.act('snapPhoto', `${t.id}:${nearestPlace(this.pos)}`);
    if (this.talk) this.renderTalk();
  },

  // Done talking: the bubble goes, and (unless they're staying with the pig) they get on with it
  endTalk(release = true) {
    const t = this.talk;
    if (!t) return;
    this.talk = null;
    const el = this.npcEl[t.id];
    el.querySelector('.talk')?.remove();
    el.classList.remove('talking');
    if (release) this.release(t.id);
  },

  // Let someone get on with their day from wherever they stopped
  release(id) {
    const h = this.npcHold[id];
    if (!h) return;
    delete this.npcHold[id];
    this.detour[id] = { key: this.planOf(id).key, from: { x: h.x, y: h.y }, t0: Date.now() };
  },

  // ---------- walking together ----------

  // They walk along half a step behind the pig, and now and then say something about where
  // they're passing. It ends when the pig goes in somewhere, when their day moves on, or after
  // three minutes.
  startBuddy(id, line, to = null) {
    const now = Date.now();
    const st = this.npcHold[id] || this.npcAt[id];
    this.npcHold[id] = { x: st.x, y: st.y, dir: st.dir || 1 };
    // the way the pig has gone, for them to follow along it (newest last)
    this.trail = [{ x: st.x, y: st.y }, { x: this.pos.x, y: this.pos.y }];
    this.buddy = { id, t0: now, key: this.planOf(id).key, next: now + 8000, said: new Set(), n: 0, to };
    if (line) this.npcSay(id, line);
  },

  endBuddy(line) {
    const b = this.buddy;
    if (!b) return;
    this.buddy = null;
    if (line) this.npcSay(b.id, line);
    this.release(b.id);
  },

  // They come along the way the pig went, a little way behind: never off to one side, through a
  // wall or a fence
  followPig(dt) {
    const h = this.npcHold[this.buddy.id];
    if (!h) return (this.buddy = null);
    const trail = (this.trail ||= [{ x: h.x, y: h.y }]);
    const last = trail[trail.length - 1];
    if (Math.hypot(this.pos.x - last.x, this.pos.y - last.y) >= 6) trail.push({ x: this.pos.x, y: this.pos.y });
    // the point BUDDY_GAP back along the trail from the pig
    let left = BUDDY_GAP;
    let tx = this.pos.x;
    let ty = this.pos.y;
    let cut = 0;
    for (let i = trail.length - 1; i >= 0; i--) {
      const seg = Math.hypot(tx - trail[i].x, ty - trail[i].y);
      if (seg >= left) {
        const k = left / seg;
        tx += (trail[i].x - tx) * k;
        ty += (trail[i].y - ty) * k;
        left = 0;
        cut = i;
        break;
      }
      left -= seg;
      tx = trail[i].x;
      ty = trail[i].y;
    }
    // stood close by already: stay put rather than step back onto the trail
    if (left > 0 && Math.hypot(this.pos.x - h.x, this.pos.y - h.y) <= BUDDY_GAP + 4) {
      h.moving = false;
      return;
    }
    // they walk the trail in order: the next point of it ahead of them, not straight at the target
    let goal = { x: tx, y: ty };
    for (let i = 0; i < trail.length; i++) {
      if (Math.hypot(trail[i].x - h.x, trail[i].y - h.y) < 8) continue;
      if (i <= cut) goal = trail[i];
      break;
    }
    if (trail.length > 400) trail.splice(0, trail.length - 400);
    const dx = goal.x - h.x;
    const dy = goal.y - h.y;
    const d = Math.hypot(dx, dy);
    h.moving = d > 3;
    if (d > 0.5) {
      const far = Math.hypot(this.pos.x - h.x, this.pos.y - h.y);
      const step = Math.min(d, WALK_SPEED * (far > BUDDY_GAP * 2 ? 1.6 : 1.05) * dt);
      h.x += (dx / d) * step;
      h.y += (dy / d) * step;
    }
    // drop the trail they've walked past
    while (trail.length > 2 && Math.hypot(trail[0].x - h.x, trail[0].y - h.y) < 8) trail.shift();
    if (Math.abs(dx) > 2) h.dir = Math.sign(dx);
  },

  buddyTick(now) {
    const b = this.buddy;
    if (!b) return;
    const T = NPC_TALK[b.id].walk;
    if (this.snap?.busy || this.snap?.sleeping) return this.endBuddy();
    if (this.planOf(b.id).key !== b.key) return this.endBuddy(T.end);
    if (now - b.t0 > 180000) return this.endBuddy(T.tired);
    if (b.to) return this.route ? null : this.endBuddy();
    if (now < b.next) return;
    b.next = now + 13000 + Math.random() * 6000;
    const near = (where) => {
      const pl = npcPlace(where);
      return pl && Math.hypot(this.pos.x - pl.door.x, this.pos.y - pl.door.y) < 170;
    };
    const fav = NPC_BY_ID[b.id].fav;
    if (!b.said.has('fav') && near(fav)) {
      b.said.add('fav');
      return this.npcSay(b.id, T.fav, 4200);
    }
    const place = Object.keys(T.near).find((w) => !b.said.has(w) && near(w));
    if (place) {
      b.said.add(place);
      return this.npcSay(b.id, T.near[place], 4200);
    }
    if (Math.random() < 0.5) this.npcSay(b.id, T.idle[b.n++ % T.idle.length]);
  },

  // Off to the canteen together; at the door they go in with the pig and sit across the table
  // Off somewhere together: they walk along beside the pig to it, and when he starts they stay
  // with him: indoors out of sight, outdoors standing beside him (OUTING_MATES)
  // Where an outing happens: the pitch for football, else wherever that help is given
  outingTarget(o) {
    return o.hobby ? { place: 'field', scene: SOCCER_SCENE } : sceneOf({ s: { activity: { type: 'help', id: o.help } } });
  },

  // What can be done here with the one walking along (if they're friends enough): outings on now
  matesOutings(placeId, id) {
    const s = this.snap?.s;
    if (!s || hearts(s, id) < TOGETHER_HEARTS.go) return [];
    return OUTINGS.filter((o) => this.outingTarget(o).place === placeId && outingOn(s, o));
  },

  goOuting(id, kind) {
    const o = OUTING_BY_ID[kind];
    const target = this.outingTarget(o);
    const e = this.entryOf(target);
    this.endTalk(false);
    this.startBuddy(id, outingTalk(id, kind).go, target.place);
    this.walkTo(e, () => {
      if (this.buddy?.id !== id) return;
      this.buddy = null;
      const m = OUTING_MATES[kind];
      this.npcHold[id] = m ? { x: e.x + m.dx, y: e.y + m.dy, dir: Math.sign(-m.dx) || -1, hold: m.hold || '', act: m.act || '', untilFree: Date.now() } : { x: e.x, y: e.y, gone: true, untilFree: Date.now() };
      this.cb.act('together', `${id}:${kind}`);
    });
  },

  // ---------- camera ----------

  // how much of the world fits in the view
  get viewW() {
    return this.vp.clientWidth / ZOOM;
  },

  get viewH() {
    return this.vp.clientHeight / ZOOM;
  },

  setCam(x, y) {
    this.cam.x = clamp(x, 0, WORLD.w - this.viewW);
    this.cam.y = clamp(y, 0, WORLD.h - this.viewH);
    this.world.style.transform = `translate3d(${-Math.round(this.cam.x * ZOOM)}px, ${-Math.round(this.cam.y * ZOOM)}px, 0) scale(${ZOOM})`;
    this.updateMinimap();
  },

  camFor(px, py) {
    return { x: px - this.viewW / 2, y: py - 30 - this.viewH / 2 };
  },

  centerOnPig() {
    const c = this.camFor(this.pos.x, this.pos.y);
    this.setCam(c.x, c.y);
  },

  // Smoothly bring a world point to the middle of the map (and stop following the pig)
  flyTo(px, py, ms = 650) {
    this.follow = false;
    const t = this.camFor(px, py + 30);
    const tx = clamp(t.x, 0, WORLD.w - this.viewW);
    const ty = clamp(t.y, 0, WORLD.h - this.viewH);
    const from = { ...this.cam };
    const t0 = performance.now();
    cancelAnimationFrame(this.flyRaf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.setCam(from.x + (tx - from.x) * e, from.y + (ty - from.y) * e);
      if (k < 1) this.flyRaf = requestAnimationFrame(step);
    };
    this.flyRaf = requestAnimationFrame(step);
  },

  flyToPlace(id) {
    const p = PLACE_BY_ID[id];
    this.flyTo(p.x + p.w / 2, p.y + p.h / 2);
  },

  // Back to watching the pig
  findPig() {
    cancelAnimationFrame(this.flyRaf);
    this.follow = true;
  },

  // ---------- input ----------

  bindInput() {
    let press = null;
    let pressNpc = null;
    let dragged = false;
    this.vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // someone walking may be out from under the pointer by the time it's let go: who it went down on
      const on = e.target.closest('[data-npc]');
      press = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y };
      pressNpc = e.target.closest('.talk, [data-tk], #pigMenu') ? null : on ? on.dataset.npc : this.npcNear(e.clientX, e.clientY);
      dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!press) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (!dragged) {
        dragged = true;
        cancelAnimationFrame(this.flyRaf);
        this.follow = false;
        this.vp.classList.add('dragging');
        this.hideTip();
      }
      this.setCam(press.cx - dx / ZOOM, press.cy - dy / ZOOM);
    });
    window.addEventListener('pointerup', () => {
      press = null;
      this.vp.classList.remove('dragging');
    });
    // a drag shouldn't also count as a click on whatever it ended over
    this.vp.addEventListener('click', (e) => {
      if (dragged) {
        e.stopPropagation();
        dragged = false;
        return;
      }
      if (e.target.closest('#pigMenu')) return;
      const tk = e.target.closest('[data-tk]');
      if (tk) return this.talkAction(tk);
      if (e.target.closest('.talk')) return;
      this.togglePigMenu(false);
      const npc = e.target.closest('[data-npc]')?.dataset.npc || pressNpc;
      pressNpc = null;
      if (npc) return this.meetNpc(npc);
      const w = e.target.closest('[data-walker]');
      if (w) return this.chat(w);
      this.endTalk();
      if (e.target.closest('#pigActor .a-sprite, #pigActor .a-veh')) return this.togglePigMenu(true);
      const home = e.target.closest('[data-home]');
      if (home) return this.goVisit(home.dataset.home);
      const pl = e.target.closest('[data-place]');
      if (pl) return this.goInto(pl.dataset.place);
      // anywhere else: walk there
      const r = this.vp.getBoundingClientRect();
      const x = (e.clientX - r.left) / ZOOM + this.cam.x;
      const y = (e.clientY - r.top) / ZOOM + this.cam.y;
      if (this.canWalk(true) && walkable(x, y)) this.walkTo({ x, y });
    }, true);
    // right-click works too
    this.vp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const w = e.target.closest('[data-walker]');
      if (w) return this.chat(w);
      const npc = e.target.closest('[data-npc]');
      if (npc && !e.target.closest('.talk')) this.meetNpc(npc.dataset.npc);
    });
    // the view goes where the pig goes: the wheel doesn't move it
    this.vp.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    this.vp.addEventListener('mouseover', (e) => {
      const pl = e.target.closest('[data-place]');
      const npc = e.target.closest('[data-npc]');
      const home = e.target.closest('[data-home]');
      if (npc && !e.target.closest('.talk')) this.showTip(this.npcTip(npc.dataset.npc), this.npcAt[npc.dataset.npc], NPC_BY_ID[npc.dataset.npc].small ? 50 : 66);
      else if (npc) this.hideTip();
      else if (home) {
        const n = NPC_BY_ID[home.dataset.home];
        const r = home.getBBox();
        this.showTip(`${n.icon} ${esc(n.name)}家`, { x: r.x + r.width / 2, y: r.y }, 4);
      } else if (pl) {
        const p = PLACE_BY_ID[pl.dataset.place];
        this.showTip(`${p.icon} ${p.name}`, { x: p.x + p.w / 2, y: p.y }, 4);
      } else this.hideTip();
    });
    this.vp.addEventListener('mouseleave', () => this.hideTip());
  },

  // Keys from the window: WASD / arrows walk, Space / E / Enter go into the place in front
  key(e, down) {
    const k = e.key.toLowerCase();
    if (KEY_DIRS[k]) {
      if (down) {
        if (!this.keys.has(k) && !this.canWalk(true)) return;
        this.keys.add(k);
        this.route = null;
        if (this.talk && !this.talk.met) this.endTalk();
        this.follow = true;
        this.togglePigMenu(false);
      } else this.keys.delete(k);
      return true;
    }
    if (down && [' ', 'e', 'enter'].includes(k) && !this.locked) {
      const h = this.homeNear(40);
      if (h) {
        this.knock(h);
        return true;
      }
      const p = this.doorNear(60);
      if (p) {
        this.enter(p.id);
        return true;
      }
    }
    return false;
  },

  // ---------- visiting ----------

  // Someone's house whose door is right in front of the pig
  homeNear(dist) {
    return Object.keys(HOMES).find((id) => Math.hypot(this.pos.x - HOMES[id].entry.x, this.pos.y - HOMES[id].entry.y) < dist);
  },

  // Click on someone's house: walk up to the door and knock
  goVisit(id) {
    if (!this.canWalk(true)) return;
    const e = HOMES[id].entry;
    if (Math.hypot(this.pos.x - e.x, this.pos.y - e.y) < 12) return this.knock(id);
    this.walkTo(e, () => this.knock(id));
  },

  knock(id) {
    this.face(1);
    this.endBuddy();
    this.cb.onKnock(id);
  },

  // Words from behind a door that stays shut, over the house
  doorSay(id, text) {
    const d = HOMES[id].door;
    const el = document.createElement('div');
    el.className = 'actor door-say';
    el.style.transform = `translate(${d.x}px, ${d.y}px)`;
    el.innerHTML = '<div class="npc-say on"></div>';
    el.firstChild.textContent = text;
    el.firstChild.style.bottom = `${HOMES[id].h - 6}px`;
    this.world.appendChild(el);
    setTimeout(() => el.remove(), 3700);
  },

  // Nobody home: a ? over the pig
  shrug() {
    const el = document.createElement('div');
    el.className = 'city-fx';
    el.textContent = '❓';
    el.style.left = `${this.pos.x}px`;
    el.style.top = `${this.pos.y - 70}px`;
    document.getElementById('cityFx').appendChild(el);
    setTimeout(() => el.remove(), 1600);
  },

  // The pig can be steered: not busy, not asleep, nothing open over the map.
  // tell: say why not
  canWalk(tell = false) {
    if (this.locked || !this.snap || Story.open) return false;
    const why = this.snap.busy ? `${this.snap.label.replace(/^在/, '正在')}呢` : this.snap.sleeping ? '在睡觉呢…zzz' : '';
    if (why && tell && Date.now() - (this.toldAt || 0) > 2500) {
      this.toldAt = Date.now();
      this.cb.onBlocked(why);
    }
    return !why;
  },

  lock(on) {
    this.locked = on;
    if (on) {
      this.keys.clear();
      this.endTalk();
    }
    // coming back out of a building: the pig steps out of its door; a friend who came in and
    // didn't do anything with him gets on with their day
    if (!on && this.inside) {
      const p = PLACE_BY_ID[this.inside];
      this.inside = null;
      if (this.mate && !this.mate.busy) this.release(this.mate.id);
      this.mate = null;
      if (!this.at?.place && !this.route) {
        this.placePig(p.entry.x, p.entry.y);
        this.follow = true;
      }
    }
  },

  // Go into a place (its sheet opens). Someone walking along comes in too if there's something
  // here to do together: the sheet offers to do it with them (see withMate)
  enter(id) {
    this.inside = id;
    const b = this.buddy;
    if (b && this.matesOutings(id, b.id).length) {
      this.buddy = null;
      this.npcHold[b.id] = { ...this.npcHold[b.id], gone: true };
      this.mate = { id: b.id, place: id };
    } else this.endBuddy();
    this.cb.onEnter(id);
  },

  // A help or hobby started inside with the friend who came in: the outing that is, or null
  withMate(kind, helpId) {
    const m = this.mate;
    if (!m || m.busy) return null;
    const o = this.matesOutings(m.place, m.id).find((x) => (kind === 'hobby' ? x.hobby : x.help) === helpId);
    if (!o) return null;
    // they stay with the pig until it's done, then get on with their day
    m.busy = true;
    this.npcHold[m.id] = { ...this.npcHold[m.id], gone: true, untilFree: Date.now() };
    return `${m.id}:${o.id}`;
  },

  // A place whose door is right in front of the pig
  doorNear(dist) {
    let best = null;
    for (const p of PLACES) {
      const d = Math.hypot(this.pos.x - p.entry.x, this.pos.y - p.entry.y);
      if (d < dist && (!best || d < best.d)) best = { p, d };
    }
    return best?.p;
  },

  // Click on a place: walk to its door and go in (or just go in if the pig can't walk now)
  goInto(id) {
    const p = PLACE_BY_ID[id];
    if (!this.canWalk() || Math.hypot(this.pos.x - p.entry.x, this.pos.y - p.entry.y) < 30) return this.enter(id);
    this.walkTo(p.entry, () => this.enter(id));
  },

  npcTip(id) {
    const n = NPC_BY_ID[id];
    const h = hearts(this.snap.s, id);
    return `${esc(n.name)} <span class="tip-hearts">${'♥'.repeat(Math.ceil(h / 2)) || '♡'}</span>`;
  },

  showTip(html, { x, y }, lift) {
    const tip = document.getElementById('placeTip');
    tip.innerHTML = html;
    tip.style.transform = `translate(${x}px, ${y - lift}px) translate(-50%, -100%)`;
    tip.classList.add('on');
  },

  hideTip() {
    document.getElementById('placeTip').classList.remove('on');
  },

  // ---------- the pig ----------

  makePig() {
    const el = document.getElementById('pigActor');
    el.innerHTML = `<div class="a-move"><div class="a-face">
        <div class="a-veh"></div><div class="a-sprite pig-sprite" style="--k:${PIG_SCALE}"></div><div class="a-hold"></div>
      </div><div class="a-follow"></div></div><div class="a-fx"></div>
      <div class="pig-menu" id="pigMenu"></div>`;
    this.actor = el;
    this.sprite = new PigSprite(el.querySelector('.pig-sprite'));
  },

  placePig(x, y) {
    this.pos = { x, y };
    this.actor.style.transform = `translate(${x}px, ${y}px)`;
    this.updateMinimap();
  },

  setPoses(list) {
    for (const p of POSES) this.sprite.root.classList.toggle(p, list.includes(p));
  },

  face(dir) {
    if (!dir) return;
    this.pigDir = dir;
    this.actor.querySelector('.a-face').style.transform = `scaleX(${dir})`;
  },

  // Walk by itself to a point, around anything in the way, then run `done`
  walkTo(end, done = () => {}) {
    if (this.actor.classList.contains('in-room') && this.leaving) {
      // come out of the building first
      const e = PLACE_BY_ID[this.leaving].entry;
      this.placePig(e.x, e.y);
    }
    this.leaving = null;
    this.clearScene();
    this.keys.clear();
    // on the way over to talk to someone: going somewhere else calls it off
    if (this.talk && !this.talk.met) this.endTalk();
    this.route = { pts: findPath({ ...this.pos }, end), i: 1, done };
    this.follow = true;
    this.setPoses(['walking']);
    this.wasMoving = true;
  },

  // Every frame: walking (by itself or by keys) and the camera following along
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let moving = false;
    if (this.route) {
      moving = true;
      let step = WALK_SPEED * dt;
      while (step > 0 && this.route) {
        const t = this.route.pts[this.route.i];
        const dx = t.x - this.pos.x;
        const dy = t.y - this.pos.y;
        const d = Math.hypot(dx, dy);
        if (d <= step) {
          this.placePig(t.x, t.y);
          step -= d;
          if (++this.route.i >= this.route.pts.length) {
            const done = this.route.done;
            this.route = null;
            moving = false;
            this.setPoses([]);
            done();
          }
        } else {
          this.placePig(this.pos.x + (dx / d) * step, this.pos.y + (dy / d) * step);
          this.face(Math.sign(dx));
          step = 0;
        }
      }
    } else if (this.keys.size && this.canWalk()) {
      let vx = 0;
      let vy = 0;
      for (const k of this.keys) {
        vx += KEY_DIRS[k][0];
        vy += KEY_DIRS[k][1];
      }
      const len = Math.hypot(vx, vy);
      if (len) {
        moving = true;
        const step = WALK_SPEED * dt;
        let { x, y } = this.pos;
        // slide along walls: try each direction on its own
        if (walkable(x + (vx / len) * step, y)) x += (vx / len) * step;
        if (walkable(x, y + (vy / len) * step)) y += (vy / len) * step;
        const stuck = x === this.pos.x && y === this.pos.y;
        this.placePig(x, y);
        this.face(Math.sign(vx));
        // walking up into a door goes in
        if (vy < 0 && (stuck || !walkable(x, y - 8))) {
          const h = Object.keys(HOMES).find((id) => Math.abs(x - HOMES[id].door.x) < 26 && y >= HOMES[id].door.y - 4 && y - HOMES[id].door.y < 30);
          const p = !h && PLACES.find((q) => DOOR_KINDS.includes(q.kind) && Math.abs(x - q.door.x) < 26 && y >= q.door.y - 4 && y - q.door.y < 30);
          if (h) {
            this.keys.clear();
            this.knock(h);
          } else if (p) {
            this.keys.clear();
            this.enter(p.id);
          }
        }
      }
    }
    if (moving !== this.wasMoving) {
      this.wasMoving = moving;
      if (!this.at?.scene) this.setPoses(moving ? ['walking'] : []);
    }
    if (this.buddy) this.followPig(dt);
    this.moveNpcs(Date.now());
    // walking away from someone ends the talk
    if (this.talk?.met && Math.hypot(this.pos.x - this.talk.at.x, this.pos.y - this.talk.at.y) > 80) this.endTalk();
    if (this.follow && this.pos) {
      const c = this.camFor(this.pos.x, this.pos.y);
      const k = Math.min(1, dt * 6);
      const nx = this.cam.x + (c.x - this.cam.x) * k;
      const ny = this.cam.y + (c.y - this.cam.y) * k;
      if (Math.abs(nx - this.cam.x) > 0.2 || Math.abs(ny - this.cam.y) > 0.2) this.setCam(nx, ny);
    }
    requestAnimationFrame((t) => this.frame(t));
  },

  // ---------- following the snapshot ----------

  update(snap) {
    this.snap = snap;
    const s = snap.s;
    if (this.talk && (snap.busy || snap.sleeping)) this.endTalk();
    // a friend who came in but whom the pig left out of it: off they go
    if (this.mate && !this.mate.busy && (snap.busy || snap.sleeping)) {
      this.release(this.mate.id);
      this.mate = null;
    }
    // back out of the canteen after eating together
    for (const [id, h] of Object.entries(this.npcHold)) if (h.untilFree && !snap.busy && Date.now() - h.untilFree > 4000) this.release(id);
    this.updateTown(s);
    this.updateNpcs(s);
    this.sprite.update(s, snap.sleeping);
    const target = sceneOf(snap);
    const a = s.activity;
    const key = a ? `${a.type}:${a.id}:${a.start}` : 'free';
    if (key !== this.sceneKey) {
      const first = !this.sceneKey;
      const prev = this.at;
      this.sceneKey = key;
      this.at = target;
      if (!target.place) {
        // done: step out of wherever it was and roam again
        this.route = null;
        this.clearScene();
        if (prev?.place && this.actor.classList.contains('in-room')) {
          const e = PLACE_BY_ID[prev.place].entry;
          this.placePig(e.x, e.y);
        }
        this.actor.classList.remove('in-room', 'on-route');
        this.setPoses([]);
      } else if (first) {
        const entry = this.entryOf(target);
        this.placePig(entry.x, entry.y);
        this.showScene();
        this.centerOnPig();
      } else {
        this.leaving = prev?.place;
        this.walkTo(this.entryOf(target), () => this.showScene());
      }
      this.lastStart = a?.start;
    } else if (!this.route) {
      this.tickScene();
    }
  },

  // Where the pig goes to start a scene: the door, or where the job begins
  entryOf({ place, scene }) {
    if (!scene || scene.tpl === 'room') return PLACE_BY_ID[place].entry;
    if (scene.tpl === 'stand') return scene.spot;
    if (scene.tpl === 'route') return pointAlong(scene.path, this.snap.progress);
    return scene.a;
  },

  // ---------- scenes ----------

  clearScene() {
    document.getElementById('sceneProps').innerHTML = '';
    document.getElementById('bubbleLayer').innerHTML = '';
    const q = (sel) => this.actor.querySelector(sel);
    q('.a-move').className = 'a-move';
    q('.a-move').style.cssText = '';
    q('.a-face').className = 'a-face';
    q('.a-face').style.cssText = '';
    q('.a-veh').innerHTML = '';
    q('.a-hold').innerHTML = '';
    q('.a-follow').innerHTML = '';
    this.actor.classList.remove('in-room', 'on-route');
    this.bubble = null;
    this.progressKey = '';
  },

  showScene() {
    this.clearScene();
    const { place, scene } = this.at;
    if (!scene) return this.setPoses([]);
    const p = PLACE_BY_ID[place];
    const q = (sel) => this.actor.querySelector(sel);
    const hold = (html) => (q('.a-hold').innerHTML = html);
    switch (scene.tpl) {
      case 'room': {
        const room = ROOMS[scene.room];
        // over the building, or over the part of it given (a ride in the theme park)
        const at = scene.at || { x: p.x + p.w / 2, y: p.y };
        const bx = clamp(at.x - 110, 8, WORLD.w - 228);
        const by = Math.max(8, at.y - 150);
        this.bubble = { x: bx, y: by, room: scene.room };
        document.getElementById('bubbleLayer').innerHTML = `<div class="room-bubble" style="left:${bx}px;top:${by}px">
          <div class="rb-in"></div><i class="rb-tail" style="left:${clamp(at.x - bx, 30, 190)}px"></i></div>`;
        this.placePig(bx + room.pig.x, by + room.pig.y);
        this.actor.classList.add('in-room');
        this.setPoses(room.pose ? [room.pose] : []);
        break;
      }
      case 'stand':
        this.placePig(scene.spot.x, scene.spot.y);
        this.setPoses([scene.pose || 'working']);
        if (scene.hold) hold(`<span>${scene.hold}</span>`);
        break;
      case 'patrol':
      case 'haul': {
        const a = scene.a;
        const dx = scene.b.x - a.x;
        this.placePig(a.x, a.y);
        const dur = Math.max(4, Math.hypot(dx, scene.b.y - a.y) / (scene.tpl === 'haul' ? 45 : 32));
        const mv = q('.a-move');
        mv.classList.add('patrol');
        mv.style.cssText = `--dx:${dx}px;--dy:${scene.b.y - a.y}px;--dur:${dur}s`;
        const face = q('.a-face');
        face.classList.add('patrol-face');
        face.style.cssText = `--dur:${dur}s;--f:${dx < 0 ? -1 : 1}`;
        this.setPoses(['walking', ...(scene.pose ? [scene.pose] : [])]);
        if (scene.hold === 'flyer') hold('<span class="flyers"></span>');
        else if (scene.hold) hold(`<span>${scene.hold}</span>`);
        else if (scene.item) hold(`<span class="carry">${scene.item}</span>`);
        if (scene.followers) q('.a-follow').innerHTML = ['🐥', '🐰', '🐻'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
        if (scene.follow) q('.a-follow').innerHTML = scene.follow.map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
        if (scene.ducklings) q('.a-follow').innerHTML = ['🦆', '🐤', '🐤'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
        break;
      }
      case 'route':
        q('.a-veh').innerHTML = VEHICLES[scene.vehicle];
        this.actor.classList.add('on-route');
        this.setPoses(['riding']);
        hold('<span class="basket"></span>');
        break;
    }
    this.drawProps(scene);
    this.tickScene(true);
  },

  // Props on the ground around a scene that don't change with progress
  drawProps(scene) {
    const props = [];
    const at = (x, y, html, cls = '') => props.push(`<div class="prop ${cls}" style="left:${x}px;top:${y}px">${html}</div>`);
    if (scene.hat) at(scene.spot.x + 58, scene.spot.y + 2, '🎩', 'hat');
    if (scene.easel) {
      at(scene.spot.x - 44, scene.spot.y - 30, '🖼️', 'big');
      props.push(`<div class="prop npc-model" style="left:${scene.spot.x - 90}px;top:${scene.spot.y}px"><div class="a-sprite" style="--k:.26">${animalSvg('bear')}</div></div>`);
    }
    if (scene.audience) {
      const d = PLACE_BY_ID.stage.door;
      ['🐰', '🐱', '🐻', '🐥', '🐶'].forEach((c, i) => at(d.x - 80 + i * 40, d.y + 34 + (i % 2) * 8, c, 'cheer'));
    }
    if (scene.walkers) {
      // shoppers on the flyer street, each one taking a flyer as they pass
      const dist = scene.b.x - scene.a.x;
      ['🐰', '🐱', '🐻'].forEach((c, i) => props.push(`<div class="prop passer" style="left:${scene.a.x}px;top:${scene.a.y + 14}px;--i:${i};--dist:${dist}px">${c}</div>`));
    }
    document.getElementById('sceneProps').innerHTML = `<div class="sp-static">${props.join('')}</div><div class="sp-dyn"></div>`;
  },

  setDynProps(html) {
    const el = document.querySelector('#sceneProps .sp-dyn');
    if (el && el.dataset.html !== html) {
      el.dataset.html = html;
      el.innerHTML = html;
    }
  },

  // Bits of a scene that follow progress: piles, the round's position, the room's contents
  tickScene(force = false) {
    const scene = this.at?.scene;
    if (!scene || (!this.snap?.busy && !this.snap?.sleeping)) return;
    const p = this.snap.progress;
    const step = Math.floor(p * 40);
    if (!force && scene.tpl !== 'route' && step === this.progressKey) return;
    this.progressKey = step;
    const q = (sel) => this.actor.querySelector(sel);
    if (scene.tpl === 'room' && this.bubble) {
      const inner = document.querySelector('#bubbleLayer .rb-in');
      if (inner) inner.innerHTML = roomHtml(scene.room, { progress: p, snap: this.snap });
    }
    if (scene.hold === 'flyer') {
      const n = Math.max(1, Math.round((1 - p) * 5));
      q('.flyers').innerHTML = [...Array(n)].map((_, i) => `<i style="--i:${i}"></i>`).join('');
    }
    if (scene.tpl === 'haul') {
      const left = Math.round((1 - p) * 6);
      const done = Math.round(p * 6);
      const pile = (n, ch) => [...Array(n)].map((_, i) => `<i style="--i:${i}">${ch}</i>`).join('');
      let html = `<div class="prop pile" style="left:${scene.a.x - 30}px;top:${scene.a.y + 4}px">${pile(left, scene.item)}</div>`;
      if (scene.wall) {
        const rows = Math.round(p * 6);
        html += `<div class="prop wall" style="left:${scene.b.x + 22}px;top:${scene.b.y}px">${[...Array(rows)].map((_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;
      } else {
        html += `<div class="prop pile basket-pile" style="left:${scene.b.x + 26}px;top:${scene.b.y + 4}px"><b>${scene.basket || '🧺'}</b>${pile(done, scene.item)}</div>`;
      }
      this.setDynProps(html);
    }
    if (scene.tpl === 'route') {
      const pt = pointAlong(scene.path, p);
      this.placePig(pt.x, pt.y);
      this.face(pt.dir);
      const done = scene.stops.filter((_, i) => scene.stopAt[i] <= p);
      // a long round shows at most six in the basket, going down as the stops are done
      const left = Math.ceil(((scene.stops.length - done.length) / scene.stops.length) * Math.min(6, scene.stops.length));
      q('.basket').innerHTML = [...Array(left)].map(() => `<i>${scene.item}</i>`).join('');
      this.setDynProps(done.map((s) => `<div class="prop delivered" style="left:${s.x}px;top:${s.y - 16}px">${scene.item}<b>♥</b></div>`).join(''));
    }
  },

  // Little things popping up over the pig while it works: 💦, 🎵, 🪙…
  popFx() {
    if (document.hidden || this.route || !this.snap) return;
    const scene = this.at?.scene;
    const room = scene?.tpl === 'room' ? ROOMS[scene.room] : null;
    const list = room?.fx || scene?.fx;
    if (!list || !(this.snap.busy || this.snap.sleeping)) return;
    const el = document.createElement('div');
    el.className = 'city-fx';
    el.textContent = list[Math.floor(Math.random() * list.length)];
    el.style.left = `${this.pos.x + (Math.random() * 30 - 15)}px`;
    el.style.top = `${this.pos.y - 60}px`;
    document.getElementById('cityFx').appendChild(el);
    setTimeout(() => el.remove(), 1600);
  },

  // Eat something, play with a toy, wash: a short animation on the pig
  react(it) {
    playUse(this.sprite.root, this.actor, it);
  },

  // ---------- the menu over the pig ----------

  togglePigMenu(open = !this.menuOpen) {
    this.menuOpen = open;
    const m = document.getElementById('pigMenu');
    if (!open) {
      m.classList.remove('on');
      return;
    }
    const snap = this.snap;
    // busy: nothing to offer here, the status pill under the top bar has 不做了
    if (snap.busy) return this.togglePigMenu(false);
    const btns = snap.sleeping
      ? [['wake', '☀️', '起床'], ['album', '📷', '相册']]
      : [['bedtime', '😴', '睡觉'], ['goHome', '🏠', '回家'], ['album', '📷', '相册']];
    m.innerHTML = btns.map(([a, ic, t]) => `<button data-action="${a}" title="${t}"><span>${ic}</span><small>${t}</small></button>`).join('');
    m.classList.add('on');
  },

  // ---------- the little map in the corner and the big map ----------

  // Shared drawing for both: soft ground, the neighbourhoods, white roads, the river and the
  // places as cards with a band in their roof colour. On the big map every label is a group
  // sized in screen pixels (scaled by 1 / --k, the zoom), so names stay readable at any zoom.
  mapSvg(big) {
    const s = this.snap?.s;
    let svg = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="#e9f3dc"/>`;
    for (const d of DISTRICTS) {
      const [x1, y1, x2, y2] = d.rect;
      svg += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="46" fill="${d.color}"/>`;
    }
    for (const f of [...FIELDS, PASTURE]) svg += `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="14" fill="${f.crop ? '#e4cfa6' : '#bfe3a0'}"/>`;
    for (const [color, w] of [['#e3d6c0', big ? 34 : 46], ['#fffdf7', big ? 22 : 30]]) {
      for (const r of ROADS) svg += `<path d="${ptsD(r.line)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    }
    svg += `<path d="${ptsD(RIVER)}" stroke="#a5d8ff" stroke-width="${RIVER_W * 2}" stroke-linecap="round" fill="none"/>`;
    // the other buildings in their own colours: the windmill, and the homes you can visit
    for (const d of DECOS) {
      const c = decoColor(d);
      if (!big) {
        svg += `<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="16" fill="${c}" opacity=".9"/>`;
        continue;
      }
      const band = Math.min(24, d.h * 0.18);
      svg += `<g class="mp" ${d.home ? `data-mhome="${d.home}"` : ''}><rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="16" fill="#fff"/>
        <rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="16" fill="${c}" fill-opacity=".16"/>
        <path d="M${d.x} ${d.y + band}V${d.y + 16}a16 16 0 0 1 16 -16H${d.x + d.w - 16}a16 16 0 0 1 16 16V${d.y + band}Z" fill="${c}"/>
        <rect class="mp-edge" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="16" fill="none" stroke="${c}"/></g>`;
    }
    // a label group: drawn around (0, 0) in screen pixels, placed at a map point
    const at = (x, y, cls, html) => `<g class="${cls}" style="--x:${Math.round(x)};--y:${Math.round(y)}">${html}</g>`;
    const pill = (text, size, cls = '') => {
      const w = Math.round(size * [...text].length + 14);
      return `<rect class="mp-pill ${cls}" x="${-w / 2}" y="${-size / 2 - 5}" width="${w}" height="${size + 10}" rx="${size / 2 + 5}"/><text class="mp-t" y="0.5" style="font-size:${size}px">${text}</text>`;
    };
    let labels = '';
    if (big) {
      const minor = (x, y, t) => at(x, y, 'mp-lab mp-minor', `<text class="mp-t" style="font-size:11.5px">${t}</text>`);
      for (const d of DECOS) labels += at(d.x + d.w / 2, d.y + d.h / 2, 'mp-lab', `<text class="mp-ic" y="-10">${d.icon}</text><g class="mp-name" transform="translate(0 15)">${pill(d.name, 12.5)}</g>`);
      for (const f of FIELDS) labels += minor(f.x + f.w / 2, f.y + f.h / 2, '🌱 农田');
      labels += minor(PASTURE.x + PASTURE.w / 2, PASTURE.y + PASTURE.h / 2, '🐄 牧场');
    }
    for (const p of PLACES) {
      const locked = s && p.minLevel && s.level < p.minLevel;
      const c = locked ? '#ced4da' : placeColor(p);
      const band = Math.min(28, p.h * 0.2);
      svg += `<g class="mp ${locked ? 'locked' : ''}" ${big ? `data-mplace="${p.id}"` : ''}>`;
      if (big) {
        svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="18" fill="#fff"/>
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="18" fill="${locked ? '#f1f3f5' : c}" fill-opacity="${locked ? 1 : 0.16}"/>
          <path d="M${p.x} ${p.y + band}V${p.y + 18}a18 18 0 0 1 18 -18H${p.x + p.w - 18}a18 18 0 0 1 18 18V${p.y + band}Z" fill="${locked ? '#e9ecef' : c}"/>
          <rect class="mp-edge" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="18" fill="none" stroke="${c}"/>`;
        labels += at(p.x + p.w / 2, p.y + p.h / 2, `mp-lab ${locked ? 'locked' : ''}`,
          `<text class="mp-ic" y="-10">${p.icon}</text><g class="mp-name" transform="translate(0 15)">${pill(`${p.name}${locked ? ` 🔒${p.minLevel}` : ''}`, 12.5, locked ? 'locked' : '')}</g>`);
      } else {
        svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="22" fill="${locked ? '#dee2e6' : c}" opacity="${locked ? 1 : 0.9}"/>`;
      }
      svg += '</g>';
    }
    if (big) for (const d of DISTRICTS) labels += at(d.sign[0], d.sign[1] - 70, 'mp-lab mp-district', pill(d.name, 15));
    return svg + labels;
  },

  drawMinimap() {
    const el = document.getElementById('minimap');
    el.innerHTML = `<svg viewBox="0 0 ${WORLD.w} ${WORLD.h}"><g id="mmBase"></g>
      <rect id="mmView" fill="none" stroke="#f06b95" stroke-width="20" rx="24"/><circle id="mmPig" r="56" fill="#f06b95" stroke="#fff" stroke-width="20"/></svg><span class="mm-lab">M</span>`;
    el.title = '地图 (M)';
    // clicking it opens the big map, growing out of the corner
    el.addEventListener('click', () => this.cb.onMap());
  },

  updateMinimap() {
    const v = document.getElementById('mmView');
    if (!v) return;
    v.setAttribute('x', this.cam.x);
    v.setAttribute('y', this.cam.y);
    v.setAttribute('width', this.viewW);
    v.setAttribute('height', this.viewH);
    if (this.pos) {
      const pig = document.getElementById('mmPig');
      pig.setAttribute('cx', this.pos.x);
      pig.setAttribute('cy', this.pos.y);
    }
    const key = this.snap ? this.snap.s.level : -1;
    if (key !== this.mmKey) {
      this.mmKey = key;
      document.getElementById('mmBase').innerHTML = this.mapSvg(false);
    }
  },

  // The big map opens zoomed in around the pig; drag to look around, wheel or the buttons to zoom
  openMap() {
    const el = document.getElementById('mapView');
    el.innerHTML = `<div class="mv-head"><b>🗺️ 猪猪城地图</b><button class="mv-x" data-action="closeMap" title="关上 (M)">${ICON.close}</button></div>
      <div class="mv-wrap"><div class="mv-box"><svg>${this.mapSvg(true)}
        <defs><clipPath id="mvHead"><circle r="13"/></clipPath></defs><g class="mv-npcs"></g>
        <g class="mp-lab mv-pig" style="--x:${Math.round(this.pos.x)};--y:${Math.round(this.pos.y)}"><circle class="mv-pulse" r="22"/><circle class="mv-dot" r="17"/><text class="mp-ic" y="1" style="font-size:18px">🐷</text></g></svg></div>
        <div class="mv-ctl"><button data-z="in" title="放大"><svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10"/></svg></button><button data-z="out" title="缩小"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button><button data-z="pig" title="小猪在哪">🐷</button></div></div>`;
    el.classList.add('on');
    const box = el.querySelector('.mv-box');
    const svg = box.querySelector('svg');
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    // scale: screen pixels per map pixel, from the whole map fitting up to fairly close
    const minK = Math.min(bw / WORLD.w, bh / WORLD.h);
    const maxK = 0.9;
    const v = { k: 0.42, x: 0, y: 0 };
    const show = () => {
      v.k = clamp(v.k, minK, maxK);
      const w = bw / v.k;
      const h = bh / v.k;
      v.x = w >= WORLD.w ? (WORLD.w - w) / 2 : clamp(v.x, 0, WORLD.w - w);
      v.y = h >= WORLD.h ? (WORLD.h - h) / 2 : clamp(v.y, 0, WORLD.h - h);
      svg.setAttribute('viewBox', `${v.x} ${v.y} ${w} ${h}`);
      svg.style.setProperty('--k', v.k);
      // zoomed far out: icons and neighbourhood names only
      box.classList.toggle('far', v.k < 0.3);
      el.querySelector('[data-z=in]').disabled = v.k >= maxK - 1e-6;
      el.querySelector('[data-z=out]').disabled = v.k <= minK + 1e-6;
    };
    const zoomAt = (f, sx = bw / 2, sy = bh / 2) => {
      const mx = v.x + sx / v.k;
      const my = v.y + sy / v.k;
      v.k = clamp(v.k * f, minK, maxK);
      v.x = mx - sx / v.k;
      v.y = my - sy / v.k;
      show();
    };
    const centre = () => {
      v.x = this.pos.x - bw / v.k / 2;
      v.y = this.pos.y - bh / v.k / 2;
      show();
    };
    centre();
    this.mapHeads();
    clearInterval(this.headsTimer);
    this.headsTimer = setInterval(() => this.mapHeads(), 1500);
    let press = null;
    let dragged = false;
    box.onpointerdown = (e) => {
      if (e.button !== 0) return;
      press = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
      dragged = false;
      box.setPointerCapture(e.pointerId);
    };
    box.onpointermove = (e) => {
      if (!press) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!dragged && Math.hypot(dx, dy) < 8) return;
      dragged = true;
      box.classList.add('dragging');
      v.x = press.vx - dx / v.k;
      v.y = press.vy - dy / v.k;
      show();
    };
    // a press that didn't turn into a drag is a click on whatever is under the mouse (the box
    // holds the pointer while pressed, so the click event itself would only name the box)
    box.onpointerup = (e) => {
      const click = press && !dragged;
      press = null;
      box.classList.remove('dragging');
      if (click) this.mapClick(document.elementFromPoint(e.clientX, e.clientY));
    };
    // zoom around the point under the mouse
    box.onwheel = (e) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    el.querySelector('.mv-ctl').onclick = (e) => {
      const z = e.target.closest('[data-z]')?.dataset.z;
      if (z === 'in') zoomAt(1.35);
      else if (z === 'out') zoomAt(1 / 1.35);
      else if (z === 'pig') centre();
    };
  },

  // A click on the big map: a face finds that neighbour, a house goes to knock, a building
  // walks to its door (or just shows it if the pig can't walk now)
  mapClick(target) {
    const who = target?.closest('[data-mnpc]');
    const home = target?.closest('[data-mhome]');
    const place = target?.closest('[data-mplace]');
    if (!who && !home && !place) return;
    this.cb.onMap();
    this.cb.goOut?.();
    if (who) return this.findNpc(who.dataset.mnpc);
    if (home) return this.goVisit(home.dataset.mhome);
    if (this.canWalk(true)) this.walkTo(PLACE_BY_ID[place.dataset.mplace].entry);
    else this.flyToPlace(place.dataset.mplace);
  },

  closeMap() {
    clearInterval(this.headsTimer);
    document.getElementById('mapView').classList.remove('on');
  },

  // Everyone's little round face on the big map: where they are when out and about, else on
  // the corner of the place they're in (MAP_FACES at most, then how many more)
  mapHeads() {
    const g = document.querySelector('#mapView .mv-npcs');
    if (!g) return;
    const head = (n, x, y, dx, cls = '') => `<g class="mp-lab mv-npc ${cls}" data-mnpc="${n.id}" style="--x:${Math.round(x)};--y:${Math.round(y)}"><title>${esc(n.name)}</title><g transform="translate(${dx} 0)">
      <circle class="mv-npc-bg" r="14"/><g clip-path="url(#mvHead)">${mapFace(n.species)}</g><circle class="mv-npc-ring" r="14"/></g></g>`;
    let html = '';
    const inside = {};
    for (const n of NPCS) {
      const st = this.npcAt[n.id];
      if (!st) continue;
      // keepers behind their counter count as inside their shop
      const atWork = st.plan.act === 'work' && st.plan.where === n.place && !this.npcHold[n.id];
      if (st.shown && !atWork) html += head(n, st.x, st.y - 30, 0);
      else (inside[st.plan.where] ||= []).push(n);
    }
    for (const [where, list] of Object.entries(inside)) {
      const p = PLACE_BY_ID[where];
      const c = p ? { x: p.x + p.w - 12, y: p.y + 12 } : npcPlace(where).door;
      // up to four faces in an overlapping row, the first on top; past that, how many more and who
      const shown = list.slice(0, MAP_FACES);
      [...shown].reverse().forEach((n) => {
        const i = shown.indexOf(n);
        html += head(n, c.x, c.y, -i * 20, npcAsleep(this.npcAt[n.id].plan) ? 'zz' : '');
      });
      const rest = list.slice(MAP_FACES);
      if (rest.length) {
        html += `<g class="mp-lab mv-more" style="--x:${Math.round(c.x)};--y:${Math.round(c.y)}"><title>${rest.map((n) => esc(n.name)).join('、')}</title>
          <g transform="translate(${-MAP_FACES * 20 - 6} 0)"><circle r="10"/><text class="mp-t" y="0.5">+${rest.length}</text></g></g>`;
      }
    }
    if (g.dataset.html === html) return;
    g.dataset.html = html;
    g.innerHTML = html;
  },
};

// What goes in the bubble over someone the pig is talking to (t: the talk, in town or in a
// house): their words, and round buttons under them. 🎁 and 🤝 open a row of choices in the same
// place; a question shows its two answers. together: whether 🤝 is offered (not indoors); tea:
// whether ☕ is (at their house, not had today).
function talkHtml(t, snap, { together = true, tea = false } = {}) {
  const s = snap.s;
  const b = (tk, icon, title, off = false) => `<button class="tk-b" data-tk="${tk}" title="${title}" ${off ? 'disabled' : ''}>${icon}</button>`;
  const back = '<button class="tk-b tk-back" data-tk="back" title="返回">‹</button>';
  const h = hearts(s, t.id);
  let acts = '';
  if (t.line == null) acts = '';
  else if (t.mode === 'ask') acts = t.ask.a.map((a, i) => `<button class="tk-a" data-tk="answer" data-i="${i}">${esc(a)}</button>`).join('');
  else if (t.mode === 'gift') {
    const wish = wishDone(s, t.id) ? null : npcWish(t.id);
    acts = back + giftable(s, t.id).map((it) => `<button class="tk-item ${it.id === wish ? 'wish' : ''}" data-tk="give" data-item="${it.id}" title="${esc(it.name)}">${it.icon}<b>${s.inventory[it.id]}</b></button>`).join('');
  } else if (t.mode === 'together') {
    const go = h >= TOGETHER_HEARTS.go && OUTINGS.some((o) => outingOn(s, o));
    acts = back + b('walk', '🚶', '一起走走')
      + (h >= TOGETHER_HEARTS.play ? b('play', '🎲', '一起玩', !!gameBlock(snap)) : '')
      + (go ? b('go', '📍', '一起去') : '');
  } else if (t.mode === 'hands') {
    acts = back + RPS_THROWS.map((x) => `<button class="tk-b" data-tk="hand" data-hand="${x.id}" title="${x.name}">${x.icon}</button>`).join('');
  } else if (t.mode === 'go') {
    // somewhere to go together: only what's on now; greyed (and why, on hover) if the pig can't
    const busy = snap.busy ? '在忙' : snap.sleeping ? '在睡觉' : '';
    acts = back + OUTINGS.filter((o) => outingOn(s, o)).map((o) => {
      const why = outingWhy(s, o, busy);
      const fee = FREE_HELP_BY_ID[o.help]?.fee;
      return `<button class="tk-b" data-tk="outing" data-kind="${o.id}" title="${o.name}${why ? `（${why}）` : fee ? ` 🪙${fee * 2}` : ''}" ${why ? 'disabled' : ''}>${o.icon}</button>`;
    }).join('');
  } else {
    acts = b('chat', '💬', '聊天')
      + b('rps', '✊', '切磋')
      + (giftable(s, t.id).length ? b('gift', '🎁', '送礼') : '')
      + (tea ? b('tea', '☕', '坐下喝点') : '')
      + (together && h >= TOGETHER_HEARTS.walk ? b('together', '🤝', '一起') : '')
      + (h >= TOGETHER_HEARTS.walk ? b('snap', '📷', '合影', s.album.some((p) => p.k === 'snap' && p.w === t.id && p.d === dayKey())) : '');
  }
  return `<p class="tk-line ${t.line == null ? 'wait' : ''}">${t.line == null ? '<i></i><i></i><i></i>' : esc(t.line)}</p>${acts ? `<div class="tk-acts ${t.mode}">${acts}</div>` : ''}`;
}

// ---------- heart stories: a box along the bottom ----------
// A few lines with their big face beside them, typed out; a click shows the rest of a line or
// moves on. A choice is two buttons. The map dims a little and nobody here moves.
const Story = {
  open: false,

  // Play someone's story for k hearts; done() when it's over
  play(id, k, done) {
    this.say(id, NPC_STORIES[id][k].lines, done);
  },

  // Any few lines of theirs, the same way (written as a story's are)
  say(id, lines, done) {
    let el = document.getElementById('story');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story';
      document.querySelector('.window').appendChild(el);
      el.addEventListener('click', (e) => this.click(e));
    }
    el.innerHTML = `<div class="sto-box"><div class="sto-av"></div>
      <div class="sto-m"><b class="sto-name"></b><p class="sto-text"></p><div class="sto-acts"></div></div><i class="sto-more"></i></div>`;
    Object.assign(this, { id, queue: [...lines], done, open: true, choice: null });
    el.classList.add('on');
    City.hideTip();
    this.next();
  },

  // The next line or choice. "@who " says who speaks; a leading ^ smiles, ! is surprised, ~ shy.
  next() {
    const step = this.queue.shift();
    if (step == null) return this.close();
    const el = document.getElementById('story');
    if (typeof step === 'object') {
      this.choice = step;
      el.classList.add('choosing');
      el.querySelector('.sto-acts').innerHTML = step.ask.map((a, i) => `<button class="sto-pick" data-i="${i}">${esc(a)}</button>`).join('');
      return;
    }
    let text = step;
    let who = this.id;
    const m = /^@(\w+) /.exec(text);
    if (m) {
      who = m[1];
      text = text.slice(m[0].length);
    }
    const face = { '^': 'happy', '!': 'surprised', '~': 'closed' }[text[0]] || 'normal';
    if (face !== 'normal') text = text.slice(1);
    const n = NPC_BY_ID[who];
    el.classList.remove('choosing');
    el.querySelector('.sto-acts').innerHTML = '';
    el.querySelector('.sto-av').innerHTML = animalSvg(n.species, face);
    el.querySelector('.sto-name').textContent = n.name;
    const p = el.querySelector('.sto-text');
    const chars = [...text];
    let i = 0;
    p.textContent = '';
    this.typing = true;
    el.classList.add('typing');
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      p.textContent = chars.slice(0, ++i).join('');
      if (i >= chars.length) this.typed();
    }, 45);
    this.text = text;
  },

  typed() {
    clearInterval(this.timer);
    this.typing = false;
    const el = document.getElementById('story');
    el.classList.remove('typing');
    el.querySelector('.sto-text').textContent = this.text;
  },

  click(e) {
    const b = e.target.closest('.sto-pick');
    if (b) {
      const st = this.choice;
      const i = Number(b.dataset.i);
      this.choice = null;
      if (st.mem) City.cb.act('remember', `${this.id}:${st.mem}:${i}`);
      this.queue.unshift(...st.then[i]);
      return this.next();
    }
    if (this.choice) return;
    if (this.typing) return this.typed();
    this.next();
  },

  // Space, Enter or E move on too
  key(e) {
    if (![' ', 'enter', 'e'].includes(e.key.toLowerCase())) return false;
    if (!this.choice) this.click(e);
    return true;
  },

  close() {
    clearInterval(this.timer);
    this.open = false;
    document.getElementById('story').classList.remove('on');
    this.done?.();
  },
};
