import {
  OFF, EMPTY, getAssign, setAssign, isLocked, setLock,
  planDays, planWeekday, shiftTypeById, requestOf, requiredOn,
} from '../core/model.js';
import { WEEKDAY_JA, isWeekend } from '../core/time.js';
import { violationCells } from '../core/validate.js';
import { h, clear, popover } from './dom.js';

/* ============================================================
   シフト表グリッド — このツールの主役。
   行 = スタッフ、列 = 日。クリックで割当を変える。
   下部に日ごとの人数（実績/必要）を出し、不足は赤くする。
   ============================================================ */

export function renderGrid(root, state, actions) {
  const { plan, validation } = state;
  const days = planDays(plan);
  const badCells = violationCells(validation.violations);

  clear(root);
  if (plan.staff.length === 0) {
    root.append(h('div', { class: 'empty-hint' },
      'スタッフがいません。「スタッフ」タブで追加するか、デモを読み込んでください。'));
    return;
  }

  const table = h('table', { class: 'grid' });

  /* ---------- ヘッダ（日付・曜日） ---------- */
  const trDay = h('tr', {}, h('th', { class: 'name-col' }, ''));
  const trWd = h('tr', {}, h('th', { class: 'name-col sub' },
    `${plan.year}年${plan.month}月`));
  for (let d = 1; d <= days; d++) {
    const wd = planWeekday(plan, d);
    const cls = wd === 0 ? 'sun' : (wd === 6 ? 'sat' : '');
    trDay.append(h('th', { class: cls }, d));
    trWd.append(h('th', { class: `sub ${cls}` }, WEEKDAY_JA[wd]));
  }
  const thead = h('thead', {}, trDay, trWd);
  table.append(thead);

  /* ---------- 本体 ---------- */
  const tbody = h('tbody');
  for (const sf of plan.staff) {
    const tr = h('tr');
    tr.append(h('th', { class: 'name-col', title: sf.memo || '' }, sf.name,
      sf.memo ? h('span', { class: 'memo' }, ` ${sf.memo}`) : null));
    for (let d = 1; d <= days; d++) {
      tr.append(renderCell(plan, sf, d, badCells, state, actions));
    }
    tbody.append(tr);
  }
  table.append(tbody);

  /* ---------- フッタ（人数の過不足） ---------- */
  const tfoot = h('tfoot');
  for (const st of plan.shiftTypes) {
    const tr = h('tr', { class: 'coverage' });
    tr.append(h('th', { class: 'name-col sub' },
      h('span', { class: 'chip', style: { background: st.color } }, st.short),
      ` ${st.name}`));
    for (let d = 1; d <= days; d++) {
      const wd = planWeekday(plan, d);
      const req = requiredOn(st, d, wd);
      let got = 0;
      for (const sf of plan.staff) if (getAssign(plan, sf.id, d) === st.id) got++;
      const cls = got < req ? 'short' : (got > req ? 'over' : 'ok');
      tr.append(h('td', { class: `cov ${cls}`, title: `${st.name} ${got}/${req}` },
        req === 0 && got === 0 ? '' : `${got}/${req}`));
    }
    tfoot.append(tr);
  }
  table.append(tfoot);

  root.append(h('div', { class: 'grid-scroll' }, table));
}

/* ---------- セル ---------- */
function renderCell(plan, sf, d, badCells, state, actions) {
  const v = getAssign(plan, sf.id, d);
  const locked = isLocked(plan, sf.id, d);
  const req = requestOf(sf, d);
  const wd = planWeekday(plan, d);

  const classes = ['cell'];
  if (isWeekend(wd)) classes.push('we');
  if (locked) classes.push('locked');
  if (badCells.has(`${sf.id}:${d}`)) classes.push('bad');
  if (req?.kind === 'off') classes.push('req-off');
  if (req?.kind === 'want') classes.push('req-want');
  if (req?.kind === 'ng') classes.push('req-ng');

  let label = '', bg = '';
  if (v === OFF) { label = '休'; classes.push('off'); }
  else if (v !== EMPTY) {
    const st = shiftTypeById(plan, v);
    label = st?.short ?? '?';
    bg = st?.color ?? '#888';
  }

  const td = h('td', {
    class: classes.join(' '),
    style: bg ? { background: bg } : null,
    onclick: e => openCellPicker(e.currentTarget, plan, sf, d, actions),
    oncontextmenu: e => {       // 右クリックで即ロック切替
      e.preventDefault();
      setLock(plan, sf.id, d, !locked);
      actions.changed('lock');
    },
    dataset: { cell: `${sf.id}:${d}` },
    title: cellTitle(plan, sf, d, v, locked, req),
  }, label);
  return td;
}

