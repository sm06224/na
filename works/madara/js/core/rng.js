/* 決定的な乱数 — 同じ種からは、同じ斑（まだら）が浮かぶ。
   （`雷`・`星`・`雪`・`儚` と同じ系譜の mulberry32。作品が違っても、乱数の作法はひとつ。） */
export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 文字列の種を 32bit に畳む（FNV-1a）。"madara-豹" でも数でも、同じ機械に入る。
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    this.seed = (typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed)) >>> 0;
    this.next = mulberry32(this.seed);
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(n) { return (this.next() * n) | 0; }
  pick(arr) { return arr[this.int(arr.length)]; }
  // 種を派生させる（同じ核から、ちがう乱数列を取り出すため）。
  fork(tag) { return new RNG((this.seed ^ hashSeed(tag)) >>> 0); }
}
