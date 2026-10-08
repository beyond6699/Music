/* 交互与界面联动 */
(function () {
  'use strict';
  const C = window.Chun;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s) => document.querySelector(s);

  const E = new C.Engine();
  const V = new C.Visual($('#stage'), E);
  const K = new C.Conductor(E);
  V.start();

  // 调式
  const modeBtns = C.MODES.map((m, i) => {
    const b = document.createElement('button');
    b.textContent = m.name;
    b.title = `${m.name}调 · ${m.el}  [${i + 1}]`;
    b.addEventListener('click', () => setMode(i));
    $('#modes').appendChild(b);
    return b;
  });

  function setMode(i) {
    const changed = i !== E.mode;
    E.setMode(i);
    V.applyMode(i);
    const m = C.MODES[i];
    modeBtns.forEach((b, k) => b.classList.toggle('on', k === i));
    document.documentElement.style.setProperty('--mode', m.color);
    $('#mode-desc').textContent = `${m.name}调 · ${m.el} · ${m.dir} · ${m.mood}`;
    if (changed && E.ready) E.gliss(E.now + 0.03, 0.75, true, 0.3);
  }
  setMode(2);

  // 段落
  let curSec = -1;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  V.onStep = (e) => {
    $('#time-now').textContent = fmt((e.step / e.total) * C.NOMINAL_SECONDS);
    if (e.sec !== curSec) showSection(e.sec);
  };
  function showSection(i) {
    curSec = i;
    const s = C.SECTIONS[i];
    const el = $('#section');
    el.classList.add('fade');
    setTimeout(() => {
      $('.sec-idx').textContent = s.name;
      $('.sec-term').textContent = s.term;
      $('.sec-poem').innerHTML = s.poem.map((p) => `<p>${p}</p>`).join('') + `<cite>${s.author}</cite>`;
      el.classList.remove('fade');
    }, 700);
  }

  // 雨落弦上 → 泛音
  V.onRainHit = (i, x) => {
    if (!E.ready || E.ctx.state !== 'running') return;
    E.harmonic(V.octaveAt(x) * 5 + i, E.now, 0.2, 'rain', x);
  };

  function pluck(i, x, vel) {
    if (!E.ready) return;
    const deg = V.octaveAt(x) * 5 + i;
    E.zheng(deg, E.now, { vel, role: 'user', x, dur: 1.2, double: true });
    E.harmonic(deg, E.now + K.barDur, vel * 0.42, 'echo', x); // 一小节后的余音
  }

  // 开始
  function enter() {
    if (E.ready) return;
    E.init();
    E.ctx.resume();
    K.start();
    $('#overlay').classList.add('hidden');
    document.body.classList.add('playing');
  }
  $('#enter').addEventListener('click', enter);

  // 控件
  const rainBtn = $('#btn-rain'), birdBtn = $('#btn-bird'), pauseBtn = $('#btn-pause');
  function syncToggles() {
    rainBtn.dataset.level = E.rain;
    rainBtn.classList.toggle('on', E.rain > 0);
    birdBtn.classList.toggle('on', E.birds);
  }
  function cycleRain() { E.rain = (E.rain + 1) % 3; syncToggles(); }
  function toggleBird() { E.birds = !E.birds; syncToggles(); }
  function togglePause() {
    if (!E.ready) return;
    if (E.ctx.state === 'running') { E.ctx.suspend(); pauseBtn.textContent = '续'; pauseBtn.classList.add('on'); }
    else { E.ctx.resume(); pauseBtn.textContent = '停'; pauseBtn.classList.remove('on'); }
  }
  rainBtn.addEventListener('click', cycleRain);
  birdBtn.addEventListener('click', toggleBird);
  pauseBtn.addEventListener('click', togglePause);
  syncToggles();

  // 指针：拨弦 / 划弦 / 移日 / 拂空 / 跳转
  const cv = V.cv;
  let drag = null;
  cv.addEventListener('pointerdown', (ev) => {
    if (!E.ready) return;
    const x = ev.clientX, y = ev.clientY;
    cv.setPointerCapture(ev.pointerId);
    if (V.hitSun(x, y)) { drag = { type: 'sun', off: y - V.sunY }; cv.style.cursor = 'grabbing'; return; }
    if (V.hitProgress(x, y)) { K.seek(Math.floor((V.progressAt(x) * C.TOTAL_STEPS) / 8) * 8); return; }
    const si = V.hitString(x, y);
    if (si >= 0) { pluck(si, x, 0.85); drag = { type: 'strum', x, y, t: performance.now() }; return; }
    drag = { type: 'wind', x, y, t: performance.now() };
  });

  cv.addEventListener('pointermove', (ev) => {
    const x = ev.clientX, y = ev.clientY;
    if (!drag) {
      if (!E.ready) return;
      cv.style.cursor = V.hitSun(x, y) ? 'ns-resize' : V.hitString(x, y) >= 0 || V.hitProgress(x, y) ? 'pointer' : 'crosshair';
      return;
    }
    if (drag.type === 'sun') { E.setLight(V.lightFromY(y - drag.off)); return; }
    const now = performance.now();
    const dist = Math.hypot(x - drag.x, y - drag.y);
    const dtm = Math.max(1, now - drag.t);
    if (drag.type === 'strum') {
      const vel = clamp(0.4 + (dist / dtm) * 0.22, 0.38, 0.95);
      if (x >= V.sx0 - 20 && x <= V.sx1 + 10) {
        V.strings.forEach((s, i) => { if ((drag.y - s.y) * (y - s.y) < 0) pluck(i, x, vel); });
      }
    } else {
      E.wind = Math.min(1, E.wind + dist * 0.0016);
    }
    drag.x = x; drag.y = y; drag.t = now;
  });

  const endDrag = () => { drag = null; cv.style.cursor = ''; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // 键盘
  const KEYS = 'asdfg';
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const k = ev.key.toLowerCase();
    if (!E.ready) { if (k === 'enter' || k === ' ') { ev.preventDefault(); enter(); } return; }
    const i = KEYS.indexOf(k);
    if (i >= 0 && k.length === 1) {
      const z = ev.shiftKey ? 3 : 2;
      pluck(i, V.sx0 + ((z + 0.5) / 5) * (V.sx1 - V.sx0), 0.8);
      return;
    }
    if (k >= '1' && k <= '5') setMode(+k - 1);
    else if (k === ' ') { ev.preventDefault(); togglePause(); }
    else if (k === 'r') cycleRain();
    else if (k === 'b') toggleBird();
    else if (k === 'arrowup') E.setLight(E.light + 0.08);
    else if (k === 'arrowdown') E.setLight(E.light - 0.08);
  });
})();
