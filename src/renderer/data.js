// Game content and balance. Tweak freely.
// Times are in real minutes. Stat rates are points per real minute.

const STATS = [
  { key: 'hunger', name: '饱食', icon: '🍖', color: '#ffa94d' },
  { key: 'clean', name: '清洁', icon: '🧼', color: '#4dabf7' },
  { key: 'energy', name: '体力', icon: '⚡', color: '#51cf66' },
  { key: 'health', name: '健康', icon: '💗', color: '#ff6b6b' },
  { key: 'mood', name: '心情', icon: '😊', color: '#f783ac' },
];
const STAT_KEYS = STATS.map((s) => s.key);
const STAT_NAME = Object.fromEntries(STATS.map((s) => [s.key, s.name]));
const STAT_COLOR = Object.fromEntries(STATS.map((s) => [s.key, s.color]));

const esc = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- stat decay ----------

// Normal drain while idle (time spent with the app closed counts at half speed)
const DECAY = { hunger: -0.15, clean: -0.1, energy: -0.12, mood: -0.15 };
const SLEEP_ENERGY_PER_MIN = 2;
// While asleep (including while you're away or the app is closed) the pig needs much less
const SLEEP_DRAIN = { hunger: 0.2, clean: 0.3, mood: 0.2 };
// No keyboard or mouse for this long and the pig goes to sleep until you come back
const AWAY_MINUTES = 10;
// The pig feeds itself from the bag below this hunger, and takes medicine below this health
const SELF_FEED_BELOW = 25;
const SELF_MEDICINE_BELOW = 30;

// Studying drains faster than idling but slower than working (each job has its own drain)
const STUDY_DRAIN = { hunger: 1.6, clean: 1, mood: 1.8, energy: 3 };

// Free but slow, so hygiene items are worth buying to save time
const BATH_MINUTES = 10;
const BATH_EFFECT = { clean: 20, mood: 3 };
const PLAY_EFFECT = { mood: 8, energy: -8, hunger: -3 };
const MINIGAME_COST = { energy: -5, hunger: -2 };

// Free help so a broke, sick pig can always recover. It takes a while (minutes), so buying
// food or medicine is the quick way. cooldown in minutes.
const FREE_HELP = [
  { id: 'meal', name: '食堂', icon: '🍱', effects: { hunger: 20 }, minutes: 15, cooldown: 60, label: '在食堂吃饭' },
  { id: 'clinic', name: '诊所', icon: '🏥', effects: { health: 20 }, minutes: 20, cooldown: 60, maxHealth: 40, label: '在诊所看病' },
];
const FREE_HELP_BY_ID = Object.fromEntries(FREE_HELP.map((h) => [h.id, h]));

// Health below this stops studying and working
const MIN_HEALTH_TO_ACT = 40;

const MINIGAMES = [
  { id: 'rps', name: '石头剪刀布', icon: '✊', desc: '三局两胜，看谁运气好' },
  { id: 'ttt', name: '井字棋', icon: '⭕', desc: '连成一线就赢，小猪会堵你哦' },
  { id: 'penalty', name: '点球大战', icon: '⚽', desc: '轮流罚球和扑救，各踢 5 球' },
  { id: 'chess', name: '国际象棋', icon: '♟️', desc: '你执白先走，小猪执黑' },
  { id: 'banqi', name: '暗棋', icon: '🀄', desc: '翻棋 · 吃子 · 🗡️ 克 👑' },
];

// ---------- level (age) ----------

const MAX_LEVEL = 30;
// Time alone grows the pig slowly (awake, asleep or closed); studying grows it fastest.
// Little ones (below Lv.6) grow mostly by playing, so time counts half for them.
// After school age each level costs more and more.
const EXP_PER_MIN = { alive: 0.1, kidAlive: 0.05, study: 1, work: 0.2 };
const expNeed = (level) => (level < 6 ? 30 : 150 + 25 * (level - 6));

// Exp from playing, by how hard it is to win. The same at every age: it matters a lot while
// levels are cheap and little once they cost more. Only PLAY_EXP_DAILY counts each day.
const PLAY_EXP = {
  play: 3,
  toy: 5,
  hobby: 4,
  rps: { win: 3, draw: 2, lose: 1 },
  ttt: { win: 6, draw: 4, lose: 2 },
  penalty: { win: 10, draw: 6, lose: 3 },
  chess: { win: 40, draw: 20, lose: 8 },
  banqi: { win: 25, draw: 12, lose: 5 },
};
const PLAY_EXP_DAILY = 50;

// ---------- education ----------

const SUBJECTS = [
  { id: 'chinese', name: '语文', icon: '📖' },
  { id: 'math', name: '数学', icon: '🔢' },
  { id: 'english', name: '英语', icon: '🔤' },
  { id: 'physics', name: '物理', icon: '🧲' },
  { id: 'chemistry', name: '化学', icon: '⚗️' },
  { id: 'biology', name: '生物', icon: '🧬' },
  { id: 'history', name: '历史', icon: '🏺' },
  { id: 'geography', name: '地理', icon: '🌏' },
  { id: 'politics', name: '政治', icon: '🏛️' },
  { id: 'science', name: '科学', icon: '🔬' },
  // electives: not needed to graduate, but they unlock hobbies and arts jobs
  { id: 'music', name: '音乐', icon: '🎵', elective: true },
  { id: 'art', name: '美术', icon: '🎨', elective: true },
  { id: 'pe', name: '体育', icon: '⚽', elective: true },
];
// Harder subjects take a little longer, electives a little shorter
const SUBJECT_EXTRA_MIN = { math: 10, physics: 10, chemistry: 10, english: 5, biology: 5, music: -10, art: -10, pe: -10 };

