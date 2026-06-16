/* 陣のへそ — タイトル→章の幕間→戦い→結果。タッチで指揮する。 */

import { Game } from '../core/game.js';
import { isAlive, equippedWeapon, effectiveStats, unitRank, createUnit } from '../core/unit.js';
import { makeArmy, resolveMassCombat, armyTroops } from '../core/masscombat.js';
import { playMassBattle } from './massbattle.js';
import { drawCamp, campLine } from './camp.js';
import { classDef } from '../core/classes.js';
import { item as itemDef } from '../core/items.js';
import { STAT_KEYS, STAT_NAMES } from '../core/stats.js';
import { forecast, inAttackRange, isAreaWeapon, areaTargets, ARITH_PROPS, ARITH_NUMS, arithmeticTargets } from '../core/combat.js';
import { hasSkill as unitHasSkill } from '../core/unit.js';
import { manhattan, key } from '../core/grid.js';
import { Camera, draw, BASE_TILE, setView3d, isView3d, setPixel, isPixel } from './render.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { chapterScript, SUPPORTS } from '../core/script.js';
import { EXTRA_SUPPORTS } from '../core/script2.js';
import { EXTRA_SUPPORTS2 } from '../core/script3.js';
import { supportRank, supportPoints, rankLetter, SUPPORT_THRESHOLDS } from '../core/support.js';
import { skill as skillDef } from '../core/skills.js';
import { BESTIARY, WORLD, WEAPON_NOTES, TERRAIN_NOTES } from '../core/lore.js';
import { WTYPE, WRANKS } from '../core/items.js';
import { playMusic, stopMusic, setMusicMuted } from './music.js';
import { FX } from './fx.js';
import { drawPortrait } from './portrait.js';
import { shopStock, buy, canBuy, sellFromConvoy, sellPrice } from '../core/shop.js';
import { giveItem, takeItem, equipItem, equipAccessory, useBooster, canPromote, promotionOptions, doPromote, MAX_ITEMS, hireRoster, hire, canHire, dismiss, canDismiss, jobChoices, reclass, canReclass, RECLASS_COST } from '../core/party.js';
import { encodeSave, decodeSave } from '../core/save.js';
import { TRADE_GOODS, tradePrice, buyGood, sellGood, holdings, canBuyGood } from '../core/trade.js';
import { weatherForChapter } from '../core/weather.js';
import { arenaOpponents, arenaFight } from '../core/arena.js';
import { makeSkirmish, SKIRMISH_BIOMES, SKIRMISH_SIZES } from '../core/skirmish.js';
import { treasureAt, canOpenChest, openChest, visitVillage } from '../core/treasure.js';
import { stealTargetsFrom, stealableItems, resolveSteal } from '../core/steal.js';
import { canForge, applyForge, forgeLevelOf, forgeCost, MAX_FORGE } from '../core/forge.js';
import { item as itemDef2 } from '../core/items.js';

const SAVE_KEY = 'jin.save.v2';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const S = {
  game: null, battle: null, board: null,
  cam: new Camera(), vw: 0, vh: 0, dpr: 1,
  mode: 'title',           // title | idle | selected | menu | target | staff | animating | result
  selected: null, cursor: null, preMovePos: null,
  moveTiles: null, atkTiles: null, staffTiles: null, path: null,
  anim: null, popups: [], busy: false,
  fx: new FX(), lastNow: 0, auto: false,
  skirmish: null,          // 演習中はその設定。キャンペーンなら null
};

/* ---------- 画面 ---------- */
function fit() {
  S.dpr = window.devicePixelRatio || 1;
  S.vw = window.innerWidth; S.vh = window.innerHeight;
  canvas.width = S.vw * S.dpr; canvas.height = S.vh * S.dpr;
  canvas.style.width = S.vw + 'px'; canvas.style.height = S.vh + 'px';
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  if (S.board) S.cam.clamp(S.board, S.vw, S.vh);
}
window.addEventListener('resize', fit);

function loop(now) {
  requestAnimationFrame(loop);
  // 移動アニメの更新
  if (S.anim && S.anim.type === 'move') {
    const p = Math.min(1, (now - S.anim.t0) / S.anim.dur);
    const seg = p * (S.anim.path.length - 1);
    const i = Math.max(0, Math.min(S.anim.path.length - 2, Math.floor(seg)));   // 一マス経路（長さ1）でも崩れぬよう
    const f = seg - i;
    const a = S.anim.path[i] || S.anim.path[0], b = S.anim.path[i + 1] || a;
    S.anim.cx = a.x + (b.x - a.x) * f;
    S.anim.cy = a.y + (b.y - a.y) * f;
    if (p >= 1 && S.anim.resolve) { const r = S.anim.resolve; S.anim = null; r(); }
  }
  if (S.popups.length) S.popups = S.popups.filter(pp => now - pp.t < 900);
  const dt = Math.min(0.05, (now - (S.lastNow || now)) / 1000); S.lastNow = now;
  S.fx.update(dt);
  S.cam._vw = S.vw; S.cam._vh = S.vh;
  if (S.board) {
    const sh = S.fx.shake;
    ctx.save();
    if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    draw(ctx, S, now);
    S.fx.draw(ctx, S.cam);
    ctx.restore();
  }
  // 拠点が開いていれば、野営シーンを揺らす
  if (S.game && !$('base').hidden) { const cc = $('campScene'); if (cc) drawCamp(cc, S.game.livingParty(), now); }
}

/* ---------- ゲーム開始 ---------- */
function startGame(seed) {
  S.game = new Game(seed >>> 0, { setpiece: $('setpieceChk').checked, initiative: $('initChk').checked });
  $('title').hidden = true;
  showIntro();
}

