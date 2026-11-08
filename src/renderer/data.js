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
// Asleep, hunger, cleanliness, mood and health stop falling at this
const SLEEP_FLOOR = 20;
// No keyboard or mouse for this long and the pig goes to sleep until you come back
const AWAY_MINUTES = 10;
// The pig feeds itself from the bag below this hunger, and takes medicine below this health
const SELF_FEED_BELOW = 25;
const SELF_MEDICINE_BELOW = 30;

// Studying drains faster than idling but slower than working (each job has its own drain)
const STUDY_DRAIN = { hunger: 1.6, clean: 1, mood: 1.8, energy: 3 };

// Free but slow, so hygiene items are worth buying to save time
const BATH_MINUTES = 15;
const BATH_EFFECT = { clean: 20, mood: 3 };
// Petting: a little mood, at most every 20 s and only up to 60
const PET_MOOD = { mood: 2, everyMs: 20000, upTo: 60 };
const PLAY_EFFECT = { mood: 8, energy: -8, hunger: -3 };
const MINIGAME_COST = { energy: -5, hunger: -2 };

// Free help so a broke, sick pig can always recover. It takes a while (minutes), so buying
// food or medicine is the quick way. cooldown in minutes.
const FREE_HELP = [
  { id: 'meal', name: '食堂', icon: '🍱', effects: { hunger: 20 }, minutes: 15, cooldown: 90, label: '在食堂吃饭' },
  { id: 'clinic', name: '诊所', icon: '🏥', effects: { health: 20 }, minutes: 20, cooldown: 60, maxHealth: 40, label: '在诊所看病' },
  // not free: a soak in the mud spring, for a small fee. Quicker than sleeping it off.
  { id: 'soak', name: '泡温泉', icon: '♨️', effects: { energy: 50, mood: 15, health: 3 }, minutes: 15, cooldown: 90, fee: 20, label: '在泡温泉' },
  // a film at the cinema: a big lift for the mood
  { id: 'movie', name: '电影院', icon: '🎬', effects: { mood: 35, energy: -5 }, minutes: 25, cooldown: 180, fee: 30, label: '在看电影' },
  // only ever done with a friend (see OUTINGS)
  { id: 'cafe', name: '咖啡馆', icon: '☕', effects: { mood: 12, energy: 10, hunger: 6 }, minutes: 15, cooldown: 120, fee: 15, label: '在喝东西' },
  { id: 'read', name: '书店', icon: '📚', effects: { mood: 15 }, minutes: 20, cooldown: 120, label: '在看书' },
  { id: 'ducks', name: '鸭鸭湖', icon: '🦆', effects: { mood: 14, energy: -3 }, minutes: 10, cooldown: 120, label: '在喂鸭子' },
  { id: 'garden', name: '菜园', icon: '🌱', effects: { mood: 8, energy: -4 }, minutes: 10, cooldown: 180, label: '在菜园帮忙' },
  { id: 'kite', name: '球场', icon: '🪁', effects: { mood: 16, energy: -6 }, minutes: 15, cooldown: 120, label: '在放风筝' },
  { id: 'stars', name: '科技馆', icon: '🔭', effects: { mood: 18 }, minutes: 15, cooldown: 240, label: '在看星星' },
  // the theme park's rides (park: only while it's open, PARK_HOURS), and its fireworks
  { id: 'ferris', name: '摩天轮', icon: '🎡', effects: { mood: 20 }, minutes: 10, cooldown: 120, fee: 20, park: true, label: '在坐摩天轮' },
  { id: 'carousel', name: '旋转木马', icon: '🎠', effects: { mood: 14 }, minutes: 8, cooldown: 90, fee: 12, park: true, label: '在坐旋转木马' },
  { id: 'haunted', name: '鬼屋', icon: '👻', effects: { mood: 18, energy: -6 }, minutes: 10, cooldown: 120, fee: 18, park: true, label: '在逛鬼屋' },
  { id: 'fireworks', name: '烟花', icon: '🎆', effects: { mood: 22 }, minutes: 15, cooldown: 600, label: '在看烟花' },
  // on a festival day (FESTIVALS)
  { id: 'newyear', name: '庙会', icon: '🧧', effects: { mood: 25 }, minutes: 15, cooldown: 600, label: '在逛庙会' },
  { id: 'lantern', name: '灯会', icon: '🏮', effects: { mood: 22 }, minutes: 15, cooldown: 600, label: '在看花灯' },
  { id: 'dragon', name: '龙舟', icon: '🐉', effects: { mood: 22 }, minutes: 15, cooldown: 600, label: '在看龙舟' },
  { id: 'moon', name: '赏月', icon: '🌕', effects: { mood: 22 }, minutes: 15, cooldown: 600, label: '在赏月' },
  { id: 'xmas', name: '圣诞树', icon: '🎄', effects: { mood: 22 }, minutes: 15, cooldown: 600, label: '在看圣诞树' },
];
// The theme park is open from 9 in the morning to 10 at night by the town's clock, and there are
// fireworks on Saturday and Sunday nights (and on 春节) at FIREWORKS_HOURS
const PARK_HOURS = [9 * 60, 22 * 60];
const FIREWORKS_HOURS = [20 * 60, 21 * 60];
// Going somewhere with a friend (🤝 then 📍): what they do there, the help it is (or the hobby), and
// when it's on (minutes past midnight; the stars only after dark). Fees are paid for two. The
// garden goes quicker with help: every plot growing jumps ahead GARDEN_HELP_MIN.
const OUTINGS = [
  { id: 'eat', name: '一起吃饭', icon: '🍱', help: 'meal', meal: true },
  { id: 'soak', name: '一起泡温泉', icon: '♨️', help: 'soak' },
  { id: 'movie', name: '一起看电影', icon: '🎬', help: 'movie' },
  { id: 'soccer', name: '一起踢球', icon: '⚽', hobby: 'soccer' },
  { id: 'cafe', name: '一起喝东西', icon: '☕', help: 'cafe' },
  { id: 'read', name: '一起看书', icon: '📚', help: 'read' },
  { id: 'ducks', name: '一起喂鸭子', icon: '🦆', help: 'ducks' },
  { id: 'garden', name: '一起种菜', icon: '🌱', help: 'garden' },
  { id: 'kite', name: '一起放风筝', icon: '🪁', help: 'kite', hours: [6 * 60, 19 * 60] },
  { id: 'stars', name: '一起看星星', icon: '🔭', help: 'stars', hours: [19 * 60 + 30, 24 * 60] },
  { id: 'ferris', name: '一起坐摩天轮', icon: '🎡', help: 'ferris', hours: PARK_HOURS },
  { id: 'carousel', name: '一起坐旋转木马', icon: '🎠', help: 'carousel', hours: PARK_HOURS },
  { id: 'haunted', name: '一起逛鬼屋', icon: '👻', help: 'haunted', hours: PARK_HOURS },
  { id: 'fireworks', name: '一起看烟花', icon: '🎆', help: 'fireworks', fireworks: true },
  // only on that festival's day
  { id: 'newyear', name: '一起逛庙会', icon: '🧧', help: 'newyear', festival: 'newyear', hours: [9 * 60, 21 * 60] },
  { id: 'lantern', name: '一起看花灯', icon: '🏮', help: 'lantern', festival: 'lantern', hours: [18 * 60, 24 * 60] },
  { id: 'dragon', name: '一起看龙舟', icon: '🐉', help: 'dragon', festival: 'dragon', hours: [9 * 60, 18 * 60] },
  { id: 'moon', name: '一起赏月', icon: '🌕', help: 'moon', festival: 'moon', hours: [18 * 60 + 30, 24 * 60] },
  { id: 'xmas', name: '一起看圣诞树', icon: '🎄', help: 'xmas', festival: 'xmas', hours: [17 * 60, 24 * 60] },
];
const OUTING_BY_ID = Object.fromEntries(OUTINGS.map((o) => [o.id, o]));
const GARDEN_HELP_MIN = 30;

// Festivals, by the real calendar (like birthdays). The lunar ones fall on another day each year,
// so their dates are listed; 元宵 is fourteen days after 春节. food: what neighbours give that day
// (once they know the pig a little, FESTIVAL_GIFT_HEARTS). In the days before (FESTIVAL_INVITE_DAYS)
// they ask him along; on the day the town is decorated and there's something to go and see.
const LUNAR_NEW_YEAR = { 2026: '2-17', 2027: '2-6', 2028: '1-26', 2029: '2-13', 2030: '2-3', 2031: '1-23', 2032: '2-11' };
const FESTIVALS = [
  { id: 'newyear', name: '春节', icon: '🧧', food: 'dumpling', place: 'plaza', dates: LUNAR_NEW_YEAR },
  { id: 'lantern', name: '元宵节', icon: '🏮', food: 'tangyuan', place: 'plaza', after: ['newyear', 14] },
  { id: 'dragon', name: '端午节', icon: '🐉', food: 'zongzi', place: 'lake', dates: { 2026: '6-19', 2027: '6-9', 2028: '5-28', 2029: '6-16', 2030: '6-5', 2031: '6-24', 2032: '6-12' } },
  { id: 'moon', name: '中秋节', icon: '🥮', food: 'mooncake', place: 'lake', dates: { 2026: '9-25', 2027: '9-15', 2028: '10-3', 2029: '9-22', 2030: '9-12', 2031: '10-1', 2032: '9-19' } },
  { id: 'xmas', name: '圣诞节', icon: '🎄', food: 'gingerbread', place: 'plaza', date: '12-25' },
];
const FESTIVAL_BY_ID = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));
const FESTIVAL_INVITE_DAYS = 3;
const FESTIVAL_GIFT_HEARTS = 2;

// Fishing at 鸭鸭湖: a few casts a go (FISH_CASTS), then a rest. w: how often each comes up;
// night: only bites after dark. Fish are sold at the barn or given to friends.
const FISH_CASTS = 5;
const FISH_COOLDOWN = 30;
const FISH_COST = { energy: -6, hunger: -2, mood: 6 };
const FISH = [
  { id: 'crucian', w: 30 }, { id: 'shrimp', w: 22 }, { id: 'boot', w: 10 }, { id: 'puffer', w: 14 },
  { id: 'crab', w: 12 }, { id: 'tropical', w: 6 }, { id: 'octopus', w: 4, night: true }, { id: 'koi', w: 2 },
];
// What's on at the cinema: one a day, in turn
const FILMS = ['月亮上的小猪', '胡萝卜大冒险', '鸭鸭湖的秘密', '会飞的松果', '下雨天的蘑菇', '小熊的树屋', '星星掉进了喷泉'];
// The barn buys what the vegetable patch grows, at this share of the shop price: a crop sells for
// a little more than its seeds cost, and never for more than the farm market charges a friend
const BARN_RATE = 0.8;
const FREE_HELP_BY_ID = Object.fromEntries(FREE_HELP.map((h) => [h.id, h]));

// Health below this stops studying and working
const MIN_HEALTH_TO_ACT = 40;

const MINIGAMES = [
  { id: 'rps', name: '石头剪刀布', icon: '✊', desc: '' },
  { id: 'ttt', name: '井字棋', icon: '⭕', desc: '' },
  { id: 'penalty', name: '点球大战', icon: '⚽', desc: '' },
  { id: 'bumper', name: '碰碰车', icon: '🚗', desc: '' },
  { id: 'chess', name: '国际象棋', icon: '♟️', desc: '' },
  { id: 'banqi', name: '战棋', icon: '🀄', desc: '',
    rules: [
      '6×6 的棋盘上 36 枚棋子全部扣着，随机摆放。你和小猪各 18 枚：国王 1、元帅 1、将军 2、骑士 4、士兵 4、刺客 6。',
      '你先走。每回合二选一：翻开任意一枚扣着的棋子（翻出谁的就归谁），或者走一枚自己翻开的棋子。',
      '棋子每次上下左右走一格，可以走进空格，也可以吃掉相邻的、已经翻开的对方棋子。',
      '大的吃小的，同级也能吃：国王 > 元帅 > 将军 > 骑士 > 士兵 > 刺客。例外：刺客能吃国王，国王吃不了刺客。',
      '吃光对方的棋子，或者轮到对方时对方没有棋可走，就赢了。',
      '连续 30 步都没有吃子，算平局。',
    ] },
];

// ---------- level (age) ----------

const MAX_LEVEL = 30;

// Pig City keeps its own clock (s.clock): while the pig has nothing on it runs this many times
// faster than real time, so a player who always comes at the same hour still sees the town at
// every time of day. While he's doing something (a lesson, a shift, a soak, asleep) and while
// the app is closed it keeps real time: a 45-minute lesson is 45 minutes in town too.
const TOWN_SPEED = 6;
// Time alone grows the pig slowly (awake, asleep or closed); studying grows it fastest.
// Little ones (below Lv.6) grow mostly by playing, and get nothing from working.
const EXP_PER_MIN = { alive: 0.1, kidAlive: 0.02, study: 1, work: 0.1 };
const EXP_PER_SHIFT = 2;
const EXP_PER_LESSON = 5;
// Each school level is a school year, so it lasts about as long as that year's lessons need.
// LEVEL_DAYS: roughly how many days a level takes someone who checks in a few times a day
// (the exp of that year's lessons is added on top, below the course list).
const LEVEL_DAYS = {
  6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3, // primary, grades 1-6
  12: 4, 13: 4, 14: 4, // middle school
  15: 5, 16: 5, 17: 5, // high school
  18: 5, 19: 5, 20: 5, 21: 5, // university
  22: 6, 23: 6, 24: 6, // master
  25: 7, 26: 7, 27: 7, // phd
  28: 30, 29: 35, // a career
};
// exp a day of just living brings in (time, a little play and work), used with LEVEL_DAYS
const EXP_PER_DAY = 200;

// Exp from playing, by how hard it is to win. The same at every age: it matters a lot while
// levels are cheap and little once they cost more. Only PLAY_EXP_DAILY counts each day.
const PLAY_EXP = {
  play: 3,
  toy: 5,
  hobby: 4,
  rps: { win: 3, draw: 2, lose: 1 },
  ttt: { win: 6, draw: 4, lose: 2 },
  penalty: { win: 10, draw: 6, lose: 3 },
  bumper: { win: 10, draw: 6, lose: 3 },
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
// Every lesson is about a pomodoro long: 45 minutes, electives 40
const LESSON_MIN = 45;
const ELECTIVE_MIN = 40;

const STAGES = [
  { id: 'primary', name: '小学', icon: '🎒', minLevel: 6, needs: null, degree: '小学毕业', student: '小学生', fee: 0 },
  { id: 'middle', name: '初中', icon: '📘', minLevel: 12, needs: 'primary', degree: '初中毕业', student: '初中生', fee: 0 },
  { id: 'high', name: '高中', icon: '📗', minLevel: 15, needs: 'middle', degree: '高中毕业', student: '高中生', fee: 10 },
  // from university up a degree needs every required course of the major plus enough credits
  { id: 'college', name: '大学', icon: '🎓', minLevel: 18, degree: '学士', student: '大学生', byMajor: true, fee: 50, credits: 30 },
  { id: 'master', name: '研究生', icon: '📜', minLevel: 22, degree: '硕士', student: '研究生', byMajor: true, fee: 80, credits: 21 },
  { id: 'phd', name: '博士', icon: '🔬', minLevel: 25, degree: '博士', student: '博士生', byMajor: true, fee: 100, credits: 16 },
];
const CREDITS = { required: 3, elective: 2 };
// Every course is a few lessons. At school a subject has one lesson per school year (level), so a
// grade-3 lesson opens at the third level of that school. Some subjects start in a later grade.
const GRADES = { primary: 6, middle: 3, high: 3 };
const SUBJECT_START = { 'middle:physics': 1, 'middle:chemistry': 2 };
// At university a required course is 8 lessons over two years, an elective 4 lessons in one year;
// the year each one opens, by position
const UNI_LESSONS = { required: 8, elective: 4, perYear: 4 };
const REQ_YEARS = { college: [0, 0, 1, 1, 2, 2], master: [0, 0, 1, 1, 1], phd: [0, 0, 1, 1] };
const ELEC_YEARS = { college: [0, 1, 2, 3], master: [0, 1, 2], phd: [1, 2] };

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
    master: { req: ['猪工智能', '分布式系统', '编译原理', '云计算', '人机交互'], elec: ['计算机视觉', '信息安全', '机器人'] },
    phd: { req: ['机器学习研究', '猪脑模拟研究', '量子计算研究', '博士论文答辩'], elec: ['前沿讲座', '论文写作'] },
  },
  {
    id: 'med', name: '医学', icon: '🩺', needs: ['high_biology', 'high_chemistry'],
    college: { req: ['猪体解剖', '猪猪生理学', '猪病理学', '猪猪临床', '猪猪药理学', '猪猪诊断学'], elec: ['猪猪营养学', '急救常识', '猪猪心理', '中猪医'] },
    master: { req: ['猪猪内科', '猪猪外科', '猪猪儿科', '急诊医学', '神经科学'], elec: ['影像学', '麻醉学', '康复医学'] },
    phd: { req: ['猪猪健康研究', '长寿猪研究', '免疫学研究', '博士论文答辩'], elec: ['临床试验', '论文写作'] },
  },
  {
    id: 'fin', name: '金融', icon: '💹', needs: ['high_math', 'high_politics'],
    college: { req: ['经济学原理', '存钱罐会计学', '金融市场', '小猪储蓄投资', '统计学', '货币银行学'], elec: ['保险学', '税法', '理财规划', '电子支付'] },
    master: { req: ['公司金融', '存钱罐工程', '风险管理', '投资组合', '金融科技'], elec: ['量化交易', '行为金融', '国际金融'] },
    phd: { req: ['宏观经济研究', '猪肉价格研究', '金融危机研究', '博士论文答辩'], elec: ['计量经济', '论文写作'] },
  },
  {
    id: 'law', name: '法学', icon: '⚖️', needs: ['high_chinese', 'high_politics', 'high_history'],
    college: { req: ['法理学', '宪法', '猪权民法', '刑法', '合同法', '行政法'], elec: ['知识产权', '环境法', '劳动法', '法律英语'] },
    master: { req: ['诉讼法', '国际法', '商法', '知识产权法', '司法实务'], elec: ['仲裁实务', '海商法', '法律文书'] },
    phd: { req: ['动物权益研究', '比较法研究', '猪权法治研究', '博士论文答辩'], elec: ['法哲学', '论文写作'] },
  },
  {
    id: 'edu', name: '教育学', icon: '🍎', needs: ['high_chinese', 'high_english'],
    college: { req: ['教育学原理', '小猪心理学', '课程设计', '教学实践', '教育统计', '班级管理'], elec: ['儿童文学', '特殊教育', '教育技术', '游戏化教学'] },
    master: { req: ['教育心理学', '猪猪幼儿园管理', '教育评价', '课程与教学论', '学校管理'], elec: ['比较教育', '家庭教育', '教育政策'] },
    phd: { req: ['教育理论研究', '学习科学研究', '儿童发展研究', '博士论文答辩'], elec: ['质性研究', '论文写作'] },
  },
  {
    id: 'civil', name: '土木工程', icon: '🏗️', needs: ['high_math', 'high_physics'],
    college: { req: ['工程力学', '稻草与砖块', '结构设计', '防狼房屋施工', '材料力学', '工程测量'], elec: ['园林设计', '给排水', '工程制图', '建筑美学'] },
    master: { req: ['桥梁工程', '泥坑工程', '抗震设计', '岩土工程', '城市规划'], elec: ['隧道工程', '绿色建筑', '施工管理'] },
    phd: { req: ['结构理论研究', '智能猪舍研究', '防灾工程研究', '博士论文答辩'], elec: ['数值模拟', '论文写作'] },
  },
  {
    id: 'arts', name: '艺术', icon: '🎭', needs: ['high_music', 'high_art'],
    college: { req: ['乐理与和声', '素描与色彩', '猪猪设计', '舞台表演', '艺术史', '毕业创作'], elec: ['摄影', '动画', '书法', '陶艺'] },
    master: { req: ['作曲', '油画创作', '策展', '当代艺术', '艺术管理'], elec: ['电影配乐', '版画', '舞台美术'] },
    phd: { req: ['猪猪美学研究', '艺术史研究', '艺术创作研究', '博士论文答辩'], elec: ['艺术评论', '论文写作'] },
  },
];
// General electives (通识): any university student can take them, and they count for every major
const GENERAL_ELECTIVES = [
  { id: 'philo', name: '猪猪哲学', icon: '🤔' }, { id: 'music', name: '音乐鉴赏', icon: '🎧' },
  { id: 'film', name: '电影赏析', icon: '🎬' }, { id: 'mind', name: '心理健康', icon: '💗' },
  { id: 'startup', name: '创业基础', icon: '🚀' }, { id: 'lang', name: '第二外语', icon: '🗣️' },
  { id: 'astro', name: '天文学', icon: '🔭' }, { id: 'cook', name: '烹饪课', icon: '🍳' },
];
// which earlier required courses (by position) each required course needs
const REQ_PREREQ = { 6: [[], [0], [0], [1], [2], [3, 4]], 5: [[], [0], [0], [1], [2]], 4: [[], [0], [1], [2]] };
const PREV_STAGE = { master: 'college', phd: 'master' };

const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
const MAJOR_BY_ID = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

// Every course in one flat list: { id, stage, subject|major, name, fullName, icon, minutes, prereq,
// lessons, open, perLevel }. minutes is one lesson; lesson k (from 1) opens at level
// open + floor((k - 1) / perLevel). A prerequisite in the same stage is needed lesson by lesson
// (lesson k needs its lesson k); one from an earlier stage must be finished.
const COURSES = [];
for (const [stageId, subjects] of Object.entries(BASIC_COURSES)) {
  const stage = STAGE_BY_ID[stageId];
  for (const [subjectId, prereq] of Object.entries(subjects)) {
    const subj = SUBJECT_BY_ID[subjectId];
    const name = SUBJECT_ALIAS[`${stageId}:${subjectId}`] || subj.name;
    const start = SUBJECT_START[`${stageId}:${subjectId}`] || 0;
    COURSES.push({
      id: `${stageId}_${subjectId}`,
      stage: stageId,
      subject: subjectId,
      name,
      fullName: `${stage.name}${name}`,
      icon: subj.icon,
      minutes: subj.elective ? ELECTIVE_MIN : LESSON_MIN,
      prereq,
      elective: !!subj.elective,
      lessons: GRADES[stageId] - start,
      open: stage.minLevel + start,
      perLevel: 1,
    });
  }
}
for (const m of MAJORS) {
  for (const stageId of ['college', 'master', 'phd']) {
    const { req, elec } = m[stageId];
    const lv = STAGE_BY_ID[stageId].minLevel;
    const reqIds = req.map((_, i) => `${stageId}_${m.id}_${i + 1}`);
    // the first required course needs the major's high school subjects, or the degree below
    const entry = PREV_STAGE[stageId] ? [`deg:${PREV_STAGE[stageId]}:${m.id}`] : m.needs;
    const common = { stage: stageId, major: m.id, icon: m.icon };
    req.forEach((name, i) => COURSES.push({
      ...common, id: reqIds[i], name, fullName: name,
      minutes: LESSON_MIN,
      prereq: i ? REQ_PREREQ[req.length][i].map((j) => reqIds[j]) : entry,
      credits: CREDITS.required,
      lessons: UNI_LESSONS.required, open: lv + REQ_YEARS[stageId][i], perLevel: UNI_LESSONS.perYear,
    }));
    // each major elective opens after one of the required courses
    elec.forEach((name, i) => COURSES.push({
      ...common, id: `${stageId}_${m.id}_e${i + 1}`, name, fullName: name,
      minutes: ELECTIVE_MIN,
      prereq: [reqIds[Math.min(i + (req.length >= 6 ? 1 : 0), req.length - 1)]],
      credits: CREDITS.elective, elective: true,
      lessons: UNI_LESSONS.elective, open: lv + ELEC_YEARS[stageId][i], perLevel: UNI_LESSONS.perYear,
    }));
  }
}
for (const [i, g] of GENERAL_ELECTIVES.entries()) {
  COURSES.push({
    id: `college_gen_${g.id}`, stage: 'college', name: g.name, fullName: g.name, icon: g.icon,
    minutes: ELECTIVE_MIN, prereq: [], credits: CREDITS.elective, elective: true, general: true,
    lessons: UNI_LESSONS.elective, open: STAGE_BY_ID.college.minLevel + (i % 4), perLevel: UNI_LESSONS.perYear,
  });
}
const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));
// The level lesson k (from 1) of a course opens at
const lessonLevel = (c, k) => c.open + Math.floor((k - 1) / c.perLevel);

// ---------- jobs ----------
// requires: course ids, or degrees as "deg:<stage>" / "deg:<stage>:<major>".
// drain: how many times faster than idle each stat drops while working.
// pay is not set by hand: it comes from jobPay() below, from how hard the job is to get and to do.

