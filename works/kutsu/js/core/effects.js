/* ============================================================
   窟 — 効能。薬を飲み、巻物を読み、杖を振るとどうなるか。
   どれも game の道具を介して世界へ作用する。命中時の正体は知れる。
   ============================================================ */

import { applyStatus, removeStatus, clearBadStatuses, statusName } from './status.js';
import { rangedHit } from './combat.js';
import { getItemDef } from './itemdb.js';
import { line } from './util.js';
import { T, isDiggable } from './tile.js';

const E = {};
function eff(key, fn) { E[key] = fn; }

/* ---- 薬 ---- */
eff('heal', (g, c) => { const n = g.healActor(c.user, g.rng.dice(c.item.d.power || '2d8')); g.log(c.user.isPlayer ? `傷が癒えた（+${n}）。` : `${c.user.name}の傷が癒えた。`); return { id: n > 0 }; });
eff('fullheal', (g, c) => { const n = g.healActor(c.user, c.user.maxhp); clearBadStatuses(c.user); g.log('身体じゅうの傷が消えた！'); return { id: true }; });
eff('strength', (g, c) => { c.user.stats.str += 1; if (c.user.isPlayer) { c.user.maxhp += 2; c.user.hp += 2; } g.log('力がみなぎる。（力 +1）'); return { id: true }; });
eff('might', (g, c) => { applyStatus(c.user, 'might', c.item.d.power || 24); g.log('筋肉が膨れ上がった！'); return { id: true }; });
eff('haste', (g, c) => { applyStatus(c.user, 'haste', c.item.d.power || 20); g.log('世界がゆっくりに見える。'); return { id: true }; });
eff('cure', (g, c) => { clearBadStatuses(c.user); g.log('淀みが消えた。'); return { id: true }; });
eff('levitation', (g, c) => { applyStatus(c.user, 'levitation', c.item.d.power || 30); g.log('身体が浮いた。'); return { id: true }; });
eff('telepathy', (g, c) => { applyStatus(c.user, 'telepathy', c.item.d.power || 40); g.senseMonsters(); g.log('まわりの気配が頭に流れ込む。'); return { id: true }; });
eff('poison', (g, c) => { applyStatus(c.user, 'poison', 6, 2); g.log('うっ、毒だ！'); return { id: true }; });
eff('confuse', (g, c) => { applyStatus(c.user, 'confuse', c.item.d.power || 12); g.log('視界がぐるぐる回る。'); return { id: true }; });
eff('paralyze', (g, c) => { applyStatus(c.user, 'paralyze', c.item.d.power || 6); g.log('身体が動かない！'); return { id: true }; });
eff('experience', (g, c) => { if (c.user.isPlayer) g.gainXP(g.player.nextXP ? g.player.nextXP - g.player.xp : 20); g.log('叡智が満ちる。'); return { id: true }; });

/* ---- 巻物 ---- */
eff('identify', (g, c) => {
  const target = c.targetItem || g.firstUnidentified();
  if (!target) { g.log('鑑定するものがない。'); return { id: true }; }
  g.identifyItem(target);
  g.log(`それは ${target.displayName(g.ids)} だ。`);
  return { id: true };
});
eff('teleport', (g, c) => { g.teleport(c.user); g.log('景色が一瞬で入れ替わった。'); return { id: true }; });
eff('magicmap', (g, c) => { g.revealMap(); g.log('この階の地図が頭に浮かんだ。'); return { id: true }; });
eff('light', (g, c) => { g.lightAround(c.user, 9); g.log('まわりが明るく照らされた。'); return { id: true }; });
eff('detect_items', (g, c) => { const n = g.detectItems(); g.log(n ? `${n} 個の品物の在り処を感じた。` : '宝の気配はない。'); return { id: true }; });
eff('enchant', (g, c) => {
  const it = c.targetItem || g.randomEnchantable();
  if (!it) { g.log('付呪するものがない。'); return { id: true }; }
  it.enchant += 1; if (it.cursed && it.enchant >= 0) { it.cursed = false; it.known.cursed = true; }
  g.log(`${it.displayName(g.ids)} が輝いた。`);
  return { id: true };
});
eff('remove_curse', (g, c) => {
  let n = 0;
  for (const it of [...Object.values(g.player.equip), ...g.player.inv]) if (it && it.cursed) { it.cursed = false; it.known.cursed = true; n++; }
  g.log(n ? '身体が軽くなった——呪いが解けた。' : 'とくに何も起きない。');
  return { id: true };
});
eff('aggravate_or_fear', (g, c) => { g.frightenNearby(8); g.log('低い唸りが響き、魔物が怯えた。'); return { id: true }; });
eff('summon', (g, c) => { const n = g.summonHostile(c.user, g.rng.range(2, 3)); g.log(n ? '空気が裂け、何かが現れた！' : '何も起きなかった。'); return { id: true }; });
eff('curse', (g, c) => {
  const pool = [...Object.values(g.player.equip)].filter(Boolean);
  if (pool.length && g.rng.chance(0.8)) { const it = g.rng.pick(pool); it.cursed = true; g.log(`${it.displayName(g.ids)} に黒い文字が這った……`); }
  else g.log('背筋が寒くなった。');
  return { id: true };
});

