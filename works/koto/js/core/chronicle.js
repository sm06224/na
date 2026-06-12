/* ============================================================
   言語史 — 言葉の発生・死・意味のずれ・方言の分岐・借用の記録。
   この年表が、この作品の「出力」そのものでもある。
   ============================================================ */

export const EV = {
  GENESIS: 'genesis',       // 民の出現
  BIRTH: 'birth',           // 新語の発生
  DEATH: 'death',           // 死語
  SHIFT: 'shift',           // 意味の変化
  SPLIT: 'split',           // 方言の分岐
  BORROW: 'borrow',         // 借用
  DEMEDEATH: 'demedeath',   // 言語の死（群の消滅）
  WORLDEVENT: 'worldevent', // 世界事件
};

export const MAJOR = new Set([
  EV.GENESIS, EV.BIRTH, EV.DEATH, EV.SPLIT, EV.DEMEDEATH,
]);

export class Chronicle {
  constructor() { this.entries = []; }

  add(year, kind, text, opts = {}) {
    this.entries.push({ year, kind, text, ...opts });
    if (this.entries.length > 6000) this.entries.splice(0, this.entries.length - 6000);
  }
  recent(n) { return this.entries.slice(-n); }
  byKind(kind) { return this.entries.filter(e => e.kind === kind); }
  ofDeme(demeId, n = 14) {
    const out = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < n; i--) {
      if (this.entries[i].demeId === demeId) out.push(this.entries[i]);
    }
    return out;
  }
}
