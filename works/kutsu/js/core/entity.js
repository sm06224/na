/* ============================================================
   窟 — 実体。迷宮に住むもの：人・魔物・品物・仕掛け。

   役者（Actor）は体力と stats を持ち、エネルギーで順に動く。
   品物（Item）は床にも鞄にも在る。仕掛け（Feature）は罠や泉。
   ============================================================ */

let _id = 1;
export function nextId() { return _id++; }
export function resetIds(n = 1) { _id = n; }

/* ----- 役者（player / monster） ----- */
export class Actor {
  constructor(o = {}) {
    this.id = o.id ?? nextId();
    this.kind = 'actor';
    this.x = o.x ?? 0; this.y = o.y ?? 0;
    this.name = o.name ?? '何か';
    this.glyph = o.glyph ?? '?';
    this.color = o.color ?? '#ccc';
    this.faction = o.faction ?? 'monster';   // player / monster / neutral
    this.defId = o.defId ?? null;             // monsterdb のキー

    this.maxhp = o.maxhp ?? 10;
    this.hp = o.hp ?? this.maxhp;
    this.stats = Object.assign({ str: 2, def: 0, acc: 2, eva: 1, speed: 100 }, o.stats || {});

    this.energy = o.energy ?? 0;
    this.statuses = o.statuses ? o.statuses.map(s => ({ ...s })) : [];
    this.flags = Object.assign({ sleeping: false, seen: false }, o.flags || {});

    this.ai = o.ai ?? 'melee';                // 行動の型
    this.aiState = o.aiState ?? {};
    this.sight = o.sight ?? 8;
    this.xpValue = o.xpValue ?? 0;            // 倒したときの経験

    this.inv = o.inv || [];                   // 持ち物（Item[]）
    this.equip = o.equip || {};               // slot -> Item
    this.naturalDamage = o.naturalDamage ?? '1d3';
    this.resist = o.resist || {};             // {fire:0.5,...}
    this.drops = o.drops || null;             // 落とし物テーブル
    this.tags = o.tags || [];                 // 'undead','animal','flying'...
    this.speedBase = this.stats.speed;
  }

  get alive() { return this.hp > 0; }
  get isPlayer() { return this.faction === 'player'; }

  hasStatus(type) { return this.statuses.some(s => s.type === type); }
  getStatus(type) { return this.statuses.find(s => s.type === type); }
  hasTag(t) { return this.tags.includes(t); }

  /* 現在の速さ（状態異常で変わる） */
  get speed() {
    let sp = this.stats.speed;
    if (this.hasStatus('haste')) sp = Math.round(sp * 1.6);
    if (this.hasStatus('slow')) sp = Math.round(sp * 0.6);
    if (this.hasStatus('web')) sp = Math.round(sp * 0.5);
    return Math.max(20, sp);
  }

  serialize() {
    return {
      id: this.id, x: this.x, y: this.y, name: this.name, glyph: this.glyph, color: this.color,
      faction: this.faction, defId: this.defId, maxhp: this.maxhp, hp: this.hp, stats: this.stats,
      energy: this.energy, statuses: this.statuses, flags: this.flags, ai: this.ai, aiState: this.aiState,
      sight: this.sight, xpValue: this.xpValue, inv: this.inv.map(i => i.serialize()),
      equip: Object.fromEntries(Object.entries(this.equip).map(([k, v]) => [k, v && v.serialize()])),
      naturalDamage: this.naturalDamage, resist: this.resist, drops: this.drops, tags: this.tags,
    };
  }
  static deserialize(o, ItemClass) {
    const a = new Actor({ ...o, inv: [], equip: {} });
    a.inv = (o.inv || []).map(i => ItemClass.deserialize(i));
    a.equip = {};
    for (const [k, v] of Object.entries(o.equip || {})) a.equip[k] = v ? ItemClass.deserialize(v) : null;
    return a;
  }
}

/* ----- 仕掛け（罠など、盤の上の点） ----- */
export class Feature {
  constructor(o = {}) {
    this.id = o.id ?? nextId();
    this.kind = 'feature';
    this.x = o.x; this.y = o.y;
    this.type = o.type;            // 'trap' など
    this.subtype = o.subtype;      // 'dart','pit','fire'...
    this.known = o.known ?? false;
    this.armed = o.armed ?? true;
    this.data = o.data || {};
  }
  serialize() { return { id: this.id, x: this.x, y: this.y, type: this.type, subtype: this.subtype, known: this.known, armed: this.armed, data: this.data }; }
  static deserialize(o) { return new Feature(o); }
}
