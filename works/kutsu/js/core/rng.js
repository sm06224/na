/* ============================================================
   窟 — 決定的乱数。

   種ひとつから、洞窟も魔物も宝も同じものが生まれる。
   `星`・`雷`・`陽` と同じ mulberry32 を芯にして、ローグライクに
   要る道具（さいころ・重みつき抽選・正規分布・洗い替え）を足す。
   状態は save/load できる（同じ続きから、同じ運命が続く）。
   ============================================================ */

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  /* 生の 0..1（状態を一歩進める） */
  next() {
    let s = (this.state + 0x6d2b79f5) | 0;
    this.state = s >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* 保存・復元（同じ続きから） */
  save() { return this.state >>> 0; }
  restore(state) { this.state = state >>> 0; return this; }
  /* 派生 RNG（独立した流れを種から分ける） */
  fork(salt = 0) { return new RNG((this.state ^ (Math.imul(salt + 1, 0x9e3779b9) >>> 0)) >>> 0); }

  float(a = 0, b = 1) { return a + (b - a) * this.next(); }

  /* [0, n) の整数 */
  int(n) { return Math.floor(this.next() * n); }

  /* [lo, hi] の整数（両端含む） */
  range(lo, hi) {
    if (hi < lo) [lo, hi] = [hi, lo];
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /* p の確率で true */
  chance(p) { return this.next() < p; }
  /* n 分の 1 */
  oneIn(n) { return this.int(n) === 0; }

  pick(arr) { return arr[this.int(arr.length)]; }

  /* 重みつき抽選。items は [{...,weight}] か、weightFn を渡す。 */
  weighted(items, weightFn) {
    let total = 0;
    const ws = items.map(it => {
      const w = Math.max(0, weightFn ? weightFn(it) : (it.weight ?? 1));
      total += w; return w;
    });
    if (total <= 0) return items[this.int(items.length)];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
    return items[items.length - 1];
  }

  /* キー→重み の表から、キーを引く */
  weightedKey(table) {
    const keys = Object.keys(table);
    let total = 0; for (const k of keys) total += Math.max(0, table[k]);
    if (total <= 0) return keys[this.int(keys.length)];
    let r = this.next() * total;
    for (const k of keys) { r -= Math.max(0, table[k]); if (r < 0) return k; }
    return keys[keys.length - 1];
  }

  /* 破壊的シャッフル（Fisher–Yates） */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* 配列から重複なく k 個 */
  sample(arr, k) {
    const copy = arr.slice();
    this.shuffle(copy);
    return copy.slice(0, Math.min(k, copy.length));
  }

  /* "2d6+1" や "1d8" や "3" のさいころ */
  dice(spec) {
    if (typeof spec === 'number') return spec;
    const m = String(spec).trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) return Number(spec) || 0;
    const n = +m[1], faces = +m[2], mod = m[3] ? +m[3] : 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += 1 + this.int(faces);
    return sum + mod;
  }

  /* おおよその正規分布（中心 mean・広がり dev） */
  gaussian(mean = 0, dev = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + dev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* 中央に寄る整数（lo..hi、山なり） */
  bell(lo, hi, rolls = 3) {
    let sum = 0;
    for (let i = 0; i < rolls; i++) sum += this.float(lo, hi);
    return Math.round(sum / rolls);
  }
}

/* 文字列の種を 32bit に畳む（リンク共有用の種文字列にも） */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
