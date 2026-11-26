'use strict';
const VERSION = '1.25.0';

/* ── 預設分類（跟轉換腳本同一套 ID，匯入時會對上）── */
const DEFAULT_TREE = {
  expense: {
    '餐飲': ['正餐', '飲料咖啡', '零食甜點', '水果', '食材'],
    '交通': ['油費', '停車費', '維修保養', '大眾運輸', '機票', '車貸'],
    '居住': ['房貸', '管理費', '家具家用', '稅費'],
    '帳單': ['水電瓦斯', '電話網路'],
    '購物': ['3C', '服飾', '美容美髮', '書籍', '日用雜貨'],
    '娛樂': ['玩樂', '夾娃娃', '運動'],
    '醫療保險': ['醫療', '保險', '保健食品'],
    '人情': ['送禮'],
    '皓皓': ['皓皓'],
    '寵物': ['貓'],
    '其他': ['其他'],
  },
  income: { '收入': ['薪水', '拍賣', '發票中獎', '股票', '其他收入'] },
};
function defaultCategories() {
  const out = [];
  for (const [type, tree] of Object.entries(DEFAULT_TREE)) {
    Object.entries(tree).forEach(([root, subs], i) => {
      const rid = `${type.slice(0, 3)}-${String(i).padStart(2, '0')}`;
      out.push({ id: rid, name: root, parentId: null, type, order: i });
      subs.forEach((s, j) => out.push({ id: `${rid}-${String(j).padStart(2, '0')}`, name: s, parentId: rid, type, order: j }));
    });
  }
  return out;
}

/* ── 手繪風圖示：先錯位塗一層色塊（像蠟筆沒對準），再用歪歪的墨線描 ── */
const HD = {
  // f: 上色的色塊、k: 墨線、c: 額外點綴色（腮紅等）
  bowl: { f: 'M3.5 11.6Q4 18.4 12 18.9Q20 18.5 20.5 11.4Z', k: ['M2.9 11.5Q12 12.2 21.1 11.2', 'M3.4 11.7Q4.2 18.7 12 19.1Q19.8 18.8 20.7 11.4', 'M9 19.3Q12 20.7 15.3 19.1', 'M8.6 9q-1.1-1.6 0-3.1q1-1.4-.1-2.9', 'M12.4 8.8q-1-1.4.1-2.8', 'M14.2 10.5L21.6 4.1', 'M16.3 11L22.1 6.6'] },
  car: { f: 'M3 15.2Q3 11.6 6 11.3L8 7.7Q9 6.5 12 6.6Q15.4 6.5 16.6 7.8L18.6 11.3Q21.2 11.7 21 15.2L21 16.8L3 16.9Z', k: ['M3.1 16.7L2.9 14.9Q3.1 11.7 6.1 11.2L8.1 7.6Q9.2 6.4 12.2 6.5Q15.6 6.4 16.7 7.9L18.7 11.2Q21.3 11.8 21.1 15L21 16.8', 'M9.7 16.9L14.6 16.8', 'M8.4 11L9.5 8.6Q12 8.1 14.9 8.7L16 11', 'M12 8.4L12.1 11.1'], o: [[7.4, 17.2, 2], [16.8, 17.1, 2]] },
  house: { f: 'M5 11L5 20L19 20L19 11L12 4.6Z', k: ['M2.8 12.3L12.1 3.8L21.3 12.1', 'M5.2 10.6Q4.9 15.2 5.1 20.1Q12 20.5 18.9 19.9Q19.2 15 18.8 10.4', 'M10 20L10 15.2Q12 14.4 14.1 15.1L14 20', 'M15.9 6.9L15.9 4.1L18.1 4L18.1 8.7'] },
  bulb: { f: 'M12 3Q18.2 3.2 18 9.4Q17.8 12.4 15.2 14.4L15 16.4L9 16.4L8.8 14.4Q6.2 12.4 6 9.4Q6 3.2 12 3Z', k: ['M9 16.5L8.9 14.5Q6 12.5 5.9 9.3Q6 3.1 12.1 2.9Q18.3 3.1 18.1 9.5Q17.9 12.5 15.2 14.5L15.1 16.6', 'M9.1 18.5L14.9 18.3', 'M10 20.6Q12 21.7 14.1 20.5', 'M10.4 13.8L10.1 10Q12 11.7 13.9 9.9L13.6 13.8', 'M2.6 4.6L4.3 5.8', 'M21.4 4.7L19.8 5.8', 'M1.9 10.1L3.6 10', 'M22.1 10L20.4 10.1'] },
  bag: { f: 'M5 8L19 8L20 20.5L4 20.5Z', k: ['M5.1 7.8Q12 8.3 18.9 7.9L20.2 20.4Q12 20.9 3.8 20.5L5 7.7', 'M8.8 10.9L8.8 6.4Q9 3.1 12 3.2Q15.1 3.2 15.2 6.5L15.3 10.9'] },
  pad: { f: 'M7 8Q12 7 17 8Q21.6 8.6 21.8 14.4Q22 18.5 19 18.2Q17 18 15.6 15.6L8.4 15.6Q7 18 5 18.2Q2 18.5 2.2 14.4Q2.4 8.6 7 8Z', k: ['M7.1 7.9Q12 6.9 17.1 7.9Q21.7 8.6 21.9 14.5Q22 18.6 19 18.3Q17 18 15.6 15.5Q12 15.9 8.4 15.6Q7 18.1 5 18.3Q1.9 18.5 2.1 14.3Q2.4 8.5 7.3 7.9', 'M7 10.4L7.1 14.3', 'M5.1 12.4L9 12.3'], o: [[16.3, 11.1, .9], [18.4, 13.3, .9]] },
  pill: { f: 'M9.6 9.4L13.9 5.1Q16.7 2.6 19.3 5.2Q21.9 8 19 10.7L14.8 14.8Z', k: ['M5.2 13.6L13.6 5.2Q16.6 2.4 19.4 5.2Q22.1 8.1 19 10.9L10.6 19.3Q7.5 22 4.8 19.2Q2.1 16.3 5.3 13.5', 'M9.3 9.4L14.8 14.9', 'M14.6 7.6L16.4 6.2', 'M19.6 15.2L19.7 18.6', 'M18 16.9L21.4 16.8'] },
  gift: { f: 'M4 10L20 10L19.5 20.5L4.5 20.5Z', k: ['M3 7.2Q12 6.7 21 7.3L20.8 10.4Q12 10.1 3.2 10.6Z', 'M4.4 10.5L4.6 20.6Q12 21 19.4 20.5L19.6 10.3', 'M12 7.1L12.1 20.8', 'M12 7Q8 2.1 6.5 4.8Q6 7.1 12 7Q18 7 17.5 4.7Q16 2.1 12 7'] },
  kid: { f: 'M12 4.2Q19.4 4.4 19.6 12.2Q19.4 19.8 12 20Q4.6 19.8 4.4 12.2Q4.6 4.4 12 4.2Z', k: ['M12 4.2Q19.5 4.4 19.7 12.2Q19.4 19.9 12 20.1Q4.5 19.8 4.3 12.1Q4.6 4.3 12.4 4.2', 'M10 4.6Q10.9 2.1 13.7 2.7Q12 3.3 12.7 4.4', 'M9.2 10.9L9.2 12.1', 'M14.8 10.9L14.8 12.1', 'M9.4 15Q12 17.5 14.7 15'], c: [[7.6, 14, 1.3], [16.4, 14, 1.3]] },
  cat: { f: 'M5 9L4.6 3.6L9 6.6Q12 5.8 15 6.6L19.4 3.6L19 9Q21 12 20 15.4Q18.4 20 12 20Q5.6 20 4 15.4Q3 12 5 9Z', k: ['M5 9.1L4.5 3.5L9 6.5Q12 5.7 15.1 6.6L19.5 3.5L19.1 9.1Q21.1 12.1 20.1 15.5Q18.4 20.1 12 20.1Q5.5 20 3.9 15.4Q3 12 5.1 8.9', 'M8.3 12.3Q9.3 11 10.3 12.3', 'M13.7 12.3Q14.7 11 15.7 12.3', 'M11.2 14.4L12 15L12.8 14.4', 'M12 15Q11.1 16.5 10 15.8', 'M12 15Q12.9 16.5 14 15.8', 'M1.6 13.4L6.4 14.2', 'M2 16.5L6.6 15.6', 'M22.4 13.4L17.6 14.2', 'M22 16.5L17.4 15.6'] },
  box: { f: 'M4 9L12 12.4L20 9L20 17.6L12 21L4 17.6Z', k: ['M4 8.6L12 5L20.1 8.7L12 12.3Z', 'M4 8.9L4.2 17.6L12 21.2L19.8 17.7L20 8.8', 'M12 12.3L12.1 21', 'M8 6.8L16.1 10.5', 'M16.4 15.4L18.4 14.5'] },
  coin: { f: 'M8.6 8Q3.4 12.4 4.4 17Q5.4 20.8 12 20.8Q18.6 20.8 19.6 17Q20.6 12.4 15.4 8Z', k: ['M8.7 8Q3.3 12.4 4.3 17.1Q5.4 20.9 12 20.9Q18.7 20.8 19.7 17Q20.6 12.3 15.3 7.9', 'M8.4 8.1Q12 8.9 15.6 8', 'M9 7.6L7.4 4Q12 2.3 16.6 4.1L15 7.6', 'M13.7 12.6Q12 11.3 10.6 12.4Q9.7 13.7 12 14.4Q14.5 15.2 13.4 16.8Q12 17.9 10.1 16.6', 'M12 10.6L12 11.7', 'M12 17.5L12 18.6'] },
  tag: { f: 'M3.5 4L11 3.6L20.6 13.2L13.2 20.6L3.6 11Z', k: ['M3.4 4.1L11.1 3.5L20.7 13.1L13.2 20.7L3.5 11.1Z'], o: [[7.6, 7.6, 1.4]] },
  /* 線條小圖示（無色塊，跟著文字顏色） */
  dots: { k: ['M6.8 5.6Q8.6 5.7 8.4 7.3Q8.2 8.7 6.8 8.5Q5.3 8.3 5.5 6.9Q5.7 5.7 7 5.6', 'M17 5.4Q18.7 5.6 18.5 7.1Q18.3 8.6 16.9 8.4Q15.4 8.3 15.6 6.8Q15.8 5.5 17.2 5.5', 'M6.9 15.6Q8.6 15.7 8.5 17.2Q8.3 18.7 6.8 18.5Q5.4 18.3 5.5 16.9Q5.7 15.6 7.1 15.6', 'M17.1 15.5Q18.6 15.7 18.5 17.1Q18.3 18.6 16.9 18.5Q15.4 18.3 15.6 16.9Q15.8 15.5 17.3 15.6'] },
  more: { k: ['M4.5 12.2Q5.4 11.4 6.1 12.1Q6.5 13 5.4 13.2Q4.5 13.2 4.6 12.2', 'M11.4 11.9Q12.4 11.3 13 12.1Q13.3 13 12.3 13.1Q11.3 13.1 11.5 12', 'M18.2 12Q19.1 11.4 19.7 12.1Q20 13 19 13.1Q18 13.1 18.2 12'] },
  add: { k: ['M12.6 3.3Q20.6 3.4 20.8 12Q20.5 20.7 12 20.8Q3.3 20.6 3.2 12.2Q3.5 3.8 11.2 3.3', 'M12 8Q12.2 12 11.9 16.2', 'M7.9 12.1Q12 11.8 16.2 12'] },
  list: { k: ['M8.4 6.1Q14 5.6 20.2 6.2', 'M8.2 12.1Q14 11.7 20.1 12', 'M8.4 18Q14 17.6 19.9 18.1', 'M3.6 5.7L4.4 6.4', 'M3.5 11.7L4.4 12.4', 'M3.6 17.6L4.5 18.3'] },
  stat: { k: ['M5.1 19.6L5.3 11.1', 'M12 19.7L11.8 4.1', 'M18.9 19.6L19.1 13.9', 'M2.8 20.6Q12 20.1 21.2 20.7'] },
  gear: { k: ['M12.3 8.9Q15.2 9.2 15.1 12.1Q14.9 15.1 12 15.1Q9 14.9 8.9 12.1Q9 9 12.4 8.9', 'M12.2 6Q18.1 6.1 18 12Q17.8 18.1 11.9 18Q5.9 17.8 6 12.1Q6.2 6.1 12.6 6', 'M12 2.6L12.1 5.6', 'M12 18.4L11.9 21.4', 'M2.6 12.1L5.6 12', 'M18.4 12L21.4 11.9', 'M5.3 5.3L7.4 7.4', 'M16.6 16.6L18.7 18.7', 'M18.7 5.3L16.6 7.4', 'M7.4 16.6L5.3 18.7'] },
  pen: { k: ['M4.2 19.8L5 15.8L15.6 5.2Q17.2 3.8 18.6 5.3Q20.2 6.8 18.8 8.4L8.2 19L4.2 19.8', 'M14.2 6.8L17.2 9.8', 'M5.1 15.9L8.1 18.9'] },
  cal: { k: ['M4.1 6.4Q12 5.9 19.9 6.3Q20.3 13 19.8 20Q12 20.4 4.3 19.9Q3.8 13 4.1 6.4', 'M4.2 10.2Q12 9.8 19.8 10.1', 'M8.2 3.8L8.3 7.6', 'M15.8 3.7L15.7 7.6', 'M8 13.6L8.8 14', 'M12 13.5L12.8 13.9', 'M16 13.6L16.7 14', 'M8 16.8L8.8 17.2', 'M12 16.7L12.8 17.1'] },
  ok: { k: ['M12.6 3.3Q20.6 3.4 20.8 12Q20.5 20.7 12 20.8Q3.3 20.6 3.2 12.2Q3.5 3.8 11.2 3.3', 'M7.8 12.4L10.9 15.6L16.6 8.6'] },
  bin: { k: ['M3.8 6.6Q12 6.1 20.2 6.7', 'M9.2 6.4L9.6 3.9Q12 3.4 14.5 3.9L14.8 6.4', 'M5.8 6.8L6.9 20.1Q12 20.6 17.1 20L18.2 6.8', 'M10 10.2L10.3 16.6', 'M14 10.1L13.8 16.7'] },
  rep: { k: ['M4.5 11.5Q4.6 6.6 9.6 6.6L18.6 6.7', 'M15.6 3.6L18.7 6.7L15.7 9.6', 'M19.5 12.5Q19.4 17.4 14.4 17.4L5.4 17.3', 'M8.4 20.4L5.3 17.3L8.3 14.4'] },
  move: { k: ['M4.2 5.2Q4.1 12.6 11.6 12.9L19.6 13', 'M16.4 9.8L19.7 13L16.5 16.2'] },
};
function hd(name, color, cls = '') {
  const g = HD[name] || HD.tag;
  let s = `<svg class="hd${color ? ' c' : ''}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">`;
  if (g.f && color) s += `<path class="f" d="${g.f}" fill="${color}" transform="translate(.9 1)"/>`;
  if (g.c) s += g.c.map(([x, y, r]) => `<circle class="f" cx="${x}" cy="${y}" r="${r}" fill="#f472b6"/>`).join('');
  s += `<g class="k">${g.k.map((d) => `<path d="${d}"/>`).join('')}${(g.o || []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g></svg>`;
  return s;
}
/* 分類圖示：用預設大類的 ID 對應手繪圖與色調 */
const CAT_LOOK = {
  'exp-00': ['bowl', '#f97316'], 'exp-01': ['car', '#3b82f6'], 'exp-02': ['house', '#8b5cf6'], 'exp-03': ['bulb', '#eab308'],
  'exp-04': ['bag', '#ec4899'], 'exp-05': ['pad', '#22c55e'], 'exp-06': ['pill', '#14b8a6'], 'exp-07': ['gift', '#ef4444'],
  'exp-08': ['kid', '#84cc16'], 'exp-09': ['cat', '#b45309'], 'exp-10': ['box', '#64748b'], 'inc-00': ['coin', '#16a34a'],
};
function catLook(rootId) {
  const c = S.catById.get(rootId);
  const rid = c && c.parentId ? c.parentId : rootId;
  const [n, h] = CAT_LOOK[rid] || ['tag', '#64748b'];
  return [hd(n, h), h];
}
function catIcon(rootId, size = '') {
  const [e, h] = catLook(rootId);
  return `<span class="ic${size ? ' ' + size : ''}" style="background:${h}26" aria-hidden="true">${e}</span>`;
}

