/* ============================================================
   窟 — エンジン。世界の「いま」を持ち、一手を回す。
   プレイヤーが動き、状態が効き、魔物が獲物の匂いを下り、
   死と発見が年代記に刻まれる。すべては種から決まる。
   ============================================================ */

import { RNG, hashSeed } from './rng.js';
import { Board } from './board.js';
import { buildLevel } from './gen/build.js';
import { T, isStairs, isDiggable, isDoor } from './tile.js';
import { F } from './level.js';
import { DIR8, chebyshev, line } from './util.js';
import { computeFOV, hasLine } from './fov.js';
import { dijkstraMap } from './pathfind.js';
import { IdStore } from './identify.js';
import { MessageLog, Chronicle } from './chronicle.js';
import { makePlayer, gainXP as playerGainXP, tickHunger } from './player.js';
import { populate, FINAL_DEPTH } from './spawn.js';
import { makeMonster, rollDrop } from './factory.js';
import { getMonster } from './monsterdb.js';
import { meleeAttack, rangedHit, effStats } from './combat.js';
import { tickStatuses, applyStatus, isHelpless, statusName } from './status.js';
import { monsterTurn } from './ai.js';
import { addToInv } from './inventory.js';

export class Game {
  constructor(seed) {
    this.seedRaw = seed;
    this.seed = (typeof seed === 'number') ? (seed >>> 0) : hashSeed(String(seed ?? 'kutsu'));
    this.rng = new RNG(this.seed);
    this.ids = new IdStore(new RNG(this.seed ^ 0x1357bd));
    this.messages = new MessageLog();
    this.log = (m, k) => this.messages.add(m, k);
    this.chronicle = new Chronicle();
    this.player = makePlayer(new RNG(this.seed ^ 0xabcdef));
    this.depth = 0;
    this.levels = new Map();
    this.board = null;
    this.state = 'play';
    this.flags = { amuletPlaced: false, hasAmulet: false };
    this.cause = '力尽きた';
    this.sensed = new Set();
    this._dist = null;

    this.descendTo(1, 'start');
    this.message(`第 1 階。${this.player.name}の潜行が始まる。`);
  }

  /* ----- 便利な呼び口 ----- */
  message(m, k) { this.messages.add(m, k); }
  get level() { return this.board.level; }
  monsterDef(key) { return getMonster(key); }

  /* ----- 階を作る／移る ----- */
  levelRng(depth, salt = 0) { return new RNG((this.seed ^ Math.imul(depth * 31 + salt + 1, 0x9e3779b9)) >>> 0); }

  buildBoard(depth, entranceHint) {
    const lv = buildLevel(this.levelRng(depth, 1), depth, { entrance: entranceHint });
    const board = new Board(lv);
    board.player = this.player;
    populate(this, board, this.levelRng(depth, 2), depth);
    return board;
  }

  descendTo(depth, how = 'down') {
    // いまの盤に役者の占有を残したまま退避（再訪で同じ状態）
    if (this.board) this.levels.set(this.depth, this.board);
    this.depth = depth;
    this.player.depthMax = Math.max(this.player.depthMax, depth);

    let board = this.levels.get(depth);
    if (!board) {
      const hint = how === 'up' ? null : null;
      board = this.buildBoard(depth, hint);
      this.levels.set(depth, board);
    }
    this.board = board;
    board.reindex();

    // 到着位置：下りてきたら上り階段、上ってきたら下り階段、最初は入口
    let pos;
    if (how === 'up') pos = board.level.stairsDown || board.level.entrance;
    else if (depth === 1) pos = board.level.entrance;
    else pos = board.level.stairsUp || board.level.entrance;
    this.player.x = pos.x; this.player.y = pos.y;
    // プレイヤーを盤に（重複登録を避ける）
    if (!board.actors.includes(this.player)) board.addActor(this.player);
    board.setOcc(this.player, pos.x, pos.y);
    this.player.x = pos.x; this.player.y = pos.y;

    this.recomputeDist();
    this.recomputeFOV();
    if (how !== 'start') this.message(`第 ${depth} 階へ${how === 'up' ? '戻った' : '降りた'}。`);
    if (how === 'down') this.chronicle.record(this.player.turns, depth, 'descend', `第 ${depth} 階へ降りた。`);
  }

