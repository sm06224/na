/* シーケンス図の検証 — Mermaid の sequenceDiagram を正しく読み、積み、往復できるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layoutSeq } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';

const SRC = `sequenceDiagram
    autonumber
    participant u as 利用者
    participant w as Web
    u->>w: ログイン要求
    w->>a: 検証
    a->>a: ハッシュ照合
    alt OK
      a-->>w: トークン
    else 失敗
      a--xw: 拒否
    end
    Note over u,w: 3回失敗でロック
`;

test('パース：participant の別名・自動宣言・矢印の種別・Note・枠を読む', () => {
  const m = parse(SRC);
  assert.equal(m.kind, 'sequence');
  assert.equal(m.meta.autonumber, true);
  // 宣言された u,w に加え、登場した a が自動で足される。
  assert.deepEqual(m.order, ['u', 'w', 'a']);
  assert.equal(m.items.find((x) => x.id === 'u').label, '利用者');
  assert.equal(m.items.find((x) => x.id === 'a').label, 'a');
  const msgs = m.events.filter((e) => e.type === 'msg');
  assert.equal(msgs.length, 5);
  assert.deepEqual([msgs[0].dotted, msgs[0].arrow], [false, true]);   // ->>
  assert.deepEqual([msgs[3].dotted, msgs[3].arrow], [true, true]);    // -->>
  assert.equal(msgs[4].cross, true);                                   // --x
  assert.equal(msgs[4].dotted, true);
  const note = m.events.find((e) => e.type === 'note');
  assert.deepEqual(note.ids, ['u', 'w']);
  assert.equal(note.pos, 'over');
  const kinds = m.events.map((e) => e.type);
  assert.ok(kinds.includes('fstart') && kinds.includes('fdiv') && kinds.includes('fend'), '枠が読めていない');
  assert.equal(m.errors.length, 0);
});

test('パース：末尾ハイフンを線と取り違えない（a-->>b と my-node の両立）', () => {
  const m = parse(`sequenceDiagram
    a-->>b: 点線
    my-node->>b: ダッシュ入り id`);
  assert.deepEqual(m.order, ['a', 'b', 'my-node']);
  assert.equal(m.events[0].dotted, true);
  assert.equal(m.events[1].from, 'my-node');
});

test('パース：閉じていない枠は黙らず報告する', () => {
  const m = parse(`sequenceDiagram
    loop 毎分
      a->>b: ping`);
  assert.ok(m.errors.some((e) => /end/.test(e)));
});

test('レイアウト：参加者は左から並び、出来事は上から下へ積まれる', () => {
  const L = layoutSeq(parse(SRC));
  const cx = (id) => L.actors.find((x) => x.id === id).cx;
  assert.ok(cx('u') < cx('w') && cx('w') < cx('a'), '宣言順に左から');
  for (let i = 1; i < L.msgs.length; i++) assert.ok(L.msgs[i].y > L.msgs[i - 1].y, '下へ積まれていない');
  assert.ok(L.msgs.find((x) => x.self), '自分宛のメッセージが立たない');
  assert.equal(L.frames.length, 1);
  assert.equal(L.frames[0].divs.length, 1);                            // else の区切り
  assert.ok(L.frames[0].y0 < L.frames[0].y1, '枠が閉じていない');
  assert.equal(L.notes.length, 1);
  assert.equal(L.errors.length, 0);
});

test('レイアウト：@layout order が参加者の並びを上書きする', () => {
  const m = parse(SRC);
  m.layout.order = ['a', 'u', 'w'];
  const L = layoutSeq(m);
  const cx = (id) => L.actors.find((x) => x.id === id).cx;
  assert.ok(cx('a') < cx('u') && cx('u') < cx('w'));
});

test('往復：serialize→parse は安定し、並び替えは %% order にだけ入る', () => {
  const m = parse(SRC);
  const re = parse(serialize(m));
  for (const k of ['kind', 'meta', 'order', 'items', 'events', 'layout'])
    assert.deepEqual(re[k], m[k], `${k} がずれた`);
  // ドラッグ相当：参加者を並び替える。
  m.layout.order = ['w', 'u', 'a'];
  const out = serialize(m);
  const [semantic, trailer2] = out.split('%% @layout');
  assert.match(semantic, /participant u as 利用者/);                    // 意味部は無傷
  assert.match(semantic, /u->>w: ログイン要求/);
  assert.match(trailer2, /%% order w u a/);
  assert.deepEqual(parse(out).layout.order, ['w', 'u', 'a']);
});