function cellTitle(plan, sf, d, v, locked, req) {
  const parts = [`${sf.name} / ${d}日`];
  if (v === OFF) parts.push('休み');
  else if (v !== EMPTY) parts.push(shiftTypeById(plan, v)?.name ?? '?');
  else parts.push('未定');
  if (locked) parts.push('🔒ロック中');
  if (req?.kind === 'off') parts.push('休み希望');
  if (req?.kind === 'want') parts.push(`${shiftTypeById(plan, req.shiftId)?.name ?? '?'}希望`);
  if (req?.kind === 'ng') parts.push(`${shiftTypeById(plan, req.shiftId)?.name ?? '?'}不可`);
  return parts.join(' · ');
}

/* ---------- セルのピッカー ---------- */
function openCellPicker(anchor, plan, sf, d, actions) {
  const v = getAssign(plan, sf.id, d);
  const locked = isLocked(plan, sf.id, d);
  const req = requestOf(sf, d);

  const setVal = val => {
    setAssign(plan, sf.id, d, val);
    actions.changed('assign');
  };
  const setReq = val => {
    if (val === null) delete sf.requests[String(d)];
    else sf.requests[String(d)] = val;
    actions.changed('request');
  };

  const shiftBtns = plan.shiftTypes.map(st =>
    h('button', {
      class: `pick ${v === st.id ? 'now' : ''}`,
      style: { borderColor: st.color },
      onclick: () => setVal(st.id),
    }, h('span', { class: 'chip', style: { background: st.color } }, st.short),
      ` ${st.name}`));

  const reqRow = kind => req?.kind === kind ? 'now' : '';

  const content = h('div', { class: 'picker' },
    h('div', { class: 'picker-head' }, `${sf.name} — ${plan.month}/${d}`),
    h('div', { class: 'picker-grid' },
      ...shiftBtns,
      h('button', { class: `pick ${v === OFF ? 'now' : ''}`, onclick: () => setVal(OFF) }, '休み'),
      h('button', { class: `pick ${v === EMPTY ? 'now' : ''}`, onclick: () => setVal(EMPTY) }, '未定'),
    ),
    h('div', { class: 'picker-sep' }),
    h('div', { class: 'picker-row' },
      h('button', {
        class: `pick small ${locked ? 'now' : ''}`,
        onclick: () => { setLock(plan, sf.id, d, !locked); actions.changed('lock'); },
      }, locked ? '🔒 ロック中（解除）' : '🔓 ロックする'),
    ),
    h('div', { class: 'picker-label' }, '本人の希望として記録:'),
    h('div', { class: 'picker-row' },
      h('button', { class: `pick small ${reqRow('off')}`, onclick: () => setReq('off') }, '休み希望'),
      ...plan.shiftTypes.map(st =>
        h('button', {
          class: `pick small ${req?.kind === 'want' && req.shiftId === st.id ? 'now' : ''}`,
          onclick: () => setReq(`want:${st.id}`),
        }, `${st.short}希望`)),
      h('button', { class: 'pick small', onclick: () => setReq(null) }, '希望なし'),
    ),
  );

  popover(anchor, content);
}

/* 違反パネルから飛んでくる用：セルへスクロールして点滅 */
export function flashCell(staffId, day) {
  const el = document.querySelector(`[data-cell="${staffId}:${day}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}
