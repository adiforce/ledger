'use strict';
const VERSION = '1.11.1';

/* ── 預設分類（跟轉換腳本同一套 ID，匯入時會對上）── */
const DEFAULT_TREE = {
  expense: {
    '餐飲': ['正餐', '飲料咖啡', '零食甜點', '水果', '食材'],
    '交通': ['油費', '停車費', '維修保養', '大眾運輸', '機票'],
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

/* ── 分類圖示：用預設大類的 ID 對應 emoji 與色調 ── */
const CAT_LOOK = {
  'exp-00': ['🍜', '#f97316'], 'exp-01': ['🚗', '#3b82f6'], 'exp-02': ['🏠', '#8b5cf6'], 'exp-03': ['💡', '#eab308'],
  'exp-04': ['🛍️', '#ec4899'], 'exp-05': ['🎮', '#22c55e'], 'exp-06': ['💊', '#14b8a6'], 'exp-07': ['🎁', '#ef4444'],
  'exp-08': ['🧒', '#84cc16'], 'exp-09': ['🐱', '#b45309'], 'exp-10': ['📦', '#64748b'], 'inc-00': ['💰', '#16a34a'],
};
function catLook(rootId) {
  const c = S.catById.get(rootId);
  const rid = c && c.parentId ? c.parentId : rootId;
  return CAT_LOOK[rid] || ['🏷️', '#64748b'];
}
function catIcon(rootId, size = '') {
  const [e, h] = catLook(rootId);
  return `<span class="ic${size ? ' ' + size : ''}" style="background:${h}26" aria-hidden="true">${e}</span>`;
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
  for (const t of S.tx) {
    if (t.deleted) continue;
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

async function loadAll() {
  S.cats = await getAll('categories');
  if (!S.cats.length) {
    S.cats = defaultCategories();
    await putMany('categories', S.cats);
  }
  indexCats();
  S.tx = await getAll('tx');
  await loadBudget();
  rebuildIndexes();
}

/* ── 記一筆 ── */
function setNote(v) { const el = $('#note'); el.value = v; fitNote(); }
function fitNote() {
  const el = $('#note');
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 2 + 'px';
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
function renderDate() {
  $('#date').value = S.date;
  $('#dateLabel').textContent = S.date === today() ? `今天 ${S.date.slice(5).replace('-', '/')}` : `${dayLabel(S.date)}${S.date.slice(0, 4) !== today().slice(0, 4) ? ' ' + S.date.slice(0, 4) : ''}`;
}
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
  $('#freqCats').innerHTML = freq.map((id) => chip(id, id === S.subId, false)).join('');
  $('#allCats').innerHTML = roots(S.type).map((r) =>
    `<div class="root">${catLook(r.id)[0]} ${esc(r.name)}</div><div class="cat-grid">${subsOf(r.id).map((s) => chip(s.id, s.id === S.subId, false)).join('')}</div>`).join('');
}
function renderSugs() {
  const q = $('#note').value.trim();
  if (!q) { $('#sugs').innerHTML = ''; return; }
  const out = [];
  for (const [note, e] of S.noteIdx) {
    if (note !== q && note.length <= 30 && !note.includes('\n') && note.includes(q)) out.push([note, e]);
  }
  out.sort((a, b) => (b[1].count - a[1].count) || (b[1].date > a[1].date ? 1 : -1));
  $('#sugs').innerHTML = out.slice(0, 8).map(([n]) => `<button class="chip" data-note="${esc(n)}">${esc(n)}</button>`).join('');
}
function renderAdd() {
  renderTypeToggle(); renderDate(); renderAmount(); renderPicked(); renderCats(); renderSugs(); renderBudgetLine();
  const ed = S.editing && S.tx.find((t) => t.id === S.editing);
  $('#editBar').classList.toggle('on', !!ed);
  $('#btnConfirm').hidden = !(ed && ed.scheduled);
  $('#editBar .grow').textContent = ed?.scheduled ? '編輯預定項目' : '編輯中';
  $('[data-k="ok"]').textContent = ed ? '儲存' : (S.date > today() ? '排入預定' : '記帳');
  renderRepeat(ed);
  renderDay();
  fitNote();
}
const REPEAT_LABEL = { '': '不重複', monthly: '每月', yearly: '每年' };
function renderRepeat(ed) {
  const pill = $('#repeatPill');
  pill.hidden = !!(ed && !ed.scheduled);   // 已入帳的紀錄不能改重複
  $('#repeat').value = S.repeat;
  $('#repeatLabel').textContent = S.repeat ? `🔁 ${REPEAT_LABEL[S.repeat]}` : '不重複';
  pill.classList.toggle('on', !!S.repeat);
}
function resetForm(keepDate) {
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
  const sh = document.querySelector('.sheet');
  for (const el of [sh, document.querySelector('#dayList .list')]) {
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
function setupDaySwipe() {
  bindDaySwipe($('#dayZone'), () => document.querySelector('.sheet'));
  bindDaySwipe($('#dayList'), () => document.querySelector('#dayList .list'));
  $('#dayPrev').addEventListener('click', () => shiftDay(-1));
  $('#dayNext').addEventListener('click', () => shiftDay(1));
  $('#dayList').addEventListener('click', (e) => { const b = e.target.closest('[data-dn]'); if (b) shiftDay(Number(b.dataset.dn)); });
}

/* ── 記一筆：當天紀錄 ── */
function renderDay() {
  const items = live().filter((t) => t.date === S.date)
    .sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : (b.createdAt || '') < (a.createdAt || '') ? -1 : 0));
  const [, m, d] = S.date.split('-');
  const md = S.date === today() ? '今天' : `${Number(m)}/${Number(d)}`;
  const real = items.filter((t) => !t.scheduled);
  const exp = real.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const inc = real.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const sch = items.length - real.length;
  $('#daySum').innerHTML = items.length
    ? `<span>${md} 已記 <b>${real.length}</b> 筆・支出 <b>${money(exp)}</b>${inc ? `・收入 <b>${money(inc)}</b>` : ''}${sch ? `・預定 ${sch}` : ''}</span>`
    : `<span>${md} 還沒有紀錄</span>`;
  $('#daySum').disabled = !items.length;
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
    items = live().filter((t) => t.date.startsWith(f.period) && (t.subcategoryId === f.id || t.categoryId === f.id));
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
  if (!items.length) { $('#list').innerHTML = `<div class="empty">${q ? '找不到符合的紀錄' : '這個月還沒有紀錄'}</div>`; return; }
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
      <div class="cat-grid">${subsOf(r.id).map((s) => `<button class="chip" data-rename="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
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
  const t = e.target.closest('[data-rename],[data-addsub],[data-addroot]');
  if (!t) return;
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
  const vals = periods.map((p) => aggregate(p).exp);
  const W = 340, H = 150, top = 18, base = 128, n = periods.length;
  const max = Math.max(...vals, 1);
  const slot = W / n, bw = Math.max(6, Math.min(22, slot - 6));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc($('#trendTitle').textContent)}">`;
  svg += `<line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}"/>`;
  periods.forEach((p, i) => {
    const h = Math.round(vals[i] / max * (base - top));
    const x = i * slot + (slot - bw) / 2;
    const on = p === ST.period;
    svg += `<path class="b${on ? ' on' : ''}" d="${barPath(x, base - h, bw, h, 4)}"/>`;
    const lab = ST.mode === 'month' ? `${Number(p.slice(5))}月` : `'${p.slice(2)}`;
    const showLab = ST.mode === 'month' || n <= 10 || i % 2 === (n - 1) % 2;
    if (showLab) svg += `<text x="${i * slot + slot / 2}" y="${base + 14}" text-anchor="middle">${lab}</text>`;
    if (on) {
      const tx = Math.min(W - 24, Math.max(24, i * slot + slot / 2));
      svg += `<text class="val" x="${tx}" y="${base - h - 6}" text-anchor="middle">${vals[i] >= 10000 ? (vals[i] / 10000).toFixed(1) + '萬' : money(vals[i])}</text>`;
    }
    svg += `<rect class="hit" data-p="${p}" x="${i * slot}" y="0" width="${slot}" height="${H}"><title>${periodLabel(p)}：${money(vals[i])}</title></rect>`;
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
  const bud = budgetFor(ST.period);
  let budHTML = '';
  if (bud) {
    const used = a.exp / bud * 100;
    budHTML = `<div class="budget"><div class="track"><div class="fill${a.exp > bud ? ' over' : ''}" style="width:${Math.min(100, used)}%"></div></div>
      <div class="txt"><span>預算 ${money(bud)}</span><span>${a.exp > bud ? `<span class="over-t">超支 ${money(a.exp - bud)}</span>` : `剩 ${money(bud - a.exp)}`}</span></div></div>`;
  }
  $('#statHero').innerHTML = `<small>支出</small><div class="big">${money(Math.round(a.exp))}</div>
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
        h += `<div class="subs">${subs.map(([sid, v]) => catBarHTML(sid, v, sm, amt, 0, true)).join('')}</div>`;
      }
      return h;
    }).join('');
  }
  renderTrend();
}
function openCategoryList(id) {
  S.filter = { id, period: ST.period };
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

/* ── 分頁切換 ── */
function switchView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === id));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === id));
  $('main').scrollTop = 0;
  if (id === 'v-add') renderAdd();
  if (id === 'v-list') { S.listLimit = 300; renderList(); }
  if (id === 'v-set') renderSettings();
  if (id === 'v-stat') renderStats();
}

/* ── 事件 ── */
function bind() {
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
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
  $('#toggleAll').addEventListener('click', () => {
    const on = $('#allCats').classList.toggle('on');
    $('#toggleAll').textContent = on ? '收合' : '全部分類';
  });
  const pickCat = (e) => {
    const b = e.target.closest('[data-sub]'); if (!b) return;
    S.subId = b.dataset.sub;
    if ($('#allCats').classList.contains('on')) { $('#allCats').classList.remove('on'); $('#toggleAll').textContent = '全部分類'; }
    renderPicked(); renderCats();
  };
  $('#freqCats').addEventListener('click', pickCat);
  $('#allCats').addEventListener('click', pickCat);
  $('#note').addEventListener('input', () => { fitNote(); renderSugs(); });
  $('#sugs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-note]'); if (!b) return;
    const n = b.dataset.note, info = S.noteIdx.get(n);
    setNote(n);
    if (info && S.catById.has(info.subcategoryId)) { S.type = info.type; S.subId = info.subcategoryId; }
    $('#note').blur();
    renderAdd();
  });
  $('#btnCancel').addEventListener('click', () => { resetForm(); leaveEdit(); });
  $('#btnDelete').addEventListener('click', async () => {
    if (!confirm('確定刪除這筆？')) return;
    await softDelete(S.editing); resetForm(); leaveEdit();
  });
  $('#btnConfirm').addEventListener('click', confirmScheduled);
  setupDaySwipe();
  $('#daySum').addEventListener('click', () => {
    const main = $('main'), target = $('#dayList');
    if (!target.firstElementChild) return;
    const top = main.scrollTop + target.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
    try { main.scrollTo({ top, behavior: 'smooth' }); } catch { main.scrollTop = top; }
    setTimeout(() => { if (Math.abs(main.scrollTop - top) > 40) main.scrollTop = top; }, 600);  // iOS 平滑捲動失敗時直接跳過去
    const h = target.querySelector('.day-h');
    h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
  });
  $('#dayList').addEventListener('click', (e) => {
    const r = e.target.closest('.row'); if (!r || r.dataset.id === S.editing) return;
    if (!S.editing) { S.returnTo = 'add'; S.returnDate = S.date; }
    startEdit(r.dataset.id);
  });

  $('#prevM').addEventListener('click', () => shiftMonth(-1));
  $('#nextM').addEventListener('click', () => shiftMonth(1));
  $('#monthPick').addEventListener('change', (e) => { if (e.target.value) { S.month = e.target.value; S.listLimit = 300; renderList(); } });
  let st;
  $('#search').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { S.query = e.target.value; S.listLimit = 300; renderList(); }, 200); });
  $('#backupBanner').addEventListener('click', (e) => { if (e.target.id === 'bannerExport') exportData(); });
  setupSwipe();
  $('#filterClear').addEventListener('click', () => { S.filter = null; renderList(); });
  bindStats();
  bindImport();
  bindSched();
  $('#budgetEdit').addEventListener('change', onBudgetInput);
  $('#syncUrl').addEventListener('change', onSyncCfgChange);
  $('#syncKey').addEventListener('change', onSyncCfgChange);
  $('#btnSync').addEventListener('click', async () => { await onSyncCfgChange(); syncNow(true); });

  $('#btnExport').addEventListener('click', exportData);
  $('#btnUpdate').addEventListener('click', () => checkUpdate(true));
  $('#fileImport').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
  $('#btnWipe').addEventListener('click', async () => {
    if (!confirm('確定清除所有資料？建議先匯出備份。')) return;
    if (!confirm('再確認一次：所有紀錄都會刪除，無法復原。')) return;
    await clearAll(); await loadAll(); resetForm(); toast('已清除'); renderSettings();
  });
  $('#catEditExp').addEventListener('click', catAction);
  $('#catEditInc').addEventListener('click', catAction);
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { autoSync(); checkUpdate(false); } });
  setTimeout(autoSync, 1500);
})();
