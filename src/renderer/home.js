// Home window: a bigger view of the pet with the shop, school, jobs and mini games.
// It holds no game state of its own; it renders snapshots pushed from the pet window
// and sends actions back there.

const NAV = [
  { id: 'status', icon: '🐷', label: '状态' },
  { id: 'bag', icon: '🎒', label: '背包' },
  { id: 'shop', icon: '🛒', label: '商店' },
  { id: 'school', icon: '🏫', label: '学校' },
  { id: 'work', icon: '💼', label: '打工' },
  { id: 'games', icon: '🎲', label: '游戏' },
  { id: 'more', icon: '⚙️', label: '设置' },
];

const FORM_ICON = { baby: '🍼', toddler: '🧸', child: '🎒', teen: '📚', youth: '🎓', adult: '💼' };

const $ = (id) => document.getElementById(id);

const effChips = (effects) =>
  Object.entries(effects)
    .map(([k, v]) => `<span class="eff" style="--c:${STAT_COLOR[k]}">${STAT_NAME[k]} ${v > 0 ? '+' : ''}${v}</span>`)
    .join('');

const chip = (text, color) => `<span class="eff" style="--c:${color}">${text}</span>`;

const reqChips = (reqs) => reqs.map((r) => `<span class="req ${r.ok ? 'ok' : 'no'}">${esc(r.text)}</span>`).join('');

const ring = (key, color) => `<svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="16"/>
  <circle class="val" cx="20" cy="20" r="16" pathLength="100" stroke="${color}" data-ring="${key}" transform="rotate(-90 20 20)"/></svg>`;

let snap = null;
let page = new URLSearchParams(location.search).get('tab') || 'status';
let lastKey = '';
let resetArmed = false;
let shopCat = 'food';
let treeSel = null;
let schoolStage = null;
let schoolMajor = MAJORS[0].id;
let treeDir = ''; // 'fwd' / 'back': which way the school view slides on the next render
let workFilter = 'all';
let activeGame = null;
let gameSession = 0;

const freeToAct = () => !snap.busy && !snap.sleeping;

function activityIcon(a) {
  if (a.type === 'study') return COURSE_BY_ID[a.id].icon;
  if (a.type === 'work') return JOB_BY_ID[a.id].icon;
  return '🛁';
}

function gameBlock() {
  if (snap.sleeping) return '😴 睡觉中';
  if (snap.busy) return `${activityIcon(snap.s.activity)} ${snap.label.replace(/^在/, '')}中`;
  if (snap.s.energy < -MINIGAME_COST.energy) return '⚡ 体力不足';
  return '';
}