/* ── 四季：依記一筆的日期換底色、日期卡插圖與邊角點綴（春3-5、夏6-8、秋9-11、冬12-2）── */
function seasonOf(date) {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
const SART = (() => {
  const K = 'class="sk"';   // 墨線
  const blossom = (x, y, r, rot = 0) => {
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})">`;
    for (let i = 0; i < 5; i++) s += `<ellipse cx="0" cy="${-r * .55}" rx="${r * .42}" ry="${r * .55}" transform="rotate(${i * 72})" fill="#f9a8c4" ${K}/>`;
    return s + `<circle r="${r * .22}" fill="#f472a0"/><path d="M0 0l${r * .3} ${-r * .5}M0 0l${-r * .35} ${-r * .45}" class="sk" stroke-width=".8"/></g>`;
  };
  const petal = (x, y, rot, s = 1) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0Q3.5-4.5 7-1Q4 3.5 0 0Z" fill="#f9a8c4" ${K}/>`;
  const maple = (x, y, rot, s, c) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-10 -10)"><path d="M10 1L11.6 5.6L14.6 4L13.8 8.4L18.6 7.4L16.4 11L19 12.6L13.4 14L14 16.4L10.4 14.8L9.6 14.8L6 16.4L6.6 14L1 12.6L3.6 11L1.4 7.4L6.2 8.4L5.4 4L8.4 5.6Z" fill="${c}" transform="translate(.6 .7)" stroke="none"/><path d="M10 1L11.6 5.6L14.6 4L13.8 8.4L18.6 7.4L16.4 11L19 12.6L13.4 14L14 16.4L10.4 14.8L9.6 14.8L6 16.4L6.6 14L1 12.6L3.6 11L1.4 7.4L6.2 8.4L5.4 4L8.4 5.6Z" fill="none" ${K}/><path d="M10 14.8L10.3 20.2M10 14.6L10 4.6M10 11.8L15.6 8.6M10 11.8L4.4 8.6" ${K} stroke-width=".7"/></g>`;
  const ginkgo = (x, y, rot, s) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-10 -10)"><path d="M10 12Q2 10.5 2.6 4.2Q6.4 1.6 10 5Q13.6 1.6 17.4 4.2Q18 10.5 10 12Z" fill="#facc15" transform="translate(.6 .7)" stroke="none"/><path d="M10 12Q2 10.5 2.6 4.2Q6.4 1.6 10 5Q13.6 1.6 17.4 4.2Q18 10.5 10 12ZM10 12L10.4 18.6" fill="none" ${K}/></g>`;
  const flake = (x, y, r, rot = 0) => {
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})" class="sf">`;
    for (let i = 0; i < 6; i++) s += `<path transform="rotate(${i * 60})" d="M0 0L0 ${-r}M0 ${-r * .55}l${r * .28} ${-r * .26}M0 ${-r * .55}l${-r * .28} ${-r * .26}"/>`;
    return s + '</g>';
  };
  const sparkle = (x, y, r) => `<path transform="translate(${x} ${y})" d="M0 ${-r}Q.6 -.6 ${r} 0Q.6 .6 0 ${r}Q-.6 .6 ${-r} 0Q-.6 -.6 0 ${-r}Z" fill="#fcd34d" ${K}/>`;
  const wave = (x, y, n = 3) => `<path transform="translate(${x} ${y})" d="M0 0${'q4 -4.5 8 0t8 0'.repeat(n)}" fill="none" class="sw"/>`;
  const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;
  return {
    spring: {
      card: svg(130, 70, `<g transform="translate(0 16)"><path d="M134 4Q112 9 100 22Q90 34 70 40Q60 43 52 52" fill="none" class="sb"/><path d="M104 18Q110 30 104 44" fill="none" class="sb" stroke-width="1.6"/>
        ${blossom(100, 24, 9, 10)}${blossom(70, 40, 8, -20)}${blossom(104, 46, 7, 40)}${blossom(122, 8, 8, 0)}${blossom(53, 53, 5.5, 15)}
        ${petal(36, 20, 30, .9)}${petal(20, 50, -40, .8)}${petal(84, 60, 70, .8)}</g>`),
      deco: [petal(0, 0, 20, 2.2), petal(0, 0, -50, 1.8), blossom(0, 0, 9, 10), petal(0, 0, 80, 2), petal(0, 0, 140, 1.6), blossom(0, 0, 7, 30)],
    },
    summer: {
      card: svg(130, 70, `<g transform="translate(2 6)"><circle cx="104" cy="22" r="13" fill="#fcd34d" transform="translate(1 1.2)"/><path d="M104 9Q117.4 9.2 117 22.2Q116.6 35 103.8 35Q91 34.6 91.1 21.8Q91.4 9.4 105 9.2" fill="none" class="sk"/>
        <path d="M104 2.5L104.3 5.6M104 38.6L103.8 41.6M84.6 22L87.6 22.2M120.4 22L123.4 21.8M90.4 8.4L92.6 10.6M115.6 33.4L117.8 35.6M117.8 8.4L115.6 10.6M92.6 33.4L90.4 35.6" class="sk" stroke-width="1.4"/>
        <path d="M100 20.4Q100.8 19.4 101.6 20.4M106.6 20.4Q107.4 19.4 108.2 20.4M100.6 25.4Q104 28.4 107.6 25.4" fill="none" class="sk" stroke-width="1"/>
        <path d="M54 30Q54 24 60 25Q62 19 69 21Q75 19 76.6 25.4Q81.4 26 80.6 30.6Q80 33 76 33L57 33Q54 33 54 30Z" fill="#fff" class="sk" stroke-width="1.1"/>
        ${wave(40, 56, 3)}${wave(74, 63, 2)}${sparkle(30, 22, 4)}</g>`),
      deco: [sparkle(0, 0, 8), wave(-24, 0, 3), sparkle(0, 0, 6), wave(-16, 0, 2), sparkle(0, 0, 7), wave(-24, 0, 3)],
    },
    autumn: {
      card: svg(130, 70, `<g transform="translate(-4 14)">${maple(104, 24, 15, 1.7, '#f97316')}${maple(72, 46, -25, 1.25, '#dc2626')}${ginkgo(112, 52, 30, 1.1)}${ginkgo(48, 22, -30, .85)}${maple(34, 54, 50, .8, '#f59e0b')}</g>`),
      deco: [maple(0, 0, 20, 1.6, '#f97316'), ginkgo(0, 0, -30, 1.4), maple(0, 0, -40, 1.3, '#dc2626'), ginkgo(0, 0, 40, 1.2), maple(0, 0, 70, 1.4, '#f59e0b'), ginkgo(0, 0, 10, 1.3)],
    },
    winter: {
      card: svg(130, 70, `<g transform="translate(4 4)"><circle cx="104" cy="50" r="14" fill="#fff" class="sk"/><circle cx="104" cy="29" r="9.5" fill="#fff" class="sk"/>
        <path d="M94.8 36.6Q104 41.2 113.4 36.4L114 40.2Q104 44 94.4 40.4Z" fill="#ef4444" class="sk" stroke-width="1"/><path d="M110 39.6L113.6 48.6L109.6 47.8" fill="#ef4444" class="sk" stroke-width="1"/>
        <path d="M94.6 21.6Q104 19.4 113.4 21.8M97.4 21L98.4 12.6Q104 10.4 109.8 12.8L110.6 21.2" fill="#60a5fa" class="sk" stroke-width="1.1"/>
        ${dot(100.6, 27.4, 1.1, 'var(--ink)')}${dot(107.4, 27.4, 1.1, 'var(--ink)')}<path d="M104 30.2L110.6 31.6L104 32.4Z" fill="#fb923c" class="sk" stroke-width=".8"/>
        ${dot(104, 46, 1, 'var(--ink)')}${dot(104, 51.5, 1, 'var(--ink)')}<path d="M91 47L82 42M117 47L125 41" class="sk" stroke-width="1.2"/>
        ${flake(70, 22, 8, 10)}${flake(46, 48, 6, 0)}${flake(124, 12, 5, 20)}${flake(80, 56, 4.5, 15)}</g>`),
      deco: [flake(0, 0, 13, 0), flake(0, 0, 9, 15), dot(0, 0, 4, '#bfdbfe'), flake(0, 0, 11, 30), dot(0, 0, 3, '#bfdbfe'), flake(0, 0, 10, 5)],
    },
  };
})();
// 邊角點綴擺放位置：[left 或 right, %, top %]，盡量落在畫面邊緣與卡片之間的空隙
const SDECO_POS = [['right', -4, 3], ['left', -5, 33], ['right', -5, 50], ['left', -5, 66], ['right', -4, 84], ['left', 26, 97]];
let curSeason = '';
function applySeason(date) {
  const s = seasonOf(date);
  if (s === curSeason) return;
  curSeason = s;
  document.documentElement.dataset.season = s;
  const art = SART[s];
  $('#seasonDeco').innerHTML = art.deco.map((d, i) => {
    const [side, x, y] = SDECO_POS[i];
    return `<svg class="sd" viewBox="-30 -30 60 60" style="${side}:${x}%;top:${y}%" aria-hidden="true">${d}</svg>`;
  }).join('');
  $('#dateArt').innerHTML = art.card;
}

/* ── 小工具 ── */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = (n) => Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
const WEEK = '日一二三四五六';
function dayLabel(s) {
  const d = new Date(s + 'T00:00:00');
  const t = today();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (s === t) return '今天';
  if (s === ymd(y)) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}
function addPeriod(dateStr, repeat) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  if (repeat === 'monthly') d.setMonth(d.getMonth() + 1, 1);
  else if (repeat === 'yearly') d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
}
const busy = (on) => $('#mask').classList.toggle('on', on);

/* ── IndexedDB ── */
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ledger', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('tx', { keyPath: 'id' });
      d.createObjectStore('categories', { keyPath: 'id' });
      d.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const done = (t) => new Promise((res, rej) => { t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); });
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const getAll = (name) => reqP(db.transaction(name).objectStore(name).getAll());
function putMany(name, items) {
  const t = db.transaction(name, 'readwrite');
  const s = t.objectStore(name);
  for (const i of items) s.put(i);
  return done(t);
}
const getMeta = (k) => reqP(db.transaction('meta').objectStore('meta').get(k));
function setMeta(k, v) {
  const t = db.transaction('meta', 'readwrite');
  t.objectStore('meta').put(v, k);
  return done(t);
}
function clearAll() {
  const t = db.transaction(['tx', 'categories', 'meta'], 'readwrite');
  ['tx', 'categories', 'meta'].forEach((n) => t.objectStore(n).clear());
  return done(t);
}

/* ── 狀態 ── */
const S = {
  tx: [],              // 全部紀錄（含已刪除，view 時過濾）
  cats: [], catById: new Map(),
  noteIdx: new Map(),  // 備註 -> {count, date, categoryId, subcategoryId, type}
  freq: { expense: [], income: [] },
  type: 'expense', expr: '', subId: null, date: today(), editing: null, repeat: '', returnTo: null,
  month: today().slice(0, 7), query: '', listLimit: 300, filter: null,
};
const live = () => S.tx.filter((t) => !t.deleted);

function indexCats() {
  S.catById = new Map(S.cats.map((c) => [c.id, c]));
}
const roots = (type) => S.cats.filter((c) => c.type === type && !c.parentId).sort((a, b) => a.order - b.order);
const subsOf = (rid) => S.cats.filter((c) => c.parentId === rid).sort((a, b) => a.order - b.order);
const catName = (id) => S.catById.get(id)?.name ?? '（未知）';

function rebuildIndexes() {
  S.noteIdx.clear();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 180);
  const cut = ymd(cutoff);
  const freq = { expense: new Map(), income: new Map() };
  S.byDate = new Map();
  for (const t of S.tx) {
    if (t.deleted) continue;
    const bd = S.byDate.get(t.date); if (bd) bd.push(t); else S.byDate.set(t.date, [t]);
    if (t.note) {
      const k = t.note;
      const e = S.noteIdx.get(k);
      if (!e) S.noteIdx.set(k, { count: 1, date: t.date, categoryId: t.categoryId, subcategoryId: t.subcategoryId, type: t.type });
      else {
        e.count++;
        if (t.date >= e.date) Object.assign(e, { date: t.date, categoryId: t.categoryId, subcategoryId: t.subcategoryId, type: t.type });
      }
    }
    if (t.date >= cut && !t.scheduled) {
      const m = freq[t.type];
      if (m) m.set(t.subcategoryId, (m.get(t.subcategoryId) || 0) + 1);
    }
  }
  for (const type of ['expense', 'income']) {
    let list = [...freq[type].entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => S.catById.has(id));
    // 資料不足時用分類順序補滿
    for (const r of roots(type)) for (const s of subsOf(r.id)) if (!list.includes(s.id)) list.push(s.id);
    S.freq[type] = list.slice(0, 8);
  }
  updateDue();
}