const STAGES = [
  { id: 'primary', name: '小学', icon: '🎒', minLevel: 6, needs: null, degree: '小学毕业', student: '小学生', baseMin: 40, fee: 0 },
  { id: 'middle', name: '初中', icon: '📘', minLevel: 12, needs: 'primary', degree: '初中毕业', student: '初中生', baseMin: 50, fee: 0 },
  { id: 'high', name: '高中', icon: '📗', minLevel: 15, needs: 'middle', degree: '高中毕业', student: '高中生', baseMin: 60, fee: 10 },
  // from university up a degree needs every required course of the major plus enough credits
  { id: 'college', name: '大学', icon: '🎓', minLevel: 18, degree: '学士', student: '大学生', byMajor: true, fee: 50, credits: 26 },
  { id: 'master', name: '研究生', icon: '📜', minLevel: 22, degree: '硕士', student: '研究生', byMajor: true, fee: 80, credits: 13 },
  { id: 'phd', name: '博士', icon: '🔬', minLevel: 25, degree: '博士', student: '博士生', byMajor: true, fee: 100, credits: 10 },
];
const CREDITS = { required: 3, elective: 2 };

// Which subjects each school stage teaches, and what each course needs first
const BASIC_COURSES = {
  primary: {
    chinese: [],
    math: [],
    english: [],
    politics: ['primary_chinese'],
    science: ['primary_math'],
    music: [],
    art: [],
    pe: [],
  },
  middle: {
    chinese: ['primary_chinese'],
    math: ['primary_math'],
    english: ['primary_english'],
    physics: ['primary_math', 'primary_science'],
    chemistry: ['middle_physics'],
    biology: ['primary_science'],
    history: ['primary_chinese'],
    geography: ['primary_math'],
    politics: ['primary_politics'],
    music: ['primary_music'],
    art: ['primary_art'],
    pe: ['primary_pe'],
  },
  high: {
    chinese: ['middle_chinese'],
    math: ['middle_math'],
    english: ['middle_english'],
    physics: ['middle_physics', 'high_math'],
    chemistry: ['middle_chemistry'],
    biology: ['middle_biology', 'high_chemistry'],
    history: ['middle_history'],
    geography: ['middle_geography'],
    politics: ['middle_politics'],
    music: ['middle_music'],
    art: ['middle_art'],
    pe: ['middle_pe'],
  },
};
const SUBJECT_ALIAS = { 'primary:politics': '品德' };

// Each major, per stage: req (required, in order) and elec (major electives)
const MAJORS = [
  {
    id: 'cs', name: '计算机', icon: '💻', needs: ['high_math', 'high_physics'],
    college: { req: ['猪猪编程入门', '数据结构', '拱拱算法', '操作系统', '计算机组成', '软件工程'], elec: ['网页设计', '游戏开发', '数据库', '计算机网络'] },
    master: { req: ['猪工智能', '分布式系统', '编译原理'], elec: ['计算机视觉', '信息安全', '机器人'] },
    phd: { req: ['机器学习研究', '猪脑模拟研究'], elec: ['前沿讲座', '论文写作'] },
  },
  {
    id: 'med', name: '猪猪医学', icon: '🩺', needs: ['high_biology', 'high_chemistry'],
    college: { req: ['猪体解剖', '猪猪生理学', '猪病理学', '猪猪临床', '猪猪药理学', '猪猪诊断学'], elec: ['猪猪营养学', '急救常识', '猪猪心理', '中猪医'] },
    master: { req: ['猪猪内科', '猪猪外科', '猪猪儿科'], elec: ['影像学', '麻醉学', '康复医学'] },
    phd: { req: ['猪猪健康研究', '长寿猪研究'], elec: ['临床试验', '论文写作'] },
  },
  {
    id: 'fin', name: '金融', icon: '💹', needs: ['high_math', 'high_politics'],
    college: { req: ['经济学原理', '存钱罐会计学', '金融市场', '小猪储蓄投资', '统计学', '货币银行学'], elec: ['保险学', '税法', '理财规划', '电子支付'] },
    master: { req: ['公司金融', '存钱罐工程', '风险管理'], elec: ['量化交易', '行为金融', '国际金融'] },
    phd: { req: ['宏观经济研究', '猪肉价格研究'], elec: ['计量经济', '论文写作'] },
  },
  {
    id: 'law', name: '法学', icon: '⚖️', needs: ['high_chinese', 'high_politics', 'high_history'],
    college: { req: ['法理学', '宪法', '猪权民法', '刑法', '合同法', '行政法'], elec: ['知识产权', '环境法', '劳动法', '法律英语'] },
    master: { req: ['诉讼法', '国际法', '商法'], elec: ['仲裁实务', '海商法', '法律文书'] },
    phd: { req: ['动物权益研究', '比较法研究'], elec: ['法哲学', '论文写作'] },
  },
  {
    id: 'edu', name: '教育学', icon: '🍎', needs: ['high_chinese', 'high_english'],
    college: { req: ['教育学原理', '小猪心理学', '课程设计', '教学实践', '教育统计', '班级管理'], elec: ['儿童文学', '特殊教育', '教育技术', '游戏化教学'] },
    master: { req: ['教育心理学', '猪猪幼儿园管理', '教育评价'], elec: ['比较教育', '家庭教育', '教育政策'] },
    phd: { req: ['教育理论研究', '学习科学研究'], elec: ['质性研究', '论文写作'] },
  },
  {
    id: 'civil', name: '土木工程', icon: '🏗️', needs: ['high_math', 'high_physics'],
    college: { req: ['工程力学', '稻草与砖块', '结构设计', '防狼房屋施工', '材料力学', '工程测量'], elec: ['园林设计', '给排水', '工程制图', '建筑美学'] },
    master: { req: ['桥梁工程', '泥坑工程', '抗震设计'], elec: ['隧道工程', '绿色建筑', '施工管理'] },
    phd: { req: ['结构理论研究', '智能猪舍研究'], elec: ['数值模拟', '论文写作'] },
  },
  {
    id: 'arts', name: '艺术', icon: '🎭', needs: ['high_music', 'high_art'],
    college: { req: ['乐理与和声', '素描与色彩', '猪猪设计', '舞台表演', '艺术史', '毕业创作'], elec: ['摄影', '动画', '书法', '陶艺'] },
    master: { req: ['作曲', '油画创作', '策展'], elec: ['电影配乐', '版画', '舞台美术'] },
    phd: { req: ['猪猪美学研究', '艺术史研究'], elec: ['艺术评论', '论文写作'] },
  },
];
// General electives (通识): any university student can take them, and they count for every major
const GENERAL_ELECTIVES = [
  { id: 'philo', name: '猪猪哲学', icon: '🤔' }, { id: 'music', name: '音乐鉴赏', icon: '🎧' },
  { id: 'film', name: '电影赏析', icon: '🎬' }, { id: 'mind', name: '心理健康', icon: '💗' },
  { id: 'startup', name: '创业基础', icon: '🚀' }, { id: 'lang', name: '第二外语', icon: '🗣️' },
  { id: 'astro', name: '天文学', icon: '🔭' }, { id: 'cook', name: '烹饪课', icon: '🍳' },
];
// minutes of required courses by position; electives are shorter
const MAJOR_MINUTES = { college: [70, 72, 75, 78, 80, 85], master: [85, 88, 90], phd: [90, 90] };
const ELECTIVE_MINUTES = { college: 50, master: 60, phd: 70 };
// which earlier required courses (by position) each required course needs
const REQ_PREREQ = { 6: [[], [0], [0], [1], [2], [3, 4]], 3: [[], [0], [0]], 2: [[], [0]] };
const PREV_STAGE = { master: 'college', phd: 'master' };

