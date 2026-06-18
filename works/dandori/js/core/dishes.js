/* ============================================================
   段取り — dishes. 料理とその工程のモデル、そして定番の献立。
   DOM を知らない。Node でも同じデータ。

   工程(step) は、かかる分数と「何を要るか」を持つ：
     min  … 分
     hands… あなたの手が要る（同時に一つしかできない）
     heat … こんろを一口要る（炒める・煮る・揚げる…）
     oven … オーブン／魚焼きグリルを要る
   手も火も要らない工程（浸す・蒸らす・冷ます・炊飯器まかせ）は
     どれも false ＝ 放っておける時間。ここが段取りの肝になる。

   料理は fresh（0..3）を持つ＝「どれだけ出来たてで出したいか」。
   高いほど（揚げ物・サラダ）配膳ぎりぎりの良い時間帯を先に取り、
   低いもの（ご飯・煮込み・おひたし＝置ける物）は早めに回す。
   ============================================================ */

/* 工程をつくる小さな助け。s('炒める', 6, {heat:1}) のように。 */
export function step(name, min, opt = {}) {
  return {
    name,
    min: Math.max(1, Math.round(min)),
    hands: !!opt.hands,
    heat: !!opt.heat,
    oven: !!opt.oven,
  };
}

/* 工程が要る資源の一覧（表示・検証用）。 */
export function needs(st) {
  const r = [];
  if (st.hands) r.push('hands');
  if (st.heat) r.push('heat');
  if (st.oven) r.push('oven');
  return r;
}
/* 手も火もオーブンも要らない＝放っておける工程。 */
export function isIdle(st) { return !st.hands && !st.heat && !st.oven; }

/* 料理の総所要（全工程の分の和）。 */
export function totalMin(dish) { return dish.steps.reduce((a, s) => a + s.min, 0); }

/* ============================================================
   定番の献立。家庭料理のだいたいの目安（分）。
   一覧から選ぶも良し、これを下敷きに自分で直すも良し。
   ============================================================ */
const S = step;
export const PRESETS = [
  { id: 'gohan', fresh: 1, name: 'ご飯', emoji: '🍚', note: '炊飯器まかせの時間が長い。先に仕掛ければ手は空く。', steps: [
    S('米を研ぐ', 5, { hands: 1 }),
    S('炊く（炊飯器）', 50),
    S('蒸らす', 10),
  ] },
  { id: 'miso', fresh: 2, name: '味噌汁', emoji: '🥣', note: '最後に味噌を溶く。煮立てすぎない。', steps: [
    S('だしを沸かす', 8, { heat: 1 }),
    S('具を煮る', 7, { heat: 1 }),
    S('味噌を溶く', 3, { hands: 1, heat: 1 }),
  ] },
  { id: 'karaage', fresh: 3, name: '唐揚げ', emoji: '🍗', note: '下味は早めでも可。揚げたてが命。', steps: [
    S('下味をつける', 15, { hands: 1 }),
    S('衣をつける', 5, { hands: 1 }),
    S('揚げる', 12, { hands: 1, heat: 1 }),
    S('油を切る', 3),
  ] },
  { id: 'nikujaga', fresh: 1, name: '肉じゃが', emoji: '🥔', note: '煮ている間は手が空く。少し置くと味がしみる。', steps: [
    S('材料を切る', 10, { hands: 1 }),
    S('炒める', 6, { hands: 1, heat: 1 }),
    S('煮る', 20, { heat: 1 }),
    S('仕上げる', 3, { hands: 1, heat: 1 }),
  ] },
  { id: 'curry', fresh: 1, name: 'カレー', emoji: '🍛', note: '煮込みが長い。早めに火にかけて放置。', steps: [
    S('材料を切る', 12, { hands: 1 }),
    S('炒める', 8, { hands: 1, heat: 1 }),
    S('煮込む', 30, { heat: 1 }),
    S('ルーを入れる', 8, { hands: 1, heat: 1 }),
  ] },
  { id: 'ohitashi', fresh: 0, name: 'おひたし', emoji: '🥬', note: '茹でて冷ますだけ。先に作って置ける。', steps: [
    S('茹でる', 5, { heat: 1 }),
    S('冷まして絞る', 5, { hands: 1 }),
    S('和える', 3, { hands: 1 }),
  ] },
  { id: 'salad', fresh: 3, name: 'サラダ', emoji: '🥗', note: '直前に。早すぎると水っぽくなる。', steps: [
    S('洗って切る', 8, { hands: 1 }),
    S('盛りつける', 2, { hands: 1 }),
  ] },
  { id: 'yakizakana', fresh: 2, name: '焼き魚', emoji: '🐟', note: 'グリル任せの間は手が空く。', steps: [
    S('下ごしらえ', 5, { hands: 1 }),
    S('焼く（グリル）', 15, { oven: 1 }),
    S('盛りつける', 2, { hands: 1 }),
  ] },
  { id: 'gratin', fresh: 2, name: 'グラタン', emoji: '🧀', note: 'ソースを作ってからオーブンへ。', steps: [
    S('具を炒める', 8, { hands: 1, heat: 1 }),
    S('ソースを作る', 8, { hands: 1, heat: 1 }),
    S('焼く（オーブン）', 20, { oven: 1 }),
  ] },
  { id: 'dashimaki', fresh: 3, name: 'だし巻き卵', emoji: '🍳', note: '焼きは手が離せない。', steps: [
    S('卵を溶く', 3, { hands: 1 }),
    S('焼く', 8, { hands: 1, heat: 1 }),
  ] },
  { id: 'gyoza', fresh: 3, name: '餃子', emoji: '🥟', note: '包みは早めでも可。焼きは直前に。', steps: [
    S('餡を作る', 12, { hands: 1 }),
    S('包む', 15, { hands: 1 }),
    S('焼く', 10, { hands: 1, heat: 1 }),
  ] },
  { id: 'soup', fresh: 2, name: 'スープ', emoji: '🍲', note: '煮るだけ。火にかけたら放置。', steps: [
    S('材料を切る', 6, { hands: 1 }),
    S('煮る', 15, { heat: 1 }),
    S('味を調える', 2, { hands: 1, heat: 1 }),
  ] },
];

export const presetById = Object.fromEntries(PRESETS.map(d => [d.id, d]));

/* 工程配列を安全な dish にする（自作の献立づくり用）。 */
export function makeDish(name, steps, opt = {}) {
  return {
    id: opt.id || ('d' + Math.random().toString(36).slice(2, 8)),
    name: name || '料理',
    emoji: opt.emoji || '🍽️',
    fresh: opt.fresh == null ? 2 : Math.max(0, Math.min(3, opt.fresh | 0)),
    note: opt.note || '',
    steps: (steps || []).map(s => step(s.name, s.min, s)),
  };
}
