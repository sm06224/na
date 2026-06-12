/* ============================================================
   ROM たちの試験 — 同梱の五本を、ヘッドレスの機械で実際に走らせる。

   絵は screenText() と bus.pixel() で目視し、音ならぬ声は
   takeSerial() で聞く。乱数は決定的なので、夜は再現できる。
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Machine } from '../js/core/machine.js';
import { ROMS } from '../js/roms.js';
import { compile } from '../js/lang/tama.js';

/* id の ROM を機械に読ませて電源を入れる（アセンブリも珠も） */
function boot(id, seed = 1) {
  const rom = ROMS.find(r => r.id === id);
  assert.ok(rom, `ROM が棚にない: ${id}`);
  const m = new Machine(seed);
  if (rom.lang === 'tama') {
    const out = compile(rom.src);
    assert.equal(out.ok, true, `${id} が組み上がらない: ${JSON.stringify(out.errors)}`);
    m.loadWords(out.words, out.origin);
  } else {
    const out = m.loadAsm(rom.src);
    assert.equal(out.ok, true, `${id} が組み上がらない: ${JSON.stringify(out.errors)}`);
  }
  return m;
}

/* 述語に合う画素の数を数える */
function countPixels(m, pred) {
  let n = 0;
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 128; x++) if (pred(m.bus.pixel(x, y), x, y)) n++;
  }
  return n;
}

/* 灯っている蛍（色12/13）の重心 x。いなければ null */
function hotaruCentroidX(m) {
  let sx = 0, n = 0;
  for (let y = 0; y < 90; y++) {            // 草（下端）は数えない
    for (let x = 0; x < 128; x++) {
      const c = m.bus.pixel(x, y);
      if (c === 12 || c === 13) { sx += x; n++; }
    }
  }
  return n ? sx / n : null;
}

/* ---------- 全 ROM 共通：組めて、走って、毎フレーム見せる ---------- */

test('棚には 6 本 — アセンブリが 5 本、珠が 1 本', () => {
  assert.equal(ROMS.length, 6);
  for (const r of ROMS) {
    assert.ok(r.lang === 'asm' || r.lang === 'tama');
    assert.ok(r.id && r.name && r.src && r.blurb, `${r.id} に欠けがある`);
  }
  assert.equal(ROMS.filter(r => r.lang === 'tama').length, 1);
});

for (const rom of ROMS) {
  test(`${rom.name}: 300 フレーム走って故障なし、毎フレーム FLIP する`, () => {
    const m = boot(rom.id);
    for (let i = 0; i < 300; i++) {
      const r = m.frame();
      assert.equal(r.flipped, true, `${rom.id} がフレーム ${i} で見せてこない`);
      assert.equal(m.vm.fault, null, `${rom.id} がフレーム ${i} で故障: ${m.vm.fault}`);
    }
  });
}

/* ---------- 起動の画 ---------- */

test('起動の画: 数フレームで画面に 4 色以上が灯る', () => {
  const m = boot('boot');
  m.frames(3);
  const colors = new Set();
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 128; x++) colors.add(m.bus.pixel(x, y));
  }
  assert.ok(colors.size >= 4, `色が ${colors.size} 種しかない`);
});

test('起動の画: 帯は時とともに流れる（画面が変わり続ける）', () => {
  const m = boot('boot');
  m.frames(2);
  const before = m.screenText();
  m.frames(8);                              // 帯は 8 フレームでひと色ずれる
  assert.notEqual(m.screenText(), before, '画は止まったまま');
});

/* ---------- 蛍 ---------- */

test('蛍: 100 フレームのあいだ、灯っている蛍のいる夜がある', () => {
  const m = boot('hotaru');
  let litFrames = 0;
  for (let i = 0; i < 100; i++) {
    m.frame();
    if (countPixels(m, (c, x, y) => y < 90 && (c === 12 || c === 13)) > 0) litFrames++;
  }
  assert.ok(litFrames > 0, '一匹も灯らない夜だった');
});