const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
const MAJOR_BY_ID = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

// Every course in one flat list: { id, stage, subject|major, name, fullName, icon, minutes, prereq }
const COURSES = [];
for (const [stageId, subjects] of Object.entries(BASIC_COURSES)) {
  const stage = STAGE_BY_ID[stageId];
  for (const [subjectId, prereq] of Object.entries(subjects)) {
    const subj = SUBJECT_BY_ID[subjectId];
    const name = SUBJECT_ALIAS[`${stageId}:${subjectId}`] || subj.name;
    COURSES.push({
      id: `${stageId}_${subjectId}`,
      stage: stageId,
      subject: subjectId,
      name,
      fullName: `${stage.name}${name}`,
      icon: subj.icon,
      minutes: stage.baseMin + (SUBJECT_EXTRA_MIN[subjectId] || 0),
      prereq,
      elective: !!subj.elective,
    });
  }
}
for (const m of MAJORS) {
  for (const stageId of ['college', 'master', 'phd']) {
    const { req, elec } = m[stageId];
    const reqIds = req.map((_, i) => `${stageId}_${m.id}_${i + 1}`);
    // the first required course needs the major's high school subjects, or the degree below
    const entry = PREV_STAGE[stageId] ? [`deg:${PREV_STAGE[stageId]}:${m.id}`] : m.needs;
    const common = { stage: stageId, major: m.id, icon: m.icon };
    req.forEach((name, i) => COURSES.push({
      ...common, id: reqIds[i], name, fullName: `${m.name}·${name}`,
      minutes: MAJOR_MINUTES[stageId][i],
      prereq: i ? REQ_PREREQ[req.length][i].map((j) => reqIds[j]) : entry,
      credits: CREDITS.required,
    }));
    // each major elective opens after one of the required courses
    elec.forEach((name, i) => COURSES.push({
      ...common, id: `${stageId}_${m.id}_e${i + 1}`, name, fullName: `${m.name}·${name}`,
      minutes: ELECTIVE_MINUTES[stageId] + i * 3,
      prereq: [reqIds[Math.min(i + (req.length >= 6 ? 1 : 0), req.length - 1)]],
      credits: CREDITS.elective, elective: true,
    }));
  }
}
for (const [i, g] of GENERAL_ELECTIVES.entries()) {
  COURSES.push({
    id: `college_gen_${g.id}`, stage: 'college', name: g.name, fullName: `通识·${g.name}`, icon: g.icon,
    minutes: ELECTIVE_MINUTES.college + (i % 3) * 5, prereq: [], credits: CREDITS.elective, elective: true, general: true,
  });
}
const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));

// ---------- jobs ----------
// requires: course ids, or degrees as "deg:<stage>" / "deg:<stage>:<major>".
// drain: how many times faster than idle each stat drops while working.
// pay is not set by hand: it comes from jobPay() below, from how hard the job is to get and to do.

