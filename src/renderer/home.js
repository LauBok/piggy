// Home window: Pig City. It holds no game state of its own; it renders snapshots pushed from
// the pet window and sends actions back there.

const $ = (id) => document.getElementById(id);

let snap = null;
let sheet = null; // open sheet: a place id or 'settings'
let drawerOpen = false;
let lastKey = '';
let firstTab = new URLSearchParams(location.search).get('tab');

const ringSvg = (key, color, r = 15) => `<svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${r}"/>
  <circle class="val" cx="20" cy="20" r="${r}" pathLength="100" stroke="${color}" data-ring="${key}" transform="rotate(-90 20 20)"/></svg>`;

// ---------- top bar ----------

const Hud = {
  init() {
    $('hud').innerHTML = `
      <button class="hud-pig" data-action="findPig" title="小猪在哪"><div id="hudAvatar"></div>${ringSvg('exp', '#ffa94d', 18)}<span class="hud-lv" id="hudLv"></span></button>
      <div class="hud-name"><b id="hudName"></b><small id="hudTitle"></small></div>
      <div class="hud-stats">${STATS.map((st) => `<button class="hstat" data-action="stat" data-id="${st.key}" data-warn="${st.key}">
        ${ringSvg(st.key, st.color)}<span>${st.icon}</span><em data-val="${st.key}"></em></button>`).join('')}</div>
      <div class="hud-act" id="hudAct"></div>
      <div class="hud-right">
        <span class="coins">🪙 <b data-val="money"></b></span>
        <button class="hbtn" data-action="map" title="地图 (M)">🗺️</button>
        <button class="hbtn" data-action="bag" title="背包">🎒</button>
        <button class="hbtn" data-action="settings" title="设置">⚙️</button>
        <button class="hbtn win" data-win="min" title="最小化">─</button>
        <button class="hbtn win" data-win="close" title="关闭">✕</button>
      </div>`;
    this.pig = new PigSprite($('hudAvatar'), true);
  },

  update() {
    const s = snap.s;
    $('hudName').textContent = s.name;
    $('hudTitle').textContent = educationTitle(s);
    $('hudLv').textContent = s.level;
    const exp = s.level >= MAX_LEVEL ? 100 : (s.exp / expNeed(s.level)) * 100;
    document.querySelector('[data-ring="exp"]').setAttribute('stroke-dasharray', `${exp} 100`);
    for (const st of STATS) document.querySelector(`[data-ring="${st.key}"]`).setAttribute('stroke-dasharray', `${s[st.key]} 100`);
    document.querySelectorAll('[data-val]').forEach((el) => (el.textContent = Math.round(s[el.dataset.val])));
    document.querySelectorAll('[data-warn]').forEach((el) => el.classList.toggle('warn', s[el.dataset.warn] < 30));
    this.pig.update(s, snap.sleeping);

    // the activity capsule, only while busy or asleep
    const act = $('hudAct');
    const a = s.activity;
    if (!a) {
      act.classList.remove('on');
      act.dataset.key = '';
      return;
    }
    const key = `${a.type}:${a.id}:${a.start}`;
    if (act.dataset.key !== key) {
      act.dataset.key = key;
      act.innerHTML = snap.sleeping
        ? `<span class="ha-ic" data-action="findPig">😴</span><span class="ha-main" data-action="findPig"><b>睡觉中</b></span><button data-action="wake" title="叫醒">☀️</button>`
        : `<span class="ha-ic" data-action="findPig">${activityIcon(a)}</span>
           <span class="ha-main" data-action="findPig"><b>${esc(snap.label.replace(/^在/, ''))}</b><i class="ha-bar"><i id="haBar"></i></i></span>
           <span class="ha-time" id="haTime"></span><button data-action="cancel" title="不做了">✕</button>`;
      act.classList.add('on');
    }
    if ($('haBar')) $('haBar').style.width = `${snap.progress * 100}%`;
    if ($('haTime')) $('haTime').textContent = fmtTime(snap.remain);
  },
};

// ---------- sheets and the bag ----------

// Rebuild only when something the sheet depends on changed
function structKey() {
  const s = snap.s;
  const U = SheetUI;
  if (U.activeGame) return JSON.stringify([sheet, U.activeGame, U.gameSession]);
  return JSON.stringify([
    sheet, drawerOpen, s.inventory, Math.floor(s.money), s.level, s.courses, s.activity && [s.activity.type, s.activity.id],
    snap.sleeping, s.follow, s.mini, s.name, s.wear, s.npc, s.helpReady, s.hobbyReady, s.playDay, s.health >= MIN_HEALTH_TO_ACT,
    Math.floor(Date.now() / 60000), U.furnTab, U.treeSel, U.schoolStage, U.schoolMajor, U.workFilter, U.resetArmed, U.upd,
    sheet === 'tower' ? [Math.round(s.hunger), Math.round(s.energy)] : 0, gameBlock(snap),
  ]);
}

