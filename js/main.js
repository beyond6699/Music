/* 交互与界面联动 */
(function () {
  'use strict';
  const C = window.Chun;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s) => document.querySelector(s);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
    syncMode();
    if (changed && E.ready) {
      E.precache(E.season.str);
      E.gliss(E.now + 0.03, 0.75, true, 0.3);
    }
  }

  function syncMode() {
    const m = C.MODES[E.mode];
    modeBtns.forEach((b, k) => b.classList.toggle('on', k === E.mode));
    document.documentElement.style.setProperty('--mode', m.color);
    $('#mode-desc').textContent = `${m.name}调 · ${m.el} · ${m.dir} · ${m.mood}`;
  }

  // 季节
  const KEYS_SEASON = ['q', 'w', 'e', 'r'];
  const seasonBtns = C.SEASONS.map((S, i) => {
    const b = document.createElement('button');
    b.textContent = S.name;
    b.title = `${S.name} [${KEYS_SEASON[i].toUpperCase()}]`;
    b.addEventListener('click', () => chooseSeason(i));
    $('#seasons').appendChild(b);
    return b;
  });

  let previewIdx = 0;
  const pickBtns = C.SEASONS.map((S, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span>${S.name}</span>`;
    b.setAttribute('aria-label', `进入${S.name}`);
    b.addEventListener('mouseenter', () => previewSeason(i));
    b.addEventListener('focus', () => previewSeason(i));
    b.addEventListener('click', () => enter(i));
    $('#picks').appendChild(b);
    return b;
  });

  function chooseSeason(i) {
    if (!E.ready) { previewSeason(i); return; }
    K.setSeason(C.SEASONS[i]);
  }

  function previewSeason(i) {
    if (E.ready) return;
    previewIdx = i;
    const S = C.SEASONS[i];
    E.setSeason(S);
    V.preview(S);
    syncAll(S);
  }

  function syncAll(S) {
    S = S || E.season;
    seasonBtns.forEach((b, k) => b.classList.toggle('on', k === S.index));
    pickBtns.forEach((b, k) => b.classList.toggle('on', k === S.index));
    $('.title-char').textContent = S.name;
    document.title = `${S.name} · 五声`;
    document.body.dataset.season = S.id;
    $('#time-total').textContent = fmt(S.nominal);
    $('#hint-light').textContent = S.body === '月' ? '移月' : '移日';
    $('#ov-motto').textContent = `${S.name} · ${C.MODES[S.mode].name}调 · ${S.motto}`;
    syncMode();
    syncToggles();
    if (!E.ready || curSid !== S.id) showSection(S, 0);
  }

  E.on((e) => { if (e.type === 'season') syncAll(e.S); });

  // 段落与诗句
  let curSec = -1, curSid = null, secTimer = 0;
  V.onStep = (e) => {
    const S = C.seasonById(e.sid);
    $('#time-now').textContent = fmt((e.step / e.total) * S.nominal);
    if (e.sec !== curSec || e.sid !== curSid) showSection(S, e.sec);
  };
  function showSection(S, i) {
    if (curSec === i && curSid === S.id) return;
    curSec = i;
    curSid = S.id;
    const s = S.sections[i];
    const el = $('#section');
    el.classList.add('fade');
    clearTimeout(secTimer);
    secTimer = setTimeout(() => {
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
  function enter(i) {
    if (E.ready) return;
    const S = C.SEASONS[i];
    E.setSeason(S);
    E.init();
    E.ctx.resume();
    K.start(S);
    $('#overlay').classList.add('hidden');
    document.body.classList.add('playing');
  }

  // 控件
  const wxBtn = $('#btn-wx'), crBtn = $('#btn-cr'), cyBtn = $('#btn-cycle'), pauseBtn = $('#btn-pause');
  function syncToggles() {
    const S = E.season;
    wxBtn.firstChild.textContent = S.weather.name;
    crBtn.textContent = S.creature.name;
    wxBtn.dataset.level = E.weather;
    wxBtn.classList.toggle('on', E.weather > 0);
    crBtn.classList.toggle('on', E.creature);
    cyBtn.classList.toggle('on', K.cycle);
  }
  function cycleWeather() { E.weather = (E.weather + 1) % 3; syncToggles(); }
  function toggleCreature() { E.creature = !E.creature; syncToggles(); }
  function toggleCycle() { K.cycle = !K.cycle; syncToggles(); }
  function togglePause() {
    if (!E.ready) return;
    if (E.ctx.state === 'running') { E.ctx.suspend(); pauseBtn.textContent = '续'; pauseBtn.classList.add('on'); }
    else { E.ctx.resume(); pauseBtn.textContent = '停'; pauseBtn.classList.remove('on'); }
  }
  wxBtn.addEventListener('click', cycleWeather);
  crBtn.addEventListener('click', toggleCreature);
  cyBtn.addEventListener('click', toggleCycle);
  pauseBtn.addEventListener('click', togglePause);

  syncAll(C.SEASONS[0]);

  // 指针：拨弦 / 划弦 / 移日 / 拂空 / 跳转
  const cv = V.cv;
  let drag = null;
  cv.addEventListener('pointerdown', (ev) => {
    if (!E.ready) return;
    const x = ev.clientX, y = ev.clientY;
    cv.setPointerCapture(ev.pointerId);
    if (V.hitSun(x, y)) { drag = { type: 'sun', off: y - V.sunY }; cv.style.cursor = 'grabbing'; return; }
    if (V.hitProgress(x, y)) { K.seek(Math.floor((V.progressAt(x) * E.season.total) / 8) * 8); return; }
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
    if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    const si = KEYS_SEASON.indexOf(k);
    if (!E.ready) {
      if (k === 'enter' || k === ' ') { ev.preventDefault(); enter(previewIdx); }
      else if (si >= 0) previewSeason(si);
      else if (k === 'arrowright' || k === 'arrowleft') previewSeason((previewIdx + (k === 'arrowright' ? 1 : 3)) % 4);
      return;
    }
    const i = KEYS.indexOf(k);
    if (i >= 0 && k.length === 1) {
      const z = ev.shiftKey ? 3 : 2;
      pluck(i, V.sx0 + ((z + 0.5) / 5) * (V.sx1 - V.sx0), 0.8);
      return;
    }
    if (si >= 0) chooseSeason(si);
    else if (k >= '1' && k <= '5') setMode(+k - 1);
    else if (k === ' ') { ev.preventDefault(); togglePause(); }
    else if (k === 'z') cycleWeather();
    else if (k === 'x') toggleCreature();
    else if (k === 'c') toggleCycle();
    else if (k === 'arrowup') E.setLight(E.light + 0.08);
    else if (k === 'arrowdown') E.setLight(E.light - 0.08);
  });
})();
