// Home window: Pig City. It holds no game state of its own; it renders snapshots pushed from
// the pet window and sends actions back there.

const $ = (id) => document.getElementById(id);

let snap = null;
let sheet = null; // open sheet: a place id or 'settings'
let drawerOpen = false;
let lastKey = '';
let firstTab = new URLSearchParams(location.search).get('tab');

const LOW_STAT = 30;
const fmtCoins = (n) => Math.floor(n).toLocaleString('en-US');

// ---------- top bar ----------

const Hud = {
  init() {
    $('hud').innerHTML = `
      <button class="hud-who" data-action="findPig" title="小猪在哪"><span id="hudAvatar"></span>
        <span class="hud-who-txt"><b id="hudName"></b><span class="hud-sub"><span class="hud-lv" id="hudLv"></span><i class="hud-xp"><i id="hudXp"></i></i></span></span></button>
      <div class="hud-stats">${STATS.map((st) => `<button class="hstat" data-action="stat" data-id="${st.key}" style="--c: var(--st-${st.key})">
        <span class="hs-ic">${st.icon}</span><b data-val="${st.key}"></b><i class="hs-bar"><i data-bar="${st.key}"></i><i class="hs-delta"></i></i></button>`).join('')}</div>
      <div class="hud-right">
        <span class="coins" title="金币">🪙<b id="hudCoins"></b></span>
        <button class="htool" data-action="map" data-tool="map" title="地图 (M)"><span>🗺️</span>地图</button>
        <button class="htool" data-action="friends" data-tool="friends" title="朋友 (F)"><span>💞</span>朋友</button>
        <button class="htool" data-action="bag" data-tool="bag" title="背包 (B)"><span>🎒</span>背包</button>
        <button class="htool icon" data-action="settings" data-tool="settings" title="设置"><span>⚙️</span></button>
        <span class="hud-sep"></span>
        <button class="hwin" data-win="min" title="最小化">${ICON.min}</button>
        <button class="hwin close" data-win="close" title="关闭">${ICON.close}</button>
      </div>`;
    this.pig = new PigSprite($('hudAvatar'), true);
    // the town's clock sits over the minimap, out of the crowded top bar
    const clock = document.createElement('div');
    clock.id = 'townClock';
    clock.title = '猪猪城的时间';
    clock.innerHTML = '<span id="hudClockIc"></span><b id="hudClock"></b>';
    document.querySelector('.window').appendChild(clock);
    setInterval(() => this.clock(), 2000);
  },

  // The town's day and time (its own clock, see TOWN_SPEED), with the sun or the moon
  clock() {
    if (!snap) return;
    const d = townDate();
    const h = d.getHours();
    const text = `周${'日一二三四五六'[d.getDay()]} ${h}:${String(d.getMinutes()).padStart(2, '0')}`;
    const icon = h >= 6 && h < 17 ? '☀️' : h >= 17 && h < 19 ? '🌇' : '🌙';
    if ($('hudClock').textContent !== text) $('hudClock').textContent = text;
    if ($('hudClockIc').textContent !== icon) $('hudClockIc').textContent = icon;
  },

  update() {
    const s = snap.s;
    $('hudName').textContent = s.name;
    $('hudLv').textContent = `Lv.${s.level}`;
    const exp = s.level >= MAX_LEVEL ? 100 : (s.exp / expNeed(s.level)) * 100;
    $('hudXp').style.width = `${exp}%`;
    $('hudCoins').textContent = fmtCoins(s.money);
    this.clock();
    // what's under the pointer may have been redrawn: preview whatever is there now
    if (pvEl && !pvEl.isConnected) pvFrom(document.elementFromPoint(pointer.x, pointer.y));
    this.paintStats();
    this.pig.update(s, snap.sleeping);
    this.tools();
    Status.update();
  },

  // Preview a change on the stat chips: delta like { hunger: 15, mood: -3 } (already including
  // any bonus), or null to stop. A gain shows as a pale stretch of the bar up to the new value,
  // a loss as the part that would go, hatched; the number reads now → after.
  preview(delta) {
    this.pv = delta && Object.values(delta).some((v) => v) ? delta : null;
    if (snap) this.paintStats();
  },

  paintStats() {
    const s = snap.s;
    for (const st of STATS) {
      const v = Math.round(s[st.key]);
      const d = Math.round(this.pv?.[st.key] || 0);
      const to = clamp(v + d, 0, 100);
      const chip = document.querySelector(`.hstat[data-id="${st.key}"]`);
      const num = chip.querySelector('[data-val]');
      // previewing: the value it would become, with a small up or down mark (the bar shows from where)
      const html = to !== v ? `<span class="hs-dir">${to > v ? '▲' : '▼'}</span><em class="${to < LOW_STAT && d < 0 ? 'bad' : ''}">${to}</em>` : `${v}`;
      if (num.innerHTML !== html) num.innerHTML = html;
      chip.querySelector('[data-bar]').style.width = `${Math.min(v, to)}%`;
      const delta = chip.querySelector('.hs-delta');
      delta.style.left = `${Math.min(v, to)}%`;
      delta.style.width = `${Math.abs(to - v)}%`;
      chip.classList.toggle('gain', to > v);
      chip.classList.toggle('loss', to < v);
      chip.classList.toggle('pv', to !== v);
      chip.classList.toggle('low', v < LOW_STAT);
      chip.title = to !== v ? `${st.name} ${v} → ${to}` : `${st.name} ${v}`;
    }
  },

  // the 地图 / 背包 / 设置 buttons look pressed while their panel is open
  tools() {
    const on = { map: mapOpen, bag: drawerOpen, settings: sheet === 'settings', friends: sheet === 'friends' };
    document.querySelectorAll('[data-tool]').forEach((el) => el.classList.toggle('on', !!on[el.dataset.tool]));
  },
};

