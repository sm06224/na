import { makePlan, makeShiftType, sanitizePlan, extractTail } from '../core/model.js';
import { validatePlan } from '../core/validate.js';
import { solveAsync } from '../core/solver.js';
import { demoPlan } from '../core/demo.js';
import {
  exportScheduleCSV, requestTemplateCSV, importRequestsCSV,
} from '../core/csv.js';
import { exportICal } from '../core/ical.js';
import { serializePlan, deserializePlan, saveLocal, loadLocal, clearLocal } from '../core/store.js';

import { h, clear, download, debounce, pickFile, popover, closePopover, toast } from './dom.js';
import { renderGrid } from './grid.js';
import { renderStaffPanel } from './staffPanel.js';
import { renderShiftPanel } from './shiftPanel.js';
import { renderRulesPanel } from './rulesPanel.js';
import { renderStatsPanel } from './statsPanel.js';
import { renderViolations } from './violationsPanel.js';

/* ============================================================
   番 — アプリの背骨。
   状態はひとつ（state.plan）。変更 → 検証 → 再描画 → 自動保存。
   データはこのブラウザの localStorage にだけ置かれる。
   ============================================================ */

const $ = id => document.getElementById(id);

const state = {
  plan: null,
  validation: null,
  tab: 'grid',
  solving: false,
  seedCounter: 1,
  undoSnapshot: null,
};

/* ---------- 変更の通知（すべての編集はここを通る） ---------- */
const autosave = debounce(() => saveLocal(state.plan), 600);

const actions = {
  changed(kind, opts = {}) {
    sanitizePlan(state.plan);
    state.validation = validatePlan(state.plan);
    autosave();
    // soft = 入力中（フォーカスを奪わないようグリッド系のみ更新）
    if (opts.soft) {
      renderViolations($('violations'), state);
      updateToolbarBadge();
    } else {
      render();
    }
  },
};

/* ---------- タブと描画 ---------- */
const TABS = [
  ['grid', 'シフト表'],
  ['staff', 'スタッフ'],
  ['shifts', 'シフト種別'],
  ['rules', 'ルール'],
  ['stats', '統計'],
];

function render() {
  closePopover();
  state.validation = state.validation || validatePlan(state.plan);

  /* タブ */
  const tabBar = clear($('tabs'));
  for (const [id, label] of TABS) {
    tabBar.append(h('button', {
      class: `tab ${state.tab === id ? 'active' : ''}`,
      onclick: () => { state.tab = id; render(); },
    }, label));
  }

  /* 本体 */
  const main = $('main');
  const gridWrap = $('gridWrap');
  const panel = $('panel');
  if (state.tab === 'grid') {
    gridWrap.style.display = '';
    panel.style.display = 'none';
    renderGrid($('grid'), state, actions);
    renderViolations($('violations'), state);
  } else {
    gridWrap.style.display = 'none';
    panel.style.display = '';
    clear(panel);
    if (state.tab === 'staff') renderStaffPanel(panel, state, actions);
    if (state.tab === 'shifts') renderShiftPanel(panel, state, actions);
    if (state.tab === 'rules') renderRulesPanel(panel, state, actions);
    if (state.tab === 'stats') renderStatsPanel(panel, state);
  }

  renderToolbar();
  updateToolbarBadge();
}

/* ---------- ツールバー ---------- */
function renderToolbar() {
  const bar = clear($('toolbar'));
  const plan = state.plan;

  /* 月の移動 */
  bar.append(h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn', onclick: () => shiftMonth(-1) }, '◀'),
    h('span', { class: 'month-label' }, `${plan.year}年 ${plan.month}月`),
    h('button', { class: 'icon-btn', onclick: () => shiftMonth(1) }, '▶'),
  ));

  /* 自動作成 */
  bar.append(h('div', { class: 'solve-group' },
    h('button', {
      class: 'primary', id: 'solveBtn', disabled: state.solving,
      onclick: () => runSolver(false),
    }, state.solving ? '考え中…' : '⚙ 自動作成'),
    h('button', {
      class: 'ghost', disabled: state.solving, title: '別の種から焼き直して違う案を出す',
      onclick: () => runSolver(true),
    }, 'もう一案'),
    state.undoSnapshot ? h('button', {
      class: 'ghost', title: '自動作成前の表に戻す',
      onclick: () => {
        state.plan.assign = state.undoSnapshot;
        state.undoSnapshot = null;
        state.validation = null;
        actions.changed('undo');
        toast('自動作成前に戻しました');
      },
    }, '↩ 戻す') : null,
  ));

  bar.append(h('span', { id: 'vioBadge', class: 'toolbar-badge' }));
  bar.append(h('span', { style: { flex: '1' } }));

  /* 入出力メニュー */
  bar.append(h('button', {
    class: 'ghost',
    onclick: e => openExportMenu(e.currentTarget),
  }, '📄 入出力'));
  bar.append(h('button', { class: 'ghost', onclick: () => window.print() }, '🖨 印刷'));
}

