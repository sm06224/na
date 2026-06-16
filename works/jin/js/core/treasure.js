/* ============================================================
   陣 — 宝箱と村。盤の上には、戦いのほかにも目がある。
   宝箱は鍵か盗賊の手で開き、中身を荷駄へ。村は訪う者に贈り物をする。
   配置も中身も種から決定的——同じ種なら、同じ宝が同じ場所に眠る。

   盤に board.objects = [{ type, x, y, ... done }] を載せる。戦闘の勝敗・
   経路・目標には関与しない（敵 AI も無視する）ので、全章の決着は不変。
   ============================================================ */

import { RNG } from './rng.js';
import { hasSkill } from './unit.js';

/* 宝箱の中身（章が進むほど豪華に寄る）。 */
const CHEST_TABLE = [
  { w: 26, gold: 1500 },
  { w: 20, gold: 3000 },
  { w: 14, item: 'chest_key' },
  { w: 12, item: 'killing_edge' },
  { w: 10, item: 'silver_sword' },
  { w: 8,  item: 'elixir' },
  { w: 6,  item: 'speedwing' },
  { w: 4,  item: 'silver_lance' },
];

/* 村の贈り物（戦には出ぬ実利か、ちょっとした金）。 */
const VILLAGE_TABLE = [
  { w: 24, gold: 1200 },
  { w: 18, item: 'vulnerary' },
  { w: 14, item: 'door_key' },
  { w: 12, item: 'angelic_robe' },
  { w: 10, item: 'energy_drop' },
  { w: 8,  item: 'goddess_icon' },
  { w: 6,  item: 'lockpick' },
];

/* 物を置けるマスか（通れて、特別なマスでなく、空いている）。 */
function placeable(board, x, y) {
  const t = board.terrainAt(x, y);
  if (!t || t.move === Infinity) return false;
  if (t.seize || t.heal || t.id === 'gate' || t.id === 'throne' || t.id === 'fort') return false;
  if (board.occupied && board.occupied(x, y)) return false;
  return true;
}

function rollTable(rng, table, chapterIndex) {
  // 章が進むと豪華側へ少し寄せる（重みを線形に補正）
  const tilt = Math.min(1.4, 1 + chapterIndex * 0.05);
  const e = rng.weighted(table.map((o, i) => ({ ...o, _w: o.w * (i >= table.length / 2 ? tilt : 1) })), o => o._w);
  return e.item ? { item: e.item } : { gold: e.gold | 0 };
}

/* 盤に宝箱と村を据える（決定的）。返り値は board.objects。 */
export function placeTreasures(board, seed, { chests = 0, villages = 0, chapterIndex = 0 } = {}) {
  const rng = (seed && seed.derive) ? seed : new RNG(seed >>> 0);
  board.objects = [];
  const spots = [];
  for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) if (placeable(board, x, y)) spots.push({ x, y });
  const order = rng.shuffle(spots);
  let k = 0;
  for (let i = 0; i < chests && k < order.length; i++, k++) {
    const { x, y } = order[k];
    board.objects.push({ type: 'chest', x, y, locked: rng.chance(0.5), loot: rollTable(rng.derive('chest' + i), CHEST_TABLE, chapterIndex), done: false });
  }
  for (let i = 0; i < villages && k < order.length; i++, k++) {
    const { x, y } = order[k];
    board.objects.push({ type: 'village', x, y, gift: rollTable(rng.derive('village' + i), VILLAGE_TABLE, chapterIndex), done: false });
  }
  return board.objects;
}

/* このマスの、まだ手つかずのオブジェクト。 */
export function treasureAt(board, x, y) {
  return (board.objects || []).find(o => o.x === x && o.y === y && !o.done) || null;
}

/* 荷物のなかの鍵・鍵開けの番号（なければ -1）。 */
export function keyIndex(unit, kinds = ['chest_key', 'lockpick']) {
  if (!unit.items) return -1;
  return unit.items.findIndex(it => kinds.includes(it.id));
}

/* この者は、この宝箱を開けられるか。 */
export function canOpenChest(unit, obj) {
  if (!obj || obj.type !== 'chest') return false;
  if (!obj.locked) return true;                          // 施錠なしなら誰でも
  return hasSkill(unit, 'lockpick') || keyIndex(unit) >= 0;   // 盗賊の手か、鍵
}

/* 宝箱を開ける。{ loot, usedKey } を返す。施錠は盗賊以外なら鍵を一つ消費。 */
export function openChest(obj, unit) {
  obj.done = true;
  let usedKey = null;
  if (obj.locked && !hasSkill(unit, 'lockpick')) {
    const ki = keyIndex(unit);
    if (ki >= 0) {
      usedKey = unit.items[ki].id;
      const st = unit.items[ki];
      if (st.uses != null && st.uses > 1) st.uses -= 1; else unit.items.splice(ki, 1);
    }
  }
  return { loot: obj.loot, usedKey };
}

/* 村を訪れる。{ gift } を返す。 */
export function visitVillage(obj) {
  obj.done = true;
  return { gift: obj.gift };
}

/* 章ごとの宝箱・村の数（種ではなく章の規模から）。 */
export function treasureCountFor(chapterIndex) {
  const chests = 1 + (chapterIndex % 3 === 0 ? 1 : 0) + (chapterIndex >= 8 ? 1 : 0);
  const villages = chapterIndex % 2 === 0 ? 2 : 1;
  return { chests, villages };
}
