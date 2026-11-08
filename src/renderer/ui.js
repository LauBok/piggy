// Pet window UI: speech bubble, the busy progress chip, the hover overview card and the 🛵 跑腿 panel.

const STAT_LOW = 30;
const BAG_CATS = ['food', 'hygiene', 'medicine'];

// What the pig is busy with, as an icon
function busyIcon(a) {
  if (!a) return '';
  if (a.type === 'study') return COURSE_BY_ID[a.id]?.icon || '📖';
  if (a.type === 'work') return JOB_BY_ID[a.id]?.icon || '💼';
  if (a.type === 'help') return FREE_HELP_BY_ID[a.id]?.icon || '🩺';
  if (a.type === 'hobby') return HOBBY_BY_ID[a.id]?.icon || '🎵';
  if (a.type === 'kinder') return KINDER_BY_ID[a.id]?.icon || '🧸';
  if (a.type === 'sleep') return '😴';
  return '🛁';
}

const ringSvg = (key) => `<svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="14.5"/>
  <circle class="vl" cx="18" cy="18" r="14.5" pathLength="100" stroke="var(--st-${key})" transform="rotate(-90 18 18)"/></svg>`;

// Every stat an item changes if used now: { hunger: 15, mood: 2 }
function useEffects(s, it) {
  const food = it.cat === 'food' ? homeBonus(s, 'food') : 1;
  const out = {};
  for (const [k, v] of Object.entries(it.effects || {})) if (STAT_KEYS.includes(k)) out[k] = k === 'hunger' ? Math.round(v * food) : v;
  return out;
}

