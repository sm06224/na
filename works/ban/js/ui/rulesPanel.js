import { h, clear } from './dom.js';

/* ============================================================
   ルール — 職場ぜんたいの決まりごと。
   既定値は公的なガイドライン（11h インターバル、連勤 5、
   夜勤連続 2・月 8）に合わせてある。
   ============================================================ */

export function renderRulesPanel(root, state, actions) {
  const { plan } = state;
  const r = plan.rules;
  clear(root);

  const num = (label, key, min, max, help) => h('div', { class: 'rule-row' },
    h('label', { class: 'rule-label' }, label),
    h('input', {
      type: 'number', min: String(min), max: String(max), value: r[key],
      oninput: e => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v)) {
          r[key] = Math.max(min, Math.min(max, v));
          actions.changed('rules', { soft: true });
        }
      },
    }),
    h('span', { class: 'rule-help' }, help),
  );

  const flag = (label, key, help) => h('div', { class: 'rule-row' },
    h('label', { class: 'check rule-label' },
      h('input', {
        type: 'checkbox', checked: r[key],
        onchange: e => { r[key] = e.target.checked; actions.changed('rules', { soft: true }); },
      }), label),
    h('span', { class: 'rule-help' }, help),
  );

  root.append(
    h('div', { class: 'panel-head' },
      h('h2', {}, '守る決まり（破ると違反として赤く出る）'),
      h('p', { class: 'hint' },
        '既定値は厚労省の勤務間インターバル推奨・看護職ガイドラインの目安に合わせています。'),
    ),
    num('勤務間インターバル', 'minRestHours', 0, 24, '時間。前の勤務の終わりから次の始まりまで。11h が推奨（夜勤明け→早番を自動で防ぐ）'),
    num('連勤の上限', 'maxConsecutive', 1, 12, '日。法律上の最大は 12 だが健康面では 5 日以下が推奨'),
    num('夜勤の連続上限', 'maxNightStreak', 1, 7, '回。看護職ガイドラインの目安は 2 連続まで'),
    num('夜勤の月間上限', 'maxNightPerMonth', 0, 31, '回。3 交代制の目安は月 8 回以内'),

    h('div', { class: 'panel-head', style: { marginTop: '20px' } },
      h('h2', {}, '良いシフトの好み（自動作成が気を配ること）'),
    ),
    flag('出勤日数を均等にする', 'fairTotals', '特定の人に出勤が偏らないようにする'),
    flag('土日出勤を均等にする', 'fairWeekends', '「あの人ばかり週末休み」をなくす'),
    flag('夜勤を均等にする', 'fairNights', '夜勤の負担を分かち合う'),
    flag('飛び石休を避ける', 'forbidLoneOff', '出・休・出 より連休になるように'),
    flag('同じシフトが続くのを好む', 'preferStablePattern', '日勤→遅番→日勤のような細切れを減らし、生活リズムを守る'),
  );
}
