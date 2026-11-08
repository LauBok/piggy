// Draws the piggy as SVG and switches its face, growth form, pose and accessories.
// PIG_SVG / renderFace / applyForm are also used for the avatar in the home window.

const INK = '#4a2c38';

function eyeSvg(cx, cy, kind) {
  switch (kind) {
    case 'happy':
      return `<path class="line" d="M${cx - 7.5} ${cy + 2} Q${cx} ${cy - 7.5} ${cx + 7.5} ${cy + 2}"/>`;
    case 'closed':
      return `<path class="line" d="M${cx - 7.5} ${cy - 1} Q${cx} ${cy + 6} ${cx + 7.5} ${cy - 1}"/>`;
    case 'dizzy':
      return `<path class="line" d="M${cx - 5.5} ${cy - 5.5} L${cx + 5.5} ${cy + 5.5} M${cx + 5.5} ${cy - 5.5} L${cx - 5.5} ${cy + 5.5}"/>`;
    case 'surprised':
      return `<circle cx="${cx}" cy="${cy}" r="9" fill="#fff" stroke="${INK}" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="3.8" fill="${INK}"/>
        <circle cx="${cx + 1.3}" cy="${cy - 1.3}" r="1.1" fill="#fff"/>`;
    case 'tired':
      return `<path d="M${cx - 7.6} ${cy} A7.6 9 0 0 0 ${cx + 7.6} ${cy} Z" fill="${INK}"/>
        <path class="line" d="M${cx - 8.5} ${cy} L${cx + 8.5} ${cy}"/>`;
    case 'love':
      return `<path fill="#ff4d7e" d="M${cx} ${cy + 7.5} C${cx - 13} ${cy - 1} ${cx - 6.5} ${cy - 12} ${cx} ${cy - 4.5} C${cx + 6.5} ${cy - 12} ${cx + 13} ${cy - 1} ${cx} ${cy + 7.5}Z"/>
        <circle cx="${cx - 3.8}" cy="${cy - 3.2}" r="1.8" fill="#fff" opacity=".85"/>`;
    default:
      return `<ellipse cx="${cx}" cy="${cy}" rx="7.6" ry="9" fill="${INK}"/>
        <ellipse cx="${cx}" cy="${cy + 4.5}" rx="5" ry="3.2" fill="#a0607a" opacity=".55"/>
        <circle cx="${cx + 2.6}" cy="${cy - 3.4}" r="3.2" fill="#fff"/>
        <circle cx="${cx - 2.7}" cy="${cy + 3.4}" r="1.5" fill="#fff"/>
        <circle cx="${cx + 3.4}" cy="${cy + 2.4}" r=".9" fill="#fff" opacity=".8"/>`;
  }
}

const MOUTHS = {
  smile: '<path class="line thin" d="M73 97 Q76.5 101.5 80 97 Q83.5 101.5 87 97"/>',
  grin: `<path d="M72 95 Q80 108 88 95 Z" fill="#d9577f"/>
    <path d="M76 101.5 Q80 98.5 84 101.5 Q80 105 76 101.5 Z" fill="#ff9ab6"/>`,
  sad: '<path class="line" d="M74 101 Q80 95 86 101"/>',
  flat: '<path class="line" d="M75 98 L85 98"/>',
  open: '<ellipse cx="80" cy="99" rx="4.5" ry="5.5" fill="#d9577f"/>',
};

const BROWS = '<path class="line" d="M45 48 L62 54 M115 48 L98 54"/>';

const FACES = {
  normal: { eyes: 'normal', mouth: 'smile' },
  cheerful: { eyes: 'normal', mouth: 'grin' },
  happy: { eyes: 'happy', mouth: 'grin' },
  love: { eyes: 'love', mouth: 'grin' },
  sad: { eyes: 'normal', mouth: 'sad' },
  tired: { eyes: 'tired', mouth: 'flat' },
  sleep: { eyes: 'closed', mouth: 'flat' },
  dizzy: { eyes: 'dizzy', mouth: 'sad' },
  surprised: { eyes: 'surprised', mouth: 'open' },
  angry: { eyes: 'normal', mouth: 'flat', brows: true },
  eat: { eyes: 'happy', mouth: 'open' },
};

