/* ============================================================
   空 — 種から星を撒き、明るい星をひとりでに結んで、
   星座に名前と由来をつける。誰も設計しない夜空。

   `言` が言葉を、`歌` が旋律を、`史` が歴史を、誰の手も借りずに
   生んだように、ここでは星座とその名と神話が、種ひとつから決まる。
   同じ種からは、一画素も一文字もちがわない同じ空がひらく。
   コアは DOM を知らない — Node の中でも、同じ星が瞬く。
   ============================================================ */

import { RNG } from './rng.js';

export const WIDTH = 1000, HEIGHT = 1000;
const NUM_STARS = 600;
const NUM_BRIGHT = 48;          // 星座を結ぶ候補になる明るい星の数
const LINK_RADIUS = 175;        // この距離までの明るい星どうしが結ばれる
const MIN_MEMBERS = 3, MAX_MEMBERS = 6;

/* ----- 星の色（温度 0=青白い・熱い … 1=赤い・冷たい） ----- */
const COLOR_STOPS = [
  [0.00, [180, 205, 255]],
  [0.28, [226, 236, 255]],
  [0.52, [255, 246, 226]],
  [0.74, [255, 220, 168]],
  [1.00, [255, 182, 150]],
];
export function starColor(temp) {
  const t = Math.max(0, Math.min(1, temp));
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [t1, c1] = COLOR_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = COLOR_STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1].slice();
}
function colorWord(temp) {
  return temp < 0.22 ? '青' : temp < 0.48 ? '白' : temp < 0.72 ? '金' : '赤';
}

/* ----- 名づけ — 開いた音だけの、やわらかな架空語 ----- */
const SYL = (
  'アイウエオ カキクケコ サシスセソ タチツテト ナニヌネノ ' +
  'ハヒフヘホ マミムメモ ヤユヨ ラリルレロ ワ ' +
  'ガギグゲゴ ザジズゼゾ ダヂヅデド バビブベボ'
).replace(/ /g, '').split('');
const LONG = 'ー';

function coinName(rng, syllables) {
  let s = '';
  for (let i = 0; i < syllables; i++) {
    s += rng.pick(SYL);
    if (i > 0 && i < syllables - 1 && rng.next() < 0.18) s += LONG;  // ときどき伸ばす
  }
  return s;
}

/* ----- 幾何のこまごま ----- */
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/* 群れを最小全域木で結ぶ（明るい星から育つ枝）。決定的。 */
function mst(members) {
  const n = members.length;
  if (n < 2) return [];
  const inTree = new Array(n).fill(false);
  inTree[0] = true;
  const edges = [];
  for (let k = 1; k < n; k++) {
    let best = -1, bestJ = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inTree[j]) continue;
        const d = dist2(members[i], members[j]);
        if (d < bestD) { bestD = d; best = i; bestJ = j; }
      }
    }
    inTree[bestJ] = true;
    edges.push([best, bestJ]);
  }
  return edges;
}

/* ----- 星座の由来（かたちと色から、物語が決まる） ----- */
function shapeWord(members) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const m of members) {
    minx = Math.min(minx, m.x); maxx = Math.max(maxx, m.x);
    miny = Math.min(miny, m.y); maxy = Math.max(maxy, m.y);
  }
  const w = maxx - minx + 1, h = maxy - miny + 1;
  const aspect = Math.max(w, h) / Math.min(w, h);
  if (aspect > 2.4) return 'long';     // 細長い
  if (aspect < 1.25) return 'round';   // まるい
  return 'spread';                     // 広がる
}

const MYTH = {
  long: ['{c}い{n}は、天をよこぎる{r}。渡り損ねた者の足あとだという。',
    '{n}という{r}。地の果てまで続いていて、たどると朝に出るらしい。'],
  round: ['{n}は、{c}く灯る{r}。落とした者がいまも探しているという。',
    '{c}い{r}、{n}。瞬きのあいだに願いをひとつ、預かってくれる。'],
  spread: ['翼をひろげた{r}、{n}。{c}い羽が、夜のはじを撫でる。',
    '{n}という{r}。離ればなれの星が、ひとつの名で呼ばれることを選んだ。'],
};
const ROLE = {
  long: ['河', '路', '蛇', '弓'],
  round: ['珠', '眼', '灯', '実'],
  spread: ['鳥', '樹', '帆', '手'],
};
function makeMyth(rng, members, lead) {
  const shape = shapeWord(members);
  const role = rng.pick(ROLE[shape]);
  const tmpl = rng.pick(MYTH[shape]);
  const name = members.name;
  return tmpl.replace('{n}', name).replace('{r}', role).replace('{c}', colorWord(lead.temp))
    + `　${members.length} つ星。主星は${colorWord(lead.temp)}い「${lead.name}」。`;
}

