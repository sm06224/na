import { buildCtx, countsFor } from '../core/rules.js';
import { h, clear } from './dom.js';

/* ============================================================
   統計 — 公平かどうかは、感覚でなく数字で確かめる。
   ============================================================ */

export function renderStatsPanel(root, state) {
  const { plan } = state;
  clear(root);

  root.append(h('div', { class: 'panel-head' },
    h('h2', {}, '公平さの確認'),
    h('p', { class: 'hint' },
      'シフトへの不満の多くは「偏り」から。最大と最小の差が小さいほど良い表です。'),
  ));

  if (plan.staff.length === 0) {
    root.append(h('div', { class: 'empty-hint' }, 'スタッフがいません。'));
    return;
  }

  const ctx = buildCtx(plan);
  const rows = plan.staff.map(sf => ({ sf, c: countsFor(plan, sf, ctx) }));

  const cols = [
    { key: 'total', label: '出勤', unit: '日' },
    { key: 'night', label: '夜勤', unit: '回' },
    { key: 'weekend', label: '土日', unit: '日' },
  ];
  const maxOf = {};
  const minOf = {};
  for (const col of cols) {
    const vals = rows.map(r => r.c[col.key]);
    maxOf[col.key] = Math.max(...vals, 1);
    minOf[col.key] = Math.min(...vals);
  }

  const table = h('table', { class: 'stats' },
    h('thead', {}, h('tr', {},
      h('th', {}, '名前'),
      ...cols.map(c => h('th', {}, c.label)),
      h('th', {}, '労働時間'),
      h('th', {}, '目標'),
    )),
    h('tbody', {}, ...rows.map(({ sf, c }) => {
      const target = sf.targetPerMonth ?? ctx.autoTarget;
      const diff = c.total - target;
      return h('tr', {},
        h('th', {}, sf.name),
        ...cols.map(col => {
          const v = c[col.key];
          const isMax = v === maxOf[col.key] && maxOf[col.key] !== minOf[col.key];
          const isMin = v === minOf[col.key] && maxOf[col.key] !== minOf[col.key];
          return h('td', { class: isMax ? 'hi' : (isMin ? 'lo' : '') },
            h('div', { class: 'bar-wrap' },
              h('div', {
                class: 'bar',
                style: { width: `${(v / maxOf[col.key]) * 100}%` },
              }),
              h('span', { class: 'bar-num' }, `${v}${col.unit}`)));
        }),
        h('td', {}, `${(c.minutes / 60).toFixed(1)}h`),
        h('td', { class: Math.abs(diff) > 1 ? 'warn' : '' },
          `${target}日 ${diff === 0 ? '±0' : (diff > 0 ? `+${diff}` : diff)}`),
      );
    })),
  );

  root.append(table);

  for (const col of cols) {
    const spread = maxOf[col.key] - minOf[col.key];
    if (spread >= 3) {
      root.append(h('p', { class: 'stats-note warn' },
        `⚠ ${col.label}の最大と最小の差が ${spread}${col.unit} あります。「ルール」タブの均等化が有効か確認してください。`));
    }
  }
}
