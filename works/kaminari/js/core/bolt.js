/* ============================================================
   雷 — 種から、稲妻がひとりでに地への道をさがす。

   誰も稲妻の枝を描かない。電位の場（ラプラス方程式）が空に張り、
   先端は「ひらいた野＝電位の高いほう」へ確率的に伸びる
   ——誘電破壊モデル（dielectric breakdown）。`生` が神経を、`史` が
   経路探索を、`星` が最小全域木を持ったように、ここでは雷が
   「場の自己組織化」で枝を生む。同じ種からは、一閃も違わない同じ雷。
   コアは DOM を知らない — Node の中でも、同じ光が走る。
   ============================================================ */

import { RNG } from './rng.js';

export const GRID_W = 51;        // 空の幅（マス）
export const GRID_H = 76;        // 雲（上）から地（下）まで
const ETA = 3.0;                 // 枝分かれの鋭さ：大きいほど一条に近い稲妻
const INIT_SWEEPS = 60;          // 最初に場を解く回数
const STEP_SWEEPS = 8;           // 一マス伸ばすごとに場を緩める回数
const MAX_CELLS = GRID_W * GRID_H >> 1;   // 念のための上限

const idx = (x, y) => y * GRID_W + x;

/* 電位の場を緩める（ガウス＝ザイデル法）。固定セル（雷＝0・地＝1）は動かさない。
   横と上の境界は絶縁（自分自身を隣とみなす＝ゼロ流束）。 */
function relax(phi, fixed, sweeps) {
  for (let s = 0; s < sweeps; s++) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = idx(x, y);
        if (fixed[i]) continue;
        const xm = x > 0 ? x - 1 : x, xp = x < GRID_W - 1 ? x + 1 : x;
        const ym = y > 0 ? y - 1 : y, yp = y < GRID_H - 1 ? y + 1 : y;
        phi[i] = 0.25 * (phi[idx(xm, y)] + phi[idx(xp, y)] + phi[idx(x, ym)] + phi[idx(x, yp)]);
      }
    }
  }
}

/* ----- 名づけ — 開いた音だけの、やわらかな架空語（`星` と同じ音韻） ----- */
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

/* ----- 落ちた先（土地）と、その一行 ----- */
const PLACES = [
  ['岬のひとつ松', '帆を畳んだ船が、遠くでそれを数えた。'],
  ['丘のいただきの祠', '誰も詣でぬ社の、千年の杉に道がついた。'],
  ['海のうえ', '水面が一瞬、空をそっくり映してから消えた。'],
  ['古い鉄塔', '錆びた骨が受けとめ、地の底へ逃がした。'],
  ['河の中洲', '夜の鷺が一羽、白いまま飛び立った。'],
  ['街はずれの一本道', '濡れた舗装が、稲光を二度光らせた。'],
  ['野の真ん中の一樹', 'その木は割れず、ただ深く息を吸った。'],
  ['湖の小島', '波紋がひとつ、岸へ着くまで広がりつづけた。'],
];

/* ----- かたち（枝ぶり）から呼び名 -----
   ちいさな突起は数えず、太い枝（下流をたくさん抱える枝）だけを「肢」と数える。 */
function kindOf(limbs, span) {
  if (span.w >= GRID_W * 0.55) return 'くもの手';      // 横に這う蜘蛛雷
  if (limbs <= 2) return 'ひとすじ';                    // ほぼ一条
  if (limbs <= 6) return 'みつまた';                    // ほどよく分岐
  return 'えだ雷';                                      // よく分かれる
}

/* ============================================================
   makeBolt(seed) — 稲妻ひとつ
   ============================================================ */
