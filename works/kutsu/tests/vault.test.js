import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Level } from '../js/core/level.js';
import { T } from '../js/core/tile.js';
import { Rect } from '../js/core/util.js';
import { VAULTS, vaultsForDepth, stampVault } from '../js/core/gen/vault.js';

test('vault のテンプレートはどれも矩形で、既知の記号だけ', () => {
  const known = new Set('#x.,+\'~≈LT&_F|=%<$*!?/○mMB '.split(''));
  for (const v of VAULTS) {
    assert.ok(v.rows.length >= 3, `${v.id} が小さすぎる`);
    const w = v.rows[0].length;
    for (const r of v.rows) {
      assert.equal(r.length, w, `${v.id} の行幅が揃っていない`);
      for (const ch of r) assert.ok(known.has(ch), `${v.id} に未知の記号「${ch}」`);
    }
    assert.ok(Array.isArray(v.depth) && v.depth.length === 2);
  }
});

test('vaultsForDepth：深さで絞られる', () => {
  for (const v of vaultsForDepth(5)) assert.ok(5 >= v.depth[0] && 5 <= v.depth[1]);
  // 浅すぎる深さでは宝物庫(2-)は出るが、深いものは出ない
  assert.ok(vaultsForDepth(15).length >= 1);
});

test('stampVault：床地にテンプレートを押し当て、タイルと湧きが現れる', () => {
  const lv = new Level(30, 20, 4);
  for (let y = 1; y < 19; y++) for (let x = 1; x < 29; x++) lv.set(x, y, T.FLOOR);
  const treasure = VAULTS.find(v => v.id === 'treasure');
  const res = stampVault(lv, new RNG(7), treasure, { rect: new Rect(5, 5, 9, 7) });
  assert.ok(res, '置けなかった');
  // 壁と扉が刻まれている
  assert.equal(lv.get(5, 5), T.WALL);
  assert.ok(res.spawns.length >= 4, '湧きが少ない');
  assert.ok(res.spawns.some(s => s.type === 'gold'));
  assert.ok(res.spawns.some(s => s.type === 'item'));
  assert.ok(res.spawns.some(s => s.type === 'monster'));
});

test('stampVault：床が無ければ（全部壁なら）置かない', () => {
  const lv = new Level(16, 12, 3);   // 既定で全面が壁＝遊び場がない
  const v = VAULTS.find(x => x.id === 'treasure');
  const res = stampVault(lv, new RNG(3), v);
  assert.equal(res, null);
});
