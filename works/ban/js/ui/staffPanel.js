import { makeStaff, makePair } from '../core/model.js';
import { h, clear, toast, popover, closePopover } from './dom.js';

/* ============================================================
   スタッフ — 名簿と一人ひとりの働き方の条件。
   希望休の入力はシフト表のセルから（そのほうが直感的）。
   ============================================================ */

export function renderStaffPanel(root, state, actions) {
  const { plan } = state;
  clear(root);

  root.append(h('div', { class: 'panel-head' },
    h('h2', {}, 'スタッフ'),
    h('p', { class: 'hint' },
      '一人ひとりの条件はここで。希望休・シフト希望は「シフト表」のセルをクリックして記録できます。'),
  ));

  const list = h('div', { class: 'staff-list' });
  for (const sf of plan.staff) list.append(staffCard(sf, plan, actions));
  root.append(list);

  root.append(h('div', { class: 'add-row' },
    h('button', {
      class: 'add-btn',
      onclick: () => {
        plan.staff.push(makeStaff({ name: `スタッフ${plan.staff.length + 1}` }));
        actions.changed('staff');
      },
    }, '＋ スタッフを追加'),
    h('button', {
      class: 'add-btn',
      onclick: e => openBulkAdd(e.currentTarget, plan, actions),
    }, '＋ まとめて追加（1 行 1 名）'),
  ));

  /* ---------- ペア制約 ---------- */
  root.append(h('div', { class: 'panel-head', style: { marginTop: '24px' } },
    h('h2', {}, 'ペアの決まりごと'),
    h('p', { class: 'hint' },
      '「新人は先輩と組ませる」「相性の悪い二人は離す」を表現します。'),
  ));
  const pairList = h('div', { class: 'pair-list' });
  for (const pr of plan.pairs) pairList.append(pairRow(pr, plan, actions));
  root.append(pairList);
  root.append(h('button', {
    class: 'add-btn',
    onclick: () => {
      if (plan.staff.length < 2) { toast('スタッフが 2 人以上必要です', 'warn'); return; }
      plan.pairs.push(makePair({
        type: 'together', hard: false,
        a: plan.staff[0].id, b: plan.staff[1].id,
      }));
      actions.changed('pairs');
    },
  }, '＋ ペアを追加'));
}

function openBulkAdd(anchor, plan, actions) {
  const ta = h('textarea', {
    rows: '8', placeholder: '佐藤\n鈴木\n高橋\n…\n（名簿からコピペできます）',
    style: { width: '240px', resize: 'vertical' },
  });
  popover(anchor, h('div', { class: 'bulk-add' },
    h('div', { class: 'picker-label' }, '1 行に 1 名ずつ：'),
    ta,
    h('div', { class: 'picker-row' },
      h('button', {
        class: 'primary',
        onclick: () => {
          const existing = new Set(plan.staff.map(s => s.name));
          const names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
          let added = 0;
          for (const name of names) {
            if (existing.has(name)) continue;   // 同名は重複させない
            plan.staff.push(makeStaff({ name }));
            existing.add(name);
            added++;
          }
          closePopover();
          toast(`${added} 名を追加しました`, added ? 'good' : 'warn');
          if (added) actions.changed('staff');
        },
      }, '追加する'))));
  ta.focus();
}

function staffCard(sf, plan, actions) {
  const reqCount = Object.keys(sf.requests).length;

  const numInput = (label, key, placeholder, title) =>
    h('label', { class: 'field', title },
      label,
      h('input', {
        type: 'number', min: '0', max: '31',
        value: sf[key] ?? '',
        placeholder,
        oninput: e => {
          const v = e.target.value;
          sf[key] = v === '' ? null : Math.max(0, parseInt(v, 10) || 0);
          actions.changed('staff', { soft: true });
        },
      }));

  return h('div', { class: 'card staff-card' },
    h('div', { class: 'card-row' },
      h('input', {
        class: 'name-input', value: sf.name,
        oninput: e => { sf.name = e.target.value; actions.changed('staff', { soft: true }); },
      }),
      h('input', {
        class: 'memo-input', value: sf.memo, placeholder: 'メモ（パート・新人など）',
        oninput: e => { sf.memo = e.target.value; actions.changed('staff', { soft: true }); },
      }),
      h('button', {
        class: 'icon-btn danger', title: 'このスタッフを削除',
        onclick: () => {
          if (!confirm(`${sf.name} を削除しますか？（割当も消えます）`)) return;
          plan.staff.splice(plan.staff.indexOf(sf), 1);
          delete plan.assign[sf.id];
          actions.changed('staff');
        },
      }, '✕'),
    ),
    h('div', { class: 'card-row wrap' },
      h('span', { class: 'field-label' }, '入れるシフト:'),
      ...plan.shiftTypes.map(st => h('label', { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: sf.canWork.length === 0 || sf.canWork.includes(st.id),
          onchange: e => {
            // 「全部チェック = 制限なし（空配列）」に正規化する
            let set = sf.canWork.length === 0
              ? new Set(plan.shiftTypes.map(s => s.id))
              : new Set(sf.canWork);
            if (e.target.checked) set.add(st.id); else set.delete(st.id);
            sf.canWork = set.size === plan.shiftTypes.length ? [] : [...set];
            actions.changed('staff', { soft: true });
          },
        }), st.name)),
    ),
    h('div', { class: 'card-row wrap' },
      numInput('週の上限', 'maxPerWeek', 'なし', '1 週間に入れる最大日数（パート向け）'),
      numInput('月の目標', 'targetPerMonth', '自動', '月の出勤日数の目標。空欄なら全体から自動計算'),
      numInput('連勤上限', 'maxConsecutive', `全体(${plan.rules.maxConsecutive})`, '個別の連勤上限。空欄なら全体設定'),
      numInput('夜勤上限', 'maxNightPerMonth', `全体(${plan.rules.maxNightPerMonth})`, '月の夜勤回数の個別上限'),
      h('span', { class: 'req-badge', title: '希望はシフト表のセルから入力します' },
        reqCount ? `希望 ${reqCount} 件` : '希望なし'),
    ),
  );
}

function pairRow(pr, plan, actions) {
  const staffSelect = key => h('select', {
    onchange: e => { pr[key] = e.target.value; actions.changed('pairs', { soft: true }); },
  }, ...plan.staff.map(sf =>
    h('option', { value: sf.id, selected: pr[key] === sf.id }, sf.name)));

  return h('div', { class: 'card pair-row' },
    staffSelect('a'),
    h('select', {
      onchange: e => {
        pr.type = e.target.value;
        pr.hard = pr.type === 'apart';
        actions.changed('pairs', { soft: true });
      },
    },
      h('option', { value: 'together', selected: pr.type === 'together' }, 'と、なるべく同じシフトに'),
      h('option', { value: 'apart', selected: pr.type === 'apart' }, 'と、同じシフトにしない'),
    ),
    staffSelect('b'),
    pr.type === 'apart' ? h('label', { class: 'check', title: '厳守 = 違反として扱う / 努力 = なるべく' },
      h('input', {
        type: 'checkbox', checked: pr.hard,
        onchange: e => { pr.hard = e.target.checked; actions.changed('pairs', { soft: true }); },
      }), '厳守') : null,
    h('button', {
      class: 'icon-btn danger',
      onclick: () => {
        plan.pairs.splice(plan.pairs.indexOf(pr), 1);
        actions.changed('pairs');
      },
    }, '✕'),
  );
}
