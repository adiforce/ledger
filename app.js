'use strict';
const VERSION = '1.2.0';

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
  type: 'expense', expr: '', subId: null, date: today(), editing: null,
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
  const c = S.catById.get(S.subId);
  $('#picked').textContent = c ? `${catName(c.parentId)} › ${c.name}` : '請選分類';
}
function renderTypeToggle() {
  $('#typeToggle').innerHTML = S.type === 'expense' ? '<b>支出</b>　改記收入' : '<b>收入</b>　改記支出';
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
  return `<button class="chip${on ? ' on' : ''}" data-sub="${esc(id)}">${esc(c.name)}${showParent ? `<small>${esc(parent)}</small>` : ''}</button>`;
}
function renderCats() {
  $('#freqCats').innerHTML = S.freq[S.type].map((id) => chip(id, id === S.subId)).join('');
  $('#allCats').innerHTML = roots(S.type).map((r) =>
    `<div class="root">${esc(r.name)}</div><div class="cat-grid">${subsOf(r.id).map((s) => chip(s.id, s.id === S.subId, false)).join('')}</div>`).join('');
}
function renderSugs() {
  const q = $('#note').value.trim();
  if (!q) { $('#sugs').innerHTML = ''; return; }
  const out = [];
  for (const [note, e] of S.noteIdx) {
    if (note !== q && note.includes(q)) out.push([note, e]);
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
  $('[data-k="ok"]').textContent = ed ? '儲存' : '記帳';
}
function resetForm(keepDate) {
  S.expr = ''; S.editing = null;
  if (!keepDate) S.date = today();
  S.subId = S.freq[S.type][0] ?? null;
  $('#note').value = '';
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
  let rec;
  if (S.editing) {
    rec = S.tx.find((t) => t.id === S.editing);
    Object.assign(rec, { date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note, updatedAt: now });
  } else {
    rec = { id: uid(), date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note, createdAt: now, updatedAt: now };
    S.tx.push(rec);
  }
  await putMany('tx', [rec]);
  scheduleSync();
  const wasEditing = !!S.editing;
  rebuildIndexes();
  resetForm(!wasEditing);
  toast(`${wasEditing ? '已儲存' : '已記'}　${catName(sub.id)} ${money(amount)}`);
  if (wasEditing) { switchView('v-list'); } else renderAdd();
}

function startEdit(id) {
  const t = S.tx.find((x) => x.id === id);
  if (!t) return;
  S.editing = id; S.type = t.type; S.expr = String(t.amount); S.date = t.date; S.subId = t.subcategoryId;
  $('#note').value = t.note || '';
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
async function confirmScheduled() {
  const t = S.tx.find((x) => x.id === S.editing);
  if (!t) return;
  const amount = evalExpr(S.expr);
  const sub = S.catById.get(S.subId);
  if (!(amount > 0) || !sub) return toast('金額或分類不正確');
  const now = new Date().toISOString();
  Object.assign(t, { date: S.date, type: S.type, amount, categoryId: sub.parentId, subcategoryId: sub.id, note: $('#note').value.trim(), updatedAt: now });
  delete t.scheduled;
  const batch = [t];
  if (t.repeat) {
    const next = { id: uid(), date: addPeriod(t.date, t.repeat), type: t.type, amount: t.amount, categoryId: t.categoryId,
      subcategoryId: t.subcategoryId, note: t.note, scheduled: true, repeat: t.repeat, createdAt: now, updatedAt: now };
    delete t.repeat;
    S.tx.push(next); batch.push(next);
  }
  await putMany('tx', batch);
  scheduleSync();
  rebuildIndexes();
  resetForm();
  toast(batch.length > 1 ? `已入帳，下一筆排在 ${batch[1].date}` : '已入帳');
  switchView('v-list');
}

/* ── 明細 ── */
function rowHTML(t) {
  const inc = t.type === 'income';
  const cname = catName(t.subcategoryId);
  const root = catName(t.categoryId);
  const title = root !== cname ? `${cname}` : cname;
  return `<div class="rw"><button class="del" data-del="${esc(t.id)}">刪除</button>
    <div class="row" data-id="${esc(t.id)}"><div class="t"><div class="c">${esc(title)}${t.scheduled ? '<span class="tag">預定</span>' : ''}</div>
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

async function importData(file) {
  busy(true);
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'ledger-import' || !Array.isArray(data.transactions)) throw new Error('不是這個 App 的匯入檔');
    const now = new Date().toISOString();
    const cats = (data.categories || []).map(({ id, name, parentId, type, order }) => ({ id, name, parentId: parentId ?? null, type, order: order ?? 0 }));
    const tx = data.transactions.filter((t) => t.id && t.date && t.amount != null).map((t) => {
      const r = { id: String(t.id), date: t.date, type: t.type === 'income' ? 'income' : 'expense', amount: Number(t.amount),
        categoryId: t.categoryId, subcategoryId: t.subcategoryId, note: t.note || '',
        createdAt: t.createdAt || t.date + 'T00:00:00', updatedAt: t.updatedAt || now };
      for (const k of ['scheduled', 'repeat', 'legacyBook', 'legacyCategory', 'deleted']) if (t[k]) r[k] = t[k];
      return r;
    });
    if (cats.length) await putMany('categories', cats);
    await putMany('tx', tx);
    if (Array.isArray(data.budgets)) await setMeta('budgets', data.budgets);
    navigator.storage?.persist?.();
    await loadAll();
    resetForm();
    toast(`已匯入 ${tx.length.toLocaleString()} 筆`);
    renderSettings();
  } catch (err) {
    toast('匯入失敗：' + err.message);
  } finally {
    busy(false);
  }
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
const ST = { mode: 'month', period: today().slice(0, 7), open: null };
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
    periods = Array.from({ length: 12 }, (_, i) => shiftPeriod(ST.period, i - 11));
    $('#trendTitle').textContent = '近 12 個月支出';
  } else {
    const first = live().reduce((a, t) => (t.date < a ? t.date : a), today()).slice(0, 4);
    const start = Math.max(Number(first), Number(ST.period) - 15);
    periods = []; for (let y = start; y <= Number(ST.period); y++) periods.push(String(y));
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
  return `<button class="cb" data-${isSub ? 'sub' : 'root'}="${esc(id)}"><div class="l"><span>${esc(catName(id))}${isSub ? '<span class="go">明細 ›</span>' : ''}</span>
    <span>${money(amt)}<small>${total ? Math.round(amt / total * 100) : 0}%</small></span></div>
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
  $('#statHero').innerHTML = `<small>支出</small><div class="big">${money(a.exp)}</div>
    <div class="meta">${days ? `<span>日均 <b>${money(Math.round(a.exp / days))}</b></span>` : ''}<span>${a.n} 筆</span>
    ${prev.exp ? `<span>${pctDiff(a.exp, prev.exp)}</span>` : ''}<span>收入 <b>${money(a.inc)}</b></span></div>${budHTML}`;
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
    ST.open = null; renderStats();
  });
  $('#statPrev').addEventListener('click', () => { ST.period = shiftPeriod(ST.period, -1); renderStats(); });
  $('#statNext').addEventListener('click', () => { ST.period = shiftPeriod(ST.period, 1); renderStats(); });
  $('#statPick').addEventListener('change', (e) => { if (e.target.value) { ST.period = e.target.value; renderStats(); } });
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
    if (b.dataset.v !== 'v-add' && S.editing) { resetForm(); }
    if (b.dataset.v === 'v-list') S.filter = null;
    switchView(b.dataset.v);
  });
  $('#keypad').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    keyPress(b.dataset.k || b.textContent);
  });
  $('#typeToggle').addEventListener('click', () => { setType(S.type === 'expense' ? 'income' : 'expense'); renderAdd(); });
  $('#date').addEventListener('change', (e) => { if (e.target.value) { S.date = e.target.value; renderDate(); } });
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
  $('#note').addEventListener('input', renderSugs);
  $('#note').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('#sugs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-note]'); if (!b) return;
    const n = b.dataset.note, info = S.noteIdx.get(n);
    $('#note').value = n;
    if (info && S.catById.has(info.subcategoryId)) { S.type = info.type; S.subId = info.subcategoryId; }
    $('#note').blur();
    renderAdd();
  });
  $('#btnCancel').addEventListener('click', () => { resetForm(); switchView('v-list'); });
  $('#btnDelete').addEventListener('click', async () => {
    if (!confirm('確定刪除這筆？')) return;
    await softDelete(S.editing); resetForm(); switchView('v-list');
  });
  $('#btnConfirm').addEventListener('click', confirmScheduled);

  $('#prevM').addEventListener('click', () => shiftMonth(-1));
  $('#nextM').addEventListener('click', () => shiftMonth(1));
  $('#monthPick').addEventListener('change', (e) => { if (e.target.value) { S.month = e.target.value; S.listLimit = 300; renderList(); } });
  let st;
  $('#search').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { S.query = e.target.value; S.listLimit = 300; renderList(); }, 200); });
  $('#backupBanner').addEventListener('click', (e) => { if (e.target.id === 'bannerExport') exportData(); });
  setupSwipe();
  $('#filterClear').addEventListener('click', () => { S.filter = null; renderList(); });
  bindStats();
  $('#budgetEdit').addEventListener('change', onBudgetInput);
  $('#syncUrl').addEventListener('change', onSyncCfgChange);
  $('#syncKey').addEventListener('change', onSyncCfgChange);
  $('#btnSync').addEventListener('click', async () => { await onSyncCfgChange(); syncNow(true); });

  $('#btnExport').addEventListener('click', exportData);
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
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); });
  setTimeout(autoSync, 1500);
})();
