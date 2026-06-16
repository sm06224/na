/* ============================================================
   陣 — ドット絵の駒。なめらかな図形ではなく、粒（ピクセル）で人を描く。
   16×16 の論理格子に、職と陣営から決定的に色を置き、タイル大に拡大して刻む。
   画像ファイルなし・依存ゼロ。render の drawToken から「ドット」表示で呼ばれる。
   ============================================================ */

import { classDef } from '../core/classes.js';
import { equippedWeapon } from '../core/unit.js';
import { roundRect } from './sprites.js';

const G = 16;   // 論理格子（16×16）

const SIDE = {
  player: { body: '#5b74d6', edge: '#39499c', trim: '#cfe0ff' },
  ally:   { body: '#3aa06a', edge: '#287a4e', trim: '#d2ffe6' },
  enemy:  { body: '#c0463e', edge: '#8f2f2a', trim: '#ffd2c2' },
};
const SKIN = '#e9c39c', SKIN_UNDEAD = '#bcd0c0', SKIN_FIEND = '#9a8aa0';
const HAIR = '#4a3a2a', HAIR_FOE = '#3a2630';
const METAL = '#9aa6bd', METAL_D = '#6c7689', DARK = '#272c3a', GOLD = '#ffd86a';

function archetype(u) {
  if (u.mode === 'mage') return 'mage';
  if (u.mode === 'armor') return 'armor';
  if (u.mode === 'fly') return 'fly';
  if (u.mode === 'ride') return 'ride';
  return 'foot';
}
function isHealer(id) { return id === 'cleric' || id === 'monk' || id === 'bishop' || id === 'valkyrie' || id === 'priest'; }
function skinOf(u) {
  if (u.classId === 'revenant' || u.classId === 'wightlord' || u.classId === 'bonewalker') return SKIN_UNDEAD;
  if (u.classId === 'gargoyle' || u.classId === 'mogall' || u.classId === 'firedrake' || u.classId === 'gorgon') return SKIN_FIEND;
  return SKIN;
}

/* 格子へ色を置く小道具（範囲外は捨てる）。 */
function plot(grid, x, y, c) { if (x >= 0 && x < G && y >= 0 && y < G && c) grid[y][x] = c; }
function rect(grid, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) plot(grid, x, y, c); }

/* ユニットから 16×16 の色格子を組む（決定的）。 */
function buildGrid(u) {
  const pal = SIDE[u.side] || SIDE.enemy;
  const arch = archetype(u);
  const grid = Array.from({ length: G }, () => Array(G).fill(null));
  const cd = classDef(u.classId);
  const dragon = cd && cd.tags && cd.tags.includes('dragon');
  const skin = skinOf(u);

  // 乗騎（馬）を体の下に
  if (arch === 'ride') {
    const hc = dragon ? '#7a9a55' : '#8a6a44', hd = dragon ? '#5f7a40' : '#6b5034';
    rect(grid, 3, 11, 10, 3, hc);          // 胴
    rect(grid, 3, 10, 2, 2, hc);           // 首
    rect(grid, 2, 9, 2, 2, hc);            // 頭
    rect(grid, 4, 14, 2, 2, hd); rect(grid, 10, 14, 2, 2, hd);   // 脚
    plot(grid, 12, 11, hc); plot(grid, 12, 12, hd);              // 尾
  }
  // 翼（飛行）を背後に
  if (arch === 'fly') {
    const wc = dragon ? '#86b25a' : '#eef3ff';
    rect(grid, 1, 5, 3, 2, wc); rect(grid, 0, 6, 2, 3, wc);
    rect(grid, 12, 5, 3, 2, wc); rect(grid, 14, 6, 2, 3, wc);
  }

  const top = arch === 'ride' ? 1 : 4;     // 騎乗は上に乗る
  // 脚（騎乗以外）
  if (arch !== 'ride') { rect(grid, 6, 13, 2, 3, DARK); rect(grid, 9, 13, 2, 3, DARK); }
  // 胴
  rect(grid, 5, top + 5, 6, 5, pal.body);
  rect(grid, 5, top + 5, 6, 1, pal.edge);          // 肩の陰
  rect(grid, 7, top + 6, 2, 1, pal.trim);          // 胸の紋
  // 腕
  rect(grid, 4, top + 5, 1, 4, pal.edge);
  rect(grid, 11, top + 5, 1, 4, pal.edge);
  // 頭
  rect(grid, 6, top + 1, 4, 4, skin);

  // 被りもの
  if (arch === 'armor') {                          // 兜＋面頬
    rect(grid, 6, top, 4, 2, METAL); rect(grid, 5, top + 1, 6, 1, METAL);
    rect(grid, 6, top + 2, 4, 1, DARK);            // 面頬
    plot(grid, 7, top - 1, pal.trim); plot(grid, 8, top - 1, pal.trim);   // 前立て
  } else if (arch === 'mage') {                    // とんがり帽子
    rect(grid, 6, top, 4, 1, pal.body);
    rect(grid, 7, top - 1, 2, 1, pal.body);
    plot(grid, 8, top - 2, pal.body); plot(grid, 8, top - 3, pal.trim);
  } else if (isHealer(u.classId)) {                // 頭巾
    rect(grid, 5, top, 6, 2, pal.trim); rect(grid, 6, top + 1, 4, 1, skin);
  } else {                                         // 髪
    rect(grid, 6, top, 4, 1, u.side === 'enemy' ? HAIR_FOE : HAIR);
    plot(grid, 6, top + 1, u.side === 'enemy' ? HAIR_FOE : HAIR);
    plot(grid, 9, top + 1, u.side === 'enemy' ? HAIR_FOE : HAIR);
  }
  // 目
  plot(grid, 7, top + 2, DARK); plot(grid, 9, top + 2, DARK);
  // 飛行の光輪／主君の冠
  if (arch === 'fly') { plot(grid, 6, top - 1, GOLD); plot(grid, 9, top - 1, GOLD); }
  if (u.isLord) { rect(grid, 6, top - 1, 4, 1, GOLD); plot(grid, 7, top - 2, GOLD); plot(grid, 9, top - 2, GOLD); }

  // 得物（右手側）
  const wt = (equippedWeapon(u) || {}).wtype;
  drawWeaponPx(grid, wt, top);

  return grid;
}

