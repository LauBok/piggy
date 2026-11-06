// The panels that slide in over the map when a building is clicked: shops, school, the job
// board, the chess pavilion, the pig's home, city hall and settings. Each returns HTML for the
// current snapshot; buttons carry data-action / data-id like everywhere else in the window.

const effChips = (effects) =>
  Object.entries(effects)
    .map(([k, v]) => `<span class="eff" style="--c:${STAT_COLOR[k]}">${STAT_NAME[k]} ${v > 0 ? '+' : ''}${v}</span>`)
    .join('');

const chip = (text, color) => `<span class="eff" style="--c:${color}">${text}</span>`;

// what a piece of furniture does, e.g. 睡觉恢复 ×1.5, 解锁弹琴
const bonusChips = (bonus = {}) =>
  Object.entries(bonus)
    .map(([k, v]) => chip(v === 1 ? `解锁${BONUS_NAME[k]}` : `${BONUS_NAME[k]} ×${v}`, '#845ef7'))
    .join('');

const reqChips = (reqs) => reqs.map((r) => `<span class="req ${r.ok ? 'ok' : 'no'}">${esc(r.text)}</span>`).join('');

const freeToAct = (snap) => !snap.busy && !snap.sleeping;

function activityIcon(a) {
  if (a.type === 'study') return COURSE_BY_ID[a.id].icon;
  if (a.type === 'work') return JOB_BY_ID[a.id].icon;
  if (a.type === 'help') return FREE_HELP_BY_ID[a.id].icon;
  if (a.type === 'hobby') return HOBBY_BY_ID[a.id].icon;
  if (a.type === 'sleep') return '😴';
  return '🛁';
}

function gameBlock(snap) {
  if (snap.sleeping) return '😴 睡觉中';
  if (snap.busy) return `${activityIcon(snap.s.activity)} ${snap.label.replace(/^在/, '')}中`;
  if (snap.s.energy < -MINIGAME_COST.energy) return '⚡ 体力不足';
  return '';
}

const minutesLeft = (until) => Math.max(0, ((until || 0) - Date.now()) / 60000);

// a big round button for something to do (bath, the canteen, a hobby…)
const tile = (t) => `<button class="tile ${t.on ? 'on' : ''} ${t.locked ? 'locked' : ''}" data-action="${t.action}" ${t.id ? `data-id="${t.id}"` : ''} ${t.ok ? '' : 'disabled'}>
  <span class="tile-ic">${t.icon}</span><b>${t.name}</b>${t.sub ? `<small>${t.sub}</small>` : ''}</button>`;
const tiles = (list) => `<div class="tiles">${list.map(tile).join('')}</div>`;

function helpTile(snap, id) {
  const h = FREE_HELP_BY_ID[id];
  const s = snap.s;
  const wait = minutesLeft(s.helpReady[id]);
  const ok = freeToAct(snap) && wait <= 0 && !(h.maxHealth && s.health >= h.maxHealth);
  const gain = id === 'meal' ? `饱食 +${h.effects.hunger + npcPerk(s, 'canteen', 0)}` : `健康 +${h.effects.health}`;
  return { action: 'help', id, icon: h.icon, name: id === 'meal' ? '吃饭' : '看病', ok, sub: wait > 0 ? `⏱ ${Math.ceil(wait)} 分` : gain };
}

function hobbyTile(snap, h) {
  const s = snap.s;
  const lock = hobbyLock(s, h);
  if (lock) return { action: 'hobby', id: h.id, icon: h.icon, name: h.name, ok: false, sub: `${lock.why === 'subject' ? '🔒' : '🛒'} ${lock.text}`, locked: true };
  const wait = minutesLeft(s.hobbyReady[h.id]);
  return { action: 'hobby', id: h.id, icon: h.icon, name: h.name, ok: freeToAct(snap) && wait <= 0, sub: wait > 0 ? `⏱ ${Math.ceil(wait)} 分` : `心情 +${hobbyEffects(s, h).mood}` };
}

