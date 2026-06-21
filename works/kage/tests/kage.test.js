import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  castPoint, magnification, penumbra, worldParts, castPuppet, flicker,
  packScene, unpackScene, WALL,
} from '../js/core/kage.js';
import { PUPPETS, KINDS } from '../js/core/puppets.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('castPoint — 深さ p の点は、灯りを中心に W/p 倍に投げられる', () => {
  const lamp = { x: 0, y: 0 };
  const s = castPoint(lamp, 1, 0, 0.5, 1);   // m = 2
  assert.ok(near(s.x, 2) && near(s.y, 0));
});

test('castPoint — 灯りと同じ位置の点は、深さによらず灯りの真下に落ちる', () => {
  const lamp = { x: 0.3, y: 0.7 };
  for (const p of [0.2, 0.5, 0.9]) {
    const s = castPoint(lamp, 0.3, 0.7, p, 1);
    assert.ok(near(s.x, 0.3) && near(s.y, 0.7));
  }
});

test('castPoint — 壁ぎわ（p = W）の点は、実物大・実位置のまま落ちる', () => {
  const lamp = { x: 0.1, y: -0.2 };
  const s = castPoint(lamp, 0.4, 0.6, 1, 1);
  assert.ok(near(s.x, 0.4) && near(s.y, 0.6));
});

test('magnification — p が小さい（灯りに近い）ほど影は大きい', () => {
  let prev = Infinity;
  for (const p of [0.2, 0.4, 0.6, 0.8, 1.0]) {
    const m = magnification(p);
    assert.ok(m >= 1);
    assert.ok(m < prev, `m(${p})=${m} は単調減少のはず`);
    prev = m;
  }
  assert.ok(near(magnification(1), 1));
});

test('penumbra — 壁ぎわで 0、灯りに寄るほど拡がる', () => {
  assert.ok(near(penumbra(WALL, 0.01), 0));     // p = W → ぼけ 0
  assert.ok(penumbra(0.25, 0.01) > penumbra(0.5, 0.01));
  assert.ok(penumbra(0.5, 0.01) > penumbra(0.9, 0.01));
  // b = r(W−p)/p。r=0.01, p=0.5, W=1 → 0.01
  assert.ok(near(penumbra(0.5, 0.01), 0.01));
});

test('worldParts — 回転・拡大・移動が頂点に効く', () => {
  const puppet = { parts: [[[1, 0]]], x: 5, y: 5, scale: 2, rot: Math.PI / 2 };
  const [[[x, y]]] = worldParts(puppet);
  // (1,0) を 90°回し→(0,1)、2倍→(0,2)、(5,5)へ移動→(5,7)
  assert.ok(near(x, 5, 1e-9) && near(y, 7, 1e-9));
});

test('castPuppet — 灯りの真上に立つ切り絵は、中心そろえで一様に拡大される', () => {
  const lamp = { x: 0, y: 0 };
  const puppet = { parts: [[[-0.2, -0.2], [0.2, 0.2]]], x: 0, y: 0, scale: 1, rot: 0, depth: 0.5 };
  const { parts, magnification: m } = castPuppet(lamp, puppet, { wall: 1 });
  assert.ok(near(m, 2));
  assert.ok(near(parts[0][0].x, -0.4) && near(parts[0][1].x, 0.4));
});

test('flicker — [-1,1] に収まり、決定的で、時とともに動く', () => {
  for (let i = 0; i < 200; i++) {
    const t = i * 0.037;
    const v = flicker(t, 7);
    assert.ok(v >= -1 - 1e-12 && v <= 1 + 1e-12);
  }
  assert.equal(flicker(1.23, 3), flicker(1.23, 3));     // 同じ入力 → 同じ炎
  assert.notEqual(flicker(0, 3), flicker(0.5, 3));      // 時が経てば揺れる
  assert.notEqual(flicker(0.4, 1), flicker(0.4, 2));    // 種が違えば炎も違う
});

test('packScene / unpackScene — 場面は畳んでひらいても元に戻る（会える種）', () => {
  const scene = {
    lamp: { x: 0.5, y: 0.42 },
    puppets: [
      { kind: 'tsuki', x: 0.2, y: 0.15, depth: 0.8, scale: 0.3, rot: 0 },
      { kind: 'tori', x: 0.7, y: 0.4, depth: 0.45, scale: 0.25, rot: -0.2 },
    ],
  };
  const back = unpackScene(packScene(scene));
  assert.equal(back.puppets.length, 2);
  assert.ok(near(back.lamp.x, 0.5, 1e-3) && near(back.lamp.y, 0.42, 1e-3));
  for (let i = 0; i < scene.puppets.length; i++) {
    const a = scene.puppets[i], b = back.puppets[i];
    assert.equal(b.kind, a.kind);
    for (const key of ['x', 'y', 'depth', 'scale', 'rot']) {
      assert.ok(near(b[key], a[key], 1e-3), `${key}: ${b[key]} ≠ ${a[key]}`);
    }
  }
});

test('packScene — 空の舞台も往復できる', () => {
  const back = unpackScene(packScene({ lamp: { x: 0.5, y: 0.5 }, puppets: [] }));
  assert.equal(back.puppets.length, 0);
  assert.ok(near(back.lamp.x, 0.5, 1e-3));
});

test('puppets — どの型も、閉じた多角形の部品でできている', () => {
  assert.ok(KINDS.length >= 5);
  for (const kind of KINDS) {
    const p = PUPPETS[kind];
    assert.ok(p && p.name && p.glyph, `${kind} に名と絵文字`);
    assert.ok(Array.isArray(p.parts) && p.parts.length >= 1);
    for (const part of p.parts) {
      assert.ok(part.length >= 3, `${kind} の部品は 3 点以上`);
      for (const v of part) {
        assert.equal(v.length, 2);
        assert.ok(Number.isFinite(v[0]) && Number.isFinite(v[1]));
        assert.ok(Math.abs(v[0]) <= 1 && Math.abs(v[1]) <= 1, `${kind} は丈 1 におさまる`);
      }
    }
  }
});
