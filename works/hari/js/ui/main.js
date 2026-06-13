/* 針のへそ — 画面の切り替え、刺す・歩く・送る・受け取るの流れ。 */

import {
  distance, bearing, trueHeading, needleAngle, HeadingSmoother,
  averagePosition, fmtDistance, dirWord, pulseInterval, pickHeading,
} from '../core/geo.js';
import { Spots, encodeSpotLink, decodeSpotLink, fmtAge } from '../core/spots.js';
import {
  watchGeo, geoErrorWord, compassNeedsAsking, listenCompass,
  canVibrate, vibrate, keepAwake,
} from './sensors.js';
import { Dial } from './needle.js';

const $ = id => document.getElementById(id);

/* ----- 覚え書き（器は localStorage） ----- */
const spots = new Spots(localStorage.getItem('hari.spots'));
const persist = () => localStorage.setItem('hari.spots', spots.save());
let currentId = localStorage.getItem('hari.current');

/* ----- 状態 ----- */
let fix = null;                 // 最新の測位 { lat, lon, acc, heading, speed }
let heading = null;             // 真北基準の向き（なめらか済み）
let headingAt = 0;              // 磁石が最後にものを言った時刻
let compassAsked = false;
let buzzing = false;
let lastBuzz = 0;
let pinStop = null;             // 刺す作業の中断関数
let releaseWake = null;
const smoother = new HeadingSmoother(0.3);
const dial = new Dial($('dial'));

/* ----- 測位はずっと耳を澄ます ----- */
watchGeo(
  f => { fix = f; $('gps').textContent = `測位 ±${Math.round(f.acc)}m`; },
  e => { $('gps').textContent = geoErrorWord(e); });

/* ----- 画面の切り替え ----- */
function show(view) {
  for (const id of ['hero', 'compass', 'pinning']) $(id).hidden = id !== view;
  const hasTarget = view === 'compass';
  $('bShare').hidden = !hasTarget;
  $('bBuzz').hidden = !hasTarget || !canVibrate();
  $('bList').hidden = spots.list.length === 0;
  $('bPin').textContent = spots.list.length ? '📍 ここにも刺す' : '📍 ここに針を刺す';
  if (hasTarget && !releaseWake) releaseWake = keepAwake();
  if (!hasTarget && releaseWake) { releaseWake(); releaseWake = null; }
}

function current() { return currentId ? spots.get(currentId) : null; }

function select(id) {
  currentId = id;
  localStorage.setItem('hari.current', id ?? '');
  if (!current()) { show('hero'); return; }
  show('compass');
  maybeAskCompass();
}

/* ----- ひとことの灯（描画ループに消されない通知） ----- */
let toastTimer = null;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ----- 方位センサー ----- */
function maybeAskCompass() {
  if (compassAsked) return;
  if (compassNeedsAsking()) { $('wake').hidden = false; return; }
  startCompass();   // Android などは黙って起こせる
}

async function startCompass() {
  compassAsked = true;
  $('wake').hidden = true;
  try {
    await listenCompass(magnetic => {
      const t = fix ? trueHeading(magnetic, fix.lat, fix.lon) : magnetic;
      const v = smoother.push(t);
      if (Number.isFinite(v)) { heading = v; headingAt = Date.now(); }
    });
  } catch {
    // 断られた。歩けば GPS が向きを教えるので、そう伝える
    toast('方位センサーは使えません。歩き出せば GPS が向きを教えます（iPhone は 設定 → Safari → モーションと画面の向き）', 5000);
  }
}
$('bWake').addEventListener('click', startCompass);
$('bWakeSkip').addEventListener('click', () => { compassAsked = true; $('wake').hidden = true; });

/* ----- 描画の鼓動 ----- */
function beat() {
  requestAnimationFrame(beat);
  const spot = current();
  if (!spot || $('compass').hidden) return;
  if (!fix) {
    $('distMain').textContent = '—'; $('distUnit').textContent = '';
    $('walk').textContent = '';
    $('note').textContent = '衛星のこえを待っています…';
    $('note').className = '';
    dial.render({ needleDeg: null, roseDeg: 0, dim: true });
    return;
  }
  const d = distance(fix.lat, fix.lon, spot.lat, spot.lon);
  const brg = bearing(fix.lat, fix.lon, spot.lat, spot.lon);
  const arrived = d <= Math.max(15, fix.acc * 1.2);
  const f = fmtDistance(d);
  $('distMain').textContent = f.main; $('distUnit').textContent = f.unit ?? '';
  $('walk').textContent = arrived ? '' : f.walk;
  $('target').textContent = `${spot.icon} ${spot.name} ・ 刺したのは${fmtAge(spot.at)}`;

  /* 向きの出どころ：磁石 → （歩行中の）GPS → なし */
  const pick = pickHeading({
    compass: heading, compassAt: headingAt,
    gps: fix.heading, gpsSpeed: fix.speed ?? NaN, gpsAt: fix.at,
  });

  let angle = null;
  if (arrived) {
    $('note').textContent =
      `もう着いています（±${Math.round(Math.max(15, fix.acc * 1.2))}m の輪の中）。ここより近くは GPS には見えません。離れると針が立ちます`;
    $('note').className = '';
  } else if (pick.source !== 'none') {
    angle = needleAngle(brg, pick.heading);
    if (pick.source === 'gps') {
      $('note').textContent = '磁石の代わりに、歩く向きで合わせています';
      $('note').className = '';
    } else {
      $('note').textContent = fix.acc > 50 ? `測位がまだ粗い（±${Math.round(fix.acc)}m）。空の下でしばらく待って` : '';
      $('note').className = fix.acc > 50 ? 'warn' : '';
    }
  } else {
    angle = brg;   // 北上の地図のつもりで読む
    $('note').textContent = `上を北として、${dirWord(brg)}のほうです。歩き出せば向きが分かります`;
    $('note').className = '';
  }
  dial.render({
    needleDeg: angle,
    roseDeg: pick.source !== 'none' && !arrived ? -pick.heading : 0,
    arrived,
    dim: pick.source === 'none' && !arrived,
  });

  /* 振動の脈 — 針が合うほど速く */
  if (buzzing && !arrived && angle !== null && pick.source !== 'none') {
    const iv = pulseInterval(angle);
    const now = performance.now();
    if (iv !== null && now - lastBuzz >= iv) { vibrate(35); lastBuzz = now; }
  }
}
requestAnimationFrame(beat);

