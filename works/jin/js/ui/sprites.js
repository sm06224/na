/* 陣 — 駒と地形の見た目。画像ファイルなし、すべてその場で描く。
   駒は「文字」ではなく、ちいさな人の図。職で被りもの・得物・乗騎が変わる。 */

import { classDef } from '../core/classes.js';
import { equippedWeapon } from '../core/unit.js';

const GLYPH = {
  lord: '主', greatlord: '公', soldier: '兵', mercenary: '剣', fighter: '戦', archer: '弓',
  cavalier: '騎', knight: '盾', pegasus: '翔', wyvern: '竜', mage: '魔', monk: '光',
  shaman: '闇', cleric: '癒', thief: '盗', halberdier: '槍', sentinel: '衛', hero: '勇',
  swordmaster: '聖', warrior: '将', berserker: '狂', sniper: '狙', ranger: '遊', paladin: '聖',
  greatknight: '将', general: '将', falcon: '翔', wyvernlord: '竜', griffon: '鷲', sage: '賢',
  mortalsavant: '魔', bishop: '司', druid: '司', sorcerer: '導', valkyrie: '聖', assassin: '殺',
  rogue: '盗', brigand: '賊', revenant: '屍', gargoyle: '魔', mogall: '眼', commander: '隊',
};
export function glyphOf(id) { return GLYPH[id] || '兵'; }

const SIDE = {
  player: { body: '#3f6bd8', edge: '#9cc0ff', trim: '#dfe9ff' },
  enemy: { body: '#c0463e', edge: '#ff9c92', trim: '#ffe2dd' },
  ally: { body: '#3aa06a', edge: '#9cf0c0', trim: '#e6fff0' },
};
const BOW_W = { bow: 1 };

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wing(ctx, x, y, dir, r) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dir * r * 1.1, y - r * 0.8, x + dir * r * 1.3, y + r * 0.05);
  ctx.quadraticCurveTo(x + dir * r * 0.95, y + r * 0.25, x, y + r * 0.4);
  ctx.closePath(); ctx.fill();
}
function shapeOf(u) {
  if (u.mode === 'mage') return 'mage';
  if (u.mode === 'armor') return 'armor';
  if (u.mode === 'fly') return 'fly';
  if (u.mode === 'ride') return 'ride';
  return 'foot';
}

