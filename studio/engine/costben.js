/* ============================================================
   costben — 投資対効果（ベネフィット/コスト比）。純粋（DOM 非依存・決定的）。

   BCP の問い「どこに冗長化のカネをかけると一番効くか」に数字で答える。

   考え方（単一障害の年間期待損失モデル）:
     ある機器 X が落ちると、X を通らないと本部（基準点）に届かなくなる機器群が
     業務停止になる。その業務価値の合計を X の「影響 impact(X)」とする。
       影響額 = Σ value(到達不能になった機器)          … 万円/日（停止1日あたり）
       年間期待損失 EAL(X) = failrate(X) × (mttr/24 日) × 影響額   … 万円/年
     X を冗長化すれば、X が1台落ちても迂回できるので EAL(X) はほぼ消える。
       ベネフィット(X) = EAL(X)（回収できる年間損失）
       コスト(X)       = cost(X)（冗長化の年間費用）
       B/C(X)          = ベネフィット / コスト
     B/C が高い順に投資すべき。B/C > 1 なら「かけた以上に返る」。

   属性（DSL の :attrs、未指定は役割から推定＝defaulted 印つき）:
     :value N    業務停止1日あたりの損失（万円/日）
     :cost N     冗長化の年間費用（万円/年）
     :failrate N 年間の想定故障回数（回/年）  … fr N でも可
     :mttr N     復旧までの時間（時間）

   すべて「概算・参考」。前提（value/failrate）は現場が入れてこそ意味を持つ。
   ============================================================ */
import { reachableFrom, netNodeIds, netGraph } from './path.js';

// 役割ごとの既定値。金額は万円、故障率は回/年、mttr は時間。
const DEF_VALUE = {                                          // 停止1日あたりの業務損失（万円/日）
  core: 120, dist: 80, router: 100, firewall: 90, server: 50, db: 120, storage: 60,
  lb: 40, cloud: 60, switch: 30, access: 25, ap: 8, pc: 4, printer: 3,
  scada: 90, plc: 70, hmi: 30, historian: 50, ews: 30, sensor: 10, drive: 25,
  robot: 40, cnc: 40, sis: 150, gateway: 30, rtu: 40, dcs: 80, diode: 30,
  _bus: 90, _hub: 110, _default: 20,
};
const DEF_FR = {                                            // 年間故障率（回/年）
  router: 0.2, firewall: 0.15, wan: 0.2, sensor: 0.15, drive: 0.15, robot: 0.12,
  pc: 0.05, printer: 0.05, _bus: 0.12, _hub: 0.15, _default: 0.1,
};
const DEF_MTTR = 4;                                         // 復旧時間（時間）

const valueOf = (it) => it.type === 'bus' ? DEF_VALUE._bus : it.type === 'hub' ? DEF_VALUE._hub
  : (DEF_VALUE[it.role] ?? DEF_VALUE._default);
const frOf = (it) => it.type === 'bus' ? DEF_FR._bus : it.type === 'hub' ? DEF_FR._hub
  : (DEF_FR[it.role] ?? DEF_FR._default);
// 冗長化の年間費用（既定）：価値に比例させ、最低 10 万円/年。現場が :cost で上書きする前提。
const costOf = (it, value) => Math.max(10, Math.round(value * 0.4));

// 1 機器ぶんのパラメータ（明示があればそれ、無ければ推定）。
export function params(it) {
  const v = it.value != null ? it.value : valueOf(it);
  const fr = it.failrate != null ? it.failrate : frOf(it);
  const mttr = it.mttr != null ? it.mttr : DEF_MTTR;
  const cost = it.cost != null ? it.cost : costOf(it, v);
  return {
    value: v, failrate: fr, mttr, cost,
    defaulted: { value: it.value == null, failrate: it.failrate == null, mttr: it.mttr == null, cost: it.cost == null },
  };
}

// 基準点（本部）：コア級の役割を優先し、次に次数の高い頂点。到達性はここから測る。
const ROOT_PRIO = { core: 3, dist: 2, router: 2, firewall: 2, switch: 1, _hub: 1 };
const rootScore = (it) => (it ? (it.type === 'hub' ? ROOT_PRIO._hub : (ROOT_PRIO[it.role] || 0)) : 0);
export function bcRoot(model, exclude = null) {
  const deg = new Map();
  for (const e of model.edges) if (!e.rel) { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); }
  const itemOf = new Map(model.items.map((x) => [x.id, x]));
  return netNodeIds(model).filter((id) => id !== exclude).sort((a, b) =>
    rootScore(itemOf.get(b)) - rootScore(itemOf.get(a))
    || (deg.get(b) || 0) - (deg.get(a) || 0) || a.localeCompare(b))[0] || null;
}

export function costBenefit(model, opts = {}) {
  const ids = netNodeIds(model);
  const root = opts.root || bcRoot(model);
  // 本部そのものを落とす評価では、次点のコア級を代替基準点にする。
  const altRoot = bcRoot(model, root);
  const itemOf = new Map(model.items.map((x) => [x.id, x]));
  const par = new Map(ids.map((id) => [id, params(itemOf.get(id) || {})]));
  const valueTotal = ids.reduce((s, id) => s + par.get(id).value, 0);
  const rows = [];
  let eal = 0;
  for (const id of ids) {
    const it = itemOf.get(id); if (!it) continue;
    const p = par.get(id);
    // id を落としたとき本部から到達不能になる機器（id 自身は除く）。
    const ref = id === root ? altRoot : root;
    const reach = ref ? reachableFrom(model, ref, [id]) : new Set();
    let impactVal = 0, impactCnt = 0;
    for (const other of ids) {
      if (other === id) continue;
      if (!reach.has(other)) { impactVal += par.get(other).value; impactCnt++; }
    }
    // id 自身の停止も損失（機能が止まる）。冗長化で救えるのはこの分＋巻き添え。
    impactVal += p.value;
    const annualLoss = p.failrate * (p.mttr / 24) * impactVal;       // 万円/年
    const bc = p.cost > 0 ? annualLoss / p.cost : Infinity;
    eal += annualLoss;
    rows.push({ id, label: it.label || id, role: it.role || (it.type === 'bus' ? 'bus' : it.type === 'hub' ? 'hub' : ''),
      impactCnt, impactVal: Math.round(impactVal), annualLoss: Math.round(annualLoss * 10) / 10,
      cost: p.cost, bc: Math.round(bc * 100) / 100, defaulted: p.defaulted,
      value: p.value, failrate: p.failrate, mttr: p.mttr });
  }
  rows.sort((a, b) => b.bc - a.bc || b.annualLoss - a.annualLoss || a.id.localeCompare(b.id));
  const worth = rows.filter((r) => r.bc >= 1);                       // 投資する価値のある対策
  const invest = worth.reduce((s, r) => s + r.cost, 0);
  const recover = worth.reduce((s, r) => s + r.annualLoss, 0);
  return {
    root, rows, valueTotal: Math.round(valueTotal),
    eal: Math.round(eal * 10) / 10,                                   // 現状の年間期待損失（万円/年）
    invest, recover: Math.round(recover * 10) / 10,
    portfolioBC: invest > 0 ? Math.round(recover / invest * 100) / 100 : 0,
  };
}
