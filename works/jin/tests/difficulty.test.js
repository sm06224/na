import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CHAPTERS } from '../js/core/game.js';
import { encodeSave, decodeSave } from '../js/core/save.js';

function avgEnemyLevel(g, idx) {
  const { battle } = g.startChapter(idx);
  const e = battle.board.unitsOf('enemy').filter(u => !u.boss);
  return e.reduce((s, u) => s + u.level, 0) / Math.max(1, e.length);
}

test('難易度：やさしいは敵が弱く、むずかしいは強い', () => {
  const easy = avgEnemyLevel(new Game(20260615, { difficulty: 'easy' }), 4);
  const norm = avgEnemyLevel(new Game(20260615, { difficulty: 'normal' }), 4);
  const hard = avgEnemyLevel(new Game(20260615, { difficulty: 'hard' }), 4);
  assert.ok(easy < norm, 'やさしいは敵レベルが低い');
  assert.ok(hard > norm, 'むずかしいは敵レベルが高い');
});

test('難易度：レベルは1未満にならない', () => {
  const g = new Game(7, { difficulty: 'easy' });
  const { battle } = g.startChapter(0);   // ch.level 3, easy -3 → 1 以上
  for (const u of battle.board.unitsOf('enemy')) assert.ok(u.level >= 1);
});

test('やさしさ＝救済：勝っても倒れた仲間は永久死しない', () => {
  const g = new Game(123, { difficulty: 'easy' });
  g.startChapter(0);
  const ally = g.party.find(u => !u.isLord);
  ally.hp = 0;
  g.onVictory();
  assert.equal(ally.dead, false, 'easy では死が確定しない');
  assert.ok(g.livingParty().includes(ally), '次章も出撃名簿に残る');
});

test('ふつうは従来どおり永久死が確定する', () => {
  const g = new Game(123, { difficulty: 'normal' });
  g.startChapter(0);
  const ally = g.party.find(u => !u.isLord);
  ally.hp = 0;
  g.onVictory();
  assert.equal(ally.dead, true);
});

test('難易度は保存に残る', () => {
  const g = new Game(55, { difficulty: 'easy' });
  const g2 = decodeSave(encodeSave(g));
  assert.equal(g2.difficulty, 'easy');
});

test('全難易度・全16章が自動で決着する', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let i = 0; i < CHAPTERS.length; i++) {
      const g = new Game(20260615, { difficulty: diff });
      const { battle } = g.startChapter(i);
      assert.equal(battle.autoResolve(160).over, true, `${diff} 第${i + 1}章`);
    }
  }
});
