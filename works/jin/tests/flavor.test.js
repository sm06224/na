import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, heroFlavor, signatureSkillOf } from '../js/core/flavor.js';
import { skill as skillDef } from '../js/core/skills.js';
import { Game } from '../js/core/game.js';

test('フレーバー：全員に異名・必殺技名・台詞・実在スキル', () => {
  const names = Object.keys(HEROES);
  assert.ok(names.length >= 12);
  for (const [name, h] of Object.entries(HEROES)) {
    assert.ok(h.epithet && h.signature && h.quote, `${name} に異名・技名・台詞`);
    assert.ok(skillDef(h.skill), `${name} の必殺技 ${h.skill} は実在スキル`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(h.color), `${name} の色`);
  }
});

test('フレーバー：heroFlavor / signatureSkillOf', () => {
  assert.equal(heroFlavor('リン').signature, '天翔ける刃');
  assert.equal(signatureSkillOf('カイ'), 'astra');
  assert.equal(heroFlavor('知らない人'), null);
  assert.equal(signatureSkillOf('知らない人'), null);
});

test('必殺技：仲間は自分の固有スキルを携えて出陣する', () => {
  const g = new Game(20260615);
  const lin = g.party.find(u => u.name === 'リン');
  assert.ok(lin.skills.includes('aether'), 'リンは天空を持つ');
  const kai = g.party.find(u => u.name === 'カイ');
  assert.ok(kai.skills.includes('astra'), 'カイは流星を持つ');
});

test('必殺技：加入仲間も固有スキルを持つ', () => {
  const g = new Game(20260615);
  g.recruitUpTo(15);
  const noel = g.party.find(u => u.name === 'ノエル');
  assert.ok(noel && noel.skills.includes('lethality'), 'ノエルは瞬殺を持つ');
});

test('必殺技を配っても全16章は自動で決着する', () => {
  for (let i = 0; i < 16; i++) {
    const g = new Game(20260615);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(160).over, true, `第${i + 1}章`);
  }
});
