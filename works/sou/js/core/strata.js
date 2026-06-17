/* ============================================================
   層 — sou. 種ひとつから、地の記憶を積む。
   一年に一枚、地層（ラミナ）が降り積もる。雨の年は厚く粗く、
   乾いた年は薄く細かい。まれに洪水・火山灰・旱魃・地震・繁茂が
   一枚の縞となって刻まれる。下の層ほど己の重みに圧されて薄くなり、
   やがて侵食が崖を切り、断面に深い時間があらわになる。
   誰も縞を描いていない。種と歳月の関数が、ただ積むだけ。
   ——依存ゼロ・副作用なし・同じ種なら何度でも同じ大地。
   ============================================================ */

/* ---- 種から決定的な擬似乱数（mulberry32） ---- */
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 縞の粒度と、まれな出来事。表示・読み取りはこの語彙だけを使う。 */
export const GRAINS = ['gravel', 'sand', 'silt', 'clay'];
export const EVENTS = ['flood', 'ash', 'drought', 'quake', 'bloom'];

/* 出来事ごとの、岩に読む一行（新しい順に並べて「地の年代記」になる）。 */
const EVENT_LINE = {
  flood:   '大水の年。濁流が運んだ礫が、ひと筋の粗い縞となって残った。',
  ash:     '空が灰に曇った年。降り積もった火山灰が、青白い一枚を敷いた。',
  drought: '雨の絶えた年。土はひび割れ、ほとんど積もらぬ薄い縞をかろうじて刻んだ。',
  quake:   '大地の揺れた年。層がずれ、断ち切られた継ぎ目が走っている。',
  bloom:   '水と緑にあふれた年。朽ちた草木が黒く濃い、生命の一枚を沈めた。',
};
export function eventLine(ev) { return EVENT_LINE[ev] || ''; }

/* ============================================================
   deposit — 種から years 年ぶんの堆積を積む。
   返すのは古い順の配列（index 0 = 最古・最下層）。
   各層: { year, thickness, grain, hue, event }
     year:      1..years（1 が最古）
     thickness: 降り積もった元の厚み（>0）
     grain:     GRAINS のいずれか
     hue:       0..11 の鉱物色（ゆっくり巡る）
     event:     null または EVENTS のいずれか
   ============================================================ */
export function deposit(seed, years = 400) {
  years = Math.max(1, years | 0);
  const rng = mulberry32(hashSeed(seed));

  // 気候はいくつかの正弦波の重ね合わせ。周期と位相だけ種で揺らす。
  const cycles = [
    { period: 33 + rng() * 14, phase: rng() * Math.PI * 2, amp: 0.55 },
    { period: 97 + rng() * 60, phase: rng() * Math.PI * 2, amp: 0.30 },
    { period: 260 + rng() * 180, phase: rng() * Math.PI * 2, amp: 0.15 },
  ];
  const climate = (y, off = 0) => {
    let c = 0;
    for (const cy of cycles) c += cy.amp * Math.sin((2 * Math.PI * y) / cy.period + cy.phase + off);
    return c; // おおよそ [-1, 1]
  };
  const hueDrift = rng() * 12;

  const layers = [];
  for (let y = 1; y <= years; y++) {
    const wet = climate(y);                 // 湿潤(+)〜乾燥(-)
    const energy = climate(y, 1.7);          // 運搬の勢い（別位相）
    const wet01 = wet * 0.5 + 0.5;

    // 雨の年は厚く、乾いた年は薄い。少しだけ年ごとの揺らぎ。
    let thickness = 0.35 + 1.15 * wet01 + rng() * 0.35;

    // 粒度：勢いの強い年ほど粗い。
    const gi = Math.min(GRAINS.length - 1, Math.max(0,
      Math.floor((1 - (energy * 0.5 + 0.5)) * GRAINS.length + (rng() - 0.5) * 0.8)));
    let grain = GRAINS[gi];

    // 鉱物色はゆっくり巡る（鉄分の縞のように）。
    let hue = (Math.floor(hueDrift + y / 18 + (rng() - 0.5)) % 12 + 12) % 12;

    // まれな出来事。気候に応じて種類が偏る。
    let event = null;
    if (rng() < 0.045) {
      const r = rng();
      if (wet > 0.45) event = r < 0.7 ? 'flood' : 'bloom';
      else if (wet < -0.45) event = r < 0.7 ? 'drought' : 'ash';
      else event = r < 0.4 ? 'ash' : (r < 0.7 ? 'quake' : 'bloom');

      if (event === 'flood')   { thickness += 1.4; grain = 'gravel'; hue = (hue + 7) % 12; }
      if (event === 'ash')     { thickness = 0.5 + rng() * 0.3; grain = 'silt'; hue = 9; }
      if (event === 'drought') { thickness = 0.12 + rng() * 0.12; grain = 'clay'; hue = (hue + 2) % 12; }
      if (event === 'quake')   { grain = 'sand'; }
      if (event === 'bloom')   { thickness += 0.7; grain = 'clay'; hue = 3; }
    }

    layers.push({ year: y, thickness: +thickness.toFixed(4), grain, hue, event });
  }
  return layers;
}

