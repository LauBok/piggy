// The homes the pig can visit: the three neighbours' (the rabbit's burrow, the panda's bamboo
// hut, the hedgehog's stump) and three keepers' (the cow's ranch house, the bear's woodshop, the
// turtle's shell house). Each is a layout for the interior (see HOUSE_LAYOUTS), its walls, floor
// and furniture drawn its owner's way, and where its owner is at home (spots, by what their day
// says they're doing). Everything in it comes with the house: one thing is where you sit down for
// a cup (use: 'tea'), one is what they're proudest of (use: 'sign').

// ---------- walls ----------

const wallBox = (r) => ({ x0: IX(r.x), x1: IX(r.x + r.w), W: IX(r.w), top: IY(0, I_WALL), H: I_WALL * I_H });

// The shading every back wall gets: darker toward the ceiling, a lit strip along the top
function wallShade(r, c) {
  const { x0, W, top, H } = wallBox(r);
  return `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="url(#iWallTone)"/>
    <rect x="${x0}" y="${top}" width="${W}" height="${0.16 * I_H}" fill="${lighter(c, 0.35)}" opacity=".7"/>`;
}

// A round ceiling: dark in both top corners, for a burrow, a stump, a shell
function vault(r, c, k = 1) {
  const { x0, x1, top } = wallBox(r);
  const rx = 1.7 * I_T * k;
  const ry = 1.6 * I_H * k;
  return `<path d="M${x0} ${top} H${x0 + rx} Q${x0} ${top} ${x0} ${top + ry} Z" fill="${c}"/>
    <path d="M${x1} ${top} H${x1 - rx} Q${x1} ${top} ${x1} ${top + ry} Z" fill="${c}"/>`;
}

// A skirting along the foot of the wall
const skirt = (r, c, h = 0.3) => `<rect x="${IX(r.x)}" y="${IY(0, h)}" width="${IX(r.w)}" height="${h * I_H}" fill="${c}"/><rect x="${IX(r.x)}" y="${IY(0, h)}" width="${IX(r.w)}" height="2" fill="#fff" opacity=".3"/>`;

const HOME_LOOKS = {
  // the rabbit's hall: packed earth, layers in it, roots and grass hanging in from above, a round
  // skylight with the sun coming through
  burrow: {
    floor: 'earth',
    wall(r) {
      const { x0, W, top, H } = wallBox(r);
      const c = r.pale ? '#f3dcc0' : '#e8c9a0';
      const rnd = seeded(31 + Math.round(r.x * 7));
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="${c}"/>`;
      for (const y of [1.2, 2.6, 4.0]) {
        let d = `M${x0} ${IY(0, y)}`;
        for (let x = 0; x <= r.w; x += 1) d += ` Q${IX(r.x + x + 0.5)} ${IY(0, y + (rnd() - 0.5) * 0.4)} ${IX(r.x + x + 1)} ${IY(0, y)}`;
        s += `<path d="${d}" stroke="${darker(c, 0.08)}" stroke-width="5" fill="none" opacity=".7"/>`;
      }
      for (let i = 0; i < r.w * 2; i++) s += `<ellipse cx="${IX(r.x + rnd() * r.w)}" cy="${IY(0, 0.5 + rnd() * 4.3)}" rx="${3 + rnd() * 4}" ry="${2 + rnd() * 2.5}" fill="${darker(c, 0.14)}" opacity=".55"/>`;
      if (r.pale) for (let i = 0; i < r.w; i++) s += `<circle cx="${IX(r.x + 0.5 + i)}" cy="${IY(0, 3.2 + (i % 2) * 0.6)}" r="3" fill="#ffc9dc" opacity=".8"/>`;
      s += skirt(r, darker(c, 0.2), 0.35) + wallShade(r, c) + vault(r, '#7a5a3e');
      // roots and grass hanging in through the ceiling
      for (let i = 0; i < r.w / 1.4; i++) {
        const x = IX(r.x + 1.2 + i * 1.4 + rnd() * 0.4);
        const len = 18 + rnd() * 30;
        s += `<path d="M${x} ${top} q${-6 + rnd() * 12} ${len / 2} ${-3 + rnd() * 6} ${len}" stroke="#8a6a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <path d="M${x + 8} ${top} q2 8 -2 14 M${x + 12} ${top} q-1 6 2 10" stroke="#74b04a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      }
      if (r.sky != null) {
        const cx = IX(r.x + r.sky);
        const cy = IY(0, 4.2);
        s += `<circle cx="${cx}" cy="${cy}" r="30" fill="#c4a27e"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<ellipse cx="${cx + Math.cos(i * 0.785) * 30}" cy="${cy + Math.sin(i * 0.785) * 30}" rx="7" ry="5" fill="#dcd3c6" ${OL('#dcd3c6', 1.4)}/>`).join('')}
          <circle cx="${cx}" cy="${cy}" r="24" fill="url(#iSky)"/><path d="M${cx - 24} ${cy + 8} q10 -8 18 -2 q8 -10 14 -2 q6 -4 16 0 V${cy + 24} H${cx - 24} Z" fill="#a9e34b" opacity=".85"/>
          <path d="M${cx - 10} ${cy - 12} l8 -6" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>`;
      }
      return s;
    },
  },

  // the panda's hut: a wall of bamboo poles, a round moon window full of bamboo leaves, and a
  // bamboo blind half rolled up in front of the bed corner
  bamboo: {
    floor: 'mat',
    wall(r) {
      const { x0, x1, W, top, H } = wallBox(r);
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="#d8e8b0"/>`;
      for (let x = 0, i = 0; x < r.w; x += 0.42, i++) {
        const px = IX(r.x + x);
        s += `<rect x="${px + 1}" y="${top}" width="${0.42 * I_T - 2}" height="${H}" rx="8" fill="${i % 2 ? '#cfe3a2' : '#dcebb8'}" stroke="#b5cc84" stroke-width="1.2"/>`;
        for (let y = 0.6 + (i % 3) * 0.3; y < I_WALL; y += 1.1) s += `<path d="M${px + 2} ${IY(0, y)} h${0.42 * I_T - 4}" stroke="#a7c06f" stroke-width="2"/>`;
      }
      s += `<rect x="${x0}" y="${IY(0, 0.35)}" width="${W}" height="${0.35 * I_H}" fill="#7f9a50"/>
        <rect x="${x0}" y="${top + 10}" width="${W}" height="10" rx="5" fill="#a8c46e" ${OL('#a8c46e', 1.5)}/>` + wallShade(r, '#d8e8b0');
      // the moon window
      const cx = IX(r.x + r.moon);
      const cy = IY(0, 3.1);
      const R = 56;
      s += `<circle cx="${cx + 3}" cy="${cy + 4}" r="${R + 8}" fill="#4a2c38" opacity=".12"/><circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="#a0673f" ${OL('#a0673f', 2)}/>
        <clipPath id="iMoon"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
        <g clip-path="url(#iMoon)"><rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="${Interior.dark ? '#2b2f5e' : '#e6f7d4'}"/>
          ${[-34, -8, 22, 44].map((dx, i) => `<rect x="${cx + dx}" y="${cy - R}" width="7" height="${2 * R}" fill="${i % 2 ? '#94c973' : '#7cb85c'}"/>${[0, 1, 2].map((j) => `<path d="M${cx + dx + 3} ${cy - 30 + j * 26 + i * 6} q${(i % 2 ? 1 : -1) * 14} -6 ${(i % 2 ? 1 : -1) * 24} 2 q${(i % 2 ? -1 : 1) * 12} 3 ${(i % 2 ? -1 : 1) * 24} -2 Z" fill="#69b84a"/>`).join('')}`).join('')}</g>
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#7a4a2a" stroke-width="3"/>`;
      s += ibox(r.moon - 0.75, 0, 1.5, 0.3, 0.1, '#a0673f', { y0: 1.75, r: 3, ol: 2 });
      // a little potted fern on the sill
      const px = r.x + r.moon + 0.4;
      s += icyl(px, 0.15, 0.13, 0.22, '#c9d6de', { y0: 1.85, ol: 1.4 }) + `<path d="M${IX(px)} ${IY(0.15, 2.07)} q-10 -6 -14 -16 M${IX(px)} ${IY(0.15, 2.07)} q2 -10 -2 -20 M${IX(px)} ${IY(0.15, 2.07)} q10 -6 12 -16" stroke="#40c057" stroke-width="2.5" fill="none" stroke-dasharray="3 2"/>`;
      // the blind over the bed corner, half rolled up
      if (r.blind) {
        const [a, b] = r.blind;
        const bx = IX(r.x + a);
        const bw = IX(b - a);
        const by = IY(0, 2.7);
        s += `<rect x="${bx}" y="${top + 16}" width="${bw}" height="${by - top - 16}" fill="#e2c98c" opacity=".92"/>`;
        for (let y = top + 22; y < by; y += 6) s += `<path d="M${bx} ${y} h${bw}" stroke="#c9a96a" stroke-width="1.5"/>`;
        s += `<rect x="${bx - 4}" y="${by - 6}" width="${bw + 8}" height="13" rx="6.5" fill="#d6b877" ${OL('#d6b877', 2)}/>
          <path d="M${bx + 14} ${top + 16} V${by + 16} M${bx + bw - 14} ${top + 16} V${by + 16}" stroke="#c92a2a" stroke-width="1.6"/>
          <rect x="${bx - 6}" y="${top + 12}" width="${bw + 12}" height="8" rx="4" fill="#a0673f"/>`;
      }
      return s;
    },
  },

  // the inside of the hedgehog's stump: curved wood with its rings showing, leaves hanging in
  // through the cracks overhead, a knot-hole window with flowerpots, an apple wreath, a photo
  stump: {
    floor: 'leaves',
    wall(r) {
      const { x0, x1, W, top, H } = wallBox(r);
      const c = '#c99a6b';
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="${c}"/>
        <clipPath id="iStump${r.x}"><rect x="${x0}" y="${top}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#iStump${r.x})">`;
      const cx = (x0 + x1) / 2;
      for (let k = 1; k < 9; k++) s += `<ellipse cx="${cx}" cy="${IY(0, -1)}" rx="${k * 0.95 * I_T}" ry="${k * 0.75 * I_H}" fill="none" stroke="${k % 2 ? '#b7875a' : '#d4a777'}" stroke-width="${k % 2 ? 3 : 2}"/>`;
      s += `</g>` + skirt(r, '#8a5c36', 0.35) + wallShade(r, c) + vault(r, '#7a4f2c', 1.15);
      const rnd = seeded(77);
      const cols = ['#ff922b', '#fa5252', '#fcc419', '#e8590c'];
      for (let i = 0; i < r.w * 1.6; i++) {
        const lx = x0 + rnd() * W;
        const ly = top + 4 + rnd() * 18;
        const col = cols[i % 4];
        s += `<path d="M${lx - 7} ${ly} Q${lx} ${ly - 8} ${lx + 7} ${ly} Q${lx} ${ly + 5} ${lx - 7} ${ly} Z" fill="${col}" ${OL(col, 1.2)} transform="rotate(${-40 + rnd() * 80} ${lx} ${ly})"/>`;
      }
      // the knot-hole window, three little pots on its sill
      const wx = IX(r.x + r.hole);
      const wy = IY(0, 3.1);
      s += `<path d="M${wx - 44} ${wy + 4} C${wx - 46} ${wy - 34} ${wx + 36} ${wy - 40} ${wx + 44} ${wy - 4} C${wx + 50} ${wy + 26} ${wx - 40} ${wy + 34} ${wx - 44} ${wy + 4} Z" fill="#7a4f2c"/>
        <path d="M${wx - 36} ${wy + 3} C${wx - 37} ${wy - 26} ${wx + 30} ${wy - 31} ${wx + 36} ${wy - 3} C${wx + 40} ${wy + 20} ${wx - 32} ${wy + 26} ${wx - 36} ${wy + 3} Z" fill="url(#iSky)"/>
        <path d="M${wx - 36} ${wy + 8} q20 -12 40 -4 q16 -6 32 2 V${wy + 22} H${wx - 34} Z" fill="#ffa94d" opacity=".75"/>`;
      s += ibox(r.hole - 1.0, 0, 2.0, 0.3, 0.1, '#a47148', { y0: 2.25, r: 3, ol: 2 });
      [[-0.55, '#ff6b6b'], [0, '#ffd43b'], [0.55, '#b197fc']].forEach(([dx, fc]) => {
        const px = r.hole + dx;
        s += icyl(px, 0.15, 0.12, 0.2, '#e8825c', { y0: 2.35, ol: 1.3 }) + `<path d="M${IX(px)} ${IY(0.15, 2.55)} v-12" stroke="#51cf66" stroke-width="2"/><circle cx="${IX(px)}" cy="${IY(0.15, 2.55) - 14}" r="5" fill="${fc}" ${OL(fc, 1.2)}/>`;
      });
      // a wreath of dried apple rings and flowers
      const gx = IX(r.x + r.wreath);
      const gy = IY(0, 3.6);
      s += `<circle cx="${gx}" cy="${gy}" r="26" fill="none" stroke="#a37446" stroke-width="5"/>`;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const ax = gx + Math.cos(a) * 26;
        const ay = gy + Math.sin(a) * 26;
        s += i % 2 ? `<circle cx="${ax}" cy="${ay}" r="6.5" fill="#fff4e6" stroke="#e03131" stroke-width="2"/><circle cx="${ax}" cy="${ay}" r="1.6" fill="#8a5c36"/>` : `<circle cx="${ax}" cy="${ay}" r="4.5" fill="${['#ffd43b', '#ff8fab', '#fff'][i % 3]}" ${OL('#ffd43b', 1)}/>`;
      }
      s += `<path d="M${gx - 6} ${gy - 30} l6 5 l6 -5 l-6 9 Z" fill="#e03131"/>`;
      // her photo, apples stuck all over her spines
      const fx = IX(r.x + r.photo);
      const fy = IY(0, 3.4);
      s += `<rect x="${fx - 20 + 3}" y="${fy - 24 + 4}" width="40" height="48" fill="#4a2c38" opacity=".15"/><rect x="${fx - 20}" y="${fy - 24}" width="40" height="48" rx="2" fill="#fff" ${OL('#a47148', 2)}/>
        <rect x="${fx - 15}" y="${fy - 19}" width="30" height="32" fill="#d3f9d8"/>
        <path d="M${fx - 12} ${fy + 10} q0 -20 12 -21 q12 1 12 21 Z" fill="#8a5c36"/><circle cx="${fx}" cy="${fy + 5}" r="7" fill="#f3d9b1"/>
        <path d="M${fx - 4} ${fy + 4} q1.5 -2 3 0 M${fx + 1} ${fy + 4} q1.5 -2 3 0" stroke="#4a2c38" stroke-width="1.2" fill="none"/>
        ${[[-9, -6], [0, -11], [9, -6], [-11, 3], [11, 3]].map(([dx, dy]) => `<circle cx="${fx + dx}" cy="${fy + dy}" r="3.4" fill="#fa5252"/>`).join('')}`;
      return s;
    },
  },

  // the cow's ranch house: red and white barn boards, a dark red wainscot, a four-pane window
  // with the meadow and one of the cows outside
  barn: {
    floor: 'planks',
    wall(r) {
      const { x0, W, top, H } = wallBox(r);
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="#f1d3c4"/>`;
      for (let x = 0, i = 0; x < r.w; x += 0.6, i++) s += `<rect x="${IX(r.x + x)}" y="${top}" width="${0.6 * I_T}" height="${H}" fill="${i % 2 ? '#ebc7b6' : '#f1d3c4'}"/><path d="M${IX(r.x + x)} ${top} V${IY(0, 1.6)}" stroke="#d9ab98" stroke-width="1.5"/>`;
      s += `<rect x="${x0}" y="${IY(0, 1.6)}" width="${W}" height="${1.6 * I_H}" fill="#b5503a"/>`;
      for (const y of [0.55, 1.1]) s += `<path d="M${x0} ${IY(0, y)} H${x0 + W}" stroke="#9c4230" stroke-width="2"/>`;
      s += `<rect x="${x0}" y="${IY(0, 1.7)}" width="${W}" height="${0.12 * I_H + 2}" fill="#fff4e6"/>
        <rect x="${x0}" y="${top + 8}" width="${W}" height="14" fill="#8c4a36"/>` + wallShade(r, '#f1d3c4');
      const cx = IX(r.x + r.win);
      const wy = IY(0, 3.7);
      const w = IX(2.2);
      const h = 1.85 * I_H;
      s += `<rect x="${cx - w / 2 - 6}" y="${wy - 6}" width="${w + 12}" height="${h + 12}" rx="3" fill="#fff4e6" ${OL('#c08a5b', 2.5)}/>
        <rect x="${cx - w / 2}" y="${wy}" width="${w}" height="${h}" fill="url(#iSky)"/>
        <path d="M${cx - w / 2} ${wy + h * 0.62} q${w * 0.3} -14 ${w * 0.55} -4 q${w * 0.25} -8 ${w * 0.45} 0 V${wy + h} H${cx - w / 2} Z" fill="#a9e34b"/>
        <ellipse cx="${cx + 18}" cy="${wy + h * 0.66}" rx="15" ry="8" fill="#fff" stroke="#495057" stroke-width="1.2"/><circle cx="${cx + 13}" cy="${wy + h * 0.63}" r="4" fill="#343a40"/>
        <circle cx="${cx + 33}" cy="${wy + h * 0.6}" r="6" fill="#fff" stroke="#495057" stroke-width="1.2"/>
        <path d="M${cx + 8} ${wy + h * 0.72} v6 M${cx + 26} ${wy + h * 0.72} v6" stroke="#495057" stroke-width="2"/>
        <path d="M${cx} ${wy} V${wy + h} M${cx - w / 2} ${wy + h / 2} H${cx + w / 2}" stroke="#fff4e6" stroke-width="6"/>`;
      s += ibox(r.win - 1.25, 0, 2.5, 0.3, 0.12, '#fff4e6', { y0: 1.72, r: 3, ol: 2 });
      return s;
    },
  },

  // the bear's woodshop: walls of round logs, their ends showing at the corners, a pegboard with
  // the outline of every tool drawn behind it, a big window with a honey jar on the sill
  logs: {
    floor: 'shavings',
    wall(r) {
      const { x0, x1, W, top, H } = wallBox(r);
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="#b7814e"/>`;
      const lh = 0.55;
      for (let y = 0, i = 0; y < I_WALL; y += lh, i++) {
        const c = i % 2 ? '#c8945e' : '#d3a26c';
        s += `<rect x="${x0 - 4}" y="${IY(0, y + lh)}" width="${W + 8}" height="${lh * I_H}" rx="${(lh * I_H) / 2}" fill="${c}" stroke="#8c6239" stroke-width="1.4"/>
          <path d="M${x0 + 20 + (i % 3) * 30} ${IY(0, y + lh * 0.55)} h${W * 0.3} M${x0 + W * 0.5 + (i % 2) * 40} ${IY(0, y + lh * 0.4)} h${W * 0.25}" stroke="${lighter(c, 0.3)}" stroke-width="1.5" stroke-linecap="round"/>`;
        for (const ex of [x0 + 6, x1 - 6]) s += `<circle cx="${ex}" cy="${IY(0, y + lh / 2)}" r="${(lh * I_H) / 2}" fill="#e8c393" stroke="#8c6239" stroke-width="1.4"/><circle cx="${ex}" cy="${IY(0, y + lh / 2)}" r="3" fill="none" stroke="#b5875a"/>`;
      }
      s += wallShade(r, '#c8945e');
      // pegboard and tools
      const [a, b] = r.tools;
      const px = IX(r.x + a);
      const pw = IX(b - a);
      const py = IY(0, 4.5);
      const ph = 2.0 * I_H;
      s += `<rect x="${px + 3}" y="${py + 4}" width="${pw}" height="${ph}" fill="#4a2c38" opacity=".15"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="3" fill="#ead2a8" ${OL('#c8a26e', 2)}/>`;
      for (let x = px + 10; x < px + pw - 4; x += 14) for (let y = py + 10; y < py + ph - 4; y += 14) s += `<circle cx="${x}" cy="${y}" r="1.4" fill="#c8a26e"/>`;
      const tool = (svg) => `<g transform="translate(3 3)" opacity=".28" fill="#8c6239" stroke="none">${svg}</g>${svg}`;
      s += tool(`<path d="M${px + 16} ${py + 14} h46 l-6 16 h-40 Z" fill="#ced4da" stroke="#868e96" stroke-width="1.2"/><rect x="${px + 62}" y="${py + 12}" width="14" height="20" rx="4" fill="#c0503a"/>`);
      s += tool(`<rect x="${px + 92}" y="${py + 14}" width="6" height="40" rx="2" fill="#a0673f"/><rect x="${px + 82}" y="${py + 10}" width="26" height="10" rx="2" fill="#868e96"/>`);
      s += tool(`<rect x="${px + 120}" y="${py + 12}" width="10" height="56" rx="1" fill="#ffd43b" stroke="#e0a800" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${px + 120} ${py + 18 + i * 9} h5" stroke="#8c6239" stroke-width="1"/>`).join('')}`);
      s += tool(`<rect x="${px + 146}" y="${py + 14}" width="7" height="24" rx="2" fill="#a0673f"/><path d="M${px + 146} ${py + 38} h7 l-1 18 h-5 Z" fill="#adb5bd"/>`);
      // the window and its honey jar
      const wx = IX(r.x + r.win);
      const wy = IY(0, 3.9);
      const ww = IX(2.4);
      const wh = 1.9 * I_H;
      s += `<rect x="${wx - ww / 2 - 7}" y="${wy - 7}" width="${ww + 14}" height="${wh + 14}" rx="3" fill="#8c6239" ${OL('#8c6239', 2)}/>
        <rect x="${wx - ww / 2}" y="${wy}" width="${ww}" height="${wh}" fill="url(#iSky)"/>
        <path d="M${wx - ww / 2} ${wy + wh * 0.7} q${ww * 0.25} -18 ${ww * 0.5} -8 q${ww * 0.3} -14 ${ww * 0.5} 0 V${wy + wh} H${wx - ww / 2} Z" fill="#8ce99a"/>
        <path d="M${wx} ${wy} V${wy + wh} M${wx - ww / 2} ${wy + wh / 2} H${wx + ww / 2}" stroke="#8c6239" stroke-width="5"/>`;
      s += ibox(r.win - 1.35, 0, 2.7, 0.32, 0.12, '#a0673f', { y0: 1.85, r: 3, ol: 2 });
      s += icyl(r.win + 0.6, 0.16, 0.17, 0.32, '#ffc94d', { y0: 1.97, ol: 1.5, front: '#f2a900' }) + `<ellipse cx="${IX(r.win + 0.6)}" cy="${IY(0.16, 2.31)}" rx="9" ry="4" fill="#fff4e6" ${OL('#e9c46a', 1.2)}/>`;
      return s;
    },
  },

  // inside the turtle's shell: big green hexagons, a domed ceiling, a round window on the lake, a
  // wall of old photos
  shell: {
    floor: 'pebbles',
    wall(r) {
      const { x0, x1, W, top, H } = wallBox(r);
      let s = `<rect x="${x0}" y="${top}" width="${W}" height="${H}" fill="#8fc49e"/>
        <clipPath id="iShell"><rect x="${x0}" y="${top}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#iShell)">`;
      const R = 34;
      const hx = R * 1.5;
      const hy = R * Math.sqrt(3);
      for (let i = -1, col = 0; x0 + i * hx < x1 + R; i++, col++) {
        for (let j = -1; top + j * hy < IY(0) + R; j++) {
          const cx = x0 + i * hx;
          const cy = top + j * hy + (col % 2 ? hy / 2 : 0);
          const pts = [0, 1, 2, 3, 4, 5].map((k) => `${cx + (R - 3) * Math.cos((Math.PI / 3) * k)},${cy + (R - 3) * Math.sin((Math.PI / 3) * k)}`).join(' ');
          s += `<polygon points="${pts}" fill="${(i + j) % 3 ? '#a9d6b5' : '#7fb991'}" stroke="#4f8a62" stroke-width="3" stroke-linejoin="round"/>`;
        }
      }
      s += `</g>` + skirt(r, '#4f8a62', 0.32) + wallShade(r, '#8fc49e') + vault(r, '#3f6b4e', 1.4);
      // the round window on the lake, a duck going by
      const cx = IX(r.x + r.win);
      const cy = IY(0, 3.2);
      s += `<circle cx="${cx}" cy="${cy}" r="42" fill="#e9c98f" ${OL('#b5894e', 2.5)}/><circle cx="${cx}" cy="${cy}" r="34" fill="url(#iSky)"/>
        <clipPath id="iLake"><circle cx="${cx}" cy="${cy}" r="34"/></clipPath><g clip-path="url(#iLake)"><rect x="${cx - 34}" y="${cy + 2}" width="68" height="34" fill="#74c0fc"/>
        <path d="M${cx - 30} ${cy + 14} q6 -3 12 0 M${cx + 8} ${cy + 22} q6 -3 12 0" stroke="#fff" stroke-width="2" fill="none"/>
        <ellipse cx="${cx + 8}" cy="${cy + 6}" rx="9" ry="5" fill="#fff"/><circle cx="${cx + 15}" cy="${cy}" r="4" fill="#2f9e44"/><path d="M${cx + 18} ${cy} l5 1 l-5 1" fill="#fd7e14"/>
        <path d="M${cx - 26} ${cy + 4} v-14 M${cx - 22} ${cy + 4} v-18" stroke="#2b8a3e" stroke-width="2.5"/></g>
        <path d="M${cx - 34} ${cy} H${cx + 34} M${cx} ${cy - 34} V${cy + 34}" stroke="#e9c98f" stroke-width="4"/>`;
      // old photos: the two of them young, in front of the chess pavilion
      const [a, b] = r.photos;
      [[a, 3.9, -4], [(a + b) / 2, 3.4, 3], [b, 3.95, 5]].forEach(([x, y, rot], i) => {
        const fx = IX(r.x + x);
        const fy = IY(0, y);
        s += `<g transform="rotate(${rot} ${fx} ${fy})"><rect x="${fx - 18 + 3}" y="${fy - 14 + 3}" width="36" height="30" fill="#4a2c38" opacity=".18"/><rect x="${fx - 18}" y="${fy - 14}" width="36" height="30" fill="#fdf3dc" ${OL('#c9b48a', 1.5)}/>
          <rect x="${fx - 14}" y="${fy - 10}" width="28" height="19" fill="#e8d3a5"/>
          ${i === 1 ? `<path d="M${fx - 12} ${fy - 2} l12 -7 l12 7 Z" fill="#b5894e"/><path d="M${fx - 8} ${fy - 2} v10 M${fx + 8} ${fy - 2} v10" stroke="#b5894e" stroke-width="1.5"/>` : ''}
          <circle cx="${fx - 5}" cy="${fy + 3}" r="4" fill="#9c8255"/><circle cx="${fx + 5}" cy="${fy + 3}" r="4" fill="#6b5a3a"/></g>`;
      });
      return s;
    },
  },
};
Object.assign(ROOM_LOOKS, HOME_LOOKS);