/* ---- 台詞の再生（タップで送る） ---- */
let dlgState = null;
function playDialogue(lines) {
  return new Promise(res => {
    if (!lines || !lines.length) return res();
    dlgState = { lines, i: 0, res };
    $('dialogue').hidden = false;
    renderDlg();
  });
}
function renderDlg() {
  const l = dlgState.lines[dlgState.i];
  $('dlgWho').textContent = l.who;
  $('dlgText').textContent = l.line;
  const face = $('dlgFace');
  if (!l.who || l.who === 'ナレーション') { face.hidden = true; }
  else {
    face.hidden = false;
    const fx = face.getContext('2d'); fx.clearRect(0, 0, 96, 96);
    const party = S.game && S.game.party.some(u => u.name === l.who);
    drawPortrait(fx, l.who, 0, 0, 96, { color: party ? '#5f7cff' : '#c0463e' });
  }
}
let cutinAt = 0;
function showCutin(u) {
  if (!u || !u.name) return;
  const now = performance.now();
  if (now - cutinAt < 1000) return;       // 連発しない（流星などで多重にならぬよう）
  cutinAt = now;
  const c = $('cutin'); const cx = c.getContext('2d'); cx.clearRect(0, 0, 200, 200);
  const party = S.game && S.game.party.some(p => p.name === u.name);
  drawPortrait(cx, u.name, 10, 10, 180, { color: party ? '#5f7cff' : '#c0463e' });
  c.hidden = false; c.style.transition = 'none'; c.style.transform = 'translateX(-90px)'; c.style.opacity = '0';
  requestAnimationFrame(() => { c.style.transition = ''; c.style.transform = 'translateX(0)'; c.style.opacity = '1'; });
  clearTimeout(showCutin._t1); clearTimeout(showCutin._t2);
  showCutin._t1 = setTimeout(() => { c.style.opacity = '0'; c.style.transform = 'translateX(-50px)'; }, 650);
  showCutin._t2 = setTimeout(() => { c.hidden = true; }, 950);
}
function advanceDlg() {
  if (!dlgState) return;
  sfx('cursor');
  dlgState.i++;
  if (dlgState.i >= dlgState.lines.length) {
    $('dialogue').hidden = true;
    const r = dlgState.res; dlgState = null; r();
  } else renderDlg();
}
$('dialogue').addEventListener('pointerdown', advanceDlg);
function showIntro() {
  const g = S.game;
  if (g.done) return showClear();
  playMusic('prologue');
  const ch = g.chapter;
  $('introTitle').textContent = ch.title;
  const wx = weatherForChapter(g.seed, g.chapterIndex, ch.biome || 'green');
  $('introText').textContent = ch.intro + `\n\n空模様：${wx.name}——${wx.line}`;
  const pp = $('introParty'); pp.innerHTML = '';
  for (const u of g.livingParty()) {
    const d = document.createElement('span');
    d.className = 'pchip';
    d.textContent = `${u.name}(${classDef(u.classId).name}) Lv${u.level}`;
    pp.appendChild(d);
  }
  $('intro').hidden = false;
}
async function sortie() {
  $('intro').hidden = true;
  await playDialogue(chapterScript(S.game.chapterIndex).open);
  const biome = S.game.chapter.biome || 'green';
  playMusic('battle_' + biome);
  const { battle } = S.game.startChapter();
  S.battle = battle; S.board = battle.board;
  S.cam.scale = 1; S.cam.center(S.board, S.vw, S.vh); S.cam.clamp(S.board, S.vw, S.vh);
  clearSel(); S.mode = 'idle';
  $('hud').hidden = false;
  $('autoBtn').classList.toggle('on', S.auto);
  $('endTurn').style.display = battle.initiative ? 'none' : '';
  refreshHud(); refreshLog();
  if (battle.initiative) advanceInitiative();
  else maybeAuto();
}
/* 演習（スカーミッシュ）：物語の外で、種から一発の戦場を布いて戦う */
function startSkirmish() {
  const seed = (parseInt($('seedInput').value, 10) || (Date.now() >>> 0)) >>> 0;
  // 種から地勢・広さ・敵レベルを決定的に選ぶ（操作はシンプルに一押し）
  const biome = SKIRMISH_BIOMES[seed % SKIRMISH_BIOMES.length];
  const sizeKeys = Object.keys(SKIRMISH_SIZES);
  const size = sizeKeys[(seed >>> 3) % sizeKeys.length];
  const level = 6 + ((seed >>> 5) % 12);                 // 6〜17
  const initiative = $('initChk').checked;
  S.game = null;
  S.skirmish = { seed, biome, size, level, initiative };
  const { battle } = makeSkirmish(seed, { biome, size, level, initiative });
  S.battle = battle; S.board = battle.board;
  $('title').hidden = true;
  playMusic('battle_' + biome);
  S.cam.scale = 1; S.cam.center(S.board, S.vw, S.vh); S.cam.clamp(S.board, S.vw, S.vh);
  clearSel(); S.mode = 'idle';
  $('hud').hidden = false;
  $('autoBtn').classList.toggle('on', S.auto);
  $('endTurn').style.display = battle.initiative ? 'none' : '';
  refreshHud(); refreshLog();
  toast(`演習：${SKIRMISH_SIZES[size].name}・Lv${level}`);
  if (battle.initiative) advanceInitiative();
  else maybeAuto();
}
/* 会戦（マスコンバット）：盤を布かず、軍と軍で一気に決する */
function massBattle() {
  $('intro').hidden = true;
  const ch = S.game.chapter;
  const cr = S.game.rng.derive('mass' + S.game.chapterIndex);
  const partyArmy = makeArmy('自軍', S.game.livingParty());
  const foes = [];
  for (let i = 0; i < ch.count + 2; i++) {
    const cls = cr.derive('p' + i).pick(['soldier', 'fighter', 'archer', 'mercenary', 'knight', 'cavalier']);
    foes.push(createUnit({ classId: cls, level: ch.level, items: ['iron_lance'], side: 'enemy' }, cr.derive('f' + i)));
  }
  if (ch.boss) foes.push(createUnit({ classId: ch.boss.classId, level: ch.boss.level, items: ch.boss.items || ['iron_lance'], side: 'enemy', boss: true, statBoost: ch.boss.statBoost }, cr.derive('boss')));
  const enemyArmy = makeArmy(ch.boss ? ch.boss.name + '軍' : '敵軍', foes);
  const res = resolveMassCombat(partyArmy, enemyArmy, cr.derive('fight'));
  const win = res.winner === 'a';
  // まず俯瞰ドット絵で軍勢のぶつかりを見せ、その後に戦果を表示する
  stopMusic(); playMusic(win ? 'victory' : 'defeat');
  $('massScene').hidden = false;
  S.mode = 'massanim';
  playMassBattle($('massCanvas'), res, {
    nameA: '自軍', nameB: enemyArmy.name,
    onDone: () => { $('massScene').hidden = true; showMassResult(); },
  });
  function showMassResult() {
  sfx(win ? 'victory' : 'defeat');
  if (win) S.fx.confetti(60);
  $('resultTitle').textContent = win ? '会戦・勝利' : '会戦・敗北';
  const log = res.rounds.filter((_, i) => i % Math.ceil(res.rounds.length / 6) === 0 || i === res.rounds.length - 1).map(r => `R${r.round}　自軍 ${r.a}　敵 ${r.b}`).join('\n');
  if (win) {
    const rw = S.game.onVictory(); autosave();
    $('resultText').textContent = `${ch.outro}\n自軍 ${res.survivorsA}／${enemyArmy.name} ${res.survivorsB}　を打ち破った。\n（報酬 ${rw.reward}G）\n\n${log}`;
    $('nextBtn').style.display = ''; $('nextBtn').textContent = S.game.done ? 'おわりへ' : '拠点へ';
    $('retryBtn').style.display = 'none';
    S._massLost = false;
  } else {
    $('resultText').textContent = `自軍は敗走した……\n自軍 ${res.survivorsA}／敵 ${res.survivorsB}\n\n${log}`;
    $('nextBtn').style.display = 'none';
    $('retryBtn').style.display = ''; $('retryBtn').textContent = 'もう一度（章へ戻る）';
    S._massLost = true;
  }
  S.mode = 'result';
  $('result').hidden = false;
  }
}
function refreshHud() {
  const b = S.battle;
  const head = S.skirmish ? '演習' : `第${S.game.chapterIndex + 1}章`;
  if (b.initiative) {
    const act = b.activeUnit();
    const who = act ? `${act.name}${act.side === 'player' ? '（自軍）' : '（敵）'}の手番` : '—';
    $('turnInfo').textContent = `${head}　${who}　R${b.turn}`;
  } else {
    $('turnInfo').textContent = `${head}　${b.phase === 'player' ? '自軍' : '敵軍'}　ターン${b.turn}`;
  }
  const o = b.objective;
  const objText = o.type === 'rout' ? '目標：敵の殲滅' : o.type === 'seize' ? '目標：玉座の制圧' : o.type === 'defeat_boss' ? '目標：敵将の撃破' : o.type === 'survive' ? `目標：${o.turns}ターン生存` : '目標：制圧';
  const wx = b.board.weather;
  const wxText = (wx && wx.id !== 'clear') ? `　〔${wx.name}〕` : '';
  $('objInfo').textContent = objText + wxText + `　味方${b.board.unitsOf('player').length}／敵${b.board.unitsOf('enemy').length}`;
}

/* ---------- 選択と移動 ---------- */
function clearSel() {
  S.selected = null; S.preMovePos = null;
  S.moveTiles = S.atkTiles = S.staffTiles = S.path = null;
  hideMenu(); $('forecast').hidden = true;
}
function selectUnit(u) {
  clearSel();
  S.selected = u; S.preMovePos = { ...u.pos };
  S.moveTiles = S.battle.moveTiles(u);
  S.atkTiles = computeThreatTiles(u, S.moveTiles);
  S.mode = 'selected';
  sfx('select');
}
/* 選択ユニットが「どこかへ動けば狙える」敵のマス（赤表示） */
function computeThreatTiles(u, moveTiles) {
  const w = equippedWeapon(u);
  if (!w || w.wtype === 'staff') return [];
  const set = new Set(moveTiles.map(t => key(t.x, t.y)));
  set.add(key(u.pos.x, u.pos.y));
  const out = [];
  for (const e of S.board.enemiesOf(u)) {
    for (let r = w.min; r <= w.max; r++) {
      let ok = false;
      for (const t of moveTiles.concat([u.pos])) {
        if (manhattan(t, e.pos) >= w.min && manhattan(t, e.pos) <= w.max) { ok = true; break; }
      }
      if (ok) { out.push({ x: e.pos.x, y: e.pos.y }); break; }
    }
  }
  return out;
}

async function moveSelectedTo(tile) {
  const u = S.selected;
  const path = (tile.x === u.pos.x && tile.y === u.pos.y) ? [u.pos] : S.battle.pathTo(u, tile);
  if (!path) return;
  S.mode = 'animating';                       // 移動中は入力を締める（連打での多重移動を防ぐ）
  S.moveTiles = S.atkTiles = S.path = null;
  if (path.length > 1) { sfx('move'); await animateMove(u, path); S.fx.dust(tile.x, tile.y); }
  S.battle.doMove(u, tile);
  openMenu();
}
function animateMove(u, path) {
  return new Promise(res => {
    S.anim = { type: 'move', uid: u.uid, path, t0: performance.now(), dur: Math.max(120, path.length * 90), cx: u.pos.x, cy: u.pos.y, resolve: res };
  });
}

