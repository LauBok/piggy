// The panels that slide in over the map when a building is clicked: shops, school, the job
// board, the chess pavilion, the pig's home, city hall and settings. Each returns HTML for the
// current snapshot; buttons carry data-action / data-id like everywhere else in the window.
// Styles live in sheets.css.

// 12345 -> "12,345"
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// A stat going from what the pig has now to what it would have: 🍖 72 → 61. The new value is red
// when it would land in the danger zone, and the whole thing is muted when nothing would change.
const SD_ICON = Object.fromEntries(STATS.map((x) => [x.key, x.icon]));
const DANGER = { hunger: 20, clean: 20, energy: 10, mood: 30, health: MIN_HEALTH_TO_ACT };
function change(s, k, v) {
  const now = Math.round(s[k]);
  const after = clamp(Math.round(s[k] + v), 0, 100);
  const cls = after === now ? 'flat' : v < 0 && after < DANGER[k] ? 'bad' : v > 0 ? 'up' : '';
  return `<span class="sd ${cls}" title="${STAT_NAME[k]}">${SD_ICON[k]} ${now}<i>→</i><b>${after}</b></span>`;
}
const changes = (s, effects) => STAT_KEYS.filter((k) => effects[k]).map((k) => change(s, k, effects[k])).join('');
// What an item gives when it's used later: 🍖 +15
const gives = (effects) => STAT_KEYS.filter((k) => effects[k])
  .map((k) => `<span class="sd ${effects[k] > 0 ? 'up' : ''}" title="${STAT_NAME[k]}">${SD_ICON[k]} <b>${effects[k] > 0 ? '+' : '−'}${Math.abs(effects[k])}</b></span>`).join('');

const chip = (text, cls = '', title = '') => `<span class="chip ${cls}" ${title ? `title="${esc(title)}"` : ''}>${text}</span>`;

// what a piece of furniture does, e.g. 睡觉恢复 ×1.5, 解锁弹琴
const bonusChips = (bonus = {}) =>
  Object.entries(bonus).map(([k, v]) => chip(bonusText(k, v), 'bonus')).join('');

const freeToAct = (snap) => !snap.busy && !snap.sleeping;

// Why the pig can't start anything right now ('' when free)
const busyWhy = (snap) => (snap.sleeping ? '在睡觉' : snap.busy ? snap.label.replace(/^在/, '正在') : '');

function activityIcon(a) {
  if (a.type === 'study') return COURSE_BY_ID[a.id].icon;
  if (a.type === 'work') return JOB_BY_ID[a.id].icon;
  if (a.type === 'help') return FREE_HELP_BY_ID[a.id].icon;
  if (a.type === 'hobby') return HOBBY_BY_ID[a.id].icon;
  if (a.type === 'kinder') return KINDER_BY_ID[a.id].icon;
  if (a.type === 'sleep') return '😴';
  return '🛁';
}

function gameBlock(snap) {
  if (snap.sleeping) return '😴 在睡觉';
  if (snap.busy) return `${activityIcon(snap.s.activity)} ${busyWhy(snap)}`;
  if (snap.s.energy < -MINIGAME_COST.energy) return '⚡ 体力不足';
  return '';
}

const minutesLeft = (until) => Math.max(0, ((until || 0) - Date.now()) / 60000);

// A section: a title, an optional count and whatever goes on the right
const sec = (title, html, { count, right = '' } = {}) =>
  (html ? `<section class="sec"><div class="sec-h"><b>${title}</b>${count != null ? `<small>${count}</small>` : ''}${right ? `<span class="right">${right}</span>` : ''}</div>${html}</section>` : '');

// A group that starts closed, e.g. jobs not unlocked yet. Its open state survives re-renders.
const fold = (key, summary, html) =>
  `<details class="fold card" data-fold="${key}" ${SheetUI.folds[key] ? 'open' : ''}><summary>${summary}<i class="fold-ar">›</i></summary>${html}</details>`;

// the seed picked in the garden's tray
document.addEventListener('change', (e) => {
  if (e.target.name === 'seedSel') SheetUI.seedSel = e.target.value;
});

document.addEventListener('toggle', (e) => {
  const k = e.target.dataset?.fold;
  if (k) SheetUI.folds[k] = e.target.open;
}, true);

// A segmented control: [[id, label, count?], …]
const seg = (items, on, action) =>
  `<div class="seg">${items.map(([id, label, n]) => `<button class="${id === on ? 'on' : ''}" data-action="${action}" data-id="${id}">${label}${n != null ? ` <em>${n}</em>` : ''}</button>`).join('')}</div>`;

// A small square button for something to do at home or in settings
const tile = (t) => `<button class="tile ${t.on ? 'on' : ''} ${t.locked ? 'locked' : ''}" data-action="${t.action}" ${t.id ? `data-id="${t.id}"` : ''}${t.fx ? preview(t.fx) : ''} ${t.ok ? '' : 'disabled'} ${t.why ? `title="${esc(t.why)}"` : ''}>
  <span class="tile-ic">${t.icon}</span><b>${t.name}</b>${t.sub ? `<small>${t.sub}</small>` : ''}</button>`;
const tiles = (list) => `<div class="tiles">${list.map(tile).join('')}</div>`;

// ---------- a building's main service: eat, see the doctor, soak, play ball ----------

// A wide card: icon, name, what it gives, and the button, or why it can't be done
// Lets the HUD's stat bars preview a change while the pointer is over the element
const preview = (effects) => {
  const d = Object.fromEntries(STAT_KEYS.filter((k) => Math.round(effects[k] || 0)).map((k) => [k, Math.round(effects[k])]));
  return Object.keys(d).length ? ` data-preview="${esc(JSON.stringify(d))}"` : '';
};

const hero = (h) => `<div class="card hero ${h.ok ? '' : 'off'}"${h.fx ? preview(h.fx) : ''}>
    <div class="hero-ic">${h.icon}</div>
    <div class="hero-m"><b>${h.name}</b><div class="chips">${h.meta}</div></div>
    <div class="hero-act">${h.why ? `<small class="why">${h.why}</small>` : ''}
      <button class="btn primary" data-action="${h.action}" data-id="${h.id}" ${h.ok ? '' : 'disabled'}>${h.btn}</button></div></div>`;

function helpHero(snap, id) {
  const h = FREE_HELP_BY_ID[id];
  const s = snap.s;
  const wait = minutesLeft(s.helpReady[id]);
  const fx = { ...h.effects };
  if (id === 'meal') fx.hunger += npcPerk(s, 'canteen', 0);
  let why = busyWhy(snap);
  if (!why && h.maxHealth && s.health >= h.maxHealth) why = '很健康';
  if (!why && id === 'meal' && s.hunger >= 95) why = '已吃饱';
  if (!why && id === 'soak' && s.energy >= 95) why = '精神很好';
  if (!why && h.fee && s.money < h.fee) why = '金币不够';
  if (!why && wait > 0) why = `${Math.ceil(wait)} 分钟后`;
  // the theme park keeps its hours, the fireworks are on weekend nights, a festival has its hours
  const fest = OUTINGS.find((o) => o.festival === id);
  if (!why && h.park && !parkOpen()) why = `${hhmm(PARK_HOURS[0])} 开放`;
  const up = keeperBackAt(id);
  if (!why && up) why = `${clockText(up)} 开放`;
  if (!why && id === 'fireworks' && !fireworksOn()) why = `周末 ${FIREWORKS_HOURS[0] / 60}:00`;
  if (!why && fest && !outingOn(s, fest)) why = minuteOf(townDate()) < fest.hours[0] ? `${hhmm(fest.hours[0])} 开始` : '已结束';
  const verb = { meal: '吃饭', clinic: '看病', soak: '泡温泉', movie: '看电影', ferris: '坐摩天轮', carousel: '坐木马', haunted: '进鬼屋', fireworks: '看烟花',
    newyear: '逛庙会', lantern: '看花灯', dragon: '看龙舟', moon: '赏月', xmas: '看圣诞树' }[id];
  const meta = `${changes(s, fx)}${chip(`⏱️ ${h.minutes} 分`)}${h.fee ? chip(`🪙 ${h.fee}`, 'coin') : chip('免费', 'ok')}`;
  // the cinema says what's on today; the rides and festivals go by their own names
  let title = ['meal', 'clinic', 'soak'].includes(id) ? verb : h.name;
  if (id === 'movie') title = `《${esc(filmToday())}》`;
  if (fest) title = { newyear: '春节庙会', lantern: '元宵灯会', dragon: '端午龙舟', moon: '中秋赏月', xmas: '圣诞树' }[id];
  return hero({ action: 'help', id, icon: h.icon, name: title, meta, ok: !why, why, btn: verb, fx });
}