// 舊資料補小類（v1.22.0 加「交通/車貸」）；已有同名小類就不動
async function ensureSub(rid, name, id) {
  if (!S.cats.some((c) => c.id === rid) || S.cats.some((c) => c.parentId && c.name === name)) return;
  if (S.cats.some((c) => c.id === id)) id = 'c-' + uid();
  const c = { id, name, parentId: rid, type: 'expense', order: S.cats.filter((x) => x.parentId === rid).length };
  S.cats.push(c); await putMany('categories', [c]);
}
async function loadAll() {
  S.cats = await getAll('categories');
  if (!S.cats.length) {
    S.cats = defaultCategories();
    await putMany('categories', S.cats);
  }
  await ensureSub('exp-01', '車貸', 'exp-01-05');
  indexCats();
  S.tx = await getAll('tx');
  await loadBudget();
  rebuildIndexes();
}

/* ── 記一筆 ── */
function setNote(v) { const el = $('#note'); el.value = v; fitNote(); }
function fitNote() {
  const el = $('#note');
  const lh = 22.4, pad = 24, lines = document.activeElement === el ? 5 : 2;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight + 2, lines * lh + pad) + 'px';
}
function evalExpr(expr) {
  const parts = expr.split('+').filter((p) => p !== '' && p !== '.');
  return Math.round(parts.reduce((s, p) => s + Number(p), 0) * 100) / 100;
}
function renderAmount() {
  const el = $('#amount');
  el.classList.toggle('income', S.type === 'income');
  if (!S.expr) { el.innerHTML = '<span class="ph">0</span>'; return; }
  const v = evalExpr(S.expr);
  el.textContent = S.expr.includes('+') ? `${S.expr.replace(/\+/g, ' + ')} = ${money(v)}` : S.expr;
}
function renderPicked() {
  if (!$('#picked')) return;
  const c = S.catById.get(S.subId);
  $('#picked').innerHTML = c
    ? `${catIcon(c.parentId)}<span class="pt">${c.parentId && catName(c.parentId) !== c.name ? `<small>${esc(catName(c.parentId))}</small>` : ''}<b>${esc(c.name)}</b></span>`
    : '<span class="pt"><small>分類</small><b>請選擇</b></span>';
}
function renderTypeToggle() {
  $('#typeToggle').innerHTML = `<span data-t="expense" class="${S.type === 'expense' ? 'on' : ''}">支出</span><span data-t="income" class="${S.type === 'income' ? 'on inc' : ''}">收入</span>`;
}
const addDays = (s, n) => { const t = new Date(s + 'T00:00:00'); t.setDate(t.getDate() + n); return ymd(t); };
function heroInfo(date) {
  const d = new Date(date + 'T00:00:00'), T = today();
  const diff = Math.round((new Date(T + 'T00:00:00') - d) / 86400000);
  return {
    diff,
    label: `${date.slice(0, 4) !== T.slice(0, 4) ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日 週${WEEK[d.getDay()]}`,
    badge: diff === 0 ? '今天' : diff === 1 ? '昨天' : diff === -1 ? '明天・預定' : diff > 0 ? `${diff} 天前` : `${-diff} 天後・預定`,
    cls: (diff === 0 ? 'today' : diff > 0 ? 'past' : 'future') + ' s-' + seasonOf(date),
  };
}
function dayData(date) {
  const items = (S.byDate?.get(date) || []).slice()
    .sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : (b.createdAt || '') < (a.createdAt || '') ? -1 : 0));
  const real = items.filter((t) => !t.scheduled);
  return {
    items, real,
    exp: real.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    inc: real.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    sch: items.length - real.length,
    md: date === today() ? '今天' : mdOf(date),
  };
}
const daySumHTML = (dd) => (dd.items.length
  ? `<span>${dd.md} 已記 <b>${dd.real.length}</b> 筆・支出 <b>${money(dd.exp)}</b>${dd.inc ? `・收入 <b>${money(dd.inc)}</b>` : ''}${dd.sch ? `・預定 ${dd.sch}` : ''}</span>`
  : `<span>${dd.md} 還沒有紀錄</span>`);
const dayListHTML = (items) => (items.length
  ? `<div class="list">${items.map((t) => rowHTML(t).replace('class="rw"', `class="rw${t.id === S.fresh ? ' fresh' : ''}"`)
    .replace('class="row"', `class="row${t.id === S.editing ? ' editing' : ''}"`)).join('')}</div>`
  : '<div class="di-empty">這天還沒有紀錄</div>');
function sidePageHTML(date) {
  const h = heroInfo(date), dd = dayData(date);
  return `<div class="date-hero ${h.cls}"><span class="dh-pick"><span class="dh-date">${h.label}</span></span><span class="dh-badge">${h.badge}</span>
    <span class="day-sum">${daySumHTML(dd)}</span></div><div class="day-wrap"><span class="dh-art">${SART[seasonOf(date)].card}</span><div class="day-inline">${dayListHTML(dd.items)}</div></div>`;
}
function renderDate() {
  $('#date').value = S.date;
  const h = heroInfo(S.date);
  $('#dateLabel').textContent = h.label;
  $('#dateBadge').textContent = h.badge;
  $('#dateHero').className = 'date-hero ' + h.cls;
  applySeason(S.date);
  $('#dayToday').disabled = h.diff === 0;
}
const mdOf = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8))}`;
function chip(id, on, withParent = true) {
  const c = S.catById.get(id);
  if (!c) return '';
  const parent = c.parentId ? catName(c.parentId) : '';
  const showParent = withParent && parent && parent !== c.name;
  return `<button class="chip${on ? ' on' : ''}" data-sub="${esc(id)}"><span class="e">${catLook(c.parentId || c.id)[0]}</span>${esc(c.name)}${showParent ? `<small>${esc(parent)}</small>` : ''}</button>`;
}
function renderCats() {
  const freq = S.freq[S.type].slice();
  if (S.subId && !freq.includes(S.subId) && S.catById.get(S.subId)?.type === S.type) freq.unshift(S.subId);  // 選中的不在常用裡 → 排到第一個
  const shown = freq.slice(0, 7);
  if (S.subId && !shown.includes(S.subId) && S.catById.get(S.subId)?.type === S.type) shown[6] = S.subId;
  $('#freqCats').innerHTML = shown.map((id) => {
    const c = S.catById.get(id); if (!c) return '';
    return `<button class="tile${id === S.subId ? ' on' : ''}" data-sub="${esc(id)}"><span class="e">${catLook(c.parentId || c.id)[0]}</span><span class="n">${esc(c.name)}</span></button>`;
  }).join('') + `<button class="tile more" id="moreCats"><span class="e">${hd('more')}</span><span class="n">更多</span></button>`;
  $('#allCats').innerHTML = roots(S.type).map((r) => {
    const [e, h] = catLook(r.id);
    const subs = subsOf(r.id);
    const has = subs.some((s) => s.id === S.subId);
    return `<section class="cs${has ? ' has' : ''}" style="--h:${h}">
      <div class="cs-h"><span class="cs-e">${e}</span><b>${esc(r.name)}</b></div>
      <div class="cs-g">${subs.map((s) => `<button class="st${s.id === S.subId ? ' on' : ''}" data-sub="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>
    </section>`;
  }).join('');
}
function renderSugs() {
  const q = $('#note').value.trim();
  const done = '<button class="chip done" data-done>完成</button>';
  if (!q) { $('#sugs').innerHTML = done; return; }
  const out = [];
  for (const [note, e] of S.noteIdx) {
    if (note !== q && note.length <= 30 && !note.includes('\n') && note.includes(q)) out.push([note, e]);
  }
  out.sort((a, b) => (b[1].count - a[1].count) || (b[1].date > a[1].date ? 1 : -1));
  $('#sugs').innerHTML = done + out.slice(0, 8).map(([n]) => `<button class="chip" data-note="${esc(n)}">${esc(n)}</button>`).join('');
}
function renderAdd() {
  renderTypeToggle(); renderDate(); renderAmount(); renderPicked(); renderCats(); renderSugs(); renderBudgetLine();
  const ed = S.editing && S.tx.find((t) => t.id === S.editing);
  $('#editBar').classList.toggle('on', !!ed);
  $('#v-add').classList.toggle('editing', !!ed);
  $('#btnConfirm').hidden = !(ed && ed.scheduled);
  if (ed) {
    $('#editTitle').textContent = ed.scheduled ? '正在編輯預定' : '正在編輯';
    $('#editSub').textContent = `原本：${mdOf(ed.date)} ${catName(ed.subcategoryId)} ${money(ed.amount)}`;
    $('#editDate').value = S.date;
  }
  $('[data-k="ok"]').innerHTML = ed ? `儲存修改<br>${mdOf(S.date)}` : (S.date > today() ? `排入<br>${mdOf(S.date)}` : `記到<br>${mdOf(S.date)}`);
  renderRepeat(ed);
  renderDay();
  renderNotePrev();
}
function renderNotePrev() { fitNote(); }
/* ── 抽屜 ── */
function openDrawer(id) {
  closeDrawers();
  $('#' + id).classList.add('on'); $('#drawerBg').classList.add('on');
}
function closeDrawers() {
  document.querySelectorAll('.drawer.on').forEach((d) => d.classList.remove('on'));
  $('#drawerBg').classList.remove('on');
}
const REPEAT_LABEL = { '': '不重複', monthly: '每月', yearly: '每年' };
function renderRepeat(ed) {
  const pill = $('#repeatPill');
  pill.hidden = !!(ed && !ed.scheduled);   // 已入帳的紀錄不能改重複
  $('#repeat').value = S.repeat;
  $('#repeatLabel').innerHTML = S.repeat ? `${hd('rep')} ${REPEAT_LABEL[S.repeat]}` : '不重複';
  pill.classList.toggle('on', !!S.repeat);
}
function resetForm(keepDate) {
  closeDrawers();
  S.expr = ''; S.editing = null; S.repeat = '';
  if (!keepDate) S.date = today();
  S.subId = S.freq[S.type][0] ?? null;
  setNote('');
}
function setType(type) {
  if (S.type === type) return;
  S.type = type;
  const cur = S.catById.get(S.subId);
  if (!cur || cur.type !== type) S.subId = S.freq[type][0] ?? null;
}

function keyPress(k) {
  if (k === 'back') S.expr = S.expr.slice(0, -1);
  else if (k === 'clear') S.expr = '';
  else if (k === '+') { if (S.expr && !S.expr.endsWith('+')) S.expr += '+'; }
  else if (k === 'ok') return save();
  else {
    const seg = S.expr.split('+').pop();
    if (k === '.' && seg.includes('.')) return;
    if (seg.includes('.') && seg.split('.')[1].length >= 2) return;
    if (seg.replace('.', '').length >= 9) return;
    if ((k === '0' || k === '00') && seg === '0') return;
    if (seg === '0' && k !== '.') S.expr = S.expr.slice(0, -1);
    S.expr += (k === '.' && seg === '') ? '0.' : k;
  }
  renderAmount();
}

async function save() {
  const amount = evalExpr(S.expr);
  if (!(amount > 0)) return toast('請輸入金額');
  const sub = S.catById.get(S.subId);
  if (!sub) return toast('請選分類');
  const now = new Date().toISOString();
  const note = $('#note').value.trim();
  let rec, msg;
  const batch = [];
  if (S.editing) {
    rec = S.tx.find((t) => t.id === S.editing);
    Object.assign(rec, { date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note, updatedAt: now });
    if (rec.scheduled) { if (S.repeat) rec.repeat = S.repeat; else delete rec.repeat; }
    batch.push(rec);
    msg = `已儲存　${catName(sub.id)} ${money(amount)}`;
  } else {
    rec = { id: uid(), date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note, createdAt: now, updatedAt: now };
    batch.push(rec);
    if (S.date > today()) {             // 未來日期 → 預定
      rec.scheduled = true;
      if (S.repeat) rec.repeat = S.repeat;
      msg = `已排入預定 ${S.date.slice(5).replace('-', '/')}${S.repeat ? `，${REPEAT_LABEL[S.repeat]}重複` : ''}`;
    } else if (S.repeat) {              // 今天記一筆，順便排好下一期
      const next = { ...rec, id: uid(), date: addPeriod(S.date, S.repeat), scheduled: true, repeat: S.repeat };
      batch.push(next);
      msg = `已記 ${money(amount)}，下一筆排在 ${next.date.slice(5).replace('-', '/')}`;
    } else msg = `已記　${catName(sub.id)} ${money(amount)}`;
    S.tx.push(...batch);
  }
  await putMany('tx', batch);
  scheduleSync();
  const wasEditing = !!S.editing;
  // 剛記／剛改的那筆在當天清單上閃一下（只閃一次）
  S.fresh = rec.id; setTimeout(() => { if (S.fresh === rec.id) S.fresh = null; }, 600);
  rebuildIndexes();
  resetForm(!wasEditing);
  toast(msg);
  if (wasEditing) leaveEdit(); else renderAdd();
}
function leaveEdit() {
  const back = S.returnTo; S.returnTo = null;
  if (back === 'sched') { switchView('v-list'); openSched(); }
  else if (back === 'add') { S.date = S.returnDate || today(); S.returnDate = null; switchView('v-add'); }
  else switchView('v-list');
}

