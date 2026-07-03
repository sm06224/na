/* ============================================================
   tex.js（自前 TeX レンダラ）の検証：構造・記号・取りこぼしゼロ。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tex, FORMULAS } from '../js/ui/tex.js';

test('記号とギリシャ文字が置換される', () => {
  assert.ok(tex('\\beta').includes('β'));
  assert.ok(tex('\\lambda\\le\\frac{3}{N}').includes('λ'));
  assert.ok(tex('a\\le b').includes('≤'));
  assert.ok(tex('x-y').includes('−'), 'ハイフンはマイナス記号に');
});

test('上付き・下付き・分数・大型演算子が構造として組まれる', () => {
  assert.ok(/<sup>.*β.*<\/sup>/.test(tex('(t/\\eta)^{\\beta}')));
  assert.ok(/<sub><i>c<\/i><\/sub>/.test(tex('n_c')));
  const fr = tex('\\frac{3}{N}');
  assert.ok(fr.includes('class="fr"') && fr.includes('class="nu"') && fr.includes('class="de"'));
  const op = tex('\\max_{\\beta} D');
  assert.ok(op.includes('class="mop"') && op.includes('class="ml"'), '下限つき max が積まれる');
});

test('ハット・バー・立体・箱', () => {
  assert.ok(tex('\\hat{\\eta}').includes('η̂'.normalize()));
  assert.ok(tex('\\bar{d}').includes('d̄'.normalize()) || tex('\\bar{d}').includes('<i>d</i>̄'));
  assert.ok(tex('\\mathrm{RP}').includes('class="rm"'));
  assert.ok(tex('\\boxed{x}').includes('class="bx"'));
});

test('掲載する全式が取りこぼしなく組める（バックスラッシュ残留ゼロ・HTML整合）', () => {
  for (const [src] of FORMULAS) {
    const h = tex(src);
    assert.ok(!h.includes('\\'), `残留: ${src} → ${h}`);
    const opens = (h.match(/<span/g) || []).length;
    const closes = (h.match(/<\/span>/g) || []).length;
    assert.equal(opens, closes, `span 不整合: ${src}`);
  }
  assert.ok(FORMULAS.length >= 12);
});

test('決定的：同じ入力から同じ出力', () => {
  const s = FORMULAS[5][0];
  assert.equal(tex(s), tex(s));
});