/* ---------- 行動メニュー ---------- */
function openMenu() {
  S.mode = 'menu';
  const u = S.selected;
  const targets = S.battle.attackTargetsFrom(u, u.pos);
  const staffT = S.battle.staffTargetsFrom(u, u.pos);
  const consum = u.items.map((it, i) => ({ it: itemDef(it.id), i })).filter(o => o.it && (o.it.kind === 'consumable'));
  const menu = $('actionMenu'); menu.innerHTML = '';
  const add = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn; menu.appendChild(b); };
  if (isAreaWeapon(u)) {
    const centers = S.battle.areaCentersFrom(u, u.pos);
    if (centers.length) add('範囲攻撃', () => beginAoe(centers), 'primary');
  } else if (targets.length) add('攻撃', () => beginTarget(targets), 'primary');
  if (unitHasSkill(u, 'arithmetic')) add('算術', () => beginArith(), 'primary');
  if (staffT.length) add('杖', () => beginStaff(staffT), 'primary');
  if (consum.length) add('道具', () => openItems(consum));
  const stealT = stealTargetsFrom(S.battle.board, u, u.pos);
  if (stealT.length) add('盗む', () => beginSteal(stealT));
  const obj = S.game && treasureAt(S.battle.board, u.pos.x, u.pos.y);
  if (obj && obj.type === 'chest') {
    if (canOpenChest(u, obj)) add(obj.locked ? '開ける（施錠）' : '開ける', () => takeTreasure(u, obj), 'primary');
  } else if (obj && obj.type === 'village') {
    add('訪れる', () => takeTreasure(u, obj), 'primary');
  }
  add('待機', () => { sfx('select2'); S.battle.doWait(u); endAction(); });
  add('もどす', () => { undoMove(); }, 'ghost');
  menu.hidden = false;
}
function hideMenu() { $('actionMenu').hidden = true; }
function undoMove() {
  const u = S.selected;
  S.battle.board.moveUnit(u, S.preMovePos.x, S.preMovePos.y);
  u.hasMoved = false;
  hideMenu();
  selectUnit(u);
}
function openItems(consum) {
  const menu = $('actionMenu'); menu.innerHTML = '';
  for (const o of consum) {
    const b = document.createElement('button');
    b.textContent = `${o.it.name}${o.it.uses ? '×' + S.selected.items[o.i].uses : ''}`;
    b.onclick = () => { sfx('heal'); const r = S.battle.doItem(S.selected, o.i); playEvents(r.events).then(endAction); };
    menu.appendChild(b);
  }
  const back = document.createElement('button'); back.textContent = 'もどる'; back.className = 'ghost'; back.onclick = openMenu; menu.appendChild(back);
}
/* 宝箱を開ける／村を訪れる。中身を金は所持へ、品は荷駄へ。 */
function takeTreasure(u, obj) {
  hideMenu();
  const g = S.game;
  const res = obj.type === 'chest' ? openChest(obj, u) : visitVillage(obj);
  const reward = res.loot || res.gift;
  let msg;
  if (reward.gold) { g.gold += reward.gold; msg = `${reward.gold}G を得た`; }
  else { g.convoy.push(reward.item); msg = `${itemDef(reward.item).name} を荷駄へ`; }
  if (res.usedKey) msg += `（${itemDef(res.usedKey).name}を使った）`;
  sfx(obj.type === 'chest' ? 'levelup' : 'heal');
  S.fx.burst(u.pos.x, u.pos.y, obj.type === 'chest' ? '#ffd86a' : '#9cf0c0');
  S.popups.push({ x: u.pos.x, y: u.pos.y, text: obj.type === 'chest' ? '宝箱！' : '村', color: '#ffe08a', t: performance.now(), big: true });
  toast(msg);
  autosave();
  S.battle.doWait(u);
  endAction();
}

/* ---------- 盗み ---------- */
function beginSteal(targets) {
  S.mode = 'steal';
  hideMenu();
  S.staffTiles = targets.map(t => ({ x: t.pos.x, y: t.pos.y }));
  S._stealTargets = targets;
  toast('懐をねらう相手をタップ');
}
function openStealItems(target) {
  const u = S.selected;
  const idx = stealableItems(u, target);
  const menu = $('actionMenu'); menu.innerHTML = '';
  for (const i of idx) {
    const it = itemDef(target.items[i].id);
    const b = document.createElement('button');
    b.textContent = `${it.name}を盗む`;
    b.onclick = () => {
      const res = resolveSteal(u, target, i);
      sfx('select2');
      S.fx.burst(target.pos.x, target.pos.y, '#caa2ff');
      S.popups.push({ x: u.pos.x, y: u.pos.y, text: `盗：${itemDef(res.item).name}`, color: '#caa2ff', t: performance.now() });
      S.staffTiles = null;
      S.battle.doWait(u);
      endAction();
    };
    menu.appendChild(b);
  }
  const back = document.createElement('button'); back.textContent = 'やめる'; back.className = 'ghost';
  back.onclick = () => { S.staffTiles = null; openMenu(); S.mode = 'menu'; };
  menu.appendChild(back);
  menu.hidden = false;
}

/* ---------- 攻撃 ---------- */
function beginTarget(targets) {
  S.mode = 'target';
  hideMenu();
  S.atkTiles = targets.map(t => ({ x: t.pos.x, y: t.pos.y }));
  S._targets = targets;
  toast('狙う敵をタップ');
}
function showForecast(def) {
  const u = S.selected;
  const fc = forecast(u, def, S.board);
  if (!fc) return;
  const dd = classDef(def.classId);
  const dmgText = (d, x2) => `${d}${x2 ? '×2' : ''}`;
  $('fcBody').innerHTML =
    `<div class="fcrow"><b>${u.name}</b> → <b>${def.name}</b>（${dd.name} Lv${def.level}）${fc.flank === 'back' ? ' <span style="color:#ffd86a">背後!</span>' : fc.flank === 'side' ? ' <span style="color:#9cf0c0">側面</span>' : ''}</div>
     <table class="fctbl">
       <tr><th></th><th>${u.name}</th><th>${def.name}</th></tr>
       <tr><td>HP</td><td>${u.hp}/${u.maxHp}</td><td>${def.hp}/${def.maxHp}</td></tr>
       <tr><td>威力</td><td>${dmgText(fc.dmg, fc.doubles)}${fc.eff ? '★' : ''}</td><td>${fc.counter ? dmgText(fc.counter.dmg, fc.counter.doubles) : '—'}</td></tr>
       <tr><td>命中</td><td>${fc.hit}%</td><td>${fc.counter ? fc.counter.hit + '%' : '—'}</td></tr>
       <tr><td>必殺</td><td>${fc.crit}%</td><td>${fc.counter ? fc.counter.crit + '%' : '—'}</td></tr>
     </table>`;
  S._pendingDef = def;
  $('forecast').hidden = false;
}
/* ---------- マップ攻撃（範囲） ---------- */
function beginAoe(centers) {
  S.mode = 'aoe'; hideMenu();
  S._aoeCenters = centers;
  S.atkTiles = centers.map(c => ({ x: c.x, y: c.y }));
  toast('着弾点をタップ');
}
function showAoeForecast(center) {
  const u = S.selected;
  S._aoeCenter = center; S._aoeMode = true;
  S.atkTiles = S.battle.areaSplashTiles(u, center);
  const tgts = areaTargets(u, center, S.board);
  $('fcBody').innerHTML =
    `<div class="fcrow"><b>${u.name}</b> 範囲攻撃　巻き込み <b>${tgts.length}</b>体</div>`
    + tgts.map(t => `<div class="fcrow">${t.name}（${classDef(t.classId).name} HP${t.hp}/${t.maxHp}）</div>`).join('');
  $('forecast').hidden = false;
}
async function confirmAoe() {
  const u = S.selected, center = S._aoeCenter;
  $('forecast').hidden = true; S._aoeMode = false; S.atkTiles = null;
  S.busy = true; S.mode = 'animating';
  const res = S.battle.doAreaAttack(u, center);
  S.fx.burst(center.x, center.y, '#ff9c6a'); S.fx.addShake(8);
  for (const t of res.targets) if (t.pos) S.fx.burst(t.pos.x, t.pos.y, '#ffb070');
  await playEvents(res.events);
  if (res.levelUps && res.levelUps.length) await showLevelUps(u, res.levelUps);
  refreshLog();
  S.busy = false;
  endAction();
}
/* ---------- 算術 ---------- */
function beginArith() {
  hideMenu();
  const menu = $('actionMenu'); menu.innerHTML = '';
  const mk = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; menu.appendChild(b); };
  for (const [label, prop] of ARITH_PROPS) mk(label, () => chooseArithNum(prop), 'primary');
  mk('やめる', () => { openMenu(); }, 'ghost');
  menu.hidden = false;
  toast('能力値を選ぶ');
}
function chooseArithNum(prop) {
  const menu = $('actionMenu'); menu.innerHTML = '';
  const mk = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; menu.appendChild(b); };
  for (const n of ARITH_NUMS) mk('×' + n, () => arithPreview(prop, n), 'primary');
  mk('もどる', beginArith, 'ghost');
  menu.hidden = false;
  toast('倍数を選ぶ');
}
function arithPreview(prop, num) {
  const u = S.selected;
  hideMenu();
  const tgts = arithmeticTargets(u, prop, num, S.board);
  S.atkTiles = tgts.map(t => ({ x: t.pos.x, y: t.pos.y }));
  S._arith = { prop, num }; S._arithMode = true;
  const label = (ARITH_PROPS.find(p => p[1] === prop) || ['?'])[0];
  $('fcBody').innerHTML = `<div class="fcrow"><b>${u.name}</b> 算術　${label} ×${num} → <b>${tgts.length}</b>体</div>`
    + tgts.map(t => `<div class="fcrow">${t.name}（${classDef(t.classId).name}）</div>`).join('');
  $('forecast').hidden = false;
}
async function confirmArith() {
  const u = S.selected, { prop, num } = S._arith;
  $('forecast').hidden = true; S._arithMode = false; S.atkTiles = null;
  S.busy = true; S.mode = 'animating';
  const res = S.battle.doArithmetic(u, prop, num);
  for (const t of res.targets) if (t.pos) { S.fx.burst(t.pos.x, t.pos.y, '#9cc8ff'); }
  S.fx.addShake(5);
  await playEvents(res.events);
  if (res.levelUps && res.levelUps.length) await showLevelUps(u, res.levelUps);
  refreshLog();
  S.busy = false;
  endAction();
}
async function confirmAttack() {
  if (S._aoeMode) return confirmAoe();
  if (S._arithMode) return confirmArith();
  const u = S.selected, def = S._pendingDef;
  $('forecast').hidden = true;
  S.atkTiles = null;
  S.busy = true; S.mode = 'animating';
  const res = S.battle.doAttack(u, def);
  await playEvents(res.events);
  if (res.levelUps && res.levelUps.length) await showLevelUps(u, res.levelUps);
  S.busy = false;
  endAction();
}

