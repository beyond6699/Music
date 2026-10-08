/* 视觉：点（花、雨点、音符）· 线（五弦、枝、箫之气息、风）· 面（日、纸、色块），与声音事件逐一对应 */
(function () {
  'use strict';
  const C = (window.Chun = window.Chun || {});
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1)})`;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const INK = [38, 34, 30];
  const PAPER = [242, 238, 229];
  const DUSK = [224, 217, 204];
  const PETAL = [214, 124, 110];
  const PETAL_L = [232, 172, 160];
  const RAIN = [92, 104, 112];
  const FONT = '"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC",serif';

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  class Visual {
    constructor(canvas, engine) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.E = engine;
      this.queue = [];
      this.ripples = [];
      this.blossoms = [];
      this.petals = [];
      this.drops = [];
      this.birds = [];
      this.winds = [];
      this.ribbon = [];
      this.strings = [0, 1, 2, 3, 4].map(() => ({ y: 0, ty: 0, plucks: [], glow: 0 }));
      this.modeRgb = hex(C.MODES[engine.mode].color);
      this.modeTarget = this.modeRgb.slice();
      this.step = { step: 0, time: 0, dur: 0.47, total: C.TOTAL_STEPS };
      this.progress = 0;
      this.seed = 3;
      this.t = performance.now() / 1000;
      this.level = 0;
      this.sunY = null;
      this.sunR = 0;
      this.rainAcc = 0;
      this.windAcc = 0;
      this.lastRainHit = 0;
      this.lastSample = 0;
      this.onRainHit = null;
      this.onStep = null;
      this.grain = this.makeGrain();
      engine.on((e) => this.queue.push(e));
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    makeGrain() {
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      const g = c.getContext('2d');
      const img = g.createImageData(220, 220);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 70 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 16;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(110,96,80,0.06)';
      g.lineWidth = 0.6;
      for (let k = 0; k < 36; k++) {
        const x = Math.random() * 220, y = Math.random() * 220, a = Math.random() * TAU, l = 6 + Math.random() * 18;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      return this.g.createPattern(c, 'repeat');
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth, h = window.innerHeight;
      this.cv.width = Math.floor(w * dpr);
      this.cv.height = Math.floor(h * dpr);
      this.cv.style.width = w + 'px';
      this.cv.style.height = h + 'px';
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w;
      this.h = h;
      const m = Math.min(w, h);
      const portrait = h > w * 1.1;
      this.sizeK = clamp(m / 900, 0.6, 1.4);
      this.sx0 = w * (portrait ? 0.14 : 0.12);
      this.sx1 = w * (portrait ? 0.9 : 0.86);
      this.sTop = h * 0.58;
      this.sBot = h * 0.8;
      this.sunX = w * (portrait ? 0.64 : 0.68);
      this.sunR0 = m * (portrait ? 0.17 : 0.13);
      this.sunYmin = h * 0.2;
      this.sunYmax = h * (portrait ? 0.4 : 0.39);
      this.progY = h - 74;
      this.layoutStrings(true);
      this.blossoms.forEach((b) => this.toPetal(b));
      this.blossoms = [];
      this.makeBranches();
    }

    layoutStrings(instant) {
      const set = C.MODES[this.E.mode].set;
      this.strings.forEach((s, i) => {
        s.ty = this.sBot - (set[i] / 10) * (this.sBot - this.sTop);
        if (instant) s.y = s.ty;
      });
    }

    applyMode(i) {
      this.modeTarget = hex(C.MODES[i].color);
      this.layoutStrings(false);
    }

    makeBranches() {
      const R = rng(this.seed * 9973 + 17);
      const w = this.w, m = Math.min(w, this.h);
      const limitY = this.sTop - 40;
      const br = [];
      const grow = (x, y, ang, segs, len, w0, t0, t1, depth) => {
        const pts = [{ x, y }];
        let a = ang;
        for (let i = 0; i < segs; i++) {
          a += (R() - 0.5) * 0.5 + (ang - a) * 0.15;
          if (R() < 0.12) a += (R() - 0.5) * 0.9;
          const l = len * (0.7 + R() * 0.6);
          x += Math.cos(a) * l;
          y += Math.sin(a) * l;
          if (y > limitY || y < 20 || x > w * 0.96) break;
          pts.push({ x, y });
        }
        if (pts.length < 3) return;
        const n = pts.length - 1;
        const tEnd = t0 + ((t1 - t0) * n) / segs;
        br.push({ pts, t0, t1: tEnd, w0, depth });
        if (depth < 2) {
          const nSub = depth === 0 ? 6 : 2;
          for (let k = 0; k < nSub; k++) {
            const si = 2 + Math.floor(R() * Math.max(1, n - 3));
            const p = pts[Math.min(si, n)];
            const side = R() < 0.5 ? -1 : 1;
            const na = clamp(ang + side * (0.5 + R() * 0.6), -0.95, 0.8);
            const ts = t0 + ((tEnd - t0) * si) / n;
            const subSegs = Math.max(3, Math.floor(segs * (depth === 0 ? 0.42 : 0.5) * (0.6 + R() * 0.6)));
            grow(p.x, p.y, na, subSegs, len * 0.8, w0 * (depth === 0 ? 0.5 : 0.55) * (1 - (si / n) * 0.5), ts, Math.min(1, ts + (tEnd - t0) * 0.45), depth + 1);
          }
        }
      };
      grow(-m * 0.02, this.h * 0.1, 0.28, 26, w * 0.022, Math.max(3.2, m * 0.009), 0, 0.62, 0);
      this.branches = br;
    }

    growth(b) { return clamp((this.progress - b.t0) / (b.t1 - b.t0), 0, 1); }

    zoneX(deg) {
      const z = clamp(Math.floor(deg / 5) + 1, 0, 4);
      return this.sx0 + ((z + 0.5) / 5) * (this.sx1 - this.sx0);
    }

    octaveAt(x) { return clamp(Math.floor(((x - this.sx0) / (this.sx1 - this.sx0)) * 5), 0, 4) - 1; }

    hitString(x, y) {
      if (x < this.sx0 - 30 || x > this.sx1 + 12) return -1;
      let best = -1, bd = 16;
      this.strings.forEach((s, i) => {
        const d = Math.abs(y - s.y);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }

    hitSun(x, y) { return this.sunY != null && Math.hypot(x - this.sunX, y - this.sunY) < this.sunR * 1.15; }
    hitProgress(x, y) { return Math.abs(y - this.progY) < 14 && x > this.sx0 - 8 && x < this.sx1 + 8; }
    progressAt(x) { return clamp((x - this.sx0) / (this.sx1 - this.sx0), 0, 0.999); }
    lightFromY(y) { return clamp((this.sunYmax - y) / (this.sunYmax - this.sunYmin), 0, 1); }
    pitchY(f) { return this.h * 0.52 - Math.log2(f / 290) * this.h * 0.14; }

    audioNow() {
      const c = this.E.ctx;
      return c ? c.currentTime - (c.outputLatency || c.baseLatency || 0) : 0;
    }

    ripple(x, y, o) {
      this.ripples.push(Object.assign({ x, y, born: this.t, life: 1.6, r0: 0, maxR: 16, a0: 0.4, col: INK, lw: 0.8, fill: false, flat: false }, o));
    }

    toPetal(b) {
      this.petals.push({
        x: b.x, y: b.y, r: b.r * 0.6, vx: (Math.random() - 0.5) * 10, vy: 4 + Math.random() * 14,
        rot: b.rot, vr: (Math.random() - 0.5) * 2, born: this.t, life: 7 + Math.random() * 5,
        col: b.col, ph: Math.random() * TAU,
      });
    }

    newSpring() {
      this.blossoms.forEach((b) => this.toPetal(b));
      this.blossoms = [];
      this.seed++;
      this.makeBranches();
    }

    branchPoint() {
      const vis = [];
      for (const b of this.branches) {
        const f = this.growth(b);
        if (f * (b.pts.length - 1) > 0.6) vis.push([b, f]);
      }
      if (!vis.length) return null;
      const [b, f] = vis[Math.floor(Math.random() * vis.length)];
      const n = b.pts.length - 1;
      const pos = f * n * (0.3 + 0.7 * Math.sqrt(Math.random()));
      const i = Math.min(n - 1, Math.floor(pos));
      const fr = pos - i;
      const p0 = b.pts[i], p1 = b.pts[i + 1];
      const a = Math.random() * TAU, d = (2 + Math.random() * 7) * this.sizeK;
      return { x: lerp(p0.x, p1.x, fr) + Math.cos(a) * d, y: lerp(p0.y, p1.y, fr) + Math.sin(a) * d };
    }

    blossom(e, kind) {
      const pt = this.branchPoint();
      if (!pt) return;
      const dur = e.dur || 0.5;
      const r = clamp(2.6 + dur * 2.2, 2.6, 10) * this.sizeK * (e.role === 'user' ? 1.15 : 1);
      const col = kind === 'ring' ? this.modeRgb.slice() : Math.random() < 0.5 ? PETAL : PETAL_L;
      this.blossoms.push({ x: pt.x, y: pt.y, r, born: this.t, kind, rot: Math.random() * TAU, col, center: this.modeRgb.slice() });
      if (this.blossoms.length > 320) this.toPetal(this.blossoms.shift());
      this.ripple(pt.x, pt.y, { maxR: r * 3.2, life: 1.4, a0: 0.3, col, lw: 0.7 });
    }

    pluckString(i, x, role, vel, deg) {
      const s = this.strings[i];
      const u = clamp((x - this.sx0) / (this.sx1 - this.sx0), 0.03, 0.97);
      const amp = { lead: 7, user: 9, acc: 3.2, gliss: 2.4, grace: 1.5 }[role] || 3;
      s.plucks.push({ u, amp: amp * (0.5 + vel * 0.7), t0: this.t, f: 3.2 + i * 0.35 + Math.floor(deg / 5) * 0.9, decay: role === 'acc' ? 1.6 : 1.1 });
      if (s.plucks.length > 4) s.plucks.shift();
      s.glow = Math.min(1, s.glow + (role === 'lead' || role === 'user' ? 0.9 : 0.35));
    }

    handle(e) {
      const L = this.sx1 - this.sx0;
      switch (e.type) {
        case 'zheng': {
          const i = ((e.deg % 5) + 5) % 5;
          const s = this.strings[i];
          const x = e.x != null ? e.x : this.zoneX(e.deg) + (Math.random() - 0.5) * L * 0.08;
          this.pluckString(i, x, e.role, e.vel, e.deg);
          const big = e.role === 'lead' || e.role === 'user';
          this.ripple(x, s.y, {
            maxR: big ? 22 + e.vel * 22 : 10,
            life: big ? 2.2 : 1.2,
            a0: big ? 0.5 : 0.22,
            fill: true,
            col: e.role === 'user' ? this.modeRgb : INK,
          });
          if (big) this.blossom(e, e.role === 'user' || e.dur > 1.2 ? 'flower' : 'bud');
          break;
        }
        case 'harm': {
          const i = ((e.deg % 5) + 5) % 5;
          const s = this.strings[i];
          const x = e.x != null ? e.x : this.zoneX(e.deg) + (Math.random() - 0.5) * L * 0.06;
          const soft = e.role === 'echo' || e.role === 'rain' || e.role === 'drip';
          this.ripple(x, s.y, { maxR: soft ? 12 : 20, life: soft ? 2 : 3, a0: soft ? 0.3 : 0.55, col: this.modeRgb });
          this.ripple(x, s.y - 9, { r0: 2.6, maxR: 3.2, life: soft ? 1.6 : 2.6, a0: soft ? 0.4 : 0.7, col: this.modeRgb });
          s.glow = Math.min(1, s.glow + 0.3);
          if (e.role === 'lead') this.blossom({ dur: 1.4, role: 'lead' }, 'ring');
          break;
        }
        case 'xiao': {
          const y = this.pitchY(e.f);
          this.ripple(this.w * 0.93, y, { maxR: 8 + e.vel * 8, life: 1.6, a0: 0.35, col: this.modeRgb, fill: true });
          if (e.vel >= 0.75) this.blossom(e, 'ring');
          break;
        }
        case 'drop': {
          const top = this.sBot + 18, bot = this.progY - 16;
          const y = bot - top > 12 ? lerp(top, bot, Math.random()) : lerp(this.h * 0.3, this.h * 0.9, Math.random());
          this.ripple(this.w * (0.5 + e.pan * 0.46), y, { maxR: 5 + e.size * 9, life: 1.3, a0: 0.28, col: RAIN, flat: true });
          break;
        }
        case 'bird': {
          const dir = e.pan < 0 ? 1 : -1;
          this.birds.push({
            x: this.w * (0.5 + e.pan * 0.42), y: this.h * (0.1 + Math.random() * 0.22),
            vx: dir * (26 + Math.random() * 36), born: this.t, life: 5 + e.dur, chirp: e.dur,
            size: (5 + Math.random() * 4) * this.sizeK, ph: Math.random() * TAU,
          });
          break;
        }
        case 'step': {
          if (e.step < this.step.step - 2) this.newSpring();
          this.step = e;
          if (this.onStep) this.onStep(e);
          break;
        }
        default:
          break;
      }
    }

    processQueue() {
      if (!this.E.ready || !this.queue.length) return;
      const an = this.audioNow();
      const rest = [];
      for (const e of this.queue) {
        if (e.time <= an) this.handle(e);
        else rest.push(e);
      }
      this.queue = rest;
    }

    start() {
      let last = performance.now();
      const loop = (ts) => {
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        this.t = ts / 1000;
        this.frame(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    frame(dt) {
      const g = this.g, E = this.E;
      this.processQueue();
      if (E.ready) {
        const an = this.audioNow();
        const st = this.step;
        const frac = clamp((an - st.time) / st.dur, 0, 1);
        this.progress = (st.step + frac) / st.total;
        if (E.ctx.state === 'running') this.level = lerp(this.level, Math.min(1, E.level() * 4.5), 0.18);
      }
      this.modeRgb = mixc(this.modeRgb, this.modeTarget, 0.05);

      const bg = mixc(mixc(DUSK, PAPER, E.light), this.modeRgb, 0.04);
      g.fillStyle = rgba(bg, 1);
      g.fillRect(0, 0, this.w, this.h);
      g.fillStyle = this.grain;
      g.fillRect(0, 0, this.w, this.h);

      this.drawPlane();
      this.drawSun();
      this.drawRibbon();
      this.drawWind(dt);
      this.drawBranches();
      this.drawBlossoms(dt);
      this.drawBirds(dt);
      this.drawStrings();
      this.drawRipples();
      this.drawRain(dt);
      this.drawPetals(dt);
      this.drawProgress();
    }

    // 面：琴弦后的色块
    drawPlane() {
      const g = this.g;
      const L = this.sx1 - this.sx0;
      const a = 0.045 + this.E.rain * 0.02;
      g.fillStyle = rgba(this.modeRgb, a);
      g.fillRect(this.sx0 + L * 0.18, this.sTop - 26, L * 0.82 + 18, this.sBot - this.sTop + 52);
      g.fillStyle = rgba(INK, 0.05);
      g.fillRect(this.sx0 + L * 0.18, this.sBot + 26, L * 0.82 + 18, 1);
    }

    // 面：日（随声音呼吸，上下拖动即晨昏）
    drawSun() {
      const g = this.g;
      const ty = lerp(this.sunYmax, this.sunYmin, this.E.light);
      this.sunY = this.sunY == null ? ty : lerp(this.sunY, ty, 0.15);
      const lv = this.level;
      const r = this.sunR0 * (1 + lv * 0.22);
      this.sunR = r;
      g.fillStyle = rgba(this.modeRgb, 0.12);
      g.beginPath();
      g.arc(this.sunX - r * 0.07, this.sunY + r * 0.05, r * 1.02, 0, TAU);
      g.fill();
      g.fillStyle = rgba(this.modeRgb, 0.86);
      g.beginPath();
      g.arc(this.sunX, this.sunY, r, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(this.modeRgb, 0.12 + lv * 0.4);
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(this.sunX, this.sunY, r * (1.16 + lv * 0.25), 0, TAU);
      g.stroke();
    }

    // 线：箫的气息，音高即高低，气息强弱即粗细
    drawRibbon() {
      const g = this.g, E = this.E;
      const speed = this.w * 0.04;
      const maxAge = (this.w * 0.9) / speed;
      const rx = this.w * 0.93;
      if (E.ready && E.ctx.state === 'running' && this.t - this.lastSample > 1 / 30) {
        this.lastSample = this.t;
        const an = this.audioNow();
        const notes = E.xiao.notes;
        let cur = null;
        for (let j = notes.length - 1; j >= 0; j--) {
          const n = notes[j];
          if (n.t <= an && an < n.end + 0.25) { cur = n; break; }
        }
        let a = 0, y = null;
        if (cur) {
          const att = clamp((an - cur.t) / 0.12, 0, 1);
          const rel = an > cur.end ? clamp(1 - (an - cur.end) / 0.25, 0, 1) : 1;
          a = cur.vel * att * rel;
          const target = this.pitchY(cur.f);
          const prev = this.ribbon[this.ribbon.length - 1];
          y = prev && prev.y != null ? lerp(prev.y, target, 0.45) : target;
        }
        this.ribbon.push({ t: this.t, y, a });
      }
      while (this.ribbon.length && this.t - this.ribbon[0].t > maxAge) this.ribbon.shift();
      g.lineCap = 'round';
      for (let j = 1; j < this.ribbon.length; j++) {
        const p0 = this.ribbon[j - 1], p1 = this.ribbon[j];
        if (p0.y == null || p1.y == null || p0.a < 0.02 || p1.a < 0.02) continue;
        const age = (this.t - p1.t) / maxAge;
        g.strokeStyle = rgba(mixc(this.modeRgb, INK, 0.3), 0.6 * (1 - age) * Math.min(1, p1.a * 1.5));
        g.lineWidth = 0.5 + p1.a * 2.6;
        g.beginPath();
        g.moveTo(rx - (this.t - p0.t) * speed, p0.y);
        g.lineTo(rx - (this.t - p1.t) * speed, p1.y);
        g.stroke();
      }
    }

    // 线：风
    drawWind(dt) {
      const g = this.g, E = this.E;
      if (E.wind > 0.06) {
        this.windAcc += E.wind * 5 * dt;
        while (this.windAcc > 1) {
          this.windAcc -= 1;
          const sp = 160 + E.wind * 500;
          this.winds.push({ x: -this.w * 0.05, y: this.h * (0.04 + Math.random() * 0.55), len: this.w * (0.12 + Math.random() * 0.2), sp, amp: 3 + Math.random() * 6, ph: Math.random() * TAU, born: this.t, life: (this.w * 1.4) / sp });
        }
      }
      g.lineWidth = 0.7;
      this.winds = this.winds.filter((wl) => {
        const p = (this.t - wl.born) / wl.life;
        if (p >= 1) return false;
        wl.x += wl.sp * dt;
        g.strokeStyle = rgba(INK, 0.13 * Math.sin(Math.PI * p));
        g.beginPath();
        for (let k = 0; k <= 30; k++) {
          const xx = wl.x - wl.len + (wl.len * k) / 30;
          const yy = wl.y + Math.sin(wl.ph + k * 0.25 + this.t * 2) * wl.amp;
          if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy);
        }
        g.stroke();
        return true;
      });
      if (E.wind > 0.25 && this.blossoms.length && Math.random() < E.wind * dt * 4) {
        const k = Math.floor(Math.random() * this.blossoms.length);
        this.toPetal(this.blossoms.splice(k, 1)[0]);
      }
    }

    // 线：枝，随乐曲进程生长
    drawBranches() {
      const g = this.g;
      g.lineCap = 'round';
      for (const b of this.branches) {
        const f = this.growth(b);
        if (f <= 0) continue;
        const n = b.pts.length - 1;
        const upto = f * n;
        let tip = null;
        for (let i = 0; i < Math.ceil(upto); i++) {
          const p0 = b.pts[i], p1 = b.pts[i + 1];
          const fr = Math.min(1, upto - i);
          const x1 = lerp(p0.x, p1.x, fr), y1 = lerp(p0.y, p1.y, fr);
          const wdt = b.w0 * (1 - (i / n) * 0.75);
          g.strokeStyle = rgba(INK, 0.82);
          g.lineWidth = wdt;
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = rgba(INK, 0.22);
          g.lineWidth = wdt * 0.45;
          g.beginPath();
          g.moveTo(p0.x + 0.8, p0.y - wdt * 0.5);
          g.lineTo(x1 + 0.8, y1 - wdt * 0.5);
          g.stroke();
          tip = [x1, y1, wdt];
        }
        if (tip && f < 1) {
          g.fillStyle = rgba(INK, 0.85);
          g.beginPath();
          g.arc(tip[0], tip[1], Math.max(1.2, tip[2] * 0.7), 0, TAU);
          g.fill();
        }
      }
    }

    // 点：花与蕾，由旋律音符开出
    drawBlossoms() {
      const g = this.g;
      for (const b of this.blossoms) {
        const s = easeOut(clamp((this.t - b.born) / 0.5, 0, 1));
        const r = b.r * s;
        if (b.kind === 'flower') {
          g.fillStyle = rgba(b.col, 0.6);
          for (let k = 0; k < 5; k++) {
            const a = b.rot + (k * TAU) / 5;
            g.beginPath();
            g.arc(b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5, r * 0.52, 0, TAU);
            g.fill();
          }
          g.fillStyle = rgba(b.center, 0.85);
          g.beginPath();
          g.arc(b.x, b.y, Math.max(0.8, r * 0.18), 0, TAU);
          g.fill();
        } else if (b.kind === 'bud') {
          g.fillStyle = rgba(b.col, 0.8);
          g.beginPath();
          g.arc(b.x, b.y, r * 0.55, 0, TAU);
          g.fill();
          g.fillStyle = rgba(INK, 0.7);
          g.beginPath();
          g.arc(b.x + Math.cos(b.rot) * r * 0.5, b.y + Math.sin(b.rot) * r * 0.5, Math.max(0.6, r * 0.14), 0, TAU);
          g.fill();
        } else {
          g.strokeStyle = rgba(b.col, 0.7);
          g.lineWidth = 0.9;
          g.beginPath();
          g.arc(b.x, b.y, r * 0.7, 0, TAU);
          g.stroke();
          g.fillStyle = rgba(b.col, 0.8);
          g.beginPath();
          g.arc(b.x, b.y, Math.max(0.7, r * 0.15), 0, TAU);
          g.fill();
        }
      }
    }

    drawBirds(dt) {
      const g = this.g;
      g.lineWidth = 1;
      g.lineCap = 'round';
      this.birds = this.birds.filter((b) => {
        const age = this.t - b.born;
        if (age > b.life) return false;
        b.x += b.vx * dt;
        b.y += Math.sin(this.t * 0.8 + b.ph) * 6 * dt;
        const a = Math.min(1, age / 0.6, (b.life - age) / 1.2);
        const wing = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * 9 + b.ph));
        const s = b.size;
        g.strokeStyle = rgba(INK, 0.75 * a);
        g.beginPath();
        g.moveTo(b.x - s, b.y - s * 0.5 * wing);
        g.quadraticCurveTo(b.x - s * 0.45, b.y - s * 0.12, b.x, b.y + s * 0.15);
        g.quadraticCurveTo(b.x + s * 0.45, b.y - s * 0.12, b.x + s, b.y - s * 0.5 * wing);
        g.stroke();
        if (age < b.chirp) {
          const dir = Math.sign(b.vx);
          g.fillStyle = rgba(INK, 0.5 * a);
          for (let k = 1; k <= 3; k++) {
            if (Math.sin(this.t * 22 + k * 1.7) > 0.2) {
              g.beginPath();
              g.arc(b.x + dir * (s + k * 4), b.y - k * 1.5, 0.9, 0, TAU);
              g.fill();
            }
          }
        }
        return true;
      });
    }

    // 线：五弦，按调式的音程排布；被拨动时以驻波振动
    drawStrings() {
      const g = this.g;
      const L = this.sx1 - this.sx0;
      const NP = 96;
      const names = C.degreeNames(this.E.mode);
      g.font = `13px ${FONT}`;
      g.textAlign = 'right';
      g.lineCap = 'round';
      this.strings.forEach((s, i) => {
        s.y = lerp(s.y, s.ty, 0.07);
        s.glow *= 0.97;
        s.plucks = s.plucks.filter((p) => p.amp * Math.exp(-(this.t - p.t0) * p.decay) > 0.12);
        const col = mixc(INK, this.modeRgb, Math.min(1, s.glow));
        g.strokeStyle = rgba(col, 0.55 + s.glow * 0.35);
        g.lineWidth = i === 0 ? 1.3 : 1;
        g.beginPath();
        for (let k = 0; k <= NP; k++) {
          const u = k / NP;
          let dy = 0;
          for (const p of s.plucks) {
            const age = this.t - p.t0;
            const A = p.amp * Math.exp(-age * p.decay);
            for (let m = 1; m <= 3; m++) {
              dy += ((A * Math.sin(m * Math.PI * p.u)) / (m * m)) * Math.sin(m * Math.PI * u) * Math.cos(TAU * m * p.f * age) * Math.exp(-age * m * 0.8);
            }
          }
          const x = this.sx0 + u * L;
          if (k) g.lineTo(x, s.y + dy);
          else g.moveTo(x, s.y + dy);
        }
        g.stroke();
        g.fillStyle = rgba(INK, 0.6);
        g.beginPath();
        g.arc(this.sx0, s.y, 1.7, 0, TAU);
        g.arc(this.sx1, s.y, 1.7, 0, TAU);
        g.fill();
        g.fillStyle = rgba(INK, 0.3);
        for (let z = 1; z < 5; z++) {
          g.beginPath();
          g.arc(this.sx0 + (z / 5) * L, s.y, 1.1, 0, TAU);
          g.fill();
        }
        g.fillStyle = rgba(i === 0 ? mixc(INK, this.modeRgb, 0.7) : INK, i === 0 ? 0.9 : 0.5);
        g.fillText(names[i], this.sx0 - 16, s.y + 4.5);
        if (i === 0) {
          g.fillStyle = rgba(this.modeRgb, 0.9);
          g.beginPath();
          g.arc(this.sx0 - 40, s.y, 2.4, 0, TAU);
          g.fill();
        }
      });
    }

    drawRipples() {
      const g = this.g;
      this.ripples = this.ripples.filter((r) => {
        const p = (this.t - r.born) / r.life;
        if (p >= 1) return false;
        const rr = r.r0 + (r.maxR - r.r0) * easeOut(p);
        const a = r.a0 * Math.pow(1 - p, 1.4);
        g.strokeStyle = rgba(r.col, a);
        g.lineWidth = r.lw;
        g.beginPath();
        if (r.flat) g.ellipse(r.x, r.y, rr, rr * 0.32, 0, 0, TAU);
        else g.arc(r.x, r.y, rr, 0, TAU);
        g.stroke();
        if (r.fill) {
          g.fillStyle = rgba(r.col, a * 1.2);
          g.beginPath();
          g.arc(r.x, r.y, 2.2 * (1 - p) + 0.6, 0, TAU);
          g.fill();
        }
        return true;
      });
    }

    // 点与线：雨。落在弦上时，弦以泛音回应
    drawRain(dt) {
      const g = this.g, E = this.E;
      const rate = [0, 26, 80][E.rain];
      this.rainAcc += rate * dt;
      while (this.rainAcc > 1) {
        this.rainAcc -= 1;
        this.drops.push({
          x: Math.random() * this.w * 1.1 - this.w * 0.1, y: -20, vy: 520 + Math.random() * 260,
          len: 10 + Math.random() * 14, endY: this.h * (0.45 + Math.random() * 0.5),
        });
      }
      g.lineWidth = 0.8;
      const slant = 0.12 + E.wind * 0.8;
      this.drops = this.drops.filter((d) => {
        const py = d.y;
        d.y += d.vy * dt;
        d.x += slant * d.vy * dt;
        if (d.x > this.sx0 && d.x < this.sx1) {
          this.strings.forEach((s, i) => {
            if (py < s.y && d.y >= s.y) {
              this.ripple(d.x, s.y, { maxR: 3, life: 0.5, a0: 0.3, col: RAIN });
              if (this.t - this.lastRainHit > 0.18 && Math.random() < 0.15 && this.onRainHit) {
                this.lastRainHit = this.t;
                this.onRainHit(i, d.x);
              }
            }
          });
        }
        if (d.y > d.endY) {
          this.ripple(d.x, d.y, { maxR: 2 + Math.random() * 4, life: 0.8, a0: 0.22, col: RAIN, flat: true });
          return false;
        }
        g.strokeStyle = rgba(RAIN, 0.22);
        g.beginPath();
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - slant * d.len, d.y - d.len);
        g.stroke();
        return true;
      });
    }

    drawPetals(dt) {
      const g = this.g, E = this.E;
      this.petals = this.petals.filter((p) => {
        const age = this.t - p.born;
        if (age > p.life || p.y > this.h + 20) return false;
        p.vy += 6 * dt;
        p.x += (p.vx + Math.sin(this.t * 1.3 + p.ph) * 12 + E.wind * 90) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        g.fillStyle = rgba(p.col, 0.55 * (1 - age / p.life));
        g.beginPath();
        g.ellipse(p.x, p.y, p.r, p.r * 0.55, p.rot, 0, TAU);
        g.fill();
        return true;
      });
    }

    // 线与点：进程
    drawProgress() {
      const g = this.g;
      const y = this.progY, x0 = this.sx0, x1 = this.sx1, L = x1 - x0;
      const px = x0 + L * this.progress;
      g.lineWidth = 1;
      g.strokeStyle = rgba(INK, 0.16);
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
      g.strokeStyle = rgba(INK, 0.55);
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(px, y);
      g.stroke();
      g.font = `11px ${FONT}`;
      g.textAlign = 'center';
      const cur = Math.min(3, Math.floor(this.progress * 4));
      for (let k = 0; k <= 4; k++) {
        g.fillStyle = rgba(INK, 0.4);
        g.beginPath();
        g.arc(x0 + (L * k) / 4, y, 1.6, 0, TAU);
        g.fill();
        if (k < 4) {
          g.fillStyle = k === cur ? rgba(mixc(INK, this.modeRgb, 0.6), 0.85) : rgba(INK, 0.3);
          g.fillText(C.SECTIONS[k].name, x0 + (L * (k + 0.5)) / 4, y - 10);
        }
      }
      g.fillStyle = rgba(this.modeRgb, 0.95);
      g.beginPath();
      g.arc(px, y, 3.5, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(this.modeRgb, 0.3);
      g.beginPath();
      g.arc(px, y, 7 + this.level * 6, 0, TAU);
      g.stroke();
    }
  }

  C.Visual = Visual;
})();
