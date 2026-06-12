/* ============================================================
   時代 — 文明は石を磨き、銅を吹き、鉄を打ち、書を編む。
   時代が進むほど都市は大きく、軍は強く、世界は速くなる。
   ============================================================ */

export const ERAS = ['石器', '青銅', '鉄器', '古典', '中世'];

/* 都市の人口上限・軍の強さに掛かる係数 */
export const ERA_MULT = [1, 1.5, 2.1, 3.0, 4.2];

/* この蓄積を超えると次の時代へ */
export const TECH_THRESHOLD = [0, 12, 35, 80, 150];

export function maxEra() { return ERAS.length - 1; }

/* 1 年ぶんの技術の蓄積。人と交易が知を運ぶ。 */
export function techGain(totalPop, externalTradeLinks) {
  return totalPop / 6000 + externalTradeLinks * 0.06;
}

export function eraForTech(tech) {
  let era = 0;
  for (let i = 0; i < TECH_THRESHOLD.length; i++) {
    if (tech >= TECH_THRESHOLD[i]) era = i;
  }
  return era;
}
