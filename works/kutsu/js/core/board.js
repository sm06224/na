/* ============================================================
   窟 — 盤。ひとつの階の「いま」：地形＋役者＋床の品物＋仕掛け。
   占有・視界・近さの問い合わせはここに集める。
   ============================================================ */

import { keyOf } from './util.js';
import { isWalkable, isClear, T } from './tile.js';

/* aiState の中の盗品（Item）だけ畳む */
function serializeAiState(st) {
  if (!st) return {};
  const out = { ...st };
  if (st.loot && typeof st.loot.serialize === 'function') out.loot = { __item: st.loot.serialize() };
  return out;
}

export class Board {
  constructor(level) {
    this.level = level;
    this.actors = [];          // Actor[]
    this.items = [];           // Item[]（床に落ちている）
    this.features = [];        // Feature[]（罠など）
    this._occ = new Map();     // "x,y" -> Actor
  }

  get w() { return this.level.w; }
  get h() { return this.level.h; }

  /* 占有の索引を作り直す */
  reindex() {
    this._occ.clear();
    for (const a of this.actors) if (a.alive) this._occ.set(keyOf(a.x, a.y), a);
  }

  actorAt(x, y) { return this._occ.get(keyOf(x, y)) || null; }
  setOcc(a, x, y) { this._occ.delete(keyOf(a.x, a.y)); this._occ.set(keyOf(x, y), a); }

  addActor(a) { this.actors.push(a); if (a.alive) this._occ.set(keyOf(a.x, a.y), a); return a; }
  removeActor(a) {
    const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1);
    if (this._occ.get(keyOf(a.x, a.y)) === a) this._occ.delete(keyOf(a.x, a.y));
  }
  moveActor(a, x, y) { this._occ.delete(keyOf(a.x, a.y)); a.x = x; a.y = y; this._occ.set(keyOf(x, y), a); }

  monsters() { return this.actors.filter(a => a.faction === 'monster' && a.alive); }

  /* 地形が歩けて、役者がいなければ通れる */
  passable(x, y, ignore) {
    if (!this.level.walkable(x, y)) return false;
    const a = this.actorAt(x, y);
    return !a || a === ignore || !a.alive;
  }
  /* 経路探索用：役者を見ない地形だけの通過判定 */
  terrainPassable(x, y) { return this.level.walkable(x, y); }
  transparent(x, y) { return this.level.clearTile(x, y); }

  /* 床の品物 */
  itemsAt(x, y) { return this.items.filter(it => it.x === x && it.y === y); }
  addItem(it, x, y) { if (x != null) { it.x = x; it.y = y; } this.items.push(it); return it; }
  removeItem(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); }

  /* 仕掛け */
  featureAt(x, y) { return this.features.find(f => f.x === x && f.y === y) || null; }
  addFeature(f) { this.features.push(f); return f; }

  /* 保存：地形・床の品・仕掛け・魔物（プレイヤーは別途） */
  serialize() {
    return {
      level: this.level.serialize(),
      items: this.items.map(i => i.serialize()),
      features: this.features.map(f => f.serialize()),
      monsters: this.actors.filter(a => a.faction !== 'player').map(a => ({
        defId: a.defId, id: a.id, x: a.x, y: a.y, hp: a.hp, maxhp: a.maxhp,
        energy: a.energy, statuses: a.statuses, flags: a.flags,
        aiState: serializeAiState(a.aiState), faction: a.faction, ai: a.ai, peaceful: a.peaceful,
      })),
    };
  }

  /* 近くの空いた歩けるマス（召喚・落とし物の押し出しに） */
  freeNear(x, y, rng, maxR = 4) {
    if (this.passable(x, y)) return { x, y };
    for (let r = 1; r <= maxR; r++) {
      const ring = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (this.passable(nx, ny)) ring.push({ x: nx, y: ny });
      }
      if (ring.length) return rng ? rng.pick(ring) : ring[0];
    }
    return null;
  }
}
