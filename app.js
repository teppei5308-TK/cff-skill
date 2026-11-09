'use strict';
/* CFF 技能伝承ボード
 * 画面：GitHub Pages（このファイル）／データ：会社GASのウェブアプリ → スプレッドシートとドライブ
 * API が空のときはデモ（この端末だけに保存）で動く */
const API = 'https://script.google.com/macros/s/AKfycbzhetXJzRNL-nTJHWGDdEehUgevDgu-pCOq8MYJNPQ6ZoRoY8hi_JtLdAO5MnhAcCtNRQ/exec';   // GAS ウェブアプリ（CFF 技能伝承ボード v1）
const APP_URL = 'https://teppei5308-tk.github.io/cff-skill/';
const VERSION = '2026-11-09a';

const LANGS = { ja: '日本語', en: 'English', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', zh: '中文', ne: 'नेपाली', my: 'မြန်မာ', tl: 'Tagalog' };
const SPEECH = { ja: 'ja-JP', en: 'en-US', vi: 'vi-VN', id: 'id-ID', zh: 'zh-CN', ne: 'ne-NP', my: 'my-MM', tl: 'fil-PH' };
const KINDS = ['社員', 'パート・アルバイト', '技能実習・特定技能', '派遣'];
const ROLES = ['作業者', '指導者', '工場長'];
const LV = ['未', 'L1 知っている', 'L2 見られてできる', 'L3 一人でできる', 'L4 教えられる'];
const RANK = { staff: 1, leader: 2, admin: 3 };
const ROLE_NAME = { staff: 'スタッフ', leader: '指導者', admin: '管理者' };
const SHAPE_COLORS = { red: '#ff3b30', yellow: '#ffd60a', white: '#ffffff' };

const S = {
  key: '', role: 'staff', demo: !API, data: null, syncedAt: '', ui: { filter: 'all', q: '', adminTab: 'staff', editTask: '', recMonth: '', planStaff: '', anTask: '' },
  lang: {}, hold: null, blobs: {}, player: null
};

// ---------- 小道具 ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'svg') el.innerHTML = v;            // 自分で書いた固定のアイコンだけ
    else if (k === 'value' && tag !== 'option') { el.setAttribute('value', v); el.value = v; }
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; }
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date((s || today()) + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const fmtT = s => { if (s == null || isNaN(s)) return '--:--'; s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const fmtSec = s => s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`;
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const slug = () => Math.random().toString(36).slice(2, 10);
const can = need => RANK[S.role] >= RANK[need];
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
function toast(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2800); }
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><path d="M17 14a3 3 0 1 1 0 6z" fill="currentColor"/></svg>',
  sprout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 14c0-3-2-5-7-5 0 4 2 5 7 5z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 16V9M12 16V5M17 16v-4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  tri: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>'
};
const NAV = [
  ['home', 'ホーム', 'home'], ['manuals', '動画マニュアル', 'play'], ['map', '星取表', 'grid'], ['plan', '育成計画', 'sprout'],
  ['analysis', '作業分析', 'chart'], ['records', '教育記録', 'list'], ['admin', '設定', 'gear']
];
const BOTTOM = [['home', 'ホーム', 'home'], ['manuals', 'マニュアル', 'play'], ['map', '星取表', 'grid'], ['plan', '育成', 'sprout'], ['more', 'その他', 'menu']];

// ---------- データ ----------
const D = () => S.data || { tasks: [], staff: [], levels: {}, plans: {}, records: [], timings: [] };
const tasksSorted = () => [...D().tasks].sort((a, b) => 'ABC'.indexOf(a.priority || 'C') - 'ABC'.indexOf(b.priority || 'C') || (a.order || 0) - (b.order || 0));
const taskById = id => D().tasks.find(t => t.id === id);
const staffById = id => D().staff.find(s => s.id === id);
const activeStaff = () => D().staff.filter(s => s.active !== false);
const lvEntry = (sid, tid) => D().levels?.[sid]?.[tid] || null;
const levelOf = (sid, tid) => lvEntry(sid, tid)?.level || 0;
const l3count = tid => activeStaff().filter(s => levelOf(s.id, tid) >= 3).length;
function needsRecheck(sid, tid) { const e = lvEntry(sid, tid), t = taskById(tid); return !!(e && e.level >= 1 && t && (e.version || 1) < (t.version || 1)); }
function planItem(sid, tid) { return D().plans?.[sid]?.items?.[tid] || null; }
function planState(sid, tid) {
  const p = planItem(sid, tid); if (!p || !p.target) return null;
  if (levelOf(sid, tid) >= p.target) return 'done';
  if (p.due && p.due < today()) return 'late';
  if (p.due && p.due <= addDays(today(), 7)) return 'soon';
  return 'open';
}
function hasVideo(t) { return !!(t.video?.fileId || t.video?.url); }
function videoUrl(t) {
  const id = t.video?.fileId; if (!id) return '';
  if (S.blobs[id]) return S.blobs[id];
  if (S.demo) return '';
  return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(D().videoKey || '')}`;
}
function imgUrl(id) { if (!id) return ''; if (S.blobs[id]) return S.blobs[id]; return S.demo ? '' : `https://drive.google.com/thumbnail?id=${id}&sz=w640`; }
function tr(t, lang) {
  const x = lang && lang !== 'ja' ? t.i18n?.[lang] : null, e = t.edit || {};
  return {
    name: x?.name || t.name,
    steps: (t.steps || []).map((s, i) => x?.steps?.[i] || s),
    points: (t.points || []).filter(Boolean).map((p, i) => x?.points?.[i] || p),
    ng: x?.ng || t.ng || '',
    quiz: (t.quiz || []).map((q, i) => ({ ...q, q: x?.quiz?.[i]?.q || q.q, choices: q.choices.map((c, j) => x?.quiz?.[i]?.choices?.[j] || c), why: x?.quiz?.[i]?.why || q.why })),
    captions: (e.captions || []).map((c, i) => x?.captions?.[i] || c.text),
    pauses: (e.pauses || []).map((p, i) => x?.pauses?.[i] || p.text)
  };
}
function videoLen(t) { const e = t.edit || {}, d = t.video?.duration; if (!d) return null; const s = e.trimStart || 0, en = e.trimEnd || d; return Math.max(0, en - s - (e.cuts || []).reduce((a, c) => a + Math.max(0, c.to - c.from), 0)); }

// ---------- 通信 ----------
async function call(action, payload = {}) {
  if (S.demo) return demoCall(action, clone(payload));
  const res = await fetch(API, { method: 'POST', body: JSON.stringify({ k: S.key, action, ...payload }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'error');
  return j;
}
async function refresh(quiet) {
  try {
    const j = await call('bootstrap');
    if (j.role === 'admin' && !j.tasks.length && window.CFF_SEED) { const s = await call('seed', { tasks: clone(window.CFF_SEED) }); j.tasks = s.tasks || j.tasks; }
    S.role = S.demo ? (lsGet('cffDemoRole') || 'admin') : j.role;
    S.data = { tasks: j.tasks, staff: j.staff, levels: j.levels || {}, plans: j.plans || {}, records: j.records || [], timings: j.timings || [], videoKey: j.videoKey, ai: j.ai };
    S.syncedAt = new Date().toISOString();
    if (!S.demo) lsSet('cffCache', JSON.stringify({ role: S.role, data: S.data, at: S.syncedAt }));
    banner();
    if (!quiet || !(S.hold && S.hold())) render();
  } catch (e) {
    if (String(e.message) === 'key') { lsSet('cffKey', null); S.key = ''; render(); return; }
    banner(S.data ? 'データを更新できませんでした。前回の内容を表示しています。' : 'データを読み込めませんでした。通信を確認してください。', true);
    if (!S.data) render();
  }
}
// 書き込みの共通処理：結果を手元のデータにも反映
async function write(action, payload, apply) {
  try { const j = await call(action, payload); if (apply) apply(j); render(); return j; }
  catch (e) {
    const m = String(e.message || e);
    toast(m === 'forbidden' ? 'この鍵ではできない操作です' : m === 'no_ai' ? 'AIが設定されていません（CLAUDE_API_KEY）' : '保存できませんでした：' + m);
    return null;
  }
}
const putTask = t => write('saveTask', { task: t }, j => { const a = D().tasks, i = a.findIndex(x => x.id === j.task.id); if (i >= 0) a[i] = j.task; else a.push(j.task); });
function applyLevel(j) {
  if (j.level) { const L = D().levels; (L[j.level.staffId] = L[j.level.staffId] || {})[j.level.taskId] = j.level; }
  if (j.record) D().records.push(j.record);
}

// ---------- デモ（この端末だけ） ----------
function demoDb() {
  if (!S._demo) { try { S._demo = JSON.parse(lsGet('cffDemo') || 'null'); } catch (e) {} }
  if (!S._demo) S._demo = { tasks: [], staff: [], levels: {}, plans: {}, records: [], timings: [] };
  return S._demo;
}
const demoSave = () => lsSet('cffDemo', JSON.stringify(S._demo));
async function demoCall(action, p) {
  const db = demoDb(), now = new Date().toISOString(), id = pfx => pfx + slug();
  const lv = (sid, tid, level, judgeId, date, version) => { const l = { id: sid + '|' + tid, staffId: sid, taskId: tid, level, judgeId, date, version }; (db.levels[sid] = db.levels[sid] || {})[tid] = l; return l; };
  const rec = r => { r.id = id('r-'); r.at = now; db.records.push(r); return r; };
  let out = {};
  switch (action) {
    case 'bootstrap': out = { role: 'admin', ...clone(db), videoKey: '', ai: false }; break;
    case 'seed': if (!db.tasks.length) db.tasks = p.tasks.map(t => ({ ...t, updatedAt: now })); out = { tasks: clone(db.tasks) }; break;
    case 'saveTask': { p.task.updatedAt = now; const i = db.tasks.findIndex(t => t.id === p.task.id); if (i >= 0) db.tasks[i] = p.task; else db.tasks.push(p.task); out = { task: p.task }; break; }
    case 'deleteTask': db.tasks = db.tasks.filter(t => t.id !== p.id); break;
    case 'saveStaff': { if (!p.staff.id) p.staff.id = id('s-'); const i = db.staff.findIndex(s => s.id === p.staff.id); if (i >= 0) db.staff[i] = p.staff; else db.staff.push(p.staff); out = { staff: p.staff }; break; }
    case 'testResult': {
      const st = db.staff.find(s => s.id === p.staffId), tk = db.tasks.find(t => t.id === p.taskId);
      out.record = rec({ kind: 'test', date: today(), staffId: st.id, staffName: st.name, taskId: tk.id, taskName: tk.name, pass: p.pass, score: p.score, total: p.total, taskVersion: tk.version || 1 });
      if (p.pass) { const c = db.levels[st.id]?.[tk.id]; out.level = lv(st.id, tk.id, Math.max(1, c?.level || 0), c?.judgeId || null, c && c.level > 1 ? c.date : today(), tk.version || 1); }
      break;
    }
    case 'certify': {
      const st = db.staff.find(s => s.id === p.staffId), tk = db.tasks.find(t => t.id === p.taskId), j = db.staff.find(s => s.id === p.judgeId);
      if (p.level >= 2 && !j) throw new Error('判定者を選んでください');
      if (p.level >= 3 && j.role !== '工場長') throw new Error('L3・L4は工場長が判定します');
      if (j && j.id === st.id) throw new Error('本人は判定者になれません');
      out.level = lv(st.id, tk.id, p.level, j?.id || null, p.date, tk.version || 1);
      out.record = rec({ kind: 'cert', date: p.date, staffId: st.id, staffName: st.name, taskId: tk.id, taskName: tk.name, level: p.level, judgeId: j?.id || null, judgeName: j?.name || '', note: p.note || '', taskVersion: tk.version || 1 });
      break;
    }
    case 'savePlan': db.plans[p.staffId] = { id: p.staffId, items: p.items, updatedAt: now }; out = { plan: db.plans[p.staffId] }; break;
    case 'addTiming': p.timing.id = id('m-'); p.timing.at = now; db.timings.push(p.timing); out = { timing: p.timing }; break;
    case 'deleteFile': break;
    case 'ai': throw new Error('no_ai');
    default: throw new Error('action');
  }
  demoSave();
  return { ok: true, ...clone(out) };
}

// ---------- アップロード ----------
const readB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function uploadBlob(blob, name, onProgress) {
  if (S.demo) { const id = 'local-' + slug(); S.blobs[id] = URL.createObjectURL(blob); return id; }
  const mime = blob.type || 'video/mp4';
  if (blob.size < 3 * 1024 * 1024 && mime.startsWith('image/')) { const j = await call('uploadSmall', { name, mime, b64: await readB64(blob) }); return j.fileId; }
  const { token } = await call('uploadStart', { name, mime, size: blob.size });
  const CH = 4 * 1024 * 1024;
  for (let start = 0; start < blob.size; start += CH) {
    const part = blob.slice(start, Math.min(blob.size, start + CH));
    const j = await call('uploadChunk', { token, start, total: blob.size, mime, b64: await readB64(part) });
    onProgress && onProgress(Math.min(1, (start + part.size) / blob.size));
    if (j.done) return j.fileId;
  }
  throw new Error('upload_incomplete');
}
function meta(src) {
  return new Promise((res, rej) => { const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = src; v.onloadedmetadata = () => res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight }); v.onerror = () => rej(new Error('meta')); });
}
// 指定した秒の画面を JPEG で取り出す（ドライブの動画で取れないときは null）
async function captureFrames(src, times, width = 640) {
  const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = src; v.playsInline = true;
  try { await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(() => rej(new Error('timeout')), 20000); }); } catch (e) { return times.map(() => null); }
  const out = [];
  for (const t of times) {
    try {
      await new Promise((res, rej) => { v.onseeked = res; v.onerror = rej; v.currentTime = Math.min(Math.max(0, t), (v.duration || t) - 0.05); setTimeout(res, 4000); });
      const sc = width / v.videoWidth, c = document.createElement('canvas'); c.width = width; c.height = Math.round(v.videoHeight * sc);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.78)));
    } catch (e) { out.push(null); }
  }
  return out;
}
// 大きい動画を、再生しながら 720p・低ビットレートで録り直して軽くする
function shrinkVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === 'undefined') return reject(new Error('shrink_failed'));
    const v = document.createElement('video'); v.src = URL.createObjectURL(file); v.playsInline = true;
    v.onloadedmetadata = async () => {
      try {
        const sc = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
        const cw = Math.round(v.videoWidth * sc / 2) * 2, ch = Math.round(v.videoHeight * sc / 2) * 2;
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d');
        const stream = cv.captureStream(30);
        try { const ac = new AudioContext(), src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) { v.muted = true; }
        const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
        if (!mime) return reject(new Error('shrink_failed'));
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000, audioBitsPerSecond: 96000 });
        const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.onstop = () => { URL.revokeObjectURL(v.src); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
        let raf; const draw = () => { g.drawImage(v, 0, 0, cw, ch); onProgress(v.currentTime / (v.duration || 1)); if (!v.ended) raf = requestAnimationFrame(draw); };
        v.onended = () => { cancelAnimationFrame(raf); onProgress(1); rec.stop(); };
        rec.start(1000); await v.play(); draw();
      } catch (e) { reject(new Error('shrink_failed')); }
    };
    v.onerror = () => reject(new Error('shrink_failed'));
  });
}

