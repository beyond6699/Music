/* 指挥：前瞻调度器，按八分音符推进乐曲，并把用户状态（调式/晨昏/雨）融入演奏 */
(function () {
  'use strict';
  const C = window.Chun;

  class Conductor {
    constructor(E) {
      this.E = E;
      this.step = 0;
      this.total = C.TOTAL_STEPS;
      this.nextTime = 0;
      this.timer = null;
    }

    eighth() { return 60 / (56 + 16 * this.E.light) / 2; }
    get barDur() { return this.eighth() * 8; }

    start() {
      this.nextTime = this.E.ctx.currentTime + 0.25;
      if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    }

    seek(step) { this.step = ((step % this.total) + this.total) % this.total; }

    tick() {
      const ctx = this.E.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const ahead = document.hidden ? 1.2 : 0.22;
      if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
      while (this.nextTime < ctx.currentTime + ahead) {
        const s = this.step;
        const p = s % 32;
        const ei = Math.floor(s / 32);
        let d = this.eighth();
        if (ei % 3 === 2 && p >= 28) d *= 1 + 0.07 * (p - 27); // 段落尾的呼吸（渐慢）
        this.play(s, this.nextTime, d);
        this.nextTime += d;
        this.step = (s + 1) % this.total;
      }
    }

    play(s, t, d) {
      const E = this.E;
      const st = C.STRUCTURE;
      const ei = Math.floor(s / 32);
      const entry = st[ei];
      const p = s % 32;
      const bar = p >> 3;
      const pos = p & 7;
      const ph = C.PHRASES[entry.ph];
      const hum = () => (Math.random() - 0.5) * 0.014;
      E.section = entry.sec;
      E.emit({ type: 'step', time: t, step: s, dur: d, total: this.total, sec: entry.sec });

      for (const ev of ph.at[p] || []) this.lead(entry.lead, ev, t, d);

      if (entry.xiao) {
        const xp = entry.xiao === 'double' ? ph.doubled : C.PHRASES[entry.xiao];
        for (const ev of xp.at[p] || []) E.xiao.note(ev.deg, t + 0.012, ev.len * d * 0.98, 0.62, ev.vib);
      }

      const root = ph.roots[bar];
      for (const a of C.ACC[entry.acc]) {
        if (a[0] !== pos) continue;
        E.zheng(root + a[1], t + hum() + 0.004, {
          vel: a[3] * (0.9 + Math.random() * 0.2) * (0.85 + E.light * 0.3),
          dur: a[2] * d,
          role: 'acc',
          damp: a[2] * d + 1.2,
        });
      }

      if (p === 30) {
        const nx = st[(ei + 1) % st.length];
        if (nx.gliss) E.gliss(t, d * 1.9, nx.gliss === 'up', 0.45);
      }

      // 雨滴落弦：随雨势在弱拍点缀高音泛音
      if (E.rain > 0 && pos & 1 && Math.random() < 0.05 * E.rain) {
        E.harmonic(10 + Math.floor(Math.random() * 5), t + hum() + 0.01, 0.25, 'drip');
      }
    }

    lead(kind, ev, t, d) {
      const E = this.E;
      const dur = ev.len * d;
      if (kind === 'xiao') {
        E.xiao.note(ev.deg, t, dur * 0.97, 0.8, ev.vib || ev.len >= 4);
        return;
      }
      if (ev.harm) { E.harmonic(ev.deg, t, 0.75, 'lead'); return; }
      // 日高时多加倚音，旋律更明媚
      if (E.light > 0.68 && ev.len >= 3 && !ev.bend && Math.random() < 0.45) {
        E.zheng(ev.deg + 1, t - 0.075, { vel: 0.3, role: 'grace', dur: 0.08, damp: 0.25 });
      }
      E.zheng(ev.deg, t, {
        vel: 0.78 + Math.random() * 0.1,
        dur,
        role: 'lead',
        double: true,
        vib: ev.vib || ev.len >= 4,
        bend: ev.bend,
        damp: dur + 2.4,
      });
    }
  }

  C.Conductor = Conductor;
})();
