/* ============================================================
   窟 — 品物。武器・防具・薬・巻物・杖・指輪・食料・金。

   未鑑定のものは「見た目」だけ分かる（青い薬・「ゾフ」と書かれた巻物）。
   使うか鑑定すると正体が知れる。見た目は一回の潜行ごとに種で入れ替わる。
   ============================================================ */

import { nextId } from './entity.js';
import { getItemDef } from './itemdb.js';

export class Item {
  constructor(o = {}) {
    this.id = o.id ?? nextId();
    this.kind = 'item';
    this.x = o.x ?? 0; this.y = o.y ?? 0;
    this.def = o.def;                       // itemdb のキー
    this.count = o.count ?? 1;
    this.identified = o.identified ?? false;
    this.enchant = o.enchant ?? 0;          // 武具の +n
    this.charges = o.charges;               // 杖の残り
    this.appearance = o.appearance ?? null; // 未鑑定の見た目（type ごとに割当）
    this.cursed = o.cursed ?? false;
    this.known = o.known ?? { cursed: false };
    this.data = o.data || {};
  }

  get d() { return getItemDef(this.def) || {}; }
  get category() { return this.d.category; }
  get stackable() { return !!this.d.stackable; }
  get slot() { return this.d.slot; }

  /* 表示名（鑑定状況で変わる） */
  displayName(idStore) {
    const d = this.d;
    if (d.category === 'gold') return `金 ${this.count}`;
    const known = this.identified || (idStore && idStore.isKnown(d.category, this.def));
    let base;
    if (known) {
      base = d.name;
      if (d.enchantable) base = `${this.enchant >= 0 ? '+' : ''}${this.enchant} ${base}`;
      if (d.category === 'wand' && this.charges != null) base += `（残${this.charges}）`;
    } else {
      const app = idStore ? idStore.appearanceOf(d.category, this.def) : this.appearance;
      base = app ? `${app}の${categoryWord(d.category)}` : d.name;
    }
    if (this.count > 1 && this.stackable) base += ` ×${this.count}`;
    if (this.known.cursed && this.cursed) base += '（呪）';
    return base;
  }

  clone(count) {
    const c = new Item(this.serialize());
    c.id = nextId();
    if (count != null) c.count = count;
    return c;
  }

  serialize() {
    return {
      id: this.id, x: this.x, y: this.y, def: this.def, count: this.count, identified: this.identified,
      enchant: this.enchant, charges: this.charges, appearance: this.appearance, cursed: this.cursed,
      known: this.known, data: this.data,
    };
  }
  static deserialize(o) { return new Item(o); }
}

export function categoryWord(cat) {
  return {
    potion: '薬', scroll: '巻物', wand: '杖', ring: '指輪', weapon: '武器',
    armor: '防具', food: '食料', amulet: '護符', gold: '金',
  }[cat] || '品';
}