// ---------- AI ----------
function parseJSON(text) { const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error('AIの答えを読めませんでした'); return JSON.parse(m[0]); }
async function ai(prompt, images = []) {
  const b64 = []; for (const im of images) if (im) b64.push(await readB64(im));
  const j = await call('ai', { prompt, images: b64 });
  return parseJSON(j.text);
}
const CONTEXT = 'あなたは食品工場（クリエイティブフーズファクトリー。唐辛子などをすりつぶした旨辛調味料「すりだね」を製造）の作業マニュアル作りを手伝います。読み手は新人・パート・外国人スタッフ。短く、具体的に、やさしい日本語で。画像や入力に無い数値（温度・時間・分量）は作らず、必要なら「（要確認）」と書く。';

// ---------- 画面の外枠 ----------
function route() { return (location.hash || '#home').slice(1).split('&')[0] || 'home'; }
function tabOf(r) {
  if (r.startsWith('t-') || r.startsWith('e-')) return 'manuals';
  if (r.startsWith('p-')) return 'plan';
  return ['home', 'manuals', 'map', 'plan', 'analysis', 'records', 'admin', 'more'].includes(r) ? r : 'home';
}
function shell() {
  const tab = tabOf(route());
  const nav = document.getElementById('sideNav'); nav.replaceChildren(...NAV.filter(n => n[0] !== 'admin' || can('admin') || S.demo).map(([k, l, i]) =>
    h('a', { href: '#' + k, 'aria-current': tab === k ? 'page' : null }, h('span', { svg: ICON[i] }).firstChild, l)));
  const more = ['analysis', 'records', 'admin', 'more'].includes(tab) ? 'more' : tab;
  document.getElementById('bottomNav').replaceChildren(...BOTTOM.map(([k, l, i]) =>
    h('a', { href: '#' + k, 'aria-current': more === k ? 'page' : null }, h('span', { svg: ICON[i] }).firstChild, l)));
  const role = h('span', { class: 'chip' + (S.role === 'admin' ? ' y' : '') }, ROLE_NAME[S.role] || '');
  document.getElementById('topRole').replaceChildren(S.key || S.demo ? role : '');
  document.getElementById('sideFoot').replaceChildren(h('div', null, S.key || S.demo ? role.cloneNode(true) : ''), h('div', { style: 'margin-top:8px' }, S.syncedAt ? `更新 ${new Date(S.syncedAt).toTimeString().slice(0, 5)}` : ''), h('div', null, `版 ${VERSION}`));
}
function banner(msg, bad) {
  const b = document.getElementById('banner');
  const parts = [];
  if (S.demo) {
    const sel = h('select', { class: 'in', style: 'width:auto', onchange: e => { lsSet('cffDemoRole', e.target.value); S.role = e.target.value; render(); } },
      Object.entries(ROLE_NAME).map(([k, v]) => h('option', { value: k, selected: S.role === k }, v + 'として見る')));
    parts.push(h('div', { class: 'note' }, h('b', null, 'デモ表示'), h('span', null, 'データはこの端末だけに保存されます。会社のGASにつなぐと全員で共有されます。'), sel));
  }
  if (msg) parts.push(h('div', { class: 'note' + (bad ? ' bad' : ''), style: parts.length ? 'margin-top:8px' : '' }, msg));
  b.replaceChildren(...parts);
}
function render() {
  if (S.player) { S.player.destroy(); S.player = null; }
  S.hold = null;
  shell();
  const v = document.getElementById('view'), r = route();
  if (!S.demo && !S.key) { v.replaceChildren(viewWelcome()); return; }
  if (!S.data) { v.replaceChildren(h('div', { class: 'empty' }, '読み込み中…')); return; }
  const keep = render.last === r ? window.scrollY : 0;
  let node;
  if (r.startsWith('t-')) node = viewTask(r.slice(2));
  else if (r.startsWith('e-')) node = can('admin') ? viewEditor(r.slice(2)) : denied();
  else if (r.startsWith('p-')) node = viewPerson(r.slice(2));
  else node = ({ home: viewHome, manuals: viewManuals, map: viewMap, plan: viewPlan, analysis: viewAnalysis, records: viewRecords, admin: viewAdmin, more: viewMore }[tabOf(r)] || viewHome)();
  v.replaceChildren(node);
  window.scrollTo(0, keep);
  render.last = r;
}
const denied = () => h('div', { class: 'empty' }, 'この画面は管理者の鍵で開いたときに使えます。');

function viewWelcome() {
  const inp = h('input', { class: 'in', id: 'key-in', type: 'password', placeholder: '鍵（QRに入っている文字）', autocomplete: 'off' });
  return h('div', { class: 'welcome' },
    h('img', { src: 'icons/cr-logo.png', alt: 'CREATIVE RESORT', class: 'only-light' }), h('img', { src: 'icons/cr-logo-white.png', alt: 'CREATIVE RESORT', class: 'only-dark' }),
    h('h1', null, '技能伝承ボード'),
    h('p', { class: 'muted' }, '工場で配られた「はじめにQR」をスマホのカメラで読み取ると開けます。読み取ったあとは、ホーム画面に追加しておくと次からすぐ開けます。'),
    h('div', { class: 'card stack' }, h('label', { class: 'f' }, 'QRが読めないときは鍵を入力', inp),
      h('button', { class: 'btn primary', onclick: () => { if (inp.value.trim()) { S.key = inp.value.trim(); lsSet('cffKey', S.key); refresh(); } } }, 'はじめる')));
}

