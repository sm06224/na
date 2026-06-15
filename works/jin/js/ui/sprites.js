/* 陣 — 駒と地形の見た目。画像ファイルなし、すべてその場で描く。 */

import { classDef } from '../core/classes.js';
import { equippedWeapon, effectiveStats } from '../core/unit.js';

/* 職ごとの一字（駒の顔） */
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
  player: { body: '#3f6bd8', edge: '#9cc0ff', text: '#eaf2ff' },
  enemy: { body: '#c0463e', edge: '#ff9c92', text: '#ffeceb' },
  ally: { body: '#3aa06a', edge: '#9cf0c0', text: '#eafff2' },
};
const CLASSES_BOW = { archer: 1, sniper: 1, ranger: 1 };

/* 翼ひとひら（dir=-1 左 / +1 右） */
function wing(ctx, x, y, dir, r) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dir * r * 1.1, y - r * 0.7, x + dir * r * 1.25, y + r * 0.1);
  ctx.quadraticCurveTo(x + dir * r * 0.9, y + r * 0.2, x, y + r * 0.35);
  ctx.closePath(); ctx.fill();
}

/* 職のおおまかな姿（描き分けの区分） */
function shapeOf(u) {
  if (u.mode === 'mage') return 'mage';
  if (u.mode === 'armor') return 'armor';
  if (u.mode === 'fly') return 'fly';
  if (u.mode === 'ride') return 'ride';
  return 'foot';
}

export function drawToken(ctx, u, cx, cy, size, opts = {}) {
  const pal = SIDE[u.side] || SIDE.enemy;
  const r = size * 0.40;
  const shape = shapeOf(u);
  ctx.save();
  if (opts.acted) ctx.globalAlpha = 0.5;
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.82, r * (shape === 'ride' || shape === 'fly' ? 1.05 : 0.85), r * 0.34, 0, 0, Math.PI * 2); ctx.fill();

  // 乗騎・翼は体の下／脇に
  if (shape === 'ride') {
    ctx.fillStyle = '#5a4636';
    roundRect(ctx, cx - r * 1.05, cy + r * 0.15, r * 2.1, r * 0.7, r * 0.3); ctx.fill();
    ctx.fillStyle = '#3a2c22'; ctx.fillRect(cx - r * 0.95, cy + r * 0.8, r * 0.22, r * 0.5); ctx.fillRect(cx + r * 0.73, cy + r * 0.8, r * 0.22, r * 0.5);
  } else if (shape === 'fly') {
    ctx.fillStyle = 'rgba(235,240,255,.85)';
    wing(ctx, cx - r * 0.7, cy - r * 0.1, -1, r);
    wing(ctx, cx + r * 0.7, cy - r * 0.1, 1, r);
  }

  // 体
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, pal.edge); g.addColorStop(0.5, pal.body); g.addColorStop(1, '#161a28');
  ctx.fillStyle = g;
  ctx.strokeStyle = u.boss ? '#ffd86a' : pal.edge;
  ctx.lineWidth = u.boss ? 2.5 : 1.4;
  const bw = shape === 'armor' ? r * 2.1 : r * 1.9;
  roundRect(ctx, cx - bw / 2, cy - r, bw, r * 2, shape === 'armor' ? r * 0.3 : r * 0.44);
  ctx.fill(); ctx.stroke();

  // 職の標（かぶりもの・得物）
  ctx.lineWidth = 2; ctx.strokeStyle = pal.text; ctx.fillStyle = pal.text;
  if (shape === 'mage') {            // とんがり帽子
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.85); ctx.lineTo(cx + r * 0.6, cy - r * 0.85); ctx.lineTo(cx, cy - r * 1.6); ctx.closePath();
    ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = pal.edge; ctx.stroke();
  } else if (shape === 'armor') {    // 兜のひさし
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(cx - bw * 0.42, cy - r * 0.35, bw * 0.84, r * 0.22);
  }
  // 弓は脇に弧
  if ((CLASSES_BOW[u.classId])) {
    ctx.strokeStyle = '#d8c089'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx + r * 0.95, cy, r * 0.8, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  }
  // ボスの冠
  if (u.boss) {
    ctx.fillStyle = '#ffd86a';
    ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy - r * 0.95); ctx.lineTo(cx - r * 0.55, cy - r * 1.35); ctx.lineTo(cx - r * 0.18, cy - r * 1.05);
    ctx.lineTo(cx, cy - r * 1.4); ctx.lineTo(cx + r * 0.18, cy - r * 1.05); ctx.lineTo(cx + r * 0.55, cy - r * 1.35); ctx.lineTo(cx + r * 0.55, cy - r * 0.95); ctx.closePath(); ctx.fill();
  }

  // 顔（一字）
  ctx.fillStyle = pal.text;
  ctx.font = `${Math.round(size * 0.40)}px ui-sans-serif, "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyphOf(u.classId), cx, cy + size * 0.03);
  ctx.restore();
  // HP バー
  if (opts.hp !== false) {
    const bw = r * 2, bh = Math.max(3, size * 0.09);
    const by = cy + r + bh * 0.4;
    const frac = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundRect(ctx, cx - bw / 2, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#6fd98a' : frac > 0.25 ? '#e8c44a' : '#e8624a';
    roundRect(ctx, cx - bw / 2, by, bw * frac, bh, bh / 2); ctx.fill();
  }
}

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
