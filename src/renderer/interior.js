// Inside a home, Stardew style: rooms seen from the front and above, furniture drawn at real size
// on a tile grid, the pig walked around with WASD. Walk up to something and press E (or click it)
// to use it; the stairs go up and down, the front door goes back out to town.
//
// One oblique top-down projection for everything. World units are tiles: x runs right, z toward
// the viewer (0 = the back wall's inner face), y up. On screen sx = x*I_T, sy = z*I_R - y*I_H
// (plus the world's origin). A box (w, d, h) shows its top face (w by d*I_R) over its front face
// (w by h*I_H); faces pointing left or right are edge-on and never drawn. Light comes from the back
// left, so soft contact shadows fall to the front right. One outline style for everything: a
// darker shade of the same hue.

const I_T = 48; // px per tile across
const I_R = 32; // px per tile of depth
const I_H = 36; // px per tile of height
const I_WALL = 5.5; // how tall the back wall is
const I_CAP = 0.4; // wall thickness
const I_CUT = 0.4; // the front wall is cut down to this, so we can see in
const I_M = 12; // margin round the house, px
const I_OX = I_M + I_CAP * I_T; // where x = 0 is in the world, px
const I_OY = I_M + I_CAP * I_R + I_WALL * I_H; // where z = 0 on the floor is
const I_ZOOM = 1;
const I_SPEED = 3.6; // tiles a second
const I_PIG = 0.54; // pig size inside
const I_RX = 0.5; // the pig's footprint on the floor: half its width
const I_RZ = 0.25; // and half its depth

const IX = (x) => x * I_T;
const IY = (z, y = 0) => z * I_R - y * I_H;
const izi = (z) => 10 + Math.round(z * 100); // stacking order for something whose front edge is at z

// ---------- drawing helpers ----------
// Everything is drawn in tiles from a local origin: a piece of furniture from the back-left corner
// of its footprint, the rooms from the world's origin.

const OL = (c, w = 2.5) => `stroke="${darker(c, 0.45)}" stroke-width="${w}" stroke-linejoin="round"`;
const OL_IN = (c, w = 1.5) => `stroke="${darker(c, 0.3)}" stroke-width="${w}" fill="none" stroke-linecap="round"`;

// A rounded-corner shape's path: only the outer corners are rounded (r), on the given sides
function rpath(x, y, w, h, r, top = true, bottom = true) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const rt = top ? r : 0;
  const rb = bottom ? r : 0;
  return `M${x} ${y + rt} Q${x} ${y} ${x + rt} ${y} H${x + w - rt} Q${x + w} ${y} ${x + w} ${y + rt} V${y + h - rb} Q${x + w} ${y + h} ${x + w - rb} ${y + h} H${x + rb} Q${x} ${y + h} ${x} ${y + h - rb} Z`;
}

// A box standing at (x, z), w wide, d deep, h tall, its bottom at height y0: the top face over the
// front face, with a light line along the top's front edge
function ibox(x, z, w, d, h, c, o = {}) {
  const y0 = o.y0 || 0;
  const r = o.r ?? 4;
  const X = IX(x);
  const Wd = IX(w);
  const yt = IY(z, y0 + h);
  const dt = d * I_R;
  const ys = IY(z + d, y0 + h);
  const hf = h * I_H;
  const f = o.front || darker(c, 0.16);
  let s = '';
  if (dt > 0.5) s += `<path d="${rpath(X, yt, Wd, dt, r, true, hf <= 0.5)}" fill="${c}" ${OL(c, o.ol)}/>`;
  if (hf > 0.5) s += `<path d="${rpath(X, ys, Wd, hf, r, dt <= 0.5, true)}" fill="${f}" ${OL(c, o.ol)}/>`;
  if (dt > 0.5 && hf > 0.5 && !o.noLit) s += `<path d="M${X + 3} ${ys - 1.5} H${X + Wd - 3}" stroke="${lighter(c, 0.5)}" stroke-width="2" stroke-linecap="round"/>`;
  return s;
}

// An upright cylinder centred at (xc, zc), radius r, height h, bottom at y0
function icyl(xc, zc, r, h, c, o = {}) {
  const y0 = o.y0 || 0;
  const cx = IX(xc);
  const rx = r * I_T;
  const ry = r * I_R;
  const yt = IY(zc, y0 + h);
  const yb = IY(zc, y0);
  const f = o.front || darker(c, 0.16);
  return `<path d="M${cx - rx} ${yt} V${yb} A${rx} ${ry} 0 0 0 ${cx + rx} ${yb} V${yt} Z" fill="${f}" ${OL(c, o.ol)}/>
    <ellipse cx="${cx}" cy="${yt}" rx="${rx}" ry="${ry}" fill="${c}" ${OL(c, o.ol)}/>`;
}

// A flat rounded rectangle lying on the floor (or on a surface at height y)
function iflat(x, z, w, d, fill, o = {}) {
  const r = o.r ?? 0.3;
  return `<rect x="${IX(x)}" y="${IY(z, o.y || 0)}" width="${IX(w)}" height="${d * I_R}" rx="${r * I_T}" ry="${r * I_R}" fill="${fill}" ${o.attrs || ''}/>`;
}

// Soft contact shadows, falling to the front right (taller things throw them a little further)
function ishadow(x, z, w, d, h = 1, op = 0.22) {
  const k = Math.min(h, 2.5);
  return `<rect x="${IX(x) + k * 0.1 * I_T}" y="${IY(z) + k * 0.1 * I_R}" width="${IX(w)}" height="${d * I_R}" rx="${0.25 * I_T}" ry="${0.25 * I_R}" fill="#6b3a4e" opacity="${op}" filter="url(#iblur)"/>`;
}
function ishadowE(xc, zc, r, h = 1, op = 0.22) {
  const k = Math.min(h, 2.5);
  return `<ellipse cx="${IX(xc) + k * 0.1 * I_T}" cy="${IY(zc) + k * 0.1 * I_R}" rx="${r * I_T}" ry="${r * I_R}" fill="#6b3a4e" opacity="${op}" filter="url(#iblur)"/>`;
}

// A little heart with its top dip at (x, y)
const iheart = (x, y, fill, k = 1, extra = '') => `<path d="M${x} ${y} c${-6 * k} ${-7 * k} ${-12 * k} ${-2 * k} ${-6 * k} ${4 * k} l${6 * k} ${5 * k} l${6 * k} ${-5 * k} c${6 * k} ${-6 * k} 0 ${-11 * k} ${-6 * k} ${-4 * k} z" fill="${fill}" ${extra}/>`;

// A potted plant centred at (xc, zc)
function iplant(xc, zc, size = 1) {
  const r = 0.3 * size;
  let s = ishadowE(xc, zc, r + 0.05, 1.5 * size);
  s += icyl(xc, zc, r, 0.55 * size, '#f59f80');
  s += `<ellipse cx="${IX(xc)}" cy="${IY(zc, 0.55 * size)}" rx="${r * I_T - 4}" ry="${r * I_R - 3}" fill="#8a5a44"/>`;
  const cx = IX(xc);
  const by = IY(zc, 0.55 * size);
  const L = (dx, dy, rx, ry, rot, c) => `<ellipse cx="${cx + dx * size}" cy="${by + dy * size}" rx="${rx * size}" ry="${ry * size}" transform="rotate(${rot} ${cx + dx * size} ${by + dy * size})" fill="${c}" ${OL('#51cf66', 2)}/>`;
  s += L(-14, -18, 9, 17, -35, '#69db7c') + L(14, -20, 9, 17, 35, '#69db7c') + L(-6, -34, 9, 18, -12, '#8ce99a') + L(8, -36, 9, 18, 14, '#8ce99a') + L(0, -48, 8, 15, 0, '#69db7c');
  return s;
}

