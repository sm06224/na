import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { Battle } from '../js/core/battle.js';
import { Board } from '../js/core/board.js';
import { createUnit, isAlive } from '../js/core/unit.js';
import { RNG } from '../js/core/rng.js';
import { encodeSave, decodeSave } from '../js/core/save.js';

test('救済：敗北後の再戦で、倒れた主人公も立ち上がる（無限ターン・無敵化バグの修正）', () => {
  const g = new Game(20260615);
  g.startChapter(0);
  const lord = g.party.find(u => u.isLord);
  // 主人公が倒れる（敗北条件）——だが勝利していないので確定しない
  lord.hp = 0;
  assert.ok(!isAlive(lord), 'いったんは倒れている');
  assert.equal(lord.dead, false, 'まだ永久の死ではない');
  // 章を再戦（敗北→retry→startChapter 相当）
  const { battle } = g.startChapter(0);
  assert.ok(isAlive(lord), '主人公が全快して立ち上がる');
  assert.ok(g.livingParty().includes(lord), '出撃名簿に主人公が戻る');
  assert.ok(battle.board.unitsOf('player').some(u => u.isLord), '盤に主人公が再配置される');
});

test('救済：主君が盤から失われても、expectLord なら必ず敗北で決着する（無限ターン防止）', () => {
  const g = new Game(7);
  const { battle } = g.startChapter(2);   // 第三章＝制圧（主君依存の目標）
  // 盤上の主君を取り除く（再配置漏れ・全滅の極端ケースの保険）
  const lord = battle.lord();
  if (lord) battle.board.remove(lord), lord.hp = 0, battle.board.rebuildIndex();
  battle.checkEnd();
  assert.equal(battle.over, true, '無限に進まず決着する');
  assert.equal(battle.victory, false);
  assert.equal(battle.reason, 'lord');
});

test('永久の死は勝利で確定する：勝って初めて、倒れた仲間が名簿から消える', () => {
  const g = new Game(123);
  g.startChapter(0);
  const ally = g.party.find(u => !u.isLord);
  ally.hp = 0;                         // 戦闘で倒れた
  assert.ok(g.livingParty().includes(ally), '勝利前は名簿に残る（再戦で戻れる）');
  g.onVictory();
  assert.equal(ally.dead, true, '勝利で死が確定');
  assert.ok(!g.livingParty().includes(ally), '次章の名簿からは消える');
});

test('永久の死：生き延びた者は勝利後も無事', () => {
  const g = new Game(99);
  g.startChapter(0);
  const before = g.livingParty().length;
  g.onVictory();                       // 誰も倒れていない
  assert.equal(g.livingParty().length, before, '全員そのまま');
});

test('保存：永久の死フラグが往復で保たれる', () => {
  const g = new Game(55);
  g.startChapter(0);
  const ally = g.party.find(u => !u.isLord);
  ally.hp = 0; g.onVictory();          // ally を永久の死に
  const g2 = decodeSave(encodeSave(g));
  const ally2 = g2.party.find(u => u.name === ally.name);
  assert.equal(ally2.dead, true, '記録に死が残る');
  assert.ok(!g2.livingParty().includes(ally2), '復元後も名簿から除かれる');
});

test('expectLord 既定は false（単体戦闘テストには影響しない）', () => {
  const b = new Board(4, 1);
  const a = createUnit({ classId: 'mercenary', level: 5, items: ['iron_sword'], side: 'player' }, new RNG(1));
  const e = createUnit({ classId: 'soldier', level: 5, items: ['iron_lance'], side: 'enemy' }, new RNG(2));
  b.add(a, 0, 0); b.add(e, 1, 0); b.rebuildIndex();
  const battle = new Battle(b, { rng: new RNG(3) });
  battle.checkEnd();
  assert.equal(battle.over, false, '主君がいなくても勝手に敗北しない');
});