const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

// Fishing at the lake: a few casts, then a rest
function fishHero(snap) {
  const s = snap.s;
  let why = busyWhy(snap);
  if (!why && s.energy < -FISH_COST.energy) why = '体力不足';
  const wait = minutesLeft(s.fishReady);
  if (!why && wait > 0) why = `${Math.ceil(wait)} 分钟后`;
  const meta = `${changes(s, FISH_COST)}${chip(`🎣 ${FISH_CASTS} 竿`)}${chip('免费', 'ok')}`;
  return hero({ action: 'game', id: 'fishing', icon: '🎣', name: '钓鱼', meta, ok: !why, why, btn: '钓鱼', fx: FISH_COST });
}

// ---------- the photo album ----------
// Each photo: a backdrop for what was going on (sky, ground, the big thing behind them and a
// couple of little ones), the pig as he looked then, whoever was with him, and what and when
// written under it

const PHOTO_SCENES = {
  ferris: ['#a5d8ff', '#ffe3c2', '🎡'], carousel: ['#fff3bf', '#ffd8a8', '🎠', '🎵'], haunted: ['#3b2a5c', '#2b1f47', '👻', '🕸️'],
  fireworks: ['#1c2541', '#3a506b', '🎆', '🎇'], newyear: ['#ffe3e3', '#ffc9c9', '🏮', '🧧'], lantern: ['#2b2d54', '#4a2c38', '🏮', '🏮'],
  dragon: ['#d0ebff', '#74c0fc', '🐉', '🥁'], moon: ['#1c2541', '#364fc7', '🌕', '🥮'], xmas: ['#1c2541', '#f1f3f5', '🎄', '⭐'],
  eat: ['#fff4e6', '#e9c99b', '🍱'], soak: ['#fff4e6', '#c69c6d', '♨️'], movie: ['#2b2d54', '#4a2c38', '🎬', '🍿'],
  soccer: ['#d0ebff', '#8ce99a', '⚽'], cafe: ['#f8f0e3', '#e9c99b', '☕', '🧁'], read: ['#fff4e6', '#e9c99b', '📚'],
  ducks: ['#d0ebff', '#a5d8ff', '🦆', '🍞'], garden: ['#d0ebff', '#b88a5c', '🌱', '🥕'], kite: ['#a5d8ff', '#8ce99a', '🪁'],
  stars: ['#1c2541', '#3a506b', '🔭', '⭐'], tea: ['#fff9db', '#e9c99b', '🍵', '🍪'],
};
// a photo together somewhere in town: that place's own colours and sign
function placeScene(at) {
  const p = PLACE_BY_ID[at];
  if (at?.startsWith('home-')) return ['#fff9db', '#e9c99b', '🏡'];
  if (!p) return ['#d0ebff', '#c1e6a3', '🌳'];
  const [c1, c2] = p.look ? [p.look.body, p.look.roofColor] : KIND_COLORS[p.kind] || ['#d0ebff', '#c1e6a3'];
  return [c1, lighter(c2, 0.4), p.icon];
}

function photoCaption(p) {
  const n = NPC_BY_ID[p.w];
  const o = OUTING_BY_ID[p.k];
  if (p.k.startsWith('fish:')) return `钓到${ITEM_BY_ID[p.k.slice(5)].name}`;
  if (p.k === 'tea') return `在${n.name}家喝茶`;
  if (p.k === 'snap') {
    const place = p.at.startsWith('home-') ? `${NPC_BY_ID[p.at.slice(5)].name}家` : PLACE_BY_ID[p.at]?.name || '猪猪城';
    return `和${n.name}在${place}`;
  }
  if (n && o) return `和${n.name}${o.name}`;
  return FREE_HELP_BY_ID[p.k]?.label.slice(1) || '';
}

function photoHtml(p, i) {
  const [sky, ground, back, deco] = p.k === 'snap' ? placeScene(p.at) : p.k.startsWith('fish:') ? ['#d0ebff', '#74c0fc', ITEM_BY_ID[p.k.slice(5)].icon] : PHOTO_SCENES[p.k] || ['#d0ebff', '#c1e6a3', '📷'];
  const n = NPC_BY_ID[p.w];
  const d = new Date(p.t);
  return `<figure class="photo" style="--sky:${sky};--ground:${ground}">
    <div class="ph-pic"><span class="ph-back">${back}</span>${deco ? `<span class="ph-deco">${deco}</span>` : ''}
      <div class="ph-pig photo-pig" data-i="${i}"></div>${n ? `<div class="ph-npc ${n.small ? 'small' : ''}">${animalSvg(n.species, 'happy')}</div>` : ''}</div>
    <figcaption><b>${esc(photoCaption(p))}</b><small>${d.getMonth() + 1}月${d.getDate()}日</small></figcaption></figure>`;
}

function lookGrid(snap, kind, list) {
  const s = snap.s;
  const look = s.look || { color: 'pink', hair: '' };
  const card = (o) => {
    const now = (look[kind] || '') === o.id;
    const prev = { ...look, [kind]: o.id };
    const btn = now
      ? '<button class="btn owned" disabled>现在</button>'
      : `<button class="btn primary" data-action="restyle" data-id="${kind}:${o.id}" ${s.money < o.price ? 'disabled' : ''}>${o.price ? `🪙 ${fmt(o.price)}` : '免费'}</button>`;
    return `<div class="card goods look ${now ? 'current' : ''}"><div class="look-prev" data-color="${prev.color}" data-hair="${prev.hair || ''}"></div><b>${o.name}</b>${btn}</div>`;
  };
  return `<div class="grid">${list.map(card).join('')}</div>`;
}

// The pig is kept as he is and a new pig starts
function potionHero(snap) {
  const why = busyWhy(snap);
  const armed = SheetUI.armed === 'rejuvenate:';
  return hero({ action: 'rejuvenate', id: '', icon: '🧪', name: '返老还童药', meta: chip('免费', 'ok'), ok: !why, why, btn: armed ? '确认喝下' : '喝下' });
}

function hobbyState(snap, h) {
  const s = snap.s;
  const lock = hobbyLock(s, h);
  const wait = minutesLeft(s.hobbyReady[h.id]);
  let why = busyWhy(snap);
  if (lock) why = lock.why === 'subject' ? `要学${lock.text}` : `要有${lock.text}`;
  else if (!why && wait > 0) why = `${Math.ceil(wait)} 分钟后`;
  return { lock, why, fx: hobbyEffects(s, h) || h.effects };
}

function hobbyTile(snap, h) {
  const { lock, why, fx } = hobbyState(snap, h);
  return { action: 'hobby', id: h.id, icon: h.icon, name: h.name, ok: !why, why, locked: !!lock, sub: why || `😊 +${fx.mood}`, fx: lock ? null : fx };
}

function hobbyHero(snap, h) {
  const { why, fx } = hobbyState(snap, h);
  return hero({ action: 'hobby', id: h.id, icon: h.icon, name: h.name, meta: `${changes(snap.s, fx)}${chip(`⏱️ ${h.minutes} 分`)}`, ok: !why, why, btn: h.name, fx });
}

// Kindergarten classes, while he's too little for primary school
function kinderClasses(snap) {
  if (snap.s.level >= STAGE_BY_ID.primary.minLevel) return '';
  const why = busyWhy(snap);
  const list = KINDER_CLASSES.map((k) => ({ action: 'kinder', id: k.id, icon: k.icon, name: k.name, ok: !why, why, sub: why || `⏱️ ${KINDER_MIN} 分`, fx: { mood: KINDER_MOOD } }));
  return sec('上学', tiles(list));
}

