import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CHAPTERS, EXTRA_ROSTER } from '../js/core/game.js';
import { chapterScript } from '../js/core/script.js';
import { heroFlavor } from '../js/core/flavor.js';
import { classDef } from '../js/core/classes.js';

test('第三幕：全24章になった（第一幕8＋第二幕8＋第三幕8）', () => {
  assert.equal(CHAPTERS.length, 24);
  for (let i = 16; i < 24; i++) {
    const ch = CHAPTERS[i];
    assert.ok(ch.title && ch.intro && ch.outro, `第${i + 1}章に題と物語`);
    assert.ok(classDef(ch.boss.classId), `第${i + 1}章のボス職 ${ch.boss.classId}`);
    assert.ok(ch.level >= 33, `第${i + 1}章は高レベル`);
  }
});

test('第三幕：各章に開幕と勝利の台本（話者と本文つき）', () => {
  for (let i = 16; i < 24; i++) {
    const s = chapterScript(i);
    assert.ok(s.open.length >= 2 && s.win.length >= 2, `第${i + 1}章の台本`);
    for (const l of s.open.concat(s.win)) {
      assert.ok(l.who && l.line, `第${i + 1}章の台詞`);
      assert.ok(!/[\n\r]/.test(l.line), '台詞に生改行なし');
      assert.ok(!/\b[a-z]{3,}\b/.test(l.line.replace(/[A-Z]/g, '')), `第${i + 1}章の台詞に英単語が紛れない: ${l.line}`);
    }
  }
});

test('第三幕：新しい仲間（セレネ・ガイル・ミーア）が加わる', () => {
  const g = new Game(20260615);
  g.recruitUpTo(23);
  for (const name of ['セレネ', 'ガイル', 'ミーア']) {
    const u = g.party.find(p => p.name === name);
    assert.ok(u, `${name} が加入`);
    assert.ok(classDef(u.classId), `${name} の職が実在`);
  }
});

test('第三幕：新しい仲間にも異名・必殺技がある', () => {
  for (const name of ['セレネ', 'ガイル', 'ミーア']) {
    const fl = heroFlavor(name);
    assert.ok(fl && fl.epithet && fl.signature, `${name} のフレーバー`);
  }
  const g = new Game(7); g.recruitUpTo(23);
  const selene = g.party.find(p => p.name === 'セレネ');
  assert.ok(selene.skills.includes('ignis'), 'セレネは固有技イグニスを携える');
});

test('第三幕：終々章まで、全章が自動で決着する（無限ループ防止）', () => {
  for (let i = 16; i < 24; i++) {
    const g = new Game(20260615);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章が決着`);
  }
});

test('第三幕：終々章クリアでゲーム完結（done）', () => {
  const g = new Game(99);
  g.chapterIndex = 23;
  g.onVictory();
  assert.equal(g.done, true, '終々章を越えれば done');
});