// ---------- pieces ----------

function goodsCard(snap, it) {
  const s = snap.s;
  const owned = s.inventory[it.id] || 0;
  const once = ONCE_CATS.includes(it.cat) && owned;
  const price = priceOf(s, it);
  const why = buyBlock(s, it);
  const npcLock = it.npc && hearts(s, it.npc) < NPC_MAX_HEARTS;
  let btn = `<button class="btn" data-action="buy" data-id="${it.id}" ${why ? 'disabled' : ''}>🪙 ${price}${price < it.price ? ` <s>${it.price}</s>` : ''}</button>`;
  if (once) btn = '<button class="btn done" disabled>已拥有</button>';
  else if (npcLock) btn = `<button class="btn" disabled>♥ ${NPC_MAX_HEARTS}</button>`;
  else if (why && why !== '金币不够…去打工赚钱吧') btn = `<button class="btn" disabled title="${esc(why)}">${it.needsTier ? `🏡 ${HOUSE_NAMES[it.needsTier]}` : it.cat === 'decor' ? '摆满了' : '—'}</button>`;
  return `<div class="card goods ${npcLock ? 'special' : ''}">
    ${owned && !once ? `<span class="badge soft">已有 ${owned}</span>` : ''}${it.npc ? '<span class="badge star">★</span>' : ''}
    <div class="goods-ic">${it.icon}</div><b>${it.name}</b>
    <div class="effs">${effChips(it.effects)}${bonusChips(it.bonus)}${it.cooldown ? chip(`⏱ ${it.cooldown} 分`, '#868e96') : ''}</div>
    ${btn}</div>`;
}

const goodsGrid = (snap, items) => `<div class="grid">${items.map((it) => goodsCard(snap, it)).join('')}</div>`;

// Items a shop sells: its category, with the neighbour's special item last
const shopItems = (cat) => [...ITEMS.filter((it) => it.cat === cat && !it.npc), ...ITEMS.filter((it) => it.cat === cat && it.npc)];

function npcCard(snap, n) {
  const s = snap.s;
  const h = hearts(s, n.id);
  const heartsRow = [...Array(NPC_MAX_HEARTS)].map((_, i) => `<i class="${i < h ? 'on' : ''} ${i === NPC_PERK_HEARTS - 1 ? 'mark' : ''}"></i>`).join('');
  const wish = npcWish(n.id);
  let wishBtn = '';
  if (wish && !wishDone(s, n.id)) {
    const it = ITEM_BY_ID[wish];
    const have = s.inventory[wish] > 0;
    wishBtn = `<button class="wish ${have ? 'have' : ''}" data-action="give" data-id="${n.id}" ${have ? '' : 'disabled'} title="${esc(it.name)}">
      <span>${it.icon}</span>${have ? '送给它' : '想要'}</button>`;
  } else if (wish) wishBtn = '<span class="wish done">💗</span>';
  const hi = greetedToday(s, n.id)
    ? ''
    : `<button class="btn ghost hi" data-action="greet" data-id="${n.id}">👋</button>`;
  const perkOn = h >= NPC_PERK_HEARTS;
  return `<div class="card npc-card"><div class="npc-av" data-action="greet" data-id="${n.id}">${animalSvg(n.species)}</div>
    <div class="npc-main"><b>${n.name}</b><div class="hearts">${heartsRow}</div>
      <small class="perk ${perkOn ? 'on' : ''}">${perkOn ? '✓' : `${NPC_PERK_HEARTS}♥`} ${n.perk.text}</small></div>
    <div class="npc-acts">${wishBtn}${hi}</div></div>`;
}

