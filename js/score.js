/* 乐谱：五声调式与四季曲目（每季起承转合，约三分钟） */
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
    return { events, length, roots: roots || [0, 0, 0, 0], at: index(events), doubled: { at: index(dbl) } };
  }

  // 伴奏型：[八分位置, 相对根音的音级偏移, 时值, 力度]
  C.ACC = {
    still: [[0, -5, 8, 0.42]],
    drone: [[0, -5, 8, 0.5], [0, 0, 8, 0.22]],
    qin: [[0, -5, 6, 0.5], [6, 0, 2, 0.26]],
    sparse: [[0, -5, 4, 0.5], [2, 0, 2, 0.28], [4, 2, 2, 0.26], [6, 5, 2, 0.2]],
    arp: [[0, -5, 2, 0.5], [1, 0, 1, 0.3], [2, 2, 1, 0.27], [3, 3, 1, 0.25], [4, 5, 2, 0.3], [6, 3, 1, 0.23], [7, 2, 1, 0.21]],
    dance: [[0, -5, 2, 0.5], [1, 2, 1, 0.27], [2, 5, 1, 0.3], [3, 2, 1, 0.24], [4, 0, 2, 0.4], [5, 5, 1, 0.27], [6, 3, 1, 0.26], [7, 2, 1, 0.22]],
    flow: [[0, -5, 2, 0.52], [1, 0, 1, 0.32], [2, 2, 1, 0.3], [3, 3, 1, 0.3], [4, 5, 1, 0.33], [5, 3, 1, 0.28], [6, 2, 1, 0.28], [7, 0, 1, 0.25]],
  };

  // 结构字段：ph 主旋律乐句 | lead 主奏(str 弦 / wind 管) | wind 管乐副旋律(double=随主旋律) | acc 伴奏
  //           sec 段落 | gliss 进入前刮奏 | rit 段尾渐慢 | bell 段首钟声 | wx 段落天气（雨/风/雪的强度）
  const SEASONS = [
    {
      id: 'spring', name: '春', mode: 2, light: 0.55, tempo: [56, 72], str: 'zheng', wind: 'xiao',
      weather: { name: '雨', def: 1 }, creature: { name: '鸟', def: true }, body: '日',
      motto: '桃 · 柳 · 燕 · 雨',
      sections: [
        { name: '起', term: '雨水', poem: ['好雨知时节', '当春乃发生'], author: '杜甫' },
        { name: '承', term: '惊蛰', poem: ['微雨众卉新', '一雷惊蛰始'], author: '韦应物' },
        { name: '转', term: '春分', poem: ['等闲识得东风面', '万紫千红总是春'], author: '朱熹' },
        { name: '合', term: '谷雨', poem: ['人闲桂花落', '夜静春山空'], author: '王维' },
      ],
      phrases: {
        I: ['r:4 10:4h | r:2 9:2h 8:4h | r:4 7:2h 8:2h | 5:8h', [0, 0, 3, 0]],
        A1: ['5:2 6:1 7:1 8:4~ | 7:2 8:1 9:1 10:3 9:1 | 8:2 7:2 6:2 7:1 6:1 | 5:8~', [0, 3, 1, 0]],
        A2: ['8:2 9:1 10:1 11:4~ | 10:2 9:2 8:3 7:1 | 6:2 7:1 8:1 7:2 6:2 | 5:6~ r:2', [3, 4, 1, 0]],
        B1: ['10:1 11:1 12:2 11:1 10:1 9:2 | 10:3 9:1 8:4~ | 7:1 8:1 9:1 10:1 11:2 10:2 | 9:6^ r:2', [4, 3, 2, 3]],
        B2: ['12:2 13:2 12:1 11:1 10:2 | 9:1 10:1 9:1 8:1 7:4~ | 8:2 7:1 6:1 5:2 6:2 | 7:4 8:4~', [0, 2, 1, 3]],
        C1: ['10:1 9:1 10:1 12:1 11:2 10:2 | 9:1 8:1 9:1 11:1 10:4~ | 12:1 11:1 10:1 9:1 8:1 9:1 10:2 | 11:2 12:2 13:4~', [0, 4, 3, 3]],
        C2: ['13:2 12:1 11:1 12:2 10:2 | 11:1 10:1 9:1 8:1 9:2 7:2 | 8:1 9:1 10:2 9:1 8:1 7:2 | 6:2 7:2 5:4~', [3, 4, 2, 0]],
        D: ['10:4h 9:4h | 8:3 7:1 6:4~ | 7:2 6:2 5:4~ | 5:8h', [3, 2, 1, 0]],
        XB1: ['9:8~ | 8:6~ 7:2 | 7:8~ | 8:8~'],
        XC1: ['10:4~ 9:4 | 8:8~ | 9:4 10:4 | 11:8~'],
        XC2: ['12:8~ | 11:4 10:4 | 9:4~ 8:4 | 5:8~'],
      },
      structure: [
        { ph: 'I', lead: 'str', acc: 'drone', sec: 0, wx: 1 },
        { ph: 'A1', lead: 'str', acc: 'sparse', sec: 0, wx: 1 },
        { ph: 'A2', lead: 'str', acc: 'sparse', sec: 0, rit: 1, wx: 1 },
        { ph: 'A1', lead: 'wind', acc: 'arp', sec: 1 },
        { ph: 'A2', lead: 'str', wind: 'double', acc: 'arp', sec: 1 },
        { ph: 'B1', lead: 'str', wind: 'XB1', acc: 'arp', sec: 1, rit: 1 },
        { ph: 'C1', lead: 'str', wind: 'XC1', acc: 'flow', sec: 2, gliss: 'up' },
        { ph: 'C2', lead: 'str', wind: 'XC2', acc: 'flow', sec: 2 },
        { ph: 'B2', lead: 'wind', acc: 'arp', sec: 2, rit: 1 },
        { ph: 'A1', lead: 'str', acc: 'sparse', sec: 3, gliss: 'down' },
        { ph: 'A2', lead: 'wind', acc: 'drone', sec: 3 },
        { ph: 'D', lead: 'str', acc: 'drone', sec: 3, rit: 1 },
      ],
    },
    {
      id: 'summer', name: '夏', mode: 3, light: 0.7, tempo: [66, 84], str: 'zheng', wind: 'dizi',
      weather: { name: '雨', def: 1 }, creature: { name: '蝉', def: true }, body: '日',
      motto: '荷 · 蜻蜓 · 萤 · 雷雨',
      sections: [
        { name: '起', term: '立夏', poem: ['小荷才露尖尖角', '早有蜻蜓立上头'], author: '杨万里' },
        { name: '承', term: '小满', poem: ['接天莲叶无穷碧', '映日荷花别样红'], author: '杨万里' },
        { name: '转', term: '夏至', poem: ['黑云翻墨未遮山', '白雨跳珠乱入船'], author: '苏轼' },
        { name: '合', term: '大暑', poem: ['稻花香里说丰年', '听取蛙声一片'], author: '辛弃疾' },
      ],
      phrases: {
        I: ['r:2 12:1h 10:1h r:4 | r:2 11:1h 9:1h r:2 7:2h | r:4 10:2h 9:2h | 8:8h', [0, 0, 3, 0]],
        A1: ['7:1 8:1 9:2 10:2 9:1 8:1 | 7:2 5:1 6:1 7:4~ | 9:1 10:1 11:2 10:1 9:1 8:2 | 9:6~ r:2', [0, 3, 0, 4]],
        A2: ['10:1 11:1 12:2 11:1 10:1 9:2 | 10:2 9:1 8:1 7:4~ | 8:1 9:1 8:1 7:1 6:2 5:2 | 7:6~ r:2', [3, 0, 1, 0]],
        B1: ['12:1 r:1 12:1 11:1 10:2 12:2 | 11:1 r:1 11:1 10:1 9:4~ | 10:1 11:1 12:1 13:1 12:1 11:1 10:2 | 9:4 7:4~', [0, 4, 3, 0]],
        B2: ['13:2 12:1 11:1 10:2 9:2 | 10:1 9:1 8:1 7:1 8:4~ | 9:2 10:1 9:1 8:2 7:2 | 5:6~ r:2', [3, 1, 4, 0]],
        C1: ['10:1 12:1 13:1 12:1 10:1 12:1 13:2 | 14:1 13:1 12:1 10:1 12:4^ | 13:1 12:1 10:1 9:1 10:1 12:1 13:1 14:1 | 15:4~ 14:2 13:2', [0, 3, 4, 0]],
        C2: ['15:2 14:1 13:1 12:2 10:2 | 12:1 10:1 9:1 8:1 9:2 10:2 | 12:1 10:1 9:1 7:1 8:2 9:2 | 10:4~ 7:4', [0, 4, 3, 0]],
        D: ['10:3 9:1 8:4~ | 7:2 8:2 10:4~ | 9:2 8:1 7:1 5:4~ | 5:8h', [3, 0, 4, 0]],
        XB: ['12:8~ | 11:4 10:4 | 12:4 13:4 | 12:8~'],
        XC1: ['15:4~ 14:4 | 13:8~ | 12:4 13:4 | 15:8~'],
        XC2: ['17:8~ | 15:4 14:4 | 13:4~ 12:4 | 10:8~'],
      },
      structure: [
        { ph: 'I', lead: 'str', acc: 'drone', sec: 0 },
        { ph: 'A1', lead: 'str', acc: 'sparse', sec: 0 },
        { ph: 'A2', lead: 'wind', acc: 'arp', sec: 0, rit: 1 },
        { ph: 'A1', lead: 'str', wind: 'double', acc: 'dance', sec: 1 },
        { ph: 'B1', lead: 'str', acc: 'dance', sec: 1 },
        { ph: 'B2', lead: 'wind', acc: 'arp', sec: 1 },
        { ph: 'B1', lead: 'str', wind: 'XB', acc: 'dance', sec: 1, rit: 1 },
        { ph: 'C1', lead: 'str', wind: 'XC1', acc: 'flow', sec: 2, gliss: 'up', wx: 2 },
        { ph: 'C2', lead: 'str', wind: 'XC2', acc: 'flow', sec: 2, wx: 2 },
        { ph: 'C1', lead: 'wind', acc: 'flow', sec: 2, wx: 2 },
        { ph: 'C2', lead: 'str', wind: 'double', acc: 'flow', sec: 2, rit: 1, wx: 2 },
        { ph: 'A2', lead: 'str', acc: 'arp', sec: 3, gliss: 'down' },
        { ph: 'A1', lead: 'wind', acc: 'sparse', sec: 3 },
        { ph: 'D', lead: 'str', acc: 'drone', sec: 3, rit: 1 },
      ],
    },
    {
      id: 'autumn', name: '秋', mode: 1, light: 0.4, tempo: [54, 64], str: 'qin', wind: 'xiao',
      weather: { name: '风', def: 1 }, creature: { name: '雁', def: true }, body: '月',
      motto: '枫 · 芦苇 · 雁 · 月',
      sections: [
        { name: '起', term: '立秋', poem: ['空山新雨后', '天气晚来秋'], author: '王维' },
        { name: '承', term: '白露', poem: ['露从今夜白', '月是故乡明'], author: '杜甫' },
        { name: '转', term: '秋分', poem: ['无边落木萧萧下', '不尽长江滚滚来'], author: '杜甫' },
        { name: '合', term: '霜降', poem: ['停车坐爱枫林晚', '霜叶红于二月花'], author: '杜牧' },
      ],
      phrases: {
        I: ['0:4h r:4 | 5:4h 3:2h 2:2h | 4:6h r:2 | 5:8h', [0, 0, 3, 0]],
        A1: ['5:3 4:1 3:4~ | 2:2 3:1 4:1 5:4^ | 7:2 6:2 5:2 4:2 | 3:8~', [0, 2, 4, 3]],
        A2: ['6:3 7:1 8:4~ | 7:2 6:1 5:1 4:4~ | 5:2 4:2 3:2 1:2 | 2:6~ r:2', [1, 4, 3, 2]],
        B1: ['8:2 9:2 10:4~ | 9:2 8:1 7:1 6:4^ | 7:1 8:1 7:1 6:1 5:4~ | 4:4 3:4~', [3, 1, 0, 4]],
        C1: ['10:1 9:1 8:1 7:1 8:2 10:2 | 11:4^ 10:2 9:2 | 8:1 7:1 6:1 5:1 6:2 8:2 | 9:6~ r:2', [0, 1, 0, 4]],
        C2: ['12:2 11:2 10:4~ | 9:1 10:1 9:1 8:1 7:4~ | 8:2 7:1 6:1 5:2 4:2 | 5:8~', [2, 4, 1, 0]],
        D: ['7:4~ 6:4 | 5:3 4:1 3:4~ | 2:2 3:2 1:4~ | 0:8h', [2, 3, 1, 0]],
        XB: ['10:8~ | 9:8~ | 8:4 7:4 | 6:8~'],
        XC1: ['12:8~ | 11:4 10:4 | 9:8~ | 10:8~'],
        XC2: ['13:4~ 12:4 | 11:8~ | 10:4 9:4 | 10:8~'],
      },
      structure: [
        { ph: 'I', lead: 'str', acc: 'still', sec: 0 },
        { ph: 'A1', lead: 'str', acc: 'qin', sec: 0 },
        { ph: 'A2', lead: 'str', acc: 'qin', sec: 0, rit: 1 },
        { ph: 'A1', lead: 'wind', acc: 'qin', sec: 1 },
        { ph: 'A2', lead: 'str', wind: 'double', acc: 'sparse', sec: 1 },
        { ph: 'B1', lead: 'str', wind: 'XB', acc: 'sparse', sec: 1, rit: 1 },
        { ph: 'C1', lead: 'str', wind: 'XC1', acc: 'arp', sec: 2, gliss: 'up', wx: 2 },
        { ph: 'C2', lead: 'str', wind: 'XC2', acc: 'arp', sec: 2, wx: 2 },
        { ph: 'C1', lead: 'wind', acc: 'sparse', sec: 2, rit: 1, wx: 2 },
        { ph: 'A1', lead: 'str', acc: 'qin', sec: 3, gliss: 'down' },
        { ph: 'D', lead: 'str', acc: 'still', sec: 3, rit: 1 },
      ],
    },
    {
      id: 'winter', name: '冬', mode: 4, light: 0.35, tempo: [44, 56], str: 'zheng', wind: 'xiao',
      weather: { name: '雪', def: 1 }, creature: { name: '钟', def: true }, body: '日',
      motto: '梅 · 雪 · 远山 · 钟',
      sections: [
        { name: '起', term: '立冬', poem: ['晚来天欲雪', '能饮一杯无'], author: '白居易' },
        { name: '承', term: '小雪', poem: ['千山鸟飞绝', '万径人踪灭'], author: '柳宗元' },
        { name: '转', term: '大雪', poem: ['忽如一夜春风来', '千树万树梨花开'], author: '岑参' },
        { name: '合', term: '冬至', poem: ['墙角数枝梅', '凌寒独自开'], author: '王安石' },
      ],
      phrases: {
        I: ['r:4 0:4h | r:8 | 5:4h r:4 | 3:8h', [0, 0, 0, 0]],
        A1: ['7:4~ 8:2 7:2 | 5:6~ 3:2 | 4:3 5:1 7:4~ | 5:8~', [0, 3, 4, 0]],
        A2: ['8:3 9:1 10:4~ | 9:2 8:2 7:4~ | 8:2 7:1 5:1 4:4~ | 3:8~', [3, 2, 4, 3]],
        B1: ['10:6~ 12:2 | 11:4~ 10:4 | 9:2 8:2 7:2 8:2 | 10:8h', [0, 1, 2, 0]],
        C1: ['10:2 11:1 12:1 13:4~ | 12:2 11:1 10:1 9:4~ | 10:1 11:1 12:1 13:1 14:2 13:2 | 12:8~', [0, 4, 0, 2]],
        C2: ['14:2 13:2 12:2 10:2 | 11:4~ 10:2 9:2 | 8:2 9:2 7:4~ | 8:8~', [4, 1, 2, 3]],
        D: ['7:4~ 5:4 | 4:4 3:4~ | 2:2 3:2 5:4~ | 5:8h', [2, 3, 2, 0]],
        XB: ['5:8~ | 6:8~ | 7:8~ | 5:8~'],
        XC1: ['8:8~ | 9:8~ | 10:4 11:4 | 10:8~'],
        XC2: ['12:8~ | 11:8~ | 10:4~ 9:4 | 8:8~'],
      },
      structure: [
        { ph: 'I', lead: 'str', acc: 'still', sec: 0, bell: 1 },
        { ph: 'A1', lead: 'str', acc: 'still', sec: 0, rit: 1 },
        { ph: 'A2', lead: 'wind', acc: 'drone', sec: 1, bell: 1 },
        { ph: 'B1', lead: 'str', wind: 'XB', acc: 'drone', sec: 1, rit: 1 },
        { ph: 'C1', lead: 'str', wind: 'XC1', acc: 'sparse', sec: 2, gliss: 'up', bell: 1, wx: 2 },
        { ph: 'C2', lead: 'str', wind: 'XC2', acc: 'arp', sec: 2, wx: 2 },
        { ph: 'C1', lead: 'wind', acc: 'sparse', sec: 2, rit: 1, wx: 2 },
        { ph: 'A1', lead: 'str', acc: 'still', sec: 3, gliss: 'down', bell: 1 },
        { ph: 'D', lead: 'str', acc: 'still', sec: 3, rit: 1 },
      ],
    },
  ];

  // 每个八分音符的时长：速度随「日」的高低在区间内变化，段尾渐慢
  C.stepDur = (S, light, s) => {
    const bpm = S.tempo[0] + (S.tempo[1] - S.tempo[0]) * light;
    let d = 30 / bpm;
    const e = S.structure[s >> 5];
    const p = s & 31;
    if (e && e.rit && p >= 28) d *= 1 + 0.07 * (p - 27);
    return d;
  };

  SEASONS.forEach((S, i) => {
    S.index = i;
    const raw = S.phrases;
    S.phrases = {};
    Object.keys(raw).forEach((k) => (S.phrases[k] = build(raw[k][0], raw[k][1])));
    S.total = S.structure.length * 32;
    S.secStarts = [0, 1, 2, 3].map((k) => S.structure.findIndex((e) => e.sec === k) * 32);
    let secs = 0;
    for (let s = 0; s < S.total; s++) secs += C.stepDur(S, S.light, s);
    S.nominal = secs;
  });

  C.SEASONS = SEASONS;
  C.seasonById = (id) => SEASONS.find((S) => S.id === id);
})();