function renderFace(eyesEl, mouthEl, name) {
  const f = FACES[name];
  eyesEl.innerHTML = eyeSvg(58, 64, f.eyes) + eyeSvg(102, 64, f.eyes) + (f.brows ? BROWS : '');
  mouthEl.innerHTML = MOUTHS[f.mouth];
}

// Face shown for the pet's stats when nothing temporary overrides it
function moodFace(s, sleeping) {
  if (sleeping) return 'sleep';
  if (s.health < 20) return 'dizzy';
  if (s.mood < 30 || s.hunger < 20 || s.health < 40) return 'sad';
  if (s.energy < 20) return 'tired';
  if (s.mood > 75) return 'cheerful';
  return 'normal';
}

const ACCESSORIES = {
  study: `<path d="M62 28 L62 37 Q80 44 98 37 L98 28 Z" fill="#2f2f45"/>
    <path d="M42 24 L80 8 L118 24 L80 40 Z" fill="#41415e"/>
    <path d="M80 24 L110 28 L110 40" fill="none" stroke="#fcc419" stroke-width="2"/>
    <circle cx="110" cy="42" r="3.2" fill="#fcc419"/>`,
  work: `<path d="M46 34 Q48 6 80 6 Q112 6 114 34 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="1.5"/>
    <rect x="76" y="8" width="8" height="24" rx="3" fill="#fcc419"/>
    <rect x="38" y="31" width="84" height="7" rx="3.5" fill="#fab005"/>`,
  bath: `<g class="soap">
    <circle cx="34" cy="100" r="7"/><circle cx="128" cy="86" r="9"/><circle cx="50" cy="26" r="5"/>
    <circle cx="114" cy="30" r="6"/><circle cx="82" cy="12" r="8"/><circle cx="134" cy="122" r="5"/></g>`,
  icebag: `<ellipse cx="80" cy="24" rx="20" ry="8" fill="#a5d8ff" stroke="#74c0fc" stroke-width="1.5"/>
    <rect x="76" y="14" width="8" height="5" rx="2" fill="#74c0fc"/>`,
};

// Which activity/sickness accessory the pig shows right now
const accKeyFor = (s) => (s.activity && ACCESSORIES[s.activity.type] ? s.activity.type : s.health < 40 ? 'icebag' : null);

// ---------- outfits bought in the shop ----------

