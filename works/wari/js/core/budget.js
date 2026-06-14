/* ============================================================
   計画 — 会費をいくら集める？

   費用は二種類。
     ・人数割（×人数）：料理・飲み放題など、頭数ぶんかかるもの
     ・一式（1回きり）：会場代・花代など、人数に関わらず一度きりのもの
   主賓（送られる人）は無料にでき、その分はみんなで肩代わりする
   ＝払う人で頭割りするので、通常の人の会費が少し上がる。

   金額はすべて整数（円）。同じ入力からは、同じ見積り。DOM 非依存。
   ============================================================ */

/* items: [{kind:'per'|'fixed', amount}]
   headcount: 参加人数（主賓も含む・人数割はこの頭数ぶん）
   freeGuests: 主賓（無料）の人数。払うのは headcount − freeGuests 人
   roundTo: 会費の切り上げ単位（0 なら 1 円単位） */
export function planBudget({ headcount = 0, freeGuests = 0, items = [], roundTo = 0 } = {}) {
  const N = Math.max(0, Math.floor(headcount));
  const free = Math.max(0, Math.min(N, Math.floor(freeGuests)));
  const payers = N - free;

  let perUnit = 0, fixed = 0;
  for (const it of items) {
    const a = Math.max(0, Math.round(it.amount || 0));
    if (it.kind === 'per') perUnit += a; else fixed += a;
  }
  const perTotal = perUnit * N;          // 人数割は全員ぶん（主賓も食べる）
  const total = perTotal + fixed;

  const rawFee = payers > 0 ? total / payers : 0;
  const unit = roundTo > 0 ? roundTo : 1;
  const fee = payers > 0 ? Math.ceil(rawFee / unit) * unit : 0;   // 集めやすい額へ切り上げ
  const collected = fee * payers;
  const surplus = collected - total;     // 集めすぎ（＋）＝余り

  return { headcount: N, freeGuests: free, payers, perUnit, perTotal, fixed, total, rawFee, fee, collected, surplus };
}
