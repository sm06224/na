/* 決定的な乱数 — 同じ種からは、同じシフト案が生まれる（再現性） */
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
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
