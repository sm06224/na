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
export const DEF_LIFE = 5;                                  // 想定耐用年数（年）
export const DEF_RATE = 2;                                  // 割引率（%）

const valueOf = (it) => it.type === 'bus' ? DEF_VALUE._bus : it.type === 'hub' ? DEF_VALUE._hub
  : (DEF_VALUE[it.role] ?? DEF_VALUE._default);
const frOf = (it) => it.type === 'bus' ? DEF_FR._bus : it.type === 'hub' ? DEF_FR._hub
  : (DEF_FR[it.role] ?? DEF_FR._default);
// 冗長化コストの既定：CapEx（初期投資・一括）は価値の 1.5 倍、OpEx（年間運用費）は価値の 15%。
const capexOf = (value) => Math.max(30, Math.round(value * 1.5));
const opexOf = (value) => Math.max(5, Math.round(value * 0.15));

// 1 機器ぶんのパラメータ（明示があればそれ、無ければ推定）。
// 費用は CapEx（初期・一括）／OpEx（年間）に分離。旧 :cost は年間費用＝OpEx として後方互換。
export function params(it) {
  const v = it.value != null ? it.value : valueOf(it);
  const fr = it.failrate != null ? it.failrate : frOf(it);
  const mttr = it.mttr != null ? it.mttr : DEF_MTTR;
  const legacy = it.cost != null && it.capex == null && it.opex == null;   // 旧 :cost N → OpEx N
  const capex = it.capex != null ? it.capex : (legacy ? 0 : capexOf(v));
  const opex = it.opex != null ? it.opex : (legacy ? it.cost : opexOf(v));
  const benefit = it.benefit != null ? it.benefit : 0;      // その他の年間便益（可用性以外）
  return {
    value: v, failrate: fr, mttr, capex, opex, benefit,
    defaulted: { value: it.value == null, failrate: it.failrate == null, mttr: it.mttr == null,
      capex: it.capex == null && !legacy, opex: it.opex == null && !legacy, benefit: it.benefit == null },
  };
}

// 年金現価係数：毎年 1 を L 年、割引率 r（小数）で現在価値に。
const annuityFactor = (L, r) => r > 0 ? (1 - (1 + r) ** -L) / r : L;

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
  const altRoot = bcRoot(model, root);                              // 本部自身を落とす評価用の代替基準点
  const life = opts.life || model.meta?.bcLife || DEF_LIFE;         // 想定年数
  const rate = (opts.rate != null ? opts.rate : (model.meta?.bcRate != null ? model.meta.bcRate : DEF_RATE)) / 100;
  const af = annuityFactor(life, rate);                             // 年金現価係数
  const r1 = (x) => Math.round(x * 10) / 10;
  const itemOf = new Map(model.items.map((x) => [x.id, x]));
  const par = new Map(ids.map((id) => [id, params(itemOf.get(id) || {})]));
  const valueTotal = ids.reduce((s, id) => s + par.get(id).value, 0);
  const rows = [];
  let eal = 0;
  for (const id of ids) {
    const it = itemOf.get(id); if (!it) continue;
    const p = par.get(id);
    const ref = id === root ? altRoot : root;
    const reach = ref ? reachableFrom(model, ref, [id]) : new Set();
    let impactVal = 0, impactCnt = 0;
    for (const other of ids) {
      if (other === id) continue;
      if (!reach.has(other)) { impactVal += par.get(other).value; impactCnt++; }
    }
    impactVal += p.value;                                           // 自身の停止も損失
    const avoided = p.failrate * (p.mttr / 24) * impactVal;         // 冗長化で回避できる年間損失（万円/年）
    const annualBenefit = avoided + p.benefit;                      // ＋その他便益（可用性以外）
    // 割引現在価値でのベネフィット/コスト。CapEx は初期一括、OpEx は毎年。
    const pvBenefit = annualBenefit * af;
    const pvCost = p.capex + p.opex * af;
    const npv = pvBenefit - pvCost;                                 // 正味現在価値（万円）
    const bc = pvCost > 0 ? pvBenefit / pvCost : (pvBenefit > 0 ? Infinity : 0);
    const net = annualBenefit - p.opex;                             // 年間の手残り
    const payback = net > 0 ? p.capex / net : Infinity;            // 回収年
    eal += avoided;
    rows.push({ id, label: it.label || id, role: it.role || (it.type === 'bus' ? 'bus' : it.type === 'hub' ? 'hub' : ''),
      impactCnt, impactVal: Math.round(impactVal),
      avoided: r1(avoided), benefit: p.benefit, annualBenefit: r1(annualBenefit),
      capex: p.capex, opex: p.opex, npv: Math.round(npv), bc: Math.round(bc * 100) / 100,
      payback: payback === Infinity ? null : r1(payback),
      defaulted: p.defaulted, value: p.value, failrate: p.failrate, mttr: p.mttr });
  }
  rows.sort((a, b) => b.npv - a.npv || b.bc - a.bc || a.id.localeCompare(b.id));   // NPV 順（正味の効き）
  const worth = rows.filter((r) => r.npv > 0);                      // NPV 黒字＝やる価値のある対策
  return {
    root, rows, life, rate: rate * 100, valueTotal: Math.round(valueTotal),
    eal: r1(eal),                                                   // 現状の年間期待損失（万円/年）
    capexTotal: worth.reduce((s, r) => s + r.capex, 0),             // 必要な初期投資合計
    opexTotal: worth.reduce((s, r) => s + r.opex, 0),               // 年間運用費合計
    npvTotal: worth.reduce((s, r) => s + r.npv, 0),                 // ポートフォリオ NPV
    portfolioBC: (() => {
      const pvB = worth.reduce((s, r) => s + r.annualBenefit * af, 0);
      const pvC = worth.reduce((s, r) => s + r.capex + r.opex * af, 0);
      return pvC > 0 ? Math.round(pvB / pvC * 100) / 100 : 0;
    })(),
  };
}
