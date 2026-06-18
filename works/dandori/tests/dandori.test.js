import test from 'node:test';
import assert from 'node:assert/strict';
import {
  step, needs, isIdle, totalMin, makeDish, PRESETS, presetById,
} from '../js/core/dishes.js';
import {
  schedule, hhmm, parseHHMM, activeAt, nextAfter, DEFAULT_KITCHEN,
} from '../js/core/schedule.js';

const at = (s) => parseHHMM(s);

/* 検証の助け：計画の不変条件をまとめて確かめる。 */
function checkInvariants(plan, kitchen) {
  const cap = { hands: kitchen.cooks, heat: kitchen.burners, oven: kitchen.ovens };
  // 各分の資源使用量を数え、容量を超えないこと
  const useAt = (res, m) => {
    let n = 0;
    for (const e of plan.events) if (e.res.includes(res) && e.at <= m && m < e.end) n++;
    return n;
  };
  let lo = Infinity, hi = -Infinity;
  for (const e of plan.events) { lo = Math.min(lo, e.at); hi = Math.max(hi, e.end); }
  for (let m = lo; m < hi; m++) {
    for (const r of ['hands', 'heat', 'oven']) {
      assert.ok(useAt(r, m) <= cap[r], `${hhmm(m)}: ${r} が容量 ${cap[r]} を超えた（${useAt(r, m)}）`);
    }
  }
  // 工程は配膳より後に終わらない
  for (const d of plan.dishes) for (const s of d.steps) {
    assert.ok(s.end <= plan.serve, `${d.name}/${s.name} が配膳(${hhmm(plan.serve)})より後に終わる`);
  }
}

test('時刻の変換：H:MM ⇄ 分', () => {
  assert.equal(at('18:00'), 1080);
  assert.equal(at('9:05'), 545);
  assert.equal(hhmm(1080), '18:00');
  assert.equal(hhmm(545), '9:05');
  assert.equal(parseHHMM('25:61'), null);
  assert.equal(parseHHMM('わ'), null);
});

test('一品だけなら、最後の工程はちょうど配膳時刻に終わる', () => {
  const miso = presetById.miso;
  const serve = at('18:00');
  const plan = schedule([miso], { serve, kitchen: { cooks: 1, burners: 2, ovens: 1 } });
  const d = plan.dishes[0];
  assert.equal(d.steps[d.steps.length - 1].end, serve, '最後の工程が配膳に着地しない');
  assert.equal(d.wait, 0, '待ち時間ゼロ＝熱いうち');
  // 工程は順番どおり・分は保たれる
  for (let i = 0; i < d.steps.length; i++) {
    assert.equal(d.steps[i].min, miso.steps[i].min, '分が変わった');
    if (i > 0) assert.ok(d.steps[i].start >= d.steps[i - 1].end, '工程の順序が崩れた');
  }
});

test('決定的：同じ献立・同じ台所なら、寸分たがわぬ段取り', () => {
  const dishes = [presetById.gohan, presetById.miso, presetById.karaage];
  const opt = { serve: at('19:00'), kitchen: { cooks: 1, burners: 2, ovens: 1 } };
  const a = schedule(dishes, opt), b = schedule(dishes, opt);
  assert.deepEqual(a.events, b.events);
  assert.equal(a.startAt, b.startAt);
});

test('資源を溢れさせない：手は一度に一つ、こんろもオーブンも口数まで', () => {
  const dishes = [presetById.karaage, presetById.nikujaga, presetById.miso, presetById.dashimaki];
  const kitchen = { cooks: 1, burners: 2, ovens: 1 };
  const plan = schedule(dishes, { serve: at('18:30'), kitchen });
  checkInvariants(plan, kitchen);
  // 手は一人なので、どの瞬間も hands を要する工程は高々ひとつ
  for (let m = plan.startAt; m < plan.serve; m++) {
    const hands = plan.events.filter(e => e.res.includes('hands') && e.at <= m && m < e.end).length;
    assert.ok(hands <= 1, `${hhmm(m)}: 一人なのに手が ${hands} つ要る`);
  }
});