function updateToolbarBadge() {
  const el = $('vioBadge');
  if (!el || !state.validation) return;
  const { hardCount, shortCount } = state.validation;
  el.textContent = hardCount || shortCount
    ? `⚠ 違反${hardCount} / 不足${shortCount}` : '✓ 問題なし';
  el.className = `toolbar-badge ${hardCount || shortCount ? 'bad' : 'good'}`;
}

/* ---------- ソルバ実行 ---------- */
async function runSolver(newSeed) {
  if (state.solving) return;
  if (state.plan.staff.length === 0 || state.plan.shiftTypes.length === 0) {
    toast('スタッフとシフト種別を先に設定してください', 'warn');
    return;
  }
  state.solving = true;
  if (newSeed) state.seedCounter += 1;
  state.undoSnapshot = JSON.parse(JSON.stringify(state.plan.assign));
  renderToolbar();

  const btn = $('solveBtn');
  const result = await solveAsync(state.plan, {
    seed: state.seedCounter * 1013 + 7,
    iterations: 36000,
    chunk: 6000,
    onProgress: frac => {
      if (btn) btn.textContent = `考え中… ${Math.round(frac * 100)}%`;
    },
  });

  state.solving = false;
  state.validation = null;
  actions.changed('solve');
  const v = state.validation;
  if (v.hardCount === 0 && v.shortCount === 0) {
    toast(`✓ 違反ゼロの表ができました（${(result.elapsedMs / 1000).toFixed(1)} 秒）`, 'good');
  } else if (v.hardCount === 0) {
    toast(`表はできましたが ${v.shortCount} 枠の人員不足が残っています（人手そのものが足りない可能性）`, 'warn', 4200);
  } else {
    toast(`どうしても解けない違反が ${v.hardCount} 件あります。違反一覧で原因を確認してください`, 'warn', 4200);
  }
}

/* ---------- 月の移動 ---------- */
function shiftMonth(delta) {
  const hasData = Object.keys(state.plan.assign).length > 0;
  if (hasData && !confirm('月を変えると、いまの割当・ロック・希望はクリアされます。よろしいですか？\n（必要なら先に「入出力 → JSON で保存」を）')) {
    return;
  }
  let { year, month } = state.plan;
  // 翌月へ進むときは月末の勤務を引き継ぐ（月初の連勤・夜勤明けの判定が正しくなる）
  state.plan.prevTail = delta > 0 ? extractTail(state.plan) : {};
  month += delta;
  if (month < 1) { month = 12; year--; }
  if (month > 12) { month = 1; year++; }
  state.plan.year = year;
  state.plan.month = month;
  state.plan.assign = {};
  state.plan.locks = {};
  for (const sf of state.plan.staff) sf.requests = {};
  state.undoSnapshot = null;
  state.validation = null;
  actions.changed('month');
}