const PAGES = {
  status() {
    const s = snap.s;
    let act = '';
    if (snap.busy) {
      act = `<div class="card activity"><div class="act-ic">${activityIcon(s.activity)}</div>
        <div class="act-main"><b>${esc(s.name)}正${snap.label}</b><div class="pbar"><i data-progress></i></div></div>
        <span class="remain">还剩 <b data-remain></b></span>
        <button class="btn ghost" data-action="cancel">取消</button></div>`;
    } else if (snap.sleeping) {
      act = `<div class="card activity"><div class="act-ic">😴</div>
        <div class="act-main"><b>睡觉中</b></div>
        <button class="btn" data-action="wake">叫醒</button></div>`;
    }
    const form = formFor(s.level);
    const growth = `<div class="card growth"><div class="growth-ic">${FORM_ICON[form.id]}</div>
      <div class="growth-main"><b>${form.name} · Lv.${s.level}</b><div class="pbar"><i data-exp></i></div></div>
      <small data-exptext></small></div>`;
    const stats = STATS.map(
      (st) => `<div class="card stat" data-warn="${st.key}">
        <div class="ring-wrap">${ring(st.key, st.color)}<span class="ring-ic">${st.icon}</span></div>
        <b>${st.name}</b><span class="num"><b data-val="${st.key}"></b></span></div>`
    ).join('');
    const free = !snap.busy;
    const tiles = [
      { action: 'bath', icon: '🛁', name: '洗澡', ok: free && !snap.sleeping },
      snap.sleeping
        ? { action: 'wake', icon: '☀️', name: '起床', ok: true }
        : { action: 'sleep', icon: '😴', name: '睡觉', ok: free },
      { action: 'play', icon: '🤸', name: '玩耍', ok: free && !snap.sleeping },
      { action: 'follow', icon: '🐾', name: '跟随', ok: true, on: s.follow },
      ...FREE_HELP.map((h) => {
        const wait = Math.max(0, ((s.helpReady[h.id] || 0) - Date.now()) / 60000);
        const ok = !snap.sleeping && wait <= 0 && !(h.maxHealth && s.health >= h.maxHealth);
        return { action: 'help', id: h.id, icon: h.icon, name: h.name, ok, sub: wait > 0 ? `⏱ ${Math.ceil(wait)} 分` : '免费' };
      }),
    ];
    return `${act}${growth}<div class="stats">${stats}</div>
      <div class="tiles">${tiles.map((t) => `<button class="tile ${t.on ? 'on' : ''}" data-action="${t.action}" ${t.id ? `data-id="${t.id}"` : ''} ${t.ok ? '' : 'disabled'}>
        <span class="tile-ic">${t.icon}</span><b>${t.name}</b>${t.sub ? `<small>${t.sub}</small>` : ''}</button>`).join('')}</div>`;
  },

  bag() {
    const s = snap.s;
    const inv = s.inventory;
    const owned = ITEMS.filter((it) => inv[it.id] > 0);
    if (!owned.length) {
      return `<div class="empty"><div class="empty-ic">🎒</div><b>空空的</b>
        <button class="btn" data-action="go" data-id="shop">🛒 商店</button></div>`;
    }
    return SHOP_CATS.map((cat) => {
      const items = owned.filter((it) => it.cat === cat.id);
      if (!items.length) return '';
      return `<h3>${cat.icon} ${cat.name}</h3><div class="grid">${items.map((it) => {
        let label = { food: '吃', hygiene: '用', medicine: '吃', toy: '玩' }[it.cat];
        let ok = !snap.sleeping;
        if (it.cat === 'toy') {
          const wait = Math.max(0, ((s.toyReady[it.id] || 0) - Date.now()) / 60000);
          if (wait > 0) label = `⏱ ${Math.ceil(wait)} 分`;
          ok = ok && !snap.busy && wait <= 0;
        }
        return `<div class="card goods">
          ${it.cat === 'toy' ? '' : `<span class="badge">×${inv[it.id]}</span>`}
          <div class="goods-ic">${it.icon}</div><b>${it.name}</b>
          <div class="effs">${effChips(it.effects)}</div>
          <button class="btn" data-action="use" data-id="${it.id}" ${ok ? '' : 'disabled'}>${label}</button>
        </div>`;
      }).join('')}</div>`;
    }).join('');
  },

  shop() {
    const s = snap.s;
    const pills = SHOP_CATS.map((c) => `<button class="pill ${c.id === shopCat ? 'on' : ''}" data-action="shopCat" data-id="${c.id}">${c.icon} ${c.name}</button>`).join('');
    const goods = ITEMS.filter((it) => it.cat === shopCat).map((it) => {
      const owned = s.inventory[it.id] || 0;
      const toyOwned = it.cat === 'toy' && owned;
      return `<div class="card goods">
        ${owned ? `<span class="badge soft">${toyOwned ? '已拥有' : `已有 ${owned}`}</span>` : ''}
        <div class="goods-ic">${it.icon}</div><b>${it.name}</b>
        <div class="effs">${effChips(it.effects)}${it.cooldown ? chip(`⏱ ${it.cooldown} 分`, '#868e96') : ''}</div>
        <button class="btn" data-action="buy" data-id="${it.id}" ${toyOwned || s.money < it.price ? 'disabled' : ''}>
          ${toyOwned ? '已拥有' : `🪙 ${it.price}`}</button>
      </div>`;
    }).join('');
    return `<div class="pills">${pills}</div><div class="grid">${goods}</div>`;
  },

  // A local tech tree: the focused course in the middle, what it needs on the left,
  // what it unlocks on the right. Clicking either side moves the focus there.
  school() {
    const s = snap.s;
    const state = (c) => {
      if (s.courses[c.id]) return 'done';
      if (s.activity?.type === 'study' && s.activity.id === c.id) return 'studying';
      return allOk(courseReqs(s, c)) ? 'ready' : 'locked';
    };
    if (!treeSel) treeSel = (COURSES.find((c) => state(c) === 'ready') || COURSES.find((c) => !s.courses[c.id]) || COURSES[0]).id;
    const sel = COURSE_BY_ID[treeSel];
    if (!schoolStage) schoolStage = sel.stage;
    const label = (c) => (c.major ? `${MAJOR_BY_ID[c.major].name}·${c.name}` : c.fullName);

    if (sel.major) schoolMajor = sel.major;
    const byMajor = STAGE_BY_ID[schoolStage].byMajor;

    // one line of stages: green when graduated, pink for the one being viewed, faded when too young
    const stepper = STAGES.map((st) => {
      const done = st.byMajor ? MAJORS.some((m) => stageDone(s, st.id, m.id)) : stageDone(s, st.id);
      const cls = [st.id === schoolStage && 'on', done && 'done', s.level < st.minLevel && 'young'].filter(Boolean).join(' ');
      return `<button class="step ${cls}" data-action="stage" data-id="${st.id}" title="Lv.${st.minLevel}"><i></i><span>${st.name}</span></button>`;
    }).join('');
    const majorBar = byMajor
      ? `<div class="majors">${MAJORS.map((m) => `<button class="major-btn ${m.id === schoolMajor ? 'on' : ''}"
          data-action="major" data-id="${m.id}" title="${m.name}">${m.icon}</button>`).join('')}</div>`
      : '';

    // the courses you can flip through with ‹ › on the center card
    const siblings = COURSES.filter((c) => c.stage === sel.stage && (!c.major || c.major === sel.major));
    const at = siblings.findIndex((c) => c.id === sel.id);
    const prevSib = siblings[at - 1];
    const nextSib = siblings[at + 1];

    // left: prerequisite courses; right: courses this one unlocks
    const stage = STAGE_BY_ID[sel.stage];
    const before = sel.prereq.map((id) => ({ kind: 'course', c: COURSE_BY_ID[id] }));
    const after = COURSES.filter((c) => c.prereq.includes(sel.id)).map((c) => ({ kind: 'course', c }));

    // the whole degree ladder: one segment per stage, filled by how much of it is learned.
    // University stages fill by the furthest major, and show every major started as a small icon
    // (several majors can be studied, each gives its own degree).
    const ladder = STAGES.map((st) => {
      const done = (list) => list.filter((c) => s.courses[c.id]).length;
      let frac;
      let got;
      let majors = '';
      if (st.byMajor) {
        const per = MAJORS.map((m) => {
          const list = COURSES.filter((c) => c.stage === st.id && c.major === m.id);
          return { m, n: done(list), total: list.length };
        });
        frac = Math.max(...per.map((p) => p.n / p.total));
        got = per.some((p) => p.n === p.total);
        majors = per.filter((p) => p.n > 0)
          .map((p) => `<i class="${p.n === p.total ? 'got' : ''}" title="${p.m.name} ${p.n}/${p.total}">${p.m.icon}</i>`).join('');
      } else {
        const list = COURSES.filter((c) => c.stage === st.id);
        frac = done(list) / list.length;
        got = frac === 1;
      }
      return `<button class="dl-seg ${got ? 'got' : ''} ${st.id === schoolStage ? 'on' : ''}" data-action="stage" data-id="${st.id}">
        <div class="dl-bar"><i style="width:${frac * 100}%"></i></div><span>${st.degree}</span>
        <div class="dl-majors">${majors}</div></button>`;
    }).join('');
    const degree = `<div class="degree-ladder">${ladder}</div>`;

    const ROW = 54;
    const H = Math.max(Math.max(before.length, after.length) * ROW + 16, 300); // room for the center card
    const W = { side: 148, gap: 38, mid: 230 };
    const xMid = W.side + W.gap;
    const xRight = xMid + W.mid + W.gap;
    const yOf = (list, i) => (H - list.length * ROW) / 2 + i * ROW + 5;
    const node = (item, list, i, x, dir) => {
      const y = yOf(list, i);
      return `<button class="fnode ${state(item.c)}" data-action="focus" data-id="${item.c.id}" data-dir="${dir}" style="left:${x}px;top:${y}px">
        <span>${item.c.icon}</span>${label(item.c)}</button>`;
    };
    const line = (x1, y1, x2, y2, ok) =>
      `<path class="edge ${ok ? 'done' : ''}" d="M${x1} ${y1} C${x1 + 26} ${y1} ${x2 - 26} ${y2} ${x2} ${y2}"/>`;
    const nodeOk = (item) => !!s.courses[item.c.id];
    const lines = [
      ...before.map((it, i) => line(W.side, yOf(before, i) + 22, xMid, H / 2, nodeOk(it))),
      ...after.map((it, i) => line(xMid + W.mid, H / 2, xRight, yOf(after, i) + 22, !!s.courses[sel.id])),
    ].join('');

    const st = state(sel);
    const fee = stage.fee;
    let btn;
    if (st === 'done') btn = '<button class="btn done" disabled>已学完</button>';
    else if (st === 'studying') btn = '<button class="btn" disabled>学习中</button>';
    else if (st === 'locked') btn = '<button class="btn" disabled>🔒</button>';
    else btn = `<button class="btn" data-action="study" data-id="${sel.id}" ${freeToAct() ? '' : 'disabled'}>上课</button>`;
    const sibBtn = (c, dir, ch) => (c
      ? `<button class="fc-nav" data-action="focus" data-id="${c.id}" data-dir="${dir}">${ch}</button>`
      : '<span class="fc-nav off">' + ch + '</span>');
    const center = `<div class="fcenter ${st}" style="left:${xMid}px;width:${W.mid}px">
      <div class="fc-top">${sibBtn(prevSib, 'back', '‹')}<small>${at + 1} / ${siblings.length}</small>${sibBtn(nextSib, 'fwd', '›')}</div>
      <div class="fc-ic">${sel.icon}</div><b>${label(sel)}</b>
      <div class="effs">${chip(`⏱ ${sel.minutes} 分`, '#868e96')}${fee ? chip(`🪙 ${fee}`, '#f59f00') : ''}</div>
      ${st === 'done' ? '' : `<div class="reqs">${reqChips(courseReqs(s, sel).slice(0, 1))}</div>`}
      ${btn}</div>`;

    const anim = treeDir;
    treeDir = '';
    return `<div class="stepper">${stepper}</div>${majorBar}
      <div class="card focus ${anim}"><div class="focus-in" style="width:${xRight + W.side}px;height:${H}px">
        <svg width="${xRight + W.side}" height="${H}">${lines}</svg>
        ${before.length ? '' : `<div class="fside-empty" style="left:0;width:${W.side}px">起点</div>`}
        ${before.map((it, i) => node(it, before, i, 0, 'back')).join('')}
        ${center}
        ${after.map((it, i) => node(it, after, i, xRight, 'fwd')).join('')}
      </div></div>${degree}`;
  },

  work() {
    const s = snap.s;
    const pills = [['all', '全部'], ['can', '可做']].map(([id, name]) =>
      `<button class="pill ${workFilter === id ? 'on' : ''}" data-action="workFilter" data-id="${id}">${name}</button>`).join('');
    const jobs = JOBS.filter((j) => workFilter === 'all' || allOk(jobReqs(s, j)));
    const rows = jobs.map((job) => {
      const reqs = jobReqs(s, job);
      const ok = allOk(reqs);
      const p = projected(job.drain, job.minutes);
      const working = s.activity?.type === 'work' && s.activity.id === job.id;
      return `<div class="card job ${ok ? '' : 'locked'}">
        <div class="job-ic">${job.icon}</div>
        <div class="job-main"><b>${job.name}</b>
          <div class="reqs">${reqChips(reqs)}</div>
          <div class="effs">${chip(`⏱ ${job.minutes} 分`, '#868e96')}${effChips(p)}</div></div>
        <div class="job-side"><span class="pay">🪙 ${job.pay}</span>
          ${working
            ? '<button class="btn" disabled>💪</button>'
            : ok
              ? `<button class="btn" data-action="work" data-id="${job.id}" ${freeToAct() ? '' : 'disabled'}>打工</button>`
              : '<button class="btn" disabled>🔒</button>'}
        </div></div>`;
    }).join('');
    return `<div class="pills">${pills}</div>
      <div class="jobs">${rows || '<div class="empty"><div class="empty-ic">🔒</div></div>'}</div>`;
  },

  games() {
    if (activeGame) {
      const g = MINIGAMES.find((x) => x.id === activeGame);
      return `<div class="game-head"><button class="btn ghost" data-action="games">←</button>
        <b>${g.icon} ${g.name}</b></div>
        <div class="card game-area" id="gameArea"></div>`;
    }
    const why = gameBlock();
    const s = snap.s;
    const got = s.playDay?.date === new Date().toDateString() ? s.playDay.got : 0;
    const left = Math.max(0, PLAY_EXP_DAILY - got);
    return `<div class="play-day"><span>⭐ 今日</span><div class="pbar"><i style="width:${(got / PLAY_EXP_DAILY) * 100}%"></i></div>
        <b>${Math.floor(got)} / ${PLAY_EXP_DAILY}</b></div>
      ${why ? `<div class="advice">${why}</div>` : ''}
      <div class="game-list">${MINIGAMES.map((g) => {
        const win = Math.min(PLAY_EXP[g.id].win, left);
        return `<button class="card game-card" data-action="game" data-id="${g.id}" ${why ? 'disabled' : ''}>
          <span class="game-ic">${g.icon}</span><b>${g.name}</b>
          <span class="eff" style="--c:#f59f00">⭐ +${win}</span></button>`;
      }).join('')}</div>`;
  },

  more() {
    const s = snap.s;
    const degs = degrees(s);
    return `<div class="card form"><h3>名字</h3>
        <div class="field"><input id="nameInput" maxlength="8" value="${esc(s.name)}" />
          <button class="btn" data-action="rename">保存</button></div></div>
      ${degs.length ? `<div class="card form"><h3>学历</h3>
        <div class="reqs left">${degs.map((d) => `<span class="req ok">🎓 ${d}</span>`).join('')}</div></div>` : ''}
      <div class="card form row-btns">
        <button class="btn ghost" data-action="reset">${resetArmed ? '⚠️ 确认重置' : '重置存档'}</button>
        <button class="btn ghost" data-action="quit">退出</button>
      </div>`;
  },
};