// ---------- goods ----------

function goodsCard(snap, it, placeId) {
  const s = snap.s;
  // a hidden item stays a mystery until its keeper likes the pig enough
  if (hiddenLocked(s, it)) {
    const need = heartsNeeded(it);
    return `<div class="card goods mystery"><div class="goods-ic">?</div><b>隐藏商品</b>
      <div class="chips">${chip(NPC_BY_ID[it.npc].name, 'tag')}</div>
      <button class="btn" disabled>♥ ${need}</button></div>`;
  }
  const owned = s.inventory[it.id] || 0;
  const once = ONCE_CATS.includes(it.cat) && owned;
  const price = priceOf(s, it, placeId);
  // a reason other than money (full house, needs a bigger house…) replaces the price
  const why = buyBlock({ ...s, money: Infinity }, it, placeId);
  const poor = s.money < price;
  let btn = `<button class="btn primary" data-action="buy" data-id="${placeId ? `${placeId}:` : ''}${it.id}" ${poor ? `disabled title="还差 ${fmt(price - s.money)}"` : ''}>🪙 ${fmt(price)}${price < it.price ? ` <s>${fmt(it.price)}</s>` : ''}</button>`;
  if (once) btn = '<button class="btn owned" disabled>已拥有</button>';
  else if (why) {
    const label = it.needsTier ? HOUSE_NAMES[it.needsTier] : it.cat === 'decor' ? '已摆满' : it.tier ? '已有更好的' : '—';
    btn = `<button class="btn" disabled title="${esc(why)}">${label}</button>`;
  }
  const fx = `${gives(it.effects)}${bonusChips(it.bonus)}`;
  return `<div class="card goods">
    ${owned && !once ? `<span class="corner">已有 ${owned}</span>` : ''}
    <div class="goods-ic">${it.icon}${it.npc ? `<span class="pin" title="${esc(NPC_BY_ID[it.npc].name)}">★</span>` : ''}</div><b>${it.name}</b>
    <div class="chips">${fx}</div>
    ${btn}</div>`;
}

const goodsGrid = (snap, items, placeId) => `<div class="grid">${items.map((it) => goodsCard(snap, it, placeId)).join('')}</div>`;

// ---------- the calendar ----------

// One season of the town's calendar: four weeks from a Monday, today marked, and on each day its
// festival and whose birthday it is. The seasons along the top.
function calendarPage(snap) {
  const now = calOf();
  const season = SheetUI.calSeason || now.season;
  const si = SEASON_IDS.indexOf(season);
  const nowSi = SEASON_IDS.indexOf(now.season);
  const tabs = seg(SEASON_IDS.map((id) => [id, `${SEASON_ICONS[id]} ${SEASON_NAMES[id]}`]), season, 'calSeason');
  const cells = [];
  for (let day = 1; day <= SEASON_DAYS; day++) {
    const key = `${season}-${day}`;
    const fest = FESTIVALS.find((f) => f.date === key);
    const bdays = NPCS.filter((n) => n.birthday === key);
    const today = si === nowSi && day === now.day;
    const past = si < nowSi || (si === nowSi && day < now.day);
    const ev = (fest ? `<span class="cal-ev fest">${fest.icon}<i>${fest.name}</i></span>` : '')
      + bdays.map((n) => `<span class="cal-ev bday"><span class="cal-av">${animalSvg(n.species)}</span><i>${n.name}</i></span>`).join('');
    cells.push(`<div class="cal-day ${today ? 'today' : ''} ${past ? 'past' : ''} ${fest ? 'has-fest' : ''}"><b>${day}</b>${ev}</div>`);
  }
  const head = '一二三四五六日'.split('').map((d) => `<span>周${d}</span>`).join('');
  return `<div class="cal">
    <div class="cal-top"><b>第 ${now.year} 年 ${SEASON_NAMES[season]}季</b>${tabs}</div>
    <div class="cal-head">${head}</div>
    <div class="cal-grid">${cells.join('')}</div></div>`;
}

// City hall on a festival's day: that festival's outfit, to pick up
function festWearHero(s) {
  const fest = festivalOn();
  const it = fest && ITEMS.find((x) => x.festival === fest.id);
  if (!it) return '';
  const got = !!s.inventory[it.id];
  return sec('节日装扮', hero({ icon: it.icon, name: it.name, meta: chip(`${fest.icon} ${fest.name}`), ok: !got, why: got ? '已领取' : '', action: 'claimFestival', id: it.id, btn: '领取' }));
}

// What a place sells, with its neighbour's special item last
const shopItems = (placeId) => {
  // hidden goods without their own shop list show up in their keeper's shop
  const keeper = keeperOf(placeId);
  const here = ITEMS.filter((it) => shopsOf(it).includes(placeId) || (keeper && it.npc === keeper.id && !it.shops));
  return [...here.filter((it) => !it.npc), ...here.filter((it) => it.npc)];
};

// ---------- neighbours ----------

// A neighbour's perk and whether the pig has it yet: "5♥ 打工工资 +5%" (muted) or "打工工资 +5%"
function npcPerk2(s, n, h) {
  if (n.perk) return { on: h >= NPC_PERK_HEARTS, text: h >= NPC_PERK_HEARTS ? n.perk.text : `${NPC_PERK_HEARTS}♥ ${n.perk.text}` };
  if (n.spot != null) return null;
  const ZHE = { 0.95: '九五折', 0.9: '九折', 0.85: '八五折', 0.8: '八折' };
  const pct = (k) => ZHE[k] || `${Math.round(k * 100) / 10} 折`;
  const next = [...SHOP_DISCOUNTS].reverse().find(([need]) => h < need);
  if (next) return { on: false, text: `${next[0]}♥ ${pct(next[1])}` };
  return { on: true, text: pct(shopDiscount(s, n.place)) };
}

// Where someone is right now, as a small round button that walks the pig there: the place's
// icon, a house at home, zz asleep; its name on hover
function whereBtn(n) {
  const plan = npcPlan(n.id);
  const pl = npcPlace(plan.where);
  const home = plan.where === n.home && plan.act !== 'work';
  const icon = npcAsleep(plan) ? '💤' : home ? '🏠' : pl.icon;
  return `<button class="npc-pin" data-action="findNpc" data-id="${n.id}" title="${esc(pl.name)}"><span>${icon}</span></button>`;
}

