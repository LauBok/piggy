// Inside the pig's home, Stardew style: rooms seen from above with the back wall standing up,
// furniture drawn at real size, the pig walked around with WASD. Walk up to something and press
// E (or click it) to use it; the stairs go up and down, the front door goes back out to town.

const WALL_H = 120; // how tall the back wall of a room looks
const I_ZOOM = 1.08;
const I_SPEED = 170;
const I_PIG = 0.5; // pig size inside

// ---------- furniture drawings ----------
// Each one is drawn with its bottom middle at (0, 0), going up. w: width, d: how deep its
// footprint on the floor is (what the pig can't walk through), wall: hangs on the back wall.
// Every piece follows one projection (the room's): seen from the front and above, every
// horizontal surface is drawn at 0.6 of its real depth, every surface facing us at full height,
// nothing converges. Things standing on the floor show a top face above a front face. Light
// comes from the top left: tops are the base colour with a light edge, fronts darker, lips and
// legs darkest. One outline for everything: 2.5px, a darker shade of the fill.

const OL = (c) => `stroke="${darker(c, 0.45)}" stroke-width="2.5" stroke-linejoin="round"`;
const OL_IN = (c) => `stroke="${darker(c, 0.3)}" stroke-width="1.5" fill="none"`;

// A rounded-corner shape's path: only the outer corners are rounded (r), on the given sides
function rpath(x, y, w, h, r, top = true, bottom = true) {
  const rt = top ? r : 0;
  const rb = bottom ? r : 0;
  return `M${x} ${y + rt} Q${x} ${y} ${x + rt} ${y} H${x + w - rt} Q${x + w} ${y} ${x + w} ${y + rt} V${y + h - rb} Q${x + w} ${y + h} ${x + w - rb} ${y + h} H${x + rb} Q${x} ${y + h} ${x} ${y + h - rb} Z`;
}

// A block standing on the floor, bottom middle at (0, 0): a top face topD deep over a front face
// frontH tall, with a hard seam between them and a light line along the top's front edge.
// plinth: a dark strip at the bottom (a toe-kick or base).
function slab(w, topD, frontH, c, { y = 0, r = 3, plinth = 0, front } = {}) {
  const yTop = y - frontH - topD;
  const ySeam = y - frontH;
  const f = front || darker(c, 0.18);
  let svg = `<path d="${rpath(-w / 2, yTop, w, topD, r, true, false)}" fill="${c}" ${OL(c)}/>
    <path d="${rpath(-w / 2, ySeam, w, frontH, r, false, true)}" fill="${f}" ${OL(c)}/>
    <path d="M${-w / 2 + 3} ${ySeam - 2} H${w / 2 - 3}" stroke="${lighter(c, 0.4)}" stroke-width="2"/>`;
  if (plinth) svg += `<rect x="${-w / 2 + 3}" y="${y - plinth}" width="${w - 6}" height="${plinth - 1}" fill="${darker(c, 0.4)}"/>`;
  return svg;
}

// the older helper some decorations still use: a slab from a top colour and a front colour
const box = (w, h, top, front, depth = 18) => slab(w, depth, h - depth, top, { front, plinth: 6 });

