/* ============================================================
   陣 — 戦の進行（ターン／フェイズ）。プレイヤー→敵→味方、また頭へ。
   行動の作法（移動・攻撃・杖・道具・待機）と、勝敗の見極めをここが持つ。
   UI はこの API を叩くだけ。コアは DOM を知らない。
   ============================================================ */

import { manhattan, key } from './grid.js';
import { reachable, findPath } from './pathfind.js';
import { equippedWeapon, effectiveStats, isAlive, hasSkill, gainExp, autoEquip } from './unit.js';
import { resolveCombat, forecast, inAttackRange } from './combat.js';
import { planTurn } from './ai.js';
import { battleExp } from './stats.js';
import { tickStatus, canAct, addStatus, clearStatus } from './status.js';
import { item as itemDef } from './items.js';
import { rateOf } from './skills.js';

export const PHASES = ['player', 'enemy', 'ally'];

export class Battle {
  constructor(board, opts = {}) {
    this.board = board;
    this.rng = opts.rng;
    this.turn = 1;
    this.phaseIdx = 0;
    this.objective = opts.objective || { type: 'rout' };
    this.maxTurns = opts.maxTurns || 0;
    this.over = false;
    this.victory = false;
    this.log = [];
    this.beginPhase('player');
  }
  get phase() { return PHASES[this.phaseIdx]; }

  unitsOfPhase(side = this.phase) { return this.board.unitsOf(side); }

