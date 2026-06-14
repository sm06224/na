/* 決定的な乱数 — 同じ種からは、同じ稲妻が走る。
   （`星` と同じ系譜の mulberry32。空が違っても、乱数の作法はひとつ。） */
export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(n) { return (this.next() * n) | 0; }
  pick(arr) { return arr[this.int(arr.length)]; }
}