// ---------- ホーム ----------
function viewHome() {
  const tasks = tasksSorted(), staff = activeStaff(), ym = today().slice(0, 7);
  const recs = D().records.filter(r => (r.date || '').startsWith(ym));
  const tests = recs.filter(r => r.kind === 'test');
  const risky = tasks.filter(t => l3count(t.id) < 2);
  const recheck = []; staff.forEach(s => tasks.forEach(t => { if (needsRecheck(s.id, t.id)) recheck.push([s, t]); }));
  const late = [], soon = [];
  staff.forEach(s => tasks.forEach(t => { const st = planState(s.id, t.id); if (st === 'late') late.push([s, t]); if (st === 'soon') soon.push([s, t]); }));
  const noVideoA = tasks.filter(t => t.priority === 'A' && !hasVideo(t));
  const d = new Date();
  const todo = [];
  if (late.length) todo.push(['bad', `育成目標の期限切れ ${late.length}件`, [...new Set(late.map(x => x[0].name))].slice(0, 4).join('・') + (late.length > 4 ? ' ほか' : ''), '#plan']);
  if (risky.length) todo.push(['bad', `属人化している作業 ${risky.length}`, risky.slice(0, 4).map(t => t.short || t.name).join('・') + '：L3以上が2人未満', '#map']);
  if (recheck.length) todo.push(['', `手順の改訂後、再確認が必要 ${recheck.length}件`, '改訂後にテストか認定をやり直してください', '#map']);
  if (soon.length) todo.push(['y', `1週間以内に期限の育成目標 ${soon.length}件`, [...new Set(soon.map(x => x[0].name))].slice(0, 4).join('・'), '#plan']);
  if (noVideoA.length) todo.push(['y', `動画がまだのA作業 ${noVideoA.length}`, noVideoA.map(t => t.short || t.name).join('・'), can('admin') ? '#e-' + noVideoA[0].id : '#manuals']);
  if (!staff.length && can('admin')) todo.unshift(['y', 'スタッフを登録しましょう', '設定 → スタッフ から。登録すると星取表ができます', '#admin']);
  const recent = [...tasks].filter(hasVideo).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 3);
  return h('div', null,
    h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`), h('h1', null, 'すりだね工場の技能'))),
    h('div', { class: 'kpis' },
      kpi('動画ができた作業', `${tasks.filter(hasVideo).length}`, `/ ${tasks.length}`, '#manuals'),
      kpi('属人化している作業', `${risky.length}`, '', '#map', risky.length > 0),
      kpi(`${d.getMonth() + 1}月のテスト合格`, `${tests.filter(r => r.pass).length}`, `/ ${tests.length}回`, '#records'),
      kpi(`${d.getMonth() + 1}月の認定（L2〜L4）`, `${recs.filter(r => r.kind === 'cert' && r.level >= 2).length}`, '件', '#records')),
    h('div', { class: 'home-grid' },
      h('section', null, h('div', { class: 'section-h' }, h('h2', null, 'やること')),
        todo.length ? h('div', { class: 'todo' }, todo.map(([c, b, s, href]) => h('a', { href }, h('span', { class: 'dot ' + c }), h('span', null, h('b', null, b), h('span', { class: 'small muted' }, s)))))
          : h('div', { class: 'empty' }, '今のところ対応が必要なことはありません。')),
      h('section', null, h('div', { class: 'section-h' }, h('h2', null, '最近更新した動画'), h('a', { href: '#manuals', class: 'small' }, 'すべて見る')),
        recent.length ? h('div', { class: 'stack' }, recent.map(t => vcard(t, true))) : h('div', { class: 'empty' }, 'まだ動画がありません。'),
        h('div', { class: 'section-h', style: 'margin-top:18px' }, h('h2', null, '最近の記録')),
        recentRecords(5))));
}
function kpi(k, v, unit, href, alert) { return h('a', { class: 'kpi' + (alert ? ' alert' : ''), href }, h('span', { class: 'k' }, k), h('span', { class: 'v num' }, v, unit ? h('small', null, ' ' + unit) : null)); }
function recentRecords(n, filter) {
  const rs = D().records.filter(filter || (() => true)).slice().sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, n);
  if (!rs.length) return h('div', { class: 'empty' }, 'まだ記録はありません。');
  return h('div', { class: 'todo' }, rs.map(r => h('a', { href: '#p-' + r.staffId },
    h('span', { class: 'dot ' + (r.kind === 'test' ? (r.pass ? 'y' : 'bad') : '') , style: r.kind === 'cert' ? 'background:var(--ink)' : '' }),
    h('span', null, h('b', null, `${staffById(r.staffId)?.name || r.staffName}：${taskById(r.taskId)?.name || r.taskName}`),
      h('span', { class: 'small muted' }, `${r.date}　${r.kind === 'test' ? `確認テスト ${r.pass ? '合格' : '不合格'} ${r.score}/${r.total}` : `認定 ${LV[r.level]}${r.judgeName ? '（' + r.judgeName + '）' : ''}`}`)))));
}

// ---------- 動画マニュアル一覧 ----------
function vcard(t, wide) {
  const th = imgUrl(t.video?.thumbId), len = videoLen(t), n = l3count(t.id);
  return h('a', { class: 'vcard', href: '#t-' + t.id, style: wide ? 'flex-direction:row' : '' },
    h('div', { class: 'thumb', style: wide ? 'width:44%;flex:none' : '' },
      th ? h('img', { src: th, alt: '', loading: 'lazy', onerror: e => e.target.remove() }) : h('div', { class: 'ph' }, t.short || t.name, h('small', null, t.process || '')),
      h('span', { class: 'pri ' + (t.priority || 'C') }, t.priority || 'C'),
      hasVideo(t) ? h('span', { class: 'play', svg: ICON.tri }) : null,
      len ? h('span', { class: 'dur num' }, fmtT(len).replace(/\.\d$/, '')) : null),
    h('div', { class: 'vbody' }, h('span', { class: 'proc' }, t.process || ''), h('span', { class: 'name' }, t.name),
      h('div', { class: 'chips' },
        hasVideo(t) ? null : h('span', { class: 'chip' }, '動画なし'),
        (t.steps || []).length ? h('span', { class: 'chip' }, `手順${t.steps.length}`) : null,
        n < 2 ? h('span', { class: 'chip bad' }, `L3以上 ${n}人`) : h('span', { class: 'chip good' }, `L3以上 ${n}人`),
        t.draft ? h('span', { class: 'chip warn' }, '仮の内容') : null)));
}
function viewManuals() {
  const f = S.ui.filter, q = S.ui.q.trim();
  let list = tasksSorted();
  if (f === 'A' || f === 'B' || f === 'C') list = list.filter(t => (t.priority || 'C') === f);
  if (f === 'novideo') list = list.filter(t => !hasVideo(t));
  if (q) list = list.filter(t => [t.name, t.process, ...(t.steps || []), ...(t.points || [])].join(' ').includes(q));
  const box = h('div', null, list.length ? h('div', { class: 'vgrid' }, list.map(t => vcard(t))) : h('div', { class: 'empty' }, '当てはまる作業がありません。'));
  const search = h('input', { type: 'search', id: 'q', value: S.ui.q, placeholder: '作業名・手順のことばで探す', oninput: e => { S.ui.q = e.target.value; box.replaceChildren(...viewManuals().lastChild.childNodes); } });
  return h('div', null,
    h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'つくる・わかる'), h('h1', null, '動画マニュアル')),
      can('admin') ? h('button', { class: 'btn primary', onclick: () => { S.ui.adminTab = 'tasks'; S.ui.editTask = '__new'; location.hash = '#admin'; } }, '＋ 作業を追加') : null),
    h('div', { class: 'filters' }, h('label', { class: 'search' }, h('span', { svg: ICON.search }).firstChild, search),
      h('div', { class: 'seg' }, [['all', 'すべて'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['novideo', '動画なし']].map(([k, l]) =>
        h('button', { 'aria-pressed': f === k ? 'true' : 'false', onclick: () => { S.ui.filter = k; render(); } }, l)))),
    box);
}

// ---------- プレーヤー（編集内容をその場で反映） ----------
function makePlayer(t, o = {}) {
  const getEdit = o.edit || (() => t.edit || {});
  const getTimes = o.times || (() => t.stepTimes || []);
  let lang = o.lang || 'ja';
  const v = h('video', { playsinline: true, preload: 'metadata', controls: true });
  const src = o.src || videoUrl(t);
  const stage = h('div', { class: 'stage' }, v);
  const svg = sv('svg', { class: 'shapes', viewBox: '0 0 1000 562.5', preserveAspectRatio: 'none' });
  const capT = h('div', { class: 'cap top' }), capB = h('div', { class: 'cap bottom' }), card = h('div', { class: 'pausecard', hidden: true });
  stage.append(svg, capT, capB, card);
  if (src) v.src = src;
  else stage.append(h('div', { class: 'novideo' }, t.video?.url ? h('a', { class: 'btn yellow', href: t.video.url, target: '_blank', rel: 'noopener' }, '外部の動画を開く') : h('span', null, S.demo && t.video?.fileId ? 'デモでは動画は開いている間だけ保存されます' : 'この作業の動画はまだありません')));
  let H = 562.5, raf = 0, last = -1, cur = -2; const spoken = new Set();
  v.addEventListener('loadedmetadata', () => { const ar = (v.videoWidth / v.videoHeight) || 16 / 9; stage.style.aspectRatio = String(ar); H = 1000 / ar; svg.setAttribute('viewBox', `0 0 1000 ${H}`); const e = getEdit(); if (e.trimStart && v.currentTime < e.trimStart) v.currentTime = e.trimStart; tick(); o.onMeta && o.onMeta(v); });
  v.addEventListener('error', () => { if (src) stage.append(h('div', { class: 'novideo' }, '動画を読み込めませんでした。通信か共有設定を確認してください。')); });
  function say(text) {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = SPEECH[lang] || 'ja-JP'; u.rate = 1; speechSynthesis.speak(u);
  }
  function showPause(i) {
    const x = tr(t, lang); card.hidden = false;
    card.replaceChildren(h('b', null, x.pauses[i] || '確認'), h('div', null, h('button', { class: 'btn yellow', onclick: () => { card.hidden = true; v.play(); } }, '確認した・続ける')));
    if (o.speak && o.speak()) say(x.pauses[i]);
  }
  function drawShapes(e, now) {
    while (svg.firstChild) svg.firstChild.remove();
    (e.shapes || []).forEach((s, i) => {
      if (!(now >= s.from && now < s.to) && !(o.showShape && o.showShape() === i)) return;
      const col = SHAPE_COLORS[s.color] || SHAPE_COLORS.red, cx = s.x * 1000, cy = s.y * H, w = (s.w || 0.2) * 1000;
      const g = sv('g', {});
      const add = (el, outline) => { el.setAttribute('fill', 'none'); el.setAttribute('stroke', outline ? 'rgba(0,0,0,.55)' : col); el.setAttribute('stroke-width', outline ? 16 : 9); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round'); g.append(el); };
      for (const outline of [true, false]) {
        if (s.type === 'circle') add(sv('ellipse', { cx, cy, rx: w / 2, ry: w / 2 }), outline);
        else if (s.type === 'rect') add(sv('rect', { x: cx - w / 2, y: cy - w * 0.3, width: w, height: w * 0.6, rx: 8 }), outline);
        else {
          const a = (s.ang ?? 135) * Math.PI / 180, tx = cx - Math.cos(a) * w, ty = cy - Math.sin(a) * w, hl = Math.min(60, w * 0.35);
          const p1 = `${cx - Math.cos(a - 0.5) * hl},${cy - Math.sin(a - 0.5) * hl}`, p2 = `${cx - Math.cos(a + 0.5) * hl},${cy - Math.sin(a + 0.5) * hl}`;
          add(sv('line', { x1: tx, y1: ty, x2: cx, y2: cy }), outline); add(sv('polyline', { points: `${p1} ${cx},${cy} ${p2}` }), outline);
        }
      }
      svg.append(g);
    });
  }
  function tick() {
    const e = getEdit(), now = v.currentTime, raw = o.raw && o.raw();
    if (!raw && !v.seeking && v.readyState >= 1) {
      if (e.trimStart && now < e.trimStart - 0.05) v.currentTime = e.trimStart;
      else if (e.trimEnd && now >= e.trimEnd) { if (!v.paused) v.pause(); }
      else for (const c of e.cuts || []) if (now >= c.from && now < c.to - 0.05) { v.currentTime = c.to; break; }
      if (!v.paused && last >= 0 && now - last < 1.5) (e.pauses || []).forEach((p, i) => { if (last < p.t && now >= p.t) { v.pause(); showPause(i); } });
    }
    if (now < last - 0.3) spoken.clear();
    last = now;
    const x = tr(t, lang); let top = '', bot = '';
    (e.captions || []).forEach((c, i) => {
      if (now >= c.from && now < c.to) {
        if (c.pos === 'top') top = x.captions[i]; else bot = x.captions[i];
        if (o.speak && o.speak() && !v.paused && !spoken.has(i)) { spoken.add(i); say(x.captions[i]); }
      }
    });
    capT.textContent = top; capB.textContent = bot;
    drawShapes(e, now);
    const times = getTimes(); let si = -1, best = -1;
    times.forEach((s, i) => { if (s != null && s !== '' && now + 0.05 >= s && s >= best) { best = s; si = i; } });
    if (si !== cur) { cur = si; o.onStep && o.onStep(si); }
    o.onTime && o.onTime(now);
  }
  const loop = () => { tick(); if (!v.paused && !v.ended) raf = requestAnimationFrame(loop); };
  v.addEventListener('play', () => { card.hidden = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
  ['seeked', 'pause', 'timeupdate'].forEach(ev => v.addEventListener(ev, () => { if (v.paused) tick(); }));
  return {
    el: stage, video: v, stage, redraw: tick,
    setLang(l) { lang = l; tick(); },
    seek(s) { if (s == null) return; v.currentTime = s; tick(); },
    destroy() { cancelAnimationFrame(raf); try { speechSynthesis.cancel(); } catch (e) {} v.pause(); v.removeAttribute('src'); v.load(); }
  };
}

// ---------- 作業ページ ----------
function viewTask(id) {
  const t = taskById(id);
  if (!t) return h('div', null, h('p', null, h('a', { href: '#manuals' }, '← 動画マニュアル')), h('div', { class: 'empty' }, 'この作業は見つかりませんでした。'));
  let lang = S.lang[id] || 'ja';
  const langs = ['ja', ...Object.keys(t.i18n || {})];
  let speak = lsGet('cffSpeak') === '1';
  const stepsBox = h('div', { class: 'steps-list' });
  const p = makePlayer(t, { lang, speak: () => speak, onStep: i => stepsBox.querySelectorAll('.step').forEach((el, k) => el.classList.toggle('now', k === i)) });
  S.player = p;
  S.hold = () => !p.video.paused;
  const drawText = () => {
    const x = tr(t, lang), times = t.stepTimes || [];
    stepsBox.replaceChildren(...x.steps.map((s, i) => h('button', { class: 'step', onclick: () => { if (times[i] != null) { p.seek(times[i]); p.video.play(); } } },
      h('span', { class: 'n' }, i + 1), h('span', null, s), h('span', { class: 'tm num' }, times[i] != null ? fmtT(times[i]).replace(/\.\d$/, '') : ''))));
    mustBox.replaceChildren(...(x.points.length ? [h('ul', { class: 'must' }, x.points.map(pt => h('li', null, pt)))] : [h('p', { class: 'muted' }, '未設定')]));
    ngBox.replaceChildren(x.ng ? h('p', { style: 'margin:0;white-space:pre-wrap' }, x.ng) : h('p', { class: 'muted', style: 'margin:0' }, '未設定'));
    title.textContent = x.name;
  };
  const mustBox = h('div'), ngBox = h('div'), title = h('h1');
  const speeds = h('div', { class: 'seg' }, [0.5, 0.75, 1].map(r => h('button', { 'aria-pressed': r === 1 ? 'true' : 'false', onclick: e => { p.video.playbackRate = r; speeds.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.target ? 'true' : 'false')); } }, r === 1 ? '標準' : r + '倍')));
  const holders = activeStaff().map(s => ({ s, l: levelOf(s.id, t.id) })).filter(o => o.l > 0).sort((a, b) => b.l - a.l);
  drawText();
  return h('div', null,
    h('p', { style: 'margin:0 0 8px' }, h('a', { href: '#manuals', class: 'small muted' }, '← 動画マニュアル')),
    h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, h('span', { class: 'pri ' + t.priority }, t.priority), '　', t.process || '', `　手順の版 ${t.version || 1}`), title),
      h('div', { class: 'row' },
        langs.length > 1 ? h('select', { class: 'in', style: 'width:auto', 'aria-label': '言語', onchange: e => { lang = S.lang[id] = e.target.value; p.setLang(lang); drawText(); } }, langs.map(l => h('option', { value: l, selected: l === lang }, LANGS[l]))) : null,
        can('admin') ? h('a', { class: 'btn', href: '#e-' + t.id }, '動画を編集') : null)),
    h('div', { class: 'watch' },
      h('div', { class: 'stack' }, p.el,
        h('div', { class: 'pbar' }, speeds,
          'speechSynthesis' in window ? h('label', { class: 'row small', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: speak, onchange: e => { speak = e.target.checked; lsSet('cffSpeak', speak ? '1' : '0'); } }), 'テロップを読み上げる') : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn yellow', disabled: !(t.quiz || []).length, onclick: () => openTest(t) }, (t.quiz || []).length ? `確認テスト（${t.quiz.length}問）` : 'テスト未作成'),
          can('leader') ? h('button', { class: 'btn', onclick: () => openCert({ taskId: t.id }) }, '認定を記録') : null,
          h('button', { class: 'btn ghost', onclick: () => printManual(t, lang) }, '手順書を印刷')),
        h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:8px' }, 'この作業ができる人'),
          holders.length ? h('div', { class: 'holders' }, holders.map(o => h('a', { href: '#p-' + o.s.id }, star(o.l, 22), h('b', null, o.s.name), h('span', { class: 'small muted' }, LV[o.l]), needsRecheck(o.s.id, t.id) ? h('span', { class: 'chip warn' }, '要再確認') : null)))
            : h('p', { class: 'muted', style: 'margin:0' }, 'まだ誰も認定されていません。'))),
      h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:10px' }, '必ず守ること'), mustBox),
        h('div', null, h('div', { class: 'section-h' }, h('h3', null, '手順'), h('span', { class: 'small muted' }, (t.stepTimes || []).some(x => x != null) ? '押すとその場面から再生' : '')), stepsBox),
        h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:8px' }, 'よくある失敗・NG'), ngBox))));
}
function star(level, size = 26) {
  const r = size / 2 - 2, c = size / 2; let fill = '';
  if (level >= 4) fill = `<circle cx="${c}" cy="${c}" r="${r}" fill="currentColor"/>`;
  else if (level > 0) { const a = (level / 4) * 2 * Math.PI, x = c + r * Math.sin(a), y = c - r * Math.cos(a); fill = `<path d="M${c} ${c}L${c} ${c - r}A${r} ${r} 0 ${level >= 3 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z" fill="currentColor"/>`; }
  return h('span', { role: 'img', 'aria-label': LV[level || 0], style: `display:inline-flex;color:var(--ink);opacity:${level ? 1 : .35}`, svg: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.6"/>${fill}</svg>` });
}