const WEAR_SVG = {
  bow: `<g transform="translate(107 24) rotate(18)">
      <path d="M0 0 L-16 -10 Q-21 0 -16 10 Z" fill="#ff6b9d"/><path d="M0 0 L16 -10 Q21 0 16 10 Z" fill="#ff6b9d"/>
      <path d="M-12 -5 L-5 -1 M12 -5 L5 -1" stroke="#fff" stroke-width="1.6" opacity=".6" stroke-linecap="round"/>
      <circle r="5" fill="#f03e83"/></g>`,
  flower: `<g transform="translate(52 30)" fill="#ffd6e7" stroke="#f783ac" stroke-width="1.2">
      <circle cx="0" cy="-6.5" r="6"/><circle cx="6.2" cy="-2" r="6"/><circle cx="3.8" cy="5.3" r="6"/>
      <circle cx="-3.8" cy="5.3" r="6"/><circle cx="-6.2" cy="-2" r="6"/>
      <circle r="4.2" fill="#ffd43b" stroke="#fab005"/></g>`,
  shades: `<g>
      <path d="M45 61 L33 56 M115 61 L127 56" stroke="#2b2b3a" stroke-width="3" stroke-linecap="round"/>
      <rect x="44" y="55" width="28" height="17" rx="8" fill="#2b2b3a"/><rect x="88" y="55" width="28" height="17" rx="8" fill="#2b2b3a"/>
      <path d="M72 61 Q80 57 88 61" stroke="#2b2b3a" stroke-width="3" fill="none"/>
      <path d="M50 60 L59 60 M94 60 L103 60" stroke="#fff" stroke-width="2.2" opacity=".55" stroke-linecap="round"/></g>`,
  tophat: `<g>
      <rect x="59" y="-6" width="42" height="32" rx="4" fill="#343a40"/>
      <rect x="59" y="16" width="42" height="7" fill="#e64980"/>
      <ellipse cx="80" cy="26" rx="36" ry="7" fill="#212529"/>
      <path d="M64 -2 L64 14" stroke="#fff" stroke-width="2.5" opacity=".15" stroke-linecap="round"/></g>`,
  // the Lv.29 prize: a top hat in gold, a pink band and a little star on it
  goldhat: `<g>
      <rect x="59" y="-6" width="42" height="32" rx="4" fill="#ffd43b" stroke="#f59f00" stroke-width="1.5"/>
      <rect x="59" y="16" width="42" height="7" fill="#f06595"/>
      <ellipse cx="80" cy="26" rx="36" ry="7" fill="#fcc419" stroke="#f59f00" stroke-width="1.5"/>
      <path d="M64 -2 L64 14" stroke="#fff" stroke-width="2.5" opacity=".55" stroke-linecap="round"/>
      <path d="M90 4 l1.6 3.4 l3.6 .4 l-2.7 2.4 l.8 3.6 l-3.3 -1.9 l-3.3 1.9 l.8 -3.6 l-2.7 -2.4 l3.6 -.4 z" fill="#fff" opacity=".9"/></g>`,
  cap: `<g>
      <path d="M48 36 Q50 6 80 6 Q110 6 112 36 Z" fill="#ff922b" stroke="#e8590c" stroke-width="1.5"/>
      <path d="M104 33 Q130 30 138 39 Q120 42 100 38 Z" fill="#e8590c"/>
      <path d="M80 7 L80 34" stroke="#ffa94d" stroke-width="2"/><circle cx="80" cy="7" r="3.2" fill="#e8590c"/></g>`,
  starclip: `<g transform="translate(108 28) rotate(12)">
      <path d="M0 -11 L3.2 -3.5 L11 -3.4 L4.8 1.6 L7 9.4 L0 4.8 L-7 9.4 L-4.8 1.6 L-11 -3.4 L-3.2 -3.5 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="-2" cy="-3" r="1.6" fill="#fff" opacity=".8"/></g>`,
  gradcap: `<g>
      <path d="M62 28 L62 37 Q80 44 98 37 L98 28 Z" fill="#2f2f45"/>
      <path d="M42 24 L80 8 L118 24 L80 40 Z" fill="#41415e"/>
      <path d="M80 24 L110 28 L110 40" fill="none" stroke="#ff6b6b" stroke-width="2"/>
      <circle cx="110" cy="42" r="3.2" fill="#ff6b6b"/></g>`,
  crown: `<g>
      <path d="M58 28 L60 6 L70 17 L80 1 L90 17 L100 6 L102 28 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="80" cy="19" r="3.4" fill="#ff6b6b"/><circle cx="67" cy="22" r="2.4" fill="#4dabf7"/><circle cx="93" cy="22" r="2.4" fill="#4dabf7"/></g>`,
};

// ---------- the salon: fur colour and hairstyle ----------

