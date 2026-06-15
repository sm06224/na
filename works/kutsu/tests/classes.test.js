import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { CLASSES, classKeys } from '../js/core/classes.js';
import { getAbility, allAbilities } from '../js/core/abilities.js';
import { effStats } from '../js/core/combat.js';
import { applyStatus } from '../js/core/status.js';
import { regenFocus } from '../js/core/player.js';
import { makeMonster } from '../js/core/factory.js';
import { T } from '../js/core/tile.js';
import * as A from '../js/core/actions.js';

function arena(game) {
  for (const m of game.board.monsters()) game.board.removeActor(m);
  const p = game.player;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < game.level.w - 1 && y < game.level.h - 1) game.level.set(x, y, T.FLOOR);
  }
  game.recomputeFOV(); game.recomputeDist();
}
function spawn(game, key, x, y) { const m = makeMonster(game.rng, key, x, y); m.flags.sleeping = false; m.hp = m.maxhp; game.board.addActor(m); return m; }

test('すべての型が遊べる：始まりの素質・装備・技が整う', () => {
  for (const key of classKeys()) {
    const g = new Game(1, { cls: key });
    const p = g.player;
    assert.equal(p.cls, key);
    assert.ok(p.hp > 0 && p.hp === p.maxhp);
    assert.ok(p.maxFocus > 0 && p.focus === p.maxFocus);
    assert.ok(p.abilities.length >= 2);
    assert.ok(p.equip.weapon, `${key} に武器が装備されていない`);
    for (const ak of p.abilities) assert.ok(getAbility(ak), `${key} の技 ${ak} が無い`);
  }
});

test('型の技はすべて登録済み', () => {
  const all = new Set(allAbilities().map(a => a.key));
  for (const c of Object.values(CLASSES)) for (const a of c.abilities) assert.ok(all.has(a), `${a} が無い`);
});

test('戦士の薙ぎ払い：隣の敵すべてに当たる', () => {
  const g = new Game(2, { cls: 'warrior' }); arena(g);
  const p = g.player;
  const a = spawn(g, 'rat', p.x + 1, p.y), b = spawn(g, 'rat', p.x - 1, p.y);
  const f0 = p.focus;
  A.useAbility(g, 'cleave');
  assert.ok(p.focus < f0, '気力が減っていない');
  assert.ok(a.hp < a.maxhp || !a.alive);
  assert.ok(b.hp < b.maxhp || !b.alive);
});

test('魔術師の火球：直線の敵を焼く。気力不足なら撃てない', () => {
  const g = new Game(3, { cls: 'mage' }); arena(g);
  const orc = spawn(g, 'orc', g.player.x + 3, g.player.y);
  const hp0 = orc.hp;
  assert.ok(A.useAbility(g, 'firebolt', 1, 0));
  assert.ok(orc.hp < hp0 || !orc.alive, '火球が当たっていない');
  // 気力を空にして撃てないことを確認
  g.player.focus = 0;
  assert.equal(A.useAbility(g, 'firebolt', 1, 0), false);
});

test('鉄壁：fortify は防御を上げる', () => {
  const g = new Game(4, { cls: 'warrior' }); arena(g);
  const before = effStats(g.player).def;
  applyStatus(g.player, 'fortify', 10, 4);
  const after = effStats(g.player).def;
  assert.equal(after, before + 4);
});

test('気力は手を重ねると戻る', () => {
  const g = new Game(5, { cls: 'mage' });
  g.player.focus = 0;
  for (let i = 0; i < 9; i++) { g.player.turns++; regenFocus(g.player); }
  assert.ok(g.player.focus >= 2, `気力 ${g.player.focus}`);
});

test('盗賊の忍び足：透明になる', () => {
  const g = new Game(6, { cls: 'rogue' }); arena(g);
  A.useAbility(g, 'sneak');
  assert.ok(g.player.hasStatus('invisible'));
});
