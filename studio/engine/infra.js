/* ============================================================
   infra — システム構成図。studio の拡張図種（Mermaid には無い）。
   ------------------------------------------------------------
   ねらい：既存ツールの構成図は「箱を並べて線を引いて属性を書く」を
   人間が全部やる。ここでは **知っていることを行で書くだけ** にする：
     ・zone 〜 { … }   … 建屋・フロア・部署・ドメイン・セグメント（入れ子可）
     ・id[ラベル] :役割, OS, IPアドレス, vlan N
     ・bus id[ラベル] :h|v, vlan N, 10.0.0.0/24   … 水平/垂直の基幹バス
     ・a -- b          … 接続（機器同士でも、機器とバスでも）
   置き場所は自動（ゾーン内で折り返し配置）。ドラッグすれば %% pos に
   保存され、ゾーンの枠は中身を追いかける。役割は色とタグ（CORE/FW/SV…）、
   OS・IP・VLAN は機器カードの中に小さく書かれる。
   例：
     infra
       title 本社ネットワーク
       zone 本社 3F {
         sw3[SW-3F] :access, ios15, vlan 30
         pc[営業PC x40] :pc, win11
       }
       zone サーバ室 {
         core[CORE] :core, nxos
         fw[FW-1] :firewall
         ap1[基幹AP] :server, rhel9, 10.0.10.5
       }
       bus lan[基幹LAN] :h, vlan 10, 10.0.10.0/24
       core -- lan
       ap1 -- lan
       sw3 -- core
   ============================================================ */
import { themeOf } from '../render/draw.js';

// 役割の正規化：書き方のゆらぎ（sw / switch / l2…）を吸収する。
const ROLE_ALIAS = {
  core: 'core', dist: 'dist', distribution: 'dist', access: 'access',
  sw: 'switch', switch: 'switch', l2: 'switch', l3: 'switch',
  rt: 'router', router: 'router', gw: 'router',
  fw: 'firewall', firewall: 'firewall', utm: 'firewall',
  sv: 'server', srv: 'server', server: 'server',
  db: 'db', database: 'db',
  st: 'storage', storage: 'storage', nas: 'storage',
  pc: 'pc', client: 'pc', clients: 'pc',
  ap: 'ap', wifi: 'ap', wlc: 'ap',
  lb: 'lb', proxy: 'lb',
  cloud: 'cloud', wan: 'cloud', net: 'cloud', internet: 'cloud',
  prn: 'printer', printer: 'printer',
};
export const ROLE_TAG = { core: 'CORE', dist: 'DIST', access: 'ACC', switch: 'SW', router: 'RT',
  firewall: 'FW', server: 'SV', db: 'DB', storage: 'ST', pc: 'PC', ap: 'AP', lb: 'LB', cloud: 'NET', printer: 'PR' };
const ROLE_HUE = { core: '#f5b86a', dist: '#f5b86a', access: '#6aa9ff', switch: '#6aa9ff', router: '#d68ad6',
  firewall: '#f57a8a', server: '#7ad1b0', db: '#7ad1b0', storage: '#8ad1f5', pc: '#9aa3b5', ap: '#b8a6ff',
  lb: '#8ad1f5', cloud: '#8ad1f5', printer: '#9aa3b5' };

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;

// :attr, attr, … を {role, os, ip, vlan, orient} に。役割でも IP でも VLAN でも
// ない言葉は OS/バージョン扱い——「知らない言葉は捨てずに書いておく」が構成図の礼儀。
function parseAttrs(spec) {
  const out = { role: null, os: null, ip: null, vlan: null, orient: null };
  for (const tokRaw of String(spec || '').split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const low = tok.toLowerCase();
    const mv = /^vlan\s*(\d+)$/i.exec(tok);
    if (mv) { out.vlan = +mv[1]; continue; }
    if (/^(h|horizontal|横)$/.test(low)) { out.orient = 'h'; continue; }
    if (/^(v|vertical|縦)$/.test(low)) { out.orient = 'v'; continue; }
    if (IP_RE.test(tok)) { out.ip = tok; continue; }
    if (ROLE_ALIAS[low]) { out.role = ROLE_ALIAS[low]; continue; }
    out.os = out.os ? out.os + ' ' + tok : tok;
  }
  return out;
}

