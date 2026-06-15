/* ============================================================
   窟 — BSP。盤を二分木に裂き、葉ごとに部屋を彫り、
   兄弟どうしを結ぶ。整然とした、城のような階。
   ============================================================ */

import { T } from '../tile.js';
import { Rect } from '../util.js';
import { carveRoom, tunnelL } from './carve.js';

export function genBSP(level, rng, opts = {}) {
  const minLeaf = opts.minLeaf ?? 8;
  const maxLeaf = opts.maxLeaf ?? 18;
  const root = new Node(new Rect(1, 1, level.w - 2, level.h - 2));
  split(root, rng, minLeaf, maxLeaf, opts.depth ?? 5);

  const leaves = [];
  collectLeaves(root, leaves);

  const rooms = [];
  for (const leaf of leaves) {
    const b = leaf.bounds;
    const w = rng.range(Math.max(4, Math.floor(b.w * 0.55)), b.w - 1);
    const h = rng.range(Math.max(4, Math.floor(b.h * 0.55)), b.h - 1);
    const x = b.x + rng.range(0, b.w - w - 1);
    const y = b.y + rng.range(0, b.h - h - 1);
    const room = new Rect(x, y, w, h);
    leaf.room = room;
    carveRoom(level, room, T.FLOOR);
    rooms.push(room);
  }

  // 木をたどって、左右の子の部屋どうしを結ぶ
  connect(root, level, rng);

  level.meta.rooms = rooms;
  level.theme = 'bsp';
  return rooms;
}

class Node {
  constructor(bounds) { this.bounds = bounds; this.left = null; this.right = null; this.room = null; }
  get leaf() { return !this.left && !this.right; }
}

function split(node, rng, minLeaf, maxLeaf, depth) {
  if (depth <= 0) return;
  const b = node.bounds;
  if (b.w < minLeaf * 2 && b.h < minLeaf * 2) return;
  // 細長い方を裂く（比率が偏ったら）
  let horizontal = rng.chance(0.5);
  if (b.w > b.h && b.w / b.h >= 1.3) horizontal = false;
  else if (b.h > b.w && b.h / b.w >= 1.3) horizontal = true;

  if (horizontal) {
    if (b.h < minLeaf * 2) return;
    const cut = rng.range(minLeaf, b.h - minLeaf);
    node.left = new Node(new Rect(b.x, b.y, b.w, cut));
    node.right = new Node(new Rect(b.x, b.y + cut, b.w, b.h - cut));
  } else {
    if (b.w < minLeaf * 2) return;
    const cut = rng.range(minLeaf, b.w - minLeaf);
    node.left = new Node(new Rect(b.x, b.y, cut, b.h));
    node.right = new Node(new Rect(b.x + cut, b.y, b.w - cut, b.h));
  }
  // 大きすぎる葉はさらに裂く
  if (node.left.bounds.w > maxLeaf || node.left.bounds.h > maxLeaf || rng.chance(0.7))
    split(node.left, rng, minLeaf, maxLeaf, depth - 1);
  if (node.right.bounds.w > maxLeaf || node.right.bounds.h > maxLeaf || rng.chance(0.7))
    split(node.right, rng, minLeaf, maxLeaf, depth - 1);
}

function collectLeaves(node, out) {
  if (node.leaf) { out.push(node); return; }
  if (node.left) collectLeaves(node.left, out);
  if (node.right) collectLeaves(node.right, out);
}

/* ある部分木の代表となる部屋を返す（中心を結ぶため） */
function roomOf(node, rng) {
  if (node.room) return node.room;
  const a = node.left && roomOf(node.left, rng);
  const b = node.right && roomOf(node.right, rng);
  if (a && b) return rng.chance(0.5) ? a : b;
  return a || b;
}

function connect(node, level, rng) {
  if (node.leaf) return;
  connect(node.left, level, rng);
  connect(node.right, level, rng);
  const a = roomOf(node.left, rng), b = roomOf(node.right, rng);
  if (a && b) tunnelL(level, a.cx, a.cy, b.cx, b.cy, rng, T.CORRIDOR);
}