// ---------- ダイアログ ----------
function openDialog(build) {
  const layer = document.getElementById('layer');
  const close = () => { layer.replaceChildren(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' });
  const scrim = h('div', { class: 'scrim', onclick: e => { if (e.target === scrim) close(); } }, box);
  layer.replaceChildren(scrim); build(box, close);
  const f = box.querySelector('select,input,button'); if (f) f.focus();
  return close;
}
const staffSelect = (id, filter, ph) => h('select', { class: 'in', id }, h('option', { value: '' }, ph || '選んでください'), activeStaff().filter(filter || (() => true)).map(s => h('option', { value: s.id }, s.name)));

function openTest(t) {
  openDialog((box, close) => {
    box.append(h('h2', null, '確認テスト：' + t.name));
    if (!activeStaff().length) { box.append(h('p', null, 'スタッフがまだ登録されていません。'), h('button', { class: 'btn', onclick: close }, '閉じる')); return; }
    const sel = staffSelect('test-staff', null, '受ける人を選ぶ');
    box.append(h('p', { class: 'muted small', style: 'margin:0' }, '全問正解で L1（知っている）になります。手順が改訂されたあとは、もう一度受けると再確認になります。'), h('label', { class: 'f' }, '受ける人', sel));
    const qa = h('div', { class: 'stack' }); let x, lang = 'ja';
    const draw = () => {
      const st = staffById(sel.value); lang = st?.lang && t.i18n?.[st.lang] ? st.lang : 'ja'; x = tr(t, lang);
      qa.replaceChildren(...x.quiz.map((q, i) => h('fieldset', { class: 'q' }, h('legend', null, `問${i + 1}　${q.q}`),
        q.choices.map((c, j) => h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'q' + i, value: j, id: `q${i}-${j}` }), h('span', null, c))))));
    };
    draw(); sel.addEventListener('change', draw);
    const out = h('div');
    const go = h('button', { class: 'btn primary', onclick: async () => {
      if (!sel.value) return toast('受ける人を選んでください');
      const ans = x.quiz.map((q, i) => { const c = qa.querySelector(`input[name=q${i}]:checked`); return c ? +c.value : -1; });
      if (ans.includes(-1)) return toast('すべての問題に答えてください');
      go.disabled = true; let score = 0;
      x.quiz.forEach((q, i) => {
        const ok = ans[i] === +q.answer; if (ok) score++;
        qa.querySelectorAll(`input[name=q${i}]`).forEach(inp => { inp.disabled = true; const l = inp.closest('.choice'); if (+inp.value === +q.answer) l.classList.add('right'); else if (inp.checked) l.classList.add('wrong'); });
        if (!ok && q.why) qa.children[i].append(h('p', { class: 'small', style: 'margin:0' }, '解説：' + q.why));
      });
      const pass = score === x.quiz.length;
      out.replaceChildren(h('div', { class: 'result ' + (pass ? 'pass' : 'fail') }, pass ? `全問正解（${score}/${x.quiz.length}）。L1として記録しました。` : `${score}/${x.quiz.length}問正解。動画を見直して、もう一度受けてください。`));
      await write('testResult', { staffId: sel.value, taskId: t.id, pass, score, total: x.quiz.length, lang }, applyLevel);
      go.replaceWith(h('button', { class: 'btn', onclick: close }, '閉じる'));
    } }, '採点する');
    box.append(qa, out, h('div', { class: 'row' }, go, h('button', { class: 'btn ghost', onclick: close }, 'やめる')));
  });
}

function openCert(pre) {
  if (!can('leader')) return;
  openDialog((box, close) => {
    box.append(h('h2', null, '認定を記録する'));
    if (!activeStaff().length) { box.append(h('p', null, 'スタッフがまだ登録されていません。'), h('button', { class: 'btn', onclick: close }, '閉じる')); return; }
    const sS = staffSelect('cert-staff'); if (pre.staffId) sS.value = pre.staffId;
    const tS = h('select', { class: 'in', id: 'cert-task' }, tasksSorted().map(t => h('option', { value: t.id }, `${t.priority} ${t.name}`))); if (pre.taskId) tS.value = pre.taskId;
    const lS = h('select', { class: 'in', id: 'cert-level' }, [0, 1, 2, 3, 4].map(l => h('option', { value: l }, LV[l])));
    const jS = staffSelect('cert-judge', s => s.role === '指導者' || s.role === '工場長', '判定する人');
    const date = h('input', { class: 'in', type: 'date', id: 'cert-date', value: today() });
    const note = h('input', { class: 'in', type: 'text', id: 'cert-note', placeholder: '例：一人作業で3ロット不良なし' });
    const cur = h('p', { class: 'small muted', style: 'margin:0' });
    const show = () => { const l = levelOf(sS.value, tS.value); cur.textContent = sS.value ? `今：${LV[l]}${needsRecheck(sS.value, tS.value) ? '（改訂後の再確認が必要）' : ''}` : ''; lS.value = String(Math.min(4, l + (sS.value && !needsRecheck(sS.value, tS.value) ? 1 : 0))); };
    sS.addEventListener('change', show); tS.addEventListener('change', show); show();
    box.append(h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'スタッフ', sS), h('label', { class: 'f' }, '作業', tS), h('label', { class: 'f' }, '認定するレベル', lS), h('label', { class: 'f' }, '判定者', jS), h('label', { class: 'f' }, '日付', date), h('label', { class: 'f' }, 'メモ', note)), cur,
      h('p', { class: 'small muted', style: 'margin:0' }, 'L2は指導者以上、L3・L4は工場長が判定します。本人は判定者になれません。'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => {
        const level = +lS.value, st = staffById(sS.value), j = staffById(jS.value);
        if (!st) return toast('スタッフを選んでください');
        if (level >= 2 && !j) return toast('判定者を選んでください');
        if (level >= 3 && j.role !== '工場長') return toast('L3・L4は工場長が判定します');
        if (j && j.id === st.id) return toast('本人は判定者になれません');
        const r = await write('certify', { staffId: st.id, taskId: tS.value, level, judgeId: j?.id || '', date: date.value || today(), note: note.value }, applyLevel);
        if (r) { toast(`${st.name}さんを ${LV[level]} にしました`); close(); }
      } }, '記録する'), h('button', { class: 'btn ghost', onclick: close }, 'やめる')));
  });
}