function jobRows(snap, jobs, showPlace = false) {
  const s = snap.s;
  if (!jobs.length) return '';
  return `<div class="jobs">${jobs.map((job) => {
    const reqs = jobReqs(s, job);
    const ok = allOk(reqs);
    const p = projected(job.drain, job.minutes);
    const working = s.activity?.type === 'work' && s.activity.id === job.id;
    const place = PLACE_BY_ID[JOB_SCENES[job.id].place];
    const pay = payOf(s, job);
    return `<div class="card job ${ok ? '' : 'locked'}">
      <div class="job-ic">${job.icon}</div>
      <div class="job-main"><b>${job.name}</b>${showPlace ? `<span class="job-where" data-action="fly" data-id="${place.id}">${place.icon} ${place.name}</span>` : ''}
        <div class="reqs">${reqChips(reqs)}</div>
        <div class="effs">${chip(`⏱ ${job.minutes} 分`, '#868e96')}${effChips(p)}</div></div>
      <div class="job-side"><span class="pay">🪙 ${pay}</span>
        ${working
          ? '<button class="btn" disabled>💪</button>'
          : ok
            ? `<button class="btn" data-action="work" data-id="${job.id}" ${freeToAct(snap) ? '' : 'disabled'}>打工</button>`
            : '<button class="btn" disabled>🔒</button>'}
      </div></div>`;
  }).join('')}</div>`;
}

const section = (title, html) => (html ? `<h3>${title}</h3>${html}` : '');

// ---------- sheet state kept between renders ----------

const SheetUI = {
  furnTab: 'furniture',
  treeSel: null,
  schoolStage: null,
  schoolMajor: MAJORS[0].id,
  treeDir: '',
  workFilter: 'all',
  activeGame: null,
  gameSession: 0,
  resetArmed: false,
  upd: { info: null, busy: false, checked: false },
};

// ---------- the sheets ----------

