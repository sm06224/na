/* ============================================================
   窟 — 迷路。再帰的後戻りで彫る、行き止まりだらけの隘路。
   そのままでは難物なので、少し編んで（braid）回遊できる窟にする。
   ============================================================ */

import { T } from '../tile.js';

export function genMaze(level, rng, opts = {}) {
  const w = level.w, h = level.h;
  // 偶数格子の壁、奇数格子の床（完全迷路の作法）
  for (let i = 0; i < level.tiles.length; i++) level.tiles[i] = T.WALL;

  const startX = 1, startY = 1;
  const stack = [{ x: startX, y: startY }];
  level.set(startX, startY, T.CORRIDOR);
  const dirs = [{ x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 }];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cand = [];
    for (const d of dirs) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && level.get(nx, ny) === T.WALL) cand.push(d);
    }
    if (!cand.length) { stack.pop(); continue; }
    const d = rng.pick(cand);
    level.set(cur.x + d.x / 2, cur.y + d.y / 2, T.CORRIDOR);
    level.set(cur.x + d.x, cur.y + d.y, T.CORRIDOR);
    stack.push({ x: cur.x + d.x, y: cur.y + d.y });
  }

  // braid：行き止まりをいくらか潰して輪を作る
  const braid = opts.braid ?? 0.4;
  braidMaze(level, rng, braid);

  level.theme = 'maze';
  level.meta.rooms = [];
  return level.walkableRegions()[0] || [];
}

function braidMaze(level, rng, ratio) {
  const deadEnds = [];
  for (let y = 1; y < level.h - 1; y++) for (let x = 1; x < level.w - 1; x++) {
    if (!level.walkable(x, y)) continue;
    let exits = 0;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (level.walkable(x + d[0], y + d[1])) exits++;
    if (exits === 1) deadEnds.push({ x, y });
  }
  for (const de of deadEnds) {
    if (!rng.chance(ratio)) continue;
    const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(d => ({ x: de.x + d[0], y: de.y + d[1] }))
      .filter(p => p.x > 0 && p.y > 0 && p.x < level.w - 1 && p.y < level.h - 1 && !level.walkable(p.x, p.y));
    if (walls.length) { const w = rng.pick(walls); level.set(w.x, w.y, T.CORRIDOR); }
  }
}
