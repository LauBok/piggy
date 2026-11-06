// The pet's state and every game rule that changes it. Actions return { ok, msg, fx }.

const SAVE_VERSION = 2;

function defaultState() {
  return {
    v: SAVE_VERSION,
    name: '小猪',
    level: 1,
    exp: 0,
    hunger: 80,
    clean: 80,
    energy: 80,
    health: 100,
    mood: 80,
    money: 100,
    courses: {},
    inventory: { apple: 3, bread: 1, wipes: 2 },
    toyReady: {},
    toyBored: {},
    helpReady: {},
    hobbyReady: {},
    wear: { head: null, face: null },
    playDay: null,
    // neighbours: { [id]: { h: hearts, hi: day of the last hello, wish: day the last wish was granted } }
    npc: {},
    // the vegetable patch: one entry per plot, null or { seed, at: when it was planted }
    farm: Array(GARDEN_PLOTS).fill(null),
    // the salon's look: fur colour and hairstyle
    look: { color: 'pink', hair: '' },
    activity: null,
    follow: false,
    mini: false,
    lastTick: Date.now(),
  };
}

// Version 1 had no levels or courses: keep the pet's name, stats and money
function migrate(saved) {
  const s = defaultState();
  if (saved.v === SAVE_VERSION) return { ...s, ...saved };
  for (const k of ['name', 'money', 'follow', ...STAT_KEYS]) if (k in saved) s[k] = saved[k];
  s.inventory = Object.fromEntries(Object.entries(saved.inventory || {}).filter(([id]) => ITEM_BY_ID[id]));
  s.lastTick = saved.lastTick || Date.now();
  return s;
}

const fail = (msg) => ({ ok: false, msg });

