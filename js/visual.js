/* 视觉：四季意象。点（花、叶、雨雪、萤、露）· 线（五弦、枝、柳、苇、气息、风、闪电）· 面（日月、远山、雾、荷叶、色块），与声音事件逐一对应 */
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
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rand = Math.random;
  const FONT = '"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC",serif';

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  const THEMES = {
    spring: { paper: [242, 238, 229], dusk: [226, 216, 204], ink: [38, 34, 30], sky: [210, 224, 212], mist: [244, 241, 233], rain: [92, 104, 112], mtn: [[178, 194, 180], [140, 162, 148], [106, 128, 114]], snow: 0 },
    summer: { paper: [239, 239, 229], dusk: [198, 206, 202], ink: [30, 36, 34], sky: [196, 220, 222], mist: [238, 241, 233], rain: [70, 96, 104], mtn: [[150, 178, 170], [104, 140, 130], [66, 100, 92]], snow: 0 },
    autumn: { paper: [241, 233, 216], dusk: [212, 198, 176], ink: [44, 34, 26], sky: [232, 212, 180], mist: [243, 235, 219], rain: [110, 98, 84], mtn: [[198, 182, 152], [162, 140, 110], [120, 100, 78]], snow: 0 },
    winter: { paper: [237, 239, 239], dusk: [204, 208, 214], ink: [34, 36, 42], sky: [212, 220, 230], mist: [242, 244, 245], rain: [110, 120, 134], mtn: [[196, 204, 214], [150, 162, 178], [106, 118, 136]], snow: 1 },
  };
  const PAL = ['paper', 'dusk', 'ink', 'sky', 'mist', 'rain'];

  const PEACH = [[214, 124, 110], [232, 172, 160], [238, 196, 186]];
  const PLUM = [[166, 32, 40], [186, 46, 50], [150, 28, 36]];
  const LEAF_Y = [178, 160, 72], LEAF_O = [214, 146, 60], LEAF_R = [178, 56, 40];
  const LOTUS = [222, 128, 146], LOTUS_L = [244, 214, 214], LOTUS_D = [176, 70, 96];
  const LEAF = [86, 124, 100], LEAF_D = [52, 86, 70], STEM = [74, 98, 80];
  const WILLOW = [132, 164, 96], PLUME = [206, 188, 156], FIRE = [236, 232, 140], DRAGON = [64, 92, 116];

  const leafColor = (p) => {
    p = clamp(p + (rand() - 0.5) * 0.3, 0, 1);
    return p < 0.5 ? mixc(LEAF_Y, LEAF_O, p * 2) : mixc(LEAF_O, LEAF_R, (p - 0.5) * 2);
  };

  function drawMaple(g, x, y, r, rot, sx, col, a, ink) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(sx, 1);
    g.beginPath();
    for (let k = 0; k <= 60; k++) {
      const u = k / 60;
      const ang = -Math.PI / 2 + u * TAU;
      const lobe = Math.pow(Math.abs(Math.cos(u * TAU * 2.5)), 3);
      const down = 0.5 + 0.5 * Math.sin(ang);
      const rr = r * (0.42 + 0.58 * lobe) * (1 - 0.5 * down);
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = rgba(col, a);
    g.fill();
    g.strokeStyle = rgba(ink, a * 0.35);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(0, r * 0.25);
    g.lineTo(0, r * 0.85);
    g.moveTo(0, r * 0.2);
    g.lineTo(0, -r * 0.7);
    g.stroke();
    g.restore();
  }

  class Visual {
    constructor(canvas, engine) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.E = engine;
      this.queue = [];
      this.ripples = [];
      this.falls = [];
      this.drops = [];
      this.flakes = [];
      this.birds = [];
      this.winds = [];
      this.ribbon = [];
      this.geese = [];
      this.flies = [];
      this.dflies = [];
      this.crystals = [];
      this.bolt = null;
      this.flash = 0;
      this.strings = [0, 1, 2, 3, 4].map(() => ({ y: 0, ty: 0, plucks: [], glow: 0, snow: [] }));
      this.S = C.SEASONS[0];
      this.pal = {};
      PAL.forEach((k) => (this.pal[k] = THEMES[this.S.id][k].slice()));
      this.modeRgb = hex(C.MODES[engine.mode].color);
      this.modeTarget = this.modeRgb.slice();
      this.step = { step: 0, time: 0, dur: 0.47, total: this.S.total };
      this.progress = 0;
      this.started = false;
      this.seed = 3;
      this.t = performance.now() / 1000;
      this.level = 0;
      this.sunY = null;
      this.sunR = 0;
      this.acc = { rain: 0, wind: 0, snow: 0, leaf: 0 };
      this.lastRainHit = 0;
      this.lastSample = 0;
      this.onRainHit = null;
      this.onStep = null;
      this.grain = this.makeGrain();
      engine.on((e) => this.queue.push(e));
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    get th() { return THEMES[this.S.id]; }

    makeGrain() {
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      const g = c.getContext('2d');
      const img = g.createImageData(220, 220);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = rand() < 0.5 ? 70 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = rand() * 16;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(110,96,80,0.06)';
      g.lineWidth = 0.6;
      for (let k = 0; k < 36; k++) {
        const x = rand() * 220, y = rand() * 220, a = rand() * TAU, l = 6 + rand() * 18;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      return this.g.createPattern(c, 'repeat');
    }

    resize() {
      const dpr = (this.dpr = Math.min(2, window.devicePixelRatio || 1));
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
      this.sTop = h * 0.6;
      this.sBot = h * 0.8;
      this.sunX = w * (portrait ? 0.64 : 0.68);
      this.sunR0 = m * (portrait ? 0.15 : 0.115);
      this.sunYmin = h * 0.19;
      this.sunYmax = h * 0.4;
      this.progY = h - 74;
      this.layoutStrings(true);
      this.mists = [0, 1, 2].map((k) => ({ y: h * (0.43 + k * 0.055), hh: 10 + k * 7, sp: 5 + k * 4, x: rand() * w, wd: w * (0.35 + k * 0.15) }));
      this.mtn = this.makeMountains(this.S.id, this.seed);
      this.mtn.alpha = 1;
      this.mtnOld = null;
      if (this.flora) this.flora.blooms.forEach((b) => this.shed(b));
      this.flora = this.makeFlora(this.S.id, this.seed);
      this.oldFlora = null;
      this.flakes = [];
      this.strings.forEach((s) => (s.snow = []));
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

    // ———————————————— 季节 ————————————————

    setSeason(S) {
      if (this.flora) {
        this.flora.blooms.forEach((b) => this.shed(b));
        this.flora.blooms = [];
        this.flora.prog = this.progress;
        this.flora.fade = 1;
        this.oldFlora = this.flora;
      }
      this.S = S;
      this.seed++;
      this.flora = this.makeFlora(S.id, this.seed);
      this.mtnOld = this.mtn;
      this.mtn = this.makeMountains(S.id, this.seed);
      this.mtn.alpha = 0;
      this.strings.forEach((s) => this.shakeSnow(s));
      this.step = { step: 0, time: this.audioNow(), dur: 0.5, total: S.total };
      this.progress = 0;
      this.applyMode(S.mode);
    }

    newCycle() {
      if (this.flora) {
        this.flora.blooms.forEach((b) => this.shed(b));
        this.flora.blooms = [];
        this.flora.prog = 1;
        this.flora.fade = 1;
        this.oldFlora = this.flora;
      }
      this.seed++;
      this.flora = this.makeFlora(this.S.id, this.seed);
    }

    // ———————————————— 生成：远山 / 枝 / 荷 / 柳 / 苇 ————————————————

    makeMountains(id, seed) {
      const th = THEMES[id];
      const R = rng(seed * 7919 + 11);
      const w = this.w, h = this.h, dpr = this.dpr;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = [
        { base: 0.43, amp: 0.13, a: 0.42, fr: 1.1 },
        { base: 0.5, amp: 0.1, a: 0.5, fr: 1.7 },
        { base: 0.57, amp: 0.065, a: 0.58, fr: 2.6 },
      ];
      let temple = { x: w * 0.62, y: h * 0.4 };
      const step = 3;
      layers.forEach((L, li) => {
        const col = th.mtn[li];
        const comps = [];
        for (let k = 0; k < 5; k++) comps.push({ f: ((k + 1) * L.fr * (0.6 + R() * 0.8) * TAU) / w, p: R() * TAU, a: Math.pow(0.5, k) });
        const ePh = R() * TAU, eF = 0.5 + R() * 0.6;
        const ys = [];
        for (let x = 0; x <= w + step; x += step) {
          let n = 0;
          for (const c of comps) n += c.a * Math.sin(x * c.f + c.p);
          n /= 1.94;
          const env = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin((x / w) * TAU * eF + ePh), 1.4);
          ys.push(h * L.base - h * L.amp * env * (0.55 + 0.45 * n));
        }
        let top = Infinity;
        ys.forEach((y) => (top = Math.min(top, y)));
        const bot = h * L.base + h * 0.08;
        const grad = g.createLinearGradient(0, top, 0, bot);
        if (th.snow) {
          grad.addColorStop(0, rgba(mixc(col, th.paper, 0.85), L.a + 0.2));
          grad.addColorStop(0.3, rgba(mixc(col, th.paper, 0.2), L.a));
          grad.addColorStop(1, rgba(col, 0));
        } else {
          grad.addColorStop(0, rgba(col, L.a));
          grad.addColorStop(0.55, rgba(col, L.a * 0.75));
          grad.addColorStop(1, rgba(col, 0));
        }
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, bot);
        ys.forEach((y, i) => g.lineTo(i * step, y));
        g.lineTo(w + step, bot);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(th.ink, 0.1 + li * 0.05);
        g.lineWidth = 0.8;
        g.beginPath();
        ys.forEach((y, i) => (i ? g.lineTo(i * step, y) : g.moveTo(0, y)));
        g.stroke();
        // 皴：顺山势的短笔触
        g.lineWidth = 0.6;
        for (let k = 0; k < 80; k++) {
          const i = Math.floor(R() * ys.length);
          const x = i * step, y = ys[i];
          const len = 6 + R() * h * 0.035;
          const sl = (R() - 0.5) * 0.7;
          g.strokeStyle = rgba(th.ink, 0.04 + R() * 0.06);
          g.beginPath();
          g.moveTo(x, y + 2);
          g.quadraticCurveTo(x + sl * len * 0.5 + 2, y + len * 0.5, x + sl * len, y + len);
          g.stroke();
        }
        if (li === 1) {
          let by = Infinity;
          ys.forEach((y, i) => {
            const x = i * step;
            if (x > w * 0.5 && x < w * 0.82 && y < by) { by = y; temple = { x, y }; }
          });
        }
      });
      if (id === 'autumn' || id === 'winter') {
        const tx = temple.x, ty = temple.y;
        g.strokeStyle = rgba(th.ink, 0.5);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(tx, ty + 1);
        g.lineTo(tx, ty - 11);
        for (let k = 0; k < 3; k++) {
          g.moveTo(tx - 5 + k * 1.3, ty - 2 - k * 3.2);
          g.lineTo(tx + 5 - k * 1.3, ty - 2 - k * 3.2);
        }
        g.stroke();
      }
      return { cv, temple, alpha: 0 };
    }

    makeFlora(id, seed) {
      const f = { id, seed, blooms: [], fade: 1, prog: null };
      if (id === 'summer') {
        f.kind = 'lotus';
        f.stems = this.makeLotus(seed);
        f.dews = [];
      } else {
        f.kind = 'branch';
        f.branches = this.makeBranches(id, seed);
      }
      if (id === 'spring') f.willow = this.makeWillow(seed);
      if (id === 'autumn') f.reeds = this.makeReeds(seed);
      return f;
    }

    makeBranches(id, seed) {
      const P = {
        spring: { x: -0.02, y: 0.1, ang: 0.28, segs: 26, len: 0.022, w: 0.009, jit: 0.5, kink: 0.12, subs: 6, t1: 0.62 },
        autumn: { x: -0.02, y: 0.05, ang: 0.2, segs: 30, len: 0.021, w: 0.01, jit: 0.6, kink: 0.18, subs: 7, t1: 0.58 },
        winter: { x: -0.02, y: 0.17, ang: 0.1, segs: 22, len: 0.027, w: 0.011, jit: 0.75, kink: 0.32, subs: 5, t1: 0.6 },
      }[id];
      const R = rng(seed * 9973 + 17);
      const w = this.w, m = Math.min(w, this.h);
      const limitY = this.sTop - 40;
      const br = [];
      const grow = (x, y, ang, segs, len, w0, t0, t1, depth) => {
        const pts = [{ x, y }];
        let a = ang;
        for (let i = 0; i < segs; i++) {
          a += (R() - 0.5) * P.jit + (ang - a) * 0.15;
          if (R() < P.kink) a += (R() - 0.5) * 1.1;
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
          const nSub = depth === 0 ? P.subs : 2;
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
      grow(w * P.x - m * 0.0, this.h * P.y, P.ang, P.segs, w * P.len, Math.max(3.2, m * P.w), 0, P.t1, 0);
      return br;
    }

    makeLotus(seed) {
      const R = rng(seed * 31 + 7);
      const w = this.w, h = this.h, m = Math.min(w, h);
      const types = ['leaf', 'flower', 'leaf', 'leaf', 'flower', 'leaf', 'bud'];
      const n = types.length;
      return types.map((type, i) => {
        const x = w * (0.04 + 0.32 * (i / (n - 1))) + (R() - 0.5) * w * 0.04;
        const y = h * (type === 'leaf' ? 0.22 + R() * 0.28 : 0.13 + R() * 0.22);
        const bx = x + (R() - 0.5) * w * 0.06;
        const t0 = (i / n) * 0.45 + R() * 0.05;
        return {
          type, x, y, bx, by: h + 10,
          cx: lerp(bx, x, 0.5) + (R() - 0.5) * w * 0.05, cy: lerp(h, y, 0.5),
          t0, t1: t0 + 0.12 + R() * 0.08,
          R: m * (0.055 + R() * 0.04), tilt: (R() - 0.5) * 0.3, ph: R() * TAU,
          bloom: type === 'flower' ? 0.15 : 0.08, size: m * (0.03 + R() * 0.012),
          tx: null, ty: null,
        };
      });
    }

    makeWillow(seed) {
      const R = rng(seed * 53 + 5);
      const out = [];
      for (let i = 0; i < 10; i++) {
        out.push({ x: this.w * (0.36 + 0.22 * (i / 9)) + (R() - 0.5) * 20, len: this.h * (0.12 + R() * 0.2), ph: R() * TAU, lean: (R() - 0.5) * 0.6 });
      }
      return out;
    }

    makeReeds(seed) {
      const R = rng(seed * 71 + 9);
      const out = [];
      for (let i = 0; i < 13; i++) {
        out.push({ x: this.w * (0.87 + 0.125 * (i / 12)) + (R() - 0.5) * 10, hgt: this.h * (0.16 + R() * 0.2), ph: R() * TAU, lean: -(0.05 + R() * 0.15) * this.h * 0.2 });
      }
      return out;
    }

    // ———————————————— 工具 ————————————————

    growth(b, prog) { return clamp((prog - b.t0) / (b.t1 - b.t0), 0, 1); }

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
      this.ripples.push(Object.assign({ x, y, born: this.t, life: 1.6, r0: 0, maxR: 16, a0: 0.4, col: this.pal.ink, lw: 0.8, fill: false, flat: false }, o));
    }

    shed(b) {
      if (b.kind === 'ring') return;
      const shape = b.kind === 'leaf' ? 'leaf' : b.kind === 'plum' || b.kind === 'pbud' ? 'plum' : 'petal';
      this.falls.push({
        x: b.x, y: b.y, r: shape === 'leaf' ? b.r : b.r * 0.6, vx: (rand() - 0.5) * 10, vy: 4 + rand() * 14,
        rot: b.rot, vr: (rand() - 0.5) * 2, born: this.t, life: 7 + rand() * 6, col: b.col, ph: rand() * TAU, shape,
      });
      if (this.falls.length > 400) this.falls.shift();
    }

    shakeSnow(s) {
      const L = this.sx1 - this.sx0;
      for (const f of s.snow) {
        this.flakes.push({ x: this.sx0 + f.u * L, y: s.y - 1, r: f.r, vy: -15 - rand() * 35, vt: 14 + f.r * 10, ph: rand() * TAU, endY: this.h * (0.86 + rand() * 0.1), free: true });
      }
      s.snow = [];
    }

    branchPoint(f, prog) {
      const vis = [];
      for (const b of f.branches) {
        const gr = this.growth(b, prog);
        if (gr * (b.pts.length - 1) > 0.6) vis.push([b, gr]);
      }
      if (!vis.length) return null;
      const [b, gr] = pick(vis);
      const n = b.pts.length - 1;
      const pos = gr * n * (0.3 + 0.7 * Math.sqrt(rand()));
      const i = Math.min(n - 1, Math.floor(pos));
      const fr = pos - i;
      const p0 = b.pts[i], p1 = b.pts[i + 1];
      const a = rand() * TAU, d = (2 + rand() * 7) * this.sizeK;
      return { x: lerp(p0.x, p1.x, fr) + Math.cos(a) * d, y: lerp(p0.y, p1.y, fr) + Math.sin(a) * d };
    }

    // 音符 → 花开 / 叶生 / 梅绽 / 荷放 / 露珠
    bloom(e, major, ring) {
      const f = this.flora;
      if (!f) return;
      if (f.kind === 'lotus') {
        if (major) {
          const fl = f.stems.filter((s) => s.type !== 'leaf' && s.tx != null && this.progress > s.t1);
          if (fl.length) {
            const s = pick(fl);
            s.bloom = Math.min(s.type === 'bud' ? 0.35 : 1, s.bloom + 0.09);
            this.ripple(s.tx, s.ty - s.size * 0.5, { maxR: s.size * 1.7, life: 1.8, a0: 0.3, col: LOTUS });
            return;
          }
        }
        const lv = [];
        f.stems.forEach((s, i) => { if (s.type === 'leaf' && s.tx != null && this.progress > s.t1 + 0.03) lv.push(i); });
        if (!lv.length) return;
        const si = pick(lv);
        const s = f.stems[si];
        const d = { si, a: rand() * TAU, rr: Math.sqrt(rand()) * 0.75, born: this.t, r: (1.3 + rand() * 1.8) * this.sizeK };
        f.dews.push(d);
        if (f.dews.length > 70) f.dews.shift();
        this.ripple(s.tx + Math.cos(d.a) * d.rr * s.R, s.ty + Math.sin(d.a) * d.rr * s.R * 0.36, { maxR: 7, life: 1.2, a0: 0.35, col: this.pal.rain });
        return;
      }
      const pt = this.branchPoint(f, this.progress);
      if (!pt) return;
      const dur = e.dur || 0.5;
      let r = clamp(2.6 + dur * 2.2, 2.6, 10) * this.sizeK * (e.role === 'user' ? 1.15 : 1);
      let kind, col;
      if (ring) { kind = 'ring'; col = this.modeRgb.slice(); }
      else if (f.id === 'spring') { kind = major ? 'flower' : 'bud'; col = pick(PEACH); }
      else if (f.id === 'autumn') { kind = 'leaf'; r *= 1.3; col = leafColor(this.progress); }
      else { kind = major ? 'plum' : 'pbud'; r *= 0.82; col = pick(PLUM); }
      f.blooms.push({ x: pt.x, y: pt.y, r, born: this.t, kind, rot: rand() * TAU, col, center: this.modeRgb.slice() });
      if (f.blooms.length > 320) this.shed(f.blooms.shift());
      this.ripple(pt.x, pt.y, { maxR: r * 3.2, life: 1.4, a0: 0.3, col, lw: 0.7 });
    }

    disp(s, u) {
      let dy = 0;
      for (const p of s.plucks) {
        const age = this.t - p.t0;
        const A = p.amp * Math.exp(-age * p.decay);
        for (let m = 1; m <= 3; m++) {
          dy += ((A * Math.sin(m * Math.PI * p.u)) / (m * m)) * Math.sin(m * Math.PI * u) * Math.cos(TAU * m * p.f * age) * Math.exp(-age * m * 0.8);
        }
      }
      return dy;
    }

    pluckString(i, x, role, vel, deg) {
      const s = this.strings[i];
      const u = clamp((x - this.sx0) / (this.sx1 - this.sx0), 0.03, 0.97);
      const amp = { lead: 7, user: 9, acc: 3.2, gliss: 2.4, grace: 1.5 }[role] || 3;
      s.plucks.push({ u, amp: amp * (0.5 + vel * 0.7), t0: this.t, f: 3.2 + i * 0.35 + Math.floor(deg / 5) * 0.9, decay: role === 'acc' ? 1.6 : 1.1 });
      if (s.plucks.length > 4) s.plucks.shift();
      s.glow = Math.min(1, s.glow + (role === 'lead' || role === 'user' ? 0.9 : 0.35));
      if (s.snow.length && (role === 'lead' || role === 'user' || role === 'gliss' || rand() < 0.3)) this.shakeSnow(s);
    }

    // ———————————————— 事件 ————————————————

    handle(e) {
      const L = this.sx1 - this.sx0;
      const id = this.S.id;
      switch (e.type) {
        case 'zheng': {
          const i = ((e.deg % 5) + 5) % 5;
          const s = this.strings[i];
          const x = e.x != null ? e.x : this.zoneX(e.deg) + (rand() - 0.5) * L * 0.08;
          this.pluckString(i, x, e.role, e.vel, e.deg);
          const big = e.role === 'lead' || e.role === 'user';
          this.ripple(x, s.y, {
            maxR: big ? 22 + e.vel * 22 : 10,
            life: big ? 2.2 : 1.2,
            a0: big ? 0.5 : 0.22,
            fill: true,
            col: e.role === 'user' ? this.modeRgb : this.pal.ink,
          });
          if (big) this.bloom(e, e.role === 'user' || e.dur > 1.2, false);
          break;
        }
        case 'harm': {
          const i = ((e.deg % 5) + 5) % 5;
          const s = this.strings[i];
          const x = e.x != null ? e.x : this.zoneX(e.deg) + (rand() - 0.5) * L * 0.06;
          const soft = e.role !== 'lead';
          this.ripple(x, s.y, { maxR: soft ? 12 : 20, life: soft ? 2 : 3, a0: soft ? 0.3 : 0.55, col: this.modeRgb });
          this.ripple(x, s.y - 9, { r0: 2.6, maxR: 3.2, life: soft ? 1.6 : 2.6, a0: soft ? 0.4 : 0.7, col: this.modeRgb });
          s.glow = Math.min(1, s.glow + 0.3);
          if (id === 'winter') {
            this.crystals.push({ x, y: s.y - 14, r: (5 + e.vel * 10) * this.sizeK, rot: rand() * TAU, born: this.t, life: soft ? 4 : 6, vy: -4 - rand() * 4 });
          }
          if (e.role === 'lead') this.bloom({ dur: 1.4, role: 'lead' }, false, true);
          break;
        }
        case 'xiao': {
          const y = this.pitchY(e.f);
          this.ripple(this.w * 0.93, y, { maxR: 8 + e.vel * 8, life: 1.6, a0: 0.35, col: this.modeRgb, fill: true });
          if (e.vel >= 0.75) this.bloom(e, false, true);
          break;
        }
        case 'drop': {
          const top = this.sBot + 18, bot = this.progY - 16;
          const y = bot - top > 12 ? lerp(top, bot, rand()) : lerp(this.h * 0.3, this.h * 0.9, rand());
          this.ripple(this.w * (0.5 + e.pan * 0.46), y, { maxR: 5 + e.size * 9, life: 1.3, a0: 0.28, col: this.pal.rain, flat: true });
          break;
        }
        case 'bird': {
          const dir = e.pan < 0 ? 1 : -1;
          this.birds.push({
            x: this.w * (0.5 + e.pan * 0.42), y: this.h * (0.1 + rand() * 0.22),
            vx: dir * (40 + rand() * 50), born: this.t, life: 5 + e.dur, chirp: e.dur,
            size: (5 + rand() * 4) * this.sizeK, ph: rand() * TAU,
          });
          break;
        }
        case 'frog': {
          const x = this.w * (0.06 + rand() * 0.3), y = this.h * (0.9 + rand() * 0.07);
          for (let k = 0; k < 2; k++) this.ripple(x, y, { born: this.t + k * 0.25, maxR: 10 + k * 6, life: 1.6, a0: 0.3, col: this.pal.rain, flat: true });
          break;
        }
        case 'thunder': {
          this.flash = 1;
          const x0 = this.w * (0.3 + rand() * 0.6);
          const pts = [[x0, this.h * 0.02]];
          let x = x0;
          const n = 12;
          for (let k = 1; k <= n; k++) {
            x += (rand() - 0.5) * 34;
            pts.push([x, this.h * (0.02 + (0.42 * k) / n)]);
          }
          const bi = 4 + Math.floor(rand() * 4);
          const br = [pts[bi]];
          let bx = pts[bi][0];
          for (let k = 1; k <= 4; k++) {
            bx += 8 + rand() * 18;
            br.push([bx, pts[bi][1] + k * this.h * 0.03]);
          }
          this.bolt = { pts, br };
          break;
        }
        case 'cricket': {
          const x = this.w * (0.86 + rand() * 0.12), y = this.h * (0.9 + rand() * 0.08);
          this.ripple(x, y, { maxR: 4, life: 0.9, a0: 0.5, col: this.modeRgb, fill: true });
          break;
        }
        case 'geese': {
          const dir = e.dir;
          this.geese.push({ x: dir > 0 ? -80 : this.w + 80, y: this.h * (0.08 + rand() * 0.14), dir, n: 5 + Math.floor(rand() * 5), sp: (11 + rand() * 4) * this.sizeK, vx: 34 + rand() * 16, born: this.t, ph: rand() * TAU });
          break;
        }
        case 'bell': {
          const tp = this.mtn ? this.mtn.temple : { x: this.w * 0.6, y: this.h * 0.4 };
          const m = Math.min(this.w, this.h);
          for (let k = 0; k < 4; k++) {
            this.ripple(tp.x, tp.y - 5, { born: this.t + k * 0.9, maxR: m * (0.35 + k * 0.08), life: 7, a0: 0.22 - k * 0.03, col: this.modeRgb, lw: 0.9 });
          }
          this.ripple(tp.x, tp.y - 5, { r0: 3, maxR: 5, life: 4, a0: 0.8, col: this.modeRgb, fill: true });
          break;
        }
        case 'step': {
          if (e.sid === this.S.id && e.step < this.step.step - 2) this.newCycle();
          this.step = e;
          if (this.onStep) this.onStep(e);
          break;
        }
        case 'season': {
          if (e.S !== this.S || !this.started) this.setSeason(e.S);
          this.started = true;
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

    // ———————————————— 渲染 ————————————————

    frame(dt) {
      const g = this.g, E = this.E;
      this.processQueue();
      if (E.ready && this.started) {
        const an = this.audioNow();
        const st = this.step;
        const frac = clamp((an - st.time) / st.dur, 0, 1);
        this.progress = (st.step + frac) / st.total;
        if (E.ctx.state === 'running') this.level = lerp(this.level, Math.min(1, E.level() * 4.5), 0.18);
      } else {
        this.progress = 0.32;
      }
      const th = this.th;
      PAL.forEach((k) => (this.pal[k] = mixc(this.pal[k], th[k], 0.03)));
      this.modeRgb = mixc(this.modeRgb, this.modeTarget, 0.05);
      if (this.mtn.alpha < 1) this.mtn.alpha = Math.min(1, this.mtn.alpha + dt * 0.5);
      if (this.mtnOld && this.mtn.alpha >= 1) this.mtnOld = null;
      if (this.oldFlora) {
        this.oldFlora.fade -= dt * 0.45;
        if (this.oldFlora.fade <= 0) this.oldFlora = null;
      }

      const P = this.pal;
      const bg = mixc(mixc(P.dusk, P.paper, E.light), this.modeRgb, 0.04);
      g.fillStyle = rgba(bg, 1);
      g.fillRect(0, 0, this.w, this.h);
      this.drawSky();
      g.fillStyle = this.grain;
      g.fillRect(0, 0, this.w, this.h);

      this.drawBody();
      this.drawMountains(dt);
      this.drawPlane();
      this.drawRibbon();
      this.drawWind(dt);
      if (this.oldFlora) this.drawFlora(this.oldFlora, this.oldFlora.prog, Math.max(0, this.oldFlora.fade));
      this.drawFlora(this.flora, this.progress, 1);
      this.drawGeese(dt);
      this.drawBirds(dt);
      this.drawSummerLife(dt);
      this.drawStrings();
      this.drawRipples();
      this.drawRain(dt);
      this.drawSnow(dt);
      this.drawFalls(dt);
      this.drawCrystals();
      this.drawFlash(dt);
      this.drawProgress();
    }

    // 面：天色。晨昏时日旁泛起一层暖色
    drawSky() {
      const g = this.g, E = this.E;
      const sg = g.createLinearGradient(0, 0, 0, this.h * 0.62);
      sg.addColorStop(0, rgba(this.pal.sky, 0.55));
      sg.addColorStop(1, rgba(this.pal.sky, 0));
      g.fillStyle = sg;
      g.fillRect(0, 0, this.w, this.h * 0.62);
      if (E.light < 0.6 && this.sunY != null) {
        const k = 1 - E.light / 0.6;
        const rg = g.createRadialGradient(this.sunX, this.sunY, 0, this.sunX, this.sunY, this.w * 0.5);
        rg.addColorStop(0, rgba(this.modeRgb, 0.13 * k));
        rg.addColorStop(1, rgba(this.modeRgb, 0));
        g.fillStyle = rg;
        g.fillRect(0, 0, this.w, this.h);
      }
    }

    // 面：日 / 月（随声音呼吸，上下拖动即晨昏）
    drawBody() {
      const g = this.g, id = this.S.id;
      const ty = lerp(this.sunYmax, this.sunYmin, this.E.light);
      this.sunY = this.sunY == null ? ty : lerp(this.sunY, ty, 0.15);
      const lv = this.level;
      const k = id === 'summer' ? 1.12 : id === 'winter' ? 0.86 : 1;
      const r = this.sunR0 * k * (1 + lv * 0.22);
      this.sunR = r;
      const x = this.sunX, y = this.sunY, ink = this.pal.ink;
      if (id === 'autumn') {
        g.fillStyle = rgba(this.modeRgb, 0.1);
        g.beginPath();
        g.arc(x, y, r * (1.32 + lv * 0.2), 0, TAU);
        g.fill();
        g.fillStyle = rgba([251, 249, 241], 0.97);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(ink, 0.22);
        g.lineWidth = 0.8;
        g.stroke();
        g.fillStyle = rgba(ink, 0.045);
        for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.12, 0.16], [0.05, 0.42, 0.12], [-0.12, 0.08, 0.08]]) {
          g.beginPath();
          g.arc(x + cx * r, y + cy * r, cr * r, 0, TAU);
          g.fill();
        }
      } else if (id === 'winter') {
        g.fillStyle = rgba(mixc(this.modeRgb, this.pal.paper, 0.55), 0.85);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(this.modeRgb, 0.14 + lv * 0.3);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, y, r * (1.2 + lv * 0.25), 0, TAU);
        g.stroke();
      } else {
        g.fillStyle = rgba(this.modeRgb, 0.12);
        g.beginPath();
        g.arc(x - r * 0.07, y + r * 0.05, r * 1.02, 0, TAU);
        g.fill();
        g.fillStyle = rgba(this.modeRgb, 0.86);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(this.modeRgb, 0.12 + lv * 0.4);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, y, r * (1.16 + lv * 0.25), 0, TAU);
        g.stroke();
        if (id === 'summer') {
          for (let k2 = 1; k2 <= 2; k2++) {
            g.strokeStyle = rgba(this.modeRgb, 0.08);
            g.beginPath();
            g.arc(x, y, r * (1.3 + k2 * 0.2 + Math.sin(this.t * 1.4 + k2) * 0.03), 0, TAU);
            g.stroke();
          }
        }
      }
      // 线：横过日月的云
      if (id !== 'summer') {
        g.strokeStyle = rgba(ink, 0.16);
        g.lineWidth = 1;
        const d = Math.sin(this.t * 0.05) * r * 0.5;
        g.beginPath();
        g.moveTo(x - r * 1.7 + d, y + r * 0.32);
        g.lineTo(x + r * 0.9 + d, y + r * 0.32);
        g.moveTo(x - r * 0.4 - d, y - r * 0.5);
        g.lineTo(x + r * 1.5 - d, y - r * 0.5);
        g.stroke();
      }
    }

    // 面：远山与流动的雾
    drawMountains(dt) {
      const g = this.g;
      const draw = (m, a) => {
        if (!m || a <= 0) return;
        g.globalAlpha = a;
        g.drawImage(m.cv, 0, 0, this.w, this.h);
        g.globalAlpha = 1;
      };
      if (this.mtnOld) draw(this.mtnOld, 1 - this.mtn.alpha);
      draw(this.mtn, this.mtn.alpha);
      for (const m of this.mists) {
        m.x += m.sp * dt * (1 + this.E.wind * 6);
        if (m.x - m.wd > this.w) m.x = -m.wd;
        g.fillStyle = rgba(this.pal.mist, 0.5);
        g.beginPath();
        g.ellipse(m.x, m.y, m.wd, m.hh, 0, 0, TAU);
        g.fill();
      }
    }

    drawPlane() {
      const g = this.g;
      const L = this.sx1 - this.sx0;
      const a = 0.045 + this.E.wx * 0.02;
      g.fillStyle = rgba(this.modeRgb, a);
      g.fillRect(this.sx0 + L * 0.18, this.sTop - 26, L * 0.82 + 18, this.sBot - this.sTop + 52);
      g.fillStyle = rgba(this.pal.ink, 0.05);
      g.fillRect(this.sx0 + L * 0.18, this.sBot + 26, L * 0.82 + 18, 1);
    }

    // 线：箫/笛的气息，音高即高低，气息强弱即粗细
    drawRibbon() {
      const g = this.g, E = this.E;
      const speed = this.w * 0.04;
      const maxAge = (this.w * 0.9) / speed;
      const rx = this.w * 0.93;
      if (E.ready && E.ctx.state === 'running' && this.t - this.lastSample > 1 / 30) {
        this.lastSample = this.t;
        const an = this.audioNow();
        let cur = null;
        for (const inst of [E.xiao, E.dizi]) {
          const notes = inst.notes;
          for (let j = notes.length - 1; j >= 0; j--) {
            const n = notes[j];
            if (n.t <= an && an < n.end + 0.25) { if (!cur || n.t > cur.t) cur = n; break; }
          }
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
        g.strokeStyle = rgba(mixc(this.modeRgb, this.pal.ink, 0.3), 0.6 * (1 - age) * Math.min(1, p1.a * 1.5));
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
      const base = this.S.id === 'autumn' ? E.wx * 0.12 : 0;
      const wv = E.wind + base;
      if (wv > 0.06) {
        this.acc.wind += wv * 5 * dt;
        while (this.acc.wind > 1) {
          this.acc.wind -= 1;
          const sp = 160 + wv * 500;
          this.winds.push({ x: -this.w * 0.05, y: this.h * (0.04 + rand() * 0.55), len: this.w * (0.12 + rand() * 0.2), sp, amp: 3 + rand() * 6, ph: rand() * TAU, born: this.t, life: (this.w * 1.4) / sp });
        }
      }
      g.lineWidth = 0.7;
      this.winds = this.winds.filter((wl) => {
        const p = (this.t - wl.born) / wl.life;
        if (p >= 1) return false;
        wl.x += wl.sp * dt;
        g.strokeStyle = rgba(this.pal.ink, 0.13 * Math.sin(Math.PI * p));
        g.beginPath();
        for (let k = 0; k <= 30; k++) {
          const xx = wl.x - wl.len + (wl.len * k) / 30;
          const yy = wl.y + Math.sin(wl.ph + k * 0.25 + this.t * 2) * wl.amp;
          if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy);
        }
        g.stroke();
        return true;
      });
      const f = this.flora;
      if (f && f.blooms.length) {
        let pr = E.wind > 0.25 ? E.wind * dt * 4 : 0;
        if (f.id === 'autumn') pr += E.wx * dt * 0.35;
        if (rand() < pr) {
          const k = Math.floor(rand() * f.blooms.length);
          this.shed(f.blooms.splice(k, 1)[0]);
        }
      }
    }

    drawFlora(f, prog, alpha) {
      if (!f || alpha <= 0) return;
      if (f.willow) this.drawWillow(f, prog, alpha);
      if (f.kind === 'lotus') this.drawLotus(f, prog, alpha);
      else this.drawBranches(f, prog, alpha);
      if (f.reeds) this.drawReeds(f, alpha);
    }

    // 线：枝，随乐曲进程生长；冬日枝上积雪
    drawBranches(f, prog, alpha) {
      const g = this.g, ink = this.pal.ink;
      const snow = f.id === 'winter' ? clamp(0.3 + prog * 0.8 + this.E.wx * 0.1, 0, 1) : 0;
      g.lineCap = 'round';
      for (const b of f.branches) {
        const gr = this.growth(b, prog);
        if (gr <= 0) continue;
        const n = b.pts.length - 1;
        const upto = gr * n;
        let tip = null;
        for (let i = 0; i < Math.ceil(upto); i++) {
          const p0 = b.pts[i], p1 = b.pts[i + 1];
          const fr = Math.min(1, upto - i);
          const x1 = lerp(p0.x, p1.x, fr), y1 = lerp(p0.y, p1.y, fr);
          const wdt = b.w0 * (1 - (i / n) * 0.75);
          g.strokeStyle = rgba(ink, 0.82 * alpha);
          g.lineWidth = wdt;
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = rgba(ink, 0.22 * alpha);
          g.lineWidth = wdt * 0.45;
          g.beginPath();
          g.moveTo(p0.x + 0.8, p0.y - wdt * 0.5);
          g.lineTo(x1 + 0.8, y1 - wdt * 0.5);
          g.stroke();
          if (snow > 0) {
            const flat = 1 - Math.abs(y1 - p0.y) / (Math.hypot(x1 - p0.x, y1 - p0.y) + 0.01);
            if (flat > 0.35) {
              const sw = wdt * 0.85 * snow * flat;
              g.strokeStyle = rgba([252, 252, 250], 0.95 * alpha);
              g.lineWidth = sw;
              g.beginPath();
              g.moveTo(p0.x, p0.y - wdt * 0.5 - sw * 0.3);
              g.lineTo(x1, y1 - wdt * 0.5 - sw * 0.3);
              g.stroke();
              g.strokeStyle = rgba(ink, 0.18 * alpha);
              g.lineWidth = 0.5;
              g.beginPath();
              g.moveTo(p0.x, p0.y - wdt * 0.5 - sw * 0.8);
              g.lineTo(x1, y1 - wdt * 0.5 - sw * 0.8);
              g.stroke();
            }
          }
          tip = [x1, y1, wdt];
        }
        if (tip && gr < 1) {
          g.fillStyle = rgba(ink, 0.85 * alpha);
          g.beginPath();
          g.arc(tip[0], tip[1], Math.max(1.2, tip[2] * 0.7), 0, TAU);
          g.fill();
        }
      }
      this.drawBlooms(f, alpha);
    }

    // 点：花、蕾、叶、梅
    drawBlooms(f, alpha) {
      const g = this.g, ink = this.pal.ink;
      for (const b of f.blooms) {
        const s = easeOut(clamp((this.t - b.born) / 0.5, 0, 1));
        const r = b.r * s;
        if (b.kind === 'flower') {
          g.fillStyle = rgba(b.col, 0.6 * alpha);
          for (let k = 0; k < 5; k++) {
            const a = b.rot + (k * TAU) / 5;
            g.beginPath();
            g.arc(b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5, r * 0.52, 0, TAU);
            g.fill();
          }
          g.fillStyle = rgba(b.center, 0.85 * alpha);
          g.beginPath();
          g.arc(b.x, b.y, Math.max(0.8, r * 0.18), 0, TAU);
          g.fill();
        } else if (b.kind === 'bud') {
          g.fillStyle = rgba(b.col, 0.8 * alpha);
          g.beginPath();
          g.arc(b.x, b.y, r * 0.55, 0, TAU);
          g.fill();
          g.fillStyle = rgba(ink, 0.7 * alpha);
          g.beginPath();
          g.arc(b.x + Math.cos(b.rot) * r * 0.5, b.y + Math.sin(b.rot) * r * 0.5, Math.max(0.6, r * 0.14), 0, TAU);
          g.fill();
        } else if (b.kind === 'leaf') {
          drawMaple(g, b.x, b.y, r, b.rot, 1, b.col, 0.82 * alpha, ink);
        } else if (b.kind === 'plum') {
          g.fillStyle = rgba(b.col, 0.88 * alpha);
          for (let k = 0; k < 5; k++) {
            const a = b.rot + (k * TAU) / 5;
            g.beginPath();
            g.arc(b.x + Math.cos(a) * r * 0.45, b.y + Math.sin(a) * r * 0.45, r * 0.42, 0, TAU);
            g.fill();
          }
          g.strokeStyle = rgba(ink, 0.6 * alpha);
          g.lineWidth = 0.5;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = b.rot + (k * TAU) / 6 + 0.3;
            g.moveTo(b.x, b.y);
            g.lineTo(b.x + Math.cos(a) * r * 0.75, b.y + Math.sin(a) * r * 0.75);
          }
          g.stroke();
          g.fillStyle = rgba([226, 196, 120], 0.9 * alpha);
          g.beginPath();
          g.arc(b.x, b.y, Math.max(0.7, r * 0.16), 0, TAU);
          g.fill();
        } else if (b.kind === 'pbud') {
          g.fillStyle = rgba(b.col, 0.9 * alpha);
          g.beginPath();
          g.arc(b.x, b.y, r * 0.42, 0, TAU);
          g.fill();
          g.fillStyle = rgba(ink, 0.75 * alpha);
          g.beginPath();
          g.arc(b.x + Math.cos(b.rot) * r * 0.4, b.y + Math.sin(b.rot) * r * 0.4, Math.max(0.6, r * 0.15), 0, TAU);
          g.fill();
        } else {
          g.strokeStyle = rgba(b.col, 0.7 * alpha);
          g.lineWidth = 0.9;
          g.beginPath();
          g.arc(b.x, b.y, r * 0.7, 0, TAU);
          g.stroke();
          g.fillStyle = rgba(b.col, 0.8 * alpha);
          g.beginPath();
          g.arc(b.x, b.y, Math.max(0.7, r * 0.15), 0, TAU);
          g.fill();
        }
      }
    }

    // 面与线：荷叶、荷茎、荷花、露珠
    drawLotus(f, prog, alpha) {
      const g = this.g, E = this.E, ink = this.pal.ink;
      const W = E.wx;
      g.lineCap = 'round';
      for (const s of f.stems) {
        const gr = this.growth(s, prog);
        if (gr <= 0) continue;
        const sway = Math.sin(this.t * 0.6 + s.ph) * 2.5 + E.wind * 16 + (W === 2 ? Math.sin(this.t * 2.2 + s.ph) * 5 : 0);
        const bez = (u) => {
          const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
          return [a * s.bx + b * s.cx + c * (s.x + sway), a * s.by + b * s.cy + c * s.y];
        };
        g.strokeStyle = rgba(STEM, 0.6 * alpha);
        g.lineWidth = 1.5;
        g.beginPath();
        for (let k = 0; k <= 24; k++) {
          const p = bez((k / 24) * gr);
          if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
        }
        g.stroke();
        const tip = bez(gr);
        s.tx = tip[0];
        s.ty = tip[1];
        if (gr < 1) {
          g.fillStyle = rgba(STEM, 0.8 * alpha);
          g.beginPath();
          g.arc(tip[0], tip[1], 1.6, 0, TAU);
          g.fill();
          continue;
        }
        if (s.type === 'leaf') {
          const u = easeOut(clamp((prog - s.t1) / 0.06, 0, 1));
          this.drawLotusLeaf(s.tx, s.ty, s.R * u, s.tilt + sway * 0.004, alpha, ink);
        } else {
          this.drawLotusFlower(s.tx, s.ty, s.size, s.bloom, alpha);
        }
      }
      for (const d of f.dews) {
        const s = f.stems[d.si];
        if (s.tx == null) continue;
        const age = this.t - d.born;
        const a = alpha * clamp(Math.min(age / 0.3, (30 - age) / 5), 0, 1);
        if (a <= 0) continue;
        const x = s.tx + Math.cos(d.a + s.tilt) * d.rr * s.R;
        const y = s.ty + Math.sin(d.a) * d.rr * s.R * 0.36 - 1.5;
        g.fillStyle = rgba(this.pal.rain, 0.55 * a);
        g.beginPath();
        g.arc(x, y, d.r, 0, TAU);
        g.fill();
        g.fillStyle = rgba([255, 255, 255], 0.85 * a);
        g.beginPath();
        g.arc(x - d.r * 0.3, y - d.r * 0.3, d.r * 0.35, 0, TAU);
        g.fill();
      }
    }

    drawLotusLeaf(x, y, R, tilt, alpha, ink) {
      if (R < 1) return;
      const g = this.g;
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      g.fillStyle = rgba(LEAF, 0.3 * alpha);
      g.beginPath();
      g.ellipse(0, 0, R, R * 0.36, 0, 0, TAU);
      g.fill();
      g.fillStyle = rgba(LEAF_D, 0.16 * alpha);
      g.beginPath();
      g.ellipse(0, R * 0.04, R * 0.8, R * 0.25, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(ink, 0.32 * alpha);
      g.lineWidth = 0.8;
      g.beginPath();
      g.ellipse(0, 0, R, R * 0.36, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(ink, 0.14 * alpha);
      g.lineWidth = 0.6;
      g.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.34);
      }
      g.stroke();
      g.fillStyle = rgba(ink, 0.4 * alpha);
      g.beginPath();
      g.arc(0, 0, 1.4, 0, TAU);
      g.fill();
      g.restore();
    }

    drawLotusFlower(x, y, size, bloom, alpha) {
      const g = this.g;
      const open = 0.12 + 0.88 * bloom;
      g.save();
      g.translate(x, y);
      for (const [af, lf] of [[-1, 0.75], [1, 0.75], [-0.55, 0.9], [0.55, 0.9], [0, 1]]) {
        const a = af * open * 0.9;
        const L = size * lf * (0.8 + 0.2 * bloom);
        const Wd = size * 0.34 * lf;
        g.save();
        g.rotate(a);
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(Wd, -L * 0.3, Wd * 0.7, -L * 0.8, 0, -L);
        g.bezierCurveTo(-Wd * 0.7, -L * 0.8, -Wd, -L * 0.3, 0, 0);
        const gr = g.createLinearGradient(0, 0, 0, -L);
        gr.addColorStop(0, rgba(LOTUS_L, 0.8 * alpha));
        gr.addColorStop(1, rgba(LOTUS, 0.92 * alpha));
        g.fillStyle = gr;
        g.fill();
        g.strokeStyle = rgba(LOTUS_D, 0.35 * alpha);
        g.lineWidth = 0.6;
        g.stroke();
        g.restore();
      }
      if (bloom > 0.6) {
        g.fillStyle = rgba([206, 196, 112], 0.85 * alpha);
        g.beginPath();
        g.ellipse(0, -size * 0.32, size * 0.17, size * 0.07, 0, 0, TAU);
        g.fill();
      }
      g.restore();
    }

    // 线：柳丝，随风摆动，柳叶随乐曲渐密
    drawWillow(f, prog, alpha) {
      const g = this.g, E = this.E, ink = this.pal.ink;
      const gr = clamp(0.25 + prog * 1.6, 0.25, 1);
      g.lineCap = 'round';
      for (const s of f.willow) {
        const L = s.len * gr;
        const N = 22;
        const pts = [];
        for (let k = 0; k <= N; k++) {
          const v = k / N;
          const sway = (Math.sin(this.t * 0.8 + s.ph + v * 2.2) * (4 + 6 * v) + E.wind * 55 * v + E.wx * 3 * Math.sin(this.t * 1.7 + s.ph)) * v;
          pts.push([s.x + sway + s.lean * v * L * 0.1, -4 + v * L]);
        }
        g.strokeStyle = rgba(ink, 0.36 * alpha);
        g.lineWidth = 0.8;
        g.beginPath();
        pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
        g.strokeStyle = rgba(WILLOW, 0.65 * alpha);
        g.lineWidth = 1.7;
        g.beginPath();
        for (let k = 3; k <= N; k += 2) {
          if (prog < (k / N) * 0.55) break;
          const p = pts[k];
          const a = Math.PI / 2 + (k % 4 === 1 ? 0.8 : -0.8);
          g.moveTo(p[0], p[1]);
          g.lineTo(p[0] + Math.cos(a) * 5 * this.sizeK, p[1] + Math.sin(a) * 5 * this.sizeK);
        }
        g.stroke();
      }
    }

    // 线：芦苇与苇花
    drawReeds(f, alpha) {
      const g = this.g, E = this.E, ink = this.pal.ink, h = this.h;
      g.lineCap = 'round';
      for (const r of f.reeds) {
        const sway = Math.sin(this.t * 0.7 + r.ph) * 4 + E.wind * 36 + E.wx * 6 * Math.sin(this.t * 1.3 + r.ph);
        const bx = r.x, by = h + 4;
        const tx = r.x + r.lean + sway, ty = h - r.hgt;
        g.strokeStyle = rgba(ink, 0.25 * alpha);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(bx, by - r.hgt * 0.2);
        g.quadraticCurveTo(bx + r.lean * 0.2 - 6, by - r.hgt * 0.45, bx + r.lean * 0.7 - 16 + sway * 0.3, by - r.hgt * 0.5);
        g.stroke();
        g.strokeStyle = rgba(ink, 0.45 * alpha);
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(r.x + r.lean * 0.3, h - r.hgt * 0.5, tx, ty);
        g.stroke();
        g.strokeStyle = rgba(PLUME, 0.8 * alpha);
        g.lineWidth = 1.1;
        g.beginPath();
        for (let k = 0; k < 7; k++) {
          const a = Math.PI / 2 + 0.75 + (k - 3) * 0.13 - sway * 0.01;
          const l = (9 + (k % 3) * 3) * this.sizeK;
          g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(a - 0.5) * l * 0.5, ty + Math.sin(a - 0.5) * l * 0.5, tx + Math.cos(a) * l, ty + Math.sin(a) * l);
        }
        g.stroke();
      }
    }

    // 线：雁阵
    drawGeese(dt) {
      const g = this.g, ink = this.pal.ink;
      g.lineWidth = 0.9;
      g.lineCap = 'round';
      this.geese = this.geese.filter((G) => {
        G.x += G.dir * G.vx * dt;
        if ((G.dir > 0 && G.x > this.w + 200) || (G.dir < 0 && G.x < -200)) return false;
        const a = Math.min(1, (this.t - G.born) / 1.5);
        g.strokeStyle = rgba(ink, 0.6 * a);
        g.beginPath();
        for (let i = 0; i < G.n; i++) {
          const rank = (i + 1) >> 1;
          const side = i % 2 ? 1 : -1;
          const bx = G.x - G.dir * rank * G.sp;
          const by = G.y + side * rank * G.sp * 0.55 + Math.sin(this.t * 0.7 + i) * 1.5;
          const fl = Math.sin(this.t * 4 + i * 0.7 + G.ph) * 2.2;
          const s = 5 * this.sizeK;
          g.moveTo(bx - s, by - fl);
          g.quadraticCurveTo(bx - s * 0.4, by - 0.5, bx, by + 0.8);
          g.quadraticCurveTo(bx + s * 0.4, by - 0.5, bx + s, by - fl);
        }
        g.stroke();
        return true;
      });
    }

    // 线：燕
    drawBirds(dt) {
      const g = this.g, ink = this.pal.ink;
      g.lineWidth = 1;
      g.lineCap = 'round';
      this.birds = this.birds.filter((b) => {
        const age = this.t - b.born;
        if (age > b.life) return false;
        b.x += b.vx * dt;
        b.y += Math.sin(this.t * 0.8 + b.ph) * 10 * dt;
        const a = Math.min(1, age / 0.6, (b.life - age) / 1.2);
        const wing = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * 9 + b.ph));
        const s = b.size;
        const dir = Math.sign(b.vx);
        g.strokeStyle = rgba(ink, 0.75 * a);
        g.beginPath();
        g.moveTo(b.x - s, b.y - s * 0.5 * wing);
        g.quadraticCurveTo(b.x - s * 0.45, b.y - s * 0.12, b.x, b.y + s * 0.15);
        g.quadraticCurveTo(b.x + s * 0.45, b.y - s * 0.12, b.x + s, b.y - s * 0.5 * wing);
        g.moveTo(b.x, b.y + s * 0.15);
        g.lineTo(b.x - dir * s * 0.7, b.y + s * 0.55);
        g.moveTo(b.x, b.y + s * 0.15);
        g.lineTo(b.x - dir * s * 0.8, b.y + s * 0.25);
        g.stroke();
        if (age < b.chirp) {
          g.fillStyle = rgba(ink, 0.5 * a);
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

    // 点与线：夏夜萤火、蜻蜓
    drawSummerLife(dt) {
      const g = this.g, E = this.E;
      const summer = this.S.id === 'summer' && this.started;
      const nFly = summer ? Math.round(clamp((0.55 - E.light) / 0.45, 0, 1) * 36) : 0;
      if (this.flies.length < nFly && rand() < 0.3) {
        this.flies.push({ x: rand() * this.w * 0.7, y: this.h * (0.2 + rand() * 0.65), vx: 0, vy: 0, ph: rand() * TAU, born: this.t, dying: false });
      }
      if (this.flies.length > nFly && rand() < 0.1) {
        const f = this.flies.find((q) => !q.dying);
        if (f) { f.dying = true; f.die = this.t; }
      }
      this.flies = this.flies.filter((f) => {
        f.vx += (rand() - 0.5) * 40 * dt + E.wind * 30 * dt;
        f.vy += (rand() - 0.5) * 40 * dt;
        f.vx *= 0.97;
        f.vy *= 0.97;
        f.x += f.vx * dt * 6;
        f.y += f.vy * dt * 6;
        let a = Math.min(1, (this.t - f.born) / 1.5);
        if (f.dying) {
          a *= 1 - (this.t - f.die) / 1.5;
          if (a <= 0) return false;
        }
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(this.t * 2.2 + f.ph), 3);
        const A = a * (0.25 + 0.75 * pulse);
        const rg = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
        rg.addColorStop(0, rgba(FIRE, 0.6 * A));
        rg.addColorStop(1, rgba(FIRE, 0));
        g.fillStyle = rg;
        g.fillRect(f.x - 9, f.y - 9, 18, 18);
        g.fillStyle = rgba([150, 158, 60], 0.9 * A);
        g.beginPath();
        g.arc(f.x, f.y, 1.3, 0, TAU);
        g.fill();
        return true;
      });

      const nDf = summer && E.creature && E.light > 0.3 && E.wx < 2 ? 2 : 0;
      if (this.dflies.length < nDf) {
        this.dflies.push({ x: -20, y: this.h * (0.2 + rand() * 0.3), tx: this.w * 0.3, ty: this.h * 0.3, hover: 0, ang: 0, leaving: false, ph: rand() * TAU });
      }
      if (this.dflies.length > nDf) this.dflies.forEach((d) => (d.leaving = true));
      const k = this.sizeK;
      this.dflies = this.dflies.filter((d) => {
        if (d.hover > 0) {
          d.hover -= dt;
          d.x += Math.sin(this.t * 7 + d.ph) * 0.3;
          d.y += Math.cos(this.t * 5 + d.ph) * 0.2;
          if (d.hover <= 0) {
            if (d.leaving) { d.tx = this.w + 60; d.ty = d.y - 80; }
            else {
              const tips = this.flora && this.flora.kind === 'lotus' ? this.flora.stems.filter((s) => s.type !== 'leaf' && s.tx != null && this.progress > s.t1) : [];
              if (tips.length && rand() < 0.45) { const s = pick(tips); d.tx = s.tx; d.ty = s.ty - s.size * 1.05; }
              else { d.tx = this.w * (0.05 + rand() * 0.6); d.ty = this.h * (0.12 + rand() * 0.42); }
            }
          }
        } else {
          const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy);
          if (dist < 3) d.hover = 0.8 + rand() * 2.4;
          else {
            const sp = Math.min(dist, 260 * dt);
            d.x += (dx / dist) * sp;
            d.y += (dy / dist) * sp;
            d.ang = Math.atan2(dy, dx);
          }
        }
        if (d.leaving && d.x > this.w + 40) return false;
        g.save();
        g.translate(d.x, d.y);
        g.rotate(d.hover > 0 ? d.ang * 0.2 : d.ang);
        const flick = d.hover > 0 ? 0.75 + 0.25 * Math.sin(this.t * 50) : 0.5;
        g.fillStyle = rgba(this.pal.ink, 0.12 * flick + 0.04);
        for (const [wx, wy, wr] of [[1, -1, -0.25], [1, 1, 0.25], [-2, -1, -0.45], [-2, 1, 0.45]]) {
          g.beginPath();
          g.ellipse(wx * k, wy * 6 * k, 2.2 * k, 6.5 * k, wr, 0, TAU);
          g.fill();
        }
        g.strokeStyle = rgba(DRAGON, 0.85);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-15 * k, 0);
        g.lineTo(5 * k, 0);
        g.stroke();
        g.fillStyle = rgba(DRAGON, 0.9);
        g.beginPath();
        g.arc(6.5 * k, 0, 1.9 * k, 0, TAU);
        g.fill();
        g.restore();
        return true;
      });
    }

    // 线：五弦，按调式的音程排布；被拨动时以驻波振动；冬日弦上落雪
    drawStrings() {
      const g = this.g, ink = this.pal.ink;
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
        const col = mixc(ink, this.modeRgb, Math.min(1, s.glow));
        g.strokeStyle = rgba(col, 0.55 + s.glow * 0.35);
        g.lineWidth = i === 0 ? 1.3 : 1;
        g.beginPath();
        for (let k = 0; k <= NP; k++) {
          const u = k / NP;
          const x = this.sx0 + u * L;
          const y = s.y + (s.plucks.length ? this.disp(s, u) : 0);
          if (k) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
        for (const f of s.snow) {
          const x = this.sx0 + f.u * L;
          const y = s.y + (s.plucks.length ? this.disp(s, f.u) : 0) - f.r * 0.8;
          g.fillStyle = rgba([255, 255, 255], 0.95);
          g.beginPath();
          g.arc(x, y, f.r, 0, TAU);
          g.fill();
          g.strokeStyle = rgba(ink, 0.22);
          g.lineWidth = 0.5;
          g.stroke();
        }
        g.fillStyle = rgba(ink, 0.6);
        g.beginPath();
        g.arc(this.sx0, s.y, 1.7, 0, TAU);
        g.arc(this.sx1, s.y, 1.7, 0, TAU);
        g.fill();
        g.fillStyle = rgba(ink, 0.3);
        for (let z = 1; z < 5; z++) {
          g.beginPath();
          g.arc(this.sx0 + (z / 5) * L, s.y, 1.1, 0, TAU);
          g.fill();
        }
        g.fillStyle = rgba(i === 0 ? mixc(ink, this.modeRgb, 0.7) : ink, i === 0 ? 0.9 : 0.5);
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
        if (p < 0) return true;
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
      const g = this.g, E = this.E, id = this.S.id;
      const wet = id === 'spring' || id === 'summer';
      const rate = wet ? (id === 'summer' ? [0, 40, 130] : [0, 26, 80])[E.wx] : 0;
      this.acc.rain += rate * dt;
      while (this.acc.rain > 1) {
        this.acc.rain -= 1;
        const big = id === 'summer';
        this.drops.push({
          x: rand() * this.w * 1.1 - this.w * 0.1, y: -20, vy: (big ? 700 : 520) + rand() * 280,
          len: (big ? 14 : 10) + rand() * 14, endY: this.h * (0.45 + rand() * 0.5),
        });
      }
      g.lineWidth = 0.8;
      const slant = 0.12 + E.wind * 0.8 + (E.wx === 2 && id === 'summer' ? 0.15 : 0);
      const rc = this.pal.rain;
      this.drops = this.drops.filter((d) => {
        const py = d.y;
        d.y += d.vy * dt;
        d.x += slant * d.vy * dt;
        if (d.x > this.sx0 && d.x < this.sx1) {
          this.strings.forEach((s, i) => {
            if (py < s.y && d.y >= s.y) {
              this.ripple(d.x, s.y, { maxR: 3, life: 0.5, a0: 0.3, col: rc });
              if (this.t - this.lastRainHit > 0.18 && rand() < 0.15 && this.onRainHit) {
                this.lastRainHit = this.t;
                this.onRainHit(i, d.x);
              }
            }
          });
        }
        if (d.y > d.endY) {
          this.ripple(d.x, d.y, { maxR: 2 + rand() * 4, life: 0.8, a0: 0.22, col: rc, flat: true });
          return false;
        }
        g.strokeStyle = rgba(rc, 0.22);
        g.beginPath();
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - slant * d.len, d.y - d.len);
        g.stroke();
        return true;
      });
    }

    // 点：雪。落在弦上积起，拨弦时抖落
    drawSnow(dt) {
      const g = this.g, E = this.E, ink = this.pal.ink;
      const winter = this.S.id === 'winter';
      const rate = winter ? [0, 26, 85][E.wx] + (this.started ? 0 : 10) : 0;
      this.acc.snow += rate * dt;
      while (this.acc.snow > 1) {
        this.acc.snow -= 1;
        const r = 0.7 + Math.pow(rand(), 2) * 2.4;
        const vt = 14 + r * 10;
        this.flakes.push({ x: rand() * this.w * 1.2 - this.w * 0.15, y: -6, r, vy: vt, vt, ph: rand() * TAU, endY: this.h * (0.84 + rand() * 0.14), free: false });
      }
      const L = this.sx1 - this.sx0;
      this.flakes = this.flakes.filter((f) => {
        const py = f.y;
        f.vy = lerp(f.vy, f.vt, Math.min(1, dt * 1.5));
        f.x += (Math.sin(this.t * 1.1 + f.ph) * 12 + E.wind * 140 + 6) * dt;
        f.y += f.vy * dt * (1 + E.wind * 0.5);
        if (winter && f.vy > 0 && f.x > this.sx0 && f.x < this.sx1) {
          for (const s of this.strings) {
            if (py < s.y && f.y >= s.y && rand() < 0.3 && s.snow.length < 60) {
              s.snow.push({ u: (f.x - this.sx0) / L, r: Math.min(f.r, 1.8) });
              return false;
            }
          }
        }
        if (f.y > f.endY || f.x > this.w + 20) return false;
        const a = f.y > f.endY - 30 ? (f.endY - f.y) / 30 : 1;
        if (f.r < 1.2) {
          g.fillStyle = rgba(mixc(ink, this.pal.paper, 0.55), 0.6 * a);
          g.beginPath();
          g.arc(f.x, f.y, f.r, 0, TAU);
          g.fill();
        } else {
          g.fillStyle = rgba([255, 255, 255], 0.92 * a);
          g.beginPath();
          g.arc(f.x, f.y, f.r, 0, TAU);
          g.fill();
          g.strokeStyle = rgba(ink, 0.2 * a);
          g.lineWidth = 0.5;
          g.stroke();
        }
        return true;
      });
    }

    // 点：落花、落叶、落梅；秋风亦从画外吹来红叶
    drawFalls(dt) {
      const g = this.g, E = this.E, ink = this.pal.ink;
      if (this.S.id === 'autumn' && this.started) {
        this.acc.leaf += (E.wx * 0.8 + E.wind * 5) * dt;
        while (this.acc.leaf > 1) {
          this.acc.leaf -= 1;
          this.falls.push({ x: rand() * this.w * 0.8 - this.w * 0.1, y: -12, r: (4 + rand() * 5) * this.sizeK, vx: 10 + rand() * 20, vy: 18 + rand() * 18, rot: rand() * TAU, vr: (rand() - 0.5) * 2, born: this.t, life: 14, col: leafColor(0.4 + rand() * 0.6), ph: rand() * TAU, shape: 'leaf' });
        }
      }
      this.falls = this.falls.filter((p) => {
        const age = this.t - p.born;
        if (age > p.life || p.y > this.h + 20) return false;
        p.vy += 6 * dt;
        if (p.shape === 'leaf') p.vy = Math.min(p.vy, 40);
        p.x += (p.vx + Math.sin(this.t * 1.3 + p.ph) * (p.shape === 'leaf' ? 22 : 12) + E.wind * 90) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const a = 1 - age / p.life;
        if (p.shape === 'leaf') {
          drawMaple(g, p.x, p.y, p.r, p.rot, Math.cos(this.t * 2 + p.ph), p.col, 0.75 * a, ink);
        } else if (p.shape === 'plum') {
          g.fillStyle = rgba(p.col, 0.7 * a);
          g.beginPath();
          g.arc(p.x, p.y, p.r * 0.7, 0, TAU);
          g.fill();
        } else {
          g.fillStyle = rgba(p.col, 0.55 * a);
          g.beginPath();
          g.ellipse(p.x, p.y, p.r, p.r * 0.55, p.rot, 0, TAU);
          g.fill();
        }
        return true;
      });
    }

    // 线：冰晶（冬日泛音）
    drawCrystals() {
      const g = this.g;
      const col = mixc(this.pal.ink, this.modeRgb, 0.5);
      this.crystals = this.crystals.filter((c) => {
        const age = this.t - c.born;
        const p = age / c.life;
        if (p >= 1) return false;
        const a = 0.6 * Math.pow(1 - p, 1.2) * Math.min(1, age / 0.3);
        const r = c.r * (0.6 + 0.4 * easeOut(Math.min(1, age / 0.8)));
        g.save();
        g.translate(c.x, c.y + c.vy * age);
        g.rotate(c.rot + age * 0.2);
        g.strokeStyle = rgba(col, a);
        g.lineWidth = 0.7;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (k * TAU) / 6;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          g.moveTo(0, 0);
          g.lineTo(ca * r, sa * r);
          const bx = ca * r * 0.55, by = sa * r * 0.55;
          for (const sd of [-0.6, 0.6]) {
            g.moveTo(bx, by);
            g.lineTo(bx + Math.cos(ang + sd) * r * 0.3, by + Math.sin(ang + sd) * r * 0.3);
          }
        }
        g.stroke();
        g.restore();
        return true;
      });
    }

    // 面与线：闪电
    drawFlash(dt) {
      if (this.flash <= 0) return;
      const g = this.g;
      const f = this.flash;
      g.fillStyle = rgba([255, 255, 255], f * 0.32);
      g.fillRect(0, 0, this.w, this.h);
      if (this.bolt) {
        g.strokeStyle = rgba(this.pal.ink, f * 0.7);
        g.lineWidth = 1.2;
        g.beginPath();
        this.bolt.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
        g.lineWidth = 0.7;
        g.beginPath();
        this.bolt.br.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
      }
      this.flash = Math.max(0, f - dt * (f > 0.5 ? 3.5 : 1.6));
      if (this.flash === 0) this.bolt = null;
    }

    // 线与点：进程，按本季实际段落标注
    drawProgress() {
      const g = this.g, ink = this.pal.ink, S = this.S;
      const y = this.progY, x0 = this.sx0, x1 = this.sx1, L = x1 - x0;
      const prog = this.started ? this.progress : 0;
      const px = x0 + L * prog;
      g.lineWidth = 1;
      g.strokeStyle = rgba(ink, 0.16);
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
      g.strokeStyle = rgba(ink, 0.55);
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(px, y);
      g.stroke();
      g.font = `11px ${FONT}`;
      g.textAlign = 'center';
      const marks = S.secStarts.map((s) => s / S.total).concat([1]);
      let cur = 0;
      for (let k = 0; k < 4; k++) if (prog >= marks[k]) cur = k;
      for (let k = 0; k <= 4; k++) {
        g.fillStyle = rgba(ink, 0.4);
        g.beginPath();
        g.arc(x0 + L * marks[k], y, 1.6, 0, TAU);
        g.fill();
        if (k < 4) {
          g.fillStyle = k === cur ? rgba(mixc(ink, this.modeRgb, 0.6), 0.85) : rgba(ink, 0.3);
          g.fillText(S.sections[k].name, x0 + L * (marks[k] + marks[k + 1]) * 0.5, y - 10);
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

    // 预览（尚未开始时，悬停季节即换景）
    preview(S) {
      if (this.started || S === this.S) return;
      this.setSeason(S);
    }
  }

  C.Visual = Visual;
})();
