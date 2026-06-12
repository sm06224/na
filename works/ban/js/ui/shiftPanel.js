import { makeShiftType, shiftIsNight, shiftWorkMinutes } from '../core/model.js';
import { parseHM, WEEKDAY_JA } from '../core/time.js';
import { h, clear, toast } from './dom.js';

/* ============================================================
   シフト種別と必要人数 — 「何時から何時まで、毎日何人」を決める。
   ============================================================ */

const PALETTE = ['#e8b14f', '#6aa3d8', '#a48ad4', '#5a6e8c', '#6fbf8f', '#d88a8a', '#8ad0c9', '#c9a86a'];

export function renderShiftPanel(root, state, actions) {
  const { plan } = state;
  clear(root);

  root.append(h('div', { class: 'panel-head' },
    h('h2', {}, 'シフト種別と必要人数'),
    h('p', { class: 'hint' },
      '終了が開始より早い時刻なら日をまたぐ夜勤として扱います。必要人数は曜日ごとに。'),
  ));

  const list = h('div', { class: 'shift-list' });
  for (const st of plan.shiftTypes) list.append(shiftCard(st, plan, actions));
  root.append(list);

  root.append(h('button', {
    class: 'add-btn',
    onclick: () => {
      plan.shiftTypes.push(makeShiftType({
        name: `シフト${plan.shiftTypes.length + 1}`,
        short: '新',
        color: PALETTE[plan.shiftTypes.length % PALETTE.length],
      }));
      actions.changed('shift');
    },
  }, '＋ シフト種別を追加'));
}

function shiftCard(st, plan, actions) {
  const isNight = shiftIsNight(st);
  const hours = (shiftWorkMinutes(st) / 60).toFixed(1);

  const timeInput = key => h('input', {
    class: 'time-input', value: st[key], placeholder: 'HH:MM',
    oninput: e => {
      if (parseHM(e.target.value) !== null) {
        st[key] = e.target.value;
        e.target.classList.remove('invalid');
        actions.changed('shift', { soft: true });
      } else {
        e.target.classList.add('invalid');
      }
    },
  });

  /* 曜日ごとの必要人数 */
  const reqInputs = h('div', { class: 'req-grid' },
    ...st.required.map((n, wd) => h('label', {
      class: `req-day ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}`,
    },
      WEEKDAY_JA[wd],
      h('input', {
        type: 'number', min: '0', max: '99', value: n,
        oninput: e => {
          st.required[wd] = Math.max(0, parseInt(e.target.value, 10) || 0);
          actions.changed('shift', { soft: true });
        },
      }))));

  /* 特定日の上書き */
  const overrides = h('div', { class: 'override-list' },
    ...Object.entries(st.requiredOverride).map(([day, count]) =>
      h('span', { class: 'override-chip' },
        `${day}日: ${count}人`,
        h('button', {
          class: 'chip-x',
          onclick: () => {
            delete st.requiredOverride[day];
            actions.changed('shift');
          },
        }, '×'))),
    h('button', {
      class: 'mini-btn',
      onclick: () => {
        const day = prompt('日付（1〜31）— 行事や繁忙日に人数を変えたい日');
        if (!day) return;
        const d = parseInt(day, 10);
        if (!(d >= 1 && d <= 31)) { toast('1〜31 で入力してください', 'warn'); return; }
        const count = prompt(`${d}日に必要な人数`);
        if (count === null) return;
        st.requiredOverride[String(d)] = Math.max(0, parseInt(count, 10) || 0);
        actions.changed('shift');
      },
    }, '＋ 特定日の人数'));

  return h('div', { class: 'card shift-card' },
    h('div', { class: 'card-row' },
      h('input', {
        type: 'color', class: 'color-input', value: st.color,
        oninput: e => { st.color = e.target.value; actions.changed('shift', { soft: true }); },
      }),
      h('input', {
        class: 'name-input', value: st.name, title: 'シフト名',
        oninput: e => { st.name = e.target.value; actions.changed('shift', { soft: true }); },
      }),
      h('input', {
        class: 'short-input', value: st.short, maxlength: '2', title: '略称（表のセルに出る 1〜2 文字）',
        oninput: e => { st.short = e.target.value || '?'; actions.changed('shift', { soft: true }); },
      }),
      timeInput('start'), '〜', timeInput('end'),
      h('label', { class: 'field' }, '休憩(分)',
        h('input', {
          type: 'number', min: '0', max: '300', value: st.breakMin,
          oninput: e => {
            st.breakMin = Math.max(0, parseInt(e.target.value, 10) || 0);
            actions.changed('shift', { soft: true });
          },
        })),
      h('span', { class: `night-badge ${isNight ? 'on' : ''}` },
        isNight ? '🌙 夜勤扱い' : `実働 ${hours}h`),
      h('button', {
        class: 'icon-btn danger', title: 'このシフト種別を削除',
        onclick: () => {
          if (!confirm(`「${st.name}」を削除しますか？（この種別の割当も消えます）`)) return;
          plan.shiftTypes.splice(plan.shiftTypes.indexOf(st), 1);
          actions.changed('shift');
        },
      }, '✕'),
    ),
    h('div', { class: 'card-row' },
      h('span', { class: 'field-label' }, '必要人数:'),
      reqInputs),
    h('div', { class: 'card-row' }, overrides),
  );
}