/* ============================================================
   compact — 埋没した層は己の上の重みに圧される。
   各層に compacted（圧密後の厚み）と burial（上載の厚み）を足して返す。
   下（古い）ほど burial が大きく、圧密係数が小さい——単調。
   ============================================================ */
const COMPACTION_K = 0.025;
export function compact(layers) {
  // 上に載る厚み = より新しい（index の大きい）層の元厚みの総和。
  let above = 0;
  const out = new Array(layers.length);
  for (let i = layers.length - 1; i >= 0; i--) {        // 新しい方から下りる
    const factor = 1 / (1 + COMPACTION_K * above);
    out[i] = { ...layers[i], burial: +above.toFixed(4), factor: +factor.toFixed(6),
      compacted: +(layers[i].thickness * factor).toFixed(5) };
    above += layers[i].thickness;
  }
  return out;
}

/* 圧密後の総深度。 */
export function totalDepth(compacted) {
  let d = 0; for (const l of compacted) d += l.compacted; return +d.toFixed(5);
}

/* ============================================================
   cliff — 侵食が断面を切る。圧密後の柱を rows 段に写し取る。
   返すのは上（新しい）→下（古い）の配列。各段はその深さを占める層。
   ============================================================ */
export function cliff(seed, years = 400, rows = 48) {
  rows = Math.max(1, rows | 0);
  const layers = compact(deposit(seed, years));
  const total = totalDepth(layers);

  // 上（地表＝最も新しい）からの累積深度の区切りを作る。
  const edges = [];                 // edges[k] = index k 層の上端深度
  let acc = 0;
  for (let i = layers.length - 1; i >= 0; i--) { edges.push({ top: acc, layer: layers[i] }); acc += layers[i].compacted; }
  // edges は新しい→古いの順。各段の中心深度がどの層に入るかを引く。
  const face = [];
  let cursor = 0;
  for (let r = 0; r < rows; r++) {
    // 端を地表（最新）と岩盤（最古）に錨で留め、崖が時代の全幅を貫くようにする。
    const depth = rows === 1 ? 0 : (r / (rows - 1)) * total * 0.999999;
    while (cursor + 1 < edges.length && depth >= edges[cursor + 1].top) cursor++;
    const L = edges[cursor].layer;
    face.push({ row: r, depth: +depth.toFixed(4), year: L.year, grain: L.grain, hue: L.hue, event: L.event, glyph: glyphFor(L) });
  }
  return face;
}

/* ============================================================
   readRecord — 岩に刻まれた出来事を、新しい順に読み上げる。
   present は「今」に当たる年（既定では最も新しい年）。ago は何年前か。
   ============================================================ */
export function readRecord(seed, years = 400) {
  const layers = deposit(seed, years);
  const present = years;
  return layers
    .filter(l => l.event)
    .map(l => ({ year: l.year, ago: present - l.year, event: l.event, line: eventLine(l.event) }))
    .sort((a, b) => b.year - a.year);   // 新しい順
}

/* 粒度・出来事から、ASCII の濃淡記号を選ぶ（UI が無くても読めるように）。 */
const GRAIN_GLYPH = { gravel: '▓', sand: '▒', silt: '░', clay: '·' };
export function glyphFor(layer) {
  if (layer.event === 'quake') return '╱';
  if (layer.event === 'ash') return '─';
  if (layer.event === 'bloom') return '█';
  return GRAIN_GLYPH[layer.grain] || '░';
}

/* 崖を文字で刷る（テスト・端末・確認用）。 */
export function renderText(seed, years = 400, rows = 40, width = 18) {
  const face = cliff(seed, years, rows);
  return face.map(c => c.glyph.repeat(width) + (c.event ? `  ◂ ${c.year}年 ${c.event}` : '')).join('\n');
}