/* ── 記一筆：左右滑換天 ── */
function shiftDay(d) {
  const t = new Date(S.date + 'T00:00:00');
  t.setDate(t.getDate() + d);
  S.date = ymd(t);
  renderAdd();
  for (const el of [$('#dateHero'), document.querySelector('#dayInline .list') || document.querySelector('#dayInline .di-empty'), document.querySelector('#dayList .list')]) {
    if (!el) continue;
    el.classList.remove('inL', 'inR'); void el.offsetWidth;
    el.classList.add(d > 0 ? 'inL' : 'inR');
  }
}
function bindDaySwipe(zone, animEl) {
  let sx = 0, sy = 0, lx = 0, active = false, horiz = null;
  const reset = () => { const el = animEl(); if (el) { el.style.transition = ''; el.style.transform = ''; } };
  const finish = () => {
    if (!active) return;
    active = false; reset();
    if (horiz && Math.abs(lx - sx) >= 45) shiftDay(lx < sx ? 1 : -1);   // 往左滑 → 下一天
  };
  zone.addEventListener('touchstart', (e) => {
    active = e.touches.length === 1 && !S.editing && !e.target.closest('textarea');
    if (!active) return;
    sx = lx = e.touches[0].clientX; sy = e.touches[0].clientY; horiz = null;
  }, { passive: true });
  zone.addEventListener('touchmove', (e) => {
    if (!active) return;
    lx = e.touches[0].clientX;
    const dx = lx - sx, dy = e.touches[0].clientY - sy;
    if (horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horiz = Math.abs(dx) > Math.abs(dy);
    if (horiz) {
      e.preventDefault();   // 不讓 iOS 把手勢拿去捲動
      const el = animEl(); if (el) { el.style.transition = 'none'; el.style.transform = `translateX(${dx * 0.35}px)`; }
    }
  }, { passive: false });
  zone.addEventListener('touchend', finish);
  zone.addEventListener('touchcancel', finish);
}
/* 換天：拖動時整條（前一天｜當天｜後一天）跟著手指走，放手後滑到定位再換資料 */
const PAGER = { anim: false };
function pagerSet(px, animate) {
  const tr = $('#dayTrack'), w = $('#dayPager').clientWidth;
  tr.style.transition = animate ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'none';
  tr.style.transform = `translateX(${-w + px}px)`;
}
function slideDay(d) {
  if (PAGER.anim) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { shiftDay(d); return; }
  PAGER.anim = true;
  const tr = $('#dayTrack'), w = $('#dayPager').clientWidth;
  let done = false;
  const commit = () => {
    if (done) return; done = true;
    S.date = addDays(S.date, d);
    tr.style.transition = 'none'; tr.style.transform = '';
    renderAdd();
    PAGER.anim = false;
  };
  pagerSet(d > 0 ? -w : w, true);
  tr.addEventListener('transitionend', commit, { once: true });
  setTimeout(commit, 400);
}
function setupDayPager() {
  const zone = $('#dayPager');
  let sx = 0, sy = 0, lx = 0, lt = 0, vx = 0, active = false, horiz = null;
  zone.addEventListener('touchstart', (e) => {
    active = e.touches.length === 1 && !S.editing && !PAGER.anim;
    if (!active) return;
    sx = lx = e.touches[0].clientX; sy = e.touches[0].clientY; lt = e.timeStamp; vx = 0; horiz = null;
  }, { passive: true });
  zone.addEventListener('touchmove', (e) => {
    if (!active) return;
    const x = e.touches[0].clientX, dx = x - sx, dy = e.touches[0].clientY - sy;
    if (horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horiz = Math.abs(dx) > Math.abs(dy);
    if (!horiz) return;
    e.preventDefault();
    const dt = Math.max(1, e.timeStamp - lt);
    vx = (x - lx) / dt; lx = x; lt = e.timeStamp;
    pagerSet(dx, false);
  }, { passive: false });
  const end = () => {
    if (!active) return;
    active = false;
    if (!horiz) return;
    const dx = lx - sx, w = zone.clientWidth;
    if (Math.abs(dx) > w * 0.22 || (Math.abs(vx) > 0.45 && Math.abs(dx) > 24)) slideDay(dx < 0 ? 1 : -1);   // 往左 → 下一天
    else pagerSet(0, true);
  };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
}
function setupDaySwipe() {
  setupDayPager();
  bindDaySwipe($('#dayList'), () => document.querySelector('#dayList .list'));
  $('#dayPrev').addEventListener('click', () => slideDay(-1));
  $('#dayNext').addEventListener('click', () => slideDay(1));
  $('#dayToday').addEventListener('click', () => { const t = new Date(S.date + 'T00:00:00'); const diff = Math.round((new Date(today() + 'T00:00:00') - t) / 86400000); if (diff) shiftDay(diff); });
  $('#dayList').addEventListener('click', (e) => { const b = e.target.closest('[data-dn]'); if (b) shiftDay(Number(b.dataset.dn)); });
}

/* ── 記一筆：當天紀錄 ── */
function updateMoreHint() {
  const d = $('#dayInline'), hint = $('#moreHint');
  if (d.style.visibility === 'hidden') { hint.hidden = true; return; }
  const bottom = d.scrollTop + d.clientHeight;
  const hidden = [...d.querySelectorAll('.rw')].filter((r) => r.offsetTop + r.offsetHeight / 2 > bottom).length;
  hint.hidden = !hidden;
  if (hidden) hint.textContent = `還有 ${hidden} 筆 ↓`;
}
function renderDay() {
  const dd = dayData(S.date), items = dd.items, exp = dd.exp;
  const [, m, d] = S.date.split('-');
  $('#daySum').innerHTML = daySumHTML(dd);
  $('#daySum').disabled = false;
  $('#dayInline').innerHTML = dayListHTML(items);
  if (S.fresh) { const f = $('#dayInline .rw.fresh'); if (f) f.scrollIntoView({ block: 'nearest' }); }
  $('#pagePrev').innerHTML = sidePageHTML(addDays(S.date, -1));
  $('#pageNext').innerHTML = sidePageHTML(addDays(S.date, 1));
  requestAnimationFrame(() => {
    document.querySelectorAll('#dayTrack .day-inline').forEach((el) => { el.style.visibility = el.clientHeight < 34 ? 'hidden' : ''; });
    updateMoreHint();
  });
  const dw = WEEK[new Date(S.date + 'T00:00:00').getDay()];
  $('#dayList').innerHTML = `<div class="day-h dl-h"><button class="day-nav sm" data-dn="-1" aria-label="前一天">‹</button>
      <span class="dl-t">${S.date.slice(0, 4) !== today().slice(0, 4) ? S.date.slice(0, 4) + ' ' : ''}${Number(m)}/${Number(d)}（${dw}）${S.date === today() ? '今天' : ''}</span>
      <span class="dl-s">${exp ? '支出 ' + money(exp) : ''}</span><button class="day-nav sm" data-dn="1" aria-label="下一天">›</button></div>
    <div class="list">${items.length
      ? items.map((t) => rowHTML(t).replace('class="row"', `class="row${t.id === S.editing ? ' editing' : ''}"`)).join('')
      : '<div class="dl-empty">這天沒有紀錄，左右滑可以換天</div>'}</div>`;
}

function startEdit(id) {
  const t = S.tx.find((x) => x.id === id);
  if (!t) return;
  S.editing = id; S.type = t.type; S.expr = String(t.amount); S.date = t.date; S.subId = t.subcategoryId;
  S.repeat = t.scheduled ? (t.repeat || '') : '';
  setNote(t.note || '');
  switchView('v-add');
}
async function softDelete(id) {
  const t = S.tx.find((x) => x.id === id);
  if (!t) return;
  t.deleted = true; t.updatedAt = new Date().toISOString();
  await putMany('tx', [t]);
  scheduleSync();
  rebuildIndexes();
  toast('已刪除');
}
// 預定 → 入帳；有週期的自動排下一期
async function confirmRecord(t) {
  const now = new Date().toISOString();
  delete t.scheduled;
  t.updatedAt = now;
  const batch = [t];
  let next = null;
  if (t.repeat) {
    next = { id: uid(), date: addPeriod(t.date, t.repeat), type: t.type, amount: t.amount, categoryId: t.categoryId,
      subcategoryId: t.subcategoryId, note: t.note, scheduled: true, repeat: t.repeat, createdAt: now, updatedAt: now };
    delete t.repeat;
    S.tx.push(next); batch.push(next);
  }
  await putMany('tx', batch);
  scheduleSync();
  rebuildIndexes();
  return next;
}
async function confirmScheduled() {
  const t = S.tx.find((x) => x.id === S.editing);
  if (!t) return;
  const amount = evalExpr(S.expr);
  const sub = S.catById.get(S.subId);
  if (!(amount > 0) || !sub) return toast('金額或分類不正確');
  Object.assign(t, { date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note: $('#note').value.trim() });
  if (S.repeat) t.repeat = S.repeat; else delete t.repeat;
  const next = await confirmRecord(t);
  resetForm();
  toast(next ? `已入帳，下一筆排在 ${next.date.slice(5).replace('-', '/')}` : '已入帳');
  leaveEdit();
}

/* ── 預定與週期 ── */
const dueList = () => live().filter((t) => t.scheduled && t.date <= today()).sort((a, b) => (a.date < b.date ? -1 : 1));
function updateDue() {
  const n = dueList().length;
  const b = $('#dueBanner');
  if (b) {
    b.hidden = !n;
    if (n) b.innerHTML = `有 ${n} 筆預定到期了<button id="dueOpen">查看</button>`;
  }
  const tab = document.querySelector('#tabs [data-v="v-list"]');
  if (tab) tab.classList.toggle('dot', n > 0);
  $('#fabMain')?.classList.toggle('dot', n > 0);
  const c = $('#schedCount');
  if (c) {
    const all = live().filter((t) => t.scheduled).length;
    c.textContent = all ? `${all} 筆${n ? `，${n} 筆到期` : ''}` : '沒有';
  }
}
function schedRowHTML(t, due) {
  const inc = t.type === 'income';
  const sub = catName(t.subcategoryId), root = catName(t.categoryId);
  const [y, m, d] = t.date.split('-');
  const dateTxt = `${y !== today().slice(0, 4) ? y + '/' : ''}${Number(m)}/${Number(d)}`;
  return `<div class="ir sr">${catIcon(t.categoryId)}<div class="t" data-sedit="${esc(t.id)}">
      <div class="c">${dateTxt}　${esc(root !== sub ? `${root} › ${sub}` : sub)}${t.repeat ? `<span class="tag">${REPEAT_LABEL[t.repeat]}</span>` : ''}</div>
      ${t.note ? `<div class="n">${esc(t.note)}</div>` : ''}</div>
    <div class="a${inc ? ' inc' : ''}">${inc ? '+' : ''}${money(t.amount)}</div>
    ${due ? `<button class="chip" data-sok="${esc(t.id)}">入帳</button>` : ''}</div>`;
}
function renderSched() {
  const all = live().filter((t) => t.scheduled).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const due = all.filter((t) => t.date <= today()), later = all.filter((t) => t.date > today());
  const sec = (title, list, isDue) => list.length
    ? `<div class="day-h"><span>${title}</span><span>${list.length} 筆</span></div><div class="list">${list.map((t) => schedRowHTML(t, isDue)).join('')}</div>` : '';
  $('#schedList').innerHTML = all.length
    ? sec('已到期，等你確認', due, true) + sec('即將到來', later, false)
    : '<div class="empty">還沒有預定項目<br>記一筆時選「每月」或「每年」，或把日期選在未來，就會出現在這裡</div>';
}
function openSched() { renderSched(); $('#schedView').classList.add('on'); }
function closeSched() { $('#schedView').classList.remove('on'); }
function bindSched() {
  $('#schedClose').addEventListener('click', () => { closeSched(); refreshCurrentView(); });
  $('#schedList').addEventListener('click', async (e) => {
    const ok = e.target.closest('[data-sok]');
    if (ok) {
      const t = S.tx.find((x) => x.id === ok.dataset.sok); if (!t) return;
      const next = await confirmRecord(t);
      toast(next ? `已入帳 ${money(t.amount)}，下一筆排在 ${next.date.slice(5).replace('-', '/')}` : `已入帳 ${money(t.amount)}`);
      renderSched(); return;
    }
    const ed = e.target.closest('[data-sedit]');
    if (ed) { closeSched(); S.returnTo = 'sched'; startEdit(ed.dataset.sedit); }
  });
  document.addEventListener('click', (e) => { if (e.target.id === 'dueOpen') openSched(); });
  $('#btnSched').addEventListener('click', openSched);
  $('#repeat').addEventListener('change', (e) => { S.repeat = e.target.value; renderAdd(); });
}

/* ── 明細 ── */
function rowHTML(t) {
  const inc = t.type === 'income';
  const cname = catName(t.subcategoryId);
  const root = catName(t.categoryId);
  const title = root !== cname ? `${cname}` : cname;
  return `<div class="rw"><button class="del" data-del="${esc(t.id)}">刪除</button>
    <div class="row" data-id="${esc(t.id)}">${catIcon(t.categoryId)}<div class="t"><div class="c">${esc(title)}${t.scheduled ? '<span class="tag">預定</span>' : ''}</div>
    ${t.note ? `<div class="n">${esc(t.note)}</div>` : ''}</div>
    <div class="a${inc ? ' inc' : ''}">${inc ? '+' : ''}${money(t.amount)}</div></div></div>`;
}
function groupHTML(items, showYear) {
  const byDay = new Map();
  for (const t of items) { if (!byDay.has(t.date)) byDay.set(t.date, []); byDay.get(t.date).push(t); }
  let html = '';
  for (const [d, list] of byDay) {
    const exp = list.filter((t) => t.type === 'expense' && !t.scheduled).reduce((s, t) => s + t.amount, 0);
    html += `<div class="day-h"><span>${showYear ? d.slice(0, 4) + ' ' : ''}${dayLabel(d)}</span><span>${exp ? '支出 ' + money(exp) : ''}</span></div>
      <div class="list">${list.map(rowHTML).join('')}</div>`;
  }
  return html;
}
const sortDesc = (a, b) => (a.date === b.date ? ((b.createdAt || '') > (a.createdAt || '') ? 1 : -1) : (b.date > a.date ? 1 : -1));

function renderList() {
  const q = S.query.trim();
  const f = S.filter;
  $('#monthArea').style.display = q || f ? 'none' : '';
  $('#filterChip').hidden = !f || !!q;
  let items;
  if (f && !q) {
    const c = S.catById.get(f.id);
    $('#filterText').textContent = `${c?.parentId ? catName(c.parentId) + ' › ' : ''}${catName(f.id)}・${periodLabel(f.period)}`;
    $('#filterMin').classList.toggle('on', !!f.min);
    items = live().filter((t) => t.date.startsWith(f.period) && (t.subcategoryId === f.id || t.categoryId === f.id) && (!f.min || t.amount >= f.min));
  } else if (q) {
    items = live().filter((t) => (t.note || '').includes(q) || catName(t.subcategoryId).includes(q) || catName(t.categoryId).includes(q));
  } else {
    items = live().filter((t) => t.date.startsWith(S.month));
    const [y, m] = S.month.split('-');
    $('#monthLabel').textContent = `${y} 年 ${Number(m)} 月`;
    $('#monthPick').value = S.month;
  }
  items.sort(sortDesc);
  const real = items.filter((t) => !t.scheduled);
  const exp = real.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const inc = real.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  $('#sumCard').innerHTML = (q || f)
    ? `<div><small>找到</small><b>${items.length} 筆</b></div><div><small>支出合計</small><b>${money(exp)}</b></div>`
    : `<div><small>支出</small><b>${money(exp)}</b></div><div><small>收入</small><b class="inc">${money(inc)}</b></div><div><small>結餘</small><b>${money(inc - exp)}</b></div>`;
  if (!items.length) { $('#list').innerHTML = `<div class="empty">${q ? '找不到符合的紀錄' : f ? (f.min ? `沒有 ${money(f.min)} 以上的項目` : '沒有紀錄') : '這個月還沒有紀錄'}</div>`; return; }
  const shown = items.slice(0, S.listLimit);
  $('#list').innerHTML = groupHTML(shown, !!q) +
    (items.length > shown.length ? `<button class="more" id="moreBtn">再顯示 300 筆（還有 ${items.length - shown.length} 筆）</button>` : '');
  renderBackupBanner();
}
async function renderBackupBanner() {
  const last = await getMeta('lastExport');
  const n = live().length;
  const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
  const b = $('#backupBanner');
  const cfg = await syncCfg();
  const synced = cfg.lastSync && Date.now() - new Date(cfg.lastSync) < 7 * 86400000;
  if (n && !synced && (days === null || days >= 30)) {
    b.innerHTML = `${days === null ? '還沒有備份過' : `已經 ${days} 天沒備份`}<button id="bannerExport">現在備份</button>`;
    b.hidden = false;
  } else b.hidden = true;
}

/* 左滑刪除 */
function setupSwipe() {
  const list = $('#list');
  let sx = 0, sy = 0, row = null, dx = 0, moved = false, openRow = null;
  const close = (r) => { if (r) r.style.transform = ''; };
  list.addEventListener('touchstart', (e) => {
    const r = e.target.closest('.row');
    if (openRow && openRow !== r) { close(openRow); openRow = null; }
    if (!r) return;
    row = r; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; moved = false;
    row.style.transition = 'none';
  }, { passive: true });
  list.addEventListener('touchmove', (e) => {
    if (!row) return;
    const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (!moved && Math.abs(y) > Math.abs(x)) { row.style.transition = ''; row = null; return; }
    moved = true;
    const base = openRow === row ? -80 : 0;
    dx = Math.min(0, Math.max(-100, base + x));
    row.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  list.addEventListener('touchend', () => {
    if (!row) return;
    row.style.transition = '';
    if (moved) {
      if (dx < -40) { row.style.transform = 'translateX(-80px)'; openRow = row; }
      else { close(row); if (openRow === row) openRow = null; }
      const r = row;
      r.dataset.swiped = '1';
      setTimeout(() => { delete r.dataset.swiped; }, 350);
    }
    row = null;
  });
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      await softDelete(del.dataset.del);
      openRow = null; renderList(); return;
    }
    if (e.target.id === 'moreBtn') { S.listLimit += 300; renderList(); return; }
    const r = e.target.closest('.row');
    if (!r || r.dataset.swiped) return;
    if (openRow) { close(openRow); openRow = null; return; }
    startEdit(r.dataset.id);
  });
}

/* ── 設定 ── */
async function renderSettings() {
  const last = await getMeta('lastExport');
  $('#lastExport').textContent = last ? `上次 ${last.slice(0, 10)}` : '尚未備份';
  const l = live();
  $('#countInfo').textContent = `${l.length.toLocaleString()} 筆${l.length ? `（${l.reduce((a, t) => t.date < a ? t.date : a, '9999').slice(0, 4)} 起）` : ''}`;
  $('#ver').textContent = VERSION;
  renderSyncEdit();
  renderBudgetEdit();
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  $('#installHint').hidden = standalone;
  for (const [type, el] of [['expense', '#catEditExp'], ['income', '#catEditInc']]) {
    $(el).innerHTML = roots(type).map((r) => `<div class="cat-edit"><div class="root-name"><span>${esc(r.name)}</span><button data-rename="${esc(r.id)}">改名</button></div>
      <div class="cat-grid">${subsOf(r.id).map((s) => `<button class="chip" data-subact="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
      <button class="chip" data-addsub="${esc(r.id)}">＋</button></div></div>`).join('') +
      `<button class="item accent" data-addroot="${type}">＋ 新增大類</button>`;
  }
}

async function exportData() {
  const l = live();
  const data = {
    format: 'ledger-import', version: 2, source: 'ledger-pwa ' + VERSION, exportedAt: new Date().toISOString(),
    categories: S.cats,
    transactions: l.map(forServer),
    budgets: (await getMeta('budgets')) || [],
  };
  const name = `ledger-backup-${today().replace(/-/g, '')}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    await setMeta('lastExport', new Date().toISOString());
    toast(`已匯出 ${l.length.toLocaleString()} 筆`);
  } catch (err) {
    if (err.name !== 'AbortError') toast('匯出失敗：' + err.message);
  }
  renderSettings(); renderBackupBanner();
}

/* ── 匯入：解析檔案 → 預覽 → 勾選 → 寫入 ── */

// 快捷記帳本2 舊分類 → 新分類（大類, 小類）；'*' 代表該大類全部
const OLD_MAP = {
  '吃/食物': ['餐飲', '正餐'], '吃/飲料': ['餐飲', '飲料咖啡'], '吃/咖啡': ['餐飲', '飲料咖啡'], '吃/水': ['餐飲', '飲料咖啡'],
  '吃/牛奶': ['餐飲', '飲料咖啡'], '吃/雜項': ['餐飲', '零食甜點'], '吃/烘焙': ['餐飲', '零食甜點'], '吃/水果': ['餐飲', '水果'],
  '吃/保健食品': ['醫療保險', '保健食品'], 'Food/Meal': ['餐飲', '正餐'], 'Food/Drink': ['餐飲', '飲料咖啡'], 'Food/Groceries': ['餐飲', '食材'],
  '車/油費': ['交通', '油費'], '車/停車費': ['交通', '停車費'], '車/維修': ['交通', '維修保養'], '車/洗車': ['交通', '維修保養'],
  '車/雜項': ['交通', '維修保養'], '車/Insurance': ['醫療保險', '保險'], '車/大眾運輸': ['交通', '大眾運輸'], '交通/*': ['交通', '大眾運輸'],
  'Transportation/Metro': ['交通', '大眾運輸'], 'Transportation/Airfare': ['交通', '機票'],
  '房屋/房貸': ['居住', '房貸'], '房屋/管理費': ['居住', '管理費'], '房屋/傢俱': ['居住', '家具家用'], '房屋/雜項': ['居住', '家具家用'], '房屋/稅險': ['居住', '稅費'],
  '帳單/電費': ['帳單', '水電瓦斯'], '帳單/水費': ['帳單', '水電瓦斯'], '帳單/瓦斯費': ['帳單', '水電瓦斯'], '帳單/電話費': ['帳單', '電話網路'],
  '帳單/網路費': ['帳單', '電話網路'], '帳單/税': ['居住', '稅費'], '帳單/保險': ['醫療保險', '保險'], 'Bills/*': ['帳單', '電話網路'],
  '個人/電子產品': ['購物', '3C'], '個人/衣': ['購物', '服飾'], '個人/保養品': ['購物', '美容美髮'], '個人/髮': ['購物', '美容美髮'],
  '個人/書': ['購物', '書籍'], '個人/醫療': ['醫療保險', '醫療'], '個人/保險': ['醫療保險', '保險'], '個人/運動': ['娛樂', '運動'],
  '個人/雜項': ['其他', '其他'], 'Personal/*': ['其他', '其他'], '教育/*': ['購物', '書籍'],
  '雜項/玩樂': ['娛樂', '玩樂'], '雜項/夾娃娃': ['娛樂', '夾娃娃'], '雜項/雜貨': ['購物', '日用雜貨'], '雜項/送禮': ['人情', '送禮'], '雜項/毛毛': ['寵物', '貓'],
  '皓皓的吃喝玩樂拉撒睡/*': ['皓皓', '皓皓'], '工作/*': ['其他', '其他'], '股票/*': ['其他', '其他'],
  '薪水/*': ['收入', '薪水'], 'Income/*': ['收入', '薪水'], '拍賣/*': ['收入', '拍賣'], '統一發票/*': ['收入', '發票中獎'], '其他/*': ['收入', '其他收入'],
};
// 用預設分類的位置換成 ID（使用者改過分類名稱也對得上）
function defaultCatId(type, root, sub) {
  const tree = DEFAULT_TREE[type];
  const roots = Object.keys(tree);
  const i = roots.indexOf(root); if (i < 0) return null;
  const j = tree[root].indexOf(sub); if (j < 0) return null;
  const rid = `${type.slice(0, 3)}-${pad(i)}`;
  return [rid, `${rid}-${pad(j)}`];
}
function mapOldCategory(root, sub, type) {
  if (type === 'income' && root === '股票') return ['收入', '股票'];
  return OLD_MAP[`${root}/${sub}`] || OLD_MAP[`${root}/*`] || null;
}

async function unzipEntry(buf, wanted) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('不是有效的 .sbk（zip）檔');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    if (name === wanted || name.endsWith('/' + wanted)) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error('不支援的壓縮格式');
      if (typeof DecompressionStream === 'undefined') throw new Error('iOS 版本太舊，請更新到 16.4 以上');
      const out = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(out).arrayBuffer());
    }
    p += 46 + nl + el + cl;
  }
  throw new Error(`備份裡找不到 ${wanted}`);
}
let sqlPromise;
function loadSql() {
  if (!sqlPromise) {
    sqlPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'lib/sql-wasm.js';
      s.onload = () => initSqlJs({ locateFile: (f) => 'lib/' + f }).then(res, rej);
      s.onerror = () => rej(new Error('讀取元件載入失敗，請連網後重開 App 一次'));
      document.head.appendChild(s);
    }).catch((e) => { sqlPromise = null; throw e; });
  }
  return sqlPromise;
}
const tw8Date = (sec) => {
  const ts = Number(sec);
  if (!(ts > 0)) return null;
  const d = new Date(ts * 1000 + 8 * 3600000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
async function parseSbk(file) {
  const bytes = await unzipEntry(new Uint8Array(await file.arrayBuffer()), 'spending.dat');
  const SQL = await loadSql();
  const sdb = new SQL.Database(bytes);
  const rows = (sql) => { const st = sdb.prepare(sql), out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out; };
  try {
    const name = new Map(), kind = new Map();
    for (const r of rows('SELECT oldTitle, title, type FROM category')) {
      name.set(String(r.oldTitle), r.title);
      kind.set(String(r.oldTitle), r.type === 11 ? 'income' : r.type === 12 ? 'expense' : null);
    }
    const bookName = new Map(rows('SELECT oldTitle, title FROM account').map((r) => [String(r.oldTitle), r.title]));
    const out = [];
    let diary = 0, skipped = 0;
    for (const r of rows('SELECT * FROM transactions WHERE deleted = 0')) {
      const t = r.type, root = name.get(String(r.category)) || '', sub = name.get(String(r.subcategory)) || '';
      const date = tw8Date(r.datetime);
      if (t === 61) continue;                          // 預算設定
      if (root === '重點日記') { diary++; continue; }  // 日記不是帳
      if (![11, 12, 85].includes(t) || !date) { skipped++; continue; }
      const type = t === 85 ? (kind.get(String(r.category)) || 'expense') : (t === 11 ? 'income' : 'expense');
      const m = mapOldCategory(root, sub, type);
      const fallback = type === 'income' ? ['收入', '其他收入'] : ['其他', '其他'];
      const [cid, sid] = defaultCatId(type, ...(m || fallback)) || defaultCatId(type, ...fallback);
      const rec = { id: String(r.eid), date, type, amount: Number(r.amount) || 0, categoryId: cid, subcategoryId: sid,
        note: String(r.note || '').trim(), legacyCategory: `${root}/${sub}` };
      if (t === 85) rec.scheduled = true;
      if (r.repeat === 'Monthly') rec.repeat = 'monthly';
      if (r.repeat === 'Yearly') rec.repeat = 'yearly';
      const bk = bookName.get(String(r.book));
      if (bk && bk !== '我的消費記錄') rec.legacyBook = bk;
      if (!m) rec.unmapped = true;
      out.push(rec);
    }
    return { source: '快捷記帳備份', tx: out, categories: [], budgets: null, note: diary || skipped ? `（已排除日記 ${diary} 筆、空白紀錄 ${skipped} 筆）` : '' };
  } finally { sdb.close(); }
}
async function parseJson(file) {
  const data = JSON.parse(await file.text());
  if (data.format !== 'ledger-import' || !Array.isArray(data.transactions)) throw new Error('不是這個 App 的匯入檔');
  const tx = data.transactions.filter((t) => t.id && t.date && t.amount != null).map((t) => {
    const r = { id: String(t.id), date: t.date, type: t.type === 'income' ? 'income' : 'expense', amount: Number(t.amount),
      categoryId: t.categoryId, subcategoryId: t.subcategoryId, note: t.note || '' };
    for (const k of ['scheduled', 'repeat', 'legacyBook', 'legacyCategory', 'deleted', 'createdAt', 'updatedAt']) if (t[k]) r[k] = t[k];
    return r;
  });
  const categories = (data.categories || []).map(({ id, name, parentId, type, order }) => ({ id, name, parentId: parentId ?? null, type, order: order ?? 0 }));
  return { source: '備份檔', tx, categories, budgets: Array.isArray(data.budgets) ? data.budgets : null, note: '' };
}

const IMP = { all: [], shown: [], sel: new Set(), dup: new Set(), ignored: new Set(), showIgnored: false, limit: 200, parsed: null };
async function importData(file) {
  busy(true);
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const parsed = head[0] === 0x50 && head[1] === 0x4b ? await parseSbk(file) : await parseJson(file);
    openImport(parsed, new Set((await getMeta('importIgnored')) || []));
  } catch (err) {
    toast('匯入失敗：' + (err.message || err));
  } finally { busy(false); }
}
function openImport(parsed, ignored) {
  const have = new Set(S.tx.map((t) => t.id));
  const keyOf = (t) => `${t.date}|${t.type}|${t.amount}`;
  const existingKeys = new Set(live().map(keyOf));
  IMP.parsed = parsed;
  IMP.ignored = ignored;
  IMP.all = parsed.tx.filter((t) => !have.has(t.id) && !t.deleted).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  for (const t of IMP.all) { const sc = S.catById.get(t.subcategoryId); if (sc?.parentId) t.categoryId = sc.parentId; }   // 小類搬過家，跟著現在的大類
  IMP.existing = parsed.tx.length - IMP.all.length;
  IMP.dup = new Set(IMP.all.filter((t) => existingKeys.has(keyOf(t))).map((t) => t.id));
  IMP.sel = new Set(IMP.all.filter((t) => !IMP.dup.has(t.id) && !ignored.has(t.id)).map((t) => t.id));
  IMP.showIgnored = false; IMP.limit = 200;
  $('#impView').classList.add('on');
  renderImport();
}
function impRowHTML(t) {
  const on = IMP.sel.has(t.id), inc = t.type === 'income';
  const tags = (IMP.dup.has(t.id) ? '<span class="tag warn">可能重複</span>' : '') + (t.scheduled ? '<span class="tag">預定</span>' : '') +
    (t.unmapped ? '<span class="tag warn">分類未對應</span>' : '') + (IMP.ignored.has(t.id) ? '<span class="tag">之前略過</span>' : '');
  const sub = catName(t.subcategoryId), root = catName(t.categoryId);
  return `<label class="ir${on ? '' : ' off'}"><input type="checkbox" data-imp="${esc(t.id)}"${on ? ' checked' : ''}>
    ${catIcon(t.categoryId)}<div class="t"><div class="c">${esc(root !== sub ? `${root} › ${sub}` : sub)}${tags}</div><div class="n">${esc(t.note || (t.unmapped ? '舊分類：' + t.legacyCategory : ''))}</div></div>
    <div class="a${inc ? ' inc' : ''}">${inc ? '+' : ''}${money(t.amount)}</div></label>`;
}
function renderImport() {
  const visible = IMP.all.filter((t) => IMP.showIgnored || !IMP.ignored.has(t.id));
  const hiddenIgn = IMP.all.length - visible.length;
  const nSel = IMP.all.filter((t) => IMP.sel.has(t.id)).length;
  const nDup = visible.filter((t) => IMP.dup.has(t.id)).length;
  $('#impSum').innerHTML = `${esc(IMP.parsed.source)}裡有 <b>${IMP.parsed.tx.length.toLocaleString()}</b> 筆${esc(IMP.parsed.note)}<br>
    已經在 App 裡的 <b>${IMP.existing.toLocaleString()}</b> 筆會自動略過。<br>
    新的有 <b>${visible.length.toLocaleString()}</b> 筆${nDup ? `，其中 <b>${nDup}</b> 筆「可能重複」（同一天、同金額 App 裡已經有），預設不勾` : ''}。
    ${hiddenIgn ? `<br>另有 ${hiddenIgn} 筆是你之前選擇略過的 <button id="impShowIgn">顯示</button>` : ''}`;
  const shown = visible.slice(0, IMP.limit);
  let html = '', day = '';
  for (const t of shown) {
    if (t.date !== day) {
      if (day) html += '</div>';
      day = t.date;
      html += `<div class="day-h"><span>${t.date.slice(0, 4)} ${dayLabel(t.date)}</span></div><div class="list">`;
    }
    html += impRowHTML(t);
  }
  if (day) html += '</div>';
  if (!visible.length) html = '<div class="empty">沒有新的紀錄可以匯入</div>';
  if (visible.length > shown.length) html += `<button class="more" id="impMore">再顯示 200 筆（還有 ${visible.length - shown.length} 筆）</button>`;
  $('#impList').innerHTML = html;
  $('#impGo').textContent = nSel ? `匯入選取的 ${nSel.toLocaleString()} 筆` : '沒有選取';
  $('#impGo').disabled = !nSel && !IMP.all.length;
  if (!nSel && IMP.all.length) { $('#impGo').textContent = '不匯入，只記住略過'; $('#impGo').disabled = !$('#impRemember').checked; }
}
function closeImport() { $('#impView').classList.remove('on'); IMP.all = []; IMP.parsed = null; }
async function commitImport() {
  const now = new Date().toISOString();
  const pick = IMP.all.filter((t) => IMP.sel.has(t.id)).map((t) => {
    const r = { ...t, createdAt: t.createdAt || t.date + 'T00:00:00', updatedAt: t.updatedAt || now };
    delete r.unmapped;
    return r;
  });
  busy(true);
  try {
    const haveCat = new Set(S.cats.map((c) => c.id));
    const newCats = (IMP.parsed.categories || []).filter((c) => !haveCat.has(c.id));
    if (newCats.length) await putMany('categories', newCats);
    if (pick.length) await putMany('tx', pick);
    if (IMP.parsed.budgets && !(await getMeta('budgets'))) await setMeta('budgets', IMP.parsed.budgets);
    if ($('#impRemember').checked) {
      for (const t of IMP.all) { if (IMP.sel.has(t.id)) IMP.ignored.delete(t.id); else IMP.ignored.add(t.id); }
      await setMeta('importIgnored', [...IMP.ignored]);
    }
    navigator.storage?.persist?.();
    await loadAll();
    resetForm();
    const skipped = IMP.all.length - pick.length;
    closeImport();
    toast(pick.length ? `已匯入 ${pick.length.toLocaleString()} 筆${skipped ? `，略過 ${skipped} 筆` : ''}` : `已記住略過 ${skipped} 筆`);
    renderSettings();
    if (pick.length) scheduleSync(1000);
  } catch (err) {
    toast('匯入失敗：' + err.message);
  } finally { busy(false); }
}
function bindImport() {
  $('#impCancel').addEventListener('click', closeImport);
  $('#impGo').addEventListener('click', commitImport);
  $('#impRemember').addEventListener('change', renderImport);
  $('#impList').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-imp]'); if (!cb) return;
    if (cb.checked) IMP.sel.add(cb.dataset.imp); else IMP.sel.delete(cb.dataset.imp);
    cb.closest('.ir').classList.toggle('off', !cb.checked);
    const n = IMP.all.filter((t) => IMP.sel.has(t.id)).length;
    $('#impGo').textContent = n ? `匯入選取的 ${n.toLocaleString()} 筆` : '不匯入，只記住略過';
    $('#impGo').disabled = !n && !$('#impRemember').checked;
  });
  $('#impList').addEventListener('click', (e) => { if (e.target.id === 'impMore') { IMP.limit += 200; renderImport(); } });
  $('#impSum').addEventListener('click', (e) => { if (e.target.id === 'impShowIgn') { IMP.showIgnored = true; renderImport(); } });
  document.querySelector('.imp-ctl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sel]'); if (!b) return;
    const vis = IMP.all.filter((t) => IMP.showIgnored || !IMP.ignored.has(t.id));
    if (b.dataset.sel === 'all') vis.forEach((t) => IMP.sel.add(t.id));
    if (b.dataset.sel === 'none') vis.forEach((t) => IMP.sel.delete(t.id));
    if (b.dataset.sel === 'nodup') vis.forEach((t) => (IMP.dup.has(t.id) ? IMP.sel.delete(t.id) : IMP.sel.add(t.id)));
    renderImport();
  });
}

