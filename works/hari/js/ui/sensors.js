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
   onHeading(磁北からの度) — センサが黙っていれば呼ばれない。 */
export async function listenCompass(onHeading) {
  if (compassNeedsAsking()) {
    const ans = await DeviceOrientationEvent.requestPermission();
    if (ans !== 'granted') throw new Error('denied');
  }
  const handler = ev => {
    const h = headingFromEvent({
      webkitCompassHeading: ev.webkitCompassHeading,
      alpha: ev.alpha,
      absolute: ev.absolute || ev.type === 'deviceorientationabsolute',
    }, screenAngle());
    if (h !== null) onHeading(h);
  };
  /* absolute（磁北基準）が来る窓には absolute を、iOS には素のほうを */
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handler);
  } else {
    window.addEventListener('deviceorientation', handler);
  }
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
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
