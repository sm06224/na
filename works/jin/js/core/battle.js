/* ============================================================
   陣 — 戦の進行（ターン／フェイズ）。プレイヤー→敵→味方、また頭へ。
   行動の作法（移動・攻撃・杖・道具・待機）と、勝敗の見極めをここが持つ。
   UI はこの API を叩くだけ。コアは DOM を知らない。
   ============================================================ */

import { manhattan, key, tilesInRange } from './grid.js';
import { reachable, findPath } from './pathfind.js';
import { equippedWeapon, effectiveStats, isAlive, hasSkill, gainExp, autoEquip, attackSpeed, gainWexp } from './unit.js';
import { resolveCombat, forecast, inAttackRange, resolveArea, areaTargets, isAreaWeapon, dirToward, patternTiles, resolveArithmetic } from './combat.js';
import { planTurn } from './ai.js';
import { battleExp } from './stats.js';
import { tickStatus, canAct, addStatus, clearStatus } from './status.js';
import { item as itemDef } from './items.js';
import { rateOf } from './skills.js';
import { edgeSpawnTiles } from './reinforce.js';

export const PHASES = ['player', 'enemy', 'ally'];

/* 交戦の一行（履歴ウィンドウ用） */
function dmgTo(events, uid) {
  let d = 0, crit = false;
  for (const e of events) if ((e.type === 'hit' || e.type === 'crit') && e.tgt === uid) { d += e.dmg; if (e.type === 'crit') crit = true; }
  return { d, crit };
}
export function combatLine(att, def, events) {
  const a = dmgTo(events, def.uid), b = dmgTo(events, att.uid);
  let s = `${att.name} → ${def.name}　${a.d}${a.crit ? '!' : ''}`;
  if (!isAlive(def)) s += '　撃破';
  if (b.d > 0) s += `（反撃 ${b.d}${b.crit ? '!' : ''}${!isAlive(att) ? ' 被撃破' : ''}）`;
  const sk = [...new Set(events.filter(e => e.type === 'skill').map(e => e.id))];
  if (sk.length) s += ` 〈${sk.join('・')}〉`;
  return s;
}

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
    this.initiative = !!opts.initiative;
    this.expectLord = !!opts.expectLord;     // 主君前提（盤から失われたら敗北＝詰み無限の保険）
    this.reinforce = opts.reinforce || [];   // 増援の波 [{turn, units:[...], done}]
    this.rrng = (this.rng && this.rng.derive) ? this.rng.derive('reinforce') : null;
    if (this.initiative) this.beginInitiative();
    else this.beginPhase('player');
  }
  get phase() { return PHASES[this.phaseIdx]; }

  unitsOfPhase(side = this.phase) { return this.board.unitsOf(side); }

  /* ユニットひとりの手番開始処理（状態・再生・地形・バフ）。events を返す。 */
  tickUnitStart(u) {
    const events = [];
    u.hasMoved = false; u.hasActed = false;
    const se = tickStatus(u);
    events.push(...se);
    if (hasSkill(u, 'renewal') && u.hp < u.maxHp && u.hp > 0) {
      const h = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp * 0.2));
      u.hp += h; if (h) events.push({ type: 'heal', uid: u.uid, amount: h });
    }
    if (u.pos) {
      const t = this.board.terrainAt(u.pos.x, u.pos.y);
      if (t.heal && u.hp < u.maxHp) {
        const h = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp * t.heal / 100));
        u.hp += h; if (h) events.push({ type: 'heal', uid: u.uid, amount: h });
      }
      if (t.burns && u.mode !== 'fly') { u.hp = Math.max(1, u.hp - t.burns); events.push({ type: 'burn', uid: u.uid }); }
    }
    for (const k in u.buffs) { u.buffs[k].turns--; if (u.buffs[k].turns <= 0) delete u.buffs[k]; }
    return events;
  }

  beginPhase(side) {
    const events = [];
    for (const u of this.board.unitsOf(side)) events.push(...this.tickUnitStart(u));
    return events;
  }

  /* ---- プレイヤーの行動を支える問い合わせ ---- */
  moveTiles(u) {
    const reach = reachable(this.board.terrain, u.pos, u.mov, {
      costAt: (x, y) => this.board.costForUnit(u, x, y),
      blocked: (x, y) => this.board.blockedForUnit(u, x, y),
      zoc: (x, y) => this.board.zocFor(u, x, y),
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
      zoc: (x, y) => this.board.zocFor(u, x, y),
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
    const dx = tile.x - u.pos.x, dy = tile.y - u.pos.y;
    if (dx || dy) u.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : (dy >= 0 ? 2 : 0);
    this.board.moveUnit(u, tile.x, tile.y);
    u.hasMoved = true;
  }
  doAttack(att, def) {
    att.facing = dirToward(att.pos, def.pos);     // 攻め手は標的へ向き直る
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
    // 武器熟練度：使えば上がる（攻め手・反撃した受け手とも）
    const aw = equippedWeapon(att);
    if (aw && aw.wtype !== 'staff') { const up = gainWexp(att, aw.wtype, 2); if (up) this.record(`${att.name}　${aw.wtype} 熟練 ${up}`); }
    const dw = equippedWeapon(def);
    if (isAlive(def) && dw && dw.wtype !== 'staff' && res.events.some(e => e.by === def.uid)) gainWexp(def, dw.wtype, 1);
    this.record(combatLine(att, def, res.events));
    this.cleanupDead();
    this.checkEnd();
    return res;
  }
  doStaff(u, target) {
    const w = equippedWeapon(u);
    const events = [];
    if (w.staff === 'heal') {
      const h = Math.min(target.maxHp - target.hp, (w.power >= 99 ? target.maxHp : w.power + Math.floor(effectiveStats(u).mag / 2) + Math.floor((u.faith ?? 5) / 3)));
      target.hp += h; events.push({ type: 'heal', uid: target.uid, amount: h });
      if (u.side === 'player') gainExp(u, 12, this.rng);
    } else if (w.staff === 'restore') {
      clearStatus(target); events.push({ type: 'restore', uid: target.uid });
      if (u.side === 'player') gainExp(u, 12, this.rng);
    }
    u.hasActed = true; u.hasMoved = true;
    gainWexp(u, 'staff', 2);
    this.record(`${u.name} → ${target.name}　${w.staff === 'heal' ? '回復' : '状態回復'}`);
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
    this.record(`${u.name}　${it.name}`);
    return { events };
  }
  /* マップ攻撃：撃てる着弾点（射程内で、巻き込める敵が1体以上） */
  areaCentersFrom(u, tile) {
    const w = equippedWeapon(u);
    if (!w || !w.aoe) return [];
    const saved = u.pos; u.pos = tile;
    const out = [];
    for (const c of tilesInRange(tile.x, tile.y, w.min, w.max)) {
      if (!this.board.inBounds(c.x, c.y)) continue;
      if (areaTargets(u, c, this.board).length > 0) out.push(c);
    }
    u.pos = saved;
    return out;
  }
  areaSplashTiles(u, center) {
    const w = equippedWeapon(u);
    return patternTiles(center.x, center.y, w && w.shape, (w && w.aoe) || 0).filter(t => this.board.inBounds(t.x, t.y));
  }
  doAreaAttack(caster, center) {
    const res = resolveArea(caster, center, this.board, this.rng);
    caster.hasActed = true; caster.hasMoved = true;
    const aw = equippedWeapon(caster); if (aw) gainWexp(caster, aw.wtype, 2);
    if ((caster.side === 'player' || caster.side === 'ally') && res.targets.length) {
      let kills = 0;
      for (const t of res.targets) if (!isAlive(t)) kills++;
      let exp = Math.min(100, 14 + res.targets.length * 4 + kills * 20);
      if (hasSkill(caster, 'paragon')) exp *= 2;
      res.levelUps = gainExp(caster, exp, this.rng);
    }
    this.record(`${caster.name}　範囲攻撃 → ${res.targets.length}体${res.fallen.length ? `（${res.fallen.length}撃破）` : ''}`);
    this.cleanupDead();
    this.checkEnd();
    return res;
  }
  doArithmetic(caster, prop, num) {
    const res = resolveArithmetic(caster, prop, num, this.board);
    caster.hasActed = true; caster.hasMoved = true;
    if ((caster.side === 'player' || caster.side === 'ally') && res.targets.length) {
      let kills = res.fallen.length;
      let exp = Math.min(100, 12 + res.targets.length * 4 + kills * 18);
      if (hasSkill(caster, 'paragon')) exp *= 2;
      res.levelUps = gainExp(caster, exp, this.rng);
    }
    this.record(`${caster.name}　算術 → ${res.targets.length}体${res.fallen.length ? `（${res.fallen.length}撃破）` : ''}`);
    this.cleanupDead();
    this.checkEnd();
    return res;
  }
  doWait(u) { u.hasActed = true; u.hasMoved = true; }

  /* 履歴に一行を残す */
  record(text) {
    if (!text) return;
    this.log.push({ turn: this.turn, side: this.phase, text });
    if (this.log.length > 240) this.log.shift();
  }

  cleanupDead() {
    for (const u of this.board.units) if (!isAlive(u) && u.pos) { this.board.remove(u); u.pos = null; }
  }

  /* オート：自軍を AI が指す（演出用の手番列を返す。敵フェイズへは UI が送る） */
  autoPlayerTurn() { return this.runSide('player', true); }

  /* ---- フェイズ送り ---- */
  endPlayerPhase() {
    if (this.over) return [];
    return this.runSide('enemy');
  }

  /* AI ひとり分の一手を実行し、演出用の記録を返す */
  aiActOnce(u) {
    const rec = { uid: u.uid, from: u.pos ? { ...u.pos } : null, path: null, attack: null, area: null, events: [] };
    if (!isAlive(u) || !u.pos || !canAct(u)) { u.hasActed = true; return rec; }
    const plan = planTurn(this.board, u, this.rng);
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
    } else if (plan.heal != null) {
      const ally = this.board.units.find(x => x.uid === plan.heal);
      if (ally && isAlive(ally) && manhattan(u.pos, ally.pos) <= (equippedWeapon(u)?.max || 1)) {
        const res = this.doStaff(u, ally);
        rec.heal = ally.uid; rec.events = res.events;
      }
    }
    u.hasActed = true;
    return rec;
  }

  /* AI 側のフェイズを実行し、演出用の手番列を返す */
  runSide(side, skipBegin = false) {
    this.phaseIdx = PHASES.indexOf(side);
    if (!skipBegin) this.beginPhase(side);
    const turns = [];
    const actors = this.board.unitsOf(side).slice().sort((a, b) => a.uid - b.uid);
    for (const u of actors) {
      if (this.over) break;
      if (!isAlive(u) || !u.pos || !canAct(u)) continue;
      turns.push(this.aiActOnce(u));
      if (this.over) break;
    }
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
    this.spawnReinforcements();
    this.phaseIdx = 0;
    this.beginPhase('player');
    this.checkEnd();
  }

  /* 増援：この手番までに到来予定の波を、盤の縁の空きマスへ配する。 */
  spawnReinforcements() {
    if (!this.reinforce || !this.reinforce.length) return [];
    const spawned = [];
    for (const wave of this.reinforce) {
      if (wave.done || this.turn < wave.turn) continue;
      wave.done = true;
      let tiles = edgeSpawnTiles(this.board);
      if (this.rrng) tiles = this.rrng.shuffle(tiles);
      for (const u of wave.units) {
        const tile = tiles.pop();
        if (!tile) break;
        this.board.add(u, tile.x, tile.y);
        spawned.push(u);
      }
    }
    if (spawned.length) { this.board.rebuildIndex(); this.record(`増援 ${spawned.length} 体が現れた！`); }
    return spawned;
  }

  /* ---- 勝敗 ---- */
  lord() { return this.board.units.find(u => u.side === 'player' && u.classId && (u.isLord || u.classId === 'lord' || u.classId === 'greatlord')); }
  checkEnd() {
    if (this.over) return;
    const players = this.board.unitsOf('player');
    const lord = this.lord();
    // 敗北：主君が倒れた／盤上から失われた（再配置漏れ等の保険）、または全滅
    if (this.expectLord && (!lord || !isAlive(lord))) { this.over = true; this.victory = false; this.reason = 'lord'; return; }
    if (lord && !isAlive(lord)) { this.over = true; this.victory = false; this.reason = 'lord'; return; }
    if (!players.length) { this.over = true; this.victory = false; this.reason = 'wipe'; return; }
    // 勝利
    const o = this.objective;
    const enemies = this.board.unitsOf('enemy');
    // 敵を倒し切れば、どの目標でも勝ち（制圧・離脱でも詰まらぬよう）。ただし未到来の増援が残るうちは保留。
    const pendingReinf = (this.reinforce || []).some(w => !w.done);
    if (!enemies.length && !pendingReinf) { this.win(o.type === 'seize' ? 'seize' : o.type === 'defeat_boss' ? 'boss' : o.type === 'escape' ? 'escape' : 'rout'); return; }
    if (o.type === 'defeat_boss') {
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

  /* ============ 行動順モード（イニシアチブ＝速さ順） ============ */
  beginInitiative() { this.rebuildOrder(); this._started = false; }
  rebuildOrder() {
    this.order = this.board.units.filter(u => isAlive(u) && u.pos)
      .sort((a, b) => (attackSpeed(b) - attackSpeed(a)) || ((b.spd | 0) - (a.spd | 0)) || (a.uid - b.uid));
    this.orderIdx = 0;
  }
  /* いま手番のユニット（倒れた者は飛ばす） */
  activeUnit() {
    if (!this.order) return null;
    while (this.orderIdx < this.order.length) {
      const u = this.order[this.orderIdx];
      if (isAlive(u) && u.pos) return u;
      this.orderIdx++;
    }
    return null;
  }
  /* 手番開始：その者だけ状態・地形・再生を処理 */
  startUnitTurn(u) { return this.tickUnitStart(u); }
  /* 手番終了：次へ。一巡したら新しいラウンド（速さ順を組み直す） */
  endUnitTurn() {
    this.orderIdx++;
    this.checkEnd();
    if (this.over) return;
    if (this.orderIdx >= this.order.length) { this.turn++; this.spawnReinforcements(); this.rebuildOrder(); }
  }

  /* ---- テスト・自動進行：行動順モードで両軍 AI ---- */
  autoResolveInitiative(maxRounds = 150) {
    this.beginInitiative();
    let guard = 0;
    while (!this.over && this.turn <= maxRounds && guard++ < 12000) {
      const u = this.activeUnit();
      if (!u) { this.turn++; this.rebuildOrder(); continue; }
      this.startUnitTurn(u);
      if (canAct(u)) this.aiActOnce(u);
      this.endUnitTurn();
    }
    if (!this.over) { this.over = true; this.victory = false; this.reason = 'timeout'; }
    return { over: this.over, victory: this.victory, reason: this.reason, turn: this.turn };
  }

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