async function catAction(e) {
  const t = e.target.closest('[data-rename],[data-addsub],[data-addroot],[data-subact]');
  if (!t) return;
  if (t.dataset.subact) { openSubAction(t.dataset.subact); return; }
  if (t.dataset.rename) {
    const c = S.catById.get(t.dataset.rename);
    const name = prompt('改名', c.name)?.trim();
    if (!name || name === c.name) return;
    c.name = name; await putMany('categories', [c]);
  } else if (t.dataset.addsub) {
    const p = S.catById.get(t.dataset.addsub);
    const name = prompt(`在「${p.name}」新增小類`)?.trim();
    if (!name) return;
    const c = { id: 'c-' + uid(), name, parentId: p.id, type: p.type, order: subsOf(p.id).length };
    S.cats.push(c); await putMany('categories', [c]);
  } else {
    const type = t.dataset.addroot;
    const name = prompt('新增大類（會一起建立同名小類）')?.trim();
    if (!name) return;
    const r = { id: 'c-' + uid(), name, parentId: null, type, order: roots(type).length };
    const s = { id: 'c-' + uid(), name, parentId: r.id, type, order: 0 };
    S.cats.push(r, s); await putMany('categories', [r, s]);
  }
  indexCats(); rebuildIndexes(); renderSettings(); scheduleSync();
}

