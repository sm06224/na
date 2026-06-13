import test from 'node:test';
import assert from 'node:assert/strict';
import { Spots, encodeSpotLink, decodeSpotLink, fmtAge } from '../js/core/spots.js';

test('分かち合い：座標と名前がリンクに畳まれ、ほどける', () => {
  const spot = { lat: 35.68123, lon: 139.76712, acc: 12, name: '車 P3' };
  const frag = encodeSpotLink(spot);
  assert.match(frag, /^s=[0-9a-z]+\.[0-9a-z]+\.[0-9a-z]+\./);
  const back = decodeSpotLink(frag);
  assert.ok(Math.abs(back.lat - spot.lat) < 2e-5, `lat ${back.lat}`);
  assert.ok(Math.abs(back.lon - spot.lon) < 2e-5);
  assert.equal(back.acc, 12);
  assert.equal(back.name, '車 P3');
});

test('分かち合い：南半球・西半球・名前なしも正しく', () => {
  const spot = { lat: -33.86882, lon: -70.66265, acc: 0, name: '' };
  const back = decodeSpotLink('#' + encodeSpotLink(spot));
  assert.ok(Math.abs(back.lat - spot.lat) < 2e-5);
  assert.ok(Math.abs(back.lon - spot.lon) < 2e-5);
  assert.equal(back.name, '');
});

test('分かち合い：名前の「.」や絵文字や & に負けない', () => {
  const back = decodeSpotLink(encodeSpotLink(
    { lat: 1, lon: 2, acc: 3, name: 'テント⛺ ver.2 & 3' }));
  assert.equal(back.name, 'テント⛺ ver.2 & 3');
});

test('分かち合い：他のパラメタと並んでいても読める', () => {
  const frag = '#x=1&' + encodeSpotLink({ lat: 35, lon: 135, acc: 5, name: '宿' });
  assert.equal(decodeSpotLink(frag).name, '宿');
});

test('分かち合い：壊れたリンクは黙って null', () => {
  assert.equal(decodeSpotLink(''), null);
  assert.equal(decodeSpotLink('#t=abc'), null);
  assert.equal(decodeSpotLink('#s=zzz'), null);
  assert.equal(decodeSpotLink('#s=!!.??.x'), null);
});

test('覚え書き：刺す・引く・名を変える・抜く', () => {
  const spots = new Spots();
  const a = spots.pin({ lat: 35, lon: 139, acc: 8 });
  assert.equal(a.name, '針 1');
  const b = spots.pin({ lat: 36, lon: 140, acc: 4, name: '車', icon: '🚗' });
  assert.equal(spots.list.length, 2);
  assert.equal(spots.list[0].id, b.id, '新しい針が先頭');
  assert.equal(spots.get(a.id).lat, 35);
  assert.ok(spots.rename(a.id, 'テント', '⛺'));
  assert.equal(spots.get(a.id).name, 'テント');
  assert.equal(spots.get(a.id).icon, '⛺');
  assert.ok(spots.remove(a.id));
  assert.equal(spots.list.length, 1);
  assert.equal(spots.remove('nai'), false);
});

test('覚え書き：保存して、読み戻せる（器は問わない）', () => {
  const spots = new Spots();
  spots.pin({ lat: 35.1, lon: 139.1, acc: 6, name: '宿' });
  const json = spots.save();
  const again = new Spots(json);
  assert.equal(again.list.length, 1);
  assert.equal(again.list[0].name, '宿');
});

test('覚え書き：壊れた保存からは、空で立ち上がる', () => {
  assert.equal(new Spots('{{{').list.length, 0);
  assert.equal(new Spots('[{"id":"x"}]').list.length, 0);   // 座標のない針は捨てる
  assert.equal(new Spots(null).list.length, 0);
});

test('刺した時刻のことば', () => {
  const now = Date.now();
  assert.equal(fmtAge(now - 30_000, now), 'たったいま');
  assert.equal(fmtAge(now - 5 * 60_000, now), '5分前');
  assert.equal(fmtAge(now - 3 * 3600_000, now), '3時間前');
  assert.equal(fmtAge(now - 2 * 86400_000, now), '2日前');
  assert.equal(fmtAge(now - 65 * 86400_000, now), '2か月前');
});
