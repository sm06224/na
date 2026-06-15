/* ============================================================
   窟 — へそ。種から窟をひらき、鍵で潜る者を動かし、描く。
   手番が進むたび、視界と HUD と記録を描き直す。
   ============================================================ */

import { Game } from '../core/game.js';
import { hashSeed } from '../core/rng.js';
import { Renderer } from './render.js';
import { Screens } from './screens.js';
import { sfx, toggleSound } from './audio.js';
import * as A from '../core/actions.js';
import { CLASSES, classKeys } from '../core/classes.js';
import { getAbility } from '../core/abilities.js';
import { recordScore, scoresHTML } from './scores.js';
import { equipBonus } from '../core/inventory.js';
import { hungerWord } from '../core/player.js';
import { statusName } from '../core/status.js';
import { T } from '../core/tile.js';

const $ = id => document.getElementById(id);
const renderer = new Renderer($('map'));
const screens = new Screens($('overlay'));
let game = null;
let mode = 'play';          // play / target / examine / title / dead
let pending = null;         // 向き待ちの行動
let prev = null;            // 音の差分検出用
let cursor = null;          // 「調べる」のカーソル

// 「調べる」の表示札（動的に作る）
const exEl = document.createElement('div');
exEl.id = 'examine'; exEl.hidden = true; document.body.appendChild(exEl);

