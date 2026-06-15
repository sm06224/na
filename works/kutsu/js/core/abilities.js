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

export function getAbility(key) { return AB[key]; }
export function allAbilities() { return Object.values(AB); }
