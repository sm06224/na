import { BRAIN } from './genome.js';

/* ============================================================
   脳 — 遺伝子の重みベクトルから組み立てる小さな多層パーセプトロン。
   入力: 視覚 5 レイ × {植物, 獲物, 脅威} + 自エネルギー + 自速度
   出力: [旋回 -1..1, 推進 -1..1]
   学習はしない。賢さは「進化」だけが選び取る。
   ============================================================ */
export class Brain {
  constructor(weights) {
    const { INPUTS: I, HIDDEN: H, OUTPUTS: O } = BRAIN;
    let p = 0;
    this.W1 = weights.slice(p, p += H * I);
    this.b1 = weights.slice(p, p += H);
    this.W2 = weights.slice(p, p += O * H);
    this.b2 = weights.slice(p, p += O);
    // インスペクタ用に直近の活性を保持する
    this.lastIn = new Array(I).fill(0);
    this.lastHidden = new Array(H).fill(0);
    this.lastOut = new Array(O).fill(0);
  }

  forward(inputs) {
    const { INPUTS: I, HIDDEN: H, OUTPUTS: O } = BRAIN;
    const h = this.lastHidden, out = this.lastOut;
    for (let i = 0; i < I; i++) this.lastIn[i] = inputs[i];
    for (let j = 0; j < H; j++) {
      let s = this.b1[j];
      const row = j * I;
      for (let i = 0; i < I; i++) s += this.W1[row + i] * inputs[i];
      h[j] = Math.tanh(s);
    }
    for (let o = 0; o < O; o++) {
      let s = this.b2[o];
      const row = o * H;
      for (let j = 0; j < H; j++) s += this.W2[row + j] * h[j];
      out[o] = Math.tanh(s);
    }
    return out;
  }
}