const SHEETS = {
  shop(snap, p) {
    return goodsGrid(snap, shopItems(p.cat));
  },

  furniture(snap) {
    const tabs = [['furniture', '🛋️ 家具'], ['decor', '🪴 装饰'], ['house', '🏡 房子']];
    const pills = tabs.map(([id, name]) => `<button class="pill ${SheetUI.furnTab === id ? 'on' : ''}" data-action="furnTab" data-id="${id}">${name}</button>`).join('');
    let items;
    if (SheetUI.furnTab === 'house') items = ITEMS.filter((it) => it.group === 'house');
    else if (SheetUI.furnTab === 'decor') items = shopItems('decor');
    else items = shopItems('furniture').filter((it) => it.group !== 'house');
    const s = snap.s;
    const slots = SheetUI.furnTab === 'decor' ? `<div class="note">🪴 ${ownedDecor(s).length} / ${decorSlots(s)}</div>` : '';
    return `<div class="pills">${pills}</div>${slots}${goodsGrid(snap, items)}`;
  },

  clinic(snap, p) {
    return `${tiles([helpTile(snap, 'clinic')])}${section('💊 药房', goodsGrid(snap, shopItems('medicine')))}${section('💼 工作', jobRows(snap, jobsAt(p.id)))}`;
  },

  canteen(snap) {
    return tiles([helpTile(snap, 'meal')]);
  },

  home(snap) {
    const s = snap.s;
    const tier = homeTier(s);
    const free = freeToAct(snap);
    const acts = [
      { action: 'bath', icon: '🛁', name: '洗澡', ok: free, sub: `${BATH_MINUTES} 分` },
      snap.sleeping ? { action: 'wake', icon: '☀️', name: '起床', ok: true } : { action: 'sleep', icon: '😴', name: '睡觉', ok: !snap.busy },
      ...HOBBIES.filter((h) => h.id !== 'soccer').map((h) => hobbyTile(snap, h)),
    ];
    const wear = ITEMS.filter((it) => it.cat === 'wear' && s.inventory[it.id]);
    const wardrobe = wear.length
      ? `<div class="wardrobe">${wear.map((it) => {
        const on = s.wear[it.slot] === it.id;
        return `<button class="wear-btn ${on ? 'on' : ''}" data-action="use" data-id="${it.id}" title="${esc(it.name)}">${it.icon}</button>`;
      }).join('')}</div>`
      : '';
    const furn = ITEMS.filter((it) => it.cat === 'furniture' && it.group !== 'house' && s.inventory[it.id]);
    const better = (it) => ITEMS.some((x) => x.group === it.group && x.price > it.price && s.inventory[x.id]);
    const list = furn.length
      ? `<div class="furn-list">${furn.map((it) => `<span class="furn ${better(it) ? 'idle' : ''}" title="${esc(it.name)}">${it.icon}<small>${bonusChips(it.bonus)}</small></span>`).join('')}</div>`
      : '';
    return `<div class="home-top"><b>${HOUSE_NAMES[tier]}</b><button class="btn ghost" data-action="fly" data-id="furniture">🛋️ 家具城</button></div>
      <div id="dollhouse"></div>${tiles(acts)}${section('👗 衣柜', wardrobe)}${section('🛋️ 家具', list)}`;
  },

  // A local tech tree: the focused course in the middle, what it needs on the left,
  // what it unlocks on the right. Clicking either side moves the focus there.
  school(snap, p) {
    const s = snap.s;
    const U = SheetUI;
    const state = (c) => {
      if (s.courses[c.id]) return 'done';
      if (s.activity?.type === 'study' && s.activity.id === c.id) return 'studying';
      return allOk(courseReqs(s, c)) ? 'ready' : 'locked';
    };
    if (!U.treeSel) {
      const here = COURSES.filter((c) => STAGE_PLACE[c.stage] === p.id);
      U.treeSel = (here.find((c) => state(c) === 'ready') || here.find((c) => !s.courses[c.id]) || here[0]).id;
    }
    const sel = COURSE_BY_ID[U.treeSel];
    if (!U.schoolStage) U.schoolStage = sel.stage;
    const label = (c) => (c.major ? `${MAJOR_BY_ID[c.major].name}·${c.name}` : c.fullName);

    if (sel.major) U.schoolMajor = sel.major;
    const byMajor = STAGE_BY_ID[U.schoolStage].byMajor;

    // one line of stages: green when graduated, pink for the one being viewed, faded when too young
    const stepper = STAGES.map((st) => {
      const done = st.byMajor ? MAJORS.some((m) => stageDone(s, st.id, m.id)) : stageDone(s, st.id);
      const cls = [st.id === U.schoolStage && 'on', done && 'done', s.level < st.minLevel && 'young'].filter(Boolean).join(' ');
      return `<button class="step ${cls}" data-action="stage" data-id="${st.id}" title="Lv.${st.minLevel}"><i></i><span>${st.name}</span></button>`;
    }).join('');
    // at university: the majors, and how far the viewed one is toward its degree
    let majorBar = '';
    if (byMajor) {
      const vs = STAGE_BY_ID[U.schoolStage];
      const reqs = COURSES.filter((c) => c.stage === vs.id && c.major === U.schoolMajor && !c.elective);
      const credits = stageCredits(s, vs.id, U.schoolMajor);
      majorBar = `<div class="majors">${MAJORS.map((m) => `<button class="major-btn ${m.id === U.schoolMajor ? 'on' : ''}"
          data-action="major" data-id="${m.id}" title="${m.name}">${m.icon}</button>`).join('')}</div>
        <div class="credit-line"><span>必修 <b>${reqs.filter((c) => s.courses[c.id]).length}</b> / ${reqs.length}</span>
          <div class="pbar"><i style="width:${Math.min(1, credits / vs.credits) * 100}%"></i></div>
          <span>学分 <b>${credits}</b> / ${vs.credits}</span></div>`;
    }

    // the courses you can flip through with ‹ › on the center card (general electives go with any major)
    const siblings = COURSES.filter((c) => c.stage === sel.stage && (!c.major || c.major === (sel.major || U.schoolMajor)));
    const at = siblings.findIndex((c) => c.id === sel.id);
    const prevSib = siblings[at - 1];
    const nextSib = siblings[at + 1];

    // left: what the course needs (courses, or the degree below); right: courses this one unlocks
    const stage = STAGE_BY_ID[sel.stage];
    const before = sel.prereq.map((t) => (t.startsWith('deg:') ? { deg: t } : { c: COURSE_BY_ID[t] }));
    const after = COURSES.filter((c) => c.prereq.includes(sel.id)).map((c) => ({ c }));

    // the whole degree ladder: one segment per stage, filled by how much of it is learned.
    // University stages fill by the furthest major, and show every major started as a small icon.
    const ladder = STAGES.map((st) => {
      const done = (list) => list.filter((c) => s.courses[c.id]).length;
      let frac;
      let got;
      let majors = '';
      if (st.byMajor) {
        // by credits toward each major's degree
        const per = MAJORS.map((m) => ({ m, n: stageCredits(s, st.id, m.id), got: stageDone(s, st.id, m.id), own: done(COURSES.filter((c) => c.stage === st.id && c.major === m.id)) }));
        frac = Math.max(...per.map((x) => (x.got ? 1 : Math.min(0.95, x.n / st.credits))));
        got = per.some((x) => x.got);
        majors = per.filter((x) => x.own > 0)
          .map((x) => `<i class="${x.got ? 'got' : ''}" title="${x.m.name} ${x.n}/${st.credits} 学分">${x.m.icon}</i>`).join('');
      } else {
        const list = COURSES.filter((c) => c.stage === st.id && !c.elective);
        frac = done(list) / list.length;
        got = frac === 1;
      }
      return `<button class="dl-seg ${got ? 'got' : ''} ${st.id === U.schoolStage ? 'on' : ''}" data-action="stage" data-id="${st.id}">
        <div class="dl-bar"><i style="width:${frac * 100}%"></i></div><span>${st.degree}</span>
        <div class="dl-majors">${majors}</div></button>`;
    }).join('');

    const ROW = 54;
    const H = Math.max(Math.max(before.length, after.length) * ROW + 16, 290);
    const W = { side: 148, gap: 38, mid: 230 };
    const xMid = W.side + W.gap;
    const xRight = xMid + W.mid + W.gap;
    const yOf = (list, i) => (H - list.length * ROW) / 2 + i * ROW + 5;
    const node = (item, list, i, x, dir) => (item.deg
      // a degree from the stage below: clicking goes to that stage
      ? `<button class="fnode ${reqMet(s, item.deg) ? 'done' : 'locked'}" data-action="stage" data-id="${item.deg.split(':')[1]}" style="left:${x}px;top:${yOf(list, i)}px">
        <span>🎓</span>${reqName(item.deg)}</button>`
      : `<button class="fnode ${state(item.c)}" data-action="focus" data-id="${item.c.id}" data-dir="${dir}" style="left:${x}px;top:${yOf(list, i)}px">
        <span>${item.c.icon}</span>${label(item.c)}</button>`);
    const line = (x1, y1, x2, y2, ok) =>
      `<path class="edge ${ok ? 'done' : ''}" d="M${x1} ${y1} C${x1 + 26} ${y1} ${x2 - 26} ${y2} ${x2} ${y2}"/>`;
    const lines = [
      ...before.map((it, i) => line(W.side, yOf(before, i) + 22, xMid, H / 2, it.deg ? reqMet(s, it.deg) : !!s.courses[it.c.id])),
      ...after.map((it, i) => line(xMid + W.mid, H / 2, xRight, yOf(after, i) + 22, !!s.courses[sel.id])),
    ].join('');

    const st = state(sel);
    const fee = stage.fee;
    let btn;
    if (st === 'done') btn = '<button class="btn done" disabled>已学完</button>';
    else if (st === 'studying') btn = '<button class="btn" disabled>学习中</button>';
    else if (st === 'locked') btn = '<button class="btn" disabled>🔒</button>';
    else btn = `<button class="btn" data-action="study" data-id="${sel.id}" ${freeToAct(snap) ? '' : 'disabled'}>上课</button>`;
    const sibBtn = (c, dir, ch) => (c
      ? `<button class="fc-nav" data-action="focus" data-id="${c.id}" data-dir="${dir}">${ch}</button>`
      : `<span class="fc-nav off">${ch}</span>`);
    const center = `<div class="fcenter ${st}" style="left:${xMid}px;width:${W.mid}px">
      <div class="fc-top">${sibBtn(prevSib, 'back', '‹')}<small>${at + 1} / ${siblings.length}</small>${sibBtn(nextSib, 'fwd', '›')}</div>
      <div class="fc-ic">${sel.icon}</div><b>${label(sel)}</b>
      <div class="effs">${sel.credits
        ? chip(sel.general ? '通识' : sel.elective ? '选修' : '必修', sel.elective ? '#845ef7' : '#e64980') + chip(`${sel.credits} 学分`, '#1c7ed6')
        : sel.elective ? chip('选修', '#845ef7') : ''}${chip(`⏱ ${sel.minutes} 分`, '#868e96')}${fee ? chip(`🪙 ${fee}`, '#f59f00') : ''}</div>
      ${st === 'done' ? '' : `<div class="reqs">${reqChips(courseReqs(s, sel).slice(0, 1))}</div>`}
      ${btn}</div>`;

    const anim = U.treeDir;
    U.treeDir = '';
    const owl = p.id === 'primary' ? npcCard(snap, NPC_BY_ID.owl) : '';
    return `${owl}<div class="stepper">${stepper}</div>${majorBar}
      <div class="card focus ${anim}"><div class="focus-in" style="width:${xRight + W.side}px;height:${H}px">
        <svg width="${xRight + W.side}" height="${H}">${lines}</svg>
        ${before.length ? '' : `<div class="fside-empty" style="left:0;width:${W.side}px">起点</div>`}
        ${before.map((it, i) => node(it, before, i, 0, 'back')).join('')}
        ${center}
        ${after.map((it, i) => node(it, after, i, xRight, 'fwd')).join('')}
      </div></div><div class="degree-ladder">${ladder}</div>
      ${section('💼 工作', jobRows(snap, jobsAt(p.id)))}`;
  },

  tower(snap) {
    const s = snap.s;
    const pills = [['all', '全部'], ['can', '可做']].map(([id, name]) =>
      `<button class="pill ${SheetUI.workFilter === id ? 'on' : ''}" data-action="workFilter" data-id="${id}">${name}</button>`).join('');
    const jobs = JOBS.filter((j) => SheetUI.workFilter === 'all' || allOk(jobReqs(s, j)));
    return `<div class="pills">${pills}</div>${jobRows(snap, jobs, true) || '<div class="empty"><div class="empty-ic">🔒</div></div>'}`;
  },

  chess(snap) {
    return gamesSheet(snap, MINIGAMES.filter((g) => g.id !== 'penalty'));
  },

  field(snap, p) {
    if (SheetUI.activeGame) return gamesSheet(snap, []);
    const soccer = hobbyTile(snap, HOBBY_BY_ID.soccer);
    return `${gamesSheet(snap, MINIGAMES.filter((g) => g.id === 'penalty'))}${tiles([soccer])}${section('💼 工作', jobRows(snap, jobsAt(p.id)))}`;
  },

  cityhall(snap, p) {
    const s = snap.s;
    const degs = degrees(s);
    return `<div class="card form"><h3>📛 名字</h3>
        <div class="field"><input id="nameInput" maxlength="8" value="${esc(s.name)}" />
          <button class="btn" data-action="rename">保存</button></div></div>
      ${degs.length ? `<div class="card form"><h3>🎓 学历</h3>
        <div class="reqs left">${degs.map((d) => `<span class="req ok">${d}</span>`).join('')}</div></div>` : ''}
      ${section('⛲ 捐建', goodsGrid(snap, shopItems('city')))}
      ${section('💼 工作', jobRows(snap, jobsAt(p.id)))}`;
  },

  jobs(snap, p) {
    const rows = jobRows(snap, jobsAt(p.id));
    return rows || '<div class="empty"><div class="empty-ic">🌿</div></div>';
  },

  settings(snap) {
    const s = snap.s;
    const u = SheetUI.upd.info;
    const U = SheetUI.upd;
    // version and the one update button: check, or apply whatever is waiting
    let btn = '<button class="btn" data-action="checkUpdate">检查更新</button>';
    if (!u) btn = '';
    else if (!u.packaged) btn = '<button class="btn" disabled>开发版</button>';
    else if (U.busy) btn = '<button class="btn" disabled>检查中…</button>';
    else if (u.contentUpdate) btn = `<button class="btn" data-action="applyUpdate">更新到 ${u.contentUpdate}</button>`;
    else if (u.update?.ready) btn = `<button class="btn" data-action="applyUpdate">重启更新到 ${u.update.version}</button>`;
    else if (u.update?.downloading) btn = `<button class="btn" disabled>下载中 ${u.update.version}…</button>`;
    else if (u.update) btn = `<button class="btn" data-action="applyUpdate">下载 ${u.update.version}</button>`;
    else if (U.checked) btn = '<button class="btn ghost" data-action="checkUpdate">✓ 已是最新</button>';
    const ver = u ? `<div class="card form version"><div><b>🐷 v${u.app}</b>${u.content !== u.app ? `<small>内容 v${u.content}</small>` : ''}</div>${btn}</div>` : '';
    return `${ver}${tiles([
      { action: 'follow', icon: '🐾', name: '跟随', ok: true, on: s.follow },
      { action: 'mini', icon: '🫣', name: '迷你', ok: true, on: s.mini },
    ])}
      <div class="card form row-btns">
        <button class="btn ghost" data-action="reset">${SheetUI.resetArmed ? '⚠️ 确认重置' : '重置存档'}</button>
        <button class="btn ghost" data-action="quit">退出</button>
      </div>`;
  },
};

