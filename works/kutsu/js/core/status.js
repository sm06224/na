/* ============================================================
   窟 — 状態異常。毒・炎上・再生・混乱・麻痺・恐慌・気絶・浮遊・
   千里眼・剛力・盲目・蜘蛛の巣・吸われ。毎ターン頭で効く。
   ============================================================ */

export const STATUS = {
  poison: { name: '毒', bad: true, tick: (g, a, s) => g.hurt(a, s.power, '毒') },
  burning: { name: '炎上', bad: true, tick: (g, a, s) => g.hurt(a, s.power, '炎'), resist: 'fire' },
  bleed: { name: '出血', bad: true, tick: (g, a, s) => g.hurt(a, s.power, '出血') },
  regen: { name: '再生', bad: false, tick: (g, a, s) => g.healActor(a, s.power) },
  confuse: { name: '混乱', bad: true },
  paralyze: { name: '麻痺', bad: true },
  stun: { name: '気絶', bad: true },
  fear: { name: '恐慌', bad: true },
  haste: { name: '俊足', bad: false },
  slow: { name: '鈍足', bad: true },
  might: { name: '剛力', bad: false },
  fortify: { name: '鉄壁', bad: false },
  levitation: { name: '浮遊', bad: false },
  telepathy: { name: '千里眼', bad: false },
  blind: { name: '盲目', bad: true },
  web: { name: '蜘蛛の巣', bad: true },
  invisible: { name: '透明', bad: false },
};

export function statusName(type) { return (STATUS[type] || {}).name || type; }

/* 付与（同じものは長い方／強い方に更新） */
export function applyStatus(actor, type, turns, power = 1) {
  const ex = actor.statuses.find(s => s.type === type);
  if (ex) { ex.turns = Math.max(ex.turns, turns); ex.power = Math.max(ex.power, power); return ex; }
  const s = { type, turns, power };
  actor.statuses.push(s);
  return s;
}
export function removeStatus(actor, type) {
  actor.statuses = actor.statuses.filter(s => s.type !== type);
}
export function clearBadStatuses(actor) {
  actor.statuses = actor.statuses.filter(s => !(STATUS[s.type] && STATUS[s.type].bad));
}

/* 毎ターンの頭で呼ぶ。毒で死ぬこともある。 */
export function tickStatuses(game, actor) {
  for (const s of actor.statuses.slice()) {
    const def = STATUS[s.type];
    if (def && def.tick && actor.alive) {
      // 耐性があれば軽減
      let st = { ...s };
      if (def.resist && actor._resist && actor._resist[def.resist]) st.power = Math.max(0, Math.round(s.power * (1 - actor._resist[def.resist])));
      if (st.power > 0) def.tick(game, actor, st);
    }
    s.turns--;
    if (s.turns <= 0) {
      removeStatus(actor, s.type);
      if (actor.isPlayer) game.log(`${statusName(s.type)}が解けた。`);
    }
  }
}

/* 行動を奪う状態か（麻痺・気絶） */
export function isHelpless(actor) {
  return actor.hasStatus('paralyze') || actor.hasStatus('stun');
}
