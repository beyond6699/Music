/* 乐谱：五声调式、乐句、伴奏型与曲式结构（起 承 转 合，约三分钟） */
(function () {
  'use strict';
  const C = (window.Chun = window.Chun || {});

  C.NAMES = ['宫', '商', '角', '徵', '羽'];

  // 同一主音上的五种调式音级（半音），对应五行五色
  C.MODES = [
    { name: '宫', el: '土', dir: '中', mood: '敦厚', color: '#c39a4a', set: [0, 2, 4, 7, 9] },
    { name: '商', el: '金', dir: '西', mood: '清朗', color: '#9a968c', set: [0, 2, 5, 7, 10] },
    { name: '角', el: '木', dir: '东', mood: '生发', color: '#4f7f68', set: [0, 3, 5, 8, 10] },
    { name: '徵', el: '火', dir: '南', mood: '明丽', color: '#b4493b', set: [0, 2, 5, 7, 9] },
    { name: '羽', el: '水', dir: '北', mood: '幽远', color: '#34414e', set: [0, 3, 5, 7, 10] },
  ];

  C.degreeNames = (m) => [0, 1, 2, 3, 4].map((i) => C.NAMES[(m + i) % 5]);

  C.SECTIONS = [
    { name: '起', term: '雨水', poem: ['好雨知时节', '当春乃发生'], author: '杜甫' },
    { name: '承', term: '惊蛰', poem: ['微雨众卉新', '一雷惊蛰始'], author: '韦应物' },
    { name: '转', term: '春分', poem: ['等闲识得东风面', '万紫千红总是春'], author: '朱熹' },
    { name: '合', term: '谷雨', poem: ['人闲桂花落', '夜静春山空'], author: '王维' },
  ];

  // 记谱：音级:时值(八分音符数)[~ 吟揉 | ^ 上滑 | h 泛音]，r 为休止；音级 0 = 主音(D3)，5 = 高八度
  function parse(str) {
    const events = [];
    let pos = 0;
    str.replace(/\|/g, ' ').trim().split(/\s+/).forEach((tok) => {
      const m = tok.match(/^(r|-?\d+):(\d+)([~^h]*)$/);
      if (!m) return;
      const len = +m[2];
      if (m[1] !== 'r') {
        events.push({ pos, deg: +m[1], len, vib: m[3].includes('~'), bend: m[3].includes('^'), harm: m[3].includes('h') });
      }
      pos += len;
    });
    return { events, length: pos };
  }

  function index(events) {
    const at = [];
    events.forEach((e) => (at[e.pos] = at[e.pos] || []).push(e));
    return at;
  }

  function build(str, roots) {
    const { events, length } = parse(str);
    const keep = events.filter((e) => e.len >= 2 && !e.harm);
    const dbl = keep.map((e, i) => {
      const next = keep[i + 1];
      return Object.assign({}, e, { len: next ? Math.min(next.pos - e.pos, e.len + 2) : e.len });
    });
    return { events, length, roots, at: index(events), doubled: { at: index(dbl) } };
  }

  const RAW = {
    I: ['r:4 10:4h | r:2 9:2h 8:4h | r:4 7:2h 8:2h | 5:8h', [0, 0, 3, 0]],
    A1: ['5:2 6:1 7:1 8:4~ | 7:2 8:1 9:1 10:3 9:1 | 8:2 7:2 6:2 7:1 6:1 | 5:8~', [0, 3, 1, 0]],
    A2: ['8:2 9:1 10:1 11:4~ | 10:2 9:2 8:3 7:1 | 6:2 7:1 8:1 7:2 6:2 | 5:6~ r:2', [3, 4, 1, 0]],
    B1: ['10:1 11:1 12:2 11:1 10:1 9:2 | 10:3 9:1 8:4~ | 7:1 8:1 9:1 10:1 11:2 10:2 | 9:6^ r:2', [4, 3, 2, 3]],
    B2: ['12:2 13:2 12:1 11:1 10:2 | 9:1 10:1 9:1 8:1 7:4~ | 8:2 7:1 6:1 5:2 6:2 | 7:4 8:4~', [0, 2, 1, 3]],
    C1: ['10:1 9:1 10:1 12:1 11:2 10:2 | 9:1 8:1 9:1 11:1 10:4~ | 12:1 11:1 10:1 9:1 8:1 9:1 10:2 | 11:2 12:2 13:4~', [0, 4, 3, 3]],
    C2: ['13:2 12:1 11:1 12:2 10:2 | 11:1 10:1 9:1 8:1 9:2 7:2 | 8:1 9:1 10:2 9:1 8:1 7:2 | 6:2 7:2 5:4~', [3, 4, 2, 0]],
    D: ['10:4h 9:4h | 8:3 7:1 6:4~ | 7:2 6:2 5:4~ | 5:8h', [3, 2, 1, 0]],
    XB1: ['9:8~ | 8:6~ 7:2 | 7:8~ | 8:8~', [0, 0, 0, 0]],
    XC1: ['10:4~ 9:4 | 8:8~ | 9:4 10:4 | 11:8~', [0, 0, 0, 0]],
    XC2: ['12:8~ | 11:4 10:4 | 9:4~ 8:4 | 5:8~', [0, 0, 0, 0]],
  };

  C.PHRASES = {};
  Object.keys(RAW).forEach((k) => (C.PHRASES[k] = build(RAW[k][0], RAW[k][1])));

  // 伴奏型：[八分位置, 相对根音的音级偏移, 时值, 力度]
  C.ACC = {
    drone: [[0, -5, 8, 0.5], [0, 0, 8, 0.22]],
    sparse: [[0, -5, 4, 0.5], [2, 0, 2, 0.28], [4, 2, 2, 0.26], [6, 5, 2, 0.2]],
    arp: [[0, -5, 2, 0.5], [1, 0, 1, 0.3], [2, 2, 1, 0.27], [3, 3, 1, 0.25], [4, 5, 2, 0.3], [6, 3, 1, 0.23], [7, 2, 1, 0.21]],
    flow: [[0, -5, 2, 0.52], [1, 0, 1, 0.32], [2, 2, 1, 0.3], [3, 3, 1, 0.3], [4, 5, 1, 0.33], [5, 3, 1, 0.28], [6, 2, 1, 0.28], [7, 0, 1, 0.25]],
  };

  // 每段 4 小节（32 个八分），共 12 段 48 小节
  C.STRUCTURE = [
    { ph: 'I', lead: 'zheng', acc: 'drone', sec: 0 },
    { ph: 'A1', lead: 'zheng', acc: 'sparse', sec: 0 },
    { ph: 'A2', lead: 'zheng', acc: 'sparse', sec: 0 },
    { ph: 'A1', lead: 'xiao', acc: 'arp', sec: 1 },
    { ph: 'A2', lead: 'zheng', xiao: 'double', acc: 'arp', sec: 1 },
    { ph: 'B1', lead: 'zheng', xiao: 'XB1', acc: 'arp', sec: 1 },
    { ph: 'C1', lead: 'zheng', xiao: 'XC1', acc: 'flow', sec: 2, gliss: 'up' },
    { ph: 'C2', lead: 'zheng', xiao: 'XC2', acc: 'flow', sec: 2 },
    { ph: 'B2', lead: 'xiao', acc: 'arp', sec: 2 },
    { ph: 'A1', lead: 'zheng', acc: 'sparse', sec: 3, gliss: 'down' },
    { ph: 'A2', lead: 'xiao', acc: 'drone', sec: 3 },
    { ph: 'D', lead: 'zheng', acc: 'drone', sec: 3 },
  ];

  C.TOTAL_STEPS = C.STRUCTURE.length * 32;
  C.NOMINAL_SECONDS = 180;
})();