// Rebuild only when something the layout depends on changed; live numbers update in refresh()
function structKey() {
  if (page === 'games' && activeGame) return JSON.stringify(['games', activeGame, gameSession]);
  const s = snap.s;
  // cooldown labels count down in minutes
  const minuteTick = page === 'bag' || page === 'status' ? Math.floor(Date.now() / 60000) : 0;
  return JSON.stringify([
    page, s.inventory, Math.floor(s.money), s.level, s.courses, s.activity && [s.activity.type, s.activity.id],
    s.follow, s.name, resetArmed, shopCat, treeSel, schoolStage, schoolMajor, workFilter, gameBlock(), minuteTick,
    page === 'work' ? [Math.round(s.hunger), Math.round(s.energy)] : 0,
    s.helpReady, s.health >= MIN_HEALTH_TO_ACT, page === 'games' ? s.playDay : 0,
  ]);
}

function renderAll() {
  const p = NAV.find((n) => n.id === page);
  $('nav').innerHTML = NAV.map((n) => `<button class="nav-item ${n.id === page ? 'on' : ''}" data-action="go" data-id="${n.id}">
    <span>${n.icon}</span>${n.label}</button>`).join('');
  $('pageTitle').textContent = p.label;
  $('sideName').textContent = snap.s.name;
  $('sideTitle').textContent = educationTitle(snap.s);
  $('sideLevel').textContent = `Lv.${snap.s.level}`;
  const scroll = $('page').scrollTop;
  $('page').innerHTML = PAGES[page]();
  $('page').scrollTop = scroll;
  if (page === 'games' && activeGame) {
    const id = activeGame;
    MiniGames[id].start($('gameArea'), (result) => window.home.act('minigame', `${id}:${result}`));
  }
}

