/* ============================================================
   割 — 立て替えを精算する。

   旅行や飲み会のあと、誰がいくら立て替え、誰が誰にいくら払えば
   貸し借りがゼロになるか。割り勘は等分とはかぎらない——飲まない
   人、子どもぶん、幹事多め…。重みつきで割り、端数は公平に配り、
   最後に**送金の回数が最小に近づくよう**まとめる。

   金額はすべて整数（円）。同じ入力からは、同じ精算。
   コアは DOM を知らない。
   ============================================================ */

/* 一件の出費を、参加者へ重みで割る。端数は小数部の大きい人から 1 円ずつ。
   amount: 整数, participants: id[], weights: {id:重み}（既定 1）
   返り値: Map id -> 負担額（整数・合計は amount に一致） */
export function splitExpense(amount, participants, weights = {}) {
  const owed = new Map();
  if (!participants.length || amount <= 0) {
    for (const id of participants) owed.set(id, 0);
    return owed;
  }
  const w = participants.map(id => Math.max(0, weights[id] ?? 1));
  const W = w.reduce((a, b) => a + b, 0);
  if (W <= 0) {                       // 全員 0 重み → 等分に倒す
    return splitExpense(amount, participants, {});
  }
  const exact = participants.map((id, i) => amount * w[i] / W);
  const base = exact.map(Math.floor);
  let rem = amount - base.reduce((a, b) => a + b, 0);
  // 小数部が大きい順（同じなら元の順）に 1 円ずつ配る
  const order = participants.map((id, i) => i)
    .sort((a, b) => (exact[b] - base[b]) - (exact[a] - base[a]) || a - b);
  for (let k = 0; k < rem; k++) base[order[k]]++;
  participants.forEach((id, i) => owed.set(id, base[i]));
  return owed;
}

/* 全員の差引残高：立て替えた額 − 負担した額。
   members: id[], expenses: [{payer, amount, participants, weights}]
   返り値: Map id -> 残高（＋＝受け取る / −＝払う・合計 0） */
export function computeBalances(members, expenses) {
  const bal = new Map(members.map(id => [id, 0]));
  for (const e of expenses) {
    if (!bal.has(e.payer)) continue;
    bal.set(e.payer, bal.get(e.payer) + e.amount);
    const owed = splitExpense(e.amount, e.participants.filter(id => bal.has(id)), e.weights);
    for (const [id, v] of owed) bal.set(id, bal.get(id) - v);
  }
  return bal;
}

/* 残高を、送金回数が少なくなるようまとめる（貪欲法：最大の貸しと最大の借りを
   繰り返し相殺）。返り値: [{from, to, amount}]（amount は正の整数）。 */
export function minimizeTransfers(balances) {
  const creditors = [], debtors = [];
  for (const [id, v] of balances) {
    if (v > 0) creditors.push({ id, v });
    else if (v < 0) debtors.push({ id, v: -v });
  }
  // 決定的に：額の大きい順、同額は id 順
  const byAmt = (a, b) => b.v - a.v || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  creditors.sort(byAmt); debtors.sort(byAmt);

  const transfers = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const m = Math.min(c.v, d.v);
    transfers.push({ from: d.id, to: c.id, amount: m });
    c.v -= m; d.v -= m;
    if (c.v === 0) ci++;
    if (d.v === 0) di++;
  }
  return transfers;
}

/* まとめて精算する。 */
export function settle(members, expenses) {
  const balances = computeBalances(members, expenses);
  const transfers = minimizeTransfers(balances);
  let total = 0;
  for (const e of expenses) total += e.amount;
  return { balances, transfers, total };
}
