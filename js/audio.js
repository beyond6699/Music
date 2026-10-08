/* 音频引擎：古筝(Karplus-Strong 物理建模)、泛音、箫(气声)、雨/风/鸟，以及合成空间混响 */
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

  // Karplus-Strong 拨弦：噪声激励 + 拨弦位置梳状滤波 + 损耗环路 + 义甲触弦瞬态
  function makeString(sr, f) {
    const period = sr / f;
    const N = Math.max(2, Math.floor(period - 0.5));
    const rate = (N + 0.5) / period;
    const T60 = clamp(9 * Math.sqrt(73.4 / f), 1.4, 9);
    const secs = Math.min(T60 * 0.8, 6.5);
    const len = Math.floor(sr * secs);
    const out = new Float32Array(len);
    const loop = new Float32Array(N);
    const exc = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += 0.55 * (rand() * 2 - 1 - lp); exc[i] = lp; }
    const P = Math.max(1, Math.floor(N * 0.14));
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
    for (let n = 0; n < tn; n++) out[n] += (rand() * 2 - 1) * 0.35 * Math.exp(-n / (sr * 0.0012));
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

  class Xiao {
    constructor(E) {
      const ctx = E.ctx;
      this.E = E;
      this.notes = [];
      this.lastEnd = -1;
      this.out = E.gain(1);
      this.out.connect(E.xBus);
      const real = new Float32Array(7);
      const imag = new Float32Array([0, 1, 0.2, 0.11, 0.035, 0.02, 0.008]);
      this.osc = ctx.createOscillator();
      this.osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      this.osc.frequency.value = 440;
      this.amp = E.gain(0);
      this.lp = ctx.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 3400;
      this.lp.Q.value = 0.2;
      this.osc.connect(this.amp);
      this.amp.connect(this.lp);
      this.lp.connect(this.out);
      this.vib = ctx.createOscillator();
      this.vib.frequency.value = 4.9;
      this.vibG = E.gain(0);
      this.vib.connect(this.vibG);
      this.vibG.connect(this.osc.detune);
      const ns = ctx.createBufferSource();
      ns.buffer = E.noise;
      ns.loop = true;
      this.bp = ctx.createBiquadFilter();
      this.bp.type = 'bandpass';
      this.bp.Q.value = 11;
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
      const t0 = ctx.currentTime + 0.01;
      this.osc.start(t0);
      this.vib.start(t0);
      ns.start(t0);
    }

    note(deg, t, dur, vel, vib) {
      const E = this.E;
      const ctx = E.ctx;
      t = Math.max(t, ctx.currentTime + 0.005);
      let f = E.freqOf(deg);
      while (f < 285) f *= 2;
      while (f > 1250) f /= 2;
      const legato = t - this.lastEnd < 0.06;
      const peak = 0.15 * vel;
      const bw = 1 + E.wind * 1.2;
      [this.amp.gain, this.breath.gain, this.air.gain, this.vibG.gain].forEach((p) => p.cancelScheduledValues(t));
      this.osc.frequency.setTargetAtTime(f, t, legato ? 0.03 : 0.004);
      this.bp.frequency.setTargetAtTime(f, t, 0.01);
      if (!legato) {
        this.osc.detune.setValueAtTime(-30, t);
        this.osc.detune.setTargetAtTime(0, t, 0.06);
      }
      this.amp.gain.setTargetAtTime(peak, t, legato ? 0.03 : 0.07);
      this.breath.gain.setTargetAtTime(peak * 2.2 * bw, t, 0.04);
      this.air.gain.setTargetAtTime(peak * 0.22 * bw, t, 0.006);
      this.air.gain.setTargetAtTime(peak * 0.05 * bw, t + 0.05, 0.06);
      this.vibG.gain.setTargetAtTime(0, t, 0.04);
      if (dur > 0.7) {
        this.vibG.gain.setTargetAtTime(vib ? 17 : 9, t + 0.35, 0.35);
        this.amp.gain.setTargetAtTime(peak * 1.12, t + dur * 0.35, dur * 0.3);
      }
      const rel = t + Math.max(0.08, dur - 0.05);
      this.amp.gain.setTargetAtTime(0, rel, 0.07);
      this.breath.gain.setTargetAtTime(0, rel, 0.06);
      this.air.gain.setTargetAtTime(0, rel, 0.05);
      this.lastEnd = t + dur;
      this.notes.push({ t, end: t + dur, f, vel, deg });
      while (this.notes.length && this.notes[0].end < ctx.currentTime - 3) this.notes.shift();
      E.emit({ type: 'xiao', time: t, deg, dur, vel, f });
    }
  }

  class Engine {
    constructor() {
      this.mode = 2;
      this.light = 0.55;
      this.wind = 0;
      this.rain = 1;
      this.birds = true;
      this.section = 0;
      this.listeners = [];
      this.cache = new Map();
      this.ready = false;
    }

    on(fn) { this.listeners.push(fn); }
    emit(e) { for (const fn of this.listeners) fn(e); }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }

    gain(v) { const n = this.ctx.createGain(); n.gain.value = v; return n; }

    semis(deg) {
      const set = C.MODES[this.mode].set;
      const o = Math.floor(deg / 5);
      return set[deg - o * 5] + 12 * o;
    }

    freqOf(deg) { return TONIC * Math.pow(2, this.semis(deg) / 12); }

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
      // 琴身共鸣：低频箱体 + 中频凹陷 + 义甲亮度 + 高频柔化
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

      this.noise = makeNoise(ctx, 3, false);
      this.pink = makeNoise(ctx, 4, true);
      this.xiao = new Xiao(this);
      this.initNature();
      this.ready = true;
      this.setLight(this.light);
      this.master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.0);
      for (let d = -5; d <= 19; d++) this.string(this.freqOf(d));
    }

    string(f) {
      const key = f.toFixed(2);
      let s = this.cache.get(key);
      if (!s) {
        const r = makeString(this.ctx.sampleRate, f);
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
      const vel = o.vel == null ? 0.7 : o.vel;
      const f = this.freqOf(deg);
      const s = this.string(f);
      const out = this.gain(0.5 * vel);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.25;
      lp.frequency.value = 1200 + vel * vel * 8000;
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp((deg - 7) / 16 + (o.pan || 0), -0.6, 0.6);
      out.connect(lp); lp.connect(pan); pan.connect(this.zBus);
      const life = s.secs / s.rate;
      const n = o.double ? 2 : 1;
      const srcs = [];
      const bendC = o.bend ? (this.semis(deg) - this.semis(deg - 1)) * 100 : 0;
      for (let k = 0; k < n; k++) {
        const src = ctx.createBufferSource();
        src.buffer = s.buffer;
        src.playbackRate.value = s.rate;
        const base = n === 2 ? (k ? 2.5 : -2.5) : 0;
        if (bendC) {
          src.detune.setValueAtTime(base - bendC, t);
          src.detune.setValueAtTime(base - bendC, t + 0.1);
          src.detune.linearRampToValueAtTime(base, t + 0.36);
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
        lfo.frequency.value = 4.2 + rand() * 1.2;
        const lg = this.gain(0);
        lg.gain.setValueAtTime(0, t);
        lg.gain.setValueAtTime(0, t + 0.35);
        lg.gain.linearRampToValueAtTime(16, t + 0.95);
        lg.gain.linearRampToValueAtTime(5, t + (o.dur || 1) + 0.8);
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

    initNature() {
      const ctx = this.ctx;
      const w = ctx.createBufferSource();
      w.buffer = this.pink;
      w.loop = true;
      this.windBp = ctx.createBiquadFilter();
      this.windBp.type = 'bandpass';
      this.windBp.frequency.value = 420;
      this.windBp.Q.value = 0.6;
      this.windG = this.gain(0);
      w.connect(this.windBp); this.windBp.connect(this.windG); this.windG.connect(this.nBus);
      w.start();
      const r = ctx.createBufferSource();
      r.buffer = this.noise;
      r.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      this.rainG = this.gain(0);
      r.connect(hp); hp.connect(lp); lp.connect(this.rainG); this.rainG.connect(this.nBus);
      r.start();
      this.natureTimer = setInterval(() => this.natureTick(), 50);
    }

    natureTick() {
      const ctx = this.ctx;
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      this.wind *= 0.965;
      if (this.wind < 0.001) this.wind = 0;
      this.windG.gain.setTargetAtTime(0.012 + this.wind * 0.22 + (this.section === 2 ? 0.01 : 0), now, 0.35);
      this.windBp.frequency.setTargetAtTime(280 + this.wind * 900 + 120 * Math.sin(now * 0.23), now, 0.5);
      this.rainG.gain.setTargetAtTime([0, 0.01, 0.026][this.rain], now, 0.8);
      let p = [0, 5, 18][this.rain] * 0.05;
      while (p > 0) {
        if (rand() < p) this.drop(now + 0.05 + rand() * 0.05);
        p -= 1;
      }
      if (this.birds) {
        const pr = 0.006 * (0.25 + this.light * 1.2) * [0.6, 1, 1.4, 0.7][this.section];
        if (rand() < pr) this.bird(now + 0.06);
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
