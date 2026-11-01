// Mini games the player plays against the pig in the home window.
// Each game's start(el, done) renders into el and calls done('win' | 'lose' | 'draw') once,
// from the player's point of view, then shows its own result screen.

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

function resultView(gameId, result, detail) {
  const face = { win: '🎉', lose: '🐷', draw: '🤝' }[result];
  const text = { win: '你赢了！', lose: '小猪赢了', draw: '平局' }[result];
  return `<div class="g-result"><div class="g-result-ic">${face}</div><b>${text}</b>
    ${detail ? `<span>${detail}</span>` : ''}
    <div class="g-result-btns">
      <button class="btn" data-action="game" data-id="${gameId}">再来</button>
      <button class="btn ghost" data-action="games">返回</button>
    </div></div>`;
}

// ---------- rock paper scissors (first to 2) ----------

const RPS_HANDS = [
  { id: 'rock', icon: '✊', name: '石头', beats: 'scissors' },
  { id: 'scissors', icon: '✌️', name: '剪刀', beats: 'paper' },
  { id: 'paper', icon: '🖐️', name: '布', beats: 'rock' },
];

const RPS = {
  start(el, done) {
    let you = 0;
    let pig = 0;
    let last = null;
    let locked = false;

    const render = () => {
      el.innerHTML = `<div class="rps">
        <div class="score"><span>你 <b>${you}</b></span><span><b>${pig}</b> 🐷</span></div>
        <div class="rps-hands">
          <div class="rps-hand ${last ? 'show' : ''}">${last ? last.you.icon : '❔'}</div>
          <div class="rps-vs">VS</div>
          <div class="rps-hand pig ${last ? 'show' : ''}">${last ? last.pig.icon : '❔'}</div>
        </div>
        <div class="g-msg">${last ? last.text : '出拳！'}</div>
        <div class="g-choices">${RPS_HANDS.map((h) => `<button class="g-choice" data-g="${h.id}">${h.icon}<small>${h.name}</small></button>`).join('')}</div>
      </div>`;
    };

    el.onclick = (e) => {
      const b = e.target.closest('[data-g]');
      if (!b || locked) return;
      const mine = RPS_HANDS.find((h) => h.id === b.dataset.g);
      const theirs = pickOne(RPS_HANDS);
      let text = '平手';
      if (mine.beats === theirs.id) {
        you++;
        text = '+1';
      } else if (theirs.beats === mine.id) {
        pig++;
        text = '🐷 +1';
      }
      last = { you: mine, pig: theirs, text };
      render();
      if (you === 2 || pig === 2) {
        locked = true;
        const result = you === 2 ? 'win' : 'lose';
        setTimeout(() => {
          el.innerHTML = resultView('rps', result, `${you} : ${pig}`);
          done(result);
        }, 1100);
      }
    };
    render();
  },
};

