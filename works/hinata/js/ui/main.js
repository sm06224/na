/* 陽のへそ — 地点と日付から太陽を描き、日当たりを読む。 */

import { dayEvents, sunPosition, hhmm } from '../core/sun.js';
import { windowSunlight, yearlySunlight, FACING } from '../core/window.js';
import { drawDome } from './render.js';

const $ = id => document.getElementById(id);
const canvas = $('sky');
const ctx = canvas.getContext('2d');

const CITIES = [
  ['札幌', 43.062, 141.354], ['仙台', 38.268, 140.872], ['東京', 35.6895, 139.6917],
  ['新潟', 37.916, 139.036], ['名古屋', 35.181, 136.906], ['大阪', 34.694, 135.502],
  ['広島', 34.385, 132.455], ['高松', 34.340, 134.046], ['福岡', 33.590, 130.402],
  ['鹿児島', 31.596, 130.557], ['那覇', 26.212, 127.681],
];

const state = {
  lat: 35.6895, lon: 139.6917, tz: 9,
  date: today(),
  facing: 180, obs: 0,
  timeMin: 12 * 60,
  placeName: '東京',
};

function today() { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
function isToday(dt) { const t = today(); return dt.y === t.y && dt.m === t.m && dt.d === t.d; }
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(dt) { return `${dt.y}-${pad(dt.m)}-${pad(dt.d)}`; }

/* ----- 初期化 ----- */
function buildControls() {
  const city = $('city');
  for (const [name, lat, lon] of CITIES) {
    const o = document.createElement('option');
    o.value = `${lat},${lon}`; o.textContent = name; o.dataset.name = name;
    city.appendChild(o);
  }
  const fc = $('facings');
  for (const [name, az] of Object.entries(FACING)) {
    const b = document.createElement('button');
    b.className = 'facing'; b.textContent = name; b.dataset.az = az;
    b.addEventListener('click', () => { state.facing = az; markFacing(); recompute(); });
    fc.appendChild(b);
  }
}
function markFacing() {
  for (const b of document.querySelectorAll('.facing'))
    b.classList.toggle('on', Number(b.dataset.az) === state.facing);
}

function syncInputs() {
  $('lat').value = state.lat.toFixed(4);
  $('lon').value = state.lon.toFixed(4);
  $('tz').value = state.tz;
  $('date').value = dateStr(state.date);
  $('obs').value = state.obs;
  $('obsval').textContent = `${state.obs}°`;
  $('placeName').textContent = state.placeName ? `${state.placeName}　(${state.lat.toFixed(3)}, ${state.lon.toFixed(3)})` : `${state.lat.toFixed(3)}, ${state.lon.toFixed(3)}`;
}

/* ----- 画面サイズ ----- */
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.parentElement.clientWidth, 420);
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderDome();
}

/* ----- 計算と描画 ----- */
let events = null;
function recompute() {
  const { lat, lon, tz, date } = state;
  events = dayEvents(lat, lon, tz, date);
  // 日付が今日なら現在時刻、そうでなければ南中にスクラブを合わせる
  if (isToday(date)) {
    const now = new Date(); state.timeMin = now.getHours() * 60 + now.getMinutes();
  } else if (events.solarNoon != null) {
    state.timeMin = Math.round(((events.solarNoon % 1440) + 1440) % 1440);
  }
  $('time').value = state.timeMin;
  renderDome();
  renderGrid();
  renderTimeline();
  renderWindow();
  updateHash();
}

function sunPath() {
  const { lat, lon, tz, date } = state;
  const path = [];
  for (let m = 0; m <= 1440; m += 3) {
    const s = sunPosition(lat, lon, tz, date, m);
    path.push({ min: m, az: s.azimuth, el: s.elevation });
  }
  return path;
}

function renderDome() {
  if (!events) return;
  const { lat, lon, tz, date } = state;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const sun = sunPosition(lat, lon, tz, date, state.timeMin);
  const marks = [];
  if (events.sunrise != null) marks.push({ az: sunPosition(lat, lon, tz, date, Math.round(events.sunrise)).azimuth });
  if (events.sunset != null) marks.push({ az: sunPosition(lat, lon, tz, date, Math.round(events.sunset)).azimuth });
  drawDome(ctx, w, h, { path: sunPath(), sun: { az: sun.azimuth, el: sun.elevation }, marks });
  $('timeRead').innerHTML = `<b>${hhmm(state.timeMin)}</b>　高度 ${sun.elevation.toFixed(1)}°　方位 ${sun.azimuth.toFixed(0)}°（${compass(sun.azimuth)}）`;
}

