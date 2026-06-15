/* ============================================================
   窟 — 階層。ひとつの階の地形そのもの。

   タイルの格子と、各セルの覚え（見えた・照らされた・罠を知った）。
   魔物や品物は持たない——それは盤（board）の仕事。ここは大地だけ。
   ============================================================ */

import { T, tileProp, isWalkable, isClear, isStairs } from './tile.js';
import { DIR4, DIR8, connectedRegions } from './util.js';

/* セルの覚えのビット */
export const F = {
  DISCOVERED: 1,   // 一度でも見た（記憶に残る）
  VISIBLE: 2,      // いま視界内
  LIT: 4,          // 灯りが届く
  TRAP_KNOWN: 8,   // 罠の在り処を知った
  MAPPED: 16,      // 魔法で見えた（記憶のみ）
};

export class Level {
  constructor(w, h, depth = 1) {
    this.w = w; this.h = h;
    this.depth = depth;
    this.theme = 'cave';
    this.tiles = new Int16Array(w * h).fill(T.WALL);
    this.flags = new Uint8Array(w * h);
    this.stairsDown = null;
    this.stairsUp = null;
    this.entrance = null;      // 入ってくる位置（上り階段 or 既定）
    this.regionId = null;      // セル→領域番号（生成時に使う）
    this.meta = {};            // 生成器の覚え書き
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  get(x, y) { return this.inBounds(x, y) ? this.tiles[y * this.w + x] : T.VOID; }
  set(x, y, code) { if (this.inBounds(x, y)) this.tiles[y * this.w + x] = code; }

  /* 縁を必ず壁に（生成の最後に呼ぶと安全） */
  sealBorder() {
    for (let x = 0; x < this.w; x++) { this.set(x, 0, T.WALL); this.set(x, this.h - 1, T.WALL); }
    for (let y = 0; y < this.h; y++) { this.set(0, y, T.WALL); this.set(this.w - 1, y, T.WALL); }
  }

  walkable(x, y) { return this.inBounds(x, y) && isWalkable(this.get(x, y)); }
  clearTile(x, y) { return this.inBounds(x, y) && isClear(this.get(x, y)); }
  prop(x, y) { return tileProp(this.get(x, y)); }

  /* 周囲で壁の数（洞窟の整形に使う） */
  wallCount(x, y, r = 1) {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (!this.inBounds(x + dx, y + dy) || this.get(x + dx, y + dy) === T.WALL) n++;
    }
    return n;
  }

  neighbors4(x, y) { return DIR4.map(d => ({ x: x + d.x, y: y + d.y })).filter(p => this.inBounds(p.x, p.y)); }
  neighbors8(x, y) { return DIR8.map(d => ({ x: x + d.x, y: y + d.y })).filter(p => this.inBounds(p.x, p.y)); }

  /* 覚えのビット */
  flag(x, y, bit) { return this.inBounds(x, y) && (this.flags[y * this.w + x] & bit) !== 0; }
  setFlag(x, y, bit, on = true) {
    if (!this.inBounds(x, y)) return;
    const i = y * this.w + x;
    if (on) this.flags[i] |= bit; else this.flags[i] &= ~bit;
  }
  clearVisible() {
    for (let i = 0; i < this.flags.length; i++) this.flags[i] &= ~(F.VISIBLE | F.LIT);
  }

  /* 条件に合うタイルをすべて集める */
  findTiles(pred) {
    const out = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (pred(this.get(x, y), x, y)) out.push({ x, y });
    }
    return out;
  }

  /* 歩けるセルからひとつ無作為に */
  randomFloor(rng, tries = 500) {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(1, this.w - 2), y = rng.range(1, this.h - 2);
      if (this.walkable(x, y) && !isStairs(this.get(x, y))) return { x, y };
    }
    const all = this.findTiles((c, x, y) => this.walkable(x, y));
    return all.length ? rng.pick(all) : null;
  }

  /* 歩けるセルの連結成分（4 連結） */
  walkableRegions() {
    return connectedRegions(this.w, this.h, (x, y) => this.walkable(x, y), false);
  }

  /* いちばん大きい歩ける島だけ残し、ほかを壁で埋める */
  keepLargestRegion() {
    const regions = this.walkableRegions();
    if (regions.length <= 1) return regions[0] || [];
    regions.sort((a, b) => b.length - a.length);
    for (let r = 1; r < regions.length; r++) {
      for (const c of regions[r]) this.set(c.x, c.y, T.WALL);
    }
    return regions[0];
  }

  /* 保存・復元（決定的に同じ階へ戻れる） */
  serialize() {
    return {
      w: this.w, h: this.h, depth: this.depth, theme: this.theme,
      tiles: Array.from(this.tiles), flags: Array.from(this.flags),
      stairsDown: this.stairsDown, stairsUp: this.stairsUp, entrance: this.entrance, meta: this.meta,
    };
  }
  static deserialize(o) {
    const lv = new Level(o.w, o.h, o.depth);
    lv.theme = o.theme;
    lv.tiles = Int16Array.from(o.tiles);
    lv.flags = Uint8Array.from(o.flags);
    lv.stairsDown = o.stairsDown; lv.stairsUp = o.stairsUp; lv.entrance = o.entrance;
    lv.meta = o.meta || {};
    return lv;
  }

  /* デバッグ・テスト用の文字絵 */
  toText(mark) {
    let s = '';
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        s += (mark && mark(x, y)) || tileProp(this.get(x, y)).ch;
      }
      s += '\n';
    }
    return s;
  }
}
