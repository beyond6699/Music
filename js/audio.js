/* 音频引擎：古筝/古琴(Karplus-Strong 物理建模)、泛音、箫/笛(气声)、钟(模态合成)、四季自然声与合成空间混响 */
(function () {
  'use strict';
  const C = (window.Chun = window.Chun || {});
  const TONIC = 146.83; // D3
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = Math.random;

  function makeNoise(ctx, seconds, pink) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rand() * 2 - 1;
      if (!pink) { d[i] = w * 0.5; continue; }
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  // 合成冲激响应：早期反射 + 逐渐变暗的指数尾音，模拟山谷/厅堂
  function makeIR(ctx, seconds, power) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.pow(1 - i / len, power) * Math.min(1, t / 0.012);
        const c = 0.06 + 0.8 * Math.exp(-t * 2.4);
        lp += c * (rand() * 2 - 1 - lp);
        d[i] = lp * env;
      }
      for (let k = 0; k < 12; k++) {
        const idx = Math.floor(sr * (0.006 + rand() * 0.075));
        d[idx] += (rand() * 2 - 1) * 0.5 * (1 - k / 12);
      }
    }
    return ir;
  }

  // 弦的音色参数：古筝用义甲（亮、瞬态明显），古琴用指肉（暗、余韵长）
  const TIMBRE = {
    zheng: { exc: 0.55, pos: 0.14, t60: 9, min: 1.4, max: 9, cap: 6.5, tr: 0.35 },
    qin: { exc: 0.26, pos: 0.2, t60: 13, min: 2.2, max: 12, cap: 6.5, tr: 0.1 },
  };

  // Karplus-Strong 拨弦：噪声激励 + 拨弦位置梳状滤波 + 损耗环路 + 触弦瞬态
  function makeString(sr, f, tb) {
    const period = sr / f;
    const N = Math.max(2, Math.floor(period - 0.5));
    const rate = (N + 0.5) / period;
    const T60 = clamp(tb.t60 * Math.sqrt(73.4 / f), tb.min, tb.max);
    const secs = Math.min(T60 * 0.8, tb.cap);
    const len = Math.floor(sr * secs);
    const out = new Float32Array(len);
    const loop = new Float32Array(N);
    const exc = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += tb.exc * (rand() * 2 - 1 - lp); exc[i] = lp; }
    const P = Math.max(1, Math.floor(N * tb.pos));
    let mean = 0;
    for (let i = 0; i < N; i++) { loop[i] = exc[i] - 0.9 * exc[(i + P) % N]; mean += loop[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) loop[i] -= mean;
    const gLoss = Math.pow(0.001, (N + 0.5) / (T60 * sr));
    let idx = 0;
    for (let n = 0; n < len; n++) {
      const a = loop[idx];
      const nx = idx + 1 === N ? 0 : idx + 1;
      out[n] = a;
      loop[idx] = gLoss * 0.5 * (a + loop[nx]);
      idx = nx;
    }
    const tn = Math.min(len, Math.floor(sr * 0.008));
    for (let n = 0; n < tn; n++) out[n] += (rand() * 2 - 1) * tb.tr * Math.exp(-n / (sr * 0.0012));
    let x1 = 0, y1 = 0;
    for (let n = 0; n < len; n++) { const x = out[n]; const y = x - x1 + 0.995 * y1; x1 = x; y1 = y; out[n] = y; }
    let pk = 0;
    const scan = Math.min(len, Math.floor(sr * 0.2));
    for (let n = 0; n < scan; n++) pk = Math.max(pk, Math.abs(out[n]));
    const s = 0.8 / (pk || 1);
    const fl = Math.floor(sr * 0.05);
    for (let n = 0; n < len; n++) out[n] *= s * (n > len - fl ? (len - n) / fl : 1);
    return { data: out, rate, secs };
  }

  // 管乐：箫（低沉、气声重）与笛（明亮、带笛膜的沙音）
  const WIND = {
    xiao: { lo: 285, hi: 1250, imag: [0, 1, 0.2, 0.11, 0.035, 0.02, 0.008], lpf: 3400, breath: 2.2, air: 0.22, vib: 4.9, depth: [9, 17], peak: 0.15, q: 11, buzz: 0 },
    dizi: { lo: 520, hi: 2350, imag: [0, 1, 0.42, 0.26, 0.16, 0.09, 0.06, 0.035, 0.02], lpf: 7000, breath: 1.1, air: 0.14, vib: 5.8, depth: [7, 14], peak: 0.105, q: 16, buzz: 0.55 },
  };

  class Wind {
    constructor(E, cfg) {
      const ctx = E.ctx;
      this.E = E;
      this.cfg = cfg;
      this.notes = [];
      this.lastEnd = -1;
      this.out = E.gain(1);
      this.out.connect(E.xBus);
      const imag = new Float32Array(cfg.imag);
      this.osc = ctx.createOscillator();
      this.osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(imag.length), imag));
      this.osc.frequency.value = 440;
      this.amp = E.gain(0);
      this.lp = ctx.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = cfg.lpf;
      this.lp.Q.value = 0.2;
      this.osc.connect(this.amp);
      this.amp.connect(this.lp);
      this.lp.connect(this.out);
      this.vib = ctx.createOscillator();
      this.vib.frequency.value = cfg.vib;
      this.vibG = E.gain(0);
      this.vib.connect(this.vibG);
      this.vibG.connect(this.osc.detune);
      const ns = ctx.createBufferSource();
      ns.buffer = E.noise;
      ns.loop = true;
      this.bp = ctx.createBiquadFilter();
      this.bp.type = 'bandpass';
      this.bp.Q.value = cfg.q;
      this.bp.frequency.value = 440;
      this.breath = E.gain(0);
      ns.connect(this.bp);
      this.bp.connect(this.breath);
      this.breath.connect(this.lp);
      const airF = ctx.createBiquadFilter();
      airF.type = 'bandpass';
      airF.frequency.value = 4200;
      airF.Q.value = 0.6;
      this.air = E.gain(0);
      ns.connect(airF);
      airF.connect(this.air);
      this.air.connect(this.out);
      if (cfg.buzz) {
        this.bz = ctx.createBiquadFilter();
        this.bz.type = 'bandpass';
        this.bz.Q.value = 22;
        this.bz.frequency.value = 880;
        this.buzz = E.gain(0);
        ns.connect(this.bz);
        this.bz.connect(this.buzz);
        this.buzz.connect(this.out);
      }
      const t0 = ctx.currentTime + 0.01;
      this.osc.start(t0);
      this.vib.start(t0);
      ns.start(t0);
    }

    note(deg, t, dur, vel, vib) {
      const E = this.E, cfg = this.cfg;
      const ctx = E.ctx;
      t = Math.max(t, ctx.currentTime + 0.005);
      let f = E.freqOf(deg);
      while (f < cfg.lo) f *= 2;
      while (f > cfg.hi) f /= 2;
      const legato = t - this.lastEnd < 0.06;
      const peak = cfg.peak * vel;
      const bw = 1 + E.wind * 1.2;
      const params = [this.amp.gain, this.breath.gain, this.air.gain, this.vibG.gain];
      if (this.buzz) params.push(this.buzz.gain);
      params.forEach((p) => p.cancelScheduledValues(t));
      this.osc.frequency.setTargetAtTime(f, t, legato ? 0.03 : 0.004);
      this.bp.frequency.setTargetAtTime(f, t, 0.01);
      if (this.bz) this.bz.frequency.setTargetAtTime(f * 2, t, 0.01);
      if (!legato) {
        this.osc.detune.setValueAtTime(-30, t);
        this.osc.detune.setTargetAtTime(0, t, 0.06);
      }
      this.amp.gain.setTargetAtTime(peak, t, legato ? 0.03 : 0.07);
      this.breath.gain.setTargetAtTime(peak * cfg.breath * bw, t, 0.04);
      this.air.gain.setTargetAtTime(peak * cfg.air * bw, t, 0.006);
      this.air.gain.setTargetAtTime(peak * cfg.air * 0.25 * bw, t + 0.05, 0.06);
      if (this.buzz) this.buzz.gain.setTargetAtTime(peak * cfg.buzz, t, 0.05);
      this.vibG.gain.setTargetAtTime(0, t, 0.04);
      if (dur > 0.7) {
        this.vibG.gain.setTargetAtTime(vib ? cfg.depth[1] : cfg.depth[0], t + 0.35, 0.35);
        this.amp.gain.setTargetAtTime(peak * 1.12, t + dur * 0.35, dur * 0.3);
      }
      const rel = t + Math.max(0.08, dur - 0.05);
      this.amp.gain.setTargetAtTime(0, rel, 0.07);
      this.breath.gain.setTargetAtTime(0, rel, 0.06);
      this.air.gain.setTargetAtTime(0, rel, 0.05);
      if (this.buzz) this.buzz.gain.setTargetAtTime(0, rel, 0.05);
      this.lastEnd = t + dur;
      this.notes.push({ t, end: t + dur, f, vel, deg });
      while (this.notes.length && this.notes[0].end < ctx.currentTime - 3) this.notes.shift();
      E.emit({ type: 'xiao', time: t, deg, dur, vel, f });
    }
  }

  class Engine {
    constructor() {
      this.season = C.SEASONS[0];
      this.mode = this.season.mode;
      this.light = this.season.light;
      this.wind = 0;
      this.weather = this.season.weather.def;
      this.creature = this.season.creature.def;
      this.autoWx = 0;
      this.section = 0;
      this.listeners = [];
      this.cache = new Map();
      this.ready = false;
      this.cicSwell = 0.5;
      this.nextBell = 0;
    }

    on(fn) { this.listeners.push(fn); }
    emit(e) { for (const fn of this.listeners) fn(e); }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    get id() { return this.season.id; }
    // 实际天气：用户关闭则无；否则乐曲段落可将其加强（如夏之雷雨、冬之大雪）
    get wx() { return this.weather === 0 ? 0 : Math.max(this.weather, this.autoWx || 0); }

    gain(v) { const n = this.ctx.createGain(); n.gain.value = v; return n; }

    semis(deg) {
      const set = C.MODES[this.mode].set;
      const o = Math.floor(deg / 5);
      return set[deg - o * 5] + 12 * o;
    }

    freqOf(deg) { return TONIC * Math.pow(2, this.semis(deg) / 12); }

    windInst() { return this.season.wind === 'dizi' ? this.dizi : this.xiao; }

    setSeason(S) {
      this.season = S;
      this.mode = S.mode;
      this.weather = S.weather.def;
      this.creature = S.creature.def;
      this.autoWx = 0;
      this.setLight(S.light);
      this.nextBell = this.now + 8;
      for (const k of this.cache.keys()) if (!k.startsWith(S.str)) this.cache.delete(k);
      if (this.ready) this.precache(S.str);
    }

    init() {
      if (this.ready) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

      this.master = this.gain(0);
      this.tone = ctx.createBiquadFilter();
      this.tone.type = 'lowpass';
      this.tone.Q.value = 0.4;
      this.tone.frequency.value = 8000;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.knee.value = 18;
      this.comp.ratio.value = 2.5;
      this.comp.attack.value = 0.02;
      this.comp.release.value = 0.35;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;

      this.dry = this.gain(1);
      this.send = this.gain(1);
      const pre = ctx.createDelay(0.2);
      pre.delayTime.value = 0.028;
      this.conv = ctx.createConvolver();
      this.conv.buffer = makeIR(ctx, 4.6, 3.0);
      this.wet = this.gain(0.4);
      this.dry.connect(this.tone);
      this.send.connect(pre);
      pre.connect(this.conv);
      this.conv.connect(this.wet);
      this.wet.connect(this.tone);
      this.tone.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      const eq = (type, f, q, g) => {
        const b = ctx.createBiquadFilter();
        b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g;
        return b;
      };
      // 琴身共鸣：低频箱体 + 中频凹陷 + 亮度 + 高频柔化
      this.zBus = this.gain(0.9);
      const e1 = eq('peaking', 190, 0.9, 3);
      const e2 = eq('peaking', 750, 1.4, -2);
      const e3 = eq('peaking', 2700, 1.2, 2.5);
      const e4 = eq('highshelf', 6500, 0.7, -7);
      this.zBus.connect(e1); e1.connect(e2); e2.connect(e3); e3.connect(e4);
      const zd = this.gain(0.85), zs = this.gain(0.38);
      e4.connect(zd); e4.connect(zs); zd.connect(this.dry); zs.connect(this.send);

      this.xBus = this.gain(1);
      const xd = this.gain(0.8), xs = this.gain(0.55);
      this.xBus.connect(xd); this.xBus.connect(xs); xd.connect(this.dry); xs.connect(this.send);

      this.nBus = this.gain(1);
      const nd = this.gain(0.8), nsd = this.gain(0.5);
      this.nBus.connect(nd); this.nBus.connect(nsd); nd.connect(this.dry); nsd.connect(this.send);

      // 远处的声音（雁、钟、雷）：更暗、更多混响
      this.farBus = this.gain(1);
      const farLp = eq('lowpass', 2600, 0.5, 0);
      const fd = this.gain(0.35), fs = this.gain(1.1);
      this.farBus.connect(farLp); farLp.connect(fd); farLp.connect(fs); fd.connect(this.dry); fs.connect(this.send);

      this.noise = makeNoise(ctx, 3, false);
      this.pink = makeNoise(ctx, 4, true);
      this.xiao = new Wind(this, WIND.xiao);
      this.dizi = new Wind(this, WIND.dizi);
      this.initNature();
      this.ready = true;
      this.setLight(this.light);
      this.master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.0);
      this.precache(this.season.str);
    }

    // 分批预生成琴弦，避免切换季节/调式时卡顿
    precache(tb) {
      const degs = [];
      for (let d = -5; d <= 19; d++) degs.push(d);
      const mode = this.mode;
      const next = () => {
        if (!degs.length || this.mode !== mode) return;
        this.string(this.freqOf(degs.shift()), tb);
        setTimeout(next, 12);
      };
      next();
    }

    string(f, tb) {
      const key = tb + f.toFixed(2);
      let s = this.cache.get(key);
      if (!s) {
        const r = makeString(this.ctx.sampleRate, f, TIMBRE[tb]);
        const buffer = this.ctx.createBuffer(1, r.data.length, this.ctx.sampleRate);
        buffer.getChannelData(0).set(r.data);
        s = { buffer, rate: r.rate, secs: r.secs };
        this.cache.set(key, s);
      }
      return s;
    }

    zheng(deg, t, o = {}) {
      if (!this.ready) return;
      const ctx = this.ctx;
      t = Math.max(t, ctx.currentTime + 0.002);
      const tb = o.timbre || this.season.str;
      const qin = tb === 'qin';
      const vel = o.vel == null ? 0.7 : o.vel;
      const f = this.freqOf(deg);
      const s = this.string(f, tb);
      const out = this.gain((qin ? 0.62 : 0.5) * vel);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.25;
      lp.frequency.value = qin ? 600 + vel * vel * 3600 : 1200 + vel * vel * 8000;
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp((deg - 7) / 16 + (o.pan || 0), -0.6, 0.6);
      out.connect(lp); lp.connect(pan); pan.connect(this.zBus);
      const life = s.secs / s.rate;
      const n = o.double && !qin ? 2 : 1;
      const srcs = [];
      const bendC = o.bend ? (this.semis(deg) - this.semis(deg - 1)) * 100 : 0;
      for (let k = 0; k < n; k++) {
        const src = ctx.createBufferSource();
        src.buffer = s.buffer;
        src.playbackRate.value = s.rate;
        const base = n === 2 ? (k ? 2.5 : -2.5) : 0;
        if (bendC) {
          // 古琴「上」音：滑行更慢更长
          const a = qin ? 0.05 : 0.1, b = qin ? 0.7 : 0.36;
          src.detune.setValueAtTime(base - bendC, t);
          src.detune.setValueAtTime(base - bendC, t + a);
          src.detune.linearRampToValueAtTime(base, t + b);
        } else {
          src.detune.value = base;
        }
        const sg = this.gain(n === 2 ? (k ? 0.55 : 0.75) : 1);
        src.connect(sg); sg.connect(out);
        src.start(t);
        src.stop(t + life);
        srcs.push(src);
      }
      if (o.vib) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = qin ? 3.2 + rand() * 1.2 : 4.2 + rand() * 1.2;
        const lg = this.gain(0);
        const depth = qin ? 24 : 16;
        lg.gain.setValueAtTime(0, t);
        lg.gain.setValueAtTime(0, t + 0.35);
        lg.gain.linearRampToValueAtTime(depth, t + 0.95);
        lg.gain.linearRampToValueAtTime(depth * 0.3, t + (o.dur || 1) + 0.8);
        lfo.connect(lg);
        srcs.forEach((sr) => lg.connect(sr.detune));
        lfo.start(t);
        lfo.stop(t + life);
      }
      if (o.damp) out.gain.setTargetAtTime(0, t + o.damp, Math.min(0.7, 0.08 + o.damp * 0.25));
      this.emit({ type: 'zheng', time: t, deg, vel, dur: o.dur || 0.5, role: o.role || 'lead', x: o.x });
    }

    // 泛音：轻触弦长二分之一处，得到纯净的八度
    harmonic(deg, t, vel, role, x) {
      if (!this.ready) return;
      const ctx = this.ctx;
      t = Math.max(t, ctx.currentTime + 0.002);
      const f = this.freqOf(deg) * 2;
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp((deg - 7) / 16, -0.6, 0.6);
      const out = this.gain(0.13 * vel);
      out.connect(pan); pan.connect(this.zBus);
      const parts = [[1, 1, 1.5], [2, 0.2, 0.6], [3, 0.07, 0.3]];
      for (const [m, a, tau] of parts) {
        const osc = ctx.createOscillator();
        osc.frequency.value = f * m * (1 + 0.0006 * m * m);
        const pg = this.gain(0);
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(a, t + 0.003);
        pg.gain.setTargetAtTime(0, t + 0.004, tau);
        osc.connect(pg); pg.connect(out);
        osc.start(t);
        osc.stop(t + tau * 7 + 0.1);
      }
      const ns = ctx.createBufferSource();
      ns.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(f, 9000);
      bp.Q.value = 3;
      const ng = this.gain(0);
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.setTargetAtTime(0, t, 0.008);
      ns.connect(bp); bp.connect(ng); ng.connect(out);
      ns.start(t, rand() * 2, 0.08);
      this.emit({ type: 'harm', time: t, deg, vel, role: role || 'lead', x });
    }

    // 刮奏
    gliss(t, dur, up, vel) {
      if (!this.ready) return;
      const degs = [];
      for (let d = -3; d <= 14; d++) degs.push(d);
      if (!up) degs.reverse();
      const n = degs.length;
      const step = dur / n;
      degs.forEach((d, i) => {
        this.zheng(d, t + i * step + rand() * 0.006, {
          vel: vel * (0.45 + 0.55 * (i / (n - 1))),
          role: 'gliss',
          dur: 0.4,
          damp: 1.2 + (n - i) * 0.03,
        });
      });
    }

    // 钟：模态合成，非谐和分音成对微失谐产生「拍」，远处传来
    bell(deg, t, vel) {
      if (!this.ready) return;
      const ctx = this.ctx;
      t = Math.max(t, ctx.currentTime + 0.01);
      const f = this.freqOf(deg);
      const out = this.gain(0.09 * vel);
      const pan = ctx.createStereoPanner();
      pan.pan.value = 0.25;
      out.connect(pan); pan.connect(this.farBus);
      const P = [[0.5, 1, 11], [1, 0.75, 8], [1.183, 0.5, 6], [1.506, 0.4, 5], [2, 0.32, 4], [2.514, 0.22, 3], [2.662, 0.18, 2.6], [3.011, 0.14, 2], [4.166, 0.09, 1.4]];
      for (const [r, a, dec] of P) {
        for (const dt of [-0.6, 0.6]) {
          const o = ctx.createOscillator();
          o.frequency.value = f * r + dt * r;
          const g = this.gain(0);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(a * 0.5, t + 0.004);
          g.gain.setTargetAtTime(0, t + 0.005, dec / 4);
          o.connect(g); g.connect(out);
          o.start(t);
          o.stop(t + dec * 1.6);
        }
      }
      const ns = ctx.createBufferSource();
      ns.buffer = this.pink;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const ng = this.gain(0);
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.setTargetAtTime(0, t, 0.02);
      ns.connect(lp); lp.connect(ng); ng.connect(out);
      ns.start(t, rand() * 2, 0.2);
      this.emit({ type: 'bell', time: t, vel });
    }

    initNature() {
      const ctx = this.ctx;
      const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
      const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

      // 风
      this.windBp = filt('bandpass', 420, 0.6);
      this.windG = this.gain(0);
      loop(this.pink).connect(this.windBp); this.windBp.connect(this.windG); this.windG.connect(this.nBus);

      // 雨
      const hp = filt('highpass', 1800, 0.7), lp = filt('lowpass', 7000, 0.7);
      this.rainG = this.gain(0);
      loop(this.noise).connect(hp); hp.connect(lp); lp.connect(this.rainG); this.rainG.connect(this.nBus);

      // 蝉：高频带通噪声被快速调幅，整体随「齐鸣」起伏
      const cb = filt('bandpass', 5200, 3);
      const cb2 = filt('peaking', 7600, 2, 6);
      this.cicAm = this.gain(0.5);
      const am = ctx.createOscillator();
      am.frequency.value = 88;
      const amG = this.gain(0.5);
      am.connect(amG); amG.connect(this.cicAm.gain); am.start();
      this.cicG = this.gain(0);
      const cp = ctx.createStereoPanner();
      cp.pan.value = -0.35;
      loop(this.noise).connect(cb); cb.connect(cb2); cb2.connect(this.cicAm); this.cicAm.connect(this.cicG); this.cicG.connect(cp); cp.connect(this.nBus);

      // 冬之寒风：高 Q 带通，扫频成呼啸
      this.howlBp = filt('bandpass', 520, 9);
      this.howlG = this.gain(0);
      loop(this.pink).connect(this.howlBp); this.howlBp.connect(this.howlG); this.howlG.connect(this.nBus);

      this.natureTimer = setInterval(() => this.natureTick(), 50);
    }

    natureTick() {
      const ctx = this.ctx;
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const id = this.id, W = this.wx, cr = this.creature, L = this.light, sec = this.section;
      this.wind *= 0.965;
      if (this.wind < 0.001) this.wind = 0;

      const windBase = { spring: 0.012, summer: 0.008, autumn: 0.016 + W * 0.022, winter: 0.01 + W * 0.006 }[id];
      this.windG.gain.setTargetAtTime(windBase + this.wind * 0.22, now, 0.35);
      this.windBp.frequency.setTargetAtTime(280 + this.wind * 900 + 120 * Math.sin(now * 0.23) + (id === 'autumn' ? W * 120 : 0), now, 0.5);

      const rainLv = id === 'spring' ? [0, 0.01, 0.026][W] : id === 'summer' ? [0, 0.014, 0.04][W] : 0;
      this.rainG.gain.setTargetAtTime(rainLv, now, 0.8);
      if (id === 'spring' || id === 'summer') {
        let p = (id === 'spring' ? [0, 5, 18] : [0, 8, 28])[W] * 0.05;
        while (p > 0) {
          if (rand() < p) this.drop(now + 0.05 + rand() * 0.05);
          p -= 1;
        }
      }

      // 蝉鸣（夏日昼）
      if (id === 'summer' && cr && L > 0.3) {
        this.cicSwell = clamp(this.cicSwell + (rand() - 0.5) * 0.08, 0, 1);
        this.cicG.gain.setTargetAtTime(0.014 * (0.25 + 0.75 * this.cicSwell) * (W === 2 ? 0.3 : 1), now, 0.6);
      } else {
        this.cicG.gain.setTargetAtTime(0, now, 0.8);
      }

      // 冬之呼啸
      if (id === 'winter') {
        this.howlG.gain.setTargetAtTime(0.004 + W * 0.009 + this.wind * 0.06, now, 0.6);
        this.howlBp.frequency.setTargetAtTime(420 + 200 * Math.sin(now * 0.17) + 120 * Math.sin(now * 0.41) + this.wind * 500, now, 0.4);
      } else {
        this.howlG.gain.setTargetAtTime(0, now, 0.8);
      }

      if (id === 'spring' && cr) {
        const pr = 0.006 * (0.25 + L * 1.2) * [0.6, 1, 1.4, 0.7][sec];
        if (rand() < pr) this.bird(now + 0.06);
      }
      if (id === 'summer') {
        if (W === 2 && rand() < 0.004) this.thunder(now + 0.05);
        else if (W === 1 && rand() < 0.0006) this.thunder(now + 0.05);
        if (cr && (L < 0.5 || sec === 3) && rand() < 0.03) this.frog(now + 0.05);
      }
      if (id === 'autumn') {
        if (cr && L < 0.65 && rand() < 0.05) this.cricket(now + 0.05);
        if (cr && rand() < 0.0018 * (sec === 1 || sec === 2 ? 1.6 : 1)) this.geese(now + 0.1);
        if (rand() < W * 0.05 + this.wind * 0.3) this.rustle(now + 0.03);
      }
      if (id === 'winter' && cr && now > this.nextBell) {
        this.nextBell = now + 22 + rand() * 18;
        this.bell(0, now + 0.1, 0.55);
      }
    }

    drop(t) {
      const ctx = this.ctx;
      const pan = ctx.createStereoPanner();
      const pv = rand() * 1.8 - 0.9;
      pan.pan.value = pv;
      const out = this.gain(0);
      out.connect(pan); pan.connect(this.nBus);
      if (rand() < 0.55) {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800 + rand() * 4200;
        bp.Q.value = 2 + rand() * 6;
        src.connect(bp); bp.connect(out);
        const a = 0.05 + rand() * 0.08;
        out.gain.setValueAtTime(0, t);
        out.gain.linearRampToValueAtTime(a, t + 0.002);
        out.gain.setTargetAtTime(0, t + 0.003, 0.012 + rand() * 0.02);
        src.start(t, rand() * 2, 0.12);
      } else {
        const o = ctx.createOscillator();
        const f0 = 900 + rand() * 1400;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.04);
        o.connect(out);
        const a = 0.025 + rand() * 0.03;
        out.gain.setValueAtTime(0, t);
        out.gain.linearRampToValueAtTime(a, t + 0.002);
        out.gain.setTargetAtTime(0, t + 0.003, 0.02);
        o.start(t);
        o.stop(t + 0.15);
      }
      this.emit({ type: 'drop', time: t, pan: pv, size: rand() });
    }

    bird(t) {
      const ctx = this.ctx;
      const pv = rand() * 1.6 - 0.8;
      const pan = ctx.createStereoPanner();
      pan.pan.value = pv;
      const out = this.gain(1);
      out.connect(pan); pan.connect(this.nBus);
      const type = Math.floor(rand() * 3);
      const o = ctx.createOscillator();
      const gg = this.gain(0);
      o.connect(gg); gg.connect(out);
      let tt = t;
      const n = 2 + Math.floor(rand() * 5);
      const base = 2300 + rand() * 1600;
      const amp = 0.03 + rand() * 0.02;
      for (let i = 0; i < n; i++) {
        const sd = 0.05 + rand() * 0.09;
        const f1 = base * (0.9 + rand() * 0.3);
        const f2 = type === 0 ? f1 * 1.5 : type === 1 ? f1 * 0.62 : f1 * 1.05;
        o.frequency.setValueAtTime(f1, tt);
        o.frequency.exponentialRampToValueAtTime(f2, tt + sd);
        gg.gain.setValueAtTime(0, tt);
        gg.gain.linearRampToValueAtTime(amp, tt + sd * 0.25);
        gg.gain.linearRampToValueAtTime(0, tt + sd);
        tt += sd + 0.025 + rand() * 0.1;
      }
      if (type === 2) {
        const m = ctx.createOscillator();
        m.frequency.value = 28 + rand() * 22;
        const mg = this.gain(220 + rand() * 200);
        m.connect(mg); mg.connect(o.frequency);
        m.start(t);
        m.stop(tt + 0.1);
      }
      o.start(t);
      o.stop(tt + 0.1);
      this.emit({ type: 'bird', time: t, pan: pv, dur: tt - t, n });
    }

    // 蛙：带通噪声被短脉冲串门控，成「咯咯」声
    frog(t) {
      const ctx = this.ctx;
      const pv = -0.7 + rand() * 0.9;
      const pan = ctx.createStereoPanner();
      pan.pan.value = pv;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 380 + rand() * 260;
      bp.Q.value = 7;
      const g = this.gain(0);
      src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(this.nBus);
      const croaks = 1 + Math.floor(rand() * 3);
      const amp = 0.25 + rand() * 0.2;
      let tt = t;
      for (let c = 0; c < croaks; c++) {
        const pulses = 5 + Math.floor(rand() * 5);
        for (let k = 0; k < pulses; k++) {
          g.gain.setValueAtTime(0, tt);
          g.gain.linearRampToValueAtTime(amp, tt + 0.004);
          g.gain.setTargetAtTime(0, tt + 0.006, 0.008);
          tt += 0.03;
        }
        tt += 0.12 + rand() * 0.15;
      }
      src.start(t, rand() * 2, tt - t + 0.1);
      this.emit({ type: 'frog', time: t, pan: pv });
    }

    // 雷：先见闪电，后闻雷声；低频滚动 + 起首的炸裂
    thunder(t) {
      const ctx = this.ctx;
      const delay = 0.4 + rand() * 1.6;
      const ts = t + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.pink;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160 + rand() * 120;
      const g = this.gain(0);
      src.connect(lp); lp.connect(g); g.connect(this.farBus);
      const a = 0.9 * (1 - delay / 2.4) + 0.3;
      g.gain.setValueAtTime(0, ts);
      g.gain.linearRampToValueAtTime(a, ts + 0.12);
      g.gain.setTargetAtTime(a * 0.5, ts + 0.15, 0.4);
      g.gain.setTargetAtTime(0, ts + 1.2, 1.1);
      src.start(ts, rand(), 5);
      const c = ctx.createBufferSource();
      c.buffer = this.noise;
      const cb = ctx.createBiquadFilter();
      cb.type = 'bandpass';
      cb.frequency.value = 900;
      cb.Q.value = 0.8;
      const cg = this.gain(0);
      c.connect(cb); cb.connect(cg); cg.connect(this.farBus);
      cg.gain.setValueAtTime(0, ts);
      cg.gain.linearRampToValueAtTime(0.12 * (1.4 - delay / 2), ts + 0.01);
      cg.gain.setTargetAtTime(0, ts + 0.02, 0.12);
      c.start(ts, rand() * 2, 0.8);
      this.emit({ type: 'thunder', time: t });
    }

    // 蟋蟀：高频短促的颤鸣
    cricket(t) {
      const ctx = this.ctx;
      const pv = 0.2 + rand() * 0.7;
      const pan = ctx.createStereoPanner();
      pan.pan.value = pv;
      const o = ctx.createOscillator();
      o.frequency.value = 4200 + rand() * 700;
      const g = this.gain(0);
      o.connect(g); g.connect(pan); pan.connect(this.nBus);
      const n = 3 + Math.floor(rand() * 3);
      const amp = 0.008 + rand() * 0.008;
      let tt = t;
      for (let k = 0; k < n; k++) {
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(amp, tt + 0.004);
        g.gain.linearRampToValueAtTime(0, tt + 0.018);
        tt += 0.034;
      }
      o.start(t);
      o.stop(tt + 0.05);
      this.emit({ type: 'cricket', time: t, pan: pv });
    }

    // 雁：远处的鸣叫，三角波经共振峰带通，音高短促下滑
    geese(t) {
      const ctx = this.ctx;
      const dir = rand() < 0.5 ? 1 : -1;
      const n = 2 + Math.floor(rand() * 3);
      let tt = t;
      for (let k = 0; k < n; k++) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        const f = 360 + rand() * 90;
        o.frequency.setValueAtTime(f * 1.06, tt);
        o.frequency.exponentialRampToValueAtTime(f * 0.84, tt + 0.2);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1050 + rand() * 300;
        bp.Q.value = 2.5;
        const pan = ctx.createStereoPanner();
        pan.pan.value = clamp(-dir * 0.6 + (k / n) * dir * 1.2, -0.8, 0.8);
        const g = this.gain(0);
        o.connect(bp); bp.connect(g); g.connect(pan); pan.connect(this.farBus);
        const a = 0.16 + rand() * 0.06;
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(a, tt + 0.03);
        g.gain.linearRampToValueAtTime(a * 0.6, tt + 0.14);
        g.gain.linearRampToValueAtTime(0, tt + 0.24);
        o.start(tt);
        o.stop(tt + 0.3);
        tt += 0.32 + rand() * 0.5;
      }
      this.emit({ type: 'geese', time: t, dir });
    }

    // 落叶沙沙：一簇极短的高频噪声颗粒
    rustle(t) {
      const ctx = this.ctx;
      const pan = ctx.createStereoPanner();
      pan.pan.value = rand() * 1.6 - 0.8;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800 + rand() * 4000;
      bp.Q.value = 1.2;
      const g = this.gain(0);
      src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(this.nBus);
      const n = 5 + Math.floor(rand() * 9);
      for (let k = 0; k < n; k++) {
        const tt = t + rand() * 0.45;
        const a = 0.03 + rand() * 0.05;
        g.gain.setValueAtTime(a, tt);
        g.gain.setTargetAtTime(0, tt + 0.002, 0.006);
      }
      src.start(t, rand() * 2, 0.6);
    }

    setLight(v) {
      this.light = clamp(v, 0, 1);
      if (!this.ready) return;
      const now = this.ctx.currentTime;
      this.tone.frequency.setTargetAtTime(2200 * Math.pow(2, this.light * 2.7), now, 0.3);
      this.wet.gain.setTargetAtTime(0.55 - this.light * 0.25, now, 0.4);
    }

    setMode(i) { this.mode = i; }

    level() {
      if (!this.ready) return 0;
      if (!this._buf) this._buf = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(this._buf);
      let s = 0;
      for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i];
      return Math.sqrt(s / this._buf.length);
    }
  }

  C.Engine = Engine;
})();