const Game = {
  s: defaultState(),
  isNew: true,
  levelUps: 0,

  async load() {
    const saved = await window.pet.loadSave();
    if (saved) {
      this.s = migrate(saved);
      this.isNew = false;
    }
    const minutes = (Date.now() - this.s.lastTick) / 60000;
    if (minutes > 0) this.tick(Math.min(minutes, 12 * 60), true);
  },

  save() {
    this.s.lastTick = Date.now();
    window.pet.writeSave(this.s);
  },

  reset() {
    this.s = defaultState();
    this.save();
  },

  get title() {
    return educationTitle(this.s);
  },

  get form() {
    return formFor(this.s.level);
  },

  get sleeping() {
    return this.s.activity?.type === 'sleep';
  },

  get busy() {
    return !!this.s.activity && !this.sleeping;
  },

  apply(effects) {
    for (const [k, v] of Object.entries(effects)) {
      if (STAT_KEYS.includes(k)) this.s[k] = clamp(this.s[k] + v, 0, 100);
      else this.s[k] = Math.max(0, (this.s[k] || 0) + v);
    }
  },

  // Play exp left today (resets at local midnight)
  playExpToday() {
    const today = new Date().toDateString();
    if (this.s.playDay?.date !== today) this.s.playDay = { date: today, got: 0 };
    return this.s.playDay;
  },

  // Exp from playing, capped per day; returns a little "+n" label to float over the pig
  playExp(base) {
    const day = this.playExpToday();
    const n = Math.min(base, playCap(this.s) - day.got);
    if (n <= 0) return '';
    day.got += n;
    this.addExp(n);
    return ` +${n}`;
  },

  addExp(n) {
    const s = this.s;
    if (s.level >= MAX_LEVEL) return;
    s.exp += n;
    while (s.level < MAX_LEVEL && s.exp >= expNeed(s.level)) {
      s.exp -= expNeed(s.level);
      s.level++;
      this.levelUps++;
    }
  },

  // How the current activity changes stat drain, and how much extra exp it gives per minute
  activityEffect(a) {
    if (!a || a.type === 'bath') return { drain: {}, exp: 0 };
    if (a.type === 'study') return { drain: STUDY_DRAIN, exp: EXP_PER_MIN.study };
    if (a.type === 'work') return { drain: JOB_BY_ID[a.id].drain, exp: EXP_PER_MIN.work };
    return { drain: {}, exp: 0 };
  },

  // Advance by real minutes, in 1-minute steps so threshold rules and activity end times stay accurate.
  // While the app was closed or the computer slept, the pig counts as asleep (unless it was
  // busy studying or working, which then runs at half speed), and health can't drop below 20.
  tick(minutes, offline = false) {
    let t = Date.now() - minutes * 60000;
    while (minutes > 0) {
      const m = Math.min(1, minutes);
      minutes -= m;
      t += m * 60000;
      const s = this.s;
      const a = s.activity;
      const active = a && a.end && t <= a.end ? a : null;
      const sleeping = this.sleeping || (offline && !active);
      const r = offline && active ? 0.5 : 1;
      const eff = this.activityEffect(active);
      const rates = drainRates(sleeping ? SLEEP_DRAIN : eff.drain);
      const d = {
        hunger: rates.hunger * m * r,
        clean: rates.clean * m * r,
        mood: rates.mood * m * r * homeBonus(s, 'moodDrain'),
        energy: sleeping ? SLEEP_ENERGY_PER_MIN * homeBonus(s, 'sleep') * m : rates.energy * m * r,
        health: 0,
      };
      if (s.hunger < 20) d.health -= 0.3 * m * r;
      if (s.clean < 20) d.health -= 0.2 * m * r;
      if (s.energy < 10) d.health -= 0.1 * m * r;
      if (s.hunger > 40 && s.clean > 40 && s.mood > 30) d.health += 0.1 * m;
      if (sleeping && s.hunger > 20) d.health += 0.2 * m;
      if (s.hunger < 30) d.mood -= 0.15 * m * r;
      if (s.clean < 30) d.mood -= 0.1 * m * r;
      if (s.health < 40) d.mood -= 0.15 * m * r;
      const before = s.health;
      this.apply(d);
      if (offline) s.health = Math.max(s.health, Math.min(20, before));
      const alive = s.level < 6 ? EXP_PER_MIN.kidAlive : EXP_PER_MIN.alive;
      const studyBonus = active?.type === 'study' ? homeBonus(s, 'study') * npcPerk(s, 'study', 1) : 1;
      this.addExp(((s.health >= 30 ? alive : 0) + eff.exp * r * studyBonus) * m);
      this.selfCare();
    }
  },

  // The pig eats from its bag when hungry and takes medicine when sick, even with nobody around.
  // Messages pile up until takeSelfCare() shows them.
  selfCare() {
    const s = this.s;
    const useCheapest = (cat, stat, below) => {
      while (s[stat] < below) {
        const it = ITEMS.filter((i) => i.cat === cat && s.inventory[i.id] > 0 && i.effects[stat] > 0)
          .sort((x, y) => x.price - y.price)[0];
        if (!it) return;
        this.apply(it.effects);
        if (--s.inventory[it.id] <= 0) delete s.inventory[it.id];
        this.selfCareLog.push(it.name);
      }
    };
    useCheapest('food', 'hunger', SELF_FEED_BELOW);
    useCheapest('medicine', 'health', SELF_MEDICINE_BELOW);
  },

  selfCareLog: [],

  takeSelfCare() {
    if (!this.selfCareLog.length) return null;
    const counts = {};
    for (const n of this.selfCareLog) counts[n] = (counts[n] || 0) + 1;
    this.selfCareLog = [];
    const list = Object.entries(counts).map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join('、');
    return { ok: true, msg: `我自己从背包拿了${list}~`, fx: '😋' };
  },

  // A level-up message since the last call, if any
  takeLevelUp() {
    if (!this.levelUps) return null;
    this.levelUps = 0;
    const f = this.form;
    const grew = FORMS.find((x) => x.min === this.s.level);
    const extra = grew ? `，长成${f.name}啦` : '';
    const school = STAGES.find((st) => st.minLevel === this.s.level);
    const hint = school ? `，可以上${school.name}了！` : '！';
    return { ok: true, msg: `长大了！现在 Lv.${this.s.level}${extra}${hint}`, fx: '🎉' };
  },

  // ---------- timed activities ----------

  activityLabel(a = this.s.activity) {
    if (!a) return '';
    if (a.type === 'study') return `在上${COURSE_BY_ID[a.id].fullName}`;
    if (a.type === 'work') return `在${jobVerb(JOB_BY_ID[a.id])}`;
    if (a.type === 'bath') return '在洗澡';
    if (a.type === 'help') return FREE_HELP_BY_ID[a.id].label;
    if (a.type === 'hobby') return `在${HOBBY_BY_ID[a.id].name}`;
    return '在睡觉';
  },

  progress() {
    const a = this.s.activity;
    if (!a?.end) return 0;
    return clamp((Date.now() - a.start) / (a.end - a.start), 0, 1);
  },

  remaining() {
    const a = this.s.activity;
    return a?.end ? Math.max(0, (a.end - Date.now()) / 1000) : 0;
  },

  blocked() {
    if (this.busy) return `正${this.activityLabel()}呢`;
    if (this.sleeping) return '在睡觉呢…zzz';
    return null;
  },

  // Refuse if the pet is sick, or would run out of food or energy before finishing
  tooWeak(drain, minutes) {
    const s = this.s;
    if (s.health < MIN_HEALTH_TO_ACT) return `健康要到 ${MIN_HEALTH_TO_ACT} 才能去，先去诊所或吃药吧`;
    const p = projected(drain, minutes);
    if (s.hunger + p.hunger < 5) return `肚子太饿了，撑不完（要消耗饱食 ${-p.hunger}），先吃点东西吧`;
    if (s.energy + p.energy < 5) return `体力不够（要消耗体力 ${-p.energy}），先睡一觉吧`;
    return null;
  },

  begin(type, id, minutes) {
    const now = Date.now();
    this.s.activity = { type, id, start: now, end: now + minutes * 60000 };
  },

  startStudy(id) {
    const c = COURSE_BY_ID[id];
    if (this.s.courses[id]) return fail('这门课已经学完啦');
    const why = this.blocked();
    if (why) return fail(why);
    const miss = courseReqs(this.s, c).find((r) => !r.ok);
    if (miss) return fail(`还不能学，需要：${miss.text}`);
    const weak = this.tooWeak(STUDY_DRAIN, c.minutes);
    if (weak) return fail(weak);
    const fee = STAGE_BY_ID[c.stage].fee;
    if (this.s.money < fee) return fail(`学费要 ${fee} 金币，先去打工吧`);
    this.apply({ money: -fee });
    this.begin('study', id, c.minutes);
    return { ok: true, msg: `去上${c.fullName}啦，要 ${c.minutes} 分钟` };
  },

  startWork(id) {
    const job = JOB_BY_ID[id];
    const why = this.blocked();
    if (why) return fail(why);
    const miss = jobReqs(this.s, job).find((r) => !r.ok);
    if (miss) return fail(`还不能做，需要：${miss.text}`);
    const weak = this.tooWeak(job.drain, job.minutes);
    if (weak) return fail(weak);
    this.begin('work', id, job.minutes);
    return { ok: true, msg: `去${jobVerb(job)}，${job.minutes} 分钟后回来！` };
  },

  startBath() {
    const why = this.blocked();
    if (why) return fail(why);
    if (this.s.clean >= 98) return fail('已经很干净啦');
    this.begin('bath', null, BATH_MINUTES);
    return { ok: true, msg: '洗澡澡~' };
  },

  // Finish the activity if its time is up (also catches ones that ended while the app was closed)
  checkActivity() {
    const a = this.s.activity;
    if (!a) return null;
    if (a.type === 'sleep') {
      // asleep because you're away: keep sleeping until you come back
      if (this.s.energy < 100 || a.auto) return null;
      this.s.activity = null;
      return { ok: true, msg: '睡饱啦，精神满满！', fx: '☀️' };
    }
    if (Date.now() < a.end) return null;
    this.s.activity = null;

    if (a.type === 'study') {
      const c = COURSE_BY_ID[a.id];
      // a course can finish a degree (a general elective even several), so compare before and after
      const had = degrees(this.s);
      this.s.courses[a.id] = Date.now();
      this.addExp(10);
      const got = degrees(this.s).filter((d) => !had.includes(d));
      const grad = got.length ? ` 🎓 ${got.map((d) => (d.endsWith('毕业') ? `${d}啦` : `拿到${d}学位`)).join('，')}！` : '';
      return { ok: true, msg: `学完了「${c.fullName}」！${grad}`, fx: '📖✓' };
    }
    if (a.type === 'work') {
      const pay = payOf(this.s, JOB_BY_ID[a.id]);
      this.apply({ money: pay });
      this.addExp(5);
      return { ok: true, msg: `下班啦，赚了 ${pay} 金币！`, fx: `🪙+${pay}` };
    }
    if (a.type === 'help') {
      const h = FREE_HELP_BY_ID[a.id];
      this.apply(h.effects);
      if (a.id === 'meal') this.apply({ hunger: npcPerk(this.s, 'canteen', 0) });
      return { ok: true, msg: a.id === 'meal' ? '食堂的饭真香！' : '看过医生，好多了', fx: h.icon };
    }
    if (a.type === 'hobby') {
      const h = HOBBY_BY_ID[a.id];
      this.apply(hobbyEffects(this.s, h) || {});
      const lines = { piano: '弹得真好听~', paint: '画好啦，好看吗？', soccer: '踢球真开心！' };
      return { ok: true, msg: lines[h.id], fx: `${h.icon}${this.playExp(PLAY_EXP.hobby)}` };
    }
    const tub = homeBonus(this.s, 'bath');
    this.apply({ clean: Math.round(BATH_EFFECT.clean * tub), mood: Math.round(BATH_EFFECT.mood * tub) });
    return { ok: true, msg: '洗得香喷喷！', fx: '✨' };
  },

  cancel() {
    if (!this.busy) return null;
    this.s.activity = null;
    return { ok: true, msg: '不去了，回家~' };
  },

  // auto: fell asleep because nobody was around
  sleep(auto = false) {
    if (this.busy) return fail(`正${this.activityLabel()}呢`);
    if (this.sleeping) return fail('已经在睡啦');
    this.s.activity = { type: 'sleep', start: Date.now(), auto };
    return { ok: true, msg: auto ? '主人不在，我先睡啦…zzz' : '晚安…zzz' };
  },

  wake(byClick) {
    if (!this.sleeping) return null;
    this.s.activity = null;
    if (byClick && this.s.energy < 60) {
      this.apply({ mood: -5 });
      return { ok: true, msg: '被吵醒了，哼！' };
    }
    return { ok: true, msg: '早上好！' };
  },

  // ---------- instant actions ----------

  play() {
    const why = this.blocked();
    if (why) return fail(why);
    if (this.s.energy < 8) return fail('太累了，玩不动…');
    this.apply(PLAY_EFFECT);
    return { ok: true, msg: '好好玩！再来再来~', fx: `🎵${this.playExp(PLAY_EXP.play)}` };
  },

  // A mini game the player played against the pig; result is from the player's side.
  // The pig enjoys any game, and gloats a little more when it wins.
  minigame(name, result) {
    const why = this.blocked();
    if (why) return fail(why);
    if (this.s.energy < MINIGAME_COST.energy * -1) return fail('太累了，玩不动…');
    const mood = { win: 8, draw: 10, lose: 14 }[result];
    this.apply({ ...MINIGAME_COST, mood });
    const exp = this.playExp(PLAY_EXP[name][result]);
    const msg = {
      win: '你好厉害！下次我一定赢回来~',
      draw: '平局！再来一局？',
      lose: '耶！我赢啦！',
    }[result];
    return { ok: true, msg, fx: `${result === 'lose' ? '🏆' : '🎵'}${exp}`, result };
  },

  helpWait(id) {
    return Math.max(0, ((this.s.helpReady[id] || 0) - Date.now()) / 60000);
  },

  // Free canteen meal or clinic visit: takes a while, then on a cooldown
  help(id) {
    const h = FREE_HELP_BY_ID[id];
    const why = this.blocked();
    if (why) return fail(why);
    if (h.maxHealth && this.s.health >= h.maxHealth) return fail('很健康，不用看病');
    if (id === 'meal' && this.s.hunger >= 95) return fail('吃不下了…');
    const wait = this.helpWait(id);
    if (wait > 0) return fail(`${h.name}还要 ${Math.ceil(wait)} 分钟`);
    const cooldown = h.cooldown * (id === 'clinic' ? npcPerk(this.s, 'clinicCd', 1) : 1);
    this.s.helpReady[id] = Date.now() + cooldown * 60000;
    this.begin('help', id, h.minutes);
    return { ok: true, msg: `去${h.name}啦，${h.minutes} 分钟回来` };
  },

  hobbyWait(id) {
    return Math.max(0, ((this.s.hobbyReady[id] || 0) - Date.now()) / 60000);
  },

  // Piano, painting or football: unlocked by the electives, takes a few minutes
  startHobby(id) {
    const h = HOBBY_BY_ID[id];
    const why = this.blocked();
    if (why) return fail(why);
    const lock = hobbyLock(this.s, h);
    if (lock) return fail(lock.why === 'subject' ? `先上一节${lock.text}课吧` : `家里还没有${lock.text}，去商店买一个吧`);
    const effects = hobbyEffects(this.s, h);
    const wait = this.hobbyWait(id);
    if (wait > 0) return fail(`歇一会儿，${Math.ceil(wait)} 分钟后再${h.name}`);
    if (this.s.energy < -(effects.energy || 0)) return fail('太累了…');
    this.s.hobbyReady[id] = Date.now() + h.cooldown * 60000;
    this.begin('hobby', id, h.minutes);
    return { ok: true, msg: `去${h.name}啦~` };
  },

  toyWait(id) {
    return Math.max(0, ((this.s.toyReady[id] || 0) - Date.now()) / 60000);
  },

  // Eat food, use a hygiene item, take medicine or play with a toy
  use(id) {
    const it = ITEM_BY_ID[id];
    const s = this.s;
    if (!s.inventory[id]) return fail(`没有${it.name}了`);

    if (['furniture', 'decor'].includes(it.cat)) return fail(`${it.name}已经摆在家里啦`);
    if (it.cat === 'city') return fail(`${it.name}已经在城里啦`);

    // outfits: put on, or take off if already worn
    if (it.cat === 'wear') {
      const on = s.wear[it.slot] !== id;
      s.wear[it.slot] = on ? id : null;
      return { ok: true, msg: on ? `戴上${it.name}啦，好看吗？` : `摘下${it.name}`, fx: on ? '✨' : '' };
    }

    if (this.sleeping) return fail('在睡觉呢…zzz');

    if (it.cat === 'toy') {
      if (this.busy) return fail(`正${this.activityLabel()}，没空玩`);
      const wait = this.toyWait(id);
      if (wait > 0) return fail(`${it.name}刚玩过，${Math.ceil(wait)} 分钟后再玩吧`);
      if (s.energy < 5) return fail('太累了，玩不动…');
      const fun = toyFun(s, id);
      this.apply({ mood: Math.round(it.effects.mood * fun), ...TOY_COST });
      s.toyReady[id] = Date.now() + it.cooldown * 60000;
      s.toyBored[id] = { n: toyBoredom(s, id) + 1, at: Date.now() };
      const msg = fun < 0.5 ? `${it.name}有点玩腻了…` : `玩${it.name}好开心！`;
      return { ok: true, msg, fx: `${it.icon}${this.playExp(PLAY_EXP.toy)}` };
    }

    if (it.cat === 'food' && s.hunger >= 95) return fail('吃不下了…');
    if (it.cat === 'hygiene' && s.clean >= 98) return fail('已经很干净啦');
    if (it.cat === 'medicine' && s.health >= 100) return fail('很健康，不用吃药');
    // a kitchen at home makes food go further
    const food = it.cat === 'food' ? homeBonus(s, 'food') : 1;
    this.apply({ ...it.effects, ...(it.effects.hunger ? { hunger: Math.round(it.effects.hunger * food) } : {}) });
    if (--s.inventory[id] <= 0) delete s.inventory[id];
    if (it.cat === 'medicine') return { ok: true, msg: '吃了药，感觉好多了', fx: '💊' };
    if (it.cat === 'hygiene') return { ok: true, msg: '擦擦洗洗，干净啦~', fx: '✨' };
    const lines = ['好吃！', '真香~', '吧唧吧唧…', `${it.name}最棒了！`];
    return { ok: true, msg: lines[Math.floor(Math.random() * lines.length)], fx: '😋' };
  },

  // id: the item, or "shop:item" when bought in a shop (its keeper's discount applies)
  buy(id) {
    const [placeId, itemId] = String(id).includes(':') ? String(id).split(':') : [null, id];
    const it = ITEM_BY_ID[itemId];
    const why = buyBlock(this.s, it, placeId);
    if (why) return fail(why);
    this.apply({ money: -priceOf(this.s, it, placeId) });
    id = itemId;
    this.s.inventory[id] = (this.s.inventory[id] || 0) + 1;
    if (it.cat === 'city') return { ok: true, msg: `捐建了${it.name}，猪猪城更漂亮啦！`, fx: '🎉' };
    if (['furniture', 'decor'].includes(it.cat)) return { ok: true, msg: `${it.name}送到家啦`, fx: '🏠' };
    return { ok: true, msg: `买了${it.name}，放进背包啦` };
  },

  // ---------- the salon ----------

  // id: "color:<id>" or "hair:<id>"
  restyle(id) {
    const [kind, val] = String(id).split(':');
    const list = kind === 'color' ? LOOK_COLORS : LOOK_HAIR;
    const opt = list.find((o) => o.id === (val || ''));
    if (!opt) return fail('没有这种造型');
    if (this.s.look[kind] === opt.id) return fail('现在就是这个样子啦');
    if (this.s.money < opt.price) return fail('金币不够…去打工赚钱吧');
    this.apply({ money: -opt.price });
    this.s.look = { ...this.s.look, [kind]: opt.id };
    return { ok: true, msg: kind === 'color' ? `换成${opt.name}啦，好看吗？` : `新发型：${opt.name}！`, fx: '✨' };
  },

  // ---------- the vegetable patch ----------

  plant(plot, seedId) {
    const s = this.s;
    const seed = ITEM_BY_ID[seedId];
    if (!seed || seed.cat !== 'seed') return fail('这不是种子');
    if (s.farm[plot]) return fail('这块地已经种上了');
    if (!s.inventory[seedId]) return fail(`没有${seed.name}了，去农牧市场买吧`);
    if (--s.inventory[seedId] <= 0) delete s.inventory[seedId];
    s.farm[plot] = { seed: seedId, at: Date.now() };
    return { ok: true, msg: `种下了${seed.name}，${fmtGrow(seed.grow)}后就能收啦`, fx: '🌱' };
  },

  // Harvest every ripe plot
  harvest() {
    const s = this.s;
    const got = {};
    s.farm.forEach((p, i) => {
      if (!p || plotProgress(p) < 1) return;
      const seed = ITEM_BY_ID[p.seed];
      s.inventory[seed.crop] = (s.inventory[seed.crop] || 0) + seed.yield;
      got[seed.crop] = (got[seed.crop] || 0) + seed.yield;
      s.farm[i] = null;
    });
    const list = Object.entries(got);
    if (!list.length) return fail('还没有熟的菜');
    this.apply({ mood: 3 });
    this.addExp(2 * list.length);
    return { ok: true, msg: `收获了${list.map(([id, n]) => `${ITEM_BY_ID[id].name}×${n}`).join('、')}！`, fx: list.map(([id]) => ITEM_BY_ID[id].icon).join('') };
  },

  // ---------- neighbours ----------

  npcRec(id) {
    return (this.s.npc[id] ||= { h: 0 });
  },

  addHearts(id, n) {
    const rec = this.npcRec(id);
    const before = rec.h;
    rec.h = Math.min(NPC_MAX_HEARTS, rec.h + n);
    const name = NPC_BY_ID[id].name;
    if (before < NPC_PERK_HEARTS && rec.h >= NPC_PERK_HEARTS) return NPC_BY_ID[id].perk ? `${name}和你成了好朋友：${NPC_BY_ID[id].perk.text}！` : `${name}和你成了好朋友！`;
    if (before < NPC_MAX_HEARTS && rec.h >= NPC_MAX_HEARTS) return `${name}最喜欢你了，店里有专属好东西！`;
    return '';
  },

  // Say hi: the first hello of the day makes them like the pig a little more
  greet(id) {
    const n = NPC_BY_ID[id];
    const line = n.hello[Math.floor(Math.random() * n.hello.length)];
    if (greetedToday(this.s, id)) return { ok: true, msg: `${n.name}：${line}` };
    this.npcRec(id).hi = dayKey();
    this.apply({ mood: 2 });
    const up = this.addHearts(id, 1);
    return { ok: true, msg: up || `${n.name}：${line}`, fx: '💗' };
  },

  // Give a neighbour what they wished for today
  give(id) {
    const n = NPC_BY_ID[id];
    const wish = npcWish(id);
    if (!wish || wishDone(this.s, id)) return fail(`${n.name}今天什么都不缺`);
    const it = ITEM_BY_ID[wish];
    if (!this.s.inventory[wish]) return fail(`背包里还没有${it.name}`);
    if (--this.s.inventory[wish] <= 0) delete this.s.inventory[wish];
    this.npcRec(id).wish = dayKey();
    this.apply({ mood: 5 });
    const up = this.addHearts(id, 2);
    return { ok: true, msg: up || `${n.name}收下了${it.name}，好开心！`, fx: '💗💗' };
  },
};
