/* 狐のへそ — 役の分かれ道、的を仕掛ける狐、矢印を追う追手。

   針（hari）の羅針盤と感覚器を受け継ぎ、その上に宝探しを建てる。
   コースはリンクに畳まれて渡り、通過は GPS・QR・写真で証明される。
   サーバーは無い。すべてこの端末と、配られたリンクの中だけで起こる。 */

import {
  distance, bearing, trueHeading, needleAngle, HeadingSmoother,
  averagePosition, fmtDistance, dirWord, pulseInterval, pickHeading,
} from '../core/geo.js';
import {
  encodeCourse, decodeCourse, decodeToken, encodeToken,
  randomToken, randomId, tokenHash, Hunt, PROOFS, MAX_CPS,
} from '../core/course.js';
import {
  watchGeo, geoErrorWord, compassNeedsAsking, listenCompass,
  canVibrate, vibrate, keepAwake,
} from './sensors.js';
import { Dial } from './needle.js';
import { takePhoto } from './camera.js';
import { qrToSVG } from '../core/qr.js';

const $ = id => document.getElementById(id);
const PROOF_GLYPH = { gps: '📍', qr: '🔳', photo: '📷' };
const PROOF_WORD = { gps: '近づいて通過', qr: 'QRを読む', photo: '写真をとる' };

/* ===== 共有の状態 ===== */
let fix = null;
let heading = null, headingAt = 0, compassAsked = false;
let releaseWake = null;
const smoother = new HeadingSmoother(0.3);
let dial = null;

let mode = 'home';
let draft = loadDraft();        // 狐の作りかけ
let hunt = null;                // 追手の進行（Hunt）
let lastBuzz = 0, celebrating = 0;

/* ===== 保存の器（localStorage） ===== */
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('kitsune.draft'));
    if (d && Array.isArray(d.cps)) return d;
  } catch { /* 落ちたら新規 */ }
  return { id: randomId(), name: '', cps: [] };
}
function saveDraft() { localStorage.setItem('kitsune.draft', JSON.stringify(draft)); }
function saveCourse(course) { localStorage.setItem('kitsune.course.' + course.id, JSON.stringify(course)); }
function loadCourse(id) {
  try { return JSON.parse(localStorage.getItem('kitsune.course.' + id)); } catch { return null; }
}
function saveHunt() {
  if (!hunt) return;
  localStorage.setItem('kitsune.hunt.' + hunt.course.id, hunt.save());
  localStorage.setItem('kitsune.active', hunt.course.id);
}

