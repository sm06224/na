/* ============================================================
   種 — 種ひとつから、草木がひとりでに芽ぐむ。

   誰も枝ぶりを描かない。一文字の規則（L-システム）が、種から
   ほどけるように同じ文字を書き換えつづけ、亀（タートル）がそれを
   なぞって茎と葉になる。育つ向きは「重力と陽（屈性）」がそっと曲げる
   ——ホンダの屈性モデル。`雷` が電位の場で枝を生み、`星` が最小全域木で
   星座を結んだように、ここでは草木が「書き換え規則の自己相似」で立つ。

   種は二重の意味を負う——乱数の種であり、土に蒔く種でもある。
   同じ種からは、葉の一枚までちがわない同じ草木。土さえあれば、何度でも。
   コアは DOM を知らない — Node の中でも、同じ草木が芽ぐむ。
   ============================================================ */

import { RNG } from './rng.js';

const DEG = Math.PI / 180;
const MAX_SYMBOLS = 90000;   // 書き換えの上限（念のため）
const MAX_NODES = 4200;      // 茎の節の上限

/* ----- 書き換え規則の見本 — どれも「無から自己相似で立つ」古典の系譜 ----- */
/* 規則は文字 → 展開。値が配列なら、そのつど種で一つ選ぶ（個体差）。
   現れない文字はそのまま残る（+ - [ ] は亀の所作、X は伸びしろの芽）。 */
const SPECIES = [
  { // 0 草本フラクタル（教科書の「植物」） — こんもり茂る
    name: 'fractal',
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: [22, 28], iters: [4, 6], gravity: [-0.02, 0.02],
  },
  { // 1 叢（くさむら） — 左右に開いて茂る
    name: 'bush',
    axiom: 'F',
    rules: { F: ['FF+[+F-F-F]-[-F+F+F]', 'FF-[-F+F+F]+[+F-F-F]'] },
    angle: [20, 25], iters: [3, 4], gravity: [-0.03, 0.0],
  },
  { // 2 立木（りゅうぼく） — 幹から枝、上へ
    name: 'tree',
    axiom: 'X',
    rules: { X: ['F[+X]F[-X]+X', 'F[-X]F[+X]-X', 'F[+X][-X]FX'], F: ['FF', 'F'] },
    angle: [16, 28], iters: [4, 6], gravity: [0.01, 0.05],
  },
  { // 3 枝垂れ（しだれ） — 細く伸びて、垂れる
    name: 'weeping',
    axiom: 'X',
    rules: { X: ['F[+X]F[-X]X', 'F[-X]F[+X]X'], F: 'FF' },
    angle: [10, 18], iters: [5, 7], gravity: [-0.10, -0.05],
  },
  { // 4 羊歯（しだ） — 羽のように細かく分かれる
    name: 'fern',
    axiom: 'X',
    rules: { X: 'F[+X][-X]FX', F: 'FF' },
    angle: [22, 28], iters: [5, 7], gravity: [0.0, 0.03],
  },
];

/* ----- 名づけ — 開いた音だけの、やわらかな架空語（`星`・`雷` と同じ音韻） ----- */
const SYL = (
  'アイウエオ カキクケコ サシスセソ タチツテト ナニヌネノ ' +
  'ハヒフヘホ マミムメモ ヤユヨ ラリルレロ ワ ' +
  'ガギグゲゴ ザジズゼゾ ダヂヅデド バビブベボ'
).replace(/ /g, '').split('');
function coinName(rng, syllables) {
  let s = '';
  for (let i = 0; i < syllables; i++) {
    s += rng.pick(SYL);
    if (i > 0 && i < syllables - 1 && rng.next() < 0.18) s += 'ー';
  }
  return s;
}

/* ----- 季（き） — 種から決まる、芽ぐむ季節。葉のいろと花の数を分ける ----- */
const SEASONS = [
  { key: '春', en: 'spring', bloom: 0.55, leaf: '#7fd07a' },
  { key: '夏', en: 'summer', bloom: 0.18, leaf: '#3f9d52' },
  { key: '秋', en: 'autumn', bloom: 0.10, leaf: '#e08a3a' },
  { key: '冬', en: 'winter', bloom: 0.02, leaf: '#8aa0a8' },
];

