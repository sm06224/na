/* 陣のへそ — タイトル→章の幕間→戦い→結果。タッチで指揮する。 */

import { Game } from '../core/game.js';
import { isAlive, equippedWeapon, effectiveStats } from '../core/unit.js';
import { classDef } from '../core/classes.js';
import { item as itemDef } from '../core/items.js';
import { STAT_KEYS, STAT_NAMES } from '../core/stats.js';
import { forecast, inAttackRange } from '../core/combat.js';
import { manhattan, key } from '../core/grid.js';
import { Camera, draw, BASE_TILE } from './render.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { chapterScript, SUPPORTS } from '../core/script.js';
import { BESTIARY, WORLD, WEAPON_NOTES, TERRAIN_NOTES } from '../core/lore.js';
import { WTYPE } from '../core/items.js';
import { playMusic, stopMusic, setMusicMuted } from './music.js';
import { FX } from './fx.js';
import { shopStock, buy, canBuy, sellFromConvoy, sellPrice } from '../core/shop.js';
import { giveItem, takeItem, equipItem, equipAccessory, useBooster, canPromote, promotionOptions, doPromote, MAX_ITEMS } from '../core/party.js';
import { encodeSave, decodeSave } from '../core/save.js';
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
  fx: new FX(), lastNow: 0,
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
    const i = Math.min(S.anim.path.length - 2, Math.floor(seg));
    const f = seg - i;
    const a = S.anim.path[i], b = S.anim.path[i + 1] || a;
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
}