const HAIR_SVG = {
  bangs: '<path d="M38 52 Q40 22 80 20 Q120 22 122 52 Q112 40 100 46 Q90 36 80 44 Q70 36 60 46 Q48 40 38 52 Z" fill="#8c5a3c" stroke="#6b4129" stroke-width="1.5"/>',
  curls: [[50, 30], [64, 20], [80, 16], [96, 20], [110, 30], [58, 36], [102, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#d9a066" stroke="#a9744a" stroke-width="1.5"/>`).join(''),
  bun: '<circle cx="80" cy="12" r="14" fill="#6b4129" stroke="#4a2c1e" stroke-width="1.5"/><path d="M56 28 Q80 10 104 28" stroke="#6b4129" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="70" y="20" width="20" height="5" rx="2" fill="#ff6b9d"/>',
  mohawk: '<path d="M70 26 L66 2 L76 14 L80 -4 L84 14 L94 2 L90 26 Z" fill="#ff6b9d" stroke="#e64980" stroke-width="1.5" stroke-linejoin="round"/>',
};

// Puts the salon's look on a pig drawing: a colour class for the fur, and a hairstyle
function renderLook(root, look) {
  const color = look?.color || 'pink';
  const hair = look?.hair || '';
  const key = `${color}|${hair}`;
  if (root.dataset.look === key) return;
  root.dataset.look = key;
  for (const c of [...root.classList]) if (c.startsWith('fur-')) root.classList.remove(c);
  root.classList.add(`fur-${color}`);
  root.classList.toggle('has-hair', !!hair);
  const g = root.querySelector('#hair');
  if (g) g.innerHTML = hair ? HAIR_SVG[hair] : '';
}

// Draws what the pig wears. Head items stay off while a school cap, hard hat or ice bag is on;
// sunglasses replace the youth form's glasses.
function renderWear(root, wear, accKey) {
  const g = root.querySelector('#wear');
  const headId = wear?.head && !accKey ? wear.head : null;
  const faceId = wear?.face || null;
  const key = `${headId}|${faceId}`;
  if (g.dataset.key === key) return;
  g.dataset.key = key;
  g.innerHTML = (headId ? WEAR_SVG[headId] : '') + (faceId ? WEAR_SVG[faceId] : '');
  root.classList.toggle('wear-face', !!faceId);
}

// ---------- growth forms ----------

const OUTFIT = {
  bib: `<path d="M63 103 Q80 99 97 103 Q101 123 80 129 Q59 123 63 103 Z" fill="#fff" stroke="#ffb3c8" stroke-width="1.5"/>
    <path d="M80 121 C76 117 73 114 76 112 C78 111 80 113 80 114 C80 113 82 111 84 112 C87 114 84 117 80 121 Z" fill="#ff8fab"/>`,
  scarf: `<path d="M63 105 Q80 113 97 105 L95 111 Q80 118 65 111 Z" fill="#f03e3e"/>
    <path d="M78 112 L69 128 L75 130 L80 116 Z M82 112 L91 128 L85 130 L80 116 Z" fill="#e03131"/>
    <circle cx="80" cy="113" r="3.6" fill="#c92a2a"/>`,
  collar: `<path d="M65 104 L80 112 L71 121 Z M95 104 L80 112 L89 121 Z" fill="#fff" stroke="#d6c9de" stroke-width="1.2"/>`,
  tie: `<path d="M77 110 L83 110 L81.5 114 L85 128 L80 133 L75 128 L78.5 114 Z" fill="#4c6ef5"/>
    <path d="M76.5 118 L83.5 116 M76 124 L84 122" stroke="#91a7ff" stroke-width="1.5"/>`,
  bowtie: `<path d="M80 112 L67 104.5 Q65 112 67 119.5 Z M80 112 L93 104.5 Q95 112 93 119.5 Z" fill="#7048e8"/>
    <circle cx="80" cy="112" r="3.2" fill="#5f3dc4"/>`,
  glasses: `<g class="glasses"><g fill="rgba(255,255,255,.2)" stroke="#6b4b57" stroke-width="2.2">
      <circle cx="58" cy="64" r="12.5"/><circle cx="102" cy="64" r="12.5"/></g>
    <path d="M70.5 62 Q80 57 89.5 62 M45.5 62 L34 57 M114.5 62 L126 57" fill="none" stroke="#6b4b57" stroke-width="2.2" stroke-linecap="round"/></g>`,
  pacifier: `<g class="paci"><ellipse cx="80" cy="99" rx="10.5" ry="6.8" fill="#91d5ff" stroke="#4dabf7" stroke-width="1.5"/>
    <circle cx="80" cy="99" r="2.8" fill="#fff"/>
    <circle cx="80" cy="108.5" r="5" fill="none" stroke="#ffd43b" stroke-width="3"/></g>`,
};

const CART_BACK = `<path d="M24 102 C16 58 40 28 80 26 C70 40 66 70 68 102 Z" fill="url(#gCanopy)" stroke="#9775fa" stroke-width="1.5"/>
  <path d="M33 100 C27 66 44 42 70 34" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
  <path d="M24 102 Q30 96 36 102 Q42 96 48 102 Q54 96 60 102 Q64 97 68 102" fill="none" stroke="#9775fa" stroke-width="1.5"/>`;

const wheel = (cx) => `<g class="wheel"><circle cx="${cx}" cy="137" r="9.5" fill="#5f4b8b"/>
  <circle cx="${cx}" cy="137" r="6" fill="#e5dbff"/>
  <path d="M${cx} 131 L${cx} 143 M${cx - 6} 137 L${cx + 6} 137" stroke="#5f4b8b" stroke-width="1.6"/>
  <circle cx="${cx}" cy="137" r="2" fill="#5f4b8b"/></g>`;

const CART_FRONT = `<path d="M134 100 L150 64" stroke="#7d6aa8" stroke-width="4" stroke-linecap="round"/>
  <rect x="142" y="56" width="16" height="8" rx="4" fill="#7d6aa8" transform="rotate(-25 150 60)"/>
  <path d="M22 100 Q24 130 62 130 L100 130 Q138 130 140 100 Z" fill="url(#gCart)" stroke="#9775fa" stroke-width="1.5"/>
  <rect x="18" y="95" width="126" height="9" rx="4.5" fill="#fff" stroke="#b197fc" stroke-width="1.5"/>
  <path d="M81 124 C74 118 70 114 74 111 C77 109 80 112 81 113 C82 112 85 109 88 111 C92 114 88 118 81 124 Z" fill="#fff" opacity=".85"/>
  <circle cx="50" cy="114" r="3" fill="#fff" opacity=".6"/><circle cx="112" cy="114" r="3" fill="#fff" opacity=".6"/>
  <path d="M52 129 L46 137 M110 129 L116 137" stroke="#7d6aa8" stroke-width="3" stroke-linecap="round"/>
  ${wheel(46)}${wheel(116)}`;

// k = size, dy = vertical shift (the baby sits up inside its pram)
const FORM_LOOK = {
  baby: { k: 0.72, dy: -24, cart: true, extra: OUTFIT.pacifier },
  toddler: { k: 0.8, under: OUTFIT.bib },
  child: { k: 0.88, over: OUTFIT.scarf },
  teen: { k: 0.94, under: OUTFIT.collar, over: OUTFIT.tie },
  youth: { k: 1, under: OUTFIT.collar, face: OUTFIT.glasses },
  adult: { k: 1.04, over: OUTFIT.bowtie },
};

function applyForm(root, formId) {
  const look = FORM_LOOK[formId];
  const $ = (sel) => root.querySelector(sel);
  for (const id of Object.keys(FORM_LOOK)) root.classList.toggle(`form-${id}`, id === formId);
  $('#grow').setAttribute('transform', `translate(0 ${look.dy || 0}) translate(80 150) scale(${look.k}) translate(-80 -150)`);
  $('#cartBack').innerHTML = look.cart ? CART_BACK : '';
  $('#cartFront').innerHTML = look.cart ? CART_FRONT : '';
  $('#outfitUnder').innerHTML = look.under || '';
  $('#outfitOver').innerHTML = look.over || '';
  $('#faceAcc').innerHTML = (look.face || '') + (look.extra || '');
  $('#shadow').setAttribute('rx', look.cart ? 66 : Math.round(40 * look.k));
}

const OUTLINE = 'stroke="#f2a0b8" stroke-width="1.5"';

const PIG_SVG = `
<svg viewBox="0 0 160 150" width="160" height="150">
  <defs>
    <radialGradient id="gHead" cx="40%" cy="32%" r="75%">
      <stop offset="0" stop-color="#ffeaf1"/><stop offset=".6" stop-color="#ffcddc"/><stop offset="1" stop-color="#ffb3c9"/>
    </radialGradient>
    <radialGradient id="gBody" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffdfe9"/><stop offset="1" stop-color="#ffadc5"/>
    </radialGradient>
    <radialGradient id="gSnout" cx="45%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffd6e1"/><stop offset="1" stop-color="#ff9fbc"/>
    </radialGradient>
    <radialGradient id="gCheek">
      <stop offset="0" stop-color="#ff7aa2" stop-opacity=".8"/><stop offset="1" stop-color="#ff7aa2" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gCart" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e5dbff"/><stop offset="1" stop-color="#b197fc"/>
    </linearGradient>
    <linearGradient id="gCanopy" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d0bfff"/><stop offset="1" stop-color="#b197fc"/>
    </linearGradient>
  </defs>
  <ellipse id="shadow" cx="80" cy="145" rx="40" ry="5" fill="rgba(140,60,90,.16)"/>
  <g id="cartBack"></g>
  <g id="grow"><g class="pig"><g class="breathe">
    <path class="tail skin" d="M113 118 c10 -2 12 9 5 9 c-6 0 -4 -9 4 -10" fill="none" stroke="#f28fae" stroke-width="3" stroke-linecap="round"/>
    <ellipse class="skin" cx="80" cy="116" rx="36" ry="26" fill="url(#gBody)" ${OUTLINE}/>
    <ellipse cx="80" cy="123" rx="19" ry="12" fill="#fff2f6" opacity=".8"/>
    <g class="leg leg-a skin"><ellipse cx="63" cy="137" rx="9.5" ry="7.5" fill="#ffb5c9" ${OUTLINE}/></g>
    <g class="leg leg-b skin"><ellipse cx="97" cy="137" rx="9.5" ry="7.5" fill="#ffb5c9" ${OUTLINE}/></g>
    <g class="arm arm-l skin"><ellipse cx="47" cy="115" rx="7" ry="9" fill="#ffbccf" ${OUTLINE}/></g>
    <g class="arm arm-r skin"><ellipse cx="113" cy="115" rx="7" ry="9" fill="#ffbccf" ${OUTLINE}/></g>
    <g id="outfitUnder"></g>
    <g class="ear ear-l skin">
      <path d="M42 44 C30 30 28 14 34 10 C42 8 58 18 66 28 Z" fill="url(#gBody)" ${OUTLINE}/>
      <path d="M44 37 C37 28 36 19 39 16 C45 15 53 22 58 28 Z" fill="#ff9ab6"/>
    </g>
    <g class="ear ear-r skin">
      <path d="M118 44 C130 30 132 14 126 10 C118 8 102 18 94 28 Z" fill="url(#gBody)" ${OUTLINE}/>
      <path d="M116 37 C123 28 124 19 121 16 C115 15 107 22 102 28 Z" fill="#ff9ab6"/>
    </g>
    <ellipse class="skin" cx="80" cy="66" rx="50" ry="44" fill="url(#gHead)" ${OUTLINE}/>
    <g id="hair"></g>
    <path class="skin tuft" d="M77 23 q-3 -9 5 -10 q5 0 2 5" fill="none" stroke="#f2a0b8" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="43" cy="82" rx="13" ry="8" fill="url(#gCheek)"/>
    <ellipse cx="117" cy="82" rx="13" ry="8" fill="url(#gCheek)"/>
    <circle cx="39" cy="79" r="1.7" fill="#fff" opacity=".8"/><circle cx="113" cy="79" r="1.7" fill="#fff" opacity=".8"/>
    <g id="eyes"></g>
    <ellipse class="skin" cx="80" cy="84" rx="13.5" ry="9.5" fill="url(#gSnout)" stroke="#f08aa8" stroke-width="1.3"/>
    <ellipse cx="75" cy="84.5" rx="2.4" ry="3.5" fill="#c94f76"/>
    <ellipse cx="85" cy="84.5" rx="2.4" ry="3.5" fill="#c94f76"/>
    <ellipse cx="75.5" cy="79.5" rx="3.6" ry="1.4" fill="#fff" opacity=".65"/>
    <g id="mouth"></g>
    <g id="outfitOver"></g>
    <g id="faceAcc"></g>
    <g id="wear"></g>
    <g id="dirt" opacity="0" fill="#9c7b5b">
      <ellipse cx="60" cy="120" rx="6" ry="4"/><ellipse cx="100" cy="127" rx="5" ry="3.5"/>
      <circle cx="108" cy="44" r="3.5"/><circle cx="52" cy="52" r="2.5"/><circle cx="68" cy="38" r="2.2"/>
    </g>
    <g id="acc"></g>
  </g></g></g>
  <g id="cartFront"></g>
</svg>`;

const PetView = {
  init(wrap, mount) {
    this.wrap = wrap;
    mount.innerHTML = PIG_SVG;
    this.svg = mount.querySelector('svg');
    this.eyes = mount.querySelector('#eyes');
    this.mouth = mount.querySelector('#mouth');
    this.dirt = mount.querySelector('#dirt');
    this.acc = mount.querySelector('#acc');
    this.fxBox = document.getElementById('fx');
    this.prop = document.getElementById('prop');
    this.propUntil = 0;
    this.face = null;
    this.formId = null;
    this.accKey = null;
    this.override = null;
    this.setFace('normal');
    this.blinkLoop();
  },

  blinkLoop() {
    setTimeout(() => {
      if (FACES[this.face].eyes === 'normal') {
        this.eyes.classList.add('blink');
        setTimeout(() => this.eyes.classList.remove('blink'), 140);
      }
      this.blinkLoop();
    }, 2500 + Math.random() * 3000);
  },

  setFace(name) {
    if (name === this.face) return;
    this.face = name;
    renderFace(this.eyes, this.mouth, name);
  },

  // Show a face for a while, on top of whatever the stats say
  flash(face, ms) {
    this.override = { face, until: Date.now() + ms };
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.update(Game), ms + 20);
    this.setFace(face);
  },

  setPose(cls, on) {
    this.wrap.classList.toggle(cls, on);
  },

  // Mini mode shows only the face: crop the drawing to the head
  setMini(on) {
    this.svg.setAttribute('viewBox', on ? '18 2 124 108' : '0 0 160 150');
  },

  setFacing(dir) {
    this.svg.style.transform = dir < 0 ? 'scaleX(-1)' : '';
  },

  // Hold an item for a moment (food being eaten, a toy, soap…)
  showProp(text, cls, ms) {
    this.setProp(text, cls);
    this.propUntil = Date.now() + ms;
    clearTimeout(this.propTimer);
    this.propTimer = setTimeout(() => this.update(Game), ms + 20);
  },

  setProp(text, cls) {
    const p = this.prop;
    if (p.textContent === text && p.className === cls) return;
    p.className = '';
    void p.offsetWidth; // restart the CSS animation
    p.textContent = text;
    p.className = cls;
  },

  fx(text) {
    const el = document.createElement('div');
    el.className = 'fx-item';
    el.textContent = text;
    el.style.left = `${40 + Math.random() * 20}%`;
    this.fxBox.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  },

  update(game) {
    const s = game.s;
    const overriding = this.override && Date.now() < this.override.until;
    this.setFace(overriding ? this.override.face : moodFace(s, game.sleeping));

    const form = game.form.id;
    if (form !== this.formId) {
      this.formId = form;
      applyForm(this.wrap, form);
    }

    this.dirt.setAttribute('opacity', s.clean < 50 ? ((50 - s.clean) / 50).toFixed(2) : 0);
    this.setPose('sick', s.health < 40);
    this.setPose('sleeping', game.sleeping);

    const a = s.activity;
    const type = a?.type;
    this.setPose('studying', type === 'study' || (type === 'hobby' && a.id !== 'soccer'));
    this.setPose('working', type === 'work');
    this.setPose('dining', type === 'help' && a.id === 'meal');
    if (Date.now() >= this.propUntil) {
      if (type === 'study') this.setProp('📖', 'prop-study');
      else if (type === 'work') this.setProp(JOB_BY_ID[a.id].icon, 'prop-work');
      else if (type === 'help') this.setProp(a.id === 'meal' ? '🍱' : '🌡️', 'prop-study');
      else if (type === 'hobby') this.setProp(HOBBY_BY_ID[a.id].icon, a.id === 'soccer' ? 'prop-toy' : 'prop-study');
      else this.setProp('', '');
    }
    renderWear(this.wrap, s.wear, accKeyFor(s));
    renderLook(this.wrap, s.look);

    const accKey = accKeyFor(s);
    if (accKey !== this.accKey) {
      this.accKey = accKey;
      this.acc.innerHTML = accKey ? ACCESSORIES[accKey] : '';
    }
  },
};