/* ============================================================
   makeSky(seed) — 夜空ひとつ
   ============================================================ */
export function makeSky(seed) {
  const rng = new RNG(seed >>> 0);
  const stars = [];
  for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
      id: i,
      x: rng.float(0, WIDTH),
      y: rng.float(0, HEIGHT),
      mag: -1 + 7 * rng.skew(1.7),     // 等級：-1（明るい）〜 6（かすか）
      temp: rng.skew(0.9),             // 色温度
      name: '',
      twinkle: rng.float(0, Math.PI * 2),
    });
  }
  for (const s of stars) s.color = starColor(s.temp);

  // 明るい順に候補を選ぶ（同等級は id で割る＝決定的）
  const bright = stars.slice().sort((a, b) => a.mag - b.mag || a.id - b.id).slice(0, NUM_BRIGHT);

  // 空ぜんたいの一番星（主星）を先に名づける — 最初に灯った星。
  const leadStar = bright[0];
  leadStar.name = coinName(new RNG((seed >>> 0) ^ 0x5bd1e995), 3);
  leadStar.isLead = true;
  leadStar.myth = `最初に灯った星、${leadStar.name}。`
    + `みなはこの灯を目あてに、暗がりを渡ってゆく。`
    + `あなたのあとに来る人も、まずこの星を探すだろう。`;

  // 星座を結ぶ：明るい星から、近くの明るい星を半径内で集める
  const used = new Set();
  const constellations = [];
  const nameRng = new RNG((seed >>> 0) ^ 0x9e3779b9);
  for (const seedStar of bright) {
    if (used.has(seedStar.id)) continue;
    const near = bright
      .filter(s => !used.has(s.id) && dist2(s, seedStar) <= LINK_RADIUS * LINK_RADIUS)
      .sort((a, b) => dist2(a, seedStar) - dist2(b, seedStar) || a.id - b.id)
      .slice(0, MAX_MEMBERS);
    if (near.length < MIN_MEMBERS) { used.add(seedStar.id); continue; }
    for (const s of near) used.add(s.id);
    const members = near.slice();
    const lead = members.slice().sort((a, b) => a.mag - b.mag || a.id - b.id)[0];
    const syllables = 2 + (members.length >= 5 ? 1 : 0) + (nameRng.next() < 0.4 ? 1 : 0);
    members.name = coinName(nameRng, syllables);
    if (!lead.name) lead.name = coinName(nameRng, 2 + (nameRng.next() < 0.4 ? 1 : 0));
    members.lead = lead;
    members.edges = mst(members);
    members.myth = makeMyth(nameRng, members, lead);
    let cx = 0, cy = 0;
    for (const m of members) { cx += m.x; cy += m.y; }
    constellations.push({
      name: members.name,
      stars: members,
      edges: members.edges,
      lead,
      myth: members.myth,
      cx: cx / members.length,
      cy: cy / members.length,
    });
  }

  return { seed: seed >>> 0, width: WIDTH, height: HEIGHT, stars, constellations, leadStar };
}

/* 空の銘 — 種と中身の指紋。一星でもずれれば変わる（手紙の封蝋）。 */
export function skyFingerprint(sky) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= v & 0xff; h = Math.imul(h, 0x01000193); };
  mix(sky.seed); mix(sky.seed >>> 8); mix(sky.seed >>> 16);
  for (const s of sky.stars) {
    mix(Math.round(s.x)); mix(Math.round(s.y)); mix(Math.round((s.mag + 1) * 40));
  }
  mix(sky.constellations.length);
  for (const c of sky.constellations) for (const ch of c.name) mix(ch.charCodeAt(0));
  for (const ch of sky.leadStar.name) mix(ch.charCodeAt(0));
  return (h >>> 0).toString(16).padStart(8, '0');
}
