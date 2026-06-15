/* 陣 — 戦場を描く。地形・移動範囲・攻撃範囲・経路・カーソル・駒・演出。
   カメラ（位置と拡大）を持ち、画面⇄盤の座標を変換する。 */

import { terrainOf } from '../core/terrain.js';
import { isAlive } from '../core/unit.js';
import { drawToken, roundRect } from './sprites.js';
import { key } from '../core/grid.js';

export const BASE_TILE = 46;

/* 色をすこし明暗（地形の立体感に） */
function shade(hex, f) {
  const n = parseInt((hex || '#5c7a4a').slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* 立体（疑似クォータービュー）モード：地形を高さのある積み木として描く */
let VIEW3D = false;
export function setView3d(v) { VIEW3D = !!v; }
export function isView3d() { return VIEW3D; }
const ELEV = { peak: 16, mountain: 13, wall: 14, hill: 7, forest: 4, thicket: 5, fort: 5, gate: 5, throne: 6, ruins: 4, water: -4, shallow: -2, lava: -2, ice: -1, swamp: -2 };
export function elevOf(id, T) { return (ELEV[id] || 0) * (T / 46); }

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.scale = 1; }
  get tile() { return BASE_TILE * this.scale; }
  worldToScreen(wx, wy) { return { x: wx * this.tile + this.x, y: wy * this.tile + this.y }; }
  screenToTile(sx, sy) {
    return { x: Math.floor((sx - this.x) / this.tile), y: Math.floor((sy - this.y) / this.tile) };
  }
  center(board, vw, vh) {
    this.x = (vw - board.w * this.tile) / 2;
    this.y = (vh - board.h * this.tile) / 2;
  }
  clamp(board, vw, vh) {
    const bw = board.w * this.tile, bh = board.h * this.tile;
    const margin = this.tile * 2;
    if (bw <= vw) this.x = (vw - bw) / 2; else this.x = Math.min(margin, Math.max(vw - bw - margin, this.x));
    if (bh <= vh) this.y = (vh - bh) / 2; else this.y = Math.min(margin, Math.max(vh - bh - margin, this.y));
  }
}