// ---------- 動画の編集 ----------
function viewEditor(id) {
  const t = taskById(id);
  if (!t) return h('div', { class: 'empty' }, 'この作業は見つかりませんでした。');
  const d = clone(t.edit || {}); ['cuts', 'captions', 'shapes', 'pauses'].forEach(k => d[k] = d[k] || []);
  const steps = (t.steps || []).map((s, i) => ({ text: s, t: (t.stepTimes || [])[i] ?? null }));
  let dirty = false, tab = hasVideo(t) ? 'steps' : 'file', placing = -1, selShape = -1, raw = false, localSrc = '', proposal = null;
  const dirtyEl = h('span', { class: 'dirty' });
  const mark = () => { dirty = true; dirtyEl.textContent = '未保存の変更があります'; p.redraw(); drawTL(); };
  S.hold = () => true;
  const p = makePlayer(t, { edit: () => d, times: () => steps.map(s => s.t), raw: () => raw, showShape: () => selShape, onTime: () => head(), onMeta: () => drawTL() });
  S.player = p;
  const v = p.video, now = () => Math.round(v.currentTime * 10) / 10, dur = () => v.duration || t.video?.duration || 0;
  // 動画の上をクリックして図形の位置を決める
  const catcher = h('div', { class: 'catcher', hidden: true, onclick: e => {
    const r = p.stage.getBoundingClientRect(), s = d.shapes[placing]; if (!s) return;
    s.x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000; s.y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000;
    placing = -1; catcher.hidden = true; mark(); drawPanel();
  } });
  p.stage.append(catcher);

  // タイムライン
  const tl = h('div', { class: 'tl' }); let headEls = [];
  function drawTL() {
    const D_ = dur(); headEls = [];
    if (!D_) { tl.replaceChildren(h('div', { class: 'small muted' }, '動画を読み込むとタイムラインが出ます。')); return; }
    const pc = x => `${Math.max(0, Math.min(100, x / D_ * 100))}%`;
    const track = (label, kids) => { const tr_ = h('div', { class: 'tl-track', onclick: e => { const r = tr_.getBoundingClientRect(); p.seek(((e.clientX - r.left) / r.width) * D_); } }, kids); const hd = h('span', { class: 'tl-head' }); tr_.append(hd); headEls.push(hd); return h('div', { class: 'tl-row' }, label, tr_); };
    const seg = (cls, a, b, title) => h('span', { class: 'tl-seg ' + cls, style: `left:${pc(a)};width:${pc(Math.max(0.15, b - a))}`, title });
    tl.replaceChildren(
      track('カット', [d.trimStart ? seg('cut', 0, d.trimStart, '前を切る') : null, d.trimEnd ? seg('cut', d.trimEnd, D_, '後ろを切る') : null, ...d.cuts.map(c => seg('cut', c.from, c.to, 'カット'))]),
      track('手順', steps.map((s, i) => s.t != null ? h('span', { class: 'tl-tick', style: `left:${pc(s.t)}` }, h('span', null, i + 1)) : null)),
      track('テロップ', d.captions.map(c => seg('capseg', c.from, c.to, c.text))),
      track('図形', d.shapes.map(s => seg('shape', s.from, s.to, s.type))),
      track('一時停止', d.pauses.map(x => h('span', { class: 'tl-dia', style: `left:${pc(x.t)}`, title: x.text }))),
      h('div', { class: 'tl-time num' }, h('span', null, '0:00'), h('span', { id: 'tl-now' }, fmtT(v.currentTime)), h('span', null, fmtT(D_))));
    head();
  }
  function head() { const D_ = dur(); if (!D_) return; headEls.forEach(e => e.style.left = `${v.currentTime / D_ * 100}%`); const n = tl.querySelector('#tl-now'); if (n) n.textContent = fmtT(v.currentTime); }

  // 時刻の入力（今の位置ボタン付き）
  const tIn = (obj, key, label) => h('label', { class: 'f' }, label, h('div', { class: 'tfield' },
    h('input', { class: 'in num', type: 'number', step: '0.1', min: '0', value: obj[key] ?? '', oninput: e => { obj[key] = e.target.value === '' ? null : +e.target.value; mark(); } }),
    h('button', { class: 'btn sm', type: 'button', onclick: e => { obj[key] = now(); e.target.closest('.tfield').querySelector('input').value = obj[key]; mark(); } }, '今'),
    h('button', { class: 'btn sm ghost', type: 'button', title: 'この時点へ移動', onclick: () => p.seek(obj[key]) }, '▶')));
  const del = (arr, i) => h('button', { class: 'btn sm danger', type: 'button', onclick: () => { arr.splice(i, 1); selShape = -1; mark(); drawPanel(); } }, '消す');
  const panel = h('div', { class: 'stack' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const TABS = [['steps', '手順の区切り'], ['captions', 'テロップ'], ['shapes', '図形'], ['pauses', '一時停止'], ['cut', 'カット'], ['ai', 'AIで下書き'], ['file', '動画ファイル']];
  function drawPanel() {
    tabs.replaceChildren(...TABS.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', onclick: () => { tab = k; drawPanel(); } }, l)));
    let body;
    if (tab === 'steps') body = [
      h('p', { class: 'small muted', style: 'margin:0' }, '動画を止めて「今」を押すと、その手順の始まりになります。見る人は手順を押すとその場面に飛べます。'),
      ...steps.map((s, i) => h('div', { class: 'item' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `手順${i + 1}`), del(steps, i)),
        h('input', { class: 'in', value: s.text, oninput: e => { s.text = e.target.value; mark(); } }), tIn(s, 't', '始まる時刻（秒）'))),
      h('button', { class: 'btn', onclick: () => { steps.push({ text: '', t: now() }); mark(); drawPanel(); } }, '＋ 手順を追加（今の位置から）')];
    else if (tab === 'captions') body = [
      h('p', { class: 'small muted', style: 'margin:0' }, '画面に出す文字です。翻訳すると外国語でも出ます。「読み上げ」をオンにすると声でも流れます。'),
      ...d.captions.map((c, i) => h('div', { class: 'item' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `テロップ${i + 1}`), del(d.captions, i)),
        h('textarea', { class: 'in', style: 'min-height:56px', value: c.text, oninput: e => { c.text = e.target.value; mark(); } }),
        h('div', { class: 'grid2' }, tIn(c, 'from', '出す'), tIn(c, 'to', '消す'),
          h('label', { class: 'f' }, '位置', h('select', { class: 'in', onchange: e => { c.pos = e.target.value; mark(); } }, h('option', { value: 'bottom', selected: c.pos !== 'top' }, '下'), h('option', { value: 'top', selected: c.pos === 'top' }, '上')))))),
      h('button', { class: 'btn', onclick: () => { d.captions.push({ id: slug(), from: now(), to: Math.round((now() + 3) * 10) / 10, text: '', pos: 'bottom' }); d.captions.sort((a, b) => a.from - b.from); mark(); drawPanel(); } }, '＋ テロップを追加（今から3秒）')];
    else if (tab === 'shapes') body = [
      h('p', { class: 'small muted', style: 'margin:0' }, '注目してほしい所に丸・四角・矢印を出します。「位置を決める」を押してから動画の上をタップしてください。'),
      ...d.shapes.map((s, i) => h('div', { class: 'item' + (selShape === i ? ' sel' : ''), onclick: () => { if (selShape !== i) { selShape = i; p.redraw(); panel.querySelectorAll('.item').forEach((el, k) => el.classList.toggle('sel', k === i)); } } },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `${{ circle: '丸', rect: '四角', arrow: '矢印' }[s.type]}${i + 1}`), del(d.shapes, i)),
        h('div', { class: 'grid2' }, tIn(s, 'from', '出す'), tIn(s, 'to', '消す'),
          h('label', { class: 'f' }, '色', h('select', { class: 'in', onchange: e => { s.color = e.target.value; mark(); } }, [['red', '赤'], ['yellow', '黄'], ['white', '白']].map(([k, l]) => h('option', { value: k, selected: s.color === k }, l)))),
          h('label', { class: 'f' }, '大きさ', h('input', { type: 'range', min: '0.05', max: '0.6', step: '0.01', value: s.w, oninput: e => { s.w = +e.target.value; mark(); } })),
          s.type === 'arrow' ? h('label', { class: 'f' }, '向き', h('input', { type: 'range', min: '0', max: '359', step: '1', value: s.ang ?? 135, oninput: e => { s.ang = +e.target.value; mark(); } })) : null),
        h('button', { class: 'btn sm yellow', onclick: e => { e.stopPropagation(); placing = i; selShape = i; v.pause(); catcher.hidden = false; toast('動画の上をタップして位置を決めてください'); } }, '位置を決める'))),
      h('div', { class: 'row' }, [['circle', '＋ 丸'], ['rect', '＋ 四角'], ['arrow', '＋ 矢印']].map(([k, l]) => h('button', { class: 'btn', onclick: () => {
        d.shapes.push({ id: slug(), type: k, from: now(), to: Math.round((now() + 3) * 10) / 10, x: 0.5, y: 0.5, w: k === 'arrow' ? 0.18 : 0.22, ang: 135, color: 'red' });
        selShape = d.shapes.length - 1; mark(); drawPanel(); } }, l)))];
    else if (tab === 'pauses') body = [
      h('p', { class: 'small muted', style: 'margin:0' }, '大事な場面で動画を自動で止め、確認してもらう文を出します。「確認した・続ける」を押すと再生が続きます。'),
      ...d.pauses.map((x, i) => h('div', { class: 'item' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `一時停止${i + 1}`), del(d.pauses, i)),
        h('input', { class: 'in', value: x.text, placeholder: '例：この色になったら火を止める', oninput: e => { x.text = e.target.value; mark(); } }), tIn(x, 't', '止める時刻'))),
      h('button', { class: 'btn', onclick: () => { d.pauses.push({ id: slug(), t: now(), text: '' }); d.pauses.sort((a, b) => a.t - b.t); mark(); drawPanel(); } }, '＋ 今の位置で止める')];
    else if (tab === 'cut') body = [
      h('p', { class: 'small muted', style: 'margin:0' }, '元の動画は残したまま、見せない部分を飛ばします（何度でもやり直せます）。'),
      h('div', { class: 'item' }, h('b', null, '前後を切る'), h('div', { class: 'grid2' }, tIn(d, 'trimStart', 'ここから見せる'), tIn(d, 'trimEnd', 'ここまで見せる'))),
      ...d.cuts.map((c, i) => h('div', { class: 'item' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `途中カット${i + 1}`), del(d.cuts, i)), h('div', { class: 'grid2' }, tIn(c, 'from', 'ここから'), tIn(c, 'to', 'ここまで飛ばす')))),
      h('button', { class: 'btn', onclick: () => { d.cuts.push({ from: now(), to: Math.round((now() + 2) * 10) / 10 }); mark(); drawPanel(); } }, '＋ 途中をカット（今から2秒）'),
      h('label', { class: 'row small', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: raw, onchange: e => { raw = e.target.checked; } }), '編集前の動画で確認する（カット・一時停止を無視）')];
    else if (tab === 'ai') body = aiPanel();
    else body = filePanel();
    panel.replaceChildren(...body);
  }
  function aiPanel() {
    const st = h('div', { class: 'small muted' }), list = h('div', { class: 'stack' });
    const drawProposal = () => {
      if (!proposal) return list.replaceChildren();
      list.replaceChildren(
        h('div', { class: 'item' }, h('b', null, `手順の区切り ${proposal.steps.length}件`), h('ol', { style: 'margin:0;padding-left:1.4em' }, proposal.steps.map(s => h('li', null, `${fmtT(s.t).replace(/\.\d$/, '')}　${s.text}`))),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm yellow', onclick: () => { steps.splice(0, steps.length, ...proposal.steps.map(s => ({ text: s.text, t: s.t }))); mark(); toast('手順を置き換えました'); } }, '手順として使う（置き換え）'),
            steps.length ? h('button', { class: 'btn sm', onclick: () => { proposal.steps.forEach((s, i) => { if (steps[i]) steps[i].t = s.t; }); mark(); toast('時刻だけ反映しました'); } }, '今の手順に時刻だけ入れる') : null)),
        h('div', { class: 'item' }, h('b', null, `テロップ ${proposal.captions.length}件`), h('ul', { style: 'margin:0;padding-left:1.2em' }, proposal.captions.map(c => h('li', null, `${fmtT(c.from).replace(/\.\d$/, '')}〜　${c.text}`))),
          h('button', { class: 'btn sm yellow', onclick: () => { proposal.captions.forEach(c => d.captions.push({ id: slug(), from: c.from, to: c.to, text: c.text, pos: 'bottom' })); d.captions.sort((a, b) => a.from - b.from); mark(); toast('テロップを追加しました'); } }, 'テロップに追加')));
    };
    drawProposal();
    const go = h('button', { class: 'btn primary', disabled: !D().ai || !dur(), onclick: async () => {
      go.disabled = true; st.textContent = '動画から場面を取り出しています…';
      const D_ = dur(), n = 10, times = Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * D_ * 10) / 10);
      const frames = await captureFrames(localSrc || videoUrl(t), times);
      if (frames.every(f => !f)) { st.textContent = 'この動画から場面を取り出せませんでした（共有設定の都合）。動画ファイルのタブで端末の動画を選び直すと使えます。'; go.disabled = false; return; }
      st.textContent = 'AIが手順とテロップを考えています…';
      try {
        const used = times.filter((_, i) => frames[i]);
        const r = await ai(`${CONTEXT}\n作業名：${t.name}（工程：${t.process || ''}）\n今の手順：${steps.map(s => s.text).join(' / ') || 'なし'}\n添付は作業動画から取り出した画像で、順に ${used.map(x => x + '秒').join('、')} の場面です（動画の長さ ${Math.round(D_)}秒）。\n画像から読み取れる作業の流れを手順に分け、各手順が始まる秒数を付けてください。テロップは「何を見て判断するか」が伝わる短い文（20字以内）を3〜6個。\nJSONだけで答える：{"steps":[{"t":秒,"text":"手順（30字以内）"}],"captions":[{"from":秒,"to":秒,"text":"テロップ"}]}`, frames.filter(Boolean));
        proposal = { steps: (r.steps || []).filter(s => s.text).map(s => ({ t: Math.min(D_, Math.max(0, +s.t || 0)), text: String(s.text) })), captions: (r.captions || []).filter(c => c.text).map(c => ({ from: +c.from || 0, to: +c.to || (+c.from || 0) + 3, text: String(c.text) })) };
        st.textContent = 'AIの提案です。使うものを選んでください。'; drawProposal();
      } catch (e) { st.textContent = 'うまくいきませんでした：' + (e.message || e); }
      go.disabled = false;
    } }, '動画から手順とテロップを提案してもらう');
    return [h('p', { class: 'small muted', style: 'margin:0' }, '動画から10場面を取り出してClaudeに見せ、手順の区切りとテロップの案を作ります。そのまま使う前に必ず確認してください。'),
      D().ai ? null : h('div', { class: 'note' }, S.demo ? 'デモではAIは使えません。' : 'AIが設定されていません（GASのスクリプトプロパティ CLAUDE_API_KEY）。'), go, st, list];
  }
  function filePanel() {
    const st = h('div', { class: 'small muted' }), bar = h('div', { class: 'progress', hidden: true }, h('i'));
    const file = h('input', { type: 'file', accept: 'video/*', id: 'video-file' });
    const shrink = h('input', { type: 'checkbox', id: 'shrink', checked: true });
    const go = h('button', { class: 'btn primary', onclick: async () => {
      const f = file.files[0]; if (!f) return toast('動画を選んでください');
      go.disabled = true; bar.hidden = false; const setP = x => bar.firstChild.style.width = (x * 100).toFixed(0) + '%';
      try {
        let blob = f;
        if (shrink.checked && f.size > 60 * 1024 * 1024) { st.textContent = '軽くしています（再生と同じ時間がかかります。画面を閉じないでください）…'; blob = await shrinkVideo(f, setP); }
        if (!blob.type || blob.type === 'video/quicktime') blob = new Blob([blob], { type: 'video/mp4' });
        localSrc = URL.createObjectURL(f);
        const m = await meta(localSrc);
        st.textContent = 'ドライブに保存しています…'; setP(0);
        const fileId = await uploadBlob(blob, `${t.name}_${today()}.${blob.type.includes('webm') ? 'webm' : 'mp4'}`, setP);
        st.textContent = 'サムネイルを作っています…';
        const [thumb] = await captureFrames(localSrc, [Math.min(2, m.duration / 3)]);
        const thumbId = thumb ? await uploadBlob(thumb, `${t.name}_thumb.jpg`) : '';
        const old = t.video || {};
        const nt = clone(t); nt.video = { fileId, thumbId, duration: m.duration, url: '' };
        if (old.fileId && (d.trimEnd || d.cuts.length || d.captions.length)) toast('動画を差し替えたので、時刻の位置を確認してください');
        nt.edit = d; nt.steps = steps.map(s => s.text); nt.stepTimes = steps.map(s => s.t);
        const ok = await putTask(nt);
        if (ok) { if (old.fileId) call('deleteFile', { fileId: old.fileId }).catch(() => {}); if (old.thumbId) call('deleteFile', { fileId: old.thumbId }).catch(() => {}); toast('動画を保存しました'); }
      } catch (e) { st.textContent = e.message === 'shrink_failed' ? 'この端末では軽くできませんでした。チェックを外してそのまま送ってください。' : '保存できませんでした：' + (e.message || e); go.disabled = false; }
    } }, '保存する');
    const url = h('input', { class: 'in', type: 'url', value: t.video?.url || '', placeholder: 'https://…（外部の動画リンク）' });
    return [h('p', { class: 'small muted', style: 'margin:0' }, '撮った動画を会社のGoogleドライブに保存します。スマホならここからそのまま撮影もできます。'),
      h('label', { class: 'f' }, '動画を選ぶ・撮る', file), h('label', { class: 'row small', style: 'gap:6px' }, shrink, '60MBを超える動画は軽くしてから送る（通信量の節約）'),
      go, bar, st,
      h('div', { class: 'item' }, h('b', null, 'または外部のリンクを使う'), url, h('button', { class: 'btn sm', onclick: async () => { const nt = clone(t); nt.video = { ...(t.video || {}), url: url.value.trim() }; if (await putTask(nt)) toast('リンクを保存しました'); } }, 'リンクを保存'))];
  }
  const save = h('button', { class: 'btn primary', onclick: async () => {
    const nt = clone(t);
    const texts = steps.map(s => s.text.trim()).filter(Boolean);
    const changed = texts.join('\n') !== (t.steps || []).join('\n');
    nt.edit = d; nt.steps = steps.filter(s => s.text.trim()).map(s => s.text.trim()); nt.stepTimes = steps.filter(s => s.text.trim()).map(s => s.t);
    if (changed) { nt.version = (t.version || 1) + 1; nt.draft = false; }
    if (await putTask(nt)) { dirty = false; toast(changed ? `保存しました（手順の版を ${nt.version} にしました。翻訳は作り直してください）` : '保存しました'); }
  } }, '保存する');
  window.onbeforeunload = () => dirty ? '未保存' : undefined;
  drawPanel();
  setTimeout(drawTL, 0);
  return h('div', null,
    h('p', { style: 'margin:0 0 8px' }, h('a', { href: '#t-' + t.id, class: 'small muted', onclick: e => { if (dirty && !confirmLeave()) e.preventDefault(); } }, '← 作業ページへ')),
    h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, '動画を編集'), h('h1', null, t.name)), h('div', { class: 'row' }, dirtyEl, save)),
    h('div', { class: 'editor' }, h('div', { class: 'stack' }, p.el, tl), h('div', { class: 'card' }, tabs, panel)));
}
function confirmLeave() { toast('先に「保存する」を押してください'); return false; }

