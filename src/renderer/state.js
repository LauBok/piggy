// The pet's state and every game rule that changes it. Actions return { ok, msg, fx }.

const SAVE_VERSION = 2;

function defaultState() {
  return {
    v: SAVE_VERSION,
    // which pig this is (several can be kept, see Game.rejuvenate) and when it was born
    pigId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    born: Date.now(),
    name: '小猪',
    level: 1,
    exp: 0,
    hunger: 80,
    clean: 80,
    energy: 80,
    health: 100,
    mood: 80,
    money: 100,
    // finished courses (when), and lessons done of the ones still going
    courses: {},
    lessons: {},
    inventory: { apple: 3, bread: 1, wipes: 2 },
    toyReady: {},
    toyBored: {},
    helpReady: {},
    hobbyReady: {},
    wear: { head: null, face: null },
    playDay: null,
    // neighbours, by id: p friendship points; days (as dayKey) of the last hello (hi), present
    // (gift), wish granted (wish) and thing done together (tog); got { d, n } points today;
    // cn { d, n } chats today; ev stories seen; fav favourites found; said the last few lines;
    // mem answers to their questions; seen what they last knew of the pig, for news
    // (lv level, dg degrees, ht house, rk rank, wr look, gift / duel the last ones mentioned);
    // look: the pig's looks already remarked on today; duel: the day of the last game together;
    // tea, vg: the days of the last cup at their house and of the last present on leaving it
    npc: {},
    // the vegetable patch: one entry per plot, null or { seed, at: when it was planted }
    farm: Array(GARDEN_PLOTS).fill(null),
    // every shift worked, at any job (career seniority)
    shifts: 0,
    // the day pocket money was last given
    allowanceDay: null,
    // shares owned in each business, when they last paid, and coins not yet paid out
    biz: { owned: {}, at: Date.now(), cash: 0 },
    // money in the bank, and when interest was last paid
    bank: { balance: 0, at: Date.now() },
    // the look from the beauty parlour and the barber: fur colour and hairstyle
    look: { color: 'pink', hair: '' },
    // the photo album, oldest first: { k what, w with whom, at where, d day, t when, lv, look,
    // wear: how the pig looked } (see Game.photo)
    album: [],
    // when the pig can go fishing again
    fishReady: 0,
    activity: null,
    follow: false,
    mini: false,
    lastTick: Date.now(),
    // Pig City's own time (see TOWN_SPEED): t, the town's moment as at real moment at
    clock: { t: Date.now(), at: Date.now() },
  };
}