// ---------- floors ----------

const floorRect = (r, depth, c) => `<rect x="${IX(r.x)}" y="${IY(0)}" width="${IX(r.w)}" height="${depth * I_R}" fill="${c}"/>`;

Object.assign(FLOOR_ART, {
  // packed earth with darker patches and pebbles
  earth(r, depth) {
    const rnd = seeded(11 + Math.round(r.x));
    let s = floorRect(r, depth, '#d6ad7f');
    for (let i = 0; i < r.w * 1.2; i++) s += `<ellipse cx="${IX(r.x + rnd() * r.w)}" cy="${IY(rnd() * depth)}" rx="${20 + rnd() * 30}" ry="${8 + rnd() * 10}" fill="#cba070" opacity=".6"/>`;
    for (let i = 0; i < r.w * 3; i++) s += `<ellipse cx="${IX(r.x + rnd() * r.w)}" cy="${IY(rnd() * depth)}" rx="${2 + rnd() * 3}" ry="${1.5 + rnd() * 2}" fill="${rnd() < 0.5 ? '#b8957a' : '#e9d3b4'}"/>`;
    return s;
  },
  // woven bamboo mats, edged in a darker green
  mat(r, depth) {
    let s = floorRect(r, depth, '#efe3b0');
    for (let z = 0.25; z < depth; z += 0.25) s += `<path d="M${IX(r.x)} ${IY(z)} H${IX(r.x + r.w)}" stroke="#dccf96" stroke-width="${Math.round(z * 4) % 4 ? 1 : 2}"/>`;
    for (let x = 3; x < r.w; x += 3) s += `<path d="M${IX(r.x + x)} ${IY(0)} V${IY(depth)}" stroke="#a7b86a" stroke-width="3"/>`;
    return s;
  },
  // dark boards with fallen leaves on them
  leaves(r, depth) {
    const rnd = seeded(5);
    let s = floorRect(r, depth, '#a8774f');
    for (let z = 0.5; z < depth; z += 0.5) s += `<path d="M${IX(r.x)} ${IY(z)} H${IX(r.x + r.w)}" stroke="#94643f" stroke-width="2"/>`;
    for (let z = 0, b = 0; z < depth; z += 0.5, b++) for (let x = (b % 3) + 0.7; x < r.w; x += 3) s += `<path d="M${IX(r.x + x)} ${IY(z)} v${I_R / 2}" stroke="#94643f" stroke-width="1.5"/>`;
    const cols = ['#ff922b', '#fa5252', '#fcc419', '#e8590c'];
    for (let i = 0; i < r.w * 1.3; i++) {
      const lx = IX(r.x + 0.3 + rnd() * (r.w - 0.6));
      const ly = IY(0.4 + rnd() * (depth - 0.8));
      const c = cols[i % 4];
      s += `<path d="M${lx - 8} ${ly} Q${lx} ${ly - 7} ${lx + 8} ${ly} Q${lx} ${ly + 6} ${lx - 8} ${ly} Z" fill="${c}" opacity=".9" transform="rotate(${rnd() * 180} ${lx} ${ly})"/>`;
    }
    return s;
  },
  // wide rough boards with nail heads
  planks(r, depth) {
    let s = floorRect(r, depth, '#d9a877');
    for (let z = 0, b = 0; z < depth; z += 0.75, b++) {
      s += `<path d="M${IX(r.x)} ${IY(z)} H${IX(r.x + r.w)}" stroke="#bf8c5c" stroke-width="2.2"/>`;
      for (let x = (b % 2) * 2 + 1.5; x < r.w; x += 4) s += `<path d="M${IX(r.x + x)} ${IY(z)} v${0.75 * I_R}" stroke="#bf8c5c" stroke-width="2"/><circle cx="${IX(r.x + x) + 5}" cy="${IY(z + 0.2)}" r="1.5" fill="#8c6239"/><circle cx="${IX(r.x + x) - 5}" cy="${IY(z + 0.55)}" r="1.5" fill="#8c6239"/>`;
    }
    return s;
  },
  // boards with curls of wood shaving lying about
  shavings(r, depth) {
    let s = this.planks(r, depth).replace('#d9a877', '#d0a06a');
    const rnd = seeded(9);
    for (let i = 0; i < r.w * 0.9; i++) {
      const x = IX(r.x + 0.4 + rnd() * (r.w - 0.8));
      const y = IY(0.5 + rnd() * (depth - 1));
      s += `<path d="M${x} ${y} c6 -6 12 0 6 4 c-5 3 -9 -2 -4 -4" stroke="#f3d29c" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    }
    return s;
  },
  // round pebbles set in sand
  pebbles(r, depth) {
    const rnd = seeded(3);
    let s = floorRect(r, depth, '#ddd5c2');
    for (let i = 0; i < r.w * depth * 1.6; i++) {
      const c = ['#c9c0aa', '#b8b19e', '#e8e1cf', '#cdbfa3'][i % 4];
      s += `<ellipse cx="${IX(r.x + rnd() * r.w)}" cy="${IY(rnd() * depth)}" rx="${5 + rnd() * 6}" ry="${3 + rnd() * 3}" fill="${c}" stroke="${darker(c, 0.12)}" stroke-width="1"/>`;
    }
    return s;
  },
});

// A woven round doormat inside the front door (c: its colour)
const wovenMat = (c) => (x, Z) => `<ellipse cx="${IX(x + I_DOOR_W / 2) + 3}" cy="${IY(Z - 0.5) + 3}" rx="${IX(0.95)}" ry="${0.42 * I_R}" fill="#4a2c38" opacity=".12"/>
  <ellipse cx="${IX(x + I_DOOR_W / 2)}" cy="${IY(Z - 0.5)}" rx="${IX(0.95)}" ry="${0.42 * I_R}" fill="${c}" ${OL(c, 2)}/>
  <ellipse cx="${IX(x + I_DOOR_W / 2)}" cy="${IY(Z - 0.5)}" rx="${IX(0.65)}" ry="${0.28 * I_R}" fill="none" stroke="${darker(c, 0.15)}" stroke-width="2" stroke-dasharray="5 4"/>`;

// ---------- furniture ----------
// The same shape as FIXTURE_ART (they're added to it): footprint w by d, height h, drawn from the
// back-left corner. o.hearts: how well the owner knows the pig.

// A carrot lying on its side, its point to the right, from (x, y) px
const carrotSide = (x, y, k = 1) => `<path d="M${x} ${y - 4 * k} L${x + 20 * k} ${y} L${x} ${y + 4 * k} Q${x - 3 * k} ${y} ${x} ${y - 4 * k} Z" fill="#ff922b" ${OL('#ff922b', 1.2)}/>
  <path d="M${x} ${y} l-7 -5 M${x} ${y} l-8 0 M${x} ${y} l-7 5" stroke="#51cf66" stroke-width="2" stroke-linecap="round"/>`;

// A red mushroom stool at (xc, zc)
const mushroomStool = (xc, zc) => ishadowE(xc, zc, 0.3, 0.6) + icyl(xc, zc, 0.13, 0.42, '#fff4e6', { front: '#f3e3cc', ol: 1.6 })
  + `<path d="M${IX(xc) - 0.36 * I_T} ${IY(zc, 0.48)} Q${IX(xc) - 0.34 * I_T} ${IY(zc, 0.9)} ${IX(xc)} ${IY(zc, 0.92)} Q${IX(xc) + 0.34 * I_T} ${IY(zc, 0.9)} ${IX(xc) + 0.36 * I_T} ${IY(zc, 0.48)} Q${IX(xc)} ${IY(zc, 0.38)} ${IX(xc) - 0.36 * I_T} ${IY(zc, 0.48)} Z" fill="#fa5252" ${OL('#fa5252', 2)}/>
  <circle cx="${IX(xc) - 7}" cy="${IY(zc, 0.72)}" r="3" fill="#fff"/><circle cx="${IX(xc) + 6}" cy="${IY(zc, 0.8)}" r="2.5" fill="#fff"/><circle cx="${IX(xc) + 1}" cy="${IY(zc, 0.6)}" r="2" fill="#fff"/>`;

// A short log for a stool at (xc, zc)
const logStool = (xc, zc, c = '#b07a4f') => ishadowE(xc, zc, 0.3, 0.6) + icyl(xc, zc, 0.28, 0.5, '#e8c393', { front: c, ol: 2 })
  + `<ellipse cx="${IX(xc)}" cy="${IY(zc, 0.5)}" rx="${0.15 * I_T}" ry="${0.15 * I_R}" fill="none" stroke="#c49a6c" stroke-width="1.5"/>`;

// A plain round cushion on the floor at (xc, zc)
const cushion = (xc, zc, c) => ishadowE(xc, zc, 0.36, 0.4) + icyl(xc, zc, 0.34, 0.18, c, { ol: 2 }) + `<circle cx="${IX(xc)}" cy="${IY(zc, 0.18)}" r="2.5" fill="${darker(c, 0.25)}"/>`;

// A little cup on a table at (xc, zc), table top at y
const teacup = (xc, zc, y, c = '#fff') => icyl(xc, zc, 0.1, 0.12, c, { y0: y, ol: 1.4 });

const HOME_ART = {
  // ---- the rabbit's ----

  // a store dug into the earth wall: three shelves of carrots, a bunch of carrot tops hung above
  rb_shelf() {
    const w = 2.2;
    const d = 0.5;
    const h = 2.7;
    let s = ishadow(0, 0, w, d, h, 0.16);
    s += ibox(0, 0, w, d, h, '#b5875a', { r: 6, front: '#a37446' });
    s += `<path d="${rpath(IX(0.18), IY(d, h - 0.2), IX(w - 0.36), (h - 0.35) * I_H, 10, true, false)}" fill="#6b4a32"/>`;
    for (const y of [0.15, 0.95, 1.75]) {
      s += `<rect x="${IX(0.18)}" y="${IY(d, y + 0.08)}" width="${IX(w - 0.36)}" height="5" fill="#d39a5e"/>`;
      for (let i = 0; i < 4; i++) s += carrotSide(IX(0.4 + i * 0.42), IY(d, y + 0.25) - (i % 2) * 3, 0.9);
    }
    s += `<path d="M${IX(w / 2)} ${IY(d, h - 0.05)} v8" stroke="#8a6a4a" stroke-width="2"/>${[-8, -3, 2, 7].map((dx) => `<path d="M${IX(w / 2)} ${IY(d, h - 0.05) + 8} q${dx} 6 ${dx * 1.4} 18" stroke="#51cf66" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}`;
    return { w, d, h, svg: s };
  },
  // Grandma Rabbit's wicker rocking chair, an unfinished scarf over its back, the ball of wool
  // rolled away on the floor
  rb_rocker() {
    const w = 1.3;
    const d = 1.0;
    const c = '#e2bf74';
    let s = ishadow(0, 0.1, w, d, 1.5, 0.18);
    s += `<path d="M${IX(-0.05)} ${IY(d - 0.05)} Q${IX(w / 2)} ${IY(d + 0.25)} ${IX(w + 0.05)} ${IY(d - 0.05)}" stroke="#a0673f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${rpath(IX(0.1), IY(0.1, 2.2), IX(w - 0.2), 1.5 * I_H, 14, true, false)}" fill="${c}" ${OL(c)}/>`;
    for (let y = 0.85; y < 2.1; y += 0.22) s += `<path d="M${IX(0.16)} ${IY(0.1, y)} h${IX(w - 0.32)}" stroke="${darker(c, 0.15)}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    s += ibox(0.05, 0.25, w - 0.1, d - 0.35, 0.18, c, { y0: 0.55, r: 6 });
    s += `<rect x="${IX(0.12)}" y="${IY(d - 0.1, 0.55)}" width="5" height="${0.5 * I_H}" fill="#a0673f"/><rect x="${IX(w - 0.12) - 5}" y="${IY(d - 0.1, 0.55)}" width="5" height="${0.5 * I_H}" fill="#a0673f"/>`;
    s += `<path d="M${IX(0.25)} ${IY(0.1, 2.05)} Q${IX(0.6)} ${IY(0.1, 1.85)} ${IX(1.0)} ${IY(0.1, 2.0)} L${IX(1.05)} ${IY(0.4, 1.0)} L${IX(0.8)} ${IY(0.4, 1.05)} L${IX(0.78)} ${IY(0.1, 1.75)} Q${IX(0.5)} ${IY(0.1, 1.68)} ${IX(0.3)} ${IY(0.1, 1.82)} Z" fill="#ff8fab" ${OL('#ff8fab', 1.8)}/>
      <path d="M${IX(0.85)} ${IY(0.3, 1.2)} h${IX(0.18)} M${IX(0.85)} ${IY(0.3, 1.4)} h${IX(0.18)}" stroke="#fff" stroke-width="1.5"/>
      <path d="M${IX(1.0)} ${IY(0.4, 1.0)} C${IX(1.2)} ${IY(0.8, 0.5)} ${IX(0.6)} ${IY(1.2)} ${IX(0.3)} ${IY(1.35)}" stroke="#ff8fab" stroke-width="1.5" fill="none"/>
      <circle cx="${IX(0.25)}" cy="${IY(1.3, 0.15)}" r="8" fill="#ff8fab" ${OL('#ff8fab', 1.5)}/><path d="M${IX(0.25) - 6} ${IY(1.3, 0.15) - 2} q6 -3 12 2 M${IX(0.25) - 5} ${IY(1.3, 0.15) + 3} q5 -2 10 1" stroke="#fff" stroke-width="1.2" fill="none"/>`;
    return { w, d: d + 0.3, h: 2.3, svg: s };
  },
  // a rug like a big carrot, its leafy end a green fringe
  rb_rug() {
    const w = 4.2;
    const d = 2.0;
    const P = (x, z) => `${IX(x)} ${IY(z)}`;
    let s = `<path d="M${P(0.9, 0.1)} Q${P(2.6, 0.2)} ${P(w, d / 2)} Q${P(2.6, d - 0.2)} ${P(0.9, d - 0.1)} Q${P(0.5, d / 2)} ${P(0.9, 0.1)} Z" fill="#4a2c38" opacity=".1" transform="translate(4 4)"/>
      <path d="M${P(0.9, 0.1)} Q${P(2.6, 0.2)} ${P(w, d / 2)} Q${P(2.6, d - 0.2)} ${P(0.9, d - 0.1)} Q${P(0.5, d / 2)} ${P(0.9, 0.1)} Z" fill="#ffa94d" ${OL('#f76707', 2.5)}/>`;
    for (const x of [1.6, 2.3, 3.0]) s += `<path d="M${P(x, 0.35 + (x - 1.6) * 0.18)} q-6 ${0.6 * I_R} 0 ${(1.3 - (x - 1.6) * 0.36) * I_R}" stroke="#f76707" stroke-width="2" fill="none" opacity=".6"/>`;
    for (let i = 0; i < 7; i++) s += `<path d="M${P(0.8, 0.3 + i * 0.24)} l${-0.7 * I_T} ${-6 + i * 2}" stroke="#51cf66" stroke-width="5" stroke-linecap="round"/>`;
    return { w, d, flat: true, svg: s };
  },
  // a tree-stump table, its rings showing, a jug of carrot juice and two cups; a mushroom stool
  // either side
  rb_table() {
    const xc = 1.8;
    const zc = 0.7;
    let s = mushroomStool(xc - 1.35, zc + 0.15) + mushroomStool(xc + 1.35, zc + 0.15);
    s += ishadowE(xc, zc, 0.7, 1);
    s += icyl(xc, zc, 0.62, 0.85, '#e8c393', { front: '#a47148' });
    for (const k of [0.45, 0.3, 0.15]) s += `<ellipse cx="${IX(xc)}" cy="${IY(zc, 0.85)}" rx="${k * I_T}" ry="${k * I_R}" fill="none" stroke="#c49a6c" stroke-width="1.6"/>`;
    for (const dx of [-0.4, 0, 0.4]) s += `<path d="M${IX(xc + dx)} ${IY(zc + 0.55, 0.75)} v${0.7 * I_H}" stroke="#8a5c36" stroke-width="2"/>`;
    s += icyl(xc - 0.2, zc - 0.05, 0.16, 0.4, '#ffd8a8', { y0: 0.85, ol: 1.6 }) + `<ellipse cx="${IX(xc - 0.2)}" cy="${IY(zc - 0.05, 1.18)}" rx="5" ry="3" fill="#ff922b"/>
      <path d="M${IX(xc - 0.04)} ${IY(zc - 0.05, 1.15)} q8 2 6 12" stroke="#e8c393" stroke-width="3" fill="none"/>`;
    s += teacup(xc + 0.3, zc + 0.15, 0.85, '#ffc078') + teacup(xc + 0.05, zc + 0.3, 0.85, '#ffc078');
    return { w: 3.6, d: 1.5, h: 1.3, svg: s };
  },
  // hopscotch chalked on the floor, a stub of chalk beside it
  rb_hop() {
    const sq = 0.62;
    let s = '';
    for (const [i, j] of [[0.5, 3], [0, 2], [1, 2], [0.5, 1], [0.5, 0]]) s += `<rect x="${IX(i * sq + 0.1)}" y="${IY(j * sq * 0.9)}" width="${IX(sq)}" height="${sq * 0.9 * I_R}" fill="none" stroke="#fff" stroke-width="2.5" opacity=".85"/>`;
    s += `<circle cx="${IX(0.82)}" cy="${IY(0.62 * 0.9 * 1.5)}" r="5" fill="#ff8fab" opacity=".6"/><rect x="${IX(1.5)}" y="${IY(3.0)}" width="12" height="5" rx="2" fill="#fff" transform="rotate(-20 ${IX(1.5)} ${IY(3.0)})"/>`;
    return { w: 1.6, d: 2.8, flat: true, svg: s };
  },
  // her bed in an arched alcove dug into the wall: a straw mattress, a flowery quilt, a pillow
  // shaped like a bunny
  rb_bed() {
    const w = 2.6;
    const d = 2.0;
    let s = `<path d="M${IX(-0.2)} ${IY(0)} V${IY(0, 1.9)} Q${IX(-0.2)} ${IY(0, 3.3)} ${IX(w / 2)} ${IY(0, 3.3)} Q${IX(w + 0.2)} ${IY(0, 3.3)} ${IX(w + 0.2)} ${IY(0, 1.9)} V${IY(0)} Z" fill="#b5875a" ${OL('#b5875a', 2.5)}/>
      <path d="M${IX(0)} ${IY(0)} V${IY(0, 1.9)} Q${IX(0)} ${IY(0, 3.05)} ${IX(w / 2)} ${IY(0, 3.05)} Q${IX(w)} ${IY(0, 3.05)} ${IX(w)} ${IY(0, 1.9)} V${IY(0)} Z" fill="#8a6a4a"/>
      ${[0.4, 1.3, 2.2].map((x, i) => `<circle cx="${IX(x)}" cy="${IY(0, 2.3 + (i % 2) * 0.3)}" r="3" fill="#ffd43b"/>`).join('')}`;
    s += ishadow(0, 0, w, d, 0.6, 0.2);
    s += ibox(0, 0, w, d, 0.35, '#f2d17a', { r: 8, front: '#e2b84f' });
    for (let x = 0.2; x < w; x += 0.25) s += `<path d="M${IX(x)} ${IY(d, 0.3)} l3 8" stroke="#c99a2e" stroke-width="1.2"/>`;
    s += ibox(0.06, 0.85, w - 0.12, d - 0.8, 0.12, '#ffc9de', { y0: 0.35, r: 8, front: '#ffb3cd' });
    for (let i = 0; i < 7; i++) s += `<circle cx="${IX(0.3 + (i % 4) * 0.62 + (i > 3 ? 0.3 : 0))}" cy="${IY(1.15 + (i > 3 ? 0.5 : 0), 0.47)}" r="3.5" fill="${i % 2 ? '#fff' : '#ffd43b'}"/>`;
    const px = IX(0.9);
    const py = IY(0.4, 0.62);
    s += `<path d="M${px - 8} ${py - 4} q-4 -20 2 -22 q5 2 4 20 M${px + 6} ${py - 4} q-2 -20 4 -21 q5 3 0 20" fill="#fff" ${OL('#e9d5db', 1.6)}/>
      <ellipse cx="${px}" cy="${py}" rx="22" ry="11" fill="#fff" ${OL('#e9d5db', 1.8)}/><circle cx="${px - 6}" cy="${py - 1}" r="1.6" fill="#4a2c38"/><circle cx="${px + 6}" cy="${py - 1}" r="1.6" fill="#4a2c38"/><ellipse cx="${px}" cy="${py + 3}" rx="2" ry="1.4" fill="#ff8fab"/>`;
    return { w, d, h: 1.0, svg: s };
  },
  // on the wall: her chart of little red flowers, more of them the better she knows the pig
  rb_chart(o) {
    const w = IX(1.9);
    const h = 1.45 * I_H;
    const cols = 5;
    const rows = 3;
    const n = Math.min(cols * rows, 4 + Math.floor((o.hearts || 0) / 2) * 1);
    let s = `<rect x="${-w / 2 + 4}" y="${-h / 2 + 5}" width="${w}" height="${h}" rx="4" fill="#4a2c38" opacity=".15"/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="#fff" ${OL('#f4a9bf', 2.5)}/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="12" rx="4" fill="#ff8fab"/><circle cx="0" cy="${-h / 2 + 2}" r="4" fill="#ffd43b" ${OL('#fab005', 1.2)}/>`;
    const cw = (w - 16) / cols;
    const ch = (h - 24) / rows;
    for (let i = 0; i < cols * rows; i++) {
      const cx = -w / 2 + 8 + (i % cols) * cw + cw / 2;
      const cy = -h / 2 + 18 + Math.floor(i / cols) * ch + ch / 2;
      s += `<rect x="${cx - cw / 2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" fill="none" stroke="#ffd6e3" stroke-width="1.2"/>`;
      if (i < n) s += [0, 1, 2, 3, 4].map((k) => `<circle cx="${cx + Math.cos(k * 1.257) * 4.5}" cy="${cy + Math.sin(k * 1.257) * 4.5}" r="3.6" fill="#fa5252"/>`).join('') + `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#ffd43b"/>`;
    }
    return { wall: true, w: 1.9, svg: s };
  },
  // a wooden toy box, a ball and a kite's tail poking out
  rb_toys() {
    const w = 1.1;
    const d = 0.8;
    let s = ishadow(0, 0, w, d, 0.8, 0.2);
    s += `<circle cx="${IX(0.35)}" cy="${IY(0.35, 0.95)}" r="12" fill="#ff6b6b" ${OL('#ff6b6b', 1.8)}/><path d="M${IX(0.35) - 12} ${IY(0.35, 0.95)} q12 6 24 0" stroke="#fff" stroke-width="3" fill="none"/>
      <path d="M${IX(0.8)} ${IY(0.3, 0.8)} q8 -18 0 -30 q-6 -12 4 -22" stroke="#4dabf7" stroke-width="2" fill="none"/>${[0, 1, 2].map((i) => `<path d="M${IX(0.8) + (i % 2 ? 4 : -2)} ${IY(0.3, 0.8) - 10 - i * 12} l5 -3 l-1 6 Z" fill="${['#ffd43b', '#ff8fab', '#69db7c'][i]}"/>`).join('')}`;
    s += ibox(0, 0, w, d, 0.75, '#e0a96d', { r: 4 });
    s += `<path d="M${IX(0.1)} ${IY(d, 0.4)} h${IX(w - 0.2)}" ${OL_IN('#e0a96d')}/><circle cx="${IX(w / 2)}" cy="${IY(d, 0.55)}" r="5" fill="#ffd43b" ${OL('#fab005', 1.2)}/>`;
    return { w, d, h: 1.4, svg: s };
  },
  // a little desk: crayons, and a drawing of a pink pig
  rb_desk() {
    const w = 1.6;
    const d = 0.8;
    const c = '#ffd8a8';
    let s = ishadow(0, 0, w, d, 0.8, 0.18);
    for (const lx of [0.1, w - 0.2]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.1, 0.62)}" width="${0.1 * I_T}" height="${0.62 * I_H}" fill="${WOOD_D}"/>`;
    s += ibox(0, 0, w, d, 0.12, c, { y0: 0.6, r: 4, front: WOOD });
    s += `<rect x="${IX(0.25)}" y="${IY(0.12, 0.72)}" width="${IX(0.75)}" height="${0.55 * I_R}" fill="#fff" ${OL('#ced4da', 1.2)} transform="rotate(-4 ${IX(0.6)} ${IY(0.4, 0.72)})"/>
      <circle cx="${IX(0.62)}" cy="${IY(0.4, 0.72)}" r="7" fill="#ffc9dc" stroke="#f783ac" stroke-width="1.5"/><ellipse cx="${IX(0.62)}" cy="${IY(0.4, 0.72) + 2}" rx="3" ry="2" fill="#f783ac"/>`;
    ['#fa5252', '#4dabf7', '#ffd43b', '#51cf66'].forEach((cc, i) => (s += `<rect x="${IX(1.15 + i * 0.07)}" y="${IY(0.2 + i * 0.1, 0.74)}" width="14" height="4" rx="2" fill="${cc}" transform="rotate(${-20 + i * 12} ${IX(1.15 + i * 0.07)} ${IY(0.2 + i * 0.1, 0.74)})"/>`));
    return { w, d, h: 0.9, svg: s };
  },
  // a round pink rug
  rb_rug2() {
    const w = 3.0;
    const d = 2.4;
    return { w, d, flat: true, svg: `<ellipse cx="${IX(w / 2) + 3}" cy="${IY(d / 2) + 4}" rx="${IX(w / 2)}" ry="${(d / 2) * I_R}" fill="#4a2c38" opacity=".1"/>
      <ellipse cx="${IX(w / 2)}" cy="${IY(d / 2)}" rx="${IX(w / 2)}" ry="${(d / 2) * I_R}" fill="#ffc9dc" ${OL('#f783ac', 2.5)}/>
      <ellipse cx="${IX(w / 2)}" cy="${IY(d / 2)}" rx="${IX(w / 2 - 0.3)}" ry="${(d / 2 - 0.3) * I_R}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6"/>
      ${carrotSide(IX(w / 2) - 10, IY(d / 2), 1.1)}` };
  },

  // ---- the panda's ----

  // a low writing table: rice paper with brush strokes, the inkstone, brushes on their rack, a
  // pile of finished sheets
  pd_desk() {
    const w = 2.6;
    const d = 1.0;
    const c = '#8a5a3c';
    let s = ishadow(0, 0, w, d, 0.7, 0.2);
    for (const lx of [0.12, w - 0.24]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.1, 0.55)}" width="${0.12 * I_T}" height="${0.55 * I_H}" rx="2" fill="${darker(c, 0.2)}"/>`;
    s += ibox(0, 0, w, d, 0.14, c, { y0: 0.55, r: 4 });
    s += `<rect x="${IX(0.5)}" y="${IY(0.15, 0.69)}" width="${IX(1.1)}" height="${0.7 * I_R}" fill="#fffdf5" ${OL('#e9e1d6', 1.2)}/>
      <path d="M${IX(1.12)} ${IY(0.25, 0.69)} a${0.3 * I_T} ${0.27 * I_R} 0 1 0 ${0.18 * I_T} ${0.06 * I_R}" stroke="#343a40" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="${IX(0.72)}" cy="${IY(0.7, 0.69)}" r="1.6" fill="#343a40"/><circle cx="${IX(0.78)}" cy="${IY(0.75, 0.69)}" r="1" fill="#343a40"/>
      <rect x="${IX(1.8)}" y="${IY(0.25, 0.69)}" width="${IX(0.35)}" height="${0.45 * I_R}" rx="3" fill="#343a40"/><ellipse cx="${IX(1.97)}" cy="${IY(0.45, 0.69)}" rx="6" ry="3" fill="#495057"/>
      <path d="M${IX(2.2)} ${IY(0.15, 0.69)} v-14 M${IX(2.42)} ${IY(0.15, 0.69)} v-14 M${IX(2.15)} ${IY(0.15, 0.69) - 14} h18" stroke="#a0673f" stroke-width="2.5"/>
      ${[0, 1, 2].map((i) => `<path d="M${IX(2.24) + i * 4} ${IY(0.15, 0.69) - 14} v10" stroke="#a0673f" stroke-width="1.6"/><path d="M${IX(2.24) + i * 4} ${IY(0.15, 0.69) - 4} l-1 5 h2 Z" fill="#212529"/>`).join('')}
      ${[0, 1, 2].map((i) => `<rect x="${IX(0.05)}" y="${IY(0.25, 0.7 + i * 0.03)}" width="${IX(0.38)}" height="${0.5 * I_R}" fill="#fffdf5" ${OL('#e9e1d6', 1)}/>`).join('')}`;
    return { w, d, h: 0.9, svg: s };
  },
  // on the wall: a hanging scroll with one big character on it, 慢
  pd_scroll() {
    const w = IX(1.05);
    const h = 2.35 * I_H;
    return { wall: true, w: 1.1, svg: `<rect x="${-w / 2 + 4}" y="${-h / 2 + 5}" width="${w}" height="${h}" fill="#4a2c38" opacity=".14"/>
      <path d="M0 ${-h / 2 - 16} l-14 12 M0 ${-h / 2 - 16} l14 12" stroke="#7a4a2a" stroke-width="1.5"/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#fffaf0" ${OL('#e2d3b8', 1.5)}/>
      <rect x="${-w / 2 + 5}" y="${-h / 2 + 6}" width="${w - 10}" height="${h - 12}" fill="none" stroke="#c8b48a" stroke-width="1.5"/>
      <rect x="${-w / 2 - 6}" y="${-h / 2 - 6}" width="${w + 12}" height="8" rx="4" fill="#7a4a2a"/><rect x="${-w / 2 - 6}" y="${h / 2 - 2}" width="${w + 12}" height="8" rx="4" fill="#7a4a2a"/>
      <text class="i-scroll" x="0" y="-4">慢</text>
      <rect x="6" y="${h / 2 - 26}" width="9" height="9" fill="#e03131" opacity=".85"/>` };
  },
  // a square stone table under the window with a game of Chinese chess left half played, a stone
  // stool either side
  pd_chess() {
    const w = 2.4;
    const d = 1.2;
    const stool = (x) => ishadowE(x, 0.75, 0.24, 0.5) + icyl(x, 0.75, 0.22, 0.45, '#ced4da', { front: '#adb5bd' });
    let s = stool(0.2) + stool(w - 0.2);
    s += ishadow(0.4, 0.1, w - 0.8, d - 0.2, 1, 0.2);
    s += `<rect x="${IX(w / 2) - 7}" y="${IY(0.7, 0.75)}" width="14" height="${0.75 * I_H}" fill="#adb5bd" ${OL('#adb5bd', 2)}/>`;
    s += ibox(0.45, 0.15, w - 0.9, d - 0.3, 0.12, '#dee2e6', { y0: 0.75, r: 4, front: '#ced4da' });
    s += `<rect x="${IX(0.6)}" y="${IY(0.25, 0.87)}" width="${IX(w - 1.2)}" height="${(d - 0.5) * I_R}" fill="#f1d9a8"/>`;
    for (let i = 0; i <= 6; i++) s += `<path d="M${IX(0.6 + (i * (w - 1.2)) / 6)} ${IY(0.25, 0.87)} v${(d - 0.5) * I_R}" stroke="#a0673f" stroke-width=".8"/>`;
    for (let j = 0; j <= 3; j++) s += `<path d="M${IX(0.6)} ${IY(0.25 + (j * (d - 0.5)) / 3, 0.87)} h${IX(w - 1.2)}" stroke="#a0673f" stroke-width=".8"/>`;
    [[0.75, 0.32, '#e03131'], [1.05, 0.5, '#343a40'], [1.4, 0.4, '#e03131'], [1.6, 0.6, '#343a40'], [0.9, 0.62, '#343a40']].forEach(([x, z, c]) => (s += `<ellipse cx="${IX(x)}" cy="${IY(z, 0.9)}" rx="6" ry="4" fill="#fff4e6" stroke="${c}" stroke-width="1.6"/><circle cx="${IX(x)}" cy="${IY(z, 0.9)}" r="1.6" fill="${c}"/>`));
    return { w, d, h: 1.1, svg: s };
  },
  // an old tree root made into a tea table: a purple clay pot, four little cups, a bamboo tray;
  // a cushion on the floor either side
  pd_tea() {
    const w = 3.4;
    const d = 1.6;
    const xc = w / 2;
    const zc = 0.75;
    let s = cushion(0.25, zc + 0.2, '#ffd43b') + cushion(w - 0.25, zc + 0.2, '#ffd43b');
    s += ishadowE(xc, zc, 1.0, 0.8);
    for (const [dx, k] of [[-0.6, -1], [0.55, 1], [0.1, 0.3]]) s += `<path d="M${IX(xc + dx)} ${IY(zc + 0.2, 0.55)} q${k * 10} ${0.3 * I_H} ${k * 18} ${0.55 * I_H}" stroke="#7a4a2a" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M${IX(xc - 1.0)} ${IY(zc, 0.6)} C${IX(xc - 1.1)} ${IY(zc - 0.6, 0.6)} ${IX(xc - 0.2)} ${IY(zc - 0.75, 0.6)} ${IX(xc + 0.4)} ${IY(zc - 0.55, 0.6)} C${IX(xc + 1.2)} ${IY(zc - 0.6, 0.6)} ${IX(xc + 1.15)} ${IY(zc + 0.45, 0.6)} ${IX(xc + 0.5)} ${IY(zc + 0.5, 0.6)} C${IX(xc)} ${IY(zc + 0.6, 0.6)} ${IX(xc - 0.95)} ${IY(zc + 0.55, 0.6)} ${IX(xc - 1.0)} ${IY(zc, 0.6)} Z" fill="#b5784a" ${OL('#b5784a', 2.5)}/>
      <path d="M${IX(xc - 1.0)} ${IY(zc, 0.6)} C${IX(xc - 0.95)} ${IY(zc + 0.55, 0.6)} ${IX(xc)} ${IY(zc + 0.6, 0.6)} ${IX(xc + 0.5)} ${IY(zc + 0.5, 0.6)} L${IX(xc + 0.5)} ${IY(zc + 0.5, 0.45)} C${IX(xc)} ${IY(zc + 0.6, 0.45)} ${IX(xc - 0.95)} ${IY(zc + 0.55, 0.45)} ${IX(xc - 1.0)} ${IY(zc, 0.45)} Z" fill="#8a5a3c"/>
      <ellipse cx="${IX(xc - 0.4)}" cy="${IY(zc - 0.1, 0.6)}" rx="10" ry="5" fill="none" stroke="#8a5a3c" stroke-width="1.5"/>`;
    s += `<rect x="${IX(xc - 0.55)}" y="${IY(zc - 0.25, 0.6)}" width="${IX(1.1)}" height="${0.5 * I_R}" rx="4" fill="#e2c98c" ${OL('#c9a96a', 1.5)}/>`;
    s += icyl(xc - 0.2, zc - 0.05, 0.17, 0.22, '#7a4a52', { y0: 0.62, ol: 1.6 }) + `<circle cx="${IX(xc - 0.2)}" cy="${IY(zc - 0.05, 0.9)}" r="3" fill="#7a4a52"/>
      <path d="M${IX(xc - 0.37)} ${IY(zc - 0.05, 0.75)} q-8 -2 -10 -8" stroke="#7a4a52" stroke-width="3" fill="none"/><path d="M${IX(xc - 0.03)} ${IY(zc - 0.05, 0.8)} q8 0 8 8" stroke="#7a4a52" stroke-width="2.5" fill="none"/>`;
    for (const [x, z] of [[0.15, -0.12], [0.35, 0.02], [0.15, 0.15], [0.35, 0.28]]) s += icyl(xc + x, zc + z, 0.07, 0.08, '#fff', { y0: 0.62, ol: 1.2 });
    s += `<g class="steam"><path d="M${IX(xc + 0.15)} ${IY(zc, 0.8)} q-4 -8 0 -14" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/></g>`;
    return { w, d, h: 1.0, svg: s };
  },
  // a bamboo rocking chair, a palm-leaf fan on its arm
  pd_rocker() {
    const w = 1.4;
    const d = 1.1;
    const c = '#cfe39a';
    let s = ishadow(0, 0.1, w, d, 1.5, 0.18);
    s += `<path d="M${IX(-0.05)} ${IY(d - 0.05)} Q${IX(w / 2)} ${IY(d + 0.25)} ${IX(w + 0.05)} ${IY(d - 0.05)}" stroke="#93ad5a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    for (let x = 0.15; x < w - 0.1; x += 0.17) s += `<rect x="${IX(x)}" y="${IY(0.1, 2.1)}" width="7" height="${1.45 * I_H}" rx="3.5" fill="${c}" ${OL(c, 1.4)}/>`;
    s += `<rect x="${IX(0.1)}" y="${IY(0.1, 2.15)}" width="${IX(w - 0.2)}" height="9" rx="4.5" fill="#a8c46e" ${OL('#a8c46e', 1.5)}/>`;
    s += ibox(0.05, 0.25, w - 0.1, d - 0.35, 0.15, c, { y0: 0.55, r: 6 });
    for (const x of [0.1, w - 0.15]) s += `<rect x="${IX(x)}" y="${IY(d - 0.1, 0.55)}" width="6" height="${0.5 * I_H}" fill="#93ad5a"/>`;
    s += `<path d="M${IX(w - 0.1)} ${IY(0.6, 0.95)} l14 -8" stroke="#a0673f" stroke-width="2.5"/><ellipse cx="${IX(w - 0.1) + 22}" cy="${IY(0.6, 0.95) - 16}" rx="14" ry="12" fill="#e2c98c" ${OL('#c9a96a', 1.5)}/>
      ${[-40, -15, 10, 35].map((a) => `<path d="M${IX(w - 0.1) + 16} ${IY(0.6, 0.95) - 10} l${Math.cos((a * Math.PI) / 180 - 0.8) * 16} ${Math.sin((a * Math.PI) / 180 - 0.8) * 16}" stroke="#c9a96a" stroke-width="1.2"/>`).join('')}`;
    return { w, d: d + 0.3, h: 2.3, svg: s };
  },
  // a bamboo bed behind the blind, the quilt folded square, a paper lantern on a stand
  pd_bed() {
    const w = 2.6;
    const d = 2.0;
    const c = '#cfe39a';
    let s = ishadow(0, 0, w, d, 0.8, 0.2);
    s += ibox(0, 0, w, d, 0.45, c, { r: 4 });
    for (let x = 0.15; x < w; x += 0.2) s += `<path d="M${IX(x)} ${IY(d, 0.42)} v${0.38 * I_H}" stroke="#a8c46e" stroke-width="1.5"/>`;
    s += ibox(0.1, 0.1, w - 0.2, d - 0.2, 0.1, '#fffaf0', { y0: 0.45, r: 6 });
    s += ibox(0.3, 0.2, 0.9, 0.5, 0.14, '#e9ecef', { y0: 0.55, r: 6, ol: 2 });
    s += ibox(1.3, 0.6, 1.1, 0.9, 0.3, '#63b3a5', { y0: 0.55, r: 5 }) + `<path d="M${IX(1.35)} ${IY(1.5, 0.7)} h${IX(1.0)}" stroke="#4c9a8c" stroke-width="2"/>`;
    s += `<path d="M${IX(w + 0.3)} ${IY(0.5)} V${IY(0.5, 1.3)}" stroke="#a0673f" stroke-width="2.5"/>
      <ellipse cx="${IX(w + 0.3)}" cy="${IY(0.5, 1.6)}" rx="13" ry="15" fill="#fff8e1" ${OL('#e9c46a', 1.5)}/><rect x="${IX(w + 0.3) - 8}" y="${IY(0.5, 1.6) - 17}" width="16" height="4" fill="#e03131"/><rect x="${IX(w + 0.3) - 8}" y="${IY(0.5, 1.6) + 13}" width="16" height="4" fill="#e03131"/>
      <ellipse cx="${IX(w + 0.3)}" cy="${IY(0.5, 1.6)}" rx="7" ry="10" fill="#ffe066" opacity=".55"/>`;
    return { w: w + 0.6, d, h: 1.9, svg: s };
  },
  // a tall potted bamboo
  pd_bamboo() {
    const xc = 0.5;
    const zc = 0.4;
    let s = ishadowE(xc, zc, 0.4, 2.5) + ibox(xc - 0.35, zc - 0.3, 0.7, 0.6, 0.55, '#c5d0d8', { r: 3 });
    for (const [dx, h, c] of [[-0.15, 3.6, '#7cb85c'], [0.1, 4.1, '#69a94c'], [0.22, 3.1, '#8fc56c']]) {
      s += `<rect x="${IX(xc + dx) - 3}" y="${IY(zc, h)}" width="6" height="${(h - 0.55) * I_H}" rx="3" fill="${c}" ${OL(c, 1)}/>`;
      for (let y = 1.2; y < h; y += 0.8) s += `<path d="M${IX(xc + dx) - 3} ${IY(zc, y)} h6" stroke="${darker(c, 0.3)}" stroke-width="1.5"/>`;
      for (let y = h - 0.2; y > h - 1.8; y -= 0.55) s += `<path d="M${IX(xc + dx)} ${IY(zc, y)} q${dx < 0 ? -12 : 12} -6 ${dx < 0 ? -22 : 22} 2 q${dx < 0 ? 10 : -10} 3 ${dx < 0 ? 22 : -22} -2 Z" fill="#69b84a" ${OL('#69b84a', 1)}/>`;
    }
    return { w: 1.0, d: 0.8, h: 4.2, svg: s };
  },
  // a woven basket of bamboo shoots
  pd_shoots() {
    const xc = 0.5;
    const zc = 0.35;
    let s = ishadowE(xc, zc, 0.42, 0.8) + icyl(xc, zc, 0.38, 0.4, '#8a6a3a', { front: '#c9a253' });
    for (const [dx, h] of [[-0.18, 0.95], [0.05, 1.1], [0.24, 0.9]]) s += `<path d="M${IX(xc + dx) - 9} ${IY(zc, 0.4)} L${IX(xc + dx)} ${IY(zc, h)} L${IX(xc + dx) + 9} ${IY(zc, 0.4)} Z" fill="#e2c98c" ${OL('#c9a96a', 1.4)}/><path d="M${IX(xc + dx) - 5} ${IY(zc, 0.6)} l5 -5 l5 5" stroke="#94c973" stroke-width="2" fill="none"/>`;
    s += `<path d="M${IX(xc - 0.38)} ${IY(zc, 0.4)} A${0.38 * I_T} ${0.38 * I_R} 0 0 0 ${IX(xc + 0.38)} ${IY(zc, 0.4)} V${IY(zc, 0)} A${0.38 * I_T} ${0.38 * I_R} 0 0 1 ${IX(xc - 0.38)} ${IY(zc, 0)} Z" fill="#d9b26a" ${OL('#c9a253')}/>`;
    for (let y = 0.1; y < 0.4; y += 0.12) s += `<path d="M${IX(xc - 0.36)} ${IY(zc + 0.3, y)} h${IX(0.72)}" stroke="#b08a3e" stroke-width="1.2"/>`;
    return { w: 1.0, d: 0.7, h: 1.0, svg: s };
  },

  // ---- the hedgehog's ----

  // her bed: a shallow wooden tub full of soft leaves, a red checked blanket, a pine-cone pillow
  hh_bed() {
    const w = 2.6;
    const d = 2.0;
    let s = ishadow(0, 0, w, d, 0.7, 0.2);
    s += ibox(0, 0, w, d, 0.5, '#c99a6b', { r: 12, front: '#a47148' });
    const cols = ['#ff922b', '#fa5252', '#fcc419', '#e8590c'];
    for (let i = 0; i < 14; i++) {
      const x = IX(0.25 + (i % 5) * 0.5);
      const y = IY(0.25 + Math.floor(i / 5) * 0.55, 0.55);
      s += `<path d="M${x - 9} ${y} Q${x} ${y - 8} ${x + 9} ${y} Q${x} ${y + 6} ${x - 9} ${y} Z" fill="${cols[i % 4]}" ${OL(cols[i % 4], 1)} transform="rotate(${(i * 47) % 90 - 45} ${x} ${y})"/>`;
    }
    s += ibox(0.15, 0.9, w - 0.3, d - 0.95, 0.12, '#ff6b6b', { y0: 0.5, r: 6 });
    for (let x = 0.3; x < w - 0.2; x += 0.3) s += `<path d="M${IX(x)} ${IY(0.95, 0.62)} v${(d - 1.0) * I_R}" stroke="#fff" stroke-width="2.5" opacity=".6"/>`;
    for (let z = 1.1; z < d - 0.1; z += 0.3) s += `<path d="M${IX(0.2)} ${IY(z, 0.62)} h${IX(w - 0.4)}" stroke="#fff" stroke-width="2.5" opacity=".6"/>`;
    const px = IX(0.8);
    const py = IY(0.45, 0.72);
    s += `<ellipse cx="${px}" cy="${py}" rx="20" ry="11" fill="#a0673f" ${OL('#a0673f', 1.8)}/>${[-12, -4, 4, 12].map((dx) => `<path d="M${px + dx - 4} ${py - 2} l4 -5 l4 5" stroke="#7a4a2a" stroke-width="1.5" fill="none"/><path d="M${px + dx - 4} ${py + 4} l4 -5 l4 5" stroke="#7a4a2a" stroke-width="1.5" fill="none"/>`).join('')}`;
    return { w, d, h: 1.0, svg: s };
  },
  // her sewing basket: wool, and a pincushion shaped like a little hedgehog, bristling with pins
  hh_basket() {
    const xc = 0.4;
    const zc = 0.35;
    let s = ishadowE(xc, zc, 0.36, 0.6) + icyl(xc, zc, 0.34, 0.35, '#e2bf74', { front: '#c9a253' });
    for (let y = 0.08; y < 0.35; y += 0.1) s += `<path d="M${IX(xc - 0.33)} ${IY(zc + 0.3, y)} h${IX(0.66)}" stroke="#b08a3e" stroke-width="1.2"/>`;
    s += `<circle cx="${IX(xc - 0.12)}" cy="${IY(zc, 0.45)}" r="8" fill="#748ffc" ${OL('#748ffc', 1.3)}/><path d="M${IX(xc - 0.12) - 6} ${IY(zc, 0.45) - 2} q6 -3 12 2" stroke="#fff" stroke-width="1.2" fill="none"/>`;
    const hx = IX(xc + 0.12);
    const hy = IY(zc, 0.42);
    s += [...Array(9)].map((_, i) => {
      const a = Math.PI + (i / 8) * Math.PI;
      return `<path d="M${hx + Math.cos(a) * 7} ${hy + Math.sin(a) * 6} l${Math.cos(a) * 8} ${Math.sin(a) * 8}" stroke="#adb5bd" stroke-width="1.2"/><circle cx="${hx + Math.cos(a) * 15} " cy="${hy + Math.sin(a) * 14}" r="1.8" fill="${['#fa5252', '#ffd43b', '#4dabf7'][i % 3]}"/>`;
    }).join('');
    s += `<path d="M${hx - 10} ${hy + 2} Q${hx - 10} ${hy - 10} ${hx} ${hy - 10} Q${hx + 10} ${hy - 10} ${hx + 10} ${hy + 2} Z" fill="#8a5c36" ${OL('#8a5c36', 1.3)}/><circle cx="${hx + 8}" cy="${hy - 1}" r="4" fill="#f3d9b1"/><circle cx="${hx + 9}" cy="${hy - 2}" r="1" fill="#4a2c38"/>`;
    return { w: 0.8, d: 0.7, h: 0.9, svg: s };
  },
  // her flower stand: three shelves made of branches, crowded with pots; the better she knows the
  // pig, the more of them are in flower (the cactus last of all)
  hh_flowers(o) {
    const w = 3.2;
    const d = 0.8;
    const c = '#8a5c36';
    const out = Math.min(9, 3 + Math.floor((o.hearts || 0) * 0.6));
    let s = ishadow(0, 0, w, d, 2.5, 0.16);
    for (const x of [0.1, w - 0.18]) s += `<path d="M${IX(x)} ${IY(d - 0.1)} q-3 ${-1.4 * I_H} 2 ${-2.8 * I_H}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    const tiers = [0.45, 1.45, 2.45];
    const flowers = [['#fa5252', 'tulip'], ['#fff', 'daisy'], ['#ffd43b', 'tulip'], ['#b197fc', 'daisy'], ['#ff8fab', 'tulip'], ['#fff', 'daisy'], ['#ff922b', 'tulip'], ['#fa5252', 'daisy'], ['#ffc9dc', 'cactus']];
    tiers.forEach((y, t) => {
      s += `<path d="M${IX(0)} ${IY(d - 0.2, y)} Q${IX(w / 2)} ${IY(d - 0.2, y + 0.06)} ${IX(w)} ${IY(d - 0.2, y)}" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 3; i++) {
        const k = t * 3 + i;
        const x = 0.55 + i * 1.05 + (t % 2) * 0.12;
        const [fc, kind] = flowers[k];
        s += icyl(x, d - 0.4, 0.16, 0.24, '#e8825c', { y0: y + 0.05, ol: 1.5 });
        const bx = IX(x);
        const by = IY(d - 0.4, y + 0.29);
        if (kind === 'cactus') {
          s += `<path d="M${bx - 7} ${by} V${by - 18} a7 7 0 0 1 14 0 V${by} Z" fill="#69db7c" ${OL('#40c057', 1.4)}/><path d="M${bx - 3} ${by - 12} l-3 -2 M${bx + 3} ${by - 6} l3 -2 M${bx} ${by - 20} v-3" stroke="#2b8a3e" stroke-width="1"/>`;
          if (k < out) s += `<circle cx="${bx}" cy="${by - 25}" r="4.5" fill="${fc}" ${OL(fc, 1)}/>`;
          continue;
        }
        s += `<path d="M${bx} ${by} v-10" stroke="#40c057" stroke-width="2"/><path d="M${bx} ${by - 4} q-7 -2 -7 -7 q5 0 7 5" fill="#69db7c"/>`;
        if (k >= out) s += `<ellipse cx="${bx}" cy="${by - 12}" rx="3.5" ry="5" fill="#8ce99a" ${OL('#40c057', 1)}/>`;
        else if (kind === 'tulip') s += `<path d="M${bx - 6} ${by - 10} q0 -10 6 -11 q6 1 6 11 q-6 4 -12 0 Z" fill="${fc}" ${OL(fc, 1.2)}/>`;
        else s += `${[0, 1, 2, 3, 4, 5].map((j) => `<ellipse cx="${bx + Math.cos(j * 1.05) * 5}" cy="${by - 14 + Math.sin(j * 1.05) * 5}" rx="3.5" ry="2.5" fill="${fc}" ${OL('#ced4da', 0.8)} transform="rotate(${j * 60} ${bx + Math.cos(j * 1.05) * 5} ${by - 14 + Math.sin(j * 1.05) * 5})"/>`).join('')}<circle cx="${bx}" cy="${by - 14}" r="3" fill="#ffd43b"/>`;
      }
    });
    return { w, d, h: 3.2, svg: s };
  },
  // a round rag rug, knitted in autumn colours
  hh_rug() {
    const w = 2.8;
    const d = 2.0;
    let s = `<ellipse cx="${IX(w / 2) + 3}" cy="${IY(d / 2) + 4}" rx="${IX(w / 2)}" ry="${(d / 2) * I_R}" fill="#4a2c38" opacity=".12"/>`;
    ['#e8590c', '#ffa94d', '#fcc419', '#fa5252', '#ffd8a8'].forEach((c, i) => {
      const k = 1 - i * 0.19;
      s += `<ellipse cx="${IX(w / 2)}" cy="${IY(d / 2)}" rx="${IX((w / 2) * k)}" ry="${(d / 2) * k * I_R}" fill="${c}" ${i ? '' : OL(c, 2)}/>`;
    });
    return { w, d, flat: true, svg: s };
  },
  // a big mushroom for a table, a plate of apple slices cut like little rabbits on it; a branch
  // stool either side
  hh_table() {
    const xc = 1.5;
    const zc = 0.65;
    let s = logStool(xc - 1.25, zc + 0.15, '#8a5c36') + logStool(xc + 1.25, zc + 0.15, '#8a5c36');
    s += ishadowE(xc, zc, 0.75, 1);
    s += icyl(xc, zc, 0.24, 0.85, '#fff4e6', { front: '#f3e3cc' });
    const top = IY(zc, 1.05);
    const cx = IX(xc);
    s += `<path d="M${cx - 0.85 * I_T} ${top + 6} Q${cx - 0.8 * I_T} ${top - 22} ${cx} ${top - 24} Q${cx + 0.8 * I_T} ${top - 22} ${cx + 0.85 * I_T} ${top + 6} Q${cx} ${top + 18} ${cx - 0.85 * I_T} ${top + 6} Z" fill="#e8590c" ${OL('#e8590c', 2.5)}/>
      <ellipse cx="${cx}" cy="${top - 8}" rx="${0.62 * I_T}" ry="${0.38 * I_R}" fill="#ff922b"/>
      ${[[-22, 2], [20, 4], [-4, 10]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${top + dy}" r="4" fill="#fff4e6" opacity=".9"/>`).join('')}
      <ellipse cx="${cx + 4}" cy="${top - 10}" rx="20" ry="7" fill="#fff" ${OL('#e9ecef', 1.4)}/>
      ${[-10, 0, 10].map((dx) => `<path d="M${cx + 4 + dx - 5} ${top - 9} q5 -9 10 0 Z" fill="#fff4e6" stroke="#fa5252" stroke-width="1.6"/><path d="M${cx + 4 + dx - 2} ${top - 15} l-1 -4 M${cx + 4 + dx + 2} ${top - 15} l1 -4" stroke="#fa5252" stroke-width="1.6"/>`).join('')}`;
    return { w: 3.0, d: 1.4, h: 1.7, svg: s };
  },
  // two wooden crates of red apples by the door, one with a leaf on the top apple
  hh_apples() {
    const w = 1.4;
    const d = 0.9;
    let s = ishadow(0, 0, w, d, 1.2, 0.2);
    const crate = (y0, h) => {
      let c = ibox(0, 0, w, d, h, '#d39a5e', { y0, r: 3 });
      for (let k = 0.18; k < h; k += 0.2) c += `<path d="M${IX(0.05)} ${IY(d, y0 + k)} h${IX(w - 0.1)}" stroke="#b5784a" stroke-width="1.5"/>`;
      return c;
    };
    const apples = (y) => [[0.25, 0.25], [0.6, 0.2], [0.95, 0.28], [0.4, 0.55], [0.8, 0.55], [1.15, 0.5]].map(([x, z]) => `<circle cx="${IX(x)}" cy="${IY(z, y) - 4}" r="8" fill="#fa5252" ${OL('#fa5252', 1.4)}/><circle cx="${IX(x) - 3}" cy="${IY(z, y) - 7}" r="2" fill="#fff" opacity=".6"/>`).join('');
    s += crate(0, 0.55) + apples(0.55) + crate(0.55, 0.55) + apples(1.1);
    s += `<path d="M${IX(0.8)} ${IY(0.55, 1.1) - 12} q8 -8 14 -4 q-6 6 -14 4" fill="#51cf66" ${OL('#51cf66', 1)}/>`;
    return { w, d, h: 1.5, svg: s };
  },

  // ---- the cow's ----

  // two shining milk churns
  cw_cans() {
    let s = '';
    for (const [x, z] of [[0.45, 0.4], [1.3, 0.45]]) {
      s += ishadowE(x, z, 0.36, 1.3) + icyl(x, z, 0.32, 1.0, '#e9ecef', { front: '#ced4da' });
      s += icyl(x, z, 0.22, 0.28, '#dee2e6', { y0: 1.0, ol: 1.8 }) + icyl(x, z, 0.25, 0.08, '#adb5bd', { y0: 1.28, ol: 1.4 });
      s += `<path d="M${IX(x - 0.32)} ${IY(z + 0.2, 0.3)} h${IX(0.64)}" stroke="#adb5bd" stroke-width="3"/><path d="M${IX(x - 0.22)} ${IY(z + 0.3, 0.85)} v-16" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>`;
    }
    return { w: 1.8, d: 0.8, h: 1.5, svg: s };
  },
  // on the wall: a beam of cow bells, big and small, each over a little wooden plaque with its
  // cow's face burnt into it
  cw_bells() {
    const w = IX(2.8);
    let s = `<rect x="${-w / 2 + 3}" y="-26" width="${w}" height="12" rx="5" fill="#4a2c38" opacity=".15"/><rect x="${-w / 2}" y="-30" width="${w}" height="12" rx="5" fill="#8c4a36" ${OL('#8c4a36', 2)}/>`;
    [[-0.4, 1], [-0.2, 0.8], [0, 1.2], [0.2, 0.9], [0.4, 0.75]].forEach(([u, k], i) => {
      const x = u * w;
      const c = i % 2 ? '#c0c4c8' : '#ffd43b';
      const oc = i % 2 ? '#868e96' : '#fab005';
      s += `<path d="M${x} -18 v${6 * k}" stroke="#a0673f" stroke-width="2.5"/>
        <path d="M${x - 10 * k} ${-12 + 6 * k + 20 * k} Q${x - 10 * k} ${-12 + 6 * k} ${x} ${-12 + 6 * k} Q${x + 10 * k} ${-12 + 6 * k} ${x + 10 * k} ${-12 + 6 * k + 20 * k} Z" fill="${c}" ${OL(oc, 1.6)}/>
        <circle cx="${x}" cy="${-12 + 6 * k + 22 * k}" r="${2.6 * k}" fill="${oc}"/>
        <rect x="${x - 11}" y="${24 + i * 1.5}" width="22" height="16" rx="3" fill="#e0b07a" ${OL('#b5784a', 1.4)}/>
        <circle cx="${x}" cy="${33 + i * 1.5}" r="4.5" fill="#fff" stroke="#6b4423" stroke-width="1"/><path d="M${x - 5} ${29 + i * 1.5} l-2 -3 M${x + 5} ${29 + i * 1.5} l2 -3" stroke="#6b4423" stroke-width="1.2"/>
        <circle cx="${x + 2}" cy="${32 + i * 1.5}" r="1.6" fill="#343a40"/>`;
    });
    return { wall: true, w: 2.8, svg: s };
  },
  // a wooden butter churn with its plunger
  cw_churn() {
    const xc = 0.4;
    const zc = 0.4;
    let s = ishadowE(xc, zc, 0.36, 1.6);
    s += icyl(xc, zc, 0.3, 1.1, '#d39a5e', { front: '#b5784a' });
    for (const y of [0.25, 0.85]) s += `<path d="M${IX(xc - 0.3)} ${IY(zc + 0.28, y)} h${IX(0.6)}" stroke="#868e96" stroke-width="3"/>`;
    s += `<rect x="${IX(xc) - 2.5}" y="${IY(zc, 1.9)}" width="5" height="${0.85 * I_H}" fill="#a0673f"/><rect x="${IX(xc) - 10}" y="${IY(zc, 1.95)}" width="20" height="5" rx="2" fill="#a0673f"/>`;
    return { w: 0.8, d: 0.8, h: 2.0, svg: s };
  },
  // the long table with a red and white checked cloth: a big jug of milk, a wedge of cheese, a
  // basket of bread; a stool either end
  cw_table() {
    const w = 4.0;
    const d = 1.6;
    let s = logStool(0.3, 0.9, '#a0673f') + logStool(w - 0.3, 0.9, '#a0673f');
    s += ishadow(0.6, 0.15, w - 1.2, d - 0.3, 1, 0.2);
    for (const lx of [0.75, w - 0.9]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.2, 0.9)}" width="${0.15 * I_T}" height="${0.9 * I_H}" fill="#8c6239"/>`;
    s += ibox(0.6, 0.15, w - 1.2, d - 0.3, 0.1, '#fff', { y0: 0.9, r: 3, front: '#fff' });
    for (let x = 0.6; x < w - 0.6; x += 0.28) s += `<rect x="${IX(x)}" y="${IY(0.15, 1.0)}" width="${0.14 * I_T}" height="${(d - 0.3) * I_R + 0.1 * I_H}" fill="#fa5252" opacity=".45"/>`;
    for (let z = 0.15; z < d - 0.15; z += 0.25) s += `<rect x="${IX(0.6)}" y="${IY(z, 1.0)}" width="${IX(w - 1.2)}" height="${0.12 * I_R}" fill="#fa5252" opacity=".45"/>`;
    s += `<path d="M${IX(0.6)} ${IY(d - 0.15, 0.9)} v6 h${IX(w - 1.2)} v-6" fill="#fff" stroke="#fa5252" stroke-width="1.5"/>`;
    s += icyl(1.4, 0.6, 0.2, 0.5, '#f8f9fa', { y0: 1.0, ol: 1.8 }) + `<path d="M${IX(1.6)} ${IY(0.6, 1.4)} q10 2 6 14" stroke="#ced4da" stroke-width="3" fill="none"/><ellipse cx="${IX(1.4)}" cy="${IY(0.6, 1.5)}" rx="7" ry="3.5" fill="#fff"/>`;
    s += `<path d="M${IX(2.0)} ${IY(0.85, 1.0)} l${IX(0.55)} -4 l-6 -14 Z" fill="#ffd43b" ${OL('#fab005', 1.5)}/><circle cx="${IX(2.25)}" cy="${IY(0.85, 1.0) - 6}" r="2" fill="#f2b400"/><circle cx="${IX(2.12)}" cy="${IY(0.85, 1.0) - 3}" r="1.5" fill="#f2b400"/>`;
    s += icyl(2.85, 0.6, 0.28, 0.2, '#d9b26a', { y0: 1.0, ol: 1.6 }) + `<ellipse cx="${IX(2.75)}" cy="${IY(0.6, 1.25)}" rx="10" ry="6" fill="#e8a65d" ${OL('#c48a57', 1.2)}/><ellipse cx="${IX(2.95)}" cy="${IY(0.55, 1.27)}" rx="9" ry="5" fill="#d9944a" ${OL('#c48a57', 1.2)}/>`;
    return { w, d, h: 1.6, svg: s };
  },
  // a big haystack he sleeps on, a patched blanket over it and a pitchfork stuck in the top
  cw_hay() {
    const w = 3.0;
    const d = 2.0;
    let s = ishadow(0, 0.1, w, d, 1.5, 0.2);
    const cx = IX(w / 2);
    const base = IY(d - 0.1);
    s += `<path d="M${IX(0)} ${base} Q${IX(0)} ${IY(0.5, 1.8)} ${cx} ${IY(0.4, 2.0)} Q${IX(w)} ${IY(0.5, 1.8)} ${IX(w)} ${base} Q${cx} ${base + 10} ${IX(0)} ${base} Z" fill="#ffd43b" ${OL('#e0a800', 2.5)}/>`;
    for (let i = 0; i < 16; i++) s += `<path d="M${IX(0.2 + (i % 8) * 0.34)} ${base - 6 - Math.floor(i / 8) * 26} q4 -12 -2 -22" stroke="#e0a800" stroke-width="1.4" fill="none"/>`;
    s += `<path d="M${IX(0.9)} ${IY(1.0, 1.5)} L${IX(2.4)} ${IY(1.1, 1.45)} L${IX(2.5)} ${IY(1.6, 0.7)} L${IX(0.7)} ${IY(1.7, 0.75)} Z" fill="#74c0fc" ${OL('#4dabf7', 1.8)}/>
      <rect x="${IX(1.2)}" y="${IY(1.3, 1.3)}" width="16" height="12" fill="#ff8787" transform="rotate(-6 ${IX(1.2)} ${IY(1.3, 1.3)})"/><rect x="${IX(1.9)}" y="${IY(1.4, 1.0)}" width="14" height="12" fill="#ffd8a8"/>
      <path d="M${IX(2.5)} ${IY(0.4, 1.9)} L${IX(2.9)} ${IY(0.3, 3.4)}" stroke="#a0673f" stroke-width="4" stroke-linecap="round"/>
      <path d="M${IX(2.42)} ${IY(0.4, 1.7)} v18 M${IX(2.5)} ${IY(0.4, 1.7)} v18 M${IX(2.58)} ${IY(0.4, 1.7)} v18 M${IX(2.4)} ${IY(0.4, 1.72)} h${IX(0.2)}" stroke="#868e96" stroke-width="2"/>`;
    return { w, d, h: 2.2, svg: s };
  },
  // a basket just picked: carrots, corn and a pumpkin
  cw_veg() {
    const xc = 0.6;
    const zc = 0.4;
    let s = ishadowE(xc, zc, 0.5, 0.9) + icyl(xc, zc, 0.48, 0.4, '#8a6a3a', { front: '#c9a253' });
    s += `<path d="M${IX(xc - 0.25)} ${IY(zc, 0.45)} l-6 -22 l8 0 Z" fill="#ff922b"/><path d="M${IX(xc - 0.25) - 4} ${IY(zc, 0.45) - 22} l-4 -6 M${IX(xc - 0.25) - 2} ${IY(zc, 0.45) - 22} l2 -7" stroke="#51cf66" stroke-width="2.5"/>
      <ellipse cx="${IX(xc + 0.05)}" cy="${IY(zc, 0.7)}" rx="7" ry="15" fill="#ffd43b" ${OL('#fab005', 1.4)} transform="rotate(14 ${IX(xc + 0.05)} ${IY(zc, 0.7)})"/><path d="M${IX(xc)} ${IY(zc, 0.45)} q-8 -10 -6 -24" stroke="#69db7c" stroke-width="3" fill="none"/>
      <ellipse cx="${IX(xc + 0.3)}" cy="${IY(zc, 0.55)}" rx="14" ry="11" fill="#ff922b" ${OL('#e8590c', 1.6)}/><path d="M${IX(xc + 0.3)} ${IY(zc, 0.55) - 11} v-5" stroke="#51cf66" stroke-width="3"/>`;
    // the basket's front rim, over the bottom of what's in it
    s += `<path d="M${IX(xc - 0.48)} ${IY(zc, 0.4)} A${0.48 * I_T} ${0.48 * I_R} 0 0 0 ${IX(xc + 0.48)} ${IY(zc, 0.4)} V${IY(zc, 0)} A${0.48 * I_T} ${0.48 * I_R} 0 0 1 ${IX(xc - 0.48)} ${IY(zc, 0)} Z" fill="#d9b26a" ${OL('#c9a253')}/>`;
    for (let y = 0.1; y < 0.4; y += 0.12) s += `<path d="M${IX(xc - 0.46)} ${IY(zc + 0.4, y)} h${IX(0.92)}" stroke="#b08a3e" stroke-width="1.2"/>`;
    return { w: 1.2, d: 0.8, h: 1.1, svg: s };
  },

  // ---- the bear's ----

  // his workbench: a vice at one end, a plane and shavings, and on top whatever he's making —
  // a stool at first, a sofa frame once the bear sofa is in his shop, the treehouse at the end
  br_bench(o) {
    const w = 4.0;
    const d = 1.3;
    const c = '#c8945e';
    const hh = o.hearts || 0;
    let s = ishadow(0, 0, w, d, 1.2, 0.2);
    for (const lx of [0.15, w - 0.35]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.15, 1.0)}" width="${0.2 * I_T}" height="${1.0 * I_H}" fill="${darker(c, 0.25)}"/>`;
    s += `<rect x="${IX(0.25)}" y="${IY(d - 0.15, 0.3)}" width="${IX(w - 0.5)}" height="7" fill="${darker(c, 0.25)}"/>`;
    s += ibox(0, 0, w, d, 0.2, c, { y0: 1.0, r: 3 });
    s += `<rect x="${IX(-0.15)}" y="${IY(d - 0.2, 1.25)}" width="${0.35 * I_T}" height="${0.5 * I_H}" rx="2" fill="#868e96" ${OL('#868e96', 1.5)}/><path d="M${IX(-0.35)} ${IY(d - 0.2, 1.05)} h${0.75 * I_T}" stroke="#495057" stroke-width="3" stroke-linecap="round"/>`;
    s += `<rect x="${IX(0.1)}" y="${IY(0.4, 1.32)}" width="${IX(0.9)}" height="${0.35 * I_R}" fill="#e8c393" ${OL('#c8945e', 1.4)}/>`;
    s += ibox(3.0, 0.75, 0.6, 0.3, 0.15, '#a0673f', { y0: 1.2, r: 3, ol: 1.6 }) + `<path d="M${IX(3.2)} ${IY(0.75, 1.35)} q4 -10 12 -8" stroke="#a0673f" stroke-width="3" fill="none"/>`;
    for (const [x, z] of [[2.8, 0.4], [3.4, 0.35], [2.6, 1.0], [0.3, 1.05]]) s += `<path d="M${IX(x)} ${IY(z, 1.2)} c5 -5 10 0 5 3 c-4 3 -8 -2 -3 -3" stroke="#f3d29c" stroke-width="2.4" fill="none"/>`;
    const bx = 1.7;
    const by = 1.2;
    if (hh >= 10) {
      // the treehouse model
      s += `<rect x="${IX(bx) - 3}" y="${IY(0.6, by + 1.0)}" width="6" height="${1.0 * I_H}" fill="#9c6a43"/>
        ${[[-14, -10, 14], [12, -12, 15], [0, -24, 16]].map(([dx, dy, rr]) => `<circle cx="${IX(bx) + dx}" cy="${IY(0.6, by + 1.3) + dy}" r="${rr}" fill="#69db7c" ${OL('#40c057', 1.5)}/>`).join('')}
        <rect x="${IX(bx) - 12}" y="${IY(0.6, by + 1.1)}" width="24" height="16" fill="#ffd8a8" ${OL('#e0a96d', 1.4)}/><path d="M${IX(bx) - 16} ${IY(0.6, by + 1.1)} l16 -12 l16 12 Z" fill="#ff8787" ${OL('#ff8787', 1.4)}/>`;
    } else if (hh >= 6) {
      // the bear sofa's frame, no cushions yet
      s += `<path d="M${IX(bx - 0.6)} ${IY(0.75, by)} v-26 M${IX(bx + 0.6)} ${IY(0.75, by)} v-26 M${IX(bx - 0.6)} ${IY(0.75, by) - 12} h${IX(1.2)} M${IX(bx - 0.5)} ${IY(0.45, by) - 32} h${IX(1.0)} M${IX(bx - 0.5)} ${IY(0.45, by) - 32} v20 M${IX(bx + 0.5)} ${IY(0.45, by) - 32} v20" stroke="#e0a96d" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${IX(bx - 0.42)}" cy="${IY(0.45, by) - 38}" r="6" fill="none" stroke="#e0a96d" stroke-width="4"/><circle cx="${IX(bx + 0.42)}" cy="${IY(0.45, by) - 38}" r="6" fill="none" stroke="#e0a96d" stroke-width="4"/>`;
    } else {
      // a little three-legged stool
      s += `<path d="M${IX(bx - 0.2)} ${IY(0.7, by)} l4 -18 M${IX(bx + 0.2)} ${IY(0.7, by)} l-4 -18 M${IX(bx)} ${IY(0.5, by)} v-16" stroke="#e0a96d" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="${IX(bx)}" cy="${IY(0.6, by) - 19}" rx="16" ry="6" fill="#f3d29c" ${OL('#e0a96d', 1.6)}/>`;
    }
    return { w, d, h: hh >= 10 ? 3.0 : 2.2, svg: s };
  },
  // his own bed, the same as the one in his shop: a bear's round ears on the headboard
  br_bed() {
    const w = 2.8;
    const d = 2.2;
    const c = '#a0673f';
    let s = ishadow(0, 0, w, d, 1, 0.2);
    for (const k of [0.45, w - 0.45]) s += `<circle cx="${IX(k)}" cy="${IY(0.1, 2.0)}" r="${0.36 * I_T}" fill="${c}" ${OL(c)}/><circle cx="${IX(k)}" cy="${IY(0.1, 2.0)}" r="${0.2 * I_T}" fill="#e8b787"/>`;
    s += `<path d="${rpath(IX(0.1), IY(0.1, 1.95), IX(w - 0.2), 1.95 * I_H, 18, true, false)}" fill="${c}" ${OL(c)}/>`;
    s += ibox(0, 0.25, w, d - 0.25, 0.5, c, { r: 6 });
    s += ibox(0.1, 0.3, w - 0.2, d - 0.4, 0.15, '#fff8f0', { y0: 0.5, r: 8 });
    s += ibox(0.35, 0.4, 0.95, 0.45, 0.14, '#fff', { y0: 0.65, r: 8, ol: 2 }) + ibox(1.5, 0.4, 0.95, 0.45, 0.14, '#fff', { y0: 0.65, r: 8, ol: 2 });
    s += ibox(0.08, 1.0, w - 0.16, d - 1.05, 0.25, '#ffc94d', { y0: 0.5, r: 8, front: '#f2a900' });
    for (const [x, z] of [[0.6, 1.4], [1.4, 1.7], [2.2, 1.35]]) s += `<path d="M${IX(x) - 5} ${IY(z, 0.75)} l5 -6 l5 6 l-5 6 Z" fill="#fff3bf" opacity=".8"/>`;
    return { w, d, h: 2.4, svg: s };
  },
  // a shelf of honey jars, one open with a wooden dipper in it
  br_honey() {
    const w = 2.2;
    const d = 0.7;
    const c = '#b5784a';
    let s = ishadow(0, 0, w, d, 2, 0.18);
    s += ibox(0, 0, w, d, 1.9, c, { r: 3, front: darker(c, 0.1) });
    s += `<rect x="${IX(0.1)}" y="${IY(d, 1.8)}" width="${IX(w - 0.2)}" height="${1.7 * I_H}" fill="#6b4423"/>`;
    for (const y of [0.1, 0.95]) {
      s += `<rect x="${IX(0.1)}" y="${IY(d, y + 0.05)}" width="${IX(w - 0.2)}" height="5" fill="${c}"/>`;
      for (let i = 0; i < 4; i++) {
        const x = IX(0.35 + i * 0.5);
        const hh = 18 + (i % 2) * 6;
        const by = IY(d, y + 0.05);
        s += `<rect x="${x - 9}" y="${by - hh}" width="18" height="${hh}" rx="4" fill="#ffb02e" ${OL('#e8890c', 1.5)}/><rect x="${x - 10}" y="${by - hh - 5}" width="20" height="6" rx="2" fill="${i === 2 && y > 0.5 ? '#ffb02e' : '#fff4e6'}" ${OL('#e9c46a', 1)}/>
          <rect x="${x - 6}" y="${by - hh + 6}" width="4" height="${hh - 10}" rx="2" fill="#fff" opacity=".45"/>`;
      }
    }
    s += `<path d="M${IX(1.35)} ${IY(d, 1.0) - 26} l8 -16" stroke="#e0a96d" stroke-width="3.5" stroke-linecap="round"/>`;
    return { w, d, h: 2.0, svg: s };
  },
  // a round table and two stump stools for visitors; a jug of honey water
  br_table() {
    const xc = 1.6;
    const zc = 0.7;
    let s = logStool(xc - 1.3, zc + 0.15) + logStool(xc + 1.3, zc + 0.15);
    s += ishadowE(xc, zc, 0.7, 1) + icyl(xc, zc, 0.3, 0.05, WOOD_D, { ol: 2 });
    s += `<rect x="${IX(xc) - 5}" y="${IY(zc, 0.85)}" width="10" height="${0.82 * I_H}" fill="${WOOD_D}" ${OL(WOOD_D, 2)}/>`;
    s += icyl(xc, zc, 0.68, 0.12, '#e8c393', { y0: 0.85, front: '#c8945e' });
    s += icyl(xc - 0.15, zc - 0.05, 0.15, 0.38, '#ffe8a3', { y0: 0.97, ol: 1.6 }) + `<ellipse cx="${IX(xc - 0.15)}" cy="${IY(zc - 0.05, 1.35)}" rx="5" ry="2.5" fill="#ffc94d"/><path d="M${IX(xc)} ${IY(zc - 0.05, 1.3)} q8 2 6 12" stroke="#e8c393" stroke-width="3" fill="none"/>`;
    s += teacup(xc + 0.35, zc + 0.1, 0.97, '#ffe8a3') + teacup(xc + 0.1, zc + 0.3, 0.97, '#ffe8a3');
    return { w: 3.2, d: 1.4, h: 1.4, svg: s };
  },
  // planks stacked by the door
  br_planks() {
    const w = 1.8;
    const d = 0.8;
    let s = ishadow(0, 0, w, d, 0.7, 0.2);
    for (let i = 0; i < 4; i++) s += ibox(0.05 * (i % 2), 0.05, w - 0.1, d - 0.1, 0.14, i % 2 ? '#e0b07a' : '#d39a5e', { y0: i * 0.15, r: 2, ol: 1.6 });
    return { w, d, h: 0.7, svg: s };
  },

  // ---- the turtle's ----

  // a tall old clock whose pendulum swings very, very slowly
  tt_clock() {
    const w = 0.9;
    const d = 0.6;
    const c = '#8a5a3c';
    let s = ishadow(0, 0, w, d, 3, 0.2);
    s += ibox(0, 0, w, d, 4.0, c, { r: 6 });
    const cx = IX(w / 2);
    s += `<circle cx="${cx}" cy="${IY(d, 3.35)}" r="14" fill="#fff8e1" ${OL('#e9c46a', 2)}/><path d="M${cx} ${IY(d, 3.35)} v-9 M${cx} ${IY(d, 3.35)} l6 3" stroke="#4a2c38" stroke-width="2" stroke-linecap="round"/>
      <rect x="${cx - 13}" y="${IY(d, 2.6)}" width="26" height="${1.9 * I_H}" rx="4" fill="#3d2a1f"/>
      <g class="slowswing" style="transform-origin:${cx}px ${IY(d, 2.55)}px"><path d="M${cx} ${IY(d, 2.55)} v${1.3 * I_H}" stroke="#e9c46a" stroke-width="2"/><circle cx="${cx}" cy="${IY(d, 2.55) + 1.3 * I_H}" r="8" fill="#ffd43b" ${OL('#fab005', 1.4)}/></g>`;
    return { w, d, h: 4.1, svg: s };
  },
  // a low table under the window: a teapot of seaweed tea, two cups
  tt_tea() {
    const w = 2.0;
    const d = 1.0;
    const c = '#b5894e';
    let s = ishadow(0, 0, w, d, 0.6, 0.2);
    for (const lx of [0.1, w - 0.22]) s += `<rect x="${IX(lx)}" y="${IY(d - 0.1, 0.5)}" width="${0.12 * I_T}" height="${0.5 * I_H}" rx="2" fill="${darker(c, 0.2)}"/>`;
    s += ibox(0, 0, w, d, 0.12, '#e9c98f', { y0: 0.5, r: 6, front: c });
    s += icyl(0.75, 0.45, 0.2, 0.26, '#63b3a5', { y0: 0.62, ol: 1.6 }) + `<circle cx="${IX(0.75)}" cy="${IY(0.45, 0.92)}" r="3" fill="#4c9a8c"/>
      <path d="M${IX(0.95)} ${IY(0.45, 0.8)} q9 -2 10 -10" stroke="#63b3a5" stroke-width="3" fill="none"/><path d="M${IX(0.7)} ${IY(0.45, 0.88)} q-4 -8 2 -12" stroke="#2b8a3e" stroke-width="2.5" fill="none"/>`;
    s += teacup(1.3, 0.35, 0.62, '#e6fcf5') + teacup(1.55, 0.6, 0.62, '#e6fcf5');
    return { w, d, h: 1.0, svg: s };
  },
  // the stone chess table, a game on it that has been going for three years; stone stools
  tt_chess() {
    const xc = 1.55;
    const zc = 0.85;
    let s = ishadowE(xc, zc, 0.85, 1);
    const stool = (k) => ishadowE(xc + k * 1.25, zc + 0.15, 0.3, 0.6) + icyl(xc + k * 1.25, zc + 0.15, 0.3, 0.5, '#ced4da', { front: '#adb5bd' });
    s += stool(-1) + stool(1);
    s += `<rect x="${IX(xc) - 8}" y="${IY(zc, 0.85)}" width="16" height="${0.82 * I_H}" fill="#adb5bd" ${OL('#adb5bd', 2)}/>`;
    s += icyl(xc, zc, 0.8, 0.14, '#e9ecef', { y0: 0.85, front: '#ced4da' });
    const n = 4;
    const bs = 1.0 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += `<rect x="${IX(xc - 0.5 + i * bs)}" y="${IY(zc - 0.5 + j * bs, 0.99)}" width="${IX(bs)}" height="${bs * I_R}" fill="${(i + j) % 2 ? '#6b7a74' : '#f1f3f5'}"/>`;
    s += `<rect x="${IX(xc - 0.5)}" y="${IY(zc - 0.5, 0.99)}" width="${I_T}" height="${I_R}" fill="none" ${OL('#6b7a74', 1.5)}/>`;
    for (const [dx, dz, c, k] of [[-0.3, -0.3, '#fff', 1], [0.15, 0.1, '#343a40', 1.2], [-0.05, 0.3, '#fff', 0.9], [0.35, -0.2, '#343a40', 1]]) {
      s += `<path d="M${IX(xc + dx) - 4 * k} ${IY(zc + dz, 1.0)} h${8 * k} l-2 ${-8 * k} h${-4 * k} Z" fill="${c}" ${OL('#adb5bd', 1.2)}/><circle cx="${IX(xc + dx)}" cy="${IY(zc + dz, 1.0) - 10 * k}" r="${3.5 * k}" fill="${c}" ${OL('#adb5bd', 1.2)}/>`;
    }
    return { w: 3.1, d: 1.7, h: 1.4, svg: s };
  },
  // his bed: a thick soft mattress of moss, two tiny mushrooms growing at its edge
  tt_moss() {
    const w = 2.6;
    const d = 1.8;
    let s = ishadow(0, 0, w, d, 0.6, 0.2);
    s += ibox(0, 0, w, d, 0.45, '#69b84a', { r: 18, front: '#57a03a' });
    for (let i = 0; i < 18; i++) s += `<circle cx="${IX(0.25 + (i % 6) * 0.42)}" cy="${IY(0.25 + Math.floor(i / 6) * 0.55, 0.45)}" r="${4 + (i % 3)}" fill="#8fd46a" opacity=".7"/>`;
    s += ibox(0.3, 0.2, 0.9, 0.45, 0.14, '#e6fcf5', { y0: 0.45, r: 8, ol: 2 });
    for (const [x, c] of [[2.2, '#fa5252'], [2.4, '#ffd43b']]) s += `<rect x="${IX(x) - 1.5}" y="${IY(d, 0.55)}" width="3" height="8" fill="#fff4e6"/><path d="M${IX(x) - 6} ${IY(d, 0.55)} q6 -9 12 0 Z" fill="${c}"/>`;
    return { w, d, h: 0.9, svg: s };
  },
  // a bamboo fishing rod leaning by the door, an empty creel at its foot
  tt_rod() {
    let s = ishadowE(0.5, 0.4, 0.35, 0.6);
    s += `<path d="M${IX(0.8)} ${IY(0.3)} L${IX(-0.4)} ${IY(0.3, 3.4)}" stroke="#c99a2e" stroke-width="4" stroke-linecap="round"/>
      <path d="M${IX(-0.4)} ${IY(0.3, 3.4)} q-6 30 -2 60" stroke="#868e96" stroke-width="1" fill="none"/><circle cx="${IX(-0.4) - 2}" cy="${IY(0.3, 3.4) + 60}" r="3" fill="#fa5252"/>`;
    s += ibox(0.15, 0.15, 0.7, 0.5, 0.55, '#d9b26a', { r: 8, front: '#c9a253' });
    for (let y = 0.15; y < 0.55; y += 0.13) s += `<path d="M${IX(0.2)} ${IY(0.65, y)} h${IX(0.6)}" stroke="#b08a3e" stroke-width="1.2"/>`;
    return { w: 1.0, d: 0.7, h: 1.0, svg: s };
  },
};
Object.assign(FIXTURE_ART, HOME_ART);

// ---------- the homes ----------
// layout: floors as in HOUSE_LAYOUTS (one floor each). spots: where the owner is, by what their
// day says (home, porch…; _ for anything else), each [x, z, doing, holding]. guestSpots: for
// anyone round on a visit. tea: where the pig and the owner sit for a cup. labels: what E does
// at the table and at their pride and joy.

const NPC_HOMES = {
  rabbit: {
    name: '小兔家',
    walls: '#8a6a4a',
    mat: wovenMat('#e2bf74'),
    labels: { tea: '喝胡萝卜汁', sign: '看小红花' },
    layout: [{
      depth: 8,
      rooms: [{ w: 11, name: '洞厅', look: 'burrow', sky: 5.6, light: 5.6 }, { w: 7, name: '小兔的房间', look: 'burrow', pale: true }],
      doors: [[3.6, 6.6]],
      door: 4.0,
      fixtures: [['rb_shelf', 1.6, 0.05], ['rb_rocker', 9.4, 0.4], ['rb_rug', 5.4, 3.0], ['rb_table', 5.6, 3.3, { use: 'tea' }], ['rb_hop', 8.6, 5.0],
        ['rb_rug2', 14.6, 3.0], ['rb_bed', 14.9, 0.1], ['rb_chart', 12.6, 3.7, { use: 'sign' }], ['rb_toys', 17.6, 5.9], ['rb_desk', 12.8, 5.6]],
    }],
    spots: {
      home: [[14.2, 4.3, '', '🖍️'], [8.9, 6.6, 'hop'], [15.6, 3.2]],
      porch: [[6.6, 6.9], [8.9, 6.6, 'hop']],
      hop: [[8.9, 6.6, 'hop'], [8.9, 5.6, 'hop']],
      _: [[14.2, 4.3, '', '🖍️'], [6.6, 6.9]],
    },
    guestSpots: [[3.2, 5.2]],
    tea: { pig: [4.25, 4.15, 0.72], host: [6.95, 4.15, 0.72] },
  },
  panda: {
    name: '熊猫爷爷家',
    walls: '#7f9a50',
    mat: wovenMat('#a8c46e'),
    labels: { tea: '喝茶', sign: '看字' },
    layout: [{
      depth: 9,
      rooms: [{ w: 15, name: '竹屋', look: 'bamboo', moon: 7.6, blind: [12.1, 15], light: 7.6 }],
      door: 8.6,
      fixtures: [['pd_scroll', 2.0, 3.4, { use: 'sign' }], ['pd_desk', 2.0, 0.3], ['pd_chess', 7.6, 0.5], ['pd_tea', 5.0, 4.1, { use: 'tea' }],
        ['pd_rocker', 10.6, 0.6], ['pd_bed', 13.2, 0.15], ['pd_bamboo', 14.2, 7.6], ['pd_shoots', 11.6, 7.8]],
    },
    ],
    spots: {
      home: [[2.0, 2.1, '', '🖌️'], [7.0, 6.2], [10.6, 2.6]],
      porch: [[11.2, 6.2], [7.0, 6.2]],
      _: [[2.0, 2.1, '', '🖌️'], [7.0, 6.2]],
    },
    guestSpots: [[2.4, 6.4]],
    tea: { pig: [3.55, 5.05, 0.15], host: [6.45, 5.05, 0.15] },
  },
  hedgehog: {
    name: '刺猬妹妹家',
    walls: '#7a4f2c',
    mat: wovenMat('#e8825c'),
    labels: { tea: '吃苹果', sign: '看花' },
    layout: [{
      depth: 8,
      rooms: [{ w: 13, name: '落叶小窝', look: 'stump', hole: 4.8, wreath: 7.6, photo: 1.4, light: 4.8 }],
      door: 7.4,
      fixtures: [['hh_rug', 3.2, 4.6], ['hh_bed', 2.0, 0.3], ['hh_basket', 4.0, 2.7], ['hh_flowers', 10.6, 0.15, { use: 'sign' }], ['hh_table', 6.2, 3.6, { use: 'tea' }], ['hh_apples', 11.6, 6.4]],
    }],
    spots: {
      home: [[6.6, 5.4, '', '🔪'], [10.6, 1.9, '', '💧'], [4.9, 3.2, '', '🧶']],
      porch: [[8.6, 7.0], [10.6, 1.9, '', '💧']],
      flowers: [[10.6, 1.9, '', '💧'], [9.6, 2.1, '', '💧']],
      _: [[10.6, 1.9, '', '💧'], [6.6, 5.4]],
    },
    guestSpots: [[3.4, 5.4]],
    tea: { pig: [4.95, 4.4, 0.5], host: [7.45, 4.4, 0.5] },
  },
  cow: {
    name: '牛大叔家',
    walls: '#8c4a36',
    mat: wovenMat('#d9b26a'),
    labels: { tea: '喝牛奶', sign: '看牛铃' },
    layout: [{
      depth: 9,
      rooms: [{ w: 15, name: '牧场小屋', look: 'barn', win: 7.5, light: 7.5 }],
      door: 8.8,
      fixtures: [['cw_cans', 2.2, 0.3], ['cw_bells', 2.4, 3.9, { use: 'sign' }], ['cw_churn', 5.2, 0.4], ['cw_table', 7.2, 3.6, { use: 'tea' }],
        ['cw_hay', 12.6, 0.3], ['cw_veg', 12.2, 7.4]],
    }],
    spots: {
      home: [[7.4, 6.2], [11.0, 3.3], [3.0, 2.2]],
      ranch: [[7.4, 6.2], [3.0, 2.2]],
      _: [[7.4, 6.2], [11.0, 3.3]],
    },
    guestSpots: [[4.8, 6.0]],
    tea: { pig: [5.5, 4.5, 0.5], host: [8.9, 4.5, 0.5] },
  },
  bear: {
    name: '熊师傅的木工房',
    walls: '#8c6239',
    mat: wovenMat('#c8945e'),
    labels: { tea: '喝蜂蜜水', sign: '看看在做什么' },
    layout: [{
      depth: 9,
      rooms: [{ w: 15, name: '木工房', look: 'logs', tools: [1.6, 5.4], win: 12.2, light: 12.2 }],
      door: 8.6,
      fixtures: [['br_bench', 3.6, 1.2, { use: 'sign' }], ['br_bed', 8.0, 0.15], ['br_honey', 12.2, 0.15], ['br_table', 11.4, 4.4, { use: 'tea' }], ['br_planks', 2.4, 7.4]],
    }],
    spots: {
      home: [[3.6, 3.2, '', '🔨'], [11.4, 6.4], [6.4, 5.0]],
      _: [[3.6, 3.2, '', '🔨'], [11.4, 6.4]],
    },
    guestSpots: [[9.0, 6.2]],
    tea: { pig: [10.1, 5.25, 0.5], host: [12.7, 5.25, 0.5] },
  },
  turtle: {
    name: '龟爷爷家',
    walls: '#3f6b4e',
    mat: wovenMat('#a9d6b5'),
    labels: { tea: '喝茶', sign: '看棋' },
    layout: [{
      depth: 8,
      rooms: [{ w: 13, name: '龟壳屋', look: 'shell', win: 6.4, photos: [9.6, 11.6], light: 6.4 }],
      door: 7.6,
      fixtures: [['tt_clock', 1.0, 0.2], ['tt_tea', 6.4, 0.6, { use: 'tea' }], ['tt_chess', 5.6, 3.8, { use: 'sign' }], ['tt_moss', 10.6, 0.3], ['tt_rod', 11.8, 6.6]],
    }],
    spots: {
      home: [[5.6, 6.2], [3.2, 2.8], [8.6, 2.6]],
      _: [[5.6, 6.2], [3.2, 2.8]],
    },
    guestSpots: [[3.4, 5.6]],
    tea: { pig: [4.6, 2.2], host: [8.2, 2.2] },
  },
};

for (const H of Object.values(NPC_HOMES)) {
  for (const L of H.layout) {
    let x = 0;
    for (const r of L.rooms) {
      r.x = x;
      x += r.w + I_CAP;
    }
    L.width = x - I_CAP;
  }
}

// Someone's home as Interior.enter wants it: whose, its rooms, what's in it, who else is round
function visitHome(id, s, now = townNow()) {
  const H = NPC_HOMES[id];
  return {
    key: `visit:${id}`, host: id, name: H.name, layout: H.layout, things: [], degrees: [], walls: H.walls, mat: H.mat, labels: H.labels,
    spots: H.spots, guestSpots: H.guestSpots, tea: H.tea, hearts: hearts(s, id), guests: guestsAt(NPC_BY_ID[id].home, now).map((n) => n.id),
  };
}
