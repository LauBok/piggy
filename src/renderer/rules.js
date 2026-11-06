// Pure rule helpers that read a save state `s` and never change it.
// Shared by the pet window (game logic) and the home window (display).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Credits earned toward a major's degree at a university stage: its own courses and general electives
const stageCredits = (s, stageId, majorId) =>
  COURSES.filter((c) => c.stage === stageId && (c.major === majorId || c.general) && s.courses[c.id]).reduce((n, c) => n + c.credits, 0);

// Graduated from a stage: every required course done (electives don't count before university),
// and from university up, enough credits for that major too
function stageDone(s, stageId, majorId) {
  const st = STAGE_BY_ID[stageId];
  if (st.byMajor && !majorId) return MAJORS.some((m) => stageDone(s, stageId, m.id));
  const required = COURSES.filter((c) => c.stage === stageId && !c.elective && (!majorId || c.major === majorId)).every((c) => s.courses[c.id]);
  return required && (!st.credits || stageCredits(s, stageId, majorId) >= st.credits);
}

// How far an elective subject was studied: 0 (not at all) to 3 (high school)
const subjectLevel = (s, subject) => COURSES.filter((c) => c.subject === subject && s.courses[c.id]).length;

// Combined furniture bonus for one effect (sleep, bath, study, moodDrain, piano, paint):
// the best item owned in each furniture group counts, and groups multiply
function homeBonus(s, key) {
  const best = {};
  for (const it of ITEMS) {
    if (it.cat !== 'furniture' || !s.inventory[it.id]) continue;
    if (!best[it.group] || it.price > best[it.group].price) best[it.group] = it;
  }
  return Object.values(best).reduce((k, it) => k * (it.bonus[key] ?? 1), 1);
}

// Owns what a hobby needs: a furniture group (any piano) or an item (the ball)
const hasTool = (s, tool) =>
  ITEM_BY_ID[tool] ? !!s.inventory[tool] : ITEMS.some((it) => it.group === tool && s.inventory[it.id]);

// Why a hobby can't be done yet ({ why: 'subject' | 'tool', text }), or null
function hobbyLock(s, hobby) {
  if (!subjectLevel(s, hobby.subject)) return { why: 'subject', text: SUBJECT_BY_ID[hobby.subject].name };
  if (!hasTool(s, hobby.tool)) return { why: 'tool', text: hobby.toolName };
  return null;
}

// A hobby's effects for this pig: stronger the further its subject was studied and with
// better furniture; null if locked
function hobbyEffects(s, hobby) {
  if (hobbyLock(s, hobby)) return null;
  const k = (1 + 0.3 * (subjectLevel(s, hobby.subject) - 1)) * homeBonus(s, hobby.id);
  return Object.fromEntries(Object.entries(hobby.effects).map(([key, v]) => [key, v > 0 ? Math.round(v * k) : v]));
}

function reqMet(s, token) {
  if (token.startsWith('deg:')) {
    const [, stageId, majorId] = token.split(':');
    return stageDone(s, stageId, majorId);
  }
  return !!s.courses[token];
}

function reqName(token) {
  if (token.startsWith('deg:')) {
    const [, stageId, majorId] = token.split(':');
    const stage = STAGE_BY_ID[stageId];
    return majorId ? `${MAJOR_BY_ID[majorId].name}${stage.degree}` : stage.degree;
  }
  return COURSE_BY_ID[token].fullName;
}

// Everything a course needs, as [{ text, ok }]
function courseReqs(s, c) {
  const stage = STAGE_BY_ID[c.stage];
  const reqs = [{ text: `Lv.${stage.minLevel}`, ok: s.level >= stage.minLevel }];
  if (stage.needs) reqs.push({ text: STAGE_BY_ID[stage.needs].degree, ok: stageDone(s, stage.needs) });
  for (const t of c.prereq) reqs.push({ text: reqName(t), ok: reqMet(s, t) });
  return reqs;
}

function jobReqs(s, job) {
  return [
    { text: `Lv.${job.minLevel}`, ok: s.level >= job.minLevel },
    ...job.requires.map((t) => ({ text: reqName(t), ok: reqMet(s, t) })),
  ];
}

const allOk = (reqs) => reqs.every((r) => r.ok);

// How bored the pig is with a toy right now (plays' worth, wearing off over time)
function toyBoredom(s, id) {
  const b = s.toyBored?.[id];
  if (!b) return 0;
  const hours = TOY_BORED_RECOVER_H / npcPerk(s, 'toyRecover', 1);
  return Math.max(0, b.n - (Date.now() - b.at) / 3600000 / hours);
}

// ---------- neighbours ----------

const dayKey = () => new Date().toDateString();