// Version 1 had no levels or courses: keep the pet's name, stats and money
function migrate(saved) {
  const s = defaultState();
  if (saved.v === SAVE_VERSION) {
    const out = { ...s, ...saved };
    // seniority used to be per job: it now counts every shift
    if (saved.jobXp && saved.shifts == null) out.shifts = Object.values(saved.jobXp).reduce((a, b) => a + b, 0);
    delete out.jobXp;
    // friendship used to be whole hearts: the same hearts in points
    for (const rec of Object.values(out.npc || {})) {
      if (rec.h != null && rec.p == null) rec.p = pointsFor(rec.h);
      delete rec.h;
    }
    // the town's clock starts at the real time
    out.clock ||= { t: Date.now(), at: saved.lastTick || Date.now() };
    out.pigId ||= s.pigId;
    out.born ||= s.born;
    // keepsakes promised in a story told before they could be given
    for (const [id, st] of Object.entries(NPC_STORIES)) {
      for (const [k, x] of Object.entries(st)) if (x.give && out.npc?.[id]?.ev?.includes(+k)) out.inventory[x.give] ||= 1;
    }
    return out;
  }
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
    TOWN_SAVE = this.s;
    const minutes = (Date.now() - this.s.lastTick) / 60000;
    if (minutes > 0) this.tick(Math.min(minutes, 12 * 60), true);
    // anything beyond the 12 hours caught up on goes by in town at real time too
    this.s.clock.t += Math.max(0, Date.now() - this.s.clock.at);
    this.s.clock.at = Date.now();
    await this.loadPigs();
  },

  save() {
    this.s.lastTick = Date.now();
    window.pet.writeSave(this.s);
  },

  reset() {
    this.s = defaultState();
    TOWN_SAVE = this.s;
    this.save();
  },

  // ---------- pigs kept from before ----------
  // A grown-up pig can drink the rejuvenation potion: it's kept just as it is, and a brand-new pig
  // starts, a whole new save (nothing carried over, the town as new). A kept pig can be taken
  // back out; the one playing now is kept in its place.

  pigs: [],

  // Just enough of each to show in 设置, newest kept first
  async loadPigs() {
    const all = await window.pet.listPigs();
    this.pigs = all
      .map(migrate)
      .map((p) => ({ pigId: p.pigId, name: p.name, level: p.level, degree: degrees(p).at(-1) || '', born: p.born, kept: p.kept }))
      .sort((a, b) => b.kept - a.kept);
  },

  // Keep the pig playing now, with when it was put away
  keep() {
    this.s.kept = Date.now();
    this.save();
    window.pet.keepPig(this.s);
  },

  rejuvenate() {
    const why = this.blocked();
    if (why) return fail(why);
    this.keep();
    this.s = defaultState();
    TOWN_SAVE = this.s;
    this.isNew = true;
    this.save();
    return { ok: true, msg: '你好呀！右键点我去猪猪城~', fx: '🍼' };
  },

  // Play with a kept pig again. Time stood still for it while it was kept: no hunger, no
  // interest, the town's clock where it was.
  switchPig(id) {
    const why = this.blocked();
    if (why) return fail(why);
    this.keep();
    const saved = window.pet.takePig(id);
    if (!saved) return fail('找不到这只小猪了');
    const s = migrate(saved);
    const now = Date.now();
    const away = now - (s.kept || now);
    s.lastTick = now;
    s.clock.at = now;
    if (s.bank) s.bank.at += away;
    if (s.biz) s.biz.at += away;
    delete s.kept;
    this.s = s;
    TOWN_SAVE = s;
    this.isNew = false;
    this.save();
    return { ok: true, msg: `${s.name}回来啦~` };
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
      // what a level brings with it (the gold hat at Lv.29)
      for (const it of ITEMS) if (it.prize === s.level) s.inventory[it.id] = 1;
    }
  },

  // How the current activity changes stat drain, and how much extra exp it gives per minute
  activityEffect(a) {
    if (!a || a.type === 'bath') return { drain: {}, exp: 0 };
    if (a.type === 'study') return { drain: STUDY_DRAIN, exp: EXP_PER_MIN.study };
    if (a.type === 'work') return { drain: JOB_BY_ID[a.id].drain, exp: this.s.level < 6 ? 0 : EXP_PER_MIN.work };
    return { drain: {}, exp: 0 };
  },

  // Advance by real minutes, in 1-minute steps so threshold rules and activity end times stay accurate.
  // While the app was closed or the computer slept, the pig counts as asleep (unless it was
  // busy studying or working, which then earns half the exp). Asleep, needs fall slowly and stop
  // at 20, and health can't drop below 20, so no pig wakes up ill after a night.
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
      // the town's clock: fast while he's free and the app is open, real time otherwise
      const c = (s.clock ||= { t, at: t });
      c.t += Math.max(0, t - c.at) * (offline || s.activity ? 1 : TOWN_SPEED);
      c.at = t;
      const eff = this.activityEffect(active);
      const rates = drainRates(sleeping ? SLEEP_DRAIN : eff.drain);
      // asleep, an empty tummy or a dirty coat hurts less and spoils the mood much less
      const hurt = sleeping ? 0.5 : 1;
      const sulk = sleeping ? 0.2 : 1;
      const d = {
        hunger: rates.hunger * m,
        clean: rates.clean * m,
        mood: rates.mood * m * homeBonus(s, 'moodDrain'),
        energy: sleeping ? SLEEP_ENERGY_PER_MIN * homeBonus(s, 'sleep') * m : rates.energy * m,
        health: 0,
      };
      if (s.hunger < 20) d.health -= 0.3 * m * hurt;
      if (s.clean < 20) d.health -= 0.2 * m * hurt;
      if (s.energy < 10) d.health -= 0.1 * m * hurt;
      if (s.hunger > 40 && s.clean > 40 && s.mood > 30) d.health += 0.1 * m;
      if (sleeping && s.hunger > 20) d.health += 0.2 * m;
      if (s.hunger < 30) d.mood -= 0.15 * m * sulk;
      if (s.clean < 30) d.mood -= 0.1 * m * sulk;
      if (s.health < 40) d.mood -= 0.15 * m * sulk;
      const before = { hunger: s.hunger, clean: s.clean, mood: s.mood, health: s.health };
      this.apply(d);
      if (sleeping) for (const k of Object.keys(before)) s[k] = Math.max(s[k], Math.min(SLEEP_FLOOR, before[k]));
      else if (offline) s.health = Math.max(s.health, Math.min(SLEEP_FLOOR, before.health));
      const alive = s.level < 6 ? EXP_PER_MIN.kidAlive : EXP_PER_MIN.alive;
      const studyBonus = active?.type === 'study' ? homeBonus(s, 'study') * npcPerk(s, 'study', 1) * this.majorExp(active.id) : 1;
      this.addExp(((s.health >= 30 ? alive : 0) + eff.exp * r * studyBonus) * m);
      this.selfCare();
    }
    this.payInterest();
    this.payBusiness();
  },

  // A second major at a stage the pig already holds a degree of grows it only half as much
  majorExp(courseId) {
    const c = COURSE_BY_ID[courseId];
    if (!c.major) return 1;
    return MAJORS.some((m) => m.id !== c.major && stageDone(this.s, c.stage, m.id)) ? 0.5 : 1;
  },

  // Pocket money the first time each day the pig is awake with you, while still a kid
  takeAllowance() {
    const s = this.s;
    if (s.level >= ALLOWANCE.belowLevel || this.sleeping || s.allowanceDay === dayKey()) return null;
    s.allowanceDay = dayKey();
    this.apply({ money: ALLOWANCE.amount });
    return { ok: true, msg: '谢谢主人的零花钱~', fx: `🪙+${ALLOWANCE.amount}` };
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
    const s = this.s;
    const grew = FORMS.find((x) => x.min === s.level);
    const school = STAGES.find((st) => st.minLevel === s.level);
    // a lesson that opens at this level, in a course the pig is already taking or can start now
    const newLesson = COURSES.some((c) => {
      const k = lessonsDone(s, c) + 1;
      return k <= c.lessons && lessonLevel(c, k) === s.level && (k > 1 || allOk(courseReqs(s, c)));
    });
    // one piece of news, the most important
    let news = '';
    const prize = ITEMS.find((it) => it.prize === s.level);
    if (s.level === MAX_LEVEL) news = '长到最大啦！';
    else if (prize) news = `收到一顶${prize.name}`;
    else if (school) news = `可以去上${school.name}了`;
    else if (grew) news = `长成${grew.name}了`;
    else if (newLesson) news = '学校有新课了';
    const pocket = s.level === ALLOWANCE.belowLevel ? '，以后不要零花钱啦，自己赚！' : '';
    return { ok: true, msg: `升到 Lv.${s.level} 啦！${news}${pocket}`, fx: '🎉' };
  },

  // ---------- timed activities ----------

  activityLabel(a = this.s.activity) {
    if (!a) return '';
    if (a.type === 'study') {
      const c = COURSE_BY_ID[a.id];
      return `在上${lessonName(c, Math.min(c.lessons, lessonsDone(this.s, c) + 1))}`;
    }
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
    if (s.hunger + p.hunger < 5) return '太饿了，撑不下来，先吃点东西吧';
    if (s.energy + p.energy < 5) return '太累了，撑不下来，先睡一觉吧';
    return null;
  },

  begin(type, id, minutes) {
    const now = Date.now();
    this.s.activity = { type, id, start: now, end: now + minutes * 60000 };
  },

  startStudy(id) {
    const c = COURSE_BY_ID[id];
    if (this.s.courses[id]) return fail('这门课已经学完啦');
    const k = lessonsDone(this.s, c) + 1;
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
    return { ok: true, msg: `去上${lessonName(c, k)}啦，${c.minutes} 分钟后下课` };
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
      const s = this.s;
      this.addExp(EXP_PER_LESSON * this.majorExp(a.id));
      const n = lessonsDone(s, c) + 1;
      if (n < c.lessons) {
        s.lessons[a.id] = n;
        return { ok: true, msg: `上完${lessonName(c, n)}啦`, fx: '📖' };
      }
      // a course can finish a degree (a general elective even several), so compare before and after
      const had = degrees(s);
      delete s.lessons[a.id];
      s.courses[a.id] = Date.now();
      const got = degrees(s).filter((d) => !had.includes(d));
      const grad = got.length ? ` 🎓 ${got.map((d) => (d.endsWith('毕业') ? `${d}啦` : `拿到${d}学位`)).join('，')}！` : '';
      return { ok: true, msg: `学完了「${c.fullName}」！${grad}`, fx: '📖' };
    }
    if (a.type === 'work') {
      const job = JOB_BY_ID[a.id];
      const pay = payOf(this.s, job);
      const rank = careerRank(this.s);
      this.apply({ money: pay });
      if (this.s.level >= 6) this.addExp(EXP_PER_SHIFT);
      this.s.shifts = (this.s.shifts || 0) + 1;
      const r = careerRank(this.s);
      const up = r > rank ? ` 干得越来越熟练，工资涨了 ${Math.round((RANK_PAY - 1) * 100)}%！` : '';
      return { ok: true, msg: `下班啦，赚了 ${pay} 金币！${up}`, fx: `🪙+${pay}` };
    }
    if (a.type === 'help') {
      const h = FREE_HELP_BY_ID[a.id];
      this.apply(h.effects);
      if (a.id === 'meal') this.apply({ hunger: npcPerk(this.s, 'canteen', 0) });
      const done = {
        meal: '食堂的饭真香！', clinic: '看过医生，好多了', soak: '泡得浑身舒服，精神满满！', movie: `《${filmToday()}》真好看！`,
        cafe: '喝得暖暖的~', read: '这本书真有意思！', ducks: '鸭子都吃饱啦！', garden: '菜园收拾好啦，菜长得更快了！', kite: '风筝飞得好高！', stars: '今晚的星星真亮！',
      }[a.id];
      return { ok: true, msg: done, fx: h.icon };
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

  // Free canteen meal or clinic visit: takes a while, then on a cooldown. people: how many the pig
  // is paying for.
  help(id, people = 1) {
    const h = FREE_HELP_BY_ID[id];
    const fee = (h.fee || 0) * people;
    const why = this.blocked();
    if (why) return fail(why);
    if (h.maxHealth && this.s.health >= h.maxHealth) return fail('很健康，不用看病');
    if (id === 'meal' && this.s.hunger >= 95) return fail('吃不下了…');
    if (fee && this.s.money < fee) return fail(`${h.name}要 ${fee} 金币`);
    if (id === 'soak' && this.s.energy >= 95) return fail('精神好着呢，不用泡');
    if (h.park && !parkOpen()) return fail(`游乐园 ${Math.floor(PARK_HOURS[0] / 60)}:00 开放`);
    if (id === 'fireworks' && !fireworksOn()) return fail('现在没有烟花');
    const fest = OUTINGS.find((o) => o.festival === id);
    if (fest && !outingOn(this.s, fest)) return fail(`现在没有${h.name}`);
    const wait = this.helpWait(id);
    if (wait > 0) return fail(`${{ meal: '刚吃过', clinic: '刚看过病', soak: '刚泡过', movie: '刚看过一场' }[id] || '刚去过'}，${Math.ceil(wait)} 分钟后再来吧`);
    const cooldown = h.cooldown * (id === 'clinic' ? npcPerk(this.s, 'clinicCd', 1) : 1);
    this.s.helpReady[id] = Date.now() + cooldown * 60000;
    if (fee) this.apply({ money: -fee });
    this.begin('help', id, h.minutes);
    // the rides, the fireworks and the festivals: what he's off to do
    const fun = h.park || id === 'fireworks' || fest;
    if (fun && people === 1) this.photo(id);
    if (fun) return { ok: true, msg: `${h.label.slice(1)}去啦，${h.minutes} 分钟回来` };
    return { ok: true, msg: id === 'movie' ? `看《${filmToday()}》去啦，${h.minutes} 分钟回来` : `去${h.name}啦，${h.minutes} 分钟回来` };
  },

  // ---------- the photo album ----------

  // A photo of what the pig is doing (k), with whom (w), where (at): one of each a day
  photo(k, w = '', at = '') {
    const s = this.s;
    const d = dayKey();
    if (s.album.some((p) => p.k === k && p.w === w && p.d === d)) return false;
    s.album.push({ k, w, at, d, t: Date.now(), lv: s.level, look: { ...s.look }, wear: { ...s.wear } });
    return true;
  },

  // 📷 with a neighbour, wherever they are: "id:place"
  snapPhoto(arg) {
    const [id, at] = String(arg).split(':');
    if (!this.photo('snap', id, at)) return fail('今天已经一起拍过啦');
    return { ok: true, msg: `和${NPC_BY_ID[id].name}拍了张合影，放进相册啦`, fx: '📷' };
  },

  // ---------- fishing ----------

  // Why the pig can't fish right now, or ''
  fishWhy() {
    const why = this.blocked();
    if (why) return why;
    if (this.s.energy < -FISH_COST.energy) return '太累了';
    const wait = Math.ceil(((this.s.fishReady || 0) - Date.now()) / 60000);
    return wait > 0 ? `${wait} 分钟后` : '';
  },

  // A go at fishing is over: what was caught ("id,id,…"; misses left out)
  fish(arg) {
    const why = this.fishWhy();
    if (why) return fail(why);
    const got = String(arg || '').split(',').filter((id) => ITEM_BY_ID[id]?.cat === 'fish').slice(0, FISH_CASTS);
    this.s.fishReady = Date.now() + FISH_COOLDOWN * 60000;
    this.apply(FISH_COST);
    for (const id of got) this.s.inventory[id] = (this.s.inventory[id] || 0) + 1;
    // something special goes in the album
    const best = got.find((id) => ['koi', 'octopus'].includes(id));
    if (best) this.photo(`fish:${best}`);
    if (!got.length) return { ok: true, msg: '一条都没钓到…下次再来', fx: '🎣' };
    const n = {};
    for (const id of got) n[id] = (n[id] || 0) + 1;
    return { ok: true, msg: `钓到了${Object.entries(n).map(([id, k]) => `${ITEM_BY_ID[id].name}${k > 1 ? `×${k}` : ''}`).join('、')}`, fx: `🎣${ITEM_BY_ID[best || got[0]].icon}` };
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
    if (it.cat === 'fish') return fail(it.id === 'boot' ? '这个……不能吃吧' : `生的${it.name}可不能吃…`);

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
      const msg = it.book ? (fun < 0.5 ? `${it.name}都快背下来了…` : `${it.name}真有意思！`) : fun < 0.5 ? `${it.name}有点玩腻了…` : `玩${it.name}好开心！`;
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

  // Selling what the vegetable patch grew to the barn: "item" for one, "item:all" for all of it
  sell(arg) {
    const [id, all] = String(arg).split(':');
    const it = ITEM_BY_ID[id];
    const s = this.s;
    if (!it || !barnGoods().includes(it)) return fail('谷仓不收这个');
    const have = s.inventory[id] || 0;
    if (!have) return fail(`没有${it.name}了`);
    const n = all ? have : 1;
    const coins = barnPrice(it) * n;
    if ((s.inventory[id] -= n) <= 0) delete s.inventory[id];
    this.apply({ money: coins });
    return { ok: true, msg: `卖了${n}个${it.name}，得了 ${coins} 金币`, fx: `🪙+${coins}` };
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

  // 跑腿: a basket "id:count,id:count" is paid for (goods plus the delivery fee) and lands in the bag
  order(basket) {
    const cart = {};
    for (const part of String(basket).split(',')) {
      const [id, k] = part.split(':');
      const n = Math.floor(Number(k) || 1);
      if (!deliveryItems().some((it) => it.id === id) || n <= 0) return fail('这个要去店里买');
      cart[id] = (cart[id] || 0) + n;
    }
    const bill = deliveryBill(cart);
    if (!bill.goods) return fail('还没选东西');
    if (this.s.money < bill.total) return fail('金币不够…');
    this.apply({ money: -bill.total });
    for (const [id, n] of Object.entries(cart)) this.s.inventory[id] = (this.s.inventory[id] || 0) + n;
    return { ok: true, msg: '跑腿送到啦，放进背包了', fx: '🛵' };
  },

  // ---------- the bank ----------

  // Pay interest for every full day since the last payment
  payInterest() {
    const b = this.s.bank;
    const days = Math.floor((Date.now() - b.at) / DAY_MS);
    if (days <= 0) return;
    const before = b.balance;
    for (let i = 0; i < days; i++) b.balance += Math.min(Math.floor(b.balance * BANK_RATE), BANK_DAILY_CAP);
    b.at += days * DAY_MS;
    this.interestPaid += b.balance - before;
  },

  interestPaid: 0,

  // Interest that arrived since the last call, as a message
  takeInterest() {
    const n = this.interestPaid;
    if (n < 1) return null;
    this.interestPaid = 0;
    return { ok: true, msg: `银行给了 ${n.toLocaleString()} 金币利息~`, fx: `🪙+${n.toLocaleString()}` };
  },

  // id: an amount, or "all"
  deposit(id) {
    const n = id === 'all' ? Math.floor(this.s.money) : Number(id);
    if (!(n > 0)) return fail('没有可以存的钱');
    if (n > this.s.money) return fail('身上没有这么多钱');
    this.payInterest();
    this.s.money -= n;
    this.s.bank.balance += n;
    return { ok: true, msg: `存了 ${n} 金币，每天都有利息`, fx: '🐷' };
  },

  withdraw(id) {
    const b = this.s.bank;
    this.payInterest();
    const n = id === 'all' ? b.balance : Number(id);
    if (!(n > 0) || !b.balance) return fail('存钱罐里是空的');
    if (n > b.balance) return fail('存钱罐里没有这么多');
    b.balance -= n;
    this.s.money += n;
    return { ok: true, msg: `取出 ${n} 金币`, fx: `🪙+${n}` };
  },

  // ---------- businesses ----------

  // Pay what the businesses earned since last time (the cents wait for the next payment)
  payBusiness() {
    const b = (this.s.biz ||= { owned: {}, at: Date.now(), cash: 0 });
    const now = Date.now();
    b.cash += (bizIncome(this.s) * Math.max(0, now - b.at)) / DAY_MS;
    b.at = now;
    const whole = Math.floor(b.cash);
    if (whole > 0) {
      b.cash -= whole;
      this.s.money += whole;
      b.earned = (b.earned || 0) + whole;
    }
  },

  invest(id) {
    const biz = BUSINESS_BY_ID[id];
    if (!biz) return fail('没有这家店');
    if (this.s.level < biz.minLevel) return fail(`Lv.${biz.minLevel} 才能投资${biz.name}`);
    const price = bizPrice(this.s, biz);
    if (this.s.money < price) return fail(`要 ${price.toLocaleString()} 金币`);
    this.payBusiness();
    this.apply({ money: -price });
    this.s.biz.owned[id] = bizOwned(this.s, id) + 1;
    return { ok: true, msg: `入股了${biz.name}，每天多分 ${biz.income.toLocaleString()} 金币！`, fx: biz.icon };
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
    if (!list.length) return fail('还没有可以收获的菜');
    this.apply({ mood: 3 });
    this.addExp(2 * list.length);
    return { ok: true, msg: `收获了${list.map(([id, n]) => `${ITEM_BY_ID[id].name}×${n}`).join('、')}！`, fx: list.map(([id]) => ITEM_BY_ID[id].icon).join('') };
  },

  // ---------- neighbours ----------
  // Talking returns { talk: { id, ... } } for the town to show over their head: line, or story
  // (the hearts of a heart story to play), ask (a question: { k, a: two answers }), face (an
  // emoji over their head) and gain (whether friendship grew).

  npcRec(id) {
    return (this.s.npc[id] ||= { p: 0 });
  },

  // Friendship points, up to the day's cap. Past the cap they're just as glad and nothing says
  // so; the hearts only stop moving. up: the toast for a heart that unlocks something.
  befriend(id, n) {
    const rec = this.npcRec(id);
    const day = dayKey();
    if (rec.got?.d !== day) rec.got = { d: day, n: 0 };
    const add = Math.max(0, Math.min(n, npcDailyCap(id) - rec.got.n, pointsFor(NPC_MAX_HEARTS) - (rec.p || 0)));
    if (!add) return { gained: false, up: '' };
    const before = hearts(this.s, id);
    rec.p = (rec.p || 0) + add;
    rec.got.n += add;
    const h = hearts(this.s, id);
    const npc = NPC_BY_ID[id];
    let up = '';
    if (before < NPC_PERK_HEARTS && h >= NPC_PERK_HEARTS) up = npc.perk ? `${npc.name}和你成了好朋友！以后${npc.perk.text}` : `${npc.name}和你成了好朋友！`;
    else if (before < NPC_MAX_HEARTS && h >= NPC_MAX_HEARTS) up = npc.spot == null ? `${npc.name}最喜欢你了，店里有专属好东西！` : `${npc.name}最喜欢你了！`;
    return { gained: true, up };
  },

  talked(talk, gain = { gained: false, up: '' }) {
    talk.gain = gain.gained;
    return { ok: true, msg: gain.up, fx: gain.gained ? '💗' : '', talk };
  },

  // A line from a pool that wasn't said lately (each neighbour remembers their last five)
  sayFrom(id, key, lines) {
    const rec = this.npcRec(id);
    const said = rec.said || [];
    const fresh = (lines || []).map((l, i) => [l, `${key}.${i}`]).filter(([, k]) => !said.includes(k));
    if (!fresh.length) return null;
    const [line, k] = fresh[Math.floor(Math.random() * fresh.length)];
    rec.said = [...said, k].slice(-5);
    return line;
  },

  helloLine(id) {
    const T = NPC_TALK[id];
    const mem = this.npcRec(id).mem || {};
    const memo = Object.entries(T.hiMemo || {}).find(([k]) => mem[k] != null);
    if (memo && Math.random() < 0.5) return memo[1][mem[memo[0]]];
    return this.sayFrom(id, 'hi', T.hi) || T.hi[0];
  },

  // What a neighbour knows of the pig, to notice what's new next time
  pigNow() {
    const s = this.s;
    return { lv: s.level, dg: degrees(s).length, ht: homeTier(s), rk: careerRank(s), wr: JSON.stringify([s.wear, s.look]) };
  },

  // Something that happened since they last saw the pig: grad, house, grew, rank, or yesterday's
  // present or game. Each is news once.
  npcNews(id) {
    const rec = this.npcRec(id);
    const now = this.pigNow();
    const seen = rec.seen;
    const yesterday = new Date(Date.now() - DAY_MS).toDateString();
    let news = null;
    if (now.lv >= MAX_LEVEL && seen.lv < MAX_LEVEL) news = 'max';
    else if (now.dg > seen.dg) news = 'grad';
    else if (now.ht > seen.ht) news = 'house';
    else if (now.lv > seen.lv) news = 'grew';
    else if (now.rk > seen.rk) news = 'rank';
    else if (rec.gift === yesterday && seen.gift !== yesterday) news = 'gift';
    else if (rec.duel === yesterday && seen.duel !== yesterday) news = 'played';
    rec.seen = { ...seen, lv: now.lv, dg: now.dg, ht: now.ht, rk: now.rk, gift: rec.gift, duel: rec.duel };
    return news;
  },

  // What to say on 💬: news first, then how the pig looks (each remark once a day), now and then
  // a question, else something about what they're doing, the time, or how well they know the pig
  chatLine(id) {
    const T = NPC_TALK[id];
    const s = this.s;
    const rec = this.npcRec(id);
    const news = this.npcNews(id);
    if (news === 'max') return { line: NPC_MAX_NEWS[id] };
    if (news && T.news[news]) return { line: T.news[news] };
    const day = dayKey();
    if (rec.look?.d !== day) rec.look = { d: day, k: [] };
    const wr = this.pigNow().wr;
    const dressed = rec.seen.wr !== wr && !!(s.wear.head || s.wear.face || s.look.color !== 'pink' || s.look.hair);
    rec.seen.wr = wr;
    const looks = { sick: s.health < 50, hungry: s.hunger < 35, dirty: s.clean < 35, tired: s.energy < 25, sad: s.mood < 30, dressed };
    const look = Object.keys(looks).find((k) => looks[k] && T.pig?.[k] && !rec.look.k.includes(k));
    if (look) {
      rec.look.k.push(look);
      return { line: T.pig[look] };
    }
    const ask = (T.ask || []).find((q) => rec.mem?.[q.k] == null);
    if (ask && Math.random() < 0.2) return { line: ask.q, ask: { k: ask.k, a: ask.a } };
    const plan = npcPlan(id);
    const h = hearts(s, id);
    const tier = h >= 8 ? 2 : h >= 4 ? 1 : 0;
    const part = dayPart();
    const memo = Object.entries(T.memo || {}).filter(([k]) => rec.mem?.[k] != null).map(([k, l]) => l[rec.mem[k]]);
    // [key, lines, weight]: what they're doing comes up most
    const said = rec.said || [];
    const pools = [['at', T.at?.[`${plan.act}@${plan.where}`] || T.at?.[plan.act], 3], [`time.${part}`, part ? T.time[part] : null, 1],
      [`tier${tier}`, T.tier[tier], 2], ['memo', memo, 1]].filter(([key, lines]) => lines?.some((_, i) => !said.includes(`${key}.${i}`)));
    let r = Math.random() * pools.reduce((n, p) => n + p[2], 0);
    for (const [key, lines, w] of pools) {
      if ((r -= w) <= 0) return { line: this.sayFrom(id, key, lines) };
    }
    return { line: T.tier[tier][Math.floor(Math.random() * T.tier[tier].length)] };
  },

  // Meeting someone in town: the first hello of the day makes them like the pig a little more,
  // and a heart story that's due is told instead of the hello
  meet(id, story = true) {
    const rec = this.npcRec(id);
    rec.seen ||= this.pigNow();
    const first = !greetedToday(this.s, id);
    let gain;
    if (first) {
      rec.hi = dayKey();
      this.apply({ mood: 2 });
      gain = this.befriend(id, NPC_POINTS.hello);
    }
    const k = story ? storyDue(this.s, id) : null;
    if (k != null) {
      (rec.ev ||= []).push(k);
      const give = NPC_STORIES[id][k].give;
      if (give) this.s.inventory[give] = 1;
      return this.talked({ id, story: k }, gain);
    }
    if (first && isBirthday(id)) return this.talked({ id, line: NPC_TALK[id].bday }, gain);
    // a festival: on the day a greeting, and that festival's food from a friend; in the days
    // before, they ask the pig along
    const fest = first && festivalOn();
    if (fest) {
      const F = NPC_FESTIVAL_TALK[id][fest.id];
      if (!story || hearts(this.s, id) < FESTIVAL_GIFT_HEARTS) return this.talked({ id, line: F.day }, gain);
      const food = ITEM_BY_ID[fest.food];
      this.s.inventory[food.id] = (this.s.inventory[food.id] || 0) + 1;
      const res = this.talked({ id, line: F.gift, face: '😊' }, gain);
      return { ...res, msg: res.msg || `收到${NPC_BY_ID[id].name}送的${food.name}`, fx: food.icon };
    }
    const soon = first && festivalSoon();
    if (soon) return this.talked({ id, line: NPC_FESTIVAL_TALK[id][soon.f.id].invite }, gain);
    return this.talked({ id, line: this.helloLine(id) }, gain);
  },

  // Saying hi from afar (the friends page): no stories, those need meeting in person
  greet(id) {
    return this.meet(id, false);
  },

  // 💬: the first chat of the day counts a little; the fourth winds up, after that just hellos
  chat(id) {
    const rec = this.npcRec(id);
    rec.seen ||= this.pigNow();
    const day = dayKey();
    if (rec.cn?.d !== day) rec.cn = { d: day, n: 0 };
    const n = ++rec.cn.n;
    const gain = n === 1 ? this.befriend(id, NPC_POINTS.chat) : undefined;
    const T = NPC_TALK[id];
    if (n === 4) return this.talked({ id, line: T.bye }, gain);
    if (n > 4) return this.talked({ id, line: this.helloLine(id) }, gain);
    return this.talked({ id, ...this.chatLine(id) }, gain);
  },

  // An answer to their question ("id:key:0" or 1): they remember it
  answer(arg) {
    const [id, k, i] = String(arg).split(':');
    const q = NPC_TALK[id].ask.find((x) => x.k === k);
    (this.npcRec(id).mem ||= {})[k] = +i;
    return this.talked({ id, line: q.r[+i] });
  },

  // A choice made in a heart story that they keep in mind ("id:key:0" or 1)
  remember(arg) {
    const [id, k, i] = String(arg).split(':');
    (this.npcRec(id).mem ||= {})[k] = +i;
    return {};
  },

  // A present ("id:item"), one a day each. How much it counts goes by how they take it.
  gift(arg) {
    const [id, itemId] = String(arg).split(':');
    const npc = NPC_BY_ID[id];
    const it = ITEM_BY_ID[itemId];
    const s = this.s;
    // what they wished for can always be given, whatever it is
    const wished = itemId === npcWish(id) && !wishDone(s, id);
    if (!it || !(GIFT_CATS.includes(it.cat) || wished) || !s.inventory[itemId]) return fail(`背包里没有${it?.name || '这个'}了`);
    if (giftedToday(s, id)) return fail(`${npc.name}今天已经收过礼物啦`);
    const tier = giftTier(s, id, itemId);
    if (--s.inventory[itemId] <= 0) delete s.inventory[itemId];
    const rec = this.npcRec(id);
    rec.seen ||= this.pigNow();
    rec.gift = dayKey();
    if (tier === 'wish') rec.wish = dayKey();
    if (npc.loves.includes(itemId) && !(rec.fav ||= []).includes(itemId)) rec.fav.push(itemId);
    this.apply({ mood: tier === 'wish' ? 5 : 3 });
    // a favourite counts extra on their birthday, also when it was the wish
    const love = npc.loves.includes(itemId) ? (isBirthday(id) ? NPC_POINTS.birthdayLove : NPC_POINTS.love) : 0;
    const gain = this.befriend(id, Math.max(NPC_POINTS[tier], love));
    const say = NPC_TALK[id].gift;
    let line = say[tier] || say.plain;
    if (typeof line === 'object') line = line[itemId] || line._;
    const face = { wish: '💗💗', love: '😍', like: '😊', plain: '🙂', dislike: '😅' }[tier];
    return this.talked({ id, line, face }, gain);
  },

  // Give a neighbour what they wished for today (from their card, without picking it out)
  give(id) {
    const npc = NPC_BY_ID[id];
    const wish = npcWish(id);
    if (!wish || wishDone(this.s, id)) return fail(`${npc.name}今天什么都不缺`);
    return this.gift(`${id}:${wish}`);
  },

  // Doing something together ("id:walk", "id:play", or an outing: "id:movie"…); the first time each
  // day counts. An outing is the pig doing that thing (a help or a hobby) with them alongside,
  // the pig paying for both.
  together(arg) {
    const [id, kind] = String(arg).split(':');
    const npc = NPC_BY_ID[id];
    const s = this.s;
    const o = OUTING_BY_ID[kind];
    if (hearts(s, id) < TOGETHER_HEARTS[o ? 'go' : kind]) return fail(`和${npc.name}再熟一点吧`);
    const why = this.blocked();
    if (why) return fail(why);
    if (o) {
      if (!outingOn(s, o)) return fail('现在去不了');
      const r = o.hobby ? this.startHobby(o.hobby) : this.help(o.help, 2);
      if (!r.ok) return r;
      s.activity.with = id;
      // a friend in the garden: everything growing comes on a little
      if (kind === 'garden') for (const p of s.farm) if (p) p.at -= GARDEN_HELP_MIN * 60000;
      this.photo(kind, id);
    }
    const rec = this.npcRec(id);
    let gain;
    if (rec.tog !== dayKey()) {
      rec.tog = dayKey();
      gain = this.befriend(id, NPC_POINTS.together);
    }
    const T = o ? outingTalk(id, kind) : NPC_TALK[id][kind];
    const fav = o && NPC_OUTINGS_TALK[id]?.fav === kind ? NPC_OUTINGS_TALK[id].favLine : null;
    return this.talked({ id, line: o ? T.sit : T.go, fav, together: kind }, gain);
  },

  // ☕ at someone's house: sitting down together for a cup, once a day each. Cheers him up; the
  // friendship comes from hellos and presents, not from this.
  tea(id) {
    const rec = this.npcRec(id);
    if (rec.tea === dayKey()) return fail('今天已经喝过啦');
    rec.tea = dayKey();
    this.apply({ mood: 5 });
    this.photo('tea', id);
    return { ok: true, talk: { id, tea: true } };
  },

  // Going home after a visit: a neighbour who's a good friend gives him a little something, the
  // first visit of a day
  farewell(id) {
    const v = NPC_VISITS[id];
    const rec = this.npcRec(id);
    if (!v?.gift || hearts(this.s, id) < NPC_PERK_HEARTS || rec.vg === dayKey()) return {};
    rec.vg = dayKey();
    this.s.inventory[v.gift] = (this.s.inventory[v.gift] || 0) + 1;
    return { ok: true, msg: `${NPC_BY_ID[id].name}：${v.bye}`, fx: ITEM_BY_ID[v.gift].icon };
  },

  // A mini game played against a neighbour ("id:game:result", result from the player's side):
  // the same as any game for the pig, and they say something about how it went
  duel(arg) {
    const [id, game, result] = String(arg).split(':');
    const res = this.minigame(game, result);
    if (!res.ok) return res;
    this.npcRec(id).duel = dayKey();
    return { ok: true, fx: res.fx, result, talk: { id, line: NPC_TALK[id].play[result], duel: true } };
  },
};