function refresh() {
  const s = snap.s;
  const need = expNeed(s.level);
  const expPct = s.level >= MAX_LEVEL ? 100 : (s.exp / need) * 100;
  const expText = s.level >= MAX_LEVEL ? 'MAX' : `${Math.floor(s.exp)} / ${need}`;
  $('sideExp').style.width = `${expPct}%`;
  document.querySelectorAll('[data-exp]').forEach((el) => (el.style.width = `${expPct}%`));
  document.querySelectorAll('[data-exptext]').forEach((el) => (el.textContent = expText));
  document.querySelectorAll('[data-val]').forEach((el) => (el.textContent = Math.round(s[el.dataset.val])));
  document.querySelectorAll('[data-ring]').forEach((el) => el.setAttribute('stroke-dasharray', `${s[el.dataset.ring]} 100`));
  document.querySelectorAll('[data-warn]').forEach((el) => el.classList.toggle('warn', s[el.dataset.warn] < 30));
  document.querySelectorAll('[data-remain]').forEach((el) => (el.textContent = fmtTime(snap.remain)));
  document.querySelectorAll('[data-progress]').forEach((el) => (el.style.width = `${snap.progress * 100}%`));
  Avatar.update(s, snap.sleeping);
}

function update() {
  if (!snap) return;
  const key = structKey();
  if (key !== lastKey) {
    lastKey = key;
    renderAll();
  }
  refresh();
}

