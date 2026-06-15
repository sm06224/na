/* ============================================================
   陣 — 戦場を、種から生む。誰も地形を描かない。
   高さと湿りの場（自前のバリューノイズ）が、平地・森・山・水を選ぶ。
   そこへ道を通し、砦や玉座を据え、味方の布陣と敵の湧きを置く。
   同じ種からは、一マスもちがわぬ同じ戦場。`窟` の地下生成の、地上版。
   ============================================================ */

import { Board } from './board.js';
import { manhattan } from './grid.js';
import { RNG } from './rng.js';

/* バリューノイズ（格子のランダム値を双線形でなめらかに、数オクターブ重ねる） */
function valueNoise(rng, w, h, scale) {
  const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
  const g = [];
  for (let i = 0; i < gw * gh; i++) g.push(rng.next());
  const at = (gx, gy) => g[Math.min(gh - 1, gy) * gw + Math.min(gw - 1, gx)];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / scale, fy = y / scale;
      const x0 = fx | 0, y0 = fy | 0;
      const tx = fx - x0, ty = fy - y0;
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const top = a + (b - a) * sx, bot = c + (d - c) * sx;
      out[y * w + x] = top + (bot - top) * sy;
    }
  }
  return out;
}
function fbm(rng, w, h) {
  const a = valueNoise(rng.derive('n1'), w, h, 7);
  const b = valueNoise(rng.derive('n2'), w, h, 3.5);
  const c = valueNoise(rng.derive('n3'), w, h, 2);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] * 0.6 + b[i] * 0.3 + c[i] * 0.1);
  return out;
}

export const BIOMES = {
  green: { name: '緑野', water: 0.18, forest: 0.5, mountain: 0.82, base: 'grass', low: 'water', mid: 'forest', high: 'mountain' },
  desert: { name: '砂漠', water: 0.08, forest: 0.62, mountain: 0.85, base: 'sand', low: 'shallow', mid: 'sand', high: 'mountain' },
  snow: { name: '雪原', water: 0.14, forest: 0.55, mountain: 0.82, base: 'snow', low: 'ice', mid: 'forest', high: 'mountain' },
  ruins: { name: '廃都', water: 0.1, forest: 0.5, mountain: 0.86, base: 'floor', low: 'water', mid: 'ruins', high: 'wall' },
  volcano: { name: '火山', water: 0.16, forest: 0.6, mountain: 0.8, base: 'plain', low: 'lava', mid: 'hill', high: 'mountain' },
};
const BIOME_KEYS = Object.keys(BIOMES);

/* 戦場を生成。{ board, deploy:[{x,y}], spawns:[{x,y}], objective } を返す。 */
export function generateMap(seed, opts = {}) {
  const rng = (seed && seed.derive) ? seed : new RNG(seed >>> 0);
  const w = opts.w || 16, h = opts.h || 12;
  const biomeKey = opts.biome || BIOME_KEYS[rng.derive('biome').int(BIOME_KEYS.length)];
  const B = BIOMES[biomeKey] || BIOMES.green;
  const board = new Board(w, h);
  board.biome = biomeKey;

  const elev = fbm(rng.derive('elev'), w, h);
  const moist = fbm(rng.derive('moist'), w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = elev[y * w + x], m = moist[y * w + x];
      let t = B.base;
      if (e < B.water) t = B.low;
      else if (e > B.mountain) t = 'peak';
      else if (e > B.mountain - 0.08) t = B.high;
      else if (e > B.forest && m > 0.55) t = B.mid;
      else if (m > 0.62) t = (biomeKey === 'snow' ? 'snow' : 'forest');
      else if (m < 0.32 && B.base === 'grass') t = 'plain';
      board.setTerrain(x, y, t);
    }
  }

  // 道を一本通す（左から右へ、なだらかな所を選んで）
  const roadRng = rng.derive('road');
  let ry = (h / 2) | 0;
  for (let x = 0; x < w; x++) {
    board.setTerrain(x, ry, board.terrainAt(x, ry).id === 'water' || board.terrainAt(x, ry).id === 'lava' ? 'bridge' : 'road');
    if (roadRng.chance(0.5)) ry += roadRng.int(3) - 1;
    ry = Math.max(1, Math.min(h - 2, ry));
  }

  // 布陣（左端寄り）と敵湧き（右側）
  const deploy = [];
  for (let y = 1; y < h - 1 && deploy.length < 10; y++)
    for (let x = 0; x < 3 && deploy.length < 10; x++)
      if (passable(board, x, y)) deploy.push({ x, y });

  const spawns = [];
  const sRng = rng.derive('spawn');
  let tries = 0;
  while (spawns.length < (opts.enemyCount || 6) && tries++ < 500) {
    const x = sRng.range((w * 0.45) | 0, w - 1);
    const y = sRng.range(1, h - 2);
    if (passable(board, x, y) && !spawns.some(s => s.x === x && s.y === y)) spawns.push({ x, y });
  }

  // 目標と、それに応じた地形（砦・玉座）
  const objective = pickObjective(board, rng.derive('obj'), opts, spawns);

  return { board, deploy, spawns, objective, biome: biomeKey };
}

function passable(board, x, y) {
  const t = board.terrainAt(x, y);
  return t.move !== Infinity && t.id !== 'wall';
}

function pickObjective(board, rng, opts, spawns) {
  const w = board.w, h = board.h;
  const kind = opts.objective || rng.pick(['rout', 'seize', 'defeat_boss', 'seize', 'rout']);
  if (kind === 'seize') {
    // 右奥に玉座を据える
    let best = { x: w - 2, y: (h / 2) | 0 };
    board.setTerrain(best.x, best.y, 'throne');
    return { type: 'seize', x: best.x, y: best.y };
  }
  return { type: kind === 'defeat_boss' ? 'defeat_boss' : 'rout' };
}