/* ── 小類：改名／搬到其他大類 ── */
function openSubAction(id) {
  const c = S.catById.get(id); if (!c) return;
  const n = S.tx.filter((t) => t.subcategoryId === id && !t.deleted).length;
  $('#catActTitle').innerHTML = `${catLook(c.parentId)[0]} ${esc(catName(c.parentId))} › ${esc(c.name)}`;
  $('#catActBody').innerHTML = `<p class="note-text">這個小類有 ${n.toLocaleString()} 筆紀錄。</p>
    <button class="item accent sa-btn" data-sa="rename">${hd('pen')} 改名</button>
    <button class="item accent sa-btn" data-sa="move">${hd('move')} 搬到其他大類</button>`;
  $('#catActBody').dataset.id = id;
  openDrawer('catActDrawer');
}
function showMoveTargets(id) {
  const c = S.catById.get(id);
  $('#catActBody').innerHTML = `<p class="note-text">選擇要搬到哪個大類（只能在${c.type === 'income' ? '收入' : '支出'}裡搬）：</p>
    <div class="mv-list">${roots(c.type).map((r) => {
      const [e, h] = catLook(r.id), cur = r.id === c.parentId;
      return `<button class="mv-root${cur ? ' cur' : ''}" style="--h:${h}" data-to="${esc(r.id)}"${cur ? ' disabled' : ''}><span class="cs-e">${e}</span><b>${esc(r.name)}</b>${cur ? '<small>目前所在</small>' : ''}</button>`;
    }).join('')}</div>`;
}
async function moveSub(id, toRoot) {
  const c = S.catById.get(id), from = c.parentId;
  if (!c || from === toRoot) return;
  const affected = S.tx.filter((t) => t.subcategoryId === id);
  const n = affected.filter((t) => !t.deleted).length;
  if (!confirm(`把「${c.name}」從「${catName(from)}」搬到「${catName(toRoot)}」，\n會一起改 ${n.toLocaleString()} 筆紀錄。確定嗎？`)) return;
  busy(true);
  try {
    const now = new Date().toISOString();
    c.parentId = toRoot;
    c.order = subsOf(toRoot).filter((s) => s.id !== id).length;
    await putMany('categories', [c]);
    for (const t of affected) { t.categoryId = toRoot; t.updatedAt = now; }
    if (affected.length) await putMany('tx', affected);
    indexCats(); rebuildIndexes();
    closeDrawers(); renderSettings(); scheduleSync(2000);
    toast(`已搬到「${catName(toRoot)}」，更新 ${n.toLocaleString()} 筆`);
  } catch (err) {
    toast('搬移失敗：' + err.message);
  } finally { busy(false); }
}
async function onSubAction(e) {
  const id = $('#catActBody').dataset.id;
  const a = e.target.closest('[data-sa]');
  if (a?.dataset.sa === 'move') { showMoveTargets(id); return; }
  if (a?.dataset.sa === 'rename') {
    const c = S.catById.get(id);
    closeDrawers();
    const name = prompt('改名', c.name)?.trim();
    if (!name || name === c.name) return;
    c.name = name; await putMany('categories', [c]);
    indexCats(); rebuildIndexes(); renderSettings(); scheduleSync();
    return;
  }
  const to = e.target.closest('[data-to]');
  if (to && !to.disabled) moveSub(id, to.dataset.to);
}

/* ── 預算 ── */
let BUDGET = { total: 0, cats: {} };
async function loadBudget() {
  const b = await getMeta('budget');
  BUDGET = { total: Number(b?.total) || 0, cats: b?.cats || {} };
}
const saveBudget = () => setMeta('budget', BUDGET);
function monthExpense(month, rootId) {
  let s = 0;
  for (const t of S.tx) {
    if (t.deleted || t.scheduled || t.type !== 'expense' || !t.date.startsWith(month)) continue;
    if (rootId && t.categoryId !== rootId) continue;
    s += t.amount;
  }
  return s;
}
function budgetFor(period, rootId) {
  const per = rootId ? Number(BUDGET.cats[rootId]) || 0 : BUDGET.total;
  return period.length === 4 ? per * 12 : per;
}
function renderBudgetLine() {
  const el = $('#budgetLine');
  if (!BUDGET.total || S.type !== 'expense') { el.textContent = ''; return; }
  const m = today().slice(0, 7);
  const left = BUDGET.total - monthExpense(m);
  const d = new Date();
  const daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
  el.innerHTML = left >= 0
    ? `本月預算剩 ${money(left)}，平均每天可花 ${money(Math.floor(left / daysLeft))}`
    : `<span class="over-t">本月已超支 ${money(-left)}</span>`;
}
function renderBudgetEdit() {
  const rows = roots('expense').map((r) => `<div class="item"><span>${esc(r.name)}</span>
    <input class="num-in" inputmode="numeric" data-bud="${esc(r.id)}" value="${BUDGET.cats[r.id] || ''}" placeholder="—"></div>`).join('');
  $('#budgetEdit').innerHTML = `<div class="item"><b>總預算</b><input class="num-in" inputmode="numeric" data-bud="__total" value="${BUDGET.total || ''}" placeholder="不設"></div>${rows}`;
}
async function onBudgetInput(e) {
  const el = e.target.closest('[data-bud]'); if (!el) return;
  const v = Math.max(0, Math.round(Number(el.value.replace(/[^\d.]/g, '')) || 0));
  el.value = v || '';
  if (el.dataset.bud === '__total') BUDGET.total = v;
  else if (v) BUDGET.cats[el.dataset.bud] = v;
  else delete BUDGET.cats[el.dataset.bud];
  await saveBudget();
  toast('預算已儲存');
  scheduleSync();
}

/* ── 統計 ── */
const BIG_MIN = 1000;   // 「大額」門檻
const ST = { mode: 'month', period: today().slice(0, 7), anchor: today().slice(0, 7), open: null };
// 趨勢圖的範圍：月模式 = anchor 往前 12 個月；年模式 = anchor 往前最多 16 年
function trendStart() {
  if (ST.mode === 'month') return shiftPeriod(ST.anchor, -11);
  const first = live().reduce((a, t) => (t.date < a ? t.date : a), today()).slice(0, 4);
  return String(Math.max(Number(first), Number(ST.anchor) - 15));
}
// 選的期間跑出圖表範圍時才平移
function keepInWindow() {
  if (ST.period > ST.anchor) ST.anchor = ST.period;
  else if (ST.period < trendStart()) {
    ST.anchor = ST.mode === 'month' ? shiftPeriod(ST.period, 11) : String(Number(ST.period) + 15);
    const cap = ST.mode === 'month' ? today().slice(0, 7) : today().slice(0, 4);
    if (ST.anchor > cap && ST.period <= cap) ST.anchor = cap;
  }
}
function periodLabel(p) {
  return p.length === 4 ? `${p} 年` : `${p.slice(0, 4)} 年 ${Number(p.slice(5))} 月`;
}
function shiftPeriod(p, d) {
  if (p.length === 4) return String(Number(p) + d);
  const [y, m] = p.split('-').map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}