/* ---------- 杖 ---------- */
function beginStaff(targets) {
  S.mode = 'staff'; hideMenu();
  S.staffTiles = targets.map(t => ({ x: t.pos.x, y: t.pos.y }));
  S._staffTargets = targets;
  toast('癒す味方をタップ');
}
async function doStaffOn(target) {
  const u = S.selected;
  S.staffTiles = null; S.busy = true; S.mode = 'animating';
  const r = S.battle.doStaff(u, target);
  await playEvents(r.events);
  S.busy = false; endAction();
}

/* ---------- 行動の終わり ---------- */
function endAction() {
  clearSel();
  S.mode = 'idle';
  refreshHud();
  checkResult();
  if (S.battle && S.battle.initiative && !S.battle.over) {
    S.battle.endUnitTurn();              // 行動順：その者の手番を閉じ、次へ
    if (S.battle.over) checkResult(); else advanceInitiative();
  }
}

/* 行動順モードの進行：AI は自動で、自軍は手番が来たら操作できる */
async function advanceInitiative() {
  if (S.busy || !S.battle || !S.battle.initiative) return;
  for (let guard = 0; guard < 400; guard++) {
    if (S.battle.over) { checkResult(); return; }
    const u = S.battle.activeUnit();
    if (!u) { S.battle.endUnitTurn(); continue; }
    if (S._initStartedFor !== u.uid) {       // 手番開始処理は一度だけ
      S._initStartedFor = u.uid;
      const ev = S.battle.startUnitTurn(u);
      if (ev && ev.length) { S.busy = true; S.mode = 'animating'; await playEvents(ev); S.busy = false; refreshLog(); }
    }
    if (S.battle.over) { checkResult(); return; }
    if (u.side === 'player' && !S.auto) {
      S.activeInit = u;
      S.cam_focus = u.pos;
      selectUnit(u);                     // 操作を委ねる
      refreshHud();
      return;
    }
    // AI（または自軍オート）が一手指す
    S.busy = true; S.mode = 'animating';
    const rec = S.battle.aiActOnce(u);
    S.cursor = rec.path ? rec.path[rec.path.length - 1] : rec.from;
    if (rec.path && rec.path.length > 1) { sfx('move'); await animateMoveAlong(uOf(rec.uid), rec.path); }
    if (rec.events && rec.events.length) await playEvents(rec.events);
    refreshLog(); checkResultSilent();
    S.busy = false; S.cursor = null;
    S.battle.endUnitTurn();
    refreshHud();
    if (S.battle.over) { checkResult(); return; }
    await sleep(60);
  }
}

/* ---------- 演出（戦闘イベント） ---------- */
function popup(pos, text, color, big) { S.popups.push({ x: pos.x, y: pos.y, text, color, big, t: performance.now() }); }
function uOf(uid) { return S.board.units.find(u => u.uid === uid); }

async function playEvents(events) {
  for (const e of events) {
    const tgt = e.tgt != null ? uOf(e.tgt) : (e.uid != null ? uOf(e.uid) : null);
    const by = e.by != null ? uOf(e.by) : null;
    if (e.type === 'miss') { if (by && tgt) attackFx(by, tgt, false); if (tgt && tgt.pos) popup(tgt.pos, 'MISS', '#cfd6e6'); sfx('miss'); await sleep(340); }
    else if (e.type === 'hit') { if (by && tgt) attackFx(by, tgt, false); if (tgt && tgt.pos) { const c = impactColor(by); popup(tgt.pos, String(e.dmg), '#ffd0c0'); flashHit(tgt); S.fx.impact(tgt.pos.x, tgt.pos.y, c); S.fx.addShake(3); } sfx('hit'); await sleep(420); }
    else if (e.type === 'crit') { if (by) showCutin(by); if (by && tgt) attackFx(by, tgt, true); if (tgt && tgt.pos) { popup(tgt.pos, String(e.dmg) + '!', '#ffd86a', true); flashHit(tgt); S.fx.star(tgt.pos.x, tgt.pos.y, '#ffd86a'); S.fx.flash('#fff3c8', 0.4); S.fx.addShake(12); } sfx('crit'); await sleep(560); }
    else if (e.type === 'skill') { if (by && by.pos) popup(by.pos, skillName(e.id), '#b79bff'); await sleep(260); }
    else if (e.type === 'drain') { if (by && by.pos) { popup(by.pos, '+' + e.amount, '#9cf0c0'); S.fx.heal(by.pos.x, by.pos.y); } await sleep(220); }
    else if (e.type === 'heal') { if (tgt && tgt.pos) { popup(tgt.pos, '+' + e.amount, '#9cf0c0'); S.fx.heal(tgt.pos.x, tgt.pos.y); } await sleep(220); }
    else if (e.type === 'poison' || e.type === 'burn') { if (tgt && tgt.pos) popup(tgt.pos, String(e.dmg), '#b6e07c'); await sleep(220); }
    else if (e.type === 'status') { if (tgt && tgt.pos) { popup(tgt.pos, statusName(e.id), '#b6e07c'); S.fx.burst(tgt.pos.x, tgt.pos.y, '#9cd06a'); } await sleep(260); }
    else if (e.type === 'restore' || e.type === 'buff' || e.type === 'debuff') { await sleep(120); }
    // 死亡——撃破の演出（破片・閃光・揺れ）
    if (tgt && !isAlive(tgt)) { if (tgt.pos) { popup(tgt.pos, '×', '#ff6a5a', true); S.fx.spark(tgt.pos.x, tgt.pos.y, '#c0463e', 18, 4); S.fx.spark(tgt.pos.x, tgt.pos.y, '#3a2630', 10, 2.6); S.fx.flash('#ff6a5a', 0.22); S.fx.addShake(8); } sfx('die'); }
  }
  // 倒れた者を盤から
  for (const u of S.board.units) if (!isAlive(u) && u.pos) { S.board.remove(u); u.pos = null; }
}
function flashHit(u) { S.anim = { type: 'hit', uid: u.uid, until: performance.now() + 260 }; setTimeout(() => { if (S.anim && S.anim.type === 'hit') S.anim = null; }, 280); }
/* 得物の型ごとの色（衝撃・斬撃の色味） */
function impactColor(by) {
  const w = by && equippedWeapon(by);
  const wt = w && w.wtype;
  return ({ sword: '#dfe8ff', lance: '#b9e0ff', axe: '#ffcf9a', bow: '#ffe8b0', dagger: '#cfe0d0',
    anima: '#ff9c6a', light: '#ffe08a', dark: '#c79bff', fist: '#ffd0a0' })[wt] || '#ffd0a0';
}
function attackFx(by, tgt, crit) {
  if (!by.pos || !tgt.pos) return;
  const w = equippedWeapon(by);
  const dist = manhattan(by.pos, tgt.pos);
  if (w && w.magic) {
    const c = w.wtype === 'light' ? '#ffe08a' : w.wtype === 'dark' ? '#c79bff' : '#ff9c6a';
    S.fx.magicCircle(by.pos.x, by.pos.y, c);
    S.fx.shoot(by.pos, tgt.pos, { kind: 'bolt', color: c, dur: 0.18, onArrive: () => { S.fx.ring(tgt.pos.x, tgt.pos.y, c, 1.3); S.fx.spark(tgt.pos.x, tgt.pos.y, c, 12, 3); } });
  } else if (dist > 1) {
    S.fx.shoot(by.pos, tgt.pos, { kind: 'arrow', dur: 0.16 });
  } else {
    S.fx.slash(by.pos, tgt.pos, crit ? '#ffd86a' : impactColor(by));
  }
}
function skillName(id) { const m = { sol: '太陽', luna: '月光', astra: '流星', pierce: '貫通', colossus: '剛撃', lethality: '瞬殺！', aether: '天空', aegis: '盾防', pavise: '大盾', miracle: '祈り', ignis: 'イグニス', adept: '連撃', wrath: '憤怒', vantage: '先制', lifetaker: '命奪' }; return m[id] || id; }
function statusName(id) { return ({ poison: '毒', sleep: '眠り', silence: '沈黙', freeze: '凍結', berserk: '狂乱' })[id] || id; }