// A neighbour: avatar, name, hearts as a bar, what they wish for and where they are (hellos and
// presents are done in person, in town). `keeper` is the compact pill in a shop's banner (greyed, with where they are, while
// they're out; the shop sells all the same); otherwise a row on the friends page.
function npcCard(snap, n, keeper = false) {
  const s = snap.s;
  const { h, frac } = heartProgress(s, n.id);
  const here = keeper && npcAtWork(n.id);
  const wish = npcWish(n.id);
  let wishBtn = '';
  if (wish && !wishDone(s, n.id)) {
    const it = ITEM_BY_ID[wish];
    const have = s.inventory[wish] > 0 && !giftedToday(s, n.id);
    wishBtn = `<span class="npc-wish ${have ? 'have' : ''}" title="${esc(it.name)}">${it.icon}</span>`;
  }
  // on the friends page: whether today's hello and present are done (they're done in person)
  const mark = (on, icon, text) => `<span class="npc-mark ${on ? 'on' : ''}" title="${text}">${icon}</span>`;
  const today = keeper ? '' : mark(greetedToday(s, n.id), '👋', greetedToday(s, n.id) ? '今天已打招呼' : '今天未打招呼')
    + mark(giftedToday(s, n.id), '🎁', giftedToday(s, n.id) ? '今天已送礼' : '今天未送礼');
  const perk = npcPerk2(s, n, h);
  const bar = `<span class="hbar" title="${h} / ${NPC_MAX_HEARTS} ♥"><i style="--p:${((h + frac) / NPC_MAX_HEARTS) * 100}%;--m:${(NPC_PERK_HEARTS / NPC_MAX_HEARTS) * 100}%"></i><em>♥ ${h}</em></span>`;
  // on the friends page: a cake on their birthday, and what's been given so far and how it went down
  const bday = !keeper && isBirthday(n.id) ? '<span class="npc-bday" title="生日">🎂</span>' : '';
  const TASTE = { love: ['😍', '最爱'], like: ['😊', '喜欢'], plain: ['🙂', '一般'], dislike: ['😣', '讨厌'] };
  const favs = keeper ? '' : giftsGiven(s, n.id).map((g) => `<span class="npc-fav ${g.taste}" title="${esc(`${ITEM_BY_ID[g.id].name} ${TASTE[g.taste][1]}`)}">${ITEM_BY_ID[g.id].icon}<i>${TASTE[g.taste][0]}</i></span>`).join('');
  const av = here ? `data-action="callOut" data-id="${n.id}"` : `data-action="findNpc" data-id="${n.id}"`;
  return `<div class="npc-card ${keeper ? 'keeper' : 'card npc-row'} ${keeper && !here ? 'out' : ''}">
    <div class="npc-av" ${av} title="${esc(n.name)}">${animalSvg(n.species)}</div>
    <div class="npc-main"><span class="nm"><b>${n.name}</b>${bday}${bar}</span>${perk ? `<small class="perk ${perk.on ? 'on' : ''}">${perk.text}</small>` : ''}${favs ? `<span class="npc-favs">${favs}</span>` : ''}</div>
    <div class="npc-acts">${wishBtn}${today}${here ? '' : whereBtn(n)}</div></div>`;
}

// Others inside a place right now (shopping, eating, at a film or a café table): their faces on
// its banner; click one and they come out to talk
function hereHeads(p) {
  const keeper = keeperOf(p.id);
  const list = NPCS.filter((n) => n !== keeper && npcPlan(n.id).where === p.id && ['shop', 'eat', 'movie', 'cafe'].includes(npcPlan(n.id).act));
  if (!list.length) return '';
  return `<div class="bnr-here">${list.map((n) => `<button class="here-av" data-action="callOut" data-id="${n.id}" title="${esc(n.name)}">${animalSvg(n.species)}</button>`).join('')}</div>`;
}

// ---------- jobs ----------

// Pay goes up a little when the pig is happy and down when it's sad: say so next to the number
function moodTag(s) {
  const k = moodPay(s);
  const pct = Math.round(Math.abs(k - 1) * 100);
  if (k > 1) return `<small class="mood up">心情好 +${pct}%</small>`;
  if (k < 1) return `<small class="mood down">心情差 −${pct}%</small>`;
  return '';
}

// Why the pig would be refused even though the job is unlocked ('' if fine)
function weakWhy(s, job) {
  if (s.health < MIN_HEALTH_TO_ACT) return '生病中';
  const p = projected(job.drain, job.minutes);
  if (s.hunger + p.hunger < 5) return '饱食不足';
  if (s.energy + p.energy < 5) return '体力不足';
  return '';
}

function jobRow(snap, job, showPlace) {
  const s = snap.s;
  const reqs = jobReqs(s, job);
  const need = reqs.filter((r) => !r.ok);
  const p = projected(job.drain, job.minutes);
  const working = s.activity?.type === 'work' && s.activity.id === job.id;
  const place = PLACE_BY_ID[JOB_SCENES[job.id].place];
  const where = showPlace ? `<span class="chip where" data-action="goto" data-id="${place.id}" title="在地图上看看">${place.icon} ${place.name}</span>` : '';
  let act;
  if (working) act = '<button class="btn" disabled>打工中</button>';
  else if (need.length) act = '<span class="gap">🔒</span>';
  else act = `<button class="btn primary" data-action="work" data-id="${job.id}" ${freeToAct(snap) ? '' : `disabled title="${esc(busyWhy(snap))}"`}>打工</button>`;
  const weak = !need.length && !working ? weakWhy(s, job) : '';
  return `<div class="row job ${need.length ? 'locked' : ''} ${working ? 'now' : ''}"${need.length ? '' : preview(p)}>
    <div class="row-ic">${job.icon}</div>
    <div class="row-m"><div class="t"><b>${job.name}</b>${where}<small>⏱️ ${job.minutes} 分</small></div>
      <div class="chips">${need.length ? need.map((r) => chip(esc(r.text), 'need')).join('') : changes(s, p)}</div></div>
    <div class="row-v"><b>🪙 ${fmt(payOf(s, job))}</b>${moodTag(s)}${weak ? `<small class="warn">${weak}</small>` : ''}</div>
    ${act}</div>`;
}

const jobList = (snap, jobs, showPlace = false) =>
  (jobs.length ? `<div class="list card">${jobs.map((j) => jobRow(snap, j, showPlace)).join('')}</div>` : '');

const unmet = (s, job) => jobReqs(s, job).filter((r) => !r.ok).length;
const byPay = (s) => (a, b) => payOf(s, b) - payOf(s, a);

// A place's own jobs: open ones listed, best paid first; locked ones folded away
function placeJobs(snap, p, foldLocked = true) {
  const s = snap.s;
  const jobs = jobsAt(p.id);
  if (!jobs.length) return '';
  const open = jobs.filter((j) => !unmet(s, j)).sort(byPay(s));
  const shut = jobs.filter((j) => unmet(s, j)).sort((a, b) => a.minLevel - b.minLevel);
  if (!foldLocked) return sec('打工', jobList(snap, [...open, ...shut]), { count: jobs.length });
  const folded = shut.length
    ? fold(`jobs:${p.id}`, `<span class="fold-ic">🔒</span>未解锁<small>${shut.length}</small><span class="fold-icons">${shut.map((j) => j.icon).join('')}</span>`, jobList(snap, shut))
    : '';
  return sec('打工', `${jobList(snap, open)}${folded}`, { count: jobs.length });
}

// Businesses to buy shares in: what each pays a day, and the next share's price.
// Ones the pig is too young for fold away after the first.
function bizList(snap) {
  const s = snap.s;
  const row = (b) => {
    const n = bizOwned(s, b.id);
    const price = bizPrice(s, b);
    const young = s.level < b.minLevel;
    const short = price - s.money;
    const act = young
      ? `<span class="gap">Lv.${b.minLevel}</span>`
      : `<button class="btn primary" data-action="invest" data-id="${b.id}" ${short > 0 ? 'disabled' : ''}>入股</button>`;
    return `<div class="row ${young ? 'locked' : ''}">
      <div class="row-ic">${b.icon}</div>
      <div class="row-m"><div class="t"><b>${b.name}</b>${n ? `<span class="own">×${n}</span>` : ''}</div>
        <div class="chips">${chip(`🪙 +${fmt(b.income)}/天`, 'gain')}</div></div>
      <div class="row-v"><b>🪙 ${fmt(price)}</b>${!young && short > 0 ? `<small>还差 ${fmt(short)}</small>` : ''}</div>
      ${act}</div>`;
  };
  const shown = BUSINESSES.filter((b, i) => s.level >= b.minLevel || i === BUSINESSES.findIndex((x) => s.level < x.minLevel));
  const later = BUSINESSES.filter((b) => !shown.includes(b));
  const income = bizIncome(s);
  const right = income ? `<b class="money">🪙 +${fmt(income)}/天</b>` : '';
  const rest = later.length ? fold('biz', `<span class="fold-ic">🔒</span>未解锁<small>${later.length}</small><span class="fold-icons">${later.map((b) => b.icon).join('')}</span>`, `<div class="list card">${later.map(row).join('')}</div>`) : '';
  return sec('投资', `<div class="list card">${shown.map(row).join('')}</div>${rest}`, { right });
}

// ---------- sheet state kept between renders ----------

