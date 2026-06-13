/* ============================================================
   QR — 文字列を、現地に貼る正方形に変える。依存ゼロの自作。

   QR Code Model 2・バイトモード・バージョン 1〜10・誤り訂正 M（と L）。
   出典は JIS X 0510 / ISO 18004。アルゴリズムの骨格は公知の
   リファレンス実装（Project Nayuki, 公有）に倣う。

   この機械が作るのは「印刷して貼り、標準カメラで読む」ための QR。
   だから誤り訂正は既定で M（15%）— 多少の汚れや影に耐える。
   ============================================================ */

/* ----- GF(256) の掛け算（原始多項式 0x11D） ----- */
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

/* ----- Reed-Solomon ----- */
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

/* ----- 誤り訂正の表（バージョン 1〜10、レベル L と M） ----- */
const ECC_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
};
const EC_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
};
const ECL_FORMAT_BITS = { M: 0, L: 1 };   // 形式情報での EC レベル指標

function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function numDataCodewords(ver, ecl) {
  return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver - 1] * EC_BLOCKS[ecl][ver - 1];
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

/* ----- バイト列をビットの帯にして、データ符号語にする ----- */
function dataCodewords(bytes, ver, ecl) {
  const cap = numDataCodewords(ver, ecl);
  const bb = [];
  const append = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
  append(0x4, 4);                         // バイトモード
  append(bytes.length, ver <= 9 ? 8 : 16); // 文字数（版で幅が変わる）
  for (const b of bytes) append(b, 8);
  const capBits = cap * 8;
  append(0, Math.min(4, capBits - bb.length));   // 終端
  while (bb.length % 8 !== 0) bb.push(0);
  for (let pad = 0xEC; bb.length < capBits; pad ^= 0xEC ^ 0x11) append(pad, 8);
  const out = new Array(cap).fill(0);
  for (let i = 0; i < bb.length; i++) out[i >>> 3] |= bb[i] << (7 - (i & 7));
  return out;
}

/* ----- 符号語をブロックに分け、誤り訂正をつけて、織り交ぜる ----- */
function addEccAndInterleave(data, ver, ecl) {
  const numBlocks = EC_BLOCKS[ecl][ver - 1];
  const blockEccLen = ECC_PER_BLOCK[ecl][ver - 1];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShort = numBlocks - rawCodewords % numBlocks;
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const blocks = [];
  const div = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortLen - blockEccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);          // 後で読み飛ばす詰め物
    blocks.push(dat.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - blockEccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

/* ============================================================
   面 — 模様を据え、データを流し、マスクをかける
   ============================================================ */
class Matrix {
  constructor(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.mod = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  set(x, y, dark) { this.mod[y][x] = dark; this.fn[y][x] = true; }

  drawFunction() {
    const n = this.size;
    // タイミング
    for (let i = 0; i < n; i++) { this.set(6, i, i % 2 === 0); this.set(i, 6, i % 2 === 0); }
    // 位置検出（三隅）と分離帯
    this.finder(3, 3); this.finder(3, n - 4); this.finder(n - 4, 3);
    // 整合
    const pos = alignmentPositions(this.ver);
    const m = pos.length;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === m - 1) || (i === m - 1 && j === 0)) continue;
      this.alignment(pos[i], pos[j]);
    }
    // 形式情報・版情報の場所を予約（仮の値で塗ってから後で本物を）
    this.drawFormat(0, 'M');
    this.drawVersion();
  }
  finder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= this.size || y < 0 || y >= this.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      this.set(x, y, dist !== 2 && dist !== 4);
    }
  }
  alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  drawFormat(mask, ecl) {
    const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, getBit(bits, i));
    this.set(8, 7, getBit(bits, 6));
    this.set(8, 8, getBit(bits, 7));
    this.set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, getBit(bits, i));
    this.set(8, n - 8, true);   // 常に暗いモジュール
  }
  drawVersion() {
    if (this.ver < 7) return;
    let rem = this.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (this.ver << 12) | rem;
    const n = this.size;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = n - 11 + i % 3, b = Math.floor(i / 3);
      this.set(a, b, bit); this.set(b, a, bit);
    }
  }
  drawCodewords(data) {
    let i = 0;
    const n = this.size;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.fn[y][x] && i < data.length * 8) {
            this.mod[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }
  applyMask(mask) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.fn[y][x]) continue;
      if (maskInvert(mask, x, y)) this.mod[y][x] = !this.mod[y][x];
    }
  }
  penalty() {
    let result = 0;
    const n = this.size, mod = this.mod;
    // 規則 1：同色の連なり ＋ 位置検出もどき
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < n; a++) {
        let runColor = false, runLen = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        for (let b = 0; b < n; b++) {
          const c = pass === 0 ? mod[a][b] : mod[b][a];
          if (c === runColor) {
            runLen++;
            if (runLen === 5) result += 3; else if (runLen > 5) result++;
          } else {
            addHistory(runLen, hist, n);
            if (!runColor) result += countFinderLike(hist) * 40;
            runColor = c; runLen = 1;
          }
        }
        result += terminateFinder(runColor, runLen, hist, n) * 40;
      }
    }
    // 規則 2：2×2 の同色
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) result += 3;
    }
    // 規則 4：白黒のかたより
    let dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (mod[y][x]) dark++;
    const total = n * n;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }
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
  return false;
}
function addHistory(runLen, hist, n) {
  if (hist[0] === 0) runLen += n;   // 端の白枠ぶん
  hist.pop(); hist.unshift(runLen);
}
function countFinderLike(hist) {
  const c = hist[1];
  const core = c > 0 && hist[2] === c && hist[3] === c * 3 && hist[4] === c && hist[5] === c;
  return (core && hist[0] >= c * 4 && hist[6] >= c ? 1 : 0)
       + (core && hist[6] >= c * 4 && hist[0] >= c ? 1 : 0);
}
function terminateFinder(color, runLen, hist, n) {
  if (color) { addHistory(runLen, hist, n); runLen = 0; }
  runLen += n;
  addHistory(runLen, hist, n);
  return countFinderLike(hist);
}

