/* ============================================================
   窟 — 技（active abilities）。冒険者の「型」ごとに使える特技。
   気力（focus）を費やして放つ。歩くごとに気力は少し戻る。
   ============================================================ */

import { applyStatus } from './status.js';
import { rangedHit } from './combat.js';
import { DIR8 } from './util.js';

/* まっすぐな筋を引き、最初に当たる役者を返す */
function boltTarget(game, user, dx, dy, range) {
  let x = user.x, y = user.y;
  const path = [];
  for (let i = 0; i < range; i++) {
    x += dx; y += dy;
    if (!game.level.inBounds(x, y)) break;
    path.push({ x, y });
    const a = game.board.actorAt(x, y);
    if (a && a !== user && a.alive) return { actor: a, path };
    if (!game.level.clearTile(x, y)) break;
  }
  return { actor: null, path };
}

const AB = {};
function ab(key, def) { AB[key] = { key, ...def }; }

/* ---- 戦士 ---- */
ab('cleave', {
  name: '薙ぎ払い', focus: 3, targeted: false,
  desc: '隣り合う敵すべてに一撃。',
  use(game) {
    let hit = 0;
    for (const d of DIR8) {
      const a = game.board.actorAt(game.player.x + d.x, game.player.y + d.y);
      if (a && a.alive && a.faction === 'monster') { game.attack(game.player, a); hit++; }
    }
    if (!hit) game.message('まわりに敵はいない。');
    return true;
  },
});
ab('warcry', {
  name: '雄叫び', focus: 4, targeted: false,
  desc: 'まわりの魔物を怯えさせ、自らを鼓舞する。',
  use(game) {
    game.frightenNearby(6);
    applyStatus(game.player, 'might', 12);
    game.message('腹の底から雄叫びをあげた！');
    return true;
  },
});
ab('bulwark', {
  name: '鉄壁', focus: 3, targeted: false,
  desc: 'しばし防御を固める。',
  use(game) { applyStatus(game.player, 'fortify', 12, 4); game.message('身構えた。守りが固くなる。'); return true; },
});

/* ---- 魔術師 ---- */
ab('firebolt', {
  name: '火球', focus: 4, targeted: true,
  desc: '炎の塊を放つ。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 8);
    game.flashBolt(path, 'firebolt');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '3d4', element: 'fire' }); game.message(`火球が${actor.name}を焼いた（${r.damage}）。`, 'good'); if (!r.killed && game.rng.oneIn(3)) applyStatus(actor, 'burning', 3, 2); }
    else game.message('火球は壁に弾けた。');
    return true;
  },
});
ab('frostbolt', {
  name: '氷弾', focus: 4, targeted: true,
  desc: '凍てつく弾を放ち、鈍らせる。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 8);
    game.flashBolt(path, 'frostbolt');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '2d5', element: 'frost' }); game.message(`氷弾が${actor.name}を打った（${r.damage}）。`, 'good'); if (!r.killed) applyStatus(actor, 'slow', 8); }
    else game.message('氷弾は砕け散った。');
    return true;
  },
});
ab('blink', {
  name: '瞬歩', focus: 3, targeted: false,
  desc: '近くへ瞬間移動する。',
  use(game) {
    const p = game.player;
    for (let i = 0; i < 30; i++) {
      const x = p.x + game.rng.range(-5, 5), y = p.y + game.rng.range(-5, 5);
      if (game.board.passable(x, y) && !game.level.prop(x, y).deadly) { game.board.moveActor(p, x, y); game.recomputeDist(); game.recomputeFOV(); game.message('景色がずれた。'); return true; }
    }
    game.message('瞬歩は不発に終わった。');
    return true;
  },
});
ab('wardshield', {
  name: '魔法の盾', focus: 4, targeted: false,
  desc: '魔力の膜で身を守る。',
  use(game) { applyStatus(game.player, 'fortify', 16, 5); game.message('淡い光の膜が身を包んだ。'); return true; },
});

/* ---- 盗賊 ---- */
ab('sneak', {
  name: '忍び足', focus: 3, targeted: false,
  desc: 'しばし姿を隠す。',
  use(game) { applyStatus(game.player, 'invisible', 14); game.message('影に溶け込んだ。'); return true; },
});
ab('dagger_throw', {
  name: '投げ刃', focus: 2, targeted: true,
  desc: '隠し刃を投げ打つ。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 6);
    game.flashBolt(path, 'magicmissile');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '2d4' }); game.message(`刃が${actor.name}に突き立った（${r.damage}）。`, 'good'); }
    else game.message('刃は虚しく床に落ちた。');
    return true;
  },
});

/* ---- 狩人 ---- */
ab('aimed_shot', {
  name: '狙撃', focus: 3, targeted: true,
  desc: '狙いすまして射る。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 9);
    game.flashBolt(path, 'magicmissile');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '2d6' }); game.message(`矢が${actor.name}を射抜いた（${r.damage}）。`, 'good'); }
    else game.message('矢は外れた。');
    return true;
  },
});
ab('herbal', {
  name: '薬草', focus: 4, targeted: false,
  desc: '手当てして傷を癒す。',
  use(game) { const n = game.healActor(game.player, game.rng.dice('2d6')); game.message(`薬草で手当てした（+${n}）。`, 'good'); return true; },
});