// A beanbag sitting on the floor at (xc, zc): round, so it looks the same from any side
function ibeanbag(xc, zc, c) {
  const cx = IX(xc);
  const by = IY(zc);
  const rx = 0.62 * I_T;
  return `<path d="M${cx - rx} ${by - 4} C${cx - rx - 4} ${by - 30} ${cx - rx * 0.6} ${by - 54} ${cx - 4} ${by - 52} C${cx + rx * 0.6} ${by - 58} ${cx + rx + 4} ${by - 34} ${cx + rx} ${by - 4} Q${cx} ${by + 6} ${cx - rx} ${by - 4} Z" fill="${c}" ${OL(c)}/>
    <path d="M${cx - rx * 0.62} ${by - 20} Q${cx} ${by - 34} ${cx + rx * 0.62} ${by - 20} Q${cx} ${by - 8} ${cx - rx * 0.62} ${by - 20} Z" fill="${darker(c, 0.12)}"/>
    <path d="M${cx - rx * 0.5} ${by - 44} q10 -8 22 -6" stroke="${lighter(c, 0.5)}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

// Piano keys lying flat at (x, z) on a surface at height y: white keys with black ones at the back
function ikeys(x, z, w, d, y) {
  const kx = IX(x);
  const ky = IY(z, y);
  const kw = IX(w);
  const kd = d * I_R;
  const n = Math.max(7, Math.round(w * 6));
  let s = `<rect x="${kx}" y="${ky}" width="${kw}" height="${kd}" fill="#fff" ${OL('#d0a8b8', 1.2)}/>`;
  for (let i = 1; i < n; i++) s += `<path d="M${kx + (i * kw) / n} ${ky} v${kd}" stroke="#e5d0d6" stroke-width="1"/>`;
  for (let i = 1; i < n; i++) if ([1, 2, 4, 5, 6].includes(i % 7)) s += `<rect x="${kx + (i * kw) / n - 2}" y="${ky}" width="4" height="${kd * 0.6}" fill="#4a2c38"/>`;
  return s;
}

// A gold cup standing at (x, y) px, s its size
const icup = (x, y, k = 1) => `<path d="M${x - 5 * k} ${y} h${10 * k} l-1.5 ${-3 * k} h${-2 * k} v${-4 * k} c${5 * k} -1 ${7 * k} ${-5 * k} ${7 * k} ${-11 * k} h${-15 * k} c0 ${6 * k} ${2 * k} ${10 * k} ${7 * k} ${11 * k} v${4 * k} h${-2 * k} z" fill="#ffd43b" ${OL('#fab005', 1.4)}/>
  <path d="M${x - 7 * k} ${y - 21 * k} q${-5 * k} ${1 * k} ${-3 * k} ${6 * k} q${1 * k} ${2 * k} ${4 * k} ${2 * k} M${x + 7 * k} ${y - 21 * k} q${5 * k} ${1 * k} ${3 * k} ${6 * k} q${-1 * k} ${2 * k} ${-4 * k} ${2 * k}" stroke="#fab005" stroke-width="1.6" fill="none"/>`;

const WOOD = '#e0a96d';
const WOOD_D = '#c48a57';

// ---------- furniture ----------
// Each takes the item and returns its footprint (w wide, d deep, in tiles), how tall it gets (h),
// and its drawing from the back-left corner of the footprint. Optional: seat [x, z, lift], where
// the pig is while using it; over, drawn over the pig when he's in it (a blanket, a tub's side);
// flat (a rug: lies under everything) or wall (hangs on the back wall: drawn from its centre).

const FURN_ART = {
  // a bed with its head against the back wall: headboard and posts, the frame, the mattress with
  // two pillows, the blanket over the foot end draping down the front
  bed(it) {
    const look = {
      bed1: { frame: '#d39a63', sheet: '#74c0fc' }, bed2: { frame: '#f783ac', sheet: '#ffc9de' }, bed3: { frame: '#e599f7', sheet: '#fff0f6', canopy: true },
      bed4: { frame: '#a5d8ff', sheet: '#d0ebff', cloud: true }, bed_bear: { frame: '#a9805b', sheet: '#ffe066', bear: true },
    }[it.id] || { frame: '#d39a63', sheet: '#74c0fc' };
    const f = look.frame;
    const sh = look.sheet;
    const w = 2.3;
    const d = 3.2;
    let s = ishadow(0, 0, w, d, 1.2, 0.24);
    const postH = look.canopy ? 3.35 : 2.05;
    if (look.cloud) {
      // a fluffy cloud for a headboard
      s += [[0.35, 1.55, 0.36], [0.85, 1.85, 0.42], [1.45, 1.85, 0.42], [1.95, 1.55, 0.36], [1.15, 1.3, 0.5]].map(([x, y, r]) => `<circle cx="${IX(x)}" cy="${IY(0.15, y)}" r="${r * I_T}" fill="#fff" ${OL('#a5d8ff')}/>`).join('');
      s += `<rect x="${IX(0.2)}" y="${IY(0.15, 1.45)}" width="${IX(1.9)}" height="${1.0 * I_H}" fill="#fff"/>`;
    } else {
      s += ibox(0.1, 0, w - 0.2, 0.22, 1.8, f, { r: 8 });
      s += iheart(IX(w / 2), IY(0.22, 1.4), lighter(f, 0.45), 1.3);
      for (const x of [0, w - 0.2]) s += ibox(x, 0, 0.2, 0.25, postH, darker(f, 0.06), { r: 3, ol: 2 });
      if (!look.canopy) for (const x of [0.1, w - 0.1]) s += `<circle cx="${IX(x)}" cy="${IY(0.12, postH + 0.08)}" r="6" fill="${lighter(f, 0.25)}" ${OL(f, 2)}/>`;
    }
    if (look.bear) {
      for (const x of [0.45, w - 0.45]) s += `<circle cx="${IX(x)}" cy="${IY(0.1, 1.85)}" r="11" fill="${f}" ${OL(f)}/><circle cx="${IX(x)}" cy="${IY(0.1, 1.85)}" r="5" fill="${lighter(f, 0.35)}"/>`;
    }
    // the frame, the mattress, the pillows
    s += ibox(0.05, 0.22, w - 0.1, d - 0.22, 0.5, f, { r: 4 });
    s += ibox(0.12, 0.25, w - 0.24, d - 0.35, 0.3, '#fffaf6', { y0: 0.5, r: 6, front: '#f3e7e7' });
    for (const k of [0, 1]) s += ibox(0.25 + k * 0.95, 0.42, 0.85, 0.5, 0.16, '#ffffff', { y0: 0.8, r: 9, ol: 2, front: '#f1eef0' });
    // feet
    for (const x of [0.12, w - 0.24]) s += `<rect x="${IX(x)}" y="${IY(d) - 1}" width="${0.12 * I_T}" height="5" rx="1.5" fill="${darker(f, 0.5)}"/>`;
    // the blanket: drawn over the pig when he's tucked in
    let over = ibox(0.06, 1.3, w - 0.12, d - 1.26, 0.5, sh, { y0: 0.38, r: 6, front: darker(sh, 0.1) });
    over += iflat(0.08, 1.3, w - 0.16, 0.24, '#fff', { y: 0.88, r: 0.06, attrs: OL_IN('#dee2e6') });
    if (look.cloud) over += [0.35, 0.85, 1.4, 1.95].map((x) => `<circle cx="${IX(x)}" cy="${IY(d, 0.42)}" r="11" fill="#fff" ${OL('#a5d8ff', 2)}/>`).join('');
    else over += [0.5, 1.15, 1.8].map((x, i) => iheart(IX(x), IY(2.1 + (i % 2) * 0.45, 0.88) - 2, lighter(sh, 0.5), 0.9)).join('');
    if (look.canopy) {
      // a canopy over the head end, curtains tied back at both sides
      s += ibox(-0.08, 0, w + 0.16, 0.55, 0.2, lighter(f, 0.2), { y0: postH, r: 3 });
      const vy = IY(0.55, postH);
      let sc = `M${IX(-0.08)} ${vy}`;
      for (let i = 0; i < 6; i++) sc += ` q${IX((w + 0.16) / 12)} 9 ${IX((w + 0.16) / 6)} 0`;
      s += `<path d="${sc}" fill="${lighter(f, 0.35)}" ${OL(f, 2)}/>`;
      for (const k of [-1, 1]) {
        const ex = k < 0 ? IX(-0.08) : IX(w + 0.08);
        const ix = ex - k * 0.42 * I_T;
        const tieY = IY(0.55, 1.4);
        s += `<path d="M${ex} ${vy} L${ix} ${vy} Q${ix + k * 4} ${(vy + tieY) / 2} ${ex - k * 4} ${tieY} Q${ex - k * 8} ${tieY + 18} ${ex} ${IY(0.55, 0.9)} Z" fill="${lighter(f, 0.55)}" ${OL(f, 2)}/>
          <ellipse cx="${ex - k * 4}" cy="${tieY}" rx="6" ry="3.5" fill="${f}"/>`;
      }
    }
    return { w, d, h: postH + 0.3, svg: s, over, seat: [w / 2, 1.85, 0.75] };
  },

  // a bathtub against the wall: rim on top with the water inside, the side facing us, little gold
  // feet, the tap at the back; or a hot spring, a ring of stones round a pool
  tub(it) {
    if (it.id === 'tub3') {
      const w = 3.2;
      const d = 2.4;
      const cx = 1.6;
      const cz = 1.2;
      // a paved edge, the pool sunk into it, a few big stones round the back, steam
      let s = `<ellipse cx="${IX(cx) + 4}" cy="${IY(cz) + 4}" rx="${IX(1.6)}" ry="${1.18 * I_R}" fill="#6b3a4e" opacity=".12" filter="url(#iblur)"/>
        <ellipse cx="${IX(cx)}" cy="${IY(cz)}" rx="${IX(1.58)}" ry="${1.16 * I_R}" fill="#e9e1d6" ${OL('#cfc4b6')}/>
        <ellipse cx="${IX(cx)}" cy="${IY(cz)}" rx="${IX(1.25)}" ry="${0.88 * I_R}" fill="#74c0fc" ${OL('#4dabf7', 2)}/>
        <path d="M${IX(cx - 1.1)} ${IY(cz) - 6} A${IX(1.1)} ${0.7 * I_R} 0 0 1 ${IX(cx + 1.1)} ${IY(cz) - 6}" stroke="#4dabf7" stroke-width="3" fill="none" opacity=".5"/>
        <ellipse cx="${IX(cx - 0.35)}" cy="${IY(cz - 0.1)}" rx="${IX(0.5)}" ry="${0.22 * I_R}" fill="#d0ebff" opacity=".7"/>`;
      // a rounded stone sitting at (x, z): a low dome with a lit top
      const stone = (x, z, r, h, c) => {
        const sx = IX(x);
        const by = IY(z);
        const rx = r * I_T;
        const ty = by - h * I_H - r * I_R;
        return `<path d="M${sx - rx} ${by} C${sx - rx} ${ty + 4} ${sx - rx * 0.4} ${ty} ${sx} ${ty} C${sx + rx * 0.5} ${ty} ${sx + rx} ${ty + 6} ${sx + rx} ${by} Q${sx} ${by + r * I_R * 0.8} ${sx - rx} ${by} Z" fill="${c}" ${OL(c, 2)}/>
          <path d="M${sx - rx * 0.5} ${ty + 6} q${rx * 0.4} -4 ${rx * 0.8} 0" stroke="#fff" stroke-width="2.5" opacity=".6" fill="none" stroke-linecap="round"/>`;
      };
      s += stone(0.45, 0.6, 0.3, 0.3, '#ced4da') + stone(1.05, 0.25, 0.26, 0.24, '#dee2e6') + stone(2.55, 0.45, 0.32, 0.34, '#c3c9cf') + stone(1.95, 0.22, 0.22, 0.2, '#dee2e6');
      s += `<g class="steam">${[-0.5, 0, 0.5].map((x) => `<path d="M${IX(cx + x)} ${IY(cz, 0.3)} q-6 -12 0 -24" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/>`).join('')}</g>`;
      // a wooden bucket on the edge
      s += icyl(2.85, 1.85, 0.2, 0.32, WOOD, { ol: 2 }) + `<path d="M${IX(2.68)} ${IY(1.85, 0.32)} q8 -12 16 0" stroke="${WOOD_D}" stroke-width="2" fill="none"/>`;
      // the front half of the water and the edge: over the pig when he's soaking
      const cy = IY(cz);
      const over = `<path d="M${IX(cx - 1.25)} ${cy} A${IX(1.25)} ${0.88 * I_R} 0 0 0 ${IX(cx + 1.25)} ${cy} Z" fill="#74c0fc" opacity=".85"/>
        <path d="M${IX(cx - 1.58)} ${cy} A${IX(1.58)} ${1.16 * I_R} 0 0 0 ${IX(cx + 1.58)} ${cy} L${IX(cx + 1.25)} ${cy} A${IX(1.25)} ${0.88 * I_R} 0 0 1 ${IX(cx - 1.25)} ${cy} Z" fill="#e9e1d6"/>
        <path d="M${IX(cx - 1.58)} ${cy} A${IX(1.58)} ${1.16 * I_R} 0 0 0 ${IX(cx + 1.58)} ${cy}" fill="none" ${OL('#cfc4b6')}/>
        <path d="M${IX(cx + 1.25)} ${cy} A${IX(1.25)} ${0.88 * I_R} 0 0 1 ${IX(cx - 1.25)} ${cy}" fill="none" ${OL('#4dabf7', 2)}/>
        ${stone(0.3, 1.75, 0.22, 0.16, '#dee2e6')}`;
      return { w, d, h: 1, svg: s, over, seat: [cx, cz + 0.4, -0.35] };
    }
    const w = 2.4;
    const d = 1.3;
    const c = it.id === 'tub2' ? '#e7f5ff' : '#fbfbfd';
    const trim = it.id === 'tub2' ? '#74c0fc' : '#adb5bd';
    let s = ishadow(0, 0, w, d, 1, 0.22);
    // the tap at the back of the rim
    s += `<rect x="${IX(w / 2) - 4}" y="${IY(0.06, 1.4)}" width="8" height="${0.5 * I_H}" rx="3" fill="#ced4da" ${OL('#adb5bd', 1.5)}/>
      <path d="M${IX(w / 2)} ${IY(0.06, 1.3)} q10 0 10 10" stroke="#adb5bd" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    for (const x of [0.2, w - 0.35]) s += `<rect x="${IX(x)}" y="${IY(d, 0.12)}" width="${0.15 * I_T}" height="${0.14 * I_H}" rx="3" fill="#ffd43b" ${OL('#fab005', 1.5)}/>`;
    s += ibox(0, 0, w, d, 0.8, c, { y0: 0.1, r: 14, front: darker(c, 0.06), noLit: true });
    // the basin and the water
    s += `<path d="${rpath(IX(0.16), IY(0.14, 0.9), IX(w - 0.32), (d - 0.28) * I_R, 12)}" fill="${darker(c, 0.14)}"/>
      <path d="${rpath(IX(0.2), IY(0.24, 0.9) + 4, IX(w - 0.4), (d - 0.4) * I_R - 4, 10)}" fill="#a5d8ff"/>
      <path d="M${IX(0.5)} ${IY(0.75, 0.9)} q10 -5 20 0 t20 0 t20 0" stroke="#fff" stroke-width="2.5" fill="none"/>`;
    if (it.id === 'tub2') s += [[0.6, 0.55, 8], [1.0, 0.45, 6], [1.55, 0.6, 9], [1.85, 0.42, 5]].map(([x, z, r]) => `<circle cx="${IX(x)}" cy="${IY(z, 0.9)}" r="${r}" fill="#fff" stroke="#a5d8ff" stroke-width="1.5"/>`).join('');
    // the side facing us, drawn again over the pig when he's in the bath
    const side = `<path d="${rpath(IX(0), IY(d, 0.9), IX(w), 0.8 * I_H, 14, false, true)}" fill="${darker(c, 0.06)}" ${OL(trim)}/>
      <path d="M${IX(0.12)} ${IY(d, 0.9) + 2} H${IX(w - 0.12)}" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M${IX(0.3)} ${IY(d, 0.45)} H${IX(w - 0.3)}" ${OL_IN(trim)}/>`;
    s += side;
    return { w, d, h: 1.8, svg: s, over: side, seat: [w / 2, 0.95, 0] };
  },

  // a desk against the wall: the top on a drawer pedestal and a leg, things on it, a chair pulled
  // up; the study has a bookshelf beside it
  desk(it) {
    const dw = it.id === 'desk1' ? 2.0 : 2.4;
    const shelf = it.id === 'desk3';
    const w = dw + (shelf ? 1.2 : 0);
    const d = 1.6;
    const c = '#f0bd85';
    const top = 1.15;
    let s = ishadow(0, 0, w, 1.0, 1.4, 0.22);
    if (shelf) {
      const x = dw + 0.05;
      const sc = '#d39a63';
      s += ibox(x, 0, 1.15, 0.6, 2.05, sc, { front: darker(sc, 0.12) });
      for (let r = 0; r < 3; r++) {
        const by = IY(0.6, 0.15 + r * 0.62);
        s += `<path d="M${IX(x) + 3} ${by} H${IX(x + 1.15) - 3}" stroke="${darker(sc, 0.35)}" stroke-width="2.5"/>`;
        for (let i = 0; i < 6; i++) {
          const bh = 0.38 + ((i * 7 + r * 3) % 4) * 0.05;
          s += `<rect x="${IX(x + 0.1 + i * 0.16)}" y="${by - bh * I_H}" width="${0.14 * I_T}" height="${bh * I_H}" rx="1.5" fill="${['#ff8787', '#74c0fc', '#ffd43b', '#8ce99a', '#b197fc', '#ffa8a8'][(i + r * 2) % 6]}" ${OL('#e9d5db', 1)}/>`;
        }
      }
      s += icyl(x + 0.58, 0.3, 0.14, 0.18, '#f59f80', { y0: 2.05, ol: 2 }) + `<circle cx="${IX(x + 0.52)}" cy="${IY(0.3, 2.36)}" r="6" fill="#69db7c" ${OL('#40c057', 1.5)}/><circle cx="${IX(x + 0.66)}" cy="${IY(0.3, 2.4)}" r="5.5" fill="#8ce99a" ${OL('#40c057', 1.5)}/>`;
    }
    // the dark gap under the top, the pedestal, the right-hand leg
    s += `<rect x="${IX(0.1)}" y="${IY(0.9, top)}" width="${IX(dw - 0.2)}" height="${top * I_H}" fill="${darker(c, 0.55)}" opacity=".35"/>`;
    s += ibox(0.06, 0.08, 0.78, 0.82, top, c, { front: darker(c, 0.1) });
    for (const y of [0.85, 0.42]) s += `<rect x="${IX(0.12)}" y="${IY(0.9, y + 0.3)}" width="${IX(0.66)}" height="${0.32 * I_H}" rx="2" fill="none" ${OL_IN(c)}/><rect x="${IX(0.45) - 5}" y="${IY(0.9, y + 0.15) - 2}" width="10" height="4" rx="2" fill="${darker(c, 0.4)}"/>`;
    s += ibox(dw - 0.2, 0.78, 0.14, 0.12, top, darker(c, 0.08), { r: 2, ol: 2 });
    s += ibox(0, 0, dw, 0.92, 0.12, c, { y0: top, r: 4 });
    // paper, a book, a pencil cup
    const ty = top + 0.12;
    s += `<path d="M${IX(dw * 0.42)} ${IY(0.3, ty)} l${0.5 * I_T} -3 l3 ${0.42 * I_R} l${-0.5 * I_T} 3 Z" fill="#fff" ${OL('#dee2e6', 1.5)}/>
      <path d="M${IX(dw * 0.47)} ${IY(0.42, ty) - 2} h16 M${IX(dw * 0.47)} ${IY(0.52, ty) - 2} h12" stroke="#adb5bd" stroke-width="1.5"/>`;
    s += ibox(dw - 0.85, 0.2, 0.42, 0.32, 0.1, '#ff8787', { y0: ty, r: 2, ol: 1.8 }) + ibox(dw - 0.8, 0.22, 0.38, 0.3, 0.08, '#74c0fc', { y0: ty + 0.1, r: 2, ol: 1.8 });
    s += icyl(dw - 0.22, 0.3, 0.1, 0.2, '#ffd8a8', { y0: ty, ol: 1.6 }) + `<path d="M${IX(dw - 0.25)} ${IY(0.3, ty + 0.2)} l-3 -9 M${IX(dw - 0.19)} ${IY(0.3, ty + 0.2)} l3 -10" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>`;
    if (it.id !== 'desk1') {
      // a desk lamp
      const lx = IX(0.4);
      s += icyl(0.4, 0.3, 0.14, 0.05, '#ffd43b', { y0: ty, ol: 1.6 });
      s += `<path d="M${lx} ${IY(0.3, ty + 0.05)} L${lx + 6} ${IY(0.3, ty + 0.75)} L${lx + 20} ${IY(0.3, ty + 0.95)}" stroke="#868e96" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M${lx + 10} ${IY(0.3, ty + 1.1)} L${lx + 34} ${IY(0.3, ty + 1.1)} L${lx + 28} ${IY(0.3, ty + 0.82)} L${lx + 16} ${IY(0.3, ty + 0.82)} Z" fill="#ffd43b" ${OL('#fab005', 2)}/>`;
    }
    // the chair, its back to us
    const cx = dw / 2 - 0.4;
    const cc = '#ffa3b8';
    s += ibox(cx, 0.82, 0.8, 0.55, 0.1, cc, { y0: 0.6, r: 4, ol: 2 });
    for (const x of [cx + 0.06, cx + 0.64]) s += `<rect x="${IX(x)}" y="${IY(1.42, 0.6)}" width="${0.1 * I_T}" height="${0.6 * I_H}" rx="2" fill="${darker(cc, 0.3)}"/>`;
    s += ibox(cx, 1.36, 0.8, 0.12, 0.85, cc, { y0: 0.6, r: 6, ol: 2 });
    s += iheart(IX(cx + 0.4), IY(1.48, 1.1), lighter(cc, 0.5), 0.9);
    return { w, d, h: 2.3, svg: s };
  },

  // a tall wardrobe: two doors with panels, a cornice, a dark plinth
  wardrobe() {
    const w = 2;
    const d = 0.9;
    const h = 3.4;
    const c = '#f3c79a';
    const fy = (y) => IY(d, y);
    let s = ishadow(0, 0, w, d, h, 0.24);
    s += ibox(0, 0, w, d, h, c, { front: darker(c, 0.08) });
    s += ibox(-0.06, -0.02, w + 0.12, d + 0.08, 0.16, lighter(c, 0.3), { y0: h, r: 3, ol: 2 });
    for (const k of [0, 1]) {
      const x = IX(0.12 + k * 0.9);
      const dw = IX(0.86);
      s += `<rect x="${x}" y="${fy(h - 0.12)}" width="${dw}" height="${(h - 0.4) * I_H}" rx="3" fill="${darker(c, 0.02)}" ${OL_IN(c)}/>
        <rect x="${x + 6}" y="${fy(h - 0.3)}" width="${dw - 12}" height="${1.3 * I_H}" rx="3" fill="none" ${OL_IN(c)}/>
        <rect x="${x + 6}" y="${fy(1.55)}" width="${dw - 12}" height="${1.15 * I_H}" rx="3" fill="none" ${OL_IN(c)}/>`;
    }
    for (const x of [0.92, 1.08]) s += `<circle cx="${IX(x)}" cy="${fy(1.75)}" r="3.5" fill="#ffd43b" ${OL('#fab005', 1.4)}/>`;
    s += iheart(IX(1), fy(h - 0.62), '#ff8fab', 1);
    s += `<rect x="${IX(0.06)}" y="${fy(0.22)}" width="${IX(w - 0.12)}" height="${0.2 * I_H}" fill="${darker(c, 0.35)}"/>`;
    return { w, d, h: h + 0.2, svg: s };
  },

  // a sofa against the wall facing the room: backrest, back cushions, seat, arms; the bear's has
  // ears, the lazy one is two beanbags
  sofa(it) {
    const w = 3;
    const d = 1.4;
    if (it.id === 'sofa3') {
      let s = ishadowE(0.75, 0.85, 0.6, 1) + ishadowE(2.25, 0.75, 0.6, 1);
      s += ibeanbag(0.75, 0.95, '#b197fc') + ibeanbag(2.25, 0.85, '#ffa3b8');
      return { w, d, h: 1.5, svg: s };
    }
    const c = { sofa1: '#ffa3b8', sofa2: '#c98a5e', sofa_bear: '#d9a066' }[it.id] || '#ffa3b8';
    let s = ishadow(0, 0, w, d, 1.5, 0.26);
    if (it.id === 'sofa_bear') for (const x of [0.55, w - 0.55]) s += `<circle cx="${IX(x)}" cy="${IY(0.2, 1.62)}" r="12" fill="${c}" ${OL(c)}/><circle cx="${IX(x)}" cy="${IY(0.2, 1.62)}" r="6" fill="${lighter(c, 0.4)}"/>`;
    s += ibox(0, 0, w, 0.42, 1.6, c, { r: 8 });
    for (const k of [0, 1]) s += ibox(0.42 + k * 1.08, 0.42, 1.08, 0.22, 0.7, lighter(c, 0.18), { y0: 0.72, r: 8, ol: 2 });
    if (it.id === 'sofa2') for (const k of [0, 1]) for (const [dx, dy] of [[0.3, 1.25], [0.78, 1.25], [0.54, 1.0]]) s += `<circle cx="${IX(0.42 + k * 1.08 + dx)}" cy="${IY(0.64, dy)}" r="2.2" fill="${darker(c, 0.3)}"/>`;
    s += ibox(0.4, 0.62, w - 0.8, d - 0.62, 0.42, darker(c, 0.05), { r: 4 });
    for (const k of [0, 1]) s += ibox(0.42 + k * 1.08, 0.62, 1.08, d - 0.66, 0.26, lighter(c, 0.1), { y0: 0.42, r: 7, ol: 2 });
    for (const k of [0, 1]) s += ibox(k * (w - 0.42), 0.3, 0.42, d - 0.3, 1.0, c, { r: 7 });
    for (const k of [0, 1]) s += `<rect x="${IX(0.1 + k * (w - 0.3))}" y="${IY(d) - 1}" width="${0.1 * I_T}" height="5" rx="1.5" fill="${darker(c, 0.5)}"/>`;
    // a heart cushion
    const hx = IX(2.3);
    const hy = IY(0.9, 0.95);
    s += `<path d="M${hx} ${hy + 12} C${hx - 20} ${hy - 2} ${hx - 10} ${hy - 18} ${hx} ${hy - 6} C${hx + 10} ${hy - 18} ${hx + 20} ${hy - 2} ${hx} ${hy + 12} Z" fill="#fff0f5" ${OL('#ffa3b8', 2)}/>`;
    return { w, d, h: 1.8, svg: s };
  },

  // a keyboard on an X stand, an upright piano against the wall, or a grand piano with its tail to
  // the wall; each with a stool or bench in front
  piano(it) {
    if (it.id === 'piano3') {
      const w = 3.4;
      const d = 3.3;
      const c = '#3d3440';
      const lid = 1.55;
      const front = 2.2;
      // the body's outline seen from above: straight bass side, curved tail and bentside
      const outline = (y) => {
        const P = (x, z) => `${IX(x)} ${IY(z, y)}`;
        return `M${P(0.1, front)} L${P(0.1, 0.45)} Q${P(0.1, 0.05)} ${P(0.6, 0.05)} Q${P(1.3, 0.05)} ${P(1.7, 0.5)} Q${P(2.3, 1.15)} ${P(3.0, 1.3)} Q${P(3.3, 1.38)} ${P(3.3, 1.75)} L${P(3.3, front)} Z`;
      };
      let s = ishadow(0.1, 0.1, 3.2, 2.2, 1.6, 0.24);
      for (const [x, z] of [[0.25, front - 0.1], [3.1, front - 0.1], [1.2, 0.4]]) s += `<rect x="${IX(x) - 4}" y="${IY(z, 0.95)}" width="8" height="${0.95 * I_H}" rx="2" fill="${darker(c, 0.2)}"/>`;
      for (let i = 0; i <= 6; i++) s += `<path d="${outline(0.95 + (i / 6) * (lid - 0.95))}" fill="${i === 6 ? c : darker(c, 0.25)}" ${i === 0 || i === 6 ? OL(c) : ''}/>`;
      s += `<path d="M${IX(0.3)} ${IY(0.5, lid) + 3} Q${IX(0.3)} ${IY(0.2, lid) + 3} ${IX(0.7)} ${IY(0.2, lid) + 3}" stroke="${lighter(c, 0.35)}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      // the music stand, the keybed and keys at the front
      s += `<rect x="${IX(1.15)}" y="${IY(front - 0.15, lid + 0.55)}" width="${IX(1.1)}" height="${0.5 * I_H}" rx="2" fill="${darker(c, 0.1)}" ${OL(c, 2)}/><rect x="${IX(1.3)}" y="${IY(front - 0.15, lid + 0.48)}" width="${IX(0.8)}" height="${0.32 * I_H}" fill="#fff" opacity=".85"/>`;
      s += ibox(0.1, front, 3.2, 0.42, 0.22, c, { y0: 0.95, r: 3 });
      s += ikeys(0.25, front + 0.04, 2.9, 0.3, 1.17);
      // the bench
      s += ibox(1.1, 2.75, 1.2, 0.45, 0.62, c, { r: 4 }) + iflat(1.15, 2.78, 1.1, 0.38, '#ff8fab', { y: 0.62, r: 0.08 });
      return { w, d, h: 2.2, svg: s, seat: [1.7, 3.0, 0] };
    }
    if (it.id === 'piano2') {
      const w = 2.45;
      const d = 2.45;
      const c = '#fff8f3';
      let s = ishadow(0, 0, w, 1.3, 2.4, 0.24);
      s += ibox(0, 0, w, 0.75, 2.35, c, { r: 5, front: '#fbe9e3' });
      s += `<rect x="${IX(0.75)}" y="${IY(0.75, 2.05)}" width="${IX(0.95)}" height="${0.48 * I_H}" rx="2" fill="#fff" ${OL('#e9d5db', 1.5)}/>
        <path d="M${IX(0.85)} ${IY(0.75, 1.9)} h${IX(0.7)} M${IX(0.85)} ${IY(0.75, 1.78)} h${IX(0.75)}" stroke="#d0a8b8" stroke-width="1.4"/>
        <rect x="${IX(0.18)}" y="${IY(0.75, 1.0)}" width="${IX(w - 0.36)}" height="${0.75 * I_H}" rx="3" fill="none" stroke="#f0d5d0" stroke-width="2"/>`;
      s += ibox(0.05, 0.75, w - 0.1, 0.45, 0.16, '#f4a9bf', { y0: 1.12, r: 3 });
      s += ikeys(0.15, 0.82, w - 0.3, 0.32, 1.28);
      for (const lx of [0.15, w - 0.3]) s += `<rect x="${IX(lx)}" y="${IY(1.1, 1.12)}" width="${0.15 * I_T}" height="${1.12 * I_H}" rx="2" fill="#fbe9e3" ${OL(c, 2)}/>`;
      s += icyl(0.5, 0.35, 0.13, 0.32, '#a5d8ff', { y0: 2.35, ol: 1.8 }) + `<circle cx="${IX(0.45)}" cy="${IY(0.35, 2.85)}" r="5" fill="#ff8fab"/><circle cx="${IX(0.58)}" cy="${IY(0.35, 2.92)}" r="4.5" fill="#fff"/>`;
      s += ishadowE(w / 2, 2.05, 0.32, 0.7) + icyl(w / 2, 2.05, 0.32, 0.7, '#f4a9bf', { front: '#e98fa9' }) + `<ellipse cx="${IX(w / 2)}" cy="${IY(2.05, 0.7)}" rx="${0.24 * I_T}" ry="${0.24 * I_R}" fill="#ffc9dc"/>`;
      return { w, d, h: 3.1, svg: s, seat: [w / 2, 2.1, 0] };
    }
    const w = 2.0;
    const d = 1.75;
    const c = '#4a3f52';
    let s = ishadow(0.1, 0.2, 1.8, 0.6, 1.2, 0.2);
    s += `<path d="M${IX(0.3)} ${IY(0.75)} L${IX(1.7)} ${IY(0.75, 1.0)} M${IX(1.7)} ${IY(0.75)} L${IX(0.3)} ${IY(0.75, 1.0)}" stroke="#868e96" stroke-width="5" stroke-linecap="round"/>`;
    s += ibox(0, 0.2, w, 0.55, 0.16, c, { y0: 1.0, r: 3 });
    s += ikeys(0.12, 0.3, w - 0.24, 0.32, 1.16);
    s += `<rect x="${IX(0.1)}" y="${IY(0.75, 1.13)}" width="10" height="4" rx="2" fill="#69db7c"/><rect x="${IX(0.1) + 14}" y="${IY(0.75, 1.13)}" width="10" height="4" rx="2" fill="#ff8787"/>`;
    s += ishadowE(w / 2, 1.45, 0.28, 0.6) + icyl(w / 2, 1.45, 0.28, 0.6, '#f4a9bf', { front: '#e98fa9' });
    return { w, d, h: 1.9, svg: s, seat: [w / 2, 1.5, 0] };
  },

  // an easel with a painting on it; the studio adds a paint cart with a palette
  easel(it) {
    const big = it.id === 'easel2';
    const w = big ? 2.3 : 1.3;
    const d = big ? 1.1 : 0.9;
    const c = '#c48a57';
    const cw = big ? 1.2 : 0.9;
    const x0 = 0.65 - cw / 2;
    let s = ishadow(0.2, 0.3, 0.9, 0.5, 2.5, 0.18);
    const leg = (x1, z1, x2, z2, y2, col) => `<path d="M${IX(x1)} ${IY(z1)} L${IX(x2)} ${IY(z2, y2)}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
    s += leg(0.65, 0.12, 0.65, 0.42, 2.45, darker(c, 0.2));
    s += leg(0.18, 0.8, 0.62, 0.55, 2.6, c) + leg(1.12, 0.8, 0.68, 0.55, 2.6, c);
    s += ibox(x0 - 0.06, 0.55, cw + 0.12, 0.16, 0.08, WOOD, { y0: 0.95, r: 2, ol: 2 });
    const cy1 = IY(0.58, big ? 2.45 : 2.25);
    const cy2 = IY(0.58, 1.05);
    s += `<rect x="${IX(x0)}" y="${cy1}" width="${IX(cw)}" height="${cy2 - cy1}" rx="2" fill="#fff" ${OL('#e9d5db', 2)}/>
      <rect x="${IX(x0) + 4}" y="${cy1 + 4}" width="${IX(cw) - 8}" height="${(cy2 - cy1) * 0.55}" fill="#d0ebff"/>
      <path d="M${IX(x0) + 4} ${cy2 - 4} V${cy1 + (cy2 - cy1) * 0.62} q${IX(cw) * 0.25} -14 ${IX(cw) * 0.5} -2 t${IX(cw) * 0.5 - 8} -4 V${cy2 - 4} Z" fill="#8ce99a"/>
      <circle cx="${IX(x0 + cw * 0.72)}" cy="${cy1 + 13}" r="6" fill="#ffd43b"/>
      <path d="M${IX(x0 + cw * 0.2)} ${cy2 - 10} q6 -8 12 0 q6 -8 12 0" stroke="#ff8fab" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (big) {
      const kx = 1.45;
      s += ishadow(kx, 0.35, 0.75, 0.6, 1, 0.2);
      s += ibox(kx, 0.35, 0.75, 0.6, 0.85, '#ffd8a8', { r: 4 });
      s += `<path d="M${IX(kx) + 4} ${IY(0.95, 0.45)} H${IX(kx + 0.75) - 4}" ${OL_IN('#ffd8a8')}/>`;
      s += `<ellipse cx="${IX(kx + 0.4)}" cy="${IY(0.62, 0.85)}" rx="${0.3 * I_T}" ry="${0.22 * I_R}" fill="#fff4e6" ${OL('#e0a96d', 1.5)}/>
        ${[['#ff6b6b', 0.25, 0.55], ['#4dabf7', 0.42, 0.5], ['#ffd43b', 0.55, 0.65], ['#69db7c', 0.33, 0.72]].map(([col, x, z]) => `<circle cx="${IX(kx + x)}" cy="${IY(z, 0.85)}" r="3.2" fill="${col}"/>`).join('')}`;
      s += icyl(kx + 0.6, 0.48, 0.1, 0.2, '#a5d8ff', { y0: 0.85, ol: 1.5 }) + `<path d="M${IX(kx + 0.57)} ${IY(0.48, 1.05)} l-3 -12 M${IX(kx + 0.63)} ${IY(0.48, 1.05)} l4 -11" stroke="#c48a57" stroke-width="2" stroke-linecap="round"/>`;
    }
    return { w, d, h: big ? 2.7 : 2.6, svg: s, seat: [big ? -0.35 : w + 0.35, d * 0.8, 0] };
  },

  // kitchen counters along the wall: cupboards and an oven below, sink and hob on the worktop,
  // wall cupboards and a hood above; the big one has a fridge
  kitchen(it) {
    const big = it.id === 'kitchen2';
    const cw = big ? 3.4 : 2.8;
    const w = big ? cw + 1.15 : cw;
    const d = 1.15;
    const h = 1.5;
    const c = '#f8f9fa';
    let s = ishadow(0, 0, w, d, 1.6, 0.22);
    // wall cupboards and the hood
    s += ibox(0.05, 0, 1.25, 0.5, 0.85, '#fff8f3', { y0: 3.0, r: 3, front: '#fbe9e3' });
    s += `<path d="M${IX(0.67)} ${IY(0.5, 3.8)} V${IY(0.5, 3.05)}" ${OL_IN('#fbe9e3')}/>`;
    const hx = cw - 1.15;
    s += `<path d="M${IX(hx + 0.25)} ${IY(0.3, 3.5)} H${IX(hx + 0.85)} L${IX(hx + 1.0)} ${IY(0.45, 2.75)} H${IX(hx + 0.1)} Z" fill="#dee2e6" ${OL('#ced4da', 2)}/>`;
    // the base units
    s += ibox(0, 0.05, cw, d - 0.05, h - 0.12, c, { front: '#e9ecef' });
    s += `<rect x="${IX(0.08)}" y="${IY(d, h - 0.2)}" width="${IX(cw - 0.16)}" height="${0.16 * I_H}" fill="none" ${OL_IN('#ced4da')}/>`;
    for (let i = 0; i < Math.floor(cw / 0.7) - 2; i++) s += `<rect x="${IX(0.12 + i * 0.7)}" y="${IY(d, h - 0.42)}" width="${IX(0.62)}" height="${(h - 0.6) * I_H}" rx="2" fill="#fff" ${OL_IN('#ced4da')}/><rect x="${IX(0.38 + i * 0.7)}" y="${IY(d, h - 0.55)}" width="${IX(0.12)}" height="3" rx="1.5" fill="#adb5bd"/>`;
    s += `<rect x="${IX(hx + 0.08)}" y="${IY(d, h - 0.4)}" width="${IX(1.0)}" height="${(h - 0.6) * I_H}" rx="3" fill="#495057" ${OL('#868e96', 1.5)}/><rect x="${IX(hx + 0.2)}" y="${IY(d, h - 0.62)}" width="${IX(0.76)}" height="${(h - 1.05) * I_H}" rx="3" fill="#ffd8a8" opacity=".8"/>`;
    s += `<rect x="${IX(0.06)}" y="${IY(d, 0.1)}" width="${IX(cw - 0.12)}" height="${0.1 * I_H}" fill="#868e96"/>`;
    s += ibox(-0.04, 0, cw + 0.08, d + 0.04, 0.12, '#ffe8cc', { y0: h - 0.12, r: 3 });
    // the sink and the hob
    s += `<path d="${rpath(IX(0.3), IY(0.28, h), IX(0.95), 0.6 * I_R, 6)}" fill="#cfe2f3" ${OL('#a5c8e4', 2)}/>
      <path d="M${IX(0.78)} ${IY(0.18, h)} v-10 q0 -6 7 -6 q6 0 6 6" stroke="#adb5bd" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    s += iflat(hx + 0.08, 0.2, 1.0, 0.75, '#495057', { y: h, r: 0.08 });
    for (const [x, z] of [[0.33, 0.4], [0.78, 0.4], [0.33, 0.75], [0.78, 0.75]]) s += `<ellipse cx="${IX(hx + x)}" cy="${IY(z, h)}" rx="9" ry="5.5" fill="none" stroke="#868e96" stroke-width="2.5"/>`;
    s += icyl(hx + 0.78, 0.42, 0.2, 0.18, '#ff8787', { y0: h, ol: 1.8 }) + `<path d="M${IX(hx + 0.98)} ${IY(0.42, h + 0.12)} h10" stroke="#e03131" stroke-width="3" stroke-linecap="round"/>`;
    if (big) {
      const fx = cw + 0.05;
      s += ishadow(fx, 0, 1.05, 1.0, 2.5, 0.22);
      s += ibox(fx, 0, 1.05, 1.0, 3.2, '#e7f5ff', { r: 6 });
      s += `<path d="M${IX(fx) + 3} ${IY(1.0, 2.1)} H${IX(fx + 1.05) - 3}" ${OL_IN('#e7f5ff')}/>
        <rect x="${IX(fx + 0.12)}" y="${IY(1.0, 2.9)}" width="4" height="${0.6 * I_H}" rx="2" fill="#adb5bd"/><rect x="${IX(fx + 0.12)}" y="${IY(1.0, 1.85)}" width="4" height="${0.8 * I_H}" rx="2" fill="#adb5bd"/>
        <circle cx="${IX(fx + 0.7)}" cy="${IY(1.0, 2.6)}" r="5" fill="#ff8787"/><rect x="${IX(fx + 0.55)}" y="${IY(1.0, 1.6)}" width="14" height="10" rx="2" fill="#ffd43b" transform="rotate(-8 ${IX(fx + 0.6)} ${IY(1.0, 1.5)})"/>`;
    }
    return { w, d, h: big ? 3.4 : 2.2, svg: s };
  },

  // a big cooking pot on its own little stove, steaming
  pot() {
    const w = 1.2;
    const d = 0.9;
    let s = ishadow(0, 0, w, d, 1.2, 0.22);
    s += ibox(0, 0, w, d, 0.95, '#868e96', { front: '#6c7580', r: 4 });
    s += `<rect x="${IX(0.15)}" y="${IY(d, 0.8)}" width="${IX(w - 0.3)}" height="${0.42 * I_H}" rx="3" fill="#495057"/><rect x="${IX(0.22)}" y="${IY(d, 0.72)}" width="${IX(w - 0.44)}" height="${0.24 * I_H}" rx="2" fill="#ff922b" opacity=".75"/>`;
    for (const x of [0.3, 0.6, 0.9]) s += `<circle cx="${IX(x)}" cy="${IY(d, 0.18)}" r="3.5" fill="#dee2e6"/>`;
    s += icyl(0.6, 0.45, 0.4, 0.42, '#adb5bd', { y0: 0.95, front: '#9aa3ad' });
    s += `<ellipse cx="${IX(0.6)}" cy="${IY(0.45, 1.37)}" rx="${0.32 * I_T}" ry="${0.32 * I_R}" fill="#ffa94d"/>
      <path d="M${IX(0.2) - 6} ${IY(0.45, 1.25)} h6 M${IX(1.0)} ${IY(0.45, 1.25)} h6" stroke="#495057" stroke-width="4" stroke-linecap="round"/>
      <g class="steam"><path d="M${IX(0.5)} ${IY(0.45, 1.5)} q-6 -12 0 -22 M${IX(0.72)} ${IY(0.45, 1.5)} q-6 -12 0 -22" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/></g>`;
    return { w, d, h: 2.1, svg: s };
  },

  // a bubble machine: a round window on the front, bubbles drifting up from the dome
  bubbler() {
    const w = 0.9;
    const d = 0.7;
    let s = ishadow(0, 0, w, d, 1, 0.2);
    s += ibox(0, 0, w, d, 0.75, '#74c0fc', { r: 5 });
    s += `<circle cx="${IX(w / 2)}" cy="${IY(d, 0.4)}" r="8" fill="#fff" ${OL('#4dabf7', 2)}/><circle cx="${IX(w / 2) - 2}" cy="${IY(d, 0.4) - 2}" r="2.5" fill="#d0ebff"/>`;
    s += icyl(w / 2, d / 2, 0.24, 0.18, '#d0ebff', { y0: 0.75, ol: 2 });
    s += `<g class="rise"><circle cx="${IX(0.25)}" cy="${IY(0.3, 1.5)}" r="7" fill="#fff" opacity=".85" stroke="#a5d8ff" stroke-width="1.5"/><circle cx="${IX(0.7)}" cy="${IY(0.3, 1.95)}" r="5" fill="#fff" opacity=".85" stroke="#a5d8ff" stroke-width="1.5"/><circle cx="${IX(0.4)}" cy="${IY(0.3, 2.3)}" r="4" fill="#fff" opacity=".85" stroke="#a5d8ff" stroke-width="1.5"/></g>`;
    return { w, d, h: 1.4, svg: s };
  },

  // ---- decorations ----

  // a round rug, lying flat on the floor
  rug: () => {
    const r = 1.9;
    return { w: 2 * r, d: 2 * r, flat: true, svg: `<ellipse cx="${IX(r) + 3}" cy="${IY(r) + 4}" rx="${IX(r)}" ry="${r * I_R}" fill="#6b3a4e" opacity=".1"/>
      <ellipse cx="${IX(r)}" cy="${IY(r)}" rx="${IX(r)}" ry="${r * I_R}" fill="#ffc9dc" ${OL('#f783ac', 2.5)}/>
      <ellipse cx="${IX(r)}" cy="${IY(r)}" rx="${IX(r - 0.32)}" ry="${(r - 0.32) * I_R}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="9 7"/>
      ${[[-0.75, 0.15], [0, -0.35], [0.75, 0.15], [0, 0.55]].map(([x, z]) => iheart(IX(r + x), IY(r + z) - 4, '#ff8fab', 1, 'opacity=".8"')).join('')}` };
  },
  plant: () => ({ w: 0.9, d: 0.9, h: 2.4, svg: iplant(0.45, 0.45, 1.25) }),
  // a fish tank on a low cabinet
  aquarium: () => {
    const w = 2.1;
    let s = ishadow(0, 0, w, 0.9, 1.8, 0.24);
    s += ibox(0, 0, w, 0.9, 0.9, '#fff8f3', { front: '#fbe9e3', r: 4 });
    s += `<path d="M${IX(1.05)} ${IY(0.9, 0.82)} V${IY(0.9, 0.08)}" ${OL_IN('#fbe9e3')}/><circle cx="${IX(0.9)}" cy="${IY(0.9, 0.45)}" r="2.5" fill="#f4a9bf"/><circle cx="${IX(1.2)}" cy="${IY(0.9, 0.45)}" r="2.5" fill="#f4a9bf"/>`;
    const gx = 0.12;
    const gw = 1.86;
    s += `<path d="${rpath(IX(gx), IY(0.12, 1.75), IX(gw), 0.66 * I_R, 3, true, false)}" fill="#d0ebff" ${OL('#74c0fc', 2)}/>
      <path d="${rpath(IX(gx), IY(0.78, 1.75), IX(gw), 0.85 * I_H, 3, false, true)}" fill="#a5d8ff" ${OL('#74c0fc', 2)}/>
      <rect x="${IX(gx) + 3}" y="${IY(0.78, 1.6)}" width="${IX(gw) - 6}" height="${0.15 * I_H}" fill="#d0ebff" opacity=".7"/>
      <path d="M${IX(gx) + 6} ${IY(0.78, 0.9) - 2} q8 -10 14 0 q6 -12 12 0" fill="#69db7c"/>
      <ellipse cx="${IX(gx + 0.6)}" cy="${IY(0.78, 1.3)}" rx="7" ry="4.5" fill="#ff922b"/><path d="M${IX(gx + 0.6) - 7} ${IY(0.78, 1.3)} l-6 -4 v8 z" fill="#ff922b"/>
      <ellipse cx="${IX(gx + 1.3)}" cy="${IY(0.78, 1.12)}" rx="6" ry="4" fill="#ffd43b"/><path d="M${IX(gx + 1.3) + 6} ${IY(0.78, 1.12)} l6 -4 v8 z" fill="#ffd43b"/>
      <circle cx="${IX(gx + 1.0)}" cy="${IY(0.78, 1.45)}" r="2.2" fill="#fff" opacity=".8"/><circle cx="${IX(gx + 1.05)}" cy="${IY(0.78, 1.55)}" r="1.6" fill="#fff" opacity=".8"/>
      <path d="M${IX(gx) + 5} ${IY(0.78, 1.55)} v${0.5 * I_H}" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
    return { w, d: 0.9, h: 1.9, svg: s };
  },
  // a glass-fronted cabinet of cups and medals
  trophy: () => {
    const w = 1.6;
    const d = 0.7;
    const h = 2.6;
    const c = '#d39a63';
    let s = ishadow(0, 0, w, d, h, 0.24);
    s += ibox(0, 0, w, d, h, c, { front: darker(c, 0.1) });
    const gx = IX(0.12);
    const gw = IX(w - 0.24);
    s += `<rect x="${gx}" y="${IY(d, h - 0.12)}" width="${gw}" height="${(h - 0.4) * I_H}" rx="2" fill="#f1f8ff" ${OL_IN(c)}/>`;
    for (const y of [0.95, 1.75]) s += `<path d="M${gx} ${IY(d, y)} h${gw}" stroke="${c}" stroke-width="3"/>`;
    s += icup(IX(0.5), IY(d, 1.75), 0.9) + icup(IX(1.1), IY(d, 1.75), 1.15);
    s += icup(IX(0.8), IY(d, 0.95), 1);
    for (const [x, col] of [[0.35, '#ced4da'], [1.25, '#e8a87c']]) s += `<path d="M${IX(x) - 4} ${IY(d, 1.45)} l4 8 l4 -8" stroke="#4dabf7" stroke-width="3" fill="none"/><circle cx="${IX(x)}" cy="${IY(d, 1.15)}" r="5.5" fill="${col}" ${OL(col, 1.3)}/>`;
    s += `<rect x="${IX(w / 2) - 7}" y="${IY(d, 0.28)}" width="14" height="5" rx="2" fill="#ffd43b"/>`;
    s += `<path d="M${gx + 5} ${IY(d, h - 0.3)} l10 ${-0.0} M${gx + 6} ${IY(d, h - 0.4)} l${0.25 * I_T} ${0.9 * I_H}" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>`;
    return { w, d, h: h + 0.1, svg: s };
  },
  // a globe on a little stand
  globe: () => {
    const cx = IX(0.4);
    const cy = IY(0.4, 1.05);
    const r = 0.34 * I_T;
    let s = ishadowE(0.4, 0.4, 0.32, 1.2) + icyl(0.4, 0.4, 0.26, 0.08, WOOD_D, { ol: 2 });
    s += `<rect x="${cx - 2.5}" y="${IY(0.4, 0.62)}" width="5" height="${0.55 * I_H}" fill="${WOOD_D}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#74c0fc" ${OL('#4dabf7', 2)}/>
      <path d="M${cx - 10} ${cy - 9} q6 -4 10 0 q4 6 -2 10 q-6 2 -8 -4 z M${cx + 3} ${cy + 4} q6 -2 8 3 q-2 7 -8 5 z M${cx + 6} ${cy - 12} q5 0 6 4 q-4 2 -6 -4 z" fill="#8ce99a"/>
      <circle cx="${cx - 6}" cy="${cy - 7}" r="3" fill="#fff" opacity=".6"/>
      <path d="M${cx - r - 4} ${cy} A${r + 4} ${r + 4} 0 0 1 ${cx + r + 4} ${cy}" stroke="${WOOD_D}" stroke-width="3" fill="none" transform="rotate(-25 ${cx} ${cy})"/>`;
    return { w: 0.8, d: 0.8, h: 1.7, svg: s };
  },
  // a little tree with a house in it, a ladder up
  treehouse: () => {
    const w = 1.8;
    const d = 1.6;
    let s = ishadowE(0.9, 0.9, 0.75, 2.5, 0.2);
    const leaves = (list) => list.map(([x, z, y, r, c]) => `<circle cx="${IX(x)}" cy="${IY(z, y)}" r="${r * I_T}" fill="${c}" ${OL('#40c057', 2)}/>`).join('');
    s += leaves([[0.45, 0.6, 3.1, 0.42, '#69db7c'], [1.35, 0.6, 3.15, 0.45, '#69db7c'], [0.9, 0.5, 3.6, 0.5, '#8ce99a']]);
    s += icyl(0.9, 0.9, 0.2, 2.2, '#b07a4f', { front: '#9c6a43' });
    s += ibox(0.25, 0.5, 1.3, 0.9, 0.12, WOOD, { y0: 1.45, r: 3, front: WOOD_D });
    s += ibox(0.4, 0.55, 1.0, 0.65, 0.7, '#ffd8a8', { y0: 1.57, r: 3 });
    s += `<path d="${rpath(IX(0.8), IY(1.2, 1.97), IX(0.22), 0.4 * I_H, 5, true, false)}" fill="${WOOD_D}"/><rect x="${IX(0.5)}" y="${IY(1.2, 2.05)}" width="${IX(0.2)}" height="${0.22 * I_H}" rx="2" fill="#a5d8ff" ${OL('#74c0fc', 1.2)}/>`;
    // the roof: two slopes seen from above and the gable facing us
    const P = (x, z, y) => `${IX(x)},${IY(z, y)}`;
    s += `<polygon points="${P(0.3, 1.25, 2.27)} ${P(0.9, 1.25, 2.85)} ${P(0.9, 0.5, 2.85)} ${P(0.3, 0.5, 2.27)}" fill="#ff8787" ${OL('#ff8787', 2)}/>
      <polygon points="${P(1.5, 1.25, 2.27)} ${P(0.9, 1.25, 2.85)} ${P(0.9, 0.5, 2.85)} ${P(1.5, 0.5, 2.27)}" fill="#ffa8a8" ${OL('#ff8787', 2)}/>
      <polygon points="${P(0.4, 1.2, 2.27)} ${P(1.4, 1.2, 2.27)} ${P(0.9, 1.2, 2.75)}" fill="#ffe8cc" ${OL('#ffd8a8', 2)}/>`;
    s += leaves([[0.2, 1.1, 2.75, 0.24, '#69db7c'], [1.6, 1.1, 2.7, 0.26, '#8ce99a']]);
    // the ladder
    s += `<path d="M${IX(0.2)} ${IY(d)} L${IX(0.32)} ${IY(1.4, 1.45)} M${IX(0.55)} ${IY(d)} L${IX(0.62)} ${IY(1.4, 1.45)}" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/>
      ${[0.3, 0.65, 1.0, 1.3].map((y) => `<path d="M${IX(0.22 + y * 0.07)} ${IY(d - y * 0.13, y)} H${IX(0.56 + y * 0.04)}" stroke="${WOOD_D}" stroke-width="2.5"/>`).join('')}`;
    return { w, d, h: 4.1, svg: s };
  },
  // a round chess table with a stool either side
  chesstable: () => {
    const xc = 1.55;
    const zc = 0.85;
    let s = ishadowE(xc, zc, 0.85, 1);
    const stool = (k) => ishadowE(xc + k * 1.25, zc + 0.15, 0.3, 0.6) + icyl(xc + k * 1.25, zc + 0.15, 0.3, 0.55, '#ffd8a8', { front: '#f7c38a' }) + `<ellipse cx="${IX(xc + k * 1.25)}" cy="${IY(zc + 0.15, 0.55)}" rx="${0.22 * I_T}" ry="${0.22 * I_R}" fill="#ffc9dc"/>`;
    s += stool(-1) + stool(1);
    s += icyl(xc, zc, 0.35, 0.05, WOOD_D, { ol: 2 });
    s += `<rect x="${IX(xc) - 5}" y="${IY(zc, 0.85)}" width="10" height="${0.82 * I_H}" fill="${WOOD_D}" ${OL(WOOD_D, 2)}/>`;
    s += icyl(xc, zc, 0.8, 0.12, '#f7d9b4', { y0: 0.85, front: WOOD });
    const n = 4;
    const bs = 1.0 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += `<rect x="${IX(xc - 0.5 + i * bs)}" y="${IY(zc - 0.5 + j * bs, 0.97)}" width="${IX(bs)}" height="${bs * I_R}" fill="${(i + j) % 2 ? '#8a5a44' : '#fff4e6'}"/>`;
    s += `<rect x="${IX(xc - 0.5)}" y="${IY(zc - 0.5, 0.97)}" width="${I_T}" height="${I_R}" fill="none" ${OL('#8a5a44', 1.5)}/>`;
    s += `<circle cx="${IX(xc - 0.2)}" cy="${IY(zc - 0.1, 1.05)}" r="4" fill="#fff" ${OL('#e9d5db', 1.4)}/><circle cx="${IX(xc + 0.25)}" cy="${IY(zc + 0.2, 1.05)}" r="4" fill="#4a2c38"/>`;
    return { w: 3.1, d: 1.7, h: 1.3, svg: s };
  },
  // on the wall: a famous painting in a gold frame (sunflowers in a vase)
  painting: () => {
    const fw = IX(1.9);
    const fh = 1.35 * I_H;
    const x = -fw / 2;
    const y = -fh / 2;
    return { wall: true, w: 1.9, svg: `<rect x="${x + 4}" y="${y + 5}" width="${fw}" height="${fh}" rx="3" fill="#6b3a4e" opacity=".14"/>
      <rect x="${x}" y="${y}" width="${fw}" height="${fh}" rx="3" fill="#ffd43b" ${OL('#e9b200', 2.5)}/>
      <rect x="${x + 4}" y="${y + 4}" width="${fw - 8}" height="${fh - 8}" rx="2" fill="none" stroke="#fff3bf" stroke-width="1.5"/>
      <rect x="${x + 8}" y="${y + 8}" width="${fw - 16}" height="${fh - 16}" fill="#5c7cfa"/>
      <rect x="${x + 8}" y="${y + fh - 18}" width="${fw - 16}" height="10" fill="#e0a96d"/>
      <path d="M-11 ${y + fh - 18} L-14 ${y + fh - 32} Q0 ${y + fh - 38} 14 ${y + fh - 32} L11 ${y + fh - 18} Z" fill="#ffa94d" ${OL('#e8590c', 1.2)}/>
      ${[[-16, -6], [0, -12], [15, -5], [-6, 2], [9, 3]].map(([dx, dy]) => `<circle cx="${dx}" cy="${dy}" r="7" fill="#ffd43b" ${OL('#f59f00', 1.2)}/><circle cx="${dx}" cy="${dy}" r="3" fill="#8a5a44"/>`).join('')}` };
  },
  // on the wall: a red lantern hanging from a bracket
  lamp: () => ({ wall: true, w: 0.7, svg: `<path d="M-10 -40 h10 v4" stroke="#8a5a44" stroke-width="3" fill="none"/><path d="M0 -36 V-22" stroke="#8a5a44" stroke-width="1.5"/>
    <ellipse cx="2" cy="4" rx="18" ry="20" fill="#6b3a4e" opacity=".12"/>
    <rect x="-9" y="-24" width="18" height="5" rx="2" fill="#ffd43b" ${OL('#fab005', 1.3)}/><rect x="-9" y="17" width="18" height="5" rx="2" fill="#ffd43b" ${OL('#fab005', 1.3)}/>
    <ellipse cx="0" cy="-1" rx="17" ry="19" fill="#ff6b6b" ${OL('#e03131', 2)}/>
    <path d="M-8 -17 Q-14 -1 -8 16 M0 -19 V17 M8 -17 Q14 -1 8 16" stroke="#e03131" stroke-width="1.4" fill="none"/>
    <ellipse cx="-7" cy="-6" rx="3" ry="6" fill="#fff" opacity=".35"/>
    <path d="M0 22 V30 M-3 30 l3 9 l3 -9 z" stroke="#e03131" stroke-width="2" fill="#ff8787"/>` }),
  // ---- keepsakes from friends ----

  // the rabbit's carrot pillow, a big floor cushion
  carrotpillow: () => {
    const w = 1.3;
    const d = 0.8;
    const y = IY(0.45, 0.32);
    let s = ishadowE(0.65, 0.45, 0.6, 0.5);
    s += `<path d="M${IX(0.25)} ${y - 14} Q${IX(0.7)} ${y - 18} ${IX(1.3)} ${y} Q${IX(0.7)} ${y + 18} ${IX(0.25)} ${y + 14} Q${IX(0.05)} ${y} ${IX(0.25)} ${y - 14} Z" fill="#ff922b" ${OL('#ff922b')}/>
      <path d="M${IX(0.55)} ${y - 13} q-4 13 0 26 M${IX(0.85)} ${y - 9} q-3 9 0 18" stroke="#e8590c" stroke-width="1.6" fill="none"/>
      <path d="M${IX(0.25)} ${y - 13} q4 6 -1 13 q-4 4 -5 13" stroke="#ffd8a8" stroke-width="3" fill="none" opacity=".6"/>
      ${[[-14, -18], [-18, -6], [-14, 6]].map(([dx, dy]) => `<ellipse cx="${IX(0.2) + dx}" cy="${y + dy}" rx="11" ry="5" fill="#69db7c" ${OL('#69db7c', 1.6)} transform="rotate(${dy * 1.5} ${IX(0.2) + dx} ${y + dy})"/>`).join('')}`;
    return { w, d, h: 0.9, svg: s };
  },
  // the panda's bamboo in a little square pot
  bonsai: () => {
    const xc = 0.5;
    const zc = 0.4;
    let s = ishadowE(xc, zc, 0.35, 2) + ibox(xc - 0.3, zc - 0.25, 0.6, 0.5, 0.45, '#9fb8c4', { r: 3 });
    for (const [dx, h, c] of [[-0.1, 2.3, '#7cb85c'], [0.1, 2.7, '#69a94c'], [0.2, 1.9, '#8fc56c']]) {
      s += `<rect x="${IX(xc + dx) - 2.5}" y="${IY(zc, h)}" width="5" height="${(h - 0.45) * I_H}" rx="2.5" fill="${c}"/>`;
      for (let y = 1.0; y < h; y += 0.6) s += `<path d="M${IX(xc + dx) - 2.5} ${IY(zc, y)} h5" stroke="${darker(c, 0.3)}" stroke-width="1.3"/>`;
      s += `<path d="M${IX(xc + dx)} ${IY(zc, h - 0.2)} q${dx < 0 ? -10 : 10} -5 ${dx < 0 ? -18 : 18} 2 q${dx < 0 ? 8 : -8} 3 ${dx < 0 ? 18 : -18} -2 Z" fill="#69b84a"/>`;
    }
    return { w: 1.0, d: 0.8, h: 2.8, svg: s };
  },
  // the hedgehog's apple tree in a pot, its first apples on it
  appletree: () => {
    const xc = 0.6;
    const zc = 0.45;
    let s = ishadowE(xc, zc, 0.45, 2.4) + icyl(xc, zc, 0.32, 0.5, '#e8825c', { ol: 2 });
    s += `<path d="M${IX(xc)} ${IY(zc, 0.5)} V${IY(zc, 1.5)} M${IX(xc)} ${IY(zc, 1.2)} l-10 -10" stroke="#8a5c36" stroke-width="5" stroke-linecap="round"/>`;
    for (const [dx, dy, r] of [[-14, -6, 16], [14, -8, 17], [0, -22, 19]]) s += `<circle cx="${IX(xc) + dx}" cy="${IY(zc, 1.6) + dy}" r="${r}" fill="#69db7c" ${OL('#40c057', 2)}/>`;
    for (const [dx, dy] of [[-16, -2], [12, -12], [2, -26], [18, 2]]) s += `<circle cx="${IX(xc) + dx}" cy="${IY(zc, 1.6) + dy}" r="5" fill="#fa5252" ${OL('#fa5252', 1.2)}/>`;
    return { w: 1.2, d: 0.9, h: 2.8, svg: s };
  },

  // on the wall: a starry night, the moon and a string of little star lights
  stars: () => {
    const w = IX(2.6);
    const h = 1.5 * I_H;
    const pts = [[-0.42, -0.25], [-0.25, 0.2], [-0.05, -0.32], [0.12, 0.05], [0.3, -0.15], [0.4, 0.28], [-0.36, 0.05], [0.05, 0.3], [0.22, -0.34]];
    return { wall: true, w: 2.6, svg: `<rect x="${-w / 2 + 4}" y="${-h / 2 + 5}" width="${w}" height="${h}" rx="10" fill="#6b3a4e" opacity=".14"/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="10" fill="#2b2d54" ${OL('#5c5f8f', 2.5)}/>
      ${pts.map(([u, v], i) => `<circle cx="${u * w}" cy="${v * h}" r="${i % 3 ? 1.8 : 2.6}" fill="#fff3bf" class="twinkle" style="animation-delay:${-i * 0.37}s"/>`).join('')}
      <path d="M${w * 0.28} ${-h * 0.18} a13 13 0 1 0 13 -16 a10 10 0 1 1 -13 16" fill="#ffd43b"/>
      <path d="M${-w / 2 + 4} ${-h / 2 - 6} Q0 ${-h / 2 + 10} ${w / 2 - 4} ${-h / 2 - 6}" stroke="#adb5bd" stroke-width="1.2" fill="none"/>
      ${[-0.36, -0.18, 0, 0.18, 0.36].map((u) => `<path d="M${u * w} ${-h / 2 + 4 - (1 - Math.abs(u) * 2) * 0} m0 -5 l2 4 l4.5 .5 l-3.3 3 l1 4.5 l-4.2 -2.4 l-4.2 2.4 l1 -4.5 l-3.3 -3 l4.5 -.5 z" fill="#ffe066" class="twinkle" style="animation-delay:${u * 2}s"/>`).join('')}` };
  },
};

// Things that come with a room rather than being bought: rugs, a coffee table, nightstands, a
// plant, a dining table in the kitchen, a telescope in the star tower. Same shape as the furniture
// drawings; o: the fixture's own options from the layout (unless: a furniture group it stands in
// for until one is bought).
const RUG_LOOKS = {
  pink: ['#ffc9dc', '#f783ac', '#ff8fab'], lilac: ['#e5dbff', '#b197fc', '#d0bfff'], lemon: ['#fff3bf', '#fcc419', '#ffd43b'],
  mint: ['#d3f9d8', '#69db7c', '#b2f2bb'], night: ['#3b3e75', '#7c7fc4', '#ffe066'], sky: ['#d0ebff', '#74c0fc', '#a5d8ff'],
};
const FIXTURE_ART = {
  // a rectangular rug with a stitched border and little hearts (stars in the tower)
  rug: (o) => {
    const [c, edge, dot] = RUG_LOOKS[o.look || 'pink'];
    const { w, d } = o;
    const n = Math.max(1, Math.round(w / 1.3));
    let s = iflat(0.06, 0.1, w, d, '#6b3a4e', { r: 0.4, attrs: 'opacity=".1"' });
    s += iflat(0, 0, w, d, c, { r: 0.4, attrs: OL(edge, 2.5) });
    s += iflat(0.28, 0.28, w - 0.56, d - 0.56, 'none', { r: 0.25, attrs: 'stroke="#fff" stroke-width="3" stroke-dasharray="9 7"' });
    if (o.look === 'night') s += [...Array(n)].map((_, i) => `<circle cx="${IX(((i + 0.5) * w) / n)}" cy="${IY(d - 0.55)}" r="3" fill="${dot}"/>`).join('');
    else if (d > 1.6) s += [...Array(n)].map((_, i) => iheart(IX(((i + 0.5) * w) / n), IY(d - 0.72), dot, 1, 'opacity=".8"')).join('');
    return { w, d, flat: true, svg: s };
  },
  // a little bath mat
  mat: (o) => {
    const [c, edge] = RUG_LOOKS[o.look || 'sky'];
    return { w: o.w || 1.6, d: 0.6, flat: true, svg: iflat(0, 0, o.w || 1.6, 0.6, c, { r: 0.18, attrs: OL(edge, 2) }) + iflat(0.15, 0.15, (o.w || 1.6) - 0.3, 0.3, 'none', { r: 0.1, attrs: 'stroke="#fff" stroke-width="1.6"' }) };
  },
  // the low table in front of the sofa: a teapot, a cup and a plate of biscuits on it
  coffee: () => {
    const w = 2;
    const d = 1;
    const c = '#f7d9b4';
    let s = ishadow(0.1, 0.1, w - 0.2, d - 0.2, 0.8, 0.18);
    for (const lx of [0.15, w - 0.27]) s += `<rect x="${IX(lx)}" y="${IY(0.25, 0.68)}" width="${0.12 * I_T}" height="${0.68 * I_H}" rx="2" fill="${darker(WOOD_D, 0.2)}"/>`;
    for (const lx of [0.12, w - 0.26]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.1, 0.68)}" width="${0.14 * I_T}" height="${0.68 * I_H}" rx="2" fill="${WOOD_D}" ${OL(WOOD_D, 2)}/>`;
    s += ibox(0, 0, w, d, 0.16, c, { y0: 0.66, r: 5, front: WOOD });
    s += icyl(0.6, 0.45, 0.2, 0.26, '#ffffff', { y0: 0.82, ol: 2 }) + `<ellipse cx="${IX(0.6)}" cy="${IY(0.45, 1.08)}" rx="4" ry="3" fill="#ff8fab"/>
      <path d="M${IX(0.8)} ${IY(0.45, 0.98)} q8 -2 10 -9" stroke="#e9d5db" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    s += icyl(1.3, 0.55, 0.11, 0.14, '#ffc9dc', { y0: 0.82, ol: 1.8 });
    s += `<ellipse cx="${IX(1.62)}" cy="${IY(0.4, 0.83)}" rx="${0.2 * I_T}" ry="${0.2 * I_R}" fill="#fff" ${OL('#e9d5db', 1.6)}/>
      <circle cx="${IX(1.56)}" cy="${IY(0.4, 0.86)}" r="3.5" fill="#e0a96d"/><circle cx="${IX(1.68)}" cy="${IY(0.37, 0.86)}" r="3.5" fill="#e0a96d"/>`;
    return { w, d, h: 1.1, svg: s };
  },
  // a bedside table with a drawer and a little lamp
  nightstand: () => {
    const c = '#f3c79a';
    let s = ishadow(0, 0, 0.7, 0.6, 0.8, 0.2);
    s += ibox(0, 0, 0.7, 0.6, 0.72, c, { r: 4 });
    s += `<rect x="${IX(0.1)}" y="${IY(0.6, 0.6)}" width="${IX(0.5)}" height="${0.26 * I_H}" rx="2" fill="none" ${OL_IN(c)}/><circle cx="${IX(0.35)}" cy="${IY(0.6, 0.47)}" r="2.5" fill="#ffd43b"/>`;
    s += icyl(0.35, 0.3, 0.1, 0.25, '#ffd8a8', { y0: 0.72, ol: 1.6 });
    const lx = IX(0.35);
    const ly = IY(0.3, 0.97);
    s += `<path d="M${lx - 9} ${ly} L${lx - 6} ${ly - 15} H${lx + 6} L${lx + 9} ${ly} Z" fill="#fff0c7" ${OL('#ffd8a8', 1.8)}/>`;
    return { w: 0.7, d: 0.6, h: 1.5, svg: s };
  },
  // a standing lamp with a shade
  floorlamp: () => {
    const xc = 0.3;
    const zc = 0.3;
    let s = ishadowE(xc, zc, 0.3, 2) + icyl(xc, zc, 0.26, 0.06, WOOD_D, { ol: 2 });
    s += `<rect x="${IX(xc) - 2}" y="${IY(zc, 2.6)}" width="4" height="${2.55 * I_H}" fill="#a8736a"/>`;
    const yb = IY(zc, 2.55);
    const yt = IY(zc, 3.15);
    const rb = 0.42 * I_T;
    const rt = 0.26 * I_T;
    s += `<path d="M${IX(xc) - rt} ${yt} L${IX(xc) - rb} ${yb} A${rb} ${rb * 0.35} 0 0 0 ${IX(xc) + rb} ${yb} L${IX(xc) + rt} ${yt} Z" fill="#fff0c7" ${OL('#ffd8a8', 2)}/>
      <ellipse cx="${IX(xc)}" cy="${yt}" rx="${rt}" ry="${rt * 0.35}" fill="#ffe8a3" ${OL('#ffd8a8', 2)}/>
      <path d="M${IX(xc) - rb + 4} ${yb + 2} A${rb} ${rb * 0.35} 0 0 0 ${IX(xc) + rb - 4} ${yb + 2}" stroke="#ff8fab" stroke-width="3" fill="none"/>`;
    return { w: 0.6, d: 0.6, h: 3.3, svg: s };
  },
  // a washbasin on a pedestal with a mirror on the wall above it
  sink: () => {
    let s = `<rect x="${IX(0.05)}" y="${IY(0, 3.5)}" width="${IX(0.8)}" height="${1.0 * I_H}" rx="14" fill="#e7f5ff" ${OL('#a5c8e4', 2.5)}/>
      <path d="M${IX(0.2)} ${IY(0, 3.2)} l12 -12" stroke="#fff" stroke-width="3" opacity=".8" stroke-linecap="round"/>`;
    s += ishadowE(0.45, 0.4, 0.3, 1);
    s += `<rect x="${IX(0.45) - 6}" y="${IY(0.4, 0.8)}" width="12" height="${0.8 * I_H}" fill="#f1f3f5" ${OL('#ced4da', 2)}/>`;
    s += ibox(0, 0.05, 0.9, 0.62, 0.22, '#f8f9fa', { y0: 0.8, r: 8, front: '#e9ecef' });
    s += `<ellipse cx="${IX(0.45)}" cy="${IY(0.36, 1.02)}" rx="${0.3 * I_T}" ry="${0.2 * I_R}" fill="#cfe2f3"/>
      <path d="M${IX(0.45)} ${IY(0.1, 1.02)} v-9 q0 -4 6 -4" stroke="#adb5bd" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return { w: 0.9, d: 0.7, h: 3.6, svg: s };
  },
  plant: () => ({ w: 0.9, d: 0.9, h: 2.4, svg: iplant(0.45, 0.45, 1.25) }),
  // a mattress on the floor with a pillow and a quilt, until there's a bed
  futon: () => {
    const w = 2.1;
    const d = 2.7;
    let s = ishadow(0, 0, w, d, 0.4, 0.18);
    s += ibox(0, 0, w, d, 0.2, '#fffaf6', { r: 8, front: '#f3e7e7' });
    s += ibox(0.3, 0.2, w - 0.6, 0.5, 0.12, '#ffffff', { y0: 0.2, r: 9, ol: 2, front: '#f1eef0' });
    s += ibox(0.06, 1.0, w - 0.12, d - 0.96, 0.24, '#ffc9de', { y0: 0.02, r: 8, front: darker('#ffc9de', 0.1) });
    s += [0.45, 1.05, 1.65].map((x, i) => iheart(IX(x), IY(1.75 + (i % 2) * 0.4, 0.26) - 2, '#fff0f6', 0.9)).join('');
    return { w, d, h: 0.6, svg: s, seat: [w / 2, 1.5, 0.25] };
  },
  table: () => {
    const xc = 1.3;
    const zc = 0.7;
    let s = ishadowE(xc, zc, 0.7, 1);
    const stool = (k) => ishadowE(xc + k * 0.95, zc + 0.1, 0.26, 0.6) + icyl(xc + k * 0.95, zc + 0.1, 0.26, 0.5, '#ffd8a8', { front: '#f7c38a' }) + `<ellipse cx="${IX(xc + k * 0.95)}" cy="${IY(zc + 0.1, 0.5)}" rx="${0.19 * I_T}" ry="${0.19 * I_R}" fill="#ffe066"/>`;
    s += stool(-1) + stool(1);
    s += icyl(xc, zc, 0.28, 0.05, WOOD_D, { ol: 2 });
    s += `<rect x="${IX(xc) - 4}" y="${IY(zc, 0.8)}" width="8" height="${0.78 * I_H}" fill="${WOOD_D}" ${OL(WOOD_D, 2)}/>`;
    s += icyl(xc, zc, 0.62, 0.12, '#ffffff', { y0: 0.8, front: '#ff8787' });
    s += `<path d="M${IX(xc - 0.62)} ${IY(zc, 0.8)} q${0.08 * I_T} 9 ${0.21 * I_T} 3 t${0.2 * I_T} 3 t${0.2 * I_T} 3 t${0.2 * I_T} 0 t${0.2 * I_T} -3 t${0.23 * I_T} -6" stroke="#ff8787" stroke-width="2" fill="none"/>`;
    s += `<path d="M${IX(xc - 0.3)} ${IY(zc, 0.98)} q${0.3 * I_T} 12 ${0.6 * I_T} 0 z" fill="#fff4e6" ${OL('#e0a96d', 1.5)}/>
      <circle cx="${IX(xc - 0.1)}" cy="${IY(zc, 1.0)}" r="5" fill="#ff6b6b"/><circle cx="${IX(xc + 0.1)}" cy="${IY(zc, 1.02)}" r="5" fill="#ffd43b"/><circle cx="${IX(xc)}" cy="${IY(zc, 1.08)}" r="5" fill="#8ce99a"/>`;
    return { w: 2.6, d: 1.4, h: 1.2, svg: s };
  },
  telescope: () => {
    const cx = IX(0.6);
    const top = IY(0.5, 1.35);
    let s = ishadowE(0.6, 0.5, 0.45, 2);
    s += `<path d="M${cx} ${top} L${IX(0.2)} ${IY(0.8)} M${cx} ${top} L${IX(1.0)} ${IY(0.8)} M${cx} ${top} L${IX(0.6)} ${IY(0.15)}" stroke="#a8736a" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx - 16} ${top + 12} L${cx + 22} ${top - 30}" stroke="${darker('#9775fa', 0.45)}" stroke-width="15" stroke-linecap="round"/>
      <path d="M${cx - 16} ${top + 12} L${cx + 22} ${top - 30}" stroke="#9775fa" stroke-width="11" stroke-linecap="round"/>
      <path d="M${cx + 16} ${top - 23} L${cx + 26} ${top - 34}" stroke="#ffd43b" stroke-width="14" stroke-linecap="round"/>
      <path d="M${cx - 10} ${top + 2} l10 -11" stroke="#fff" stroke-width="2.5" opacity=".5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${top}" r="4" fill="#ffd43b" ${OL('#fab005', 1.5)}/>`;
    return { w: 1.2, d: 1.0, h: 2.6, svg: s };
  },
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

// ---------- the houses ----------
// A house is a list of floors. A floor is a row of rooms side by side (w wide, all as deep as the
// floor), with doorways in the walls between them (doors: [z1, z2] for each wall, left to right),
// the front door in the front wall (door: x where it starts, 2 wide), the stairs at x against the
// back wall, and spots: where each thing stands, by item id or furniture group: [x centre, z of
// its back edge] for things on the floor, [x centre, height] for things on the back wall.
// diplomas: [x1, x2], the stretch of back wall where they hang. fixtures: things that come with
// the rooms, [name, x, z]. Rooms have a look (the wallpaper and floor), a window and maybe a clock
// (x across the room).
// Nothing here says whose house it is: Interior.enter takes a home (a layout and what's in it).

const ROOM_LOOKS = {
  pink: { paper: '#ffe3ec', stripe: '#ffd5e2', dot: '#ffc2d4', wainscot: '#fff4ee', panel: '#f3dcd2', rail: '#f4a9bf', skirting: '#e597ae', curtain: '#ffb3c8', floor: 'wood' },
  lilac: { paper: '#efe6ff', stripe: '#e6dafe', dot: '#d6c6fb', wainscot: '#fbf8ff', panel: '#e6def3', rail: '#c9b0f2', skirting: '#b79ae6', curtain: '#d0bfff', floor: 'wood' },
  mint: { paper: '#e4f7e9', stripe: '#d6f1dd', dot: '#bde6c8', wainscot: '#f7fff9', panel: '#d9ecdd', rail: '#96d6a9', skirting: '#7cc495', curtain: '#b2f2bb', floor: 'warm' },
  lemon: { paper: '#fff1c2', stripe: '#ffeaa8', dot: '#ffe08a', wainscot: '#fffdf5', panel: '#f1e6c8', rail: '#ffd43b', skirting: '#f2c14e', curtain: '#ffe8cc', floor: 'tile', tiles: true },
  sky: { paper: '#e0f1ff', stripe: '#d3eaff', dot: '#b9dcfb', wainscot: '#ffffff', panel: '#d6e7f5', rail: '#91c9f2', skirting: '#74b4e6', curtain: '#d0ebff', floor: 'tile', tiles: true },
  night: { paper: '#2f3160', stripe: '#36396e', dot: '#fff3bf', wainscot: '#3b3e75', panel: '#4a4d8a', rail: '#7c7fc4', skirting: '#5c5f8f', curtain: '#9775fa', floor: 'night', stars: true },
};
const FLOOR_LOOKS = { wood: ['#f3cb9b', '#dfae7a'], warm: ['#efc290', '#d9a26c'], tile: ['#f8f9fa', '#e9ecef'], night: ['#4c4f7f', '#5c5f8f'] };

const HOUSE_LAYOUTS = [
  // 小猪窝: one cosy room, a corner for each thing: sleeping on the left, the desk, the sofa and
  // the piano along the back, a table out on the floor, a bath corner by the door
  [{
    depth: 9,
    rooms: [{ w: 17, name: '小猪窝', look: 'pink', window: 11.65 }],
    door: 7.5,
    fixtures: [['nightstand', 0.6, 0.05], ['rug', 2.1, 3.35, { w: 2.4, d: 1.1, look: 'lilac' }], ['rug', 11.65, 1.7, { w: 4.2, d: 3 }],
      ['coffee', 11.65, 2.65], ['futon', 2.15, 0.15, { unless: 'bed', use: 'sleep' }], ['plant', 0.75, 7.95, { unless: 'tub' }]],
    spots: {
      bed: [2.15, 0], wardrobe: [4.6, 0], desk: [7.65, 0], sofa: [11.65, 0], piano: [15.25, 0],
      tub: [1.6, 7.5], tub3: [1.7, 6.5], bubbler: [3.9, 8.15], easel: [15.6, 3.9], pot: [15.0, 8.0],
      rug: [5.0, 4.3], chesstable: [5.0, 5.35], trophy: [1.0, 4.75], aquarium: [15.85, 5.6], globe: [13.6, 5.4],
      treehouse: [12.6, 7.0], plant: [10.85, 8.0],
      painting: [2.15, 4.45], lamp: [13.35, 3.8], stars: [15.25, 4.2],
      carrotpillow: [9.9, 3.75], bonsai: [16.45, 7.1], appletree: [2.55, 5.7],
    },
    diplomas: [5.85, 9.45],
  }],
  // 温馨公寓: a bedroom with a bath corner and a table; a living room with a study corner, a
  // seating group and the piano
  [{
    depth: 9,
    rooms: [{ w: 10, name: '卧室', look: 'lilac', window: 7.9 }, { w: 13, name: '客厅', look: 'mint', window: 6.6, clock: 11 }],
    doors: [[4.0, 7.0]],
    door: 15.9,
    fixtures: [['nightstand', 0.6, 0.05], ['rug', 2.1, 3.35, { w: 2.4, d: 1.1, look: 'lilac' }], ['mat', 7.9, 2.55], ['futon', 2.15, 0.15, { unless: 'bed', use: 'sleep' }],
      ['floorlamp', 14.95, 0.3], ['rug', 17.0, 1.7, { w: 4.2, d: 3, look: 'mint' }], ['coffee', 17.0, 2.65], ['plant', 10.95, 8.05]],
    spots: {
      bed: [2.15, 0], wardrobe: [4.6, 0], tub: [7.9, 0], bubbler: [9.4, 2.65],
      desk: [12.65, 0], sofa: [17.0, 0], piano: [21.4, 0], easel: [22.0, 4.0], pot: [22.6, 8.0],
      rug: [4.6, 4.4], chesstable: [4.6, 5.4], trophy: [1.0, 5.0], treehouse: [1.15, 7.25], plant: [7.2, 8.05],
      aquarium: [22.35, 5.8], globe: [19.6, 5.7],
      painting: [2.15, 4.45], stars: [4.6, 4.55], lamp: [19.1, 3.8],
      carrotpillow: [15.4, 3.85], bonsai: [11.1, 2.2], appletree: [9.15, 7.8],
    },
    diplomas: [10.85, 14.45],
  }],
  // 花园别墅: the living room (stairs, a seating group, the piano, a table out on the floor) and
  // the kitchen with its dining table downstairs; the bedroom and the bathroom upstairs
  [{
    depth: 9,
    rooms: [{ w: 16, name: '客厅', look: 'pink', window: 12.3, clock: 15.2 }, { w: 9, name: '厨房', look: 'lemon', window: 7.1 }],
    doors: [[4.0, 7.0]],
    door: 6.5,
    stairs: 0,
    fixtures: [['rug', 8.3, 1.7, { w: 4.2, d: 3 }], ['coffee', 8.3, 2.65], ['floorlamp', 10.4, 0.3], ['plant', 15.55, 8.05],
      ['rug', 21.0, 3.5, { w: 3.4, d: 2.4, look: 'lemon' }], ['table', 21.0, 4.0], ['plant', 24.95, 8.05]],
    spots: {
      sofa: [8.3, 0], piano: [14.25, 0], easel: [14.8, 3.8], kitchen: [19.0, 0], pot: [23.6, 0],
      rug: [3.0, 3.6], chesstable: [3.0, 4.6], aquarium: [11.8, 7.9], plant: [0.65, 8.05], lamp: [5.9, 3.7],
      painting: [8.3, 3.95],
      carrotpillow: [10.1, 3.75], bonsai: [13.9, 7.9], appletree: [4.7, 7.6],
    },
  }, {
    depth: 9,
    rooms: [{ w: 17, name: '卧室', look: 'lilac', window: 11.6 }, { w: 9, name: '浴室', look: 'sky', window: 7.2 }],
    doors: [[4.0, 7.0]],
    stairs: 0,
    fixtures: [['nightstand', 9.75, 0.05], ['rug', 8.15, 3.35, { w: 2.6, d: 1.2, look: 'lilac' }], ['plant', 0.65, 8.05], ['futon', 8.15, 0.15, { unless: 'bed', use: 'sleep' }],
      ['rug', 12.6, 4.6, { w: 3.4, d: 2.4 }], ['coffee', 12.6, 5.3],
      ['sink', 22.6, 0.05], ['mat', 19.9, 2.6], ['plant', 25.9, 8.05]],
    spots: {
      wardrobe: [5.6, 0], bed: [8.15, 0], desk: [15.1, 0], tub: [19.9, 0], bubbler: [24.6, 0.25],
      trophy: [1.0, 5.2], globe: [16.4, 2.6], treehouse: [2.6, 7.2], stars: [8.15, 4.45],
    },
    diplomas: [13.3, 16.9],
  }],
  // 猪猪城堡: a big hall and the kitchen downstairs; bedroom, bathroom and a star tower upstairs
  [{
    depth: 9,
    rooms: [{ w: 18, name: '大厅', look: 'mint', window: 13.3, clock: 16.2 }, { w: 9, name: '厨房', look: 'lemon', window: 7.1 }],
    doors: [[4.0, 7.0]],
    door: 8.0,
    stairs: 0,
    fixtures: [['rug', 8.8, 1.7, { w: 4.2, d: 3, look: 'mint' }], ['coffee', 8.8, 2.65], ['floorlamp', 10.95, 0.3],
      ['rug', 23.0, 3.5, { w: 3.4, d: 2.4, look: 'lemon' }], ['table', 23.0, 4.0], ['plant', 26.95, 8.05]],
    spots: {
      sofa: [8.8, 0], piano: [16.2, 0], easel: [16.6, 3.9], kitchen: [21.0, 0], pot: [25.6, 0],
      rug: [3.0, 3.6], chesstable: [3.0, 4.6], aquarium: [13.3, 7.9], plant: [0.65, 8.05], trophy: [16.95, 7.95], lamp: [5.9, 3.7],
      painting: [8.8, 3.95],
      carrotpillow: [10.6, 3.75], bonsai: [15.1, 7.9], appletree: [5.5, 7.6],
    },
  }, {
    depth: 9,
    rooms: [{ w: 17, name: '卧室', look: 'lilac', window: 11.6 }, { w: 9, name: '浴室', look: 'sky', window: 7.2 }, { w: 9, name: '星空塔楼', look: 'night', window: 4.5 }],
    doors: [[4.0, 7.0], [4.0, 7.0]],
    stairs: 0,
    fixtures: [['nightstand', 9.75, 0.05], ['rug', 8.15, 3.35, { w: 2.6, d: 1.2, look: 'lilac' }], ['plant', 0.65, 8.05], ['futon', 8.15, 0.15, { unless: 'bed', use: 'sleep' }],
      ['rug', 12.6, 4.6, { w: 3.4, d: 2.4 }], ['coffee', 12.6, 5.3],
      ['sink', 22.6, 0.05], ['mat', 19.9, 2.6], ['plant', 25.9, 8.05],
      ['rug', 31.3, 4.0, { w: 4, d: 2.6, look: 'night' }], ['telescope', 31.3, 1.8]],
    spots: {
      wardrobe: [5.6, 0], bed: [8.15, 0], desk: [15.1, 0], tub: [19.9, 0], bubbler: [24.6, 0.25],
      globe: [28.4, 1.6], treehouse: [34.6, 0.3], stars: [28.4, 4.45],
    },
    diplomas: [13.3, 16.9],
  }],
];

// Room positions along the floor: each starts after the one before it and a wall
for (const floors of HOUSE_LAYOUTS) {
  for (const L of floors) {
    let x = 0;
    for (const r of L.rooms) {
      r.x = x;
      x += r.w + I_CAP;
    }
    L.width = x - I_CAP;
  }
}

const I_DOOR_W = 2; // the front door's opening
const I_STAIRS = { len: 4.5, d: 1.6, n: 6, landing: 1.0, hole: 2.0 }; // hole: how deep the opening upstairs is

// The pig's own home, from his save: which house, what stands in it, which diplomas he has.
// Someone else's home would be the same shape: a layout, its name, its things, its diplomas.
function pigHome(s) {
  const tier = homeTier(s);
  const best = {};
  for (const it of ITEMS) {
    if (it.cat !== 'furniture' || !s.inventory[it.id] || it.group === 'house') continue;
    if (!best[it.group] || it.price > best[it.group].price) best[it.group] = it;
  }
  const things = [{ id: 'wardrobe', group: 'wardrobe', name: '衣柜' }, ...Object.values(best)];
  for (const it of ownedDecor(s).slice(0, decorSlots(s))) things.push({ ...it, group: it.id });
  // what friends gave him: each in its own place (the cow bell hangs on the coat stand)
  for (const it of keepsakes(s)) if (it.id !== 'cowbell') things.push({ ...it, group: it.id });
  const told = (id, k) => !!s.npc?.[id]?.ev?.includes(k);
  // the dog's certificate hangs with the diplomas; the hedgehog's flower sits on a windowsill
  const degs = told('dog', 5) ? [...degrees(s), '优秀打工猪'] : degrees(s);
  return { key: `pig${tier}`, layout: HOUSE_LAYOUTS[tier], name: HOUSE_NAMES[tier], things, degrees: degs, bell: !!s.inventory.cowbell, sill: told('hedgehog', 5) };
}

// ---------- fixed parts of the rooms ----------

// The back wall of a room: wallpaper with stripes and little hearts (or stars), panelling or tiles
// below a rail, a skirting board, shading toward the ceiling and the crown moulding
function backWallSvg(r) {
  const k = ROOM_LOOKS[r.look];
  if (k.wall) return k.wall(r, Interior.home); // someone else's house: a wall all its own
  const x0 = IX(r.x);
  const W = IX(r.w);
  const top = IY(0, I_WALL);
  let s = `<rect x="${x0}" y="${top}" width="${W}" height="${I_WALL * I_H}" fill="${k.paper}"/>`;
  for (let x = 0.25; x < r.w; x += 0.75) s += `<rect x="${IX(r.x + x)}" y="${top}" width="${IX(0.25)}" height="${(I_WALL - 1.4) * I_H}" fill="${k.stripe}"/>`;
  for (let x = 0.62, i = 0; x < r.w; x += 1.5, i++) {
    const y = IY(0, I_WALL - 0.7 - (i % 2) * 1.2);
    s += k.stars ? `<circle cx="${IX(r.x + x)}" cy="${y}" r="${i % 3 ? 1.6 : 2.4}" fill="${k.dot}" class="twinkle" style="animation-delay:${-i * 0.3}s"/>` : iheart(IX(r.x + x), y, k.dot, 0.65);
  }
  s += `<rect x="${x0}" y="${IY(0, 1.4)}" width="${W}" height="${1.4 * I_H}" fill="${k.wainscot}"/>`;
  if (k.tiles) {
    for (let y = 0.3; y < 1.4; y += 0.37) s += `<path d="M${x0} ${IY(0, y)} H${x0 + W}" stroke="${k.panel}" stroke-width="1.5"/>`;
    for (let x = 0.5; x < r.w; x += 0.5) s += `<path d="M${IX(r.x + x)} ${IY(0, 1.4)} V${IY(0, 0.3)}" stroke="${k.panel}" stroke-width="1.5"/>`;
  } else {
    for (let x = 0.2; x < r.w - 0.5; x += 1) s += `<rect x="${IX(r.x + x)}" y="${IY(0, 1.2)}" width="${IX(0.8) - 4}" height="${0.75 * I_H}" rx="3" fill="none" stroke="${k.panel}" stroke-width="2"/>`;
  }
  s += `<rect x="${x0}" y="${IY(0, 1.48)}" width="${W}" height="${0.12 * I_H + 2}" fill="${k.rail}"/><rect x="${x0}" y="${IY(0, 1.48)}" width="${W}" height="2" fill="#fff" opacity=".5"/>`;
  s += `<rect x="${x0}" y="${IY(0, 0.3)}" width="${W}" height="${0.3 * I_H}" fill="${k.skirting}"/><rect x="${x0}" y="${IY(0, 0.3)}" width="${W}" height="2" fill="#fff" opacity=".45"/>`;
  s += `<rect x="${x0}" y="${top}" width="${W}" height="${I_WALL * I_H}" fill="url(#iWallTone)"/>
    <rect x="${x0}" y="${top}" width="${W}" height="${0.18 * I_H}" fill="${lighter(k.paper, 0.6)}"/><rect x="${x0}" y="${IY(0, I_WALL - 0.18)}" width="${W}" height="2" fill="${darker(k.paper, 0.12)}"/>`;
  return s;
}

// A window with curtains tied back and a sill, centred at x on the back wall
function windowSvg(xc, curtain, night, pot = false) {
  const w = 1.9;
  const sill = 1.5;
  const topY = 3.7;
  const x1 = IX(xc - w / 2);
  const x2 = IX(xc + w / 2);
  const y1 = IY(0, topY);
  const y2 = IY(0, sill);
  let s = `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="6" fill="#fff" ${OL('#f2c4d2', 2.5)}/>
    <rect x="${x1 + 7}" y="${y1 + 7}" width="${x2 - x1 - 14}" height="${y2 - y1 - 14}" rx="3" fill="url(#${night ? 'iNightSky' : 'iSky'})"/>`;
  if (night) {
    s += `<path d="M${x1 + 30} ${y1 + 18} a9 9 0 1 0 9 -11 a7 7 0 1 1 -9 11" fill="#ffd43b"/>${[[0.25, 0.6], [0.7, 0.3], [0.8, 0.75], [0.45, 0.4]].map(([u, v], i) => `<circle cx="${x1 + 7 + u * (x2 - x1 - 14)}" cy="${y1 + 7 + v * (y2 - y1 - 14)}" r="1.8" fill="#fff3bf" class="twinkle" style="animation-delay:${-i * 0.5}s"/>`).join('')}`;
  } else {
    s += `<ellipse cx="${x1 + (x2 - x1) * 0.66}" cy="${y1 + 24}" rx="16" ry="7" fill="#fff" opacity=".9"/><ellipse cx="${x1 + (x2 - x1) * 0.58}" cy="${y1 + 21}" rx="9" ry="7" fill="#fff" opacity=".9"/>
      <path d="M${x1 + 7} ${y2 - 7} q14 -22 30 -10 q14 -16 30 -2 q12 -10 ${x2 - x1 - 74} 0 V${y2 - 7} Z" fill="#a9e34b" opacity=".85"/>`;
  }
  s += `<path d="M${(x1 + x2) / 2} ${y1 + 5} V${y2 - 5} M${x1 + 5} ${(y1 + y2) / 2} H${x2 - 5}" stroke="#fff" stroke-width="5"/>
    <path d="M${x1 + 14} ${y2 - 16} L${x1 + 34} ${y1 + 14}" stroke="#fff" stroke-width="4" opacity="${night ? 0.2 : 0.55}" stroke-linecap="round"/>`;
  const ry = IY(0, topY + 0.35);
  s += `<path d="M${x1 - 0.45 * I_T} ${ry} H${x2 + 0.45 * I_T}" stroke="#d8a48f" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${x1 - 0.45 * I_T}" cy="${ry}" r="4" fill="${darker(curtain, 0.15)}"/><circle cx="${x2 + 0.45 * I_T}" cy="${ry}" r="4" fill="${darker(curtain, 0.15)}"/>`;
  for (const k of [-1, 1]) {
    const ex = k < 0 ? x1 - 0.42 * I_T : x2 + 0.42 * I_T;
    const ix = k < 0 ? x1 + 0.18 * I_T : x2 - 0.18 * I_T;
    const tieY = IY(0, sill + 0.75);
    const bot = IY(0, sill - 0.35);
    const mid = ex + (ix - ex) * 0.25;
    s += `<path d="M${ex} ${ry} L${ix} ${ry} Q${ix} ${(ry + tieY) / 2} ${mid + k * 2} ${tieY} Q${mid + (ix - ex) * 0.35} ${(tieY + bot) / 2} ${mid + (ix - ex) * 0.3} ${bot} Q${(ex + mid) / 2} ${bot + 5} ${ex} ${bot} Z" fill="${curtain}" ${OL(curtain, 2)}/>
      <path d="M${ex + (ix - ex) * 0.45} ${ry + 3} Q${ex + (ix - ex) * 0.4} ${(ry + tieY) / 2} ${mid + (ix - ex) * 0.12} ${tieY - 4}" ${OL_IN(curtain)}/>
      <ellipse cx="${mid + k * 2}" cy="${tieY}" rx="7" ry="4" fill="${darker(curtain, 0.2)}"/>`;
  }
  // the sill sticks out of the wall a little
  s += ibox(xc - w / 2 - 0.15, 0, w + 0.3, 0.25, 0.12, '#ffffff', { y0: sill - 0.12, r: 3, ol: 2 });
  if (pot) s += sillFlowerSvg(xc + 0.45, sill);
  return s;
}

// The hedgehog's little pot of flowers on a windowsill: three tulips
function sillFlowerSvg(xc, sill) {
  let s = icyl(xc, 0.12, 0.16, 0.26, '#f59f80', { y0: sill, ol: 1.6 });
  const by = IY(0.12, sill + 0.26);
  const cx = IX(xc);
  for (const [dx, h, c] of [[-6, 20, '#ff6b6b'], [1, 26, '#ffd43b'], [7, 18, '#f783ac']]) {
    s += `<path d="M${cx + dx * 0.4} ${by} Q${cx + dx * 0.7} ${by - h / 2} ${cx + dx} ${by - h}" stroke="#51cf66" stroke-width="2" fill="none"/>
      <path d="M${cx + dx - 4} ${by - h} q0 -8 4 -9 q4 1 4 9 q-4 3 -8 0 Z" fill="${c}" ${OL(c, 1.2)}/>`;
  }
  return s + `<path d="M${cx - 2} ${by - 6} q-7 -3 -9 -9 q7 1 9 7" fill="#69db7c"/>`;
}

// Sunlight from a window falling forward and to the right
function windowLightSvg(xc) {
  const x1 = xc - 0.8;
  const x2 = xc + 0.8;
  const p = (x, y) => `${IX(x + y * 0.35)},${IY(y * 0.95)}`;
  return `<polygon points="${p(x1, 1.5)} ${p(x2, 1.5)} ${p(x2, 3.7)} ${p(x1, 3.7)}" fill="#fffbe0" opacity=".45" filter="url(#iblur)"/>`;
}

function clockSvg(xc) {
  const cx = IX(xc);
  const cy = IY(0, 3.9);
  return `<circle cx="${cx + 3}" cy="${cy + 4}" r="15" fill="#6b3a4e" opacity=".14"/><circle cx="${cx}" cy="${cy}" r="15" fill="#fff" ${OL('#f4a9bf', 3)}/>
    <path d="M${cx} ${cy} V${cy - 9} M${cx} ${cy} L${cx + 6} ${cy + 3}" stroke="#6b3a4e" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="1.8" fill="#f783ac"/>`;
}

// Floors drawn some other way (beaten earth, bamboo mats…): (room, depth) → svg, by floor name
const FLOOR_ART = {};

// The floor of a room: planks two to a tile row with staggered joints, or tiles
function floorSvg(r, depth) {
  if (FLOOR_ART[ROOM_LOOKS[r.look].floor]) return FLOOR_ART[ROOM_LOOKS[r.look].floor](r, depth);
  const [f1, f2] = FLOOR_LOOKS[ROOM_LOOKS[r.look].floor];
  const x0 = IX(r.x);
  const x1 = IX(r.x + r.w);
  let s = `<rect x="${x0}" y="${IY(0)}" width="${x1 - x0}" height="${depth * I_R}" fill="${f1}"/>`;
  if (ROOM_LOOKS[r.look].floor === 'tile') {
    for (let z = 0; z < depth; z++) for (let x = 0; x < r.w; x++) if ((x + z) % 2) s += `<rect x="${IX(r.x + x)}" y="${IY(z)}" width="${I_T}" height="${I_R}" fill="${f2}"/>`;
    return s;
  }
  for (let b = 0; b < depth * 2; b++) {
    const y = IY(b / 2);
    s += `<path d="M${x0} ${y} H${x1}" stroke="${f2}" stroke-width="${b % 2 ? 1.2 : 2}"/><path d="M${x0} ${y + 2} H${x1}" stroke="#fff" stroke-width="1" opacity=".2"/>`;
    for (let x = (b % 4) * 0.75 + ((b * 7) % 3); x < r.w; x += 3) if (x > 0) s += `<path d="M${IX(r.x + x)} ${y} V${y + I_R / 2}" stroke="${f2}" stroke-width="1.5"/>`;
  }
  return s;
}

// A framed diploma hanging on the wall, centred at (x, y) px: a dark wood frame with a gold line,
// cream paper with a little mortarboard, the degree on two lines (what, then 学士 / 毕业), a red
// seal and a ribbon. Text is squeezed to fit the paper if it's long.
const I_DIP = { w: 52, h: 44, gap: 6 };
function diplomaSvg(x, y, degree) {
  const fw = I_DIP.w;
  const fh = I_DIP.h;
  const left = x - fw / 2;
  const top = y - fh / 2;
  const m = degree.match(/^(.*?)(毕业|学士|硕士|博士)$/);
  const [l1, l2] = m && m[1] ? [m[1], m[2]] : [degree, ''];
  const paperW = fw - 12;
  const fit = (t, size) => (t.length * size > paperW - 4 ? `textLength="${paperW - 4}" lengthAdjust="spacingAndGlyphs"` : '');
  return `<g><title>${degree}</title>
    <rect x="${left + 3}" y="${top + 3}" width="${fw}" height="${fh}" rx="2" fill="#6b3a4e" opacity=".16"/>
    <rect x="${left}" y="${top}" width="${fw}" height="${fh}" rx="2" fill="#a0673f" ${OL('#a0673f', 1.5)}/>
    <rect x="${left + 3}" y="${top + 3}" width="${fw - 6}" height="${fh - 6}" fill="none" stroke="#e9c46a" stroke-width="1.2"/>
    <rect x="${left + 6}" y="${top + 6}" width="${paperW}" height="${fh - 12}" fill="#fffaf0"/>
    <path d="M${x - 7} ${top + 11} L${x} ${top + 8} L${x + 7} ${top + 11} L${x} ${top + 14} Z" fill="#343a40"/><path d="M${x + 5} ${top + 11.5} v4" stroke="#e9c46a" stroke-width="1"/>
    <text class="i-dip" x="${x}" y="${top + 24}" ${fit(l1, 9)}>${l1}</text>
    ${l2 ? `<text class="i-dip small" x="${x}" y="${top + 33}">${l2}</text>` : ''}
    <circle cx="${left + fw - 12}" cy="${top + fh - 11}" r="4" fill="#e03131" opacity=".85"/><circle cx="${left + fw - 12}" cy="${top + fh - 11}" r="2.2" fill="none" stroke="#ffc9c9" stroke-width=".8"/>
    <path d="M${left + 11} ${top + fh - 12} l-2 6 l2.5 -1.5 l1.5 2 Z M${left + 15} ${top + fh - 12} l2 6 l-2.5 -1.5 l-1.5 2 Z" fill="#e03131"/>
    <circle cx="${left + 13}" cy="${top + fh - 13}" r="3.2" fill="#e9c46a" stroke="#c99a2e" stroke-width=".8"/></g>`;
}

// The diplomas on their stretch of wall: as many rows as fit between the rail and the crown, never
// overlapping; when there are more than fit, the last place says how many more there are
function diplomasSvg([x1, x2], degs) {
  if (!degs.length) return '';
  const { w, h, gap } = I_DIP;
  const perRow = Math.max(1, Math.floor((IX(x2 - x1) + gap) / (w + gap)));
  const rows = Math.max(1, Math.floor(((I_WALL - 0.25 - 2.55) * I_H + gap) / (h + gap)));
  const cap = perRow * rows;
  const shown = degs.length > cap ? degs.slice(0, cap - 1) : degs;
  const more = degs.length - shown.length;
  const cells = shown.length + (more ? 1 : 0);
  const usedRows = Math.ceil(cells / perRow);
  const topY = IY(0, I_WALL - 0.25) + h / 2;
  const at = (i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, cells - row * perRow);
    return [IX((x1 + x2) / 2) + ((i % perRow) - (inRow - 1) / 2) * (w + gap), topY + (rows - usedRows + row) * (h + gap)];
  };
  let s = shown.map((d, i) => diplomaSvg(...at(i), d)).join('');
  if (more) {
    const [x, y] = at(shown.length);
    // a little framed tag in the diplomas' style, saying how many more there are
    s += `<rect x="${x - 19}" y="${y - 12}" width="38" height="24" rx="2" fill="#6b3a4e" opacity=".16" transform="translate(3 3)"/>
      <rect x="${x - 19}" y="${y - 12}" width="38" height="24" rx="2" fill="#a0673f" ${OL('#a0673f', 1.5)}/>
      <rect x="${x - 15}" y="${y - 8}" width="30" height="16" fill="#fffaf0"/>
      <text class="i-more" x="${x}" y="${y + 4.5}">+${more}</text>`;
  }
  return s;
}