/* ---- 杖（ターゲット式・bolt） ---- */
function bolt(g, c, applyHit) {
  const { user } = c;
  const path = c.path || boltPath(g, user, c.dx, c.dy, c.item.d.range || 7);
  let hitActor = null;
  for (const p of path) {
    const a = g.board.actorAt(p.x, p.y);
    if (a && a !== user) { hitActor = a; break; }
    if (!g.level.clearTile(p.x, p.y)) break;
  }
  g.flashBolt && g.flashBolt(path, c.item.d.effect);
  if (hitActor) applyHit(hitActor);
  else g.log('魔力は虚しく壁に消えた。');
  return { id: true };
}
function boltPath(g, user, dx, dy, range) {
  const path = [];
  let x = user.x, y = user.y;
  for (let i = 0; i < range; i++) { x += dx; y += dy; if (!g.level.inBounds(x, y)) break; path.push({ x, y }); if (!g.level.clearTile(x, y)) break; }
  return path;
}
eff('firebolt', (g, c) => bolt(g, c, t => { const r = rangedHit(g, c.user, t, { damage: c.item.d.power, element: 'fire' }); g.log(`火炎が${t.name}を焼いた（${r.damage}）。`); if (!r.killed && g.rng.oneIn(3)) applyStatus(t, 'burning', 3, 2); }));
eff('frostbolt', (g, c) => bolt(g, c, t => { const r = rangedHit(g, c.user, t, { damage: c.item.d.power, element: 'frost' }); g.log(`氷塊が${t.name}を打った（${r.damage}）。`); if (!r.killed && g.rng.oneIn(2)) applyStatus(t, 'slow', 8); }));
eff('lightning', (g, c) => bolt(g, c, t => { const r = rangedHit(g, c.user, t, { damage: c.item.d.power, element: 'shock' }); g.log(`稲妻が${t.name}を貫いた（${r.damage}）。`); }));
eff('magicmissile', (g, c) => bolt(g, c, t => { const r = rangedHit(g, c.user, t, { damage: c.item.d.power }); g.log(`魔法の矢が${t.name}に当たった（${r.damage}）。`); }));
eff('wand_slow', (g, c) => bolt(g, c, t => { applyStatus(t, 'slow', c.item.d.power || 20); g.log(`${t.name}の動きが鈍った。`); }));
eff('polymorph', (g, c) => bolt(g, c, t => { g.polymorph(t); }));
eff('wand_teleport', (g, c) => bolt(g, c, t => { g.teleport(t); g.log(`${t.name}が消えた。`); }));
eff('dig', (g, c) => {
  const path = boltPathDig(g, c.user, c.dx, c.dy, c.item.d.range || 6);
  let n = 0;
  for (const p of path) { if (isDiggable(g.level.get(p.x, p.y))) { g.level.set(p.x, p.y, T.CORRIDOR); n++; } }
  g.log(n ? '岩が砕け、道が開けた。' : '掘るものがない。');
  return { id: true };
});
function boltPathDig(g, user, dx, dy, range) {
  const path = []; let x = user.x, y = user.y;
  for (let i = 0; i < range; i++) { x += dx; y += dy; if (!g.level.inBounds(x, y) || x === 0 || y === 0 || x === g.level.w - 1 || y === g.level.h - 1) break; path.push({ x, y }); }
  return path;
}

/* ---- 追補の効能 ---- */
eff('invisible', (g, c) => { applyStatus(c.user, 'invisible', c.item.d.power || 24); g.log(c.user.isPlayer ? '身体が透きとおった。' : `${c.user.name}が消えた。`); return { id: true }; });
eff('recharge', (g, c) => {
  const wands = g.player.inv.filter(i => i.category === 'wand');
  if (!wands.length) { g.log('充填する杖がない。'); return { id: true }; }
  const w = c.targetItem && c.targetItem.category === 'wand' ? c.targetItem : g.rng.pick(wands);
  w.charges += g.rng.range(2, 4);
  g.log(`${w.displayName(g.ids)} に力が戻った。`);
  return { id: true };
});
eff('deep_descent', (g, c) => {
  if (g.depth >= 15) { g.log('これより下はない。'); return { id: true }; }
  g.log('床が抜け、一気に深みへ落ちた！');
  g.descendTo(g.depth + 1, 'down');
  return { id: true };
});
eff('wand_confuse', (g, c) => bolt(g, c, t => { applyStatus(t, 'confuse', c.item.d.power || 12); g.log(`${t.name}が惑乱した。`); }));
eff('wand_drain', (g, c) => bolt(g, c, t => { const r = rangedHit(g, c.user, t, { damage: c.item.d.power }); g.healActor(c.user, Math.ceil(r.damage / 2)); g.log(`${t.name}の生気を吸った（${r.damage}）。`); }));

export function applyEffect(game, key, ctx) {
  const fn = E[key];
  if (!fn) { game.log('……何も起きなかった。'); return { id: false }; }
  return fn(game, ctx) || { id: true };
}
export function hasEffect(key) { return !!E[key]; }
export const EFFECTS = E;