/* ---------- 入出力メニュー ---------- */
function openExportMenu(anchor) {
  const plan = state.plan;
  const item = (label, fn, help) => h('button', {
    class: 'menu-item', title: help || '',
    onclick: () => { closePopover(); fn(); },
  }, label);

  const content = h('div', { class: 'menu' },
    h('div', { class: 'menu-label' }, '書き出し'),
    item('シフト表 CSV（Excel 対応）', () => {
      download(`shift-${plan.year}-${plan.month}.csv`, exportScheduleCSV(plan), 'text/csv');
    }, 'BOM 付き UTF-8。日本語版 Excel でそのまま開けます'),
    item('希望収集テンプレート CSV', () => {
      download(`kibou-${plan.year}-${plan.month}.csv`, requestTemplateCSV(plan), 'text/csv');
    }, 'スタッフに配って希望を書いてもらう表'),
    item('スマホ用カレンダー (.ics)…', () => openICalMenu(anchor)),
    item('JSON で保存（バックアップ）', () => {
      download(`ban-${plan.year}-${plan.month}.json`, serializePlan(plan), 'application/json');
    }),
    h('div', { class: 'menu-label' }, '読み込み'),
    item('希望 CSV を取り込む', async () => {
      const f = await pickFile('.csv,text/csv');
      if (!f) return;
      const r = importRequestsCSV(plan, f.text);
      let msg = `${r.applied} 件の希望を取り込みました`;
      if (r.unknownStaff.length) msg += ` / 不明な名前: ${r.unknownStaff.join('、')}`;
      if (r.unknownShift.length) msg += ` / 不明な記号: ${r.unknownShift.join('、')}`;
      toast(msg, r.unknownStaff.length || r.unknownShift.length ? 'warn' : 'good', 4200);
      state.validation = null;
      actions.changed('import');
    }),
    item('JSON を開く', async () => {
      const f = await pickFile('.json,application/json');
      if (!f) return;
      try {
        state.plan = deserializePlan(f.text);
        state.validation = null;
        state.undoSnapshot = null;
        actions.changed('load');
        toast('読み込みました', 'good');
      } catch (err) {
        toast(`読み込めませんでした: ${err.message}`, 'warn');
      }
    }),
    h('div', { class: 'menu-label' }, 'その他'),
    item('デモデータを読み込む', () => {
      if (!confirm('いまの内容を破棄してデモ（介護施設 12 人）を読み込みますか？')) return;
      state.plan = demoPlan();
      state.validation = null;
      state.undoSnapshot = null;
      actions.changed('demo');
    }),
    item('すべて消去してやり直す', () => {
      if (!confirm('スタッフ・シフト・割当をすべて消去します。よろしいですか？')) return;
      clearLocal();
      state.plan = freshPlan();
      state.validation = null;
      state.undoSnapshot = null;
      actions.changed('reset');
    }),
  );
  popover(anchor, content);
}

function openICalMenu(anchor) {
  const plan = state.plan;
  const content = h('div', { class: 'menu' },
    h('div', { class: 'menu-label' }, '誰のカレンダーを書き出す？'),
    ...plan.staff.map(sf => h('button', {
      class: 'menu-item',
      onclick: () => {
        closePopover();
        const ics = exportICal(plan, sf.id);
        if (ics) download(`${sf.name}-${plan.year}-${plan.month}.ics`, ics, 'text/calendar');
      },
    }, sf.name)),
  );
  popover(anchor, content);
}

/* ---------- 初期化 ---------- */
function freshPlan() {
  return makePlan({
    shiftTypes: [
      makeShiftType({ name: '早番', short: '早', color: '#e8b14f', start: '07:00', end: '16:00' }),
      makeShiftType({ name: '日勤', short: '日', color: '#6aa3d8', start: '09:00', end: '18:00' }),
      makeShiftType({ name: '遅番', short: '遅', color: '#a48ad4', start: '11:00', end: '20:00' }),
    ],
    staff: [],
  });
}

function boot() {
  const saved = loadLocal();
  if (saved) {
    state.plan = saved;
    $('welcome').style.display = 'none';
  } else {
    /* はじめての人にはようこそ画面 */
    $('welcome').style.display = '';
    $('btnDemo').onclick = () => {
      state.plan = demoPlan();
      $('welcome').style.display = 'none';
      state.validation = null;
      render();
    };
    $('btnFresh').onclick = () => {
      state.plan = freshPlan();
      $('welcome').style.display = 'none';
      state.tab = 'staff';
      state.validation = null;
      render();
    };
    state.plan = freshPlan();   // 背景用
  }
  state.validation = null;
  render();
}

boot();

/* オフラインでも開けるように（バックヤードは電波が悪い） */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 非対応でも全機能動く */ });
}
