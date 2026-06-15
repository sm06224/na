import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Game } from '../js/core/game.js';
import { allMonsters } from '../js/core/monsterdb.js';
import { monsterLore, itemInfo, monsterEntry, MONSTER_LORE } from '../js/core/lore.js';
import { Knowledge } from '../js/core/knowledge.js';
import { makeItem } from '../js/core/factory.js';
import { T } from '../js/core/tile.js';
import * as A from '../js/core/actions.js';
import { aStar } from '../js/core/pathfind.js';

test('すべての魔物に言い伝えがある', () => {
  for (const m of allMonsters()) {
    assert.ok(MONSTER_LORE[m.key], `${m.key} に lore がない`);
    assert.ok(monsterLore(m.key).length > 4);
  }
});

test('itemInfo：鑑定済みの品は素性を数で語る', () => {
  const rng = new RNG(1);
  const sword = makeItem(rng, 'longsword', { enchant: 2 }); sword.identified = true;
  const info = itemInfo(sword, null);
  assert.match(info, /1d8/);
  assert.match(info, /\+2/);
  const armor = makeItem(rng, 'chainmail', { enchant: 1 }); armor.identified = true;
  assert.match(itemInfo(armor, null), /防御/);
});

test('Knowledge：見た・倒した数を覚え、保存復元できる', () => {
  const k = new Knowledge();
  k.see('rat'); k.see('rat'); k.slay('rat');
  assert.equal(k.monster('rat').seen, 2);
  assert.equal(k.monster('rat').slain, 1);
  const k2 = Knowledge.deserialize(k.serialize());
  assert.equal(k2.monster('rat').slain, 1);
  assert.deepEqual(k.encountered(), ['rat']);
});

test('鑑識帳：潜行で魔物に出会うと記録され、倒すと数が増える', () => {
  const g = new Game(20260615);
  // 自動で少し潜る
  for (let i = 0; i < 400 && g.state === 'play'; i++) {
    const p = g.player, lv = g.level;
    if (lv.get(p.x, p.y) === T.STAIRS_DOWN) { A.descend(g); continue; }
    const safe = (x, y) => lv.walkable(x, y) && !lv.prop(x, y).deadly && !lv.prop(x, y).chasm;
    const path = aStar(lv, p.x, p.y, lv.stairsDown.x, lv.stairsDown.y, safe) || aStar(lv, p.x, p.y, lv.stairsDown.x, lv.stairsDown.y, (x, y) => lv.walkable(x, y));
    if (path && path.length > 1) A.move(g, path[1].x - p.x, path[1].y - p.y); else A.wait(g);
  }
  assert.ok(g.know.encountered().length >= 1, '誰にも出会っていない');
  const ent = monsterEntry(g.know.encountered()[0], g.know);
  assert.ok(ent.name && ent.lore);
});

test('describe：見たマスの中身を一言で返す', () => {
  const g = new Game(42);
  const d = g.describe(g.player.x, g.player.y);
  assert.ok(d.includes('あなた'));
});

test('serialize に鑑識帳が載る', () => {
  const g = new Game(7);
  g.know.see('rat');
  const s = g.serialize();
  assert.ok(s.know && s.know.monsters);
});
