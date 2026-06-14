import test from 'node:test';
import assert from 'node:assert/strict';
import { planBudget } from '../js/core/budget.js';

test('人数割だけ：きれいに割れる', () => {
  const b = planBudget({ headcount: 10, items: [{ kind: 'per', amount: 5000 }] });
  assert.equal(b.total, 50000);
  assert.equal(b.payers, 10);
  assert.equal(b.fee, 5000);
  assert.equal(b.surplus, 0);
});

test('人数割＋一式：会場代・花代は頭数に関わらず一度きり', () => {
  const b = planBudget({
    headcount: 10,
    items: [{ kind: 'per', amount: 4000 }, { kind: 'fixed', amount: 30000 }, { kind: 'fixed', amount: 5000 }],
  });
  assert.equal(b.perTotal, 40000);    // 4000 × 10
  assert.equal(b.fixed, 35000);       // 30000 + 5000
  assert.equal(b.total, 75000);
  assert.equal(b.fee, 7500);          // 75000 / 10
});

test('主賓は無料、その分をみんなで肩代わり（送別会）', () => {
  const b = planBudget({
    headcount: 20, freeGuests: 1,
    items: [{ kind: 'per', amount: 5000 }, { kind: 'fixed', amount: 30000 }, { kind: 'fixed', amount: 5000 }],
    roundTo: 500,
  });
  assert.equal(b.total, 135000);      // 5000×20 + 35000
  assert.equal(b.payers, 19);         // 主賓 1 を除く
  // 135000 / 19 = 7105.26… → 500 円単位で切り上げ 7500
  assert.equal(b.fee, 7500);
  assert.equal(b.collected, 142500);  // 7500 × 19
  assert.equal(b.surplus, 7500);      // 余り
});

test('端数の切り上げ単位（0 なら 1 円単位）', () => {
  const a = planBudget({ headcount: 3, items: [{ kind: 'per', amount: 1000 }] });   // 1000/人
  assert.equal(a.total, 3000); assert.equal(a.fee, 1000);
  const b = planBudget({ headcount: 7, items: [{ kind: 'fixed', amount: 10000 }] }); // 10000/7=1428.5
  assert.equal(b.fee, 1429);          // 1 円単位で切り上げ
  const c = planBudget({ headcount: 7, items: [{ kind: 'fixed', amount: 10000 }], roundTo: 1000 });
  assert.equal(c.fee, 2000);          // 1000 円単位で切り上げ
  assert.ok(c.surplus > 0);
});

test('費用ゼロ・人数ゼロでも壊れない', () => {
  assert.equal(planBudget({ headcount: 0, items: [] }).fee, 0);
  assert.equal(planBudget({ headcount: 5, items: [] }).total, 0);
  assert.equal(planBudget({ headcount: 2, freeGuests: 2, items: [{ kind: 'fixed', amount: 1000 }] }).fee, 0);
});

test('決定性：同じ入力からは同じ見積り', () => {
  const inp = { headcount: 12, freeGuests: 2, items: [{ kind: 'per', amount: 3500 }, { kind: 'fixed', amount: 8000 }], roundTo: 100 };
  assert.deepEqual(planBudget(inp), planBudget(inp));
});
