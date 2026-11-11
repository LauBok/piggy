// Home window: Pig City. It holds no game state of its own; it renders snapshots pushed from
// the pet window and sends actions back there.

const $ = (id) => document.getElementById(id);

let snap = null;
let sheet = null; // open sheet: a place id or 'settings'
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
    const clock = document.createElement('button');
    clock.id = 'townClock';
    clock.dataset.action = 'calendar';
    clock.title = '日历';
    clock.innerHTML = '<span id="hudClockIc"></span><b id="hudClock"></b>';
    document.querySelector('.window').appendChild(clock);
    // often enough that a night in bed (a town minute each second) ticks by evenly
    setInterval(() => this.clock(), 250);
  },

  // The town's day and time (its own clock, see TOWN_SPEED), with the sun or the moon
  clock() {
    if (!snap) return;
    const d = townDate();
    const h = d.getHours();
    const c = calOf(d.getTime());
    const text = `${SEASON_NAMES[c.season]}${c.day}日 周${'日一二三四五六'[d.getDay()]} ${h}:${String(d.getMinutes()).padStart(2, '0')}`;
    const icon = h >= 6 && h < 17 ? '☀️' : h >= 17 && h < 19 ? '🌇' : '🌙';
    if ($('hudClock').textContent !== text) $('hudClock').textContent = text;
    if ($('hudClockIc').textContent !== icon) $('hudClockIc').textContent = icon;
  },

  update() {
    const s = snap.s;
    $('hudName').textContent = s.name;
    $('hudLv').textContent = `Lv.${s.level}`;
    const max = s.level >= MAX_LEVEL;
    const exp = max ? 100 : (s.exp / expNeed(s.level)) * 100;
    $('hudXp').style.width = `${exp}%`;
    // the numbers behind the bar, on hover
    document.querySelector('.hud-sub').title = max ? '经验 满级' : `经验 ${Math.floor(s.exp)} / ${expNeed(s.level)}`;
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
    const on = { map: mapOpen, bag: sheet === 'bag', settings: sheet === 'settings', friends: sheet === 'friends' };
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
    sheet, SheetUI.bagCat, basket, s.inventory, Math.floor(s.money), s.level, s.courses, s.activity && [s.activity.type, s.activity.id],
    snap.sleeping, s.follow, s.mini, s.name, s.wear, s.npc, s.helpReady, s.hobbyReady, s.playDay, s.health >= MIN_HEALTH_TO_ACT, s.album.length, s.fishReady,
    Math.floor(Date.now() / 60000), U.furnTab, U.calSeason, City.mate && [City.mate.id, !!City.mate.busy], U.treeSel, U.schoolStage, U.schoolMajor, U.workFilter, U.armed, U.upd,
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

// ---------- the bag: its groups down the left, what's in the open one on the right, and
// 🛵 跑腿 (delivery from the supermarket) as the last group ----------

// the bag's groups, named as the shops name them
const BAG_CATS = ['food', 'hygiene', 'medicine', 'toy', 'seasoning', 'fish'].map((id) => SHOP_CATS.find((c) => c.id === id));
const DELIVERY_SHOPS = ['supermarket', 'bakery', 'farm', 'restaurant', 'clinic'];
SheetUI.bagCat = (() => {
  try {
    return localStorage.getItem('bagCat') || 'food';
  } catch {
    return 'food';
  }
})();

const bagItems = (s) => ITEMS.filter((it) => s.inventory[it.id] > 0 && BAG_CATS.some((c) => c.id === it.cat));
const bagCount = (s, cat) => bagItems(s).filter((it) => it.cat === cat).reduce((t, it) => t + s.inventory[it.id], 0);
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

// on a 跑腿 tile (bought for later, not used now): what it gives, as stat icon and amount
function gainTag(it) {
  const e = effectsNow(it).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  return e ? `<span class="dr-ef" style="--c: var(--st-${e.k})"><i>${STAT_ICON[e.k]}</i><b>${e.d > 0 ? '+' : ''}${e.d}</b></span>` : '';
}
const gainList = (it) => effectsNow(it).map((e) => `${STAT_ICON[e.k]} ${STAT_NAME[e.k]} ${e.d > 0 ? '+' : ''}${e.d}`).join('\n');

function groupsHtml(list, tile) {
  return BAG_CATS.map(({ id, name }) => {
    const its = list.filter((it) => it.cat === id);
    return its.length ? `<div class="dr-grp"><small>${name}</small><div>${its.map(tile).join('')}</div></div>` : '';
  }).join('');
}

// One thing in the bag: what it does to the pig now, and 使用 (or why not)
function bagRow(s, it) {
  // fish and seasonings aren't used on their own: no 使用
  const fish = ['fish', 'seasoning'].includes(it.cat);
  let fx = Object.fromEntries(effectsNow(it).map((e) => [e.k, e.d]));
  let why = snap.sleeping ? '在睡觉' : '';
  if (it.cat === 'toy') {
    fx = { mood: Math.round(it.effects.mood * toyFun(s, it.id)) };
    for (const [k, v] of Object.entries(TOY_COST)) fx[k] = (fx[k] || 0) + v;
    const wait = minutesLeft(s.toyReady[it.id]);
    if (!why && snap.busy) why = busyWhy(snap);
    if (!why && wait > 0) why = `${Math.ceil(wait)} 分钟后`;
  }
  return `<div class="card bag-row ${why ? 'off' : ''}"${fish || why ? '' : preview(fx)}>
    <div class="bag-ic">${it.icon}</div>
    <div class="bag-m"><b>${it.name}<em>×${s.inventory[it.id]}</em></b><div class="chips">${fish ? '' : changes(s, fx)}</div></div>
    ${fish ? '' : `<div class="bag-act">${why ? `<small class="why">${why}</small>` : ''}<button class="btn primary" data-action="use" data-id="${it.id}" ${why ? 'disabled' : ''}>使用</button></div>`}</div>`;
}

function bagPage(snap) {
  const s = snap.s;
  const cat = SheetUI.bagCat;
  const tab = (id, icon, name, n) => `<button class="bag-tab ${cat === id ? 'on' : ''}" data-action="bagCat" data-id="${id}"><span>${icon}</span>${name}${n ? `<em>${n}</em>` : ''}</button>`;
  const nav = BAG_CATS.map((c) => tab(c.id, c.icon, c.name, bagCount(s, c.id))).join('') + tab('delivery', '🛵', '跑腿', basketCount());
  let list;
  if (cat === 'delivery') list = deliveryHtml(s);
  else {
    const items = bagItems(s).filter((it) => it.cat === cat);
    list = items.length ? items.map((it) => bagRow(s, it)).join('') : `<div class="sheet-empty"><div class="empty-ic">${SHOP_CATS.find((c) => c.id === cat).icon}</div></div>`;
  }
  return `<div class="bag-page"><nav class="bag-nav">${nav}</nav><div class="bag-list">${list}</div></div>`;
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

// Open the bag: on a given group, or the last one if it still has something, or else the first
// group with anything in it (跑腿 when the bag is empty)
function openBag(cat) {
  closeMap();
  const s = snap.s;
  if (!cat) {
    cat = SheetUI.bagCat;
    if (cat !== 'delivery' && !bagCount(s, cat)) cat = BAG_CATS.find((c) => bagCount(s, c.id))?.id || 'delivery';
  }
  setBagCat(cat);
  openSheet('bag');
}

function setBagCat(id) {
  SheetUI.bagCat = id;
  try {
    localStorage.setItem('bagCat', id);
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
  City.togglePigMenu(false);
  lastKey = '';
  update();
  if (id === 'settings') refreshUpdateInfo();
}

function closeAll() {
  sheet = null;
  closeMap();
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
    if (sheet === 'bag') closeAll();
    else openBag();
  },
  bagCat: (id) => setBagCat(id),
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
    const first = ITEM_BY_ID[Object.keys(basket)[0]];
    for (const id of Object.keys(basket)) delete basket[id];
    setBagCat(first.cat);
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
  // sleep is in bed at home: walk home, go in, and lie down
  bedtime: () => {
    City.togglePigMenu(false);
    if (Interior.open && Interior.own) return window.home.act('sleep');
    if (!City.canWalk(true)) return;
    City.walkTo(PLACE_BY_ID.home.entry, () => {
      City.enter('home');
      window.home.act('sleep');
    });
  },
  album: () => openSheet('album'),
  furnTab: (id) => { SheetUI.furnTab = id; update(); },
  calSeason: (id) => { SheetUI.calSeason = id; update(); },
  // the friend who walked in with the pig comes along to it
  helpWith: (id, ds) => {
    const together = City.withMate(ds.kind, id);
    if (together) window.home.act('together', together);
  },
  calendar: () => {
    if (sheet === 'calendar') return closeAll();
    SheetUI.calSeason = null;
    openSheet('calendar');
  },
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
    else if (sheet || mapOpen) closeAll();
    else if (Interior.talk) Interior.endTalk();
    else if (Interior.open) Interior.leave();
    else window.home.close();
    return;
  }
  if (e.key.toLowerCase() === 'm' && !sheet) return LOCAL.map();
  if (e.key.toLowerCase() === 'b' && (!sheet || sheet === 'bag') && !mapOpen) return LOCAL.bag();
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
  // going somewhere from the map while indoors: step out first
  goOut: () => Interior.open && Interior.leave(),
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
  // fallen asleep because nobody's around: he goes home to bed by himself
  const auto = (x) => x?.s.activity?.type === 'sleep' && x.s.activity.auto;
  if (auto(s) && !auto(snap) && !(Interior.open && Interior.own)) {
    snap = s;
    TOWN_SAVE = s.s;
    if (Interior.open) Interior.leave();
    closeAll();
    City.placePig(PLACE_BY_ID.home.entry.x, PLACE_BY_ID.home.entry.y);
    City.enter('home');
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