function go(id) {
  if (!PAGES[id]) return;
  if (id !== page) $('page').scrollTop = 0;
  if (id !== 'games') activeGame = null;
  page = id;
  update();
}

let toastTimer;
function toast({ msg, ok }) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', !ok);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// The piggy in the sidebar mirrors the real pet's mood and growth
const Avatar = {
  init() {
    const mount = $('avatar');
    mount.innerHTML = PIG_SVG;
    this.root = mount;
    this.eyes = mount.querySelector('#eyes');
    this.mouth = mount.querySelector('#mouth');
    this.dirt = mount.querySelector('#dirt');
    this.face = null;
    this.formId = null;
    this.blink();
  },
  blink() {
    setTimeout(() => {
      if (this.face && FACES[this.face].eyes === 'normal') {
        this.eyes.classList.add('blink');
        setTimeout(() => this.eyes.classList.remove('blink'), 140);
      }
      this.blink();
    }, 2500 + Math.random() * 3000);
  },
  update(s, sleeping) {
    const face = moodFace(s, sleeping);
    if (face !== this.face) {
      this.face = face;
      renderFace(this.eyes, this.mouth, face);
    }
    const form = formFor(s.level).id;
    if (form !== this.formId) {
      this.formId = form;
      applyForm(this.root, form);
    }
    this.dirt.setAttribute('opacity', s.clean < 50 ? ((50 - s.clean) / 50).toFixed(2) : 0);
    this.root.classList.toggle('sick', s.health < 40);
    this.root.classList.toggle('sleeping', sleeping);
  },
};