async function showLevelUps(u, ups) {
  for (const up of ups) {
    sfx('levelup');
    const gains = STAT_KEYS.filter(k => up.gain[k]).map(k => `${STAT_NAMES[k]}+${up.gain[k]}`).join(' ') || '（変化なし）';
    if (u.pos) popup(u.pos, 'Lv' + up.level + '!', '#ffe08a', true);
    toast(`${u.name} レベルアップ！ ${gains}`, 1800);
    await sleep(1100);
  }
}

/* ---------- ターン終了・敵フェイズ・オート ---------- */
async function animateTurns(turns) {
  for (const rec of turns) {
    const u = uOf(rec.uid);
    if (!u) continue;
    S.cursor = rec.path ? rec.path[rec.path.length - 1] : rec.from;
    if (rec.path && rec.path.length > 1) { sfx('move'); await animateMoveAlong(u, rec.path); await sleep(50); }
    if (rec.events && rec.events.length) await playEvents(rec.events);
    refreshLog();
    checkResultSilent();
    if (S.battle.over) break;
    await sleep(70);
  }
  S.cursor = null;
}
async function endTurn() {
  if (S.busy || S.mode === 'animating') return;
  clearSel(); S.mode = 'animating'; S.busy = true;
  const turns = S.battle.endPlayerPhase();
  await animateTurns(turns);
  S.busy = false; S.mode = 'idle';
  refreshHud(); refreshLog();
  checkResult();
  maybeAuto();
}
/* オート：自軍を AI に任せる */
async function autoPlayerPhase() {
  if (S.busy || S.mode === 'animating' || !S.battle || S.battle.over) return;
  clearSel(); S.mode = 'animating'; S.busy = true;
  const turns = S.battle.autoPlayerTurn();
  await animateTurns(turns);
  S.busy = false; S.mode = 'idle';
  refreshHud(); refreshLog();
  checkResult();
  if (!S.battle.over) endTurn();          // 続けて敵フェイズへ
}
function maybeAuto() {
  if (S.auto && S.battle && !S.battle.over && S.battle.phase === 'player' && !S.busy && S.mode === 'idle') {
    setTimeout(autoPlayerPhase, 250);
  }
}
function refreshLog() {
  if ($('log').hidden || !S.battle) return;
  const body = $('logBody');
  body.innerHTML = S.battle.log.slice(-80).map(e =>
    `<div class="lg ${e.side}"><span class="tn">T${e.turn}</span>${e.text}</div>`).join('');
  body.scrollTop = body.scrollHeight;
}
function animateMoveAlong(u, path) {
  // 演出用：すでに doMove 済みなので、見た目だけ from→to を滑らせる
  return new Promise(res => {
    S.anim = { type: 'move', uid: u.uid, path, t0: performance.now(), dur: Math.max(120, path.length * 70), cx: path[0].x, cy: path[0].y, resolve: res };
  });
}

/* ---------- 勝敗 ---------- */
function checkResultSilent() { S.battle.checkEnd(); }
function checkResult() {
  if (!S.battle || !S.battle.over || S.mode === 'result') return;
  S.mode = 'result';
  showOutcome();
}
async function showOutcome() {
  $('hud').hidden = true;
  const win = S.battle.victory;
  stopMusic();
  sfx(win ? 'victory' : 'defeat');
  if (win) S.fx.confetti(70);
  playMusic(win ? 'victory' : 'defeat');
  if (S.skirmish) {
    $('resultTitle').textContent = win ? '演習・勝利' : '演習・敗北';
    $('resultText').textContent = win
      ? `${SKIRMISH_SIZES[S.skirmish.size].name}の戦場を制した。——また別の種で、別の一戦を。`
      : '演習に敗れた。手勢を立て直し、もう一度。';
    $('nextBtn').textContent = 'タイトルへ';
    $('nextBtn').style.display = '';
    $('retryBtn').textContent = 'もう一度';
    $('retryBtn').style.display = '';
    $('result').hidden = false;
    return;
  }
  const ch = S.game.chapter;
  if (win) await playDialogue(chapterScript(S.game.chapterIndex).win);
  $('resultTitle').textContent = win ? '勝利' : '敗北';
  if (win) {
    const r = S.game.onVictory();
    autosave();
    const sup = (r.supportUps && r.supportUps.length)
      ? '\n絆が深まった：' + r.supportUps.map(s => `${s.a}＆${s.b}→${s.rank}`).join('、')
      : '';
    $('resultText').textContent = `${ch.outro}\n（報酬 ${r.reward}G／所持 ${r.gold}G）${sup}`;
    $('nextBtn').textContent = S.game.done ? 'おわりへ' : '拠点へ';
    $('nextBtn').style.display = '';
    $('retryBtn').style.display = 'none';
  } else {
    const reason = S.battle.reason === 'lord' ? `${S.game.party[0].name}が倒れた——戦記はここで途絶えた。` : '全軍が潰えた。';
    $('resultText').textContent = reason;
    $('nextBtn').style.display = 'none';
    $('retryBtn').textContent = 'この章を再戦';
    $('retryBtn').style.display = '';
  }
  $('result').hidden = false;
}
function showClear() {
  $('result').hidden = true;
  playMusic('ending');
  $('title').hidden = false;
  $('title').querySelector('.lead').textContent = '簒奪の王は倒れ、長い戦が終わった。——また別の種で、別の戦記を。';
}

/* ---------- 入力（タップ・ドラッグ・ピンチ） ---------- */
const ptrs = new Map();
let gesture = null;     // null | 'pan' | 'pinch'
let downInfo = null;
let pinchStart = null;
let longTimer = null;

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    gesture = 'pinch';
    const [a, b] = [...ptrs.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: S.cam.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, camx: S.cam.x, camy: S.cam.y };
  } else {
    gesture = null;
    downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), camx: S.cam.x, camy: S.cam.y, moved: false };
    clearTimeout(longTimer);
    longTimer = setTimeout(() => { if (downInfo && !downInfo.moved) onLongPress(e.clientX, e.clientY); }, 480);
  }
});
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ns = Math.max(0.55, Math.min(2.2, pinchStart.scale * dist / pinchStart.dist));
    // 中点を保ったままズーム
    const wx = (pinchStart.cx - pinchStart.camx) / (BASE_TILE * pinchStart.scale);
    const wy = (pinchStart.cy - pinchStart.camy) / (BASE_TILE * pinchStart.scale);
    S.cam.scale = ns;
    S.cam.x = pinchStart.cx - wx * S.cam.tile;
    S.cam.y = pinchStart.cy - wy * S.cam.tile;
    S.cam.clamp(S.board, S.vw, S.vh);
    return;
  }
  if (downInfo) {
    const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
    if (!downInfo.moved && Math.hypot(dx, dy) > 10) { downInfo.moved = true; gesture = 'pan'; clearTimeout(longTimer); }
    if (gesture === 'pan') {
      S.cam.x = downInfo.camx + dx; S.cam.y = downInfo.camy + dy;
      S.cam.clamp(S.board, S.vw, S.vh);
    }
  }
});
function endPointer(e) {
  clearTimeout(longTimer);
  const wasTap = downInfo && !downInfo.moved && (performance.now() - downInfo.t) < 450 && ptrs.size === 1;
  const px = e.clientX, py = e.clientY;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2 && gesture === 'pinch') gesture = ptrs.size === 1 ? 'pan' : null;
  if (gesture === 'pinch') return;
  if (wasTap) onTap(px, py);
  if (ptrs.size === 0) { gesture = null; downInfo = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { clearTimeout(longTimer); ptrs.delete(e.pointerId); if (ptrs.size === 0) { gesture = null; downInfo = null; } });