const INF_ID = '[A-Za-z0-9_\\u00C0-\\uFFFF][A-Za-z0-9_.\\-\\u00C0-\\uFFFF]*';
const NODE_RE = new RegExp(`^(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const BUS_RE = new RegExp(`^bus\\s+(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const LINK_RE = new RegExp(`^(${INF_ID})\\s*--\\s*(${INF_ID})$`);

export function parseInfra(lines, model) {
  model.kind = 'infra';
  const zstack = [];                                          // 入れ子の現在地
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    if (line === 'infra') continue;
    if (line.startsWith('title ')) { model.meta.title = line.slice(6).trim(); continue; }
    const zm = /^zone\s+(.+?)\s*\{$/.exec(line);
    if (zm) {
      let name = zm[1];
      while (model.groups.some((g) => g.name === name)) name += '′';   // 同名ゾーンは正直に区別
      model.groups.push({ name, parent: zstack.length ? zstack[zstack.length - 1] : null });
      zstack.push(name);
      continue;
    }
    if (line === '}') { if (zstack.length) zstack.pop(); else model.errors.push(`L${ln}: 閉じすぎの「}」`); continue; }
    const bm = BUS_RE.exec(line);
    if (bm) {
      const a = parseAttrs(bm[3]);
      model.items.push({ type: 'bus', id: bm[1], label: bm[2] || bm[1],
        orient: a.orient || 'h', vlan: a.vlan, cidr: a.ip });
      model.order.push(bm[1]);
      continue;
    }
    const lm = LINK_RE.exec(line);
    if (lm) { model.edges.push({ from: lm[1], to: lm[2] }); continue; }
    const nm = NODE_RE.exec(line);
    if (nm) {
      if (model.items.some((x) => x.id === nm[1])) { model.errors.push(`L${ln}: id が重複「${nm[1]}」`); continue; }
      const a = parseAttrs(nm[3]);
      model.items.push({ type: 'inode', id: nm[1], label: nm[2] || nm[1],
        role: a.role, os: a.os, ip: a.ip, vlan: a.vlan,
        zone: zstack.length ? zstack[zstack.length - 1] : null });
      model.order.push(nm[1]);
      continue;
    }
    model.errors.push(`L${ln}: 読めない行「${line}」`);
  }
  if (zstack.length) model.errors.push(`閉じていない zone（} が ${zstack.length} 個足りない）`);
  // 接続先の存在確認（打ち間違いに早く気づく）。
  for (const e of model.edges)
    for (const end of [e.from, e.to])
      if (!model.items.some((x) => x.id === end)) model.errors.push(`接続の相手が見つからない「${end}」`);
  return model;
}

// ---- レイアウト ---------------------------------------------------------------
// ゾーンの中で折り返し配置 → ゾーンは中身に合わせて膨らむ →
// ドラッグ（%% pos）があれば従い、ゾーン枠は中身の bbox を追いかける。
// バスは本文の下（h）／右（v）に並び、接続は最短の垂線で落ちる。

const metaLines = (n) => [n.os, n.ip, n.vlan != null ? 'VLAN ' + n.vlan : null].filter(Boolean);

// 全角は半角の約 1.7 倍幅。ここをサボるとラベルが役割タグに刺さる。
const textW = (s, px) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? px * 1.7 : px), 0);

function inodeSize(n) {
  const metas = metaLines(n);
  const w = Math.max(118, textW(n.label, 7.6) + (n.role ? 58 : 26), ...metas.map((s) => textW(s, 6.3) + 30));
  return { w: Math.ceil(w), h: 30 + metas.length * 13 + (metas.length ? 6 : 0) };
}