test('蛍: 下端には草（色10/11）が生えている', () => {
  const m = boot('hotaru');
  m.frames(2);
  const grass = countPixels(m, (c, x, y) => y >= 92 && (c === 10 || c === 11));
  assert.ok(grass > 50, `草が ${grass} 画素しかない`);
});

test('蛍: → の風が吹くと、みんな東へ流される（重心 x が右へ）', () => {
  const m = boot('hotaru');
  m.frames(20);
  let s1 = 0, n1 = 0;                       // 風のない夜の重心
  for (let i = 0; i < 8; i++) {
    m.frame();
    const c = hotaruCentroidX(m);
    if (c !== null) { s1 += c; n1++; }
  }
  for (let i = 0; i < 40; i++) {            // 東風が 40 フレーム吹く
    m.devices.setButtons(8);
    m.frame();
  }
  let s2 = 0, n2 = 0;
  for (let i = 0; i < 8; i++) {
    m.devices.setButtons(8);
    m.frame();
    const c = hotaruCentroidX(m);
    if (c !== null) { s2 += c; n2++; }
  }
  assert.ok(n1 > 0 && n2 > 0, '重心を測る夜に蛍が灯らなかった');
  assert.ok(s2 / n2 > s1 / n1 + 10,
    `重心が動かない: ${(s1 / n1).toFixed(1)} → ${(s2 / n2).toFixed(1)}`);
});

test('蛍: 同じ種なら同じ夜（screenText が一致する）', () => {
  const a = boot('hotaru', 5);
  const b = boot('hotaru', 5);
  a.frames(50);
  b.frames(50);
  assert.equal(a.screenText(), b.screenText());
});

/* ---------- へび ---------- */

test('へび: 最初の餌を食べて一升伸び、シリアルに「得点」が流れる', () => {
  const m = boot('hebi');
  m.frames(20);                             // まだ餌の手前
  const before = countPixels(m, c => c === 11 || c === 12);
  assert.equal(before, 48, '初めは 3 升 = 48 画素のはず');
  m.frames(80);                             // (24,12) の餌は 64 フレーム目に食べる
  const after = countPixels(m, c => c === 11 || c === 12);
  assert.equal(after, 64, '食べたのに 4 升 = 64 画素になっていない');
  const serial = m.devices.takeSerial();
  assert.ok(serial.includes('得点'), `シリアルに得点がない: ${JSON.stringify(serial)}`);
  assert.ok(serial.includes('得点 1'), `一点目のはず: ${JSON.stringify(serial)}`);
});

test('へび: 壁にぶつかって開始待ちになり、開始(64)で初めから', () => {
  const m = boot('hebi');
  m.frames(140);                            // 右へ走りつづけ、128 フレーム目に東の壁
  assert.equal(m.bus.pixel(125, 49), 12, '骸の頭が東の壁ぎわにいない');
  const frozen = m.screenText();
  m.frames(10);                             // 死んでいるあいだ、画は止まったまま
  assert.equal(m.screenText(), frozen);
  m.devices.setButtons(64);                 // 開始
  m.frame();
  m.devices.setButtons(0);
  m.frame();
  assert.equal(m.bus.pixel(65, 49), 12, '頭が真ん中 (16,12) の升に戻っていない');
  assert.equal(m.bus.pixel(125, 49), 0, '壁ぎわの骸が消えていない');
});

/* ---------- 万華鏡 ---------- */

test('万華鏡: 60 フレームで模様が積もる', () => {
  const m = boot('mangekyou');
  m.frames(60);
  const lit = countPixels(m, c => c !== 0);
  assert.ok(lit >= 100, `点が ${lit} しかない`);
});

test('万華鏡: 左半分と右半分は鏡像', () => {
  const m = boot('mangekyou');
  m.frames(60);
  let checked = 0;
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 64; x++) {
      const a = m.bus.pixel(x, y);
      const b = m.bus.pixel(127 - x, y);
      assert.equal(a, b, `(${x},${y}) と (${127 - x},${y}) が違う: ${a} vs ${b}`);
      if (a !== 0) checked++;
    }
  }
  assert.ok(checked >= 30, `灯った点が ${checked} 対しかなく、鏡の検めにならない`);
});

