import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../js/core/sha256.js';

test('既知のテストベクトルと一字一句合う（FIPS 180-4）', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex('The quick brown fox jumps over the lazy dog'),
    'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  // ピリオド一つで雪崩のように変わる
  assert.equal(
    sha256Hex('The quick brown fox jumps over the lazy dog.'),
    'ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c');
});

test('二ブロックにまたがる長文も正しい（55→56→64 byte 境界）', () => {
  // 56 byte ちょうど（パディングが次ブロックへあふれる境界）
  assert.equal(
    sha256Hex('a'.repeat(56)),
    'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a');
  // 1,000,000 個の 'a'（古典的な長文ベクトル）
  assert.equal(
    sha256Hex('a'.repeat(1000000)),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

test('UTF-8（日本語）でも安定して同じ', () => {
  assert.equal(sha256Hex('日本語のテスト'), sha256Hex('日本語のテスト'));
  assert.match(sha256Hex('くじ'), /^[0-9a-f]{64}$/);
  assert.notEqual(sha256Hex('くじ'), sha256Hex('クジ'));
});