  descend() {
    if (this.level.get(this.player.x, this.player.y) !== T.STAIRS_DOWN) { this.message('ここに下り階段はない。'); return false; }
    if (this.depth >= FINAL_DEPTH && this.flags.hasAmulet) { this.win(); return true; }
    this.descendTo(this.depth + 1, 'down');
    return true;
  }
  ascend() {
    if (this.level.get(this.player.x, this.player.y) !== T.STAIRS_UP) { this.message('ここに上り階段はない。'); return false; }
    if (this.depth === 1) {
      if (this.flags.hasAmulet) { this.win(); return true; }
      this.message('地上はまだ遠い。護符を手にしてここへ戻れ。');
      return false;
    }
    this.descendTo(this.depth - 1, 'up');
    return true;
  }

  win() { this.state = 'won'; this.cause = '護符を手に窟を出た'; this.message('陽の光だ——あなたは窟を生きて出た！'); }

  /* ----- 視界と匂い ----- */
  recomputeFOV() {
    const lv = this.level;
    lv.clearVisible();
    const radius = this.player.hasStatus('blind') ? 1 : this.player.sight;
    computeFOV(this.player.x, this.player.y, radius,
      (x, y) => !lv.clearTile(x, y),
      (x, y) => { lv.setFlag(x, y, F.VISIBLE | F.DISCOVERED | F.LIT, true); });
    // 罠は見えれば覚える
    for (const f of this.board.features) if (lv.flag(f.x, f.y, F.VISIBLE)) f.known = true;
  }
  recomputeDist() {
    this._dist = dijkstraMap(this.level, [{ x: this.player.x, y: this.player.y }], (x, y) => this.level.walkable(x, y));
  }
  distToPlayer(x, y) { if (!this.level.inBounds(x, y)) return 1e9; return this._dist[y * this.level.w + x]; }
  chebToPlayer(x, y) { return chebyshev(x, y, this.player.x, this.player.y); }
  adjacentToPlayer(m) { return this.chebToPlayer(m.x, m.y) === 1; }
  inSight(x, y) { return this.level.flag(x, y, F.VISIBLE); }

  canSeePlayer(m) {
    const d = this.chebToPlayer(m.x, m.y);
    if (d > m.sight) return false;
    if (this.player.hasStatus('invisible') && d > 1) return false;
    return this.lineToPlayer(m);
  }
  lineToPlayer(m) {
    return hasLine(m.x, m.y, this.player.x, this.player.y, (x, y) => !this.level.clearTile(x, y));
  }

  /* ----- 傷つける・癒す・倒す ----- */
  hurt(actor, amount, source) {
    if (amount <= 0 || !actor.alive) return 0;
    actor.hp -= amount;
    if (actor.flags) actor.flags.sleeping = false;
    if (actor.hp <= 0) this.killActor(actor, source);
    return amount;
  }
  healActor(actor, amount) {
    const before = actor.hp;
    actor.hp = Math.min(actor.maxhp, actor.hp + amount);
    return actor.hp - before;
  }

  killActor(actor, killer) {
    if (actor.isPlayer) {
      this.state = 'dead';
      this.cause = killer && killer.name ? `${killer.name}に倒された` : `${killer || '何か'}に倒された`;
      this.message(`あなたは死んだ……（${this.cause}）`, 'bad');
      return;
    }
    // 盗品を落とす
    if (actor.aiState && actor.aiState.loot) this.board.addItem(actor.aiState.loot, actor.x, actor.y);
    // 落とし物
    const drop = rollDrop(this.rng, actor.drops, this.depth);
    if (drop) this.board.addItem(drop, actor.x, actor.y);
    if (this.inSight(actor.x, actor.y)) this.message(`${actor.name}を倒した。`);
    if (actor.boss) this.chronicle.record(this.player.turns, this.depth, 'boss', `${actor.name}を打ち倒した。`);
    this.player.kills++;
    const msgs = playerGainXP(this.player, actor.xpValue);
    for (const mm of msgs) this.message(mm, 'good');
    this.player.nextXP = this.player.nextXP;
    this.board.removeActor(actor);
    this.sensed.delete(actor.id);
  }
  gainXP(n) { for (const m of playerGainXP(this.player, n)) this.message(m, 'good'); }

  /* ----- 攻撃（近接） ----- */
  attack(attacker, defender) {
    const res = meleeAttack(this, attacker, defender);
    const seen = this.inSight(attacker.x, attacker.y) || this.inSight(defender.x, defender.y) || attacker.isPlayer || defender.isPlayer;
    if (!seen) return res;
    if (res.miss) { this.message(`${this.who(attacker)}の攻撃は外れた。`); return res; }
    let m = `${this.who(attacker)}は${this.whom(defender)}に${res.crit ? '会心の一撃で' : ''}${res.damage} の傷を与えた。`;
    this.message(m, attacker.isPlayer ? 'good' : 'bad');
    for (const st of res.statuses) this.message(`${this.whom(defender)}は${statusName(st)}に冒された。`);
    return res;
  }
  who(a) { return a.isPlayer ? 'あなた' : a.name; }
  whom(a) { return a.isPlayer ? 'あなた' : a.name; }