function aggregate(prefix) {
  const r = { exp: 0, inc: 0, n: 0, roots: new Map(), subs: new Map() };
  for (const t of S.tx) {
    if (t.deleted || t.scheduled || !t.date.startsWith(prefix)) continue;
    if (t.type === 'income') { r.inc += t.amount; continue; }
    r.exp += t.amount; r.n++;
    r.roots.set(t.categoryId, (r.roots.get(t.categoryId) || 0) + t.amount);
    r.subs.set(t.subcategoryId, (r.subs.get(t.subcategoryId) || 0) + t.amount);
  }
  return r;
}
function daysElapsed(p) {
  const t = today();
  if (p.length === 4) {
    if (p < t.slice(0, 4)) return (Number(p) % 4 === 0 ? 366 : 365);
    if (p > t.slice(0, 4)) return 0;
    const s = new Date(Number(p), 0, 1);
    return Math.floor((new Date(t + 'T00:00:00') - s) / 86400000) + 1;
  }
  const [y, m] = p.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  if (p < t.slice(0, 7)) return dim;
  if (p > t.slice(0, 7)) return 0;
  return Number(t.slice(8));
}
function pctDiff(a, b) {
  if (!b) return '';
  const d = Math.round((a - b) / b * 100);
  return d === 0 ? '跟上期差不多' : `比上期${d > 0 ? '多' : '少'} ${Math.abs(d)}%`;
}
function barPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
// 貸款：依小類名稱認（改過 ID 也對得上），在長條上由下往上疊
const LOANS = [{ name: '房貸', cls: 'ln' }, { name: '車貸', cls: 'cl' }];
function loansOf(a) {
  return LOANS.map((l) => S.cats.filter((c) => c.parentId && c.type === 'expense' && c.name === l.name)
    .reduce((s, c) => s + (a.subs.get(c.id) || 0), 0));
}
const fmtW = (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '萬' : money(Math.round(v)));
function renderTrend() {
  let periods;
  if (ST.mode === 'month') {
    periods = Array.from({ length: 12 }, (_, i) => shiftPeriod(ST.anchor, i - 11));
    $('#trendTitle').textContent = '近 12 個月支出';
  } else {
    const first = live().reduce((a, t) => (t.date < a ? t.date : a), today()).slice(0, 4);
    const start = Math.max(Number(first), Number(ST.anchor) - 15);
    periods = []; for (let y = start; y <= Number(ST.anchor); y++) periods.push(String(y));
    $('#trendTitle').textContent = '每年支出';
  }
  const aggs = periods.map((p) => aggregate(p));
  const vals = aggs.map((a) => a.exp);
  const loans = aggs.map(loansOf);
  const W = 340, H = 174, top = 46, base = 152, n = periods.length;
  const max = Math.max(...vals, 1);
  const slot = W / n, bw = Math.max(6, Math.min(22, slot - 6));
  const px = (v) => Math.round(v / max * (base - top));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc($('#trendTitle').textContent)}">`;
  svg += `<line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}"/>`;
  periods.forEach((p, i) => {
    const h = px(vals[i]);
    const x = i * slot + (slot - bw) / 2;
    const on = p === ST.period ? ' on' : '';
    svg += `<path class="b${on}" d="${barPath(x, base - h, bw, h, 4)}"/>`;
    let acc = 0;
    LOANS.forEach((l, k) => {
      if (!loans[i][k]) return;
      const y0 = acc; acc = Math.min(h, px(loans[i].slice(0, k + 1).reduce((s, v) => s + v, 0)));
      const sh = acc - y0; if (sh <= 0) return;
      svg += acc >= h
        ? `<path class="${l.cls}${on}" d="${barPath(x, base - h, bw, sh, 4)}"/>`
        : `<rect class="${l.cls}${on}" x="${x}" y="${base - acc}" width="${bw}" height="${sh}"/>`;
    });
    const lab = ST.mode === 'month' ? `${Number(p.slice(5))}月` : `'${p.slice(2)}`;
    const showLab = ST.mode === 'month' || n <= 10 || i % 2 === (n - 1) % 2;
    if (showLab) svg += `<text x="${i * slot + slot / 2}" y="${base + 14}" text-anchor="middle">${lab}</text>`;
    const lsum = loans[i].reduce((s, v) => s + v, 0);
    if (on) {
      const tx = Math.min(W - 24, Math.max(24, i * slot + slot / 2));
      // 有貸款就分行，由上往下＝長條由下往上：房貸（紫）、車貸（藍）、其他（綠，貼長條），沒有的略過
      const lines = [['val', vals[i] - lsum]];
      if (lsum) [...LOANS.keys()].reverse().forEach((k) => { if (loans[i][k]) lines.push([`val ${LOANS[k].cls}-t`, loans[i][k]]); });
      lines.forEach(([c, v], j) => { svg += `<text class="${c}" x="${tx}" y="${base - h - 6 - j * 14}" text-anchor="middle">${fmtW(v)}</text>`; });
    }
    const tip = LOANS.map((l, k) => (loans[i][k] ? `${l.name} ${money(loans[i][k])}` : '')).filter(Boolean).join('、');
    svg += `<rect class="hit" data-p="${p}" x="${i * slot}" y="0" width="${slot}" height="${H}"><title>${periodLabel(p)}：${money(vals[i])}${tip ? `（${tip}）` : ''}</title></rect>`;
  });
  $('#statTrend').innerHTML = svg + '</svg>';
}
function catBarHTML(id, amt, max, total, budget, isSub) {
  const w = max ? amt / max * 100 : 0;
  const over = budget && amt > budget;
  const mk = budget && !isSub ? `<div class="mk" style="left:calc(${Math.min(100, budget / max * 100)}% - 1px)"></div>` : '';
  const bud = budget && !isSub
    ? `<div class="bud">${over ? `<span class="over-t">超支 ${money(amt - budget)}</span>` : `預算 ${money(budget)}，剩 ${money(budget - amt)}`}</div>` : '';
  return `<button class="cb" data-${isSub ? 'sub' : 'root'}="${esc(id)}"><div class="l"><span>${isSub ? '' : catLook(id)[0] + ' '}${esc(catName(id))}${isSub ? '<span class="go">明細 ›</span>' : ''}</span>
    <span>${money(Math.round(amt))}<small>${total ? Math.round(amt / total * 100) : 0}%</small></span></div>
    <div class="tr"><div class="f${over ? ' over' : ''}" style="width:${w}%"></div>${mk}</div>${bud}</button>`;
}
function renderStats() {
  document.querySelectorAll('#statMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === ST.mode));
  $('#statLabel').textContent = periodLabel(ST.period);
  $('#statPick').type = ST.mode === 'month' ? 'month' : 'number';
  $('#statPick').style.display = ST.mode === 'month' ? '' : 'none';
  if (ST.mode === 'month') $('#statPick').value = ST.period;
  const a = aggregate(ST.period), prev = aggregate(shiftPeriod(ST.period, -1));
  const days = daysElapsed(ST.period);
  const ls = loansOf(a), lsum = ls.reduce((x, v) => x + v, 0);
  const bud = budgetFor(ST.period);
  let budHTML = '';
  if (bud) {
    const used = a.exp / bud * 100;
    budHTML = `<div class="budget"><div class="track"><div class="fill${a.exp > bud ? ' over' : ''}" style="width:${Math.min(100, used)}%"></div></div>
      <div class="txt"><span>預算 ${money(bud)}</span><span>${a.exp > bud ? `<span class="over-t">超支 ${money(a.exp - bud)}</span>` : `剩 ${money(bud - a.exp)}`}</span></div></div>`;
  }
  $('#statHero').innerHTML = `<small>支出</small><div class="big">${money(Math.round(a.exp))}</div>
    ${lsum ? `<div class="loan-split">不含${LOANS.filter((l, k) => ls[k]).map((l) => l.name).join('')} <b>${money(Math.round(a.exp - lsum))}</b>${LOANS.map((l, k) => (ls[k] ? `<span class="${l.cls}-t">${l.name} ${money(Math.round(ls[k]))}</span>` : '')).join('')}</div>` : ''}
    <div class="meta">${days ? `<span>日均 <b>${money(Math.round(a.exp / days))}</b></span>` : ''}<span>${a.n} 筆</span>
    ${prev.exp ? `<span>${pctDiff(a.exp, prev.exp)}</span>` : ''}<span>收入 <b>${money(Math.round(a.inc))}</b></span></div>${budHTML}`;
  const list = [...a.roots.entries()].sort((x, y) => y[1] - x[1]);
  if (!list.length) { $('#statCats').innerHTML = '<div class="empty">這段期間沒有支出</div>'; }
  else {
    const max = Math.max(list[0][1], ...list.map(([id]) => budgetFor(ST.period, id)));
    $('#statCats').innerHTML = list.map(([id, amt]) => {
      let h = catBarHTML(id, amt, max, a.exp, budgetFor(ST.period, id), false);
      if (ST.open === id) {
        const subs = subsOf(id).map((s) => [s.id, a.subs.get(s.id) || 0]).filter(([, v]) => v).sort((x, y) => y[1] - x[1]);
        const sm = subs.length ? subs[0][1] : 0;
        h += `<div class="subs">${subs.map(([sid, v]) => catBarHTML(sid, v, sm, amt, 0, true)).join('')}<button class="big-go" data-big="${esc(id)}">只看 ${money(BIG_MIN)} 以上的項目 ›</button></div>`;
      }
      return h;
    }).join('');
  }
  renderTrend();
}
function openCategoryList(id, min = 0) {
  S.filter = { id, period: ST.period, min };
  switchView('v-list');
}
function bindStats() {
  $('#statMode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === ST.mode) return;
    ST.mode = b.dataset.m;
    ST.period = ST.mode === 'year' ? ST.period.slice(0, 4) : (ST.period === today().slice(0, 4) ? today().slice(0, 7) : ST.period + '-12');
    ST.anchor = ST.mode === 'year' ? today().slice(0, 4) : today().slice(0, 7);
    keepInWindow();
    ST.open = null; renderStats();
  });
  $('#statPrev').addEventListener('click', () => { ST.period = shiftPeriod(ST.period, -1); keepInWindow(); renderStats(); });
  $('#statNext').addEventListener('click', () => { ST.period = shiftPeriod(ST.period, 1); keepInWindow(); renderStats(); });
  $('#statPick').addEventListener('change', (e) => { if (e.target.value) { ST.period = e.target.value; keepInWindow(); renderStats(); } });
  $('#statTrend').addEventListener('click', (e) => {
    const r = e.target.closest('[data-p]'); if (!r) return;
    ST.period = r.dataset.p; renderStats();
  });
  $('#statCats').addEventListener('click', (e) => {
    const big = e.target.closest('[data-big]');
    if (big) return openCategoryList(big.dataset.big, BIG_MIN);
    const sub = e.target.closest('[data-sub]');
    if (sub) return openCategoryList(sub.dataset.sub);
    const root = e.target.closest('[data-root]'); if (!root) return;
    ST.open = ST.open === root.dataset.root ? null : root.dataset.root;
    renderStats();
  });
}

/* ── Google 同步 ── */
const SYNC = { running: false, timer: null, lastAuto: 0 };
const CHUNK = 2000;
async function syncCfg() { return (await getMeta('sync')) || {}; }
async function deviceId() {
  let id = await getMeta('deviceId');
  if (!id) { id = 'd-' + uid(); await setMeta('deviceId', id); }
  return id;
}
const isDirty = (t) => t._s !== t.updatedAt;
function forServer(t) {
  const { _s, ...r } = t;
  r.category = catName(t.categoryId); r.subcategory = catName(t.subcategoryId);
  return r;
}
async function post(url, body) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 120000);
  try {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let j;
    try { j = await r.json(); } catch { throw new Error('回應不是 JSON，請確認部署權限是「所有人」'); }
    if (!j.ok) throw new Error(j.error || '同步失敗');
    return j;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('連線逾時');
    if (err instanceof TypeError) throw new Error('連不到伺服器，請檢查網址');
    throw err;
  } finally { clearTimeout(to); }
}
async function applyPulled(res) {
  const byId = new Map(S.tx.map((t) => [t.id, t]));
  const put = [];
  for (const r of res.changes || []) {
    const local = byId.get(r.id);
    if (local && (local.updatedAt || '') >= (r.updatedAt || '') && !isDirty(local)) continue;
    if (local && isDirty(local) && (local.updatedAt || '') > (r.updatedAt || '')) continue; // 本機較新，等等會推上去
    const t = { id: r.id, date: r.date, type: r.type === 'income' ? 'income' : 'expense', amount: Number(r.amount) || 0,
      categoryId: r.categoryId, subcategoryId: r.subcategoryId, note: r.note || '', createdAt: r.createdAt, updatedAt: r.updatedAt };
    for (const k of ['scheduled', 'repeat', 'legacyBook', 'legacyCategory', 'deleted']) if (r[k]) t[k] = r[k];
    t._s = t.updatedAt;
    if (local) Object.keys(local).forEach((k) => delete local[k]);
    if (local) Object.assign(local, t); else S.tx.push(t);
    put.push(local || t);
  }
  if (res.categories?.length) {
    await putMany('categories', res.categories);
    S.cats = await getAll('categories'); indexCats();
  }
  if (res.budget && !BUDGET.total && !Object.keys(BUDGET.cats).length) {
    BUDGET = { total: Number(res.budget.total) || 0, cats: res.budget.cats || {} }; await saveBudget();
  }
  if (put.length) await putMany('tx', put);
  return put.length;
}
function syncStatus(text, err) {
  const el = $('#syncStatus');
  if (el) { el.textContent = text; el.classList.toggle('over-t', !!err); }
}
async function syncNow(manual) {
  if (SYNC.running) return;
  const cfg = await syncCfg();
  if (!cfg.url || !cfg.key) { if (manual) toast('請先填網址和密鑰'); return; }
  if (!navigator.onLine) { if (manual) toast('目前離線，有網路時會自動同步'); return; }
  SYNC.running = true;
  const dev = await deviceId();
  let pulled = 0, pushedN = 0;
  try {
    syncStatus('同步中…');
    const base = { key: cfg.key, deviceId: dev };
    // 第一次：先下載，避免新手機用預設分類蓋掉雲端的
    if (!cfg.pullCursor) {
      const r0 = await post(cfg.url, { ...base, changes: [], pull: true, since: 0 });
      pulled += await applyPulled(r0);
      cfg.pullCursor = r0.serverTime;
      await setMeta('sync', cfg);
    }
    const dirty = S.tx.filter(isDirty);
    const snap = new Map(dirty.map((t) => [t.id, t.updatedAt]));
    const n = Math.max(1, Math.ceil(dirty.length / CHUNK));
    let last;
    for (let i = 0; i < n; i++) {
      const chunk = dirty.slice(i * CHUNK, (i + 1) * CHUNK);
      if (n > 1) syncStatus(`上傳中 ${i + 1}/${n}…`);
      const isLast = i === n - 1;
      last = await post(cfg.url, { ...base, changes: chunk.map(forServer), categories: i === 0 ? S.cats : undefined,
        budget: i === 0 ? BUDGET : undefined, pull: isLast, since: cfg.pullCursor });
      const done = [];
      for (const t of chunk) if (t.updatedAt === snap.get(t.id)) { t._s = t.updatedAt; done.push(t); }
      if (done.length) await putMany('tx', done);
      pushedN += chunk.length;
    }
    pulled += await applyPulled(last);
    cfg.pullCursor = last.serverTime;
    cfg.lastSync = new Date().toISOString();
    delete cfg.lastError;
    await setMeta('sync', cfg);
    if (pulled) rebuildIndexes();
    syncStatus(`上次同步 ${fmtTime(cfg.lastSync)}・雲端共 ${last.total.toLocaleString()} 筆`);
    if (manual) toast(`同步完成：上傳 ${pushedN}、下載 ${pulled}`);
    refreshCurrentView();
  } catch (err) {
    cfg.lastError = err.message; await setMeta('sync', cfg);
    syncStatus('同步失敗：' + err.message, true);
    if (manual) toast('同步失敗：' + err.message);
  } finally {
    SYNC.running = false;
  }
}
function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function refreshCurrentView() {
  const v = document.querySelector('.view.on')?.id;
  if (v === 'v-list') renderList();
  else if (v === 'v-stat') renderStats();
  else if (v === 'v-add' && !S.editing) renderCats();
  else if (v === 'v-set') renderSettings();
}
function scheduleSync(delay = 4000) {
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(() => syncNow(false), delay);
}
async function autoSync() {
  if (Date.now() - SYNC.lastAuto < 60000) return;
  SYNC.lastAuto = Date.now();
  syncNow(false);
}
async function renderSyncEdit() {
  const cfg = await syncCfg();
  for (const [sel, v] of [['#syncUrl', cfg.url], ['#syncKey', cfg.key]]) {
    const el = $(sel);
    if (document.activeElement !== el && el.value !== (v || '')) el.value = v || '';
  }
  const pending = S.tx.filter(isDirty).length;
  if (cfg.lastError) syncStatus('上次失敗：' + cfg.lastError, true);
  else if (cfg.lastSync) syncStatus(`上次同步 ${fmtTime(cfg.lastSync)}${pending ? `・待上傳 ${pending} 筆` : ''}`);
  else syncStatus(cfg.url ? `尚未同步・待上傳 ${pending.toLocaleString()} 筆` : '未設定');
}
async function onSyncCfgChange() {
  const cfg = await syncCfg();
  const url = $('#syncUrl').value.trim(), key = $('#syncKey').value.trim();
  if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('網址應該是 https://script.google.com/... 開頭'); return; }
  if (url !== cfg.url) { delete cfg.pullCursor; delete cfg.lastSync; delete cfg.lastError; }
  cfg.url = url; cfg.key = key;
  await setMeta('sync', cfg);
  renderSyncEdit();
}

