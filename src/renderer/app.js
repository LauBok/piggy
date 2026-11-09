// Wires input, the game clock and the views together. The pet window owns the game state;
// the home window only displays snapshots of it and sends actions back here.

const LINES = {
  hunger: ['肚子咕咕叫了…', '好饿呀，想吃东西'],
  clean: ['身上脏脏的，想洗澡', '我是不是有点臭臭的…'],
  energy: ['好累…想睡觉', '眼皮在打架…'],
  health: ['我不舒服…', '头好晕…想吃药'],
  mood: ['陪我玩嘛~', '好无聊呀'],
  happy: ['哼哼~', '今天也很开心！', '最喜欢你了！', '(｡･ω･｡)', '要摸摸头！'],
  lifted: ['哇啊！', '放我下来~', '飞起来啦！'],
  sulk: ['哼！', '不理你了！', '还戳！', '哼哼！'],
};
// little symbols that pop up now and then while busy
const BUSY_FX = { study: ['💡', '✏️', '❓', '📝', '💡'], work: ['💦', '💪', '💦', '😤'], kinder: ['🎵', '⭐', '😄', '🖍️'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// The most urgent stat the pig needs help with, or null
function needStat() {
  const s = Game.s;
  if (s.health < 40) return 'health';
  if (s.hunger < 30) return 'hunger';
  if (s.energy < 20) return 'energy';
  if (s.clean < 30) return 'clean';
  if (s.mood < 30) return 'mood';
  return null;
}

function needLine() {
  const k = needStat();
  return k ? pick(LINES[k]) : null;
}

const App = {
  lastHover: 0,
  holdUntil: 0,
  clicks: [],
  angryUntil: 0,
  lastPetMood: 0,
  nextChat: Date.now() + 60000,
  nextIdleCheck: 0,
  lastTickAt: Date.now(),

  async start() {
    this.wrap = document.getElementById('petWrap');
    PetView.init(this.wrap, document.getElementById('pet'));
    UI.init();
    await Game.load();
    const done = Game.checkActivity();
    Game.takeLevelUp(); // growth while closed is shown by the new form, no need to announce
    const fedWhileAway = Game.takeSelfCare();
    await Motion.init();
    if (Game.s.mini) await this.setMini(true);
    this.bindInput();
    window.pet.onAct((action, id) => this.act(action, id));
    window.pet.onStateRequest(() => this.push());
    window.pet.onUpdate((u) => {
      PetView.flash('happy', 2000);
      let msg = u.ready ? `新版本 ${u.version} 准备好啦，托盘里点重启~` : `有新版本 ${u.version}，托盘里可以下载~`;
      if (u.content) msg = `新内容 ${u.version} 下好啦，托盘里点重新加载~`;
      UI.say(msg, 8000);
    });
    PetView.update(Game);
    UI.refresh();
    Game.save();

    setInterval(() => this.tick(), 1000);
    setInterval(() => Game.save(), 15000);
    window.addEventListener('beforeunload', () => Game.save());

    if (done) this.report(done);
    else if (fedWhileAway) this.report(fedWhileAway);
    else UI.say(Game.isNew ? '你好呀！右键点我去猪猪城~' : `${Game.s.name}回来啦~`);
  },

  get hovered() {
    return Date.now() - this.lastHover < 1500;
  },

  canWander() {
    return !Game.busy && !Game.sleeping && !this.hovered && !UI.qbOpen && Game.s.health >= 20 && Date.now() > this.holdUntil;
  },

  hold(ms) {
    this.holdUntil = Date.now() + ms;
  },

  pose(cls, ms) {
    PetView.setPose(cls, true);
    setTimeout(() => PetView.setPose(cls, false), ms);
  },

  // Send the current state to the home window, if it's open
  push() {
    window.pet.pushState({
      s: Game.s,
      busy: Game.busy,
      sleeping: Game.sleeping,
      label: Game.activityLabel(),
      progress: Game.progress(),
      remain: Game.remaining(),
      pigs: Game.pigs,
    });
  },

  // Show an action's outcome and refresh everything that depends on state
  report(res) {
    if (!res) return;
    if (res.ok === false) PetView.flash('sad', 1200);
    if (res.msg) UI.say(res.msg);
    // what a neighbour said goes along too, to show over their head in town
    if (res.msg || res.talk) window.pet.toast({ msg: res.msg || '', ok: res.ok !== false, fx: res.fx, talk: res.talk });
    if (res.fx) PetView.fx(res.fx);
    PetView.update(Game);
    UI.refresh();
    Game.save();
    this.push();
  },

  act(action, id) {
    let res;
    switch (action) {
      case 'order':
        res = Game.order(id);
        break;
      case 'use': {
        const it = ITEM_BY_ID[id];
        res = Game.use(id);
        if (!res.ok) break;
        this.hold(2500);
        if (it.cat === 'toy') {
          PetView.flash('happy', 2000);
          PetView.showProp(it.icon, 'prop-toy', 2200);
          this.pose('jump', 1400);
        } else if (it.cat === 'hygiene') {
          PetView.flash('happy', 1600);
          PetView.showProp(it.icon, 'prop-wash', 1600);
        } else {
          PetView.flash('eat', 1600);
          PetView.showProp(it.icon, 'prop-eat', 1600);
          this.pose('eating', 1600);
        }
        break;
      }
      case 'help':
        res = Game.help(id);
        break;
      case 'hobby':
        res = Game.startHobby(id);
        break;
      case 'kinder':
        res = Game.startKinder(id);
        break;
      case 'minigame': {
        const [name, result] = String(id).split(':');
        res = Game.minigame(name, result);
        if (!res.ok) break;
        PetView.flash(result === 'win' ? 'sad' : 'happy', 1800);
        if (result !== 'win') this.pose('jump', 1400);
        this.hold(2500);
        break;
      }
      case 'buy':
        res = Game.buy(id);
        break;
      case 'plant': {
        const [plot, seed] = String(id).split(':');
        res = Game.plant(Number(plot), seed);
        break;
      }
      case 'invest':
        res = Game.invest(id);
        break;
      case 'deposit':
        res = Game.deposit(id);
        break;
      case 'withdraw':
        res = Game.withdraw(id);
        break;
      case 'restyle':
        res = Game.restyle(id);
        break;
      case 'harvest':
        res = Game.harvest();
        break;
      case 'meet':
        res = Game.meet(id);
        break;
      case 'chat':
        res = Game.chat(id);
        break;
      case 'rps':
        res = Game.rps(id);
        break;
      case 'claimFestival':
        res = Game.claimFestival();
        break;
      case 'answer':
        res = Game.answer(id);
        break;
      case 'remember':
        res = Game.remember(id);
        break;
      case 'gift':
        res = Game.gift(id);
        break;
      case 'together':
        res = Game.together(id);
        break;
      case 'sell':
        res = Game.sell(id);
        break;
      case 'tea':
        res = Game.tea(id);
        break;
      case 'snapPhoto':
        res = Game.snapPhoto(id);
        break;
      case 'fish':
        res = Game.fish(id);
        if (res.ok) PetView.flash('happy', 1500);
        break;
      case 'farewell':
        res = Game.farewell(id);
        break;
      case 'duel': {
        res = Game.duel(id);
        if (!res.ok) break;
        PetView.flash(res.result === 'win' ? 'sad' : 'happy', 1800);
        if (res.result !== 'win') this.pose('jump', 1400);
        this.hold(2500);
        break;
      }
      case 'study':
        res = Game.startStudy(id);
        break;
      case 'work':
        res = Game.startWork(id);
        break;
      case 'bath':
        res = Game.startBath();
        break;
      case 'sleep':
        res = Game.sleep();
        break;
      case 'wake':
        res = Game.wake(false);
        break;
      case 'cancel':
        res = Game.cancel();
        break;
      case 'follow':
        Game.s.follow = !Game.s.follow;
        res = { msg: Game.s.follow ? '我跟着你走~' : '我自己去逛逛' };
        break;
      case 'rename': {
        const name = String(id || '').trim().slice(0, 8);
        if (!name) return;
        Game.s.name = name;
        res = { msg: `以后叫我「${name}」吧！` };
        break;
      }
      case 'rejuvenate':
      case 'switchPig':
        res = action === 'rejuvenate' ? Game.rejuvenate() : Game.switchPig(id);
        if (res.ok) {
          Game.loadPigs().then(() => this.push());
          PetView.flash('happy', 2000);
        }
        break;
      case 'reset':
        Game.reset();
        res = { msg: '一只新的小猪诞生啦！' };
        break;
      case 'mini':
        UI.closeQuick();
        this.setMini(!Game.s.mini);
        return;
      case 'quit':
        Game.save();
        window.pet.quit();
        return;
    }
    this.report(res);
  },

  // Sleep while nobody is at the computer, wake up when they're back. Something he was doing gets
  // finished first, and then he's free a while (AWAY_MINUTES) before he goes home to bed.
  onIdle(sec) {
    const away = sec >= AWAY_MINUTES * 60;
    const a = Game.s.activity;
    const freeLong = Date.now() - (this.freeAt || 0) >= AWAY_MINUTES * 60000;
    if (away && !a && freeLong) this.report(Game.sleep(true));
    else if (!away && a?.type === 'sleep' && a.auto) {
      Game.wake(false);
      PetView.flash('happy', 2000);
      this.pose('jump', 1400);
      this.report({ msg: '你回来啦！' });
    }
  },

  onPetClick() {
    if (Game.sleeping) {
      PetView.flash('angry', 1500);
      this.report(Game.wake(true));
      return;
    }
    if (Game.busy) {
      UI.say(`${Game.activityLabel()}，还要 ${fmtTime(Game.remaining())}~`);
      return;
    }
    const now = Date.now();
    // still sulking: more poking keeps it angry (and a bit longer), never happy
    if (now < this.angryUntil) {
      this.angryUntil = Math.min(this.angryUntil + 3000, now + 15000);
      PetView.flash('angry', this.angryUntil - now);
      PetView.setFacing(-1);
      UI.say(pick(LINES.sulk), 1500);
      return;
    }
    this.clicks = this.clicks.filter((t) => now - t < 3000);
    this.clicks.push(now);
    if (this.clicks.length >= 6) {
      this.clicks = [];
      this.angryUntil = now + 10000;
      Game.apply({ mood: -3 });
      PetView.flash('angry', 10000);
      this.report({ msg: '别戳啦！哼！' });
      return;
    }
    PetView.flash('love', 1200);
    PetView.fx('❤️');
    this.pose('hop', 450);
    this.hold(3000);
    // petting cheers it up a little, now and then: toys and hobbies do the real cheering up
    if (now - this.lastPetMood > PET_MOOD.everyMs && Game.s.mood < PET_MOOD.upTo) {
      this.lastPetMood = now;
      Game.apply({ mood: PET_MOOD.mood });
    }
    if (Math.random() < 0.5) UI.say(needLine() || pick(LINES.happy));
    UI.refresh();
  },

  onDragStart() {
    if (Game.sleeping) this.report(Game.wake(true));
    document.body.classList.add('lifted');
    PetView.setPose('dragged', true);
    PetView.setPose('airborne', true);
    PetView.flash('surprised', 60000);
    UI.say(pick(LINES.lifted), 2000);
  },

  async onDragEnd() {
    const pos = await window.pet.dragEnd();
    document.body.classList.remove('lifted');
    PetView.setPose('dragged', false);
    PetView.flash('surprised', 500);
    if (Game.s.mini) {
      PetView.setPose('airborne', false);
      this.setPeek(await Motion.dropMini(pos));
      return;
    }
    Motion.drop(pos);
    if (!Motion.falling) PetView.setPose('airborne', false);
  },

  // Mini mode: just a small face that stays put and keeps quiet (a red dot when it needs you)
  async setMini(on) {
    Game.s.mini = on;
    this.setPeek(null);
    document.body.classList.toggle('mini', on);
    PetView.setMini(on);
    const pos = await window.pet.setMini(on);
    await new Promise((r) => requestAnimationFrame(r)); // let the window size settle before measuring
    Motion.x = on ? pos.x : clamp(pos.x, Motion.minX, Motion.maxX);
    Motion.y = pos.y;
    Motion.place();
    if (!on) Motion.startFall();
    Game.save();
    this.push();
  },

  // Which screen edge the mini face is hiding behind, if any
  setPeek(edge) {
    for (const e of ['left', 'right', 'bottom']) document.body.classList.toggle(`peek-${e}`, e === edge);
  },

  onLand(height, jetted) {
    PetView.setPose('airborne', false);
    this.pose('land', 300);
    this.hold(1500);
    if (jetted) {
      PetView.flash('happy', 1500);
      UI.say('呼～安全着陆！');
    } else if (height > 250) {
      Game.apply({ mood: -2 });
      PetView.flash('dizzy', 1500);
      UI.say('哎哟，摔疼了！');
    }
  },

  bindInput() {
    const hit = document.getElementById('petHit');
    let press = null;

    hit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      hit.setPointerCapture(e.pointerId);
      press = { x: e.clientX, y: e.clientY, dragging: false };
    });
    hit.addEventListener('pointermove', (e) => {
      if (!press || press.dragging) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
      press.dragging = true;
      Motion.startDrag();
      window.pet.dragStart();
      this.onDragStart();
    });
    hit.addEventListener('pointerup', () => {
      if (!press) return;
      const wasDrag = press.dragging;
      press = null;
      if (wasDrag) this.onDragEnd();
      else this.onPetClick();
    });
    hit.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.pet.openHome('status');
    });
    hit.addEventListener('dblclick', () => Game.s.mini && this.setMini(false));

    // The window is mostly transparent: let clicks fall through to the desktop
    // except over the pet and the overview card (elements marked .hit)
    let ignoring = true;
    window.pet.ignoreMouse(true);
    document.addEventListener('mousemove', (e) => {
      const overHit = !!e.target.closest('.hit');
      if (overHit === ignoring) {
        ignoring = !overHit;
        window.pet.ignoreMouse(ignoring);
      }
      if (e.target.closest('#petWrap, #hud')) {
        this.lastHover = Date.now();
        document.body.classList.add('hover');
      }
    });
  },

  tick() {
    const now = Date.now();
    const minutes = (now - this.lastTickAt) / 60000;
    this.lastTickAt = now;
    // a long gap means the computer was asleep: treat it like time spent closed
    Game.tick(minutes, minutes > 2);

    const done = Game.checkActivity();
    if (done) {
      // free again: if nobody's at the computer he hangs about a while before going home to bed
      this.freeAt = now;
      this.report(done);
    }
    const fed = Game.takeSelfCare();
    if (fed) {
      PetView.flash('eat', 1600);
      this.pose('eating', 1600);
      this.report(fed);
    }
    if (now > this.nextIdleCheck) {
      this.nextIdleCheck = now + 30000;
      window.pet.idleSeconds().then((sec) => this.onIdle(sec));
    }
    const pocket = Game.takeAllowance();
    if (pocket) this.report(pocket);
    const interest = Game.takeInterest();
    if (interest) this.report(interest);
    const up = Game.takeLevelUp();
    if (up) {
      this.pose('jump', 1400);
      PetView.flash('happy', 2000);
      this.report(up);
    }

    const a = Game.s.activity;
    if (a && BUSY_FX[a.type] && Math.random() < 0.25) PetView.fx(pick(BUSY_FX[a.type]));

    if (!Game.busy && !Game.sleeping && Game.s.energy <= 0) {
      Game.sleep();
      this.report({ msg: '撑不住了…zzz' });
    }

    if (now > this.nextChat) {
      this.nextChat = now + rand(60000, 120000);
      const line = needLine();
      if (line && !Game.busy && !Game.sleeping) UI.say(line);
    }

    if (!this.hovered && !UI.qbOpen) document.body.classList.remove('hover');
    const need = needStat();
    document.body.classList.toggle('needy', !!need);
    this.needDot ||= document.getElementById('needDot');
    const needIcon = need ? STATS.find((st) => st.key === need).icon : '';
    if (this.needDot.textContent !== needIcon) this.needDot.textContent = needIcon;
    PetView.update(Game);
    UI.refresh();
    this.push();
  },
};

App.start();
