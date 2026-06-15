/* ============================================================
   窟 — プレイヤーの一手。歩き・殴り・拾い・飲み・読み・振るい・
   食べ・装備・降りる。手番を使ったら世界がひとつ進む。
   ============================================================ */

import { T, isStairs, isDoor, isDiggable } from './tile.js';
import { F } from './level.js';
import { applyEffect } from './effects.js';
import { applyStatus } from './status.js';
import { addToInv, equipItem, unequip } from './inventory.js';

/* 歩く／殴る。手番を使えば true。 */
export function move(game, dx, dy) {
  if (game.state !== 'play') return false;
  const p = game.player;
  if (p.hasStatus('confuse') && game.rng.chance(0.6)) {
    const d = game.rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]);
    dx = d[0]; dy = d[1];
  }
  const nx = p.x + dx, ny = p.y + dy;
  if (!game.level.inBounds(nx, ny)) return false;

  const target = game.board.actorAt(nx, ny);
  if (target && target.alive && target.faction !== 'player') {
    game.attack(p, target);
    game.endPlayerAction(100);
    return true;
  }

  const code = game.level.get(nx, ny);
  if (code === T.DOOR_CLOSED) { game.level.set(nx, ny, T.DOOR_OPEN); game.message('扉を開けた。'); game.endPlayerAction(100); return true; }
  if (!game.level.walkable(nx, ny)) {
    if (code === T.DOOR_SECRET) return false;
    return false;
  }
  // 斜めに壁の角は抜けない
  if (dx && dy && !game.level.walkable(p.x + dx, p.y) && !game.level.walkable(p.x, p.y + dy)) return false;

  game.board.moveActor(p, nx, ny);
  afterStep(game);
  game.endPlayerAction(game.level.prop(nx, ny).slow ? 140 : 100);
  return true;
}

/* 足元の出来事：罠・品物・階段 */
function afterStep(game) {
  const p = game.player;
  const code = game.level.get(p.x, p.y);
  const prop = game.level.prop(p.x, p.y);

  if (code === T.TRAP && !p.hasStatus('levitation')) { triggerTrap(game, p); }
  else if (prop.deadly && !p.hasStatus('levitation')) { game.message('熱い！溶岩だ！', 'bad'); game.hurt(p, game.rng.dice('2d6'), '溶岩'); }
  else if (prop.chasm && !p.hasStatus('levitation')) { fallThroughChasm(game); return; }

  const items = game.board.itemsAt(p.x, p.y);
  if (items.length === 1) game.message(`足元に ${items[0].displayName(game.ids)} がある。`);
  else if (items.length > 1) game.message(`足元に ${items.length} 個の品がある。`);
  if (code === T.STAIRS_DOWN) game.message('下り階段がある（> で降りる）。');
  if (code === T.STAIRS_UP) game.message('上り階段がある（< で上る）。');
}

const TRAPS = ['dart', 'pit', 'fire', 'confuse', 'teleport', 'alarm', 'web'];
function triggerTrap(game, actor) {
  const sub = game.rng.pick(TRAPS);
  game.level.set(actor.x, actor.y, T.FLOOR);
  game.level.setFlag(actor.x, actor.y, F.DISCOVERED, true);
  const dmgScale = 1 + Math.floor(game.depth / 4);
  switch (sub) {
    case 'dart': game.message('矢が飛んできた！', 'bad'); game.hurt(actor, game.rng.dice('1d6') + dmgScale, '矢の罠'); break;
    case 'pit': game.message('落とし穴だ！', 'bad'); game.hurt(actor, game.rng.dice('1d8'), '落とし穴'); break;
    case 'fire': game.message('炎が噴き出した！', 'bad'); game.hurt(actor, game.rng.dice('2d4') + dmgScale, '火炎の罠'); applyStatus(actor, 'burning', 3, 2); break;
    case 'confuse': game.message('毒の霧だ……視界が回る。', 'bad'); applyStatus(actor, 'confuse', game.rng.range(8, 14)); break;
    case 'teleport': game.message('床が光り、身体が飛ばされた。'); game.teleport(actor); break;
    case 'alarm': game.message('けたたましい音！魔物が気づいた。', 'bad'); for (const m of game.board.monsters()) if (game.chebToPlayer(m.x, m.y) <= 12) m.flags.sleeping = false; break;
    case 'web': game.message('蜘蛛の巣に絡め取られた。', 'bad'); applyStatus(actor, 'web', game.rng.range(4, 8)); break;
  }
}

function fallThroughChasm(game) {
  game.message('足を踏み外し、奈落へ落ちていく……！', 'bad');
  game.hurt(game.player, game.rng.dice('2d6'), '落下');
  if (game.state === 'play' && game.depth < 15) {
    game.descendTo(game.depth + 1, 'down');
    game.message('一つ下の階に落ちた。');
  }
}

export function wait(game) { game.endPlayerAction(100); return true; }

export function search(game) {
  const p = game.player; let found = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (game.level.get(x, y) === T.DOOR_SECRET && game.rng.chance(0.5)) { game.level.set(x, y, T.DOOR_CLOSED); game.message('隠し扉を見つけた！'); found++; }
    const f = game.board.featureAt(x, y);
    if (f && !f.known && game.rng.chance(0.5)) { f.known = true; found++; }
  }
  game.endPlayerAction(100);
  return true;
}

