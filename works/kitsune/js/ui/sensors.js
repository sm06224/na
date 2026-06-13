/* 感覚器 — GPS・方位センサー・振動・眠らせない約束。
   ブラウザごとの癖はここで吸収し、外には度と m しか出さない。 */

import { headingFromEvent } from '../core/geo.js';

/* ----- 測位 ----- */
export function watchGeo(onFix, onError) {
  if (!('geolocation' in navigator)) {
    onError(new Error('この端末は場所をはかれません'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    p => onFix({
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      acc: p.coords.accuracy ?? 50,
      heading: p.coords.heading,     // 進行方位（真北基準）。動いていないと null/NaN
      speed: p.coords.speed,         // m/s
      at: p.timestamp,
    }),
    e => onError(e),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  return () => navigator.geolocation.clearWatch(id);
}

export function geoErrorWord(e) {
  if (e && e.code === 1) return '場所の利用が断られています。ブラウザの設定から許してください';
  if (e && e.code === 2) return '衛星のこえが届きません。空の見える場所へ';
  if (e && e.code === 3) return '測位に時間がかかっています…';
  return '場所をはかれませんでした';
}

/* ----- 方位 ----- */
export function compassNeedsAsking() {
  return typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';
}

function screenAngle() {
  return (screen.orientation && typeof screen.orientation.angle === 'number')
    ? screen.orientation.angle
    : (typeof window.orientation === 'number' ? window.orientation : 0);
}

/* 方位の購読。iOS では先に requestPermission（ユーザー操作の中で呼ぶこと）。
   onHeading(磁北からの度) — センサが黙っていれば呼ばれない。

   どちらの窓から本物の向きが来るかはブラウザごとに違うので、
   両方の窓を同時に開け、最初に向きをくれたほうに固定する。
   （片方だけ開ける作りにしていたら、窓を選び間違えた端末で
   針が永遠に黙った。同じ過ちは二度としない。） */
export async function listenCompass(onHeading) {
  if (compassNeedsAsking()) {
    const ans = await DeviceOrientationEvent.requestPermission();
    if (ans !== 'granted') throw new Error('denied');
  }
  let source = null;
  const make = type => ev => {
    if (source && source !== type) return;
    const h = headingFromEvent({
      webkitCompassHeading: ev.webkitCompassHeading,
      alpha: ev.alpha,
      absolute: ev.absolute || type === 'deviceorientationabsolute',
    }, screenAngle());
    if (h !== null) { source = type; onHeading(h); }
  };
  const onAbs = make('deviceorientationabsolute');
  const onRel = make('deviceorientation');
  window.addEventListener('deviceorientationabsolute', onAbs);
  window.addEventListener('deviceorientation', onRel);
  return () => {
    window.removeEventListener('deviceorientationabsolute', onAbs);
    window.removeEventListener('deviceorientation', onRel);
  };
}

/* ----- 振動 ----- */
export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
export const vibrate = ms => { try { navigator.vibrate(ms); } catch { /* 黙る */ } };

/* ----- 画面を眠らせない ----- */
export function keepAwake() {
  let lock = null, want = true;
  const grab = async () => {
    if (!want || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch { /* 省電力中などは諦める */ }
  };
  const onVis = () => { if (document.visibilityState === 'visible') grab(); };
  document.addEventListener('visibilitychange', onVis);
  grab();
  return () => {
    want = false;
    document.removeEventListener('visibilitychange', onVis);
    if (lock) lock.release().catch(() => {});
  };
}