const SheetUI = {
  furnTab: 'furniture',
  calSeason: null, // the season the calendar shows (null: this one)
  treeSel: null,
  schoolStage: null,
  schoolMajor: MAJORS[0].id,
  treeDir: '',
  workFilter: 'can',
  activeGame: null,
  gameSession: 0,
  duel: null, // a game against a neighbour: { id, line }
  armed: '', // 'action:id' waiting for its second tap (reset, the potion, taking a pig back)
  folds: {},
  seedSel: null,
  upd: { info: null, busy: false, checked: false },
};

// ---------- the sheets ----------

const SHEETS = {
  shop(snap, p) {
    const items = shopItems(p.id);
    return sec('商品', goodsGrid(snap, items, p.id), { count: items.length }) + placeJobs(snap, p);
  },

  furniture(snap) {
    const s = snap.s;
    const tabs = [['furniture', '🛋️ 家具'], ['decor', '🪴 装饰'], ['house', '🏡 房子']];
    let items;
    if (SheetUI.furnTab === 'house') items = ITEMS.filter((it) => it.group === 'house');
    else if (SheetUI.furnTab === 'decor') items = shopItems('furniture').filter((it) => it.cat === 'decor');
    else items = shopItems('furniture').filter((it) => it.cat === 'furniture' && it.group !== 'house');
    const slots = SheetUI.furnTab === 'decor' ? `<span class="muted" title="摆放位置">🪴 ${ownedDecor(s).length} / ${decorSlots(s)}</span>` : '';
    return `<div class="toolbar">${seg(tabs, SheetUI.furnTab, 'furnTab')}<span class="right">${slots}</span></div>${goodsGrid(snap, items, 'furniture')}`;
  },

  clinic(snap, p) {
    const items = shopItems('clinic');
    return helpHero(snap, 'clinic') + potionHero(snap) + sec('药房', goodsGrid(snap, items, 'clinic'), { count: items.length }) + placeJobs(snap, p);
  },

  // the barber's hairstyles and the beauty parlour's fur colours; the little pigs show how each
  // would look
  salon: (snap) => sec('发型', lookGrid(snap, 'hair', LOOK_HAIR)),
  beauty: (snap) => sec('毛色', lookGrid(snap, 'color', LOOK_COLORS)),

  // the bank: savings, the next interest, putting coins in or taking them out
  bank(snap) {
    const s = snap.s;
    const b = s.bank || { balance: 0, at: Date.now() };
    const daily = Math.min(Math.floor(b.balance * BANK_RATE), BANK_DAILY_CAP);
    const keys = (action, have) => [[100, '100'], [1000, '1,000'], [10000, '10,000'], ['all', '全部']]
      .map(([id, label]) => `<button class="btn ${action === 'deposit' ? 'primary' : 'outline'}" data-action="${action}" data-id="${id}" ${(id === 'all' ? have >= 1 : have >= id) ? '' : 'disabled'}>${label}</button>`).join('');
    return `<div class="card vault">
        <div class="vault-l"><div class="vault-pig">🐷</div>
          <div class="vault-m"><small>存款</small><b class="hero-n">🪙 ${fmt(Math.floor(b.balance))}</b>
            <div class="next">${daily >= 1 ? `利息 <b class="money">+${fmt(daily)}/天</b>${daily >= BANK_DAILY_CAP ? ` <span class="chip" title="每天利息最多 ${fmt(BANK_DAILY_CAP)}">已达上限</span>` : ''}` : `利率 ${Math.round(BANK_RATE * 100)}%/天`}</div></div></div>
        <div class="vault-r">
          <div class="amt"><span>存入</span>${keys('deposit', s.money)}</div>
          <div class="amt"><span>取出</span>${keys('withdraw', b.balance)}</div>
        </div></div>
      ${bizList(snap)}
      ${placeJobs(snap, PLACE_BY_ID.bank)}`;
  },

  // the wardrobe at home: put things on or take them off
  wardrobe(snap) {
    const s = snap.s;
    const wear = ITEMS.filter((it) => it.cat === 'wear' && s.inventory[it.id]);
    if (!wear.length) return `<div class="sheet-empty"><div class="empty-ic">👗</div><b>空的</b><button class="btn secondary" data-action="goto" data-id="clothes">🎀 服装店</button></div>`;
    return `<div class="grid">${wear.map((it) => {
      const on = s.wear[it.slot] === it.id;
      return `<div class="card goods ${on ? 'current' : ''}"><div class="goods-ic">${it.icon}</div><b>${it.name}</b>
        <button class="btn ${on ? 'secondary' : 'primary'}" data-action="use" data-id="${it.id}">${on ? '摘下' : '戴上'}</button></div>`;
    }).join('')}</div>`;
  },

  // the study at home: diplomas earned and what the furniture does
  study(snap) {
    const s = snap.s;
    const degs = degrees(s);
    return sec('学历', degs.length ? `<div class="chips">${degs.map((d) => chip(`🎓 ${d}`, 'ok')).join('')}</div>` : '<div class="muted">—</div>', { count: degs.length })
      + sec('家具', furnList(s, false) || '<div class="muted">—</div>');
  },

  // The vegetable patch: one raised bed of six squares and a tray of seeds. Click an empty square
  // to plant the chosen seed there, a ripe one to bring everything in.
  garden(snap) {
    const s = snap.s;
    const seeds = ITEMS.filter((it) => it.cat === 'seed' && s.inventory[it.id]);
    if (!seeds.some((it) => it.id === SheetUI.seedSel)) SheetUI.seedSel = seeds[0]?.id || null;
    const ripe = s.farm.filter((p) => p && plotProgress(p) >= 1).length;
    const squares = s.farm.map((p, i) => {
      if (!p) {
        // one planting button per seed; only the chosen seed's shows (see the style below)
        return `<div class="sq empty">${seeds.map((it) => `<button class="sq-plant" data-seed="${it.id}" data-action="plant" data-id="${i}:${it.id}" title="${esc(it.name)}">${it.icon}</button>`).join('')}</div>`;
      }
      const seed = ITEM_BY_ID[p.seed];
      const crop = ITEM_BY_ID[seed.crop];
      const k = plotProgress(p);
      if (k >= 1) return `<button class="sq ripe" data-action="harvest" title="${esc(crop.name)} 可收获"><span class="crop">${crop.icon}</span></button>`;
      const stage = k < 0.25 ? 'seed' : k < 0.6 ? 'sprout' : 'leafy';
      const look = { seed: '<i class="seedling"></i>', sprout: '🌱', leafy: '🌿' }[stage];
      return `<div class="sq grow is-${stage}" title="${esc(crop.name)}"><span class="plant">${look}</span>
        <small>${fmtGrow(Math.ceil((1 - k) * seed.grow))}</small><div class="bar"><i style="--p:${k * 100}%"></i></div></div>`;
    }).join('');
    const tray = seeds.length
      ? seeds.map((it) => `<label class="seed" title="${esc(it.name)}"><input type="radio" name="seedSel" value="${it.id}" ${it.id === SheetUI.seedSel ? 'checked' : ''} />
          <span>${it.icon}</span><small>×${s.inventory[it.id]}</small></label>`).join('')
      : `<button class="btn secondary" data-action="goto" data-id="farm">${PLACE_BY_ID.farm.icon} ${PLACE_BY_ID.farm.name}</button>`;
    const pick = seeds.map((it) => `#sheet .garden:has(input[value="${it.id}"]:checked) .sq-plant[data-seed="${it.id}"] { display: grid; }`).join(' ');
    const btn = `<button class="btn primary" data-action="harvest" ${ripe ? '' : 'disabled'}>收获${ripe ? ` ${ripe}` : ''}</button>`;
    return `<div class="garden ${seeds.length ? 'has-seeds' : ''}"><style>${pick}</style>
      <div class="bed">${squares}</div>
      <div class="tray-row"><div class="tray">${tray}</div>${btn}</div></div>`;
  },

  spring(snap, p) {
    return helpHero(snap, 'soak') + placeJobs(snap, p);
  },

  canteen(snap, p) {
    return helpHero(snap, 'meal') + placeJobs(snap, p);
  },

  cinema(snap, p) {
    return helpHero(snap, 'movie') + placeJobs(snap, p);
  },

  // the barn buys the harvest and the fish: one at a time, or all of a kind
  barn(snap) {
    const s = snap.s;
    const cards = (fish) => barnGoods().filter((it) => (it.cat === 'fish') === fish).map((it) => {
      const n = s.inventory[it.id] || 0;
      const one = barnPrice(it);
      return `<div class="card goods ${n ? '' : 'none'}">${n ? `<span class="corner">已有 ${n}</span>` : ''}
        <div class="goods-ic">${it.icon}</div><b>${it.name}</b>
        <div class="sell-row"><button class="btn primary" data-action="sell" data-id="${it.id}" ${n ? '' : 'disabled'}>卖 🪙${one}</button>
          ${n > 1 ? `<button class="btn" data-action="sell" data-id="${it.id}:all">全卖 🪙${fmt(one * n)}</button>` : ''}</div></div>`;
    }).join('');
    return sec('收菜', `<div class="grid">${cards(false)}</div>`) + sec('收鱼', `<div class="grid">${cards(true)}</div>`);
  },

  // the flats: a mailbox for each household, who lives on which floor and where they are now
  apt(snap) {
    const rows = NPCS.filter((n) => n.home === 'apt').map((n, i) => `<div class="apt-row"><span class="apt-floor">${i + 1}楼</span>${npcCard(snap, n)}</div>`).join('');
    return sec('信箱', rows);
  },

  home(snap) {
    const s = snap.s;
    const tier = homeTier(s);
    const free = freeToAct(snap);
    const acts = [
      { action: 'bath', icon: '🛁', name: '洗澡', ok: free, why: busyWhy(snap), sub: `${BATH_MINUTES} 分` },
      snap.sleeping ? { action: 'wake', icon: '☀️', name: '起床', ok: true } : { action: 'sleep', icon: '😴', name: '睡觉', ok: !snap.busy, why: busyWhy(snap) },
      ...HOBBIES.filter((h) => h.id !== 'soccer').map((h) => hobbyTile(snap, h)),
    ];
    const wear = ITEMS.filter((it) => it.cat === 'wear' && s.inventory[it.id]);
    const wardrobe = wear.length
      ? `<div class="wardrobe">${wear.map((it) => {
        const on = s.wear[it.slot] === it.id;
        return `<button class="wear-btn ${on ? 'on' : ''}" data-action="use" data-id="${it.id}" title="${esc(it.name)}">${it.icon}</button>`;
      }).join('')}</div>`
      : '';
    return `${tiles(acts)}
      ${sec(HOUSE_NAMES[tier], '<div id="dollhouse"></div>')}
      ${sec('衣柜', wardrobe, { count: wear.length })}
      ${sec('家具', furnList(s, true))}`;
  },

  // The school: one degree path, the majors at university, the stage's courses on the left and
  // the chosen one on the right with its lessons, what it needs and what it opens.
  school(snap, p) {
    const s = snap.s;
    const U = SheetUI;
    const state = (c) => {
      if (s.courses[c.id]) return 'done';
      if (s.activity?.type === 'study' && s.activity.id === c.id) return 'studying';
      if (allOk(courseReqs(s, c))) return 'ready';
      return lessonsDone(s, c) ? 'part' : 'locked';
    };
    if (!U.treeSel) {
      const here = COURSES.filter((c) => STAGE_PLACE[c.stage] === p.id);
      U.treeSel = (here.find((c) => state(c) === 'ready') || here.find((c) => !s.courses[c.id]) || here[0]).id;
    }
    const sel = COURSE_BY_ID[U.treeSel];
    if (!U.schoolStage) U.schoolStage = sel.stage;
    if (sel.major) U.schoolMajor = sel.major;
    U.treeDir = '';
    const vs = STAGE_BY_ID[U.schoolStage];

    // the degree path: one segment per stage, filled by how much of it is learned
    const path = STAGES.map((st) => {
      let frac;
      let got;
      let note;
      if (st.byMajor) {
        const per = MAJORS.map((m) => ({ m, n: stageCredits(s, st.id, m.id), got: stageDone(s, st.id, m.id) }));
        got = per.some((x) => x.got);
        frac = got ? 1 : Math.min(0.95, Math.max(...per.map((x) => x.n)) / st.credits);
        const mine = per.find((x) => x.m.id === U.schoolMajor);
        note = st.id === U.schoolStage && mine.n ? `${mine.n}/${st.credits}` : '';
      } else {
        const list = COURSES.filter((c) => c.stage === st.id && !c.elective);
        frac = list.reduce((n, c) => n + lessonsDone(s, c), 0) / list.reduce((n, c) => n + c.lessons, 0);
        got = frac === 1;
        note = '';
      }
      const young = s.level < st.minLevel;
      if (got) note = '';
      else if (young) note = `Lv.${st.minLevel}`;
      const cls = [st.id === U.schoolStage && 'on', got && 'done', young && 'young'].filter(Boolean).join(' ');
      return `<button class="stage ${cls}" data-action="stage" data-id="${st.id}" title="${st.degree}">
        <span class="n">${st.icon} ${st.name}<span class="s">${note}</span></span>
        <div class="bar ${got ? 'ok' : ''}"><i style="--p:${frac * 100}%"></i></div></button>`;
    }).join('');

    const majors = vs.byMajor
      ? `<div class="majors">${MAJORS.map((m) => {
        const n = stageCredits(s, vs.id, m.id);
        const got = stageDone(s, vs.id, m.id);
        return `<button class="mj ${m.id === U.schoolMajor ? 'on' : ''} ${n ? 'started' : ''}" data-action="major" data-id="${m.id}">${m.icon} ${m.name}${got ? ' 🎓' : ''}</button>`;
      }).join('')}</div>`
      : '';

    // the courses of the viewed stage (and major): required, then electives
    const list = COURSES.filter((c) => c.stage === vs.id && (!c.major || c.major === U.schoolMajor));
    const groups = [['必修', list.filter((c) => !c.elective)], ['选修', list.filter((c) => c.elective && !c.general)], ['通识', list.filter((c) => c.general)]];
    const crow = (c) => {
      const st = state(c);
      const n = lessonsDone(s, c);
      const lv = courseReqs(s, c)[0];
      const shut = lv.ok ? '🔒' : lv.text;
      const tag = { done: '', studying: '学习中', ready: c.lessons > 1 ? lessonNum(n + 1) : '', part: shut, locked: shut }[st];
      return `<button class="crow ${st} ${c.id === sel.id ? 'sel' : ''}" data-action="focus" data-id="${c.id}">
        <span class="crow-ic">${c.icon}</span><b>${c.name}</b><span class="stt">${tag}</span></button>`;
    };
    const clist = groups.filter(([, l]) => l.length)
      .map(([name, l], i) => `${i || groups[0][1].length === 0 ? `<div class="sub">${name}</div>` : ''}${l.map(crow).join('')}`).join('');

    // the chosen course
    const stage = STAGE_BY_ID[sel.stage];
    const st = state(sel);
    const done = lessonsDone(s, sel);
    const reqs = courseReqs(s, sel);
    const pips = `<div class="pips">${[...Array(sel.lessons)].map((_, i) => {
      const lv = lessonLevel(sel, i + 1);
      const cls = i < done ? 'on' : s.level < lv ? 'later' : i === done && st === 'ready' ? 'next' : 'open';
      return `<i class="${cls}" title="${esc(lessonName(sel, i + 1))}  Lv.${lv}">${lessonNum(i + 1)}</i>`;
    }).join('')}<small>${done} / ${sel.lessons}</small></div>`;
    const off = 1 + (stage.needs ? 1 : 0);
    const needLinks = [
      ...(reqs[0].ok ? [] : [`<span class="lk need">${reqs[0].text}</span>`]),
      ...(stage.needs ? [`<button class="lk ${reqs[1].ok ? '' : 'need'}" data-action="stage" data-id="${stage.needs}">${reqs[1].text}</button>`] : []),
      ...sel.prereq.map((t, i) => {
        const r = reqs[off + i];
        const cls = r.ok ? '' : 'need';
        return t.startsWith('deg:')
          ? `<button class="lk ${cls}" data-action="stage" data-id="${t.split(':')[1]}">${esc(r.text)}</button>`
          : `<button class="lk ${cls}" data-action="focus" data-id="${t.split('@')[0]}" data-dir="back">${esc(r.text)}</button>`;
      }),
    ];
    const after = COURSES.filter((c) => c.prereq.includes(sel.id));
    const opens = after.map((c) => `<button class="lk" data-action="focus" data-id="${c.id}" data-dir="fwd">${c.icon} ${c.fullName}</button>`);
    let btn;
    if (st === 'done') btn = '<button class="btn owned" disabled>已学完</button>';
    else if (st === 'studying') btn = '<button class="btn" disabled>学习中</button>';
    else if (st !== 'ready') btn = `<button class="btn" disabled>${reqs[0].ok ? '上课' : reqs[0].text}</button>`;
    else btn = `<button class="btn primary" data-action="study" data-id="${sel.id}"${preview(projected(STUDY_DRAIN, sel.minutes))} ${freeToAct(snap) ? '' : `disabled title="${esc(busyWhy(snap))}"`}>上课</button>`;
    const kind = sel.general ? '通识' : sel.elective ? '选修' : '必修';
    const detail = `<div class="card detail ${st}">
      <div class="d-top"><div class="hero-ic">${sel.icon}</div>
        <div><b>${sel.fullName}</b><div class="chips">${chip(kind, sel.elective ? 'bonus' : 'tag')}</div></div></div>
      ${pips}
      ${st === 'ready' ? `<div class="chips">${changes(s, projected(STUDY_DRAIN, sel.minutes))}</div>` : ''}
      <div class="links">${needLinks.length ? `<span>前置</span><div>${needLinks.join('')}</div>` : ''}${opens.length ? `<span>后续</span><div>${opens.join('')}</div>` : ''}</div>
      <div class="d-act">${btn}${st === 'done' ? '' : `<span class="chips">${chip(`⏱️ ${sel.minutes} 分`)}${stage.fee ? chip(`🪙 ${stage.fee}`, 'coin') : ''}</span>`}</div></div>`;

    return `<div class="path">${path}</div>${majors}
      <div class="two"><div class="card clist">${clist}</div>${detail}</div>
      ${placeJobs(snap, p)}`;
  },

  tower(snap) {
    const s = snap.s;
    const can = JOBS.filter((j) => !unmet(s, j)).sort(byPay(s));
    const near = JOBS.filter((j) => { const n = unmet(s, j); return n > 0 && n <= 2; }).sort((a, b) => unmet(s, a) - unmet(s, b) || payOf(s, b) - payOf(s, a));
    const shut = JOBS.filter((j) => unmet(s, j)).sort((a, b) => a.minLevel - b.minLevel || payOf(s, a) - payOf(s, b));
    const f = SheetUI.workFilter === 'all' ? 'all' : SheetUI.workFilter === 'near' ? 'near' : 'can';
    const bar = `<div class="toolbar">${seg([['can', '可做', can.length], ['near', '快解锁', near.length], ['all', '全部', JOBS.length]], f, 'workFilter')}</div>`;
    const empty = '<div class="sheet-empty"><div class="empty-ic">🔒</div></div>';
    if (f === 'can') return bar + (jobList(snap, can, true) || empty);
    if (f === 'near') return bar + (jobList(snap, near, true) || empty);
    return bar + jobList(snap, can, true) + (shut.length ? `<div class="grp">未解锁 ${shut.length}</div>${jobList(snap, shut, true)}` : '');
  },

  chess(snap) {
    return gamesSheet(snap, MINIGAMES.filter((g) => !['penalty', 'bumper'].includes(g.id)));
  },

  // the theme park: its rides (while it's open), the fireworks, the bumper cars and the sweet stall
  funpark(snap) {
    if (SheetUI.activeGame) return gamesSheet(snap, []);
    const items = shopItems('funpark');
    return ['ferris', 'carousel', 'haunted', 'fireworks'].map((id) => helpHero(snap, id)).join('')
      + gamesSheet(snap, MINIGAMES.filter((g) => g.id === 'bumper'))
      + sec('棉花糖摊', goodsGrid(snap, items, 'funpark'), { count: items.length });
  },

  field(snap, p) {
    if (SheetUI.activeGame) return gamesSheet(snap, []);
    return `${hobbyHero(snap, HOBBY_BY_ID.soccer)}${gamesSheet(snap, MINIGAMES.filter((g) => g.id === 'penalty'))}${placeJobs(snap, p)}`;
  },

  cityhall(snap, p) {
    const s = snap.s;
    const degs = degrees(s);
    const items = shopItems('cityhall');
    return `<div class="card namecard">
        <span class="lbl">名字</span><input id="nameInput" maxlength="8" value="${esc(s.name)}" />
        <button class="btn primary" data-action="rename">保存</button></div>
      ${festWearHero(s)}
      ${degs.length ? sec('学历', `<div class="chips">${degs.map((d) => chip(`🎓 ${d}`, 'ok')).join('')}</div>`, { count: degs.length }) : ''}
      ${sec('捐建', goodsGrid(snap, items), { count: items.length })}
      ${placeJobs(snap, p)}`;
  },

  // jobs, and whatever else is on there: a festival in the square or by the lake, fishing at the lake
  jobs(snap, p) {
    if (SheetUI.activeGame) return '<div class="card game-area" id="gameArea"></div>';
    const fest = festivalOn();
    const extra = (fest?.place === p.id ? helpHero(snap, fest.id) : '') + (p.id === 'lake' ? fishHero(snap) : '') + (p.id === 'kinder' ? kinderClasses(snap) : '');
    return extra + placeJobs(snap, p, false) || '<div class="sheet-empty"><div class="empty-ic">🌿</div></div>';
  },

  // The photo album, newest first
  album(snap) {
    const list = snap.s.album || [];
    if (!list.length) return '<div class="sheet-empty"><div class="empty-ic">📷</div></div>';
    return `<div class="album">${list.map((p, i) => photoHtml(p, i)).reverse().join('')}</div>`;
  },

  // Everyone in town: who hasn't been greeted today first, then the best friends
  friends(snap) {
    const s = snap.s;
    const list = [...NPCS].sort((a, b) => greetedToday(s, a.id) - greetedToday(s, b.id) || npcPoints(s, b.id) - npcPoints(s, a.id));
    return `<div class="npc-list friends">${list.map((n) => npcCard(snap, n)).join('')}</div>`;
  },

  settings(snap) {
    const s = snap.s;
    const u = SheetUI.upd.info;
    const U = SheetUI.upd;
    // version and the one update button: check, or apply whatever is waiting
    let btn = '<button class="btn secondary" data-action="checkUpdate">检查更新</button>';
    if (!u) btn = '';
    else if (!u.packaged) btn = '<button class="btn" disabled>开发版</button>';
    else if (U.busy) btn = '<button class="btn" disabled>检查中…</button>';
    else if (u.contentUpdate) btn = `<button class="btn primary" data-action="applyUpdate">更新到 ${u.contentUpdate}</button>`;
    else if (u.update?.ready) btn = `<button class="btn primary" data-action="applyUpdate">重启更新到 ${u.update.version}</button>`;
    else if (u.update?.downloading) btn = `<button class="btn" disabled>下载中 ${u.update.version}…</button>`;
    else if (u.update) btn = `<button class="btn primary" data-action="applyUpdate">下载 ${u.update.version}</button>`;
    else if (U.checked) btn = '<button class="btn owned" data-action="checkUpdate">已是最新版本</button>';
    const sw = (action, icon, name, on) => `<button class="row set-row" data-action="${action}">
      <span class="row-ic">${icon}</span><span class="row-m"><span class="t"><b>${name}</b></span></span><span class="sw ${on ? 'on' : ''}"></span></button>`;
    // pigs from before, kept when the one playing drank the potion
    const pigRow = (p, now) => {
      const armed = SheetUI.armed === `switchPig:${p.pigId}`;
      const act = now
        ? '<button class="btn owned" disabled>现在</button>'
        : `<button class="btn ${armed ? 'primary' : 'secondary'}" data-action="switchPig" data-id="${esc(p.pigId)}" ${busyWhy(snap) ? 'disabled' : ''}>${armed ? '确认换回' : '换回'}</button>`;
      return `<div class="row"><span class="row-ic">🐷</span><div class="row-m"><div class="t"><b>${esc(p.name)}</b><small>Lv.${p.level}${p.degree ? ` ${esc(p.degree)}` : ''}</small></div></div>${act}</div>`;
    };
    const pigs = snap.pigs?.length ? sec('我的小猪', `<div class="list card">${pigRow({ ...s, degree: degrees(s).at(-1) }, true)}${snap.pigs.map((p) => pigRow(p)).join('')}</div>`) : '';
    return `<div class="list card">${sw('follow', '🐾', '跟随', s.follow)}${sw('mini', '🫣', '迷你', s.mini)}</div>
      ${pigs}
      ${u ? `<div class="list card"><div class="row"><span class="row-ic">🐷</span><div class="row-m"><div class="t"><b>v${u.app}</b>${u.content !== u.app ? `<small>内容 v${u.content}</small>` : ''}</div></div>${btn}</div></div>` : ''}
      <div class="list card">
        <div class="row"><span class="row-ic">🚪</span><div class="row-m"><div class="t"><b>退出</b></div></div><button class="btn secondary" data-action="quit">退出</button></div>
        <div class="row"><span class="row-ic">⚠️</span><div class="row-m"><div class="t"><b class="danger">重置存档</b></div></div>
          <button class="btn ${SheetUI.armed === 'reset:' ? 'danger' : 'quiet danger'}" data-action="reset">${SheetUI.armed === 'reset:' ? '确认重置' : '重置'}</button></div>
      </div>`;
  },
};