/* ----- L-システム：種から規則をほどく ----- */
function expand(species, iters, rng) {
  let s = species.axiom;
  for (let it = 0; it < iters; it++) {
    let out = '';
    for (const ch of s) {
      const rule = species.rules[ch];
      if (rule === undefined) { out += ch; continue; }
      out += Array.isArray(rule) ? rng.pick(rule) : rule;
      if (out.length > MAX_SYMBOLS) return out;   // 暴走を止める
    }
    s = out;
    if (s.length > MAX_SYMBOLS) break;
  }
  return s;
}

/* ----- 亀（タートル）：文字列をなぞって、茎の節の木を立てる -----
   数学座標（y は上向き＝上へ伸びる）。根は原点、最初は真上を向く。 */
function grow(str, opt, rng) {
  const baseAngle = opt.angle * DEG;
  const gravity = opt.gravity;     // 屈性の強さ（負＝下へ垂れる、正＝上へ）

  const nodes = [{ x: 0, y: 0, parent: -1, depth: 0, gen: 0, children: [] }];

  let x = 0, y = 0, ang = 90 * DEG; // 真上
  let cur = 0, depth = 0;
  const stack = [];

  for (const ch of str) {
    if (ch === 'F') {
      // 一歩進む（種でほんの少し揺らす＝手描きのゆらぎ）
      const step = 1 * (1 + rng.float(-0.12, 0.12));
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      const node = {
        x, y, parent: cur, depth,
        gen: nodes[cur].gen + 1, children: [],
      };
      nodes.push(node);
      const ni = nodes.length - 1;
      nodes[cur].children.push(ni);
      cur = ni;
      if (nodes.length >= MAX_NODES) break;

      // 屈性：進むたび、向きを目標（重力／陽）へほんの少し曲げる。
      // T=(0,±1)。曲げ量は H×T（外積の z）に比例（ホンダの屈性）。
      if (gravity !== 0) {
        const target = gravity < 0 ? -1 : 1;        // y 成分の符号
        const cross = Math.cos(ang) * target;       // Hx*Ty - Hy*Tx, T=(0,target)
        ang += Math.abs(gravity) * cross;
      }
    } else if (ch === '+') {
      ang += baseAngle * (1 + rng.float(-0.18, 0.18));
    } else if (ch === '-') {
      ang -= baseAngle * (1 + rng.float(-0.18, 0.18));
    } else if (ch === '[') {
      stack.push({ x, y, ang, cur, depth });
      depth++;
    } else if (ch === ']') {
      const st = stack.pop();
      if (st) { x = st.x; y = st.y; ang = st.ang; cur = st.cur; depth = st.depth; }
    }
  }

  // 葉は、できあがった木の「行き止まり（子を持たない節）」につく。
  // 向きは、親からその節へ向かう向き（枝の伸びる先）。
  const leaves = [];
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.children.length !== 0) continue;
    const p = nodes[n.parent];
    leaves.push({ node: i, ang: Math.atan2(n.y - p.y, n.x - p.x) });
  }

  return { nodes, leaves };
}

/* かたちから草姿（くさすがた）を見立てる — 品種ではなく、測った姿に名づける。
   誰も「この種は枝垂れ」と決めない。立ってみて、その影で呼ぶ。 */
function formOf(bounds, forks, downFrac) {
  const aspect = bounds.h / Math.max(1e-6, bounds.w);
  if (downFrac > 0.28) return '枝垂れ';   // 垂れる枝が多い
  if (aspect >= 2.0) return 'すらり';     // 縦に高い
  if (aspect <= 0.85) return '横這い';    // 横に這う
  if (forks >= 90) return 'こんもり';     // よく分かれて茂る
  if (forks >= 30) return 'ふさ';         // ほどよく房になる
  return '叢';                             // ちいさな群れ
}

/* ============================================================
   makePlant(seed) — 草木ひとつ
   ============================================================ */
