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

// Lessons of a course done (a finished course counts all of them)
// A furniture bonus as a label: 睡觉回体力 +25%, 心情下降 −15%, 能在家弹琴
function bonusText(k, v) {
  if (v === 1) return BONUS_UNLOCK[k] || BONUS_NAME[k];
  const pct = Math.round((v - 1) * 100);
  return `${BONUS_NAME[k]} ${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

// A lesson's number as shown: I, II, III …
const lessonNum = (k) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k - 1] || String(k);

// A lesson's name in text. At school a lesson is a grade: 三年级语文, 初二物理, 高三数学.
// At university: 数据结构 III (a one-lesson course is just its name).
const GRADE_NAME = { primary: (g) => `${'一二三四五六'[g - 1]}年级`, middle: (g) => `初${'一二三'[g - 1]}`, high: (g) => `高${'一二三'[g - 1]}` };
function lessonName(c, k) {
  const grade = GRADE_NAME[c.stage];
  if (grade) return `${grade(GRADES[c.stage] - c.lessons + k)}${c.name}`;
  return c.lessons > 1 ? `${c.fullName} ${lessonNum(k)}` : c.fullName;
}
const lessonsDone = (s, c) => (s.courses[c.id] ? c.lessons : s.lessons?.[c.id] || 0);

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

// How far an elective subject was studied: 0 (not at all) to 3 (into high school)
const subjectLevel = (s, subject) => COURSES.filter((c) => c.subject === subject && lessonsDone(s, c) > 0).length;

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

// token: a course id, "course@n" (at least n of its lessons), or a degree "deg:<stage>[:<major>]"
function reqMet(s, token) {
  if (token.startsWith('deg:')) {
    const [, stageId, majorId] = token.split(':');
    return stageDone(s, stageId, majorId);
  }
  const [id, n] = token.split('@');
  return n ? lessonsDone(s, COURSE_BY_ID[id]) >= +n : !!s.courses[id];
}

function reqName(token) {
  if (token.startsWith('deg:')) {
    const [, stageId, majorId] = token.split(':');
    const stage = STAGE_BY_ID[stageId];
    return majorId ? `${MAJOR_BY_ID[majorId].name}${stage.degree}` : stage.degree;
  }
  const [id, n] = token.split('@');
  return n ? lessonName(COURSE_BY_ID[id], +n) : COURSE_BY_ID[id].fullName;
}

// Everything the next lesson of a course needs, as [{ text, ok }]. A prerequisite in the same
// stage is needed up to the same lesson; one from an earlier stage must be finished.
function courseReqs(s, c) {
  const stage = STAGE_BY_ID[c.stage];
  const k = Math.min(c.lessons, lessonsDone(s, c) + 1);
  const lv = lessonLevel(c, k);
  const reqs = [{ text: `Lv.${lv}`, ok: s.level >= lv }];
  if (stage.needs) reqs.push({ text: STAGE_BY_ID[stage.needs].degree, ok: stageDone(s, stage.needs) });
  for (const t of c.prereq) {
    const p = COURSE_BY_ID[t];
    if (p && p.stage === c.stage && p.lessons > 1) {
      const n = Math.min(k, p.lessons);
      reqs.push({ text: n < p.lessons ? lessonName(p, n) : p.fullName, ok: lessonsDone(s, p) >= n });
    } else reqs.push({ text: reqName(t), ok: reqMet(s, t) });
  }
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

// today, as the town counts days (its clock, not the real date): what daily limits reset on
const dayKey = () => new Date(townNow()).toDateString();

// ---------- the town's clock ----------
// Each window points TOWN_SAVE at the save it reads (the pet window its own, the home window the
// latest snapshot's). Town time is where the clock was last set plus the time since, at today's
// speed: real time while the pig is busy or asleep, TOWN_SPEED times faster while he's free.
let TOWN_SAVE = null;
function townRate(s) {
  const a = s.activity;
  if (!a) return TOWN_SPEED;
  if (a.type === 'sleep') return a.auto ? 0 : SLEEP_SPEED;
  return 1;
}
function townNow() {
  const c = TOWN_SAVE?.clock;
  return c ? c.t + (Date.now() - c.at) * townRate(TOWN_SAVE) : Date.now();
}
const townDate = () => new Date(townNow());
// The real moment that a town moment was (or will be), at the speed now
const realOf = (t) => Date.now() - (townNow() - t) / ((TOWN_SAVE && townRate(TOWN_SAVE)) || 1);

// What the pig says on waking, by the hour in town
const wakeLine = (h) => (h >= 5 && h < 11 ? '早上好！' : h >= 11 && h < 14 ? '中午好！' : h >= 14 && h < 18 ? '下午好！' : '晚上好！');
const isNight = (h) => h >= 19 || h < 5;

// Drawn icons for buttons, where the game fonts have no such character (styled by .ic)
const ICON = {
  close: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  min: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9"/></svg>',
  back: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 2.5 7 6 10.5M3 7h7.5a3 3 0 0 1 0 6H8"/></svg>',
};

function hashStr(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Points needed in all for h hearts (500 for 5♥, 1500 for 10♥)
const pointsFor = (h) => 40 * h + 10 * h * (h + 1);
const npcPoints = (s, id) => s.npc?.[id]?.p || 0;
function hearts(s, id) {
  const p = npcPoints(s, id);
  let h = 0;
  while (h < NPC_MAX_HEARTS && p >= pointsFor(h + 1)) h++;
  return h;
}
// How far into the next heart: { h, frac } (frac 0–1; 0 at the max)
function heartProgress(s, id) {
  const h = hearts(s, id);
  if (h >= NPC_MAX_HEARTS) return { h, frac: 0 };
  return { h, frac: (npcPoints(s, id) - pointsFor(h)) / heartCost(h + 1) };
}
const greetedToday = (s, id) => s.npc?.[id]?.hi === dayKey();
const wishDone = (s, id) => s.npc?.[id]?.wish === dayKey();
// One present a day each (today's wish counts as it)
const giftedToday = (s, id) => s.npc?.[id]?.gift === dayKey() || wishDone(s, id);
const togetherToday = (s, id) => s.npc?.[id]?.tog === dayKey();

const isBirthday = (id, t = townNow()) => NPC_BY_ID[id].birthday === calOf(t).key;
const npcDailyCap = (id) => (isBirthday(id) ? NPC_BIRTHDAY_DAILY : NPC_DAILY);

// How a neighbour takes a present: wish, love, like, dislike or plain
function giftTier(s, id, itemId) {
  if (itemId === npcWish(id) && !wishDone(s, id)) return 'wish';
  return giftTaste(id, itemId);
}
// What they think of a thing, wish or not: love, like, plain or dislike
function giftTaste(id, itemId) {
  const n = NPC_BY_ID[id];
  if (n.loves.includes(itemId)) return 'love';
  if (n.likes.includes(itemId)) return 'like';
  if (n.dislike === itemId) return 'dislike';
  return 'plain';
}
// Everything given to a neighbour so far and how they took it, favourites first:
// [{ id, taste }]. Favourites found before this was kept count too.
function giftsGiven(s, id) {
  const rec = s.npc?.[id];
  const gave = { ...Object.fromEntries((rec?.fav || []).map((k) => [k, 'love'])), ...(rec?.gave || {}) };
  const order = ['love', 'like', 'plain', 'dislike'];
  return Object.entries(gave).filter(([k]) => ITEM_BY_ID[k]).map(([k, taste]) => ({ id: k, taste }))
    .sort((a, b) => order.indexOf(a.taste) - order.indexOf(b.taste));
}
// What the pig could give: things to eat, toys and medicine in the bag; the wish first
function giftable(s, id) {
  const wish = wishDone(s, id) ? null : npcWish(id);
  const list = ITEMS.filter((it) => (GIFT_CATS.includes(it.cat) || it.id === wish) && s.inventory[it.id] > 0);
  return [...list.filter((it) => it.id === wish), ...list.filter((it) => it.id !== wish)];
}

// ---------- where everyone is ----------
// Worked out from the clock every time, never stored: what someone is doing now is the entry of
// their day (NPC_DAYS) that started last.

const npcDayList = (id, d) => {
  const days = NPC_DAYS[id];
  const w = d.getDay();
  return days[`d${w}`] || ((w === 0 || w === 6) && days.weekend) || days.week;
};

// One day's entries as { at (ms), where, act }, with each start nudged 0–15 minutes on some days
function npcDay(id, d) {
  const day = d.toDateString();
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return npcDayList(id, d).map((e, i) => {
    const [h, m] = e[0].split(':').map(Number);
    let [where, act] = [e[1], e[2]];
    if (Array.isArray(where)) [where, act] = where[hashStr(day + id) % where.length];
    // a little give in everyone's day, except a shift behind their own counter: that starts on time
    const sharp = act === 'work' && where === NPC_BY_ID[id].place;
    const jitter = i && !sharp ? hashStr(`${day}${id}${i}`) % 16 : 0;
    return { at: midnight + (h * 60 + m + jitter) * 60000, where, act };
  });
}

// What someone is doing now: { at, end, where, act, prev } (prev: the entry before, where they
// came from). key names the entry, for anything that should happen once per stretch.
function npcPlan(id, now = townNow()) {
  const d = new Date(now);
  const list = npcDay(id, d);
  let i = list.length - 1;
  while (i > 0 && list[i].at > now) i--;
  const cur = list[i];
  const prev = i ? list[i - 1] : npcDay(id, new Date(cur.at - 1)).pop();
  const next = list[i + 1]?.at ?? cur.at + DAY_MS;
  return { ...cur, end: next, prev, key: `${id}:${cur.at}` };
}
const npcInside = (plan) => NPC_INSIDE.includes(plan.act);
const npcAsleep = (plan) => NPC_ASLEEP.includes(plan.act);
// A shop keeper behind their own counter
const npcAtWork = (id, now) => {
  const plan = npcPlan(id, now);
  return plan.act === 'work' && plan.where === NPC_BY_ID[id].place;
};

// Time of day for small talk: morn, noon, eve, night, or '' in the afternoon
function dayPart(d = townDate()) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morn';
  if (h >= 11 && h < 14) return 'noon';
  if (h >= 17 && h < 20) return 'eve';
  if (h >= 20 || h < 5) return 'night';
  return '';
}

// Eating together is offered around lunch and supper
const mealTime = (d = townDate()) => {
  const m = d.getHours() * 60 + d.getMinutes();
  return MEAL_HOURS.some(([a, b]) => m >= a && m < b);
};

// The heart story someone has to tell next, if they're where it happens: its hearts, or null
function storyDue(s, id, now = townNow()) {
  const rec = s.npc?.[id] || {};
  const h = hearts(s, id);
  const k = Object.keys(NPC_STORIES[id] || {}).map(Number).sort((a, b) => a - b).find((x) => x <= h && !(rec.ev || []).includes(x));
  if (k == null) return null;
  const st = NPC_STORIES[id][k];
  const plan = npcPlan(id, now);
  if (st.at && !st.at.includes(plan.act)) return null;
  if (st.with && npcPlan(st.with, now).where !== plan.where) return null;
  return k;
}

// ---------- festivals, the theme park, the seasons ----------

// Where a town moment falls on the town's calendar: n (days since spring 1 of year 1), year,
// season ('spring'…), day (1–28), key ('autumn-7', as festivals and birthdays are written)
function calOf(t = townNow()) {
  const d = new Date(t);
  const n = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - CAL_EPOCH) / DAY_MS);
  const y = SEASON_DAYS * 4;
  const inYear = ((n % y) + y) % y;
  const season = SEASON_IDS[Math.floor(inYear / SEASON_DAYS)];
  const day = (inYear % SEASON_DAYS) + 1;
  return { n, year: Math.floor(n / y) + 1, season, day, key: `${season}-${day}` };
}
// The festival on a town day, or null
const festivalOn = (t = townNow()) => FESTIVALS.find((f) => f.date === calOf(t).key) || null;
// A festival coming up in the next few days (not today): { f, days }, or null
function festivalSoon(t = townNow()) {
  for (let i = 1; i <= FESTIVAL_INVITE_DAYS; i++) {
    const f = festivalOn(t + i * DAY_MS);
    if (f) return { f, days: i };
  }
  return null;
}
// spring, summer, autumn or winter, by the town's calendar
const seasonOf = (t = townNow()) => calOf(t).season;

const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();
const parkOpen = (d = townDate()) => minuteOf(d) >= PARK_HOURS[0] && minuteOf(d) < PARK_HOURS[1];
// Fireworks over the theme park: weekend nights, and the night of 春节
function fireworksOn(d = townDate()) {
  const w = d.getDay();
  if (!(w === 0 || w === 6 || festivalOn()?.id === 'newyear')) return false;
  return minuteOf(d) >= FIREWORKS_HOURS[0] && minuteOf(d) < FIREWORKS_HOURS[1];
}

// ---------- going somewhere together ----------

// Whether an outing is on offer at all just now: its hours, a meal at mealtimes, football once
// the pig can play it, the garden while something grows in it, a festival on its day
function outingOn(s, o, d = townDate()) {
  const m = d.getHours() * 60 + d.getMinutes();
  if (o.hours && !(m >= o.hours[0] && m < o.hours[1])) return false;
  if (o.festival && festivalOn()?.id !== o.festival) return false;
  if (o.fireworks && !fireworksOn(d)) return false;
  if (o.meal && !mealTime(d)) return false;
  if (o.hobby && hobbyLock(s, HOBBY_BY_ID[o.hobby])) return false;
  if (o.id === 'garden' && !(s.farm || []).some((p) => p && plotProgress(p) < 1)) return false;
  return true;
}
// Why the pig can't go on it right now ('' if he can): busy, full, tired, broke, or done lately
function outingWhy(s, o, busy) {
  if (busy) return busy;
  if (o.hobby) return minutesLeft(s.hobbyReady[o.hobby]) > 0 ? '刚玩过' : '';
  const h = FREE_HELP_BY_ID[o.help];
  if (o.help === 'meal' && s.hunger >= 95) return '已吃饱';
  const up = keeperBackAt(o.help);
  if (up) return `${clockText(up)} 开放`;
  if (o.help === 'soak' && s.energy >= 95) return '精神很好';
  if (h.fee && s.money < h.fee * 2) return '金币不够';
  if (minutesLeft(s.helpReady[o.help]) > 0) return '刚去过';
  return '';
}
// What they say about it: the old lines for a meal, the outings' own lines otherwise
const outingTalk = (id, kind) => (kind === 'eat' ? NPC_TALK[id].eat : NPC_OUTINGS_TALK[id][kind]);

// ---------- the cinema and the barn ----------

// Today's film
const filmToday = (d = townDate()) => FILMS[Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS) % FILMS.length];
// What the barn will buy: whatever the vegetable patch grows, and what it pays for one
// (and fish, at what they're worth)
const barnGoods = () => ITEMS.filter((it) => it.cat === 'fish' || ITEMS.some((seed) => seed.crop === it.id));
const barnPrice = (it) => (it.cat === 'fish' ? it.price : Math.max(1, Math.round(it.price * BARN_RATE)));

// ---------- visiting ----------

// Whether someone's door is open to the pig: 'open'; 'closed' (in, but he hasn't been asked in
// yet); 'asleep'; or 'away'. Home is anywhere about their own house, in or out of it.
function visitDoor(s, id, now = townNow()) {
  const v = NPC_VISITS[id];
  const plan = npcPlan(id, now);
  if (!v || plan.where !== NPC_BY_ID[id].home) return 'away';
  if (npcAsleep(plan)) return 'asleep';
  return asked(s, id) ? 'open' : 'closed';
}
// Asked in: their story at that many hearts has been told
const asked = (s, id) => !!s.npc?.[id]?.ev?.includes(NPC_VISITS[id].hearts);
// Others round at someone's house just now (the rabbit at the hedgehog's, the turtle for tea)
const guestsAt = (where, now = townNow()) => NPCS.filter((n) => n.home !== where && npcPlan(n.id, now).where === where);

// The value of a neighbour's perk once they like the pig enough, or `base`
function npcPerk(s, key, base) {
  const n = NPCS.find((x) => x.perk?.key === key && hearts(s, x.id) >= NPC_PERK_HEARTS);
  return n ? n.perk.v : base;
}

// Who runs a shop (null if nobody does)
const keeperOf = (placeId) => NPCS.find((n) => n.place === placeId && n.spot == null) || null;

// Services someone has to be there for: the doctor sees you at the clinic, the cook feeds you at
// the canteen, while they're at work there. Otherwise: the town moment they're next back; else null
const HELP_KEEPER = { clinic: 'clinic', meal: 'canteen' };
function keeperBackAt(helpId, now = townNow()) {
  const k = HELP_KEEPER[helpId] && keeperOf(HELP_KEEPER[helpId]);
  if (!k || npcAtWork(k.id, now)) return null;
  let t = now;
  for (let i = 0; i < 24 * 12 && !npcAtWork(k.id, t); i++) t += 5 * 60000;
  return npcPlan(k.id, t).at;
}
const clockText = (t) => {
  const d = new Date(t);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// A shop's price multiplier for this pig: the friendlier its keeper, the cheaper
function shopDiscount(s, placeId) {
  const k = keeperOf(placeId);
  if (!k) return 1;
  return (SHOP_DISCOUNTS.find(([h]) => hearts(s, k.id) >= h) || [0, 1])[1];
}

// What 跑腿 can bring: the supermarket's everyday goods
const deliveryItems = () => ITEMS.filter((it) => DELIVERY.cats.includes(it.cat) && !it.npc && shopsOf(it).includes(DELIVERY.shop));

// What an item costs this pig in a shop
const priceOf = (s, it, placeId) => (placeId ? Math.round(it.price * shopDiscount(s, placeId)) : it.price);

// A 跑腿 basket { id: count }: the goods, the delivery fee and the total
function deliveryBill(cart) {
  const goods = Object.entries(cart).reduce((n, [id, k]) => n + ITEM_BY_ID[id].price * k, 0);
  const fee = goods ? Math.max(DELIVERY.minFee, Math.ceil(goods * DELIVERY.fee)) : 0;
  return { goods, fee, total: goods + fee };
}

// Hearts a hidden item needs before it's sold (0: not hidden)
const heartsNeeded = (it) => (it.npc ? it.hearts || NPC_MAX_HEARTS : 0);
const hiddenLocked = (s, it) => !!it.npc && hearts(s, it.npc) < heartsNeeded(it);

// Career seniority (工龄): the rank from every shift the pig has worked, and the shifts the next rank needs
function careerRank(s) {
  let r = 0;
  while (r < MAX_RANK && (s.shifts || 0) >= rankShifts(r + 1)) r++;
  return r;
}
const rankBonus = (r) => RANK_PAY ** r;
// A good mood pays a little more, a bad one less
const moodPay = (s) => (s.mood >= MOOD_PAY.high ? MOOD_PAY.highK : s.mood < MOOD_PAY.low ? MOOD_PAY.lowK : 1);
const payOf = (s, job) => Math.round(job.pay * rankBonus(careerRank(s)) * npcPerk(s, 'pay', 1) * moodPay(s));

// ---------- businesses ----------

const bizOwned = (s, id) => s.biz?.owned?.[id] || 0;
// The next share of a business: dearer for every one already owned
const bizPrice = (s, b) => Math.round(b.price * BUSINESS_STEP ** bizOwned(s, b.id));
// Everything the businesses pay in a day
const bizIncome = (s) => BUSINESSES.reduce((n, b) => n + b.income * bizOwned(s, b.id), 0);
const playCap = (s) => PLAY_EXP_DAILY + npcPerk(s, 'playCap', 0);

// The item a neighbour wishes for today, or null. A few neighbours a day each want one cheap
// thing, picked so it's sold somewhere other than their own shop.
function npcWish(id, day = dayKey()) {
  const wishers = [...NPCS].sort((a, b) => hashStr(day + a.id) - hashStr(day + b.id)).slice(0, NPC_WISHES_PER_DAY);
  if (!wishers.some((n) => n.id === id)) return null;
  const own = NPC_BY_ID[id].perk?.cats || [];
  const pool = ITEMS.filter((it) => WISH_CATS.includes(it.cat) && !it.npc && shopsOf(it).length && it.price <= WISH_MAX_PRICE && !own.includes(it.cat));
  return pool[hashStr(id + day) % pool.length].id;
}

// ---------- home ----------

// The best house owned: 0 小猪窝 (the one every pig starts with) … 3 城堡
const homeTier = (s) => Math.max(0, ...ITEMS.filter((it) => it.tier && s.inventory[it.id]).map((it) => it.tier));
const ownedDecor = (s) => ITEMS.filter((it) => it.cat === 'decor' && !it.gift && s.inventory[it.id]);
// what friends gave him to keep at home
const keepsakes = (s) => ITEMS.filter((it) => it.gift && s.inventory[it.id]);
const decorSlots = (s) => DECOR_SLOTS[homeTier(s)];
const HOUSE_NAMES = ['小猪窝', '温馨公寓', '花园别墅', '猪猪城堡'];

// Why an item can't be bought right now, or null
function buyBlock(s, it, placeId) {
  if (ONCE_CATS.includes(it.cat) && s.inventory[it.id]) return `已拥有${it.name}`;
  if (hiddenLocked(s, it)) return `需要和${NPC_BY_ID[it.npc].name}更熟悉`;
  if (it.tier && homeTier(s) >= it.tier) return '已有更好的房子';
  if (it.needsTier && homeTier(s) < it.needsTier) return `需要${HOUSE_NAMES[it.needsTier]}`;
  if (it.cat === 'decor' && ownedDecor(s).length >= decorSlots(s)) return '装饰位已满';
  if (s.money < priceOf(s, it, placeId)) return '金币不够';
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
// how far a plot has grown, by the town's clock (t: the town moment it was sown)
const plotProgress = (p) => clamp((townNow() - p.t) / 60000 / ITEM_BY_ID[p.seed].grow, 0, 1);
const fmtGrow = (min) => (min >= 60 ? `${+(min / 60).toFixed(1)} 小时` : `${min} 分钟`);