export function draw(ctx, state, now) {
  const { board, cam, vw, vh } = state;
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, vw, vh);
  const T = cam.tile;

  // 可視範囲のタイルだけ描く
  const x0 = Math.max(0, Math.floor((-cam.x) / T) - 1);
  const y0 = Math.max(0, Math.floor((-cam.y) / T) - 1);
  const x1 = Math.min(board.w - 1, Math.ceil((vw - cam.x) / T) + 1);
  const y1 = Math.min(board.h - 1, Math.ceil((vh - cam.y) / T) + 1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = terrainOf(board.terrain.get(x, y));
      const s = cam.worldToScreen(x, y);
      const e = VIEW3D ? elevOf(t.id, T) : 0;
      const ty = s.y - e;                          // 立体：高さぶん上へ持ち上げた天面
      if (e > 0) {                                 // 側面（積み木の壁）
        ctx.fillStyle = shade(t.color, -0.42);
        ctx.fillRect(s.x, ty + T - 1, T + 1, e + 2);
      } else if (e < 0) {                          // 窪み（水・溶岩）
        ctx.fillStyle = shade(t.color, -0.5);
        ctx.fillRect(s.x, s.y, T + 1, T + 1);
      }
      // 天面：上を明るく下を暗く（縦グラデ）
      const g2 = ctx.createLinearGradient(s.x, ty, s.x, ty + T);
      g2.addColorStop(0, shade(t.color, 0.13));
      g2.addColorStop(0.55, t.color || '#5c7a4a');
      g2.addColorStop(1, shade(t.color, -0.2));
      ctx.fillStyle = g2;
      ctx.fillRect(s.x, ty, T + 1, T + 1);
      // ざらり（決定的な斑点）
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      ctx.fillStyle = (h & 1) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)';
      for (let k = 0; k < 3; k++) {
        const px = s.x + ((h >> (k * 5)) & 31) / 31 * T;
        const py = ty + ((h >> (k * 4 + 2)) & 31) / 31 * T;
        ctx.fillRect(px, py, T * 0.12, T * 0.12);
      }
      decorate(ctx, t, s.x, ty, T, now, x, y);
      // 縁の面取り（上＝光、下＝影）
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x + 0.5, ty + T - 0.5); ctx.lineTo(s.x + 0.5, ty + 0.5); ctx.lineTo(s.x + T - 0.5, ty + 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.moveTo(s.x + T - 0.5, ty + 0.5); ctx.lineTo(s.x + T - 0.5, ty + T - 0.5); ctx.lineTo(s.x + 0.5, ty + T - 0.5); ctx.stroke();
    }
  }

  // 重ね（移動＝青、攻撃＝赤、杖＝緑）
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);
  drawOverlay(ctx, cam, state.moveTiles, `rgba(90,150,255,${0.28 + pulse * 0.12})`, T);
  drawOverlay(ctx, cam, state.atkTiles, `rgba(255,90,90,${0.26 + pulse * 0.12})`, T);
  drawOverlay(ctx, cam, state.staffTiles, `rgba(120,230,150,${0.26 + pulse * 0.12})`, T);

  // 経路の点
  if (state.path && state.path.length > 1) {
    ctx.fillStyle = '#ffe08a';
    for (const p of state.path) {
      const s = cam.worldToScreen(p.x, p.y);
      ctx.beginPath(); ctx.arc(s.x + T / 2, s.y + T / 2, T * 0.10, 0, Math.PI * 2); ctx.fill();
    }
  }

  // カーソル
  if (state.cursor) {
    const s = cam.worldToScreen(state.cursor.x, state.cursor.y);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.strokeRect(s.x + 2, s.y + 2, T - 4, T - 4);
  }
  if (state.selected && state.selected.pos) {
    const s = cam.worldToScreen(state.selected.pos.x, state.selected.pos.y);
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3;
    ctx.strokeRect(s.x + 2, s.y + 2, T - 4, T - 4);
  }

  // 駒（移動アニメ中のユニットはずらして描く）
  const anim = state.anim;
  for (const u of board.units) {
    if (!isAlive(u) || !u.pos) continue;
    let px = u.pos.x, py = u.pos.y;
    if (anim && anim.type === 'move' && anim.uid === u.uid) { px = anim.cx; py = anim.cy; }
    const s = cam.worldToScreen(px, py);
    const e = VIEW3D ? elevOf(board.terrainAt(Math.round(px), Math.round(py)).id, T) : 0;
    const shake = (anim && anim.type === 'hit' && anim.uid === u.uid) ? Math.sin(now / 30) * 3 : 0;
    drawToken(ctx, u, s.x + T / 2 + shake, s.y + T / 2 - e, T, { acted: u.side === 'player' && u.hasActed && !state.selected });
  }

  // ダメージ表示など
  if (state.popups) {
    for (const p of state.popups) {
      const s = cam.worldToScreen(p.x, p.y);
      const age = (now - p.t) / 900;
      if (age > 1) continue;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = p.color || '#fff';
      ctx.font = `bold ${Math.round(T * (p.big ? 0.5 : 0.38))}px ui-sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, s.x + T / 2, s.y + T / 2 - age * T * 0.8);
      ctx.globalAlpha = 1;
    }
  }
}

/* 地形を描き込む（木・山・水のゆらぎ・砦の旗…）。安価に。 */
function decorate(ctx, t, x, y, T, now, gx, gy) {
  const id = t.id;
  const hash = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
  if (id === 'forest' || id === 'thicket') {
    const n = id === 'thicket' ? 3 : 2;
    ctx.fillStyle = id === 'thicket' ? '#16331c' : '#1f4a26';
    for (let i = 0; i < n; i++) {
      const ox = T * (0.28 + 0.44 * ((hash >> (i * 3)) & 7) / 7), oy = T * (0.4 + 0.4 * ((hash >> (i * 4)) & 3) / 3);
      const tw = T * 0.2;
      ctx.beginPath(); ctx.moveTo(x + ox, y + oy - tw); ctx.lineTo(x + ox - tw * 0.7, y + oy + tw * 0.6); ctx.lineTo(x + ox + tw * 0.7, y + oy + tw * 0.6); ctx.closePath(); ctx.fill();
    }
  } else if (id === 'mountain' || id === 'peak' || id === 'hill') {
    ctx.fillStyle = id === 'hill' ? 'rgba(0,0,0,.16)' : '#5b5346';
    ctx.beginPath(); ctx.moveTo(x + T * 0.5, y + T * 0.2); ctx.lineTo(x + T * 0.16, y + T * 0.82); ctx.lineTo(x + T * 0.84, y + T * 0.82); ctx.closePath(); ctx.fill();
    if (id === 'peak') { ctx.fillStyle = '#e9eef4'; ctx.beginPath(); ctx.moveTo(x + T * 0.5, y + T * 0.2); ctx.lineTo(x + T * 0.4, y + T * 0.4); ctx.lineTo(x + T * 0.6, y + T * 0.4); ctx.closePath(); ctx.fill(); }
  } else if (id === 'water' || id === 'shallow' || id === 'lava' || id === 'ice') {
    const ph = now / (id === 'lava' ? 700 : 1100) + (gx + gy) * 0.7;
    ctx.strokeStyle = id === 'lava' ? 'rgba(255,200,120,.5)' : id === 'ice' ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const yy = y + T * (0.4 + i * 0.3) + Math.sin(ph + i) * T * 0.05;
      ctx.beginPath(); ctx.moveTo(x + T * 0.15, yy); ctx.quadraticCurveTo(x + T * 0.5, yy + Math.sin(ph + i * 2) * T * 0.08, x + T * 0.85, yy); ctx.stroke();
    }
  } else if (id === 'fort' || id === 'throne' || id === 'gate') {
    ctx.fillStyle = id === 'throne' ? '#ffd86a' : '#cdd6ea';
    ctx.fillRect(x + T * 0.46, y + T * 0.2, T * 0.06, T * 0.5);
    ctx.beginPath(); ctx.moveTo(x + T * 0.52, y + T * 0.22); ctx.lineTo(x + T * 0.74, y + T * 0.3); ctx.lineTo(x + T * 0.52, y + T * 0.38); ctx.closePath(); ctx.fill();
  } else if (id === 'wall') {
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + T * 0.5); ctx.lineTo(x + T, y + T * 0.5); ctx.moveTo(x + T * 0.5, y); ctx.lineTo(x + T * 0.5, y + T * 0.5); ctx.moveTo(x + T * 0.25, y + T * 0.5); ctx.lineTo(x + T * 0.25, y + T); ctx.moveTo(x + T * 0.75, y + T * 0.5); ctx.lineTo(x + T * 0.75, y + T); ctx.stroke();
  } else if (id === 'ruins') {
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + T * 0.2, y + T * 0.3, T * 0.18, T * 0.4); ctx.fillRect(x + T * 0.55, y + T * 0.25, T * 0.16, T * 0.45);
  }
}

function drawOverlay(ctx, cam, tiles, color, T) {
  if (!tiles) return;
  ctx.fillStyle = color;
  for (const p of tiles) {
    const s = cam.worldToScreen(p.x, p.y);
    ctx.fillRect(s.x + 2, s.y + 2, T - 4, T - 4);
  }
}