export function makePlant(seed) {
  seed = seed >>> 0;
  const rng = new RNG(seed ^ 0x2e1a91d3);

  // 品種・季・形質を種から決める
  const species = SPECIES[rng.int(SPECIES.length)];
  const season = SEASONS[rng.int(SEASONS.length)];
  const iters = species.iters[0] + rng.int(species.iters[1] - species.iters[0] + 1);
  const angle = rng.float(species.angle[0], species.angle[1]);
  const gravity = rng.float(species.gravity[0], species.gravity[1]);

  // ほどいて、なぞる
  const str = expand(species, iters, rng);
  const { nodes, leaves } = grow(str, { angle, gravity }, rng);

  // 流れ（茎の太さ）：各節がぶら下げる子孫の数（根もとほど太い）
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    n.flow = 1;
    for (const c of n.children) n.flow += nodes[c].flow;
  }

  // 幹（みき）：根から、いちばん太い子をたどる一本道
  for (const n of nodes) n.main = false;
  let p = 0;
  while (p >= 0) {
    nodes[p].main = true;
    let best = -1, bestFlow = 0;
    for (const c of nodes[p].children) {
      if (nodes[c].flow > bestFlow) { bestFlow = nodes[c].flow; best = c; }
    }
    p = best;
  }

  // 入れ物（bounding box）と、下を向く枝の割合（枝垂れ具合）
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  let forks = 0, down = 0, edges = 0;
  for (const n of nodes) {
    minx = Math.min(minx, n.x); maxx = Math.max(maxx, n.x);
    miny = Math.min(miny, n.y); maxy = Math.max(maxy, n.y);
    if (n.children.length >= 2) forks++;
    if (n.parent >= 0) {
      edges++;
      if (n.y < nodes[n.parent].y) down++;   // 親より下＝垂れている
    }
  }
  const bounds = { minx, maxx, miny, maxy, w: maxx - minx, h: maxy - miny };
  const downFrac = edges ? down / edges : 0;

  // 花 — 季ぶんの確率で、葉のつく先のいくつかが咲く
  const flowers = [];
  const bloomRng = new RNG(seed ^ 0x85ebca6b);
  for (const lf of leaves) if (bloomRng.chance(season.bloom)) flowers.push(lf);

  const kind = formOf(bounds, forks, downFrac);
  const maxGen = nodes.reduce((m, n) => Math.max(m, n.gen), 0);

  // 名づけ — 草木は、おのれの名を芽のうちに名のる
  const nameRng = new RNG(seed ^ 0x27d4eb2f);
  const name = coinName(nameRng, 3);

  const line = `${season.key}に芽ぐむ、${kind}の${name}。`
    + `${nodes.length} 節・${leaves.length} 葉`
    + (flowers.length ? `・${flowers.length} 花` : '・花は持たず') + '。';

  // 由来 — 記憶を持たない次の人への言づて（`星`・`雷`・`窟` と同じ作法）
  const tale = `この種、${name}。土と水さえあれば、いつでもこの${kind}が立つ。`
    + `あなたが蒔いても、葉の一枚までちがわぬ同じ草木が芽ぐむだろう——種さえあれば、何度でも。`;

  return {
    seed, species: species.name, season: season.key, seasonEn: season.en, seasonLeaf: season.leaf,
    iters, angle, gravity,
    nodes, leaves, flowers, bounds, maxGen,
    kind, downFrac, forks, name, line, tale,
  };
}

/* 草木の銘 — 種と枝ぶりの指紋。葉の一枚でもずれれば変わる（手紙の封蝋）。 */
export function plantFingerprint(plant) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= v & 0xff; h = Math.imul(h, 0x01000193); };
  mix(plant.seed); mix(plant.seed >>> 8); mix(plant.seed >>> 16); mix(plant.seed >>> 24);
  mix(plant.nodes.length); mix(plant.leaves.length); mix(plant.flowers.length);
  for (const n of plant.nodes) { mix((n.x * 16) | 0); mix((n.y * 16) | 0); }
  for (const ch of plant.name) mix(ch.charCodeAt(0));
  mix(plant.season.charCodeAt(0));
  return (h >>> 0).toString(16).padStart(8, '0');
}