// ---------- 手順書の印刷 ----------
async function printManual(t, lang) {
  toast('手順書を準備しています…');
  const x = tr(t, lang), times = t.stepTimes || [];
  const want = x.steps.map((_, i) => times[i] != null ? times[i] + 1 : null);
  const src = videoUrl(t);
  const frames = src && want.some(w => w != null) ? await captureFrames(src, want.map(w => w ?? 0), 800) : [];
  const pr = document.getElementById('print');
  const qr = h('div');
  pr.replaceChildren(
    h('div', { class: 'pm-h' }, h('div', null, h('div', { style: 'font-size:12px' }, `${t.process || ''}　優先度${t.priority}　手順の版 ${t.version || 1}　${today()}`), h('h1', null, x.name)), h('img', { src: 'icons/cr-logo.png', alt: '' })),
    h('div', { class: 'pm-steps' }, x.steps.map((s, i) => h('div', { class: 'pm-step' }, frames[i] && want[i] != null ? h('img', { src: URL.createObjectURL(frames[i]), alt: '' }) : null, h('p', null, h('b', null, i + 1), s)))),
    x.points.length ? h('div', { class: 'pm-box' }, h('strong', null, '必ず守ること'), h('ul', null, x.points.map(pt => h('li', null, pt)))) : null,
    x.ng ? h('div', { class: 'pm-box' }, h('strong', null, 'よくある失敗・NG'), h('p', { style: 'white-space:pre-wrap;margin:4px 0 0' }, x.ng)) : null,
    h('div', { class: 'pm-box', style: 'display:flex;gap:14px;align-items:center' }, qr, h('div', null, h('strong', null, '動画で見る'), h('p', { style: 'margin:4px 0 0' }, 'スマホのカメラでQRを読み取ると、この作業の動画が開きます。'))));
  try { new QRCode(qr, { text: APP_URL + '#t-' + t.id, width: 96, height: 96 }); } catch (e) {}
  setTimeout(() => window.print(), 400);
}

// ---------- 星取表 ----------
function viewMap() {
  const staff = activeStaff(), tasks = tasksSorted();
  const head = h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'そだつ'), h('h1', null, '星取表'), h('p', { class: 'small muted' }, can('leader') ? 'マスを押すと認定を記録できます。各作業にL3以上が2人いる状態を目指します。' : '各作業にL3以上が2人いる状態を目指します。')),
    can('leader') ? h('button', { class: 'btn primary', onclick: () => openCert({}) }, '認定を記録') : null);
  if (!staff.length) return h('div', null, head, h('div', { class: 'empty' }, can('admin') ? '設定 → スタッフ から登録すると、ここに星取表ができます。' : 'スタッフが登録されると、ここに星取表ができます。'));
  const rank = r => ({ 工場長: 0, 指導者: 1 }[r] ?? 2);
  const rows = [...staff].sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name, 'ja'));
  const cell = (s, t) => {
    const l = levelOf(s.id, t.id), ps = planState(s.id, t.id), p = planItem(s.id, t.id), rc = needsRecheck(s.id, t.id);
    const ring = ps && ps !== 'done' ? `box-shadow:inset 0 0 0 2px ${ps === 'late' ? 'var(--bad)' : 'var(--yellow)'};border-radius:99px` : '';
    const tip = `${s.name}／${t.name}：${LV[l]}${rc ? '（要再確認）' : ''}${p?.target && ps !== 'done' ? `　目標 L${p.target}${p.due ? ' ' + p.due + 'まで' : ''}` : ''}`;
    return h('td', null, h('button', { title: tip, 'aria-label': tip, disabled: !can('leader'), onclick: () => openCert({ staffId: s.id, taskId: t.id }), style: ring }, star(l), rc ? h('span', { class: 'recheck' }) : null));
  };
  return h('div', null, head,
    h('div', { class: 'mapwrap' }, h('table', { class: 'map num' },
      h('thead', null, h('tr', null, h('th', { class: 'who' }, 'スタッフ'), tasks.map(t => h('th', { scope: 'col' }, h('div', null, h('span', { class: 'pri ' + t.priority }, t.priority)), h('a', { href: '#t-' + t.id, style: 'text-decoration:none' }, t.short || t.name))), h('th', null, 'L3以上'))),
      h('tbody', null, rows.map(s => h('tr', null, h('th', { class: 'who', scope: 'row' }, h('a', { href: '#p-' + s.id }, s.name), h('div', { class: 'small muted' }, [s.role, s.kind].filter(Boolean).join('・'))),
        tasks.map(t => cell(s, t)), h('td', null, String(tasks.filter(t => levelOf(s.id, t.id) >= 3).length))))),
      h('tfoot', null, h('tr', null, h('th', { class: 'who' }, 'L3以上の人数'), tasks.map(t => { const n = l3count(t.id); return h('td', { class: n < 2 ? 'risk' : '' }, String(n)); }), h('td', null, ''))))),
    h('div', { class: 'legend' }, [1, 2, 3, 4].map(l => h('span', null, star(l, 18), LV[l])),
      h('span', null, h('span', { style: 'width:16px;height:16px;border-radius:99px;box-shadow:inset 0 0 0 2px var(--yellow);display:inline-block' }), '育成目標あり'),
      h('span', null, h('span', { style: 'width:16px;height:16px;border-radius:99px;box-shadow:inset 0 0 0 2px var(--bad);display:inline-block' }), '目標の期限切れ'),
      h('span', null, h('span', { style: 'width:10px;height:10px;border-radius:99px;background:var(--warn);display:inline-block' }), '改訂後の再確認が必要'),
      h('span', null, h('span', { class: 'chip bad' }, '赤'), 'L3以上が2人未満＝属人化')));
}

// ---------- 育成計画 ----------
function planProgress(sid) {
  const items = Object.entries(D().plans?.[sid]?.items || {}).filter(([tid, p]) => p.target && taskById(tid));
  const done = items.filter(([tid]) => planState(sid, tid) === 'done').length, late = items.filter(([tid]) => planState(sid, tid) === 'late').length;
  return { total: items.length, done, late };
}
function viewPlan() {
  const staff = activeStaff();
  const head = h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'そだつ'), h('h1', null, '育成計画'), h('p', { class: 'small muted' }, '一人ずつ「いつまでに、どの作業を、どのレベルに」を決めます。新人は標準プランから始めると早いです。')));
  if (!staff.length) return h('div', null, head, h('div', { class: 'empty' }, 'スタッフが登録されると使えます。'));
  return h('div', null, head, h('div', { class: 'people' }, staff.map(s => {
    const pg = planProgress(s.id), l3 = tasksSorted().filter(t => levelOf(s.id, t.id) >= 3).length;
    return h('a', { class: 'card person', href: '#p-' + s.id },
      h('div', { class: 'row' }, h('span', { class: 'avatar' }, s.name.slice(0, 1)), h('div', null, h('b', null, s.name), h('div', { class: 'small muted' }, [s.role, s.kind, s.joined ? `入社 ${s.joined}` : ''].filter(Boolean).join('・')))),
      pg.total ? h('div', null, h('div', { class: 'row small', style: 'justify-content:space-between' }, h('span', null, `育成目標 ${pg.done}/${pg.total} 達成`), pg.late ? h('span', { class: 'chip bad' }, `期限切れ ${pg.late}`) : null),
        h('div', { class: 'prog' }, h('i', { style: `width:${pg.done / pg.total * 100}%` }))) : h('span', { class: 'small muted' }, '育成目標はまだありません'),
      h('span', { class: 'small muted' }, `L3以上の作業 ${l3}`));
  })));
}
function viewPerson(sid) {
  const s = staffById(sid);
  if (!s) return h('div', { class: 'empty' }, 'このスタッフは見つかりませんでした。');
  const tasks = tasksSorted();
  S.planDraft = S.planDraft || {}; S.planDirty = S.planDirty || {};
  if (!S.planDirty[sid]) S.planDraft[sid] = clone(D().plans?.[sid]?.items || {});
  const items = S.planDraft[sid];
  const saveBtn = h('button', { class: 'btn primary', disabled: !S.planDirty[sid], onclick: async () => {
    S.planDirty[sid] = false;
    if (await write('savePlan', { staffId: sid, items }, j => { D().plans[sid] = j.plan; })) toast('育成計画を保存しました'); else S.planDirty[sid] = true;
  } }, '計画を保存');
  const mark = () => { S.planDirty[sid] = true; saveBtn.disabled = false; };
  S.hold = () => !!S.planDirty[sid];
  const rowsEl = tasks.map(t => {
    const it = items[t.id] = items[t.id] || { target: 0, due: '' }, l = levelOf(sid, t.id), st = planState(sid, t.id);
    const chip = !it.target ? null : l >= it.target ? h('span', { class: 'chip good' }, '達成') : st === 'late' ? h('span', { class: 'chip bad' }, '期限切れ') : st === 'soon' ? h('span', { class: 'chip warn' }, 'もうすぐ') : h('span', { class: 'chip' }, '予定');
    return h('tr', null, h('td', null, h('span', { class: 'pri ' + t.priority }, t.priority), ' ', h('a', { href: '#t-' + t.id }, t.name)),
      h('td', null, h('span', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, star(l, 20), LV[l].split(' ')[0], needsRecheck(sid, t.id) ? h('span', { class: 'chip warn' }, '要再確認') : null)),
      h('td', null, can('leader') ? h('select', { class: 'in', style: 'width:auto', onchange: e => { it.target = +e.target.value; mark(); } }, [0, 1, 2, 3, 4].map(v => h('option', { value: v, selected: +it.target === v }, v ? 'L' + v : '－'))) : (it.target ? 'L' + it.target : '－')),
      h('td', null, can('leader') ? h('input', { class: 'in', type: 'date', style: 'width:auto', value: it.due || '', onchange: e => { it.due = e.target.value; mark(); } }) : (it.due || '')),
      h('td', null, chip));
  });
  const standard = () => {
    const base = s.joined && s.joined > addDays(today(), -60) ? s.joined : today();
    tasks.forEach(t => {
      const it = items[t.id] = items[t.id] || {};
      if (t.id === 'hygiene' || /入室|身だしなみ|衛生/.test(t.name)) { it.target = 3; it.due = addDays(base, 7); }
      else if (t.priority === 'A') { it.target = 2; it.due = addDays(base, 45); }
      else if (t.priority === 'B') { it.target = 1; it.due = addDays(base, 30); }
    });
    mark(); render();
  };
  const hist = D().records.filter(r => r.staffId === sid).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const tms = D().timings.filter(m => m.staffId === sid).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return h('div', null,
    h('p', { style: 'margin:0 0 8px' }, h('a', { href: '#plan', class: 'small muted' }, '← 育成計画')),
    h('div', { class: 'page-h' }, h('div', { class: 'row' }, h('span', { class: 'avatar', style: 'width:52px;height:52px;font-size:22px' }, s.name.slice(0, 1)),
      h('div', null, h('h1', null, s.name), h('div', { class: 'small muted' }, [s.role, s.kind, LANGS[s.lang], s.joined ? `入社 ${s.joined}` : ''].filter(Boolean).join('・')))),
      can('leader') ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: standard }, '標準プランを当てる'), saveBtn) : null),
    h('div', { class: 'section-h' }, h('h2', null, '作業ごとの目標'), h('span', { class: 'small muted' }, '標準：入室L3を1週間、A作業L2を45日、B作業L1を30日')),
    h('div', { class: 'tablewrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['作業', '今', '目標', '期限', ''].map(c => h('th', null, c)))), h('tbody', null, rowsEl))),
    h('div', { class: 'home-grid', style: 'margin-top:22px' },
      h('section', null, h('div', { class: 'section-h' }, h('h2', null, 'これまでの記録')), recentRecords(30, r => r.staffId === sid)),
      h('section', null, h('div', { class: 'section-h' }, h('h2', null, '作業時間の計測')),
        tms.length ? h('div', { class: 'todo' }, tms.slice(0, 10).map(m => h('a', { href: '#analysis', onclick: () => { S.ui.anTask = m.taskId; } }, h('span', { class: 'dot y' }), h('span', null, h('b', null, `${m.taskName}　${fmtSec(m.total)}`), h('span', { class: 'small muted' }, m.date)))))
          : h('div', { class: 'empty' }, 'まだ計測していません。'))));
}