  beginPhase(side) {
    const events = [];
    for (const u of this.board.unitsOf(side)) {
      u.hasMoved = false; u.hasActed = false;
      // 状態異常の処理
      const se = tickStatus(u);
      events.push(...se);
      // 素質「再生」：自分のターンの頭に 2 割癒える
      if (hasSkill(u, 'renewal') && u.hp < u.maxHp && u.hp > 0) {
        const h = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp * 0.2));
        u.hp += h; if (h) events.push({ type: 'heal', uid: u.uid, amount: h });
      }
      // 地形回復
      if (u.pos) {
        const t = this.board.terrainAt(u.pos.x, u.pos.y);
        if (t.heal && u.hp < u.maxHp) {
          const h = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp * t.heal / 100));
          u.hp += h; if (h) events.push({ type: 'heal', uid: u.uid, amount: h });
        }
        if (t.burns && u.mode !== 'fly') { u.hp = Math.max(1, u.hp - t.burns); events.push({ type: 'burn', uid: u.uid }); }
      }
      // バフの残り
      for (const k in u.buffs) { u.buffs[k].turns--; if (u.buffs[k].turns <= 0) delete u.buffs[k]; }
    }
    return events;
  }

  /* ---- プレイヤーの行動を支える問い合わせ ---- */
  moveTiles(u) {
    const reach = reachable(this.board.terrain, u.pos, u.mov, {
      costAt: (x, y) => this.board.costForUnit(u, x, y),
      blocked: (x, y) => this.board.blockedForUnit(u, x, y),
    });
    const tiles = [];
    for (const [k] of reach.dist) {
      const [x, y] = k.split(',').map(Number);
      if ((x === u.pos.x && y === u.pos.y) || !this.board.occupied(x, y)) tiles.push({ x, y });
    }
    return tiles;
  }
  pathTo(u, dest) {
    return findPath(this.board.terrain, u.pos, dest, {
      costAt: (x, y) => this.board.costForUnit(u, x, y),
      blocked: (x, y) => this.board.blockedForUnit(u, x, y),
    });
  }
  attackTargetsFrom(u, tile) {
    const w = equippedWeapon(u);
    if (!w || w.wtype === 'staff') return [];
    const saved = u.pos; u.pos = tile;
    const out = this.board.enemiesOf(u).filter(e => inAttackRange(u, e));
    u.pos = saved;
    return out;
  }
  staffTargetsFrom(u, tile) {
    const w = equippedWeapon(u);
    if (!w || w.wtype !== 'staff') return [];
    const saved = u.pos; u.pos = tile;
    let out = [];
    if (w.staff === 'heal') out = this.board.alliesOf(u).concat([u]).filter(a => a.pos && manhattan(u.pos, a.pos) <= w.max && a.hp < a.maxHp);
    else if (w.staff === 'restore') out = this.board.alliesOf(u).concat([u]).filter(a => a.pos && manhattan(u.pos, a.pos) <= w.max && a.status.length);
    u.pos = saved;
    return out;
  }

  /* ---- 行動 ---- */
  doMove(u, tile) {
    this.board.moveUnit(u, tile.x, tile.y);
    u.hasMoved = true;
  }
  doAttack(att, def) {
    const res = resolveCombat(att, def, this.board, this.rng);
    att.hasActed = true; att.hasMoved = true;
    // 命中したか（経験）
    const hitLand = res.events.some(e => (e.type === 'hit' || e.type === 'crit') && e.by === att.uid);
    const killed = !isAlive(def);
    if (att.side === 'player' || att.side === 'ally') {
      let exp = battleExp(att, def, killed && this.board.alliesAreEnemies(att, def));
      if (hasSkill(att, 'paragon')) exp *= 2;            // 天稟：経験二倍
      res.levelUps = gainExp(att, hitLand || killed ? exp : Math.max(1, Math.floor(exp / 3)), this.rng);
    }
    // 反撃で経験
    if ((def.side === 'player' || def.side === 'ally') && isAlive(def)) {
      const cHit = res.events.some(e => (e.type === 'hit' || e.type === 'crit') && e.by === def.uid);
      if (cHit) { res.defLevelUps = gainExp(def, battleExp(def, att, !isAlive(att)), this.rng); }
    }
    this.cleanupDead();
    this.checkEnd();
    return res;
  }
  doStaff(u, target) {
    const w = equippedWeapon(u);
    const events = [];
    if (w.staff === 'heal') {
      const h = Math.min(target.maxHp - target.hp, (w.power >= 99 ? target.maxHp : w.power + Math.floor(effectiveStats(u).mag / 2)));
      target.hp += h; events.push({ type: 'heal', uid: target.uid, amount: h });
      if (u.side === 'player') gainExp(u, 12, this.rng);
    } else if (w.staff === 'restore') {
      clearStatus(target); events.push({ type: 'restore', uid: target.uid });
      if (u.side === 'player') gainExp(u, 12, this.rng);
    }
    u.hasActed = true; u.hasMoved = true;
    return { events };
  }
  doItem(u, idx) {
    const stack = u.items[idx]; if (!stack) return null;
    const it = itemDef(stack.id);
    const events = [];
    if (it.use === 'heal') { const h = Math.min(u.maxHp - u.hp, it.power); u.hp += h; events.push({ type: 'heal', uid: u.uid, amount: h }); }
    else if (it.use === 'healFull') { events.push({ type: 'heal', uid: u.uid, amount: u.maxHp - u.hp }); u.hp = u.maxHp; }
    else if (it.use === 'cure') { clearStatus(u); events.push({ type: 'restore', uid: u.uid }); }
    else if (it.use === 'buffRes') { u.buffs.res = { amt: it.power, turns: 3 }; events.push({ type: 'buff', uid: u.uid }); }
    if (it.uses) { stack.uses--; if (stack.uses <= 0) { u.items.splice(idx, 1); if (u.equipped >= idx) autoEquip(u); } }
    u.hasActed = true; u.hasMoved = true;
    return { events };
  }
  doWait(u) { u.hasActed = true; u.hasMoved = true; }

  cleanupDead() {
    for (const u of this.board.units) if (!isAlive(u) && u.pos) { this.board.remove(u); u.pos = null; }
  }

  /* ---- フェイズ送り ---- */
  endPlayerPhase() {
    if (this.over) return [];
    return this.runSide('enemy');
  }

  /* AI 側のフェイズを実行し、演出用の手番列を返す */
  runSide(side, skipBegin = false) {
    this.phaseIdx = PHASES.indexOf(side);
    if (!skipBegin) this.beginPhase(side);
    const turns = [];
    const actors = this.board.unitsOf(side).slice().sort((a, b) => a.uid - b.uid);
    for (const u of actors) {
      if (this.over) break;
      if (!isAlive(u) || !u.pos) continue;
      if (!canAct(u)) continue;
      const plan = planTurn(this.board, u, this.rng);
      const rec = { uid: u.uid, from: { ...u.pos }, path: null, attack: null, events: [] };
      if (plan.move && (plan.move.x !== u.pos.x || plan.move.y !== u.pos.y)) {
        rec.path = this.pathTo(u, plan.move) || [u.pos, plan.move];
        this.doMove(u, plan.move);
      }
      if (plan.target != null) {
        const def = this.board.units.find(x => x.uid === plan.target);
        if (def && isAlive(def) && inAttackRange(u, def)) {
          const res = this.doAttack(u, def);
          rec.attack = def.uid; rec.events = res.events;
        }
      }
      u.hasActed = true;
      turns.push(rec);
      if (this.over) break;
    }
    // 次のフェイズへ
    if (!this.over) this.advancePhase(side);
    return turns;
  }
  advancePhase(justFinished) {
    if (justFinished === 'enemy') {
      const allies = this.board.unitsOf('ally');
      if (allies.length) { this.runSide('ally'); return; }
      this.startPlayerTurn();
    } else if (justFinished === 'ally') {
      this.startPlayerTurn();
    }
  }
  startPlayerTurn() {
    this.turn++;
    this.phaseIdx = 0;
    this.beginPhase('player');
    this.checkEnd();
  }

  /* ---- 勝敗 ---- */
  lord() { return this.board.units.find(u => u.side === 'player' && u.classId && (u.isLord || u.classId === 'lord' || u.classId === 'greatlord')); }
  checkEnd() {
    if (this.over) return;
    const players = this.board.unitsOf('player');
    const lord = this.lord();
    // 敗北
    if (lord && !isAlive(lord)) { this.over = true; this.victory = false; this.reason = 'lord'; return; }
    if (!players.length) { this.over = true; this.victory = false; this.reason = 'wipe'; return; }
    // 勝利
    const o = this.objective;
    const enemies = this.board.unitsOf('enemy');
    if (o.type === 'rout' && !enemies.length) { this.win('rout'); }
    else if (o.type === 'defeat_boss') {
      const boss = this.board.units.find(u => u.uid === o.uid);
      if (!boss || !isAlive(boss)) this.win('boss');
    } else if (o.type === 'seize' && lord && lord.pos && lord.pos.x === o.x && lord.pos.y === o.y) {
      this.win('seize');
    } else if (o.type === 'escape') {
      const tiles = o.tiles || [];
      if (lord && lord.pos && tiles.some(t => t.x === lord.pos.x && t.y === lord.pos.y)) this.win('escape');
    } else if (o.type === 'survive' && this.turn > o.turns) {
      this.win('survive');
    }
  }
  win(reason) { this.over = true; this.victory = true; this.reason = reason; }

  /* ---- テスト・自動進行：両軍 AI で決着まで ---- */
  autoResolve(maxTurns = 80) {
    let guard = 0;
    while (!this.over && this.turn <= maxTurns && guard++ < 6000) {
      this.runSide('player', true);     // 開始フェイズは構築/前ターンで済んでいる
      if (this.over) break;
      this.runSide('enemy');            // 終わりに ally→次のプレイヤーターンへ進む
    }
    if (!this.over && this.turn > maxTurns) { this.over = true; this.victory = false; this.reason = 'timeout'; }
    return { over: this.over, victory: this.victory, reason: this.reason, turn: this.turn };
  }
}