// The stairs up: a straight flight along the back wall climbing to the left, a sawtooth side panel
// facing us with a little cupboard door under the high end, a newel post at the foot. Returns the
// bits on the wall (the stairwell's shadow, the handrail) and the flight itself.
function stairsUpSvg(x0) {
  const { len, d, n } = I_STAIRS;
  const rise = I_WALL / n;
  const run = len / n;
  const side = '#d39a63';
  const tread = '#f2c894';
  const wall = `<polygon points="${IX(x0)},${IY(0, I_WALL)} ${IX(x0 + 2.6)},${IY(0, I_WALL)} ${IX(x0)},${IY(0, I_WALL - (2.6 * I_WALL) / len)}" fill="url(#iWell)"/>`;
  let s = `<polygon points="${IX(x0 + len + 0.15)},${IY(0.1)} ${IX(x0 + len + 0.4)},${IY(d + 0.2)} ${IX(x0 + 0.3)},${IY(d + 0.25)} ${IX(x0)},${IY(0.1)}" fill="#6b3a4e" opacity=".2" filter="url(#iblur)"/>`;
  const pts = [`${IX(x0 + len)},${IY(d)}`];
  for (let i = 0; i < n; i++) {
    const xr = x0 + len - i * run;
    const h = (i + 1) * rise;
    pts.push(`${IX(xr)},${IY(d, h)}`, `${IX(xr - run)},${IY(d, h)}`);
  }
  pts.push(`${IX(x0)},${IY(d)}`);
  s += `<polygon points="${pts.join(' ')}" fill="${side}" ${OL(side)}/>`;
  s += `<path d="M${IX(x0 + len - 0.25)} ${IY(d, 0.25)} L${IX(x0 + 0.25)} ${IY(d, 0.25)} L${IX(x0 + 0.25)} ${IY(d, I_WALL - 0.75)} Z" fill="none" stroke="${lighter(side, 0.35)}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="${rpath(IX(x0 + 0.45), IY(d, 2.2), 1.05 * I_T, 1.95 * I_H, 6, true, false)}" fill="${darker(side, 0.12)}" ${OL(side, 2)}/>
    <circle cx="${IX(x0 + 1.3)}" cy="${IY(d, 1.1)}" r="3" fill="#ffd43b" ${OL('#fab005', 1.2)}/>${iheart(IX(x0 + 0.97), IY(d, 1.85), '#ff8fab', 0.8)}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + len - (i + 1) * run;
    const h = (i + 1) * rise;
    s += `<path d="${rpath(IX(x), IY(0, h), run * I_T, d * I_R, 3, true, true)}" fill="${tread}" ${OL(side, 2)}/>
      <path d="M${IX(x) + 3} ${IY(d, h) - 2.5} H${IX(x + run) - 3}" stroke="#fff" stroke-width="2" opacity=".6"/>
      <rect x="${IX(x) - 1}" y="${IY(0.35, h)}" width="${run * I_T + 2}" height="${(d - 0.7) * I_R}" fill="#ffa3b8"/>
      <path d="M${IX(x)} ${IY(0.35, h)} h${run * I_T} M${IX(x)} ${IY(d - 0.35, h)} h${run * I_T}" stroke="#f783ac" stroke-width="1.5"/>`;
  }
  s += ibox(x0 + len - 0.2, d - 0.22, 0.2, 0.2, 1.4, WOOD_D, { r: 2, ol: 2 }) + `<circle cx="${IX(x0 + len - 0.1)}" cy="${IY(d - 0.12, 1.45)}" r="5" fill="#f4a9bf" ${OL('#f4a9bf', 1.8)}/>`;
  const railAt = (u) => (x0 + len - u) * (rise / run) + 1.1;
  const uTop = x0 + len - (I_WALL - 0.4 - 1.1) * (run / rise);
  const rail = `<path d="M${IX(x0 + len + 0.1)} ${IY(0, railAt(x0 + len + 0.1))} L${IX(uTop)} ${IY(0, railAt(uTop))}" stroke="${WOOD_D}" stroke-width="5" stroke-linecap="round"/>
    ${[0.6, 2.0, 3.4].filter((u) => railAt(x0 + u) < I_WALL - 0.3).map((u) => `<rect x="${IX(x0 + u) - 2}" y="${IY(0, railAt(x0 + u))}" width="4" height="7" fill="#a8736a"/>`).join('')}`;
  return { wall: wall + rail, flight: s };
}

// The stairs down: a dark opening in the floor beside a little landing, the steps dropping away
// to the right into the dark, a banister of thin spindles round its front and far end (the landing
// side is open)
function stairsDownSvg(x0) {
  const { len, n, landing, hole: d } = I_STAIRS;
  const a = x0 + landing;
  const hw = len - landing;
  const run = hw / (n - 1);
  const drop = 0.34; // how far each step shows lower, in tiles of height
  let hole = `<clipPath id="iHole"><rect x="${IX(a)}" y="${IY(0)}" width="${IX(hw)}" height="${d * I_R}"/></clipPath>
    <g clip-path="url(#iHole)"><rect x="${IX(a)}" y="${IY(0)}" width="${IX(hw)}" height="${d * I_R}" fill="#24170f"/>`;
  for (let i = 0; i < n - 1; i++) {
    const x = a + i * run;
    const y = -(i + 1) * drop;
    const c = mixHex('#d9a066', '#24170f', Math.min(0.92, 0.12 + i * 0.2));
    hole += `<rect x="${IX(x)}" y="${IY(0, y)}" width="${IX(run) + 1}" height="${d * I_R}" fill="${c}"/>
      <path d="M${IX(x) + 1} ${IY(0, y)} V${IY(d, y)}" stroke="${lighter(c, 0.25)}" stroke-width="2"/>`;
  }
  // the shaft's far wall in shadow, and the dark under the near edge
  hole += `<rect x="${IX(a)}" y="${IY(0)}" width="${IX(hw)}" height="${0.55 * I_R}" fill="url(#iShaft)"/></g>
    <rect x="${IX(a)}" y="${IY(0)}" width="${IX(hw)}" height="${d * I_R}" fill="none" ${OL(WOOD, 2.5)}/>
    <rect x="${IX(a)}" y="${IY(d) - 3}" width="${IX(hw)}" height="5" fill="${WOOD_D}"/>`;
  // the landing: the top step, level with the floor, a nosing along its edge
  hole += iflat(x0 + 0.06, 0.06, landing - 0.06, d - 0.12, '#fff', { r: 0.05, attrs: 'opacity=".22"' });
  hole += `<path d="M${IX(a) - 3} ${IY(0.1)} V${IY(d - 0.1)}" stroke="#fff" stroke-width="2" opacity=".55"/>`;
  // the banister: spindles under a rail along the front and the far end
  const ry = 0.85;
  let rail = '';
  for (let z = 0.3; z < d - 0.1; z += 0.35) rail += `<rect x="${IX(x0 + len) - 1.5}" y="${IY(z, ry)}" width="3" height="${ry * I_H}" fill="${WOOD_D}"/>`;
  rail += `<path d="M${IX(x0 + len)} ${IY(0, ry)} V${IY(d, ry)}" stroke="${darker(WOOD_D, 0.3)}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${IX(x0 + len)} ${IY(0, ry)} V${IY(d, ry)}" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/>`;
  for (let x = a + 0.32; x < x0 + len - 0.1; x += 0.32) rail += `<rect x="${IX(x) - 1.5}" y="${IY(d, ry)}" width="3" height="${ry * I_H}" fill="${WOOD_D}"/>`;
  rail += ibox(a, d - 0.08, hw, 0.1, 0.1, WOOD, { y0: ry, r: 2, ol: 2 });
  for (const [x, z] of [[a - 0.1, d - 0.15], [x0 + len - 0.1, d - 0.15], [x0 + len - 0.1, 0]]) rail += ibox(x, z, 0.2, 0.2, ry + 0.2, WOOD_D, { r: 2, ol: 2 }) + `<circle cx="${IX(x + 0.1)}" cy="${IY(z + 0.1, ry + 0.25)}" r="5" fill="#f4a9bf" ${OL('#f4a9bf', 1.8)}/>`;
  return { hole, rail };
}

// The doormat inside the front door, the coat stand beside it, slippers by the mat
function doormatSvg(x, Z) {
  return `${iflat(x + 0.2, Z - 0.85, I_DOOR_W - 0.4, 0.7, '#f08c8c', { r: 0.12, attrs: OL('#f08c8c', 2) })}
    ${iflat(x + 0.35, Z - 0.75, I_DOOR_W - 0.7, 0.5, 'none', { r: 0.08, attrs: 'stroke="#ffd0d0" stroke-width="1.6"' })}
    ${iheart(IX(x + I_DOOR_W / 2), IY(Z - 0.38) - 3, '#fff', 1, 'opacity=".85"')}`;
}
function coatStandSvg(xc, zc, bell = false) {
  let s = ishadowE(xc, zc, 0.3, 2.5) + icyl(xc, zc, 0.28, 0.06, WOOD_D, { ol: 2 });
  s += `<rect x="${IX(xc) - 2.5}" y="${IY(zc, 3.0)}" width="5" height="${2.95 * I_H}" fill="#a8736a"/>
    <path d="M${IX(xc)} ${IY(zc, 2.8)} l-12 -6 M${IX(xc)} ${IY(zc, 2.8)} l12 -6" stroke="#a8736a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${IX(xc)}" cy="${IY(zc, 3.05)}" r="4" fill="#f4a9bf"/>
    <ellipse cx="${IX(xc) - 13}" cy="${IY(zc, 2.62)}" rx="15" ry="5" fill="#ffe066" ${OL('#fcc419', 1.8)}/><path d="M${IX(xc) - 22} ${IY(zc, 2.62)} q9 -16 18 0 Z" fill="#ffe066" ${OL('#fcc419', 1.8)}/><path d="M${IX(xc) - 22} ${IY(zc, 2.62) - 2} h18" stroke="#ff8fab" stroke-width="3"/>
    <path d="M${IX(xc) + 10} ${IY(zc, 2.72)} q4 10 1 30 l7 1 q3 -18 -2 -31 Z" fill="#74c0fc" ${OL('#74c0fc', 1.8)}/>`;
  // the cow's little bell, tied to the pole on a red ribbon
  if (bell) {
    const bx = IX(xc) - 9;
    const by = IY(zc, 1.95);
    s += `<path d="M${IX(xc)} ${by - 3} L${bx} ${by + 2} v6" stroke="#e03131" stroke-width="2.2" fill="none"/>
      <path d="M${bx - 8} ${by + 24} Q${bx - 8} ${by + 8} ${bx} ${by + 8} Q${bx + 8} ${by + 8} ${bx + 8} ${by + 24} Z" fill="#ffd43b" ${OL('#fab005', 1.6)}/>
      <circle cx="${bx}" cy="${by + 26}" r="2.8" fill="#e9b200"/><path d="M${bx - 4} ${by + 13} q-1 5 0 8" stroke="#fff" stroke-width="2" opacity=".7" fill="none"/>`;
  }
  return s;
}

// ---------- the interior ----------

const Interior = {
  open: false,
  floor: 0,
  keys: new Set(),
  route: null,
  people: [],
  usable: [],

  init(cb) {
    this.cb = cb;
    this.el = document.getElementById('interior');
    this.el.innerHTML = `<div id="iworld"><svg id="ibase"></svg><div id="ifurn"></div><div id="ipig" class="actor"><div class="a-face"><div class="a-sprite" style="--k:${I_PIG}"></div></div></div><div id="iprompt"></div><div id="idoor" class="i-door">🚪 出门</div></div>
      <div class="i-room"><b id="iroom"></b><small id="ihouse"></small><button class="i-out" data-ileave title="出门 (Esc)">出门 ${ICON.back}</button></div>
      <div class="i-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>走动</span><span><kbd>E</kbd>使用</span><span><kbd>Esc</kbd>出门</span></div>`;
    this.world = document.getElementById('iworld');
    this.sprite = new PigSprite(this.el.querySelector('#ipig .a-sprite'));
    this.el.addEventListener('click', (e) => this.click(e));
    this.last = performance.now();
    requestAnimationFrame((t) => this.frameLoop(t));
    // night falls (or day breaks) while inside: the windows change
    setInterval(() => {
      if (this.open && townSky(townDate()).light > 0.5 !== this.dark) this.draw();
    }, 5000);
  },

  // Go in: the pig appears on the mat just inside the front door. home: whose house (the pig's
  // own when left out, following his save; someone else's stays as given)
  enter(snap, home) {
    this.snap = snap;
    this.own = !home;
    this.home = home || pigHome(snap.s);
    this.floor = 0;
    this.seated = null;
    this.open = true;
    this.el.classList.add('on');
    this.draw();
    const L = this.layout;
    this.place(L.door + I_DOOR_W / 2, L.depth - 0.75);
    this.keys.clear();
    this.route = null;
    this.makePeople();
    this.update(snap);
    this.centerCam(true);
  },

  leave() {
    this.endTalk();
    this.open = false;
    this.el.classList.remove('on');
    this.keys.clear();
    for (const p of this.people) p.el.remove();
    this.people = [];
    this.cb.onLeave(this.own ? null : this.home);
  },

  get layout() {
    return this.home.layout[this.floor];
  },

  // Everything that stands on this floor: each thing at the first floor with a spot for it
  pieces() {
    const floors = this.home.layout;
    const out = [];
    for (const it of this.home.things) {
      const f = floors.findIndex((L) => L.spots[it.id] || L.spots[it.group]);
      if (f !== this.floor || !FURN_ART[it.group]) continue;
      const L = floors[f];
      const at = L.spots[it.id] || L.spots[it.group];
      out.push({ group: it.group, it, at, art: FURN_ART[it.group](it) });
    }
    return out;
  },

  // The room at x on this floor (walls count as the room on their left)
  roomAt(x) {
    const rooms = this.layout.rooms;
    return rooms.find((r) => x < r.x + r.w + I_CAP / 2) || rooms[rooms.length - 1];
  },

  goFloor(f) {
    this.floor = Math.max(0, Math.min(this.home.layout.length - 1, f));
    this.draw();
  },

  draw() {
    const L = this.layout;
    const Z = L.depth;
    const ground = L.door != null;
    // after dark (by the town's clock) the windows show the night sky and no sun comes in
    const dark = (this.dark = townSky(townDate()).light > 0.5);
    const W = I_OX * 2 + IX(L.width);
    const H = Math.round(I_OY + IY(Z + I_CAP) + (ground ? 40 : 24));
    this.size = { w: W, h: H };
    let svg = `<defs>
      <filter id="iblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
      <linearGradient id="iAoTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3a4e" stop-opacity=".22"/><stop offset="1" stop-color="#6b3a4e" stop-opacity="0"/></linearGradient>
      <linearGradient id="iAoL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b3a4e" stop-opacity=".16"/><stop offset="1" stop-color="#6b3a4e" stop-opacity="0"/></linearGradient>
      <linearGradient id="iAoR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#6b3a4e" stop-opacity=".16"/><stop offset="1" stop-color="#6b3a4e" stop-opacity="0"/></linearGradient>
      <linearGradient id="iWallTone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3a4e" stop-opacity=".1"/><stop offset=".45" stop-color="#6b3a4e" stop-opacity="0"/></linearGradient>
      <linearGradient id="iSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark ? '#1c1e45' : '#9fd6ff'}"/><stop offset="1" stop-color="${dark ? '#4c4f8f' : '#e3f4ff'}"/></linearGradient>
      <linearGradient id="iNightSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1e45"/><stop offset="1" stop-color="#4c4f8f"/></linearGradient>
      <linearGradient id="iWell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2c38" stop-opacity=".55"/><stop offset=".7" stop-color="#4a2c38" stop-opacity="0"/></linearGradient>
      <linearGradient id="iShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c08" stop-opacity=".9"/><stop offset="1" stop-color="#140c08" stop-opacity="0"/></linearGradient>
    </defs>`;
    // outside: the garden round the ground floor, the roof below an upper floor
    if (ground) {
      svg += `<rect width="${W}" height="${H}" fill="#bfe3a0"/>`;
      for (let i = 0; i < Math.round(W / 13); i++) svg += `<path d="M${(i * 137) % W} ${I_OY + IY(Z + I_CAP) + 20 + ((i * 53) % 18)} q2 -6 4 0 q2 -5 4 0" stroke="#9fd17f" stroke-width="1.6" fill="none"/>`;
    } else {
      svg += `<rect width="${W}" height="${H}" fill="#cfe8ff"/>`;
      const ry = I_OY + IY(Z + I_CAP);
      svg += `<rect x="0" y="${ry}" width="${W}" height="${H - ry}" fill="#e8846f"/>`;
      for (let y = ry + 6; y < H; y += 9) for (let x = ((y / 9) % 2) * 11; x < W; x += 22) svg += `<path d="M${x} ${y} q11 8 22 0" stroke="#c8604d" stroke-width="2" fill="none"/>`;
    }
    let g = '';
    // the hedgehog's flowers go on the first window downstairs
    const sillRoom = this.home.sill && this.floor === 0 ? L.rooms.find((r) => r.window != null) : null;
    for (const r of L.rooms) {
      const k = ROOM_LOOKS[r.look];
      g += floorSvg(r, Z);
      if (r.window != null && r.look !== 'night' && !dark) g += windowLightSvg(r.x + r.window);
      if (r.light != null && !dark) g += windowLightSvg(r.x + r.light);
      g += `<rect x="${IX(r.x)}" y="${IY(0)}" width="${IX(r.w)}" height="${0.7 * I_R}" fill="url(#iAoTop)"/>
        <rect x="${IX(r.x)}" y="${IY(0)}" width="${0.45 * I_T}" height="${Z * I_R}" fill="url(#iAoL)"/>
        <rect x="${IX(r.x + r.w - 0.45)}" y="${IY(0)}" width="${0.45 * I_T}" height="${Z * I_R}" fill="url(#iAoR)"/>`;
      g += backWallSvg(r);
      if (r.window != null) g += windowSvg(r.x + r.window, k.curtain, r.look === 'night' || dark, r === sillRoom);
      if (r.clock != null) g += clockSvg(r.x + r.clock);
    }
    // thresholds in the doorways between rooms
    (L.doors || []).forEach(([z1, z2], i) => {
      const x = L.rooms[i].x + L.rooms[i].w;
      g += `<rect x="${IX(x) - 2}" y="${IY(z1)}" width="${IX(I_CAP) + 4}" height="${(z2 - z1) * I_R}" fill="#e0b98c"/>
        <path d="M${IX(x + I_CAP / 2)} ${IY(z1)} V${IY(z2)}" stroke="#c99a68" stroke-width="1.5" stroke-dasharray="4 5"/>`;
    });
    if (ground) g += (this.home.mat || doormatSvg)(L.door, Z);
    // the stairs: the flight up on the ground floor, the opening going down upstairs
    const props = [];
    if (L.stairs != null) {
      if (this.floor === 0) {
        const st = stairsUpSvg(L.stairs);
        g += st.wall;
        props.push({ zi: izi(I_STAIRS.d), svg: st.flight });
      } else {
        const st = stairsDownSvg(L.stairs);
        g += st.hole;
        props.push({ zi: izi(I_STAIRS.hole), svg: st.rail });
      }
    }
    // diplomas on their stretch of wall
    if (L.diplomas) g += diplomasSvg(L.diplomas, this.home.degrees);
    svg += `<g transform="translate(${I_OX} ${I_OY})">${g}</g>`;
    const base = document.getElementById('ibase');
    base.setAttribute('width', W);
    base.setAttribute('height', H);
    base.setAttribute('viewBox', `0 0 ${W} ${H}`);
    base.innerHTML = svg;
    this.world.style.width = `${W}px`;
    this.world.style.height = `${H}px`;
    // round the house, past the edges of the world: the garden, or sky above and roof below
    this.el.style.background = ground ? '#bfe3a0' : 'linear-gradient(#cfe8ff 50%, #e8846f 50%)';
    // the pig's own entrance: a coat stand and a pair of slippers by the mat
    if (ground && this.own) {
      props.push({ zi: izi(Z - 0.25), svg: coatStandSvg(L.door - 0.75, Z - 0.55, this.home.bell) });
      for (const [dx, dz] of [[0.25, -0.05], [0.55, 0.05]]) props.push({ zi: izi(Z - 0.5 + dz), svg: ibox(L.door + I_DOOR_W + dx, Z - 0.9 + dz, 0.24, 0.4, 0.14, '#ff8fab', { r: 5, ol: 1.8 }) });
    }
    // what comes with the rooms. In someone else's house that's everything, and a thing or two
    // there does something (use: 'tea', or 'sign', their pride and joy); hearts lets a thing show
    // how well they know the pig. On the wall: z is how high it hangs.
    this.fixtures = [];
    this.usable = [];
    const have = new Set(this.home.things.map((t) => t.group));
    for (const [name, x, z, o = {}] of L.fixtures || []) {
      if (o.unless && have.has(o.unless)) continue; // stands in for something not bought yet
      const art = FIXTURE_ART[name]({ ...o, hearts: this.home.hearts || 0 });
      const x0 = x - art.w / 2;
      const use = o.use ? `class="ifurn" data-ifix="${this.usable.length}"` : '';
      if (art.wall) props.push({ zi: 2, svg: `<g ${use} transform="translate(${IX(x)} ${IY(0, z)})">${art.svg}</g>` });
      else props.push({ zi: art.flat ? 1 : izi(z + art.d), svg: `<g ${use} transform="translate(${IX(x0)} ${IY(z)})">${art.svg}</g>` });
      if (!art.flat && !art.wall) this.fixtures.push({ x0, z0: z, x1: x0 + art.w, z1: z + art.d });
      // something on the wall is in reach from a step or two out, over whatever stands below it
      if (o.use) this.usable.push({ use: o.use, wall: !!art.wall, art, zi: art.flat ? 1 : izi(z + art.d), box: art.wall ? { x0, z0: 0, x1: x0 + art.w, z1: 1.5 } : { x0, z0: z, x1: x0 + art.w, z1: z + art.d }, h: art.wall ? z + 0.6 : art.h || 1.5 });
    }
    props.push(...this.wallsSvg());
    this.props = props;
    this.drawFurniture();
    // the way out, said beside the mat (never over it: the pig comes in standing on the mat)
    const door = document.getElementById('idoor');
    door.classList.toggle('on', ground);
    if (ground) door.style.transform = `translate(${I_OX + IX(L.door + I_DOOR_W + 1.1)}px, ${I_OY + IY(Z - 0.45)}px) translate(0, -50%)`;
  },

  // The walls seen from above, cut away so we can see in: the back wall's top, thin side walls and
  // the walls between rooms (with their doorways), the front wall cut down low with the front door.
  // Each is stacked by how far forward it reaches, so the pig passes in front of or behind them.
  wallsSvg() {
    const L = this.layout;
    const Z = L.depth;
    const wc = this.home.walls || '#a8736a';
    const lit = lighter(wc, 0.35);
    const capTop = IY(-I_CAP, I_WALL);
    const bottom = IY(Z + I_CAP);
    const strip = (x, y1, y2) => `<rect x="${IX(x)}" y="${y1}" width="${IX(I_CAP)}" height="${y2 - y1}" fill="${wc}"/><rect x="${IX(x)}" y="${y1}" width="2.5" height="${y2 - y1}" fill="${lit}"/>`;
    const out = [];
    const top = 3000;
    let s = `<rect x="${IX(-I_CAP)}" y="${capTop}" width="${IX(L.width + 2 * I_CAP)}" height="${I_CAP * I_R}" fill="${wc}"/>
      <rect x="${IX(-I_CAP)}" y="${capTop}" width="${IX(L.width + 2 * I_CAP)}" height="2.5" fill="${lit}"/>`;
    s += strip(-I_CAP, capTop, bottom) + strip(L.width, capTop, bottom);
    out.push({ zi: top, svg: s });
    // the walls between rooms: the part behind the doorway is stacked at the doorway, the part in
    // front of it at the front. Door casings: trims across the wall's cut ends, flush with it.
    L.rooms.slice(0, -1).forEach((r, i) => {
      const x = r.x + r.w;
      const [z1, z2] = (L.doors || [])[i] || [Z, Z];
      const trim = (z) => `<rect x="${IX(x - 0.1)}" y="${IY(z)}" width="${IX(I_CAP + 0.2)}" height="${0.18 * I_R}" rx="2" fill="#f7e3d0" ${OL('#f7e3d0', 2)}/>`;
      out.push({ zi: izi(z1), svg: strip(x, capTop, IY(z1)) + trim(z1 - 0.18) });
      if (z2 < Z) out.push({ zi: top, svg: strip(x, IY(z2), bottom) + trim(z2) });
    });
    // the front wall, cut down low, with the front door's opening, its casings and a step outside
    const fy = IY(Z, I_CUT);
    const fseg = (x1, x2) => `<rect x="${IX(x1)}" y="${fy}" width="${IX(x2 - x1)}" height="${I_CAP * I_R}" fill="${wc}"/>
      <rect x="${IX(x1)}" y="${fy}" width="${IX(x2 - x1)}" height="2.5" fill="${lit}"/>
      <rect x="${IX(x1)}" y="${fy + I_CAP * I_R}" width="${IX(x2 - x1)}" height="${I_CUT * I_H}" fill="${darker(wc, 0.25)}"/>`;
    const right = L.width + I_CAP;
    let f = '';
    if (L.door != null) {
      const dx = L.door;
      f += fseg(-I_CAP, dx) + fseg(dx + I_DOOR_W, right);
      f += `<rect x="${IX(dx)}" y="${IY(Z)}" width="${IX(I_DOOR_W)}" height="${I_CAP * I_R}" fill="#e0b98c"/>`;
      f += ibox(dx - 0.1, Z + I_CAP, I_DOOR_W + 0.2, 0.45, 0.18, '#e9e1d6', { r: 4, ol: 2 });
      for (const px of [dx - 0.22, dx + I_DOOR_W]) f += ibox(px, Z - 0.02, 0.22, I_CAP + 0.04, I_CUT + 0.2, '#f7e3d0', { r: 3, ol: 2 });
      for (let i = 0; i < 1; i++) f += `<ellipse cx="${IX(dx + I_DOOR_W / 2) - 6}" cy="${IY(Z + I_CAP) + 29}" rx="${0.42 * I_T}" ry="${0.42 * I_R * 0.7}" fill="#e9e1d6" ${OL('#d8cdbf', 2)}/>`;
    } else f += fseg(-I_CAP, right);
    out.push({ zi: top + 1, svg: f });
    return out;
  },

  drawFurniture() {
    this.items = this.pieces();
    const els = [];
    const at = (x, z) => `left:${I_OX + IX(x)}px;top:${I_OY + IY(z)}px`;
    this.items.forEach((p, i) => {
      const { art } = p;
      if (art.wall) {
        els.push(`<svg class="ifurn" data-furn="${i}" style="left:${I_OX + IX(p.at[0])}px;top:${I_OY + IY(0, p.at[1])}px;z-index:2" width="1" height="1" overflow="visible">${art.svg}<title>${esc(p.it.name || '')}</title></svg>`);
        return;
      }
      const x0 = p.at[0] - art.w / 2;
      const z0 = p.at[1];
      p.box = { x0, z0, x1: x0 + art.w, z1: z0 + art.d };
      p.zi = art.flat ? 1 : izi(z0 + art.d);
      els.push(`<svg class="ifurn${art.flat ? ' flat' : ''}" data-furn="${i}" style="${at(x0, z0)};z-index:${p.zi}" width="1" height="1" overflow="visible">${art.svg}<title>${esc(p.it.name || '')}</title></svg>`);
      if (art.over) els.push(`<svg class="ifurn" data-furn="${i}" style="${at(x0, z0)};z-index:${p.zi + 2}" width="1" height="1" overflow="visible">${art.over}</svg>`);
    });
    for (const p of this.props) els.push(`<svg class="iprop" style="${at(0, 0)};z-index:${p.zi}" width="1" height="1" overflow="visible">${p.svg}</svg>`);
    document.getElementById('ifurn').innerHTML = els.join('');
    this.blockers = this.blocking();
    this.furnKey = this.thingsKey();
  },

  thingsKey() {
    return JSON.stringify([this.home.key, this.floor, this.home.things.map((t) => t.id), this.home.degrees.length, this.home.bell, this.home.sill]);
  },

  // Floor the pig can't stand on: each piece's footprint, stretched back over the floor where it
  // would hide him completely, and on to the wall behind or beside it when the gap left there is
  // too narrow to walk into; the stairs, the coat stand and the rooms' own things
  blocking() {
    const L = this.layout;
    const out = [];
    for (const p of this.items) {
      if (!p.box || p.art.flat) continue;
      let { x0, z0, x1, z1 } = p.box;
      const room = this.roomAt((x0 + x1) / 2);
      // how far behind it the pig would be out of sight altogether
      const hide = Math.max(0, ((p.art.h || 0) * I_H - 70) / I_R);
      z0 = z0 - hide < 1.3 ? 0 : z0 - hide;
      if (x0 - room.x < 1.1) x0 = room.x;
      if (room.x + room.w - x1 < 1.1) x1 = room.x + room.w;
      out.push({ x0, z0, x1, z1 });
    }
    if (L.stairs != null) {
      const a = this.floor === 0 ? L.stairs : L.stairs + I_STAIRS.landing;
      out.push({ x0: a, z0: 0, x1: L.stairs + I_STAIRS.len, z1: this.floor === 0 ? I_STAIRS.d : I_STAIRS.hole + 0.1 });
    }
    if (L.door != null && this.own) out.push({ x0: L.door - 1.05, z0: L.depth - 0.85, x1: L.door - 0.45, z1: L.depth });
    out.push(...this.fixtures);
    return out;
  },

  // ---------- walking ----------

  // Floor the pig can stand on: inside a room, in a doorway between rooms, or in the front door's
  // opening; and not in furniture
  walkable(x, z) {
    const L = this.layout;
    const Z = L.depth;
    const inRoom = L.rooms.some((r) => x > r.x + I_RX && x < r.x + r.w - I_RX && z > 0.35 && z < Z - I_RZ);
    const inDoor = (L.doors || []).some(([z1, z2], i) => {
      const wx = L.rooms[i].x + L.rooms[i].w;
      return x > wx - I_RX - 0.2 && x < wx + I_CAP + I_RX + 0.2 && z > z1 + I_RZ && z < z2 - I_RZ;
    });
    const atFront = L.door != null && x > L.door + 0.5 && x < L.door + I_DOOR_W - 0.5 && z > Z - 1 && z < Z + 0.3;
    if (!inRoom && !inDoor && !atFront) return false;
    return !this.blockers.some((b) => x + I_RX > b.x0 && x - I_RX < b.x1 && z + I_RZ > b.z0 && z - I_RZ < b.z1);
  },

  // Put the pig at (x, z), lift tiles off the floor (lying in bed)
  place(x, z, lift = 0) {
    this.pos = { x, z };
    const el = document.getElementById('ipig');
    el.style.transform = `translate(${I_OX + IX(x)}px, ${I_OY + IY(z, lift)}px)`;
    el.style.zIndex = izi(z) + 1;
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
      const t = this.nearest();
      if (t && (this.snap.sleeping || !this.busyWhy(true))) t.run();
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

  // Everything here that does something: { box (its footprint), h (how tall), label (what E
  // does), run } — the pig's furniture, the things in someone's house that do something, and
  // whoever is in it with him (box: where they stand)
  targets() {
    const out = [];
    for (const p of this.items) {
      if (!FURN_USE[p.group] || !p.box) continue;
      out.push({ box: p.box, h: p.art.h || 2, label: FURN_USE[p.group].label(this.snap), run: () => this.useFurn(p) });
    }
    for (const u of this.usable) out.push({ ...u, label: u.use === 'sleep' ? FURN_USE.bed.label(this.snap) : this.home.labels[u.use], run: () => this.useFixture(u) });
    for (const p of this.people) out.push({ box: { x0: p.x - 0.35, z0: p.z - 0.3, x1: p.x + 0.35, z1: p.z }, h: p.small ? 2.1 : 2.7, person: p, label: '说话', run: () => this.meet(p.id) });
    return out;
  },

  // What the pig is standing at, if anything: the closest within reach that he isn't behind (a
  // thing on the wall: standing at the wall below it)
  nearest() {
    let best = null;
    for (const t of this.targets()) {
      const { x0, z0, x1, z1 } = t.box;
      const dx = Math.max(0, x0 - this.pos.x, this.pos.x - x1);
      const dz = Math.max(0, this.pos.z - z1);
      const d = Math.hypot(dx, dz) + (t.person ? 0.2 : 0);
      if ((this.pos.z > z0 || t.wall) && d < (t.person ? 1.4 : 1.1) && (!best || d < best.d)) best = { t, d };
    }
    if (best?.t.person && this.talk?.id === best.t.person.id) return null; // already talking
    return best?.t;
  },

  useFurn(p) {
    const [act, id] = FURN_USE[p.group].act(this.snap);
    this.cb.onUse(act, id);
  },

  click(e) {
    if (e.target.closest('[data-ileave]')) return this.leave();
    if (e.target.closest('.i-room, .i-hint')) return;
    const tk = e.target.closest('[data-tk]');
    if (tk) return this.talkAction(tk);
    if (e.target.closest('.talk')) return;
    const f = e.target.closest('[data-furn]');
    const fx = e.target.closest('[data-ifix]');
    const who = e.target.closest('[data-iperson]');
    const r = this.el.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / I_ZOOM + this.cam.x - I_OX) / I_T;
    const wz = ((e.clientY - r.top) / I_ZOOM + this.cam.y - I_OY) / I_R;
    if (this.busyWhy(true)) return;
    // walk up to it (in front of it; beside someone) and use it
    const goTo = (box, run, side = false) => {
      const cx = (box.x0 + box.x1) / 2;
      const spots = side ? [[box.x0 - 0.55, box.z1 - 0.05], [box.x1 + 0.55, box.z1 - 0.05], [cx, box.z1 + 0.6]] : [[cx, box.z1 + I_RZ + 0.2], [cx, box.z1 + 0.8]];
      const [x, z] = spots.sort((a, b) => Math.hypot(a[0] - this.pos.x, a[1] - this.pos.z) - Math.hypot(b[0] - this.pos.x, b[1] - this.pos.z)).find(([sx, sz]) => this.walkable(sx, sz)) || spots[0];
      this.route = { to: { x, z }, done: run };
    };
    if (who) {
      const p = this.people.find((q) => q.id === who.dataset.iperson);
      if (p) goTo({ x0: p.x, z0: p.z, x1: p.x, z1: p.z }, () => this.meet(p.id), true);
      return;
    }
    if (fx) {
      const u = this.usable[fx.dataset.ifix];
      return goTo(u.box, () => this.useFixture(u));
    }
    if (f) {
      const p = this.items[f.dataset.furn];
      if (!FURN_USE[p.group] || !p.box) return;
      return goTo(p.box, () => this.useFurn(p));
    }
    this.endTalk();
    if (this.walkable(wx, wz)) this.route = { to: { x: wx, z: wz }, done: () => {} };
  },

  frameLoop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.open) this.frame(dt);
    requestAnimationFrame((t) => this.frameLoop(t));
  },

  frame(dt) {
    let vx = 0;
    let vz = 0;
    if (this.route) {
      const dx = this.route.to.x - this.pos.x;
      const dz = this.route.to.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        const done = this.route.done;
        this.route = null;
        done();
      } else {
        vx = dx / d;
        vz = dz / d;
      }
    } else if (this.keys.size && !this.busyWhy()) {
      for (const k of this.keys) {
        vx += KEY_DIRS[k][0];
        vz += KEY_DIRS[k][1];
      }
      const len = Math.hypot(vx, vz);
      if (len) {
        vx /= len;
        vz /= len;
      }
    }
    const moving = !!(vx || vz);
    if (moving) {
      const step = I_SPEED * dt;
      let { x, z } = this.pos;
      if (this.walkable(x + vx * step, z)) x += vx * step;
      if (this.walkable(x, z + vz * step)) z += vz * step;
      if (x === this.pos.x && z === this.pos.z && this.route) this.route = null; // stuck: give up
      this.place(x, z);
      if (vx) this.el.querySelector('#ipig .a-face').style.transform = `scaleX(${Math.sign(vx)})`;
      this.checkExits(vx, vz);
    }
    this.sprite.root.classList.toggle('walking', moving);
    if (this.people.length) this.movePeople(dt);
    this.updatePrompt();
    this.centerCam(false);
  },

  // Out the front door, or up and down the stairs
  checkExits(vx, vz) {
    const L = this.layout;
    const { x, z } = this.pos;
    if (L.door != null && vz > 0 && x > L.door && x < L.door + I_DOOR_W && z > L.depth - 0.3) {
      this.leave();
      return;
    }
    if (L.stairs == null) return;
    const { len, d, landing, hole } = I_STAIRS;
    // up: walk into the foot of the flight; down: walk onto the landing at the top
    const up = this.floor === 0 && x < L.stairs + len + 0.9 && z < d - 0.1 && (vx < 0 || vz < 0);
    const down = this.floor > 0 && x < L.stairs + landing + 0.3 && z < hole + 0.45 && (vx < 0 || vz < 0);
    if (!up && !down) return;
    this.goFloor(up ? 1 : 0);
    const n = this.layout.stairs;
    if (up) this.place(n + 0.75, hole + 0.95);
    else this.place(n + len + 1.2, d + 0.5);
    this.el.querySelector('#ipig .a-face').style.transform = `scaleX(1)`;
    this.keys.clear();
    this.route = null;
    this.centerCam(true);
  },

  updatePrompt() {
    const L = this.layout;
    const away = L.door != null && Math.hypot(this.pos.x - (L.door + I_DOOR_W / 2), this.pos.z - L.depth) > 3.2;
    document.getElementById('idoor').classList.toggle('away', away);
    const el = document.getElementById('iprompt');
    const t = (!this.busyWhy() || this.snap.sleeping) && !Story.open && !this.talk ? this.nearest() : null;
    if (!t) {
      el.classList.remove('on');
      return;
    }
    const html = `<kbd>E</kbd>${t.label}`;
    if (el.innerHTML !== html) el.innerHTML = html;
    const z = t.person ? t.person.z : t.wall ? 0 : t.box.z0;
    el.style.transform = `translate(${I_OX + IX((t.box.x0 + t.box.x1) / 2)}px, ${I_OY + IY(z, t.h) - 8}px) translate(-50%, -100%)`;
    el.classList.add('on');
  },

  centerCam(snap) {
    const vw = this.el.clientWidth / I_ZOOM;
    const vh = this.el.clientHeight / I_ZOOM;
    const { w: W, h: H } = this.size;
    const px = I_OX + IX(this.pos.x);
    const py = I_OY + IY(this.pos.z) - 40;
    const tx = W <= vw ? (W - vw) / 2 : clamp(px - vw / 2, 0, W - vw);
    const ty = H <= vh ? (H - vh) / 2 : clamp(py - vh / 2, 0, H - vh);
    this.cam = this.cam && !snap ? { x: this.cam.x + (tx - this.cam.x) * 0.15, y: this.cam.y + (ty - this.cam.y) * 0.15 } : { x: tx, y: ty };
    this.world.style.transform = `translate(${-this.cam.x * I_ZOOM}px, ${-this.cam.y * I_ZOOM}px) scale(${I_ZOOM})`;
    // the room in big letters, the house beside it in small ones (one name when they're the same)
    const name = this.roomAt(this.pos.x).name || this.home.name;
    const house = name === this.home.name ? '' : this.home.name;
    const label = document.getElementById('iroom');
    if (label.textContent !== name) label.textContent = name;
    const small = document.getElementById('ihouse');
    if (small.textContent !== house) small.textContent = house;
  },

  react(it) {
    playUse(this.sprite.root, document.getElementById('ipig'), it);
  },

  // ---------- whoever lives here ----------
  // In someone else's house they're in it too, getting on with what they do at home: moving now
  // and then between the spots for what their day says they're doing (home.spots[act], or _), each
  // spot [x, z, doing, holding]. Anyone round for a visit sits at a guest spot. Walk up and press
  // E (or click them) to talk, just like in town.

  makePeople() {
    this.people = [];
    this.talk = null;
    if (this.own) return;
    const H = this.home;
    const add = (id, spots, i) => {
      const n = NPC_BY_ID[id];
      const k = I_PIG * (NPC_SCALE / PIG_SCALE) * (n.small ? 0.72 : 1);
      const el = document.createElement('div');
      el.className = `actor npc ipers ${n.small ? 'small' : ''}`;
      el.dataset.iperson = id;
      el.innerHTML = `<div class="npc-say"></div><div class="a-face"><div class="a-sprite" style="--k:${k}">${animalSvg(n.species)}</div></div><div class="a-hold"></div>`;
      this.world.appendChild(el);
      const [x, z] = spots[i % spots.length];
      const p = { id, small: !!n.small, el, spots, i: i % spots.length, x, z, dir: 1, to: null, wait: performance.now() + 6000 + Math.random() * 8000 };
      this.people.push(p);
      this.settle(p);
      this.placePerson(p);
    };
    const plan = npcPlan(H.host);
    add(H.host, H.spots[plan.act] || H.spots._, 0);
    H.guests.forEach((g, i) => add(g, [H.guestSpots[i % H.guestSpots.length]], 0));
  },

  person(id) {
    return this.people.find((p) => p.id === id);
  },

  // Arrived at a spot: start doing what's done there, facing the pig if he's near
  settle(p) {
    const [, , act = '', hold = ''] = p.spots[p.i];
    p.el.dataset.act = act;
    p.el.querySelector('.a-hold').innerHTML = hold ? `<span>${hold}</span>` : '';
    if (this.pos && Math.hypot(this.pos.x - p.x, this.pos.z - p.z) < 3) p.dir = Math.sign(this.pos.x - p.x) || p.dir;
  },

  placePerson(p) {
    p.el.style.transform = `translate(${I_OX + IX(p.x)}px, ${I_OY + IY(p.z, p.lift || 0)}px)`;
    p.el.style.zIndex = p.lift ? izi(p.z + 1.2) : izi(p.z) + 1;
    p.el.querySelector('.a-face').style.transform = `scaleX(${p.dir})`;
    p.el.classList.toggle('walking', !!p.to);
  },

  movePeople(dt) {
    const now = performance.now();
    for (const p of this.people) {
      if (this.talk?.id === p.id || p.pinned) continue;
      if (p.to) {
        const dx = p.to.x - p.x;
        const dz = p.to.z - p.z;
        const d = Math.hypot(dx, dz);
        const step = (p.id === 'turtle' ? 0.7 : 1.5) * dt;
        if (d <= step) {
          Object.assign(p, { x: p.to.x, z: p.to.z, to: null, wait: now + 12000 + Math.random() * 14000 });
          this.settle(p);
        } else {
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          if (Math.abs(dx) > 0.05) p.dir = Math.sign(dx);
        }
        this.placePerson(p);
      } else if (now > p.wait && p.spots.length > 1) {
        p.i = (p.i + 1 + Math.floor(Math.random() * (p.spots.length - 1))) % p.spots.length;
        const [x, z] = p.spots[p.i];
        p.to = { x, z };
        p.el.dataset.act = '';
        p.el.querySelector('.a-hold').innerHTML = '';
      }
    }
    // walking away from someone ends the talk
    const t = this.talk && this.person(this.talk.id);
    if (t && Math.hypot(this.pos.x - t.x, this.pos.z - t.z) > 2.4) this.endTalk();
  },

  // Talk to someone here: they stop and turn to the pig, and say hello (or tell a heart story)
  meet(id) {
    const p = this.person(id);
    if (!p || Story.open) return;
    this.endTalk();
    p.to = null;
    this.talk = { id, mode: 'line', line: null };
    p.dir = Math.sign(this.pos.x - p.x) || 1;
    this.placePerson(p);
    this.el.querySelector('#ipig .a-face').style.transform = `scaleX(${-p.dir})`;
    this.renderTalk();
    this.cb.act('meet', id);
  },

  renderTalk() {
    const t = this.talk;
    const p = t && this.person(t.id);
    if (!p) return;
    let box = p.el.querySelector('.talk');
    if (!box) {
      box = document.createElement('div');
      box.className = 'talk';
      p.el.appendChild(box);
    }
    p.el.classList.add('talking');
    const tea = t.id === this.home.host && this.snap.s.npc?.[t.id]?.tea !== dayKey();
    const html = talkHtml(t, this.snap, { together: false, tea });
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
  },

  talkAction(btn) {
    const t = this.talk;
    if (!t || btn.disabled) return;
    const tk = btn.dataset.tk;
    if (tk === 'chat') this.cb.act('chat', t.id);
    else if (tk === 'gift') t.mode = 'gift';
    else if (tk === 'back') t.mode = 'line';
    else if (tk === 'give') {
      t.mode = 'line';
      this.cb.act('gift', `${t.id}:${btn.dataset.item}`);
    } else if (tk === 'answer') {
      const k = t.ask.k;
      Object.assign(t, { ask: null, mode: 'line' });
      this.cb.act('answer', `${t.id}:${k}:${btn.dataset.i}`);
    } else if (tk === 'tea') return this.askTea();
    else if (tk === 'snap') this.cb.act('snapPhoto', `${t.id}:home-${this.home.host}`);
    if (this.talk) this.renderTalk();
  },

  endTalk() {
    const t = this.talk;
    if (!t) return;
    this.talk = null;
    const p = this.person(t.id);
    p?.el.querySelector('.talk')?.remove();
    p?.el.classList.remove('talking');
    if (p) p.wait = performance.now() + 4000;
  },

  // What someone here said, from the pet window. false: they're not here.
  onTalk(t) {
    const p = this.person(t.id);
    if (!this.open || !p) return false;
    if (t.story != null) {
      this.endTalk();
      Story.play(t.id, t.story);
      return true;
    }
    if (t.tea) {
      this.teaTime(t.id);
      return true;
    }
    if (t.face) this.personFx(p, t.face);
    if (t.gain && t.face !== '💗💗') this.personFx(p, '💗', t.face ? 500 : 0);
    if (this.talk?.id === t.id) {
      Object.assign(this.talk, { line: t.line, ask: t.ask || null, mode: t.ask ? 'ask' : 'line' });
      this.renderTalk();
    } else if (t.line) this.say(t.id, t.line);
    return true;
  },

  // A word over someone's head
  say(id, text) {
    const el = this.person(id)?.el.querySelector('.npc-say');
    if (!el) return;
    el.textContent = text;
    el.style.setProperty('--ms', '3600ms');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(el.timer);
    el.timer = setTimeout(() => el.classList.remove('on'), 3600);
  },

  personFx(p, ch, delay = 0) {
    setTimeout(() => {
      const f = document.createElement('div');
      f.className = 'city-fx';
      f.textContent = ch;
      f.style.left = `${I_OX + IX(p.x) + (this.talk?.id === p.id ? -30 : 0)}px`;
      f.style.top = `${I_OY + IY(p.z) - (p.small ? 58 : 76)}px`;
      f.style.zIndex = 4000;
      this.world.appendChild(f);
      setTimeout(() => f.remove(), 1600);
    }, delay);
  },

  // The table, the tea set, their pride and joy
  useFixture(u) {
    // the futon at home, until there's a bed
    if (u.use === 'sleep') return this.cb.onUse(...FURN_USE.bed.act(this.snap));
    if (u.use === 'tea') return this.askTea();
    // their pride and joy: they tell you about it, a bit more each time
    const id = this.home.host;
    const lines = NPC_VISITS[id].sign;
    this.signI = ((this.signI ?? Math.floor(Math.random() * lines.length)) + 1) % lines.length;
    this.say(id, lines[this.signI].replace(/^[\^!~]/, ''));
  },

  askTea() {
    const id = this.home.host;
    this.endTalk();
    if (this.snap.s.npc?.[id]?.tea === dayKey()) return this.say(id, '明天再来喝呀。');
    this.cb.act('tea', id);
  },

  // Sitting down together: the pig and the host on the seats either side of the table (tea.pig,
  // tea.host: [x, z, how high the seat is]), a few words over the cups; then up again
  teaTime(id) {
    const T = this.home.tea;
    const p = this.person(id);
    this.endTalk();
    this.route = null;
    this.keys.clear();
    const [px, pz, lift = 0] = T.pig;
    this.place(px, pz, lift);
    if (lift) document.getElementById('ipig').style.zIndex = izi(pz + 1.2) + 1;
    Object.assign(p, { x: T.host[0], z: T.host[1], lift: T.host[2] || 0, to: null, pinned: true, dir: Math.sign(px - T.host[0]) || 1 });
    p.el.dataset.act = '';
    p.el.querySelector('.a-hold').innerHTML = '';
    this.placePerson(p);
    this.el.querySelector('#ipig .a-face').style.transform = `scaleX(${-p.dir})`;
    this.centerCam(false);
    Story.say(id, NPC_VISITS[id].tea, () => {
      // up off the seats, onto open floor in front
      const free = (x, z) => [[x, z + 1.0], [x, z + 1.5], [x - 0.9, z + 0.6], [x + 0.9, z + 0.6], [x, z + 2]].find(([a, b]) => this.walkable(a, b)) || [x, z + 1];
      this.place(...free(px, pz));
      const [hx, hz] = free(p.x, p.z);
      Object.assign(p, { x: hx, z: hz, lift: 0, pinned: false, wait: performance.now() + 5000 });
      this.placePerson(p);
    });
  },

  // ---------- following the snapshot ----------

  update(snap) {
    this.snap = snap;
    if (!this.open) return;
    const before = this.home.key;
    if (this.own) this.home = pigHome(snap.s);
    if (this.home.key !== before) {
      // moved house: start again at the front door
      this.floor = 0;
      this.draw();
      this.place(this.layout.door + I_DOOR_W / 2, this.layout.depth - 0.75);
    } else if (this.thingsKey() !== this.furnKey) this.draw();
    this.sprite.update(snap.s, snap.sleeping);
    // busy at home: stand at (or lie in) whatever's being used
    const a = this.own && snap.s.activity;
    const group = a && HOME_SPOT_FOR[a.type === 'hobby' ? a.id : a.type];
    const thing = group && this.home.things.find((t) => t.group === group);
    const f = thing ? this.home.layout.findIndex((L) => L.spots[thing.id] || L.spots[group]) : -1;
    if (f >= 0 && f !== this.floor && !this.route) {
      this.goFloor(f);
      this.centerCam(true);
    }
    // no bed yet: he sleeps on the futon
    const piece = group && (this.items.find((p) => p.group === group) || (group === 'bed' && this.usable.find((u) => u.use === 'sleep')));
    if (piece && piece.art.seat && !this.route) {
      const [sx, sz, lift] = piece.art.seat;
      this.place(piece.box.x0 + sx, piece.box.z0 + sz, lift);
      document.getElementById('ipig').style.zIndex = piece.zi + 1;
      this.seated = piece;
    } else if (this.seated && !piece) {
      // done: get up and step out in front of it (or beside it)
      const { x0, x1, z1 } = this.seated.box;
      const spots = [[(x0 + x1) / 2, z1 + 0.35], [x0 - 0.6, z1 - 0.3], [x1 + 0.6, z1 - 0.3], [(x0 + x1) / 2, z1 + 1]];
      const to = spots.find(([x, z]) => this.walkable(x, z));
      if (to) this.place(...to);
      this.seated = null;
    }
    this.sprite.root.classList.toggle('studying', !!(a && a.type === 'hobby'));
    if (this.talk) this.renderTalk();
  },
};
