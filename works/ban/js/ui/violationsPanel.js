import { h, clear } from './dom.js';
import { flashCell } from './grid.js';

/* ============================================================
   違反パネル — シフト表の下に常駐する点検窓。
   hard（破ってはいけない）、不足、soft（好み）を分けて見せる。
   クリックすると該当セルへ飛ぶ。
   ============================================================ */

export function renderViolations(root, state) {
  const { validation } = state;
  const { violations, hardCount, shortCount } = validation;
  clear(root);

  const softs = violations.filter(v => v.level === 'soft');

  const head = h('div', { class: 'vio-head' },
    h('span', { class: `vio-badge ${hardCount ? 'bad' : 'good'}` },
      hardCount ? `違反 ${hardCount}` : '違反なし ✓'),
    h('span', { class: `vio-badge ${shortCount ? 'short' : 'good'}` },
      shortCount ? `人員不足 ${shortCount}` : '人数 OK ✓'),
    h('span', { class: 'vio-badge soft' }, `気になる点 ${softs.length}`),
  );
  root.append(head);

  if (violations.length === 0) return;

  const list = h('div', { class: 'vio-list' });
  let shown = 0;
  for (const v of violations) {
    if (!v.msg) continue;
    if (shown++ >= 60) {
      list.append(h('div', { class: 'vio-more' }, `…ほか ${violations.length - shown + 1} 件`));
      break;
    }
    list.append(h('div', {
      class: `vio vio-${v.level} ${v.staffId && v.day ? 'jumpable' : ''}`,
      onclick: () => { if (v.staffId && v.day) flashCell(v.staffId, v.day); },
    },
      h('span', { class: 'vio-mark' },
        v.level === 'hard' ? '✕' : v.level === 'short' ? '▲' : '·'),
      v.msg));
  }
  root.append(list);
}
