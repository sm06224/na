/* ============================================================
   窟 — 鑑定。潜行ごとに、薬・巻物・杖・指輪の「見た目」を種で入れ替える。
   青い薬がいつも回復とは限らない——使うか、鑑定の巻物で正体が知れる。
   ============================================================ */

import { APPEARANCE, itemKeysByCategory } from './itemdb.js';

export class IdStore {
  constructor(rng) {
    this.appearance = {};   // defKey -> 見た目
    this.known = {};        // defKey -> true（正体が知れた）
    this.tried = {};        // defKey -> true（一度使った）
    for (const cat of Object.keys(APPEARANCE)) {
      const keys = itemKeysByCategory(cat);
      const looks = rng.shuffle(APPEARANCE[cat].slice());
      keys.forEach((k, i) => { this.appearance[k] = looks[i % looks.length]; });
    }
  }
  appearanceOf(cat, key) { return this.appearance[key] || ''; }
  isKnown(cat, key) { return !!this.known[key]; }
  learn(key) { this.known[key] = true; }
  markTried(key) { this.tried[key] = true; }
  wasTried(key) { return !!this.tried[key]; }

  serialize() { return { appearance: this.appearance, known: this.known, tried: this.tried }; }
  static deserialize(o) {
    const s = Object.create(IdStore.prototype);
    s.appearance = o.appearance || {}; s.known = o.known || {}; s.tried = o.tried || {};
    return s;
  }
}
