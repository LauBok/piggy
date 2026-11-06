// The Pig City map in the home window. The player walks the pig around town (WASD, or by
// clicking), goes into places, and sees it doing its activities on the spot; neighbours stand
// at their shops and people stroll the paths. Game state only comes in as snapshots; clicks and
// entering go out through the callbacks given to City.init().

const PIG_SCALE = 0.38;
const NPC_SCALE = 0.3;
const WALKER_SCALE = 0.24;
const WALK_SPEED = 190; // px per second
const FX_EVERY = 2600;
const KEY_DIRS = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };
// places you go into through a door, by walking up into it
const DOOR_KINDS = ['building', 'home', 'pavilion', 'stage', 'houses'];

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
    if (accKey !== this.accKey) {
      this.accKey = accKey;
      this.acc.innerHTML = accKey ? ACCESSORIES[accKey] : '';
    }
  }
}

const POSES = ['walking', 'working', 'studying', 'dining', 'dig', 'riding', 'jump'];

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
      <div id="sceneProps"></div><div id="walkers"></div><div id="npcLayer"></div>
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
    const decoSvgG = (d) => `<g class="deco"><title>${d.name}</title>${decoSvg(d)}</g>`;
    const all = [...PLACES.map((p) => ({ p, svg: placeSvg })), ...DECOS.map((p) => ({ p, svg: decoSvgG }))]
      .sort((a, b) => a.p.y + a.p.h - (b.p.y + b.p.h));
    svg.innerHTML = `${groundSvg()}${farmSvg()}${all.map((o) => o.svg(o.p)).join('')}<g id="donations"></g>${scenerySvg()}${signsSvg()}`;
    this.homeTier = -1;
    this.donated = '';
  },

  // Things on the map that change with the save: house tier, donations, locks
  updateTown(s) {
    const tier = homeTier(s);
    if (tier !== this.homeTier) {
      this.homeTier = tier;
      document.getElementById('homeArt').innerHTML = homeExterior(PLACE_BY_ID.home, tier);
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
    for (const p of PLACES) {
      if (!p.minLevel) continue;
      this.world.querySelector(`[data-place="${p.id}"]`).classList.toggle('locked', s.level < p.minLevel);
    }
  },

  // People strolling along the paths, just for life
  drawWalkers() {
    const lanes = [
      { y: 2058, x1: 1270, x2: 2420, sp: 'cat' }, { y: 1248, x1: 1270, x2: 2420, sp: 'rabbit' },
      { y: 780, x1: 1300, x2: 2440, sp: 'bear' }, { y: 2378, x1: 1270, x2: 2420, sp: 'duck' },
      { y: 968, x1: 1270, x2: 2420, sp: 'dog' }, { y: 1528, x1: 1270, x2: 2420, sp: 'sheep' },
    ];
    document.getElementById('walkers').innerHTML = lanes.map((l, i) => {
      const dx = l.x2 - l.x1;
      const dur = dx / 30;
      return `<div class="actor walker" style="transform:translate(${l.x1}px,${l.y}px)">
        <div class="a-move patrol" style="--dx:${dx}px;--dur:${dur}s;animation-delay:${-i * 13}s">
          <div class="a-face patrol-face" style="--dur:${dur}s;animation-delay:${-i * 13}s"><div class="a-sprite hop" style="--k:${WALKER_SCALE}">${animalSvg(l.sp)}</div></div>
        </div></div>`;
    }).join('') + this.pastureAnimals();
  },

  // The ranch animals ambling about their pasture
  pastureAnimals() {
    const p = PASTURE;
    return p.animals.map((a, i) => {
      const x = p.x + 40 + ((i * 97) % (p.w - 120));
      const y = p.y + 80 + ((i * 131) % (p.h - 120));
      const dx = 40 + ((i * 37) % 60);
      const dur = 9 + i * 2;
      return `<div class="actor walker" style="transform:translate(${x}px,${y}px)">
        <div class="a-move patrol" style="--dx:${dx}px;--dy:${(i % 3) * 10 - 10}px;--dur:${dur}s;animation-delay:${-i * 3}s">
          <div class="a-face patrol-face" style="--dur:${dur}s;--f:-1;animation-delay:${-i * 3}s"><span class="farm-animal">${a}</span></div></div></div>`;
    }).join('');
  },

  // ---------- neighbours ----------

  npcPos(n) {
    const d = PLACE_BY_ID[n.place].door;
    return { x: d.x + 50, y: d.y + 8 };
  },

  drawNpcs() {
    document.getElementById('npcLayer').innerHTML = NPCS.map((n) => {
      const { x, y } = this.npcPos(n);
      return `<div class="actor npc" data-npc="${n.id}" style="transform:translate(${x}px,${y}px)">
        <div class="npc-bubble" data-wish="${n.id}"></div><div class="npc-say" data-say="${n.id}"></div>
        <div class="a-sprite" style="--k:${NPC_SCALE}">${animalSvg(n.species)}</div></div>`;
    }).join('');
  },

  updateNpcs(s) {
    for (const n of NPCS) {
      const el = this.world.querySelector(`[data-wish="${n.id}"]`);
      const wish = npcWish(n.id);
      const show = wish && !wishDone(s, n.id);
      const key = show ? `${wish}:${!!s.inventory[wish]}` : '';
      if (el.dataset.key === key) continue;
      el.dataset.key = key;
      el.innerHTML = show ? ITEM_BY_ID[wish].icon : '';
      el.classList.toggle('on', !!show);
      el.classList.toggle('have', !!(show && s.inventory[wish]));
    }
  },

  npcSay(id, text) {
    const el = this.world.querySelector(`[data-say="${id}"]`);
    el.textContent = text;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(el.timer);
    el.timer = setTimeout(() => el.classList.remove('on'), 2600);
  },

  // ---------- camera ----------

  setCam(x, y) {
    this.cam.x = clamp(x, 0, WORLD.w - this.vp.clientWidth);
    this.cam.y = clamp(y, 0, WORLD.h - this.vp.clientHeight);
    this.world.style.transform = `translate3d(${-Math.round(this.cam.x)}px, ${-Math.round(this.cam.y)}px, 0)`;
    this.updateMinimap();
  },

  camFor(px, py) {
    return { x: px - this.vp.clientWidth / 2, y: py - 30 - this.vp.clientHeight / 2 };
  },

  centerOnPig() {
    const c = this.camFor(this.pos.x, this.pos.y);
    this.setCam(c.x, c.y);
  },

  // Smoothly bring a world point to the middle of the map (and stop following the pig)
  flyTo(px, py, ms = 650) {
    this.follow = false;
    const t = this.camFor(px, py + 30);
    const tx = clamp(t.x, 0, WORLD.w - this.vp.clientWidth);
    const ty = clamp(t.y, 0, WORLD.h - this.vp.clientHeight);
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
    let dragged = false;
    this.vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      press = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y };
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
      this.setCam(press.cx - dx, press.cy - dy);
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
      this.togglePigMenu(false);
      const npc = e.target.closest('[data-npc]');
      if (npc) return this.cb.onNpc(npc.dataset.npc);
      if (e.target.closest('#pigActor .a-sprite, #pigActor .a-veh')) return this.togglePigMenu(true);
      const pl = e.target.closest('[data-place]');
      if (pl) return this.goInto(pl.dataset.place);
      // anywhere else: walk there
      const r = this.vp.getBoundingClientRect();
      const x = e.clientX - r.left + this.cam.x;
      const y = e.clientY - r.top + this.cam.y;
      if (this.canWalk(true) && walkable(x, y)) this.walkTo({ x, y });
    }, true);
    this.vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.flyRaf);
      this.follow = false;
      const sx = e.shiftKey ? e.deltaY : e.deltaX;
      const sy = e.shiftKey ? 0 : e.deltaY;
      this.setCam(this.cam.x + sx, this.cam.y + sy);
    }, { passive: false });
    this.vp.addEventListener('mouseover', (e) => {
      const pl = e.target.closest('[data-place]');
      const npc = e.target.closest('[data-npc]');
      if (npc) this.showTip(this.npcTip(npc.dataset.npc), this.npcPos(NPC_BY_ID[npc.dataset.npc]), 46);
      else if (pl) {
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
        this.follow = true;
        this.togglePigMenu(false);
      } else this.keys.delete(k);
      return true;
    }
    if (down && [' ', 'e', 'enter'].includes(k) && !this.locked) {
      const p = this.doorNear(60);
      if (p) {
        this.cb.onEnter(p.id);
        return true;
      }
    }
    return false;
  },

  // The pig can be steered: not busy, not asleep, nothing open over the map.
  // tell: say why not
  canWalk(tell = false) {
    if (this.locked || !this.snap) return false;
    const why = this.snap.busy ? `${this.snap.label.replace(/^在/, '正在')}呢` : this.snap.sleeping ? '在睡觉呢…zzz' : '';
    if (why && tell && Date.now() - (this.toldAt || 0) > 2500) {
      this.toldAt = Date.now();
      this.cb.onBlocked(why);
    }
    return !why;
  },

  lock(on) {
    this.locked = on;
    if (on) this.keys.clear();
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
    if (!this.canWalk() || Math.hypot(this.pos.x - p.entry.x, this.pos.y - p.entry.y) < 30) return this.cb.onEnter(id);
    this.walkTo(p.entry, () => this.cb.onEnter(id));
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
    if (dir) this.actor.querySelector('.a-face').style.transform = `scaleX(${dir})`;
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
          const p = PLACES.find((q) => DOOR_KINDS.includes(q.kind) && Math.abs(x - q.door.x) < 26 && y >= q.door.y - 4 && y - q.door.y < 30);
          if (p) {
            this.keys.clear();
            this.cb.onEnter(p.id);
          }
        }
      }
    }
    if (moving !== this.wasMoving) {
      this.wasMoving = moving;
      if (!this.at?.scene) this.setPoses(moving ? ['walking'] : []);
    }
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
        const bx = clamp(p.x + p.w / 2 - 110, 8, WORLD.w - 228);
        const by = Math.max(8, p.y - 150);
        this.bubble = { x: bx, y: by, room: scene.room };
        document.getElementById('bubbleLayer').innerHTML = `<div class="room-bubble" style="left:${bx}px;top:${by}px">
          <div class="rb-in"></div><i class="rb-tail" style="left:${clamp(p.x + p.w / 2 - bx, 30, 190)}px"></i></div>`;
        this.placePig(bx + room.pig.x, by + room.pig.y);
        this.actor.classList.add('in-room');
        this.setPoses(room.pose ? [room.pose] : []);
        break;
      }
      case 'stand':
        this.placePig(scene.spot.x, scene.spot.y);
        this.setPoses(['working']);
        hold(`<span>${scene.hold}</span>`);
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
      q('.basket').innerHTML = [...Array(scene.stops.length - done.length)].map(() => `<i>${scene.item}</i>`).join('');
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

  // ---------- the menu over the pig ----------

  togglePigMenu(open = !this.menuOpen) {
    this.menuOpen = open;
    const m = document.getElementById('pigMenu');
    if (!open) {
      m.classList.remove('on');
      return;
    }
    const snap = this.snap;
    const btns = [];
    if (snap.busy) btns.push(['cancel', '✕', '不做了']);
    else if (snap.sleeping) btns.push(['wake', '☀️', '起床']);
    else btns.push(['play', '🤸', '玩耍'], ['sleep', '😴', '睡觉'], ['goHome', '🏠', '回家']);
    m.innerHTML = btns.map(([a, ic, t]) => `<button data-action="${a}" title="${t}">${ic}</button>`).join('');
    m.classList.add('on');
  },

  // ---------- the little map in the corner and the big map ----------

  // Shared drawing for both: neighbourhoods, paths and places as tiles
  mapSvg(big) {
    const s = this.snap?.s;
    let svg = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="#dcefc8"/>`;
    for (const d of DISTRICTS) {
      const [x1, y1, x2, y2] = d.rect;
      svg += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="46" fill="${d.color}"/>`;
    }
    for (const r of ROADS) svg += `<path d="${ptsD(r.line)}" stroke="${r.stone ? '#d6cdc2' : '#e4d1aa'}" stroke-width="${big ? 30 : 44}" stroke-linecap="round" fill="none"/>`;
    svg += `<path d="${ptsD(RIVER)}" stroke="#7cc4ea" stroke-width="${RIVER_W * 2}" fill="none"/>`;
    for (const f of [...FIELDS, PASTURE]) svg += `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="10" fill="${f.crop ? '#c9a27a' : '#a9dc8a'}"/>`;
    for (const d of DECOS) svg += `<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="12" fill="#d8d0c6"/>`;
    for (const p of PLACES) {
      const locked = s && p.minLevel && s.level < p.minLevel;
      svg += `<g class="mp ${locked ? 'locked' : ''}" ${big ? `data-mplace="${p.id}"` : ''}>
        <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="18" fill="${p.look?.roofColor || { forest: '#8ce99a', spring: '#d9b48f', site: '#f1dcc0', pavilion: '#69db7c', stage: '#9775fa', plaza: '#f1e3d3', field: '#8ce99a', lake: '#a5d8ff', home: '#ff8fab', houses: '#ffc9c9' }[p.kind]}" opacity="${big ? 0.85 : 1}"/>
        ${big ? `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - 14}" class="mp-ic">${p.icon}</text><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 30}" class="mp-name">${p.name}${locked ? ` 🔒${p.minLevel}` : ''}</text>` : ''}</g>`;
    }
    if (big) for (const d of DISTRICTS) svg += `<text x="${(d.rect[0] + d.rect[2]) / 2}" y="${d.id === 'hills' ? 400 : d.rect[3] - 60}" class="mp-district">${d.name}</text>`;
    return svg;
  },

  drawMinimap() {
    const el = document.getElementById('minimap');
    el.innerHTML = `<svg viewBox="0 0 ${WORLD.w} ${WORLD.h}"><g id="mmBase"></g>
      <rect id="mmView" fill="none" stroke="#e64980" stroke-width="22" rx="20"/><circle id="mmPig" r="44" fill="#ff6b9d" stroke="#fff" stroke-width="16"/></svg>`;
    // clicking it opens the big map, growing out of the corner
    el.addEventListener('click', () => this.cb.onMap());
  },

  updateMinimap() {
    const v = document.getElementById('mmView');
    if (!v) return;
    v.setAttribute('x', this.cam.x);
    v.setAttribute('y', this.cam.y);
    v.setAttribute('width', this.vp.clientWidth);
    v.setAttribute('height', this.vp.clientHeight);
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

  openMap() {
    const el = document.getElementById('mapView');
    el.innerHTML = `<div class="mv-head"><b>🗺️ 猪猪城地图</b><button class="sh-x" data-action="closeMap">✕</button></div>
      <svg viewBox="0 0 ${WORLD.w} ${WORLD.h}" preserveAspectRatio="xMidYMid meet">${this.mapSvg(true)}
        <g transform="translate(${this.pos.x} ${this.pos.y})"><circle r="34" class="mv-pig"/><text y="4" class="mp-ic">🐷</text></g></svg>`;
    el.classList.add('on');
    el.onclick = (e) => {
      const t = e.target.closest('[data-mplace]');
      if (!t) return;
      this.closeMap();
      this.flyToPlace(t.dataset.mplace);
    };
  },

  closeMap() {
    document.getElementById('mapView').classList.remove('on');
  },
};
