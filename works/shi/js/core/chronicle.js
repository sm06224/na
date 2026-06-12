/* ============================================================
   史書 — この世界の出来事は、すべてここに書かれる。
   シミュレーションの出力であり、この作品の本体でもある。
   ============================================================ */

export const KIND = {
  GENESIS: 'genesis',   // 創世
  FOUND: 'found',       // 集落の建設
  NATION: 'nation',     // 建国
  ERA: 'era',           // 時代の進歩
  WAR: 'war',           // 宣戦
  BATTLE: 'battle',     // 会戦・攻囲
  CONQUEST: 'conquest', // 都市の陥落
  PEACE: 'peace',       // 和平
  RULER: 'ruler',       // 王の代替わり
  REBEL: 'rebel',       // 反乱・独立
  FALL: 'fall',         // 国の滅亡
  PLAGUE: 'plague',     // 疫病
  DISASTER: 'disaster', // 天災
  WONDER: 'wonder',     // 大事業
  ANNEX: 'annex',       // 帰順・併合
};

/* 重大な出来事（年表のハイライトに使う） */
export const MAJOR = new Set([
  KIND.GENESIS, KIND.NATION, KIND.ERA, KIND.WAR, KIND.CONQUEST,
  KIND.PEACE, KIND.REBEL, KIND.FALL, KIND.PLAGUE, KIND.WONDER,
]);

export class Chronicle {
  constructor() {
    this.entries = [];
  }
  /* opts: { cityId, nationId, x, y } 位置があれば地図に印せる */
  add(year, kind, text, opts = {}) {
    this.entries.push({ year, kind, text, ...opts });
    if (this.entries.length > 5000) this.entries.splice(0, this.entries.length - 5000);
  }
  recent(n) { return this.entries.slice(-n); }
  ofCity(cityId, n = 12) {
    const out = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < n; i--) {
      if (this.entries[i].cityId === cityId) out.push(this.entries[i]);
    }
    return out;
  }
  majors() { return this.entries.filter(e => MAJOR.has(e.kind)); }
}
