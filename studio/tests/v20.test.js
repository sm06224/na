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

test('params: 明示があればそれ・無ければ役割から推定（defaulted 印）', () => {
  const explicit = params({ role: 'server', value: 500, cost: 99 });
  assert.equal(explicit.value, 500);
  assert.equal(explicit.defaulted.value, false);
  assert.equal(explicit.defaulted.failrate, true);          // 未指定は推定
  const def = params({ role: 'core' });
  assert.ok(def.value > 0 && def.cost > 0 && def.failrate > 0);
  assert.equal(def.defaulted.value, true);
});

test('costBenefit: 単一障害点を B/C でランクし、投資すべき対策を上に出す', () => {
  const m = parse(BCP);
  const r = costBenefit(m);
  // 基準点はコア級（役割優先）
  const rootIt = m.items.find((x) => x.id === r.root);
  assert.equal(rootIt.role, 'core');
  // 支社スイッチ：op1+op2 を巻き込む SPOF、故障率高く対策安い → B/C 最上位で 1 超
  const osw = r.rows.find((x) => x.id === 'osw');
  assert.equal(osw.impactCnt, 2, '受注サーバ＋出荷端末を巻き込む');
  assert.equal(osw.impactVal, 420, '150+180+90');
  // 年損失 = failrate 1.0 × (8/24 日) × 420 = 140
  assert.ok(Math.abs(osw.annualLoss - 140) < 0.5, `年損失 ${osw.annualLoss}`);
  assert.ok(Math.abs(osw.bc - 140 / 30) < 0.05, `B/C ${osw.bc}`);
  assert.equal(r.rows[0].id, 'osw', 'B/C 最上位');
  assert.ok(r.rows[0].bc >= 1, '投資する価値がある');
  // ポートフォリオ：B/C≧1 を全部打つ＝osw だけ、投資30→回収140
  assert.equal(r.invest, 30);
  assert.ok(r.recover >= 140 && r.portfolioBC > 4);
  assert.ok(r.eal > 0, '現状の年間期待損失');
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
