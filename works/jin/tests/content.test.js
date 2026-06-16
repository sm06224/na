import test from 'node:test';
import assert from 'node:assert/strict';

import './../js/core/expansion.js';
import './../js/core/items_extra.js';
import { ITEMS, ITEM_LIST } from '../js/core/items.js';
import { CLASSES, classDef } from '../js/core/classes.js';
import { SKILLS } from '../js/core/skills.js';
import { STAT_KEYS } from '../js/core/stats.js';
import { BESTIARY, WORLD, WEAPON_NOTES, TERRAIN_NOTES, bestiaryOf } from '../js/core/lore.js';
import { CHAPTER_SCRIPTS, SUPPORTS, chapterScript } from '../js/core/script.js';
import { SETPIECES, parseMap, setpiece } from '../js/core/maps.js';
import { EXPANSION_CLASSES, EXPANSION_SKILLS } from '../js/core/expansion.js';
import { EXPANSION2_CLASSES } from '../js/core/expansion2.js';
import { EXPANSION3_CLASSES } from '../js/core/expansion3.js';
import { Game, CHAPTERS, ROSTER, EXTRA_ROSTER } from '../js/core/game.js';
import { EXTRA_SETPIECES } from '../js/core/maps2.js';

/* ---- 追加の得物 ---- */
test('追加の得物：登録され、すべて欄がそろう', () => {
  assert.ok(Object.keys(ITEMS).length >= 120, '武器庫がぐっと増えた');
  for (const it of ITEM_LIST) {
    assert.ok(it.id && it.name && it.desc, `${it.id} に名と説明`);
    if (it.kind === 'weapon') {
      assert.ok(it.min >= 1 && it.max >= it.min, `${it.id} の射程`);
      assert.ok(it.price > 0, `${it.id} の価値`);
    }
  }
});

/* ---- 追加の職と素質 ---- */
test('拡張の職：登録され、bases/growths/移動がそろう', () => {
  for (const id of EXPANSION_CLASSES) {
    const c = classDef(id);
    assert.ok(c, `${id} が登録簿にある`);
    assert.ok(c.bases && c.growths && c.mov >= 3, `${id} の素質`);
    for (const k in c.growths) assert.ok(c.growths[k] >= 0 && c.growths[k] <= 100);
  }
  for (const id of EXPANSION_SKILLS) assert.ok(SKILLS[id], `技 ${id} が登録簿にある`);
});

/* ---- 図鑑（lore） ---- */
test('魔物誌：基本職をすべて網羅し、欄がそろう', () => {
  for (const id of Object.keys(CLASSES)) {
    // 拡張職は別登録なので、lore は基本職を最低限カバーしていればよい
    if (EXPANSION_CLASSES.includes(id) || EXPANSION2_CLASSES.includes(id) || EXPANSION3_CLASSES.includes(id)) continue;
    assert.ok(bestiaryOf(id), `魔物誌に ${id} がある`);
  }
  for (const b of BESTIARY) assert.ok(b.classId && b.name && b.blurb && b.tactics);
  assert.ok(WORLD.length >= 10 && WORLD.every(w => w.title && w.text));
  assert.equal(Object.keys(WEAPON_NOTES).length, 10);
  assert.ok(Object.keys(TERRAIN_NOTES).length >= 10);
});

/* ---- 物語（script） ---- */
test('戦記：全章すべてに開幕と勝利の場、台詞に話者と本文', () => {
  assert.equal(CHAPTERS.length, 24, '第一幕8＋第二幕8＋第三幕8');
  for (let i = 0; i < CHAPTERS.length; i++) {
    const s = chapterScript(i);
    assert.ok(s.open.length >= 1 && s.win.length >= 1, `第${i + 1}章に台本`);
    for (const l of s.open.concat(s.win)) { assert.ok(l.who && l.line, `第${i + 1}章の台詞に話者と本文`); }
  }
  assert.deepEqual(chapterScript(99), { open: [], win: [] }, '範囲外でも安全');
});
test('支援会話：仲間どうしで、各々が複数の台詞を交わす（加入者も含む）', () => {
  const names = new Set([...ROSTER, ...EXTRA_ROSTER].map(r => r.name));
  names.add('ナレーション');
  assert.ok(SUPPORTS.length >= 20, '第一幕＋第二幕で支援が増える');
  for (const sp of SUPPORTS) {
    assert.ok(sp.lines.length >= 4, '会話の往復');
    assert.ok(names.has(sp.a) && names.has(sp.b), `${sp.a}・${sp.b} は実在の仲間`);
  }
});

/* ---- 設置マップ（maps） ---- */
test('設置マップ：八枚すべてが解け、布陣・湧き・行の長さがそろう', () => {
  assert.equal(SETPIECES.length, 8);
  for (const sp of SETPIECES) {
    const lens = new Set(sp.rows.map(r => r.length));
    assert.equal(lens.size, 1, `${sp.id} の各行の長さがそろう`);
    const r = parseMap(sp);
    assert.ok(r.board && r.board.w >= 10 && r.board.h >= 8, `${sp.id} の盤`);
    assert.ok(r.deploy.length >= 1 && r.spawns.length >= 1, `${sp.id} に布陣と湧き`);
    assert.ok(['seize', 'rout'].includes(r.objectiveHint));
  }
  assert.ok(setpiece(SETPIECES[0].id), 'id 引きできる');
});
test('第二幕の設置マップ：八枚すべてが解ける', () => {
  assert.equal(EXTRA_SETPIECES.length, 8);
  for (const sp of EXTRA_SETPIECES) {
    const lens = new Set(sp.rows.map(r => r.length));
    assert.equal(lens.size, 1, `${sp.id} の各行の長さがそろう`);
    const r = parseMap(sp);
    assert.ok(r.deploy.length >= 1 && r.spawns.length >= 1 && r.boss, `${sp.id} に布陣・湧き・将`);
  }
});
test('加入する仲間：物語を通じて軍に馳せ参じる', () => {
  const g = new Game(123);
  const n0 = g.party.length;
  g.recruitUpTo(23);
  assert.equal(g.party.length, n0 + EXTRA_ROSTER.length, '全員加入');
  g.recruitUpTo(23);
  assert.equal(g.party.length, n0 + EXTRA_ROSTER.length, '二重加入しない');
});
test('設置マップでも、全章が自動で決着する', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(3000 + i, { setpiece: true });
    const { battle } = g.startChapter(i);
    assert.ok(battle.board.unitsOf('player').length >= 1, `第${i + 1}章に味方`);
    assert.ok(battle.board.unitsOf('enemy').length >= 1, `第${i + 1}章に敵`);
    const res = battle.autoResolve(90);
    assert.ok(res.over, `第${i + 1}章（設置）が決着する`);
  }
});
test('設置マップは決定的（同じ種なら同じ結果）', () => {
  const run = () => { const g = new Game(88, { setpiece: true }); return g.startChapter(2).battle.autoResolve(90); };
  assert.deepEqual(run(), run());
});
