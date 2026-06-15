/* ============================================================
   陣 — 状態（ステータス異常）。毒は蝕み、眠りは奪い、沈黙は封じる。
   ============================================================ */

export const STATUS = {
  poison: { name: '毒', desc: '毎ターン HP が減る。', color: '#7cae54' },
  sleep: { name: '眠り', desc: '行動できない。攻撃を受けると必中・必殺。', color: '#8a9ccc' },
  silence: { name: '沈黙', desc: '魔法と杖が使えない。', color: '#b07ccc' },
  berserk: { name: '狂乱', desc: '敵味方かまわず襲う。', color: '#cc6a5a' },
  freeze: { name: '凍結', desc: '動けない。', color: '#9cd0e4' },
};

export function addStatus(u, id, turns) {
  const ex = u.status.find(s => s.id === id);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else u.status.push({ id, turns });
}
export function hasStatus(u, id) { return u.status.some(s => s.id === id); }
export function clearStatus(u) { u.status = []; }

/* ターン頭の処理：毒のダメージ、残りターンの減少。events を返す。 */
export function tickStatus(u) {
  const events = [];
  let poisonDmg = 0;
  for (const s of u.status) {
    if (s.id === 'poison') {
      const d = Math.max(1, Math.floor(u.maxHp * 0.12));
      poisonDmg += d;
    }
  }
  if (poisonDmg > 0) {
    u.hp = Math.max(1, u.hp - poisonDmg);    // 毒では死なない（HP1 で止まる）
    events.push({ type: 'poison', uid: u.uid, dmg: poisonDmg });
  }
  for (const s of u.status) s.turns--;
  u.status = u.status.filter(s => s.turns > 0);
  return events;
}

export function canAct(u) {
  return !hasStatus(u, 'sleep') && !hasStatus(u, 'freeze');
}
export function canCast(u) {
  return !hasStatus(u, 'silence');
}
