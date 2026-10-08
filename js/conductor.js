/* 指挥：前瞻调度器，按八分音符推进当季乐曲；处理季节切换、四季轮转与段落天气 */
(function () {
  'use strict';
  const C = window.Chun;
  const rand = Math.random;

  class Conductor {
    constructor(E) {
      this.E = E;
      this.S = null;
      this.step = 0;
      this.nextTime = 0;
      this.timer = null;
      this.pending = null;
      this.cycle = false;
    }

    get barDur() { return this.S ? C.stepDur(this.S, this.E.light, 0) * 8 : 4; }

    start(S) {
      this.pending = S;
      this.nextTime = this.E.ctx.currentTime + 0.25;
      if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    }

    setSeason(S) { if (!this.S || S !== this.S || this.pending) this.pending = S; }

    seek(step) { if (this.S) this.step = ((step % this.S.total) + this.S.total) % this.S.total; }

    apply(S, t) {
      const first = !this.S;
      this.pending = null;
      this.S = S;
      this.step = 0;
      this.E.setSeason(S);
      this.E.emit({ type: 'season', time: t, S });
      if (!first) this.E.gliss(t, 0.9, S.index % 2 === 0, 0.3);
    }

    tick() {
      const ctx = this.E.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const ahead = document.hidden ? 1.2 : 0.22;
      if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
      while (this.nextTime < ctx.currentTime + ahead) {
        if (this.pending) this.apply(this.pending, this.nextTime);
        const s = this.step;
        const d = C.stepDur(this.S, this.E.light, s);
        this.play(s, this.nextTime, d);
        this.nextTime += d;
        this.step = s + 1;
        if (this.step >= this.S.total) {
          this.step = 0;
          if (this.cycle) this.pending = C.SEASONS[(this.S.index + 1) % C.SEASONS.length];
        }
      }
    }

    play(s, t, d) {
      const E = this.E, S = this.S;
      const ei = s >> 5;
      const entry = S.structure[ei];
      const p = s & 31;
      const bar = p >> 3;
      const pos = p & 7;
      const ph = S.phrases[entry.ph];
      const hum = () => (rand() - 0.5) * 0.014;
      E.section = entry.sec;
      E.autoWx = entry.wx || 0;
      E.emit({ type: 'step', time: t, step: s, dur: d, total: S.total, sec: entry.sec, sid: S.id });

      if (p === 0 && entry.bell && E.creature) E.bell(0, t, 0.75);

      for (const ev of ph.at[p] || []) this.lead(entry.lead, ev, t, d);

      if (entry.wind) {
        const xp = entry.wind === 'double' ? ph.doubled : S.phrases[entry.wind];
        for (const ev of xp.at[p] || []) E.windInst().note(ev.deg, t + 0.012, ev.len * d * 0.98, 0.62, ev.vib);
      }

      const root = ph.roots[bar];
      for (const a of C.ACC[entry.acc]) {
        if (a[0] !== pos) continue;
        E.zheng(root + a[1], t + hum() + 0.004, {
          vel: a[3] * (0.9 + rand() * 0.2) * (0.85 + E.light * 0.3),
          dur: a[2] * d,
          role: 'acc',
          damp: a[2] * d + 1.2,
        });
      }

      if (p === 30) {
        const nx = S.structure[(ei + 1) % S.structure.length];
        if (nx.gliss) E.gliss(t, d * 1.9, nx.gliss === 'up', 0.45);
      }

      // 雨滴落弦 / 雪光闪烁：弱拍点缀高音泛音
      const W = E.wx;
      if (W > 0 && pos & 1) {
        if ((S.id === 'spring' || S.id === 'summer') && rand() < 0.05 * W) {
          E.harmonic(10 + Math.floor(rand() * 5), t + hum() + 0.01, 0.25, 'drip');
        } else if (S.id === 'winter' && rand() < 0.035 * W) {
          E.harmonic(12 + Math.floor(rand() * 5), t + hum() + 0.01, 0.18, 'sparkle');
        }
      }
    }

    lead(kind, ev, t, d) {
      const E = this.E, S = this.S;
      const dur = ev.len * d;
      if (kind === 'wind') {
        E.windInst().note(ev.deg, t, dur * 0.97, 0.8, ev.vib || ev.len >= 4);
        return;
      }
      if (ev.harm) { E.harmonic(ev.deg, t, 0.75, 'lead'); return; }
      const qin = S.str === 'qin';
      // 日高时多加倚音，旋律更明媚
      if (!qin && E.light > 0.68 && ev.len >= 3 && !ev.bend && rand() < 0.45) {
        E.zheng(ev.deg + 1, t - 0.075, { vel: 0.3, role: 'grace', dur: 0.08, damp: 0.25 });
      }
      E.zheng(ev.deg, t, {
        vel: 0.78 + rand() * 0.1,
        dur,
        role: 'lead',
        double: !qin,
        vib: ev.vib || ev.len >= 4,
        bend: ev.bend,
        damp: dur + (qin ? 3.2 : 2.4),
      });
    }
  }

  C.Conductor = Conductor;
})();