function tileFromScreen(px, py) {
  const t = S.cam.screenToTile(px, py);
  if (!S.board || !S.board.inBounds(t.x, t.y)) return null;
  return t;
}
function onTap(px, py) {
  if (S.busy || S.mode === 'animating' || S.mode === 'result') return;
  const tile = tileFromScreen(px, py);
  if (!tile) { if (S.mode === 'selected') { clearSel(); S.mode = 'idle'; } return; }
  S.cursor = tile;
  const u = S.board.unitAt(tile.x, tile.y);
  if (S.mode === 'target') {
    const def = (S._targets || []).find(t => t.pos.x === tile.x && t.pos.y === tile.y);
    if (def) showForecast(def);
    else { /* キャンセル */ S.atkTiles = null; openMenu(); S.mode = 'menu'; }
    return;
  }
  if (S.mode === 'aoe') {
    const c = (S._aoeCenters || []).find(t => t.x === tile.x && t.y === tile.y);
    if (c) showAoeForecast(c);
    else { S.atkTiles = null; openMenu(); S.mode = 'menu'; }
    return;
  }
  if (S.mode === 'staff') {
    const t = (S._staffTargets || []).find(t => t.pos.x === tile.x && t.pos.y === tile.y);
    if (t) doStaffOn(t); else { S.staffTiles = null; openMenu(); S.mode = 'menu'; }
    return;
  }
  if (S.mode === 'steal') {
    const t = (S._stealTargets || []).find(t => t.pos.x === tile.x && t.pos.y === tile.y);
    if (t) openStealItems(t); else { S.staffTiles = null; openMenu(); S.mode = 'menu'; }
    return;
  }
  if (S.mode === 'selected') {
    const inMove = S.moveTiles && S.moveTiles.some(m => m.x === tile.x && m.y === tile.y);
    if (S.battle.initiative) {                 // 手番の者だけ動かせる
      if (inMove || u === S.selected) { moveSelectedTo(tile); return; }
      if (u) showInfo(u);
      return;
    }
    if (u && u.side === 'player' && u !== S.selected && !u.hasActed) { selectUnit(u); return; }
    if (inMove || (u === S.selected)) { moveSelectedTo(tile); return; }
    clearSel(); S.mode = 'idle'; sfx('cancel'); return;
  }
  // idle
  if (S.battle.initiative) { if (u) showInfo(u); return; }
  if (u && u.side === 'player' && !u.hasActed) { selectUnit(u); }
  else if (u) { showInfo(u); }
}
function onLongPress(px, py) {
  const tile = tileFromScreen(px, py);
  if (!tile) return;
  const u = S.board.unitAt(tile.x, tile.y);
  if (u) { S.cursor = tile; showInfo(u); sfx('select2'); }
}

/* ---------- ユニット詳細 ---------- */
function showInfo(u) {
  const cd = classDef(u.classId);
  const w = equippedWeapon(u);
  const es = effectiveStats(u);
  const statline = STAT_KEYS.map(k => `<span>${STAT_NAMES[k]} <b>${es[k]}</b></span>`).join('');
  const items = u.items.map(it => itemDef(it.id) ? itemDef(it.id).name + (it.uses ? `×${it.uses}` : '') : '').filter(Boolean).join('、');
  const sk = (u.skills || []).map(s => (skillDef(s) ? skillDef(s).name : s)).join('・');
  const bond = (() => { let n = 0; for (const a of (S.board ? S.board.alliesOf(u) : [])) if (a.pos && u.pos && Math.abs(a.pos.x - u.pos.x) + Math.abs(a.pos.y - u.pos.y) === 1) n++; return Math.min(3, n); })();
  $('infoBody').innerHTML =
    `<canvas id="infoFace" width="72" height="72" style="float:right;width:64px;height:64px;border-radius:10px;margin-left:.5rem"></canvas>
     <h3>${u.name} <small>${cd.name} Lv${u.level}</small></h3>
     <div class="hpline">HP ${u.hp}/${u.maxHp}　移動${u.mov}　信仰${u.faith ?? 5}${bond ? `　絆+${bond}` : ''}</div>
     <div class="statgrid">${statline}</div>
     <div class="itemline">得物：${w ? w.name : '—'}</div>
     ${u.wexp ? `<div class="itemline">熟練：${Object.keys(u.wexp).map(t => `${WTYPE[t]}${WRANKS[unitRank(u, t)] || 'E'}`).join('・')}</div>` : ''}
     <div class="itemline">持物：${items || '—'}</div>
     ${sk ? `<div class="itemline">技：${sk}</div>` : ''}
     ${u.status && u.status.length ? `<div class="itemline">状態：${u.status.map(s => statusName(s.id)).join('・')}</div>` : ''}
     ${u.bio ? `<p class="bio">${u.bio}</p>` : ''}`;
  const fc = $('infoFace');
  if (fc) { const ic = fc.getContext('2d'); const party = S.game && S.game.party.some(p => p.name === u.name); drawPortrait(ic, u.name, 0, 0, 72, { color: party ? '#5f7cff' : (u.side === 'enemy' ? '#c0463e' : '#3aa06a') }); }
  $('info').hidden = false;
}

/* ---------- 図鑑 ---------- */
const CODEX_TABS = [
  ['魔物誌', 'beast'], ['世界', 'world'], ['得物', 'weapon'], ['地形', 'terrain'], ['支援', 'support'],
];
function openCodex() {
  const tabs = $('codexTabs'); tabs.innerHTML = '';
  CODEX_TABS.forEach(([label, id], i) => {
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = () => { [...tabs.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); renderCodex(id); };
    if (i === 0) b.classList.add('on');
    tabs.appendChild(b);
  });
  renderCodex('beast');
  $('codex').hidden = false;
}
function renderCodex(tab) {
  const body = $('codexBody'); body.innerHTML = '';
  const entry = (title, sub, text, tac) => {
    const d = document.createElement('div'); d.className = 'entry';
    d.innerHTML = `<h4>${title}${sub ? ` <small>${sub}</small>` : ''}</h4><p>${text}</p>${tac ? `<p class="tac">▶ ${tac}</p>` : ''}`;
    body.appendChild(d);
  };
  if (tab === 'beast') for (const b of BESTIARY) entry(b.name, b.classId, b.blurb, b.tactics);
  else if (tab === 'world') for (const w of WORLD) entry(w.title, '', w.text);
  else if (tab === 'weapon') for (const k in WEAPON_NOTES) entry(WTYPE[k] || k, '', WEAPON_NOTES[k]);
  else if (tab === 'terrain') for (const k in TERRAIN_NOTES) entry(k, '', TERRAIN_NOTES[k]);
  else if (tab === 'support') for (const s of ALL_SUPPORTS) {
    const d = document.createElement('div'); d.className = 'entry';
    const lines = s.lines.map(l => `<span class="who">${l.who}</span>「${l.line}」`).join('<br>');
    d.innerHTML = `<h4>${s.a} & ${s.b}</h4><p class="conv">${lines}</p>`;
    body.appendChild(d);
  }
  body.scrollTop = 0;
}

