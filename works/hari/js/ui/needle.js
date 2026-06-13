/* 文字盤 — 針と方位環を描く。角度はぜんぶ度で受け取り、
   継ぎ目（0/360）をまたいでも最短の弧でなめらかに追いつく。 */

const rad = d => d * Math.PI / 180;

function approach(cur, target, k = 0.18) {
  let d = (target - cur) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return cur + d * k;
}

export class Dial {
  constructor(canvas) {
    this.cv = canvas;
    this.cx = canvas.getContext('2d');
    this.needle = 0;        // 表示中の針の角度
    this.rose = 0;          // 表示中の方位環の回転
    this.pulse = 0;
  }

  fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.cv.clientWidth;
    if (!w) return;
    if (this.cv.width !== w * dpr) {
      this.cv.width = this.cv.height = w * dpr;
    }
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.r = w / 2;
  }

  /* needleDeg: 針の角度（null なら迷い）、roseDeg: 環の回転（-heading）
     arrived: もう着いた、dim: センサ無しの淡い表示 */
  render({ needleDeg = null, roseDeg = 0, arrived = false, dim = false }) {
    this.fit();
    const c = this.cx, r = this.r;
    if (!r) return;
    c.clearRect(0, 0, r * 2, r * 2);
    c.save();
    c.translate(r, r);
    this.pulse = (this.pulse + 0.025) % 1;

    /* 外環 */
    c.strokeStyle = 'rgba(255,255,255,.1)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, r - 6, 0, Math.PI * 2); c.stroke();

    /* 方位環（北が実際の北を向くよう回す） */
    this.rose = approach(this.rose, roseDeg);
    c.save();
    c.rotate(rad(this.rose));
    for (let i = 0; i < 16; i++) {
      const main = i % 4 === 0;
      c.save();
      c.rotate(rad(i * 22.5));
      c.strokeStyle = main ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.14)';
      c.lineWidth = main ? 2 : 1;
      c.beginPath();
      c.moveTo(0, -(r - 10));
      c.lineTo(0, -(r - (main ? 24 : 17)));
      c.stroke();
      c.restore();
    }
    /* 北のしるし */
    c.fillStyle = dim ? 'rgba(230,120,110,.35)' : 'rgba(230,120,110,.9)';
    c.font = `300 ${Math.round(r * 0.11)}px ui-sans-serif, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('北', 0, -(r - 38));
    c.restore();

    if (arrived) {
      /* もう着いている — 波紋だけが残る */
      for (const k of [0, 0.5]) {
        const p = (this.pulse + k) % 1;
        c.strokeStyle = `rgba(120,220,170,${(1 - p) * 0.55})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 14 + p * r * 0.55, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = 'rgba(120,220,170,.95)';
      c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }

    /* 針 */
    const target = needleDeg ?? this.needle;
    this.needle = approach(this.needle, target);
    c.save();
    c.rotate(rad(this.needle));
    const L = r * 0.62, W = r * 0.085;
    const alpha = dim ? 0.35 : 1;
    /* 先（指す側）— 紅 */
    c.fillStyle = `rgba(230,110,100,${alpha})`;
    c.beginPath();
    c.moveTo(0, -L); c.lineTo(W, 0); c.lineTo(-W, 0); c.closePath();
    c.fill();
    /* 尾 — 胡粉 */
    c.fillStyle = `rgba(236,231,223,${0.5 * alpha})`;
    c.beginPath();
    c.moveTo(0, L * 0.7); c.lineTo(W * 0.8, 0); c.lineTo(-W * 0.8, 0); c.closePath();
    c.fill();
    /* 芯 */
    c.fillStyle = `rgba(20,20,24,1)`;
    c.beginPath(); c.arc(0, 0, W * 0.55, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(255,255,255,${0.5 * alpha})`;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, W * 0.55, 0, Math.PI * 2); c.stroke();
    c.restore();

    c.restore();
  }
}