// Stat previews for anything with data-preview='{"hunger":15,"mood":3}': shown while the
// pointer is over it or it has focus. Any window can add the attribute; this does the rest.
let pvEl = null;
const pointer = { x: -1, y: -1 };
function pvFrom(target) {
  const el = target?.closest?.('[data-preview]') || null;
  if (el === pvEl) return;
  pvEl = el;
  let delta = null;
  try {
    delta = el ? JSON.parse(el.dataset.preview) : null;
  } catch {}
  Hud.preview(delta);
}
document.addEventListener('mousemove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
document.addEventListener('mouseover', (e) => pvFrom(e.target));
document.addEventListener('focusin', (e) => pvFrom(e.target));
document.addEventListener('focusout', (e) => pvFrom(e.relatedTarget));
document.documentElement.addEventListener('mouseleave', () => pvFrom(null));

// The busy or asleep pill floating under the top bar
const Status = {
  update() {
    const el = $('status');
    const a = snap.s.activity;
    document.body.classList.toggle('has-status', !!a);
    if (!a) {
      el.classList.remove('on');
      el.dataset.key = '';
      return;
    }
    const key = `${a.type}:${a.id}:${a.start}:${snap.sleeping}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.classList.toggle('sleep', !!snap.sleeping);
      el.innerHTML = snap.sleeping
        ? `<span class="st-ic" data-action="findPig">😴</span><span class="st-main" data-action="findPig"><b>睡觉中</b><i class="st-bar"><i id="stBar"></i></i></span>
           <span class="st-time" id="stTime"></span><button class="st-btn" data-action="wake">☀️ 叫醒</button>`
        : `<span class="st-ic" data-action="findPig">${activityIcon(a)}</span>
           <span class="st-main" data-action="findPig"><b>${esc(snap.label.replace(/^在/, ''))}</b><i class="st-bar"><i id="stBar"></i></i></span>
           <span class="st-time" id="stTime"></span><button class="st-btn" data-action="cancel">停止</button>`;
      el.classList.add('on');
    }
    // a sleep with no set end has no bar or countdown
    el.classList.toggle('open-ended', !(snap.remain > 0));
    $('stBar').style.width = `${(snap.progress || 0) * 100}%`;
    $('stTime').textContent = snap.remain > 0 ? fmtTime(snap.remain) : '';
  },
};

// ---------- sheets and the bag ----------

// Rebuild only when something the sheet depends on changed
function structKey() {
  const s = snap.s;
  const U = SheetUI;
  if (U.activeGame) return JSON.stringify([sheet, U.activeGame, U.gameSession]);
  return JSON.stringify([
    sheet, drawerOpen, drawerTab, basket, s.inventory, Math.floor(s.money), s.level, s.courses, s.activity && [s.activity.type, s.activity.id],
    snap.sleeping, s.follow, s.mini, s.name, s.wear, s.npc, s.helpReady, s.hobbyReady, s.playDay, s.health >= MIN_HEALTH_TO_ACT, s.album.length, s.fishReady,
    Math.floor(Date.now() / 60000), U.furnTab, U.treeSel, U.schoolStage, U.schoolMajor, U.workFilter, U.armed, U.upd,
    sheet === 'tower' ? [Math.round(s.hunger), Math.round(s.energy)] : 0, gameBlock(snap),
  ]);
}

function renderSheet() {
  const el = $('sheet');
  if (!sheet) {
    el.classList.remove('on');
    City.lock(mapOpen || Interior.open);
    Hud.tools();
    return;
  }
  const { head, body } = sheetHtml(snap, sheet);
  const scroll = el.querySelector('.sh-body')?.scrollTop || 0;
  const same = el.dataset.id === sheet;
  el.dataset.id = sheet;
  el.innerHTML = `${head}<div class="sh-body">${body}</div>`;
  if (same) el.querySelector('.sh-body').scrollTop = scroll;
  el.classList.add('on');
  City.lock(true);
  Hud.tools();
  if (SheetUI.activeGame && $('gameArea')) {
    const id = SheetUI.activeGame;
    // against a neighbour, it's their game and they say how it went
    const duel = sheet === 'duel' && SheetUI.duel;
    // fishing ends with what was caught rather than who won
    const done = (result) => {
      if (id === 'fishing') window.home.act('fish', result);
      else if (duel) window.home.act('duel', `${duel.id}:${id}:${result}`);
      else window.home.act('minigame', `${id}:${result}`);
    };
    MiniGames[id].start($('gameArea'), done);
    if (duel) asOpponent($('gameArea'), NPC_BY_ID[duel.id]);
  }
  // the pig in each photo, as he looked when it was taken
  for (const el of document.querySelectorAll('.photo-pig')) {
    const p = snap.s.album[+el.dataset.i];
    if (p) new PigSprite(el, true).update({ ...snap.s, level: p.lv, look: p.look, wear: p.wear, clean: 100, health: 100 }, false, 'cheerful');
  }
  // the barber's and the beauty parlour's preview pigs
  for (const el of document.querySelectorAll('.look-prev')) {
    const pig = new PigSprite(el, true);
    pig.update(snap.s, false, 'cheerful');
    renderLook(pig.root, { color: el.dataset.color, hair: el.dataset.hair });
  }
  const dh = $('dollhouse');
  if (dh) {
    dh.innerHTML = dollhouseHtml(snap.s, '<div class="dh-sprite"></div>');
    new PigSprite(dh.querySelector('.dh-sprite')).update(snap.s, snap.sleeping);
  }
}

// ---------- the bag drawer: 🎒 what you have, 🛵 跑腿 (delivery from the supermarket) ----------

// the bag's groups, named as the shops name them
const BAG_CATS = ['food', 'hygiene', 'medicine', 'toy', 'fish'].map((id) => [id, SHOP_CATS.find((c) => c.id === id).name]);
const DELIVERY_SHOPS = ['supermarket', 'bakery', 'farm', 'restaurant', 'clinic'];
let drawerTab = (() => {
  try {
    return localStorage.getItem('drawerTab') === 'delivery' ? 'delivery' : 'bag';
  } catch {
    return 'bag';
  }
})();

const bagItems = (s) => ITEMS.filter((it) => s.inventory[it.id] > 0 && BAG_CATS.some(([c]) => c === it.cat));
const STAT_ICON = Object.fromEntries(STATS.map((st) => [st.key, st.icon]));

// What an item would do to the pig right now: each stat's value before and after (0 to 100).
// Food goes further with a kitchen at home, the same as Game.use.
function effectsNow(it, eff = it.effects) {
  const s = snap.s;
  const food = it.cat === 'food' ? homeBonus(s, 'food') : 1;
  return Object.entries(eff).map(([k, v]) => {
    const d = k === 'hunger' ? Math.round(v * food) : v;
    const from = Math.round(s[k]);
    return { k, d, from, to: clamp(from + d, 0, 100) };
  });
}

// the tooltip: every stat it changes, one per line
const effList = (it, eff) => effectsNow(it, eff).map((e) => `${STAT_ICON[e.k]} ${STAT_NAME[e.k]} ${e.from} → ${e.to}`).join('\n');

// on a 跑腿 tile (bought for later, not used now): what it gives, as stat icon and amount
function gainTag(it) {
  const e = effectsNow(it).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  return e ? `<span class="dr-ef" style="--c: var(--st-${e.k})"><i>${STAT_ICON[e.k]}</i><b>${e.d > 0 ? '+' : ''}${e.d}</b></span>` : '';
}
const gainList = (it) => effectsNow(it).map((e) => `${STAT_ICON[e.k]} ${STAT_NAME[e.k]} ${e.d > 0 ? '+' : ''}${e.d}`).join('\n');

// on the tile: the main stat as icon, now → after; muted when it's already full
function effTag(it, eff) {
  const e = effectsNow(it, eff).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  if (!e) return '';
  // already full (or empty, for a cost): just the value, greyed
  if (e.to === e.from) return `<span class="dr-ef full"><i>${STAT_ICON[e.k]}</i>${e.from}</span>`;
  return `<span class="dr-ef" style="--c: var(--st-${e.k})"><i>${STAT_ICON[e.k]}</i>${e.from}<span class="ar">→</span><b>${e.to}</b></span>`;
}

// one tile: icon, name, its main effect (in that stat's colour), and a corner badge
function itemTile(it, { action, eff, badge = '', ok = true, tip = '', extra = '' }) {
  const main = effTag(it, eff);
  // usable now: point at it to see the change on the top bar's stats (a toy also tires the pig)
  const delta = Object.fromEntries(effectsNow(it, eff).map((e) => [e.k, e.d]));
  if (it.cat === 'toy') for (const [k, v] of Object.entries(TOY_COST)) delta[k] = (delta[k] || 0) + v;
  const pv = action === 'use' && ok ? `data-preview="${esc(JSON.stringify(delta))}"` : '';
  return `<button class="dr-item" data-action="${action}" data-id="${it.id}" ${pv} ${ok ? '' : 'disabled'} title="${esc(tip || `${it.name}\n${effList(it, eff)}`)}" ${extra}>
    <span class="dr-ic">${it.icon}</span><span class="dr-nm">${it.name}</span>${main}${badge}</button>`;
}

function groupsHtml(list, tile) {
  return BAG_CATS.map(([cat, name]) => {
    const its = list.filter((it) => it.cat === cat);
    return its.length ? `<div class="dr-grp"><small>${name}</small><div>${its.map(tile).join('')}</div></div>` : '';
  }).join('');
}

function bagHtml(s) {
  const items = bagItems(s);
  if (!items.length) {
    return `<div class="dr-empty"><span>🎒</span><b>背包空空的</b><button class="btn" data-action="drawerTab" data-id="delivery">🛵 跑腿</button></div>`;
  }
  return `<div class="dr-groups">${groupsHtml(items, (it) => {
    let ok = !snap.sleeping;
    let eff = it.effects;
    let badge = `<span class="dr-ct">${s.inventory[it.id]}</span>`;
    if (it.cat === 'toy') {
      const wait = minutesLeft(s.toyReady[it.id]);
      const fun = toyFun(s, it.id);
      eff = { mood: Math.round(it.effects.mood * fun) };
      badge = wait > 0 ? `<span class="dr-ct cd">⏱️${Math.ceil(wait)}</span>` : '';
      ok = ok && !snap.busy && wait <= 0;
    }
    if (it.cat === 'fish') return itemTile(it, { action: 'use', eff: {}, badge, tip: it.name });
    return itemTile(it, { action: 'use', eff, badge, ok, extra: it.cat === 'toy' && !ok ? 'data-cool' : '' });
  })}</div>`;
}

// 跑腿: tap a tile to put one in the basket, − or right-click to take one out; the bill and
// 下单 at the bottom. The basket lives only here, never in the save.
const basket = {};
const basketCount = () => Object.values(basket).reduce((n, k) => n + k, 0);

function deliveryHtml(s) {
  const shops = DELIVERY_SHOPS.map((id) => PLACE_BY_ID[id]).filter(Boolean);
  const tiles = groupsHtml(deliveryItems(), (it) => {
    const n = basket[it.id] || 0;
    return `<div class="dr-item order ${n ? 'in' : ''}" data-action="basketAdd" data-id="${it.id}" title="${esc(`${it.name}\n${gainList(it)}\n右键减一个`)}">
      <span class="dr-ic">${it.icon}</span>${gainTag(it)}<span class="dr-cost">🪙${it.price}</span>
      ${n ? `<span class="dr-ct">${n}</span><button class="dr-minus" data-action="basketSub" data-id="${it.id}" title="减一个">−</button>` : ''}</div>`;
  });
  const bill = deliveryBill(basket);
  const ok = bill.goods > 0 && s.money >= bill.total;
  return `<div class="dr-groups">${tiles}</div>
  <div class="dr-foot">
    <div class="dr-shops"><small>去店里买更便宜</small>${shops.map((p) => `<button class="dr-shop" data-action="goto" data-id="${p.id}" title="${p.name}">${p.icon} ${p.name}</button>`).join('')}</div>
    <div class="dr-bill">${bill.goods ? `<span>商品 🪙${bill.goods}</span><span>配送费 🪙${bill.fee}</span>
      <b class="${ok ? '' : 'short'}">合计 🪙${bill.total}</b>` : ''}<button class="btn" data-action="checkout" ${ok ? '' : 'disabled'}>下单</button></div>
  </div>`;
}

function renderDrawer() {
  const el = $('drawer');
  el.classList.toggle('on', drawerOpen);
  document.body.classList.toggle('bag-open', drawerOpen);
  if (!drawerOpen) return;
  const s = snap.s;
  const n = bagItems(s).reduce((t, it) => t + s.inventory[it.id], 0);
  const tab = (id, label) => `<button class="dr-tab ${drawerTab === id ? 'on' : ''}" data-action="drawerTab" data-id="${id}">${label}</button>`;
  el.innerHTML = `<div class="dr-head">${tab('bag', `🎒 背包${n ? ` <small>${n}</small>` : ''}`)}${tab('delivery', `🛵 跑腿${basketCount() ? ` <small>${basketCount()}</small>` : ''}`)}
      <button class="dr-x" data-action="closeSheet" title="关上 (Esc)">${ICON.close}</button></div>
    <div class="dr-body">${drawerTab === 'delivery' ? deliveryHtml(s) : bagHtml(s)}</div>`;
}

// Open the drawer: on a given tab, or 跑腿 when the bag is empty, or the last tab
function openBag(tab) {
  closeMap();
  sheet = null;
  drawerOpen = true;
  setDrawerTab(tab || (bagItems(snap.s).length ? drawerTab : 'delivery'));
}

function setDrawerTab(id) {
  drawerTab = id;
  try {
    localStorage.setItem('drawerTab', id);
  } catch {}
  lastKey = '';
  update();
}


function update() {
  if (!snap) return;
  Hud.update();
  City.update(snap);
  Interior.update(snap);
  const key = structKey();
  if (key !== lastKey) {
    lastKey = key;
    renderSheet();
    renderDrawer();
  }
}

function openSheet(id) {
  const p = PLACE_BY_ID[id];
  if (p?.minLevel && snap.s.level < p.minLevel) {
    toast({ msg: `${p.name} Lv.${p.minLevel} 开放`, ok: false });
    City.inside = null;
    return;
  }
  if (id !== sheet) {
    SheetUI.activeGame = null;
    if (p?.sheet === 'school') {
      SheetUI.treeSel = null;
      SheetUI.schoolStage = null;
    }
  }
  sheet = id;
  drawerOpen = false;
  City.togglePigMenu(false);
  lastKey = '';
  update();
  if (id === 'settings') refreshUpdateInfo();
}

function closeAll() {
  sheet = null;
  closeMap();
  drawerOpen = false;
  SheetUI.activeGame = null;
  SheetUI.duel = null;
  City.togglePigMenu(false);
  lastKey = '';
  update();
}

function refreshUpdateInfo() {
  window.home.updateStatus().then((info) => {
    SheetUI.upd = { ...SheetUI.upd, info };
    update();
  });
}

// Old page names (tray menu, right-click on the pet) mapped to places
function openTab(tab) {
  const to = TAB_TO_PLACE[tab];
  if (tab === 'school') {
    const lv = snap.s.level;
    return LOCAL.goto(lv >= 18 ? 'college' : lv >= 12 ? 'middle' : 'primary');
  }
  if (to === 'bag') {
    closeAll();
    return openBag();
  }
  if (to === 'settings') return openSheet(to);
  if (to) return LOCAL.goto(to);
  closeAll();
  City.findPig();
}

let mapOpen = false;
function openMap() {
  closeAll();
  mapOpen = true;
  document.body.classList.add('map-open');
  City.lock(true);
  City.openMap();
  Hud.tools();
}

function closeMap() {
  if (!mapOpen) return;
  mapOpen = false;
  document.body.classList.remove('map-open');
  City.closeMap();
  City.lock(!!sheet || Interior.open);
  Hud.tools();
}

// Toasts: white cards at the top, up to three stacked, each gone after a few seconds
const TOAST_MS = 2800;
function toast({ msg, ok, fx, talk }) {
  // what a neighbour said: over their head in town, in the game against them, or else a toast
  if (talk && !onTalk(talk) && talk.line) toast({ msg: `${NPC_BY_ID[talk.id].name}：${talk.line}`, ok: true });
  if (!msg) return;
  const box = $('toasts');
  const kind = ok === false ? 'bad' : /升级|Lv\.\d/.test(msg) ? 'star' : 'ok';
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  // the icon: ⭐ for a level-up, ! for a failure, else the result's own emoji (its first one), or none
  const own = fx ? [...new Intl.Segmenter().segment(String(fx))][0]?.segment : '';
  const icon = { bad: '!', star: '⭐' }[kind] || (own && /\p{Extended_Pictographic}/u.test(own) ? own : '');
  el.innerHTML = `${icon ? `<span class="t-ic"></span>` : ''}<span class="t-msg"></span>`;
  if (icon) el.querySelector('.t-ic').textContent = icon;
  el.querySelector('.t-msg').textContent = msg;
  // the same message again: just bring it back to the top
  for (const old of box.children) if (old.querySelector('.t-msg').textContent === msg) old.remove();
  box.prepend(el);
  while (box.children.length > 3) box.lastElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, TOAST_MS);
}

function onTalk(t) {
  if (t.duel) {
    if (SheetUI.duel?.id !== t.id) return false;
    SheetUI.duel.line = t.line;
    const el = document.querySelector('#sheet .duel-line');
    if (el) el.textContent = t.line;
    return true;
  }
  const shown = Interior.onTalk(t) || City.onTalk(t);
  if (t.together === 'play') openDuel(t.id, t.line);
  return shown;
}

// The games are written against the pig: in a game against a neighbour, their name and
// emoji go wherever the pig's would be
function asOpponent(area, n) {
  const swap = () => {
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode());) {
      if (/小猪|🐷/.test(t.data)) t.data = t.data.replace(/小猪/g, n.name).replace(/🐷/g, n.icon);
    }
  };
  swap();
  new MutationObserver(swap).observe(area, { childList: true, subtree: true, characterData: true });
}

// A mini game against a neighbour: their own game, with them across the board
function openDuel(id, line) {
  closeAll();
  sheet = 'duel';
  SheetUI.duel = { id, line };
  SheetUI.activeGame = NPC_BY_ID[id].game;
  SheetUI.gameSession++;
  lastKey = '';
  update();
}

// ---------- actions ----------

// UI-only actions handled here; everything else goes to the pet window
const LOCAL = {
  open: (id) => openSheet(id),
  // somewhere else in town: close up and look at it on the map (the pig has to walk there)
  goto: (id) => {
    closeAll();
    City.flyToPlace(id);
  },
  map: () => (mapOpen ? closeMap() : openMap()),
  friends: () => (sheet === 'friends' ? closeAll() : openSheet('friends')),
  // go and find someone; from a sheet, close it first
  findNpc: (id) => {
    closeAll();
    City.findNpc(id);
  },
  // someone in the place the pig is in (a face on its banner) comes out to talk
  callOut: (id) => {
    const place = sheet;
    closeAll();
    if (npcAtWork(id)) City.meetNpc(id);
    else City.callOut(id, place);
  },
  closeMap,
  closeSheet: closeAll,
  settings: () => (sheet === 'settings' ? closeAll() : openSheet('settings')),
  bag: () => {
    if (drawerOpen) closeAll();
    else openBag();
  },
  drawerTab: (id) => setDrawerTab(id),
  basketAdd: (id) => {
    basket[id] = (basket[id] || 0) + 1;
    update();
  },
  basketSub: (id) => {
    if (!basket[id]) return;
    if (--basket[id] <= 0) delete basket[id];
    update();
  },
  // pay for the basket: everything goes into the bag, so show the bag to eat right away
  checkout: () => {
    const list = Object.entries(basket).map(([id, k]) => `${id}:${k}`).join(',');
    if (!list) return;
    window.home.act('order', list);
    for (const id of Object.keys(basket)) delete basket[id];
    setDrawerTab('bag');
  },
  // hungry: the 跑腿 tab brings food right here; the other stats show where to fix them
  stat: (key) => (key === 'hunger' ? openBag('delivery') : LOCAL.goto(STAT_PLACE[key])),
  findPig: () => {
    closeAll();
    City.findPig();
  },
  goHome: () => {
    City.togglePigMenu(false);
    if (City.canWalk(true)) City.walkTo(PLACE_BY_ID.home.entry);
  },
  album: () => openSheet('album'),
  furnTab: (id) => { SheetUI.furnTab = id; update(); },
  checkUpdate: async () => {
    SheetUI.upd = { ...SheetUI.upd, busy: true };
    update();
    const info = await window.home.checkUpdate();
    SheetUI.upd = { info, busy: false, checked: true };
    update();
  },
  applyUpdate: async () => {
    const info = await window.home.applyUpdate();
    SheetUI.upd = { ...SheetUI.upd, info };
    update();
  },
  focus: (id, data) => {
    SheetUI.treeDir = data.dir || '';
    SheetUI.treeSel = id;
    SheetUI.schoolStage = COURSE_BY_ID[id].stage;
    update();
  },
  // show a stage (and major, at university) and focus its first course still to learn
  stage: (id) => {
    const list = COURSES.filter((c) => c.stage === id && (!c.major || c.major === SheetUI.schoolMajor));
    SheetUI.schoolStage = id;
    SheetUI.treeSel = (list.find((c) => !snap.s.courses[c.id]) || list[0]).id;
    SheetUI.treeDir = '';
    update();
  },
  major: (id) => {
    SheetUI.schoolMajor = id;
    LOCAL.stage(SheetUI.schoolStage);
  },
  workFilter: (id) => { SheetUI.workFilter = id; update(); },
  games: () => {
    // after a game against a neighbour, 返回 goes back to town
    if (sheet === 'duel') return closeAll();
    SheetUI.activeGame = null;
    update();
  },
  game: (id) => {
    const why = gameBlock(snap);
    if (why) return toast({ msg: why, ok: false });
    SheetUI.activeGame = id;
    SheetUI.gameSession++;
    update();
  },
  rename: () => window.home.act('rename', $('nameInput').value),
};

document.addEventListener('click', (e) => {
  const win = e.target.closest('[data-win]');
  if (win) return win.dataset.win === 'min' ? window.home.minimize() : window.home.close();

  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, id } = el.dataset;
  if (el.closest('#pigMenu')) City.togglePigMenu(false);
  if (LOCAL[action]) return LOCAL[action](id, el.dataset);
  // these take a second tap to be sure
  if (['reset', 'rejuvenate', 'switchPig'].includes(action)) {
    const key = `${action}:${id || ''}`;
    if (SheetUI.armed !== key) {
      SheetUI.armed = key;
      update();
      setTimeout(() => {
        if (SheetUI.armed !== key) return;
        SheetUI.armed = '';
        update();
      }, 3000);
      return;
    }
    SheetUI.armed = '';
  }
  // eating, playing with a toy or washing: the pig acts it out where it is
  if (action === 'use' && ITEM_BY_ID[id] && ['food', 'toy', 'hygiene', 'medicine'].includes(ITEM_BY_ID[id].cat)) {
    (Interior.open ? Interior : City).react(ITEM_BY_ID[id]);
  }
  window.home.act(action, id);
});

// right-click a 跑腿 tile: take one back out of the basket
document.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('.dr-item.order');
  if (!el) return;
  e.preventDefault();
  LOCAL.basketSub(el.dataset.id);
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Enter' && e.target.id === 'nameInput') window.home.act('rename', e.target.value);
    return;
  }
  if (Story.open) {
    if (Story.key(e)) e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    if (City.talk) City.endTalk();
    else if (sheet || drawerOpen || mapOpen) closeAll();
    else if (Interior.talk) Interior.endTalk();
    else if (Interior.open) Interior.leave();
    else window.home.close();
    return;
  }
  if (e.key.toLowerCase() === 'm' && !sheet) return LOCAL.map();
  if (e.key.toLowerCase() === 'b' && !sheet && !mapOpen) return LOCAL.bag();
  if (e.key.toLowerCase() === 'f' && (!sheet || sheet === 'friends') && !mapOpen && !Interior.open) return LOCAL.friends();
  const handled = Interior.open ? !sheet && !mapOpen && Interior.key(e, true) : City.key(e, true);
  if (handled) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  City.key(e, false);
  Interior.key(e, false);
});
window.addEventListener('blur', () => {
  City.keys.clear();
  Interior.keys.clear();
});

// Going home: inside the house you walk about the rooms yourself
function enterHome() {
  closeAll();
  City.lock(true);
  document.body.classList.add('indoors');
  Interior.enter(snap);
}

// Knocking on someone's door: in if they've asked the pig round and are up; else a word through
// the door, or nobody answers
function knock(id) {
  const door = visitDoor(snap.s, id);
  if (door === 'away') return City.shrug();
  if (door !== 'open') return City.doorSay(id, NPC_VISITS[id].knock[door]);
  closeAll();
  City.lock(true);
  document.body.classList.add('indoors');
  Interior.enter(snap, visitHome(id, snap.s));
}

Hud.init();
City.init({
  onEnter: (id) => (id === 'home' ? enterHome() : openSheet(id)),
  onKnock: knock,
  onSay: (id, line) => toast({ msg: `${NPC_BY_ID[id].name}：${line}`, ok: true }),
  act: (action, id) => window.home.act(action, id),
  onBlocked: (msg) => toast({ msg, ok: false }),
  onMap: () => LOCAL.map(),
});
Interior.init({
  // out of someone's house: back on their doorstep, maybe with a little something from them
  onLeave: (visited) => {
    document.body.classList.remove('indoors');
    closeAll();
    City.lock(false);
    if (visited) {
      City.placePig(HOMES[visited.host].entry.x, HOMES[visited.host].entry.y);
      City.follow = true;
      window.home.act('farewell', visited.host);
    }
  },
  act: (action, id) => window.home.act(action, id),
  onBlocked: (msg) => toast({ msg, ok: false }),
  // using furniture: open the wardrobe or the study, the bag at the kitchen, or just do it
  onUse: (act, id) => {
    if (act === 'open') return openSheet(id);
    if (act === 'bag') return LOCAL.bag();
    window.home.act(act, id);
  },
});
window.home.onState((s) => {
  // another pig now (the potion, or one taken back out): start over from the town
  if (snap && snap.s.pigId !== s.s.pigId) {
    if (Interior.open) Interior.leave();
    snap = s;
    TOWN_SAVE = s.s;
    closeAll();
  }
  snap = s;
  TOWN_SAVE = s.s;
  update();
  if (firstTab) {
    const tab = firstTab;
    firstTab = null;
    openTab(tab);
  }
});
window.home.onToast(toast);
window.home.onTab((tab) => snap && openTab(tab));
window.home.ready();
refreshUpdateInfo();

// for test scripts: open any sheet, or show any scene without doing it for real
window.__city = { open: openSheet, openTab, City, Interior, Story, enterHome, openDuel, LOCAL };
