/* ============================================================
   fileset — 大きな一枚を「拠点ごとのファイルセット」に分割・再結合する。
   純粋（DOM 非依存・決定的）。

   - splitInfra(model): 最上位ゾーンごとに 1 ファイル（そのゾーンの完結した infra 文書）
       ＋ _shared.mmd（ハブ・グローバルバス・拠点間リンク・地図/レイヤ設定）に割る。
       各パーツは単体でも parse できる。結合すれば元の一枚に戻る。
   - mergeInfra(texts): ファイルセット（.mmd の中身の配列）→ 一枚の DSL。
       本文を連結し（infra ヘッダと title は先頭のものだけ残す）、%% @layout は重複を除いて併合。
   - zipStore(files): 依存ゼロの ZIP（無圧縮 store・UTF-8 ファイル名・CRC32）。
       [{name, text}] → Uint8Array。ブラウザからそのままダウンロードできる。
   ============================================================ */
import { serialize } from './serialize.js';

// ---- 分割 ----------------------------------------------------------------

const zsubtree = (model, top) => {
  const under = new Set([top]);
  let grew = true;
  while (grew) { grew = false; for (const g of model.groups) if (g.parent && under.has(g.parent) && !under.has(g.name)) { under.add(g.name); grew = true; } }
  return under;
};

function pickLayout(model, ids, zones) {
  const L = model.layout, out = { pos: {}, at: {}, order: [], fold: [], zpos: {}, geo: {} };
  for (const id of Object.keys(L.pos || {})) if (ids.has(id)) out.pos[id] = L.pos[id];
  out.fold = (L.fold || []).filter((z) => zones.has(z));
  for (const z of Object.keys(L.zpos || {})) if (zones.has(z)) out.zpos[z] = L.zpos[z];
  for (const z of Object.keys(L.geo || {})) if (zones.has(z) || ids.has(z)) out.geo[z] = L.geo[z];
  return out;
}

export function splitInfra(model) {
  if (model.kind !== 'infra') return null;
  const tops = model.groups.filter((g) => !g.parent).map((g) => g.name);
  const files = [];
  const claimed = new Set();                                   // どのパーツかに入った item id
  const claimedZones = new Set();
  for (const top of tops) {
    const zones = zsubtree(model, top);
    const items = model.items.filter((x) => x.zone && zones.has(x.zone));
    const ids = new Set(items.map((x) => x.id));
    items.forEach((x) => claimed.add(x.id));
    zones.forEach((z) => claimedZones.add(z));
    const sub = {
      kind: 'infra', meta: { ...model.meta, title: `${model.meta.title || 'infra'} — ${top}`, map: model.meta.map, hazard: null },
      items, order: model.order.filter((id) => ids.has(id)),
      groups: model.groups.filter((g) => zones.has(g.name)),
      edges: model.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
      images: {}, layout: pickLayout(model, ids, zones), errors: [],
    };
    files.push({ name: `${top}.mmd`, text: serialize(sub) });
  }
  // 共有パーツ：ゾーン外のもの（ハブ・グローバルバス・野良機器・フェンス）と、パーツをまたぐ接続。
  // パーツ内で完結する接続（両端が同じ最上位ゾーンの下）以外は全部ここ。
  const rest = model.items.filter((x) => !claimed.has(x.id));
  const restIds = new Set(rest.map((x) => x.id));
  const shared = {
    kind: 'infra', meta: { ...model.meta, title: `${model.meta.title || 'infra'} — _shared（ハブ・広域・拠点間）` },
    items: rest, order: model.order.filter((id) => restIds.has(id)),
    groups: model.groups.filter((g) => !claimedZones.has(g.name)),
    edges: model.edges.filter((e) => !zsame(model, e.from, e.to)),
    images: model.images || {}, layout: pickLayout(model, restIds, new Set()), errors: [],
  };
  files.push({ name: '_shared.mmd', text: serialize(shared) });
  return files;
}

// 2 つの id が同じ最上位ゾーンの下にいるか（＝どこかのパーツ内で完結する接続か）。
function zsame(model, a, b) {
  const topOf = (id) => {
    let z = model.items.find((x) => x.id === id)?.zone;
    while (z) { const g = model.groups.find((x) => x.name === z); if (!g || !g.parent) return z; z = g.parent; }
    return null;
  };
  const ta = topOf(a), tb = topOf(b);
  return ta != null && ta === tb;
}

// ---- 結合 ----------------------------------------------------------------

export function mergeInfra(texts) {
  const bodies = [], trailer = [];
  let title = null;
  texts.forEach((text, ti) => {
    const [bodyRaw, ...trail] = String(text).replace(/\r\n?/g, '\n').split(/^%% @layout$/m);
    for (const line of bodyRaw.split('\n')) {
      const t = line.trim();
      if (t === 'infra') continue;
      if (t.startsWith('title ')) { if (title == null) title = line; continue; }
      if (!t && bodies[bodies.length - 1] === '') continue;
      bodies.push(line);
    }
    for (const line of trail.join('\n').split('\n')) {
      const t = line.trim();
      if (t.startsWith('%%') && !trailer.includes(t)) trailer.push(t);
    }
  });
  const head = ['infra', ...(title != null ? [title] : [])];
  return [...head, ...bodies, '', '%% @layout', ...trailer].join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

// ---- ZIP（store・依存ゼロ） -------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, data);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), name);
    offset += local.length + name.length + data.length;
  }
  const cdStart = offset;
  let cdLen = 0;
  for (const c of central) cdLen += c.length;
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdLen), ...u32(cdStart), ...u16(0),
  ]);
  const total = offset + cdLen + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of [...chunks, ...central, end]) { out.set(c, p); p += c.length; }
  return out;
}
