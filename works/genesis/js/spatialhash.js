import { wrapPos } from './util.js';

/* 空間ハッシュ — 近傍探索を O(1) 近くにするための格子。
   トーラス世界なので、格子座標も端でつながる。 */
export class SpatialHash {
  constructor(worldSize, cellSize) {
    this.size = worldSize;
    this.cell = cellSize;
    this.n = Math.max(1, Math.round(worldSize / cellSize));
    this.map = new Map();
  }
  clear() { this.map.clear(); }

  _key(cx, cy) { return cx * 4096 + cy; }

  insert(item) {
    const cx = Math.floor(wrapPos(item.x, this.size) / this.cell) % this.n;
    const cy = Math.floor(wrapPos(item.y, this.size) / this.cell) % this.n;
    const k = this._key(cx, cy);
    let bucket = this.map.get(k);
    if (!bucket) { bucket = []; this.map.set(k, bucket); }
    bucket.push(item);
  }

  /* (x,y) を中心に半径 r 内に「ありうる」候補を out に集める。
     呼び出し側がトーラス距離で厳密にフィルタすること。 */
  query(x, y, r, out) {
    out.length = 0;
    const c0x = Math.floor((x - r) / this.cell);
    const c1x = Math.floor((x + r) / this.cell);
    const c0y = Math.floor((y - r) / this.cell);
    const c1y = Math.floor((y + r) / this.cell);
    // r が世界の半分を超えると同じセルを二度見してしまうので上限を仮定
    for (let cx = c0x; cx <= c1x; cx++) {
      const wcx = ((cx % this.n) + this.n) % this.n;
      for (let cy = c0y; cy <= c1y; cy++) {
        const wcy = ((cy % this.n) + this.n) % this.n;
        const bucket = this.map.get(this._key(wcx, wcy));
        if (bucket) for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  }
}