/* ---------- 電卓 ---------- */

test('電卓: まず促し、12+34= に 46、7*6= に 42 と返す', () => {
  const m = boot('dentaku');
  m.frames(2);
  assert.ok(m.devices.takeSerial().includes('> '), 'プロンプトが出ない');
  m.devices.pressKey('12+34=');
  m.frames(3);
  assert.ok(m.devices.takeSerial().includes('46'), '12+34 が 46 にならない');
  m.devices.pressKey('7*6=');
  m.frames(3);
  assert.ok(m.devices.takeSerial().includes('42'), '7*6 が 42 にならない');
});

test('電卓: 引きすぎたら負の数。- を先に出す', () => {
  const m = boot('dentaku');
  m.devices.pressKey('5-8=');
  m.frames(3);
  assert.ok(m.devices.takeSerial().includes('-3'), '5-8 が -3 にならない');
});

test('電卓: 2 進の帯が灯り、c で消える（鍵がなくても FLIP は続く）', () => {
  const m = boot('dentaku');
  m.devices.pressKey('5');                  // 0b101 — 帯が 2 本灯る
  m.frames(2);
  const lit = countPixels(m, (c, x, y) => y >= 36 && y < 60 && c === 12);
  assert.ok(lit > 0, '帯が灯らない');
  m.devices.pressKey('c');
  m.frames(2);
  const after = countPixels(m, (c, x, y) => y >= 36 && y < 60 && c === 12);
  assert.equal(after, 0, '払ったのに帯が残っている');
  const r = m.frame();                      // 鍵のないフレームも見せてくる
  assert.equal(r.flipped, true);
});

/* ---------- 恋歌（珠で書かれた一本） ---------- */

test('恋歌: らドレドレドーそーー が周波数になって流れる', () => {
  const m = boot('koiuta');
  m.frames(10);
  assert.equal(m.devices.sound[0].freq, 440, 'はじめは「ら」');
  m.frames(30);
  assert.equal(m.devices.sound[0].freq, 523, '二音目は「ド」');
  m.frames(220);
  assert.equal(m.devices.sound[0].freq, 392, '結びは「そーー」');
});

test('恋歌: 帯の色は織の染め — 紫根・紅・若竹・金茶', () => {
  const m = boot('koiuta');
  m.frames(299);                       // 歌い終わりの直前
  for (const dye of [14, 5, 11, 13]) {
    assert.ok(countPixels(m, c => c === dye) > 0, `染め ${dye} が画面にない`);
  }
  assert.ok(countPixels(m, c => c === 1) > 0, '胡粉の輪郭がない');
});

test('恋歌: 歌い終わると息を継ぎ、また同じ歌を歌い直す', () => {
  const m = boot('koiuta');
  m.frames(310);                       // 息継ぎの最中
  assert.equal(m.devices.sound[0].vol, 0, '息継ぎでは声を休める');
  m.frames(40);                        // 二巡目のはじまり
  assert.equal(m.devices.sound[0].freq, 440, '二巡目も「ら」から');
  assert.equal(m.devices.sound[0].vol, 10);
});

/* ---------- 棚と紙の一致 ---------- */

test('roms.js の src は roms/*.s と一字違わない', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = new URL('../roms/', import.meta.url);
  const files = { boot: '起動.s', hotaru: '蛍.s', hebi: 'へび.s', mangekyou: '万華鏡.s', dentaku: '電卓.s', koiuta: '恋歌.tama' };
  for (const rom of ROMS) {
    const onDisk = fs.readFileSync(new URL(files[rom.id], dir), 'utf8');
    assert.equal(rom.src, onDisk, `${rom.id} の埋め込みと ${files[rom.id]} がずれている`);
  }
});