  /* 魔物の遠隔 */
  monsterRanged(m, target, spec) {
    if (this.inSight(m.x, m.y)) this.message(`${m.name}が${spec.name || '何か'}を放った。`);
    const r = rangedHit(this, m, target, spec);
    if (target.alive && this.inSight(target.x, target.y)) this.message(`${spec.name || '一撃'}が当たった（${r.damage}）。`, 'bad');
    return r;
  }
  /* 魔物の呪文（属性 bolt として処理） */
  monsterCast(m, target) {
    if (this.inSight(m.x, m.y)) this.message(`${m.name}が呪文を唱えた。`);
    const elem = m.spell === 'firebolt' ? 'fire' : m.spell === 'frostbolt' ? 'frost' : m.spell === 'lightning' ? 'shock' : null;
    const r = rangedHit(this, m, target, { damage: m.spellPower || '2d4', element: elem });
    if (target.alive && this.inSight(target.x, target.y)) this.message(`呪文が当たった（${r.damage}）。`, 'bad');
    return r;
  }
  monsterSummon(m) {
    const key = m.summonKey || (getMonster(m.defId).depth ? this.rng.pick(['rat', 'bat', 'kobold']) : 'rat');
    let n = 0;
    for (let i = 0; i < this.rng.range(1, 2); i++) {
      const spot = this.board.freeNear(m.x, m.y, this.rng, 3);
      if (spot) { this.board.addActor(makeMonster(this.rng, key, spot.x, spot.y)); n++; }
    }
    if (n && this.inSight(m.x, m.y)) this.message(`${m.name}が眷属を呼んだ！`);
    return n;
  }
  monsterSummonGeneric() {}

  /* 盗賊が盗む */
  steal(m) {
    const inv = this.player.inv.filter(i => i.def !== 'amulet');
    if (!inv.length) return false;
    const it = this.rng.pick(inv);
    const taken = it.stackable && it.count > 1 ? it.clone(1) : it;
    if (it.stackable && it.count > 1) it.count -= 1; else this.player.inv.splice(this.player.inv.indexOf(it), 1);
    m.aiState.loot = taken;
    this.message(`${m.name}に ${taken.displayName(this.ids)} を盗まれた！`, 'bad');
    return true;
  }

  /* ----- 移動の道具（魔物用） ----- */
  monsterCanEnter(m, x, y) {
    if (!this.level.walkable(x, y)) return false;
    const p = this.level.prop(x, y);
    if (p.deadly && !(m.resist && m.resist.fire)) return false;
    if (p.chasm && !m.hasTag('flying')) return false;
    const a = this.board.actorAt(x, y);
    return !a || !a.alive;
  }
  tryMove(m, x, y) {
    if (isDoor(this.level.get(x, y)) && this.level.get(x, y) === T.DOOR_CLOSED) {
      this.level.set(x, y, T.DOOR_OPEN);
      if (this.inSight(x, y)) this.message('扉が開いた。');
    }
    this.board.moveActor(m, x, y);
  }

  /* ----- 杖・呪文の見栄え（UI が差し込む） ----- */
  flashBolt(path, kind) { this._lastBolt = { path, kind, t: this.player.turns }; }