// ---------- tic tac toe ----------

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function tttWinner(b) {
  for (const [a, c, d] of TTT_LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? 'draw' : null;
}

// Win if it can, block if it must, otherwise mostly play well but not perfectly
function tttPigMove(b) {
  const empty = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  for (const who of ['O', 'X']) {
    for (const i of empty) {
      const t = b.slice();
      t[i] = who;
      if (tttWinner(t) === who) return i;
    }
  }
  if (!b[4] && Math.random() < 0.8) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  if (corners.length && Math.random() < 0.6) return pickOne(corners);
  return pickOne(empty);
}

const TTT = {
  start(el, done) {
    const b = Array(9).fill(null);
    let fresh = -1; // the mark just placed: only it animates
    let pigLast = -1; // the pig's latest mark, outlined
    let turn = 'X';
    let over = false;

    const render = (msg) => {
      el.innerHTML = `<div class="ttt">
        <div class="g-msg">${msg}</div>
        <div class="ttt-board">${b.map((v, i) => `<button class="ttt-cell ${v ? 'filled' : ''} ${i === fresh ? 'fresh' : ''} ${i === pigLast ? 'last' : ''}"
          data-g="${i}">${v === 'X' ? '❌' : v === 'O' ? '🐷' : ''}</button>`).join('')}</div>
      </div>`;
    };

    const finish = (w) => {
      over = true;
      const result = w === 'X' ? 'win' : w === 'O' ? 'lose' : 'draw';
      render({ win: '🎉', lose: '🐷', draw: '🤝' }[result]);
      setTimeout(() => {
        el.innerHTML = resultView('ttt', result);
        done(result);
      }, 1200);
    };

    el.onclick = (e) => {
      const cell = e.target.closest('[data-g]');
      if (!cell || over || turn !== 'X') return;
      const i = +cell.dataset.g;
      if (b[i]) return;
      b[i] = 'X';
      fresh = i;
      let w = tttWinner(b);
      if (w) return finish(w);
      turn = 'O';
      render('🐷 🤔');
      setTimeout(() => {
        pigLast = tttPigMove(b);
        b[pigLast] = 'O';
        fresh = pigLast;
        turn = 'X';
        w = tttWinner(b);
        if (w) return finish(w);
        render('轮到你');
      }, 500);
    };
    render('你先');
  },
};

// ---------- penalty shootout ----------

const DIRS = [
  { id: 0, name: '左' },
  { id: 1, name: '中' },
  { id: 2, name: '右' },
];

const PENALTY = {
  start(el, done) {
    const kicks = { you: [], pig: [] };
    let phase = 'shoot'; // player shoots, then player keeps
    let busy = false;
    let msg = '射门！';

    const goals = (side) => kicks[side].filter(Boolean).length;
    const dots = (side) => {
      const n = Math.max(5, kicks.you.length, kicks.pig.length);
      return Array.from({ length: n }, (_, i) => {
        const k = kicks[side][i];
        return `<i class="${k === undefined ? '' : k ? 'goal' : 'miss'}">${k === undefined ? '' : k ? '⚽' : '✕'}</i>`;
      }).join('');
    };

    // Decided early if someone can no longer catch up within the first five kicks,
    // then sudden death, giving up as a draw after ten rounds
    const decided = () => {
      const a = kicks.you.length;
      const b = kicks.pig.length;
      const ya = goals('you');
      const pa = goals('pig');
      if (a <= 5 && b <= 5) {
        if (ya > pa + (5 - b)) return 'win';
        if (pa > ya + (5 - a)) return 'lose';
        if (a === 5 && b === 5 && ya !== pa) return ya > pa ? 'win' : 'lose';
        return null;
      }
      if (a === b && ya !== pa) return ya > pa ? 'win' : 'lose';
      if (a === b && a >= 10) return 'draw';
      return null;
    };

    const render = (anim) => {
      const shooting = phase === 'shoot';
      el.innerHTML = `<div class="pen">
        <div class="pen-score">
          <div><span>你</span><div class="pen-dots">${dots('you')}</div><b>${goals('you')}</b></div>
          <div><span>🐷</span><div class="pen-dots">${dots('pig')}</div><b>${goals('pig')}</b></div>
        </div>
        <div class="pen-field">
          <div class="pen-goal"><div class="pen-net"></div></div>
          <div class="pen-keeper ${anim ? `dive-${anim.keeper}` : ''}">${shooting ? '🐷' : '🧤'}</div>
          <div class="pen-ball ${anim ? `to-${anim.ball}` : ''}">⚽</div>
        </div>
        <div class="g-msg">${msg}</div>
        <div class="g-choices">${DIRS.map((d) => `<button class="g-choice small" data-g="${d.id}" ${busy ? 'disabled' : ''}>
          ${['⬅️', '⬆️', '➡️'][d.id]}<small>${d.name}</small></button>`).join('')}</div>
      </div>`;
    };

    el.onclick = (e) => {
      const btn = e.target.closest('[data-g]');
      if (!btn || busy) return;
      const mine = +btn.dataset.g;
      const theirs = pickOne(DIRS).id;
      busy = true;
      let scored;
      if (phase === 'shoot') {
        scored = mine !== theirs;
        kicks.you.push(scored);
        msg = scored ? '球进啦！⚽' : '被扑出！';
        render({ ball: mine, keeper: theirs });
      } else {
        scored = mine !== theirs;
        kicks.pig.push(scored);
        msg = scored ? '🐷 进球' : '扑住了！🧤';
        render({ ball: theirs, keeper: mine });
      }
      setTimeout(() => {
        const result = decided();
        if (result) {
          el.innerHTML = resultView('penalty', result, `${goals('you')} : ${goals('pig')}`);
          done(result);
          return;
        }
        phase = phase === 'shoot' ? 'keep' : 'shoot';
        msg = phase === 'shoot' ? '射门！' : '扑救！';
        busy = false;
        render();
      }, 1300);
    };
    render();
  },
};

// ---------- chess ----------

const ChessRules = (() => {
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const other = (color) => (color === 'w' ? 'b' : 'w');

  // Board index 0 is a8 (top-left from white's view), 63 is h1
  function initial() {
    const back = 'rnbqkbnr';
    const b = Array(64).fill(null);
    for (let c = 0; c < 8; c++) {
      b[c] = back[c];
      b[8 + c] = 'p';
      b[48 + c] = 'P';
      b[56 + c] = back[c].toUpperCase();
    }
    return { b, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, plies: 0 };
  }

  function attacked(b, sq, by) {
    const r = sq >> 3;
    const c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    const pawn = by === 'w' ? 'P' : 'p';
    for (const dc of [-1, 1]) if (on(pr, c + dc) && b[pr * 8 + c + dc] === pawn) return true;
    for (const [list, kind] of [[KN, 'n'], [KG, 'k']]) {
      for (const [dr, dc] of list) {
        const rr = r + dr;
        const cc = c + dc;
        if (!on(rr, cc)) continue;
        const p = b[rr * 8 + cc];
        if (p && colorOf(p) === by && p.toLowerCase() === kind) return true;
      }
    }
    for (const [dirs, kinds] of [[DIAG, 'bq'], [ORTH, 'rq']]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (on(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) {
            if (colorOf(p) === by && kinds.includes(p.toLowerCase())) return true;
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
    return false;
  }

  const inCheck = (st, color = st.turn) => attacked(st.b, st.b.indexOf(color === 'w' ? 'K' : 'k'), other(color));

  function pseudoMoves(st) {
    const { b, turn } = st;
    const moves = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== turn) continue;
      const r = i >> 3;
      const c = i & 7;
      const t = p.toLowerCase();
      const add = (to, extra) => moves.push({ from: i, to, ...extra });

      if (t === 'p') {
        const dir = turn === 'w' ? -1 : 1;
        const last = turn === 'w' ? 0 : 7;
        const r1 = r + dir;
        if (on(r1, c) && !b[r1 * 8 + c]) {
          add(r1 * 8 + c, { promo: r1 === last });
          const r2 = r + 2 * dir;
          if (r === (turn === 'w' ? 6 : 1) && !b[r2 * 8 + c]) add(r2 * 8 + c, { double: true });
        }
        for (const dc of [-1, 1]) {
          if (!on(r1, c + dc)) continue;
          const to = r1 * 8 + c + dc;
          if (b[to] && colorOf(b[to]) !== turn) add(to, { promo: r1 === last });
          else if (to === st.ep) add(to, { ep: true });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of t === 'n' ? KN : KG) {
          if (!on(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + c + dc;
          if (!b[to] || colorOf(b[to]) !== turn) add(to);
        }
      } else {
        const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : [...DIAG, ...ORTH];
        for (const [dr, dc] of dirs) {
          let rr = r + dr;
          let cc = c + dc;
          while (on(rr, cc)) {
            const to = rr * 8 + cc;
            if (b[to]) {
              if (colorOf(b[to]) !== turn) add(to);
              break;
            }
            add(to);
            rr += dr;
            cc += dc;
          }
        }
      }
    }

    // castling: king and rook unmoved, squares between empty, king not passing through check
    const opp = other(turn);
    const sides = turn === 'w'
      ? [['K', 60, 62, 63, [61, 62], [60, 61, 62]], ['Q', 60, 58, 56, [57, 58, 59], [60, 59, 58]]]
      : [['k', 4, 6, 7, [5, 6], [4, 5, 6]], ['q', 4, 2, 0, [1, 2, 3], [4, 3, 2]]];
    for (const [flag, king, to, rook, empty, safe] of sides) {
      if (!st.castle[flag] || b[king] !== (turn === 'w' ? 'K' : 'k')) continue;
      if (b[rook] !== (turn === 'w' ? 'R' : 'r')) continue;
      if (empty.some((sq) => b[sq])) continue;
      if (safe.some((sq) => attacked(b, sq, opp))) continue;
      moves.push({ from: king, to, castle: flag });
    }
    return moves;
  }

  function makeMove(st, m) {
    const b = st.b.slice();
    const p = b[m.from];
    const castle = { ...st.castle };
    b[m.to] = m.promo ? (st.turn === 'w' ? 'Q' : 'q') : p;
    b[m.from] = null;
    if (m.ep) b[m.to + (st.turn === 'w' ? 8 : -8)] = null;
    if (m.castle) {
      const [rf, rt] = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] }[m.castle];
      b[rt] = b[rf];
      b[rf] = null;
    }
    if (p === 'K') castle.K = castle.Q = false;
    if (p === 'k') castle.k = castle.q = false;
    for (const [sq, flag] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.from === sq || m.to === sq) castle[flag] = false;
    return { b, turn: other(st.turn), castle, ep: m.double ? (m.from + m.to) / 2 : -1, plies: st.plies + 1 };
  }

  const legalMoves = (st) => pseudoMoves(st).filter((m) => !inCheck(makeMove(st, m), st.turn));

  // Material plus a small bonus for central knights, bishops and pawns, from the side to move
  function evaluate(st) {
    let v = 0;
    st.b.forEach((p, i) => {
      if (!p) return;
      const t = p.toLowerCase();
      const r = i >> 3;
      const c = i & 7;
      let score = VALUE[t];
      if (t === 'n' || t === 'b' || t === 'p') score += (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5))) * 6;
      if (t === 'p') score += (colorOf(p) === 'w' ? 6 - r : r - 1) * 4;
      v += colorOf(p) === 'w' ? score : -score;
    });
    return st.turn === 'w' ? v : -v;
  }

  function search(st, depth, alpha, beta) {
    const moves = legalMoves(st);
    if (!moves.length) return inCheck(st) ? -100000 : 0;
    if (depth === 0) return evaluate(st);
    moves.sort((a, b) => (st.b[b.to] ? 1 : 0) - (st.b[a.to] ? 1 : 0));
    let best = -Infinity;
    for (const m of moves) {
      const v = -search(makeMove(st, m), depth - 1, -beta, -alpha);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Three-ply lookahead with a little randomness: a fair but beatable opponent for a pet
  function bestMove(st) {
    let best = null;
    let bestV = -Infinity;
    for (const m of legalMoves(st)) {
      const v = -search(makeMove(st, m), 2, -Infinity, -bestV + 20) + Math.random() * 20;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best;
  }

  // 'checkmate' | 'stalemate' | 'draw' | null
  function status(st) {
    if (!legalMoves(st).length) return inCheck(st) ? 'checkmate' : 'stalemate';
    if (st.b.filter(Boolean).length === 2 || st.plies >= 200) return 'draw';
    return null;
  }

  return { initial, legalMoves, makeMove, bestMove, inCheck, status };
})();

const CHESS_GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

const CHESS = {
  start(el, done) {
    let st = ChessRules.initial();
    let sel = -1;
    let targets = [];
    let lastMove = null;
    let over = false;
    let msg = '你执白';

    const render = () => {
      const cells = st.b.map((p, i) => {
        const dark = ((i >> 3) + (i & 7)) % 2 === 1;
        const cls = [
          'sq', dark ? 'dark' : 'light',
          i === sel ? 'sel' : '',
          targets.some((m) => m.to === i) ? (p ? 'cap' : 'dot') : '',
          lastMove && (lastMove.from === i || lastMove.to === i) ? 'last' : '',
        ].join(' ');
        const piece = p ? `<span class="pc ${p === p.toUpperCase() ? 'pw' : 'pb'}">${CHESS_GLYPH[p.toLowerCase()]}&#xFE0E;</span>` : '';
        return `<button class="${cls}" data-g="${i}">${piece}</button>`;
      }).join('');
      el.innerHTML = `<div class="chess">
        <div class="chess-board">${cells}</div>
        <div class="chess-side">
          <div class="g-msg">${msg}</div>
          ${over ? '' : '<button class="btn ghost" data-g="resign">认输</button>'}
        </div>
      </div>`;
    };

    const end = (result, text) => {
      over = true;
      msg = text;
      render();
      setTimeout(() => {
        el.innerHTML = resultView('chess', result, text);
        done(result);
      }, 1500);
    };

    // Returns true if the game ended
    const checkEnd = () => {
      const s = ChessRules.status(st);
      if (!s) return false;
      if (s === 'checkmate') end(st.turn === 'b' ? 'win' : 'lose', '将死！');
      else end('draw', s === 'stalemate' ? '逼和' : '和棋');
      return true;
    };

    const pigTurn = () => {
      msg = '🐷 🤔';
      render();
      setTimeout(() => {
        const m = ChessRules.bestMove(st);
        st = ChessRules.makeMove(st, m);
        lastMove = m;
        if (checkEnd()) return;
        msg = ChessRules.inCheck(st) ? '将军！' : '轮到你';
        render();
      }, 350);
    };

    el.onclick = (e) => {
      const btn = e.target.closest('[data-g]');
      if (!btn || over || st.turn !== 'w') return;
      if (btn.dataset.g === 'resign') return end('lose', '认输');
      const i = +btn.dataset.g;
      const move = targets.find((m) => m.to === i);
      if (move) {
        st = ChessRules.makeMove(st, move);
        lastMove = move;
        sel = -1;
        targets = [];
        if (checkEnd()) return;
        pigTurn();
        return;
      }
      const p = st.b[i];
      if (p && p === p.toUpperCase()) {
        sel = i;
        targets = ChessRules.legalMoves(st).filter((m) => m.from === i);
      } else {
        sel = -1;
        targets = [];
      }
      render();
    };
    render();
  },
};

// ---------- banqi (hidden pieces) ----------

// Sides: 'p' = player (pink), 'b' = pig (blue). Board index = row * 6 + col.
const BanqiRules = (() => {
  const N = 6;
  const RANKS = [
    { rank: 1, name: '刺客', icon: '🗡️', count: 6 },
    { rank: 2, name: '士兵', icon: '🛡️', count: 4 },
    { rank: 3, name: '骑士', icon: '🐎', count: 4 },
    { rank: 4, name: '将军', icon: '⚔️', count: 2 },
    { rank: 5, name: '元帅', icon: '🎖️', count: 1 },
    { rank: 6, name: '国王', icon: '👑', count: 1 },
  ];
  const QUIET_LIMIT = 30;
  // AI piece values: the assassin is worth a bit extra since it threatens the king
  const VALUE = { 1: 3, 2: 2, 3: 3.5, 4: 5, 5: 7, 6: 9 };
  const other = (s) => (s === 'p' ? 'b' : 'p');

  const neighbors = (i) => {
    const r = Math.floor(i / N);
    const c = i % N;
    const out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
  };

  function initial(rng = Math.random) {
    const b = [];
    for (const side of ['p', 'b']) for (const { rank, count } of RANKS) for (let k = 0; k < count; k++) b.push({ side, rank, up: false });
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return { b, turn: 'p', quiet: 0, plies: 0, back: {} };
  }

  // Mover wins ties; the assassin takes the king, and the king can never take the assassin
  const canCapture = (a, t) => {
    if (a.rank === 1 && t.rank === 6) return true;
    if (a.rank === 6 && t.rank === 1) return false;
    return a.rank >= t.rank;
  };

  function moves(st, side = st.turn) {
    const out = [];
    st.b.forEach((p, i) => {
      if (!p) return;
      if (!p.up) {
        out.push({ flip: i });
        return;
      }
      if (p.side !== side) return;
      for (const to of neighbors(i)) {
        const t = st.b[to];
        if (!t) out.push({ from: i, to });
        else if (t.up && t.side !== side && canCapture(p, t)) out.push({ from: i, to, cap: true });
      }
    });
    return out;
  }

  function apply(st, m) {
    const b = st.b.slice();
    let captured = null;
    if (m.flip !== undefined) {
      b[m.flip] = { ...b[m.flip], up: true };
    } else {
      captured = b[m.to];
      b[m.to] = b[m.from];
      b[m.from] = null;
    }
    // back: each side's last step, so the AI can avoid shuffling to and fro
    const back = { ...st.back, [st.turn]: m.flip === undefined ? m : null };
    return { b, turn: other(st.turn), quiet: captured ? 0 : st.quiet + 1, plies: st.plies + 1, captured, back };
  }

  const count = (st, side) => st.b.filter((p) => p && p.side === side).length;

  // Winner side ('p' | 'b'), 'draw', or null while the game goes on
  function status(st) {
    for (const s of ['p', 'b']) if (!count(st, s)) return other(s);
    if (!moves(st).length) return other(st.turn);
    if (st.quiet >= QUIET_LIMIT) return 'draw';
    return null;
  }

  // ---- AI: only face-up pieces and the unrevealed rank counts are used ----

  // Ranks still face down for a side: full set minus face-up and captured (public) pieces
  function hiddenRanks(st, side, dead) {
    const pool = {};
    for (const { rank, count: n } of RANKS) pool[rank] = n;
    for (const p of st.b) if (p && p.up && p.side === side) pool[p.rank]--;
    for (const p of dead) if (p.side === side) pool[p.rank]--;
    return pool;
  }

  const attackers = (b, i, side) =>
    neighbors(i).filter((j) => b[j] && b[j].up && b[j].side !== side && canCapture(b[j], b[i]));

  // Best net gain the enemy of `side` can get with one capture on board b (a one-step exchange)
  function danger(b, side) {
    let worst = 0;
    b.forEach((p, i) => {
      if (!p || !p.up || p.side !== side) return;
      for (const j of attackers(b, i, side)) {
        const after = b.slice();
        after[i] = after[j];
        after[j] = null;
        const recapture = attackers(after, i, other(side)).length > 0;
        worst = Math.max(worst, VALUE[p.rank] - (recapture ? VALUE[b[j].rank] : 0));
      }
    });
    return worst;
  }

  // Small bonus for pieces we safely threaten, plus pulling toward prey when the board opens up
  function pressure(b, side) {
    let v = 0;
    b.forEach((p, i) => {
      if (!p || !p.up || p.side !== side) return;
      let near = 99;
      b.forEach((t, j) => {
        if (!t || !t.up || t.side === side || !canCapture(p, t)) return;
        const d = Math.abs(Math.floor(i / N) - Math.floor(j / N)) + Math.abs((i % N) - (j % N));
        near = Math.min(near, d);
        if (d === 1 && !canCapture(t, p)) v = Math.max(v, VALUE[t.rank] * 0.25);
      });
      if (near < 99) v -= near * 0.06;
    });
    return v;
  }

  function scoreMove(st, m, dead, rng) {
    const side = st.turn;
    const b = st.b;
    if (m.flip === undefined) {
      const after = b.slice();
      const gain = m.cap ? VALUE[b[m.to].rank] : 0;
      after[m.to] = after[m.from];
      after[m.from] = null;
      const prev = st.back && st.back[side];
      const undo = !m.cap && prev && prev.from === m.to && prev.to === m.from ? 0.4 : 0;
      return gain - danger(after, side) + pressure(after, side) - undo + rng() * 0.3;
    }
    // Flip: average over what the hidden piece could be, judged by its face-up neighbours
    const mine = hiddenRanks(st, side, dead);
    const theirs = hiddenRanks(st, other(side), dead);
    const total = Object.values(mine).reduce((a, c) => a + c, 0) + Object.values(theirs).reduce((a, c) => a + c, 0);
    let exp = 0;
    for (const [pool, s] of [[mine, side], [theirs, other(side)]]) {
      for (const r of Object.keys(pool)) {
        if (!pool[r]) continue;
        const prob = pool[r] / total;
        const piece = { side: s, rank: +r, up: true };
        const after = b.slice();
        after[m.flip] = piece;
        // enemy moves next, so judge the board from that point
        exp += prob * (pressure(after, side) * 0.5 - danger(after, side));
      }
    }
    // the longer nobody captures, the more a flip is worth to break the stalemate
    return exp + 0.15 + st.quiet * 0.03 + rng() * 0.6;
  }

  // dead: list of captured pieces (public knowledge)
  function bestMove(st, dead = [], rng = Math.random) {
    let best = null;
    let bestV = -Infinity;
    for (const m of moves(st)) {
      const v = scoreMove(st, m, dead, rng);
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best;
  }

  return { N, RANKS, QUIET_LIMIT, initial, canCapture, moves, apply, count, status, bestMove };
})();

const BANQI_ICON = Object.fromEntries(BanqiRules.RANKS.map((r) => [r.rank, r.icon]));

const BANQI = {
  start(el, done) {
    let st = BanqiRules.initial();
    const dead = [];
    let sel = -1;
    let targets = [];
    let last = []; // the latest move: [from, to] or [flipped cell]
    let fresh = -1; // cell that just changed; only it animates, and only on the next render
    let over = false;

    const render = () => {
      const cells = st.b.map((p, i) => {
        const t = targets.find((m) => m.to === i);
        const cls = [
          'bq-cell',
          !p ? 'empty' : p.up ? `up ${p.side === 'p' ? 'mine' : 'pig'}` : 'back',
          i === sel ? 'sel' : '',
          t ? (t.cap ? 'cap' : 'dot') : '',
          i === last[last.length - 1] ? 'last' : '',
          last.length === 2 && i === last[0] ? 'from' : '',
          i === fresh ? 'fresh' : '',
        ].join(' ');
        const face = p && p.up ? `<span>${BANQI_ICON[p.rank]}</span><small>${p.rank}</small>` : '';
        return `<button class="${cls}" data-g="${i}">${face}</button>`;
      }).join('');
      // pieces of each rank still on the board per side (public: it's 18 minus what was captured)
      const left = (side, rank) => st.b.filter((p) => p && p.side === side && p.rank === rank).length;
      const num = (side, rank) => {
        const n = left(side, rank);
        return `<b class="${side === 'p' ? 'mine' : 'pig'} ${n ? '' : 'zero'}">${n}</b>`;
      };
      const tally = [...BanqiRules.RANKS].reverse().map((r) => `<div class="bq-row" title="${r.name}">
        <span>${r.icon}</span>${num('p', r.rank)}${num('b', r.rank)}</div>`).join('');
      el.innerHTML = `<div class="bq">
        <div class="bq-board">${cells}</div>
        <div class="chess-side">
          <div class="bq-tally">
            <div class="bq-row head"><span></span>
              <b class="mine ${!over && st.turn === 'p' ? 'turn' : ''}">你</b><b class="pig ${!over && st.turn === 'b' ? 'turn' : ''}">🐷</b></div>
            ${tally}
            <div class="bq-row total"><span>Σ</span><b class="mine">${BanqiRules.count(st, 'p')}</b><b class="pig">${BanqiRules.count(st, 'b')}</b></div>
          </div>
          <div class="bq-quiet">⏳ ${BanqiRules.QUIET_LIMIT - st.quiet}</div>
          ${over ? '' : '<button class="btn ghost" data-g="resign">认输</button>'}
        </div>
      </div>`;
      fresh = -1;
    };

    const end = (result, text) => {
      over = true;
      sel = -1;
      targets = [];
      render();
      setTimeout(() => {
        el.innerHTML = resultView('banqi', result, text);
        done(result);
      }, 1500);
    };

    const checkEnd = () => {
      const s = BanqiRules.status(st);
      if (!s) return false;
      const score = `${BanqiRules.count(st, 'p')} : ${BanqiRules.count(st, 'b')}`;
      if (s === 'draw') end('draw', `⏳ ${score}`);
      else end(s === 'p' ? 'win' : 'lose', score);
      return true;
    };

    // Applies a move; the board shows what happened (last move marks, the changed cell animates)
    const play = (m) => {
      const flip = m.flip !== undefined;
      st = BanqiRules.apply(st, m);
      last = flip ? [m.flip] : [m.from, m.to];
      fresh = flip ? m.flip : m.to;
      if (st.captured) dead.push(st.captured);
    };

    const pigTurn = () => {
      render();
      setTimeout(() => {
        play(BanqiRules.bestMove(st, dead));
        if (checkEnd()) return;
        render();
      }, 400);
    };

    el.onclick = (e) => {
      const btn = e.target.closest('[data-g]');
      if (!btn || over || st.turn !== 'p') return;
      if (btn.dataset.g === 'resign') return end('lose', '认输');
      const i = +btn.dataset.g;
      const p = st.b[i];
      const move = targets.find((m) => m.to === i);
      if (move || (p && !p.up)) {
        sel = -1;
        targets = [];
        play(move || { flip: i });
        if (checkEnd()) return;
        pigTurn();
        return;
      }
      if (p && p.side === 'p' && i !== sel) {
        sel = i;
        targets = BanqiRules.moves(st).filter((m) => m.from === i);
      } else {
        sel = -1;
        targets = [];
      }
      render();
    };
    render();
  },
};

const MiniGames = { rps: RPS, ttt: TTT, penalty: PENALTY, chess: CHESS, banqi: BANQI };
