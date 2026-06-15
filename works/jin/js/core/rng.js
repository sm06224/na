/* ============================================================
   陣 — 決定的な乱数。種ひとつから、同じ戦記が立つ。

   `星`・`雷`・`窟`・`種`・`籤` と同じ mulberry32 の血。戦場の生成も、
   命中も会心も、敵の迷いの解き方も、すべてこの一本の流れから決まる。
   流れは派生（derive）でき、同じ親種からは同じ子種が生まれる——
   だから「第三章の戦場」も「あの会心」も、種さえあれば何度でも蘇る。
   ============================================================ */

export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 文字列・数を 32bit 種へ畳む（FNV-1a） */
export function hashSeed(input) {
  let h = 0x811c9dc5;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    this.seed = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
    this.next = mulberry32(this.seed);
    this.calls = 0;
  }
  /* 0..1 */
  float(a = 0, b = 1) { this.calls++; return a + (b - a) * this.next(); }
  /* 0..n-1 の整数 */
  int(n) { this.calls++; return (this.next() * n) | 0; }
  /* a..b の整数（両端含む） */
  range(a, b) { return a + this.int(b - a + 1); }
  /* p の確率で true（百分率でなく 0..1） */
  chance(p) { this.calls++; return this.next() < p; }
  /* 百分率の判定（0..100）— 命中・会心はこちらを使う */
  roll(percent) { this.calls++; return this.next() * 100 < percent; }
  pick(arr) { return arr[this.int(arr.length)]; }
  /* 重み付き抽選：[{w, ...}] または [[item, w]] */
  weighted(entries, weightOf = e => e.w) {
    let total = 0;
    for (const e of entries) total += Math.max(0, weightOf(e));
    if (total <= 0) return entries[0];
    let r = this.next() * total;
    for (const e of entries) { r -= Math.max(0, weightOf(e)); if (r <= 0) return e; }
    return entries[entries.length - 1];
  }
  /* 偏りのないフィッシャー–イェーツ（破壊的でない） */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* ガウス近似（中心極限）— 成長のばらつきなどに */
  gauss(mean = 0, sd = 1) {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return mean + (s - 3) / 1.732 * sd;
  }
  /* 子の流れを生む。同じラベル＋親種からは、いつも同じ子種 */
  derive(label) {
    return new RNG((this.seed ^ hashSeed(label)) >>> 0);
  }
}
