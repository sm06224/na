/* ============================================================
   陣 — 戦場（ボード）。地形の盤の上に、ユニットが立つ。
   占有・移動・地形参照・経路コストの面倒を、ここがまとめて見る。
   ============================================================ */

import { Grid, key, manhattan } from './grid.js';
import { terrainOf, moveCost } from './terrain.js';
import { isAlive, hasSkill } from './unit.js';

export class Board {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.terrain = new Grid(w, h, 'plain');
    this.units = [];
    this.objectives = [];     // [{type, ...}]
    this.byPos = new Map();   // "x,y" -> unit
    this.escapeTiles = [];    // [{x,y}]
  }
  setTerrain(x, y, id) { this.terrain.set(x, y, id); }
  terrainAt(x, y) { return terrainOf(this.terrain.get(x, y) || 'plain'); }
  inBounds(x, y) { return this.terrain.inBounds(x, y); }

  rebuildIndex() {
    this.byPos.clear();
    for (const u of this.units) if (isAlive(u) && u.pos) this.byPos.set(key(u.pos.x, u.pos.y), u);
  }
  add(u, x, y) {
    if (x != null) u.pos = { x, y };
    this.units.push(u);
    if (u.pos) this.byPos.set(key(u.pos.x, u.pos.y), u);
    return u;
  }
  unitAt(x, y) { const u = this.byPos.get(key(x, y)); return u && isAlive(u) ? u : null; }
  occupied(x, y) { return !!this.unitAt(x, y); }
  moveUnit(u, x, y) {
    if (u.pos) this.byPos.delete(key(u.pos.x, u.pos.y));
    u.pos = { x, y };
    this.byPos.set(key(x, y), u);
  }
  remove(u) {
    if (u.pos) this.byPos.delete(key(u.pos.x, u.pos.y));
  }
  alliesAreEnemies(a, b) {
    if (a === b) return false;
    return a.side !== b.side && !(a.side === 'player' && b.side === 'ally') && !(a.side === 'ally' && b.side === 'player');
  }
  unitsOf(side) { return this.units.filter(u => isAlive(u) && u.side === side); }
  enemiesOf(u) { return this.units.filter(o => isAlive(o) && this.alliesAreEnemies(u, o)); }
  alliesOf(u) { return this.units.filter(o => isAlive(o) && o !== u && !this.alliesAreEnemies(u, o)); }

  /* このユニットにとっての進入コスト（地形＋移動方式＋翼） */
  costForUnit(u, x, y) {
    if (!this.inBounds(x, y)) return Infinity;
    const tid = this.terrain.get(x, y);
    const flier = u.mode === 'fly' || hasSkill(u, 'wing');
    if (flier) {
      const t = terrainOf(tid);
      if (t.id === 'wall') return Infinity;
      return 1;
    }
    return moveCost(tid, 'foot');
  }
  /* 敵ユニットがいるマスは通り抜けられない（味方はすり抜けOK） */
  blockedForUnit(u, x, y) {
    const o = this.unitAt(x, y);
    return !!o && this.alliesAreEnemies(u, o);
  }
}