/* ----- 種 ----- */
function seedFromHash() {
  const m = String(location.hash || '').match(/[#&]s=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function setHash(seed) { history.replaceState(null, '', `${location.pathname}#s=${encodeURIComponent(seed)}`); }

let selectedClass = 'warrior';
function buildClassRow() {
  const row = $('classrow'); if (!row) return;
  row.innerHTML = '';
  for (const key of classKeys()) {
    const c = CLASSES[key];
    const b = document.createElement('button');
    b.className = 'clsbtn' + (key === selectedClass ? ' on' : '');
    b.innerHTML = `<b>${c.name}</b><span>${c.desc}</span>`;
    b.addEventListener('click', () => { selectedClass = key; buildClassRow(); });
    row.appendChild(b);
  }
}

function start(seed) {
  game = new Game(seed, { cls: selectedClass });
  setHash(game.seedRaw);
  mode = 'play';
  cursor = null; exEl.hidden = true;
  screens.hide();
  $('title').hidden = true;
  renderer.fit();
  prev = snap();
  redraw();
}

function snap() {
  const p = game.player;
  return { hp: p.hp, kills: p.kills, depth: game.depth, gold: p.gold, level: p.level,
    inv: p.inv.reduce((s, i) => s + i.count, 0), state: game.state };
}

/* 状態の差分から、ふさわしい音を鳴らす */
function sounds() {
  if (!prev) { prev = snap(); return; }
  const p = game.player, n = snap();
  if (n.state !== 'play' && prev.state === 'play') sfx(n.state === 'won' ? 'win' : 'death');
  else if (n.state === 'play') {
    if (n.depth !== prev.depth) sfx('descend');
    if (n.level > prev.level) sfx('level');
    else if (n.kills > prev.kills) sfx('kill');
    else if (n.hp < prev.hp) sfx('hurt');
    else if (n.gold > prev.gold || n.inv > prev.inv) sfx('pickup');
  }
  prev = n;
}

/* ----- 描画一式 ----- */
function redraw() {
  renderer.cursor = (mode === 'examine') ? cursor : null;
  renderer.draw(game);
  drawHUD();
  drawLog();
  sounds();
  if (mode === 'examine' && cursor) { exEl.hidden = false; exEl.textContent = game.describe(cursor.x, cursor.y); }
  else exEl.hidden = true;
  if ((game.state === 'dead' || game.state === 'won') && mode !== 'dead') {
    mode = 'dead';
    try { recordScore(game); } catch (e) { /* localStorage 不可なら諦める */ }
    setTimeout(() => screens.death(game), 400);
  }
}

function drawHUD() {
  const p = game.player;
  const hpFrac = Math.max(0, p.hp / p.maxhp);
  const hcol = hpFrac < 0.34 ? '#e0563c' : hpFrac < 0.67 ? '#e0b23c' : '#56d6a0';
  const sts = p.statuses.map(s => `<span class="st">${statusName(s.type)}</span>`).join('');
  $('hud').innerHTML = `
    <div class="hrow"><b>${esc(p.name)}</b> <span class="lvl">Lv${p.level}</span></div>
    <div class="bar"><div class="barfill" style="width:${hpFrac * 100}%;background:${hol(hcol)}"></div><span class="barlabel">HP ${p.hp}/${p.maxhp}</span></div>
    <div class="hrow small">力${p.stats.str}　防${effDef()}　命${p.stats.acc}　回${p.stats.eva}</div>
    <div class="hrow small">気力 ${p.focus ?? 0}/${p.maxFocus ?? 0}　<span class="clsname">${esc(p.clsName || '')}</span></div>
    <div class="hrow small">深さ <b>${game.depth}</b>　手 ${p.turns}　金 ${p.gold}</div>
    <div class="hrow small">撃破 ${p.kills}　${hungerTag()}</div>
    <div class="hrow sts">${sts}</div>`;
  $('depthtag').textContent = `第 ${game.depth} 階`;
}
function effDef() { return game.player.stats.def + (equipBonus(game.player).def || 0); }
function hol(c) { return c; }
function hungerTag() { const w = hungerWord(game.player); return w ? `<span class="st bad">${w}</span>` : ''; }

function drawLog() {
  const recent = game.messages.recent(7);
  $('log').innerHTML = recent.map(l => `<div class="logline ${l.kind || ''}">${esc(l.text)}${l.count > 1 ? ` ×${l.count}` : ''}</div>`).join('');
}

/* ----- 鍵 ----- */
const MOVES = {
  ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  l: [1, 0], h: [-1, 0], k: [0, -1], j: [0, 1], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
  '6': [1, 0], '4': [-1, 0], '8': [0, -1], '2': [0, 1], '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1],
};
const DIRKEYS = { ...MOVES };

window.addEventListener('keydown', e => {
  if (mode === 'title') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(($('seedin').value || randomSeed())); } return; }

  if (screens.open) {
    if (e.key === 'Escape') { screens.hide(); if (mode === 'target') mode = 'play'; return; }
    if (mode === 'dead' && (e.key === 'Enter' || e.key.toLowerCase() === 'r')) { newRun(); return; }
    if (screens.mode === 'pick' && /^[a-z]$/.test(e.key)) { e.preventDefault(); screens.pick(e.key); return; }
    return;
  }
  if (mode === 'dead') { if (e.key === 'Enter' || e.key.toLowerCase() === 'r') newRun(); return; }

  if (mode === 'target') {
    const d = DIRKEYS[e.key];
    if (d) { e.preventDefault(); const act = pending; pending = null; mode = 'play'; act(d[0], d[1]); }
    else if (e.key === 'Escape') { pending = null; mode = 'play'; game.message('やめた。'); redraw(); }
    return;
  }

  if (mode === 'examine') {
    const d = MOVES[e.key];
    if (d) { e.preventDefault(); cursor = clampCursor(cursor.x + d[0], cursor.y + d[1]); redraw(); }
    else if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'x') { mode = 'play'; cursor = null; redraw(); }
    return;
  }

  if (game.state !== 'play') return;
  const k = e.key;
  if (MOVES[k]) { e.preventDefault(); A.move(game, MOVES[k][0], MOVES[k][1]); return redraw(); }

  switch (k) {
    case '.': case '5': A.wait(game); return redraw();
    case 'g': case ',': A.pickup(game); return redraw();
    case 'p': A.buy(game); return redraw();
    case '>': A.descend(game); return redraw();
    case '<': A.ascend(game); return redraw();
    case 's': A.search(game); return redraw();
    case 'R': A.rest(game); return redraw();
    case 'D': A.disarm(game); return redraw();
    case 'i': screens.inventory(game); return;
    case 'e': screens.equipment(game); return;
    case '@': case 'C': screens.character(game); return;
    case 'L': screens.bestiary(game); return;
    case 'x': mode = 'examine'; cursor = { x: game.player.x, y: game.player.y }; return redraw();
    case 'a': return chooseAbility();
    case 'M': { const v = toggleSound(); game.message(v ? '音を出す。' : '音を消した。'); return redraw(); }
    case '?': screens.help(); return;
    case 'q': return chooseAndAct('薬を飲む', it => it.category === 'potion', it => { A.drink(game, it); sfx('quaff'); redraw(); });
    case 'r': return chooseAndAct('巻物を読む', it => it.category === 'scroll', it => { A.read(game, it); redraw(); });
    case 'f': return chooseAndAct('食べる', it => it.category === 'food', it => { A.eat(game, it); redraw(); });
    case 'w': case 'W': return chooseAndAct('装備する', it => ['weapon', 'armor', 'ring'].includes(it.category), it => { A.equip(game, it); redraw(); });
    case 'd': return chooseAndAct('置く', () => true, it => { A.drop(game, it); redraw(); });
    case 'z': return chooseAndAct('杖を振る', it => it.category === 'wand', it => aimThen((dx, dy) => { sfx('zap'); A.zap(game, it, dx, dy); redraw(); }));
    case 't': return chooseAndAct('投げる', () => true, it => aimThen((dx, dy) => { A.throwItem(game, it, dx, dy); redraw(); }));
    case 'S': save(); game.message('保存した。'); return redraw();
  }
});