function renderSheet() {
  const el = $('sheet');
  if (!sheet) {
    el.classList.remove('on');
    City.lock(mapOpen || Interior.open);
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
  if (SheetUI.activeGame && $('gameArea')) {
    const id = SheetUI.activeGame;
    MiniGames[id].start($('gameArea'), (result) => window.home.act('minigame', `${id}:${result}`));
  }
  // the salon's preview pigs
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

function renderDrawer() {
  const el = $('drawer');
  el.classList.toggle('on', drawerOpen);
  if (!drawerOpen) return;
  const s = snap.s;
  const items = ITEMS.filter((it) => s.inventory[it.id] > 0 && ['food', 'hygiene', 'medicine', 'toy'].includes(it.cat));
  if (!items.length) {
    el.innerHTML = `<div class="dr-empty">🎒 空空的 <button class="btn ghost" data-action="open" data-id="bakery">🍞 面包房</button></div>`;
    return;
  }
  el.innerHTML = `<div class="dr-row">${items.map((it) => {
    let sub = `×${s.inventory[it.id]}`;
    let ok = !snap.sleeping;
    if (it.cat === 'toy') {
      const wait = minutesLeft(s.toyReady[it.id]);
      sub = wait > 0 ? `⏱${Math.ceil(wait)}` : toyFun(s, it.id) < 0.5 ? '😑' : '';
      ok = ok && !snap.busy && wait <= 0;
    }
    const eff = it.cat === 'toy' ? { mood: Math.round(it.effects.mood * toyFun(s, it.id)) } : it.effects;
    const tip = `${it.name} ${Object.entries(eff).map(([k, v]) => `${STAT_NAME[k]}${v > 0 ? '+' : ''}${v}`).join(' ')}`;
    return `<button class="dr-item" data-action="use" data-id="${it.id}" ${ok ? '' : 'disabled'} title="${esc(tip)}"><span>${it.icon}</span><small>${sub}</small></button>`;
  }).join('')}</div>`;
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
    drawerOpen = true;
    lastKey = '';
    return update();
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
  City.lock(true);
  City.openMap();
}

function closeMap() {
  if (!mapOpen) return;
  mapOpen = false;
  City.closeMap();
  City.lock(!!sheet || Interior.open);
}

let toastTimer;
function toast({ msg, ok }) {
  // a neighbour talking: say it in their speech bubble on the map instead
  const n = NPCS.find((x) => msg.startsWith(`${x.name}：`));
  if (n) {
    City.npcSay(n.id, msg.slice(n.name.length + 1));
    return;
  }
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', !ok);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
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
  closeMap,
  closeSheet: closeAll,
  settings: () => (sheet === 'settings' ? closeAll() : openSheet('settings')),
  bag: () => {
    drawerOpen = !drawerOpen;
    if (drawerOpen) sheet = null;
    lastKey = '';
    update();
  },
  stat: (key) => LOCAL.goto(STAT_PLACE[key]),
  findPig: () => {
    closeAll();
    City.findPig();
  },
  goHome: () => {
    City.togglePigMenu(false);
    if (City.canWalk(true)) City.walkTo(PLACE_BY_ID.home.entry);
  },
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
  games: () => { SheetUI.activeGame = null; update(); },
  game: (id) => {
    const why = gameBlock(snap);
    if (why) return toast({ msg: why, ok: false });
    SheetUI.activeGame = id;
    SheetUI.gameSession++;
    update();
  },
  rename: () => window.home.act('rename', $('nameInput').value),
};

function onNpc(id) {
  const s = snap.s;
  const wish = npcWish(id);
  if (wish && !wishDone(s, id) && s.inventory[wish]) window.home.act('give', id);
  else window.home.act('greet', id);
}

document.addEventListener('click', (e) => {
  const win = e.target.closest('[data-win]');
  if (win) return win.dataset.win === 'min' ? window.home.minimize() : window.home.close();

  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, id } = el.dataset;
  if (el.closest('#pigMenu')) City.togglePigMenu(false);
  if (LOCAL[action]) return LOCAL[action](id, el.dataset);
  if (action === 'reset' && !SheetUI.resetArmed) {
    SheetUI.resetArmed = true;
    update();
    setTimeout(() => {
      SheetUI.resetArmed = false;
      update();
    }, 3000);
    return;
  }
  if (action === 'reset') SheetUI.resetArmed = false;
  // eating, playing with a toy or washing: the pig acts it out where it is
  if (action === 'use' && ITEM_BY_ID[id] && ['food', 'toy', 'hygiene', 'medicine'].includes(ITEM_BY_ID[id].cat)) {
    (Interior.open ? Interior : City).react(ITEM_BY_ID[id]);
  }
  window.home.act(action, id);
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Enter' && e.target.id === 'nameInput') window.home.act('rename', e.target.value);
    return;
  }
  if (e.key === 'Escape') {
    if (sheet || drawerOpen || mapOpen) closeAll();
    else if (Interior.open) Interior.leave();
    else window.home.close();
    return;
  }
  if (e.key.toLowerCase() === 'm' && !sheet) return LOCAL.map();
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

Hud.init();
City.init({
  onEnter: (id) => (id === 'home' ? enterHome() : openSheet(id)),
  onNpc,
  onBlocked: (msg) => toast({ msg, ok: false }),
  onMap: () => LOCAL.map(),
});
Interior.init({
  onLeave: () => {
    document.body.classList.remove('indoors');
    closeAll();
    City.lock(false);
  },
  onBlocked: (msg) => toast({ msg, ok: false }),
  // using furniture: open the wardrobe or the study, the bag at the kitchen, or just do it
  onUse: (act, id) => {
    if (act === 'open') return openSheet(id);
    if (act === 'bag') return LOCAL.bag();
    window.home.act(act, id);
  },
});
window.home.onState((s) => {
  snap = s;
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
window.__city = { open: openSheet, openTab, City, Interior, enterHome };