function drawMount(ctx, cx, cy, r, pal, dragon) {
  ctx.fillStyle = dragon ? '#5a6b3a' : '#5a4636';
  roundRect(ctx, cx - r * 1.05, cy + r * 0.1, r * 2.1, r * 0.78, r * 0.34); ctx.fill();
  // 脚
  ctx.fillStyle = dragon ? '#46532e' : '#3a2c22';
  ctx.fillRect(cx - r * 0.95, cy + r * 0.78, r * 0.22, r * 0.5);
  ctx.fillRect(cx + r * 0.72, cy + r * 0.78, r * 0.22, r * 0.5);
  // 首/頭
  ctx.beginPath(); ctx.moveTo(cx + r * 0.8, cy + r * 0.3);
  ctx.quadraticCurveTo(cx + r * 1.3, cy + r * 0.05, cx + r * 1.35, cy - r * 0.3);
  ctx.lineTo(cx + r * 1.1, cy - r * 0.25); ctx.quadraticCurveTo(cx + r * 1.0, cy + r * 0.1, cx + r * 0.7, cy + r * 0.35);
  ctx.closePath(); ctx.fill();
}
function drawHeadgear(ctx, u, shape, hx, hy, hr, pal) {
  ctx.lineWidth = 1.5;
  if (shape === 'mage') {                       // とんがり帽子
    ctx.fillStyle = pal.body; ctx.strokeStyle = pal.edge;
    ctx.beginPath(); ctx.moveTo(hx - hr * 1.05, hy - hr * 0.2); ctx.lineTo(hx + hr * 1.05, hy - hr * 0.2);
    ctx.lineTo(hx + hr * 0.15, hy - hr * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.arc(hx + hr * 0.15, hy - hr * 2.0, hr * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (shape === 'armor') {               // 兜＋面頬
    ctx.fillStyle = '#9aa6bd'; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.08, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(hx - hr * 0.9, hy - hr * 0.1, hr * 1.8, hr * 0.5);
    ctx.fillStyle = pal.body; ctx.fillRect(hx - hr * 0.1, hy - hr * 1.5, hr * 0.2, hr * 0.6);  // 前立て
  } else if (u.classId === 'cleric' || u.classId === 'monk' || u.classId === 'bishop' || u.classId === 'valkyrie') {
    ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.1, hr * 1.15, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();   // 頭巾
  } else if (shape === 'fly') {
    ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.2, hr * 1.05, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();   // 円環
  } else {                                       // 髪・頭巾
    ctx.fillStyle = u.side === 'enemy' ? '#3a2630' : '#4a3a2a';
    ctx.beginPath(); ctx.arc(hx, hy - hr * 0.15, hr * 1.02, Math.PI * 1.0, Math.PI * 2.0); ctx.fill();
  }
}
function drawWeapon(ctx, wt, hand, cy, r, u) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const x = hand, y = cy;
  if (wt === 'sword' || wt === 'dagger') {
    const L = wt === 'dagger' ? r * 0.7 : r * 1.25;
    ctx.strokeStyle = '#dfe6f2'; ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.2); ctx.lineTo(x + r * 0.1, y - L); ctx.stroke();
    ctx.strokeStyle = '#c8a24a'; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.moveTo(x - r * 0.18, y + r * 0.05); ctx.lineTo(x + r * 0.28, y + r * 0.05); ctx.stroke();
  } else if (wt === 'lance') {
    ctx.strokeStyle = '#b9a06a'; ctx.lineWidth = r * 0.11;
    ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.5); ctx.lineTo(x + r * 0.3, y - r * 1.45); ctx.stroke();
    ctx.fillStyle = '#dfe6f2'; ctx.beginPath(); ctx.moveTo(x + r * 0.3, y - r * 1.7); ctx.lineTo(x + r * 0.12, y - r * 1.3); ctx.lineTo(x + r * 0.48, y - r * 1.3); ctx.closePath(); ctx.fill();
  } else if (wt === 'axe') {
    ctx.strokeStyle = '#8a6b3a'; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.4); ctx.lineTo(x + r * 0.05, y - r * 1.1); ctx.stroke();
    ctx.fillStyle = '#cfd6e2'; ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 1.05); ctx.quadraticCurveTo(x + r * 0.7, y - r * 1.2, x + r * 0.55, y - r * 0.55); ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.8, x + r * 0.05, y - r * 0.75); ctx.closePath(); ctx.fill();
  } else if (wt === 'bow') {
    ctx.strokeStyle = '#c2a05a'; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.arc(x + r * 0.1, y - r * 0.3, r * 0.95, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    const a0 = -Math.PI * 0.55, a1 = Math.PI * 0.55, bx = x + r * 0.1, by = y - r * 0.3, br = r * 0.95;
    ctx.beginPath(); ctx.moveTo(bx + Math.cos(a0) * br, by + Math.sin(a0) * br); ctx.lineTo(bx + Math.cos(a1) * br, by + Math.sin(a1) * br); ctx.stroke();
  } else if (wt === 'staff') {
    ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.4); ctx.lineTo(x + r * 0.05, y - r * 1.2); ctx.stroke();
    ctx.fillStyle = '#9cf0e0'; ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 1.32, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,255,240,.4)'; ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 1.32, r * 0.36, 0, Math.PI * 2); ctx.fill();
  } else if (wt === 'anima' || wt === 'light' || wt === 'dark') {
    const col = wt === 'light' ? '#ffe9a8' : wt === 'dark' ? '#b79bff' : '#ff9c6a';
    ctx.fillStyle = '#2a2f3e'; roundRect(ctx, x - r * 0.1, y - r * 0.35, r * 0.5, r * 0.65, r * 0.06); ctx.fill();
    ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 0.55, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 0.55, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (wt === 'fist') {
    ctx.fillStyle = '#cfd6e2'; ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawCrown(ctx, x, y, hr) {
  ctx.fillStyle = '#ffd86a';
  ctx.beginPath();
  ctx.moveTo(x - hr * 0.9, y); ctx.lineTo(x - hr * 0.9, y - hr * 0.7); ctx.lineTo(x - hr * 0.3, y - hr * 0.3);
  ctx.lineTo(x, y - hr * 0.85); ctx.lineTo(x + hr * 0.3, y - hr * 0.3); ctx.lineTo(x + hr * 0.9, y - hr * 0.7);
  ctx.lineTo(x + hr * 0.9, y); ctx.closePath(); ctx.fill();
}

export function drawToken(ctx, u, cx, cy, size, opts = {}) {
  const pal = SIDE[u.side] || SIDE.enemy;
  const r = size * 0.4;
  const shape = shapeOf(u);
  const cd = classDef(u.classId);
  const wt = (equippedWeapon(u) || {}).wtype;
  const dragon = cd && cd.tags && cd.tags.includes('dragon');
  ctx.save();
  if (opts.acted) ctx.globalAlpha = 0.5;

  // 影
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.86, r * (shape === 'ride' || shape === 'fly' ? 1.0 : 0.66), r * 0.3, 0, 0, Math.PI * 2); ctx.fill();

  // 乗騎・翼（体の後ろ）
  if (shape === 'ride') drawMount(ctx, cx, cy, r, pal, dragon);
  else if (shape === 'fly') { ctx.fillStyle = dragon ? 'rgba(120,160,90,.92)' : 'rgba(238,243,255,.92)'; wing(ctx, cx - r * 0.45, cy - r * 0.1, -1, r * 0.95); wing(ctx, cx + r * 0.45, cy - r * 0.1, 1, r * 0.95); }

  const top = shape === 'ride' ? cy - r * 0.45 : cy - r * 0.15;
  // 脚
  if (shape !== 'ride') {
    ctx.strokeStyle = '#272c3a'; ctx.lineWidth = Math.max(2, r * 0.18); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.2, cy + r * 0.25); ctx.lineTo(cx - r * 0.2, cy + r * 0.62);
    ctx.moveTo(cx + r * 0.2, cy + r * 0.25); ctx.lineTo(cx + r * 0.2, cy + r * 0.62);
    ctx.stroke();
  }
  // 胴
  const sh = r * 0.46, wa = r * 0.32, ty = top, by = cy + r * 0.3;
  const tg = ctx.createLinearGradient(cx, ty, cx, by);
  tg.addColorStop(0, pal.edge); tg.addColorStop(1, pal.body);
  ctx.fillStyle = tg; ctx.strokeStyle = u.boss ? '#ffd86a' : 'rgba(0,0,0,.3)'; ctx.lineWidth = u.boss ? 2.5 : 1;
  ctx.beginPath();
  ctx.moveTo(cx - sh, ty + r * 0.12);
  ctx.quadraticCurveTo(cx - sh, ty - r * 0.02, cx - sh * 0.65, ty - r * 0.04);
  ctx.lineTo(cx + sh * 0.65, ty - r * 0.04);
  ctx.quadraticCurveTo(cx + sh, ty - r * 0.02, cx + sh, ty + r * 0.12);
  ctx.lineTo(cx + wa, by); ctx.quadraticCurveTo(cx, by + r * 0.1, cx - wa, by);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 胸の紋
  ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.arc(cx, ty + r * 0.28, r * 0.1, 0, Math.PI * 2); ctx.fill();

  // 腕
  ctx.strokeStyle = pal.body; ctx.lineWidth = Math.max(2, r * 0.15); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - sh * 0.8, ty + r * 0.14); ctx.lineTo(cx - r * 0.5, cy + r * 0.12);
  ctx.moveTo(cx + sh * 0.8, ty + r * 0.14); ctx.lineTo(cx + r * 0.5, cy + r * 0.05);
  ctx.stroke();

  // 頭
  const hx = cx, hy = ty - r * 0.3, hr = r * 0.3;
  ctx.fillStyle = (u.classId === 'revenant' || u.classId === 'wightlord') ? '#c2d2c6'
    : (u.classId === 'gargoyle' || u.classId === 'mogall' || u.classId === 'firedrake') ? '#9a8aa0' : '#e9c39c';
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
  drawHeadgear(ctx, u, shape, hx, hy, hr, pal);

  // 得物（右手の先）
  drawWeapon(ctx, wt, cx + r * 0.5, cy, r, u);

  if (u.boss) drawCrown(ctx, hx, hy - hr * 0.8, hr);
  ctx.restore();

  // HP バー
  if (opts.hp !== false) {
    const bw = r * 1.9, bh = Math.max(3, size * 0.085), by2 = cy + r * 0.72;
    const frac = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; roundRect(ctx, cx - bw / 2, by2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#6fd98a' : frac > 0.25 ? '#e8c44a' : '#e8624a';
    roundRect(ctx, cx - bw / 2, by2, bw * frac, bh, bh / 2); ctx.fill();
  }
}
