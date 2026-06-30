/* ============================================================
   グリグリ動かす層（DOM）。純粋コアが出した図を SVG にして、
   つかんで動かし、その結果を @layout に書き戻し、DSL を更新する。
     ・アーキ：ノードを 2 次元に自由配置（pos）
     ・ガント：横ドラッグで開始日を変え（at）、縦ドラッグで行を入れ替える（order）
   左に図、右に DSL。どちらを変えても、もう一方が追いかける。
   ============================================================ */
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';
import { addDays } from '../engine/date.js';

export function init({ canvas, dsl, status, source }) {
  let model, L;

  function render() {
    L = layout(model);
    canvas.innerHTML = draw(model, L);
    const errs = [...(model.errors || []), ...(L.errors || [])];
    if (status) {
      status.textContent = errs.length ? '⚠ ' + errs.join(' / ') : `${model.kind} ・ ${model.items.length} 項目`;
      status.dataset.bad = errs.length ? '1' : '';
    }
  }

  // テキスト → モデル（人/AI が DSL を編集したとき）。
  function fromText(text) { model = parse(text); render(); }
  // モデル → テキスト（ドラッグの結果を書き戻す）。
  function toText() { dsl.value = serialize(model); }

  // 画面座標 → SVG 座標へ直すための倍率。
  function scale() {
    const svg = canvas.querySelector('svg'); if (!svg) return 1;
    const r = svg.getBoundingClientRect();
    return r.width / (svg.viewBox.baseVal.width || r.width) || 1;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-drag]'); if (!g) return;
    const id = g.dataset.id, kind = g.dataset.drag, s = scale();
    if (kind === 'node') {
      const n = L.nodes.find((x) => x.id === id);
      drag = { id, kind, s, x0: n.x, y0: n.y, px: e.clientX, py: e.clientY };
    } else {
      const b = L.bars.find((x) => x.id === id);
      drag = { id, kind, s, day0: b.startDay, order: L.bars.map((x) => x.id), rowH: L.rowH, py0: b.rowY, px: e.clientX, py: e.clientY };
    }
    g.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.px) / drag.s, dy = (e.clientY - drag.py) / drag.s;
    if (drag.kind === 'node') {
      model.layout.pos[drag.id] = [Math.round(drag.x0 + dx), Math.round(drag.y0 + dy)];
    } else {
      const days = Math.round(dx / L.dayW);
      model.layout.at[drag.id] = addDays(L.base, drag.day0 + days);     // 横：開始日
      const steps = Math.round(dy / drag.rowH);                          // 縦：行の入れ替え
      if (steps !== 0) {
        const ord = drag.order.slice(), from = ord.indexOf(drag.id);
        const to = Math.max(0, Math.min(ord.length - 1, from + steps));
        ord.splice(to, 0, ord.splice(from, 1)[0]);
        model.layout.order = ord;
      }
    }
    render();
  });

  function endDrag() { if (drag) { drag = null; toText(); } }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // DSL を直接編集したら描き直す（人/AI の手入力）。
  let t;
  dsl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => fromText(dsl.value), 180); });

  fromText(source);
  return {
    export() { return serialize(model); },
    reset() { dsl.value = source; fromText(source); },
    model: () => model,
  };
}