/* ============================================================
   入り口
   ============================================================ */

const te = new TextEncoder();

function chooseVersion(len, ecl) {
  for (let v = 1; v <= 10; v++) {
    const capBits = numDataCodewords(v, ecl) * 8;
    const cc = v <= 9 ? 8 : 16;
    if (4 + cc + 8 * len <= capBits) return v;
  }
  throw new Error(`QR に収まりません（${len} バイト）。もっと短いリンクにしてください`);
}

/* text → QR。返り値は { size, version, ecLevel, mask, get(x,y), modules, isFunction } */
export function encodeQR(text, ecLevel = 'M') {
  const ecl = ECL_FORMAT_BITS[ecLevel] === undefined ? 'M' : ecLevel;
  const bytes = Array.from(te.encode(String(text)));
  const ver = chooseVersion(bytes.length, ecl);
  const all = addEccAndInterleave(dataCodewords(bytes, ver, ecl), ver, ecl);

  const m = new Matrix(ver);
  m.drawFunction();
  m.drawCodewords(all);

  // 8 つのマスクから、罰点いちばん小さいものを選ぶ
  let best = -1, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    m.applyMask(mask); m.drawFormat(mask, ecl);
    const p = m.penalty();
    if (p < bestPenalty) { bestPenalty = p; best = mask; }
    m.applyMask(mask);   // 元に戻す（同じマスクをもう一度かけると消える）
  }
  m.applyMask(best); m.drawFormat(best, ecl);

  return {
    size: m.size, version: ver, ecLevel: ecl, mask: best,
    modules: m.mod, isFunction: m.fn,
    get: (x, y) => m.mod[y][x],
  };
}

/* QR を SVG に。静かな余白 4 モジュールつき、黒 #111 / 白 #fff。 */
export function qrToSVG(text, { module = 8, dark = '#111', light = '#fff' } = {}) {
  const qr = encodeQR(text);
  const q = 4, dim = qr.size + 2 * q, px = dim * module;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges">`];
  out.push(`<rect width="${dim}" height="${dim}" fill="${light}"/>`);
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.get(x, y)) { x++; continue; }
      let x2 = x;
      while (x2 < qr.size && qr.get(x2, y)) x2++;
      out.push(`<rect x="${x + q}" y="${y + q}" width="${x2 - x}" height="1" fill="${dark}"/>`);
      x = x2;
    }
  }
  out.push('</svg>');
  return out.join('');
}