/* ---------- ゲーム開始 ---------- */
function startGame(seed) {
  S.game = new Game(seed >>> 0, { setpiece: $('setpieceChk').checked });
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
  $('introText').textContent = ch.intro;
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
  refreshHud();
}
function refreshHud() {
  const b = S.battle;
  $('turnInfo').textContent = `第${S.game.chapterIndex + 1}章　${b.phase === 'player' ? '自軍' : '敵軍'}　ターン${b.turn}`;
  const o = b.objective;
  const objText = o.type === 'rout' ? '目標：敵の殲滅' : o.type === 'seize' ? '目標：玉座の制圧' : o.type === 'defeat_boss' ? '目標：敵将の撃破' : o.type === 'survive' ? `目標：${o.turns}ターン生存` : '目標：制圧';
  $('objInfo').textContent = objText + `　味方${b.board.unitsOf('player').length}／敵${b.board.unitsOf('enemy').length}`;
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
  if (path.length > 1) { sfx('move'); await animateMove(u, path); }
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
  if (targets.length) add('攻撃', () => beginTarget(targets), 'primary');
  if (staffT.length) add('杖', () => beginStaff(staffT), 'primary');
  if (consum.length) add('道具', () => openItems(consum));
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
    `<div class="fcrow"><b>${u.name}</b> → <b>${def.name}</b>（${dd.name} Lv${def.level}）</div>
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
async function confirmAttack() {
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
  // 自軍が全員行動済みなら、ターン終了をうながす
}

/* ---------- 演出（戦闘イベント） ---------- */
function popup(pos, text, color, big) { S.popups.push({ x: pos.x, y: pos.y, text, color, big, t: performance.now() }); }
function uOf(uid) { return S.board.units.find(u => u.uid === uid); }

async function playEvents(events) {
  for (const e of events) {
    const tgt = e.tgt != null ? uOf(e.tgt) : (e.uid != null ? uOf(e.uid) : null);
    const by = e.by != null ? uOf(e.by) : null;
    if (e.type === 'miss') { if (by && tgt) attackFx(by, tgt, false); if (tgt && tgt.pos) popup(tgt.pos, 'MISS', '#cfd6e6'); sfx('miss'); await sleep(340); }
    else if (e.type === 'hit') { if (by && tgt) attackFx(by, tgt, false); if (tgt && tgt.pos) { popup(tgt.pos, String(e.dmg), '#ffd0c0'); flashHit(tgt); S.fx.spark(tgt.pos.x, tgt.pos.y, '#ffd0a0', 8); } sfx('hit'); await sleep(420); }
    else if (e.type === 'crit') { if (by && tgt) attackFx(by, tgt, true); if (tgt && tgt.pos) { popup(tgt.pos, String(e.dmg) + '!', '#ffd86a', true); flashHit(tgt); S.fx.spark(tgt.pos.x, tgt.pos.y, '#ffd86a', 16, 4.5); S.fx.addShake(9); } sfx('crit'); await sleep(560); }
    else if (e.type === 'skill') { if (by && by.pos) popup(by.pos, skillName(e.id), '#b79bff'); await sleep(260); }
    else if (e.type === 'drain') { if (by && by.pos) { popup(by.pos, '+' + e.amount, '#9cf0c0'); S.fx.heal(by.pos.x, by.pos.y); } await sleep(220); }
    else if (e.type === 'heal') { if (tgt && tgt.pos) { popup(tgt.pos, '+' + e.amount, '#9cf0c0'); S.fx.heal(tgt.pos.x, tgt.pos.y); } await sleep(220); }
    else if (e.type === 'poison' || e.type === 'burn') { if (tgt && tgt.pos) popup(tgt.pos, String(e.dmg), '#b6e07c'); await sleep(220); }
    else if (e.type === 'restore' || e.type === 'buff' || e.type === 'debuff') { await sleep(120); }
    // 死亡
    if (tgt && !isAlive(tgt)) { if (tgt.pos) popup(tgt.pos, '×', '#ff6a5a', true); sfx('die'); }
  }
  // 倒れた者を盤から
  for (const u of S.board.units) if (!isAlive(u) && u.pos) { S.board.remove(u); u.pos = null; }
}
function flashHit(u) { S.anim = { type: 'hit', uid: u.uid, until: performance.now() + 260 }; setTimeout(() => { if (S.anim && S.anim.type === 'hit') S.anim = null; }, 280); }
function attackFx(by, tgt, crit) {
  if (!by.pos || !tgt.pos) return;
  const w = equippedWeapon(by);
  const dist = manhattan(by.pos, tgt.pos);
  if (w && w.magic) S.fx.shoot(by.pos, tgt.pos, { kind: 'bolt', color: '#c9b3ff', dur: 0.18, onArrive: () => S.fx.burst(tgt.pos.x, tgt.pos.y, '#b79bff') });
  else if (dist > 1) S.fx.shoot(by.pos, tgt.pos, { kind: 'arrow', dur: 0.16 });
  else S.fx.slash(by.pos, tgt.pos, crit ? '#ffd86a' : '#ffffff');
}
function skillName(id) { const m = { sol: '太陽', luna: '月光', astra: '流星', pierce: '貫通', colossus: '剛撃', lethality: '瞬殺！', aether: '天空', aegis: '盾防', pavise: '大盾', miracle: '祈り' }; return m[id] || id; }

async function showLevelUps(u, ups) {
  for (const up of ups) {
    sfx('levelup');
    const gains = STAT_KEYS.filter(k => up.gain[k]).map(k => `${STAT_NAMES[k]}+${up.gain[k]}`).join(' ') || '（変化なし）';
    if (u.pos) popup(u.pos, 'Lv' + up.level + '!', '#ffe08a', true);
    toast(`${u.name} レベルアップ！ ${gains}`, 1800);
    await sleep(1100);
  }
}

/* ---------- ターン終了・敵フェイズ ---------- */
async function endTurn() {
  if (S.busy || S.mode === 'animating') return;
  clearSel(); S.mode = 'animating'; S.busy = true;
  const turns = S.battle.endPlayerPhase();
  for (const rec of turns) {
    const u = uOf(rec.uid);
    if (!u) continue;
    S.cursor = rec.path ? rec.path[rec.path.length - 1] : rec.from;
    if (rec.path && rec.path.length > 1) { sfx('move'); await animateMoveAlong(u, rec.path); await sleep(60); }
    if (rec.events && rec.events.length) await playEvents(rec.events);
    checkResultSilent();
    if (S.battle.over) break;
    await sleep(80);
  }
  S.cursor = null;
  S.busy = false; S.mode = 'idle';
  refreshHud();
  checkResult();
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
  const ch = S.game.chapter;
  if (win) await playDialogue(chapterScript(S.game.chapterIndex).win);
  $('resultTitle').textContent = win ? '勝利' : '敗北';
  if (win) {
    const r = S.game.onVictory();
    autosave();
    $('resultText').textContent = `${ch.outro}\n（報酬 ${r.reward}G／所持 ${r.gold}G）`;
    $('nextBtn').textContent = S.game.done ? 'おわりへ' : '拠点へ';
    $('nextBtn').style.display = '';
    $('retryBtn').style.display = 'none';
  } else {
    const reason = S.battle.reason === 'lord' ? `${S.game.party[0].name}が倒れた——戦記はここで途絶えた。` : '全軍が潰えた。';
    $('resultText').textContent = reason;
    $('nextBtn').style.display = 'none';
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
  if (S.mode === 'staff') {
    const t = (S._staffTargets || []).find(t => t.pos.x === tile.x && t.pos.y === tile.y);
    if (t) doStaffOn(t); else { S.staffTiles = null; openMenu(); S.mode = 'menu'; }
    return;
  }
  if (S.mode === 'selected') {
    // 移動先 or 別ユニット選択 or 取消
    const inMove = S.moveTiles && S.moveTiles.some(m => m.x === tile.x && m.y === tile.y);
    if (u && u.side === 'player' && u !== S.selected && !u.hasActed) { selectUnit(u); return; }
    if (inMove || (u === S.selected)) { moveSelectedTo(tile); return; }
    clearSel(); S.mode = 'idle'; sfx('cancel'); return;
  }
  // idle
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
  const sk = (u.skills || []).map(s => s).join(' ');
  $('infoBody').innerHTML =
    `<h3>${u.name} <small>${cd.name} Lv${u.level}</small></h3>
     <div class="hpline">HP ${u.hp}/${u.maxHp}　移動${u.mov}</div>
     <div class="statgrid">${statline}</div>
     <div class="itemline">得物：${w ? w.name : '—'}</div>
     <div class="itemline">持物：${items || '—'}</div>
     ${u.bio ? `<p class="bio">${u.bio}</p>` : ''}`;
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
  else if (tab === 'support') for (const s of SUPPORTS) {
    const d = document.createElement('div'); d.className = 'entry';
    const lines = s.lines.map(l => `<span class="who">${l.who}</span>「${l.line}」`).join('<br>');
    d.innerHTML = `<h4>${s.a} & ${s.b}</h4><p class="conv">${lines}</p>`;
    body.appendChild(d);
  }
  body.scrollTop = 0;
}

/* ---------- 拠点（章と章のあいだ） ---------- */
function autosave() { try { localStorage.setItem(SAVE_KEY, encodeSave(S.game)); } catch { /* あふれは無視 */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
let baseUnit = null;
const BASE_TABS = [['店', 'shop'], ['編成', 'party'], ['記録', 'record']];

function openBase() {
  $('result').hidden = true;
  if (!S.game || S.game.done) { showIntro(); return; }
  S.mode = 'base';
  playMusic('prologue');
  $('baseTitle').textContent = `拠点 — 次は「${S.game.chapter.title}」`;
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
    body.appendChild(el('div', 'subhead', '持ち物（装備・荷駄へ）'));
    u.items.forEach((st, i) => {
      const it = itemDef2(st.id); const row = el('div', 'shoprow');
      const eq = (i === u.equipped) ? '◆' : '';
      row.appendChild(el('span', 'nm', eq + (it ? it.name : st.id) + (st.uses ? `×${st.uses}` : '')));
      if (it && it.kind === 'weapon') row.appendChild(mkbtn('装備', '', () => { if (equipItem(u, i)) { sfx('select'); renderBase('party'); } }));
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
$('endTurn').onclick = endTurn;
$('fcGo').onclick = confirmAttack;
$('fcCancel').onclick = () => { $('forecast').hidden = true; openMenu(); S.mode = 'menu'; S.atkTiles = null; };
$('infoClose').onclick = () => { $('info').hidden = true; };
$('nextBtn').onclick = () => { $('result').hidden = true; openBase(); };
$('retryBtn').onclick = () => { $('result').hidden = true; sortie(); };
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
  else if (S.mode === 'play' || S.mode === 'idle' || S.mode === 'selected' || S.mode === 'menu' || S.mode === 'target') playMusic('battle_' + ((S.game && S.game.chapter && S.game.chapter.biome) || 'green'));
}
window.addEventListener('pointerdown', wakeAudio);

let toastTimer = null;
function toast(msg, ms = 1400) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, ms); }

/* ---------- 起動 ---------- */
$('seedInput').value = '20260615';
if (hasSave()) $('continueBtn').hidden = false;
fit();
requestAnimationFrame(loop);
