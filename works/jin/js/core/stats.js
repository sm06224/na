/* ============================================================
   陣 — 能力値と、その育ち。
   HP・力・魔・技・速・運・守・魔防、そして移動。
   経験を得れば上がり、上がり方（成長率）は職と素質で決まる。決定的。
   ============================================================ */

export const STAT_KEYS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'];
export const STAT_NAMES = {
  hp: 'HP', str: '力', mag: '魔', skl: '技', spd: '速', lck: '運', def: '守', res: '魔防', mov: '移動',
};

export function zeroStats() {
  const s = {};
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}
export function cloneStats(s) {
  const o = {};
  for (const k of STAT_KEYS) o[k] = s[k] | 0;
  return o;
}
export function addStats(a, b) {
  const o = {};
  for (const k of STAT_KEYS) o[k] = (a[k] | 0) + (b[k] | 0);
  return o;
}
export function capStats(s, caps) {
  const o = {};
  for (const k of STAT_KEYS) o[k] = Math.min(s[k] | 0, caps ? (caps[k] ?? 99) : 99);
  return o;
}

/* レベルアップ：成長率（%）を rng でロールし、上がった分を返す。
   100% を超える率は確定＋余りをロール。決定的。 */
export function rollLevelUp(growths, rng, caps, current) {
  const gain = zeroStats();
  for (const k of STAT_KEYS) {
    let rate = growths[k] || 0;
    while (rate >= 100) { gain[k] += 1; rate -= 100; }
    if (rng.roll(rate)) gain[k] += 1;
    // 上限で頭打ち
    if (caps && current) {
      const room = (caps[k] ?? 99) - (current[k] | 0);
      if (gain[k] > room) gain[k] = Math.max(0, room);
    }
  }
  return gain;
}

/* 必要経験：レベルに対して緩やかに増える */
export function expToLevel(level) {
  return Math.round(20 + level * 6 + level * level * 0.6);
}

/* 戦闘で得る経験（FE 風：相手とのレベル差で増減、撃破で加算） */
export function battleExp(attacker, defender, killed) {
  const lv = (attacker.level || 1) + (attacker.tierBonus || 0);
  const dlv = (defender.level || 1) + (defender.tierBonus || 0);
  let base = Math.max(1, Math.round(20 + (dlv - lv) * 3));
  if (killed) {
    const killBonus = Math.max(20, Math.round(30 + (dlv - lv) * 5 + (defender.boss ? 40 : 0)));
    base += killBonus;
  }
  return Math.max(1, Math.min(100, base));
}
