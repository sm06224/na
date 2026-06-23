import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../js/core/kei.js';

// 一連を走らせて、最後の行の結果（またはエラー文）を返す
function last(src) {
  const out = run(src);
  const r = out[out.length - 1];
  return r.error ? { error: r.error } : r.result;
}
const val = (line) => last(line);

test('四則と優先順位・結合', () => {
  assert.equal(val('2 + 3 * 4'), '14');
  assert.equal(val('(2 + 3) * 4'), '20');
  assert.equal(val('2 ^ 3 ^ 2'), '512');      // 右結合
  assert.equal(val('-2 ^ 2'), '-4');          // 単項マイナスは ^ より弱い
  assert.equal(val('10 / 4'), '2.5');
});

test('桁区切りと倍率接尾辞', () => {
  assert.equal(val('1,234 + 1'), '1,235');
  assert.equal(val('1.5k'), '1,500');
  assert.equal(val('2M'), '2,000,000');
  assert.equal(val('3bn / 1k'), '3,000,000');
});

test('単位の換算', () => {
  assert.equal(val('5 km in mi'), '3.106856 mi');
  assert.equal(val('2 h in min'), '120 min');
  assert.equal(val('1 GB in MB'), '1,000 MB');
  assert.equal(val('1 KiB in B'), '1,024 B');
  assert.equal(val('500 g in kg'), '0.5 kg');
});

test('複合単位（割り算からおのずと生まれる）', () => {
  assert.equal(val('100 km / 2 h'), '50 km/h');
  assert.equal(val('2 TB / 50 MB/s in min'), '666.666667 min');
  assert.equal(val('60 km per h in m/s'), '16.666667 m/s');
  assert.equal(val('3 m * 4 m'), '12 m²');
});

test('通貨は次元。混ぜると拒み、同じなら通る', () => {
  assert.equal(val('100 USD + 20 USD'), '120 USD');
  assert.equal(val('1200 JPY * 3'), '3,600 JPY');
  assert.equal(val('$100 + $50'), '150 USD');
  assert.equal(val('300 円 / 4'), '75 JPY');
  const e = val('100 USD + 100 JPY');
  assert.ok(e.error && /足せない/.test(e.error), '異種通貨は足せない');
});

test('パーセント', () => {
  assert.equal(val('20% of 80'), '16');
  assert.equal(val('80 + 8%'), '86.4');
  assert.equal(val('80 - 10%'), '72');
  assert.equal(val('15%'), '15%');
  assert.equal(val('1000 円 + 8%'), '1,080 JPY');
});

test('関数', () => {
  assert.equal(val('sqrt(144)'), '12');
  assert.equal(val('round(3.14159, 2)'), '3.14');
  assert.equal(val('max(3, 7, 5)'), '7');
  assert.equal(val('round(1.4 km)'), '1 km');   // 表示の値を丸める
  assert.equal(val('avg(2, 4, 6)'), '4');
});

test('日本語の時間単位と、数え単位（ad-hoc）が割り算で運ばれる', () => {
  assert.equal(val('3 時間 in min'), '180 min');
  assert.equal(val('24 時間/日 * 1 区間/8時間'), '3 区間/日');   // 1日のシフト数
  assert.equal(val('24 時間/日 / (8 時間/区間)'), '3 区間/日');
  assert.equal(val('12 個 / 4 人'), '3 個/人');
  assert.equal(val('500 円/個 * 12 個'), '6,000 JPY');           // 数え単位は約分される
  assert.equal(val('8 時間 * 3 区間'), '24 時間·区間');
});

test('組み立て単位（N・J・W・kWh…）と、^ は単位ひとつに掛かる', () => {
  assert.equal(val('2 kg * 9.8 m/s^2 in N'), '19.6 N');
  assert.equal(val('1 N * 1 m in J'), '1 J');
  assert.equal(val('100 W * 1 h in kWh'), '0.1 kWh');
  assert.equal(val('5 V * 2 A in W'), '10 W');
  assert.equal(val('1 atm in hPa'), '1,013.25 hPa');
  assert.equal(val('500 mL + 1.5 L in L'), '2 L');
  assert.equal(val('5 m^2'), '5 m²');            // (5 m)^2 ではない
  assert.equal(val('9.8 m/s^2'), '9.8 m/s²');
  assert.equal(val('1 kWh in J'), '3,600,000 J');
});

test('温度（°C ↔ °F ↔ K）はアフィン変換、足し算は断る', () => {
  assert.equal(val('180 °C in °F'), '356 °F');
  assert.equal(val('100 degC in degF'), '212 degF');
  assert.equal(val('98.6 degF in degC'), '37 degC');
  assert.equal(val('300 K in degC'), '26.85 degC');
  assert.equal(val('0 degC in K'), '273.15 K');
  assert.ok(val('20 degC + 5 degC').error, '温度の足し算は断る');
});

test('定数と三角関数（角度対応）', () => {
  assert.equal(val('2 * pi'), '6.283185');
  assert.equal(val('sin(30 deg)'), '0.5');
  assert.equal(val('cos(60 deg)'), '0.5');
  assert.equal(val('sin(pi/2)'), '1');
  assert.equal(val('asin(0.5) in deg'), '30 deg');
  assert.equal(val('hypot(3, 4)'), '5');
  assert.equal(val('mod(17, 5)'), '2');
});

test('SI 接頭辞エンジン（µm・ns・GHz・mΩ…何にでも）', () => {
  assert.equal(val('5 µm in nm'), '5,000 nm');
  assert.equal(val('2 GHz in MHz'), '2,000 MHz');
  assert.equal(val('3 mΩ in Ω'), '0.003 Ω');
  assert.equal(val('500 ns in µs'), '0.5 µs');
  assert.equal(val('10 cL in mL'), '100 mL');
});

test('変数・前行参照（prev / sum / total / line）', () => {
  assert.equal(val('x = 10\nx * 3'), '30');
  assert.equal(val('10\nprev + 5'), '15');
  assert.equal(val('2 m\n3 m\nsum'), '5 m');
  assert.equal(val('100\n200\nline 1 + line 2'), '300');
});

test('sum は「かたまり」で止まる（空行・見出しで区切れる）', () => {
  const out = run('2\n3\n\n10\nsum');
  assert.equal(out[out.length - 1].result, '10');   // 空行の上は数えない
});

test('代入の答えも、その変数の値', () => {
  const out = run('合計 = 3 * 4');
  assert.equal(out[0].result, '12');
  assert.equal(out[0].name, '合計');
});

test('散文・見出しは黙る／本当の計算ミスは知らせる', () => {
  assert.equal(run('京都ひとり旅')[0].result, null);
  assert.equal(run('レシピを4人前から6人前へ')[0].result, null);   // 数字があっても演算子がなければ散文
  assert.equal(run('# これはコメント')[0].result, null);
  const bad = run('予備 = 100\n予備 +');                          // 演算子つきの未完 → エラー
  assert.ok(bad[1].error, '未完の式はエラーになる');
});

test('できない変換は、黙らずに正直に断る（嘘をつかない）', () => {
  const r = run('100 USD in JPY')[0];                            // 為替を持たないので変換不可
  assert.ok(r.error && /変換できません/.test(r.error), '無言で素通りしてはいけない');
  assert.equal(run('100 km in kg')[0].error ? true : false, true);  // 次元違いも断る
});

test('決定的：同じノートは寸分たがわず同じ答え', () => {
  const nb = 'a = 3 m\nb = 4 m\nsqrt(a*a + b*b)';
  assert.deepEqual(run(nb).map((r) => r.result), run(nb).map((r) => r.result));
});