export function pickup(game) {
  const p = game.player;
  const here = game.board.itemsAt(p.x, p.y);
  if (!here.length) { game.message('ここには何もない。'); return false; }
  const it = here[0];
  if (it.def === 'gold') { p.gold += it.count; game.board.removeItem(it); game.message(`金を ${it.count} 拾った。`, 'good'); game.endPlayerAction(0); return true; }
  if (it.def === 'amulet') {
    game.board.removeItem(it); addToInv(p, it); game.flags.hasAmulet = true;
    game.message('「窟の護符」を手にした！　地上へ——上り階段をめざせ。', 'good');
    game.chronicle.record(p.turns, game.depth, 'find', '「窟の護符」を手にした。');
    game.endPlayerAction(0); return true;
  }
  const got = addToInv(p, it);
  if (!got) { game.message('鞄がいっぱいだ。'); return false; }
  game.board.removeItem(it);
  game.message(`${got.displayName(game.ids)} を拾った。`, 'good');
  game.endPlayerAction(0);
  return true;
}

/* 品物を使う共通：効果を当て、正体を知る */
function useConsumable(game, item, ctx) {
  const def = item.d;
  game.ids.markTried(item.def);
  const res = applyEffect(game, def.effect, { user: game.player, item, ...ctx });
  if (res && res.id) { game.ids.learn(item.def); item.identified = true; }
  consumeOne(game, item);
}
function consumeOne(game, item) {
  if (item.stackable && item.count > 1) item.count -= 1;
  else { const i = game.player.inv.indexOf(item); if (i >= 0) game.player.inv.splice(i, 1); }
}

export function drink(game, item) {
  if (item.category !== 'potion') { game.message('それは飲めない。'); return false; }
  game.message(`${item.displayName(game.ids)} を飲んだ。`);
  useConsumable(game, item, {});
  game.endPlayerAction(100);
  return true;
}
export function read(game, item, targetItem) {
  if (item.category !== 'scroll') { game.message('それは読めない。'); return false; }
  if (game.player.hasStatus('blind')) { game.message('目が見えず読めない。'); return false; }
  game.message(`${item.displayName(game.ids)} を読んだ。`);
  useConsumable(game, item, { targetItem });
  game.endPlayerAction(100);
  return true;
}
export function eat(game, item) {
  if (item.category !== 'food') { game.message('それは食べられない。'); return false; }
  const p = game.player;
  const nut = item.d.nutrition || 100;
  p.hunger = Math.min(1500, p.hunger + nut);
  game.message(`${item.displayName(game.ids)} を食べた。`);
  consumeOne(game, item);
  game.endPlayerAction(100);
  return true;
}
export function zap(game, item, dx, dy) {
  if (item.category !== 'wand') { game.message('それは振るえない。'); return false; }
  if (item.charges <= 0) { game.message('杖は力を失っている。'); game.ids.learn(item.def); item.identified = true; return false; }
  item.charges -= 1;
  game.ids.markTried(item.def);
  const res = applyEffect(game, item.d.effect, { user: game.player, item, dx, dy });
  if (res && res.id) { game.ids.learn(item.def); item.identified = true; }
  game.endPlayerAction(100);
  return true;
}
export function equip(game, item) {
  const r = equipItem(game.player, item);
  if (!r.ok) { game.message(r.msg); return false; }
  game.message(`${item.displayName(game.ids)} を身につけた。`);
  if (r.cursed) { item.known.cursed = true; game.message('……外れない！呪われている。', 'bad'); }
  game.endPlayerAction(100);
  return true;
}
export function takeOff(game, slot) {
  const r = unequip(game.player, slot);
  if (!r.ok) { game.message(r.msg); return false; }
  game.message(`${r.item.displayName(game.ids)} を外した。`);
  game.endPlayerAction(100);
  return true;
}
export function drop(game, item) {
  const i = game.player.inv.indexOf(item);
  if (i < 0) return false;
  game.player.inv.splice(i, 1);
  game.board.addItem(item, game.player.x, game.player.y);
  game.message(`${item.displayName(game.ids)} を置いた。`);
  game.endPlayerAction(0);
  return true;
}
export function throwItem(game, item, dx, dy) {
  const i = game.player.inv.indexOf(item);
  if (i < 0) return false;
  // 投げ：直線に飛び、最初の魔物に当たる（薬は割れて効果）
  let x = game.player.x, y = game.player.y, hit = null;
  for (let r = 0; r < 8; r++) { x += dx; y += dy; if (!game.level.clearTile(x, y)) break; const a = game.board.actorAt(x, y); if (a && a.alive) { hit = a; break; } }
  consumeOne(game, item);
  if (item.category === 'potion' && hit) {
    game.message(`${item.displayName(game.ids)} が${hit.name}に砕けた。`);
    applyEffect(game, item.d.effect, { user: hit, item });
  } else if (hit) {
    const dmg = game.rng.dice('1d4') + 1; game.hurt(hit, dmg, game.player);
    game.message(`${item.displayName(game.ids)} を投げ、${hit.name}に当てた（${dmg}）。`);
  } else {
    game.board.addItem(item.clone(1), x, y);
    game.message('投げたが、当たらなかった。');
  }
  game.endPlayerAction(100);
  return true;
}
export function descend(game) { const ok = game.descend(); if (ok) game.endPlayerAction(0); return ok; }
export function ascend(game) { const ok = game.ascend(); if (ok) game.endPlayerAction(0); return ok; }