// Owned furniture: name, what it does; ones outdone by a better piece are faded
function furnList(s, skipHouse) {
  const furn = ITEMS.filter((it) => it.cat === 'furniture' && s.inventory[it.id] && !(skipHouse && it.group === 'house'));
  if (!furn.length) return '';
  const better = (it) => ITEMS.some((x) => x.group === it.group && x.price > it.price && s.inventory[x.id]);
  return `<div class="furn-list">${furn.map((it) => `<div class="furn ${better(it) ? 'idle' : ''}" ${better(it) ? 'title="已有更好的"' : ''}>
    <span class="row-ic">${it.icon}</span><div class="row-m"><b>${it.name}</b><div class="chips">${bonusChips(it.bonus)}</div></div></div>`).join('')}</div>`;
}

function gamesSheet(snap, games) {
  const U = SheetUI;
  if (U.activeGame) return '<div class="card game-area" id="gameArea"></div>';
  const why = gameBlock(snap);
  const s = snap.s;
  const cap = playCap(s);
  const got = s.playDay?.date === dayKey() ? s.playDay.got : 0;
  const left = Math.max(0, cap - got);
  return `<div class="card play-day" title="今天的游戏经验"><span>⭐</span><div class="bar"><i style="--p:${(got / cap) * 100}%"></i></div>
      <b>${Math.floor(got)} / ${cap}</b>${why ? `<small class="why">${why}</small>` : ''}</div>
    <div class="game-list">${games.map((g) => `<button class="card game-card" data-action="game" data-id="${g.id}" ${why ? 'disabled' : ''}>
        <span class="game-ic">${g.icon}</span><b>${g.name}</b>
        ${chip(`⭐ +${Math.min(PLAY_EXP[g.id].win, left)}`, 'coin')}</button>`).join('')}</div>`;
}

