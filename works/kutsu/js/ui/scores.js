/* ============================================================
   窟 — 記録。過ぎた潜行（死と生還）を端末に書き留め、表紙に並べる。
   種も残るので、同じ窟へ何度でも挑める。
   ============================================================ */

const KEY = 'kutsu.scores';

export function loadScores() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function recordScore(game) {
  const p = game.player;
  const s = {
    seed: String(game.seedRaw), depth: game.depth, deepest: p.depthMax,
    level: p.level, kills: p.kills, gold: p.gold, turns: p.turns,
    cls: p.clsName || '', won: game.state === 'won', cause: game.cause, at: Date.now(),
  };
  const list = loadScores();
  list.unshift(s);
  while (list.length > 20) list.pop();
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 容量超過は黙って諦める */ }
  return s;
}

export function bestDepth() {
  return loadScores().reduce((b, s) => Math.max(b, s.deepest || 0), 0);
}

export function scoresHTML() {
  const list = loadScores();
  if (!list.length) return '';
  const rows = list.slice(0, 8).map(s => {
    const mark = s.won ? '☀' : '☖';
    return `<div class="scrow"><span class="sm">${mark}</span><span class="sc">${esc(s.cls)}</span>
      <span class="sd">第${s.deepest}階</span><span class="sk">${s.kills}体</span>
      <span class="ss">#${esc(s.seed)}</span></div>`;
  }).join('');
  return `<div class="scores"><div class="scap">過ぎた潜行（最深 ${bestDepth()} 階）</div>${rows}</div>`;
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
