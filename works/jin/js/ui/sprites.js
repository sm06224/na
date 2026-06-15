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

export function drawToken(ctx, u, cx, cy, size, opts = {}) {
  const pal = SIDE[u.side] || SIDE.enemy;
  const r = size * 0.40;
  ctx.save();
  if (opts.acted) ctx.globalAlpha = 0.55;
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 0.85, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  // 体
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, pal.edge); g.addColorStop(0.5, pal.body); g.addColorStop(1, '#1a1f30');
  ctx.fillStyle = g;
  ctx.strokeStyle = u.boss ? '#ffd86a' : pal.edge;
  ctx.lineWidth = u.boss ? 2.5 : 1.5;
  roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.42);
  ctx.fill(); ctx.stroke();
  // 顔（一字）
  ctx.fillStyle = pal.text;
  ctx.font = `${Math.round(size * 0.42)}px ui-sans-serif, "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyphOf(u.classId), cx, cy + size * 0.02);
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
