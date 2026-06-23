import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Enigma, cipher, packKey, unpackKey, ROTORS, REFLECTORS } from '../js/core/enigma.js';

const base = { rotors: ['I', 'II', 'III'], reflector: 'B', rings: 'AAA', positions: 'AAA', plugs: [] };

test('史実のテストベクタ：I-II-III / B / AAA / AAA で AAAAA → BDZGO', () => {
  assert.equal(cipher(base, 'AAAAA'), 'BDZGO');
});

test('もう一つのベクタ：同じ設定で AAAAAAAAAAAAAAAAAAAAA を彫る', () => {
  // 既知：AAAA…(25) → BDZGOWCXLTKSBTMCDLPBMUQOF
  assert.equal(cipher(base, 'A'.repeat(25)), 'BDZGOWCXLTKSBTMCDLPBMUQOF');
});

test('暗号化と復号は同じ操作（可逆）', () => {
  const s = { rotors: ['III', 'II', 'I'], reflector: 'B', rings: 'BCD', positions: 'KEY', plugs: ['AB', 'CD', 'EF'] };
  const ct = cipher(s, 'THEQUICKBROWNFOX');
  assert.notEqual(ct, 'THEQUICKBROWNFOX');
  assert.equal(cipher(s, ct), 'THEQUICKBROWNFOX');
});

test('どの文字も、自分自身には化けない（Enigma の宿命の弱点）', () => {
  const e = new Enigma(base);
  for (let i = 0; i < 3000; i++) {
    const c = String.fromCharCode(65 + (i % 26));
    assert.notEqual(e.encodeChar(c), c);
  }
});

test('プラグボードは対合（A↔B なら B↔A、二度通すと戻る）', () => {
  const withPlugs = { ...base, plugs: ['QW', 'ER', 'TY'] };
  const ct = cipher(withPlugs, 'HELLO');
  assert.equal(cipher(withPlugs, ct), 'HELLO');         // 可逆
  // プラグなしとは違う暗号文になる
  assert.notEqual(ct, cipher(base, 'HELLO'));
});

test('ダブルステッピング：ADU から ADV AEW BFX BFY（中央が連続で動く）', () => {
  const e = new Enigma({ ...base, positions: 'ADU' });
  const w = [];
  for (let i = 0; i < 4; i++) { e.encodeChar('A'); w.push(e.window()); }
  assert.deepEqual(w, ['ADV', 'AEW', 'BFX', 'BFY']);
});

test('リング設定（Ringstellung）を変えると暗号文も変わる', () => {
  assert.notEqual(cipher(base, 'AAAAA'), cipher({ ...base, rings: 'BBB' }, 'AAAAA'));
});

test('A–Z 以外（空白・記号・数字）はそのまま素通しする', () => {
  const out = cipher(base, 'AA AA');
  assert.equal(out.length, 5);
  assert.equal(out[2], ' ');
});

test('鍵は畳んでひらいても同じ機械（packKey / unpackKey）', () => {
  const s = { rotors: ['IV', 'II', 'V'], reflector: 'C', rings: 'XMV', positions: 'QRS', plugs: ['AB', 'CD'] };
  const k = packKey(s);
  assert.equal(k, 'IV-II-V.C.XMV.QRS.ABCD');
  const back = unpackKey(k);
  const msg = 'ATTACKATDAWN';
  assert.equal(cipher(back, msg), cipher(s, msg));
});

test('配線は健全（各ローター・反射器は 26 文字の置換、反射器は対合）', () => {
  for (const name of Object.keys(ROTORS)) {
    const w = ROTORS[name].wiring;
    assert.equal(new Set(w).size, 26, `${name} は全 26 文字`);
  }
  for (const name of Object.keys(REFLECTORS)) {
    const r = REFLECTORS[name];
    for (let i = 0; i < 26; i++) {
      const j = r.charCodeAt(i) - 65;
      assert.equal(r.charCodeAt(j) - 65, i, `${name} は対合`);
      assert.notEqual(j, i, `${name} は自分自身に映さない`);
    }
  }
});