/* ---- 僧侶 ---- */
ab('smite', {
  name: '裁き', focus: 4, targeted: true,
  desc: '聖なる光で打つ。不死には効きめ大。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 7);
    game.flashBolt(path, 'magicmissile');
    if (actor) {
      let dmg = game.rng.dice('2d5');
      if (actor.hasTag && actor.hasTag('undead')) dmg = Math.round(dmg * 1.6);
      game.hurt(actor, dmg, game.player);
      game.message(`聖光が${actor.name}を裁いた（${dmg}）。`, 'good');
    } else game.message('光は虚空へ消えた。');
    return true;
  },
});
ab('mend', {
  name: '癒し', focus: 5, targeted: false,
  desc: '深い傷を癒し、淀みを払う。',
  use(game) {
    const n = game.healActor(game.player, game.rng.dice('3d6'));
    if (game.player.hasStatus('poison')) { game.player.statuses = game.player.statuses.filter(s => s.type !== 'poison'); }
    game.message(`祈りが傷を癒した（+${n}）。`, 'good');
    return true;
  },
});
ab('bless', {
  name: '祝福', focus: 4, targeted: false,
  desc: 'しばし守りと力を授かる。',
  use(game) { applyStatus(game.player, 'fortify', 14, 3); applyStatus(game.player, 'might', 14); game.message('淡い光に包まれた。'); return true; },
});
ab('turn_undead', {
  name: '退魔', focus: 4, targeted: false,
  desc: 'まわりの不死を怯えさせる。',
  use(game) {
    let n = 0;
    for (const m of game.board.monsters()) if (game.chebToPlayer(m.x, m.y) <= 6 && m.hasTag && m.hasTag('undead')) { applyStatus(m, 'fear', game.rng.range(8, 14)); n++; }
    game.message(n ? '不死どもが怯えて退いた！' : 'まわりに不死はいない。');
    return true;
  },
});

/* ---- 共通の追補 ---- */
ab('quake', {
  name: '震脚', focus: 5, targeted: false,
  desc: '足を踏み鳴らし、隣の敵すべてを揺さぶる。',
  use(game) {
    let n = 0;
    for (const d of DIR8) {
      const a = game.board.actorAt(game.player.x + d.x, game.player.y + d.y);
      if (a && a.alive && a.faction === 'monster') { const dmg = game.rng.dice('1d6'); game.hurt(a, dmg, game.player); if (a.alive && game.rng.oneIn(2)) applyStatus(a, 'stun', 1); n++; }
    }
    game.message(n ? '地が鳴り、敵がよろめいた！' : 'まわりに敵はいない。');
    return true;
  },
});
ab('volley', {
  name: '連射', focus: 5, targeted: true,
  desc: '直線上の敵を続けざまに射る。',
  use(game, { dx, dy }) {
    let x = game.player.x, y = game.player.y, hit = 0;
    const path = [];
    for (let i = 0; i < 9; i++) {
      x += dx; y += dy;
      if (!game.level.inBounds(x, y)) break;
      path.push({ x, y });
      const a = game.board.actorAt(x, y);
      if (a && a.alive && a.faction === 'monster') { const r = rangedHit(game, game.player, a, { damage: '1d6' }); hit++; if (r.killed) continue; }
      if (!game.level.clearTile(x, y)) break;
    }
    game.flashBolt(path, 'magicmissile');
    game.message(hit ? `${hit} 体を射抜いた。` : '矢は誰にも当たらなかった。', hit ? 'good' : 'info');
    return true;
  },
});

/* ---- 上位の技 ---- */
ab('shieldwall', {
  name: '盾の壁', focus: 5, targeted: false,
  desc: '渾身で守りを固める（長く・強く）。',
  use(game) { applyStatus(game.player, 'fortify', 20, 6); game.message('鉄壁の構え。'); return true; },
});
ab('icelance', {
  name: '氷槍', focus: 6, targeted: true,
  desc: '貫く氷の槍。当たれば凍てつく。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 9);
    game.flashBolt(path, 'frostbolt');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '3d5', element: 'frost' }); game.message(`氷槍が${actor.name}を貫いた（${r.damage}）。`, 'good'); if (!r.killed) applyStatus(actor, 'slow', 10); }
    else game.message('氷槍は砕けた。');
    return true;
  },
});
ab('shadowstep', {
  name: '影渡り', focus: 5, targeted: false,
  desc: '影を渡り、姿を消す。',
  use(game) {
    const p = game.player;
    for (let i = 0; i < 30; i++) { const x = p.x + game.rng.range(-6, 6), y = p.y + game.rng.range(-6, 6); if (game.board.passable(x, y) && !game.level.prop(x, y).deadly) { game.board.moveActor(p, x, y); game.recomputeDist(); game.recomputeFOV(); break; } }
    applyStatus(p, 'invisible', 10);
    game.message('影に溶けて、別の影から現れた。');
    return true;
  },
});
ab('snipe', {
  name: '一矢', focus: 4, targeted: true,
  desc: '渾身の一矢を放つ。',
  use(game, { dx, dy }) {
    const { actor, path } = boltTarget(game, game.player, dx, dy, 10);
    game.flashBolt(path, 'magicmissile');
    if (actor) { const r = rangedHit(game, game.player, actor, { damage: '3d5' }); game.message(`渾身の一矢が${actor.name}を射抜いた（${r.damage}）。`, 'good'); }
    else game.message('一矢は虚空を切った。');
    return true;
  },
});

export function getAbility(key) { return AB[key]; }
export function allAbilities() { return Object.values(AB); }
