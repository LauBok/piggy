// Moves the whole window around the screen: wandering, following the cursor, falling after a drop.

const rand = (a, b) => a + Math.random() * (b - a);

// Falling: gentle gravity up to a top speed (px per frame).
const GRAVITY = 0.5;
const MAX_FALL = 14;
// Falls longer than JET_MIN_DROP (px): the pig panics on the way down, then fires its jets
// just early enough to brake smoothly (thrust ramps up over JET_RAMP frames to JET_DECEL)
// to HOVER_SPEED with HOVER_DIST left, and floats down the rest.
const JET_MIN_DROP = 280;
const JET_DECEL = 0.8;
const JET_RAMP = 8;
const HOVER_SPEED = 2;
const HOVER_DIST = 80;

const Motion = {
  x: 0,
  y: 0,
  area: null,
  walking: false,
  targetX: null,
  falling: false,
  dropY: 0,
  vy: 0,
  dragging: false,
  cursorX: null,
  nextDecision: Date.now() + 4000,
  lastFrame: performance.now(),

  async init() {
    const b = await window.pet.getBounds();
    this.x = b.x;
    this.y = b.y;
    this.area = await window.pet.workArea();
    setInterval(async () => {
      if (!this.dragging) this.area = await window.pet.workArea();
    }, 3000);
    setInterval(async () => {
      if (Game.s.follow) this.cursorX = (await window.pet.cursor()).x;
    }, 120);
    requestAnimationFrame((t) => this.frame(t));
  },

  // The window has a transparent margin around the pet, so let it hang a little off-screen
  get margin() {
    return (window.innerWidth - 120) / 2;
  },
  get groundY() {
    return this.area.y + this.area.height - window.innerHeight;
  },
  get minX() {
    return this.area.x - this.margin;
  },
  get maxX() {
    return this.area.x + this.area.width - window.innerWidth + this.margin;
  },

  place() {
    window.pet.setPos(this.x, this.y);
  },

  setWalking(on) {
    if (on === this.walking) return;
    this.walking = on;
    PetView.setPose('walking', on);
  },

  // Returns true once the target is reached
  walkToward(tx, speed) {
    const dx = tx - this.x;
    if (Math.abs(dx) <= speed) {
      this.x = tx;
      this.place();
      return true;
    }
    const dir = Math.sign(dx);
    PetView.setFacing(dir);
    this.x = clamp(this.x + dir * speed, this.minX, this.maxX);
    this.place();
    return false;
  },

  startDrag() {
    this.dragging = true;
    this.falling = false;
    this.targetX = null;
    this.setWalking(false);
  },

  drop(pos) {
    this.dragging = false;
    this.x = pos.x;
    this.y = Math.min(pos.y, this.groundY);
    this.startFall();
  },

  // Mini mode: stays where dropped, and hides half outside the screen when dropped at an edge
  // (left, right, or down on the taskbar) so only the eyes peek out. Returns the edge or null.
  async dropMini(pos) {
    this.dragging = false;
    const { bounds, workArea } = await window.pet.display();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const EDGE = 24;
    let { x, y } = pos;
    let peek = null;
    if (x <= bounds.x + EDGE) {
      x = bounds.x - w * 0.42;
      peek = 'left';
    } else if (x + w >= bounds.x + bounds.width - EDGE) {
      x = bounds.x + bounds.width - w * 0.58;
      peek = 'right';
    } else if (y + h >= workArea.y + workArea.height - 8) {
      y = bounds.y + bounds.height - h * 0.55;
      peek = 'bottom';
    }
    this.x = x;
    this.y = y;
    this.place();
    return peek;
  },

  startFall() {
    this.jetting = false;
    this.falling = this.y < this.groundY - 1;
    this.dropY = this.y;
    this.vy = 0;
    if (this.groundY - this.y > JET_MIN_DROP) {
      PetView.flash('surprised', 3000);
      UI.say('啊啊啊——！', 1500);
    }
    if (!this.falling) {
      this.y = this.groundY;
      this.place();
    }
  },

  frame(t) {
    // speeds below are in px per 60 Hz frame; scale so high-refresh screens don't walk faster
    const k = Math.min((t - this.lastFrame) / 16.67, 3);
    this.lastFrame = t;
    requestAnimationFrame((tt) => this.frame(tt));
    // mini mode stays exactly where it was put
    if (this.dragging || !this.area || Game.s.mini) return;

    if (this.falling) {
      const high = this.groundY - this.dropY > JET_MIN_DROP;
      const left = this.groundY - this.y;
      // distance needed to brake from this speed: ramp-up (about half thrust) + full braking + hover
      const brakeDist = (this.vy * JET_RAMP) / 2 + (this.vy * this.vy) / (2 * JET_DECEL) + HOVER_DIST;
      if (high && !this.jetting && left <= brakeDist) {
        this.jetting = true;
        this.jetT = 0;
        PetView.flash('angry', 1500); // gritted teeth, full thrust
      }
      if (this.jetting) {
        this.jetT += k;
        const thrust = JET_DECEL * Math.min(1, this.jetT / JET_RAMP);
        this.vy = Math.max(HOVER_SPEED, this.vy - thrust * k);
      } else {
        this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * k);
      }
      PetView.setPose('scared', high && !this.jetting);
      PetView.setPose('jetting', this.jetting);
      this.y += this.vy * k;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.falling = false;
        const jetted = this.jetting;
        this.jetting = false;
        PetView.setPose('jetting', false);
        PetView.setPose('scared', false);
        App.onLand(this.y - this.dropY, jetted);
      }
      this.place();
      return;
    }
    // e.g. the taskbar moved or the pet changed screens
    if (Math.abs(this.y - this.groundY) > 1) return this.startFall();

    if (!App.canWander()) {
      this.setWalking(false);
      this.targetX = null;
      return;
    }

    if (Game.s.follow && this.cursorX != null) {
      const tx = clamp(this.cursorX - window.innerWidth / 2, this.minX, this.maxX);
      const far = Math.abs(tx - this.x);
      this.setWalking(far > 30);
      if (far > 30) this.walkToward(tx, (far > 300 ? 3.2 : 1.8) * k);
      return;
    }

    if (this.targetX != null) {
      this.setWalking(true);
      if (this.walkToward(this.targetX, 1.2 * k)) {
        this.targetX = null;
        this.setWalking(false);
        this.nextDecision = Date.now() + rand(3000, 8000);
      }
      return;
    }

    if (Date.now() > this.nextDecision) {
      // tired or sad pigs wander less
      const s = Game.s;
      const chance = s.energy < 30 || s.mood < 30 ? 0.15 : 0.5;
      if (Math.random() < chance) this.targetX = clamp(this.x + rand(-400, 400), this.minX, this.maxX);
      else this.nextDecision = Date.now() + rand(3000, 8000);
    }
  },
};
