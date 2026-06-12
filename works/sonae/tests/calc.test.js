import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS, CATS, itemById } from '../js/core/items.js';
import {
  normalizeProfile, totalPeople, quantity, buildList, progress, listToText,
} from '../js/core/calc.js';

const find = (list, id) => {
  for (const cat of list) for (const item of cat.items) if (item.id === id) return item;
  return null;
};

/* ----- 公的目安との一致（ここがこの道具の信用） ----- */

test('大人1人・7日：水21L・主食21食・トイレ35回分', () => {
  const p = { adults: 1, days: 7 };
  assert.equal(quantity(itemById.water, p), 21, '水 3L×7日');
  assert.equal(quantity(itemById.staple, p), 21, '主食 3食×7日');
  assert.equal(quantity(itemById.toilet, p), 35, 'トイレ 5回×7日');
});

test('大人2人・7日（マンション在宅避難の定番例）：水42L', () => {
  assert.equal(quantity(itemById.water, { adults: 2, days: 7 }), 42);
});

test('カセットボンベ：大人1人・7日で約6本（公的目安）', () => {
  const q = quantity(itemById.gas, { adults: 1, days: 7 });
  assert.ok(q >= 6 && q <= 7, `${q}本`);
});

test('最低限の3日分でも水は1人9L', () => {
  assert.equal(quantity(itemById.water, { adults: 1, days: 3 }), 9);
});

test('ペット：フードは日数分、係数は環境省の最低5日を下回らない設定で使う', () => {
  assert.equal(quantity(itemById.petfood, { adults: 1, pets: 1, days: 7 }), 7);
  assert.equal(quantity(itemById.petfood, { adults: 1, pets: 2, days: 7 }), 14);
});

test('乳幼児：おむつ8枚/日・ミルクは日数分', () => {
  assert.equal(quantity(itemById.diaper, { adults: 2, infants: 1, days: 7 }), 56);
  assert.equal(quantity(itemById.milk, { adults: 2, infants: 1, days: 7 }), 7);
});

test('生理用品：人数×約1周期分。日数には依存しない', () => {
  assert.equal(quantity(itemById.sanitary, { adults: 2, females: 1, days: 7 }),
    quantity(itemById.sanitary, { adults: 2, females: 1, days: 3 }));
  assert.equal(quantity(itemById.sanitary, { adults: 2, females: 2, days: 7 }), 60);
});

/* ----- リスト構築 ----- */

test('該当者がいない分類は出ない', () => {
  const list = buildList({ adults: 2, days: 7 });
  const ids = list.map(c => c.id);
  assert.ok(!ids.includes('infant'));
  assert.ok(!ids.includes('pet'));
  assert.ok(!ids.includes('female'));
  assert.ok(!ids.includes('elderly'));
  assert.ok(ids.includes('water') && ids.includes('toilet') && ids.includes('life'));
});

test('乳幼児・ペットがいれば、その分類が現れる', () => {
  const list = buildList({ adults: 2, infants: 1, pets: 1, days: 7 });
  const ids = list.map(c => c.id);
  assert.ok(ids.includes('infant'));
  assert.ok(ids.includes('pet'));
  assert.ok(find(list, 'diaper').qty > 0);
});

test('世帯固定の品（コンロ・ラジオ）は人数によらず1', () => {
  for (const profile of [{ adults: 1, days: 7 }, { adults: 5, children: 3, days: 7 }]) {
    const list = buildList(profile);
    assert.equal(find(list, 'stove').qty, 1);
    assert.equal(find(list, 'radio').qty, 1);
  }
});

test('誰もいなければ空のリスト', () => {
  assert.deepEqual(buildList({ adults: 0, days: 7 }), []);
});

test('数量はすべて正の整数（切り上げ）', () => {
  const list = buildList({ adults: 3, children: 2, infants: 1, elderly: 2, females: 2, pets: 1, days: 7 });
  for (const cat of list) for (const item of cat.items) {
    assert.ok(Number.isInteger(item.qty) && item.qty > 0, `${item.id} = ${item.qty}`);
  }
});

test('日数を増やせば日数比例の品は増え、固定の品は変わらない', () => {
  const a = buildList({ adults: 2, days: 3 });
  const b = buildList({ adults: 2, days: 7 });
  assert.ok(find(b, 'water').qty > find(a, 'water').qty);
  assert.equal(find(b, 'stove').qty, find(a, 'stove').qty);
});

/* ----- 入力の頑健性 ----- */

test('変な入力は黙って直す（負数・小数・文字列・欠損）', () => {
  const p = normalizeProfile({ adults: -3, children: 2.9, infants: 'x', days: 0 });
  assert.equal(p.adults, 0);
  assert.equal(p.children, 2);
  assert.equal(p.infants, 0);
  assert.ok(p.days >= 1);
  assert.equal(totalPeople(normalizeProfile({})), 2, '既定は大人2人');
});

/* ----- 進捗と書き出し ----- */

test('備え率：チェックした分だけ上がる', () => {
  const list = buildList({ adults: 2, days: 7 });
  const none = progress(list, new Set());
  assert.equal(none.done, 0);
  const all = new Set();
  for (const cat of list) for (const item of cat.items) all.add(item.id);
  const full = progress(list, all);
  assert.equal(full.rate, 1);
  assert.equal(full.total, all.size);
});

test('テキスト書き出し：見出し・チェックボックス・出典の但し書きを含む', () => {
  const list = buildList({ adults: 2, pets: 1, days: 7 });
  const text = listToText(list, { adults: 2, pets: 1, days: 7 });
  assert.ok(text.includes('# 我が家の備蓄リスト（大人2・ペット1／7日分）'));
  assert.ok(text.includes('[ ] 飲料水 … 42L'));
  assert.ok(text.includes('## ペットのために'));
  assert.ok(text.includes('目安'));
});

/* ----- 台帳の整合性 ----- */

test('台帳：全品目が実在の分類を指し、説明・単位を持つ', () => {
  const catIds = new Set(CATS.map(c => c.id));
  const seen = new Set();
  for (const item of ITEMS) {
    assert.ok(catIds.has(item.cat), `${item.id} の分類`);
    assert.ok(item.name && item.unit && item.note, `${item.id} の表記`);
    assert.ok(!seen.has(item.id), `${item.id} が重複`);
    seen.add(item.id);
    assert.ok(item.per || item.fixed, `${item.id} に数量の根拠がない`);
  }
});