function hashStr(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const hearts = (s, id) => s.npc?.[id]?.h || 0;
const greetedToday = (s, id) => s.npc?.[id]?.hi === dayKey();
const wishDone = (s, id) => s.npc?.[id]?.wish === dayKey();

// The value of a neighbour's perk once they like the pig enough, or `base`
function npcPerk(s, key, base) {
  const n = NPCS.find((x) => x.perk?.key === key && hearts(s, x.id) >= NPC_PERK_HEARTS);
  return n ? n.perk.v : base;
}

// Who runs a shop (null if nobody does)
const keeperOf = (placeId) => NPCS.find((n) => n.place === placeId && n.spot == null) || null;

// A shop's price multiplier for this pig: the friendlier its keeper, the cheaper
function shopDiscount(s, placeId) {
  const k = keeperOf(placeId);
  if (!k) return 1;
  return (SHOP_DISCOUNTS.find(([h]) => hearts(s, k.id) >= h) || [0, 1])[1];
}

// What an item costs this pig in a shop
const priceOf = (s, it, placeId) => (placeId ? Math.round(it.price * shopDiscount(s, placeId)) : it.price);

// Hearts a hidden item needs before it's sold (0: not hidden)
const heartsNeeded = (it) => (it.npc ? it.hearts || NPC_MAX_HEARTS : 0);
const hiddenLocked = (s, it) => !!it.npc && hearts(s, it.npc) < heartsNeeded(it);

const payOf = (s, job) => Math.round(job.pay * npcPerk(s, 'pay', 1));
const playCap = (s) => PLAY_EXP_DAILY + npcPerk(s, 'playCap', 0);

// The item a neighbour wishes for today, or null. A few neighbours a day each want one cheap
// thing, picked so it's sold somewhere other than their own shop.
function npcWish(id, day = dayKey()) {
  const wishers = [...NPCS].sort((a, b) => hashStr(day + a.id) - hashStr(day + b.id)).slice(0, NPC_WISHES_PER_DAY);
  if (!wishers.some((n) => n.id === id)) return null;
  const own = NPC_BY_ID[id].perk?.cats || [];
  const pool = ITEMS.filter((it) => WISH_CATS.includes(it.cat) && !it.npc && it.price <= WISH_MAX_PRICE && !own.includes(it.cat));
  return pool[hashStr(id + day) % pool.length].id;
}

// ---------- home ----------

// The best house owned: 0 小猪窝 (the one every pig starts with) … 3 城堡
const homeTier = (s) => Math.max(0, ...ITEMS.filter((it) => it.tier && s.inventory[it.id]).map((it) => it.tier));
const ownedDecor = (s) => ITEMS.filter((it) => it.cat === 'decor' && s.inventory[it.id]);
const decorSlots = (s) => DECOR_SLOTS[homeTier(s)];
const HOUSE_NAMES = ['小猪窝', '温馨公寓', '花园别墅', '猪猪城堡'];

// Why an item can't be bought right now, or null
function buyBlock(s, it, placeId) {
  if (ONCE_CATS.includes(it.cat) && s.inventory[it.id]) return `已经有${it.name}啦`;
  if (hiddenLocked(s, it)) return `和${NPC_BY_ID[it.npc].name}再熟一点才卖给你`;
  if (it.tier && homeTier(s) >= it.tier) return '已经住上更好的房子啦';
  if (it.needsTier && homeTier(s) < it.needsTier) return `要住进${HOUSE_NAMES[it.needsTier]}才放得下`;
  if (it.cat === 'decor' && ownedDecor(s).length >= decorSlots(s)) return '家里摆满啦，换个大房子吧';
  if (s.money < priceOf(s, it, placeId)) return '金币不够…去打工赚钱吧';
  return null;
}

// Share of a toy's mood effect it gives right now
const toyFun = (s, id) => Math.max(TOY_MIN_FUN, 1 - TOY_BORED_STEP * toyBoredom(s, id));

// Stat change per minute for the given drain multipliers (idle when omitted)
function drainRates(drain = {}) {
  return Object.fromEntries(Object.entries(DECAY).map(([k, v]) => [k, v * (drain[k] || 1)]));
}

// Rough total stat change over a whole activity
function projected(drain, minutes) {
  const rates = drainRates(drain);
  return Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Math.round(v * minutes)]));
}

// Highest education reached: a finished degree, or the stage currently being studied
function educationTitle(s) {
  let title = s.level < STAGES[0].minLevel ? '学龄前' : '待入学';
  for (const st of STAGES) {
    const courses = COURSES.filter((c) => c.stage === st.id);
    const started = courses.some((c) => s.courses[c.id]);
    const finished = st.byMajor ? MAJORS.some((m) => stageDone(s, st.id, m.id)) : stageDone(s, st.id);
    if (finished) title = st.degree;
    else if (started) title = st.student;
  }
  return title;
}

// Degrees earned, for display
function degrees(s) {
  const out = [];
  for (const st of STAGES) {
    if (!st.byMajor) {
      if (stageDone(s, st.id)) out.push(st.degree);
    } else {
      for (const m of MAJORS) if (stageDone(s, st.id, m.id)) out.push(`${m.name}${st.degree}`);
    }
  }
  return out;
}

// Growth form of the piggy for a level
const FORMS = [
  { min: 1, id: 'baby', name: '婴儿' },
  { min: 3, id: 'toddler', name: '幼儿' },
  { min: 6, id: 'child', name: '儿童' },
  { min: 12, id: 'teen', name: '少年' },
  { min: 18, id: 'youth', name: '青年' },
  { min: 22, id: 'adult', name: '成年' },
];
const formFor = (level) => FORMS.filter((f) => level >= f.min).pop();

// How to say doing a job: "当洗碗工" for a role, just "拱松露" when the name is already an action
const jobVerb = (job) => (job.doing ? job.name : `当${job.name}`);

// ---------- the vegetable patch ----------

// How far a planted plot has grown: 0 to 1 (ripe)
const plotProgress = (p) => clamp((Date.now() - p.at) / 60000 / ITEM_BY_ID[p.seed].grow, 0, 1);
const fmtGrow = (min) => (min >= 60 ? `${+(min / 60).toFixed(1)} 小时` : `${min} 分钟`);