/* ---------- 拠点（章と章のあいだ） ---------- */
function autosave() { if (!S.game) return; try { localStorage.setItem(SAVE_KEY, encodeSave(S.game)); } catch { /* あふれは無視 */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
let baseUnit = null;
const BASE_TABS = [['店', 'shop'], ['編成', 'party'], ['斡旋', 'hire'], ['闘技', 'arena'], ['支援', 'support'], ['交易', 'trade'], ['記録', 'record']];
const ALL_SUPPORTS = [...SUPPORTS, ...EXTRA_SUPPORTS, ...EXTRA_SUPPORTS2];

function openBase() {
  $('result').hidden = true;
  if (!S.game || S.game.done) { showIntro(); return; }
  S.mode = 'base';
  playMusic('prologue');
  $('baseTitle').textContent = `拠点 — 次は「${S.game.chapter.title}」`;
  $('campLine').textContent = campLine(S.game.seed, S.game.chapterIndex);
  baseUnit = S.game.livingParty()[0];
  const tabs = $('baseTabs'); tabs.innerHTML = '';
  BASE_TABS.forEach(([label, id], i) => {
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = () => { [...tabs.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); renderBase(id); };
    if (i === 0) b.classList.add('on');
    tabs.appendChild(b);
  });
  renderBase('shop');
  $('base').hidden = false;
}
function baseGold() { $('baseGold').textContent = `所持金 ${S.game.gold} G`; }
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function mkbtn(label, cls, fn, disabled) { const b = el('button', 'minibtn ' + (cls || ''), label); b.disabled = !!disabled; b.onclick = fn; return b; }

function renderJobPicker(u) {
  baseGold();
  const body = $('baseBody'); body.innerHTML = '';
  body.appendChild(el('div', 'subhead', `${u.name} のジョブを選ぶ（${RECLASS_COST}G・能力は引き継ぐ）`));
  for (const id of jobChoices(u)) {
    const row = el('div', 'shoprow');
    row.appendChild(el('span', 'nm', classDef(id).name));
    row.appendChild(mkbtn('就く', 'buy', () => {
      if (reclass(S.game, u, id)) { sfx('levelup'); autosave(); renderBase('party'); }
    }, !canReclass(S.game, u, id)));
    body.appendChild(row);
  }
  body.appendChild(mkbtn('もどる', 'ghost', () => renderBase('party')));
}
function renderBase(tab) {
  baseGold();
  const body = $('baseBody'); body.innerHTML = '';
  const g = S.game;
  if (tab === 'shop') {
    body.appendChild(el('div', 'subhead', '買う'));
    for (const id of shopStock(g)) {
      const it = itemDef2(id); const row = el('div', 'shoprow');
      row.appendChild(el('span', 'nm', it.name));
      row.appendChild(el('span', 'pr', it.price + 'G'));
      row.appendChild(mkbtn('買う', 'buy', () => { if (buy(g, id)) { sfx('select'); autosave(); renderBase('shop'); } }, !canBuy(g, id)));
      body.appendChild(row);
    }
    body.appendChild(el('div', 'subhead', '荷駄（売る・半値）'));
    if (!g.convoy.length) body.appendChild(el('div', 'shoprow', '——'));
    g.convoy.forEach((id, i) => {
      const it = itemDef2(id); const row = el('div', 'convrow');
      row.appendChild(el('span', 'nm', it ? it.name : id));
      row.appendChild(mkbtn('売 ' + sellPrice(id) + 'G', '', () => { if (sellFromConvoy(g, i)) { sfx('cancel'); autosave(); renderBase('shop'); } }));
      body.appendChild(row);
    });
  } else if (tab === 'party') {
    const pick = el('div', 'unitpick');
    for (const u of g.livingParty()) {
      const b = el('button', u === baseUnit ? 'on' : '', `${u.name} Lv${u.level}`);
      b.onclick = () => { baseUnit = u; renderBase('party'); };
      pick.appendChild(b);
    }
    body.appendChild(pick);
    const u = baseUnit; if (!u) return;
    const cd = classDef(u.classId); const es = effectiveStats(u);
    body.appendChild(el('div', 'subhead', `${u.name}（${cd.name} Lv${u.level}）HP${u.maxHp}　` + STAT_KEYS.map(k => `${STAT_NAMES[k]}${es[k]}`).join(' ')));
    if (canPromote(u)) {
      for (const to of promotionOptions(u)) {
        body.appendChild(mkbtn(`★ ${classDef(to).name}へ転職`, 'buy', () => { doPromote(u, to); sfx('levelup'); autosave(); renderBase('party'); }));
      }
    }
    if (!u.isLord && jobChoices(u).length) {
      body.appendChild(mkbtn(`ジョブ転職（${RECLASS_COST}G）`, '', () => renderJobPicker(u)));
    }
    if (canDismiss(S.game, u)) {
      body.appendChild(mkbtn('この者を解雇', 'ghost', () => {
        if (!confirm(`${u.name} を解雇しますか？（持ち物は荷駄へ戻ります）`)) return;
        dismiss(S.game, u); baseUnit = S.game.livingParty()[0]; sfx('cancel'); autosave(); renderBase('party');
      }));
    }
    body.appendChild(el('div', 'subhead', '持ち物（装備・荷駄へ）'));
    u.items.forEach((st, i) => {
      const it = itemDef2(st.id); const row = el('div', 'shoprow');
      const eq = (i === u.equipped) ? '◆' : '';
      const fl = forgeLevelOf(st);
      row.appendChild(el('span', 'nm', eq + (it ? it.name : st.id) + (fl ? `+${fl}` : '') + (st.uses ? `×${st.uses}` : '')));
      if (it && it.kind === 'weapon') row.appendChild(mkbtn('装備', '', () => { if (equipItem(u, i)) { sfx('select'); renderBase('party'); } }));
      if (it && it.kind === 'weapon' && it.wtype !== 'staff') {
        const label = fl >= MAX_FORGE ? '極' : `鍛${forgeCost(fl)}G`;
        row.appendChild(mkbtn(label, 'buy', () => { applyForge(g, st); sfx('levelup'); autosave(); renderBase('party'); }, !canForge(g, st, it)));
      }
      row.appendChild(mkbtn('荷駄へ', '', () => { takeItem(g, u, i); autosave(); renderBase('party'); }));
      body.appendChild(row);
    });
    if (u.accessory) body.appendChild(el('div', 'subhead', `装飾：${itemDef2(u.accessory).name}`));
    body.appendChild(el('div', 'subhead', '荷駄から'));
    if (!g.convoy.length) body.appendChild(el('div', 'shoprow', '——'));
    g.convoy.forEach((id, i) => {
      const it = itemDef2(id); if (!it) return;
      const row = el('div', 'convrow'); row.appendChild(el('span', 'nm', it.name));
      if (it.kind === 'booster') row.appendChild(mkbtn('使う', 'buy', () => { useBooster(g, u, i); sfx('levelup'); autosave(); renderBase('party'); }));
      else if (it.kind === 'accessory') row.appendChild(mkbtn('着ける', '', () => { equipAccessory(g, u, i); sfx('select'); autosave(); renderBase('party'); }));
      else row.appendChild(mkbtn('持つ', '', () => { if (giveItem(g, u, i)) { sfx('select'); autosave(); renderBase('party'); } }, u.items.length >= MAX_ITEMS));
      body.appendChild(row);
    });
  } else if (tab === 'hire') {
    body.appendChild(el('div', 'subhead', '斡旋所——金で腕利きを雇える（各人ひとり一度きり）'));
    for (const cand of hireRoster(g)) {
      const cd = classDef(cand.classId); const row = el('div', 'shoprow');
      const got = (g.hired || []).includes(cand.id);
      row.appendChild(el('span', 'nm', `${cand.name}（${cd.name} Lv${cand.level}）`));
      row.appendChild(el('span', 'pr', cand.cost + 'G'));
      row.appendChild(mkbtn(got ? '雇用済' : '雇う', got ? '' : 'buy', () => {
        if (hire(g, cand)) { sfx('levelup'); autosave(); renderBase('hire'); }
      }, got || !canHire(g, cand)));
      body.appendChild(row);
    }
  } else if (tab === 'arena') {
    const party = g.livingParty();
    if (!baseUnit || !party.includes(baseUnit)) baseUnit = party[0];
    const pick = el('div', 'unitpick');
    for (const u of party) {
      const b = el('button', u === baseUnit ? 'on' : '', `${u.name} Lv${u.level}`);
      b.onclick = () => { baseUnit = u; renderBase('arena'); };
      pick.appendChild(b);
    }
    body.appendChild(pick);
    const u = baseUnit; if (!u) return;
    const avg = Math.round(party.reduce((s, p) => s + p.level, 0) / party.length);
    body.appendChild(el('div', 'subhead', `闘技場——${u.name} で挑む。賭け金を積み、勝てば褒賞と熟練。倒れる前に行司が止める（命は獲られぬ）`));
    const foes = arenaOpponents(g.seed, g.chapterIndex, avg);
    for (const opp of foes) {
      const row = el('div', 'shoprow');
      row.appendChild(el('span', 'nm', `［${opp.tierName}］${opp.name}（${classDef(opp.classId).name} Lv${opp.level}）`));
      row.appendChild(el('span', 'pr', `賭${opp.wager}G→褒賞${opp.reward}G`));
      row.appendChild(mkbtn('挑む', 'buy', () => {
        g.gold -= opp.wager;
        const res = arenaFight(u, opp, g.seed, g.chapterIndex);
        if (res.win) { g.gold += res.reward; sfx('levelup'); }
        else sfx('cancel');
        autosave();
        renderBase('arena');
        const note = el('div', 'subhead', res.win
          ? `${u.name}、${opp.name}を下した！　賭${opp.wager}G→＋${res.reward}G（差引＋${res.reward - opp.wager}G）`
          : `${u.name}、${opp.name}に及ばず。賭${opp.wager}Gを失う（命は無事）`);
        body.insertBefore(note, body.children[1]);
      }, g.gold < opp.wager));
      body.appendChild(row);
    }
  } else if (tab === 'support') {
    body.appendChild(el('div', 'subhead', '支援——共に戦い、隣りあうほど絆は深まる（C→B→A）。段が上がると会話が読める'));
    const names = new Set(g.party.map(u => u.name));
    const pairs = ALL_SUPPORTS.filter(s => names.has(s.a) && names.has(s.b));
    if (!pairs.length) body.appendChild(el('div', 'shoprow', 'まだ語る間柄がない'));
    for (const s of pairs) {
      const pts = supportPoints(g, s.a, s.b);
      const rk = supportRank(g, s.a, s.b);
      const next = SUPPORT_THRESHOLDS[rk];
      const row = el('div', 'shoprow');
      row.appendChild(el('span', 'nm', `${s.a} ＆ ${s.b}`));
      row.appendChild(el('span', 'pr', rk > 0 ? `絆 ${rankLetter(pts)}` : (next ? `あと${next - pts}` : '—')));
      row.appendChild(mkbtn(rk > 0 ? '会話を読む' : '（C未満）', rk > 0 ? 'buy' : '', () => {
        $('base').hidden = true;
        playDialogue(s.lines).then(() => { $('base').hidden = false; renderBase('support'); });
      }, rk < 1));
      body.appendChild(row);
    }
  } else if (tab === 'trade') {
    const biome = (g.chapter && g.chapter.biome) || 'green';
    const bn = { green: '緑野', desert: '砂漠', snow: '雪原', ruins: '廃都', volcano: '火山' }[biome] || biome;
    body.appendChild(el('div', 'subhead', `いまの相場：${bn}　安く仕入れ、別の土地で高く売る`));
    const hold = holdings(g);
    for (const good of TRADE_GOODS) {
      const row = el('div', 'shoprow');
      const have = hold[good.id] || 0;
      row.appendChild(el('span', 'nm', good.name + (have ? `（所持${have}）` : '')));
      row.appendChild(el('span', 'pr', tradePrice(good.id, biome) + 'G'));
      row.appendChild(mkbtn('買', 'buy', () => { if (buyGood(g, good.id, biome)) { sfx('select'); autosave(); renderBase('trade'); } }, !canBuyGood(g, good.id, biome)));
      row.appendChild(mkbtn('売', '', () => { if (sellGood(g, good.id, biome)) { sfx('cancel'); autosave(); renderBase('trade'); } }, !have));
      body.appendChild(row);
    }
  } else if (tab === 'record') {
    body.appendChild(el('div', 'subhead', 'この符号を控えれば、どこでも続きから（自動保存もされます）'));
    const ta = el('textarea', 'codeta'); ta.readOnly = true; ta.value = encodeSave(g); body.appendChild(ta);
    body.appendChild(mkbtn('符号を写す', 'buy', async () => { try { await navigator.clipboard.writeText(ta.value); toast('符号を写しました'); } catch { ta.select(); } }));
    body.appendChild(el('div', 'subhead', '別の符号を読み込む'));
    const inp = el('textarea', 'codeta'); inp.placeholder = '符号を貼る'; body.appendChild(inp);
    body.appendChild(mkbtn('読み込む', '', () => { try { const ng = decodeSave(inp.value.trim()); S.game = ng; autosave(); toast('読み込みました'); openBase(); } catch { toast('符号を読めませんでした'); } }));
  }
}

/* ---------- ボタン ---------- */
$('startBtn').onclick = () => startGame(parseInt($('seedInput').value, 10) || 20260615);
$('codexBtn').onclick = openCodex;
$('codexClose').onclick = () => { $('codex').hidden = true; };
$('baseGo').onclick = () => { $('base').hidden = true; showIntro(); };
$('continueBtn').onclick = () => { try { S.game = decodeSave(localStorage.getItem(SAVE_KEY)); $('title').hidden = true; openBase(); } catch { toast('続きを読めませんでした'); } };
$('loadBtn').onclick = () => { const code = prompt('セーブ符号を貼ってください'); if (!code) return; try { S.game = decodeSave(code.trim()); $('title').hidden = true; openBase(); } catch { toast('符号を読めませんでした'); } };
$('randBtn').onclick = () => { $('seedInput').value = (Math.random() * 1e9) >>> 0; };
$('sortieBtn').onclick = sortie;
$('massBtn').onclick = massBattle;
$('skirmishBtn').onclick = startSkirmish;
$('resignBtn').onclick = () => {
  if (!S.battle || S.battle.over) return;
  if (!confirm('この戦いを投了して、章を初めからやり直しますか？（倒れた仲間も立ち上がります）')) return;
  S.busy = false; S.anim = null;
  S.battle.over = true; S.battle.victory = false; S.battle.reason = 'resign';
  hideMenu(); $('forecast').hidden = true; clearSel();
  checkResult();
};
$('endTurn').onclick = endTurn;
$('view3dBtn').onclick = () => { setView3d(!isView3d()); $('view3dBtn').classList.toggle('on', isView3d()); sfx('select'); };
$('pixelBtn').onclick = () => { setPixel(!isPixel()); $('pixelBtn').classList.toggle('on', isPixel()); sfx('select'); };
$('logBtn').onclick = () => { $('log').hidden = !$('log').hidden; if (!$('log').hidden) refreshLog(); };
$('logClose').onclick = () => { $('log').hidden = true; };
$('autoBtn').onclick = () => { S.auto = !S.auto; $('autoBtn').classList.toggle('on', S.auto); if (S.auto) { if (S.battle && S.battle.initiative) advanceInitiative(); else maybeAuto(); } };
$('fcGo').onclick = confirmAttack;
$('fcCancel').onclick = () => { $('forecast').hidden = true; S._aoeMode = false; S._arithMode = false; openMenu(); S.mode = 'menu'; S.atkTiles = null; };
$('infoClose').onclick = () => { $('info').hidden = true; };
$('nextBtn').onclick = () => {
  $('result').hidden = true;
  if (S.skirmish) { S.skirmish = null; S.board = null; S.mode = 'title'; $('hud').hidden = true; $('title').hidden = false; playMusic('title'); return; }
  openBase();
};
$('retryBtn').onclick = () => {
  $('result').hidden = true;
  if (S.skirmish) { startSkirmish(); return; }
  if (S._massLost) { S._massLost = false; showIntro(); } else sortie();
};
$('muteBtn').onclick = () => { const m = !isMuted(); setMuted(m); setMusicMuted(m); $('muteBtn').textContent = m ? '♪̸' : '♪'; if (!m) { sfx('select'); resumeMusic(); } };

/* 音は最初の操作で目覚める（ブラウザの制約）。タイトルでは表題曲を流す。 */
let audioWoke = false;
function wakeAudio() {
  if (audioWoke) return; audioWoke = true;
  if (!isMuted() && S.mode === 'title') playMusic('title');
}
function resumeMusic() {
  // ミュート解除や画面復帰のとき、いまの場面に合う曲へ
  if (S.mode === 'title') playMusic('title');
  else if (S.mode === 'play' || S.mode === 'idle' || S.mode === 'selected' || S.mode === 'menu' || S.mode === 'target') playMusic('battle_' + ((S.skirmish && S.skirmish.biome) || (S.game && S.game.chapter && S.game.chapter.biome) || (S.board && S.board.biome) || 'green'));
}
window.addEventListener('pointerdown', wakeAudio);

let toastTimer = null;
function toast(msg, ms = 1400) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, ms); }

/* ---------- 起動 ---------- */
$('seedInput').value = '20260615';
if (hasSave()) $('continueBtn').hidden = false;
fit();
requestAnimationFrame(loop);