/* ── 浮動選單 ── */
function setFab(open) {
  $('#tabs').classList.toggle('open', open);
  $('#fabBg').classList.toggle('on', open);
  $('#fabMain').setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ── 分頁切換 ── */
function switchView(id) {
  closeDrawers();
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === id));
  document.querySelectorAll('#tabs .fab-item').forEach((b) => b.classList.toggle('on', b.dataset.v === id));
  document.body.classList.toggle('on-add', id === 'v-add');
  setFab(false);
  $('main').scrollTop = 0;
  if (id === 'v-add') renderAdd();
  if (id === 'v-list') { S.listLimit = 300; renderList(); }
  if (id === 'v-set') renderSettings();
  if (id === 'v-stat') renderStats();
}

/* ── 事件 ── */
function bind() {
  $('#fabMain').addEventListener('click', () => setFab(!$('#tabs').classList.contains('open')));
  $('#fabBg').addEventListener('click', () => setFab(false));
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.fab-item'); if (!b) return;
    if (b.dataset.v !== 'v-add' && S.editing) { resetForm(); S.returnTo = null; }
    if (b.dataset.v === 'v-list') S.filter = null;
    switchView(b.dataset.v);
  });
  $('#keypad').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    keyPress(b.dataset.k || b.textContent);
  });
  $('#typeToggle').addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t || (S.type === 'expense' ? 'income' : 'expense');
    if (t !== S.type) { setType(t); renderAdd(); }
  });
  $('#date').addEventListener('change', (e) => { if (e.target.value) { S.date = e.target.value; renderAdd(); } });
  const pickCat = (e) => {
    if (e.target.closest('#moreCats')) { openDrawer('catDrawer'); return; }
    const b = e.target.closest('[data-sub]'); if (!b) return;
    S.subId = b.dataset.sub;
    closeDrawers();
    renderCats();
  };
  $('#freqCats').addEventListener('click', pickCat);
  $('#allCats').addEventListener('click', pickCat);
  $('#drawerBg').addEventListener('click', closeDrawers);
  document.querySelectorAll('.drawer [data-close]').forEach((b) => b.addEventListener('click', closeDrawers));
  $('#note').addEventListener('input', () => { fitNote(); renderSugs(); });
  $('#note').addEventListener('focus', () => { $('#noteWrap').classList.add('focus'); renderSugs(); fitNote(); });
  $('#note').addEventListener('blur', () => { $('#noteWrap').classList.remove('focus'); fitNote(); });
  $('#sugs').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });   // 點建議時不要先失焦
  $('#dayInline').addEventListener('scroll', updateMoreHint, { passive: true });
  $('#moreHint').addEventListener('click', () => { const d = $('#dayInline'); const t = d.scrollTop + d.clientHeight * 0.8; try { d.scrollTo({ top: t, behavior: 'smooth' }); } catch { d.scrollTop = t; } });
  $('#editDate').addEventListener('change', (e) => { if (e.target.value) { S.date = e.target.value; renderAdd(); } });
  // 點建議：iOS 會在 click 之前先讓備註框失焦、建議列跟著隱藏，click 就落空，
  // 所以手機改在 touchend 直接處理（並 preventDefault 擋掉後續的失焦與 click），滑動捲動則不算點擊
  const pickSug = (target) => {
    if (target.closest('[data-done]')) { $('#note').blur(); return; }
    const b = target.closest('[data-note]'); if (!b) return;
    const n = b.dataset.note, info = S.noteIdx.get(n);
    setNote(n);
    if (info && S.catById.has(info.subcategoryId)) { S.type = info.type; S.subId = info.subcategoryId; }
    $('#note').blur();
    renderAdd();
  };
  let sugTouch = null, sugTouchAt = 0;
  $('#sugs').addEventListener('touchstart', (e) => { const t = e.touches[0]; sugTouch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  $('#sugs').addEventListener('touchend', (e) => {
    const st = sugTouch; sugTouch = null;
    if (!st || !e.target.closest('button')) return;
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - st.x) + Math.abs(t.clientY - st.y) > 10) return;
    e.preventDefault(); sugTouchAt = Date.now();
    pickSug(e.target);
  }, { passive: false });
  $('#sugs').addEventListener('click', (e) => { if (Date.now() - sugTouchAt > 700) pickSug(e.target); });
  $('#btnCancel').addEventListener('click', () => { resetForm(); leaveEdit(); });
  $('#btnDelete').addEventListener('click', async () => {
    if (!confirm('確定刪除這筆？')) return;
    await softDelete(S.editing); resetForm(); leaveEdit();
  });
  $('#btnConfirm').addEventListener('click', confirmScheduled);
  setupDaySwipe();
  $('#dayInline').addEventListener('click', (e) => {
    const r = e.target.closest('.row'); if (!r || r.dataset.id === S.editing) return;
    if (!S.editing) { S.returnTo = 'add'; S.returnDate = S.date; }
    startEdit(r.dataset.id);
  });
  $('#dayList').addEventListener('click', (e) => {
    const r = e.target.closest('.row'); if (!r || r.dataset.id === S.editing) return;
    if (!S.editing) { S.returnTo = 'add'; S.returnDate = S.date; }
    closeDrawers();
    startEdit(r.dataset.id);
  });

  $('#prevM').addEventListener('click', () => shiftMonth(-1));
  $('#nextM').addEventListener('click', () => shiftMonth(1));
  $('#monthPick').addEventListener('change', (e) => { if (e.target.value) { S.month = e.target.value; S.listLimit = 300; renderList(); } });
  let st;
  $('#search').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { S.query = e.target.value; S.listLimit = 300; renderList(); }, 200); });
  $('#backupBanner').addEventListener('click', (e) => { if (e.target.id === 'bannerExport') exportData(); });
  setupSwipe();
  setupMonthPop();
  $('#filterClear').addEventListener('click', () => { S.filter = null; renderList(); });
  $('#filterMin').addEventListener('click', () => { if (S.filter) { S.filter.min = S.filter.min ? 0 : BIG_MIN; S.listLimit = 300; renderList(); } });
  bindStats();
  bindImport();
  bindSched();
  $('#budgetEdit').addEventListener('change', onBudgetInput);
  $('#syncUrl').addEventListener('change', onSyncCfgChange);
  $('#syncKey').addEventListener('change', onSyncCfgChange);
  $('#btnSync').addEventListener('click', async () => { await onSyncCfgChange(); syncNow(true); });

  $('#btnExport').addEventListener('click', exportData);
  $('#btnUpdate').addEventListener('click', () => checkUpdate(true));
  $('#btnForceUpdate').addEventListener('click', forceUpdate);
  $('#fileImport').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
  $('#btnWipe').addEventListener('click', async () => {
    if (!confirm('確定清除所有資料？建議先匯出備份。')) return;
    if (!confirm('再確認一次：所有紀錄都會刪除，無法復原。')) return;
    await clearAll(); await loadAll(); resetForm(); toast('已清除'); renderSettings();
  });
  $('#catEditExp').addEventListener('click', catAction);
  $('#catEditInc').addEventListener('click', catAction);
  $('#catActBody').addEventListener('click', onSubAction);
}
/* 桌機選月份：用自己的年／月選單；手機維持原生滾輪 */
function setupMonthPop() {
  if (!window.matchMedia('(pointer:fine)').matches) return;
  const pop = $('#mpop'), sel = $('#mpYear'), grid = $('#mpGrid');
  let cur = null;
  const close = () => { pop.hidden = true; cur = null; };
  const draw = () => {
    const [, m] = cur.get().split('-').map(Number);
    const sy = Number(sel.value), [cy] = cur.get().split('-').map(Number);
    grid.innerHTML = Array.from({ length: 12 }, (_, i) =>
      `<button data-m="${i + 1}" class="${sy === cy && i + 1 === m ? 'on' : ''}">${i + 1} 月</button>`).join('');
  };
  const open = (label, target) => {
    cur = target;
    const now = new Date().getFullYear();
    const years = live().map((t) => Number(t.date.slice(0, 4)));
    const lo = Math.min(now, ...years), hi = Math.max(now + 1, ...years);
    sel.innerHTML = '';
    for (let y = hi; y >= lo; y--) sel.insertAdjacentHTML('beforeend', `<option value="${y}">${y} 年</option>`);
    sel.value = cur.get().split('-')[0];
    draw();
    const r = label.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - 252, r.left + r.width / 2 - 122))}px`;
  };
  sel.addEventListener('change', draw);
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-m]');
    if (!b || !cur) return;
    const v = `${sel.value}-${pad(Number(b.dataset.m))}`;
    const set = cur.set; close(); set(v);
  });
  document.addEventListener('mousedown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.month-title')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const hook = (inputSel, make) => {
    const label = $(inputSel).closest('label');
    label.addEventListener('click', (e) => {
      const t = make(); if (!t) return;
      e.preventDefault();
      if (!pop.hidden) close(); else open(label, t);
    });
  };
  hook('#monthPick', () => ({ get: () => S.month, set: (v) => { S.month = v; S.listLimit = 300; renderList(); } }));
  hook('#statPick', () => ST.mode !== 'month' ? null : ({ get: () => ST.period, set: (v) => { ST.period = v; keepInWindow(); renderStats(); } }));
}
function shiftMonth(d) {
  const [y, m] = S.month.split('-').map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  S.month = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
  S.listLimit = 300; renderList();
}

/* ── Service Worker ── */
let SWREG = null, lastUpdCheck = 0;
// 檢查新版本；manual = 使用者按「檢查更新」，有新版就直接套用並重新載入
async function checkUpdate(manual) {
  if (!SWREG) { if (manual) toast('這個環境不支援自動更新'); return; }
  if (!manual && Date.now() - lastUpdCheck < 5 * 60000) return;
  lastUpdCheck = Date.now();
  if (manual) toast('檢查中…');
  try { await SWREG.update(); } catch { if (manual) toast('檢查失敗，請確認有網路'); return; }
  const w = SWREG.waiting || SWREG.installing;
  if (!w) { if (manual) toast(`已經是最新版 ${VERSION}`); return; }
  if (!manual) return;   // 自動檢查只顯示上方的「有新版本」提示
  toast('下載新版中，完成後會自動重新開啟');
  const go = () => w.postMessage('skipWaiting');
  if (w.state === 'installed') go();
  else w.addEventListener('statechange', () => { if (w.state === 'installed') go(); });
}
// 強制更新：清掉 Service Worker 和程式快取後重新載入（紀錄存在 IndexedDB，不會被動到）
async function forceUpdate() {
  if (!confirm('會清除程式快取並重新載入最新版。\n你的紀錄不受影響。確定嗎？')) return;
  toast('更新中…');
  try {
    await Promise.all(['./', 'index.html', 'app.js', 'sw.js'].map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  location.replace(location.pathname + '?r=' + Date.now());
}
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    SWREG = reg;
    const show = (w) => {
      const bar = $('#updateBar');
      bar.classList.add('on');
      bar.onclick = () => w.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

/* iOS 會忽略 viewport 的禁止縮放，所以直接擋手勢 */
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

(async function init() {
  try {
    db = await openDB();
    await loadAll();
  } catch (err) {
    document.body.innerHTML = `<p style="padding:24px">無法開啟資料庫：${esc(err.message)}</p>`;
    return;
  }
  resetForm();
  bind();
  renderAdd();
  setupSW();
  window.addEventListener('online', () => syncNow(false));
  window.addEventListener('resize', () => { if ($('#v-add').classList.contains('on')) renderDay(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { autoSync(); checkUpdate(false); } });
  setTimeout(autoSync, 1500);
})();