// Colours for places that aren't plain buildings
const KIND_COLORS = { forest: ['#d3f9d8', '#69db7c'], spring: ['#fff4e6', '#d9a066'], site: ['#fff3bf', '#fab005'], pavilion: ['#d3f9d8', '#2f9e44'],
  stage: ['#e5dbff', '#7048e8'], plaza: ['#f8f0e3', '#e8a87c'], field: ['#d3f9d8', '#40c057'], lake: ['#d0ebff', '#4dabf7'],
  home: ['#ffe3ec', '#f06595'], houses: ['#fff0f6', '#f783ac'], garden: ['#ebfbee', '#8c6239'], barn: ['#fff5f5', '#e03131'], funpark: ['#fff0f6', '#f06595'] };
const NEUTRAL = ['#f6eef1', '#c9b3bc'];

const closeBtn = `<button class="sh-x" data-action="closeSheet" title="关闭">${ICON.close}</button>`;

// The top of a sheet: its colours, icon, name and tagline, and the shopkeeper if there is one
function bannerHtml(snap, p) {
  const [c1, c2] = p.look ? [p.look.body, p.look.roofColor] : KIND_COLORS[p.kind] || ['#fff0f6', '#f783ac'];
  const npc = NPCS.find((n) => n.place === p.id && n.spot == null);
  // playing a game: a slim bar with a way back instead
  if (SheetUI.activeGame) {
    const g = MINIGAMES.find((x) => x.id === SheetUI.activeGame) || { icon: '🎣', name: '钓鱼' };
    return `<div class="bnr slim" style="--b1:${c1};--b2:${c2}">
      <button class="sh-back" data-action="games" title="返回">←</button>
      <div class="bnr-t"><b>${g.icon} ${g.name}</b><small>${p.icon} ${p.name}</small></div>${closeBtn}</div>`;
  }
  return `<div class="bnr" style="--b1:${c1};--b2:${c2}">
    <div class="bnr-ic">${p.icon}</div>
    <div class="bnr-t"><b>${p.name}</b>${PLACE_TAGLINES[p.id] ? `<small>${PLACE_TAGLINES[p.id]}</small>` : ''}</div>
    ${hereHeads(p)}${npc ? npcCard(snap, npc, true) : ''}${closeBtn}</div>`;
}

