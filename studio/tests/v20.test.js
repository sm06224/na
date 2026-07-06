/* ============================================================
   v20 の検証：投資対効果（B/C）。純粋エンジン。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { serialize } from '../engine/serialize.js';
import { costBenefit, params, bcRoot } from '../engine/costben.js';

const BCP = `infra
    zone 本社 {
      core[基幹コア] :core, value 200
      db[基幹DB] :db, value 400
      bus lan[本社LAN] :vlan 10, 10.0.0.0/24
    }
    zone 大阪支社 {
      osw[支社スイッチ] :access, value 150, failrate 1.0, cost 30, mttr 8
      op1[受注サーバ] :server, value 180
      op2[出荷端末群] :pc, value 90
    }
    hub wan[広域WAN] :cost 50
    core -- lan
    db -- lan
    core -- wan :幹線
    osw -- wan :専用線
    op1 -- osw
    op2 -- osw`;

test('B/C 属性 value/cost/failrate/mttr が読めて往復する', () => {
  const m = parse(BCP);
  assert.equal(m.errors.length, 0, m.errors.join('/'));
  const osw = m.items.find((x) => x.id === 'osw');
  assert.deepEqual([osw.value, osw.cost, osw.failrate, osw.mttr], [150, 30, 1.0, 8]);
  const s = serialize(m);
  assert.ok(s.includes('value 150') && s.includes('cost 30') && s.includes('failrate 1') && s.includes('mttr 8'), s);
  assert.equal(serialize(parse(s)), s, '不動点');
  // fr エイリアス
  const m2 = parse('infra\n  a[A] :server, fr 0.5');
  assert.equal(m2.items[0].failrate, 0.5);
});

test('params: 明示があればそれ・無ければ役割から推定（旧 :cost は OpEx として後方互換）', () => {
  const explicit = params({ role: 'server', value: 500, capex: 300, opex: 40 });
  assert.equal(explicit.value, 500);
  assert.deepEqual([explicit.capex, explicit.opex], [300, 40]);
  assert.equal(explicit.defaulted.value, false);
  assert.equal(explicit.defaulted.failrate, true);          // 未指定は推定
  const legacy = params({ role: 'server', value: 500, cost: 99 });
  assert.deepEqual([legacy.capex, legacy.opex], [0, 99], '旧 :cost N → CapEx 0 / OpEx N');
  const def = params({ role: 'core' });
  assert.ok(def.value > 0 && def.capex > 0 && def.opex > 0 && def.failrate > 0);
  assert.equal(def.defaulted.value, true);
});

test('costBenefit: 単一障害点を評価し、NPV/BC/回収年で投資すべき対策を上に出す', () => {
  const m = parse(BCP);
  const r = costBenefit(m);
  // 基準点はコア級（役割優先）
  const rootIt = m.items.find((x) => x.id === r.root);
  assert.equal(rootIt.role, 'core');
  // 支社スイッチ：op1+op2 を巻き込む SPOF（cost 30 は旧記法＝OpEx 30・CapEx 0）
  const osw = r.rows.find((x) => x.id === 'osw');
  assert.equal(osw.impactCnt, 2, '受注サーバ＋出荷端末を巻き込む');
  assert.equal(osw.impactVal, 420, '150+180+90');
  // 回避できる年損失 = failrate 1.0 × (8/24 日) × 420 = 140
  assert.ok(Math.abs(osw.avoided - 140) < 0.5, `回避 ${osw.avoided}`);
  assert.equal(osw.capex, 0);
  assert.equal(osw.opex, 30);
  assert.ok(osw.npv > 0, `NPV ${osw.npv}`);
  assert.equal(r.rows[0].id, 'osw', 'NPV 最上位');
  // ポートフォリオ：NPV 黒字＝osw だけ
  assert.ok(r.npvTotal > 0 && r.portfolioBC > 1);
  assert.ok(r.eal > 0, '現状の年間期待損失');
  assert.ok(r.life > 0 && r.rate >= 0, '想定年数・割引率');
});

test('costBenefit: 決定的（同じ入力→同じ結果）', () => {
  const m = parse(BCP);
  assert.deepEqual(costBenefit(m), costBenefit(m));
});

test('costBenefit: 空でも落ちない・葉ノードは影響が自分の価値のみ', () => {
  const m = parse('infra\n  a[A] :server, value 100\n  b[B] :pc, value 10\n  a -- b');
  const r = costBenefit(m);
  const b = r.rows.find((x) => x.id === 'b');
  assert.equal(b.impactCnt, 0, '葉は誰も巻き込まない');
  assert.equal(b.impactVal, 10, '自分の価値だけ');
});

test('v21: CapEx/OpEx/その他便益と NPV・回収年・割引（%% bc life/rate）', () => {
  const D = `infra
    zone z {
      a[SPOF] :access, value 150, failrate 1.0, capex 120, opex 20, benefit 10, mttr 8
      b[srv] :server, value 180
      c[pc] :pc, value 90
    }
    hub w[WAN]
    a -- w
    b -- a
    c -- a

%% @layout
%% bc life 6 rate 3`;
  const m = parse(D);
  assert.equal(m.meta.bcLife, 6);
  assert.equal(m.meta.bcRate, 3);
  assert.ok(serialize(m).includes('%% bc life 6 rate 3'));
  const r = costBenefit(m);
  assert.equal(r.life, 6);
  assert.equal(r.rate, 3);
  const a = r.rows.find((x) => x.id === 'a');
  assert.equal(a.capex, 120);
  assert.equal(a.opex, 20);
  assert.equal(a.benefit, 10);
  assert.ok(Math.abs(a.annualBenefit - (a.avoided + 10)) < 0.05, '年便益＝回避＋その他');
  // NPV = 年便益×AF(6,3%) − (capex + opex×AF)。AF≈5.417
  const af = (1 - 1.03 ** -6) / 0.03;
  const npv = a.annualBenefit * af - (120 + 20 * af);
  assert.ok(Math.abs(a.npv - Math.round(npv)) <= 1, `NPV ${a.npv} vs ${Math.round(npv)}`);
  // 回収年 = capex / (年便益 − opex)
  assert.ok(Math.abs(a.payback - 120 / (a.annualBenefit - 20)) < 0.05, `回収年 ${a.payback}`);
  assert.ok(a.npv > 0 && a.bc > 1, '黒字');
  // 割引率を上げると NPV は下がる
  const r2 = costBenefit(m, { rate: 10 });
  const a2 = r2.rows.find((x) => x.id === 'a');
  assert.ok(a2.npv < a.npv, '割引率↑で NPV↓');
});

test('v21: opex 明示より旧 cost が優先されない（capex/opex があれば legacy 無効）', () => {
  const m = parse('infra\n  a[A] :server, value 100, cost 50, capex 200, opex 30\n  b[B] :pc\n  a -- b');
  const p = costBenefit(m).rows.find((x) => x.id === 'a');
  assert.deepEqual([p.capex, p.opex], [200, 30], 'capex/opex 明示が勝つ');
});
