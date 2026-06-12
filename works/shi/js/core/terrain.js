import { RNG } from './rng.js';
import { makeFBM } from './noise.js';

/* ============================================================
   地形 — 大陸、海、川、気候、土地の恵み。
   種（seed）だけから決定的に生成される。保存時は種だけ覚えれば良い。
   ============================================================ */

export const SIZE = 200;                  // 一辺のタイル数
export const WATER = { LAND: 0, OCEAN: 1, LAKE: 2 };
export const BIOME = {
  GRASS: 0, FOREST: 1, DESERT: 2, TUNDRA: 3, MOUNTAIN: 4,
};
export const RES = { NONE: 0, ORE: 1, STONE: 2, GAME: 3, FISH: 4 };

export const BIOME_FERT = [0.72, 0.55, 0.08, 0.16, 0.05];

export function generateTerrain(seed) {
  const rng = new RNG(seed ^ 0x7e11a);
  const fbmElev = makeFBM(seed, 5);
  const fbmMoist = makeFBM(seed + 7777, 4);
  const N = SIZE, total = N * N;

  const elev = new Float32Array(total);
  const water = new Uint8Array(total);
  const river = new Uint8Array(total);
  const biome = new Uint8Array(total);
  const moist = new Float32Array(total);
  const fert = new Float32Array(total);
  const resource = new Uint8Array(total);

  /* ---- 標高と湿度 ---- */
  const f = 4.6 / N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      elev[i] = fbmElev(x * f, y * f);
      moist[i] = fbmMoist(x * f * 1.4, y * f * 1.4);
    }
  }

  /* ---- 海水準：標高の下位 36% を水にする ---- */
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const sea = sorted[Math.floor(total * 0.36)];
  const peak = sorted[total - 1];

  /* ---- 海と湖の区別：外周から繋がる水だけが「海」 ---- */
  const isWet = i => elev[i] < sea;
  const queue = [];
  for (let x = 0; x < N; x++) {
    for (const i of [x, (N - 1) * N + x, x * N, x * N + N - 1]) {
      if (isWet(i) && water[i] === 0) { water[i] = WATER.OCEAN; queue.push(i); }
    }
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (isWet(j) && water[j] === 0) { water[j] = WATER.OCEAN; queue.push(j); }
    }
  }
  for (let i = 0; i < total; i++) {
    if (isWet(i) && water[i] === 0) water[i] = WATER.LAKE;
  }

  /* ---- 気候帯 → バイオーム ---- */
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (water[i] !== WATER.LAND) continue;
      const lat = Math.abs(y / N - 0.5) * 2;           // 0=赤道相当, 1=極
      const height = (elev[i] - sea) / (peak - sea);   // 0..1
      const temp = 1 - lat * 0.9 - height * 0.55;
      if (height > 0.62) biome[i] = BIOME.MOUNTAIN;
      else if (temp < 0.22) biome[i] = BIOME.TUNDRA;
      else if (moist[i] < 0.34 && temp > 0.55) biome[i] = BIOME.DESERT;
      else if (moist[i] > 0.55) biome[i] = BIOME.FOREST;
      else biome[i] = BIOME.GRASS;
    }
  }

  /* ---- 川：高地の湧水から海へ ---- */
  const springs = [];
  for (let tries = 0; tries < 4000 && springs.length < 26; tries++) {
    const i = rng.int(total);
    const height = (elev[i] - sea) / (peak - sea);
    if (water[i] === WATER.LAND && height > 0.42 && moist[i] > 0.4) springs.push(i);
  }
  for (const start of springs) {
    let cur = start;
    for (let step = 0; step < 500; step++) {
      if (river[cur]) break;                       // 既存の川に合流
      river[cur] = 1;
      const x = cur % N, y = (cur / N) | 0;
      let best = -1, bestE = elev[cur] + 1e-5;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        const e = elev[j] + rng.float(0, 0.004);   // わずかな揺らぎで蛇行する
        if (e < bestE) { bestE = e; best = j; }
      }
      if (best < 0) {                              // 窪地 → 湖になる
        water[cur] = WATER.LAKE;
        break;
      }
      if (water[best] !== WATER.LAND) break;       // 海・湖に注いだ
      cur = best;
    }
  }

  /* ---- 恵み（肥沃度）と資源 ---- */
  const nearWater = i => {
    const x = i % N, y = (i / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (water[j] === WATER.OCEAN) return 'coast';
      if (river[j] || water[j] === WATER.LAKE) return 'fresh';
    }
    return null;
  };
  for (let i = 0; i < total; i++) {
    if (water[i] !== WATER.LAND) continue;
    let v = BIOME_FERT[biome[i]] * (0.6 + 0.4 * moist[i]);
    const nw = nearWater(i);
    if (nw === 'fresh') v += 0.34;                 // 川辺は文明のゆりかご
    else if (nw === 'coast') v += 0.12;
    fert[i] = Math.min(1, v);

    const b = biome[i];
    if (b === BIOME.MOUNTAIN) {
      if (rng.chance(0.08)) resource[i] = RES.ORE;
      else if (rng.chance(0.1)) resource[i] = RES.STONE;
    } else if (b === BIOME.FOREST && rng.chance(0.08)) resource[i] = RES.GAME;
    else if (nw === 'coast' && rng.chance(0.12)) resource[i] = RES.FISH;
  }

  return { size: N, sea, peak, elev, water, river, biome, moist, fert, resource };
}

/* 移動コスト（道路探索・行軍に使う）。水は渡れない、川は橋を架ければ。 */
export function moveCost(terrain, i) {
  if (terrain.water[i] !== WATER.LAND) return Infinity;
  if (terrain.river[i]) return 6;                  // 架橋
  switch (terrain.biome[i]) {
    case BIOME.MOUNTAIN: return 5;
    case BIOME.FOREST: return 1.7;
    case BIOME.DESERT: return 1.5;
    case BIOME.TUNDRA: return 1.5;
    default: return 1;
  }
}