export function makeBolt(seed) {
  seed = seed >>> 0;
  const rng = new RNG(seed ^ 0x1d872b41);

  const N = GRID_W * GRID_H;
  const phi = new Float64Array(N);
  const fixed = new Uint8Array(N);

  // 初期場：上（雲・雷＝0）から下（地＝1）への線形勾配
  for (let y = 0; y < GRID_H; y++) {
    const v = y / (GRID_H - 1);
    for (let x = 0; x < GRID_W; x++) phi[idx(x, y)] = v;
  }
  // 地（最下行）を 1 に固定
  for (let x = 0; x < GRID_W; x++) { const i = idx(x, GRID_H - 1); fixed[i] = 1; phi[i] = 1; }

  // 起点：上辺のまんなか付近（種でわずかに揺らす）
  const ox = (GRID_W >> 1) + rng.int(7) - 3;
  const cells = [];
  const onBolt = new Uint8Array(N);
  function addCell(x, y, parent) {
    const i = idx(x, y);
    fixed[i] = 1; phi[i] = 0; onBolt[i] = 1;
    const c = { x, y, parent, depth: parent < 0 ? 0 : cells[parent].depth + 1, children: [] };
    cells.push(c);
    if (parent >= 0) cells[parent].children.push(cells.length - 1);
    return cells.length - 1;
  }
  addCell(ox, 0, -1);
  relax(phi, fixed, INIT_SWEEPS);

  // 候補（雷に隣接する空きマス）→ そのマスに最も近い雷セルの index
  const cand = new Map();
  function refreshCand(ci) {
    const c = cells[ci];
    const nb = [[c.x - 1, c.y], [c.x + 1, c.y], [c.x, c.y - 1], [c.x, c.y + 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const ni = idx(nx, ny);
      if (onBolt[ni]) continue;
      // すでに候補なら、より浅い（起点に近い）親を優先 — 自然な幹を育てる
      const prev = cand.get(ni);
      if (prev === undefined || cells[ci].depth < cells[prev].depth) cand.set(ni, ci);
    }
  }
  refreshCand(0);

  let strike = null;
  while (cand.size && cells.length < MAX_CELLS) {
    // 候補の重み = 電位^ETA（地に近い＝場のひらいたほうが伸びやすい）
    let total = 0;
    const keys = [...cand.keys()];                       // Map は挿入順＝決定的
    const w = new Float64Array(keys.length);
    for (let k = 0; k < keys.length; k++) {
      const p = phi[keys[k]];
      const ww = p > 0 ? Math.pow(p, ETA) : 0;
      w[k] = ww; total += ww;
    }
    // ひとつ選ぶ（決定的な輪盤）
    let r = rng.next() * total, pick = keys.length - 1;
    for (let k = 0; k < keys.length; k++) { r -= w[k]; if (r <= 0) { pick = k; break; } }

    const ni = keys[pick];
    const nx = ni % GRID_W, ny = (ni / GRID_W) | 0;
    const parent = cand.get(ni);
    cand.delete(ni);
    const ci = addCell(nx, ny, parent);

    if (ny === GRID_H - 1) { strike = cells[ci]; break; }   // 接地 — ここで止まる
    relax(phi, fixed, STEP_SWEEPS);
    refreshCand(ci);
  }

  // 念のため：地に届かなかったら、いちばん下のセルから真下へ落とす
  if (!strike) {
    let low = cells[0];
    for (const c of cells) if (c.y > low.y) low = c;
    let p = cells.indexOf(low);
    for (let y = low.y + 1; y < GRID_H; y++) {
      if (onBolt[idx(low.x, y)]) break;
      p = addCell(low.x, y, p);
    }
    strike = cells[p];
  }

  // 幹（リーダー）：接地点から起点へ親をたどる道
  const main = new Set();
  for (let p = cells.indexOf(strike); p >= 0; p = cells[p].parent) main.add(p);
  for (const c of cells) c.main = false;
  for (const p of main) cells[p].main = true;

  // 流れ（電流の太さ）：各セルの子孫数 ＝ 下流に何本ぶら下がるか
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    c.flow = 1;
    for (const ch of c.children) c.flow += cells[ch].flow;
  }

  // かたちと枝ぶり — 太い枝（下流 flow≥4 の子が 2 本以上）だけを「肢」と数える
  let minx = GRID_W, maxx = 0, miny = GRID_H, maxy = 0, forks = 0, limbs = 0;
  for (const c of cells) {
    minx = Math.min(minx, c.x); maxx = Math.max(maxx, c.x);
    miny = Math.min(miny, c.y); maxy = Math.max(maxy, c.y);
    if (c.children.length >= 2) forks++;
    if (c.children.filter(ch => cells[ch].flow >= 4).length >= 2) limbs++;
  }
  const span = { w: maxx - minx, h: maxy - miny };
  const kind = kindOf(limbs, span);

  // 名づけ — 稲妻は、おのれの名を一閃のうちに名のる
  const nameRng = new RNG(seed ^ 0x5bd1e995);
  const name = coinName(nameRng, 3);

  // 落ちた先 — 接地点の位置から決まる土地
  const place = PLACES[(Math.imul(strike.x + 1, 0x9e3779b9) >>> 0) % PLACES.length];
  const struck = `${place[0]}を撃った。${place[1]}`;

  // 由来 — 記憶を持たない次の人への言づて（`星` の一番星と同じ作法）
  const tale = `最初の閃光、${name}。空は割れ、道はおのずと地をさがす。`
    + `あなたのあとに来る人も、まずこの光を探すだろう。`;

  return {
    seed, width: GRID_W, height: GRID_H,
    cells, strike, origin: cells[0],
    name, kind, struck, tale,
    forks, span,
  };
}

/* 稲妻の銘 — 種と枝のかたちの指紋。一閃でもずれれば変わる（手紙の封蝋）。 */
export function boltFingerprint(bolt) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= v & 0xff; h = Math.imul(h, 0x01000193); };
  mix(bolt.seed); mix(bolt.seed >>> 8); mix(bolt.seed >>> 16);
  mix(bolt.cells.length);
  for (const c of bolt.cells) { mix(c.x); mix(c.y); }
  for (const ch of bolt.name) mix(ch.charCodeAt(0));
  return (h >>> 0).toString(16).padStart(8, '0');
}