function gamesSheet(snap, games) {
  const U = SheetUI;
  if (U.activeGame) {
    const g = MINIGAMES.find((x) => x.id === U.activeGame);
    return `<div class="game-head"><button class="btn ghost" data-action="games">←</button><b>${g.icon} ${g.name}</b></div>
      <div class="card game-area" id="gameArea"></div>`;
  }
  const why = gameBlock(snap);
  const s = snap.s;
  const cap = playCap(s);
  const got = s.playDay?.date === dayKey() ? s.playDay.got : 0;
  const left = Math.max(0, cap - got);
  return `<div class="play-day"><span>⭐ 今日</span><div class="pbar"><i style="width:${(got / cap) * 100}%"></i></div>
      <b>${Math.floor(got)} / ${cap}</b></div>
    ${why ? `<div class="advice">${why}</div>` : ''}
    <div class="game-list">${games.map((g) => `<button class="card game-card" data-action="game" data-id="${g.id}" ${why ? 'disabled' : ''}>
        <span class="game-ic">${g.icon}</span><b>${g.name}</b>
        <span class="eff" style="--c:#f59f00">⭐ +${Math.min(PLAY_EXP[g.id].win, left)}</span></button>`).join('')}</div>`;
}


// Header and body for whatever sheet is open: a place id or 'settings'
function sheetHtml(snap, id) {
  if (id === 'settings') return { head: '⚙️ 设置', body: SHEETS.settings(snap) };
  const p = PLACE_BY_ID[id];
  const npc = NPCS.find((n) => n.place === id && p.sheet !== 'school');
  const body = (npc ? npcCard(snap, npc) : '') + SHEETS[p.sheet](snap, p);
  return { head: `${p.icon} ${p.name}`, body };
}