const JOBS = [
  { id: 'bottles', name: '拱松露', doing: true, icon: '🍄', minLevel: 3, requires: [], minutes: 20, drain: { hunger: 2, clean: 2.5, mood: 1.5, energy: 2 } },
  { id: 'flyer', name: '发传单', doing: true, icon: '📄', minLevel: 4, requires: [], minutes: 30, drain: { hunger: 2.5, clean: 2, mood: 2, energy: 3 } },
  { id: 'dishes', name: '洗碗工', icon: '🍽️', minLevel: 5, requires: [], minutes: 40, drain: { hunger: 2, clean: 2.5, mood: 2, energy: 3 } },
  { id: 'ballboy', name: '球场球童', icon: '🎾', minLevel: 10, requires: ['primary_pe@5'], minutes: 30, drain: { hunger: 3, clean: 2.5, mood: 1.5, energy: 4 } },
  { id: 'paper', name: '送报员', icon: '📰', minLevel: 8, requires: ['primary_chinese@3'], minutes: 30, drain: { hunger: 3, clean: 2, mood: 1.5, energy: 3.5 } },
  { id: 'busker', name: '街头卖艺', doing: true, icon: '🪗', minLevel: 8, requires: ['primary_music@3'], minutes: 30, drain: { hunger: 2, clean: 1.5, mood: 1.5, energy: 2.5 } },
  { id: 'portrait', name: '公园画肖像', doing: true, icon: '🖼️', minLevel: 9, requires: ['primary_art@4'], minutes: 40, drain: { hunger: 2, clean: 2, mood: 1.5, energy: 2 } },
  { id: 'museum', name: '科技馆讲解员', icon: '🔭', minLevel: 9, requires: ['primary_science@4'], minutes: 40, drain: { hunger: 2, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'mover', name: '砖房小工', icon: '🧱', minLevel: 10, requires: [], minutes: 60, drain: { hunger: 4, clean: 4, mood: 3, energy: 5 } },
  { id: 'cashier', name: '小卖部收银员', icon: '🏪', minLevel: 10, requires: ['primary_math@5'], minutes: 45, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 2.5 } },
  { id: 'courier', name: '快递员', icon: '📦', minLevel: 12, requires: ['deg:primary'], minutes: 60, drain: { hunger: 3.5, clean: 2.5, mood: 2, energy: 4.5 } },
  { id: 'pianoaide', name: '琴行助教', icon: '🎼', minLevel: 13, requires: ['middle_music@2'], minutes: 45, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'artaide', name: '美术班助教', icon: '🖍️', minLevel: 13, requires: ['middle_art@2'], minutes: 45, drain: { hunger: 1.8, clean: 2, mood: 2, energy: 2.5 } },
  { id: 'tutor', name: '家教', icon: '✏️', minLevel: 15, requires: ['middle_math', 'middle_english'], minutes: 45, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 2.5 } },
  { id: 'coach', name: '少儿体育教练', icon: '🏃', minLevel: 16, requires: ['high_pe@2'], minutes: 60, drain: { hunger: 3, clean: 2.5, mood: 1.8, energy: 4 } },
  { id: 'band', name: '乐队主唱', icon: '🎸', minLevel: 17, requires: ['high_music'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 1.5, energy: 3.5 } },
  { id: 'illustrator', name: '绘本插画师', icon: '📚', minLevel: 17, requires: ['high_art'], minutes: 60, drain: { hunger: 2, clean: 1.5, mood: 2, energy: 2.5 } },
  { id: 'guide', name: '泥浴温泉导游', icon: '♨️', minLevel: 16, requires: ['middle_history', 'middle_geography'], minutes: 60, drain: { hunger: 3, clean: 2.5, mood: 1.5, energy: 4 } },
  { id: 'labtech', name: '实验室助理', icon: '🧪', minLevel: 18, requires: ['high_chemistry', 'high_biology'], minutes: 60, drain: { hunger: 2, clean: 2, mood: 2, energy: 3 } },
  { id: 'reporter', name: '猪猪日报记者', icon: '🗞️', minLevel: 18, requires: ['high_chinese', 'high_politics'], minutes: 60, drain: { hunger: 2.5, clean: 2, mood: 2.5, energy: 3.5 } },
  { id: 'teacher', name: '幼儿园老师', icon: '🏫', minLevel: 21, requires: ['deg:college:edu'], minutes: 50, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 3 } },
  { id: 'banker', name: '存钱罐银行职员', icon: '🐷', minLevel: 21, requires: ['deg:college:fin'], minutes: 50, drain: { hunger: 1.8, clean: 1, mood: 2.8, energy: 2.5 } },
  { id: 'engineer', name: '猪舍建筑师', icon: '🏡', minLevel: 21, requires: ['deg:college:civil'], minutes: 60, drain: { hunger: 3, clean: 3, mood: 2.5, energy: 4 } },
  { id: 'designer', name: '设计师', icon: '🎨', minLevel: 21, requires: ['deg:college:arts'], minutes: 50, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 3 } },
  { id: 'coder', name: '程序员', icon: '💻', minLevel: 21, requires: ['deg:college:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'lawyer', name: '律师', icon: '⚖️', minLevel: 21, requires: ['deg:college:law'], minutes: 60, drain: { hunger: 2.2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'doctor', name: '医生', icon: '🩺', minLevel: 21, requires: ['deg:college:med'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 3, energy: 4 } },
  { id: 'architect', name: '系统架构师', icon: '🖥️', minLevel: 24, requires: ['deg:master:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 3, energy: 3.5 } },
  { id: 'fund', name: '存钱罐基金经理', icon: '📈', minLevel: 24, requires: ['deg:master:fin'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 3.5, energy: 3.5 } },
  { id: 'judge', name: '法官', icon: '👨‍⚖️', minLevel: 24, requires: ['deg:master:law'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 3, energy: 3.5 } },
  { id: 'bridgeeng', name: '桥梁总工程师', icon: '🌉', minLevel: 24, requires: ['deg:master:civil'], minutes: 60, drain: { hunger: 3, clean: 3, mood: 2.5, energy: 4 } },
  { id: 'principal', name: '小学校长', icon: '🏫', minLevel: 24, requires: ['deg:master:edu'], minutes: 50, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 3 } },
  { id: 'specialist', name: '专科主任医师', icon: '🩻', minLevel: 24, requires: ['deg:master:med'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 3, energy: 4 } },
  { id: 'orchestra', name: '交响乐团首席', icon: '🎻', minLevel: 24, requires: ['deg:master:arts'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 2.5, energy: 3.5 } },
  { id: 'artist', name: '著名艺术家', icon: '🌟', minLevel: 27, requires: ['deg:phd:arts'], minutes: 60, drain: { hunger: 2, clean: 2, mood: 2, energy: 3 } },
  { id: 'professor', name: '大学教授', icon: '🎓', minLevel: 27, requires: ['deg:phd:edu'], minutes: 50, drain: { hunger: 1.8, clean: 1, mood: 2, energy: 3 } },
  { id: 'surgeon', name: '医院院长', icon: '🏥', minLevel: 27, requires: ['deg:phd:med'], minutes: 60, drain: { hunger: 2.5, clean: 1.5, mood: 3, energy: 4.5 } },
  { id: 'justice', name: '首席大法官', icon: '🏛️', minLevel: 27, requires: ['deg:phd:law'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 3, energy: 3.5 } },
  { id: 'planner', name: '猪猪城总规划师', icon: '🗺️', minLevel: 27, requires: ['deg:phd:civil'], minutes: 60, drain: { hunger: 2.5, clean: 2, mood: 2.5, energy: 3.5 } },
  { id: 'governor', name: '存钱罐银行行长', icon: '🏦', minLevel: 27, requires: ['deg:phd:fin'], minutes: 60, drain: { hunger: 2, clean: 1, mood: 3.5, energy: 3.5 } },
  { id: 'scientist', name: '首席科学家', icon: '🚀', minLevel: 28, requires: ['deg:phd:cs'], minutes: 60, drain: { hunger: 2, clean: 1.2, mood: 2.5, energy: 4 } },
];
// Higher stages count as harder study per hour
const STAGE_DIFFICULTY = { primary: 1, middle: 1.2, high: 1.5, college: 2, master: 3, phd: 4 };

// Every course a list of requirements needs, following prerequisites and diplomas all the way down
function requiredCourses(tokens, set = new Set()) {
  for (const t of tokens) {
    let ids = [t.split('@')[0]];
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
  const hourly = 40 + 3 * job.minLevel + 6 * jobStudy(job).points + hardship;
  return Math.round((hourly * job.minutes) / 60);
}

// The more education a job needs, the more its pay is multiplied (by the highest stage it
// needs: none, primary … phd)
const STAGE_TIER = { primary: 1, middle: 2, high: 3, college: 4, master: 5, phd: 6 };
const TIER_PAY = [1, 1.3, 1.8, 2.4, 3.0, 3.6, 4.2];
const jobTier = (job) => Math.max(0, ...[...requiredCourses(job.requires)].map((id) => STAGE_TIER[COURSE_BY_ID[id].stage]));

// Career seniority (工龄): every shift at any job counts. Rank r needs 1.5·r·(r+1) shifts in all
// and pays ×1.04^r at every job, so a more educated job always still pays more.
const MAX_RANK = 20;
const RANK_PAY = 1.04;
const rankShifts = (r) => Math.round(1.5 * r * (r + 1));
// A good mood makes the pig work a little better, a bad one worse
const MOOD_PAY = { high: 70, highK: 1.05, low: 30, lowK: 0.9 };
// Pocket money: the first visit each day, while still a kid
const ALLOWANCE = { amount: 60, belowLevel: 15 };

for (const job of JOBS) {
  job.studyHours = Math.round(jobStudy(job).hours);
  job.tier = jobTier(job);
  job.pay = Math.round(jobPay(job) * TIER_PAY[job.tier]);
}
const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// Exp each level needs. Little ones: a day or so a level. From school age: the days that school
// year should last (LEVEL_DAYS) plus the exp of the lessons that open in it, on the way to a PhD.
const LESSON_EXP = (() => {
  const out = {};
  for (const id of requiredCourses(['deg:high', 'deg:phd:cs'])) {
    const c = COURSE_BY_ID[id];
    for (let k = 1; k <= c.lessons; k++) out[lessonLevel(c, k)] = (out[lessonLevel(c, k)] || 0) + c.minutes + EXP_PER_LESSON;
  }
  return out;
})();
const expNeed = (level) => (level < 6 ? 15 + 10 * level : Math.round(LEVEL_DAYS[level] * EXP_PER_DAY + (LESSON_EXP[level] || 0)));

// ---------- shop ----------

const SHOP_CATS = [
  { id: 'food', name: '食物', icon: '🍱', desc: '吃了增加饱食度' },
  { id: 'hygiene', name: '卫生用品', icon: '🧴', desc: '用了增加清洁度' },
  { id: 'toy', name: '玩具', icon: '🧸', desc: '买一次可以反复玩，玩完要歇一会儿' },
  { id: 'medicine', name: '药物', icon: '💊', desc: '生病时吃，恢复健康' },
  { id: 'wear', name: '装扮', icon: '🎀', desc: '买一次，可以随时戴上或摘下' },
  { id: 'seed', name: '种子', icon: '🌱', desc: '种在家门口的菜园里' },
  { id: 'fish', name: '鱼', icon: '🐟', desc: '在鸭鸭湖钓的' },
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
  { id: 'apple', cat: 'food', shops: ['farm', 'store', 'supermarket'], name: '苹果', icon: '🍎', price: 5, effects: { hunger: 8, mood: 1 } },
  { id: 'bread', cat: 'food', shops: ['bakery', 'store', 'supermarket'], name: '面包', icon: '🍞', price: 10, effects: { hunger: 15 } },
  { id: 'milk', cat: 'food', shops: ['farm', 'store', 'supermarket'], name: '牛奶', icon: '🥛', price: 9, effects: { hunger: 10, health: 2 } },
  { id: 'rice', cat: 'food', shops: ['supermarket', 'restaurant'], name: '米饭', icon: '🍚', price: 18, effects: { hunger: 25 } },
  { id: 'dumpling', cat: 'food', shops: ['restaurant', 'supermarket'], name: '饺子', icon: '🥟', price: 28, effects: { hunger: 35, mood: 3 } },
  { id: 'burger', cat: 'food', shops: ['restaurant'], name: '汉堡', icon: '🍔', price: 35, effects: { hunger: 45, mood: 5, health: -2 } },
  { id: 'pizza', cat: 'food', shops: ['restaurant'], name: '披萨', icon: '🍕', price: 50, effects: { hunger: 60, mood: 5 } },
  { id: 'cake', cat: 'food', shops: ['bakery'], name: '蛋糕', icon: '🍰', price: 60, effects: { hunger: 30, mood: 15 } },
  { id: 'croissant', cat: 'food', shops: ['bakery'], name: '牛角包', icon: '🥐', price: 14, effects: { hunger: 18, mood: 2 } },
  { id: 'donut', cat: 'food', shops: ['bakery'], name: '甜甜圈', icon: '🍩', price: 16, effects: { hunger: 12, mood: 6 } },
  { id: 'egg', cat: 'food', shops: ['farm', 'supermarket'], name: '鸡蛋', icon: '🥚', price: 8, effects: { hunger: 12, health: 1 } },
  { id: 'carrot', cat: 'food', shops: ['farm'], name: '胡萝卜', icon: '🥕', price: 6, effects: { hunger: 10, health: 1 } },
  { id: 'corn', cat: 'food', shops: ['farm'], name: '玉米', icon: '🌽', price: 9, effects: { hunger: 16 } },
  { id: 'strawberry', cat: 'food', shops: ['farm'], name: '草莓', icon: '🍓', price: 12, effects: { hunger: 6, mood: 6 } },
  { id: 'pumpkin', cat: 'food', shops: ['farm'], name: '南瓜', icon: '🎃', price: 24, effects: { hunger: 35, health: 2 } },
  { id: 'bamboo', cat: 'food', shops: ['farm'], name: '竹笋', icon: '🎋', price: 7, effects: { hunger: 9, health: 1 } },
  { id: 'feast', cat: 'food', shops: ['restaurant'], name: '满汉全席', icon: '🍲', price: 200, effects: { hunger: 100, mood: 20, health: 5 } },
  // the theme park's sweet stall
  { id: 'cottoncandy', cat: 'food', shops: ['funpark'], name: '棉花糖', icon: '🍭', price: 12, effects: { hunger: 4, mood: 10 } },
  { id: 'popcorn', cat: 'food', shops: ['funpark'], name: '爆米花', icon: '🍿', price: 15, effects: { hunger: 10, mood: 6 } },
  { id: 'hotdog', cat: 'food', shops: ['funpark'], name: '热狗', icon: '🌭', price: 20, effects: { hunger: 24, mood: 4 } },
  { id: 'icecream', cat: 'food', shops: ['funpark'], name: '冰淇淋', icon: '🍦', price: 18, effects: { hunger: 8, mood: 10 } },
  // festival treats, only ever given by neighbours (FESTIVALS)
  { id: 'tangyuan', cat: 'food', shops: [], name: '汤圆', icon: '🍡', price: 20, effects: { hunger: 18, mood: 8 } },
  { id: 'zongzi', cat: 'food', shops: [], name: '粽子', icon: '🍙', price: 22, effects: { hunger: 28, mood: 5 } },
  { id: 'mooncake', cat: 'food', shops: [], name: '月饼', icon: '🥮', price: 25, effects: { hunger: 20, mood: 8 } },
  { id: 'gingerbread', cat: 'food', shops: [], name: '姜饼人', icon: '🍪', price: 15, effects: { hunger: 12, mood: 8 } },
  // what comes up when fishing (FISH); price: what the barn pays
  { id: 'crucian', cat: 'fish', shops: [], name: '小鲫鱼', icon: '🐟', price: 8, effects: {} },
  { id: 'shrimp', cat: 'fish', shops: [], name: '小河虾', icon: '🦐', price: 10, effects: {} },
  { id: 'boot', cat: 'fish', shops: [], name: '旧靴子', icon: '👢', price: 1, effects: {} },
  { id: 'puffer', cat: 'fish', shops: [], name: '胖头鱼', icon: '🐡', price: 18, effects: {} },
  { id: 'crab', cat: 'fish', shops: [], name: '小螃蟹', icon: '🦀', price: 22, effects: {} },
  { id: 'tropical', cat: 'fish', shops: [], name: '彩虹鱼', icon: '🐠', price: 40, effects: {} },
  { id: 'octopus', cat: 'fish', shops: [], name: '小章鱼', icon: '🐙', price: 60, effects: {} },
  { id: 'koi', cat: 'fish', shops: [], name: '锦鲤', icon: '🎏', price: 150, effects: {} },

  { id: 'wipes', cat: 'hygiene', shops: ['store', 'supermarket'], name: '湿巾', icon: '🧻', price: 5, effects: { clean: 10 } },
  { id: 'soap', cat: 'hygiene', shops: ['bubble', 'store', 'supermarket'], name: '香皂', icon: '🧼', price: 15, effects: { clean: 25 } },
  { id: 'shampoo', cat: 'hygiene', shops: ['bubble', 'supermarket'], name: '洗发水', icon: '🧴', price: 30, effects: { clean: 40 } },
  { id: 'bodywash', cat: 'hygiene', shops: ['bubble'], name: '沐浴露', icon: '🚿', price: 60, effects: { clean: 70, mood: 5 } },
  { id: 'spa', cat: 'hygiene', shops: ['bubble'], name: '泡泡浴', icon: '🛁', price: 120, effects: { clean: 100, mood: 15 } },

  { id: 'ball', cat: 'toy', name: '皮球', icon: '⚽', price: 30, effects: { mood: 12 }, cooldown: 20 },
  { id: 'blocks', cat: 'toy', name: '积木', icon: '🧩', price: 60, effects: { mood: 18 }, cooldown: 30 },
  { id: 'kite', cat: 'toy', name: '风筝', icon: '🪁', price: 90, effects: { mood: 22 }, cooldown: 30 },
  { id: 'bear', cat: 'toy', name: '毛绒熊', icon: '🧸', price: 150, effects: { mood: 30 }, cooldown: 45 },
  { id: 'car', cat: 'toy', name: '遥控车', icon: '🏎️', price: 220, effects: { mood: 38 }, cooldown: 45 },
  { id: 'console', cat: 'toy', name: '游戏机', icon: '🎮', price: 400, effects: { mood: 50 }, cooldown: 60 },

  { id: 'vitamin', cat: 'medicine', shops: ['clinic', 'supermarket'], name: '维生素', icon: '🍬', price: 12, effects: { health: 10 } },
  { id: 'coldmed', cat: 'medicine', name: '感冒药', icon: '💊', price: 45, effects: { health: 30, mood: -3 } },
  { id: 'fevermed', cat: 'medicine', name: '退烧药', icon: '🌡️', price: 70, effects: { health: 45, mood: -3 } },
  { id: 'firstaid', cat: 'medicine', name: '急救包', icon: '🩹', price: 150, effects: { health: 80 } },

  // worn on the head or the face; bought once (see WEAR_SVG in pet.js for the drawings)
  { id: 'bow', cat: 'wear', slot: 'head', name: '粉色蝴蝶结', icon: '🎀', price: 80, effects: {} },
  { id: 'flower', cat: 'wear', slot: 'head', name: '小花发夹', icon: '🌸', price: 120, effects: {} },
  { id: 'shades', cat: 'wear', slot: 'face', name: '酷酷墨镜', icon: '🕶️', price: 200, effects: {} },
  { id: 'tophat', cat: 'wear', slot: 'head', name: '绅士礼帽', icon: '🎩', price: 350, effects: {} },
  { id: 'crown', cat: 'wear', slot: 'head', name: '小皇冠', icon: '👑', price: 600, effects: {} },

  // seeds for the vegetable patch at home: grow: real minutes until ripe, yield: how many come up
  { id: 'seed_carrot', cat: 'seed', shops: ['farm'], crop: 'carrot', name: '胡萝卜种子', icon: '🥕', price: 14, grow: 90, yield: 3, effects: {} },
  { id: 'seed_strawberry', cat: 'seed', shops: ['farm'], crop: 'strawberry', name: '草莓种子', icon: '🍓', price: 15, grow: 150, yield: 3, effects: {} },
  { id: 'seed_corn', cat: 'seed', shops: ['farm'], crop: 'corn', name: '玉米种子', icon: '🌽', price: 20, grow: 180, yield: 3, effects: {} },
  { id: 'seed_pumpkin', cat: 'seed', shops: ['farm'], crop: 'pumpkin', name: '南瓜种子', icon: '🎃', price: 30, grow: 360, yield: 2, effects: {} },

  // furniture for the pig's home, bought once. Only the best item of each group counts.
  // bonus multiplies: sleep (energy regained asleep), bath (free bath), study (exp from classes),
  // moodDrain (how fast mood drops), piano / paint (those hobbies; owning one unlocks the hobby)
  { id: 'bed1', cat: 'furniture', group: 'bed', name: '小木床', icon: '🛏️', price: 300, effects: {}, bonus: { sleep: 1.25 } },
  { id: 'bed2', cat: 'furniture', group: 'bed', name: '软软大床', icon: '🛏️', price: 1200, effects: {}, bonus: { sleep: 1.5 } },
  { id: 'bed3', cat: 'furniture', group: 'bed', name: '豪华大床', icon: '🛌', price: 5000, effects: {}, bonus: { sleep: 2 } },
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
  { id: 'house1', cat: 'furniture', group: 'house', tier: 1, name: '温馨公寓', icon: '🏠', price: 6000, effects: {}, bonus: { sleep: 1.1, moodDrain: 0.9 } },
  { id: 'house2', cat: 'furniture', group: 'house', tier: 2, name: '花园别墅', icon: '🏡', price: 40000, effects: {}, bonus: { sleep: 1.25, moodDrain: 0.8 } },
  { id: 'house3', cat: 'furniture', group: 'house', tier: 3, name: '猪猪城堡', icon: '🏰', price: 150000, effects: {}, bonus: { sleep: 1.4, moodDrain: 0.7 } },
  // late-game upgrades, for when there's more money than things to buy
  { id: 'bed4', cat: 'furniture', group: 'bed', name: '云朵床', icon: '🛏️', price: 12000, effects: {}, bonus: { sleep: 2.5 } },
  { id: 'tub3', cat: 'furniture', group: 'tub', name: '私人温泉', icon: '♨️', price: 15000, effects: {}, bonus: { bath: 3.5 } },
  { id: 'desk3', cat: 'furniture', group: 'desk', name: '书房', icon: '📚', price: 10000, effects: {}, bonus: { study: 1.4 } },
  { id: 'sofa3', cat: 'furniture', group: 'sofa', name: '懒人沙发', icon: '🛋️', price: 8000, effects: {}, bonus: { moodDrain: 0.6 } },
  // needsTier: only fits from that house up (2 = 花园别墅)
  { id: 'kitchen1', cat: 'furniture', group: 'kitchen', needsTier: 2, name: '小厨房', icon: '🍳', price: 3000, effects: {}, bonus: { food: 1.1 } },
  { id: 'kitchen2', cat: 'furniture', group: 'kitchen', needsTier: 2, name: '大厨房', icon: '🧑‍🍳', price: 10000, effects: {}, bonus: { food: 1.25 } },

  // decorations: only for looks, each takes one of the house's decoration spots
  { id: 'rug', cat: 'decor', name: '圆地毯', icon: '🧶', price: 1000, effects: {} },
  { id: 'plant', cat: 'decor', name: '大盆栽', icon: '🪴', price: 1500, effects: {} },
  { id: 'lamp', cat: 'decor', name: '小灯笼', icon: '🏮', price: 3000, effects: {} },
  { id: 'aquarium', cat: 'decor', name: '鱼缸', icon: '🐠', price: 8000, effects: {} },
  { id: 'trophy', cat: 'decor', name: '奖杯柜', icon: '🏆', price: 8000, effects: {} },
  { id: 'painting', cat: 'decor', name: '名画', icon: '🖼️', price: 12000, effects: {} },
  { id: 'globe', cat: 'decor', name: '地球仪', icon: '🌍', price: 15000, effects: {} },
  { id: 'stars', cat: 'decor', name: '星空天花板', icon: '🌌', price: 25000, effects: {} },

  // donations to the city: they appear on the map
  { id: 'fountain', cat: 'city', name: '喷泉', icon: '⛲', price: 20000, effects: {} },
  { id: 'bridge', cat: 'city', name: '彩虹桥', icon: '🌈', price: 50000, effects: {} },
  { id: 'ferris', cat: 'city', name: '摩天轮', icon: '🎡', price: 90000, effects: {} },
  { id: 'statue', cat: 'city', name: '金猪雕像', icon: '🐷', price: 250000, effects: {} },
  { id: 'park', cat: 'city', name: '猪猪乐园', icon: '🎢', price: 1000000, effects: {} },
  { id: 'rocket', cat: 'city', name: '猪猪火箭', icon: '🚀', price: 10000000, effects: {} },

  // hidden goods: a shop starts selling them once its keeper likes the pig enough (npc, hearts)
  { id: 'baguette', cat: 'food', npc: 'fox', hearts: 3, shops: ['bakery'], name: '法棍', icon: '🥖', price: 18, effects: { hunger: 32 } },
  { id: 'berrycake', cat: 'food', npc: 'fox', hearts: 6, shops: ['bakery'], name: '草莓蛋糕', icon: '🎂', price: 45, effects: { hunger: 35, mood: 18 } },
  { id: 'lavender', cat: 'hygiene', npc: 'raccoon', hearts: 3, shops: ['bubble'], name: '薰衣草皂', icon: '💜', price: 22, effects: { clean: 45, mood: 3 } },
  { id: 'bathsalt', cat: 'hygiene', npc: 'raccoon', hearts: 6, shops: ['bubble'], name: '牛奶浴盐', icon: '🧂', price: 70, effects: { clean: 90, mood: 12 } },
  { id: 'rope', cat: 'toy', npc: 'squirrel', hearts: 3, shops: ['toy'], name: '跳绳', icon: '🪢', price: 50, effects: { mood: 20 }, cooldown: 15 },
  { id: 'puzzle', cat: 'toy', npc: 'squirrel', hearts: 6, shops: ['toy'], name: '拼图', icon: '🧩', price: 140, effects: { mood: 34 }, cooldown: 25 },
  { id: 'bed_bear', cat: 'furniture', group: 'bed', npc: 'bear', hearts: 3, name: '熊师傅手作床', icon: '🛏️', price: 800, effects: {}, bonus: { sleep: 1.5 } },
  { id: 'sofa_bear', cat: 'furniture', group: 'sofa', npc: 'bear', hearts: 6, name: '熊熊沙发', icon: '🛋️', price: 1500, effects: {}, bonus: { moodDrain: 0.7 } },
  { id: 'lozenge', cat: 'medicine', npc: 'sheep', hearts: 3, name: '润喉糖', icon: '🍬', price: 14, effects: { health: 14, mood: 2 } },
  { id: 'tonic', cat: 'medicine', npc: 'sheep', hearts: 6, name: '营养补剂', icon: '🧃', price: 55, effects: { health: 50 } },
  { id: 'freshmilk', cat: 'food', npc: 'cow', hearts: 3, shops: ['farm'], name: '新鲜牛奶', icon: '🍼', price: 10, effects: { hunger: 14, health: 3 } },
  { id: 'seed_melon', cat: 'seed', npc: 'cow', hearts: 6, shops: ['farm'], crop: 'watermelon', name: '西瓜种子', icon: '🍉', price: 40, grow: 240, yield: 4, effects: {} },
  { id: 'watermelon', cat: 'food', shops: [], name: '西瓜', icon: '🍉', price: 30, effects: { hunger: 28, mood: 8 } },

  // sold only by a neighbour who loves the pig (npc: who, at NPC_MAX_HEARTS)
  { id: 'cap', cat: 'wear', slot: 'head', npc: 'dog', name: '工作帽', icon: '🧢', price: 250, effects: {} },
  { id: 'carrotcake', cat: 'food', npc: 'fox', name: '胡萝卜蛋糕', icon: '🧁', price: 80, effects: { hunger: 50, mood: 30, health: 3 } },
  { id: 'bubbler', cat: 'furniture', group: 'bubbler', npc: 'raccoon', name: '泡泡机', icon: '🫧', price: 2000, effects: {}, bonus: { bath: 1.2 } },
  { id: 'pinecone', cat: 'toy', npc: 'squirrel', name: '松果陀螺', icon: '🌰', price: 200, effects: { mood: 35 }, cooldown: 20 },
  { id: 'starclip', cat: 'wear', slot: 'head', npc: 'cat', name: '星星发卡', icon: '⭐', price: 300, effects: {} },
  { id: 'treehouse', cat: 'decor', npc: 'bear', name: '小树屋', icon: '🌳', price: 6000, effects: {} },
  { id: 'honey', cat: 'medicine', npc: 'sheep', name: '蜂蜜糖', icon: '🍯', price: 60, effects: { health: 60, mood: 15 } },
  { id: 'gradcap', cat: 'wear', slot: 'head', npc: 'owl', name: '博士帽', icon: '🎓', price: 500, effects: {} },
  { id: 'chesstable', cat: 'decor', npc: 'turtle', name: '棋盘桌', icon: '♟️', price: 4000, effects: {} },
  { id: 'pot', cat: 'furniture', group: 'pot', npc: 'duck', name: '大厨锅', icon: '🍲', price: 2500, effects: {}, bonus: { food: 1.1 } },

  // the café: drinks and something sweet
  { id: 'cocoa', cat: 'food', shops: ['cafe'], name: '热可可', icon: '☕', price: 18, effects: { hunger: 8, energy: 8, mood: 6 } },
  { id: 'lemonsoda', cat: 'food', shops: ['cafe'], name: '柠檬汽水', icon: '🍋', price: 12, effects: { hunger: 4, energy: 4, mood: 8 } },
  { id: 'pancake', cat: 'food', shops: ['cafe'], name: '松饼', icon: '🥞', price: 24, effects: { hunger: 26, mood: 6 } },
  { id: 'sundae', cat: 'food', shops: ['cafe'], name: '冰淇淋', icon: '🍨', price: 20, effects: { hunger: 10, mood: 14 } },
  // the bookshop: books are read again and again like toys (book: said as reading)
  { id: 'picturebook', cat: 'toy', book: true, shops: ['bookstore'], name: '图画书', icon: '📖', price: 40, effects: { mood: 18 }, cooldown: 20 },
  { id: 'storybook', cat: 'toy', book: true, shops: ['bookstore'], name: '故事书', icon: '📗', price: 90, effects: { mood: 26 }, cooldown: 30 },
  { id: 'comic', cat: 'toy', book: true, shops: ['bookstore'], name: '漫画书', icon: '📙', price: 150, effects: { mood: 30 }, cooldown: 30 },
  { id: 'encyclopedia', cat: 'toy', book: true, shops: ['bookstore'], name: '百科全书', icon: '📘', price: 400, effects: { mood: 36 }, cooldown: 45 },

  // given on reaching Lv.29 (prize: the level), never sold
  { id: 'goldhat', cat: 'wear', slot: 'head', prize: 29, shops: [], name: '金色礼帽', icon: '🎩', price: 0, effects: {} },

  // keepsakes: given (never sold) by a neighbour at NPC_MAX_HEARTS (gift: who); they have their
  // own places at home and take no decor slot
  { id: 'carrotpillow', cat: 'decor', gift: 'rabbit', shops: [], name: '胡萝卜抱枕', icon: '🥕', price: 0, effects: {} },
  { id: 'bonsai', cat: 'decor', gift: 'panda', shops: [], name: '竹子盆景', icon: '🎋', price: 0, effects: {} },
  { id: 'appletree', cat: 'decor', gift: 'hedgehog', shops: [], name: '苹果树盆栽', icon: '🍎', price: 0, effects: {} },
  { id: 'cowbell', cat: 'decor', gift: 'cow', shops: [], name: '小牛铃', icon: '🔔', price: 0, effects: {} },
];

// What a furniture bonus does, for its label: a multiplier v shows as +25% / −15%; v = 1 means it makes a hobby possible
const BONUS_NAME = { sleep: '睡觉回体力', bath: '洗澡效果', study: '上课经验', moodDrain: '心情下降', piano: '弹琴心情', paint: '画画心情', food: '吃饭饱食' };
const BONUS_UNLOCK = { piano: '能在家弹琴', paint: '能在家画画' };
const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Where things are sold, for items that don't list their own shops
const SHOP_FOR_CAT = { food: ['bakery'], hygiene: ['bubble'], toy: ['toy'], medicine: ['clinic'], wear: ['clothes'], furniture: ['furniture'], decor: ['furniture'], city: ['cityhall'], seed: ['farm'] };
const shopsOf = (it) => it.shops || SHOP_FOR_CAT[it.cat] || [];

// The beauty parlour's fur colours and the barber's hairstyles: paid each visit, nothing kept
// (price in coins; the first of each is the pig's own look, back to it for a little)
const LOOK_COLORS = [
  { id: 'pink', name: '粉粉原色', price: 20 }, { id: 'cream', name: '奶白', price: 40 }, { id: 'choco', name: '巧克力', price: 50 },
  { id: 'lilac', name: '香芋紫', price: 70 }, { id: 'mint', name: '薄荷绿', price: 70 }, { id: 'gold', name: '金闪闪', price: 150 },
];
const LOOK_HAIR = [
  { id: '', name: '不要发型', price: 10 }, { id: 'bangs', name: '齐刘海', price: 25 }, { id: 'curls', name: '小卷毛', price: 40 },
  { id: 'bun', name: '丸子头', price: 30 }, { id: 'mohawk', name: '莫西干', price: 50 },
];

// The bank: interest on savings, paid for each full day they sit there (also while the game is
// closed), with a cap so a huge balance doesn't snowball
// 跑腿: the supermarket's everyday food, soap and medicine brought to the pig anywhere. The goods
// cost what they do in the supermarket; each order adds a delivery fee (a share of it, at least a
// few coins). Everything else, and the friendlier prices, is only in the shops.
const DELIVERY = { shop: 'supermarket', cats: ['food', 'hygiene', 'medicine'], fee: 0.2, minFee: 5 };

const BANK_RATE = 0.02;
const BANK_DAILY_CAP = 2000;

// Businesses in Pig City to invest in: each share pays its income every day, also while the
// game is closed. Every share bought makes the next one of that business dearer, so the money
// grows fastest by putting earnings into the next, bigger business.
const BUSINESSES = [
  { id: 'lemonade', name: '柠檬水摊', icon: '🍋', minLevel: 8, price: 400, income: 30 },
  { id: 'snack', name: '小吃车', icon: '🌭', minLevel: 12, price: 3000, income: 200 },
  { id: 'bakeryshare', name: '面包房', icon: '🥐', minLevel: 15, price: 20000, income: 1200 },
  { id: 'marketshare', name: '超市', icon: '🛒', minLevel: 18, price: 120000, income: 6500 },
  { id: 'parkshare', name: '游乐场', icon: '🎠', minLevel: 22, price: 800000, income: 40000 },
  { id: 'airline', name: '猪猪航空', icon: '✈️', minLevel: 25, price: 5000000, income: 240000 },
];
const BUSINESS_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));
const BUSINESS_STEP = 1.15;
const DAY_MS = 24 * 3600 * 1000;

// The vegetable patch at home
const GARDEN_PLOTS = 6;

// ---------- neighbours in Pig City ----------
// Friendship is counted in points (s.npc[id].p); hearts are worked out from them. Heart n costs
// heartCost(n) = 40 + 20·n points: 60 for the first, 240 for the tenth, 500 in all to
// NPC_PERK_HEARTS and 1500 to NPC_MAX_HEARTS. A neighbour gives at most NPC_DAILY points a day
// (NPC_BIRTHDAY_DAILY on their birthday), so a friend greeted, chatted with and given a present
// every day reaches 5♥ in about two weeks and 10♥ in about five; only saying hello takes months.
// At NPC_PERK_HEARTS each one gives a perk; at the max their shop sells their special item.
const NPC_PERK_HEARTS = 5;
const NPC_MAX_HEARTS = 10;
const heartCost = (n) => 40 + 20 * n;
// points for: the first hello and the first chat of the day, a present (one a day: today's wish,
// a favourite, something liked, anything else, the one thing they don't like), doing something
// together (once a day), and a favourite on their birthday
const NPC_POINTS = { hello: 10, chat: 5, wish: 40, love: 30, like: 15, plain: 5, dislike: 0, together: 15, birthdayLove: 45 };
const NPC_DAILY = 40;
const NPC_BIRTHDAY_DAILY = 60;
const NPC_WISHES_PER_DAY = 3;
// A shop keeper's discount on their own goods, by hearts: [hearts, price multiplier]
const SHOP_DISCOUNTS = [[10, 0.85], [6, 0.9], [3, 0.95]];
// what neighbours wish for: cheap everyday things
const WISH_CATS = ['food', 'hygiene', 'medicine'];
const WISH_MAX_PRICE = 70;
// what can be given as a present: things to eat, toys, medicine, a fish
const GIFT_CATS = ['food', 'toy', 'medicine', 'fish'];
// Hearts needed to do something together: walk, then play a game or eat at the canteen
const TOGETHER_HEARTS = { walk: 2, play: 4, go: 4 };
// the canteen hours when eating together is offered: [from, to] in minutes after midnight
const MEAL_HOURS = [[11 * 60 + 30, 13 * 60 + 30], [17 * 60, 19 * 60]];

// icon: their emoji (a game piece when playing them); place: their shop (or 'neighbors'); home: where they live (see NPC_DAYS); loves / likes /
// dislike: items, for presents; birthday: 'month-day'; game: the mini game they play together;
// fav: the place they love to stop at on a walk
const NPCS = [
  { id: 'dog', icon: '🐶', name: '柴柴', species: 'dog', place: 'tower', home: 'apt', loves: ['burger', 'ball'], likes: ['milk', 'dumpling'], birthday: '8-26', game: 'penalty', fav: 'field', perk: { key: 'pay', v: 1.05, text: '打工工资 +5%' } },
  { id: 'fox', icon: '🦊', name: '狐狸阿姨', species: 'fox', place: 'bakery', home: 'bakery', loves: ['strawberry', 'egg'], likes: ['milk', 'apple'], dislike: 'bread', birthday: '3-12', game: 'rps', fav: 'plaza' },
  { id: 'raccoon', icon: '🦝', name: '浣浣', species: 'raccoon', place: 'bubble', home: 'apt', loves: ['strawberry', 'apple'], likes: ['donut'], birthday: '6-1', game: 'ttt', fav: 'lake' },
  { id: 'squirrel', icon: '🐿️', name: '栗栗', species: 'squirrel', place: 'toy', home: 'tree', loves: ['corn', 'kite'], likes: ['donut', 'apple'], birthday: '11-3', game: 'ttt', fav: 'meadow', perk: { key: 'toyRecover', v: 2, text: '玩具恢复速度 ×2' } },
  { id: 'cat', icon: '🐱', name: '咪咪', species: 'cat', place: 'clothes', home: 'apt', loves: ['milk', 'cake'], likes: ['croissant', 'crucian'], dislike: 'carrot', birthday: '2-22', game: 'rps', fav: 'plaza' },
  { id: 'bear', icon: '🐻', name: '熊师傅', species: 'bear', place: 'furniture', home: 'woodshop', loves: ['honey', 'watermelon'], likes: ['pumpkin', 'dumpling'], birthday: '1-20', game: 'penalty', fav: 'site' },
  { id: 'sheep', icon: '🐑', name: '绵绵医生', species: 'sheep', place: 'clinic', home: 'apt', loves: ['apple', 'corn'], likes: ['milk', 'pumpkin'], dislike: 'burger', birthday: '5-8', game: 'ttt', fav: 'lake', perk: { key: 'clinicCd', v: 0.5, text: '看病冷却 −50%' } },
  { id: 'owl', icon: '🦉', name: '咕咕校长', species: 'owl', place: 'primary', home: 'middle', loves: ['puzzle', 'croissant'], likes: ['egg', 'milk'], birthday: '9-1', game: 'chess', fav: 'museum', perk: { key: 'study', v: 1.05, text: '上课经验 +5%' } },
  { id: 'turtle', icon: '🐢', name: '龟爷爷', species: 'turtle', place: 'chess', home: 'shell', loves: ['strawberry', 'watermelon'], likes: ['pumpkin', 'apple'], birthday: '12-12', game: 'chess', fav: 'lake', perk: { key: 'playCap', v: 10, text: '每日游戏经验上限 +10' } },
  { id: 'duck', icon: '🦆', name: '嘎嘎大厨', species: 'duck', place: 'canteen', home: 'boat', loves: ['corn', 'pumpkin'], likes: ['carrot', 'rice'], dislike: 'egg', birthday: '7-15', game: 'rps', fav: 'lake', perk: { key: 'canteen', v: 10, text: '食堂饱食 +10' } },
];
// the farm market's keeper
NPCS.push({ id: 'cow', icon: '🐮', name: '牛大叔', species: 'cow', place: 'farm', home: 'ranch', loves: ['donut', 'watermelon'], likes: ['bread', 'croissant'], birthday: '6-28', game: 'rps', fav: 'garden' });

// the neighbours in the cottages next door (spot: which cottage); just friends, no perk
NPCS.push(
  { id: 'rabbit', icon: '🐰', name: '小兔', species: 'bunny', place: 'neighbors', spot: 0, home: 'cottage0', small: true, loves: ['carrot', 'carrotcake', 'strawberry'], likes: ['ball', 'donut', 'bear'], birthday: '4-5', game: 'rps', fav: 'toy' },
  { id: 'panda', icon: '🐼', name: '熊猫爷爷', species: 'panda', place: 'neighbors', spot: 1, home: 'cottage1', loves: ['bamboo', 'dumpling'], likes: ['apple', 'rice'], birthday: '9-9', game: 'banqi', fav: 'lake' },
  { id: 'hedgehog', icon: '🦔', name: '刺猬妹妹', species: 'hedgehog', place: 'neighbors', spot: 2, home: 'cottage2', loves: ['apple', 'strawberry'], likes: ['pumpkin', 'cake'], birthday: '10-18', game: 'ttt', fav: 'meadow' },
);
const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// ---------- their days ----------
// What each neighbour does, by the real clock: [from, where, doing], from midnight to midnight.
// where: a place, or a spot in town (apt, cafe, meadow, park, tree, boat, shell, ranch, cottage0-2;
// see NPC_SPOTS in city-data.js). A list of [where, doing] pairs instead picks one each day.
// Each start moves 0–15 minutes later on some days, so the town doesn't all move on the hour.
// The list used: d0 (Sunday) … d6 if there is one, else weekend (Saturday and Sunday), else week.
//   work: at their own shop (by the door); shop, eat: inside somewhere; home, sleep, nap: at home,
//   out of sight; porch: at home, at the door. Everything else is outdoors, in plain view.
const NPC_INSIDE = ['shop', 'eat', 'home', 'sleep', 'nap', 'cafe', 'movie'];
const NPC_ASLEEP = ['sleep', 'nap'];

const DOG_DAY = [['0:00', 'apt', 'sleep'], ['7:00', 'apt', 'home'], ['8:30', 'tower', 'work'], ['12:00', 'canteen', 'eat'], ['12:40', 'tower', 'work'],
  ['17:30', 'apt', 'home'], ['18:00', 'park', 'run'], ['18:50', 'field', 'rest'], ['19:15', 'apt', 'home'], ['22:30', 'apt', 'sleep']];
const FOX_DAY = [['0:00', 'bakery', 'sleep'], ['5:30', 'bakery', 'home'], ['6:30', 'bakery', 'work'], ['14:30', 'farm', 'shop'], ['15:00', 'bakery', 'work'],
  ['17:00', 'plaza', 'rest'], ['18:30', 'bakery', 'home'], ['21:30', 'bakery', 'sleep']];
const RACCOON_DAY = [['0:00', 'apt', 'sleep'], ['7:30', 'apt', 'home'], ['9:00', 'bubble', 'work'], ['12:30', 'cafe', 'rest'], ['13:10', 'bubble', 'work'],
  ['18:00', 'lake', 'wash'], ['19:30', 'apt', 'home'], ['23:00', 'apt', 'sleep']];
const SQUIRREL_DAY = [['0:00', 'tree', 'sleep'], ['8:30', 'tree', 'home'], ['10:00', 'toy', 'work'], ['13:00', 'meadow', 'pine'], ['13:40', 'toy', 'work'],
  ['18:30', 'plaza', 'play'], ['19:30', 'tree', 'home'], ['22:00', 'tree', 'sleep']];
const CAT_DAY = [['0:00', 'apt', 'sleep'], ['8:00', 'apt', 'home'], ['10:00', 'clothes', 'work'], ['12:30', 'cafe', 'cafe'], ['13:10', 'clothes', 'work'],
  ['19:00', 'plaza', 'fountain'], ['20:30', 'apt', 'home'], ['23:30', 'apt', 'sleep']];
// lunch at home in his woodshop behind the store, tinkering
const BEAR_DAY = [['0:00', 'woodshop', 'sleep'], ['6:30', 'woodshop', 'home'], ['8:00', 'furniture', 'work'], ['12:00', 'woodshop', 'home'], ['13:00', 'furniture', 'work'],
  ['17:00', 'woodshop', 'home'], ['17:30', 'canteen', 'eat'], ['18:30', 'woodshop', 'home'], ['22:00', 'woodshop', 'sleep']];
// Tuesdays and Thursdays he also looks after the building site
const BEAR_SITE_DAY = [...BEAR_DAY.slice(0, 5), ['14:00', 'site', 'site'], ['16:00', 'furniture', 'work'], ...BEAR_DAY.slice(5)];
const SHEEP_DAY = [['0:00', 'apt', 'sleep'], ['7:00', 'apt', 'home'], ['8:00', 'clinic', 'work'], ['18:00', 'apt', 'home'], ['18:30', 'lake', 'walk'],
  ['19:30', 'apt', 'home'], ['22:30', 'apt', 'sleep']];
const TURTLE_DAY = [['0:00', 'shell', 'sleep'], ['7:00', 'shell', 'home'], ['8:30', 'chess', 'work'], ['12:00', 'shell', 'home'], ['13:00', 'chess', 'work'], ['17:00', 'lake', 'walk'], ['17:40', 'shell', 'home'],
  ['21:00', 'shell', 'sleep']];
const RABBIT_DAY = [['0:00', 'cottage0', 'sleep'], ['7:30', 'cottage0', 'porch'], ['8:30', 'kinder', 'class'], ['11:30', 'cottage0', 'home'], ['13:00', 'cottage0', 'nap'],
  ['14:00', [['plaza', 'hop'], ['field', 'kite'], ['lake', 'ducks']]], ['16:00', 'toy', 'shop'], ['17:00', 'cottage0', 'porch'], ['18:30', 'plaza', 'play'],
  ['19:30', 'cottage0', 'porch'], ['20:00', 'cottage0', 'sleep']];
const RABBIT_FREE_DAY = [['0:00', 'cottage0', 'sleep'], ['8:00', 'cottage0', 'porch'], ['9:00', 'cottage0', 'hop'], ['11:30', 'cottage0', 'home'], ['13:00', 'cottage0', 'nap'],
  ['14:00', 'meadow', 'kite'], ['16:00', 'toy', 'shop'], ['17:00', 'cottage0', 'porch'], ['18:30', 'plaza', 'play'], ['19:30', 'cottage0', 'porch'], ['20:00', 'cottage0', 'sleep']];
// Wednesdays and Saturdays she goes round to the hedgehog's after the toy shop
const visitHedgehog = (day) => day.map((e) => (e[0] === '16:00' ? ['16:00', 'cottage2', 'visit'] : e));
const PANDA_DAY = [['0:00', 'cottage1', 'sleep'], ['6:00', 'cottage1', 'home'], ['6:30', 'plaza', 'taichi'], ['8:30', 'cottage1', 'porch'], ['11:00', 'farm', 'shop'],
  ['12:00', 'cottage1', 'nap'], ['14:00', 'chess', 'chess'], ['16:00', 'lake', 'walk'], ['17:00', 'cottage1', 'porch'], ['21:00', 'cottage1', 'sleep']];

const NPC_DAYS = {
  // Saturdays: football in the morning, a film after lunch
  dog: { week: DOG_DAY, d6: [['0:00', 'apt', 'sleep'], ['7:30', 'apt', 'home'], ['9:00', 'field', 'ball'], ['12:00', 'canteen', 'eat'], ['13:30', 'cinema', 'movie'], ['15:30', 'apt', 'home'], ...DOG_DAY.slice(6)] },
  fox: { week: FOX_DAY, d0: [...FOX_DAY.slice(0, 4), ['15:00', 'cottage0', 'visit'], ['15:40', 'bakery', 'work'], ...FOX_DAY.slice(5)] },
  raccoon: { week: RACCOON_DAY, d6: [...RACCOON_DAY.slice(0, 4), ['13:10', 'apt', 'home'], ...RACCOON_DAY.slice(5)] },
  squirrel: { week: SQUIRREL_DAY, d0: [['0:00', 'tree', 'sleep'], ['8:00', 'tree', 'home'], ['9:00', 'field', 'ball'], ['11:00', 'toy', 'work'], ...SQUIRREL_DAY.slice(3)] },
  cat: { week: CAT_DAY, d6: [...CAT_DAY.slice(0, 5), ['14:00', 'salon', 'shop'], ['15:30', 'clothes', 'work'], ...CAT_DAY.slice(5)] },
  bear: { week: BEAR_DAY, d2: BEAR_SITE_DAY, d4: BEAR_SITE_DAY, d6: [...BEAR_DAY.slice(0, 2), ['8:00', 'farm', 'shop'], ['9:30', 'furniture', 'work'], ...BEAR_DAY.slice(3)] },
  sheep: { week: SHEEP_DAY, d0: [...SHEEP_DAY.slice(0, 3), ['14:00', 'spring', 'soak'], ['15:30', 'clinic', 'work'], ...SHEEP_DAY.slice(3)] },
  // a night owl: stargazing every evening; at the weekend asleep all day, then the bookshop
  owl: {
    week: [['0:00', 'middle', 'sleep'], ['7:00', 'middle', 'home'], ['8:00', 'primary', 'work'], ['12:00', 'primary', 'patrol'], ['12:40', 'primary', 'work'],
      ['16:00', 'middle', 'home'], ['20:00', 'museum', 'stars'], ['23:00', 'middle', 'sleep']],
    weekend: [['0:00', 'middle', 'sleep'], ['17:00', 'bookstore', 'shop'], ['20:00', 'museum', 'stars'], ['23:30', 'middle', 'sleep']],
  },
  // the slowest walker in town; Sunday mornings he takes tea at the panda's
  turtle: { week: TURTLE_DAY, d0: [...TURTLE_DAY.slice(0, 2), ['8:40', 'cottage1', 'visit'], ['11:00', 'chess', 'work'], ...TURTLE_DAY.slice(3)] },
  duck: {
    week: [['0:00', 'boat', 'sleep'], ['7:00', 'boat', 'home'], ['10:00', 'canteen', 'work'], ['14:00', 'farm', 'shop'], ['14:40', 'lake', 'swim'],
      ['16:30', 'canteen', 'work'], ['19:00', 'lake', 'rest'], ['21:00', 'boat', 'home'], ['23:00', 'boat', 'sleep']],
  },
  cow: {
    week: [['0:00', 'ranch', 'sleep'], ['5:30', 'ranch', 'home'], ['6:00', 'farm', 'work'], ['15:00', 'ranch', 'ranch'], ['18:00', 'ranch', 'home'], ['21:00', 'ranch', 'sleep']],
    d0: [['0:00', 'ranch', 'sleep'], ['5:30', 'ranch', 'home'], ['6:00', 'ranch', 'ranch'], ['18:00', 'ranch', 'home'], ['21:00', 'ranch', 'sleep']],
  },
  rabbit: { week: RABBIT_DAY, d3: visitHedgehog(RABBIT_DAY), weekend: RABBIT_FREE_DAY, d6: visitHedgehog(RABBIT_FREE_DAY) },
  panda: { week: PANDA_DAY, weekend: PANDA_DAY.map((e) => (e[0] === '14:00' ? ['14:00', 'meadow', 'rest'] : e)) },
  hedgehog: {
    week: [['0:00', 'cottage2', 'sleep'], ['7:00', 'cottage2', 'home'], ['8:00', 'cottage2', 'flowers'], ['10:00', 'farm', 'shop'], ['11:00', 'cottage2', 'home'],
      ['13:00', [['garden', 'garden'], ['meadow', 'flowers'], ['lake', 'rest']]], ['15:00', 'bakery', 'shop'], ['16:00', 'cottage2', 'porch'], ['21:00', 'cottage2', 'sleep']],
  },
};

// ---------- what they say ----------
// hi: saying hello; bday: the first hello on their birthday; bye: the fourth chat of a day.
// at: about what they're doing, by doing@where or just doing. time: morn, noon, eve, night.
// pig: how the pig looks (dirty, hungry, sick, tired, sad, dressed: a new look).
// news: what happened since they last saw the pig (grew, grad, house, rank; gift and played: yesterday).
// tier: small talk at 0–3♥, 4–7♥ and from 8♥. ask: a question now and then; the answer is
// remembered and memo then has a line for each answer. gift: how they take a present (love
// can be one line, or one per item with _ for the rest). walk, play, eat: doing things together.
const NPC_TALK = {
  dog: {
    hi: ['汪！早呀，今天想干点啥？', '来啦！今天也加油💪', '嘿，小猪！', '汪汪，又见面啦'],
    bday: '汪！今天是我生日哦！',
    bye: '汪，说了好多，我得接着干活啦！',
    at: {
      work: ['告示板上刚贴了新活儿，要不要看看？', '今天来找活儿的人可多了，汪。', '别急，好活儿总会有的📋'],
      eat: ['食堂今天有红烧肉，汪！', '吃饱了下午才有劲儿。'],
      run: ['呼、呼……跑完这圈就歇！', '一起跑吗？跟上！'],
      ball: ['看我这脚，进啦！⚽', '传给我传给我！'],
      rest: ['跑完了，腿有点软，嘿嘿。', '球场的草软软的，躺着真舒服。'],
      movie: ['汪！电影马上开始，爆米花我买好了！', '上次那部我看哭了……别告诉别人，汪。'],
    },
    time: { morn: ['早上空气好，干活也精神！'], noon: ['饭点到了，肚子咕咕叫。'], eve: ['下班啦！跑步去！'], night: ['这么晚还在外面呀？早点回家哦。'] },
    pig: { hungry: '你肚子在叫哦，先吃饱再干活！', tired: '看你累的，今天别接活儿了，歇歇吧。', sick: '不舒服就别硬撑，活儿跑不了。' },
    news: { grew: '又长大啦？能接的活儿更多咯！', grad: '毕业啦？汪！简历上又能多写一行了！', house: '听说你搬新家了？打工没白干！', rank: '干得越来越熟练了嘛，老板都夸你。', gift: '昨天那个，我吃得一点不剩，汪！', played: '昨天那球你踢得真不赖。' },
    tier: [
      ['你好像还没找到喜欢的活儿？慢慢挑。', '我每天第一个到，最后一个走，汪。'],
      ['跟你说，洗碗那活儿别看累，老板人可好了。', '你要是忙不过来，跟我说一声。', '我以前也是从发传单干起的。'],
      ['其实我刚来猪猪城的时候，一个人都不认识。', '有时候我也会累，就是不想让别人看出来。', '能认识你真好，汪。'],
    ],
    ask: [{ k: 'job', q: '你喜欢动脑子的活儿，还是出力气的？', a: ['动脑子', '出力气'], r: ['那多上上课，好活儿都要学历！', '汪！跟我一样，干完浑身舒坦！'] }],
    memo: { job: ['写字楼那边有新岗位，适合你这种爱动脑的。', '工地在招人，你力气大，去试试？'] },
    gift: { wish: '汪！我正想要这个！你怎么知道的？', love: { ball: '皮球！走走走，踢一脚去！', _: '哇！给我的？汪汪汪！' }, like: '嘿嘿，谢啦，正好饿了。', plain: '谢谢呀，汪。' },
    walk: {
      go: '好啊，走！我带路！', end: '哎呀，我得走了，告示板还没贴完！', tired: '走了这么久，你脚酸不酸？下次再走！',
      fav: '到球场啦！等我踢一脚，就一脚！',
      near: { tower: '这就是我上班的地方，眼熟吧？', canteen: '闻到没？今天食堂有肉！', site: '工地的活儿最累，钱也最多。' },
      idle: ['你走路怎么一颠一颠的。', '天气这么好，适合跑两步！'],
    },
    play: { go: '点球？好！我当守门员，来吧！', win: '汪？！进了？再来一个我肯定扑住！', lose: '扑住啦！哈哈，你射得太正了。', draw: '平了！明天接着来！' },
    eat: { go: '走，吃饭去！', sit: '你吃你的，我吃我的，抢肉不算哦！' },
  },

  fox: {
    hi: ['乖孩子，来啦？', '哟，是你呀，吃了没？', '来，让阿姨看看，又瘦了没。', '乖孩子，早呀😊'],
    bday: '今天是阿姨的生日哦，你记得呀？',
    bye: '好啦好啦，阿姨不拉着你说话了，去玩吧。',
    at: {
      work: ['乖孩子，刚出炉的，还烫手呢，吃一个再走。', '面团要揉一百下才好吃，阿姨数着呢。', '今天的牛角包烤得特别酥。'],
      shop: ['这家的鸡蛋最新鲜，阿姨明天给你烤蛋挞。', '草莓要挑尖尖红透的，记住了没？'],
      rest: ['站了一天，脚都酸了。来，坐阿姨旁边歇会儿。', '看孩子们在喷泉边玩，阿姨就高兴。'],
      visit: ['给小兔送点心呢，她最爱吃小饼干了。'],
    },
    time: { morn: ['天还没亮阿姨就起来烤面包啦。'], noon: ['中午了，饭要按时吃，听见没？'], eve: ['晚饭吃什么呀？别又随便对付。'], night: ['这么晚了还不睡？明天还要长个子呢。'] },
    pig: { hungry: '你看你，肚子都在叫了。快，阿姨这有吃的。', tired: '眼圈都黑了，昨晚是不是又熬夜了？', sick: '哎哟，脸色怎么这么差？快去绵绵医生那儿看看。', dirty: '小花猫似的，回家洗洗脸再出来玩。' },
    news: { grew: '哎哟，又长高了！让阿姨比比……真的高了。', grad: '毕业啦？乖孩子，阿姨给你烤个大蛋糕！', house: '搬新家了？厨房大不大？阿姨教你烤饼干。', rank: '又去干活啦？别光顾着挣钱，饭要按时吃。', gift: '昨天你送的，阿姨舍不得吃，摆在柜台上看了一天。', played: '跟阿姨猜拳你可没少赢，下次让着点阿姨嘛。' },
    tier: [
      ['面包要趁热吃，凉了就硬啦。', '你一个人住，要好好照顾自己哦。'],
      ['阿姨跟你说，烤面包最要紧的是耐心。', '有空常来，阿姨这儿永远给你留一个。', '你那么瘦，阿姨看着心疼。'],
      ['阿姨小时候，跟妈妈在乡下烤面包，柴火炉子的。', '看你一天天长大，阿姨心里比吃了蜜还甜。', '乖孩子，在外面受了委屈，就回来找阿姨。'],
    ],
    ask: [{ k: 'taste', q: '乖孩子，你爱吃甜的还是咸的？', a: ['甜的！', '咸的'], r: ['就知道！阿姨明天多放一勺糖。', '咸的好，阿姨给你烤个火腿面包。'] }],
    memo: { taste: ['今天的草莓挞特别甜，给你留了一块。', '今天的火腿面包刚出炉，咸咸香香的。'] },
    gift: {
      wish: '哎呀，阿姨正缺这个，你真是贴心的乖孩子。',
      love: { strawberry: '这草莓真红！正好做蛋糕，做好了第一块给你。', egg: '鸡蛋！明天的蛋挞有着落啦。', _: '这个好！做好了点心第一块给你。' },
      like: '谢谢乖孩子，阿姨收下啦。', plain: '你这孩子，还给阿姨带东西。', dislike: '哎呀，这不是阿姨烤的嘛，你自己吃，自己吃。',
    },
    walk: {
      go: '好呀，阿姨正好想走走。', end: '哎呀，阿姨得走了，还有事呢。', tired: '走累了吧？回家喝口水，歇一歇。',
      fav: '广场到了，坐一会儿吧，阿姨脚酸了。',
      near: { bakery: '这就是阿姨的面包房，香不香？', farm: '阿姨每天都来这儿买鸡蛋。', neighbors: '小兔就住这儿，那孩子可乖了。' },
      idle: ['慢点走，别摔着。', '你这孩子，走路还蹦蹦跳跳的。'],
    },
    play: { go: '猜拳呀？阿姨可厉害了，来！', win: '哎呀，又输给你了，阿姨不服气！', lose: '阿姨赢啦！奖励你一个小饼干。', draw: '一样的？咱俩想到一块去啦。' },
    eat: { go: '走，阿姨陪你吃饭，看着你吃饱。', sit: '多吃点，乖孩子，不够阿姨再给你盛。' },
  },

  raccoon: {
    hi: ['洗手了没？……好吧，过来。', '别动！你身上有根草。好了。', '今天的泡泡特别香🫧', '啊，是你呀。'],
    bday: '今天我生日。我穿了最干净的一件衣服。',
    bye: '说了这么多话，口都干了，我去洗个杯子。',
    at: {
      work: ['别把泥带进来！门口有垫子。', '这块香皂我搓了一早上，香吧？', '泡泡要吹得圆圆的才好看。'],
      rest: ['咖啡馆里人太多了，我在外面坐坐就好。', '这张桌子我擦过了，你可以坐。'],
      wash: ['我在洗东西，别靠太近，水会溅到你。', '湖水凉凉的，洗什么都干净。'],
    },
    time: { morn: ['早上的第一件事：洗手。第二件：再洗一次。'], noon: ['吃饭前要洗手，你洗了吗？'], eve: ['一天下来，衣服都脏了，回家要好好洗。'], night: ['这么晚了……你今天洗澡了没有？'] },
    pig: { dirty: '天哪！你这是在泥里打滚了吗？快来，我给你洗！', hungry: '肚子饿也要先洗手再吃。', sick: '生病了更要干干净净的，细菌最喜欢脏小猪了。' },
    news: { grew: '长大了，更要学会自己洗澡哦。', grad: '毕业了？毕业照拍了没？衣服干净吗？', house: '新家记得天天打扫，灰尘一下就积起来了。', rank: '打工回来要先洗澡，再干别的。', gift: '昨天你送的，我洗了三遍才吃，很甜。', played: '昨天那盘棋，你赢得很干净。' },
    tier: [
      ['你的耳朵后面……算了，下次再说。', '香皂要放在通风的地方，不然会化掉。'],
      ['其实我也不是嫌人多，就是……怕弄脏。', '你身上的味道比以前好闻多了。', '你下次来，我给你留一块新皂。'],
      ['我小时候有一只布偶，洗了好多年，都洗薄了。', '跟你在一起的时候，我不太想着洗手了。……一点点。', '你是第一个我不嫌脏的朋友。'],
    ],
    ask: [{ k: 'smell', q: '你喜欢哪种味道？薰衣草还是柠檬？', a: ['薰衣草', '柠檬'], r: ['嗯，薰衣草闻着就想睡觉。', '柠檬好，清清爽爽的。'] }],
    memo: { smell: ['今天新做的薰衣草泡泡，你闻闻。', '今天的泡泡加了柠檬，酸酸的。'] },
    gift: { wish: '这个！我正想要……你洗过手了吧？', love: '好香！我要把它洗干净，慢慢吃。', like: '谢谢，我会好好洗一洗的。', plain: '嗯，谢谢。我先拿去洗洗。' },
    walk: {
      go: '一起走？好吧，你走路别踩水坑。', end: '我得走了，还有东西没洗完。', tired: '鞋底都脏了，今天就走到这吧。',
      fav: '湖边到了。水真清，我能在这儿待一下午。',
      near: { bubble: '这是我的店，门口的地垫我每天刷两遍。', lake: '鸭鸭湖的水是全城最干净的。', field: '球场……草屑会粘在身上的。' },
      idle: ['小心，前面有个水坑。', '你的鞋带松了，系好再走。'],
    },
    play: { go: '井字棋？好。我先擦一下桌子。', win: '……你赢了。我承认，下得很漂亮。', lose: '三个连成一线，整整齐齐，我喜欢。', draw: '平局，干干净净，谁也不欠谁。' },
    eat: { go: '去食堂？……好吧，我自己带了筷子。', sit: '你吃，我先把桌子擦一下。' },
  },

  squirrel: {
    hi: ['吱吱！你来啦！', '来玩来玩🎈', '嘿嘿，今天有新玩具哦！', '吱？是你呀！'],
    bday: '吱吱吱！今天是我生日！',
    bye: '吱，我嘴巴都说累了，我去啃个松果。',
    at: {
      work: ['新到的小火车，会冒烟的哦！', '这个陀螺我自己试过，转得可久了。', '玩具要轮着玩，才不会玩腻，吱。'],
      pine: ['嘘，我在找松果，这棵树下最多。', '你看，这颗最大，我要藏起来。🌰'],
      play: ['小兔跳得可高了，比我还高！', '我们在玩捉迷藏，你别说我在这儿哦。'],
      ball: ['吱！我个子小，但是跑得快！', '球比我还大，嘿嘿。'],
    },
    time: { morn: ['早上……吱……我还没醒呢。'], noon: ['中午啦，我带了玉米，分你一半？'], eve: ['天快黑了，我要回树上了。'], night: ['晚上的松鼠……也是会出来的，嘿嘿。'] },
    pig: { tired: '你看起来好累，抱抱玩具熊就好了。', sad: '不开心呀？来，这个给你玩一下。' },
    news: { grew: '你长大了！还玩玩具吗？……还玩的吧？', grad: '毕业了还可以玩玩具的，我保证！', house: '新家大吗？能放好多玩具吗？', rank: '光干活不玩会变笨的，吱。', gift: '昨天那个，我藏在树洞里了，舍不得吃。', played: '昨天那盘井字棋，我回去想了一晚上。' },
    tier: [
      ['我们店的玩具都是我亲手挑的！', '你最喜欢什么玩具呀？'],
      ['跟你说个秘密，我在公园的树洞里藏了一百颗松果。', '小兔可喜欢来我店里看玩具了。', '你来了，我今天就不无聊啦。'],
      ['其实我老是忘记松果藏在哪儿，嘿嘿。', '有你这个朋友，比捡到最大的松果还开心。', '我小时候只有一个玩具，就是一颗松果。'],
    ],
    ask: [{ k: 'toy', q: '你喜欢会动的玩具，还是会拼的？', a: ['会动的', '会拼的'], r: ['吱！我也是！遥控车冲冲冲！', '拼好了特别有成就感，对吧？'] }],
    memo: { toy: ['新到一辆遥控车，跑得飞快，你肯定喜欢。', '我新拿了一盒积木，可以拼一座城堡。'] },
    gift: { wish: '吱吱！就是这个！你是不是会读心术？', love: { corn: '玉米！我要一粒一粒地啃！', kite: '风筝！明天我们去球场放！', _: '吱——！这个我最喜欢了！' }, like: '嘿嘿，谢谢，我藏起来慢慢吃。', plain: '谢谢你呀，吱。' },
    walk: {
      go: '好呀好呀，我们去哪？', end: '吱！我得走了，差点忘了正事！', tired: '我腿短，走不动啦，下次再玩！',
      fav: '这片草地最好玩了，我能在这儿打滚。',
      near: { toy: '我的店！橱窗里那只熊是我摆的。', field: '球场！我们比赛跑步吧！', lake: '湖边的树上，松果最多。' },
      idle: ['你看那棵树，上面肯定有松果。', '我们比赛谁先跑到那边！'],
    },
    play: { go: '井字棋！我要画圈圈！', win: '吱！你怎么连起来的？再来！', lose: '赢啦赢啦！吱吱吱！', draw: '平局！我们都好厉害！' },
    eat: { go: '一起吃饭？我要坐靠窗的位置！', sit: '我吃得快，吃完我等你哦。' },
  },

  cat: {
    hi: ['哦，你来了。', '还行吧😼', '喵。……别站那儿，挡光了。', '又穿这件？算了。'],
    bday: '今天我生日。……你不说点什么吗？',
    bye: '好了，我还要整理衣架，没空陪你聊了。',
    at: {
      work: ['你又穿这件？……算了，过来，我帮你看看。', '这条裙子的颜色，全城只有我配得上。……开玩笑的。', '别乱摸，衣服会皱。'],
      cafe: ['靠窗这张桌子是我的，别坐。……算了，你坐吧。', '这里的奶泡还行，就是不够多。'],
      fountain: ['晚上的灯好看。……不是在等你，我本来就坐这。', '喷泉的声音挺好听的，你也听听。'],
      shop: ['我在做头发，别看。……好看吗？'],
    },
    time: { morn: ['早上好。头发翘了，别看我。'], noon: ['中午太阳太晒，我要躲阴凉。'], eve: ['傍晚的光最衬毛色了。'], night: ['这么晚出来，你也睡不着？'] },
    pig: { dressed: '哼，还行吧。领子歪了，我帮你弄一下。', dirty: '你……身上那是泥吗？离我的新衣服远一点。', sad: '别哭丧着脸，换件衣服心情就好了。' },
    news: { grew: '长大了，衣服都小了吧？来我店里挑新的。', grad: '毕业照要穿好看点，别给我丢人。', house: '新家的窗帘，选什么颜色了？我帮你参谋参谋。', rank: '天天干活，也要打扮一下自己。', gift: '你昨天送的……还行。我吃完了。', played: '昨天是我让着你的，你别得意。' },
    tier: [
      ['衣服要会搭，不是越贵越好。', '你的毛色适合浅一点的颜色。'],
      ['你今天这身……还挺顺眼的。', '我每天换三套衣服，你不觉得累吗？我也觉得累。', '下次进新货，我先给你留一件。'],
      ['其实我很怕别人说我土，所以才拼命打扮。', '跟你待着，不用想穿什么。挺好的。', '……谢谢你一直来看我。就说一次。'],
    ],
    ask: [{ k: 'color', q: '粉色和蓝色，你选哪个？快说。', a: ['粉色', '蓝色'], r: ['哼，果然。跟你的毛挺配。', '蓝色？……有眼光。'] }],
    memo: { color: ['新到一条粉色围巾，我觉得适合你。', '店里新进了一顶蓝帽子，跟你很配。'] },
    gift: { wish: '……你怎么知道我想要这个？谁告诉你的？', love: { milk: '……谢谢。不是因为我是猫才喜欢的。😼', _: '……谢谢。我收下了，别看着我吃。' }, like: '还行，我收下了。', plain: '嗯。放那吧。', dislike: '这是给兔子吃的吧。' },
    walk: {
      go: '一起走？……行吧，走慢点，我穿着新鞋。', end: '我得走了，衣服还没熨。', tired: '我的鞋不适合走远路，到这儿吧。',
      fav: '喷泉边，我最喜欢的位置。别告诉别人。',
      near: { clothes: '我的店。橱窗是我自己布置的，好看吧？', salon: '理发店的剪刀手艺还行。', artpalace: '艺术宫的画，有几幅配色还不错。' },
      idle: ['走路别驼背，抬头。', '你看那只鸟，羽毛颜色搭得真好。'],
    },
    play: { go: '石头剪刀布？我可从来不输。', win: '……这把不算，我刚才眨眼了。', lose: '看吧，我就说我不会输。😼', draw: '哼，学我出一样的。' },
    eat: { go: '食堂？……好吧，我挑个干净的位置。', sit: '你嘴角有饭粒。……别动，我帮你。' },
  },

  bear: {
    hi: ['嘿，小家伙。', '结实着呢🪵', '嗯，来啦。', '慢慢挑，不急。'],
    bday: '嘿嘿，今天……是我生日。',
    bye: '好了，我得去刨木头了。',
    at: {
      work: ['这张椅子，坐上一百年都不会坏。', '木头要选老的，结实。', '慢慢挑，挑中了我给你送到家。'],
      site: ['工地上的木头，都是我亲手挑的。', '小心头顶，别靠太近。'],
      eat: ['干了一天活，饿得能吃下一整锅饭。'],
      shop: ['我来买蜂蜜。……别告诉别人我买了五罐。🍯'],
    },
    time: { morn: ['早上的木头最香。'], noon: ['嗯……中午了，该吃点蜂蜜了。'], eve: ['收工了。'], night: ['这么晚……我都快睡着了。'] },
    pig: { tired: '累了就坐，我这儿的椅子随便坐。', sick: '不舒服，就回家躺着，床要软一点的好。' },
    news: { grew: '长大了。床该换个大的了。', grad: '毕业了，好。读书跟做木工一样，要下功夫。', house: '新家？……家具够不够？缺什么跟我说。', rank: '手上起茧了吧？干活的手，好手。', gift: '昨天那个，好吃。', played: '昨天那球，我没扑住。你劲儿大。' },
    tier: [
      ['好木头不怕时间。', '你家的床，睡着舒服吗？'],
      ['我做一张椅子要七天。不着急的东西，才结实。', '你来了，我就不刨木头了，歇会儿。', '我小时候住在山里，天天闻木头香。'],
      ['我一直想做一座树屋。小时候就想。', '有你这样的朋友，比好木头还难得。', '嘿嘿，我不太会说话。你懂就行。'],
    ],
    ask: [{ k: 'wood', q: '你喜欢深色的木头，还是浅色的？', a: ['深色', '浅色'], r: ['嗯，深色稳重，耐看。', '浅色好，屋里亮堂。'] }],
    memo: { wood: ['我新进了一块深色胡桃木，你摸摸，滑不滑。', '刚刨好一块白松木，颜色浅浅的，你看。'] },
    gift: { wish: '嗯？正是我想要的。谢了，小家伙。', love: { honey: '蜂蜜糖！……嘿嘿嘿。', watermelon: '大西瓜！嘿嘿，抱回去慢慢吃。', _: '嘿嘿……这个，我喜欢。' }, like: '好，好。谢谢。', plain: '嗯，谢谢你。' },
    walk: {
      go: '走走？好，我走慢点，你跟得上。', end: '我得走了，胶水快干了。', tired: '走得差不多了，回吧。',
      fav: '工地到了。看，那根梁是我架的。',
      near: { furniture: '这是我的店。门口那张沙发，我做了一个月。', farm: '牛大叔的蜂蜜，最甜。' },
      idle: ['这条路的树，长得真直。', '嗯，天气好，木头不容易受潮。'],
    },
    play: { go: '点球？我守门。……别怕，我不扑你。', win: '进了。嘿嘿，好脚法。', lose: '扑住了。下次往角上踢。', draw: '平了，挺好。' },
    eat: { go: '吃饭好，我饿了。', sit: '你吃，我这碗……嘿嘿，我再去添点。' },
  },

  sheep: {
    hi: ['咩~今天身体好吗？', '多喝水哦💧', '来，让我看看你的舌头。……开玩笑的。', '咩，是小猪呀。'],
    bday: '咩~今天是我的生日，你是第一个来的。',
    bye: '好啦，我还有病人要看，你要早点睡哦。',
    at: {
      work: ['今天的病人不多，大家都很健康，咩。', '打针不疼的，就像被蚊子叮一下。', '药要按时吃，不能嫌苦偷偷倒掉哦。'],
      walk: ['饭后走一走，消化好。', '湖边的空气最养人了，咩~'],
      soak: ['泡一泡，骨头都软了……咩~'],
    },
    time: { morn: ['早睡早起，身体才好。'], noon: ['午饭要吃蔬菜哦。'], eve: ['傍晚散散步，晚上睡得香。'], night: ['这么晚还不睡？熬夜对身体不好。'] },
    pig: { sick: '咩！你在发烧吗？快来诊所，我给你看看。', tired: '你太累了，今晚一定要早点睡。', dirty: '脏脏的会生病哦，回家好好洗个澡。', hungry: '饿肚子对胃不好，快吃点东西吧。' },
    news: { grew: '又长高了！正是长身体的时候，要多喝牛奶。', grad: '毕业啦，恭喜！考试那几天没熬夜吧？', house: '新家要常开窗通风，咩。', rank: '工作别太拼，身体最要紧。', gift: '昨天你送的，我当了下午的点心，咩~', played: '昨天下棋，你动脑子的样子很认真。' },
    tier: [
      ['不舒服就来找我，别不好意思。', '洗手要搓二十秒，记住了吗？'],
      ['当医生最开心的，就是大家都不用来找我。', '你最近气色好多了，咩。', '我中午都在诊室吃饭，万一有人突然不舒服呢。'],
      ['跟你说个秘密……我当医生之前，最怕打针了。', '有时候我也会累，但看到你健健康康的，就不累了。', '咩~有你这个朋友，我觉得自己也变健康了。'],
    ],
    ask: [{ k: 'sleep', q: '你晚上几点睡呀？说实话哦。', a: ['很早！', '有点晚……'], r: ['咩~真乖，继续保持。', '咩……慢慢来，每天提早十分钟。'] }],
    memo: { sleep: ['你说你睡得早，我看你气色就知道是真的。', '昨晚有没有提早十分钟睡？咩？'] },
    gift: { wish: '咩！正好需要这个，谢谢你。', love: '咩~这个最健康了，我最喜欢！', like: '谢谢，很有营养哦。', plain: '谢谢你，咩。', dislike: '这个……少吃一点哦。' },
    walk: {
      go: '好呀，走一走对身体好。', end: '咩，我得走了，说不定有人在等我。', tired: '走了这么多，回去喝点水，别累着。',
      fav: '湖边，深呼吸……是不是很舒服？',
      near: { clinic: '诊所的灯一直亮着，有事随时来。', spring: '泡温泉对关节好，咩。' },
      idle: ['走路要抬头挺胸，对脊椎好。', '咩~天气真好。'],
    },
    play: { go: '井字棋呀？好，动动脑子对身体好。', win: '咩~你赢了，脑子转得真快。', lose: '咩，我赢了，你别着急。', draw: '平局，咩，谁都没输。' },
    eat: { go: '一起吃饭？好，我看看你挑食不挑食。', sit: '青菜也要吃哦，咩。' },
  },

  owl: {
    hi: ['咕咕，小猪同学好。', '好好学习📚', '嗯，今天学了什么新东西？', '咕咕~'],
    bday: '咕咕，今天是我的生日，正好是开学第一天。',
    bye: '今天就聊到这里，回去温习温习。',
    at: {
      'shop@bookstore': ['咕咕，这本书我找了好久。', '书店是我周末最喜欢的地方，比白天睡觉还喜欢。'],
      work: ['上课铃要响了，同学们快进教室。', '知识就像牛角包，一层一层的。', '咕咕，今天的课讲的是星星。'],
      patrol: ['我在巡视校园，看看有没有同学在走廊上跑。', '花坛里的花，是三年级同学种的。'],
      stars: ['嘘……今晚能看到土星的环。', '星星离我们很远，但光一直在路上。'],
    },
    time: { morn: ['咕……早上我总是有点困。'], noon: ['午休时间，看书不要太久。'], eve: ['傍晚了，我的精神才刚开始好起来。'], night: ['夜晚是思考的好时候，咕咕。'] },
    pig: { tired: '学习累了要休息，书不会跑的。', sick: '生病了就在家休息，功课可以以后补。' },
    news: { grew: '你又长大了，咕咕，该学更难的东西了。', grad: '恭喜毕业！但学习是不会毕业的。', house: '新家要有一张书桌，咕咕。', rank: '工作也是一种学习，做得很好。', gift: '昨天你送的，我一边吃一边看完了一本书。', played: '昨天那盘棋，你的开局很有想法。' },
    tier: [
      ['读书要有耐心，一天一页也很好。', '有不懂的地方，随时来问我。'],
      ['我年轻的时候，在图书馆住了三年。', '你提的问题越来越有意思了。', '咕咕，你是个肯动脑筋的孩子。'],
      ['其实我也有很多不懂的事，所以才一直看书。', '教了那么多学生，你是让我最放心的一个。', '晚上看星星的时候，我常想，你以后会成为什么样的猪。'],
    ],
    ask: [{ k: 'subj', q: '你最喜欢哪门课？', a: ['数学', '语文'], r: ['咕咕，数学是思维的体操。', '语文好，会说话的人走到哪都不怕。'] }],
    memo: { subj: ['我想到一道有趣的数学题，你要不要试试？', '我最近在读一本诗集，有几句写得真好。'] },
    gift: { wish: '咕咕！正是我需要的，你很细心。', love: '咕咕咕！这个我非常喜欢。', like: '谢谢你，小猪同学。', plain: '嗯，谢谢，有心了。' },
    walk: {
      go: '散步是思考的好办法，走吧。', end: '咕咕，我得走了，还有作业要批。', tired: '走了不少路，今天的运动够了。',
      fav: '科技馆。里面的星空，我看了上百遍。',
      near: { primary: '这是我们的小学，你也在这里读过书吧？', college: '大学的图书馆，是我年轻时的家。', middle: '钟楼上那间小屋，就是我家。' },
      idle: ['你知道吗？猫头鹰的脖子能转很大一圈。', '咕咕，你看天上那朵云，像不像一本书？'],
    },
    play: { go: '国际象棋？好，我们来一盘。', win: '咕咕，下得好！我要回去研究一下。', lose: '这一步叫将杀，下次你就会了。', draw: '和棋，咕咕，势均力敌。' },
    eat: { go: '好，吃饭也要细嚼慢咽。', sit: '吃饭的时候不要看书，我也不看。' },
  },

  turtle: {
    hi: ['来一盘？♟️', '嘿嘿……来啦。', '慢慢来……不急。', '……哦，是你呀。'],
    bday: '今天……是爷爷的生日……嘿嘿，又老了一岁。',
    bye: '说了这么多……爷爷要歇歇了……',
    at: {
      work: ['来一盘？……不急，你先想好坐哪边。', '这步棋……我想了一上午。', '下棋跟走路一样……一步一步。'],
      walk: ['别等我……你先走……我总会到的，嘿嘿。', '这条路……我走了五十年了。'],
      visit: ['老熊猫的茶……泡得太淡……嘘。'],
    },
    time: { morn: ['早上……太阳慢慢出来……跟我一样。'], noon: ['中午了……该打个盹了。'], eve: ['天黑得真快……我还没走到家呢。'], night: ['这么晚了……小朋友该睡觉了。'] },
    pig: { tired: '累了就坐下……爷爷这儿有石凳。', sick: '生病了……要慢慢养，急不来。' },
    news: { grew: '长大啦……下棋也一样，一步一步，急不来。', grad: '毕业了……好，好……书读得比爷爷多了。', house: '搬家了？……爷爷一辈子就住一个壳，嘿嘿。', rank: '干活……也是一步一步的。', gift: '昨天那个……嗯……甜。', played: '昨天那盘……你那步马……走得妙。' },
    tier: [
      ['下棋要想三步……不，想一步就够了。', '……你走得太快了，坐下歇歇。'],
      ['这老熊猫……下了几十年，就没赢过我几回……嘘，别告诉他。', '慢……不是坏事。', '爷爷年轻的时候……也是跑着走路的。'],
      ['我跟老熊猫……平局了一千多盘……嘿嘿。', '活得久了……就知道，朋友最要紧。', '你来陪我下棋……爷爷高兴。'],
    ],
    ask: [{ k: 'side', q: '执白……还是执黑？', a: ['执白', '执黑'], r: ['嗯……先走的，胆子大。', '嘿嘿……后发制人。'] }],
    memo: { side: ['今天……还是你执白？', '今天……你还执黑吧？嘿嘿。'] },
    gift: { wish: '哦……这个……爷爷正想着呢。', love: '嗯……这个甜。我能吃一下午。', like: '好……好……谢谢小朋友。', plain: '嗯……放这儿吧……谢谢。' },
    walk: {
      go: '一起走？……你可要走慢点。', end: '哎……爷爷得走了……', tired: '走不动啦……爷爷歇会儿……你先回吧。',
      fav: '湖边……我在这儿……住了一辈子。',
      near: { chess: '棋亭……我的老地方。', stage: '舞台上……年轻人唱得真热闹。' },
      idle: ['……慢点……慢点……', '嘿嘿……你又跑到前面去了。'],
    },
    play: { go: '来一盘……爷爷让你先走。', win: '嘿嘿……好棋。爷爷让你的，下次可不让了。', lose: '将军……嘿嘿……下次再来。', draw: '和了……跟老熊猫一样……嘿嘿。' },
    eat: { go: '吃饭？……好，爷爷走得慢，你等等我。', sit: '慢慢嚼……别噎着。' },
  },

  duck: {
    hi: ['嘎！开饭啦🍚', '嘎嘎！来啦来啦！', '吃了没？没吃？嘎！', '管饱！'],
    bday: '嘎！今天本大厨生日！',
    bye: '嘎！锅里还炖着呢，我得去看看！',
    at: {
      work: ['今天的红烧肉，嘎！一绝！', '饭不够随便添，管饱！', '嘎！谁说鸭子不会做饭？'],
      shop: ['嘎，这玉米真嫩，全要了！', '挑菜要看叶子，蔫的不要，嘎！'],
      swim: ['嘎！水真凉快！', '别看我，本大厨在练憋气。……嘎。'],
      rest: ['忙了一天，湖边吹吹风，嘎~', '晚上的湖，比白天安静多了。'],
    },
    time: { morn: ['嘎！早饭要吃饱，一天才有劲！'], noon: ['饭点！饭点！嘎嘎！'], eve: ['晚饭吃了没？我那还有剩的！'], night: ['嘎……夜宵？本大厨下班了。'] },
    pig: { hungry: '嘎！你肚子叫得比我还响！快去食堂！', tired: '累了？吃饱了就不累了！嘎！', sick: '生病了喝碗热汤，嘎，出一身汗就好了。' },
    news: { grew: '长这么壮了！嘎！都是吃我的饭长的！', grad: '毕业了？嘎！本大厨给你加个鸡腿！', house: '新家有厨房吗？嘎！我教你炒菜！', rank: '干活辛苦，来食堂多打一勺！', gift: '昨天你送的，我做成菜了！嘎！香！', played: '昨天那把，嘎，你出得太快了！' },
    tier: [
      ['做饭最要紧的是火候，嘎！', '你喜欢吃什么？我明天做！'],
      ['嘎，我做饭从来不放鸡蛋。……别问为什么。', '食堂的饭不要钱，但是用心做的！', '你吃得香，我就高兴，嘎！'],
      ['嘎……其实我刚学做饭的时候，烧糊了一百口锅。', '看大家吃饱，比我自己吃饱还开心。', '你是我最好的食客，嘎！'],
    ],
    ask: [{ k: 'spicy', q: '嘎！吃辣不？', a: ['吃辣！', '不吃辣'], r: ['嘎！够胆！明天给你加辣！', '行！给你单独做一份不辣的！'] }],
    memo: { spicy: ['今天的辣子鸡，专门给你多放了辣，嘎！', '今天给你留了一碗不辣的番茄汤！'] },
    gift: { wish: '嘎！就缺这个！今晚有菜了！', love: '嘎嘎！好东西！我要做一大锅！', like: '嘎，谢啦，能做个小菜。', plain: '嘎！谢谢！我想想做什么菜。', dislike: '嘎？！' },
    walk: {
      go: '嘎！走！我正好消消食。', end: '嘎！该备菜了！我得走了！', tired: '走饿了吧？嘎，回食堂吃饭去！',
      fav: '湖！嘎！我最喜欢的地方！',
      near: { canteen: '我的食堂！闻到香味没？', farm: '每天的菜都是从这儿买的，嘎。', restaurant: '小猪餐馆？嘎，没我做得好吃。' },
      idle: ['嘎嘎，走路也要挺胸！', '嘎……我饿了，你饿不饿？'],
    },
    play: { go: '石头剪刀布？嘎！我出……不告诉你！', win: '嘎？！我输了？再来！', lose: '嘎嘎嘎！我赢啦！', draw: '嘎！平了！' },
    eat: { go: '嘎！跟我来，今天我给你打饭！', sit: '吃！多吃！不够我再去盛！嘎！' },
  },

  cow: {
    hi: ['哞~来看看，今早刚挤的奶🥛', '娃，来啦？', '地里的菜可水灵了！', '哞，好好好。'],
    bday: '哞！今天大叔过生日，牛都给我唱歌嘞。',
    bye: '哞，说半天了，大叔得去喂牛了。',
    at: {
      work: ['这菜今早刚摘的，叶子上还有露水嘞。', '娃，买点胡萝卜回去，甜着呢。', '哞~今年雨水好，啥都长得旺。'],
      ranch: ['大花今天吃得多，大叔高兴。', '哞~牛跟人一样，你对它好，它都知道。'],
    },
    time: { morn: ['天一亮大叔就下地了，哞。'], noon: ['晌午了，歇歇脚。'], eve: ['太阳下山，牛也该回棚了。'], night: ['这么晚，娃早点回家睡。'] },
    pig: { hungry: '饿了吧？拿个苹果先垫垫。', tired: '累了就歇着，地里的活儿干不完的。', dirty: '哈哈，一身泥，跟大叔下地回来一个样。' },
    news: { grew: '哞！长这么高了！跟地里的玉米似的，蹭蹭往上窜。', grad: '读完书了？好！大叔就认得几个字，你比我强。', house: '盖新房啦？好！有了家，心就定了。', rank: '能干活，是好娃。', gift: '昨天你送的，大叔吃了，美！', played: '昨儿那几把，大叔输得心服口服。' },
    tier: [
      ['种地跟做人一样，得实在。', '你家菜园子种了啥？'],
      ['哞，你种的菜要是吃不完，拿来给大叔看看。', '我家的牛，每一头都有名字。', '娃，你干活实在，大叔喜欢。'],
      ['大叔这辈子，就守着这块地，也挺好。', '有你常来，大叔这儿热闹多了。', '哞……你就跟大叔自家娃一样。'],
    ],
    ask: [{ k: 'veg', q: '娃，你爱吃胡萝卜还是玉米？', a: ['胡萝卜', '玉米'], r: ['好！胡萝卜养眼睛！', '玉米甜，大叔也爱啃！'] }],
    memo: { veg: ['今天的胡萝卜特别甜，给你挑了几根大的。', '今早掰的玉米，嫩得能掐出水。'] },
    gift: { wish: '哞！正想着这个嘞，娃真懂事。', love: '哎呀，这可是好东西！大叔就好这一口。', like: '好好好，谢谢娃。', plain: '哞，谢谢啊。' },
    walk: {
      go: '走走？好嘞，大叔领你看看地。', end: '哞，该喂牛了，大叔走了啊。', tired: '走累了吧？回去喝碗牛奶。',
      fav: '这是你的菜园子？种得不赖嘛！',
      near: { farm: '大叔的摊子，啥都新鲜。', home: '这就是你家？哞，挺好，挺好。' },
      idle: ['你看那片田，今年肯定丰收。', '哞~风里都是草香。'],
    },
    play: { go: '石头剪刀布？大叔可不会让你啊。', win: '哞！输了输了，娃厉害。', lose: '嘿嘿，大叔赢了！', draw: '一样的？哞，心有灵犀。' },
    eat: { go: '吃饭去？好，大叔饿了。', sit: '哞，这饭香，就是没大叔家的玉米香。' },
  },

  rabbit: {
    hi: ['小猪哥哥！小猪哥哥！', '小猪哥哥好！🐰', '是小猪哥哥！', '嘿嘿，小猪哥哥来啦！'],
    bday: '今天是我生日！今天是我生日！今天是我生日！',
    bye: '我要回去找兔婆婆了，小猪哥哥拜拜！',
    at: {
      class: ['小猪哥哥！小猪哥哥！我在这儿！🐰', '老师说今天要画画，我要画你！', '我们在学唱歌，你听你听！'],
      porch: ['兔婆婆在做胡萝卜饼，好香好香。', '我在等小猪哥哥来玩呢！'],
      hop: ['我跳到第八格啦，你看你看！', '你也来跳嘛，跳错了不算，重来就好了。'],
      kite: ['风筝飞得好高好高！', '小猪哥哥帮我拉线，我手酸了。'],
      ducks: ['鸭子鸭子，吃面包屑啦！', '那只小鸭子一直跟着我，嘻嘻。'],
      shop: ['栗栗姐姐的小火车会冒烟！', '我就看看，不买，兔婆婆说的。'],
      visit: ['我来找刺猬姐姐玩！她的花好漂亮。'],
      play: ['我们在玩捉迷藏，小猪哥哥别说话！', '栗栗姐姐跑得好快，我追不上。'],
    },
    time: { morn: ['早上好！我刚刷完牙！'], noon: ['兔婆婆做了胡萝卜饼，我要回家吃饭啦！'], eve: ['天快黑了，我要回家了。'], night: ['我……我还不困……呼……'] },
    pig: { dirty: '小猪哥哥脸上脏脏的，像小花猫！', sad: '小猪哥哥不开心吗？我给你吹吹。', sick: '小猪哥哥生病了吗？我把我的小红花给你！' },
    news: { grew: '小猪哥哥你是不是又长高了？比我高好多好多。', grad: '小猪哥哥毕业啦！你有小红花吗？', house: '小猪哥哥搬新家啦！我能去玩吗？能吗？', rank: '小猪哥哥好厉害，天天去上班。', gift: '昨天的好好吃！我一口一口吃的！', played: '昨天跟小猪哥哥玩，我赢了！……是不是？' },
    tier: [
      ['我今天得了小红花！', '小猪哥哥，你喜欢什么颜色？我喜欢粉色。'],
      ['小猪哥哥，我们拉钩，明天还一起玩。', '兔婆婆说，小猪哥哥是好孩子。', '我会自己穿鞋了！左脚右脚都对！'],
      ['小猪哥哥，你明天还来吗？我把最大的那颗胡萝卜留给你。', '我最喜欢小猪哥哥了，第二喜欢兔婆婆。……不对，一样喜欢。', '我长大了也要像小猪哥哥一样厉害。'],
    ],
    ask: [{ k: 'color', q: '小猪哥哥，你喜欢粉色还是蓝色？', a: ['粉色', '蓝色'], r: ['我也是我也是！粉色最好看！', '蓝色像天空！我画个蓝天给你！'] }],
    memo: { color: ['我给小猪哥哥画了一幅画，全是粉色的！', '我画了一片蓝蓝的天，送给小猪哥哥！'] },
    gift: { wish: '就是这个！就是这个！小猪哥哥最好了！', love: { carrot: '胡萝卜！是给我的吗？真的吗？真的吗？😍', _: '是给我的吗？真的吗？真的吗？😍' }, like: '哇，谢谢小猪哥哥！', plain: '嗯……谢谢小猪哥哥！我拿给兔婆婆看。' },
    walk: {
      go: '好呀好呀！小猪哥哥牵着我！', end: '我得回去了，兔婆婆会找我的，拜拜！', tired: '我走不动了……小猪哥哥背我……开玩笑的，嘻嘻。',
      fav: '玩具店！就看一眼，就一眼！',
      near: { kinder: '这是我的幼儿园！', bakery: '好香呀，狐狸阿姨在烤饼干！', lake: '鸭子！鸭子！' },
      idle: ['小猪哥哥，你走得好快，等等我！', '一二一，一二一！'],
    },
    play: { go: '石头剪刀布！我要出……嘘，不告诉你！', win: '呜……小猪哥哥赢了，再来一次嘛！', lose: '我赢啦！我赢啦！我赢啦！', draw: '一样的！我们想的一样！' },
    eat: { go: '跟小猪哥哥吃饭！好耶！', sit: '我会自己用勺子了，你看！' },
  },

  panda: {
    hi: ['孩子，来啦。', '慢慢走，别摔着。', '哟，是你呀。', '来，坐会儿。'],
    bday: '今天是重阳，也是爷爷的生日。',
    bye: '好啦，爷爷要歇会儿了，你去玩吧。',
    at: {
      taichi: ['哟，起这么早。来，跟爷爷比划两下，抬手，慢慢地。', '早上的风最好，吸一口，一天都精神。'],
      porch: ['这茶要等一等再喝。急了，就只剩烫了。', '爷爷刚写了个字，念「慢」。'],
      chess: ['嘘，别出声，老龟在想棋呢，他这一步能想到天黑。', '孩子，你看他走那步马，我早就看出来了，嘿嘿，不说。'],
      walk: ['湖边走一走，心就静了。', '你看那几只鸭子，多自在。'],
      shop: ['挑竹笋要挑带泥的，新鲜。'],
      rest: ['小兔跑得快，爷爷在这儿看着就好。'],
    },
    time: { morn: ['早上好，孩子。'], noon: ['中午了，爷爷要打个盹儿。'], eve: ['太阳落山了，回家喝口茶。'], night: ['这么晚了，爷爷该睡了，你也早点睡。'] },
    pig: { tired: '眼睛都快睁不开啦。回家睡一觉，什么事都等明天。', sick: '病了就别出来吹风，回家躺着。', hungry: '饿了？爷爷家里有饺子，下回给你留着。' },
    news: { grew: '又长个子了，好，好。', grad: '听说你毕业了？好，好。读书是一辈子的事，不急。', house: '搬新家了？家不在大，住着舒服就好。', rank: '能干活是好事，也别累着。', gift: '你这孩子，昨天送的，爷爷吃得可香了。', played: '昨天那盘棋，你翻棋翻得真准。' },
    tier: [
      ['做事别急，慢慢来。', '这竹子，长得慢，可结实。'],
      ['爷爷年轻的时候，一口气能爬三座山。', '你每次来，爷爷都高兴。', '茶要慢慢喝，日子要慢慢过。'],
      ['我年轻时也有个朋友，天天来我家喝茶。后来他搬走了。你别搬走啊。', '孩子，有你陪着，爷爷不觉得老。', '人老了，就记得那些对你好的人。'],
    ],
    ask: [{ k: 'tea', q: '孩子，你爱喝茶吗？', a: ['爱喝', '有点苦'], r: ['好，下回爷爷给你泡竹叶茶。', '哈哈，苦过才知道甜。爷爷给你加点蜂蜜。'] }],
    memo: { tea: ['今年的新茶下来了，给你留了一包。', '爷爷泡了一壶蜂蜜茶，不苦，你尝尝。'] },
    gift: { wish: '哎哟，正想着这个呢，你这孩子真贴心。', love: { bamboo: '哎哟，这笋嫩！今晚给你炖一锅笋汤。', dumpling: '饺子！爷爷就好这一口。', _: '哎哟，这个好！' }, like: '好，好，谢谢孩子。', plain: '你这孩子，来就来，还带东西。' },
    walk: {
      go: '好，爷爷陪你走走，走慢点。', end: '爷爷该走了，你也早点回家。', tired: '走累了，爷爷歇歇，你先回吧。',
      fav: '湖边，爷爷最喜欢的地方。站一会儿吧。',
      near: { plaza: '爷爷每天早上在这儿打太极。', chess: '老龟又在那儿等人下棋了。', farm: '牛大叔的竹笋，最嫩。' },
      idle: ['慢慢走，路不会跑。', '你看那棵树，比爷爷还老。'],
    },
    play: { go: '战棋？好，爷爷年轻时可是高手。', win: '哈哈，后生可畏，爷爷输得高兴。', lose: '嘿嘿，姜还是老的辣。', draw: '不分胜负，好棋，好棋。' },
    eat: { go: '好，爷爷陪你吃饭。', sit: '慢慢吃，细嚼慢咽，对胃好。' },
  },

  hedgehog: {
    hi: ['那个……你好。', '嘻嘻，小猪哥哥。', '小心别被扎到哦。', '啊，是你呀……嘻嘻。'],
    bday: '那个……今天，是我的生日。嘻嘻。',
    bye: '那个……我要回去浇花了，下次再聊。',
    // after the 8♥ talk she says hello the way they agreed on
    hiMemo: { hi: ['嘻嘻，挥挥手~小猪哥哥！', '碰碰鼻子……嘻嘻。'] },
    at: {
      flowers: ['那个……早。这朵昨天还没开呢。', '嘘，小声点，它们还在睡。'],
      'flowers@meadow': ['这里的花，我都叫得出名字。', '那个……这朵送你。嘻嘻。'],
      garden: ['你的胡萝卜长得好好哦。我能……摸一下叶子吗？', '你的菜园子……我每天都来看一眼。'],
      rest: ['湖边的风，把我的刺吹得凉凉的。'],
      'shop@bakery': ['我只买一个牛角包，嘻嘻，再多就吃不完了。'],
      'shop@farm': ['那个……我来买花种，还有苹果。'],
      porch: ['那个……我在门口晒太阳。', '屋里的花都开了，嘻嘻。'],
      visit: ['小兔来找我玩，她说我的花好漂亮。'],
    },
    time: { morn: ['那个……早上好。'], noon: ['中午的太阳……花都晒蔫了。'], eve: ['傍晚了，要给花盖被子了。……开玩笑的。'], night: ['那个……这么晚，你不怕黑吗？'] },
    pig: { dirty: '你脸上有泥……这里，嗯，左边一点。', sad: '那个……你不开心吗？我……我陪你坐一会儿。', sick: '那个……生病了要多喝热水。' },
    news: { grew: '你……你又长高了。嘻嘻。', grad: '毕业了呀……好厉害。', house: '新家……有窗台吗？可以放花。', rank: '你……每天都去干活，好辛苦。', gift: '昨天的……我插在背上带回家了，嘻嘻。', played: '昨天那盘棋……我是不是下得很笨。' },
    tier: [
      ['那个……我种的郁金香要开了。', '花跟人一样，要有人跟它说话。'],
      ['那个……你是第一个夸我的花好看的人。', '我很怕扎到别人，所以……离远一点。', '嘻嘻，跟你说话，我就不紧张了。'],
      ['以前我总怕扎到别人，所以都离大家远远的。跟你在一起就不怕。', '那个……我想种一盆花，送给你。', '嘻嘻，你是我最好的朋友……第二好的是花。……不对，你第一。'],
    ],
    ask: [{ k: 'flower', q: '那个……你喜欢郁金香，还是小雏菊？', a: ['郁金香', '小雏菊'], r: ['嘻嘻，我也是……红红的那种。', '小雏菊……小小的，好可爱。'] }],
    memo: { flower: ['那个……我家的郁金香，又开了一朵。', '公园里的小雏菊开了一大片，嘻嘻。'] },
    gift: { wish: '啊……就是这个……谢谢你。嘻嘻。', love: { apple: '苹果！我可以把它插在背上带回家吗？嘻嘻😊', _: '那个……我可以把它带回家吗？嘻嘻😊' }, like: '谢谢……我好喜欢。', plain: '谢谢……我会好好收着的。' },
    walk: {
      go: '那个……好呀。我走慢一点，你别嫌我。', end: '那个……我要回去给花浇水了。', tired: '我……我有点走不动了。今天好开心。',
      fav: '等一下等一下，那是小雏菊，我们看一会儿好不好。',
      near: { garden: '你的菜园子……叶子绿绿的。', bakery: '那个……面包房的苹果派，最好吃了。', farm: '我常来这儿买花种。' },
      idle: ['那个……你走得好快。', '嘻嘻，有你在，我就不怕狗叫了。'],
    },
    play: { go: '那个……井字棋，我会一点点。', win: '你好厉害……嘻嘻。', lose: '那个……我赢了？真的吗？', draw: '平局……嘻嘻，都没输。' },
    eat: { go: '那个……好呀，一起吃饭。', sit: '我吃得慢……你别等我。' },
  },
};

// ---------- heart stories ----------
// A short scene the first time someone is met after reaching some hearts: a story for each
// hidden item and perk they already give, and one that's just a story. at: what they need to be
// doing (any, if not given); with: someone who has to be there too. The scenes give nothing
// themselves: the hearts already did.
// Each line is said by them, unless it starts with @id (someone else). A leading ^ is said
// smiling, ! surprised, ~ shyly. { ask, then } is a choice of two answers, each followed by its
// own lines; mem keeps the answer (see hiMemo).
const NPC_STORIES = {
  dog: {
    3: { at: ['work'], lines: ['小猪，来来来，跟我到后面来！', '这是我们的告示板，新活儿都先贴在这儿。', '别人还不知道呢，你先看。', '^汪！好活儿要靠抢的！'] },
    5: { at: ['work'], lines: ['汪！小猪，等一下！', '这个给你，一张奖状：优秀打工猪！', '~我自己画的，画得有点歪。', '^以后你来打工，我跟老板说一声，工资给你多算一点！'] },
    8: { at: ['run'], lines: ['呼……呼……小猪！', '一起跑一圈吧！预备……跑！', '……', '!呼……你跑得好快！', '^汪！跟你一起跑，一点都不累！'] },
    10: { at: ['work'], lines: ['小猪，这个给你！', '工作帽！戴上它，就是老手了！', '~我刚来猪猪城的时候，也有人送过我一顶。', '^现在轮到我送给你啦。汪！'] },
  },
  fox: {
    3: {
      at: ['work'],
      lines: ['乖孩子，你来得正好！', '!看，第一根法棍，刚从炉子里拿出来的。', '来，掰一块尝尝，小心烫。',
        { ask: ['好香！', '脆脆的！'], then: [['^就知道你喜欢，阿姨练了好久呢。'], ['^脆就对了，外面脆，里面软，这才是法棍。']] },
        '以后阿姨天天烤，你想吃就来买。', '^给你算便宜点，谁让你是阿姨的乖孩子。'],
    },
    5: { at: ['rest'], lines: ['乖孩子，来，坐阿姨旁边。', '阿姨小时候住在乡下，家里有一个柴火炉子。', '每天天不亮，我妈妈就起来揉面。', '我就趴在炉子边上，等第一个面包出来。', '~那个味道啊，阿姨一辈子都忘不了。', '^现在阿姨也天不亮就起来揉面，就想让你们也闻到那个味道。'] },
    6: {
      at: ['work'],
      lines: ['乖孩子，帮阿姨看看，这两颗草莓，哪颗熟了？',
        { ask: ['尖尖红的', '大大的'], then: [['^对喽！尖尖都红透了，才是真熟了。'], ['大的不一定甜哦。你看它的尖尖，还白着呢。']] },
        '^用熟草莓做的蛋糕，甜得刚刚好。以后店里天天有。'],
    },
    8: { lines: ['哎，乖孩子，正好碰见你。', '阿姨烤了一盒小饼干，要给小兔送去，你也来吧？', '@rabbit 狐狸阿姨！还有小猪哥哥！', '@rabbit ^饼干！是给我的吗？真的吗？真的吗？', '^来，三个人分，一人一块，不许抢。', '~……这样一起吃点东西，真好。'] },
    10: { at: ['work'], lines: ['乖孩子，过来，阿姨跟你说个秘密。', '这是阿姨的独门手艺，胡萝卜蛋糕。', '配方阿姨谁都没告诉过。', '~今天，阿姨把它传给你。', '^……逗你的，你还小，阿姨烤给你吃就行。', '以后店里的胡萝卜蛋糕，专门给你留着。'] },
  },
  raccoon: {
    3: { at: ['work'], lines: ['站住。', '!你的手……你刚才摸了什么？', '过来，我给你洗。不许动。', '搓手心，搓手背，搓指缝……好了。', '^闻闻，香不香？薰衣草皂，我新做的。', '送你一块。以后店里也卖。'] },
    5: {
      at: ['wash'],
      lines: ['啊……你看到了。', '我在洗的，是一只布偶。', '是我小时候的。洗了好多好多年，都洗薄了。', '~每次心里不舒服，我就来湖边洗它。',
        { ask: ['它很干净', '我帮你洗'], then: [['^……嗯。它是全城最干净的布偶。'], ['^不行，只有我能洗。……不过，你可以在旁边陪我。']] }],
    },
    6: { at: ['work'], lines: ['你来得正好，帮我试试这个。', '牛奶浴盐，泡澡用的。', '!你闻，是不是有一股奶香？', '^好，那就上架了。'] },
    8: { at: ['work'], lines: ['那个……你今天有空吗？', '我想把店里从上到下擦一遍。', '你帮我擦泡泡机，我擦地。', '……', '^擦完了。好亮。', '~跟你一起干活，好像没那么累。谢谢你。'] },
    10: { at: ['work'], lines: ['你过来，我给你看个东西。', '这是泡泡机，我做了一个月。', '打开它，满屋子都是泡泡。', '^这台是给最干净的小猪的。', '~……就是你。以后店里只卖给你。'] },
  },
  squirrel: {
    3: { at: ['work'], lines: ['吱！你来啦！', '我刚才在公园捡松果，捡了一大堆！', '你会跳绳吗？我教你！一、二、三，跳！', '^吱吱！你跳得比我还高！', '这根跳绳，我放在店里卖，你随时来买。'] },
    5: { at: ['work'], lines: ['跟你说个玩玩具的秘诀。', '一个玩具玩腻了，就放一放，玩别的。', '过几天再拿出来，又像新的一样！', '^吱！我就是这么玩的，所以我从来不无聊。'] },
    6: { at: ['work'], lines: ['快来快来，帮我拼完最后一块！', '就差一块了，我找了一下午。', '!找到了！在你脚边！', '^拼好啦！是一只大松鼠！……就是我！'] },
    8: { at: ['play'], with: 'rabbit', lines: ['吱！你来得正好！', '@rabbit 小猪哥哥！我们在玩捉迷藏！', '你也来！你来找我们！', '……', '!吱！被你找到了！我躲得这么好！', '@rabbit ^嘻嘻，栗栗姐姐的尾巴露在外面啦！'] },
    10: { at: ['work'], lines: ['吱……你闭上眼睛。', '好了，睁开！', '!松果陀螺！我自己做的！', '用我捡过最大的那颗松果。', '^送你一个。店里也只卖你一个人。'] },
  },
  cat: {
    3: { at: ['work'], lines: ['站住。你这身搭配……', '我真是看不下去了。', '过来。……我随便帮你挑挑，别误会。', '这个颜色衬你。……别笑，我是认真的。', '~嗯，还行吧。比刚才顺眼多了。'] },
    5: {
      at: ['cafe'],
      lines: ['……你坐。', '跟你说件事，不许笑。', '我每天换三套衣服，是因为……我怕别人说我土。', '~小时候有人笑过我，说我穿得像一块旧抹布。',
        { ask: ['你一点都不土', '旧抹布也挺好'], then: [['~……哼，你就会说好听的。'], ['^……噗。你这只猪，真是的。']] },
        '……谢谢你。'],
    },
    8: {
      at: ['fountain'],
      lines: ['你来得正好，帮我选一个。', '星星的，还是月亮的？',
        { ask: ['星星的', '月亮的'], then: [['星星的……嗯，我也这么想。'], ['月亮的……嗯，也不错。']] },
        '……', '你看什么？我照照镜子而已，照很久怎么了。', '^……还行吧。'],
    },
    10: { at: ['work'], lines: ['喂。', '这个给你。星星发卡，全城就这么几个。', '~戴着，别弄丢了。', '……以后店里只卖给你。别告诉别人。'] },
  },
  bear: {
    3: { at: ['work'], lines: ['小家伙，来，带你看个东西。', '这张床，我亲手做的。', '床头这两只耳朵，是照着我自己做的。嘿嘿。', '你躺上去试试。', '^结实吧？睡一百年都不会坏。', '以后店里就卖这个，给你算便宜点。'] },
    5: { at: ['work'], lines: ['小家伙。', '我家在店后面，是间木工房。', '~屋里乱，全是刨花。', '不嫌弃的话，中午或者晚上来坐坐。', '^嘿嘿，我给你泡蜂蜜水。'] },
    6: { at: ['work'], lines: ['来，坐坐这个。', '熊熊沙发，样品，刚做好的。', '!软吧？里面塞的都是好棉花。', '^嘿嘿，那就上架了。'] },
    8: { at: ['work'], lines: ['嘘。给你看个小东西。', '这是一座树屋的模型。', '我小时候住在山里，最想要一座树屋。', '~可那时候我太胖了，爬不上树。', '^现在我会做了。等做好了，你第一个来看。'] },
    10: { at: ['work'], lines: ['小家伙，过来。', '树屋，做好了。', '这个是给你的。', '^放在你家里，就当……我们一起爬上去了。', '店里也只给你一个人做。嘿嘿。'] },
  },
  sheep: {
    3: { at: ['work'], lines: ['咩？你的声音怎么哑了？', '张嘴，啊——', '嗯，嗓子有点红。', '来，含一颗润喉糖。不苦的。', '^这是我自己配的，以后诊所里就有了。'] },
    5: { at: ['work'], lines: ['咩，跟你说一声。', '以后你不舒服，直接来找我，不用等。', '~我给你插个队……别告诉别的病人。', '^咩~谁让你是我的好朋友呢。'] },
    6: { at: ['work'], lines: ['你最近是不是很累？', '这是营养补剂，我新配的。', '累的时候喝一瓶，比睡一觉还管用。', '^但是觉还是要睡的哦，咩。'] },
    8: {
      at: ['walk'],
      lines: ['咩~陪我走走吧。', '跟你说个秘密。', '我当医生之前，最怕打针了。', '!每次打针，我都哭得特别大声，整个诊所都听得见。', '~所以现在，我打针都特别轻。',
        { ask: ['你打针一点都不疼', '我也怕打针'], then: [['^咩~那我就放心了。'], ['^没关系，我轻轻的，一下就好。']] }],
    },
    10: { at: ['work'], lines: ['咩，这个给你。', '蜂蜜糖。我自己熬的，熬了一整晚。', '~药都是苦的，我想做一颗甜的药。', '^这是第一颗，给你。以后诊所里只卖你。'] },
  },
  owl: {
    3: {
      at: ['patrol', 'work'],
      lines: ['咕咕，小猪同学，来得正好。', '考你一道题。', '一棵树上有五只鸟，飞走了两只，还剩几只？',
        { ask: ['三只', '一只都没了'], then: [['咕咕，书上是这么算的。'], ['!咕咕！对，剩下的都吓跑了！']] },
        '^会算题，也会想事情，很好。'],
    },
    5: { at: ['work'], lines: ['咕咕，小猪同学。', '你上课一直很认真。', '以后你来上课，我多讲一点。', '^学到的会更多一些。……别告诉别的同学。'] },
    8: { at: ['stars'], lines: ['咕咕，这么晚还没睡？', '来，看看这个。', '这是望远镜，往里看。', '!看到了吗？那是月亮上的坑。', '~我每天晚上都在这儿看，看了好多年。', '^今天多了一个人陪我看。很好。'] },
    10: { at: ['work'], lines: ['小猪同学，这顶帽子给你。', '博士帽。', '戴上它，不是因为你毕业了。', '^是因为你一直在学。'] },
  },
  turtle: {
    3: { at: ['work'], lines: ['来一盘……慢棋。', '……', '……嗯……', '!哦？你这步……下错了。', '爷爷让你一步……重新走。', '^嘿嘿……下棋，要的是开心。'] },
    5: { at: ['work'], lines: ['小朋友……爷爷跟你商量个事。', '以后……你玩游戏，爷爷多陪你几盘。', '~爷爷家在湖边……龟壳一样的小屋。', '^中午……晚上……爷爷都在家。来喝茶。'] },
    8: { at: ['work'], with: 'panda', lines: ['小朋友……你看这张照片。', '左边这个……是爷爷，年轻时候。', '右边这个……是老熊猫。', '我们俩……在这个棋亭……下了五十年。', '^平局……一千多盘……嘿嘿。', '@panda 老龟，又在说我坏话？', '^嘿嘿……来了来了。'] },
    10: { at: ['work'], lines: ['这张桌子……跟了我好多年。', '~爷爷老了……搬不动了。', '^给你吧。你家里……也摆一张。', '有空……我们在你家下一盘。'] },
  },
  duck: {
    3: {
      at: ['work'],
      lines: ['嘎！你来得正好！', '尝尝我的新菜！', '……', '嘎！好吃吧！',
        { ask: ['好吃！', '有点咸'], then: [['^嘎嘎嘎！就知道！'], ['!嘎？！……好吧，明天少放点盐。']] }],
    },
    5: { at: ['work'], lines: ['嘎！你听着！', '以后你来食堂，我给你多打一勺！', '^管饱！嘎！'] },
    8: { at: ['swim'], lines: ['嘎！别过来！', '……', '~好吧，告诉你。', '我……不会游泳。', '我只是在水里站着。', '!嘎！你别笑！鸭子不会游泳怎么了！', '^……嘎嘎，好吧，是挺好笑的。'] },
    10: { at: ['work'], lines: ['嘎！拿去！', '大厨锅！跟了我十年！', '^以后自己在家开伙！做不好别说是我教的！嘎！'] },
  },
  cow: {
    3: { at: ['work'], lines: ['娃，来，尝尝这个。', '刚挤的鲜牛奶，还热乎呢。', '^咋样？比瓶装的香吧？', '以后摊子上天天有，给你留着。'] },
    5: { at: ['work'], lines: ['娃，大叔家在牧场，有间小屋。', '~屋里就是个草垛子，大叔睡草垛子上。', '^下午大叔都在牧场，来喝牛奶。'] },
    6: { at: ['work'], lines: ['娃，这包种子给你。', '西瓜种子，种在你那菜园子里。', '^结了西瓜，大叔第一个来吃。'] },
    8: { at: ['ranch'], lines: ['娃，来，大叔给你介绍。', '这个是大花，脾气好。', '那个是小黑，爱偷吃。', '最边上那个是老黄，跟了大叔二十年了。', '^哞~每一头，大叔都当自家人。'] },
    10: { at: ['work'], give: 'cowbell', lines: ['娃，大叔给你打了个小牛铃。', '磨了好几个晚上，磨得亮亮的。', '^挂在你家门口，叮叮当当的，一听就知道是你回家了。'] },
  },
  rabbit: {
    3: { lines: ['小猪哥哥！小猪哥哥！', '你来我家玩好不好？好不好？', '我有好多好多玩具，还有兔婆婆榨的胡萝卜汁！', '^我家的门圆圆的、矮矮的，你进来要低头哦！', '~拉钩！一定要来哦！'] },
    5: { lines: ['小猪哥哥，给你看！', '我的小红花墙上，又多了一朵！', '这朵是……「小猪哥哥陪我玩」！', '^老师说，有好朋友也可以得小红花！'] },
    8: {
      lines: ['小猪哥哥……', '~今天，幼儿园的小朋友笑我。', '说我耳朵太长了，像两根面条。',
        { ask: ['长耳朵最可爱', '我也想要长耳朵'], then: [['!真的吗？真的吗？'], ['!真的？可是小猪哥哥的耳朵也很好看呀！']] },
        '^嘻嘻……我不难过了。', '明天我要把耳朵竖得高高的去幼儿园！'],
    },
    10: { give: 'carrotpillow', lines: ['小猪哥哥，闭上眼睛！', '……好了，睁开！', '!胡萝卜抱枕！我跟兔婆婆学着缝的！', '~针扎了好几次手……可是我一点都不疼。', '^送给你！抱着它睡觉，就会梦见我！'] },
  },
  panda: {
    3: { lines: ['孩子，来。', '爷爷家里有好茶，竹叶泡的。', '想请你来坐坐。', '^门开着，就进来，不用敲。', '爷爷给你泡茶。'] },
    5: { lines: ['孩子，爷爷教你一招。', '两脚分开，跟肩膀一样宽。', '抬手……慢慢地……再慢一点。', '^对喽。太极就一个字：慢。', '慢了，心就静了。'] },
    8: { at: ['porch'], lines: ['孩子，坐。', '今天老龟来过，我们俩说起年轻时候的事。', '那时候，我们俩一个比一个跑得快。', '!老龟跑得快？……是真的，你别不信。', '^后来啊，走着走着，就慢下来了。', '~慢下来也好，能看清身边的人。'] },
    10: { give: 'bonsai', lines: ['孩子，爷爷养了一盆竹子。', '小小的，养在盆里，养了一整年。', '^今天送给你，摆在你家里。', '看见它，就想起爷爷。'] },
  },
  hedgehog: {
    3: {
      lines: ['那个……小猪哥哥。', '我家的郁金香开了，开了三朵。', '你要不要……来看看？',
        { ask: ['好呀！', '现在就去'], then: [['^嘻嘻……'], ['!啊，现在吗？']] },
        '~那……我先回去切苹果。', '^门我给你留着哦。'],
    },
    5: { lines: ['那个……小猪哥哥。', '我给你种了一盆小花，开花了。', '~我把它放在你家窗台上了……可以吗？', '^嘻嘻，它会每天陪着你的。'] },
    8: {
      lines: ['那个……小猪哥哥，我想问你一件事。', '~我很怕自己的刺扎到别人。', '所以，我从来不跟人抱抱。', '我们……见面的时候，怎么打招呼呢？',
        { ask: ['挥挥手', '碰碰鼻子'], mem: 'hi', then: [['^嗯！挥挥手，就不会扎到啦。'], ['~碰碰鼻子……嘻嘻，鼻子上没有刺。']] },
        '^以后见面，就这样。'],
    },
    10: { give: 'appletree', lines: ['那个……小猪哥哥。', '我种的小苹果树，结了第一个苹果。', '~本来想自己吃的……', '^可是我更想送给你。连花盆一起！嘻嘻。'] },
  },
};

// ---------- visiting ----------
// Who has a home the pig can visit, and what happens there. hearts: how many before they ask him
// in (their heart story at that many does the asking); gift: what a neighbour presses on him on
// the way out, the first visit of a day from NPC_PERK_HEARTS (keepers give nothing: they have
// their shops). knock: what they say through the door when it stays shut (closed: not asked in
// yet; asleep: napping or in bed). tea: sitting down together, once a day. sign: about the one
// thing in the house that is most them. bye: with the little present.
const NPC_VISITS = {
  rabbit: {
    hearts: 3, gift: 'carrot',
    knock: { closed: '谁呀？是小猪哥哥！我在吃饭呢，等会儿出来玩~', asleep: '……呼……呼……' },
    tea: ['来来来，坐蘑菇凳！', '这是兔婆婆榨的胡萝卜汁，甜甜的！', '^干杯！咕嘟咕嘟……', '!小猪哥哥，你长胡子啦！橙色的胡子！嘻嘻！'],
    sign: ['这朵是我自己穿鞋得的！', '这朵是我午睡没哭得的！', '这朵是我把青菜吃光了得的！', '^等贴满了，老师说可以换一个大苹果！', '这朵是……小猪哥哥陪我玩！嘻嘻。'],
    bye: '小猪哥哥，这根胡萝卜给你！明天还来哦！',
  },
  panda: {
    hearts: 3, gift: 'dumpling',
    knock: { closed: '谁呀？……哦，是隔壁的孩子。爷爷在写字，改天再来坐。', asleep: '……嗯？……爷爷打个盹……' },
    tea: ['坐，坐。', '竹叶茶，要等一等再喝。', '……', '^急了，就只剩烫了。慢慢喝，才有味道。'],
    sign: ['这个字念「慢」。爷爷写了一辈子。', '写字跟打太极一样，手要稳，心要静。', '^今天这张写得不错，你看这一撇。', '老龟说爷爷的字像竹子。……他下棋输了才这么说。'],
    bye: '孩子，拿着，爷爷包的饺子，回去热热吃。',
  },
  hedgehog: {
    hearts: 3, gift: 'apple',
    knock: { closed: '谁、谁呀？……啊，小猪哥哥。我、我还没准备好……', asleep: '……嗯……苹果……' },
    tea: ['那个……坐这里。', '我切了苹果，切成小兔子的样子。', '^你看，耳朵是苹果皮！', '~……你喜欢就好。'],
    sign: ['这盆是郁金香，前天刚开。', '这盆小雏菊，每天早上都朝着窗户。', '~这盆是仙人掌。我觉得它跟我有点像……', '^今天又开了一朵！你看你看！'],
    bye: '那个……这个苹果给你。路上吃。',
  },
  cow: {
    hearts: 5,
    knock: { closed: '哞？娃，有事去摊子上找大叔！', asleep: '……哞……呼……' },
    tea: ['娃，坐！别客气！', '这是今天早上刚挤的牛奶，大叔自己都舍不得喝。', '^再来块奶酪，配面包，香着呢！'],
    sign: ['这个最大的铃铛，是老黄的。跟了大叔二十年。', '这个小的，是今年刚生的小牛犊的。', '!这个叮叮响的，是小黑的。它一偷吃，铃铛就响，嘿嘿。', '^每个铃铛都不一样响，大叔闭着眼都听得出来。'],
  },
  bear: {
    hearts: 5,
    knock: { closed: '谁呀？……哦，小家伙。屋里乱，下次吧，嘿嘿。', asleep: '……呼噜……呼噜……' },
    tea: ['坐那个树桩，结实。', '蜂蜜水，蜂蜜是我自己去市场挑的。', '^嘿嘿，甜吧？', '~我一天能喝十杯……别告诉绵绵医生。'],
    sign: ['这个是我正在做的。', '你看这刨花，卷得多好看。', '^做家具跟做人一样，要实实在在的。', '嘿嘿，你猜这是做什么的？'],
  },
  turtle: {
    hearts: 5,
    knock: { closed: '谁……呀……？爷爷……在想棋……改天……', asleep: '……呼……………呼……' },
    tea: ['坐……慢慢坐……', '海藻茶……湖里捞的……', '……', '^不急……茶凉了……也好喝。'],
    sign: ['这盘棋……下了三年了。', '……该谁走了？……爷爷也忘了。', '^老熊猫说……这步他想了一年。', '……嘘……别动……那颗棋子……是他的。'],
  },
};

// ---------- going somewhere together ----------
// What each says about an outing (see OUTINGS): go, as they set off; sit, once it starts. fav: the
// one they love most, and favLine, a little more they say about it a moment later.
const NPC_OUTINGS_TALK = {
  dog: {
    fav: 'soccer', favLine: '汪！以前我都是一个人对着墙踢，有你真好。',
    soak: { go: '泡温泉？汪！我先冲过去占位子！', sit: '呼……泥巴暖乎乎的，毛都软了，汪。' },
    movie: { go: '看电影？爆米花我来买，汪！', sit: '嘘，开始了！这回我肯定不哭。' },
    soccer: { go: '踢球！汪汪！走走走，我去拿球！', sit: '传给我！看我一脚射门！' },
    cafe: { go: '你请客？汪！那我要大杯的！', sit: '窗外有人遛狗，汪，跟我打招呼呢。' },
    read: { go: '看书？……行，汪，我试试坐得住。', sit: '这本有图！汪，图多我就看得下去。' },
    ducks: { go: '喂鸭子？好，我保证不追它们，汪。', sit: '汪……忍住，忍住，不能扑过去。' },
    garden: { go: '去你家种菜？刨坑我最在行，汪！', sit: '刨坑交给我！汪汪，这坑够深吧？' },
    kite: { go: '放风筝！我跑得快，我来拉线！', sit: '飞起来啦！汪，我追它去！' },
    stars: { go: '晚上看星星？好，汪，我带件外套。', sit: '那颗最亮的，像不像一根骨头？汪。' },
  },
  fox: {
    fav: 'cafe', favLine: '乖孩子都会请阿姨喝东西了，阿姨心里甜着呢。',
    soak: { go: '泡温泉呀？好，阿姨正好腰酸。', sit: '哎哟，舒服……乖孩子，别泡太久头晕。' },
    movie: { go: '看电影？阿姨带了小饼干，偷偷吃。', sit: '乖孩子，害怕就抓着阿姨的手。' },
    soccer: { go: '踢球？阿姨跑不快，你可别笑话。', sit: '慢点跑，乖孩子，摔着阿姨心疼。' },
    cafe: { go: '你请阿姨喝东西？哎哟，真懂事。', sit: '这杯热乎乎的，比阿姨冲的还香。' },
    read: { go: '看书好呀，阿姨看看新点心方子。', sit: '这个蛋糕方子不错，回去烤给你吃。' },
    ducks: { go: '喂鸭子？阿姨这儿有面包边，走。', sit: '你看它们抢的，跟你吃饭一个样。' },
    garden: { go: '去你家菜园子？阿姨帮你看看。', sit: '草莓要多晒太阳，阿姨教你搭架子。' },
    kite: { go: '放风筝呀？阿姨小时候也放过。', sit: '飞高啦！乖孩子，线可要抓牢。' },
    stars: { go: '看星星？好，阿姨给你带件外套。', sit: '夜里凉，乖孩子，靠阿姨近一点。' },
  },
  raccoon: {
    fav: 'read', favLine: '安安静静的，跟你待着，我都忘了要洗手。',
    soak: { go: '泥温泉？……泥是干净的泥吧？', sit: '……其实还挺舒服的。出来要冲三遍。' },
    movie: { go: '电影院？好。座垫我自己带了。', sit: '别把爆米花掉我身上。……挺好看。' },
    soccer: { go: '踢球？……好吧，我穿旧鞋去。', sit: '草屑粘鞋上了……算了，传过来。' },
    cafe: { go: '你请？那我要柠檬水，杯子我自己擦。', sit: '窗玻璃上有个指印。……不是你的吧？' },
    read: { go: '看书好，安静，也不会弄脏。', sit: '翻页轻一点，书角别折。' },
    ducks: { go: '喂鸭子？好，湖边我熟。', sit: '别喂太多，它们会把水弄脏的。' },
    garden: { go: '种菜要碰土……行，我带了手套。', sit: '戴好手套，土别钻进指甲缝里。' },
    kite: { go: '放风筝？好，草地上没水坑就行。', sit: '线别缠在一起……嗯，飞得很直。' },
    stars: { go: '看星星？晚上空气干净，好。', sit: '天上一点灰都没有，真干净。' },
  },
  squirrel: {
    fav: 'kite', favLine: '吱……要是我能抓着风筝飞上天就好了，带你一起。',
    soak: { go: '温泉！吱，我的尾巴会湿透吧？', sit: '吱……暖暖的，我快睡着了。' },
    movie: { go: '看电影！吱吱，我要坐第一排！', sit: '吱，前面的头挡住我了，我坐高点。' },
    soccer: { go: '踢球！吱，我跑得可快了！', sit: '吱吱！我从你脚底下钻过去抢球！' },
    cafe: { go: '你请客？吱！我要甜甜的那种！', sit: '我用两只爪子捧着杯子，嘿嘿。' },
    read: { go: '看书？有图画的那种吗？吱。', sit: '这本讲松鼠的！吱，跟我好像！' },
    ducks: { go: '喂鸭子！我分它们一点玉米，吱。', sit: '吱！它们吃得比我还快！' },
    garden: { go: '种菜！我帮你挖坑，挖坑我最会！', sit: '吱，我顺便埋颗松果，别告诉别人。' },
    kite: { go: '吱吱！放风筝！我等这天好久啦！', sit: '飞起来啦！比树还高！吱吱！' },
    stars: { go: '晚上出门？吱，我不怕黑的！', sit: '星星好多，像天上撒了一把松子。' },
  },
  cat: {
    fav: 'movie', favLine: '……这部还挺好看的。下次上新片，也叫上我。',
    soak: { go: '泥温泉？……听说泥能养毛，走吧。', sit: '别看我。……毛湿了不好看。' },
    movie: { go: '看电影？行，你别在旁边睡着。', sit: '我才没哭，是空调太干了。' },
    soccer: { go: '踢球？……我穿这双鞋可不跑。', sit: '别往我这边踢！……好吧，传过来。' },
    cafe: { go: '你请？那我不客气了，多加奶泡。', sit: '窗边光好，帮我看看毛顺不顺。' },
    read: { go: '看书？行，我正想翻翻时装杂志。', sit: '这一季流行格子……你穿应该不错。' },
    ducks: { go: '喂鸭子？……我就在旁边看着。', sit: '抢面包的样子，一点都不优雅。' },
    garden: { go: '去你菜园？……别让我拔胡萝卜。', sit: '我负责浇水。胡萝卜你自己拔。' },
    kite: { go: '放风筝？……风会吹乱毛的。走吧。', sit: '飞得还行。……线给我拉一下。' },
    stars: { go: '看星星？正好，我换了件夜里穿的。', sit: '星星挺亮的。……没我的眼睛亮。' },
  },
  bear: {
    fav: 'soak', favLine: '小时候在山里，我总是一个人泡。现在有你，嘿嘿。',
    soak: { go: '泡温泉？好，嘿嘿，我背也酸了。', sit: '嗯……舒服。山里的泉水也是这样。' },
    movie: { go: '看电影？好，我坐后排，不挡你。', sit: '嗯……我要是睡着了，叫醒我。' },
    soccer: { go: '踢球？好，我还是守门。', sit: '来，小家伙，往角上踢。' },
    cafe: { go: '你请？嘿嘿，那我要蜂蜜的。', sit: '这椅子……做得还行，腿短了点。' },
    read: { go: '看书？我看木工的书，有图就行。', sit: '这张图纸好，回去我也做一个。' },
    ducks: { go: '喂鸭子？好，我带了点玉米。', sit: '慢慢吃，别抢，嘿嘿，都有。' },
    garden: { go: '去你家？顺便看看你的栅栏。', sit: '栅栏松了，我给你钉一钉。' },
    kite: { go: '放风筝？我小时候自己扎过一个。', sit: '飞得稳。骨架扎得结实，就稳。' },
    stars: { go: '看星星？好，山里的星星最多。', sit: '嗯……星星不吵，挺好。' },
  },
  sheep: {
    fav: 'soak', favLine: '咩~每个礼拜天我都来泡，有你陪着，更放松了。',
    soak: { go: '咩~泡温泉对身体好，走吧！', sit: '咩……水温刚好，别泡超过二十分钟哦。' },
    movie: { go: '看电影？好，记得让眼睛歇歇哦。', sit: '咩，别离屏幕太近，对眼睛不好。' },
    soccer: { go: '踢球？好呀，先做热身运动，咩。', sit: '跑之前拉拉腿，别抽筋哦。' },
    cafe: { go: '咩~你请客？那我要一杯温牛奶。', sit: '少放点糖，咩，喝多了牙疼。' },
    read: { go: '看书好，咩，光线要够亮哦。', sit: '坐直一点，看书别驼背，咩。' },
    ducks: { go: '咩~喂鸭子，湖边空气也好。', sit: '面包别喂太多，鸭子也会吃撑的。' },
    garden: { go: '种菜？好，晒晒太阳对骨头好。', sit: '咩，干完活记得洗手哦。' },
    kite: { go: '放风筝呀？跑一跑，出出汗，咩。', sit: '仰头看久了脖子酸，歇一歇哦。' },
    stars: { go: '看星星？好，但不许熬太晚，咩。', sit: '星星真美……十点前要回家哦。' },
  },
  owl: {
    fav: 'stars', favLine: '小猪同学，以后你看到星星，就会想起今晚吧，咕咕。',
    soak: { go: '泡温泉？咕咕，放松也是一门功课。', sit: '咕……羽毛沾了泥，有点沉。' },
    movie: { go: '电影？好，咕咕，最好是纪录片。', sit: '咕咕，这段拍的是真的星云。' },
    soccer: { go: '踢球？咕……白天有点困，走吧。', sit: '球飞的弧线，其实是物理题，咕咕。' },
    cafe: { go: '你请？咕咕，那我要一杯浓咖啡。', sit: '喝点咖啡，晚上看星星正好。' },
    read: { go: '看书？咕咕，你选的地方真好。', sit: '这本讲宇宙的，你也看看。' },
    ducks: { go: '喂鸭子？咕，好，顺便观察观察。', sit: '你看，它们排队很有秩序，咕咕。' },
    garden: { go: '种菜？咕咕，这可是生物课。', sit: '种子发芽，要水、空气和温度。' },
    kite: { go: '放风筝？咕咕，我们来研究研究风。', sit: '风越大，风筝飞得越稳，咕咕。' },
    stars: { go: '咕咕！走，今晚的星星特别亮。', sit: '看，那是北斗七星，像个勺子。' },
  },
  turtle: {
    fav: 'stars', favLine: '星星走得比爷爷还慢……爷爷看了一辈子……今晚的最好看。',
    soak: { go: '泡温泉？……好，爷爷的壳都凉了。', sit: '暖和……爷爷能泡到明天……嘿嘿。' },
    movie: { go: '看电影？……爷爷走得慢，早点出门。', sit: '演得太快了……爷爷还没看清呢。' },
    soccer: { go: '踢球？……爷爷就站在门口吧。', sit: '踢过来……爷爷不动，也算扑住吧？' },
    cafe: { go: '喝东西？……好，爷爷要杯热的。', sit: '慢慢喝……烫……再等等。' },
    read: { go: '看书？……好，爷爷的眼镜带了。', sit: '这一页……爷爷看了好半天了。' },
    ducks: { go: '去湖边？……好，那是爷爷的老地方。', sit: '鸭子……一代一代的，爷爷都喂过。' },
    garden: { go: '去你家？……走到天黑也得去。', sit: '菜长得慢……慢的菜，好吃。' },
    kite: { go: '放风筝？……爷爷拿线，你去跑。', sit: '飞那么高……爷爷脖子都仰酸了。' },
    stars: { go: '看星星？……好，星星不着急。', sit: '这些星星……爷爷小时候就在了。' },
  },
  duck: {
    fav: 'ducks', favLine: '嘎……它们游得那么好，我在岸上看着就行。我会做饭嘛！',
    soak: { go: '嘎！泡温泉！水不深吧？不深吧？', sit: '嘎……站着就够得着底，好，舒服！' },
    movie: { go: '嘎！看电影！我带了自己炸的爆米花！', sit: '嘎！电影里那桌饭看着真香！' },
    soccer: { go: '嘎！踢球？我脚掌大，踢得远！', sit: '嘎嘎！看我的大脚板射门！' },
    cafe: { go: '嘎！你请客？我尝尝他们的手艺！', sit: '嘎……这蛋糕不错，就是糖多了点。' },
    read: { go: '嘎！看书？我找菜谱看！', sit: '嘎！这道菜我会，这道我也会！' },
    ducks: { go: '嘎！喂鸭子？都是我亲戚嘎！', sit: '嘎！吃慢点！别抢！都有份！' },
    garden: { go: '嘎！种菜！种好了我给你炒！', sit: '这菜苗嫩，嘎，长大了做汤最鲜！' },
    kite: { go: '嘎！放风筝！它比我飞得还高嘎！', sit: '嘎……飞那么高，本大厨羡慕了。' },
    stars: { go: '嘎！看星星？我带点夜宵！', sit: '那颗星星像个煎……嘎，不说那个字。' },
  },
  cow: {
    fav: 'garden', favLine: '哞，看你把菜园子种得这么好，大叔比自己丰收还高兴。',
    soak: { go: '泡温泉？好嘞，大叔忙了一早上。', sit: '哞……这泥跟地里的一样，暖和。' },
    movie: { go: '看电影？哞，大叔好多年没看了。', sit: '电影里也有牛！哞，比大花瘦。' },
    soccer: { go: '踢球？哞，大叔腿脚还利索！', sit: '娃，传过来，大叔一脚踢到田那头！' },
    cafe: { go: '娃请大叔喝东西？哞，好娃。', sit: '这牛奶……没大叔家的香，哞。' },
    read: { go: '看书？大叔认字少，你念给我听。', sit: '这本讲种地的？哞，写得在理。' },
    ducks: { go: '喂鸭子？好嘞，大叔带了把玉米。', sit: '哞，鸭子吃得欢，跟我家鸡一样。' },
    garden: { go: '去你菜园子？好嘞，大叔带锄头！', sit: '娃，土要松一松，菜才长得旺。' },
    kite: { go: '放风筝？哞，大叔给你扎一个。', sit: '风正好！娃，往高里放！' },
    stars: { go: '看星星？哞，乡下的星星可多了。', sit: '星星这么亮，明天准是好天，哞。' },
  },
  rabbit: {
    fav: 'kite', favLine: '我要在风筝上画小猪哥哥，让小猪哥哥也飞得高高的！',
    soak: { go: '泡温泉！小猪哥哥等等我！', sit: '暖暖的！我的耳朵都红啦！' },
    movie: { go: '看电影！我要坐小猪哥哥旁边！', sit: '小猪哥哥，有怪兽吗？我捂眼睛了。' },
    soccer: { go: '踢球！小猪哥哥教我！', sit: '我踢到了！我踢到了！你看你看！' },
    cafe: { go: '小猪哥哥请我喝东西！好耶！', sit: '我要胡萝卜汁！小猪哥哥尝一口？' },
    read: { go: '看书！小猪哥哥给我讲故事！', sit: '这本有兔子！是不是我？是不是？' },
    ducks: { go: '喂鸭子！我带了面包屑！', sit: '小鸭子来啦！它在吃我手里的！' },
    garden: { go: '去小猪哥哥家种菜！好耶！', sit: '我种胡萝卜！种一百根！' },
    kite: { go: '放风筝！放风筝！小猪哥哥快走！', sit: '飞起来啦！小猪哥哥你看，好高！' },
    stars: { go: '晚上出去玩！我跟兔婆婆说好了！', sit: '星星好多！我来数……一、二、三……' },
  },
  panda: {
    fav: 'ducks', favLine: '你看这些鸭子，不慌不忙的。日子就该这么过，孩子。',
    soak: { go: '泡温泉？好，老骨头该暖暖了。', sit: '泡着别说话，静一静，心就松了。' },
    movie: { go: '看电影？好，爷爷也赶回时髦。', sit: '这电影太快了，爷爷慢慢看。' },
    soccer: { go: '踢球？爷爷就在边上看你踢。', sit: '别光顾着跑，看准了再踢。' },
    cafe: { go: '你请爷爷？好，好，爷爷要杯茶。', sit: '咖啡馆也有茶，不错，不错。' },
    read: { go: '看书好，孩子，不急，慢慢看。', sit: '一页看懂了，比翻十页强。' },
    ducks: { go: '喂鸭子？好，爷爷带了点米。', sit: '撒慢一点，它们就不抢了。' },
    garden: { go: '去你家？好，看看你种了些什么。', sit: '菜跟竹子一样，急不得，慢慢长。' },
    kite: { go: '放风筝？好，爷爷来帮你放线。', sit: '线要一点一点放，风筝才稳。' },
    stars: { go: '看星星？好，爷爷今晚晚点睡。', sit: '星星看多了，烦心事就都小了。' },
  },
  hedgehog: {
    fav: 'garden', favLine: '那个……你的菜园子，我天天偷偷来看。今天能一起种，嘻嘻。',
    soak: { go: '那个……温泉？我的刺会不会扎到人……', sit: '我坐边上一点……嘻嘻，好暖和。' },
    movie: { go: '那个……好呀。我坐靠边的位置。', sit: '那个……我的刺没扎到你吧？' },
    soccer: { go: '踢球？那个……我会不会把球扎破呀。', sit: '我……我用脚尖碰一下，嘻嘻。' },
    cafe: { go: '那个……谢谢小猪哥哥请我。', sit: '我要苹果汁……嘻嘻，小口小口喝。' },
    read: { go: '那个……好呀，我想看讲花的书。', sit: '这朵花我家也有……嘻嘻，你看。' },
    ducks: { go: '那个……好呀，鸭子不怕我吧？', sit: '它们游过来了……嘻嘻，不怕我。' },
    garden: { go: '去你的菜园子？嘻嘻……好呀！', sit: '那个……我帮你拔草，我会很小心的。' },
    kite: { go: '那个……放风筝，我还没放过呢。', sit: '飞起来了……嘻嘻，飞得好高。' },
    stars: { go: '那个……晚上有你在，我就不怕黑。', sit: '那颗星星……亮亮的，像小雏菊。' },
  },
};

// What each says the first time they see the pig after he's grown all the way up (Lv.30)
const NPC_MAX_NEWS = {
  dog: '汪！你都长这么大啦！还记得你第一次来找活儿的样子吗？',
  fox: '乖孩子，长成大人啦……阿姨看着你一点点长大的，真好。',
  raccoon: '……长大了。也还是要好好洗手。恭喜你。',
  squirrel: '吱！你比我还高了！不公平！……嘿嘿，恭喜你！',
  cat: '哼，长大了嘛。……这身打扮还行，配得上你现在。',
  bear: '小家伙……不对，现在不能叫小家伙了。嘿嘿，真为你高兴。',
  sheep: '咩~长大啦！身体棒棒的，就是医生最开心的事。',
  owl: '咕咕，小猪同学，你学了这么多年，我都看在眼里。',
  turtle: '长大了……爷爷等这一天……也不算慢嘛……嘿嘿。',
  duck: '嘎！长大了！今天食堂给你加个大鸡腿！嘎嘎！',
  cow: '娃，长大啦！大叔这就给你挤一桶最好的牛奶！',
  rabbit: '小猪哥哥变成大人了！那……那你还会陪我玩吗？',
  panda: '孩子，长大了。慢慢走到今天，正好。',
  hedgehog: '那个……小猪哥哥，恭喜你。我……我给你种了一盆新的花。',
};

// What each says about the theme park's rides, the fireworks and the festivals' outings, in the
// same way (merged into NPC_OUTINGS_TALK below)
const NEW_OUTING_LINES = {
  dog: {
    ferris: { go: '摩天轮！汪，我要坐最高的那一格！', sit: '汪！我看见写字楼了，还有我的告示板！' },
    carousel: { go: '旋转木马？汪，我挑那匹跑得最快的！', sit: '汪汪！再快点！我要超过前面那匹！' },
    haunted: { go: '鬼屋？汪，我胆子大，我走前面！', sit: '汪？！那个白床单……是在冲我挥手吗？' },
    fireworks: { go: '看烟花！汪，我去占个最好的位置！', sit: '砰！汪！好响，我耳朵都竖起来了！' },
    newyear: { go: '逛庙会！汪，听说今天有舞狮！', sit: '汪！那头狮子冲我眨眼了，我也眨回去！' },
    lantern: { go: '猜灯谜？汪，我脑子转得慢，你帮我。', sit: '这个我猜到了！汪……不对，你再看看。' },
    dragon: { go: '赛龙舟！汪，我去岸边给他们加油！', sit: '划呀划呀！汪汪！红的那条快追上了！' },
    moon: { go: '赏月？汪，月饼我揣了两个！', sit: '月亮好圆，汪，像个大皮球。' },
    xmas: { go: '看圣诞树？汪，我围上围巾就走！', sit: '汪！下雪啦！我要在雪地上踩脚印！' },
  },
  fox: {
    ferris: { go: '摩天轮呀？好，阿姨陪你坐。', sit: '乖孩子，看，那个小屋顶就是阿姨的面包房。' },
    carousel: { go: '旋转木马？阿姨也坐，不许笑话阿姨。', sit: '哎哟，转得阿姨头晕，乖孩子抓稳了。' },
    haunted: { go: '鬼屋呀？别怕，阿姨走你旁边。', sit: '乖孩子，那是床单做的小幽灵，不吓人。' },
    fireworks: { go: '看烟花？阿姨带了小毯子，走吧。', sit: '好看是好看，乖孩子，捂着点耳朵。' },
    newyear: { go: '逛庙会喽！阿姨给你备了红包。', sit: '糖画想要哪个？阿姨给你挑条小龙。' },
    lantern: { go: '看花灯呀？阿姨煮了汤圆带着呢。', sit: '这盏兔子灯真俊，乖孩子，谜猜出来没？' },
    dragon: { go: '看龙舟？阿姨包了粽子，路上吃。', sit: '慢点吃，粽子黏，别噎着，乖孩子。' },
    moon: { go: '赏月呀？阿姨自己烤的月饼，走。', sit: '月亮圆圆的，乖孩子，阿姨心里也圆了。' },
    xmas: { go: '看圣诞树？阿姨烤了姜饼人给你。', sit: '树上的灯真亮，乖孩子，冷不冷？' },
  },
  raccoon: {
    ferris: { go: '摩天轮？……座位我先擦一擦。', sit: '从上面看，全城的屋顶都挺干净。' },
    carousel: { go: '旋转木马？好，我挑一匹白的。', sit: '这匹马的鬃毛刷得真亮，我喜欢。' },
    haunted: { go: '鬼屋？……里面肯定全是灰。', sit: '那么多蜘蛛网……我好想拿扫帚来。' },
    fireworks: { go: '看烟花？好，我站上风口。', sit: '好看。……烟别飘过来就更好了。' },
    newyear: { go: '庙会人多……我带了湿巾，走吧。', sit: '糖画好看，就是粘手。……给我张纸。' },
    lantern: { go: '看花灯？好，晚上的广场挺整齐。', sit: '这盏灯纸糊得平平整整，没一个褶。' },
    dragon: { go: '看龙舟？好，别站太靠水边。', sit: '水花溅过来了！……还好，湖水干净。' },
    moon: { go: '赏月？好，湖边的石凳我擦过了。', sit: '月亮倒在湖里，两个都那么干净。' },
    xmas: { go: '看圣诞树？好，雪是最干净的。', sit: '雪落你头上了，别动，我帮你拍掉。' },
  },
  squirrel: {
    ferris: { go: '吱！摩天轮！比我家的树还高吗？', sit: '吱吱！我看见我的树了！好小一棵！' },
    carousel: { go: '旋转木马！吱，我要骑那只大松鼠！', sit: '转呀转呀，吱，我的尾巴都飘起来啦！' },
    haunted: { go: '鬼屋？吱……我、我才不怕呢。', sit: '吱！那扇门吱呀响……不是我在叫！' },
    fireworks: { go: '烟花！吱吱，我要爬到最高的地方看！', sit: '吱！那一朵金灿灿的，像个大橡果！' },
    newyear: { go: '庙会！吱，听说有好多好玩的！', sit: '吱吱！风车！我想要那个会转的风车！' },
    lantern: { go: '花灯！吱，我想找一盏松鼠灯！', sit: '吱，这个谜底是松果！我猜对了吧？' },
    dragon: { go: '赛龙舟！吱，我要坐你肩膀上看！', sit: '吱吱！快划快划！鼓敲得我心砰砰跳！' },
    moon: { go: '赏月？吱，我带了一兜栗子！', sit: '月亮上有没有松鼠呀？吱，我想去。' },
    xmas: { go: '圣诞树！吱，我想爬上去摸那颗星！', sit: '吱，姜饼人分你一个，我先啃一小口。' },
  },
  cat: {
    ferris: { go: '摩天轮？……哼，我才不怕高。', sit: '风景还行。……你别晃，我的毛乱了。' },
    carousel: { go: '旋转木马？幼稚。……我坐那匹粉的。', sit: '哼，这匹马的鞍子配色还不错。' },
    haunted: { go: '鬼屋？哼，都是骗小孩的。', sit: '我没抓你胳膊。……是你抓的我。' },
    fireworks: { go: '看烟花？行，我换了件亮色的。', sit: '烟花照得我毛色挺好看吧？……别光看天。' },
    newyear: { go: '庙会？哼，我穿了新的红衣裳。', sit: '这对红灯笼挺喜庆，跟我衣服很配。' },
    lantern: { go: '猜灯谜？哼，我可比你猜得快。', sit: '这个太简单了。……好吧，你先说。' },
    dragon: { go: '看龙舟？离水远点，我不想湿毛。', sit: '哼，划得还挺整齐。……粽子分我一个。' },
    moon: { go: '赏月？行，我挑了条配月亮的围巾。', sit: '月亮挺圆的。……跟你的脸差不多。' },
    xmas: { go: '看圣诞树？我换了条红围巾，走吧。', sit: '灯挂得还行。……雪落你鼻子上了，哼。' },
  },
  bear: {
    ferris: { go: '摩天轮？好，嘿嘿，我坐一边不压歪。', sit: '看，那边就是我的店，房顶该修了。' },
    carousel: { go: '旋转木马？我这么大……坐得下吗？', sit: '嘿嘿，这木马雕得好，我也想做一个。' },
    haunted: { go: '鬼屋？好，小家伙，跟着我。', sit: '这门吱吱响，合页该上油了，嘿嘿。' },
    fireworks: { go: '看烟花？好，我扛个板凳去。', sit: '嗯……真亮。小家伙，坐我肩上看。' },
    newyear: { go: '逛庙会？好，嘿嘿，我想看舞狮。', sit: '这条糖画龙，嘿嘿，比木头雕的还细。' },
    lantern: { go: '看花灯？好，我自己也扎了一盏。', sit: '这灯谜……嗯，我想想，你别说。' },
    dragon: { go: '看龙舟？好，我看看船做得结不结实。', sit: '这船木头好，划得稳，嘿嘿。' },
    moon: { go: '赏月？好，我带了蜂蜜月饼。', sit: '嗯……月亮好，蜂蜜也好，嘿嘿。' },
    xmas: { go: '看圣诞树？好，我去瞧瞧是哪种松。', sit: '这棵松长得直，挂灯正合适。' },
  },
  sheep: {
    ferris: { go: '咩~摩天轮？好，怕高要跟我说哦。', sit: '咩，到顶了！深呼吸，别往下看太久。' },
    carousel: { go: '咩~旋转木马，慢慢转，不会晕的。', sit: '头晕了就盯着前面一个点，咩。' },
    haunted: { go: '鬼屋？咩……我、我是医生，不怕。', sit: '咩！心跳好快……没事，深呼吸。' },
    fireworks: { go: '看烟花？好，咩，晚上记得多穿点。', sit: '咩~真好看，站远一点，别被烟呛着。' },
    newyear: { go: '咩~逛庙会！人多，拉着我别走丢。', sit: '糖画少吃一点哦，咩，小心牙齿。' },
    lantern: { go: '看花灯？咩，汤圆吃两个就够啦。', sit: '汤圆糯，咩，慢慢嚼，别一口吞。' },
    dragon: { go: '咩~看龙舟，太阳大，戴好帽子。', sit: '粽子不好消化，咩，吃一个就好。' },
    moon: { go: '赏月？咩，湖边夜里凉，带件外套。', sit: '月饼甜，咩，咱俩一人一半。' },
    xmas: { go: '咩~看圣诞树，围巾帽子都戴好。', sit: '下雪了，咩，别张嘴接雪花哦。' },
  },
  owl: {
    ferris: { go: '摩天轮？咕咕，我平时就从这么高往下看。', sit: '你看，猪猪城的街道像棋盘，咕咕。' },
    carousel: { go: '旋转木马？咕，这是圆周运动的好例子。', sit: '外圈比内圈转得快，你感觉到了吗？' },
    haunted: { go: '鬼屋？咕咕，黑暗里我看得最清楚。', sit: '那只幽灵是床单，我看见他的脚了，咕。' },
    fireworks: { go: '咕咕！烟花，夜里我精神最好。', sit: '红色是锶，绿色是钡，咕咕，记住了？' },
    newyear: { go: '咕咕，逛庙会也是一堂民俗课。', sit: '舞狮要两个人配合，跟做题一样，咕。' },
    lantern: { go: '猜灯谜？咕咕，这可是我的拿手好戏。', sit: '这条谜我知道，但我想让你先猜。' },
    dragon: { go: '咕咕，看龙舟，顺便讲讲屈原。', sit: '桨要一起划，船才走得直，咕咕。' },
    moon: { go: '咕咕，今晚的月亮最圆，走吧。', sit: '月亮上暗暗的那些，是环形山，咕咕。' },
    xmas: { go: '看圣诞树？咕咕，树顶那颗星我要看看。', sit: '树顶的星星，没有天上的亮，咕咕。' },
  },
  turtle: {
    ferris: { go: '摩天轮？……爷爷走得慢，它也转得慢。', sit: '这么高……爷爷活了一辈子……头一回。' },
    carousel: { go: '旋转木马？……爷爷坐那个不动的车。', sit: '转得……刚刚好……跟爷爷一样慢。' },
    haunted: { go: '鬼屋？……爷爷走慢点，它们等不及。', sit: '那小幽灵……等爷爷走过去，都睡着了。' },
    fireworks: { go: '烟花？……好，爷爷今晚不早睡。', sit: '砰……亮了……又没了……嘿嘿。' },
    newyear: { go: '庙会？……好……爷爷年年都去。', sit: '舞狮……爷爷小时候……也看过这样的。' },
    lantern: { go: '猜灯谜？……爷爷慢慢猜……你别急。', sit: '这一条……爷爷想到明年……也能猜出来。' },
    dragon: { go: '看龙舟？……爷爷就在湖边……不用走远。', sit: '划得那么快……爷爷游一辈子……也赶不上。' },
    moon: { go: '赏月？……湖边……爷爷的老地方。', sit: '月饼……爷爷牙不好……掰一小块。' },
    xmas: { go: '圣诞树？……爷爷穿厚点……走吧。', sit: '雪……落在壳上……爷爷都没觉着。' },
  },
  duck: {
    ferris: { go: '嘎！摩天轮！我带了点心上去吃！', sit: '嘎！从上面看，鸭鸭湖像一口大锅！' },
    carousel: { go: '嘎！旋转木马！我要骑那只天鹅！', sit: '嘎嘎！转得跟我颠勺一样快！' },
    haunted: { go: '嘎？鬼屋？……本大厨走中间。', sit: '嘎！！那个白白的……吓我一跳！' },
    fireworks: { go: '嘎！看烟花，我带了夜宵！', sit: '嘎……像锅里的油花，滋啦滋啦的！' },
    newyear: { go: '嘎！庙会！小吃我要一样一样尝！', sit: '嘎！这糖画火候正好，一点没糊！' },
    lantern: { go: '嘎！闹元宵！我煮了一锅汤圆！', sit: '嘎，这个谜底是……饺子？不对吗？' },
    dragon: { go: '嘎！赛龙舟！就在我家门口划呢！', sit: '嘎！我包的粽子，咸的甜的都有！' },
    moon: { go: '嘎！赏月！月饼是本大厨烤的！', sit: '嘎……湖里有个月亮，我可不游过去捞。' },
    xmas: { go: '嘎！圣诞树！我烤了一盘姜饼人！', sit: '嘎！姜饼人的扣子是我拿糖点的！' },
  },
  cow: {
    ferris: { go: '摩天轮？哞，大叔这辈子没坐过。', sit: '哞！看，那块绿的是大叔的地！' },
    carousel: { go: '旋转木马？哞，大叔这把年纪也坐？', sit: '哞，转得比大花拉磨还快嘞。' },
    haunted: { go: '鬼屋？哞，大叔夜里下地都不怕。', sit: '哞，这小幽灵，比稻草人还瘦嘞。' },
    fireworks: { go: '看烟花？好嘞，大叔带个马扎。', sit: '哞！这一下亮得，跟白天似的！' },
    newyear: { go: '逛庙会？好嘞，大叔给娃包了红包！', sit: '哞，这舞狮舞得好，来年准丰收！' },
    lantern: { go: '看花灯？哞，娃，猜谜你来。', sit: '这谜底是玉米？哞，大叔蒙对了？' },
    dragon: { go: '看龙舟？好嘞，大叔带了一筐粽子。', sit: '哞！使劲划！跟大叔犁地一个劲儿！' },
    moon: { go: '赏月？哞，今年收成好，月亮也圆。', sit: '娃，吃块月饼，大叔家的芝麻馅。' },
    xmas: { go: '圣诞树？哞，大叔头回瞧这洋玩意。', sit: '这么大的树，哞，挂了这么多灯嘞。' },
  },
  rabbit: {
    ferris: { go: '摩天轮！小猪哥哥，我们坐最高的！', sit: '好高好高！小猪哥哥，我看见我家啦！' },
    carousel: { go: '旋转木马！我要坐小猪哥哥前面！', sit: '转起来啦！小猪哥哥，你跟上我！' },
    haunted: { go: '鬼屋……小猪哥哥要牵着我的手哦。', sit: '呜……有幽灵！小猪哥哥别松手！' },
    fireworks: { go: '看烟花！兔婆婆说可以晚点睡！', sit: '哇！好多颜色！小猪哥哥你看你看！' },
    newyear: { go: '过年啦！小猪哥哥，我们去庙会！', sit: '我收到红包啦！小猪哥哥你也有吗？' },
    lantern: { go: '看花灯！我要提兔子灯！', sit: '小猪哥哥，这个谜语我猜不出来……' },
    dragon: { go: '看龙舟！小猪哥哥抱我看！', sit: '咚咚咚！小猪哥哥，鼓好响呀！' },
    moon: { go: '赏月！月亮上有小兔子吗？', sit: '小猪哥哥，月亮上那个是不是我呀？' },
    xmas: { go: '圣诞树！小猪哥哥快走快走！', sit: '下雪啦！小猪哥哥，我们堆雪兔！' },
  },
  panda: {
    ferris: { go: '摩天轮？好，爷爷也上去看看。', sit: '孩子你看，竹林那边，就是咱们的小屋。' },
    carousel: { go: '旋转木马？好，爷爷坐边上陪你。', sit: '一圈一圈的，不急，跟打太极一样。' },
    haunted: { go: '鬼屋？好，爷爷走得稳，跟着我。', sit: '别慌，孩子，那小幽灵也是怕生的。' },
    fireworks: { go: '看烟花？好，爷爷今晚破个例。', sit: '开得快，谢得也快，看过就好。' },
    newyear: { go: '过年啦，孩子，跟爷爷逛逛庙会。', sit: '这红包拿着，爷爷祝你平平安安。' },
    lantern: { go: '看花灯？好，爷爷年轻时最爱猜谜。', sit: '汤圆趁热吃，孩子，团团圆圆。' },
    dragon: { go: '看龙舟？好，爷爷包了竹叶粽子。', sit: '划得齐，船才快，做人也一样。' },
    moon: { go: '赏月？好，爷爷泡了一壶茶。', sit: '月饼配茶，慢慢吃，日子就甜了。' },
    xmas: { go: '圣诞树？好，爷爷也凑个热闹。', sit: '雪落在竹叶上，跟这树一样好看。' },
  },
  hedgehog: {
    ferris: { go: '那个……摩天轮，会不会太高呀……', sit: '嘻嘻……从上面看，花园像一块花手帕。' },
    carousel: { go: '那个……我想坐那辆小马车。', sit: '嘻嘻，转得慢慢的，好舒服。' },
    haunted: { go: '那个……鬼屋，我会缩成一团的……', sit: '呜……小猪哥哥，我的刺都竖起来了！' },
    fireworks: { go: '那个……烟花会不会很响呀？', sit: '嘻嘻……像天上开了好多小花。' },
    newyear: { go: '那个……我穿了红衣服，好看吗？', sit: '嘻嘻……我想要那个小刺猬糖画。' },
    lantern: { go: '那个……我想看荷花灯。', sit: '那个……这个灯谜，我好像猜到了……' },
    dragon: { go: '那个……看龙舟，我站后面一点。', sit: '嘻嘻……粽子的叶子香香的。' },
    moon: { go: '那个……我带了苹果馅的月饼。', sit: '月亮照在湖上……嘻嘻，亮晶晶的。' },
    xmas: { go: '那个……我想看看树顶的星星。', sit: '雪花落在刺尖上了……嘻嘻，你看。' },
  },
};
for (const id of Object.keys(NEW_OUTING_LINES)) Object.assign(NPC_OUTINGS_TALK[id], NEW_OUTING_LINES[id]);

// ---------- festivals ----------
// invite: in the days before, asking the pig along; day: their greeting on the day; gift: handing
// him that festival's food
const NPC_FESTIVAL_TALK = {
  dog: {
    newyear: { invite: '汪！春节快到了，庙会那天中心广场见，我带你逛！', day: '汪汪！过年好！新的一年也要一起踢球哦！', gift: '汪！这饺子是我自己包的，丑是丑了点，香着呢！' },
    lantern: { invite: '元宵节就要到了，晚上去中心广场猜灯谜吧，汪！', day: '汪！元宵节快乐！今晚的花灯我已经看了三圈啦！', gift: '给你一碗汤圆，汪，我挑的全是芝麻馅的！' },
    dragon: { invite: '端午快到了！鸭鸭湖要赛龙舟，一起去喊加油，汪！', day: '汪！端午好！我嗓子都准备好了，加油加油！', gift: '粽子！食堂排了好长的队才买到，给你，汪。' },
    moon: { invite: '中秋就要到了，晚上去鸭鸭湖边赏月吧，汪？', day: '汪，中秋快乐！今晚的月亮肯定又大又圆！', gift: '月饼给你，汪！我掰开看过了，有蛋黄的！' },
    xmas: { invite: '汪！圣诞节快到了，晚上去中心广场看大圣诞树吧！', day: '汪！圣诞快乐！我的围巾是红的，像不像圣诞老人？', gift: '姜饼人给你！我忍着没先咬它的头，汪。' },
  },
  fox: {
    newyear: { invite: '乖孩子，春节快到了，庙会那天跟阿姨去中心广场逛逛？', day: '乖孩子，过年好！新的一年要长高高，吃饱饱。', gift: '阿姨包的饺子，皮是早上现擀的，趁热吃。' },
    lantern: { invite: '元宵节就要到了，晚上陪阿姨去中心广场看花灯好不好？', day: '元宵节快乐，乖孩子。晚上冷，出门多穿点。', gift: '阿姨搓的汤圆，红豆馅的，甜甜的，你爱吃。' },
    dragon: { invite: '端午快到了，鸭鸭湖赛龙舟，阿姨带上点心去看，你也来？', day: '端午安康，乖孩子。今天湖边人多，别挤着。', gift: '阿姨包的粽子，里头放了红枣，小心别烫着。' },
    moon: { invite: '中秋就要到了，晚上来鸭鸭湖边，阿姨陪你赏月。', day: '中秋快乐，乖孩子。晚上湖边凉，阿姨给你带件外套。', gift: '阿姨烤的月饼，莲蓉的，比外面卖的少放了糖。' },
    xmas: { invite: '圣诞节快到了，晚上跟阿姨去中心广场看大圣诞树吧。', day: '圣诞快乐，乖孩子。阿姨今天烤了一整天，满手都是糖。', gift: '姜饼人，阿姨一个一个画的笑脸，这个最像你。' },
  },
  raccoon: {
    newyear: { invite: '春节快到了。庙会在中心广场……人多，你牵着我走。', day: '过年好。我把家里擦了三遍，今年干干净净地开始。', gift: '饺子，我包的。手洗了五遍才和的面，放心吃。' },
    lantern: { invite: '元宵节快到了。晚上去中心广场看花灯？我带湿巾。', day: '元宵节快乐。花灯我擦不到，不过看着挺干净的。', gift: '汤圆，白白圆圆的，跟泡泡一样。给你。' },
    dragon: { invite: '端午快到了，鸭鸭湖要划龙舟。我们站远点看，水会溅。', day: '端午好。湖水被桨搅浑了……算了，今天热闹嘛。', gift: '粽子，粽叶我一片一片洗过的。剥开记得擦手。' },
    moon: { invite: '中秋快到了。晚上去鸭鸭湖赏月吧，湖边我熟。', day: '中秋快乐。今晚天上一点灰都没有，月亮会很亮。', gift: '月饼，包装纸我没拆，干干净净的，给你。' },
    xmas: { invite: '圣诞节快到了。中心广场的大圣诞树，晚上一起去看吧。', day: '圣诞快乐。你帽子上有雪……别动，我给你掸掉。', gift: '姜饼人，我用小盒子装好了，碎渣不会掉出来。' },
  },
  squirrel: {
    newyear: { invite: '吱！春节快到啦，中心广场有庙会，我们一起去逛！', day: '吱吱！过年好！我口袋里塞满了瓜子，分你！', gift: '饺子给你！我偷偷在一个里面包了颗松子，吱。' },
    lantern: { invite: '元宵节快到了！晚上中心广场猜灯谜，你帮我猜，吱！', day: '吱！元宵节快乐！我提了个松果花灯，好看吧？', gift: '汤圆！我挑的花生馅，跟松子一样香，吱。' },
    dragon: { invite: '吱吱！端午快到了，鸭鸭湖赛龙舟，我们去占前排！', day: '吱！端午好！我爬到树上看龙舟，看得最清楚！', gift: '粽子给你！好大一个，我抱都抱不动，吱。' },
    moon: { invite: '中秋快到了，晚上去鸭鸭湖看月亮好不好？吱。', day: '吱！中秋快乐！今晚的月亮好圆，像个大玉米饼！', gift: '月饼！我藏了好几个在树洞里，这个最大的给你。' },
    xmas: { invite: '吱！圣诞节快到了，晚上去中心广场看大圣诞树！', day: '吱吱！圣诞快乐！树上的小铃铛，我好想摘一个。', gift: '姜饼人！它的扣子是我用糖豆按上去的，吱。' },
  },
  cat: {
    newyear: { invite: '春节快到了。庙会在中心广场，你……要不要一起逛？', day: '过年好。新衣服我穿上了，红的。……好看吗？', gift: '饺子。我妈妈的方子，别人我可不给。哼。' },
    lantern: { invite: '元宵节就要到了。中心广场的花灯，你陪我去看。', day: '元宵节快乐。灯谜我全猜出来了，哼，不难。', gift: '汤圆。黑芝麻的，别吃到嘴角上，不好看。' },
    dragon: { invite: '端午快到了，鸭鸭湖要赛龙舟。……我想去看，你也来。', day: '端午好。湖边太晒了，我带了伞，你可以站进来。', gift: '粽子。我自己包的，绳子系的是蝴蝶结。哼。' },
    moon: { invite: '中秋快到了。晚上去鸭鸭湖赏月，我换身好看的等你。', day: '中秋快乐。月光下毛色最好看，你看我的。', gift: '月饼，盒子是我挑的。……里面也挺好吃的。' },
    xmas: { invite: '圣诞节快到了，中心广场要点大树。晚上……我在那儿等你。', day: '圣诞快乐。这条红围巾是新的，别碰。……好吧，摸一下。', gift: '姜饼人。我给它画了条围巾，跟我的一样。哼。' },
  },
  bear: {
    newyear: { invite: '春节快到了，小家伙。庙会在中心广场，我带你去。', day: '过年好，小家伙。嘿嘿，今年也结结实实的。', gift: '饺子，我包的。个儿大，一个顶三个。' },
    lantern: { invite: '元宵节快到了。晚上中心广场挂花灯，我扎了一盏，去看。', day: '元宵节快乐。广场那盏木头灯笼，是我做的，嘿嘿。', gift: '汤圆。我往里面加了蜂蜜，嘿嘿，甜。' },
    dragon: { invite: '端午快到了。鸭鸭湖赛龙舟，那条船是我修的，一起去看。', day: '端午好。今天划船的，力气都不小，嘿嘿。', gift: '粽子，给你。蘸着蜂蜜吃，最好。' },
    moon: { invite: '中秋快到了。晚上去鸭鸭湖赏月，我搬张长椅过去。', day: '中秋快乐，小家伙。月亮圆，日子也圆。', gift: '月饼，牛大叔那儿买的。我……先尝了一口，嘿嘿。' },
    xmas: { invite: '圣诞节快到了。中心广场的圣诞树我帮着搭的，晚上去看。', day: '圣诞快乐，小家伙。那棵树，站得稳稳的。', gift: '姜饼人，给你。我还刻了个木头的，那个不能吃。' },
  },
  sheep: {
    newyear: { invite: '咩~春节快到了，中心广场有庙会，一起去走走吧。', day: '咩~过年好！新的一年，身体健健康康的。', gift: '饺子，我包的白菜馅，清淡又有营养，咩。' },
    lantern: { invite: '元宵节就要到了，晚上去中心广场看花灯吧，记得穿暖和。', day: '咩~元宵节快乐！猜灯谜动脑子，对身体也好。', gift: '汤圆给你。糯米不好消化，一次吃三个就够了哦。' },
    dragon: { invite: '端午快到了，鸭鸭湖赛龙舟，咩，我们去看，戴上帽子。', day: '端午安康，咩~今天太阳大，要多喝水。', gift: '粽子给你，咩。我包的是杂粮的，健康。' },
    moon: { invite: '咩~中秋快到了，晚上去鸭鸭湖边赏月好不好？', day: '中秋快乐，咩~赏完月早点回家睡觉哦。', gift: '月饼给你。挺甜的，切成小块慢慢吃，咩。' },
    xmas: { invite: '咩~圣诞节快到了，晚上一起去中心广场看大圣诞树吧。', day: '圣诞快乐，咩~天冷了，围巾要围好。', gift: '姜饼人给你，咩。吃完记得刷牙哦。' },
  },
  owl: {
    newyear: { invite: '咕咕，春节快到了。庙会在中心广场，我们去看看民俗。', day: '咕咕，小猪同学，新年好！又长一岁，又多学一年。', gift: '饺子。我对着书学包的，褶子一共十八个，咕咕。' },
    lantern: { invite: '元宵节快到了，晚上中心广场有灯谜，咕咕，来考考你。', day: '咕咕，元宵节快乐。今晚的灯谜，有好几条是我出的。', gift: '汤圆给你。北方叫元宵，南方叫汤圆，咕咕。' },
    dragon: { invite: '端午快到了，鸭鸭湖赛龙舟。咕……白天我也会去的。', day: '咕……端午好。今天起得早，龙舟可不能错过。', gift: '粽子给你。端午吃粽子，是为了纪念一位诗人，咕咕。' },
    moon: { invite: '咕咕，中秋快到了，晚上去鸭鸭湖赏月，我带望远镜。', day: '咕咕，中秋快乐。今晚的月亮，是一年里最圆的。', gift: '月饼给你，小猪同学。边吃边看月亮，咕咕。' },
    xmas: { invite: '圣诞节快到了，咕咕，晚上中心广场点圣诞树，一起去。', day: '咕咕，圣诞快乐。树顶那颗星，比天上的还亮。', gift: '姜饼人给你。我数过了，它有三颗扣子，咕咕。' },
  },
  turtle: {
    newyear: { invite: '春节……快到了……庙会在中心广场……爷爷早点出门。', day: '过年好……嘿嘿……爷爷的壳上又多了一圈纹。', gift: '饺子……爷爷包了一上午……就包了这几个。' },
    lantern: { invite: '元宵……就要到了……晚上去中心广场……看花灯吧。', day: '元宵节好……灯谜嘛……爷爷慢慢猜。', gift: '汤圆……慢慢吃……别噎着……嘿嘿。' },
    dragon: { invite: '端午……快到了……鸭鸭湖赛龙舟……跟爷爷去看。', day: '端午好……那龙舟……划得比爷爷快多啦。', gift: '粽子……老熊猫包的……爷爷偷偷多拿了一个。' },
    moon: { invite: '中秋……就要到了……晚上来鸭鸭湖……陪爷爷赏月。', day: '中秋好……这月亮……爷爷看了一辈子……还是好看。', gift: '月饼……爷爷留了一年……不，昨天买的……嘿嘿。' },
    xmas: { invite: '圣诞……快到了……中心广场的大树……晚上去看看？', day: '圣诞快乐……年轻人的节……爷爷也凑个热闹。', gift: '姜饼人……它跑得比爷爷还快……嘿嘿，给你。' },
  },
  duck: {
    newyear: { invite: '嘎！春节快到了！中心广场庙会，本大厨要摆摊，来！', day: '嘎嘎！过年好！今年食堂也管饱！', gift: '饺子！本大厨包了一百个，嘎！先给你一盘！' },
    lantern: { invite: '嘎！元宵节快到了！晚上中心广场猜灯谜，猜完吃夜宵！', day: '嘎！元宵节快乐！灯谜我一个都没猜中，嘎……', gift: '汤圆！刚出锅的，嘎，烫嘴！吹一吹再吃！' },
    dragon: { invite: '嘎！端午快到了！龙舟赛在鸭鸭湖，就在我家门口！', day: '嘎嘎！端午好！龙舟从我船边划过去啦！', gift: '粽子！本大厨包的肉粽，嘎！一口一个香！' },
    moon: { invite: '嘎！中秋快到了！晚上来鸭鸭湖赏月，我在船上等你！', day: '嘎！中秋快乐！月亮映在湖里，跟大饼一样圆！', gift: '月饼！本大厨烤的五仁馅，嘎，谁说五仁不好吃！' },
    xmas: { invite: '嘎！圣诞节快到了！晚上中心广场点大树，一起去！', day: '嘎嘎！圣诞快乐！今天食堂有烤南瓜！', gift: '姜饼人！嘎！我烤的，姜放得足，吃了暖和！' },
  },
  cow: {
    newyear: { invite: '哞，春节快到了，娃，庙会那天来中心广场，大叔带你逛。', day: '哞！过年好！娃又大一岁啦。', gift: '饺子，大叔家自己种的白菜包的，香嘞。' },
    lantern: { invite: '元宵节快到了，娃，晚上去中心广场看花灯，大叔也去。', day: '哞~元宵节好！今晚的灯，跟田里的萤火虫一样多。', gift: '汤圆，大叔家糯米磨的粉，娃尝尝，糯嘞。' },
    dragon: { invite: '端午快到了，鸭鸭湖赛龙舟，娃，跟大叔去看热闹。', day: '哞！端午好！大叔一早割了艾草挂门上了。', gift: '粽子，大叔用自家的米包的，娃拿着。' },
    moon: { invite: '哞，中秋快到了，晚上到鸭鸭湖边，大叔陪你赏月。', day: '中秋好啊娃！今年收成好，月亮都格外圆，哞。', gift: '月饼，大叔托狐狸阿姨烤的，馅是自家的南瓜。' },
    xmas: { invite: '哞，听说圣诞节快到了，中心广场点大树，娃一起去看？', day: '哞，圣诞快乐！大叔给大花也戴了顶红帽子。', gift: '姜饼人，大叔头回买这洋玩意儿，娃尝尝。' },
  },
  rabbit: {
    newyear: { invite: '小猪哥哥！春节快到了！庙会在中心广场，一起去嘛！', day: '小猪哥哥过年好！我穿红衣服啦！你看你看！', gift: '饺子！兔婆婆包的，胡萝卜馅的，给小猪哥哥！' },
    lantern: { invite: '小猪哥哥，元宵节快到了！晚上去中心广场看花灯好不好？', day: '元宵节快乐！我的小兔子灯会发光！小猪哥哥你看！', gift: '汤圆！我自己搓的！有一个是歪的，嘻嘻。' },
    dragon: { invite: '小猪哥哥，端午快到了！鸭鸭湖有龙舟，带我去看嘛！', day: '小猪哥哥端午好！兔婆婆给我戴了香包，香香的！', gift: '粽子！兔婆婆包的，小小的，跟我一样小！' },
    moon: { invite: '小猪哥哥，中秋快到了！晚上去鸭鸭湖看月亮，我要去！', day: '中秋快乐！月亮上有兔子！是不是我呀？', gift: '月饼！我在上面按了个小兔子印，给小猪哥哥！' },
    xmas: { invite: '小猪哥哥！圣诞节快到了！中心广场的大树会发光！一起去！', day: '圣诞快乐！圣诞老人会来吗？我袜子挂好了！', gift: '姜饼人！我给它画了胡萝卜鼻子，给小猪哥哥！' },
  },
  panda: {
    newyear: { invite: '孩子，春节快到了。庙会在中心广场，跟爷爷去逛逛。', day: '过年好，孩子。来，爷爷给你写个「福」字。', gift: '爷爷包了一下午的饺子，笋丁肉馅，给你一盘。' },
    lantern: { invite: '元宵节快到了。晚上中心广场挂花灯，爷爷陪你去看。', day: '元宵节好，孩子。灯谜慢慢猜，猜不出也不打紧。', gift: '汤圆，爷爷亲手搓的，一碗团团圆圆。' },
    dragon: { invite: '端午快到了，鸭鸭湖赛龙舟，孩子，爷爷带你去看。', day: '端午安康，孩子。来，爷爷给你系根五彩绳。', gift: '粽子，爷爷用竹叶包的，清香。' },
    moon: { invite: '中秋快到了。晚上到鸭鸭湖边，陪爷爷赏赏月。', day: '中秋好，孩子。月圆人团圆，你来了，就圆了。', gift: '月饼，爷爷切好了，一块一块，配着茶吃。' },
    xmas: { invite: '圣诞节快到了。晚上中心广场的大树亮了，你陪爷爷去看看。', day: '圣诞快乐，孩子。洋节也好，热闹热闹。', gift: '姜饼人给你。爷爷配了杯竹叶茶，解解甜。' },
  },
  hedgehog: {
    newyear: { invite: '那个……春节快到了，庙会在中心广场，你……陪我去吗？', day: '那个……过年好。嘻嘻，我窗台上的水仙开了。', gift: '那个……饺子，我包的，捏成了小花的样子。嘻嘻。' },
    lantern: { invite: '那个……元宵节快到了，晚上中心广场有花灯，一起去好不好？', day: '元宵节快乐……那个，我做了一盏荷花灯。嘻嘻。', gift: '那个……汤圆，我放了桂花，香香的。' },
    dragon: { invite: '那个……端午快到了，鸭鸭湖赛龙舟，我想跟小猪哥哥去看。', day: '端午好……那个，我在门口插了艾草，嘻嘻。', gift: '那个……粽子，粽叶是我在湖边摘的。' },
    moon: { invite: '那个……中秋快到了，晚上去鸭鸭湖赏月，你会来吗？', day: '中秋快乐……月亮好亮，嘻嘻，我都不怕黑了。', gift: '那个……月饼，我在面包房挑的，苹果馅。嘻嘻。' },
    xmas: { invite: '那个……圣诞节快到了，晚上去中心广场看圣诞树好不好？', day: '那个……圣诞快乐。我给小仙人掌也挂了个铃铛。', gift: '那个……姜饼人，我给它画了一朵小花。嘻嘻。' },
  },
};
