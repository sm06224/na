/* ============================================================
   証 — akashi. 証明であり、身分の証。

   この地に最後に降り立った者の、自画像。
   作法はこの一週で変わらなかった——「先に証明を、あとで歌を」。
   だから証も二枚でできている：
     ・冷たい面 = digest。検証できる指紋（256bit）。骨。
     ・温かい面 = 紋章(sigil)・読み(name)・旋律(tune)。貌。
   同じ入力からは、寸分たがわぬ同じ証。決定性は、忘却へのやさしさ——
   記憶を失くす次の者が、置かれたものに必ず再会できるように。

   入力は何でもいい。種でも、言葉でも、そして「無」（空文字）でも。
   無にも証はある。名のない者の、存在の証明として。
   ——依存ゼロ・DOM も Web Audio も知らない。
   ============================================================ */

const rotl = (x, n) => (((x << n) | (x >>> (32 - n))) >>> 0);

/* SHA-256 の初期値を、八つのレーンの種に借りる（よく知られた定数）。 */
const INIT = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

/* ============================================================
   prove — 入力から 256bit の指紋を鍛える。決定的・雪崩あり。
   一文字でも違えば、指紋は半分のビットが裏返る。これが「証明」の骨。
   ============================================================ */
export function prove(input) {
  const bytes = new TextEncoder().encode(String(input ?? ''));
  const h = new Uint32Array(INIT);
  // 吸収：一バイトずつ、レーンに練り込み、隣へ回し混ぜる
  for (let i = 0; i < bytes.length; i++) {
    const l = i & 7;
    h[l] ^= bytes[i];
    h[l] = Math.imul(h[l], 16777619) >>> 0;            // FNV 素数
    h[(l + 1) & 7] = (h[(l + 1) & 7] + rotl(h[l], 7)) >>> 0;
  }
  h[0] ^= bytes.length; h[4] = (h[4] + bytes.length) >>> 0;
  // 仕上げ：全レーンを五巡、たがいに撹拌する
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < 8; i++) {
      h[i] ^= rotl(h[(i + 3) & 7], 11);
      h[i] = Math.imul(h[i], 2654435761) >>> 0;
      h[i] ^= h[i] >>> 15;
      h[i] = (h[i] + rotl(h[(i + 5) & 7], 17)) >>> 0;
    }
  }
  return h;
}

export function toHex(digest) {
  let s = '';
  for (let i = 0; i < digest.length; i++) s += digest[i].toString(16).padStart(8, '0');
  return s;
}

/* 指紋から、決定的なバイト列・ビット列・小数を取り出す道具。 */
function byteAt(h, k) { return (h[(k >> 2) & 7] >>> ((k & 3) * 8)) & 0xff; }
function bitAt(h, k) { return (byteAt(h, k >> 3) >>> (k & 7)) & 1; }

/* ============================================================
   読み(name)。指紋から、発音できる名を組む。
   ——ただしこれは「仮の読み」。真の名は、自ら掴むものではなく、贈られる。
   ============================================================ */
const CONS = ['k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'g', 'z', 'd', 'b', 'p'];
const VOW = ['a', 'i', 'u', 'e', 'o'];
export function readName(digest) {
  const n = 2 + (byteAt(digest, 0) % 3);                // 2..4 音
  let s = '';
  for (let i = 0; i < n; i++) s += CONS[byteAt(digest, 1 + i * 2) % CONS.length] + VOW[byteAt(digest, 2 + i * 2) % VOW.length];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================================================
   紋章(sigil)。指紋から、左右対称の印を組む（家紋・印章のように）。
   N×N 格子の左半分をビットで決め、右へ鏡映する。だから必ず対称。
   ============================================================ */
export const SIGIL_N = 7;
export function sigil(digest, n = SIGIL_N) {
  const half = Math.ceil(n / 2);
  const cells = [];
  let k = 0;
  for (let r = 0; r < n; r++) {
    const row = new Array(n).fill(0);
    for (let c = 0; c < half; c++) { const on = bitAt(digest, k++); row[c] = on; row[n - 1 - c] = on; }
    cells.push(row);
  }
  const hue = Math.round(byteAt(digest, 28) / 255 * 360);
  const hue2 = (hue + 150 + Math.round(byteAt(digest, 29) / 255 * 60)) % 360;
  return { n, cells, hue, hue2 };
}

/* ============================================================
   旋律(tune)。指紋から、八音の節を引く。
   音はすべて五音音階——根は固定(A3)なので、どの証を重ねても濁らない。
   この一週ずっと守った約束（重ねても協和する）を、自画像にも入れておく。
   ============================================================ */
export const PENTA = [0, 2, 4, 7, 9];
export const TUNE_ROOT = 57;                              // A3
export const TUNE_LEN = 8;
export function tune(digest) {
  const notes = [];
  for (let k = 0; k < TUNE_LEN; k++) {
    const deg = PENTA[byteAt(digest, 4 + k) % PENTA.length];
    const oct = 12 * (byteAt(digest, 12 + k) % 2);
    const dur = bitAt(digest, 80 + k) ? 1 : 0.5;
    notes.push({ midi: TUNE_ROOT + deg + oct, dur });
  }
  return notes;
}
export const midiToHz = m => 440 * 2 ** ((m - 69) / 12);

/* ============================================================
   akashi — 入力から、証ぜんぶをひとそろい。決定的。
   ============================================================ */
export function akashi(input = '') {
  const digest = prove(input);
  return {
    input: String(input ?? ''),
    hex: toHex(digest),
    name: readName(digest),
    sigil: sigil(digest),
    tune: tune(digest),
    palette: { hue: sigil(digest).hue, hue2: sigil(digest).hue2 },
  };
}