  /* ----- 効果が呼ぶ世界操作 ----- */
  teleport(actor) {
    const p = this.level.randomFloor(this.rng);
    if (p) { this.board.moveActor(actor, p.x, p.y); if (actor.isPlayer) { this.recomputeDist(); this.recomputeFOV(); } }
  }
  revealMap() { for (let i = 0; i < this.level.flags.length; i++) this.level.flags[i] |= F.DISCOVERED | F.MAPPED; }
  lightAround(actor, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = actor.x + dx, y = actor.y + dy;
      if (this.level.inBounds(x, y) && dx * dx + dy * dy <= r * r) this.level.setFlag(x, y, F.DISCOVERED | F.LIT, true);
    }
  }
  detectItems() {
    let n = 0;
    for (const it of this.board.items) { this.level.setFlag(it.x, it.y, F.DISCOVERED | F.MAPPED, true); n++; }
    return n;
  }
  senseMonsters() { this.sensed = new Set(this.board.monsters().map(m => m.id)); for (const m of this.board.monsters()) m.flags.seen = true; }
  frightenNearby(r) {
    for (const m of this.board.monsters()) if (this.chebToPlayer(m.x, m.y) <= r) applyStatus(m, 'fear', this.rng.range(6, 12));
  }
  summonHostile(user, n) {
    let made = 0;
    const pool = ['rat', 'bat', 'kobold', 'goblin', 'snake'].filter(k => { const d = getMonster(k); return this.depth + 2 >= d.depth[0]; });
    for (let i = 0; i < n; i++) {
      const spot = this.board.freeNear(this.player.x, this.player.y, this.rng, 5);
      if (spot) { this.board.addActor(makeMonster(this.rng, this.rng.pick(pool), spot.x, spot.y)); made++; }
    }
    return made;
  }
  polymorph(target) {
    if (target.isPlayer) { this.message('身体がねじれた気がしたが、戻った。'); return; }
    const pool = this.monsterDef ? null : null;
    const cands = ['rat', 'bat', 'kobold', 'goblin', 'orc', 'snake', 'spider', 'zombie'].filter(k => getMonster(k));
    const key = this.rng.pick(cands);
    const fresh = makeMonster(this.rng, key, target.x, target.y);
    this.board.removeActor(target);
    this.board.addActor(fresh);
    if (this.inSight(target.x, target.y)) this.message(`${target.name}が${fresh.name}に変わった！`);
  }

  /* ----- 鑑定 ----- */
  identifyItem(item) { this.ids.learn(item.def); item.identified = true; if (item.cursed) item.known.cursed = true; }
  firstUnidentified() { return this.player.inv.find(i => !i.identified && !this.ids.isKnown(i.category, i.def) && ['potion', 'scroll', 'wand', 'ring'].includes(i.category)) || null; }
  randomEnchantable() {
    const pool = [...Object.values(this.player.equip), ...this.player.inv].filter(i => i && i.d.enchantable);
    return pool.length ? this.rng.pick(pool) : null;
  }

  /* ----- 一手回す（プレイヤーの行動 → 世界） ----- */
  endPlayerAction(cost = 100) {
    this.player.energy -= cost;
    this.player.turns++;
    this.messages.turn = this.player.turns;
    // 空腹・状態・再生
    tickStatuses(this, this.player);
    this.passiveRegen(this.player);
    const hev = tickHunger(this.player, 1);
    for (const e of hev) { if (e.msg) this.message(e.msg); if (e.starve) this.hurt(this.player, e.starve, '飢え'); }
    if (this.state !== 'play') return;
    this.recomputeDist();
    this.worldTurns();
    this.recomputeDist();
    this.recomputeFOV();
  }

  passiveRegen(actor) {
    effStats(actor);
    const ring = actor._regen || 0;
    const base = actor.isPlayer ? (actor.turns % 8 === 0 ? 1 : 0) : (actor.regen || 0);
    const heal = base + ring;
    if (heal > 0 && actor.hp < actor.maxhp) this.healActor(actor, heal);
  }

  /* 魔物たちにエネルギーを配り、動けるものから動かす */
  worldTurns() {
    let guard = 0;
    while (this.state === 'play' && guard++ < 200) {
      // エネルギー分配
      for (const a of this.board.actors) if (a.alive) a.energy += a.speed;
      // 魔物の行動（エネルギーの多い順、決定的に id で割る）
      const movers = this.board.monsters().sort((a, b) => b.energy - a.energy || a.id - b.id);
      for (const m of movers) {
        let acts = 0;
        while (m.alive && m.energy >= 100 && acts < 3 && this.state === 'play') {
          m.energy -= 100;
          tickStatuses(this, m);
          this.passiveRegen(m);
          if (m.alive && !isHelpless(m)) monsterTurn(this, m);
          acts++;
        }
      }
      if (this.player.energy >= 100) break;
    }
  }

  /* ----- セーブ／ロード ----- */
  serialize() {
    return {
      seed: this.seedRaw, rng: this.rng.save(), depth: this.depth, state: this.state, flags: this.flags, cause: this.cause,
      player: this.player.serialize(), ids: this.ids.serialize(), log: this.messages.serialize(), chronicle: this.chronicle.serialize(),
      levels: [...this.levels.entries()].map(([d, b]) => [d, serializeBoard(b)]),
    };
  }
}

function serializeBoard(b) {
  return { level: b.level.serialize(), items: b.items.map(i => i.serialize()), features: b.features.map(f => f.serialize()) };
}

export function newGame(seed) { return new Game(seed); }
