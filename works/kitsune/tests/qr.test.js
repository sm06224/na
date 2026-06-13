import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQR, qrToSVG } from '../js/core/qr.js';

/* ===== 検証のための、独立した読み手 =====
   エンコーダの内部関数は借りず、面（modules）と版・マスクだけから
   元の文字列を読み戻す。これが通れば「本物の QR」である強い証拠になる。 */

const ECC_PER_BLOCK = { L: [7,10,15,20,26,18,20,24,30,18], M: [10,16,26,18,24,16,18,22,22,26] };
const EC_BLOCKS = { L: [1,1,1,1,1,2,2,2,2,4], M: [1,1,1,2,2,4,4,4,5,5] };

function numRawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const a = Math.floor(ver / 7) + 2; r -= (25 * a - 10) * a - 55; if (ver >= 7) r -= 36; }
  return r;
}
function maskInvert(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}

function decodeQR(qr) {
  const n = qr.size, fn = qr.isFunction;
  // 1) マスクをはがす
  const um = qr.modules.map(r => r.slice());
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (!fn[y][x] && maskInvert(qr.mask, x, y)) um[y][x] = !um[y][x];
  // 2) 同じ歩みで符号語のビットを拾う
  const bits = [];
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? n - 1 - vert : vert;
      if (!fn[y][x]) bits.push(um[y][x] ? 1 : 0);
    }
  }
  const raw = Math.floor(numRawDataModules(qr.version) / 8);
  const all = [];
  for (let i = 0; i < raw; i++) { let v = 0; for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b]; all.push(v); }
  // 3) 織りをほどいてブロックへ
  const ecl = qr.ecLevel;
  const numBlocks = EC_BLOCKS[ecl][qr.version - 1];
  const blockEcc = ECC_PER_BLOCK[ecl][qr.version - 1];
  const numShort = numBlocks - raw % numBlocks;
  const shortLen = Math.floor(raw / numBlocks);
  const blocks = Array.from({ length: numBlocks }, () => []);
  let idx = 0;
  for (let i = 0; i < shortLen + 1; i++) for (let j = 0; j < numBlocks; j++) {
    if (i === shortLen - blockEcc && j < numShort) { blocks[j].push(0); continue; }
    blocks[j].push(all[idx++]);
  }
  // 4) 各ブロックのデータ部だけ繋ぐ
  const cw = [];
  for (let j = 0; j < numBlocks; j++) {
    const dataLen = shortLen - blockEcc + (j < numShort ? 0 : 1);
    for (let i = 0; i < dataLen; i++) cw.push(blocks[j][i]);
  }
  // 5) バイトモードを解く
  const buf = [];
  for (const c of cw) for (let b = 7; b >= 0; b--) buf.push((c >> b) & 1);
  let p = 0;
  const take = len => { let v = 0; for (let i = 0; i < len; i++) v = (v << 1) | buf[p++]; return v; };
  const mode = take(4);
  assert.equal(mode, 0x4, 'バイトモードのはず');
  const count = take(qr.version <= 9 ? 8 : 16);
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = take(8);
  return new TextDecoder().decode(out);
}

/* ===== 形式情報の自己検査 ===== */
function readFormatValue(qr) {
  const bit = i => {
    if (i <= 5) return qr.get(8, i) ? 1 : 0;
    if (i === 6) return qr.get(8, 7) ? 1 : 0;
    if (i === 7) return qr.get(8, 8) ? 1 : 0;
    if (i === 8) return qr.get(7, 8) ? 1 : 0;
    return qr.get(14 - i, 8) ? 1 : 0;
  };
  let v = 0;
  for (let i = 0; i < 15; i++) v |= bit(i) << i;
  return v;
}

/* ===== テスト ===== */

test('寸法：v1 は 21×21、版が上がると 4 ずつ大きくなる', () => {
  assert.equal(encodeQR('a').size, 21);
  assert.equal(encodeQR('a').version, 1);
  const big = encodeQR('x'.repeat(60));   // v1/M(17B) に収まらない
  assert.equal(big.size, 17 + 4 * big.version);
  assert.ok(big.version >= 4, `version ${big.version}`);
});

test('版の自動選択：短い→v1、長い→上の版', () => {
  assert.equal(encodeQR('hi').version, 1);
  assert.ok(encodeQR('x'.repeat(100)).version >= 6);
  assert.ok(encodeQR('x'.repeat(150)).version >= 8);
});

test('位置検出パターン：三隅が 7×7 の正しい形', () => {
  const qr = encodeQR('hello');
  const n = qr.size;
  const ok = (ox, oy) => {
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
      const want = (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      assert.equal(qr.get(ox + dx, oy + dy), want, `finder@${ox},${oy} (${dx},${dy})`);
    }
  };
  ok(0, 0); ok(n - 7, 0); ok(0, n - 7);
});

test('分離帯：位置検出のまわりは白', () => {
  const qr = encodeQR('hello');
  for (let i = 0; i < 8; i++) { assert.equal(qr.get(7, i), false); assert.equal(qr.get(i, 7), false); }
});

test('タイミングパターン：6 行目・6 列目が交互に並ぶ', () => {
  const qr = encodeQR('timing');
  for (let i = 8; i < qr.size - 8; i++) {
    assert.equal(qr.get(i, 6), i % 2 === 0, `row6 col${i}`);
    assert.equal(qr.get(6, i), i % 2 === 0, `col6 row${i}`);
  }
});

test('決定性：同じ入力からは、一画素ちがわず同じ面', () => {
  const a = encodeQR('https://sm06224.github.io/na/'), b = encodeQR('https://sm06224.github.io/na/');
  assert.deepEqual(a.modules, b.modules);
  assert.equal(a.mask, b.mask);
});

test('入力がちがえば、面もちがう', () => {
  assert.notDeepEqual(encodeQR('A').modules, encodeQR('B').modules);
});

test('形式情報：15bit BCH として自己整合する（マスクと EC が読み戻せる）', () => {
  for (const s of ['a', 'hello world', 'x'.repeat(80)]) {
    const qr = encodeQR(s);
    const v = readFormatValue(qr) ^ 0x5412;
    const data = v >> 10;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    assert.equal(v & 0x3FF, rem & 0x3FF, '形式情報の誤り訂正が合う');
    assert.equal(data & 0x7, qr.mask, 'マスクが読み戻せる');
    assert.equal(data >> 3, 0, 'EC レベル M(=0) が読み戻せる');
  }
});

test('往復：ASCII の URL が、面から一字一致で読み戻る', () => {
  const url = 'https://example.com/#t=abc';
  assert.equal(decodeQR(encodeQR(url)), url);
});

test('往復：長めの実物リンクも読み戻る', () => {
  const url = 'https://sm06224.github.io/na/works/kitsune/#t=KITSU7.3.AB2CD';
  assert.equal(decodeQR(encodeQR(url)), url);
});

test('往復：日本語 UTF-8 も落ちずに読み戻る', () => {
  const s = '狐の宝探し — 第3の的「桜の木」';
  assert.equal(decodeQR(encodeQR(s)), s);
});

test('容量超過は、日本語の理由で断る', () => {
  assert.throws(() => encodeQR('x'.repeat(400)), /収まりません/);
});

test('SVG：余白つきで <svg>、矩形を含む', () => {
  const svg = qrToSVG('https://example.com/#t=abc', { module: 6 });
  assert.ok(svg.startsWith('<svg '));
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  // 余白 4 モジュール ＝ viewBox は size+8
  const qr = encodeQR('https://example.com/#t=abc');
  assert.match(svg, new RegExp(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`));
});