export function layoutInfra(model) {
  const nodes = model.items.filter((x) => x.type === 'inode')
    .map((n) => ({ ...n, ...inodeSize(n), x: 0, y: 0 }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const zones = model.groups.map((g) => ({ ...g, x: 0, y: 0, w: 0, h: 0, depth: 0 }));
  const zoneOf = new Map(zones.map((z) => [z.name, z]));
  for (const z of zones) { let p = z.parent, d = 0; while (p) { d++; p = zoneOf.get(p)?.parent; } z.depth = d; }

  const PAD = 14, HEAD = 24, GAP = 12;
  // ゾーンを内側から積む：子ブロック（子ゾーン＋直属ノード）を折り返しで敷き詰める。
  function pack(zname) {
    const kidZones = zones.filter((z) => z.parent === zname);
    const blocks = [
      ...kidZones.map((z) => ({ kind: 'zone', ref: z, w: (pack(z.name), z.w), h: z.h })),
      ...nodes.filter((n) => n.zone === zname).map((n) => ({ kind: 'node', ref: n, w: n.w, h: n.h })),
    ];
    const limit = Math.max(560, ...blocks.map((b) => b.w + PAD * 2));
    let x = PAD, y = (zname ? HEAD : 0) + PAD, rowH = 0, w = 0;
    for (const b of blocks) {
      if (x > PAD && x + b.w > limit) { x = PAD; y += rowH + GAP; rowH = 0; }
      b.ref._dx = x; b.ref._dy = y;                          // 親からの相対位置（後で絶対化）
      x += b.w + GAP; rowH = Math.max(rowH, b.h); w = Math.max(w, x - GAP + PAD);
    }
    const z = zoneOf.get(zname);
    if (z) { z.w = Math.max(w, zname.length * 12 + 40); z.h = y + rowH + PAD; }
    return { w, h: y + rowH + PAD };
  }
  const root = pack(null);
  // 相対 → 絶対。
  function place(zname, ox, oy) {
    for (const z of zones.filter((zz) => zz.parent === zname)) { z.x = ox + z._dx; z.y = oy + z._dy; place(z.name, z.x, z.y); }
    for (const n of nodes.filter((nn) => nn.zone === zname)) { n.x = ox + n._dx; n.y = oy + n._dy; }
  }
  place(null, 20, 20);
  // ドラッグの上書き。
  for (const n of nodes) if (model.layout.pos[n.id]) { n.x = model.layout.pos[n.id][0]; n.y = model.layout.pos[n.id][1]; }
  // ゾーン枠は中身の bbox を追いかける（深い順に畳むと親が子を包む）。
  for (const z of [...zones].sort((a, b) => b.depth - a.depth)) {
    const inner = [
      ...nodes.filter((n) => n.zone === z.name),
      ...zones.filter((zz) => zz.parent === z.name),
    ];
    if (!inner.length) { z.w = Math.max(z.w, 120); z.h = Math.max(z.h, 60); continue; }
    const x0 = Math.min(...inner.map((b) => b.x)) - PAD, y0 = Math.min(...inner.map((b) => b.y)) - PAD - (HEAD - 6);
    const x1 = Math.max(...inner.map((b) => b.x + b.w)) + PAD, y1 = Math.max(...inner.map((b) => b.y + b.h)) + PAD;
    z.x = x0; z.y = y0; z.w = x1 - x0; z.h = y1 - y0;
  }
  // 本文の bbox（バスの置き場所を決めるため）。
  const bx1 = Math.max(120, ...nodes.map((n) => n.x + n.w), ...zones.map((z) => z.x + z.w));
  const by1 = Math.max(80, ...nodes.map((n) => n.y + n.h), ...zones.map((z) => z.y + z.h));
  // バス：h は下に順に、v は右に順に。ドラッグ（pos の y / x）で動かせる。
  const buses = [];
  let hy = by1 + 44, vx = bx1 + 56;
  for (const b of model.items.filter((x) => x.type === 'bus')) {
    if (b.orient === 'v') {
      const x = model.layout.pos[b.id] ? model.layout.pos[b.id][0] : vx;
      buses.push({ ...b, x, y1: 16, y2: by1 + 20 });
      if (!model.layout.pos[b.id]) vx += 56;
    } else {
      const y = model.layout.pos[b.id] ? model.layout.pos[b.id][1] : hy;
      buses.push({ ...b, y, x1: 16, x2: bx1 + 20 });
      if (!model.layout.pos[b.id]) hy += 46;
    }
  }
  const busOf = new Map(buses.map((b) => [b.id, b]));
  // 接続線：機器⇔バスは垂線、機器⇔機器は中心同士。
  const links = [];
  for (const e of model.edges) {
    const na = byId.get(e.from), nb = byId.get(e.to);
    const ba = busOf.get(e.from), bb = busOf.get(e.to);
    if (na && bb) links.push(stub(na, bb));
    else if (nb && ba) links.push(stub(nb, ba));
    else if (na && nb) links.push({ x1: na.x + na.w / 2, y1: na.y + na.h / 2, x2: nb.x + nb.w / 2, y2: nb.y + nb.h / 2 });
  }
  function stub(n, b) {
    if (b.orient === 'v') { const y = n.y + n.h / 2; return { x1: n.x + n.w, y1: y, x2: b.x, y2: y, dot: true }; }
    const x = n.x + n.w / 2; return { x1: x, y1: n.y + n.h, x2: x, y2: b.y, dot: true };
  }
  const width = Math.max(bx1, ...buses.map((b) => b.orient === 'v' ? b.x : b.x2)) + 40;
  const height = Math.max(by1, ...buses.map((b) => b.orient === 'v' ? b.y2 : b.y)) + 40;
  return { kind: 'infra', width, height, nodes, zones, buses, links, errors: [] };
}

// ---- 描画 ----------------------------------------------------------------------

const iesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function drawInfra(model, L, opts = {}) {
  const T = themeOf(opts);
  const parts = [];
  for (const z of [...L.zones].sort((a, b) => a.depth - b.depth)) {  // 浅い枠から描く（親が下）
    parts.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" fill="${T.frameFill}" fill-opacity="${0.03 + z.depth * 0.02}" stroke="${T.dim}" stroke-dasharray="5 4" stroke-opacity="0.7"/>`);
    parts.push(`<text x="${z.x + 12}" y="${z.y + 16}" fill="${T.head}" font-size="11.5" font-weight="700">${iesc(z.name)}</text>`);
  }
  for (const l of L.links) {
    parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${T.line}" stroke-opacity="0.7" stroke-width="1.4"/>`);
    if (l.dot) parts.push(`<circle cx="${l.x2}" cy="${l.y2}" r="3.4" fill="${T.line}"/>`);
  }
  for (const b of L.buses) {
    const chip = [b.label, b.vlan != null ? 'VLAN ' + b.vlan : null, b.cidr].filter(Boolean).join(' ・ ');
    if (b.orient === 'v') {
      parts.push(`<g data-drag="node" data-id="${iesc(b.id)}" style="cursor:grab">`
        + `<line x1="${b.x}" y1="${b.y1}" x2="${b.x}" y2="${b.y2}" stroke="#8ad1f5" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="${b.x - 10}" y="${b.y1}" width="20" height="${b.y2 - b.y1}" fill="transparent"/>`
        + `<text x="${b.x + 9}" y="${b.y1 + 14}" fill="#8ad1f5" font-size="11" writing-mode="tb">${iesc(chip)}</text></g>`);
    } else {
      parts.push(`<g data-drag="node" data-id="${iesc(b.id)}" style="cursor:grab">`
        + `<line x1="${b.x1}" y1="${b.y}" x2="${b.x2}" y2="${b.y}" stroke="#8ad1f5" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="${b.x1}" y="${b.y - 10}" width="${b.x2 - b.x1}" height="20" fill="transparent"/>`
        + `<text x="${b.x1 + 4}" y="${b.y - 9}" fill="#8ad1f5" font-size="11" font-weight="600">${iesc(chip)}</text></g>`);
    }
  }
  L.nodes.forEach((n) => {
    const hue = ROLE_HUE[n.role] || '#9aa3b5';
    const tag = ROLE_TAG[n.role];
    const sel = !!opts.selected?.has?.(n.id);
    const metas = metaLines(n);
    let g = `<g data-drag="node" data-id="${iesc(n.id)}" style="cursor:grab">`;
    if (sel) g += `<rect x="${n.x - 5}" y="${n.y - 5}" width="${n.w + 10}" height="${n.h + 10}" rx="9" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    g += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7" fill="${T.nodeFill}" stroke="${hue}" stroke-width="${sel ? 2.6 : 1.5}"/>`
      + `<rect x="${n.x}" y="${n.y}" width="4" height="${n.h}" rx="2" fill="${hue}"/>`;              // 役割の色帯
    if (tag) g += `<rect x="${n.x + n.w - 34}" y="${n.y + 5}" width="28" height="14" rx="4" fill="${hue}" fill-opacity="0.18"/>`
      + `<text x="${n.x + n.w - 20}" y="${n.y + 15.5}" fill="${hue}" font-size="9" font-weight="700" text-anchor="middle">${tag}</text>`;
    g += `<text x="${n.x + 12}" y="${n.y + 19}" fill="${T.ink}" font-size="12.5" font-weight="600">${iesc(n.label)}</text>`;
    metas.forEach((m2, i) => {
      g += `<text x="${n.x + 12}" y="${n.y + 34 + i * 13}" fill="${T.dim}" font-size="10.5">${iesc(m2)}</text>`;
    });
    parts.push(g + `</g>`);
    if (sel && opts.selected.size === 1)
      parts.push(`<g data-connect="1" data-id="${iesc(n.id)}" style="cursor:crosshair">`
        + `<circle cx="${n.x + n.w + 14}" cy="${n.y + n.h / 2}" r="8" fill="#6aa9ff"/>`
        + `<text x="${n.x + n.w + 14}" y="${n.y + n.h / 2 + 3.5}" fill="${T.paper}" font-size="10" text-anchor="middle" font-weight="700">→</text></g>`);
  });
  return parts.join('\n');
}

// ---- 逆コンパイル（serialize から呼ぶ）------------------------------------------

const attrsOf = (n) => [
  n.role, n.os, n.ip, n.vlan != null ? 'vlan ' + n.vlan : null,
].filter(Boolean).join(', ');

export function infraBody(model) {
  const out = ['infra'];
  if (model.meta.title) out.push(`    title ${model.meta.title}`);
  const nodeLine = (n, ind) => `${ind}${n.id}[${n.label}]${attrsOf(n) ? ' :' + attrsOf(n) : ''}`;
  const emitZone = (zname, ind) => {
    for (const z of model.groups.filter((g) => g.parent === zname)) {
      out.push(`${ind}zone ${z.name} {`);
      emitZone(z.name, ind + '  ');
      out.push(`${ind}}`);
    }
    for (const n of model.items.filter((x) => x.type === 'inode' && x.zone === zname)) out.push(nodeLine(n, ind));
  };
  emitZone(null, '    ');
  for (const b of model.items.filter((x) => x.type === 'bus')) {
    const attrs = [b.orient, b.vlan != null ? 'vlan ' + b.vlan : null, b.cidr].filter(Boolean).join(', ');
    out.push(`    bus ${b.id}[${b.label}]${attrs ? ' :' + attrs : ''}`);
  }
  for (const e of model.edges) out.push(`    ${e.from} -- ${e.to}`);
  return out;
}