// ---------- 作業分析 ----------
function viewAnalysis() {
  const tasks = tasksSorted();
  if (!S.ui.anTask || !taskById(S.ui.anTask)) S.ui.anTask = (D().timings.slice(-1)[0] || {}).taskId || tasks[0]?.id || '';
  const t = taskById(S.ui.anTask);
  const sel = h('select', { class: 'in', style: 'width:auto', onchange: e => { S.ui.anTask = e.target.value; render(); } }, tasks.map(x => h('option', { value: x.id, selected: x.id === S.ui.anTask }, `${x.priority} ${x.name}（${D().timings.filter(m => m.taskId === x.id).length}回）`)));
  const head = h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'みなおす'), h('h1', null, '作業分析'), h('p', { class: 'small muted' }, 'ベテランと新人の作業時間を手順ごとに比べ、差が大きい手順を見つけます。')),
    h('div', { class: 'row' }, sel, can('leader') && t ? h('button', { class: 'btn primary', onclick: () => openMeasure(t) }, '計測する') : null));
  if (!t) return h('div', null, head, h('div', { class: 'empty' }, '作業がありません。'));
  const ms = D().timings.filter(m => m.taskId === t.id);
  if (!ms.length) return h('div', null, head, h('div', { class: 'empty' }, can('leader') ? '「計測する」を押して、作業する人の横でストップウォッチのように手順ごとにボタンを押してください。' : 'まだ計測がありません。'));
  const latest = {}; ms.forEach(m => { if (!latest[m.staffId] || (m.at || '') > (latest[m.staffId].at || '')) latest[m.staffId] = m; });
  const people = Object.values(latest).sort((a, b) => a.total - b.total).slice(0, 8);
  const vet = m => (m.level ?? levelOf(m.staffId, t.id)) >= 3;
  const names = (t.steps || []).length ? t.steps : people[0].steps.map((_, i) => `手順${i + 1}`);
  const maxT = Math.max(...people.map(m => m.total)), stepMax = i => Math.max(...people.map(m => m.steps[i] || 0));
  const spread = names.map((_, i) => { const xs = people.map(m => m.steps[i]).filter(x => x > 0); return xs.length > 1 ? Math.max(...xs) / Math.min(...xs) : 1; });
  const worst = spread.indexOf(Math.max(...spread));
  const brow = (m, val, max) => h('div', { class: 'brow num' }, h('span', { class: 'who' }, m.staffName), h('div', { class: 'btrack' }, h('i', { class: vet(m) ? 'vet' : '', style: `width:${max ? val / max * 100 : 0}%` })), h('span', { class: 'sec' }, fmtSec(val || 0)));
  return h('div', null, head,
    h('div', { class: 'home-grid' },
      h('section', { class: 'card stack' }, h('h2', null, '合計時間'),
        h('p', { class: 'small muted', style: 'margin:0' }, '黒＝L3以上（ベテラン）、黄＝それ以外。各人の最新の計測です。'),
        h('div', { class: 'bars' }, people.map(m => brow(m, m.total, maxT))),
        spread[worst] > 1.3 ? h('div', { class: 'note' }, h('b', null, `差が一番大きい手順：${worst + 1}. ${names[worst]}`), h('span', null, `最速と最遅で${spread[worst].toFixed(1)}倍。ベテランのやり方を動画のテロップや一時停止で伝えましょう。`)) : null),
      h('section', { class: 'card stack' }, h('h2', null, '手順ごと'),
        h('div', { class: 'bars' }, names.map((n, i) => h('div', { class: 'bstep' }, h('div', { class: 'bstep-h' }, h('span', null, `${i + 1}. ${n}`), i === worst && spread[i] > 1.3 ? h('span', { class: 'chip bad' }, `差 ${spread[i].toFixed(1)}倍`) : null),
          people.map(m => brow(m, m.steps[i] || 0, stepMax(i)))))))));
}
function openMeasure(t) {
  openDialog((box, close) => {
    const names = (t.steps || []).length ? t.steps : ['作業'];
    const sS = staffSelect('m-staff', null, '作業する人を選ぶ');
    const big = h('div', { class: 'big num' }, '0:00.0'), nowEl = h('div', { class: 'now' }, '「スタート」で計測を始めます'), list = h('div', { class: 'small muted' });
    let t0 = 0, last = 0, laps = [], timer = 0, i = 0;
    const btn = h('button', { class: 'btn yellow', onclick: () => {
      if (!sS.value) return toast('作業する人を選んでください');
      const n = performance.now();
      if (!t0) { t0 = last = n; sS.disabled = true; timer = setInterval(() => { big.textContent = fmtT((performance.now() - t0) / 1000); }, 100); }
      else { laps.push(Math.round((n - last) / 100) / 10); last = n; i++; }
      if (i >= names.length) { clearInterval(timer); finish(); return; }
      nowEl.textContent = `${i + 1}/${names.length}　${names[i]}`;
      btn.textContent = i === names.length - 1 ? '終わった' : 'この手順が終わった';
      list.textContent = laps.map((x, k) => `${k + 1}: ${x}秒`).join('　');
    } }, 'スタート');
    const finish = () => {
      const total = Math.round(laps.reduce((a, b) => a + b, 0) * 10) / 10, st = staffById(sS.value);
      nowEl.textContent = `合計 ${fmtSec(total)}`; list.textContent = laps.map((x, k) => `${k + 1}: ${x}秒`).join('　');
      btn.replaceWith(h('div', { class: 'row', style: 'justify-content:center' },
        h('button', { class: 'btn primary', onclick: async () => {
          const r = await write('addTiming', { timing: { date: today(), taskId: t.id, taskName: t.name, staffId: st.id, staffName: st.name, steps: laps, total, level: levelOf(st.id, t.id), taskVersion: t.version || 1 } }, j => D().timings.push(j.timing));
          if (r) { toast('記録しました'); close(); }
        } }, '記録する'), h('button', { class: 'btn ghost', onclick: close }, '記録しない')));
    };
    box.append(h('h2', null, '作業時間を計測：' + t.name), h('label', { class: 'f' }, '作業する人', sS),
      h('div', { class: 'stopwatch' }, big, nowEl, btn, list), h('button', { class: 'btn ghost', onclick: () => { clearInterval(timer); close(); } }, 'やめる'));
  });
}

// ---------- 教育記録 ----------
function viewRecords() {
  const months = [...new Set(D().records.map(r => (r.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  if (!S.ui.recMonth) S.ui.recMonth = months[0] || today().slice(0, 7);
  const recs = D().records.filter(r => (r.date || '').startsWith(S.ui.recMonth)).sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
  const sel = h('select', { class: 'in', style: 'width:auto', onchange: e => { S.ui.recMonth = e.target.value; render(); } }, (months.length ? months : [S.ui.recMonth]).map(m => h('option', { value: m, selected: m === S.ui.recMonth }, m.replace('-', '年') + '月')));
  const csv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['日付', '区分', '氏名', '作業', '結果', '点数', '判定者', 'メモ', '手順の版'].map(esc).join(',')];
    recs.forEach(r => lines.push([r.date, r.kind === 'test' ? '確認テスト' : '認定', r.staffName, r.taskName, r.kind === 'test' ? (r.pass ? '合格' : '不合格') : LV[r.level], r.kind === 'test' ? `${r.score}/${r.total}` : '', r.judgeName, r.note, r.taskVersion].map(esc).join(',')));
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })), download: `教育記録_${S.ui.recMonth}.csv` }); document.body.append(a); a.click(); a.remove();
  };
  return h('div', null,
    h('div', { class: 'page-h' }, h('div', null, h('div', { class: 'eyebrow' }, 'HACCP 教育訓練記録'), h('h1', null, '教育記録'), h('p', { class: 'small muted' }, 'テストと認定はここに自動で残ります。会社のスプレッドシート「教育記録」シートにも同じものがあります。')),
      h('div', { class: 'row' }, sel, h('button', { class: 'btn', onclick: csv, disabled: !recs.length }, 'CSVで保存'))),
    recs.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'tbl num' },
      h('thead', null, h('tr', null, ['日付', '区分', '氏名', '作業', '結果', '判定者', 'メモ'].map(c => h('th', null, c)))),
      h('tbody', null, recs.map(r => h('tr', null, h('td', null, r.date), h('td', null, r.kind === 'test' ? '確認テスト' : '認定'), h('td', null, h('a', { href: '#p-' + r.staffId }, staffById(r.staffId)?.name || r.staffName)), h('td', null, taskById(r.taskId)?.name || r.taskName),
        h('td', null, r.kind === 'test' ? h('span', { class: 'chip ' + (r.pass ? 'good' : 'bad') }, `${r.pass ? '合格' : '不合格'} ${r.score}/${r.total}`) : LV[r.level]), h('td', null, r.judgeName || ''), h('td', { class: 'wrap' }, r.note || ''))))))
      : h('div', { class: 'empty' }, 'この月の記録はまだありません。'));
}

// ---------- その他（スマホ用） ----------
function viewMore() {
  const items = [['analysis', '作業分析', '手順ごとの作業時間を比べる', 'chart'], ['records', '教育記録', 'HACCPの教育訓練記録・CSV', 'list'], ['admin', '設定', 'スタッフ・作業・QR・接続', 'gear']];
  return h('div', null, h('div', { class: 'page-h' }, h('h1', null, 'その他')),
    h('div', { class: 'todo' }, items.map(([k, l, s]) => h('a', { href: '#' + k }, h('span', { class: 'dot y' }), h('span', null, h('b', null, l), h('span', { class: 'small muted' }, s))))),
    h('p', { class: 'small muted', style: 'margin-top:20px' }, 'ホーム画面に追加すると、アプリのように全画面で開けます（iPhone：共有 →「ホーム画面に追加」）。'));
}

