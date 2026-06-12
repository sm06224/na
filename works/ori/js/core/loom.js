/* ============================================================
   織り機 — 旋律を布に写す。

   緯糸（よこいと）一段 = 一拍の四分の一。音の高さが、その段の
   「組織」——どの経糸（たていと）が浮き、どれが沈むか——の規則を
   選ぶ。織物の世界では浮き沈みの規則を本当に「組織」と呼ぶ。
   ここでは高さ十段それぞれに一つ、基本セルオートマトン規則を
   割り当てた。前の段の浮き沈みだけから次の段が決まるのは、
   一段ずつしか進めない手織りと同じである。

   音の長さは段数になり、音の高さは緯糸の染め色になる。
   だから織り上がった布には、歌の反復——フック——が
   同じ色の帯の繰り返しとして、目に見える形で残る。
   ============================================================ */

import { RNG } from './rng.js';
import { noteDeg, noteDur } from './kana.js';

export const ROWS_PER_BEAT = 4;          // 一拍 = 緯糸四段

/* 高さの段 0..9 → 組織（基本セルオートマトン規則）。
   低い音ほど鎮まった織り、高い音ほどさざめく織りになるよう選んだ。 */
export const RULES = [90, 30, 105, 110, 54, 150, 122, 60, 154, 126];

/* 高さの段 0..9 → 緯糸の染め。草木染めの伝統色。 */
export const DYES = [
  { name: '藍',   hex: '#2b4a8b' },   // ど
  { name: '萌黄', hex: '#7aa844' },   // れ
  { name: '茜',   hex: '#b34a3f' },   // み
  { name: '金茶', hex: '#c9923a' },   // そ
  { name: '紫根', hex: '#6b4a7e' },   // ら
  { name: '紅',   hex: '#c44d6e' },   // ド
  { name: '若竹', hex: '#4a9e7e' },   // レ
  { name: '露草', hex: '#4a7ec4' },   // ミ
  { name: '柿渋', hex: '#a3593a' },   // ソ
  { name: '刈安', hex: '#c4b04a' },   // ラ
];
export const WARP = { name: '生成り', hex: '#e8e0cf' };   // 経糸はいつも無染

/* 基本セルオートマトン一段ぶん。布の両端は輪につながっている（筒織り）。 */
export function step(bits, rule) {
  const n = bits.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = bits[(i - 1 + n) % n], c = bits[i], r = bits[(i + 1) % n];
    out[i] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
  }
  return out;
}

/* 糸が切れたら（段が一色に沈んだら）、織り手が結び直す。 */
function mend(bits, rng) {
  let sum = 0;
  for (const b of bits) sum += b;
  if (sum !== 0 && sum !== bits.length) return;
  for (let k = 0; k < 3; k++) bits[rng.int(bits.length)] ^= 1;
}

/* 織る。旋律は布の丈が満ちるまで繰り返される——柄のリピート。
   ただし組織の状態は繰り返しを越えて流れ続けるので、
   同じ歌の二度目の帯は、同じ色で違う織り味になる。 */
export function weave(melody, { seed = 1, warp = 72, rows = 120 } = {}) {
  if (!melody || melody.length === 0) throw new Error('旋律がありません');
  const rng = new RNG(seed);
  let row = new Uint8Array(warp);
  for (let i = 0; i < warp; i++) row[i] = rng.chance(0.5) ? 1 : 0;
  const cloth = { seed, warp, melody: melody.slice(), rows: [] };
  let at = 0;
  while (cloth.rows.length < rows) {
    const n = melody[at % melody.length];
    const deg = noteDeg(n);
    for (let b = 0; b < noteDur(n) * ROWS_PER_BEAT && cloth.rows.length < rows; b++) {
      row = step(row, RULES[deg]);
      mend(row, rng);
      cloth.rows.push({ bits: Uint8Array.from(row), deg, note: n });
    }
    at++;
  }
  return cloth;
}

/* 銘 — 布の指紋。FNV-1a。一画素ちがえば銘は変わる。 */
export function fingerprint(cloth) {
  let h = 0x811c9dc5;
  const mix = (b) => { h ^= b & 0xff; h = Math.imul(h, 0x01000193); };
  mix(cloth.warp);
  for (const r of cloth.rows) {
    mix(r.deg);
    for (const b of r.bits) mix(b);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* SVG に写す。浮いた緯糸の連なりをひとつの矩形にまとめる。 */
export function clothToSVG(cloth, { cell = 8, rowH = 7 } = {}) {
  const W = cloth.warp * cell, H = cloth.rows.length * rowH;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">`);
  out.push(`<rect width="${W}" height="${H}" fill="${WARP.hex}"/>`);
  for (let y = 0; y < cloth.rows.length; y++) {
    const { bits, deg } = cloth.rows[y];
    const fill = DYES[deg].hex;
    let x = 0;
    while (x < bits.length) {
      if (!bits[x]) { x++; continue; }
      let x2 = x;
      while (x2 < bits.length && bits[x2]) x2++;
      out.push(`<rect x="${x * cell}" y="${y * rowH}" width="${(x2 - x) * cell}" height="${rowH - 1}" rx="2" fill="${fill}"/>`);
      x = x2;
    }
  }
  out.push('</svg>');
  return out.join('\n') + '\n';
}
