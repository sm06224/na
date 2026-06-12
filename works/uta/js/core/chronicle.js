/* ============================================================
   歌史 — 歌の誕生・忘却・変奏・転用・分派・流行の記録。
   この年表が、この作品の「楽譜の余白」に書かれる物語。
   ============================================================ */

export const EV = {
  GENESIS: 'genesis',         // 民の出現
  BIRTH: 'birth',             // 歌の誕生
  DEATH: 'death',             // 忘却（歌の死）
  VAR: 'var',                 // 変奏（節回しが変わる）
  SHIFT: 'shift',             // 転用（場を移る）
  SPLIT: 'split',             // 分派（節回しの方言の誕生）
  SPREAD: 'spread',           // 流行（歌が群を越える）
  FLOCKDEATH: 'flockdeath',   // 沈黙（群の消滅）
  WORLDEVENT: 'worldevent',   // 世界事件
};

export const MAJOR = new Set([
  EV.GENESIS, EV.BIRTH, EV.DEATH, EV.SPLIT, EV.FLOCKDEATH,
]);

export class Chronicle {
  constructor() { this.entries = []; }

  add(year, kind, text, opts = {}) {
    this.entries.push({ year, kind, text, ...opts });
    if (this.entries.length > 6000) this.entries.splice(0, this.entries.length - 6000);
  }
  recent(n) { return this.entries.slice(-n); }
  byKind(kind) { return this.entries.filter(e => e.kind === kind); }
  ofFlock(flockId, n = 14) {
    const out = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < n; i--) {
      if (this.entries[i].flockId === flockId) out.push(this.entries[i]);
    }
    return out;
  }
}