const UI = {
  qbOpen: false,
  cart: {},
  preview: null,
  qbKey: '',
  lastSay: { text: '', until: 0 },

  init() {
    const $ = (id) => document.getElementById(id);
    this.bubble = $('bubble');
    this.progress = $('progress');
    this.hud = $('hud');

    const tiles = STATS.map(
      (st) => `<div class="stat" data-stat="${st.key}">${ringSvg(st.key)}
        <span class="ic">${st.icon}</span><b data-val="${st.key}"></b><small>${st.name}</small></div>`
    ).join('');
    this.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-top"><b id="hudName"></b><span class="lv" id="hudLevel"></span>
          <span class="spacer"></span><span class="coinpill"><i>🪙</i><b data-val="money"></b></span></div>
        <div class="exprow"><div class="expbar"><i id="hudExp"></i></div><small id="hudExpNum"></small></div>
        <div class="stats">${tiles}</div>
        <div class="says" id="hudSays"><span id="hudSaysIc">💬</span><span id="hudSaysText"></span><time id="hudSaysTime"></time></div>
        <div class="hud-btns">
          <button class="hud-btn" id="homeBtn">🏠 去猪猪城</button>
          <button class="hud-sq" id="qbBtn">🛵<i class="dot"></i></button>
          <button class="hud-sec" id="miniBtn"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h4v4M13 3 8.5 7.5M7 13H3V9M3 13l4.5-4.5"/></svg>迷你</button>
        </div>
      </div>
      <div class="qb" id="qb"></div>`;
    $('homeBtn').addEventListener('click', () => window.pet.openHome('status'));
    $('miniBtn').addEventListener('click', () => {
      this.closeQuick();
      App.act('mini');
    });
    $('qbBtn').addEventListener('click', () => this.openQuick());
    this.hudName = $('hudName');
    this.hudLevel = $('hudLevel');
    this.hudExp = $('hudExp');
    this.hudExpNum = $('hudExpNum');
    this.hudSays = $('hudSays');
    this.hudSaysIc = $('hudSaysIc');
    this.hudSaysText = $('hudSaysText');
    this.hudSaysTime = $('hudSaysTime');
    this.qb = $('qb');

    this.progress.innerHTML = `<div class="pg-l"><em id="pgIcon"></em><span id="pgLabel"></span><time id="pgTime"></time></div>
      <div class="track"><i id="progressBar"></i></div><div class="pg-meta"><span id="pgPct"></span><span id="pgGain"></span></div>`;
    this.pgIcon = $('pgIcon');
    this.pgLabel = $('pgLabel');
    this.pgTime = $('pgTime');
    this.pgPct = $('pgPct');
    this.pgGain = $('pgGain');
    this.progressBar = $('progressBar');

    // the 跑腿 panel: tap a tile to put one in the basket, right-click to take one out
    this.qb.addEventListener('click', (e) => {
      const b = e.target.closest('[data-qb]');
      if (!b) return;
      const [act, id] = b.dataset.qb.split(':');
      if (act === 'close') return this.closeQuick();
      if (act === 'add') {
        if (b.classList.contains('no')) return UI.say('金币不够…');
        this.cart[id] = (this.cart[id] || 0) + 1;
      } else if (act === 'order') {
        const list = Object.entries(this.cart).map(([k, n]) => `${k}:${n}`).join(',');
        if (!list) return;
        this.cart = {};
        App.act('order', list);
      } else if (act === 'use') {
        App.act('use', id);
      }
      this.refresh();
    });
    this.qb.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const b = e.target.closest('[data-qb^="add:"]');
      if (!b) return;
      const id = b.dataset.qb.split(':')[1];
      if (!this.cart[id]) return;
      if (--this.cart[id] <= 0) delete this.cart[id];
      this.refresh();
    });
    this.qb.addEventListener('mouseover', (e) => {
      const b = e.target.closest('[data-qb^="use:"], [data-qb^="add:"]');
      const id = b ? b.dataset.qb.split(':')[1] : null;
      if (id === this.preview) return;
      this.preview = id;
      this.paintStats();
    });
    this.qb.addEventListener('mouseleave', () => {
      this.preview = null;
      this.paintStats();
    });
    this.qb.addEventListener('wheel', (e) => {
      const row = e.target.closest('.qb-bag');
      if (row) row.scrollLeft += e.deltaY;
    });
    this.hud.addEventListener('mouseenter', () => clearTimeout(this.qbTimer));
    this.hud.addEventListener('mouseleave', () => {
      if (!this.qbOpen) return;
      clearTimeout(this.qbTimer);
      this.qbTimer = setTimeout(() => this.closeQuick(), 3000);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.qbOpen) this.closeQuick();
    });
  },

  openQuick() {
    if (document.body.classList.contains('mini')) return;
    this.qbOpen = true;
    this.qbKey = '';
    this.preview = null;
    this.hud.classList.add('qb-open');
    this.renderQuick();
  },

  closeQuick() {
    clearTimeout(this.qbTimer);
    if (!this.qbOpen) return;
    this.qbOpen = false;
    this.hud.classList.remove('qb-open');
  },

  // Rebuilt only when something it shows changed, so a click never lands on a replaced button
  renderQuick() {
    const s = Game.s;
    const money = Math.floor(s.money);
    const key = JSON.stringify([money, s.inventory, STAT_KEYS.map((k) => Math.round(s[k])), this.cart]);
    if (key === this.qbKey) return;
    this.qbKey = key;

    const bag = ITEMS.filter((it) => BAG_CATS.includes(it.cat) && s.inventory[it.id] > 0);
    const bagRow = bag.map((it) => `<button class="qb-bi" data-qb="use:${it.id}">
          <span class="ic">${it.icon}</span><i class="cnt">${s.inventory[it.id]}</i></button>`).join('');
    const tiles = deliveryItems().map((it) => {
      const n = this.cart[it.id] || 0;
      const no = deliveryBill({ ...this.cart, [it.id]: n + 1 }).total > money;
      return `<button class="qb-it ${no ? 'no' : ''} ${n ? 'in' : ''}" data-qb="add:${it.id}">
        <span class="ic">${it.icon}</span><em>🪙${it.price}</em>${n ? `<i class="have">${n}</i>` : ''}</button>`;
    }).join('');
    const bill = deliveryBill(this.cart);
    const sums = bill.total
      ? `<div class="qb-pay"><span>配送费 <b>🪙${bill.fee}</b></span><span>合计 <b class="tot">🪙${bill.total}</b></span>
          <button class="qb-go" data-qb="order">下单</button></div>`
      : '';
    this.qb.innerHTML = `
      <div class="qb-head"><span class="qb-title">🛵 跑腿</span><span class="spacer"></span>
        <span class="coinpill"><i>🪙</i><b>${money}</b></span>
        <button class="qb-x" data-qb="close">${ICON.close}</button></div>
      <div class="qb-stats">${STATS.map((st) => `<div class="qs" data-qs="${st.key}" style="--c: var(--st-${st.key})">
        <span class="qs-top">${st.icon}<b></b></span><span class="qs-bar"><i class="v"></i><i class="d"></i></span></div>`).join('')}</div>
      ${bag.length ? `<div class="qb-bag">${bagRow}</div>` : ''}
      <div class="qb-grid">${tiles}</div>
      ${sums}`;
    this.paintStats();
  },

  // The panel's five stat bars; while an item is pointed at, its use is previewed:
  // a pale segment for what it adds, a faded part for what it takes away
  paintStats() {
    const s = Game.s;
    const it = this.preview && ITEM_BY_ID[this.preview];
    const eff = it ? useEffects(s, it) : {};
    this.qb.querySelectorAll('[data-qs]').forEach((el) => {
      const k = el.dataset.qs;
      const from = clamp(Math.round(s[k]), 0, 100);
      const to = clamp(from + (eff[k] || 0), 0, 100);
      const v = el.querySelector('.v');
      const d = el.querySelector('.d');
      v.style.width = `${Math.min(from, to)}%`;
      d.style.left = `${Math.min(from, to)}%`;
      d.style.width = `${Math.abs(to - from)}%`;
      el.classList.toggle('gain', to > from);
      el.classList.toggle('loss', to < from);
      el.classList.toggle('low', to < STAT_LOW);
      el.querySelector('b').textContent = to;
    });
  },

  say(text, ms = 3500) {
    if (document.body.classList.contains('mini')) return; // mini mode stays quiet
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    this.lastSay = { text, until: Date.now() + Math.max(ms, 6000) };
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.bubble.classList.remove('show'), ms);
    this.refreshSays();
  },

  // The card's one line: what was just said, else what the pig is busy with
  refreshSays() {
    let ic = '';
    let text = '';
    let time = '';
    if (Date.now() < this.lastSay.until) {
      ic = '💬';
      text = this.lastSay.text;
    } else if (Game.s.activity) {
      ic = busyIcon(Game.s.activity);
      text = Game.sleeping ? '睡觉中…' : Game.activityLabel();
      if (!Game.sleeping) time = fmtTime(Game.remaining());
    }
    this.hudSays.classList.toggle('on', !!text);
    this.hudSaysIc.textContent = ic;
    if (this.hudSaysText.textContent !== text) this.hudSaysText.textContent = text;
    this.hudSaysTime.textContent = time;
  },

  // Per-second update of live numbers
  refresh() {
    const s = Game.s;

    this.hudName.textContent = s.name;
    this.hudLevel.textContent = `Lv.${s.level}`;
    const max = s.level >= MAX_LEVEL;
    const need = expNeed(s.level);
    this.hudExp.style.width = max ? '100%' : `${Math.min(100, (s.exp / need) * 100)}%`;
    this.hudExpNum.textContent = max ? '满级' : `${Math.floor(s.exp)} / ${need}`;
    this.hud.querySelectorAll('[data-val]').forEach((el) => (el.textContent = Math.round(s[el.dataset.val])));
    let anyLow = false;
    this.hud.querySelectorAll('[data-stat]').forEach((el) => {
      const k = el.dataset.stat;
      const v = s[k];
      const low = v < STAT_LOW;
      anyLow ||= low;
      el.querySelector('.vl').setAttribute('stroke-dasharray', `${Math.max(0, v)} 100`);
      el.classList.toggle('low', low);
    });
    document.getElementById('qbBtn').classList.toggle('alert', anyLow);
    this.refreshSays();
    if (this.qbOpen) this.renderQuick();

    const busy = Game.busy;
    document.body.classList.toggle('busy', busy);
    this.progress.classList.toggle('show', busy);
    if (busy) {
      const a = s.activity;
      const p = Game.progress();
      this.pgIcon.textContent = busyIcon(a);
      this.pgLabel.textContent = Game.activityLabel();
      this.pgTime.textContent = fmtTime(Game.remaining());
      this.progressBar.style.width = `${p * 100}%`;
      this.pgPct.textContent = `${Math.floor(p * 100)}%`;
      let gain = '';
      if (a.type === 'work' && JOB_BY_ID[a.id]) gain = `完成 <b>🪙 +${payOf(s, JOB_BY_ID[a.id])}</b>`;
      this.pgGain.innerHTML = gain;
    }
  },
};