const JOBS = [
  { id: 'bottles', name: '拱松露', doing: true, icon: '🍄', minLevel: 3, requires: [], minutes: 20, drain: { hunger: 2, clean: 4, mood: 1.5, energy: 2 } },
  { id: 'flyer', name: '发传单', doing: true, icon: '📄', minLevel: 4, requires: [], minutes: 30, drain: { hunger: 2.5, clean: 2, mood: 2, energy: 3 } },
  { id: 'dishes', name: '洗碗工', icon: '🍽️', minLevel: 5, requires: [], minutes: 40, drain: { hunger: 2, clean: 3.5, mood: 2, energy: 3 } },
  { id: 'ballboy', name: '球场球童', icon: '🎾', minLevel: 10, requires: ['primary_pe'], minutes: 30, drain: { hunger: 3, clean: 2.5, mood: 1.5, energy: 4 } },
  { id: 'paper', name: '送报员', icon: '📰', minLevel: 8, requires: ['primary_chinese'], minutes: 30, drain: { hunger: 3, clean: 2, mood: 1.5, energy: 3.5 } },
  { id: 'busker', name: '街头卖艺', doing: true, icon: '🪗', minLevel: 8, requires: ['primary_music'], minutes: 30, drain: { hunger: 2, clean: 1.5, mood: 1.5, energy: 2.5 } },
  { id: 'portrait', name: '公园画肖像', doing: true, icon: '🖼️', minLevel: 9, requires: ['primary_art'], minutes: 40, drain: { hunger: 2, clean: 2, mood: 1.5, energy: 2 } },
  { id: 'museum', name: '科技馆讲解员', icon: '🔭', minLevel: 9, requires: ['primary_science'], minutes: 40, drain: { hunger: 2, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'mover', name: '砖房小工', icon: '🧱', minLevel: 10, requires: [], minutes: 60, drain: { hunger: 4, clean: 4, mood: 3, energy: 5 } },
  { id: 'cashier', name: '小卖部收银员', icon: '🏪', minLevel: 10, requires: ['primary_math'], minutes: 45, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 2.5 } },
  { id: 'courier', name: '快递员', icon: '📦', minLevel: 12, requires: ['deg:primary'], minutes: 60, drain: { hunger: 3.5, clean: 2.5, mood: 2, energy: 4.5 } },
  { id: 'pianoaide', name: '琴行助教', icon: '🎼', minLevel: 13, requires: ['middle_music'], minutes: 45, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'artaide', name: '美术班助教', icon: '🖍️', minLevel: 13, requires: ['middle_art'], minutes: 45, drain: { hunger: 1.8, clean: 2, mood: 2, energy: 2.5 } },
  { id: 'tutor', name: '家教', icon: '✏️', minLevel: 15, requires: ['middle_math', 'middle_english'], minutes: 45, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'coach', name: '少儿体育教练', icon: '🏃', minLevel: 16, requires: ['high_pe'], minutes: 60, drain: { hunger: 3, clean: 2.5, mood: 1.8, energy: 4 } },
  { id: 'band', name: '乐队主唱', icon: '🎸', minLevel: 17, requires: ['high_music'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 1.5, energy: 3.5 } },
  { id: 'illustrator', name: '绘本插画师', icon: '📚', minLevel: 17, requires: ['high_art'], minutes: 60, drain: { hunger: 2, clean: 1.5, mood: 2, energy: 2.5 } },
  { id: 'guide', name: '泥浴温泉导游', icon: '♨️', minLevel: 16, requires: ['middle_history', 'middle_geography'], minutes: 60, drain: { hunger: 3, clean: 2.5, mood: 1.5, energy: 4 } },
  { id: 'labtech', name: '实验室助理', icon: '🧪', minLevel: 18, requires: ['high_chemistry', 'high_biology'], minutes: 60, drain: { hunger: 2, clean: 2, mood: 2, energy: 3 } },
  { id: 'reporter', name: '猪猪日报记者', icon: '🗞️', minLevel: 18, requires: ['high_chinese', 'high_politics'], minutes: 60, drain: { hunger: 2.5, clean: 2, mood: 2.5, energy: 3.5 } },
  { id: 'teacher', name: '猪猪幼儿园老师', icon: '🏫', minLevel: 22, requires: ['deg:college:edu'], minutes: 50, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 3 } },
  { id: 'banker', name: '存钱罐银行职员', icon: '🐷', minLevel: 22, requires: ['deg:college:fin'], minutes: 50, drain: { hunger: 1.8, clean: 1, mood: 2.8, energy: 2.5 } },
  { id: 'engineer', name: '猪舍建筑师', icon: '🏡', minLevel: 22, requires: ['deg:college:civil'], minutes: 60, drain: { hunger: 3, clean: 3, mood: 2.5, energy: 4 } },
  { id: 'designer', name: '猪猪设计师', icon: '🎨', minLevel: 22, requires: ['deg:college:arts'], minutes: 50, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 3 } },
  { id: 'coder', name: '程序员', icon: '💻', minLevel: 22, requires: ['deg:college:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'lawyer', name: '律师', icon: '⚖️', minLevel: 23, requires: ['deg:college:law'], minutes: 60, drain: { hunger: 2.2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'doctor', name: '猪猪医生', icon: '🩺', minLevel: 23, requires: ['deg:college:med'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 3, energy: 4 } },
  { id: 'architect', name: '系统架构师', icon: '🖥️', minLevel: 25, requires: ['deg:master:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'fund', name: '存钱罐基金经理', icon: '📈', minLevel: 25, requires: ['deg:master:fin'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 3.5, energy: 3.5 } },
  { id: 'orchestra', name: '交响乐团首席', icon: '🎻', minLevel: 25, requires: ['deg:master:arts'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 2.5, energy: 3.5 } },
  { id: 'artist', name: '著名艺术家', icon: '🌟', minLevel: 27, requires: ['deg:phd:arts'], minutes: 60, drain: { hunger: 2, clean: 2, mood: 2, energy: 3 } },
  { id: 'professor', name: '大学教授', icon: '🎓', minLevel: 27, requires: ['deg:phd:edu'], minutes: 50, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 3 } },
  { id: 'surgeon', name: '猪猪医院院长', icon: '🏥', minLevel: 27, requires: ['deg:phd:med'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 3, energy: 4.5 } },
  { id: 'scientist', name: '首席科学家', icon: '🚀', minLevel: 28, requires: ['deg:phd:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 4 } },
];
// Higher stages count as harder study per hour
const STAGE_DIFFICULTY = { primary: 1, middle: 1.2, high: 1.5, college: 2, master: 3, phd: 4 };

// Every course a list of requirements needs, following prerequisites and diplomas all the way down
function requiredCourses(tokens, set = new Set()) {
  for (const t of tokens) {
    let ids = [t];
    if (t.startsWith('deg:')) {
      const [, stageId, majorId] = t.split(':');
      ids = COURSES.filter((c) => c.stage === stageId && !c.elective && (!majorId || c.major === majorId)).map((c) => c.id);
      // plus the quickest electives that make up the credits the degree needs
      const need = STAGE_BY_ID[stageId].credits;
      if (need && majorId) {
        let have = ids.reduce((n, id) => n + COURSE_BY_ID[id].credits, 0);
        const pool = COURSES.filter((c) => c.stage === stageId && c.elective && (c.major === majorId || c.general))
          .sort((a, b) => a.minutes - b.minutes);
        for (const c of pool) {
          if (have >= need) break;
          ids.push(c.id);
          have += c.credits;
        }
      }
    }
    for (const id of ids) {
      if (set.has(id)) continue;
      set.add(id);
      const c = COURSE_BY_ID[id];
      requiredCourses(c.prereq, set);
      const needs = STAGE_BY_ID[c.stage].needs;
      if (needs) requiredCourses([`deg:${needs}`], set);
    }
  }
  return set;
}

// Hours of study a job needs, and those hours weighted by difficulty
function jobStudy(job) {
  const courses = [...requiredCourses(job.requires)].map((id) => COURSE_BY_ID[id]);
  return {
    hours: courses.reduce((n, c) => n + c.minutes / 60, 0),
    points: courses.reduce((n, c) => n + (c.minutes / 60) * STAGE_DIFFICULTY[c.stage], 0),
  };
}

// Hourly wage = base for the age + study difficulty + extra for draining (hard physical) work
function jobPay(job) {
  const drainSum = Object.values(job.drain).reduce((a, b) => a + b, 0);
  // small enough that a job needing more education always nets more after food and soap
  const hardship = Math.max(0, drainSum - 8) * 1.5;
  const hourly = 30 + 3 * job.minLevel + 6 * jobStudy(job).points + hardship;
  return Math.round((hourly * job.minutes) / 60);
}

for (const job of JOBS) {
  job.studyHours = Math.round(jobStudy(job).hours);
  job.pay = jobPay(job);
}
const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// ---------- shop ----------

const SHOP_CATS = [
  { id: 'food', name: '食物', icon: '🍱', desc: '吃了增加饱食度' },
  { id: 'hygiene', name: '卫生用品', icon: '🧴', desc: '用了增加清洁度' },
  { id: 'toy', name: '玩具', icon: '🧸', desc: '买一次可以反复玩，玩完要歇一会儿' },
  { id: 'medicine', name: '药物', icon: '💊', desc: '生病时吃，恢复健康' },
  { id: 'wear', name: '装扮', icon: '🎀', desc: '买一次，可以随时戴上或摘下' },
  { id: 'furniture', name: '家具', icon: '🛋️', desc: '摆在家里，一直有效' },
  { id: 'decor', name: '装饰', icon: '🪴', desc: '摆在家里，只是好看' },
  { id: 'city', name: '捐建', icon: '⛲', desc: '捐给猪猪城，地图上会出现' },
];
// Bought once and kept: these never go in the bag
const ONCE_CATS = ['toy', 'wear', 'furniture', 'decor', 'city'];
// How many decorations fit in each house tier (0 小猪窝 … 3 城堡)
const DECOR_SLOTS = [2, 5, 9, 14];

// Hobbies unlocked by the electives. Each takes a few minutes; effects grow with how far the
// subject was studied (1 at primary, up to 3 at high school). cooldown in minutes.
// tool: furniture group (or item id) the pig needs to own to do it
const HOBBIES = [
  { id: 'piano', name: '弹琴', icon: '🎹', subject: 'music', tool: 'piano', toolName: '琴', minutes: 10, effects: { mood: 12, energy: -4 }, cooldown: 30 },
  { id: 'paint', name: '画画', icon: '🖌️', subject: 'art', tool: 'easel', toolName: '画架', minutes: 10, effects: { mood: 12, energy: -3 }, cooldown: 30 },
  { id: 'soccer', name: '踢球', icon: '⚽', subject: 'pe', tool: 'ball', toolName: '皮球', minutes: 10, effects: { mood: 8, health: 4, energy: -10, hunger: -4 }, cooldown: 30 },
];
const HOBBY_BY_ID = Object.fromEntries(HOBBIES.map((h) => [h.id, h]));

// Toys are kept after use; cooldown is in minutes
const TOY_COST = { energy: -5, hunger: -2 };
// Playing the same toy gets boring: each play takes TOY_BORED_STEP off its fun (down to TOY_MIN_FUN),
// and one play's worth of boredom wears off every TOY_BORED_RECOVER_H hours
const TOY_BORED_STEP = 0.25;
const TOY_MIN_FUN = 0.2;
const TOY_BORED_RECOVER_H = 2;

const ITEMS = [
  { id: 'apple', cat: 'food', name: '苹果', icon: '🍎', price: 5, effects: { hunger: 8, mood: 1 } },
  { id: 'bread', cat: 'food', name: '面包', icon: '🍞', price: 10, effects: { hunger: 15 } },
  { id: 'milk', cat: 'food', name: '牛奶', icon: '🥛', price: 12, effects: { hunger: 10, health: 2 } },
  { id: 'rice', cat: 'food', name: '米饭', icon: '🍚', price: 18, effects: { hunger: 25 } },
  { id: 'dumpling', cat: 'food', name: '饺子', icon: '🥟', price: 28, effects: { hunger: 35, mood: 3 } },
  { id: 'burger', cat: 'food', name: '汉堡', icon: '🍔', price: 35, effects: { hunger: 45, mood: 5, health: -2 } },
  { id: 'pizza', cat: 'food', name: '披萨', icon: '🍕', price: 50, effects: { hunger: 60, mood: 5 } },
  { id: 'cake', cat: 'food', name: '蛋糕', icon: '🍰', price: 60, effects: { hunger: 30, mood: 15 } },
  { id: 'feast', cat: 'food', name: '满汉全席', icon: '🍲', price: 200, effects: { hunger: 100, mood: 20, health: 5 } },

  { id: 'wipes', cat: 'hygiene', name: '湿巾', icon: '🧻', price: 5, effects: { clean: 10 } },
  { id: 'soap', cat: 'hygiene', name: '香皂', icon: '🧼', price: 15, effects: { clean: 25 } },
  { id: 'shampoo', cat: 'hygiene', name: '洗发水', icon: '🧴', price: 30, effects: { clean: 40 } },
  { id: 'bodywash', cat: 'hygiene', name: '沐浴露', icon: '🚿', price: 60, effects: { clean: 70, mood: 5 } },
  { id: 'spa', cat: 'hygiene', name: '泡泡浴', icon: '🛁', price: 120, effects: { clean: 100, mood: 15 } },

  { id: 'ball', cat: 'toy', name: '皮球', icon: '⚽', price: 30, effects: { mood: 12 }, cooldown: 20 },
  { id: 'blocks', cat: 'toy', name: '积木', icon: '🧩', price: 60, effects: { mood: 18 }, cooldown: 30 },
  { id: 'kite', cat: 'toy', name: '风筝', icon: '🪁', price: 90, effects: { mood: 22 }, cooldown: 30 },
  { id: 'bear', cat: 'toy', name: '毛绒熊', icon: '🧸', price: 150, effects: { mood: 30 }, cooldown: 45 },
  { id: 'car', cat: 'toy', name: '遥控车', icon: '🏎️', price: 220, effects: { mood: 38 }, cooldown: 45 },
  { id: 'console', cat: 'toy', name: '游戏机', icon: '🎮', price: 400, effects: { mood: 50 }, cooldown: 60 },

  { id: 'vitamin', cat: 'medicine', name: '维生素', icon: '🍬', price: 20, effects: { health: 10 } },
  { id: 'coldmed', cat: 'medicine', name: '感冒药', icon: '💊', price: 45, effects: { health: 30, mood: -3 } },
  { id: 'fevermed', cat: 'medicine', name: '退烧药', icon: '🌡️', price: 70, effects: { health: 45, mood: -3 } },
  { id: 'firstaid', cat: 'medicine', name: '急救包', icon: '🩹', price: 150, effects: { health: 80 } },

  // worn on the head or the face; bought once (see WEAR_SVG in pet.js for the drawings)
  { id: 'bow', cat: 'wear', slot: 'head', name: '粉色蝴蝶结', icon: '🎀', price: 80, effects: {} },
  { id: 'flower', cat: 'wear', slot: 'head', name: '小花发夹', icon: '🌸', price: 120, effects: {} },
  { id: 'shades', cat: 'wear', slot: 'face', name: '酷酷墨镜', icon: '🕶️', price: 200, effects: {} },
  { id: 'tophat', cat: 'wear', slot: 'head', name: '绅士礼帽', icon: '🎩', price: 350, effects: {} },
  { id: 'crown', cat: 'wear', slot: 'head', name: '小皇冠', icon: '👑', price: 600, effects: {} },

  // furniture for the pig's home, bought once. Only the best item of each group counts.
  // bonus multiplies: sleep (energy regained asleep), bath (free bath), study (exp from classes),
  // moodDrain (how fast mood drops), piano / paint (those hobbies; owning one unlocks the hobby)
  { id: 'bed1', cat: 'furniture', group: 'bed', name: '小木床', icon: '🛏️', price: 300, effects: {}, bonus: { sleep: 1.25 } },
  { id: 'bed2', cat: 'furniture', group: 'bed', name: '软软大床', icon: '🛏️', price: 1200, effects: {}, bonus: { sleep: 1.5 } },
  { id: 'bed3', cat: 'furniture', group: 'bed', name: '豪华公主床', icon: '🛌', price: 5000, effects: {}, bonus: { sleep: 2 } },
  { id: 'tub1', cat: 'furniture', group: 'tub', name: '小浴缸', icon: '🛁', price: 400, effects: {}, bonus: { bath: 1.5 } },
  { id: 'tub2', cat: 'furniture', group: 'tub', name: '按摩浴缸', icon: '🫧', price: 3000, effects: {}, bonus: { bath: 2.5 } },
  { id: 'desk1', cat: 'furniture', group: 'desk', name: '小书桌', icon: '📝', price: 250, effects: {}, bonus: { study: 1.1 } },
  { id: 'desk2', cat: 'furniture', group: 'desk', name: '实木书桌配台灯', icon: '💡', price: 2000, effects: {}, bonus: { study: 1.25 } },
  { id: 'sofa1', cat: 'furniture', group: 'sofa', name: '小沙发', icon: '🛋️', price: 300, effects: {}, bonus: { moodDrain: 0.85 } },
  { id: 'sofa2', cat: 'furniture', group: 'sofa', name: '真皮沙发', icon: '🛋️', price: 2500, effects: {}, bonus: { moodDrain: 0.7 } },
  { id: 'piano1', cat: 'furniture', group: 'piano', name: '电子琴', icon: '🎹', price: 300, effects: {}, bonus: { piano: 1 } },
  { id: 'piano2', cat: 'furniture', group: 'piano', name: '立式钢琴', icon: '🎹', price: 2000, effects: {}, bonus: { piano: 1.3 } },
  { id: 'piano3', cat: 'furniture', group: 'piano', name: '三角钢琴', icon: '🎼', price: 12000, effects: {}, bonus: { piano: 1.6 } },
  { id: 'easel1', cat: 'furniture', group: 'easel', name: '小画架', icon: '🖼️', price: 150, effects: {}, bonus: { paint: 1 } },
  { id: 'easel2', cat: 'furniture', group: 'easel', name: '专业画室', icon: '🎨', price: 3000, effects: {}, bonus: { paint: 1.3 } },
  { id: 'house1', cat: 'furniture', group: 'house', tier: 1, name: '温馨公寓', icon: '🏠', price: 20000, effects: {}, bonus: { sleep: 1.1, moodDrain: 0.9 } },
  { id: 'house2', cat: 'furniture', group: 'house', tier: 2, name: '花园别墅', icon: '🏡', price: 80000, effects: {}, bonus: { sleep: 1.25, moodDrain: 0.8 } },
  { id: 'house3', cat: 'furniture', group: 'house', tier: 3, name: '猪猪城堡', icon: '🏰', price: 200000, effects: {}, bonus: { sleep: 1.4, moodDrain: 0.7 } },
  // late-game upgrades, for when there's more money than things to buy
  { id: 'bed4', cat: 'furniture', group: 'bed', name: '云朵床', icon: '🛏️', price: 20000, effects: {}, bonus: { sleep: 2.5 } },
  { id: 'tub3', cat: 'furniture', group: 'tub', name: '私人温泉', icon: '♨️', price: 25000, effects: {}, bonus: { bath: 3.5 } },
  { id: 'desk3', cat: 'furniture', group: 'desk', name: '书房', icon: '📚', price: 15000, effects: {}, bonus: { study: 1.4 } },
  { id: 'sofa3', cat: 'furniture', group: 'sofa', name: '懒人沙发', icon: '🛋️', price: 12000, effects: {}, bonus: { moodDrain: 0.6 } },
  // needsTier: only fits from that house up (2 = 花园别墅)
  { id: 'kitchen1', cat: 'furniture', group: 'kitchen', needsTier: 2, name: '小厨房', icon: '🍳', price: 3000, effects: {}, bonus: { food: 1.1 } },
  { id: 'kitchen2', cat: 'furniture', group: 'kitchen', needsTier: 2, name: '大厨房', icon: '🧑‍🍳', price: 15000, effects: {}, bonus: { food: 1.25 } },

  // decorations: only for looks, each takes one of the house's decoration spots
  { id: 'rug', cat: 'decor', name: '圆地毯', icon: '🧶', price: 1000, effects: {} },
  { id: 'plant', cat: 'decor', name: '大盆栽', icon: '🪴', price: 1500, effects: {} },
  { id: 'lamp', cat: 'decor', name: '小灯笼', icon: '🏮', price: 3000, effects: {} },
  { id: 'aquarium', cat: 'decor', name: '鱼缸', icon: '🐠', price: 8000, effects: {} },
  { id: 'trophy', cat: 'decor', name: '奖杯柜', icon: '🏆', price: 12000, effects: {} },
  { id: 'painting', cat: 'decor', name: '名画', icon: '🖼️', price: 20000, effects: {} },
  { id: 'globe', cat: 'decor', name: '地球仪', icon: '🌍', price: 30000, effects: {} },
  { id: 'stars', cat: 'decor', name: '星空天花板', icon: '🌌', price: 50000, effects: {} },

  // donations to the city: they appear on the map
  { id: 'fountain', cat: 'city', name: '喷泉', icon: '⛲', price: 30000, effects: {} },
  { id: 'bridge', cat: 'city', name: '彩虹桥', icon: '🌈', price: 60000, effects: {} },
  { id: 'ferris', cat: 'city', name: '摩天轮', icon: '🎡', price: 100000, effects: {} },
  { id: 'statue', cat: 'city', name: '金猪雕像', icon: '🐷', price: 300000, effects: {} },

  // sold only by a neighbour who loves the pig (npc: who, at NPC_MAX_HEARTS)
  { id: 'cap', cat: 'wear', slot: 'head', npc: 'dog', name: '工作帽', icon: '🧢', price: 250, effects: {} },
  { id: 'carrotcake', cat: 'food', npc: 'rabbit', name: '胡萝卜蛋糕', icon: '🥕', price: 80, effects: { hunger: 40, mood: 20 } },
  { id: 'bubbler', cat: 'furniture', group: 'bubbler', npc: 'raccoon', name: '泡泡机', icon: '🫧', price: 2000, effects: {}, bonus: { bath: 1.2 } },
  { id: 'pinecone', cat: 'toy', npc: 'squirrel', name: '松果陀螺', icon: '🌰', price: 200, effects: { mood: 35 }, cooldown: 20 },
  { id: 'starclip', cat: 'wear', slot: 'head', npc: 'cat', name: '星星发卡', icon: '⭐', price: 300, effects: {} },
  { id: 'treehouse', cat: 'decor', npc: 'bear', name: '小树屋', icon: '🌳', price: 6000, effects: {} },
  { id: 'honey', cat: 'medicine', npc: 'sheep', name: '蜂蜜糖', icon: '🍯', price: 60, effects: { health: 40, mood: 10 } },
  { id: 'gradcap', cat: 'wear', slot: 'head', npc: 'owl', name: '博士帽', icon: '🎓', price: 500, effects: {} },
  { id: 'chesstable', cat: 'decor', npc: 'turtle', name: '棋盘桌', icon: '♟️', price: 4000, effects: {} },
  { id: 'pot', cat: 'furniture', group: 'pot', npc: 'duck', name: '大厨锅', icon: '🍲', price: 2500, effects: {}, bonus: { food: 1.1 } },
];

const BONUS_NAME = { sleep: '睡觉恢复', bath: '洗澡', study: '学习经验', moodDrain: '心情消耗', piano: '弹琴', paint: '画画', food: '食物效果' };
const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---------- neighbours in Pig City ----------
// Hearts go from 0 to NPC_MAX_HEARTS: +1 for the first hello of the day, +2 for a wish granted.
// At NPC_PERK_HEARTS each one gives a perk; at the max their shop sells their special item.
const NPC_PERK_HEARTS = 5;
const NPC_MAX_HEARTS = 10;
const NPC_WISHES_PER_DAY = 3;
// what neighbours wish for: cheap everyday things
const WISH_CATS = ['food', 'hygiene', 'medicine'];
const WISH_MAX_PRICE = 70;

const NPCS = [
  { id: 'dog', name: '柴柴', species: 'dog', place: 'tower', hello: ['今天也加油💪', '有新活儿哦📋', '汪！早呀🌞'], perk: { key: 'pay', v: 1.05, text: '打工工资 +5%' } },
  { id: 'rabbit', name: '兔婆婆', species: 'rabbit', place: 'bakery', hello: ['刚出炉的🍞', '多吃点呀', '乖孩子😊'], perk: { key: 'discount', cats: ['food'], v: 0.9, text: '食物 9 折' } },
  { id: 'raccoon', name: '浣浣', species: 'raccoon', place: 'bubble', hello: ['洗干净没🫧', '香香的✨', '别把泥带进来！'], perk: { key: 'discount', cats: ['hygiene'], v: 0.9, text: '卫生用品 9 折' } },
  { id: 'squirrel', name: '栗栗', species: 'squirrel', place: 'toy', hello: ['来玩来玩🎈', '新玩具到啦！', '吱吱~'], perk: { key: 'toyRecover', v: 2, text: '玩腻的玩具恢复快一倍' } },
  { id: 'cat', name: '咪咪', species: 'cat', place: 'clothes', hello: ['还行吧😼', '这个衬你🎀', '喵~'], perk: { key: 'discount', cats: ['wear'], v: 0.9, text: '装扮 9 折' } },
  { id: 'bear', name: '熊师傅', species: 'bear', place: 'furniture', hello: ['结实着呢🪵', '慢慢挑', '嘿咻！'], perk: { key: 'discount', cats: ['furniture', 'decor'], v: 0.9, text: '家具和装饰 9 折' } },
  { id: 'sheep', name: '绵绵医生', species: 'sheep', place: 'clinic', hello: ['多喝水哦💧', '早睡早起~', '咩~'], perk: { key: 'clinicCd', v: 0.5, text: '免费看病等待减半' } },
  { id: 'owl', name: '咕咕校长', species: 'owl', place: 'primary', hello: ['好好学习📚', '咕咕~', '知识就是力量'], perk: { key: 'study', v: 1.05, text: '上课经验 ×1.05' } },
  { id: 'turtle', name: '龟爷爷', species: 'turtle', place: 'chess', hello: ['来一盘？♟️', '慢慢来…', '呵呵呵'], perk: { key: 'playCap', v: 10, text: '每日游戏经验上限 +10' } },
  { id: 'duck', name: '嘎嘎大厨', species: 'duck', place: 'canteen', hello: ['开饭啦🍚', '嘎嘎！', '管饱！'], perk: { key: 'canteen', v: 10, text: '食堂饱食 +10' } },
];
const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));