/* ----- 刺す ----- */
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
    if (!p) { show(current() ? 'compass' : 'hero'); return; }
    const spot = spots.pin(p);
    persist();
    select(spot.id);
    if (canVibrate()) vibrate([30, 60, 30]);
  }
  pinStop = () => { clearTimeout(timer); stopGeo(); pinStop = null; };
});
$('bPinCancel').addEventListener('click', () => {
  if (pinStop) pinStop();
  show(current() ? 'compass' : 'hero');
});

/* ----- 振動トグル ----- */
$('bBuzz').addEventListener('click', () => {
  buzzing = !buzzing;
  $('bBuzz').textContent = buzzing ? '🔔 振動中' : '🔕 振動';
  $('bBuzz').classList.toggle('on', buzzing);
  if (buzzing) vibrate(35);
});

/* ----- 送る ----- */
$('bShare').addEventListener('click', async () => {
  const spot = current();
  if (!spot) return;
  const url = location.href.split('#')[0] + '#' + encodeSpotLink(spot);
  const data = { title: '針', text: `「${spot.name}」の場所です。開くと針が案内します`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* 思い直しただけ */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('リンクを写しました。そのまま貼って送れます');
  } catch {
    prompt('このリンクを送ってください', url);
  }
});

/* ----- 一覧 ----- */
function renderList() {
  const ul = $('spotRows');
  ul.innerHTML = '';
  if (!spots.list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'まだ針がありません';
    ul.appendChild(li);
    return;
  }
  for (const s of spots.list) {
    const li = document.createElement('li');
    li.classList.toggle('sel', s.id === currentId);
    const dist = fix ? fmtDistance(distance(fix.lat, fix.lon, s.lat, s.lon)) : null;
    li.innerHTML = `
      <span class="icon"></span>
      <span class="body"><div class="name"></div><div class="meta"></div></span>
      <span class="tools">
        <button data-act="name" title="名を変える">✎</button>
        <button data-act="del" title="抜く">✕</button>
      </span>`;
    li.querySelector('.icon').textContent = s.icon;
    li.querySelector('.name').textContent = s.name;
    li.querySelector('.meta').textContent =
      `${fmtAge(s.at)}${dist ? ` ・ ${dist.main}${dist.unit}` : ''} ・ ±${s.acc}m`;
    li.addEventListener('click', e => {
      const act = e.target.dataset?.act;
      if (act === 'del') {
        if (confirm(`「${s.name}」の針を抜きますか？`)) {
          spots.remove(s.id); persist();
          if (currentId === s.id) select(spots.list[0]?.id ?? null);
          renderList();
        }
        return;
      }
      if (act === 'name') {
        const name = prompt('この針の名前', s.name);
        if (name) { spots.rename(s.id, name); persist(); renderList(); }
        return;
      }
      select(s.id);
      $('list').hidden = true;
    });
    ul.appendChild(li);
  }
}
$('bList').addEventListener('click', () => { renderList(); $('list').hidden = false; });
$('bListClose').addEventListener('click', () => { $('list').hidden = true; });

/* ----- 届いた針 ----- */
const received = decodeSpotLink(location.hash);
if (received) {
  history.replaceState(null, '', location.pathname + location.search);
  $('receivedInfo').textContent =
    `「${received.name || '名なしの場所'}」への針が分かち合われました。受け取ると、矢印が案内します。`;
  $('received').hidden = false;
  $('bReceiveGo').addEventListener('click', () => {
    const spot = spots.pin({
      lat: received.lat, lon: received.lon, acc: received.acc,
      name: received.name || '届いた針', icon: '💌',
    });
    persist();
    $('received').hidden = true;
    select(spot.id);
  });
  $('bReceiveNo').addEventListener('click', () => { $('received').hidden = true; });
}

/* ----- そっとオフラインの備えを ----- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

/* ----- 起きる ----- */
select(current() ? currentId : null);
