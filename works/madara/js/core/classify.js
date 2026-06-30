/* ============================================================
   斑 を読む — 浮かんだ形を、正直に測る。
   生まれた土地（バイオーム）が何であれ、肌に実際に立った模様を見て
   「斑・縞・迷路・孔」のどれかに分ける。物差しは三つ：
     ・覆い率   coverage — V の高い領域が肌をどれだけ覆うか
     ・前景の島  fg — V の高い領域はいくつに分かれているか（トーラス上で数える）
     ・背景の孔  bg — その隙間（地）はいくつに分かれているか
   斑は小さな島がたくさん。迷路は島がひとつにつながり地を半分占める。
   孔は前景が地を覆い、ぽつぽつと孔（背景の島）があく。縞はその中間。
   そして見分けた肌に、棲む獣の名を一頭、種から決めて名のらせる。
   生・星・雪と続く「ひとりでに名づける」系譜の、肌の章。
   ============================================================ */
import { RNG } from './rng.js';

// V の高い領域のしきい値（最大値の半分。模様の濃淡によらず公平に測る）。
function maskOf(V, N) {
  let mx = 0;
  for (let i = 0; i < N * N; i++) if (V[i] > mx) mx = V[i];
  const thr = mx * 0.5;
  const m = new Uint8Array(N * N);
  let cov = 0;
  for (let i = 0; i < N * N; i++) if (V[i] > thr) { m[i] = 1; cov++; }
  return { m, coverage: cov / (N * N), mx };
}

// トーラス（上下左右が地続き）上で、value に等しい連結成分の数を数える（4近傍）。
function components(mask, N, value) {
  const seen = new Uint8Array(N * N);
  let count = 0;
  const stack = [];
  for (let s = 0; s < N * N; s++) {
    if (seen[s] || mask[s] !== value) continue;
    count++; seen[s] = 1; stack.length = 0; stack.push(s);
    while (stack.length) {
      const i = stack.pop(), x = i % N, y = (i / N) | 0;
      const nb = [((x + 1) % N) + y * N, ((x - 1 + N) % N) + y * N,
                  x + ((y + 1) % N) * N, x + ((y - 1 + N) % N) * N];
      for (const j of nb) if (!seen[j] && mask[j] === value) { seen[j] = 1; stack.push(j); }
    }
  }
  return count;
}

// 模様を測る（DOM 非依存。数だけ返す）。
export function measure(F) {
  const { N, V } = F;
  const { m, coverage, mx } = maskOf(V, N);
  const fg = components(m, N, 1);   // V の高い島の数
  const bg = components(m, N, 0);   // 地（隙間）の島の数
  // 縞っぽさ：前景の周長 ÷ 面積（細長い・くねるほど大きい）。
  let perim = 0, area = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; if (!m[i]) continue; area++;
    const r = m[((x + 1) % N) + y * N], d = m[x + ((y + 1) % N) * N];
    if (!r) perim++; if (!d) perim++;
  }
  const sinuosity = area ? perim / area : 0;
  return { coverage, fg, bg, sinuosity, peak: mx };
}

/* 形の名づけ。
   死（一様で模様なし）→ 'void'。
   覆い率が高く、地に孔が多い → 'holes'（孔）。
   覆い率が低く、小さな島が多い → 'spots'（斑）。
   島がつながり地を半ば占める（くねる）→ 'maze'（迷路）。
   その中間で前景が細長い → 'stripes'（縞）。 */
export function classify(F) {
  const m = (F.coverage !== undefined) ? F : measure(F);
  const { coverage, fg, bg, sinuosity, peak } = m;
  if (peak < 0.02 || sinuosity < 1e-6) return 'void';        // 模様が立たなかった
  if (coverage >= 0.55 && bg >= 3) return 'holes';
  if (coverage <= 0.22 && fg >= 6) return 'spots';
  if (coverage >= 0.36 && fg <= Math.max(6, bg)) return 'maze';
  return 'stripes';
}

/* 棲む獣の名。肌の形ごとに、ありうる生きものをそろえ、種から一頭を選ぶ。
   coat（肌）に偽りはない——豹は斑から、虎は縞から、脳珊瑚は迷路から生まれる。 */
const BESTIARY = {
  spots: [
    ['ヒョウ', 'leopard', 'バラの形の花斑（ロゼット）を着た、夜の狩人。'],
    ['ジャガー', 'jaguar', '花斑の真ん中に、もうひと粒を抱く。'],
    ['キリン', 'giraffe', '網の目に割れた、乾いた大地のような肌。'],
    ['テントウムシ', 'ladybird', '赤地に黒、数えられるほどの粒。'],
    ['ウミウシ', 'sea slug', '誰にも見せぬ岩陰で、毒々しいほど鮮やかに。'],
    ['ホロホロチョウ', 'guineafowl', '一面に撒かれた、白い真珠の点描。'],
  ],
  stripes: [
    ['トラ', 'tiger', '縦縞は、藪の光と影に溶けるための迷彩。'],
    ['シマウマ', 'zebra', '一頭ごとに、世にふたつとない縞の指紋。'],
    ['エンゼルフィッシュ', 'angelfish', '水の中をすべる、垂直の帯。'],
    ['タテガミオオカミ', 'mackerel cat', '鯖縞（さばじま）の、流れる背。'],
    ['ベンガルヤマネコ', 'marbled', '溶けて流れる、大理石の縞。'],
  ],
  maze: [
    ['ノウサンゴ', 'brain coral', '海の底に、ひとつづきの迷路を彫る。'],
    ['ハコフグ', 'pufferfly', '顔いちめんに、迷宮の地図を描く。'],
    ['指紋', 'fingerprint', '渦と分岐、二度と同じものはない手の地図。'],
    ['ミミズ', 'worm-track', 'うねり、もつれ、つながって果てない筋。'],
    ['キノコの襞', 'gill', '傘の裏に整然と並ぶ、ひだの迷路。'],
  ],
  holes: [
    ['ハチの巣', 'honeycomb', '満ちた地に、規則正しく孔がならぶ。'],
    ['チーズ', 'emmental', 'みっしりと詰まって、ところどころに気泡。'],
    ['海綿', 'sponge', '無数の孔で、海の水をくぐらせる。'],
    ['軽石', 'pumice', '火に焼かれて、泡のまま固まった石。'],
    ['蓮の実', 'lotus pod', '托（うてな）の面に、種を抱く穴。'],
  ],
  void: [
    ['無地', 'plain', '模様は、まだ立たなかった。地はただ一様に静か。'],
  ],
};

export function nameOf(seed, klass) {
  const list = BESTIARY[klass] || BESTIARY.void;
  const pick = list[new RNG(seed).fork('name').int(list.length)];
  return { kana: pick[0], en: pick[1], note: pick[2], coat: klass };
}

// 種から、できあがった肌の素性をひとまとめに返す（CLI・UI の見出し用）。
export function identify(F) {
  const m = measure(F);
  const klass = classify(m);
  const name = nameOf(F.seed, klass);
  return { ...m, coat: klass, ...name };
}