// ---------- 設定 ----------
function viewAdmin() {
  const tabs = [['staff', 'スタッフ'], ['tasks', '作業の内容'], ['qr', 'QRコード'], ['conn', '接続']];
  const allowed = can('admin');
  const t = S.ui.adminTab;
  const body = !allowed && t !== 'conn' ? h('div', { class: 'empty' }, '管理者の鍵で開いたときに使えます。') : t === 'staff' ? adminStaff() : t === 'tasks' ? adminTasks() : t === 'qr' ? adminQr() : adminConn();
  return h('div', null, h('div', { class: 'page-h' }, h('h1', null, '設定')),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': t === k ? 'true' : 'false', onclick: () => { S.ui.adminTab = k; render(); } }, l))), body);
}
function adminStaff() {
  const form = s => {
    const e = {
      name: h('input', { class: 'in', id: 'st-name', value: s?.name || '', placeholder: '例：山田 花子' }),
      kind: h('select', { class: 'in', id: 'st-kind' }, KINDS.map(k => h('option', { selected: s?.kind === k }, k))),
      role: h('select', { class: 'in', id: 'st-role' }, ROLES.map(k => h('option', { selected: (s?.role || '作業者') === k }, k))),
      lang: h('select', { class: 'in', id: 'st-lang' }, Object.entries(LANGS).map(([k, v]) => h('option', { value: k, selected: (s?.lang || 'ja') === k }, v))),
      joined: h('input', { class: 'in', id: 'st-joined', type: 'date', value: s?.joined || '' })
    };
    return { e, node: h('div', { class: 'grid2' }, h('label', { class: 'f' }, '氏名', e.name), h('label', { class: 'f' }, '雇用区分', e.kind), h('label', { class: 'f' }, '役割', e.role), h('label', { class: 'f' }, 'テスト・字幕の言語', e.lang), h('label', { class: 'f' }, '入社日', e.joined)) };
  };
  const val = e => ({ name: e.name.value.trim(), kind: e.kind.value, role: e.role.value, lang: e.lang.value, joined: e.joined.value });
  const nf = form(null);
  const all = [...D().staff].sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name, 'ja'));
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' }, h('h2', null, 'スタッフを追加'), nf.node, h('div', null, h('button', { class: 'btn primary', onclick: async () => {
      const x = val(nf.e); if (!x.name) return toast('氏名を入れてください');
      if (await write('saveStaff', { staff: { ...x, active: true } }, j => D().staff.push(j.staff))) toast('追加しました');
    } }, '追加する'))),
    h('h2', null, `登録済み（在籍 ${all.filter(s => s.active !== false).length}人）`),
    all.length ? h('div', { class: 'todo' }, all.map(s => h('a', { href: '#', onclick: e => { e.preventDefault(); openDialog((box, close) => {
      const f = form(s), act = h('input', { type: 'checkbox', checked: s.active !== false });
      box.append(h('h2', null, 'スタッフを編集'), f.node, h('label', { class: 'row small' }, act, '在籍している（外すと星取表から消えます。記録は残ります）'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => {
          const x = val(f.e); if (!x.name) return toast('氏名を入れてください');
          if (await write('saveStaff', { staff: { ...s, ...x, active: act.checked } }, j => { const i = D().staff.findIndex(z => z.id === s.id); D().staff[i] = j.staff; })) { toast('保存しました'); close(); }
        } }, '保存する'), h('button', { class: 'btn ghost', onclick: close }, 'やめる')));
    }); } }, h('span', { class: 'avatar', style: 'width:32px;height:32px;font-size:14px' }, s.name.slice(0, 1)),
      h('span', null, h('b', null, s.name, s.active === false ? '（退職）' : ''), h('span', { class: 'small muted' }, [s.role, s.kind, LANGS[s.lang], s.joined ? `入社 ${s.joined}` : ''].filter(Boolean).join('・'))))))
      : h('div', { class: 'empty' }, 'まだ誰も登録されていません。'));
}
function adminTasks() {
  const pick = h('select', { class: 'in', style: 'max-width:420px', onchange: e => { S.ui.editTask = e.target.value; render(); } },
    h('option', { value: '' }, '作業を選ぶ'), tasksSorted().map(t => h('option', { value: t.id, selected: S.ui.editTask === t.id }, `${t.priority} ${t.name}`)), h('option', { value: '__new', selected: S.ui.editTask === '__new' }, '＋ 新しい作業を追加'));
  const wrap = h('div', { class: 'stack' }, h('label', { class: 'f' }, '編集する作業', pick));
  if (!S.ui.editTask) { wrap.append(h('p', { class: 'muted' }, '作業を選ぶと、手順・守ること・確認テスト・翻訳を編集できます。動画の編集は作業ページの「動画を編集」から。')); return wrap; }
  const isNew = S.ui.editTask === '__new';
  const t = isNew ? { id: 't' + slug(), name: '', short: '', process: '', priority: 'B', steps: [], stepTimes: [], points: ['', '', ''], ng: '', quiz: [], order: (D().tasks.length + 1) * 10, version: 1, edit: {}, i18n: {}, video: {} } : clone(taskById(S.ui.editTask));
  if (!t) return wrap;
  S.hold = () => true;
  const name = h('input', { class: 'in', id: 'tk-name', value: t.name }), short = h('input', { class: 'in', id: 'tk-short', value: t.short || '', placeholder: '星取表の見出し（6文字くらい）' });
  const proc = h('input', { class: 'in', id: 'tk-proc', value: t.process || '' }), pri = h('select', { class: 'in', id: 'tk-pri' }, ['A', 'B', 'C'].map(p => h('option', { selected: t.priority === p }, p)));
  const steps = h('textarea', { class: 'in', id: 'tk-steps', value: (t.steps || []).join('\n') });
  const pts = [0, 1, 2].map(i => h('input', { class: 'in', id: 'tk-pt' + i, value: (t.points || [])[i] || '' }));
  const ng = h('textarea', { class: 'in', id: 'tk-ng', value: t.ng || '' });
  const quiz = (t.quiz || []).map(q => ({ ...q, choices: [...q.choices] }));
  const qWrap = h('div', { class: 'stack' });
  const drawQuiz = () => {
    qWrap.replaceChildren(...quiz.map((q, i) => h('div', { class: 'item' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, `問${i + 1}`), h('button', { class: 'btn sm danger', onclick: () => { quiz.splice(i, 1); drawQuiz(); } }, '消す')),
      h('input', { class: 'in', value: q.q, placeholder: '問題文', oninput: e => q.q = e.target.value }),
      [0, 1, 2].map(j => h('label', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' }, h('input', { type: 'radio', name: 'ans' + i, checked: +q.answer === j, onchange: () => q.answer = j, 'aria-label': '正解' }),
        h('input', { class: 'in', value: q.choices[j] || '', placeholder: `選択肢${j + 1}`, oninput: e => q.choices[j] = e.target.value }))),
      h('input', { class: 'in', value: q.why || '', placeholder: '間違えたときの解説', oninput: e => q.why = e.target.value }))),
      quiz.length < 5 ? h('button', { class: 'btn', onclick: () => { quiz.push({ q: '', choices: ['', '', ''], answer: 0, why: '' }); drawQuiz(); } }, '＋ 問題を追加（5問まで）') : '');
  };
  drawQuiz();
  const aiSt = h('div', { class: 'small muted' });
  const fill = r => {
    if (r.name && !name.value) name.value = r.name;
    if (Array.isArray(r.steps) && r.steps.length) steps.value = r.steps.join('\n');
    if (Array.isArray(r.points)) pts.forEach((p, i) => p.value = r.points[i] || p.value);
    if (r.ng) ng.value = r.ng;
    if (Array.isArray(r.quiz) && r.quiz.length) { quiz.splice(0, quiz.length, ...r.quiz.slice(0, 5).map(q => ({ q: q.q, choices: (q.choices || []).slice(0, 3), answer: +q.answer || 0, why: q.why || '' }))); drawQuiz(); }
  };
  const paper = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'paper' });
  const aiPaper = h('button', { class: 'btn', disabled: !D().ai, onclick: async () => {
    if (!paper.files.length) return toast('紙の手順書の写真を選んでください');
    aiPaper.disabled = true; aiSt.textContent = '写真を読んでいます…';
    try { fill(await ai(`${CONTEXT}\n添付は紙の作業手順書（または現場の掲示）の写真です。書かれている内容だけを使って、作業マニュアルの下書きを作ってください。\nJSONだけで答える：{"name":"作業名","steps":["手順（30字以内）"],"points":["必ず守ること（3つまで）"],"ng":"よくある失敗","quiz":[{"q":"問題","choices":["選択肢1","選択肢2","選択肢3"],"answer":正解の番号0〜2,"why":"解説"}]}（quizは3問）`, [...paper.files].slice(0, 6))); aiSt.textContent = '下書きを入れました。内容を確認して保存してください。'; }
    catch (e) { aiSt.textContent = 'うまくいきませんでした：' + (e.message || e); }
    aiPaper.disabled = false;
  } }, '写真から下書きを作る');
  const aiQuiz = h('button', { class: 'btn', disabled: !D().ai, onclick: async () => {
    aiQuiz.disabled = true; aiSt.textContent = 'テストを考えています…';
    try { const r = await ai(`${CONTEXT}\n次の作業マニュアルから、動画と手順を見れば答えられる確認テストを3〜5問作ってください。ひっかけ問題は避け、安全・品質・衛生に関わる判断を優先。\n作業名：${name.value}\n手順：${steps.value}\n守ること：${pts.map(p => p.value).join(' / ')}\nNG：${ng.value}\nJSONだけで答える：{"quiz":[{"q":"問題","choices":["選択肢1","選択肢2","選択肢3"],"answer":0〜2,"why":"解説"}]}`); fill({ quiz: r.quiz }); aiSt.textContent = 'テストを入れました。確認して保存してください。'; }
    catch (e) { aiSt.textContent = 'うまくいきませんでした：' + (e.message || e); }
    aiQuiz.disabled = false;
  } }, '手順からテストを作る');
  const save = h('button', { class: 'btn primary', onclick: async () => {
    if (!name.value.trim()) return toast('作業名を入れてください');
    const bad = quiz.findIndex(q => !q.q.trim() || q.choices.some(c => !String(c).trim()));
    if (bad >= 0) return toast(`問${bad + 1}の問題文か選択肢が空です`);
    const newSteps = steps.value.split('\n').map(s => s.trim()).filter(Boolean);
    const changed = !isNew && (newSteps.join('\n') !== (t.steps || []).join('\n') || pts.map(p => p.value.trim()).join('|') !== (t.points || []).join('|'));
    const old = t.steps || [], times = t.stepTimes || [];
    const nt = { ...t, name: name.value.trim(), short: short.value.trim(), process: proc.value.trim(), priority: pri.value, steps: newSteps,
      stepTimes: newSteps.map(s => { const i = old.indexOf(s); return i >= 0 ? times[i] ?? null : null; }), points: pts.map(p => p.value.trim()), ng: ng.value.trim(), quiz, version: (t.version || 1) + (changed ? 1 : 0), draft: changed ? false : t.draft };
    if (await putTask(nt)) { toast(changed ? `保存しました（手順の版 ${nt.version}。認定済みの人は再確認になります）` : '保存しました'); S.ui.editTask = nt.id; render(); }
  } }, '内容を保存');
  wrap.append(
    !isNew ? h('div', { class: 'row' }, h('a', { class: 'btn yellow', href: '#e-' + t.id }, '動画を編集する'), h('a', { class: 'btn ghost', href: '#t-' + t.id }, '作業ページを見る')) : null,
    h('div', { class: 'card stack' }, h('h2', null, 'AIで下書き'), h('p', { class: 'small muted', style: 'margin:0' }, '紙の手順書を撮った写真から、手順・守ること・テストの下書きを作れます。入るのは画面の欄だけで、保存するまで反映されません。'),
      D().ai ? null : h('div', { class: 'note' }, S.demo ? 'デモではAIは使えません。' : 'AIが設定されていません（GASのスクリプトプロパティ CLAUDE_API_KEY）。'),
      h('label', { class: 'f' }, '手順書の写真（6枚まで）', paper), h('div', { class: 'row' }, aiPaper, aiQuiz), aiSt),
    h('div', { class: 'card stack' }, h('h2', null, '作業の内容'),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, '作業名', name), h('label', { class: 'f' }, '短い名前', short), h('label', { class: 'f' }, '工程', proc), h('label', { class: 'f' }, '優先度', pri)),
      h('label', { class: 'f' }, '手順（1行に1つ。動画の区切り時刻は「動画を編集」で）', steps), h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'small muted' }, '必ず守ること（3つまで）'), pts),
      h('label', { class: 'f' }, 'よくある失敗・NG', ng)),
    h('div', { class: 'card stack' }, h('h2', null, '確認テスト'), h('p', { class: 'small muted', style: 'margin:0' }, '全問正解でL1になります。'), qWrap),
    h('div', { class: 'row' }, save, !isNew ? h('button', { class: 'btn danger', onclick: e => {
      const bar = h('div', { class: 'note bad' }, `「${t.name}」を削除します。星取表のこの列も消えます（教育記録は残ります）。`, h('button', { class: 'btn sm danger', onclick: async () => {
        if (await write('deleteTask', { id: t.id }, () => { D().tasks = D().tasks.filter(x => x.id !== t.id); })) { if (t.video?.fileId) call('deleteFile', { fileId: t.video.fileId }).catch(() => {}); S.ui.editTask = ''; toast('削除しました'); }
      } }, '削除する'), h('button', { class: 'btn sm ghost', onclick: () => bar.remove() }, 'やめる'));
      e.target.closest('.row').after(bar);
    } }, 'この作業を削除') : null),
    !isNew ? translateCard(t) : null);
  return wrap;
}
function translateCard(t) {
  const st = h('div', { class: 'small muted' });
  const sel = h('select', { class: 'in', style: 'width:auto', id: 'tr-lang' }, Object.entries(LANGS).filter(([k]) => k !== 'ja').map(([k, v]) => h('option', { value: k }, v)));
  const have = Object.entries(t.i18n || {});
  const go = h('button', { class: 'btn', disabled: !D().ai, onclick: async () => {
    go.disabled = true; st.textContent = '翻訳しています…';
    const e = t.edit || {}, src = { name: t.name, steps: t.steps || [], points: (t.points || []).filter(Boolean), ng: t.ng || '', quiz: (t.quiz || []).map(q => ({ q: q.q, choices: q.choices, why: q.why || '' })), captions: (e.captions || []).map(c => c.text), pauses: (e.pauses || []).map(p => p.text) };
    try {
      const out = await ai(`Translate these Japanese food-factory work instructions into ${LANGS[sel.value]} (${sel.value}) for factory workers with basic reading skills. Short plain sentences. Keep numbers, temperatures, times and units exactly. Keep 「すりだね」 as is with a short gloss in parentheses the first time. Return ONLY JSON with exactly the same keys, shape and array lengths as the input, every string translated, quiz choice order unchanged.\n\nINPUT:\n${JSON.stringify(src)}`);
      if (!Array.isArray(out.steps) || (out.quiz || []).length !== src.quiz.length) throw new Error('形式が合いませんでした');
      const nt = clone(taskById(t.id)); nt.i18n = { ...(nt.i18n || {}), [sel.value]: { ...out, version: nt.version || 1 } };
      if (await putTask(nt)) toast(`${LANGS[sel.value]}を保存しました`);
    } catch (e2) { st.textContent = '翻訳できませんでした：' + (e2.message || e2); }
    go.disabled = false;
  } }, '翻訳して保存');
  return h('div', { class: 'card stack' }, h('h2', null, '外国語の手順・テスト・テロップ'),
    h('p', { class: 'small muted', style: 'margin:0' }, 'Claudeが翻訳します。スタッフの言語に合わせてテストが切り替わり、作業ページでも言語を選べます。訳は現場で一度確認してください。'),
    have.length ? h('div', { class: 'chips' }, have.map(([k, v]) => h('span', { class: 'chip ' + ((v.version || 1) < (t.version || 1) ? 'warn' : 'good') }, LANGS[k] + ((v.version || 1) < (t.version || 1) ? '（古い）' : '')))) : null,
    h('div', { class: 'row' }, sel, go), st);
}
function adminQr() {
  const grid = h('div', { class: 'qrgrid' }), tasks = [...D().tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  tasks.forEach(t => { const c = h('div'); grid.append(h('div', { class: 'qr' }, c, h('div', { class: 'qn' }, t.name), h('div', { class: 'qp' }, t.process || ''))); try { new QRCode(c, { text: APP_URL + '#t-' + t.id, width: 140, height: 140 }); } catch (e) { c.textContent = 'QRを作れませんでした'; } });
  const print = () => {
    const pr = document.getElementById('print');
    pr.replaceChildren(h('div', { class: 'pm-h' }, h('h1', null, '作業動画 QRコード'), h('img', { src: 'icons/cr-logo.png', alt: '' })), h('div', { class: 'pm-qr' }, [...grid.children].map(n => n.cloneNode(true))));
    setTimeout(() => window.print(), 200);
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted', style: 'margin:0' }, '作業場所に貼るQRです。読み取るとその作業の動画が開きます（鍵は入っていません。はじめて使う人は、先に配布用の「はじめにQR」を読み取ります）。'),
    h('div', null, h('button', { class: 'btn primary', onclick: print }, 'A4で印刷する')), grid);
}
function adminConn() {
  return h('div', { class: 'stack' }, h('div', { class: 'card stack' },
    h('div', null, h('b', null, '保存先：'), S.demo ? 'デモ（この端末だけ）' : '会社のGoogle（GAS → スプレッドシート「CFF 技能伝承ボード データ」・ドライブ「CFF 技能伝承ボード/動画」）'),
    h('div', null, h('b', null, 'この端末の権限：'), ROLE_NAME[S.role]),
    h('div', null, h('b', null, '最終更新：'), S.syncedAt ? S.syncedAt.replace('T', ' ').slice(0, 16) : '－'),
    h('div', null, h('b', null, 'AI：'), D().ai ? '使える' : '未設定'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => refresh() }, '今すぐ更新'),
      !S.demo ? h('button', { class: 'btn danger', onclick: () => { lsSet('cffKey', null); lsSet('cffCache', null); S.key = ''; S.data = null; render(); } }, 'この端末から鍵を消す') : null)));
}

// ---------- 起動 ----------
(function boot() {
  const m = location.hash.match(/k=([^&]+)/);
  if (m) { S.key = decodeURIComponent(m[1]); lsSet('cffKey', S.key); history.replaceState(null, '', location.pathname + location.search + '#home'); }
  else S.key = lsGet('cffKey') || '';
  if (!S.demo) { try { const c = JSON.parse(lsGet('cffCache') || 'null'); if (c && S.key) { S.data = c.data; S.role = c.role; S.syncedAt = c.at; } } catch (e) {} }
  window.addEventListener('hashchange', () => { window.onbeforeunload = null; render(); });
  banner(); render();
  if (S.demo || S.key) refresh();
  setInterval(() => { if (document.visibilityState === 'visible' && (S.demo ? false : S.key)) refresh(true); }, 90000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
