import test from 'node:test';
import assert from 'node:assert/strict';
import { Devices, REG, BTN } from '../js/core/devices.js';
import { Bus, VRAM, PALETTE, DEFAULT_PALETTE, SCREEN_W, SCREEN_H } from '../js/core/bus.js';
import { Machine } from '../js/core/machine.js';

test('FLIP と FRAME：見せてくれと頼み、時が進むと下りる', () => {
  const d = new Devices();
  assert.equal(d.read(REG.FLIP), 0);
  d.write(REG.FLIP, 1);
  assert.equal(d.read(REG.FLIP), 1);
  d.tick();
  assert.equal(d.read(REG.FLIP), 0);
  assert.equal(d.read(REG.FRAME), 1);
});

test('ボタン：BTN は押している間、BTNP は押した瞬間だけ', () => {
  const d = new Devices();
  d.setButtons(BTN.A | BTN.RIGHT);
  assert.equal(d.read(REG.BTN), BTN.A | BTN.RIGHT);
  assert.equal(d.read(REG.BTNP), BTN.A | BTN.RIGHT);
  d.tick();
  d.setButtons(BTN.A | BTN.RIGHT);     // 押しっぱなし
  assert.equal(d.read(REG.BTN), BTN.A | BTN.RIGHT);
  assert.equal(d.read(REG.BTNP), 0);   // 瞬間は過ぎた
  d.tick();
  d.setButtons(BTN.A | BTN.RIGHT | BTN.UP);
  assert.equal(d.read(REG.BTNP), BTN.UP);
});

test('乱数：決定的で、種を蒔き直せば同じ列が出る', () => {
  const d = new Devices(7);
  const a = [d.read(REG.RAND), d.read(REG.RAND), d.read(REG.RAND)];
  d.write(REG.RAND, 7);
  const b = [d.read(REG.RAND), d.read(REG.RAND), d.read(REG.RAND)];
  assert.deepEqual(a, b);
  d.write(REG.RAND, 8);
  const c = d.read(REG.RAND);
  assert.notEqual(a[0], c);
});

test('打鍵キューとシリアル出力：文字が入り、文字が出る', () => {
  const d = new Devices();
  d.pressKey('蛍');
  d.pressKey('a');
  assert.equal(d.read(REG.KEY), '蛍'.charCodeAt(0));
  assert.equal(d.read(REG.KEY), 97);
  assert.equal(d.read(REG.KEY), 0);          // 空なら 0
  d.write(REG.OUT, 'こ'.charCodeAt(0));
  d.write(REG.OUT, 'ん'.charCodeAt(0));
  assert.equal(d.takeSerial(), 'こん');
  assert.equal(d.takeSerial(), '');
});

test('音源レジスタ：4 チャンネル、書いた通りに読める', () => {
  const d = new Devices();
  for (let ch = 0; ch < 4; ch++) {
    d.write(REG.SOUND + ch * 4 + 0, 440 + ch);
    d.write(REG.SOUND + ch * 4 + 1, ch * 4);
    d.write(REG.SOUND + ch * 4 + 2, ch);
    d.write(REG.SOUND + ch * 4 + 3, 3 - ch);
  }
  for (let ch = 0; ch < 4; ch++) {
    assert.equal(d.read(REG.SOUND + ch * 4 + 0), 440 + ch);
    assert.equal(d.read(REG.SOUND + ch * 4 + 1), ch * 4);
    assert.equal(d.read(REG.SOUND + ch * 4 + 2), ch);
    assert.equal(d.read(REG.SOUND + ch * 4 + 3), 3 - ch);
  }
  assert.equal(d.sound[1].freq, 441);        // ホストの音作りはここを読む
});

test('バス：VRAM はただの RAM、画素の出し入れが合う', () => {
  const bus = new Bus();
  bus.setPixel(0, 0, 5);
  bus.setPixel(1, 0, 0xA);
  bus.setPixel(127, 95, 0xF);
  assert.equal(bus.pixel(0, 0), 5);
  assert.equal(bus.pixel(1, 0), 0xA);
  assert.equal(bus.pixel(127, 95), 0xF);
  assert.equal(bus.ram[VRAM] & 0xFF, 0xA5);  // 詰め方は HARDWARE.md の通り
  assert.equal(bus.pixel(-1, 0), 0);
  assert.equal(bus.pixel(0, SCREEN_H), 0);
});

test('パレット：既定の 16 色が入っていて、塗り替えられる', () => {
  const bus = new Bus();
  for (let i = 0; i < 16; i++) assert.equal(bus.ram[PALETTE + i], DEFAULT_PALETTE[i]);
  assert.equal(bus.cssColor(1), 'rgb(238,238,221)');     // 胡粉 0xEED
  bus.write(PALETTE + 0, 0xF00);
  assert.equal(bus.cssColor(0), 'rgb(255,0,0)');
});

test('機械一式：描いて、FLIP して、止まるまでの 1 フレーム', () => {
  const m = new Machine();
  const out = m.loadAsm(`
    .const 画面, 0x8000
    .const 見せろ, 0xF000
      LDI r0, 画面
      LDI r1, 0x4444        ; 茜を 4 画素
      ST [r0], r1
      LDI r2, 見せろ
      LDI r3, 1
      ST [r2], r3           ; FLIP
    待つ:
      LD r4, [r2]
      CMPI r4, 0
      JNZ 待つ              ; ホストが下ろすまで待つ…がテストでは 1 フレームで切れる
  `);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  const r1 = m.frame(10_000);
  assert.equal(r1.flipped, true);
  for (let x = 0; x < 4; x++) assert.equal(m.bus.pixel(x, 0), 4);
  // FLIP が下りたので、次のフレームでは待ちループを抜けて走り続ける
  const r2 = m.frame(100);
  assert.equal(r2.flipped, false);
});

test('機械一式：シリアルに「無」と書くプログラム', () => {
  const m = new Machine();
  m.loadAsm(`
    .const 口, 0xF006
      LDI r0, 口
      LDI r1, '無'
      ST [r0], r1
      HLT
  `);
  m.frame();
  assert.equal(m.devices.takeSerial(), '無');
  assert.equal(m.vm.halted, true);
});

test('screenText：画面が文字で目視できる', () => {
  const m = new Machine();
  m.bus.setPixel(0, 0, 0xF);
  const text = m.screenText();
  const rows = text.split('\n');
  assert.equal(rows.length, SCREEN_H);
  assert.equal(rows[0].length, SCREEN_W);
  assert.equal(rows[0][0], 'f');
  assert.equal(rows[0][1], '0');
});