function drawWeaponPx(grid, wt, top) {
  const wx = 12;     // 右手の外
  if (wt === 'sword' || wt === 'dagger') { rect(grid, wx, top + 2, 1, 6, METAL); plot(grid, wx, top + 8, GOLD); }
  else if (wt === 'lance') { rect(grid, wx, top, 1, 11, METAL); plot(grid, wx, top - 1, '#dfe6f2'); }
  else if (wt === 'axe') { rect(grid, wx, top + 4, 1, 5, '#6b5034'); rect(grid, wx + 1, top + 3, 2, 3, METAL); }
  else if (wt === 'bow') { rect(grid, wx + 1, top + 2, 1, 7, '#8a6a44'); plot(grid, wx, top + 3, '#8a6a44'); plot(grid, wx, top + 7, '#8a6a44'); }
  else if (wt === 'anima' || wt === 'light' || wt === 'dark') {
    const c = wt === 'light' ? '#ffe08a' : wt === 'dark' ? '#9a6acc' : '#e8624a';
    rect(grid, wx, top + 4, 2, 3, c);              // 魔導書
  } else if (wt === 'staff') { rect(grid, wx, top + 1, 1, 8, '#cdb37a'); plot(grid, wx, top, '#8ad0ff'); }
}

/* ドット絵の駒を描く。drawToken と同じ引数。HP バーも添える。 */
export function drawTokenPixel(ctx, u, cx, cy, size, opts = {}) {
  const grid = buildGrid(u);
  const px = Math.max(1, Math.round(size / G));    // 1論理ピクセルの実寸（整数で刻む）
  const ox = Math.round(cx - (G * px) / 2);
  const oy = Math.round(cy - (G * px) * 0.58);
  ctx.save();
  if (opts.acted) ctx.globalAlpha = 0.5;
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(cx, oy + G * px * 0.96, size * 0.34, size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // 粒を刻む
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const c = grid[y][x];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(ox + x * px, oy + y * px, px, px);
  }
  // 主君・ボスの縁取り
  if (u.boss) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, px * 0.5);
    ctx.strokeRect(ox + 4 * px, oy + px, 8 * px, 14 * px);
  }
  ctx.restore();

  // HP バー（なめらか版と同じ体裁）
  if (opts.hp !== false) {
    const r = size * 0.4;
    const bw = r * 1.9, bh = Math.max(3, size * 0.085), by2 = cy + r * 0.72;
    const frac = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; roundRect(ctx, cx - bw / 2, by2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#6fd98a' : frac > 0.25 ? '#e8c44a' : '#e8624a';
    roundRect(ctx, cx - bw / 2, by2, bw * frac, bh, bh / 2); ctx.fill();
  }
}
