/* ============================================================
   波 — 触れると生まれ、ひろがり、岸で跳ね返り、重なって、しずまる。

   水面の高さを格子に持ち、離散化した波動方程式を一歩ずつ進める：

     h' = (2h − h_prev) + c²·∇²h        （∇² は四近傍ラプラシアン）
     h' *= damp                          （ゆっくり凪いでいく減衰）

   岸は反射壁（ノイマン境界：格子の外の隣は自分自身）。だから波紋は
   縁で跳ね返り、互いに干渉する。誰も波形を描かない——物理がひとりでに
   描く。コアは DOM を知らない。Node の中でも、同じ波が立つ。
   ============================================================ */

export class Water {
  /* w×h の水面。c2 は伝わる速さ（安定のため 2D では c2 ≤ 0.5）。 */
  constructor(w, h, { c2 = 0.49, damp = 0.994 } = {}) {
    this.w = w; this.h = h;
    this.c2 = c2; this.damp = damp;
    this.cur = new Float32Array(w * h);
    this.prev = new Float32Array(w * h);
  }

  /* 波紋をひとつ落とす（なめらかな盛り上がり＝持ち上げた水のインパルス）。 */
  drop(cx, cy, radius = 6, amp = 1) {
    const { w, h, cur } = this;
    const r = Math.max(1, radius);
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        // 上に凸の傘形（中心がいちばん高く、縁でなめらかに 0）
        cur[y * w + x] += amp * 0.5 * (1 + Math.cos(Math.PI * d / r));
      }
    }
  }

  /* 一歩進める（反射壁・減衰つき）。 */
  step() {
    const { w, h, cur, prev, c2, damp } = this;
    const next = prev;                 // prev の器を next として使い回す
    for (let y = 0; y < h; y++) {
      const ym = (y > 0 ? y - 1 : y) * w;
      const yp = (y < h - 1 ? y + 1 : y) * w;
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        const xm = x > 0 ? x - 1 : x;
        const xp = x < w - 1 ? x + 1 : x;
        const i = yc + x;
        const lap = cur[yc + xm] + cur[yc + xp] + cur[ym + x] + cur[yp + x] - 4 * cur[i];
        next[i] = (2 * cur[i] - prev[i] + c2 * lap) * damp;
      }
    }
    this.prev = cur;                   // 入れ替え：いまの cur が次の prev に
    this.cur = next;
  }

  /* セルの傾き（法線の xy 成分）— 描画の陰影・きらめきに使う。 */
  slopeAt(x, y) {
    const { w, h, cur } = this;
    const xm = x > 0 ? x - 1 : x, xp = x < w - 1 ? x + 1 : x;
    const ym = y > 0 ? y - 1 : y, yp = y < h - 1 ? y + 1 : y;
    return { dx: cur[y * w + xm] - cur[y * w + xp], dy: cur[ym * w + x] - cur[yp * w + x] };
  }

  /* いまの水面でいちばん大きい揺れ（凪いだかの目安）。 */
  maxAmplitude() {
    let m = 0;
    for (let i = 0; i < this.cur.length; i++) { const a = Math.abs(this.cur[i]); if (a > m) m = a; }
    return m;
  }

  /* 総エネルギーの目安（高さの二乗和）。 */
  energy() {
    let e = 0;
    for (let i = 0; i < this.cur.length; i++) e += this.cur[i] * this.cur[i];
    return e;
  }

  reset() { this.cur.fill(0); this.prev.fill(0); }
}
