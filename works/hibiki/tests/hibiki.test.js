import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cast, castObject, strike, describe, degreeHz, midiToHz, noteName,
  SCALES, SCALE_IDS, KINDS, KIND_IDS, CLASS_RING, ensembleName,
  mulberry32, hashSeed,
} from '../js/core/hibiki.js';

const sr = 8000;   // テストは軽い標本化率で速く回す

test('種は決定的：同じ種なら寸分たがわぬ組、同じ波形', () => {
  const a = cast('hello'), b = cast('hello');
  assert.deepEqual(JSON.stringify(a.objects), JSON.stringify(b.objects));
  assert.equal(a.kindId, b.kindId);
  assert.equal(a.scaleId, b.scaleId);
  const wa = strike(a.objects[0], { sampleRate: sr, seed: 'hello' });
  const wb = strike(b.objects[0], { sampleRate: sr, seed: 'hello' });
  assert.deepEqual(Array.from(wa), Array.from(wb));
  // 一文字変えれば別の組（材質か音階か根音か、どこかが変わる）
  const c = cast('hellp');
  assert.notEqual(
    a.kindId + a.scaleId + a.rootMidi + a.objects.length,
    c.kindId + c.scaleId + c.rootMidi + c.objects.length,
  );
  // 数値の種でも安定
  assert.equal(cast(20260617).name, cast(20260617).name);
});

test('語彙は既知：材質も音階も、登録されたものだけ', () => {
  for (const seed of ['a', 'b', 'c', 'oto', 12345, 'kane']) {
    const e = cast(seed);
    assert.ok(KIND_IDS.includes(e.kindId), `未知の材質 ${e.kindId}`);
    assert.ok(SCALE_IDS.includes(e.scaleId), `未知の音階 ${e.scaleId}`);
    assert.ok(e.objects.length >= 6 && e.objects.length <= 8);
  }
});

test('モーダル：基音から昇順、有限・正、[0] は基音そのもの', () => {
  for (const kind of KIND_IDS) {
    const obj = castObject(kind, 60, SCALES.yo, 0, 0);
    assert.equal(obj.modes[0].f, obj.fundamental, `${kind}: 第1モードは基音`);
    for (let i = 0; i < obj.modes.length; i++) {
      const m = obj.modes[i];
      assert.ok(Number.isFinite(m.f) && m.f > 0, `${kind}: 周波数 ${m.f}`);
      assert.ok(Number.isFinite(m.a) && m.a > 0, `${kind}: 振幅 ${m.a}`);
      assert.ok(Number.isFinite(m.d) && m.d > 0, `${kind}: 減衰 ${m.d}`);
      if (i > 0) assert.ok(m.f > obj.modes[i - 1].f, `${kind}: 周波数は昇順`);
    }
    assert.equal(obj.modes[0].a, 1, `${kind}: 基音の振幅は正規化で 1`);
  }
});

test('五音の約束：すべての物の基音は、音階の五音のどれか（だから濁らない）', () => {
  for (const scaleId of SCALE_IDS) {
    const scale = SCALES[scaleId];
    const classes = new Set(scale.steps.map(s => ((s % 12) + 12) % 12));
    const root = 60;
    for (let deg = 0; deg < 16; deg++) {
      const hz = degreeHz(root, scale, deg);
      // hz を半音に戻して、音階の音度集合に含まれるか
      const semi = Math.round(12 * Math.log2(hz / midiToHz(root)));
      assert.ok(classes.has(((semi % 12) + 12) % 12),
        `${scaleId} deg${deg}: 半音 ${semi} が五音の外`);
    }
  }
});

test('材質の永さ：金・硝子は永く、木は短く、石はもっと短い', () => {
  const t = id => KINDS[id].t60;
  assert.ok(t('hachi') > t('kane'), '鉢は鐘より永い（うたう鉢）');
  assert.ok(t('kane') > t('ki'), '鐘は木より永い');
  assert.ok(t('ki') > t('ishi'), '木は石より永い');
  // 序列の表とも整合
  assert.ok(CLASS_RING.metal > CLASS_RING.wood);
  assert.ok(CLASS_RING.wood > CLASS_RING.stone);
});

test('打鍵の波形：有限・無クリップ([-1,1])・正しい長さ・頭で鳴り尾で消える', () => {
  const e = cast('bell-test', { kind: 'kane' });
  const obj = e.objects[0];
  const secs = 1.5;
  const w = strike(obj, { sampleRate: sr, seconds: secs, seed: 'k' });
  assert.equal(w.length, Math.floor(sr * secs));
  let peak = 0;
  for (const v of w) { assert.ok(Number.isFinite(v), '非有限の標本'); if (Math.abs(v) > peak) peak = Math.abs(v); }
  assert.ok(peak <= 1.0000001 && peak > 0.5, `ピークは正規化済み (${peak})`);
  // 頭の方が尾より大きい（減衰している）
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += w[i] * w[i]; return Math.sqrt(s / (b - a)); };
  const head = rms(0, (sr * 0.1) | 0);
  const tail = rms(w.length - (sr * 0.1 | 0), w.length);
  assert.ok(head > tail * 4, `頭(${head.toFixed(3)})は尾(${tail.toFixed(3)})よりずっと大きい`);
});

test('強弱：強く叩くほど高次が立つ（明るい）。鳴り出しは無音から（クリックしない）', () => {
  const e = cast('vel', { kind: 'hachi' });
  const obj = e.objects[2];
  const soft = strike(obj, { sampleRate: sr, velocity: 0.3, seconds: 1, seed: 'v' });
  const hard = strike(obj, { sampleRate: sr, velocity: 1.0, seconds: 1, seed: 'v' });
  // 高周波エネルギーの比（隣接差分の二乗和＝高域の代理）で明るさを測る
  const bright = w => { let s = 0; for (let i = 1; i < w.length; i++) { const d = w[i] - w[i - 1]; s += d * d; } return s; };
  assert.ok(bright(hard) > bright(soft), '強打のほうが明るいはず');
  // 最初の標本は 0 付近（正弦は位相0から、雑音も三乗エンベロープ）
  assert.ok(Math.abs(soft[0]) < 0.2, '鳴り出しでクリックしない');
});

test('命名と素性：決定的で、種で変わる', () => {
  assert.equal(ensembleName('rin'), ensembleName('rin'));
  assert.notEqual(ensembleName('rin'), ensembleName('ring'));
  const d = describe('omoide');
  assert.ok(typeof d.name === 'string' && d.name.length > 1);
  assert.ok(typeof d.material === 'string');
  assert.equal(d.count, d.ensemble.objects.length);
  assert.ok(d.rootMidi >= 41 && d.rootMidi <= 84);
});

test('音名：根音と音度から、十二律の名を返す', () => {
  assert.equal(noteName(69, SCALES.yo, 0), 'イ');         // A
  assert.equal(noteName(60, SCALES.yo, 0), 'ハ');         // C
  assert.equal(typeof noteName(60, SCALES.in, 3), 'string');
});
