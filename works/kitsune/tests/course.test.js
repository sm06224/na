import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeCourse, decodeCourse, encodeToken, decodeToken,
  randomToken, randomId, normalizeToken, tokenHash, Hunt, MAX_CPS,
} from '../js/core/course.js';

function makeCourse(extra = {}) {
  return {
    id: 'KITSU7',
    name: '公園一周の狐',
    cps: [
      { lat: 35.68123, lon: 139.76712, r: 25, proof: 'gps', name: '噴水', hint: '水の音のするほう', th: null },
      { lat: 35.68250, lon: 139.76900, r: 30, proof: 'qr', name: '大きな木', hint: '幹の裏を見よ', th: 'abcdef012345' },
      { lat: 35.68400, lon: 139.77100, r: 25, proof: 'photo', name: 'ゴールの鳥居', hint: '', th: null },
    ],
    ...extra,
  };
}

test('行路の符号：リンクに畳んで、ほどいて、同じ行路に戻る', () => {
  const course = makeCourse();
  const frag = encodeCourse(course);
  assert.match(frag, /^c=[A-Za-z0-9\-_]+$/);
  const back = decodeCourse('#' + frag);
  assert.equal(back.id, 'KITSU7');
  assert.equal(back.name, '公園一周の狐');
  assert.equal(back.cps.length, 3);
  assert.ok(Math.abs(back.cps[0].lat - 35.68123) < 2e-5);
  assert.ok(Math.abs(back.cps[1].lon - 139.76900) < 2e-5);
  assert.equal(back.cps[1].proof, 'qr');
  assert.equal(back.cps[1].th, 'abcdef012345');
  assert.equal(back.cps[2].proof, 'photo');
  assert.equal(back.cps[0].hint, '水の音のするほう');
});

test('行路の符号：壊れたもの・無いものは黙って null', () => {
  assert.equal(decodeCourse(''), null);
  assert.equal(decodeCourse('#x=1'), null);
  assert.equal(decodeCourse('#c=!!!'), null);
  assert.equal(decodeCourse('#c=aGVsbG8'), null);          // JSON でない
});

test('行路の符号：的の数の限度を守る', () => {
  const many = makeCourse({ cps: Array.from({ length: MAX_CPS + 1 }, (_, i) => ({
    lat: 35, lon: 139, r: 25, proof: 'gps', name: String(i), hint: '' })) });
  assert.equal(decodeCourse('#' + encodeCourse(many)), null);
});

test('しるしの符号：QR が運ぶリンクのかけら', () => {
  const frag = encodeToken('KITSU7', 1, 'ab2- cd');
  assert.equal(frag, 't=KITSU7.1.AB2CD');
  assert.deepEqual(decodeToken('#' + frag), { id: 'KITSU7', idx: 1, token: 'AB2CD' });
  assert.equal(decodeToken('#t=zure'), null);
});

test('トークン：紛らわしい字が出ない・正規化は大文字化と区切り払いだけ', () => {
  for (let i = 0; i < 200; i++) {
    assert.doesNotMatch(randomToken(), /[ILO01]/);
  }
  assert.equal(normalizeToken(' ab2-cd '), 'AB2CD');
  assert.equal(randomId().length, 6);
});

test('トークンの刻み：同じ答えでも、コースと的が違えば別の刻みになる', async () => {
  const a = await tokenHash('KITSU7', 1, 'AB2CD');
  const b = await tokenHash('KITSU7', 2, 'AB2CD');
  const c = await tokenHash('OTHER1', 1, 'AB2CD');
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, await tokenHash('KITSU7', 1, ' ab2-cd '));   // 正規化して刻む
});

test('追跡：始める前は通れない、始めれば順に通る', () => {
  const hunt = new Hunt(makeCourse());
  assert.equal(hunt.passGps(5), false);            // まだ始めていない
  hunt.begin(1000);
  assert.equal(hunt.currentIdx, 0);
  assert.equal(hunt.passGps(50, 2000), false);     // 輪の外（r=25）
  assert.equal(hunt.passGps(20, 3000), true);
  assert.equal(hunt.currentIdx, 1);
  assert.equal(hunt.current.name, '大きな木');
});

test('追跡：証明の流儀が違えば通れない（先回りも効かない）', async () => {
  const hunt = new Hunt(makeCourse());
  hunt.begin(0);
  // 1 番目（gps）の前に 2 番目（qr）のしるしを読んでも無駄
  assert.equal(await hunt.passToken(1, 'AB2CD'), false);
  assert.equal(hunt.passPhoto('x'), false);        // いまの的は photo でもない
  hunt.passGps(10, 1);
  assert.equal(hunt.passGps(10, 2), false);        // いまの的は qr。GPS では通れない
});

test('追跡：QR は正しい答えだけが扉をあける', async () => {
  const id = 'KITSU7';
  const token = 'AB2CD';
  const th = await tokenHash(id, 1, token);
  const course = makeCourse();
  course.cps[1].th = th;
  const hunt = new Hunt(course);
  hunt.begin(0);
  hunt.passGps(10, 1);
  assert.equal(await hunt.passToken(1, 'XXXXX'), false);
  assert.equal(await hunt.passToken(1, token), true);
  assert.equal(hunt.currentIdx, 2);
});

test('追跡：写真で結び、終わればタイムが止まる', () => {
  const course = makeCourse();
  course.cps[1].proof = 'gps'; course.cps[1].th = null;     // 順走しやすく
  const hunt = new Hunt(course);
  hunt.begin(0);
  hunt.passGps(10, 60_000);
  hunt.passGps(10, 120_000);
  assert.equal(hunt.done, false);
  assert.equal(hunt.passPhoto('data:image/jpeg;base64,xx', 180_000), true);
  assert.equal(hunt.done, true);
  assert.equal(hunt.elapsed(999_999), 180_000);             // 終わった後は伸びない
  assert.equal(hunt.passed[2].photo, 'data:image/jpeg;base64,xx');
  const s = hunt.summary(999_999);
  assert.match(s, /3\/3 通過/);
  assert.match(s, /タイム 3分00秒/);
  assert.match(s, /ゴールの鳥居/);
});

test('追跡：歩みは保存でき、同じ行路でだけ読み戻せる', () => {
  const course = makeCourse();
  const hunt = new Hunt(course);
  hunt.begin(1000);
  hunt.passGps(10, 2000);
  const json = hunt.save();
  const again = new Hunt(course, json);
  assert.equal(again.currentIdx, 1);
  assert.equal(again.startedAt, 1000);
  const other = new Hunt(makeCourse({ id: 'CHIGAU' }), json);
  assert.equal(other.started, false);              // 別の行路の記録は読まない
  assert.equal(new Hunt(course, '{{{').started, false);
});
