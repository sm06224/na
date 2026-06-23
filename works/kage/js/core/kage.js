/* ============================================================
   影 — 灯りひとつ、壁ひとつ。あいだに切り絵を立てると、影が落ちる。

   点光源の射影。灯りを深さ 0、壁を深さ W に置く。深さ p（0 < p < W）に
   立つ切り絵の頂点 V を、灯り L から壁へ投げると：

       S = L + (V − L)·(W / p)            倍率 m = W / p ≥ 1

   灯りに近い（p 小）ほど影は大きく、ふちは惚ける。壁に寄る（p → W）ほど
   影は実物大に縮み、ふちは締まる。灯りは点ではなく炎の幅 r を持つから、
   半影（ぼけ）の幅は壁の上で

       b = r·(W − p) / p

   だけ拡がる。誰も影のかたちを描かない——光と、あいだの距離が描く。
   コアは DOM も canvas も知らない。Node の中でも、同じ影が落ちる。
   ============================================================ */

export const WALL = 1;                 // 灯りから壁までの深さ（正規化）
export const FLAME_RADIUS = 0.013;     // 炎の幅（半影の素）

/* 灯り L から、深さ p に立つ点 (vx,vy) が壁に落とす影の位置。 */
export function castPoint(lamp, vx, vy, p, wall = WALL) {
  const m = wall / p;
  return { x: lamp.x + (vx - lamp.x) * m, y: lamp.y + (vy - lamp.y) * m };
}

/* 影の倍率。p が小さい（灯りに近い）ほど大きい。 */
export function magnification(p, wall = WALL) {
  return wall / p;
}

/* 半影（ぼけ）の幅。炎の半径 r、深さ p。壁ぎわ（p→wall）で 0 になる。 */
export function penumbra(p, r = FLAME_RADIUS, wall = WALL) {
  return r * (wall - p) / p;
}

/* 切り絵の局所座標を、回転・拡大・移動して舞台座標へ置く。 */
function placeVertex(vx, vy, cos, sin, scale, ox, oy) {
  return [
    (vx * cos - vy * sin) * scale + ox,
    (vx * sin + vy * cos) * scale + oy,
  ];
}

/* 切り絵（手足の集まり）を、時刻 t（秒）に合わせて生かし、舞台に立てる。
   手足は支点まわりに揺れ（羽ばたき・そよぎ）、生き物はそっと息をする。
   drive は「動きの勢い」(0=休み, 1=活発)。掴んで動かすほど大きく速く動く。
   t=0・drive=0 なら rest 姿（静止）に戻る。
   puppet = { limbs:[{points,pivot,swing}], x, y, scale, rot, alive, phase } */
export function worldParts(puppet, t = 0, drive = 0) {
  const cos = Math.cos(puppet.rot || 0);
  const sin = Math.sin(puppet.rot || 0);
  const scale = puppet.scale == null ? 1 : puppet.scale;
  const ph = puppet.phase || 0;
  const breath = puppet.alive ? 1 + 0.022 * Math.sin(2 * Math.PI * 0.55 * t + ph) : 1;
  const limbs = puppet.limbs || (puppet.parts || []).map((points) => ({ points }));
  return limbs.map((limb) => {
    let pts = limb.points;
    if (limb.swing && limb.pivot) {
      const sw = limb.swing;
      const d = sw.wind ? 1 : 0.32 + 0.68 * drive;          // 風・波は常に、生き物は勢いで
      const a = sw.amp * d * Math.sin(2 * Math.PI * sw.hz * t * (1 + 0.7 * drive) + (sw.phase || 0) + ph);
      const [px, py] = limb.pivot, c2 = Math.cos(a), s2 = Math.sin(a);
      pts = pts.map(([x, y]) => {
        const dx = x - px, dy = y - py;
        return [px + dx * c2 - dy * s2, py + dx * s2 + dy * c2];
      });
    }
    return pts.map(([vx, vy]) => placeVertex(vx, vy * breath, cos, sin, scale, puppet.x, puppet.y));
  });
}

/* 切り絵ひとつの影。壁の上のポリゴン群・ぼけ幅・倍率を返す。 */
export function castPuppet(lamp, puppet, opts = {}) {
  const { wall = WALL, flameRadius = FLAME_RADIUS, t = 0, drive = 0 } = opts;
  const p = puppet.depth;
  const parts = worldParts(puppet, t, drive).map((part) =>
    part.map(([x, y]) => castPoint(lamp, x, y, p, wall))
  );
  return { parts, blur: penumbra(p, flameRadius, wall), magnification: wall / p };
}

/* 炎のゆらぎ。t（秒）と種から決まる、[-1,1] のなめらかな値。
   いくつもの正弦を重ねた、決定的な「気まぐれ」。誰がいつ点しても同じ炎。 */
const FLAME_HARMONICS = [[1.7, 1], [3.1, 0.5], [7.3, 0.25], [13.0, 0.12]];
export function flicker(t, seed = 1, harmonics = FLAME_HARMONICS) {
  let v = 0, norm = 0;
  for (let k = 0; k < harmonics.length; k++) {
    const [hz, amp] = harmonics[k];
    const phase = ((seed * 9301 + (k + 1) * 49297) % 233280) / 233280 * Math.PI * 2;
    v += amp * Math.sin(2 * Math.PI * hz * t + phase);
    norm += amp;
  }
  return v / norm;
}

/* ---- 場面を畳む・ひらく（#s= で同じ夜を分かち合うための、会える種）----
   決定的・往復可能。座標は 1/1000 の格子に丸める。 */
const Q = (n) => Math.round(n * 1000);
const U = (s) => Number(s) / 1000;

export function packScene(scene) {
  const head = `${Q(scene.lamp.x)},${Q(scene.lamp.y)}`;
  const body = scene.puppets
    .map((p) => [p.kind, Q(p.x), Q(p.y), Q(p.depth), Q(p.scale), Q(p.rot || 0)].join(','))
    .join(';');
  return head + '|' + body;
}

export function unpackScene(str) {
  const [head, body = ''] = String(str).split('|');
  const [lx, ly] = head.split(',');
  const lamp = { x: U(lx), y: U(ly) };
  const puppets = body
    ? body.split(';').filter(Boolean).map((seg) => {
        const f = seg.split(',');
        return { kind: f[0], x: U(f[1]), y: U(f[2]), depth: U(f[3]), scale: U(f[4]), rot: U(f[5]) };
      })
    : [];
  return { lamp, puppets };
}
