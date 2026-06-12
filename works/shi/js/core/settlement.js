import { ERA_MULT } from './tech.js';

/* ============================================================
   集落 — 文明の細胞。生まれ、育ち、町になり、都になる。
   ============================================================ */

export const TIERS = ['集落', '村', '町', '都市', '大都'];

export class Settlement {
  constructor(id, name, x, y, founded, fertScore) {
    this.id = id;
    this.name = name;
    this.x = x; this.y = y;
    this.founded = founded;       // 建設された年
    this.fertScore = fertScore;   // 周辺の土地の恵み（建設時に計測）
    this.pop = 120;
    this.nationId = 0;            // 0 = 独立（どの国にも属さない）
    this.isCapital = false;
    this.wonders = [];            // 成った大事業の名
    this.plagueUntil = 0;         // この月まで疫病下
    this.lastSettler = 0;         // 入植隊を出した年（連発防止）
    this.tradeLinks = [];         // 交易相手の集落 id
  }

  /* 時代と気候で変わる人口の天井 */
  cap(era, climate) {
    return this.fertScore * 110 * ERA_MULT[era] * climate;
  }

  tier() {
    if (this.pop >= 9000) return 4;
    if (this.pop >= 3000) return 3;
    if (this.pop >= 1000) return 2;
    if (this.pop >= 350) return 1;
    return 0;
  }

  /* 1 か月の人口動態。疫病下では死が出生を上回る。 */
  stepMonth(era, climate, plagued) {
    const cap = this.cap(era, climate);
    let r = 0.0062 * (1 - this.pop / Math.max(cap, 1));
    if (plagued) r -= 0.035;
    this.pop = Math.max(0, this.pop + this.pop * r);
  }
}