function compass(az) {
  const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return dirs[Math.round(az / 22.5) % 16];
}

function renderGrid() {
  const e = events;
  const card = (label, val, sub = '') => `<div class="card"><div class="k">${label}</div><div class="v">${val}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  let html = '';
  if (e.polar === 'up') html += card('白夜', '一日中、陽が沈みません');
  else if (e.polar === 'down') html += card('極夜', '一日中、陽が昇りません');
  html += card('日の出', hhmm(e.sunrise));
  html += card('南中', hhmm(e.solarNoon), `高度 ${e.noonElevation.toFixed(1)}°`);
  html += card('日の入り', hhmm(e.sunset));
  html += card('昼の長さ', e.dayLength == null ? '—' : `${Math.floor(e.dayLength / 60)}時間${Math.round(e.dayLength % 60)}分`);
  if (e.goldenMorning) html += card('朝の黄金時間', `${hhmm(e.goldenMorning.start)}–${hhmm(e.goldenMorning.end)}`);
  if (e.goldenEvening) html += card('夕の黄金時間', `${hhmm(e.goldenEvening.start)}–${hhmm(e.goldenEvening.end)}`);
  html += card('市民薄明', `${hhmm(e.civilDawn)} / ${hhmm(e.civilDusk)}`, '空が白む / 暮れる');
  $('grid').innerHTML = html;
}

/* ----- 薄明タイムライン（24時間バー） ----- */
const BAND = { night: '#16203a', astro: '#27365c', naut: '#3c5689', civil: '#8a7fb0', day: '#cfe6ff' };
function renderTimeline() {
  const e = events, pct = m => `${(m / 1440) * 100}%`;
  let stops = [];
  if (e.polar === 'up') stops = [[0, BAND.day], [1440, BAND.day]];
  else if (e.polar === 'down') stops = [[0, BAND.night], [1440, BAND.night]];
  else {
    const seq = [[0, BAND.night], [e.astroDawn, BAND.astro], [e.nauticalDawn, BAND.naut],
      [e.civilDawn, BAND.civil], [e.sunrise, BAND.day], [e.sunset, BAND.civil],
      [e.civilDusk, BAND.naut], [e.nauticalDusk, BAND.astro], [e.astroDusk, BAND.night]];
    let lastColor = BAND.night;
    for (const [m, c] of seq) {
      if (m == null) continue;
      stops.push([Math.max(0, Math.min(1440, m)), c]); lastColor = c;
    }
    stops.push([1440, lastColor]);
  }
  // ハードエッジの線形グラデーション
  let parts = [];
  for (let i = 0; i < stops.length; i++) {
    const [m, c] = stops[i];
    parts.push(`${c} ${pct(m)}`);
    if (i < stops.length - 1) parts.push(`${c} ${pct(stops[i + 1][0])}`);
  }
  const tl = $('tlbar');
  tl.style.background = `linear-gradient(90deg, ${parts.join(',')})`;

  // 黄金時間・窓の日当たりを重ねる
  let ov = '';
  const band = (a, b, cls) => `<div class="ov ${cls}" style="left:${pct(a)};width:${(Math.max(0, b - a) / 1440) * 100}%"></div>`;
  if (e.goldenMorning) ov += band(e.goldenMorning.start, e.goldenMorning.end, 'ov-gold');
  if (e.goldenEvening) ov += band(e.goldenEvening.start, e.goldenEvening.end, 'ov-gold');
  const win = windowSunlight(state.lat, state.lon, state.tz, state.date, state.facing, state.obs);
  for (const iv of win.intervals) ov += band(iv.start, iv.end, 'ov-win');
  // いまの時刻線
  ov += `<div class="ov-now" style="left:${pct(state.timeMin)}"></div>`;
  tl.innerHTML = ov;
}

/* ----- 窓の日当たり ----- */
function renderWindow() {
  const win = windowSunlight(state.lat, state.lon, state.tz, state.date, state.facing, state.obs);
  const h = Math.floor(win.totalMinutes / 60), m = win.totalMinutes % 60;
  const ivs = win.intervals.map(iv => `${hhmm(iv.start)}–${hhmm(iv.end)}`).join('　/　') || 'この日は直射が入りません';
  $('winResult').innerHTML = `<div class="wt"><b>${h}時間${m}分</b>　直射</div><div class="wi">${ivs}</div>`;

  const year = yearlySunlight(state.lat, state.lon, state.tz, state.date.y, state.facing, state.obs);
  const max = Math.max(1, ...year);
  const bars = $('yearbars'); bars.innerHTML = '';
  const axis = $('yearaxis'); axis.innerHTML = '';
  year.forEach((hrs, i) => {
    const bar = document.createElement('div');
    bar.className = 'ybar';
    bar.style.height = `${(hrs / max) * 100}%`;
    if (i + 1 === state.date.m) bar.classList.add('cur');
    bar.title = `${i + 1}月：${hrs.toFixed(1)}h`;
    bars.appendChild(bar);
    const a = document.createElement('span'); a.textContent = i + 1; axis.appendChild(a);
  });
}

/* ----- リンク（位置も日付も、URL の中だけ） ----- */
function updateHash() {
  const p = `${state.lat.toFixed(4)},${state.lon.toFixed(4)},${state.tz},${dateStr(state.date)},${state.facing},${state.obs}`;
  history.replaceState(null, '', `${location.pathname}#${p}`);
}
function readHash() {
  const m = String(location.hash || '').slice(1).split(',');
  if (m.length >= 4) {
    state.lat = +m[0]; state.lon = +m[1]; state.tz = +m[2];
    const [y, mo, d] = m[3].split('-').map(Number);
    if (y) state.date = { y, m: mo, d };
    if (m[4] != null) state.facing = +m[4];
    if (m[5] != null) state.obs = +m[5];
    state.placeName = nearestCity(state.lat, state.lon);
    return true;
  }
  return false;
}
function nearestCity(lat, lon) {
  let best = '', bd = Infinity;
  for (const [name, la, lo] of CITIES) {
    const d = (la - lat) ** 2 + (lo - lon) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return bd < 0.5 ? best : '';
}

/* ----- 入力 ----- */
$('city').addEventListener('change', e => {
  if (!e.target.value) return;
  const [lat, lon] = e.target.value.split(',').map(Number);
  state.lat = lat; state.lon = lon; state.tz = 9;
  state.placeName = e.target.selectedOptions[0].dataset.name;
  syncInputs(); recompute();
});
$('date').addEventListener('change', e => {
  const [y, m, d] = e.target.value.split('-').map(Number);
  if (y) { state.date = { y, m, d }; recompute(); }
});
for (const f of ['lat', 'lon', 'tz']) $(f).addEventListener('change', () => {
  state.lat = +$('lat').value; state.lon = +$('lon').value; state.tz = +$('tz').value;
  state.placeName = nearestCity(state.lat, state.lon);
  syncInputs(); recompute();
});
$('obs').addEventListener('input', () => {
  state.obs = +$('obs').value; $('obsval').textContent = `${state.obs}°`;
  renderTimeline(); renderWindow(); updateHash();
});
$('time').addEventListener('input', () => { state.timeMin = +$('time').value; renderDome(); renderTimeline(); });
$('geo').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('この端末では現在地が使えません');
  toast('現在地を取得中…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.lat = +pos.coords.latitude.toFixed(4);
      state.lon = +pos.coords.longitude.toFixed(4);
      state.tz = -new Date().getTimezoneOffset() / 60;
      state.placeName = nearestCity(state.lat, state.lon) || '現在地';
      syncInputs(); recompute(); toast('現在地にしました');
    },
    () => toast('現在地を取得できませんでした'),
    { enableHighAccuracy: false, timeout: 8000 });
});
$('share').addEventListener('click', async () => {
  updateHash();
  const url = location.href;
  const text = `${state.placeName || 'この地点'} ${dateStr(state.date)}：日の出 ${hhmm(events.sunrise)}・日の入り ${hhmm(events.sunset)}`;
  if (navigator.share) { try { await navigator.share({ title: '陽', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました'); }
  catch { prompt('この陽あたりのリンク', url); }
});

let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

window.addEventListener('resize', fit);

/* ----- 起動 ----- */
buildControls();
readHash();
markFacing();
syncInputs();
recompute();
fit();
