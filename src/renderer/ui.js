// Pet window UI: speech bubble, busy progress bar and the hover overview card.

const UI = {
  init() {
    const $ = (id) => document.getElementById(id);
    this.bubble = $('bubble');
    this.progress = $('progress');
    this.progressLabel = $('progressLabel');
    this.progressBar = $('progressBar');
    this.hud = $('hud');

    const rings = STATS.map(
      (st) => `<div class="ring" data-ring="${st.key}" title="${st.name}">
        <svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="15"/>
          <circle class="val" cx="18" cy="18" r="15" pathLength="100" stroke="${st.color}" transform="rotate(-90 18 18)"/></svg>
        <span class="ri">${st.icon}</span><small data-val="${st.key}"></small></div>`
    ).join('');
    this.hud.innerHTML = `
      <div class="hud-top"><b id="hudName"></b><span class="tag lv" id="hudLevel"></span><span class="tag" id="hudTitle"></span>
        <span class="spacer"></span><span class="coin">🪙 <b data-val="money"></b></span></div>
      <div class="exp" title="经验"><i id="hudExp"></i></div>
      <div class="rings">${rings}</div>
      <button class="hud-btn" id="homeBtn">🏠 打开小窝</button>`;
    $('homeBtn').addEventListener('click', () => window.pet.openHome('status'));
    this.hudName = $('hudName');
    this.hudTitle = $('hudTitle');
    this.hudLevel = $('hudLevel');
    this.hudExp = $('hudExp');
  },

  say(text, ms = 3500) {
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.bubble.classList.remove('show'), ms);
  },

  // Per-second update of live numbers
  refresh() {
    const s = Game.s;
    this.hudName.textContent = s.name;
    this.hudTitle.textContent = Game.title;
    this.hudLevel.textContent = `Lv.${s.level}`;
    this.hudExp.style.width = s.level >= MAX_LEVEL ? '100%' : `${(s.exp / expNeed(s.level)) * 100}%`;
    this.hud.querySelectorAll('[data-val]').forEach((el) => (el.textContent = Math.round(s[el.dataset.val])));
    this.hud.querySelectorAll('[data-ring]').forEach((el) => {
      const v = s[el.dataset.ring];
      el.querySelector('.val').setAttribute('stroke-dasharray', `${v} 100`);
      el.classList.toggle('low', v < 30);
    });

    this.progress.classList.toggle('show', Game.busy);
    if (Game.busy) {
      this.progressLabel.textContent = `${Game.activityLabel()} · ${fmtTime(Game.remaining())}`;
      this.progressBar.style.width = `${Game.progress() * 100}%`;
    }
  },
};
