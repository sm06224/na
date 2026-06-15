/* ============================================================
   窟 — 部屋と通路。古式ゆかしいダンジョン。
   矩形の部屋を撒き、重ならぬものだけ残し、近い順に結ぶ。
   ============================================================ */

import { T } from '../tile.js';
import { Rect } from '../util.js';
import { carveRoom, tunnelL, randomRoomRect } from './carve.js';

export function genRooms(level, rng, opts = {}) {
  const attempts = opts.attempts ?? 200;
  const minSize = opts.minSize ?? 4;
  const maxSize = opts.maxSize ?? 11;
  const maxRooms = opts.maxRooms ?? 24;
  const rooms = [];

  for (let i = 0; i < attempts && rooms.length < maxRooms; i++) {
    const rect = randomRoomRect(level, rng, minSize, maxSize, minSize, Math.min(maxSize, 9));
    if (rooms.some(r => rect.intersects(r, 1))) continue;
    carveRoom(level, rect, T.FLOOR);
    rooms.push(rect);
  }

  // 近い部屋どうしを順に結ぶ（最小全域木っぽく、貪欲に）
  connectRooms(level, rng, rooms);

  level.meta.rooms = rooms;
  level.theme = 'rooms';
  return rooms;
}

/* 部屋の中心を、いちばん近い「結び済み」へ繋いでいく */
export function connectRooms(level, rng, rooms) {
  if (rooms.length <= 1) return;
  const connected = [rooms[0]];
  const pending = rooms.slice(1);
  while (pending.length) {
    let best = -1, bestTo = null, bestD = Infinity;
    for (let i = 0; i < pending.length; i++) {
      for (const c of connected) {
        const d = (pending[i].cx - c.cx) ** 2 + (pending[i].cy - c.cy) ** 2;
        if (d < bestD) { bestD = d; best = i; bestTo = c; }
      }
    }
    const room = pending.splice(best, 1)[0];
    tunnelL(level, room.cx, room.cy, bestTo.cx, bestTo.cy, rng, T.CORRIDOR);
    connected.push(room);
  }
  // ときどき余分な近道を足して、回遊できる迷宮に
  const extra = Math.floor(rooms.length * 0.25);
  for (let i = 0; i < extra; i++) {
    const a = rng.pick(rooms), b = rng.pick(rooms);
    if (a !== b) tunnelL(level, a.cx, a.cy, b.cx, b.cy, rng, T.CORRIDOR);
  }
}
