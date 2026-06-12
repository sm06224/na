/* ============================================================
   手 — 鍵盤を十字とボタンに写す。

   矢印=十字 Z=A X=B Enter=開始 Shift=選択。
   画面（かその中）に焦点があるあいだだけ聞く。よそでの
   打鍵まで吸い込むほど、この機械は欲張りではない。
   ============================================================ */

const MAP = {
  ArrowUp: 1, ArrowDown: 2, ArrowLeft: 4, ArrowRight: 8,
  KeyZ: 16, KeyX: 32,
  Enter: 64, NumpadEnter: 64,
  ShiftLeft: 128, ShiftRight: 128,
};

export function createPad(el) {
  let mask = 0;

  el.addEventListener('keydown', e => {
    const b = MAP[e.code];
    if (!b) return;
    mask |= b;
    e.preventDefault();
  });
  el.addEventListener('keyup', e => {
    const b = MAP[e.code];
    if (!b) return;
    mask &= ~b;
    e.preventDefault();
  });
  /* 焦点が離れたら、すべての指を離したことにする */
  el.addEventListener('focusout', () => { mask = 0; });
  window.addEventListener('blur', () => { mask = 0; });

  return {
    get mask() { return mask; },
    /* 画面（かその子）に焦点があるか */
    get active() {
      const a = document.activeElement;
      return a === el || el.contains(a);
    },
  };
}