function clampCursor(x, y) {
  const lv = game.level, p = game.player, R = 10;
  x = Math.max(0, Math.min(lv.w - 1, Math.max(p.x - R, Math.min(p.x + R, x))));
  y = Math.max(0, Math.min(lv.h - 1, Math.max(p.y - R, Math.min(p.y + R, y))));
  return { x, y };
}

function chooseAndAct(title, filter, onPick) { screens.chooseItem(game, title, filter, onPick); }
function chooseAbility() {
  const keys = game.player.abilities || [];
  if (!keys.length) { game.message('使える技がない。'); return redraw(); }
  screens.chooseAbility(game, keys, key => {
    const ab = getAbility(key);
    if (ab.targeted) aimThen((dx, dy) => { A.useAbility(game, key, dx, dy); redraw(); });
    else { A.useAbility(game, key); redraw(); }
  });
}
function aimThen(act) { mode = 'target'; pending = act; game.message('向きは？（移動キー / Escでやめる）'); redraw(); }

/* ----- 保存・新規 ----- */
const SAVEKEY = 'kutsu.save';
function save() { try { localStorage.setItem(SAVEKEY, JSON.stringify(game.serialize())); } catch (e) {} }
function newRun() { mode = 'title'; $('title').hidden = false; screens.hide(); $('seedin').value = ''; refreshScores(); $('seedin').focus(); }
function refreshScores() { const el = $('scores'); if (el) el.innerHTML = scoresHTML(); }
function randomSeed() { return String(Math.floor(Math.random() * 1e9)); }

/* ----- 起動 ----- */
$('btnStart').addEventListener('click', () => start(($('seedin').value || randomSeed())));
$('btnRandom').addEventListener('click', () => start(randomSeed()));
window.addEventListener('resize', () => { if (game) { renderer.fit(); redraw(); } });

// 触る端末向け：簡単な十字ボタン
for (const el of document.querySelectorAll('[data-move]')) {
  el.addEventListener('click', () => {
    if (!game || game.state !== 'play' || screens.open || mode !== 'play') return;
    const [dx, dy] = el.dataset.move.split(',').map(Number);
    A.move(game, dx, dy); redraw();
  });
}
$('btnDescend').addEventListener('click', () => { if (game && mode === 'play') { A.descend(game); redraw(); } });
$('btnPick').addEventListener('click', () => { if (game && mode === 'play') { A.pickup(game); redraw(); } });
$('btnInv').addEventListener('click', () => { if (game && mode === 'play') screens.inventory(game); });
$('btnWait').addEventListener('click', () => { if (game && mode === 'play') { A.wait(game); redraw(); } });

buildClassRow();
refreshScores();
const hashSeedVal = seedFromHash();
if (hashSeedVal != null) start(hashSeedVal);
else { mode = 'title'; $('seedin').focus?.(); }

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