const FURN_ART = {
  // a bed lying on the floor, head against the back wall: headboard standing up, the mattress's
  // top going back, the blanket draping over the front edge, the frame's front rail and stubby legs
  bed(it) {
    const look = {
      bed1: { frame: '#c08a5b', sheet: '#74c0fc' }, bed2: { frame: '#f783ac', sheet: '#ffc9de' }, bed3: { frame: '#e599f7', sheet: '#fff0f6', canopy: true },
      bed4: { frame: '#d0ebff', sheet: '#ffffff', cloud: true }, bed_bear: { frame: '#a9805b', sheet: '#ffe066', bear: true },
    }[it.id] || { frame: '#c08a5b', sheet: '#74c0fc' };
    const f = look.frame;
    const sh = look.sheet;
    const mat = darker('#ffffff', 0.05);
    let svg = '';
    if (look.canopy) {
      svg += `<path d="M-60 -250 V-110 M60 -250 V-110" stroke="${darker(f, 0.2)}" stroke-width="6"/>
        <path d="${rpath(-66, -262, 132, 16, 3, true, false)}" fill="${lighter(f, 0.2)}" ${OL(f)}/>
        <path d="M-66 -246 H66 V-226 Q50 -214 33 -226 Q16 -214 0 -226 Q-16 -214 -33 -226 Q-50 -214 -66 -226 Z" fill="${f}" ${OL(f)}/>`;
    }
    // headboard: posts with round caps, the panel facing us, its top seen from above
    svg += `<rect x="-66" y="-180" width="12" height="74" rx="3" fill="${darker(f, 0.1)}" ${OL(f)}/><rect x="54" y="-180" width="12" height="74" rx="3" fill="${darker(f, 0.1)}" ${OL(f)}/>
      <circle cx="-60" cy="-182" r="7" fill="${lighter(f, 0.2)}" ${OL(f)}/><circle cx="60" cy="-182" r="7" fill="${lighter(f, 0.2)}" ${OL(f)}/>
      <path d="${rpath(-54, -177, 108, 8, 3, true, false)}" fill="${lighter(f, 0.25)}" ${OL(f)}/>
      <rect x="-54" y="-169" width="108" height="50" fill="${f}" ${OL(f)}/>
      <path d="M-40 -160 H40 M-40 -132 H40" ${OL_IN(f)}/>`;
    if (look.bear) svg += `<circle cx="-30" cy="-178" r="11" fill="${f}" ${OL(f)}/><circle cx="30" cy="-178" r="11" fill="${f}" ${OL(f)}/><circle cx="-30" cy="-178" r="5" fill="${lighter(f, 0.3)}"/><circle cx="30" cy="-178" r="5" fill="${lighter(f, 0.3)}"/>`;
    // mattress top going back, pillows sitting on it
    svg += `<rect x="-54" y="-126" width="108" height="88" fill="${mat}" ${OL('#dee2e6')}/>
      <path d="M-46 -106 Q-46 -122 -26 -122 Q-4 -122 -4 -106 Q-4 -100 -25 -100 Q-46 -100 -46 -106 Z" fill="#fff" ${OL('#dee2e6')}/>
      <path d="M4 -106 Q4 -122 25 -122 Q46 -122 46 -106 Q46 -100 25 -100 Q4 -100 4 -106 Z" fill="#fff" ${OL('#dee2e6')}/>
      <path d="M-44 -103 Q-25 -99 -6 -103 M6 -103 Q25 -99 44 -103" stroke="#ced4da" stroke-width="3" fill="none"/>`;
    // turned-down sheet, blanket top, then the blanket draping down the front
    svg += `<rect x="-56" y="-98" width="112" height="8" fill="#fff" ${OL('#dee2e6')}/>
      <rect x="-58" y="-90" width="116" height="50" fill="${sh}" ${OL(sh)}/>
      <path d="M-30 -84 Q-22 -64 -32 -46 M26 -86 Q34 -66 24 -46" ${OL_IN(sh)}/>
      <path d="M-58 -40 H58 V-22 Q42 -16 29 -22 Q14 -16 0 -22 Q-14 -16 -29 -22 Q-42 -16 -58 -22 Z" fill="${darker(sh, 0.18)}" ${OL(sh)}/>`;
    if (look.cloud) svg += [-44, -15, 15, 44].map((x) => `<circle cx="${x}" cy="-26" r="13" fill="#fff" ${OL('#d0ebff')}/>`).join('');
    // frame front rail and legs
    svg += `<path d="${rpath(-62, -20, 124, 14, 3, false, true)}" fill="${darker(f, 0.18)}" ${OL(f)}/>
      <path d="M-59 -19 H59" stroke="${lighter(f, 0.35)}" stroke-width="2"/>
      <rect x="-58" y="-6" width="10" height="6" fill="${darker(f, 0.4)}"/><rect x="48" y="-6" width="10" height="6" fill="${darker(f, 0.4)}"/>`;
    return { w: 124, d: 120, svg };
  },

  // a bathtub: rim on top, the basin's inner back wall and water inside, a front wall, little feet
  tub(it) {
    if (it.id === 'tub3') {
      // a hot spring: a ring of stones round a pool, all on the floor
      const stones = [...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<ellipse cx="${Math.cos(a) * 72}" cy="${-46 + Math.sin(a) * 40}" rx="17" ry="11" fill="#ced4da" ${OL('#adb5bd')}/>`;
      });
      return { w: 160, d: 90, svg: `${stones.filter((_, i) => i >= 6).join('')}<ellipse cx="0" cy="-46" rx="62" ry="34" fill="#7cc4ea" ${OL('#4dabf7')}/>
        <ellipse cx="-10" cy="-54" rx="30" ry="10" fill="#a5d8ff" opacity=".7"/>${stones.filter((_, i) => i < 6).join('')}
        <g class="steam">${[-20, 0, 20].map((x) => `<path d="M${x} -62 q-6 -12 0 -24" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/>`).join('')}</g>` };
    }
    const white = '#f8f9fa';
    let svg = `<path d="${rpath(-65, -96, 130, 44, 18, true, false)}" fill="${white}" ${OL('#adb5bd')}/>
      <path d="${rpath(-57, -88, 114, 30, 12, true, true)}" fill="${darker(white, 0.3)}"/>
      <path d="${rpath(-57, -78, 114, 20, 10, false, true)}" fill="#a5d8ff"/>
      <path d="M-44 -70 q12 -5 24 0 t24 0 t24 0" stroke="#fff" stroke-width="2.5" fill="none"/>
      <path d="${rpath(-65, -52, 130, 44, 6, false, true)}" fill="${darker(white, 0.15)}" ${OL('#adb5bd')}/>
      <path d="M-62 -50 H62" stroke="#fff" stroke-width="2"/>
      <rect x="-56" y="-8" width="12" height="8" rx="2" fill="#ffd43b" ${OL('#fab005')}/><rect x="44" y="-8" width="12" height="8" rx="2" fill="#ffd43b" ${OL('#fab005')}/>
      <rect x="40" y="-108" width="8" height="14" rx="2" fill="#adb5bd" ${OL('#868e96')}/><path d="M44 -108 h-12" stroke="#868e96" stroke-width="4" stroke-linecap="round"/>`;
    if (it.id === 'tub2') svg += [-30, -5, 22].map((x, i) => `<circle cx="${x}" cy="${-82 - (i % 2) * 6}" r="${6 + (i % 2) * 3}" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/>`).join('');
    return { w: 130, d: 60, svg };
  },

  // a desk against the wall: the top, an apron, a drawer pedestal on one side, a leg on the other;
  // paper and a book lying on the top
  desk(it) {
    const c = '#d9a066';
    const w = it.id === 'desk1' ? 110 : 130;
    let svg = '';
    if (it.id === 'desk3') {
      // a bookshelf standing behind
      svg += `${slab(w + 10, 10, 104, '#a9805b', { y: -60 })}
        ${[0, 1].map((r) => [...Array(Math.floor((w - 4) / 15))].map((_, i) => `<rect x="${-w / 2 + 6 + i * 15}" y="${-160 + r * 46}" width="11" height="38" fill="${['#ff8787', '#74c0fc', '#ffd43b', '#8ce99a'][(i + r) % 4]}" ${OL('#adb5bd')}/>`).join('')).join('')}`;
    }
    svg += `<path d="${rpath(-w / 2, -82, w, 24, 3, true, false)}" fill="${c}" ${OL(c)}/>
      <rect x="${-w / 2}" y="-58" width="${w}" height="12" fill="${darker(c, 0.18)}" ${OL(c)}/>
      <path d="M${-w / 2 + 3} -60 H${w / 2 - 3}" stroke="${lighter(c, 0.4)}" stroke-width="2"/>
      <rect x="${-w / 2 + 4}" y="-46" width="${w - 8}" height="42" fill="${darker(c, 0.5)}"/>
      <rect x="${-w / 2}" y="-46" width="44" height="46" fill="${darker(c, 0.18)}" ${OL(c)}/>
      <path d="M${-w / 2} -24 h44" ${OL_IN(c)}/><rect x="${-w / 2 + 16}" y="-38" width="12" height="4" rx="2" fill="${darker(c, 0.45)}"/><rect x="${-w / 2 + 16}" y="-16" width="12" height="4" rx="2" fill="${darker(c, 0.45)}"/>
      <rect x="${w / 2 - 12}" y="-46" width="12" height="46" fill="${darker(c, 0.25)}" ${OL(c)}/>
      <path d="M-8 -78 l30 -2 l2 12 l-30 2 Z" fill="#fff" ${OL('#dee2e6')}/>
      <rect x="${w / 2 - 34}" y="-78" width="14" height="7" fill="#ff8787" ${OL('#fa5252')}/><rect x="${w / 2 - 34}" y="-71" width="14" height="6" fill="${darker('#ff8787', 0.2)}" ${OL('#fa5252')}/>`;
    if (it.id !== 'desk1') {
      svg += `<path d="M${-w / 2 + 16} -72 V-104 L${-w / 2 + 30} -112" stroke="#495057" stroke-width="3" fill="none"/>
        <path d="M${-w / 2 + 20} -118 L${-w / 2 + 44} -118 L${-w / 2 + 38} -106 L${-w / 2 + 26} -106 Z" fill="#ffd43b" ${OL('#fab005')}/>`;
    }
    return { w, d: 30, svg };
  },

  // a tall wardrobe: cornice on top, two doors with recessed panels, a dark plinth
  wardrobe() {
    const c = '#c08a5b';
    return { w: 104, d: 30, svg: `<path d="${rpath(-54, -164, 108, 14, 3, true, false)}" fill="${lighter(c, 0.2)}" ${OL(c)}/>
      <rect x="-52" y="-150" width="104" height="142" fill="${c}" ${OL(c)}/>
      <path d="M-50 -152 H50" stroke="${lighter(c, 0.45)}" stroke-width="2"/>
      <path d="M0 -150 V-8" stroke="${darker(c, 0.35)}" stroke-width="2"/>
      <rect x="-44" y="-140" width="36" height="56" rx="2" fill="${darker(c, 0.1)}" ${OL_IN(c)}/><rect x="8" y="-140" width="36" height="56" rx="2" fill="${darker(c, 0.1)}" ${OL_IN(c)}/>
      <rect x="-44" y="-74" width="36" height="56" rx="2" fill="${darker(c, 0.1)}" ${OL_IN(c)}/><rect x="8" y="-74" width="36" height="56" rx="2" fill="${darker(c, 0.1)}" ${OL_IN(c)}/>
      <circle cx="-7" cy="-80" r="3.5" fill="#ffd43b" ${OL('#fab005')}/><circle cx="7" cy="-80" r="3.5" fill="#ffd43b" ${OL('#fab005')}/>
      <rect x="-50" y="-8" width="100" height="8" fill="${darker(c, 0.4)}" ${OL(c)}/>` };
  },

  // a sofa: the backrest's top and face, the seat cushions' tops and front, the arms' tops and fronts
  sofa(it) {
    const c = { sofa1: '#ffa8a8', sofa2: '#a9805b', sofa3: '#b197fc', sofa_bear: '#d9a066' }[it.id] || '#ffa8a8';
    return { w: 150, d: 50, svg: `<path d="${rpath(-63, -92, 126, 12, 6, true, false)}" fill="${lighter(c, 0.15)}" ${OL(c)}/>
      <rect x="-63" y="-80" width="126" height="26" fill="${c}" ${OL(c)}/>
      <rect x="-51" y="-54" width="51" height="20" fill="${lighter(c, 0.1)}" ${OL(c)}/><rect x="0" y="-54" width="51" height="20" fill="${lighter(c, 0.1)}" ${OL(c)}/>
      <rect x="-51" y="-34" width="102" height="24" fill="${darker(c, 0.18)}" ${OL(c)}/><path d="M0 -34 V-10" ${OL_IN(c)}/>
      ${[-1, 1].map((k) => `<path d="${rpath(k < 0 ? -75 : 51, -66, 24, 12, 6, true, false)}" fill="${lighter(c, 0.15)}" ${OL(c)}/>
        <rect x="${k < 0 ? -75 : 51}" y="-54" width="24" height="46" fill="${darker(c, 0.12)}" ${OL(c)}/>`).join('')}
      <rect x="-70" y="-8" width="8" height="8" fill="${darker(c, 0.45)}"/><rect x="62" y="-8" width="8" height="8" fill="${darker(c, 0.45)}"/>` };
  },

  piano(it) {
    // the keys' top surface, white keys with black stubs along the back
    const keys = (x, y, w, d) => `<rect x="${x}" y="${y}" width="${w}" height="${d}" fill="#fff" ${OL('#adb5bd')}/>
      ${[...Array(Math.floor(w / 9) - 1)].map((_, i) => `<path d="M${x + 9 + i * 9} ${y} V${y + d}" stroke="#dee2e6" stroke-width="1"/>`).join('')}
      ${[...Array(Math.floor(w / 9) - 1)].map((_, i) => ([1, 2, 4, 5, 6].includes(i % 7) ? `<rect x="${x + 6 + i * 9}" y="${y}" width="6" height="${d * 0.6}" fill="#212529"/>` : '')).join('')}`;
    if (it.id === 'piano3') {
      // a grand piano: its big curved lid seen from above, keys at the front
      return { w: 170, d: 110, svg: `<path d="M-80 -160 H70 Q86 -160 86 -140 Q86 -100 50 -86 Q20 -74 20 -60 H-80 Z" fill="#343a40" ${OL('#212529')}/>
        <path d="M-74 -150 H64 Q76 -150 76 -138" stroke="#868e96" stroke-width="2" fill="none"/>
        <rect x="-80" y="-60" width="100" height="26" fill="#212529" ${OL('#212529')}/>
        ${keys(-78, -56, 96, 14)}<rect x="-80" y="-42" width="100" height="8" fill="#212529"/>
        <path d="M-74 -34 V0 M14 -34 V0 M70 -90 V-20" stroke="#212529" stroke-width="6"/>` };
    }
    if (it.id === 'piano2') {
      // an upright: lid on top, the body facing us, the keybed sticking out with the keys on top
      return { w: 130, d: 40, svg: `${slab(130, 16, 112, '#495057', { y: 0, plinth: 0 })}
        <rect x="-30" y="-100" width="60" height="26" rx="2" fill="#fff" ${OL('#dee2e6')}/><path d="M-22 -92 h44 M-22 -86 h44 M-22 -80 h30" stroke="#adb5bd"/>
        <rect x="-62" y="-60" width="124" height="16" fill="#343a40" ${OL('#212529')}/>${keys(-58, -58, 116, 13)}
        <rect x="-62" y="-44" width="124" height="7" fill="#212529"/>
        <rect x="-58" y="-36" width="10" height="30" fill="#343a40"/><rect x="48" y="-36" width="10" height="30" fill="#343a40"/>` };
    }
    // a keyboard on an X stand
    return { w: 110, d: 26, svg: `<path d="M-38 0 L28 -54 M38 0 L-28 -54" stroke="#868e96" stroke-width="5" stroke-linecap="round"/>
      <rect x="-56" y="-72" width="112" height="22" rx="2" fill="#343a40" ${OL('#212529')}/>${keys(-50, -70, 100, 14)}
      <rect x="-56" y="-56" width="112" height="7" fill="#212529"/>` };
  },

  easel(it) {
    const big = it.id === 'easel2';
    const cw = big ? 88 : 68;
    return { w: big ? 90 : 70, d: 26, svg: `<path d="M0 -130 L6 -6" stroke="${darker('#a9744a', 0.2)}" stroke-width="5"/>
      <path d="M-28 0 L0 -134 L28 0" stroke="#a9744a" stroke-width="6" fill="none" stroke-linejoin="round"/>
      <rect x="${-cw / 2 - 4}" y="-52" width="${cw + 8}" height="6" fill="#c08a5b" ${OL('#a9744a')}/>
      <rect x="${-cw / 2}" y="-122" width="${cw}" height="${big ? 70 : 56}" rx="2" fill="#fff" ${OL('#c08a5b')}/>
      <path d="M${-cw / 2 + 8} -76 q14 -26 30 -10 t24 -14" stroke="#74c0fc" stroke-width="5" fill="none"/><circle cx="10" cy="-102" r="8" fill="#ffd43b"/>
      ${big ? `<ellipse cx="46" cy="-8" rx="18" ry="9" fill="#fff4e6" ${OL('#c08a5b')}/><circle cx="40" cy="-9" r="3" fill="#ff6b6b"/><circle cx="50" cy="-6" r="3" fill="#4dabf7"/>` : ''}` };
  },

  kitchen(it) {
    const w = it.id === 'kitchen2' ? 240 : 170;
    const c = '#f1f3f5';
    return { w, d: 40, svg: `<rect x="${-w / 2}" y="-108" width="${w}" height="12" fill="#e7f5ff" ${OL('#ced4da')}/>
      <path d="${rpath(-w / 2, -96, w, 30, 3, true, false)}" fill="${c}" ${OL('#ced4da')}/>
      <path d="${rpath(-w / 2 + 14, -92, 58, 20, 4)}" fill="#a5d8ff" ${OL('#74c0fc')}/><path d="${rpath(-w / 2 + 14, -92, 58, 6, 3, true, false)}" fill="#74c0fc"/>
      ${[0, 1].map((i) => `<ellipse cx="${w / 2 - 70 + i * 36}" cy="-81" rx="12" ry="7" fill="#495057" ${OL('#212529')}/>`).join('')}
      <rect x="${-w / 2}" y="-66" width="${w}" height="58" fill="${darker(c, 0.12)}" ${OL('#ced4da')}/>
      <path d="M${-w / 2 + 3} -68 H${w / 2 - 3}" stroke="#fff" stroke-width="2"/>
      ${[...Array(Math.floor(w / 56))].map((_, i) => `<rect x="${-w / 2 + 8 + i * 56}" y="-60" width="48" height="46" rx="2" fill="#fff" ${OL_IN('#ced4da')}/><rect x="${-w / 2 + 28 + i * 56}" y="-40" width="8" height="3" rx="1.5" fill="#868e96"/>`).join('')}
      <rect x="${-w / 2 + 2}" y="-8" width="${w - 4}" height="8" fill="#868e96"/>` };
  },

  pot() {
    return { w: 70, d: 34, svg: `${slab(66, 14, 36, '#868e96', { plinth: 5 })}
      <ellipse cx="0" cy="-72" rx="26" ry="9" fill="#adb5bd" ${OL('#495057')}/><path d="M-26 -72 V-54 Q0 -46 26 -54 V-72" fill="#adb5bd" ${OL('#495057')}/>
      <ellipse cx="0" cy="-72" rx="20" ry="6" fill="#ffa94d"/>
      <g class="steam"><path d="M-8 -82 q-6 -12 0 -22 M8 -82 q-6 -12 0 -22" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/></g>` };
  },

  bubbler() {
    return { w: 56, d: 26, svg: `${slab(50, 14, 46, '#74c0fc', { plinth: 5 })}<circle cx="0" cy="-34" r="10" fill="#fff" ${OL('#4dabf7')}/>
      <g class="rise"><circle cx="-10" cy="-82" r="7" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/><circle cx="10" cy="-98" r="5" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/></g>` };
  },

  // decorations
  rug: () => ({ w: 0, d: 0, flat: true, svg: `<ellipse cx="0" cy="-66" rx="110" ry="66" fill="#ffc9de" ${OL('#f783ac')}/>
    <ellipse cx="0" cy="-66" rx="84" ry="48" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 8"/>` }),
  plant: () => ({ w: 46, d: 22, svg: `<path d="M-15 -38 L-12 0 H12 L15 -38 Z" fill="#e8590c" ${OL('#e8590c')}/>
    <rect x="-16" y="-42" width="32" height="8" rx="2" fill="#ff922b" ${OL('#e8590c')}/>
    <ellipse cx="0" cy="-42" rx="15" ry="5" fill="#6b4129"/>
    <circle cx="-12" cy="-58" r="15" fill="#69db7c" ${OL('#40c057')}/><circle cx="12" cy="-62" r="17" fill="#8ce99a" ${OL('#40c057')}/><circle cx="-2" cy="-80" r="14" fill="#69db7c" ${OL('#40c057')}/>
    <path d="M-20 -54 a14 8 0 0 0 26 4" fill="#40c057" opacity=".35"/>` }),
  aquarium: () => ({ w: 110, d: 40, svg: `${box(110, 110, '#8ecdf0', '#c08a5b', 14)}<rect x="-50" y="-100" width="100" height="56" rx="4" fill="#a5d8ff" stroke="#74c0fc" stroke-width="2"/>${emo(-18, -76, 18, '🐠')}${emo(20, -64, 14, '🐟')}` }),
  trophy: () => ({ w: 90, d: 36, svg: `${box(90, 130, '#a9805b', '#8c6239', 14)}<rect x="-38" y="-118" width="76" height="100" rx="3" fill="#fff4e6" opacity=".9"/>${emo(-16, -96, 18, '🏆')}${emo(16, -96, 16, '🥇')}${emo(0, -46, 18, '🏅')}` }),
  globe: () => ({ w: 50, d: 24, svg: `<path d="M-14 0 H14 M0 0 V-24" stroke="#8c6239" stroke-width="5"/>${emo(0, -46, 34, '🌍')}` }),
  treehouse: () => ({ w: 80, d: 40, svg: `<rect x="-6" y="-60" width="12" height="60" fill="#8c6239"/><circle cx="0" cy="-86" r="34" fill="#69db7c"/><rect x="-20" y="-80" width="40" height="28" fill="#d9a066" stroke="#8c6239"/><path d="M-26 -80 L0 -100 L26 -80 Z" fill="#e03131"/>` }),
  chesstable: () => ({ w: 80, d: 40, svg: `${box(80, 50, '#fff', '#c08a5b', 20)}${[...Array(4)].map((_, i) => [...Array(4)].map((__, j) => ((i + j) % 2 ? `<rect x="${-32 + i * 16}" y="${-50 + j * 5}" width="16" height="5" fill="#343a40"/>` : '')).join('')).join('')}` }),
  painting: () => ({ wall: true, svg: '<rect x="-40" y="-30" width="80" height="60" rx="3" fill="#fff" stroke="#c08a5b" stroke-width="6"/><path d="M-32 18 L-8 -6 L8 10 L20 0 L32 18 Z" fill="#69db7c"/><circle cx="16" cy="-12" r="8" fill="#ffd43b"/>' }),
  lamp: () => ({ wall: true, svg: '<path d="M0 -40 V-18" stroke="#868e96" stroke-width="2"/><ellipse cx="0" cy="0" rx="18" ry="22" fill="#ff6b6b" stroke="#c92a2a" stroke-width="2"/><rect x="-10" y="-24" width="20" height="5" fill="#ffd43b"/><rect x="-10" y="19" width="20" height="5" fill="#ffd43b"/>' }),
  stars: () => ({ wall: true, svg: `<rect x="-60" y="-36" width="120" height="72" rx="6" fill="#1c2541" stroke="#5c5f8f" stroke-width="4"/>${[[-40, -20], [-10, -8], [20, -24], [40, 10], [-30, 16], [8, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff3bf" class="twinkle"/>`).join('')}<path d="M18 4 a12 12 0 1 0 12 -14 a9 9 0 1 1 -12 14" fill="#ffd43b"/>` }),
};

// What each furniture group lets you do there
const FURN_USE = {
  bed: { label: (snap) => (snap.sleeping ? '起床' : '睡觉'), act: (snap) => (snap.sleeping ? ['wake'] : ['sleep']) },
  tub: { label: () => '洗澡', act: () => ['bath'] },
  piano: { label: () => '弹琴', act: () => ['hobby', 'piano'] },
  easel: { label: () => '画画', act: () => ['hobby', 'paint'] },
  wardrobe: { label: () => '换衣服', act: () => ['open', 'wardrobe'] },
  desk: { label: () => '看看学历', act: () => ['open', 'study'] },
  kitchen: { label: () => '吃点东西', act: () => ['bag'] },
};

// ---------- room layouts for each house ----------
// A floor: rooms ({ x, y, w, h, name, wall, floor }), doorways between rooms (rects), furniture
// spots ({ group or decor slot: [x, y] } with y the front edge), stairs and the front door.

const FLOOR_LOOKS = { wood: ['#e0b483', '#d4a574'], tile: ['#e9ecef', '#dee2e6'], warm: ['#f0c79a', '#e5b787'], night: ['#5c5f8f', '#4c4f7f'] };

// window: where the room's window is on its back wall (none: no window). diplomas: the stretch
// of wall [x1, x2] where the framed diplomas hang, kept clear of windows and tall furniture.
const HOUSE_LAYOUTS = [
  // 小猪窝: one cosy room
  [{
    rooms: [{ x: 0, y: 0, w: 680, h: 500, name: '小猪窝', wall: '#ffd6e2', floor: 'wood', window: 210 }],
    spots: { wardrobe: [90, 150], bed: [590, 246], desk: [400, 202], tub: [140, 400], bubbler: [250, 470], sofa: [470, 450], piano: [610, 400], easel: [640, 480] },
    decor: [[330, 340, 'floor'], [40, 480, 'floor'], [470, 300, 'floor']],
    diplomas: [262, 526],
    door: [340, 500],
  }],
  // 公寓: bedroom and bath | living room and study
  [{
    rooms: [{ x: 0, y: 0, w: 540, h: 500, name: '卧室', wall: '#e5dbff', floor: 'wood', window: 370 },
      { x: 560, y: 0, w: 580, h: 500, name: '客厅', wall: '#d3f9d8', floor: 'warm' }],
    doors: [[530, 300, 570, 400]],
    spots: { bed: [110, 246], wardrobe: [250, 150], tub: [420, 330], bubbler: [470, 450], desk: [700, 202], piano: [990, 160], sofa: [820, 450], easel: [1080, 470] },
    decor: [[290, 420, 'floor'], [40, 480, 'floor'], [1100, 300, 'floor'], [700, 360, 'floor'], [480, 56, 'wall']],
    diplomas: [620, 900],
    door: [850, 500],
  }],
  // 花园别墅: living room and kitchen downstairs, bedroom and bath upstairs
  [{
    rooms: [{ x: 0, y: 0, w: 600, h: 500, name: '客厅', wall: '#d3f9d8', floor: 'warm', window: 280 },
      { x: 620, y: 0, w: 520, h: 500, name: '厨房', wall: '#fff3bf', floor: 'tile', window: 720 }],
    doors: [[590, 300, 630, 400]],
    spots: { sofa: [300, 450], piano: [470, 160], easel: [540, 470], kitchen: [930, 160], pot: [1060, 360] },
    decor: [[300, 340, 'floor'], [180, 480, 'floor'], [740, 470, 'floor'], [1100, 480, 'floor'], [150, 56, 'wall']],
    stairs: [60, 0],
    door: [300, 500],
  }, {
    rooms: [{ x: 0, y: 0, w: 600, h: 500, name: '卧室', wall: '#e5dbff', floor: 'wood' },
      { x: 620, y: 0, w: 520, h: 500, name: '浴室', wall: '#d0ebff', floor: 'tile', window: 880 }],
    doors: [[590, 300, 630, 400]],
    spots: { bed: [200, 246], desk: [420, 202], wardrobe: [690, 150], tub: [900, 330], bubbler: [1060, 450] },
    decor: [[300, 420, 'floor'], [560, 470, 'floor'], [760, 470, 'floor'], [1070, 56, 'wall']],
    diplomas: [280, 580],
    stairs: [60, 0],
  }],
  // 猪猪城堡: the villa, and a star room in the tower upstairs
  [{
    rooms: [{ x: 0, y: 0, w: 600, h: 500, name: '大厅', wall: '#f3d9fa', floor: 'warm', window: 280 },
      { x: 620, y: 0, w: 520, h: 500, name: '厨房', wall: '#fff3bf', floor: 'tile', window: 720 }],
    doors: [[590, 300, 630, 400]],
    spots: { sofa: [300, 450], piano: [470, 160], easel: [540, 470], kitchen: [930, 160], pot: [1060, 360] },
    decor: [[300, 340, 'floor'], [180, 480, 'floor'], [740, 470, 'floor'], [1100, 480, 'floor'], [150, 56, 'wall'], [1080, 56, 'wall']],
    stairs: [60, 0],
    door: [300, 500],
  }, {
    rooms: [{ x: 0, y: 0, w: 600, h: 500, name: '卧室', wall: '#e5dbff', floor: 'wood' },
      { x: 620, y: 0, w: 520, h: 500, name: '浴室', wall: '#d0ebff', floor: 'tile', window: 880 },
      { x: 1160, y: 0, w: 420, h: 500, name: '星空塔楼', wall: '#2b2d54', floor: 'night' }],
    doors: [[590, 300, 630, 400], [1130, 300, 1170, 400]],
    spots: { bed: [200, 246], desk: [420, 202], wardrobe: [690, 150], tub: [900, 330], bubbler: [1060, 450] },
    decor: [[300, 420, 'floor'], [560, 470, 'floor'], [760, 470, 'floor'], [1370, 330, 'floor'], [1250, 470, 'floor'], [1500, 470, 'floor'], [1070, 56, 'wall'], [1370, 56, 'wall'], [1240, 60, 'wall']],
    diplomas: [280, 580],
    stairs: [60, 0],
  }],
];

const I_STAIRS = { w: 96 };

// A framed diploma hanging on the wall, centred at (x, y): a dark wood frame with a gold line,
// cream paper with a little mortarboard, the degree on two lines (what, then 学士 / 毕业),
// a red seal and a ribbon. Text is squeezed to fit the paper if it's long.
function diplomaSvg(x, y, fw, degree) {
  const fh = 46;
  const left = x - fw / 2;
  const top = y - fh / 2;
  const m = degree.match(/^(.*?)(毕业|学士|硕士|博士)$/);
  const [l1, l2] = m && m[1] ? [m[1], m[2]] : [degree, ''];
  const paperW = fw - 12;
  const fit = (t, size) => (t.length * size > paperW - 4 ? `textLength="${paperW - 4}" lengthAdjust="spacingAndGlyphs"` : '');
  return `<g><title>${degree}</title>
    <rect x="${left + 3}" y="${top + 3}" width="${fw}" height="${fh}" rx="2" fill="#3b2a20" opacity=".2"/>
    <rect x="${left}" y="${top}" width="${fw}" height="${fh}" rx="2" fill="#7a4a2a" stroke="#4a2c1e" stroke-width="1.5"/>
    <rect x="${left + 3}" y="${top + 3}" width="${fw - 6}" height="${fh - 6}" fill="none" stroke="#e9c46a" stroke-width="1.2"/>
    <rect x="${left + 6}" y="${top + 6}" width="${paperW}" height="${fh - 12}" fill="#fffaf0"/>
    <path d="M${x - 7} ${top + 11} L${x} ${top + 8} L${x + 7} ${top + 11} L${x} ${top + 14} Z" fill="#343a40"/><path d="M${x + 5} ${top + 11.5} v4" stroke="#e9c46a" stroke-width="1"/>
    <text class="i-dip" x="${x}" y="${top + 24}" ${fit(l1, 9)}>${l1}</text>
    ${l2 ? `<text class="i-dip small" x="${x}" y="${top + 34}">${l2}</text>` : ''}
    <circle cx="${left + fw - 12}" cy="${top + fh - 11}" r="4" fill="#e03131" opacity=".85"/><circle cx="${left + fw - 12}" cy="${top + fh - 11}" r="2.2" fill="none" stroke="#ffc9c9" stroke-width=".8"/>
    <path d="M${left + 11} ${top + fh - 12} l-2 6 l2.5 -1.5 l1.5 2 Z M${left + 15} ${top + fh - 12} l2 6 l-2.5 -1.5 l-1.5 2 Z" fill="#e03131"/>
    <circle cx="${left + 13}" cy="${top + fh - 13}" r="3.2" fill="#e9c46a" stroke="#c99a2e" stroke-width=".8"/></g>`;
}

// Stairs going up: a straight flight against the back wall, each step a lit tread over a darker
// riser, the same width all the way up, with straight banisters on both sides
function stairsUpSvg(sx) {
  const n = 6;
  const w = I_STAIRS.w;
  const c = '#c08a5b';
  let svg = `<rect x="${sx - w / 2}" y="6" width="${w}" height="${WALL_H + 40}" fill="${darker(c, 0.45)}"/>`;
  for (let i = n - 1; i >= 0; i--) {
    const y = WALL_H + 30 - i * 24;
    svg += `<rect x="${sx - w / 2}" y="${y - 10}" width="${w}" height="10" fill="${lighter(c, 0.2)}" ${OL(c)}/>
      <rect x="${sx - w / 2}" y="${y}" width="${w}" height="14" fill="${darker(c, 0.18)}" ${OL(c)}/>`;
  }
  for (const x of [sx - w / 2 - 6, sx + w / 2 + 6]) {
    svg += `<path d="M${x} ${WALL_H + 44} V6" stroke="#8c6239" stroke-width="7" stroke-linecap="round"/>
      ${[...Array(5)].map((_, i) => `<rect x="${x - 3}" y="${16 + i * 30}" width="6" height="16" fill="#6b4b38"/>`).join('')}`;
  }
  return svg + `<text class="i-label" x="${sx}" y="${WALL_H + 82}">⬆ 楼上</text>`;
}

// Stairs going down: an opening in the floor with a railing, steps dropping into the dark
function stairsDownSvg(sx) {
  const top = WALL_H + 6;
  const h = 120;
  let svg = `<rect x="${sx - I_STAIRS.w / 2}" y="${top}" width="${I_STAIRS.w}" height="${h}" fill="url(#iDown)"/>
    <rect x="${sx - I_STAIRS.w / 2}" y="${top + h - 8}" width="${I_STAIRS.w}" height="8" fill="#8c6239"/>`;
  for (let i = 0; i < 6; i++) {
    const y = top + h - 18 - i * 19;
    svg += `<rect x="${sx - I_STAIRS.w / 2 + 4}" y="${y}" width="${I_STAIRS.w - 8}" height="9" fill="${mixHex('#d9a066', '#3b2a20', (i / 5) * 0.8)}"/>`;
  }
  // railing round the sides and back, open at the front where you step down
  svg += `<path d="M${sx - I_STAIRS.w / 2 - 4} ${top + h} V${top - 2} H${sx + I_STAIRS.w / 2 + 4} V${top + h}" fill="none" stroke="#8c6239" stroke-width="7"/>
    ${[...Array(5)].map((_, i) => `<rect x="${sx - I_STAIRS.w / 2 - 7}" y="${top + i * 26}" width="6" height="14" fill="#6b4b38"/><rect x="${sx + I_STAIRS.w / 2 + 1}" y="${top + i * 26}" width="6" height="14" fill="#6b4b38"/>`).join('')}
    <text class="i-label" x="${sx}" y="${top + h + 30}">⬇ 楼下</text>`;
  return svg;
}

// ---------- the interior ----------

const Interior = {
  open: false,
  floor: 0,
  keys: new Set(),
  route: null,

  init(cb) {
    this.cb = cb;
    this.el = document.getElementById('interior');
    this.el.innerHTML = `<div id="iworld"><svg id="ibase"></svg><div id="ifurn"></div><div id="ipig" class="actor"><div class="a-face"><div class="a-sprite" style="--k:${I_PIG}"></div></div></div><div id="iprompt"></div></div>
      <div class="i-room" id="iroom"></div><div class="i-hint">WASD 走动 · E 使用 · 走出大门回到城里</div>`;
    this.world = document.getElementById('iworld');
    this.sprite = new PigSprite(this.el.querySelector('#ipig .a-sprite'));
    this.el.addEventListener('click', (e) => this.click(e));
    this.last = performance.now();
    requestAnimationFrame((t) => this.frameLoop(t));
  },

  // Go in: the pig appears just inside the front door
  enter(snap) {
    this.snap = snap;
    this.tier = homeTier(snap.s);
    this.floor = 0;
    this.open = true;
    this.el.classList.add('on');
    this.draw();
    const [dx, dy] = HOUSE_LAYOUTS[this.tier][0].door;
    this.place(dx, dy - 40);
    this.keys.clear();
    this.route = null;
    this.update(snap);
    this.centerCam(true);
  },

  leave() {
    this.open = false;
    this.el.classList.remove('on');
    this.keys.clear();
    this.cb.onLeave();
  },

  get layout() {
    return HOUSE_LAYOUTS[this.tier][this.floor];
  },

  // Everything that stands in the rooms right now, from what the pig owns
  pieces() {
    const s = this.snap.s;
    const L = this.layout;
    const best = {};
    for (const it of ITEMS) {
      if (it.cat !== 'furniture' || !s.inventory[it.id] || it.group === 'house') continue;
      if (!best[it.group] || it.price > best[it.group].price) best[it.group] = it;
    }
    const out = [];
    // the wardrobe is always there
    if (L.spots.wardrobe) out.push({ group: 'wardrobe', it: { id: 'wardrobe', name: '衣柜' }, at: L.spots.wardrobe });
    for (const [group, it] of Object.entries(best)) if (L.spots[group]) out.push({ group, it, at: L.spots[group] });
    // decorations fill the floor's decor spots, wall ones on the wall
    const decor = ownedDecor(s).slice(0, decorSlots(s));
    const floorSpots = L.decor.filter((d) => d[2] === 'floor');
    const wallSpots = L.decor.filter((d) => d[2] === 'wall');
    // decorations are spread over the house's floors in turn
    const floors = HOUSE_LAYOUTS[this.tier].length;
    decor.forEach((it, i) => {
      if (i % floors !== this.floor) return;
      const wall = FURN_ART[it.id]?.().wall;
      const spot = (wall ? wallSpots : floorSpots).shift();
      if (spot) out.push({ group: it.id, it, at: [spot[0], spot[1]], decor: true });
    });
    return out.map((p) => ({ ...p, art: FURN_ART[p.group](p.it) }));
  },

  draw() {
    const L = this.layout;
    const rooms = L.rooms;
    const W = Math.max(...rooms.map((r) => r.x + r.w));
    const H = Math.max(...rooms.map((r) => r.y + r.h));
    this.size = { w: W, h: H };
    let svg = `<defs>
      <linearGradient id="iShadeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a20" stop-opacity=".32"/><stop offset="1" stop-color="#3b2a20" stop-opacity="0"/></linearGradient>
      <linearGradient id="iShadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b2a20" stop-opacity=".22"/><stop offset="1" stop-color="#3b2a20" stop-opacity="0"/></linearGradient>
      <linearGradient id="iShadeR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#3b2a20" stop-opacity=".22"/><stop offset="1" stop-color="#3b2a20" stop-opacity="0"/></linearGradient>
      <linearGradient id="iWallTone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a20" stop-opacity=".16"/><stop offset=".5" stop-color="#3b2a20" stop-opacity="0"/></linearGradient>
      <linearGradient id="iFloorTone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#3b2a20" stop-opacity=".1"/></linearGradient>
      <linearGradient id="iLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6" stop-opacity=".45"/><stop offset="1" stop-color="#fffbe6" stop-opacity="0"/></linearGradient>
      <linearGradient id="iDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c120c"/><stop offset="1" stop-color="#5c4033"/></linearGradient>
    </defs>`;
    for (const r of rooms) {
      const [f1, f2] = FLOOR_LOOKS[r.floor];
      const fy = r.y + WALL_H;
      svg += `<rect x="${r.x}" y="${fy}" width="${r.w}" height="${r.h - WALL_H}" fill="${f1}"/>`;
      // floorboards or tiles
      if (r.floor === 'tile') {
        for (let x = r.x, i = 0; x < r.x + r.w; x += 50, i++) for (let y = fy, j = 0; y < r.y + r.h; y += 30, j++) if ((i + j) % 2) svg += `<rect x="${x}" y="${y}" width="50" height="30" fill="${f2}"/>`;
      } else {
        for (let y = fy + 30; y < r.y + r.h; y += 30) svg += `<path d="M${r.x} ${y} H${r.x + r.w}" stroke="${f2}" stroke-width="3"/><path d="M${r.x} ${y - 28} H${r.x + r.w}" stroke="#fff" stroke-width="1" opacity=".12"/>`;
        for (let y = fy, k = 0; y < r.y + r.h; y += 30, k++) for (let x = r.x + ((k % 3) * 70) % 210; x < r.x + r.w; x += 210) svg += `<path d="M${x} ${y} V${y + 30}" stroke="${f2}" stroke-width="2"/>`;
      }
      // light falling in from the window
      if (r.window != null) {
        svg += `<path d="M${r.window - 40} ${fy} L${r.window + 40} ${fy} L${r.window + 90} ${fy + 170} L${r.window - 10} ${fy + 170} Z" fill="url(#iLight)"/>`;
      }
      // depth: the floor darkens toward the front, shadows where it meets the walls
      svg += `<rect x="${r.x}" y="${fy}" width="${r.w}" height="${r.h - WALL_H}" fill="url(#iFloorTone)"/>
        <rect x="${r.x}" y="${fy}" width="${r.w}" height="46" fill="url(#iShadeTop)"/>
        <rect x="${r.x}" y="${fy}" width="30" height="${r.h - WALL_H}" fill="url(#iShadeL)"/>
        <rect x="${r.x + r.w - 30}" y="${fy}" width="30" height="${r.h - WALL_H}" fill="url(#iShadeR)"/>`;
      // the back wall standing up: wallpaper, darker toward the ceiling, crown moulding, skirting board
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${WALL_H}" fill="${r.wall}"/>`;
      for (let x = r.x + 20; x < r.x + r.w; x += 40) svg += `<rect x="${x}" y="${r.y}" width="14" height="${WALL_H}" fill="#fff" opacity=".18"/>`;
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${WALL_H}" fill="url(#iWallTone)"/>
        <rect x="${r.x}" y="${r.y}" width="${r.w}" height="9" fill="${lighter(r.wall, 0.35)}"/><rect x="${r.x}" y="${r.y + 9}" width="${r.w}" height="4" fill="${darker(r.wall, 0.15)}"/>
        <rect x="${r.x}" y="${fy - 16}" width="${r.w}" height="16" fill="${darker(r.wall, 0.28)}"/><rect x="${r.x}" y="${fy - 16}" width="${r.w}" height="3" fill="#fff" opacity=".35"/>`;
      if (r.window != null) {
        const wx = r.window;
        svg += `<rect x="${wx - 46}" y="${r.y + 24}" width="92" height="64" rx="6" fill="#b9e0ff" stroke="#fff" stroke-width="7"/>
          <path d="M${wx - 40} ${r.y + 80} L${wx - 10} ${r.y + 30}" stroke="#fff" stroke-width="5" opacity=".5"/>
          <path d="M${wx} ${r.y + 24} V${r.y + 88} M${wx - 46} ${r.y + 56} H${wx + 46}" stroke="#fff" stroke-width="4"/>
          <rect x="${wx - 54}" y="${r.y + 88}" width="108" height="8" rx="3" fill="#fff" stroke="${darker(r.wall, 0.2)}"/>
          <path d="M${wx - 56} ${r.y + 20} q12 42 0 72 M${wx + 56} ${r.y + 20} q-12 42 0 72" stroke="${darker(r.wall, 0.1)}" stroke-width="13" fill="none" stroke-linecap="round"/>`;
      }
      if (r.name === '星空塔楼') {
        svg += [...Array(18)].map((_, i) => `<circle cx="${r.x + 20 + ((i * 97) % (r.w - 40))}" cy="${r.y + 16 + ((i * 53) % 80)}" r="2" fill="#fff3bf" class="twinkle" style="animation-delay:${-i * 0.2}s"/>`).join('');
      }
    }
    // thick walls seen from above around and between the rooms, with gaps for doorways
    for (const r of rooms) {
      svg += `<rect x="${r.x - 8}" y="${r.y - 8}" width="${r.w + 16}" height="${r.h + 16}" fill="none" stroke="#6b4b38" stroke-width="16" rx="4"/>
        <rect x="${r.x - 8}" y="${r.y - 11}" width="${r.w + 16}" height="${r.h + 16}" fill="none" stroke="#8c6a52" stroke-width="5" rx="4"/>`;
    }
    for (const [x1, y1, x2, y2] of L.doors || []) {
      const [f1] = FLOOR_LOOKS[rooms[0].floor];
      const left = rooms.filter((r) => r.x < x1).pop() || rooms[0];
      const into = rooms.find((r) => r.x > x1) || rooms[0];
      svg += `<rect x="${x1 - 10}" y="${y1}" width="${(x2 - x1) / 2 + 10}" height="${y2 - y1}" fill="${FLOOR_LOOKS[left.floor][0]}"/><rect x="${(x1 + x2) / 2}" y="${y1}" width="${(x2 - x1) / 2 + 10}" height="${y2 - y1}" fill="${FLOOR_LOOKS[into.floor][0]}"/>
        <rect x="${x1 - 10}" y="${y1 - 8}" width="${x2 - x1 + 20}" height="10" fill="#4a3426"/><rect x="${x1 - 10}" y="${y2 - 2}" width="${x2 - x1 + 20}" height="12" fill="#4a3426"/>`;
    }
    // the front door: a gap in the wall with a doormat
    if (L.door) {
      const [dx, dy] = L.door;
      svg += `<rect x="${dx - 48}" y="${dy - 8}" width="96" height="30" fill="${FLOOR_LOOKS[rooms[0].floor][0]}"/>
        <rect x="${dx - 40}" y="${dy - 34}" width="80" height="28" rx="6" fill="#e8590c" opacity=".9"/><path d="M${dx - 30} ${dy - 20} H${dx + 30}" stroke="#ffd8a8" stroke-width="3" stroke-dasharray="6 5"/>`;
    }
    if (L.stairs) svg += this.floor === 0 ? stairsUpSvg(L.stairs[0]) : stairsDownSvg(L.stairs[0]);
    // diplomas, framed along their own stretch of wall
    if (L.diplomas) {
      const [x1, x2] = L.diplomas;
      const degs = degrees(this.snap.s);
      const fw = 56;
      const gap = 8;
      const perRow = Math.max(1, Math.floor((x2 - x1 + gap) / (fw + gap)));
      const shown = degs.slice(0, perRow * 2);
      shown.forEach((d, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, shown.length - row * perRow);
        const x = (x1 + x2) / 2 + ((i % perRow) - (inRow - 1) / 2) * (fw + gap);
        const y = 40 + row * 54;
        svg += diplomaSvg(x, y, fw, d);
      });
      if (degs.length > shown.length) svg += `<text class="i-dip" x="${x2}" y="98">+${degs.length - shown.length}</text>`;
    }
    document.getElementById('ibase').setAttribute('width', W + 40);
    document.getElementById('ibase').setAttribute('height', H + 40);
    document.getElementById('ibase').setAttribute('viewBox', `-20 -20 ${W + 40} ${H + 40}`);
    document.getElementById('ibase').innerHTML = svg;
    this.world.style.width = `${W + 40}px`;
    this.world.style.height = `${H + 40}px`;
    this.drawFurniture();
  },

  drawFurniture() {
    this.items = this.pieces();
    const furn = document.getElementById('ifurn');
    furn.innerHTML = this.items.map((p, i) => {
      const [x, y] = p.at;
      const z = p.art.wall ? 1 : p.art.flat ? 0 : Math.round(y);
      // a soft shadow on the floor under anything standing
      const shadow = p.art.wall || p.art.flat ? '' : `<ellipse cx="0" cy="-3" rx="${p.art.w / 2 + 6}" ry="11" fill="#3b2a20" opacity=".22"/>`;
      return `<svg class="ifurn ${p.art.flat ? 'flat' : ''}" data-furn="${i}" style="left:${x + 20}px;top:${y + 20}px;z-index:${z}" width="1" height="1" overflow="visible">${shadow}<g>${p.art.svg}</g><title>${esc(p.it.name || '')}</title></svg>`;
    }).join('');
    this.furnKey = JSON.stringify([this.tier, this.floor, this.items.map((p) => p.it.id)]);
  },

  // ---------- walking ----------

  // Floor the pig can stand on: inside a room below its back wall, or in a doorway, and not in furniture
  walkable(x, y) {
    const L = this.layout;
    const inRoom = L.rooms.some((r) => x > r.x + 20 && x < r.x + r.w - 20 && y > r.y + WALL_H + 6 && y < r.y + r.h - 8);
    const inDoor = (L.doors || []).some(([x1, y1, x2, y2]) => x > x1 - 20 && x < x2 + 20 && y > y1 + 10 && y < y2 - 4);
    const atFront = L.door && Math.abs(x - L.door[0]) < 40 && y >= L.door[1] - 12 && y < L.door[1] + 10;
    if (!inRoom && !inDoor && !atFront) return false;
    for (const p of this.items) {
      if (p.art.wall || p.art.flat || !p.art.d) continue;
      const [fx, fy] = p.at;
      if (x > fx - p.art.w / 2 - 10 && x < fx + p.art.w / 2 + 10 && y > fy - p.art.d && y < fy + 4) return false;
    }
    return true;
  },

  place(x, y) {
    this.pos = { x, y };
    const el = document.getElementById('ipig');
    el.style.transform = `translate(${x + 20}px, ${y + 20}px)`;
    el.style.zIndex = Math.round(y) + 1;
  },

  key(e, down) {
    const k = e.key.toLowerCase();
    if (KEY_DIRS[k]) {
      if (down) {
        if (this.busyWhy(true)) return true;
        this.keys.add(k);
        this.route = null;
      } else this.keys.delete(k);
      return true;
    }
    if (down && [' ', 'e', 'enter'].includes(k)) {
      const p = this.nearest();
      if (p) this.use(p);
      return true;
    }
    return false;
  },

  // Busy or asleep: can't walk about (tell: say so)
  busyWhy(tell) {
    const snap = this.snap;
    const why = snap.busy ? `${snap.label.replace(/^在/, '正在')}呢` : snap.sleeping ? '在睡觉呢…zzz' : '';
    if (why && tell && Date.now() - (this.toldAt || 0) > 2500) {
      this.toldAt = Date.now();
      this.cb.onBlocked(why);
    }
    return why;
  },

  // The piece of furniture right in front of the pig that can be used, if any
  nearest() {
    let best = null;
    for (const p of this.items) {
      if (!FURN_USE[p.group]) continue;
      const [fx, fy] = p.at;
      const d = Math.hypot(this.pos.x - fx, this.pos.y - (fy + 24));
      if (d < 80 + p.art.w / 3 && (!best || d < best.d)) best = { p, d };
    }
    return best?.p;
  },

  use(p) {
    const [act, id] = FURN_USE[p.group].act(this.snap);
    this.cb.onUse(act, id);
  },

  click(e) {
    const f = e.target.closest('[data-furn]');
    const r = this.el.getBoundingClientRect();
    const wx = (e.clientX - r.left) / I_ZOOM + this.cam.x - 20;
    const wy = (e.clientY - r.top) / I_ZOOM + this.cam.y - 20;
    if (this.busyWhy(true)) return;
    if (f) {
      const p = this.items[f.dataset.furn];
      if (!FURN_USE[p.group]) return;
      const front = { x: p.at[0], y: p.at[1] + 30 };
      this.route = { to: front, done: () => this.use(p) };
      return;
    }
    if (this.walkable(wx, wy)) this.route = { to: { x: wx, y: wy }, done: () => {} };
  },

  frameLoop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.open) this.frame(dt);
    requestAnimationFrame((t) => this.frameLoop(t));
  },

  frame(dt) {
    let vx = 0;
    let vy = 0;
    if (this.route) {
      const dx = this.route.to.x - this.pos.x;
      const dy = this.route.to.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        const done = this.route.done;
        this.route = null;
        done();
      } else {
        vx = dx / d;
        vy = dy / d;
      }
    } else if (this.keys.size && !this.busyWhy()) {
      for (const k of this.keys) {
        vx += KEY_DIRS[k][0];
        vy += KEY_DIRS[k][1];
      }
      const len = Math.hypot(vx, vy);
      if (len) {
        vx /= len;
        vy /= len;
      }
    }
    const moving = !!(vx || vy);
    if (moving) {
      const step = I_SPEED * dt;
      let { x, y } = this.pos;
      if (this.walkable(x + vx * step, y)) x += vx * step;
      if (this.walkable(x, y + vy * step)) y += vy * step;
      if (x === this.pos.x && y === this.pos.y && this.route) this.route = null; // stuck: give up
      this.place(x, y);
      if (vx) this.el.querySelector('#ipig .a-face').style.transform = `scaleX(${Math.sign(vx)})`;
      this.checkExits(vy);
    }
    this.sprite.root.classList.toggle('walking', moving);
    this.updatePrompt();
    this.centerCam(false);
  },

  // Out the front door, or up and down the stairs
  checkExits(vy) {
    const L = this.layout;
    if (L.door && vy > 0 && Math.abs(this.pos.x - L.door[0]) < 40 && this.pos.y > L.door[1] - 14) {
      this.leave();
      return;
    }
    if (L.stairs) {
      const [sx] = L.stairs;
      // walk up onto the bottom step to go up, or into the opening to go down
      const zoneBottom = this.floor === 0 ? WALL_H + 56 : WALL_H + 126;
      if (Math.abs(this.pos.x - sx) < I_STAIRS.w / 2 && this.pos.y < zoneBottom && vy < 0) {
        const floors = HOUSE_LAYOUTS[this.tier];
        this.floor = this.floor === 0 ? 1 : 0;
        if (this.floor >= floors.length) this.floor = 0;
        this.draw();
        const [nx] = this.layout.stairs;
        this.place(nx + 100, WALL_H + 150);
        this.keys.clear();
        this.centerCam(true);
      }
    }
  },

  updatePrompt() {
    const el = document.getElementById('iprompt');
    const p = !this.busyWhy() || this.snap.sleeping ? this.nearest() : null;
    if (!p) {
      el.classList.remove('on');
      return;
    }
    el.textContent = `E ${FURN_USE[p.group].label(this.snap)}`;
    el.style.transform = `translate(${p.at[0] + 20}px, ${p.at[1] + 20 - (p.art.d || 40) - 70}px) translate(-50%, -100%)`;
    el.classList.add('on');
  },

  centerCam(snap) {
    const vw = this.el.clientWidth / I_ZOOM;
    const vh = this.el.clientHeight / I_ZOOM;
    const W = this.size.w + 40;
    const H = this.size.h + 40;
    const tx = W <= vw ? (W - vw) / 2 : clamp(this.pos.x + 20 - vw / 2, 0, W - vw);
    const ty = H <= vh ? (H - vh) / 2 : clamp(this.pos.y + 20 - vh / 2, 0, H - vh);
    this.cam = this.cam && !snap ? { x: this.cam.x + (tx - this.cam.x) * 0.15, y: this.cam.y + (ty - this.cam.y) * 0.15 } : { x: tx, y: ty };
    this.world.style.transform = `translate(${-this.cam.x * I_ZOOM}px, ${-this.cam.y * I_ZOOM}px) scale(${I_ZOOM})`;
    const room = this.layout.rooms.find((r) => this.pos.x >= r.x && this.pos.x <= r.x + r.w);
    const label = document.getElementById('iroom');
    const text = `${HOUSE_NAMES[this.tier]} · ${room?.name || ''}`;
    if (label.textContent !== text) label.textContent = text;
  },

  react(it) {
    playUse(this.sprite.root, document.getElementById('ipig'), it);
  },

  // ---------- following the snapshot ----------

  update(snap) {
    this.snap = snap;
    if (!this.open) return;
    if (homeTier(snap.s) !== this.tier) {
      this.tier = homeTier(snap.s);
      this.floor = 0;
      this.draw();
    }
    const items = this.pieces();
    if (JSON.stringify([this.tier, this.floor, items.map((p) => p.it.id)]) !== this.furnKey) this.drawFurniture();
    this.sprite.update(snap.s, snap.sleeping);
    // busy at home: stand at (or lie in) whatever's being used
    const a = snap.s.activity;
    const group = a && HOME_SPOT_FOR[a.type === 'hobby' ? a.id : a.type];
    const piece = group && this.items.find((p) => p.group === group);
    if (piece && !this.route) {
      const [fx, fy] = piece.at;
      const lie = group === 'bed' || group === 'tub';
      this.place(fx, lie ? fy - piece.art.d / 2 : fy + 26);
      document.getElementById('ipig').style.zIndex = Math.round(fy) + 2;
    }
    this.sprite.root.classList.toggle('studying', !!(a && a.type === 'hobby'));
  },
};
