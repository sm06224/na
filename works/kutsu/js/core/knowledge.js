/* ============================================================
   窟 — 知ったことの記録。出会った魔物・倒した数を覚える（鑑識帳）。
   品物の正体は IdStore が、地形と魔物の知見はここが持つ。
   ============================================================ */

export class Knowledge {
  constructor() { this.monsters = {}; this.deepest = 1; }

  monster(key) { return this.monsters[key] || (this.monsters[key] = { seen: 0, slain: 0 }); }
  see(key) { if (key) this.monster(key).seen++; }
  slay(key) { if (key) this.monster(key).slain++; }
  encountered() { return Object.keys(this.monsters); }
  total() {
    let seen = 0, slain = 0;
    for (const k of Object.keys(this.monsters)) { seen += this.monsters[k].seen ? 1 : 0; slain += this.monsters[k].slain; }
    return { kinds: seen, slain };
  }
  serialize() { return { monsters: this.monsters, deepest: this.deepest }; }
  static deserialize(o) { const k = new Knowledge(); k.monsters = o.monsters || {}; k.deepest = o.deepest || 1; return k; }
}