// Playing against a neighbour: their face, name and what they just said
function duelBanner() {
  const { id, line } = SheetUI.duel;
  const n = NPC_BY_ID[id];
  const g = MINIGAMES.find((x) => x.id === n.game);
  const face = animalSvg(n.species, 'happy').replace(/^<svg[^>]*>/, '<svg viewBox="10 -10 140 140">');
  return `<div class="bnr slim duel" style="--b1:${NEUTRAL[0]};--b2:${NEUTRAL[1]}"><div class="duel-av">${face}</div>
    <div class="bnr-t"><b>${n.name}</b><small class="duel-line">${esc(line || '')}</small></div><span class="duel-game">${g.icon} ${g.name}</span>${closeBtn}</div>`;
}

const plainBanner = (icon, name) =>
  `<div class="bnr" style="--b1:${NEUTRAL[0]};--b2:${NEUTRAL[1]}"><div class="bnr-ic">${icon}</div><div class="bnr-t"><b>${name}</b></div>${closeBtn}</div>`;

// Header and body for whatever sheet is open: a place id, the wardrobe, the study or 'settings'
function sheetHtml(snap, id) {
  if (id === 'wardrobe') return { head: plainBanner('👗', '衣柜'), body: SHEETS.wardrobe(snap) };
  if (id === 'study') return { head: plainBanner('📚', '书房'), body: SHEETS.study(snap) };
  if (id === 'settings') return { head: plainBanner('⚙️', '设置'), body: SHEETS.settings(snap) };
  if (id === 'friends') return { head: plainBanner('💞', '朋友'), body: SHEETS.friends(snap) };
  if (id === 'album') return { head: plainBanner('📷', '相册'), body: SHEETS.album(snap) };
  if (id === 'bag') return { head: plainBanner('🎒', '背包'), body: bagPage(snap) };
  if (id === 'calendar') return { head: plainBanner('📅', '日历'), body: calendarPage(snap) };
  if (id === 'duel') return { head: duelBanner(), body: '<div class="card game-area" id="gameArea"></div>' };
  const p = PLACE_BY_ID[id];
  return { head: bannerHtml(snap, p), body: SHEETS[p.sheet](snap, p) };
}