// UI-only actions handled here; everything else goes to the pet window
const LOCAL = {
  go,
  shopCat: (id) => { shopCat = id; update(); },
  focus: (id, data) => {
    treeDir = data.dir || '';
    treeSel = id;
    schoolStage = COURSE_BY_ID[id].stage;
    update();
  },
  // show a stage (and major, at university) and focus its first course still to learn
  stage: (id) => {
    const list = COURSES.filter((c) => c.stage === id && (!c.major || c.major === schoolMajor));
    schoolStage = id;
    treeSel = (list.find((c) => !snap.s.courses[c.id]) || list[0]).id;
    treeDir = '';
    update();
  },
  major: (id) => {
    schoolMajor = id;
    LOCAL.stage(schoolStage);
  },
  workFilter: (id) => { workFilter = id; update(); },
  games: () => { activeGame = null; update(); },
  game: (id) => {
    if (gameBlock()) return toast({ msg: gameBlock(), ok: false });
    activeGame = id;
    gameSession++;
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
  if (LOCAL[action]) return LOCAL[action](id, el.dataset);
  if (action === 'reset' && !resetArmed) {
    resetArmed = true;
    update();
    setTimeout(() => {
      resetArmed = false;
      update();
    }, 3000);
    return;
  }
  if (action === 'reset') resetArmed = false;
  window.home.act(action, id);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'nameInput') window.home.act('rename', e.target.value);
  if (e.key === 'Escape') window.home.close();
});

Avatar.init();
window.home.onState((s) => {
  snap = s;
  update();
});
window.home.onToast(toast);
window.home.onTab(go);
window.home.ready();
