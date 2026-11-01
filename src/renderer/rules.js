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

// All courses of a stage (and major, for university stages) are done
function stageDone(s, stageId, majorId) {
  return COURSES.filter((c) => c.stage === stageId && (!majorId || c.major === majorId)).every((c) => s.courses[c.id]);
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
  return Math.max(0, b.n - (Date.now() - b.at) / 3600000 / TOY_BORED_RECOVER_H);
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