test('放置できる工程（炊飯・煮込み）は資源を食わない＝重なってよい', () => {
  // ご飯の「炊く」「蒸らす」と、肉じゃがの「煮る」は idle/heat。炊飯は idle。
  assert.ok(isIdle(presetById.gohan.steps[1]), '炊くは放置できるはず');
  assert.ok(isIdle(presetById.gohan.steps[2]), '蒸らすは放置できるはず');
  // ご飯を二つ同時でも、炊飯は手も火も食わないので両立する（資源は溢れない）
  const kitchen = { cooks: 1, burners: 1, ovens: 1 };
  const plan = schedule([presetById.gohan, { ...presetById.gohan, id: 'gohan2', name: 'ご飯2' }], { serve: at('18:00'), kitchen });
  checkInvariants(plan, kitchen);
  assert.equal(plan.warnings.length, 0, '炊飯が二つでも段取りは成立するはず');
});

test('こんろを増やすと、開始を遅らせられる（早く始めずに済む）', () => {
  const dishes = [presetById.nikujaga, presetById.curry, presetById.soup, presetById.miso];
  const serve = at('19:00');
  const one = schedule(dishes, { serve, kitchen: { cooks: 1, burners: 1, ovens: 1 } });
  const three = schedule(dishes, { serve, kitchen: { cooks: 2, burners: 3, ovens: 1 } });
  assert.ok(three.startAt >= one.startAt, '資源が多いほうが遅く始められるはず');
  checkInvariants(one, { cooks: 1, burners: 1, ovens: 1 });
  checkInvariants(three, { cooks: 2, burners: 3, ovens: 1 });
});

test('オーブンが無い（0台）と、グリル料理は置けず警告が出る', () => {
  const plan = schedule([presetById.yakizakana], { serve: at('18:00'), kitchen: { cooks: 1, burners: 2, ovens: 0 } });
  assert.ok(plan.warnings.length >= 1, '置けない品に警告が出るはず');
  assert.equal(plan.dishes.length, 0, '焼き魚は置けない');
});

test('行事リストは時刻順、startAt は最初の着手', () => {
  const plan = schedule([presetById.karaage, presetById.salad], { serve: at('18:00') });
  for (let i = 1; i < plan.events.length; i++) assert.ok(plan.events[i].at >= plan.events[i - 1].at, '時刻順でない');
  assert.equal(plan.startAt, plan.events[0].at);
  // 唐揚げは最後の工程（油を切る）が配膳に着地し、揚げはその直前＝終盤に来る
  const karaage = plan.dishes.find(d => d.name === '唐揚げ');
  assert.equal(karaage.wait, 0, '唐揚げが配膳ちょうどに仕上がらない');
  const fry = plan.events.find(e => e.name === '揚げる');
  assert.ok(plan.serve - fry.end <= 10, '揚げが終盤に来ていない');
});

test('live：いまやること／次の一手が拾える', () => {
  const plan = schedule([presetById.nikujaga], { serve: at('18:00') });
  const first = plan.events[0];
  const now = first.at;
  const active = activeAt(plan, now);
  assert.ok(active.some(e => e.name === first.name), 'いま着手すべき工程が拾えない');
  const nxt = nextAfter(plan, now + first.min);
  assert.ok(nxt && nxt.at >= now + first.min, '次の一手が拾えない');
});

test('プリセットは健全：工程は正の分、名前つき、総和が一致', () => {
  for (const d of PRESETS) {
    assert.ok(d.steps.length >= 1);
    let sum = 0;
    for (const s of d.steps) {
      assert.ok(s.min > 0 && Number.isFinite(s.min));
      assert.ok(typeof s.name === 'string' && s.name.length > 0);
      sum += s.min;
    }
    assert.equal(totalMin(d), sum);
  }
});
