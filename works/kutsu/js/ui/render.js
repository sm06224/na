/* ============================================================
   窟 — 描画。格子に字を打つ。見えているところは色を持ち、
   一度見た記憶はくすみ、いまの視界だけに魔物と品物が灯る。
   ============================================================ */

import { tileProp, T, isStairs } from '../core/tile.js';
import { F } from '../core/level.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cell = 20;
    this.cols = 0; this.rows = 0;
    this.font = 'ui-monospace, "DejaVu Sans Mono", "Noto Sans Mono CJK JP", monospace';
  }

  fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cols = Math.floor(w / this.cell);
    this.rows = Math.floor(h / this.cell);
    this.vw = w; this.vh = h;
  }

  /* カメラの左上（プレイヤー中心、盤の縁で止める） */
  camera(game) {
    const lv = game.level;
    let cx = game.player.x - (this.cols >> 1);
    let cy = game.player.y - (this.rows >> 1);
    cx = Math.max(0, Math.min(lv.w - this.cols, cx));
    cy = Math.max(0, Math.min(lv.h - this.rows, cy));
    if (lv.w < this.cols) cx = -((this.cols - lv.w) >> 1);
    if (lv.h < this.rows) cy = -((this.rows - lv.h) >> 1);
    return { cx, cy };
  }

  draw(game) {
    const ctx = this.ctx, lv = game.level, cell = this.cell;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.font = `${cell - 2}px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const { cx, cy } = this.camera(game);

    for (let ry = 0; ry < this.rows; ry++) {
      for (let rx = 0; rx < this.cols; rx++) {
        const x = cx + rx, y = cy + ry;
        if (!lv.inBounds(x, y)) continue;
        const disc = lv.flag(x, y, F.DISCOVERED) || lv.flag(x, y, F.MAPPED);
        if (!disc) continue;
        const vis = lv.flag(x, y, F.VISIBLE);
        const px = rx * cell + cell / 2, py = ry * cell + cell / 2;

        // 地形
        const prop = tileProp(lv.get(x, y));
        let ch = prop.ch, color = prop.color;
        let bg = null;
        if (lv.get(x, y) === T.WATER || lv.get(x, y) === T.DEEP_WATER) bg = vis ? 'rgba(40,90,150,.28)' : 'rgba(30,60,100,.14)';
        if (prop.liquid === 'lava') bg = vis ? 'rgba(180,70,30,.32)' : 'rgba(120,50,20,.16)';
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(rx * cell, ry * cell, cell, cell); }

        // いまの視界なら、品物→魔物の順に上書き
        let drew = false;
        if (vis) {
          const items = game.board.itemsAt(x, y);
          if (items.length) { const it = items[items.length - 1]; ch = it.d.glyph || '*'; color = it.d.color || itemColor(it.category); }
          const a = game.board.actorAt(x, y);
          if (a && a.alive) { ch = a.glyph; color = a.color; drew = true; if (a.faction === 'monster') this.maybeHealthTint(ctx, a, rx, ry); }
        } else if (lv.flag(x, y, F.MAPPED)) {
          const items = game.board.itemsAt(x, y);
          if (items.length) { const it = items[items.length - 1]; ch = it.d.glyph || '*'; color = it.d.color || itemColor(it.category); }
        }

        // テレパシーで感じる魔物（視界外でも）
        if (!vis && game.sensed && game.sensed.size) {
          const a = game.board.actorAt(x, y);
          if (a && a.alive && a.faction === 'monster' && game.sensed.has(a.id)) { ch = a.glyph; color = '#c89aff'; drew = true; }
        }

        ctx.fillStyle = vis || drew ? color : dim(color, 0.42);
        ctx.fillText(ch, px, py);
      }
    }

    // プレイヤーの淡い光輪
    const pr = this.toScreen(game.player.x, game.player.y, cx, cy);
    if (pr) {
      const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, cell * 1.2);
      g.addColorStop(0, 'rgba(255,233,168,.10)'); g.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pr.x, pr.y, cell * 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // 直近の魔法の筋
    this.drawBolt(game, cx, cy);
  }

  toScreen(x, y, cx, cy) {
    const rx = x - cx, ry = y - cy;
    if (rx < 0 || ry < 0 || rx >= this.cols || ry >= this.rows) return null;
    return { x: rx * this.cell + this.cell / 2, y: ry * this.cell + this.cell / 2 };
  }

  maybeHealthTint(ctx, a, rx, ry) {
    if (a.hp >= a.maxhp) return;
    const frac = a.hp / a.maxhp;
    ctx.fillStyle = `rgba(${frac < 0.34 ? 200 : 120},${frac < 0.34 ? 40 : 120},40,0.18)`;
    ctx.fillRect(rx * this.cell, ry * this.cell, this.cell, this.cell);
  }

  drawBolt(game, cx, cy) {
    const b = game._lastBolt;
    if (!b || b.t !== game.player.turns) return;
    const ctx = this.ctx;
    const col = { firebolt: '#ff7a3a', frostbolt: '#7ac6ff', lightning: '#f5e06a', magicmissile: '#c89aff' }[b.kind] || '#cfd6ff';
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
    ctx.beginPath();
    let first = true;
    for (const p of b.path) {
      const s = this.toScreen(p.x, p.y, cx, cy); if (!s) continue;
      if (first) { ctx.moveTo(s.x, s.y); first = false; } else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
}

function itemColor(cat) {
  return { potion: '#d06aa0', scroll: '#d8d2b0', wand: '#a0d0e0', ring: '#e0c060', weapon: '#cfd6e0', armor: '#9aa0b0', food: '#c0904a', amulet: '#ffd24a', gold: '#ffd24a' }[cat] || '#ccc';
}

/* 色をくすませる（記憶の描画） */
export function dim(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
