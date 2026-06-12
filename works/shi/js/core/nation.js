import { eraForTech } from './tech.js';

/* ============================================================
   国 — 集落の上に立つ想像の共同体。
   王を戴き、時代を進め、戦い、そしていつか必ず滅びる。
   ============================================================ */

export class Nation {
  constructor(id, name, hue, capitalId, foundedYear, rulerNameStr) {
    this.id = id;
    this.name = name;
    this.hue = hue;               // 地図上の色
    this.capitalId = capitalId;
    this.founded = foundedYear;
    this.fallenAt = null;         // 滅亡した年（null = 健在）
    this.ruler = rulerNameStr;
    this.rulerSince = foundedYear;
    this.stability = 0.8;         // 0..1 低いと反乱が起きる
    this.tech = 0;
    this.wonderBuiltEra = -1;     // この時代に大事業を成したか
  }

  get era() { return eraForTech(this.tech); }

  cities(world) {
    return world.settlements.filter(s => s.nationId === this.id);
  }

  totalPop(world) {
    let p = 0;
    for (const s of world.settlements) if (s.nationId === this.id) p += s.pop;
    return p;
  }

  /* 軍事力 — 人口・時代・国内の安定が支える */
  strength(world) {
    const pop = this.totalPop(world);
    return Math.pow(pop, 0.9) * (1 + this.era * 0.35) * (0.4 + 0.6 * this.stability);
  }
}