/* ===== ひとことの灯 ===== */
let toastTimer = null;
function toast(msg, ms = 3400) {
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ===== 測位はいつも耳を澄ます ===== */
watchGeo(
  f => { fix = f; $('gps').textContent = `測位 ±${Math.round(f.acc)}m`; },
  e => { $('gps').textContent = geoErrorWord(e); });

/* ===== 画面の切り替え ===== */
function show(m) {
  mode = m;
  for (const id of ['hero', 'builder', 'pinning', 'hunt', 'result']) $(id).hidden = id !== m;
  $('bHome').hidden = (m === 'home');
  $('bPin').hidden = (m !== 'builder');
  $('bQR').hidden = !(m === 'builder' && draft.cps.some(c => c.proof === 'qr'));
  $('bSendCourse').hidden = !(m === 'builder' && draft.cps.length >= 1);
  $('bProof').hidden = (m !== 'hunt');
  $('bShareResult').hidden = (m !== 'result');
  $('bPin').textContent = draft.cps.length ? '📍 ここにも的を刺す' : '📍 ここに的を刺す';
  const live = (m === 'hunt');
  if (live && !releaseWake) releaseWake = keepAwake();
  if (!live && releaseWake) { releaseWake(); releaseWake = null; }
  if (m === 'builder') renderBuilder();
  if (m === 'hunt') { maybeAskCompass(); updateProofButton(); }
}

function goHome() {
  show('home');
  $('bBecomeFox').textContent = draft.cps.length ? '🦊 コースの続きを作る' : '🦊 狐になる（コースを作る）';
}

/* ===== 方位センサー（針ゆずり） ===== */
function maybeAskCompass() {
  if (compassAsked) return;
  compassAsked = true;
  startCompass();
}
async function startCompass() {
  try {
    await listenCompass(magnetic => {
      const t = fix ? trueHeading(magnetic, fix.lat, fix.lon) : magnetic;
      const v = smoother.push(t);
      if (Number.isFinite(v)) { heading = v; headingAt = Date.now(); }
    });
  } catch {
    toast('方位センサーは使えません。歩き出せば GPS が向きを教えます（iPhone は 設定→Safari→モーションと画面の向き）', 5000);
  }
}

/* =====================================================================
   狐 — コースを組む
   ===================================================================== */

function renderBuilder() {
  $('courseName').value = draft.name;
  $('builderEmpty').hidden = draft.cps.length > 0;
  $('builderStat').textContent = draft.cps.length
    ? `的 ${draft.cps.length} / ${MAX_CPS}　・　仕掛けたら「コースを送る」`
    : '';
  const ul = $('cpRows');
  ul.innerHTML = '';
  draft.cps.forEach((cp, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="body"><div class="name"></div><div class="meta"></div></span>
      <span class="tools">
        <button data-act="edit" title="直す">✎</button>
        <button data-act="del" title="抜く">✕</button>
      </span>`;
    li.querySelector('.name').textContent = cp.name || `第${i + 1}の的`;
    const tail = cp.proof === 'gps' ? `半径${cp.r}m` : (cp.proof === 'qr' ? `合言葉 ${cp.token}` : '撮影');
    li.querySelector('.meta').textContent = `${PROOF_GLYPH[cp.proof]} ${PROOF_WORD[cp.proof]}・${tail}`;
    li.querySelector('[data-act=del]').addEventListener('click', () => {
      if (confirm(`「${cp.name || `第${i + 1}の的`}」を抜きますか？`)) {
        draft.cps.splice(i, 1); saveDraft(); renderBuilder(); show('builder');
      }
    });
    li.querySelector('[data-act=edit]').addEventListener('click', () => openCpSetup(i));
    ul.appendChild(li);
  });
}

$('courseName').addEventListener('input', () => { draft.name = $('courseName').value; saveDraft(); });

/* 的を刺す（GPS をならす） */
let pinStop = null;
$('bPin').addEventListener('click', () => {
  if (pinStop) return;
  show('pinning');
  const fixes = [];
  const t0 = Date.now();
  const stopGeo = watchGeo(
    f => {
      fixes.push(f);
      $('pinStat').textContent = `測位 ${fixes.length} 回 ・ いちばん良くて ±${Math.round(Math.min(...fixes.map(x => x.acc)))}m`;
      if (Date.now() - t0 > 8000 || fixes.length >= 12) done();
    },
    e => { $('pinStat').textContent = geoErrorWord(e); });
  const timer = setTimeout(done, 12000);
  function done() {
    clearTimeout(timer); stopGeo(); pinStop = null;
    const p = averagePosition(fixes);
    if (!p) { show('builder'); toast('うまく測れませんでした。空の見える場所でもう一度'); return; }
    pendingPin = { lat: p.lat, lon: p.lon, acc: Math.round(p.acc) };
    if (canVibrate()) vibrate(30);
    openCpSetup(-1);   // 新しい的の設定へ
  }
  pinStop = () => { clearTimeout(timer); stopGeo(); pinStop = null; };
});
$('bPinCancel').addEventListener('click', () => { if (pinStop) pinStop(); show('builder'); });

/* 的の設定シート */
let pendingPin = null;     // 新規の座標
let editIdx = -1;          // 直している的の番号（-1 は新規）
let pickedProof = 'gps';

function openCpSetup(idx) {
  editIdx = idx;
  const cp = idx >= 0 ? draft.cps[idx] : null;
  $('cpsetupTitle').textContent = cp ? '的を直す' : '的を仕掛ける';
  $('cpNameIn').value = cp ? cp.name : '';
  $('cpHintIn').value = cp ? cp.hint : '';
  pickedProof = cp ? cp.proof : 'gps';
  $('cpRadius').value = cp ? cp.r : 25;
  $('cpRadiusVal').textContent = `${cp ? cp.r : 25}m`;
  for (const b of $('proofPick').children) b.classList.toggle('on', b.dataset.proof === pickedProof);
  $('radiusRow').hidden = pickedProof !== 'gps';
  $('cpsetup').hidden = false;
}
for (const b of $('proofPick').children) {
  b.addEventListener('click', () => {
    pickedProof = b.dataset.proof;
    for (const x of $('proofPick').children) x.classList.toggle('on', x === b);
    $('radiusRow').hidden = pickedProof !== 'gps';
  });
}
$('cpRadius').addEventListener('input', () => { $('cpRadiusVal').textContent = `${$('cpRadius').value}m`; });
$('bCpCancel').addEventListener('click', () => { $('cpsetup').hidden = true; pendingPin = null; show('builder'); });

$('bCpSave').addEventListener('click', async () => {
  const base = editIdx >= 0 ? draft.cps[editIdx] : pendingPin;
  if (!base) { $('cpsetup').hidden = true; return; }
  const cp = {
    lat: base.lat, lon: base.lon, acc: base.acc ?? 0,
    name: $('cpNameIn').value.trim(),
    hint: $('cpHintIn').value.trim(),
    proof: pickedProof,
    r: Number($('cpRadius').value),
    token: null, th: null,
  };
  if (cp.proof === 'qr') {
    // 直しで既に合言葉があるなら活かす。無ければ新しく
    const prev = editIdx >= 0 ? draft.cps[editIdx] : null;
    cp.token = (prev && prev.proof === 'qr' && prev.token) ? prev.token : randomToken();
    const idx = editIdx >= 0 ? editIdx : draft.cps.length;
    cp.th = await tokenHash(draft.id, idx, cp.token);
  }
  if (editIdx >= 0) draft.cps[editIdx] = cp;
  else draft.cps.push(cp);
  saveDraft();
  $('cpsetup').hidden = true; pendingPin = null;
  show('builder');
});

/* QR を刷る */
$('bQR').addEventListener('click', () => {
  const base = location.href.split('#')[0];
  const pages = $('qrPages');
  pages.innerHTML = '';
  draft.cps.forEach((cp, i) => {
    if (cp.proof !== 'qr') return;
    const url = base + '#' + encodeToken(draft.id, i, cp.token);
    const card = document.createElement('div');
    card.className = 'qrcard';
    card.innerHTML = `
      <div class="qtitle"></div>
      <div class="qsub"></div>
      ${qrToSVG(url, { module: 6 })}
      <div class="qtoken"></div>`;
    card.querySelector('.qtitle').textContent = `第${i + 1}の的　${cp.name || ''}`;
    card.querySelector('.qsub').textContent = 'スマホのカメラで読んでください';
    card.querySelector('.qtoken').textContent = `合言葉 ${cp.token}`;
    pages.appendChild(card);
  });
  $('qrsheet').hidden = false;
});
$('bQRClose').addEventListener('click', () => { $('qrsheet').hidden = true; });
$('bQRPrint').addEventListener('click', () => window.print());

/* コースを送る */
$('bSendCourse').addEventListener('click', async () => {
  if (!draft.cps.length) return;
  draft.name = $('courseName').value.trim();
  saveDraft();
  // 送るのは公開版（合言葉の平文は抜き、ハッシュだけ）
  const pub = { id: draft.id, name: draft.name, cps: draft.cps };
  const url = location.href.split('#')[0] + '#' + encodeCourse(pub);
  const qrCount = draft.cps.filter(c => c.proof === 'qr').length;
  const data = {
    title: '狐からの挑戦状',
    text: `「${draft.name || '名なしの狐'}」— 的 ${draft.cps.length}。開くと狩りが始まります`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(data); }
    catch (e) { if (e && e.name === 'AbortError') return; await copyLink(url); }
  } else { await copyLink(url); }
  if (qrCount) toast(`コースを送りました。QR の的が ${qrCount} つあります。先に「QRを刷る」で貼っておいてください`, 5000);
}, false);

async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました。そのまま貼って送れます'); }
  catch { prompt('このリンクを送ってください', url); }
}

$('bBecomeFox').addEventListener('click', () => show('builder'));
$('bDemo').addEventListener('click', () => location.href = './README.md');
$('bHome').addEventListener('click', () => {
  if (mode === 'hunt' && hunt && !hunt.done) {
    if (!confirm('狩りを中断しますか？（続きから再開できます）')) return;
  }
  goHome();
});

/* =====================================================================
   追手 — 矢印を追う
   ===================================================================== */

function startHunt(course, resume) {
  saveCourse(course);
  hunt = new Hunt(course, resume ? localStorage.getItem('kitsune.hunt.' + course.id) : null);
  if (!resume) { hunt.passed = []; hunt.startedAt = null; }
  hunt.begin();
  saveHunt();
  show('hunt');
}

function updateProofButton() {
  const cp = hunt && hunt.current;
  const b = $('bProof');
  if (!cp) { b.hidden = true; return; }
  b.hidden = false;
  if (cp.proof === 'photo') { b.textContent = '📷 写真でしるす'; b.disabled = false; }
  else if (cp.proof === 'qr') { b.textContent = '🔳 QRの読み方'; b.disabled = false; }
  else { b.textContent = '📍 近づけば自動で通過'; b.disabled = true; }
}

$('bProof').addEventListener('click', async () => {
  const cp = hunt && hunt.current;
  if (!cp) return;
  if (cp.proof === 'photo') {
    const thumb = await takePhoto();
    if (!thumb) { toast('写真がとれませんでした'); return; }
    hunt.passPhoto(thumb); saveHunt(); afterPass();
  } else if (cp.proof === 'qr') {
    toast('この的に貼られた QR を、スマホの標準カメラで読んでください。読むと自動で通過します', 5200);
  }
});

function afterPass() {
  if (canVibrate()) vibrate([40, 50, 40]);
  celebrating = performance.now();
  if (hunt.done) { saveHunt(); renderResult(); show('result'); return; }
  updateProofButton();
  toast(`通過！ のこり ${hunt.course.cps.length - hunt.currentIdx}`, 2600);
}

/* 羅針盤の鼓動 */
function beat() {
  requestAnimationFrame(beat);
  if (mode !== 'hunt' || !hunt) return;
  const cp = hunt.current;
  if (!cp) return;
  const total = hunt.course.cps.length;
  $('huntBarFill').style.width = `${(hunt.currentIdx / total) * 100}%`;
  $('cpName').textContent = `${PROOF_GLYPH[cp.proof]} ${cp.name || `第${hunt.currentIdx + 1}の的`}（${hunt.currentIdx + 1}/${total}）`;
  $('cpHint').textContent = cp.hint ? `ヒント：${cp.hint}` : '';

  if (!fix) {
    $('distMain').textContent = '—'; $('distUnit').textContent = '';
    $('walk').textContent = '';
    $('note').textContent = '衛星のこえを待っています…'; $('note').className = '';
    dial.render({ needleDeg: null, roseDeg: 0, dim: true });
    return;
  }

  const d = distance(fix.lat, fix.lon, cp.lat, cp.lon);
  const brg = bearing(fix.lat, fix.lon, cp.lat, cp.lon);
  const f = fmtDistance(d);
  $('distMain').textContent = f.main; $('distUnit').textContent = f.unit ?? '';

  // GPS の的は、輪に入れば自動で通過
  if (cp.proof === 'gps' && hunt.passGps(d)) { saveHunt(); afterPass(); return; }

  const near = d <= Math.max(cp.r, 18);
  const pick = pickHeading({
    compass: heading, compassAt: headingAt,
    gps: fix.heading, gpsSpeed: fix.speed ?? NaN, gpsAt: fix.at,
  });

  let angle = null;
  if (near) {
    $('walk').textContent = '';
    if (cp.proof === 'photo') { $('note').textContent = 'ここだ！「写真でしるす」を押して一枚'; $('note').className = 'go'; }
    else if (cp.proof === 'qr') { $('note').textContent = 'このあたりに QR があるはず。標準カメラで読もう'; $('note').className = 'go'; }
    else { $('note').textContent = 'もうすぐ…'; $('note').className = 'go'; }
  } else {
    $('walk').textContent = f.walk;
    if (pick.source !== 'none') {
      angle = needleAngle(brg, pick.heading);
      $('note').textContent = pick.source === 'gps'
        ? '磁石の代わりに、歩く向きで合わせています'
        : (fix.acc > 50 ? `測位がまだ粗い（±${Math.round(fix.acc)}m）` : '');
      $('note').className = (pick.source !== 'gps' && fix.acc > 50) ? 'warn' : '';
    } else {
      angle = brg;
      $('note').textContent = `上を北として、${dirWord(brg)}の方へ。歩き出せば向きが分かります`;
      $('note').className = '';
    }
  }
  dial.render({
    needleDeg: angle,
    roseDeg: pick.source !== 'none' && !near ? -pick.heading : 0,
    arrived: near,
    dim: pick.source === 'none' && !near,
  });

  if (!near && pick.source !== 'none' && angle !== null) {
    const iv = pulseInterval(angle);
    const now = performance.now();
    if (iv !== null && now - lastBuzz >= iv) { vibrate(20); lastBuzz = now; }
  }
}

/* 記録の画面 */
function renderResult() {
  $('resultTitle').textContent = hunt.done ? '狩り、おわり！' : '狩りの途中';
  const ms = hunt.elapsed();
  const mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
  $('resultTime').textContent = hunt.done ? `タイム ${mm}分${String(ss).padStart(2, '0')}秒` : '';
  const ul = $('splits'); ul.innerHTML = '';
  hunt.passed.forEach((p, i) => {
    const t = Math.floor((p.at - hunt.startedAt) / 60000);
    const li = document.createElement('li');
    li.innerHTML = `<span class="s-name"></span><span class="s-time"></span>`;
    li.querySelector('.s-name').textContent = `${i + 1}. ${PROOF_GLYPH[hunt.course.cps[i].proof]} ${hunt.course.cps[i].name || `第${i + 1}の的`}`;
    li.querySelector('.s-time').textContent = `${t}分`;
    ul.appendChild(li);
  });
  const gal = $('gallery'); gal.innerHTML = '';
  hunt.passed.forEach(p => {
    if (p.photo) { const im = new Image(); im.src = p.photo; gal.appendChild(im); }
  });
}

$('bShareResult').addEventListener('click', async () => {
  const text = hunt.summary();
  if (navigator.share) {
    try { await navigator.share({ title: '狐・狩りの記録', text }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('記録を写しました'); }
  catch { prompt('記録', text); }
});

/* 受け取りシート */
$('bHuntNo').addEventListener('click', () => { $('received').hidden = true; goHome(); });

/* =====================================================================
   入り口 — リンクのかけらを読む
   ===================================================================== */

async function boot() {
  dial = new Dial($('dial'));
  requestAnimationFrame(beat);

  const hash = location.hash;

  // 1) 通過のしるし（QR から開かれた）
  const tok = decodeToken(hash);
  if (tok) {
    history.replaceState(null, '', location.pathname + location.search);
    const course = loadCourse(tok.id);
    if (!course) { goHome(); toast('先に、狐から届いたコースのリンクを開いてください', 5000); return; }
    hunt = new Hunt(course, localStorage.getItem('kitsune.hunt.' + course.id));
    hunt.begin();
    const ok = await hunt.passToken(tok.idx, tok.token);
    saveHunt();
    if (ok) { afterPass(); if (!hunt.done) show('hunt'); }
    else {
      show('hunt');
      const cp = hunt.course.cps[tok.idx];
      toast(tok.idx !== hunt.currentIdx
        ? `それは第${tok.idx + 1}の的の QR。いまの的は ${hunt.currentIdx + 1} 番です`
        : 'この QR は、いまの的のものではないようです', 5000);
    }
    return;
  }

  // 2) コース（挑戦状）が届いた
  const course = decodeCourse(hash);
  if (course) {
    history.replaceState(null, '', location.pathname + location.search);
    saveCourse(course);
    const prog = localStorage.getItem('kitsune.hunt.' + course.id);
    const resumable = prog && new Hunt(course, prog).currentIdx > 0;
    const n = course.cps.length;
    const kinds = course.cps.reduce((a, c) => (a[c.proof]++, a), { gps: 0, qr: 0, photo: 0 });
    $('receivedInfo').textContent =
      `「${course.name || '名なしの狐'}」\n的は ${n} つ（${PROOF_GLYPH.gps}${kinds.gps} ${PROOF_GLYPH.qr}${kinds.qr} ${PROOF_GLYPH.photo}${kinds.photo}）。矢印だけを頼りに、順に巡ります。`;
    $('bHuntResume').hidden = !resumable;
    $('received').hidden = false;
    $('bHuntStart').onclick = () => { $('received').hidden = true; startHunt(course, false); };
    $('bHuntResume').onclick = () => { $('received').hidden = true; startHunt(course, true); };
    return;
  }

  // 3) ふだんの起動：続きの狩りがあれば戻る、なければ家
  const activeId = localStorage.getItem('kitsune.active');
  if (activeId) {
    const c = loadCourse(activeId);
    const prog = localStorage.getItem('kitsune.hunt.' + activeId);
    if (c && prog) {
      const h = new Hunt(c, prog);
      if (h.started && !h.done) { hunt = h; show('hunt'); return; }
    }
  }
  goHome();
}

/* オフラインの備え（network-first の sw） */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

boot();
