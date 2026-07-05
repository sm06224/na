/* ============================================================
   infra — システム構成図。studio の拡張図種（Mermaid には無い）。
   ------------------------------------------------------------
   ねらい：既存ツールの構成図は「箱を並べて線を引いて属性を書く」を
   人間が全部やる。ここでは **知っていることを行で書くだけ** にする。
   IT だけでなく OT（SCADA/PLC/HMI/Historian/データダイオード…）も一級市民。

     ・zone 〜 { … }        … 建屋/フロア/部署/ドメイン/Purdue レベル（入れ子可・折りたたみ可）
     ・id[ラベル] :役割, OS, IP, vlan N
     ・bus id[ラベル] :h|v, vlan N, 10.0.0.0/24    … 水平/垂直の基幹バス
     ・a -- b :冗長, vlan 100, ラベル               … 接続（線にも意味を持たせる）
         冗長/ha/lacp = 二重線、予備/stby = 破線、trunk = 太線、一方向 = 矢印、
         vlan N = 所属ネットワークの色とチップ。同じ 2 点間の複数本はずらして描く（多重ネットワーク）
     ・fence id[ラベル] :v|h                        … 保守分界・責任分界のフェンス（ドラッグで置く）

   折りたたみ：ゾーン見出しの ▾/▸ をタップ。%% fold にだけ保存（意味部は汚さない）。
   キャンバスは事実上無限：どこへドラッグしても viewBox が中身を追いかけ、切れない。
   ============================================================ */
import { themeOf } from '../render/draw.js';
import { geoProject, GEO_OUTLINE, GEO_HAZARDS, GEO_LAYERS, geoExposure } from './geo.js';

// 役割の正規化：書き方のゆらぎを吸収する。IT と OT を同じ語彙で。
const ROLE_ALIAS = {
  // IT
  core: 'core', dist: 'dist', distribution: 'dist', access: 'access',
  sw: 'switch', switch: 'switch', l2: 'switch', l3: 'switch',
  rt: 'router', router: 'router',
  fw: 'firewall', firewall: 'firewall', utm: 'firewall',
  sv: 'server', srv: 'server', server: 'server',
  db: 'db', database: 'db',
  st: 'storage', storage: 'storage', nas: 'storage',
  pc: 'pc', client: 'pc', clients: 'pc',
  ap: 'ap', wifi: 'ap', wlc: 'ap',
  lb: 'lb', proxy: 'lb',
  cloud: 'cloud', wan: 'cloud', net: 'cloud', internet: 'cloud',
  prn: 'printer', printer: 'printer',
  // OT / 制御系
  plc: 'plc', rtu: 'rtu', dcs: 'dcs', scada: 'scada',
  hmi: 'hmi', historian: 'historian', hist: 'historian',
  ews: 'ews', eng: 'ews',
  sensor: 'sensor', センサ: 'sensor',
  drive: 'drive', inverter: 'drive', servo: 'drive',
  robot: 'robot', cnc: 'cnc',
  sis: 'sis', safety: 'sis',
  gw: 'gateway', gateway: 'gateway', opc: 'gateway',
  diode: 'diode', dataDiode: 'diode',
};
export const ROLE_TAG = {
  core: 'CORE', dist: 'DIST', access: 'ACC', switch: 'SW', router: 'RT',
  firewall: 'FW', server: 'SV', db: 'DB', storage: 'ST', pc: 'PC', ap: 'AP',
  lb: 'LB', cloud: 'NET', printer: 'PR',
  plc: 'PLC', rtu: 'RTU', dcs: 'DCS', scada: 'SCD', hmi: 'HMI', historian: 'HIS',
  ews: 'EWS', sensor: 'SEN', drive: 'DRV', robot: 'ROB', cnc: 'CNC', sis: 'SIS',
  gateway: 'GW', diode: 'DIO',
};
const ROLE_HUE = {
  core: '#f5b86a', dist: '#f5b86a', access: '#6aa9ff', switch: '#6aa9ff', router: '#d68ad6',
  firewall: '#f57a8a', server: '#7ad1b0', db: '#7ad1b0', storage: '#8ad1f5', pc: '#9aa3b5',
  ap: '#b8a6ff', lb: '#8ad1f5', cloud: '#8ad1f5', printer: '#9aa3b5',
  plc: '#e8b15a', rtu: '#e8b15a', dcs: '#e8975a', scada: '#f5d76a', hmi: '#c9d16a',
  historian: '#7ad1b0', ews: '#b8a6ff', sensor: '#9ad17a', drive: '#9ad17a', robot: '#d68ad6',
  cnc: '#d68ad6', sis: '#f5667a', gateway: '#8ad1f5', diode: '#f57a8a',
};
// 所属ネットワーク（VLAN）の線色。番号から決定的に引く。
const NET_HUES = ['#8ad1f5', '#7ad1b0', '#f5b86a', '#d68ad6', '#b8a6ff', '#9ad17a', '#f57a8a', '#6aa9ff'];
const vlanHue = (v) => NET_HUES[((v % NET_HUES.length) + NET_HUES.length) % NET_HUES.length];

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;

// 機器・バスの :attrs。役割でも IP でも VLAN でもない言葉は OS/バージョン扱い。
function parseAttrs(spec) {
  const out = { role: null, os: null, ip: null, vlan: null, orient: null, len: null };
  for (const tokRaw of String(spec || '').split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const low = tok.toLowerCase();
    const mv = /^vlan\s*(\d+)$/i.exec(tok);
    if (mv) { out.vlan = +mv[1]; continue; }
    const ml = /^len\s*(\d+)$/i.exec(tok);
    if (ml) { out.len = +ml[1]; continue; }
    if (/^(h|horizontal|横)$/.test(low)) { out.orient = 'h'; continue; }
    if (/^(v|vertical|縦)$/.test(low)) { out.orient = 'v'; continue; }
    if (IP_RE.test(tok)) { out.ip = tok; continue; }
    if (ROLE_ALIAS[low] || ROLE_ALIAS[tok]) { out.role = ROLE_ALIAS[low] || ROLE_ALIAS[tok]; continue; }
    out.os = out.os ? out.os + ' ' + tok : tok;
  }
  return out;
}

// 接続の :attrs。線そのものに意味を持たせる（冗長・予備・幹線・一方向・所属ネットワーク・自由ラベル）。
function parseLinkAttrs(spec) {
  const out = { vlan: null, redundant: false, dashed: false, thick: false, arrow: false, label: null };
  for (const tokRaw of String(spec || '').split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const low = tok.toLowerCase();
    const mv = /^vlan\s*(\d+)$/i.exec(tok);
    if (mv) { out.vlan = +mv[1]; continue; }
    if (/^(冗長|redundant|ha|lacp|teaming)$/i.test(low) || tok === '冗長') { out.redundant = true; continue; }
    if (/^(予備|backup|stby|standby)$/i.test(low) || tok === '予備') { out.dashed = true; continue; }
    if (/^(trunk|幹線)$/i.test(low) || tok === '幹線') { out.thick = true; continue; }
    if (/^(一方向|oneway|unidirectional)$/i.test(low) || tok === '一方向') { out.arrow = true; continue; }
    out.label = out.label ? out.label + ' ' + tok : tok;
  }
  return out;
}

const INF_ID = '[A-Za-z0-9_\\u00C0-\\uFFFF][A-Za-z0-9_.\\-\\u00C0-\\uFFFF]*';
const NODE_RE = new RegExp(`^(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const BUS_RE = new RegExp(`^bus\\s+(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const HUB_RE = new RegExp(`^hub\\s+(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const FENCE_RE = new RegExp(`^fence\\s+(${INF_ID})(?:\\[([^\\]]*)\\])?\\s*(?::(.*))?$`);
const LINK_RE = new RegExp(`^(${INF_ID})\\s*--\\s*(${INF_ID})\\s*(?::(.*))?$`);

export function parseInfra(lines, model) {
  model.kind = 'infra';
  const zstack = [];
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    if (line === 'infra') continue;
    if (line.startsWith('title ')) { model.meta.title = line.slice(6).trim(); continue; }
    const zm = /^zone\s+(.+?)\s*\{$/.exec(line);
    if (zm) {
      let name = zm[1];
      while (model.groups.some((g) => g.name === name)) name += '′';
      model.groups.push({ name, parent: zstack.length ? zstack[zstack.length - 1] : null });
      zstack.push(name);
      continue;
    }
    if (line === '}') { if (zstack.length) zstack.pop(); else model.errors.push(`L${ln}: 閉じすぎの「}」`); continue; }
    const bm = BUS_RE.exec(line);
    if (bm) {
      const a = parseAttrs(bm[3]);
      model.items.push({ type: 'bus', id: bm[1], label: bm[2] || bm[1], orient: a.orient || 'h', vlan: a.vlan, cidr: a.ip,
        len: a.len, zone: zstack.length ? zstack[zstack.length - 1] : null });
      model.order.push(bm[1]);
      continue;
    }
    const hm = HUB_RE.exec(line);
    if (hm) {
      const a = parseAttrs(hm[3]);
      model.items.push({ type: 'hub', id: hm[1], label: hm[2] || hm[1],
        role: a.role, vlan: a.vlan, cidr: a.ip, len: a.len,
        zone: zstack.length ? zstack[zstack.length - 1] : null });
      model.order.push(hm[1]);
      continue;
    }
    const fm = FENCE_RE.exec(line);
    if (fm) {
      const a = parseAttrs(fm[3]);
      model.items.push({ type: 'fence', id: fm[1], label: fm[2] || fm[1], orient: a.orient || 'v',
        zone: zstack.length ? zstack[zstack.length - 1] : null });
      model.order.push(fm[1]);
      continue;
    }
    const lm = LINK_RE.exec(line);
    if (lm) { model.edges.push({ from: lm[1], to: lm[2], ...parseLinkAttrs(lm[3]) }); continue; }
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
  for (const e of model.edges)
    for (const end of [e.from, e.to])
      if (!model.items.some((x) => x.id === end)) model.errors.push(`接続の相手が見つからない「${end}」`);
  return model;
}

// ---- レイアウト ---------------------------------------------------------------

const metaLines = (n) => [n.os, n.ip, n.vlan != null ? 'VLAN ' + n.vlan : null].filter(Boolean);
// 全角は半角の約 1.7 倍幅。ここをサボるとラベルが役割タグに刺さる。
const textW = (s, px) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? px * 1.7 : px), 0);

function inodeSize(n) {
  const metas = metaLines(n);
  const w = Math.max(118, textW(n.label, 7.6) + (n.role ? 58 : 26), ...metas.map((s) => textW(s, 6.3) + 30));
  return { w: Math.ceil(w), h: 30 + metas.length * 13 + (metas.length ? 6 : 0) };
}

export function layoutInfra(model) {
  const fold = new Set(model.layout.fold || []);
  const zonesAll = model.groups.map((g) => ({ ...g, x: 0, y: 0, w: 0, h: 0, depth: 0, folded: false, hidden: false }));
  const zoneOf = new Map(zonesAll.map((z) => [z.name, z]));
  for (const z of zonesAll) { let p = z.parent, d = 0; while (p) { d++; p = zoneOf.get(p)?.parent; } z.depth = d; }
  // 折りたたみの伝播：畳まれたゾーンの内側は（子ゾーンごと）隠れる。畳んだ本人は小さな札で残る。
  const foldedAncestor = (zname) => {
    let p = zname, top = null;
    while (p) { if (fold.has(p)) top = p; p = zoneOf.get(p)?.parent; }
    return top;
  };
  for (const z of zonesAll) {
    const fa = foldedAncestor(z.name);
    if (fa === z.name) z.folded = true;
    else if (fa) z.hidden = true;
  }
  const zones = zonesAll.filter((z) => !z.hidden);

  const hubSize = (h) => { const r = Math.max(30, Math.ceil(textW(h.label, 7.2) / 2) + 12, (h.len || 0) / 2); return { w: r * 2, h: r * 2, r, hub: true }; };
  const nodesAll = model.items.filter((x) => x.type === 'inode' || x.type === 'hub')
    .map((n) => ({ ...n, ...(n.type === 'hub' ? hubSize(n) : inodeSize(n)), x: 0, y: 0 }));
  const hiddenIn = new Map();                                 // nodeId → 畳んだゾーン名
  for (const n of nodesAll) { const fa = n.zone ? foldedAncestor(n.zone) : null; if (fa) hiddenIn.set(n.id, fa); }
  const nodes = nodesAll.filter((n) => !hiddenIn.has(n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const PAD = 14, HEAD = 24, GAP = 12;
  const foldSize = (z) => {
    const inside = nodesAll.filter((n) => hiddenIn.get(n.id) === z.name).length;
    const k = model.meta.map && z.depth === 0 ? 2.4 : 1;     // 地図では拠点札を大きく（遠景で読める）
    return { w: Math.ceil((textW(z.name, 8) + 76) * k), h: Math.round(40 * k), count: inside };
  };
  function pack(zname) {
    const kidZones = zones.filter((z) => z.parent === zname);
    const blocks = [];
    for (const z of kidZones) {
      if (z.folded) { const f = foldSize(z); z.w = f.w; z.h = f.h; z.count = f.count; }
      else pack(z.name);
      blocks.push({ ref: z, w: z.w, h: z.h });
    }
    for (const n of nodes.filter((nn) => nn.zone === zname)) blocks.push({ ref: n, w: n.w, h: n.h });
    // 折返し幅：ゾーン内は 640、最上位は 1400——世界は縦にも横にも広がる。
    const limit = Math.max(zname ? 640 : 1400, ...blocks.map((b) => b.w + PAD * 2));
    let x = PAD, y = (zname ? HEAD : 0) + PAD, rowH = 0, w = 0;
    for (const b of blocks) {
      if (x > PAD && x + b.w > limit) { x = PAD; y += rowH + GAP; rowH = 0; }
      b.ref._dx = x; b.ref._dy = y;
      x += b.w + GAP; rowH = Math.max(rowH, b.h); w = Math.max(w, x - GAP + PAD);
    }
    const z = zoneOf.get(zname);
    if (z && !z.folded) { z.w = Math.max(w, textW(zname, 12) + 40); z.h = y + rowH + PAD; }
  }
  pack(null);
  function place(zname, ox, oy) {
    for (const z of zones.filter((zz) => zz.parent === zname)) {
      z.x = ox + z._dx; z.y = oy + z._dy;
      if (!z.folded) place(z.name, z.x, z.y);
    }
    for (const n of nodes.filter((nn) => nn.zone === zname)) { n.x = ox + n._dx; n.y = oy + n._dy; }
  }
  place(null, 20, 20);
  for (const n of nodes) if (model.layout.pos[n.id]) { n.x = model.layout.pos[n.id][0]; n.y = model.layout.pos[n.id][1]; }
  // %% map + %% geo：ゾーン（やハブ）を実座標（緯度|経度）へ。地図の上に日本のネットワークが立つ。
  // zpos より先に効かせる——手で微調整した zpos が最後に勝つ。
  const geoOf = (model.meta.map && model.layout.geo) || {};
  for (const name of Object.keys(geoOf)) {
    const [gx, gy] = geoProject(geoOf[name][0], geoOf[name][1]);
    const gn = byId.get(name);
    if (gn) { gn.x = gx - gn.w / 2; gn.y = gy - gn.h / 2; continue; }   // ハブや機器そのもの
    const z = zoneOf.get(name);
    if (!z || z.hidden) continue;
    const dx = gx - (z.x + z.w / 2), dy = gy - (z.y + z.h / 2);
    if (z.folded) { z.x += dx; z.y += dy; continue; }
    const under = new Set([name]);
    let grew0 = true;
    while (grew0) { grew0 = false; for (const zz of zones) if (zz.parent && under.has(zz.parent) && !under.has(zz.name)) { under.add(zz.name); grew0 = true; } }
    for (const zz of zones) if (under.has(zz.name)) { zz.x += dx; zz.y += dy; }
    for (const n of nodes) if (n.zone && under.has(n.zone) && !model.layout.pos[n.id]) { n.x += dx; n.y += dy; }
  }
  // zpos はゾーンの自由配置。畳んだ札はそのまま、展開ゾーンは中身ごと平行移動する
  // （明示 pos を持つ機器は絶対座標なので動かさない。枠は後段の bbox 追従が拾う）。
  const zpos = model.layout.zpos || {};
  for (const z of [...zones].sort((a, b) => a.depth - b.depth)) {
    if (!zpos[z.name]) continue;
    if (z.folded) { z.x = zpos[z.name][0]; z.y = zpos[z.name][1]; continue; }
    const dx = zpos[z.name][0] - z.x, dy = zpos[z.name][1] - z.y;
    if (!dx && !dy) continue;
    const under = new Set([z.name]);
    let grew = true;
    while (grew) { grew = false; for (const zz of zones) if (zz.parent && under.has(zz.parent) && !under.has(zz.name)) { under.add(zz.name); grew = true; } }
    for (const zz of zones) if (under.has(zz.name)) { zz.x += dx; zz.y += dy; }
    for (const n of nodes) if (n.zone && under.has(n.zone) && !model.layout.pos[n.id]) { n.x += dx; n.y += dy; }
  }
  // ハブスポーク：ゾーンにも pos にも縛られていないスポーク（そのハブとしか繋がっていない機器）を
  // ハブの周りに環状に置く。拠点が増えても書くだけで星型が育つ。
  for (const hub of nodes.filter((n) => n.hub)) {
    const spokes = nodes.filter((n) => !n.hub && !n.zone && !model.layout.pos[n.id]
      && model.edges.some((e2) => (e2.from === n.id && e2.to === hub.id) || (e2.to === n.id && e2.from === hub.id))
      && model.edges.every((e2) => (e2.from !== n.id && e2.to !== n.id) || e2.from === hub.id || e2.to === hub.id));
    if (!spokes.length) continue;
    const cx = hub.x + hub.r, cy = hub.y + hub.r;
    const R = Math.max(hub.r + 96, (spokes.length * 150) / (2 * Math.PI));
    spokes.forEach((n, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / spokes.length;
      n.x = Math.round(cx + Math.cos(a) * R - n.w / 2);
      n.y = Math.round(cy + Math.sin(a) * R - n.h / 2);
    });
  }
  // 展開ゾーンの枠は中身の bbox を追いかける（深い順）。
  const busItems = model.items.filter((x) => x.type === 'bus');
  for (const z of [...zones].sort((a, b) => b.depth - a.depth)) {
    if (z.folded) continue;
    const inner = [...nodes.filter((n) => n.zone === z.name), ...zones.filter((zz) => zz.parent === z.name)];
    if (!inner.length) { z.w = Math.max(z.w, 120); z.h = Math.max(z.h, 60); continue; }
    const x0 = Math.min(...inner.map((b) => b.x)) - PAD, y0 = Math.min(...inner.map((b) => b.y)) - PAD - (HEAD - 6);
    const x1 = Math.max(...inner.map((b) => b.x + b.w)) + PAD, y1 = Math.max(...inner.map((b) => b.y + b.h)) + PAD;
    z.x = x0; z.y = y0; z.w = x1 - x0; z.h = y1 - y0;
    z.h += busItems.filter((b) => b.zone === z.name).length * 30;   // ゾーン内バスの居場所ぶん伸ばす
  }
  // 地図の decluttering：geo アンカーつきの拠点（札・枠・ハブ）が重なったら、
  // 重なりの小さい軸に沿って半分ずつ押し離す（決定的・最小移動）。実座標には ○ を残し、
  // 点線のリーダーで結ぶ——地図アプリのラベル整理と同じ作法。密集地帯（首都圏など）でも読める。
  const mapAnchors = [];
  if (model.meta.map) {
    const decl = [];
    for (const name of Object.keys(geoOf).sort()) {
      const [ax, ay] = geoProject(geoOf[name][0], geoOf[name][1]);
      const gn = byId.get(name);
      if (gn) { decl.push({ name, ref: gn, ax, ay, node: true }); continue; }
      const z = zoneOf.get(name);
      if (z && !z.hidden) decl.push({ name, ref: z, ax, ay });
    }
    const pre = decl.map((d) => [d.ref.x, d.ref.y]);
    const GAPD = 26;
    for (let it = 0; it < 160; it++) {
      let any = false;
      for (let a = 0; a < decl.length; a++) for (let b = a + 1; b < decl.length; b++) {
        const A = decl[a].ref, B = decl[b].ref;
        const dx = (A.x + A.w / 2) - (B.x + B.w / 2), dy = (A.y + A.h / 2) - (B.y + B.h / 2);
        const px = (A.w + B.w) / 2 + GAPD - Math.abs(dx), py = (A.h + B.h) / 2 + GAPD - Math.abs(dy);
        if (px <= 0 || py <= 0) continue;
        any = true;
        if (px < py) { const s = (dx >= 0 ? px : -px) / 2; A.x += s; B.x -= s; }
        else { const s = (dy >= 0 ? py : -py) / 2; A.y += s; B.y -= s; }
      }
      if (!any) break;
    }
    decl.forEach((d, i) => {
      const ddx = d.ref.x - pre[i][0], ddy = d.ref.y - pre[i][1];
      if ((ddx || ddy) && !d.node && !d.ref.folded) {           // 展開ゾーンは中身ごと追いかける
        const under = new Set([d.name]);
        let grew2 = true;
        while (grew2) { grew2 = false; for (const zz of zones) if (zz.parent && under.has(zz.parent) && !under.has(zz.name)) { under.add(zz.name); grew2 = true; } }
        for (const zz of zones) if (zz.name !== d.name && under.has(zz.name)) { zz.x += ddx; zz.y += ddy; }
        for (const n of nodes) if (n.zone && under.has(n.zone)) { n.x += ddx; n.y += ddy; }
      }
      const cx = d.ref.x + d.ref.w / 2, cy = d.ref.y + d.ref.h / 2;
      if (Math.hypot(cx - d.ax, cy - d.ay) > 46) mapAnchors.push({ x1: cx, y1: cy, x2: d.ax, y2: d.ay });
    });
  }
  const bx1 = Math.max(120, ...nodes.map((n) => n.x + n.w), ...zones.map((z) => z.x + z.w));
  const by1 = Math.max(80, ...nodes.map((n) => n.y + n.h), ...zones.map((z) => z.y + z.h));
  const bx0 = Math.min(20, ...nodes.map((n) => n.x), ...zones.map((z) => z.x));

  // バス：h は下に順に、v は右に順に。ドラッグ（pos）で自由に。
  // バス：pos があれば [x,y] とも自由（長さ = len 指定 > 自動 span）。
  // ゾーン内で宣言されたバスはそのゾーンの幅で張られ、ゾーンごと動く。
  const buses = [];
  const hiddenBus = new Map();                                 // busId → 畳んだゾーン名
  let hy = by1 + 44, vx = bx1 + 56;
  const zoneBusIdx = new Map();
  for (const b of model.items.filter((x) => x.type === 'bus')) {
    const p = model.layout.pos[b.id];
    const fa = b.zone ? foldedAncestor(b.zone) : null;
    if (fa) { hiddenBus.set(b.id, fa); continue; }
    if (b.zone && zoneOf.get(b.zone) && !p) {
      const z = zoneOf.get(b.zone);
      const idx = zoneBusIdx.get(b.zone) || 0; zoneBusIdx.set(b.zone, idx + 1);
      const span = b.len || z.w - 20;
      buses.push({ ...b, y: z.y + z.h - 16 - idx * 28, x1: z.x + 10, x2: z.x + 10 + span, orient: 'h' });
      continue;
    }
    if (b.orient === 'v') {
      const span = b.len || by1 + 4;
      const x = p ? p[0] : vx, y1 = p ? p[1] : 16;
      buses.push({ ...b, x, y1, y2: y1 + span });
      if (!p) vx += 56;
    } else {
      const span = b.len || (bx1 + 20) - (bx0 - 4);
      const x1 = p ? p[0] : bx0 - 4, y = p ? p[1] : hy;
      buses.push({ ...b, y, x1, x2: x1 + span });
      if (!p) hy += 46;
    }
  }
  const busOf = new Map(buses.map((b) => [b.id, b]));

  // 接続の端点解決：畳まれたゾーンの中の機器は、その札に付け替える（多重は一本に畳む）。
  const zBox = (zname) => { const z = zoneOf.get(zname); return { x: z.x, y: z.y, w: z.w, h: z.h, id: zname }; };
  const endOf = (id) => byId.get(id)
    || (hiddenIn.has(id) ? zBox(hiddenIn.get(id)) : null)
    || (hiddenBus.has(id) ? zBox(hiddenBus.get(id)) : null);
  const links = [];
  const seenFold = new Set();
  const pairIndex = new Map();                                // 同じ 2 点間の何本目か（多重ネットワーク）
  for (const e of model.edges) {
    const ea = endOf(e.from), eb = endOf(e.to);
    const ba = busOf.get(e.from), bb = busOf.get(e.to);
    const aId = ea?.id || e.from, bId = eb?.id || e.to;
    const hidF = hiddenIn.get(e.from) || hiddenBus.get(e.from), hidT = hiddenIn.get(e.to) || hiddenBus.get(e.to);
    if (hidF || hidT) {                                        // 畳み先が同じなら線ごと隠す
      if (hidF && hidF === hidT) continue;
      const k = `${aId}|${bId}|${e.vlan ?? ''}`;
      if (seenFold.has(k)) continue;
      seenFold.add(k);
    }
    const key = [aId, bId].sort().join('|');
    const idx = pairIndex.get(key) || 0; pairIndex.set(key, idx + 1);
    if (ea && bb) links.push({ ...stub(ea, bb), e, idx });
    else if (eb && ba) links.push({ ...stub(eb, ba), e, idx });
    else if (ea && eb) {
      let x1 = ea.x + ea.w / 2, y1 = ea.y + ea.h / 2, x2 = eb.x + eb.w / 2, y2 = eb.y + eb.h / 2;
      const trim = (cx, cy, r, tx, ty) => {                    // 円周まで縮める（ハブスポークの根元）
        const dx = tx - cx, dy = ty - cy, len = Math.hypot(dx, dy) || 1;
        return [cx + (dx / len) * r, cy + (dy / len) * r];
      };
      if (ea.hub) { const t = trim(x1, y1, ea.r, x2, y2); x1 = t[0]; y1 = t[1]; }
      if (eb.hub) { const t = trim(x2, y2, eb.r, x1, y1); x2 = t[0]; y2 = t[1]; }
      links.push({ x1, y1, x2, y2, e, idx, hubEnd: !!(ea.hub || eb.hub) });
    }
  }
  // 同じ 2 点間の複数本を平行にずらす（多重ネットワークが読める）。
  const counts = new Map();
  for (const l of links) { const k = `${l.x1},${l.y1}|${l.x2},${l.y2}`; counts.set(k, (counts.get(k) || 0) + 1); }
  for (const l of links) {
    const k = `${l.x1},${l.y1}|${l.x2},${l.y2}`;
    const n = counts.get(k);
    if (n > 1) {
      const off = (l.idx - (n - 1) / 2) * 8;
      const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
      l.x1 += (-dy / len) * off; l.x2 += (-dy / len) * off;
      l.y1 += (dx / len) * off; l.y2 += (dx / len) * off;
    }
  }
  function stub(n, b) {
    // バスは自由配置なので、機器の正面から降りて、範囲外なら肘（elbow）でバス上へ寄る。
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (b.orient === 'v') {
      const y = clamp(n.y + n.h / 2, b.y1 + 8, b.y2 - 8);
      const sx = b.x >= n.x + n.w / 2 ? n.x + n.w : n.x;
      return { x1: sx, y1: n.y + n.h / 2, mx: sx, my: y, x2: b.x, y2: y, dot: true, elbow: y !== n.y + n.h / 2 };
    }
    const cx = n.x + n.w / 2;
    const x = clamp(cx, b.x1 + 8, b.x2 - 8);
    const sy = b.y >= n.y ? n.y + n.h : n.y;
    return { x1: cx, y1: sy, mx: cx, my: b.y, x2: x, y2: b.y, dot: true, elbow: x !== cx };
  }

  // フェンス（保守分界・責任分界）：ゾーン内宣言ならそのゾーンに沿って立つ（ゾーンごと動き、
  // 畳めば札の中へ）。グローバル宣言は従来どおりコンテンツ全体を跨ぐ。ドラッグで置き直す。
  const fences = [];
  let fi = 0;
  for (const f of model.items.filter((x) => x.type === 'fence')) {
    fi++;
    if (f.zone && foldedAncestor(f.zone)) continue;
    const fz = f.zone ? zoneOf.get(f.zone) : null;
    if (f.orient === 'h') {
      const y = model.layout.pos[f.id] ? model.layout.pos[f.id][1] : fz ? fz.y + fz.h - 6 : by1 + 20 + fi * 30;
      fences.push({ ...f, y, x1: fz ? fz.x - 12 : bx0 - 24, x2: fz ? fz.x + fz.w + 12 : bx1 + 40 });
    } else {
      const x = model.layout.pos[f.id] ? model.layout.pos[f.id][0] : fz ? fz.x + fz.w * 0.62 : bx0 + (bx1 - bx0) * 0.5 + fi * 40;
      fences.push({ ...f, x, y1: fz ? fz.y - 10 : 0, y2: fz ? fz.y + fz.h + 10 : by1 + 30 });
    }
  }

  // ---- 無限キャンバス：viewBox は中身全部（負座標もフェンスもバスも）を必ず包む ----
  const xs = [bx0, bx1,
    ...buses.map((b) => b.orient === 'v' ? b.x : b.x1), ...buses.map((b) => b.orient === 'v' ? b.x : b.x2),
    ...fences.map((f) => f.orient === 'h' ? f.x1 : f.x), ...fences.map((f) => f.orient === 'h' ? f.x2 : f.x),
    ...links.flatMap((l) => [l.x1, l.x2])];
  const ys = [0, by1,
    ...buses.map((b) => b.orient === 'v' ? b.y1 : b.y), ...buses.map((b) => b.orient === 'v' ? b.y2 : b.y),
    ...fences.map((f) => f.orient === 'h' ? f.y : f.y1), ...fences.map((f) => f.orient === 'h' ? f.y : f.y2),
    ...links.flatMap((l) => [l.y1, l.y2])];
  const M = 36;                                               // 上端も左右もゆったり（切れない）
  if (model.meta.map) {                                       // 地図モード：ベースマップ全体も世界に含める
    for (const isl of GEO_OUTLINE) for (const p of isl.pts) { const [px, py] = geoProject(p[0], p[1]); xs.push(px); ys.push(py); }
  }
  const x0 = Math.min(...xs) - M, y0 = Math.min(...ys) - M;
  const x1 = Math.max(...xs) + M, y1 = Math.max(...ys) + M;

  let map = null;                                             // BCP：拠点ごとのハザード露出（%% geo した名前が拠点）
  if (model.meta.map) {
    const sites = Object.keys(model.layout.geo || {}).map((name) => ({ name, lat: model.layout.geo[name][0], lng: model.layout.geo[name][1] }));
    const lay = model.meta.hazard && model.meta.hazard.length ? model.meta.hazard : null;
    map = { exposure: geoExposure(sites, lay), anchors: mapAnchors };
  }
  return { kind: 'infra', x0, y0, width: x1 - x0, height: y1 - y0,
    nodes, zones, buses, links, fences, map, errors: [] };
}

// ---- 描画 ----------------------------------------------------------------------

// 線分同士の交点（端の 2% は跨がない——接続点まで跨ぐと嘘になる）。
function segX(a, b) {
  const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
  const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / den;
  if (t <= 0.03 || t >= 0.97 || u <= 0.03 || u >= 0.97) return null;
  return { x: a.x1 + t * d1x, y: a.y1 + t * d1y, t };
}

// ラインクロスのジャンプ（%% hops）：交差点ごとに小さな ⌒ で跨ぐ。回路図の作法。
function hopPath(sg, obstacles, r = 6) {
  const hits = [];
  for (const o of obstacles) { const p = segX(sg, o); if (p) hits.push(p); }
  if (!hits.length) return `M${sg.x1},${sg.y1} L${sg.x2},${sg.y2}`;
  hits.sort((p, q) => p.t - q.t);
  const dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  let d = `M${sg.x1},${sg.y1}`, last = -1;
  for (const h of hits) {
    if (h.t * len - last < r * 2) continue;                    // 近すぎる交差はまとめて跨ぐ
    last = h.t * len;
    d += ` L${(h.x - ux * r).toFixed(1)},${(h.y - uy * r).toFixed(1)}`
      + ` A${r} ${r} 0 0 1 ${(h.x + ux * r).toFixed(1)},${(h.y + uy * r).toFixed(1)}`;
  }
  return d + ` L${sg.x2},${sg.y2}`;
}

const offSeg = (sg, o) => {
  if (!o) return sg;
  const dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1, len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * o, oy = (dx / len) * o;
  return { x1: sg.x1 + ox, y1: sg.y1 + oy, x2: sg.x2 + ox, y2: sg.y2 + oy };
};

const iesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function drawInfra(model, L, opts = {}) {
  const T = themeOf(opts);
  const parts = [];
  if (model.meta.map) {                                        // ベースマップ（自前・低ポリ日本）＋ハザードレイヤ
    const path = (pts, close) => 'M' + pts.map((p) => geoProject(p[0], p[1]).join(',')).join(' L') + (close ? ' Z' : '');
    for (const isl of GEO_OUTLINE)
      parts.push(`<path d="${path(isl.pts, true)}" fill="${T.land}" stroke="${T.landLine}" stroke-width="2" stroke-linejoin="round"/>`);
    const active = model.meta.hazard || [];
    const kmPx = (km, lat) => (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * 400;   // km → px（緯度で補正）
    for (const h of GEO_HAZARDS.filter((x) => active.includes(x.layer))) {
      const hue = (GEO_LAYERS.find((l) => l.key === h.layer) || {}).hue || '#999';
      if (h.kind === 'zone') {
        const c = h.pts.reduce((a, p) => [a[0] + p[0] / h.pts.length, a[1] + p[1] / h.pts.length], [0, 0]);
        const [cx, cy] = geoProject(c[0], c[1]);
        parts.push(`<path d="${path(h.pts, true)}" fill="${hue}" fill-opacity="0.10" stroke="${hue}" stroke-opacity="0.5" stroke-dasharray="8 6" stroke-width="2"/>`
          + `<text x="${cx}" y="${cy}" fill="${hue}" font-size="48" text-anchor="middle" opacity="0.85">${iesc(h.name)}</text>`);
      } else if (h.kind === 'line') {
        parts.push(`<path d="${path(h.pts, false)}" fill="none" stroke="${hue}" stroke-opacity="0.4" stroke-width="14" stroke-linecap="round"/>`);
        const [lx, ly] = geoProject(h.pts[0][0], h.pts[0][1]);
        parts.push(`<text x="${lx + 18}" y="${ly}" fill="${hue}" font-size="36" opacity="0.85">${iesc(h.name)}</text>`);
      } else {
        const [px, py] = geoProject(h.at[0], h.at[1]);
        const r = kmPx(h.km || 50, h.at[0]);
        parts.push(`<circle cx="${px}" cy="${py}" r="${r}" fill="${hue}" fill-opacity="0.08" stroke="${hue}" stroke-opacity="0.45" stroke-dasharray="4 5"/>`
          + `<circle cx="${px}" cy="${py}" r="5" fill="${hue}"/>`
          + `<text x="${px + 12}" y="${py - 10}" fill="${hue}" font-size="30" opacity="0.9">${iesc(h.name)}</text>`);
      }
    }
    // decluttering で実座標からずれた拠点は、○ アンカーと点線リーダーで結ぶ（地図の作法）。
    for (const a of (L.map && L.map.anchors) || [])
      parts.push(`<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${a.x2}" y2="${a.y2}" stroke="${T.landLine}" stroke-width="1.8" stroke-dasharray="3 6"/>`
        + `<circle cx="${a.x2}" cy="${a.y2}" r="7" fill="none" stroke="${T.landLine}" stroke-width="1.8"/>`
        + `<circle cx="${a.x2}" cy="${a.y2}" r="2.6" fill="${T.landLine}"/>`);
  }
  for (const z of [...L.zones].sort((a, b) => a.depth - b.depth)) {
    if (z.folded) {                                            // 畳まれたゾーン＝札。つかんで移動、▸ タップで開く
      const k = z.h / 40;                                      // 地図モードの拠点札は大きい——文字も比例して読める
      parts.push(`<g data-drag="zone" data-id="${iesc(z.name)}" data-folded="1" style="cursor:grab">`
        + `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${9 * k}" fill="${T.chip}" stroke="${T.dim}" stroke-width="${k}" stroke-dasharray="5 4"/>`
        + `<text x="${z.x + 30 * k}" y="${z.y + 25 * k}" fill="${T.head}" font-size="${12 * k}" font-weight="700">${iesc(z.name)}<tspan fill="${T.dim}" font-weight="400"> ・ ${z.count} 台</tspan></text></g>`
        + `<g data-fold="${iesc(z.name)}" style="cursor:pointer"><rect x="${z.x + 4 * k}" y="${z.y + 10 * k}" width="${22 * k}" height="${22 * k}" rx="5" fill="transparent"/><text x="${z.x + 12 * k}" y="${z.y + 25 * k}" fill="${T.head}" font-size="${12 * k}" font-weight="700">▸</text></g>`);
      continue;
    }
    parts.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" fill="${T.frameInk}" fill-opacity="${0.03 + z.depth * 0.02}" stroke="${T.dim}" stroke-dasharray="5 4" stroke-opacity="0.7"/>`);
    // 見出し＝ゾーンのドラッグハンドル（中の機器ごと動く）。▾ キャレットだけが折りたたみ。
    parts.push(`<g data-drag="zone" data-id="${iesc(z.name)}" style="cursor:grab">`
      + `<rect x="${z.x + 22}" y="${z.y + 2}" width="${Math.max(24, Math.min(z.w - 24, textW(z.name, 11.5) + 20))}" height="18" rx="6" fill="transparent"/>`
      + `<text x="${z.x + 26}" y="${z.y + 16}" fill="${T.head}" font-size="11.5" font-weight="700">${iesc(z.name)}</text></g>`
      + `<g data-fold="${iesc(z.name)}" style="cursor:pointer"><rect x="${z.x + 4}" y="${z.y + 2}" width="18" height="18" rx="5" fill="transparent"/><text x="${z.x + 12}" y="${z.y + 16}" fill="${T.head}" font-size="11.5" font-weight="700">▾</text></g>`);
  }
  // 接続線：冗長=二重線・予備=破線・幹線=太線・一方向=矢印・VLAN=色とチップ。
  // バスが自由配置なので肘（elbow）区間もあり、%% hops なら交差を ⌒ で跨ぐ。
  const obstacles = L.buses.map((b) => b.orient === 'v'
    ? { x1: b.x, y1: b.y1, x2: b.x, y2: b.y2 } : { x1: b.x1, y1: b.y, x2: b.x2, y2: b.y });
  for (const l of L.links) {
    const e = l.e || {};
    const hue = e.vlan != null ? vlanHue(e.vlan) : T.line;
    const wdt = e.thick ? 3 : 1.5;
    const dash = e.dashed ? ` stroke-dasharray="6 5"` : '';
    const arrow = e.arrow ? ' marker-end="url(#arrow)"' : '';
    const segs = l.mx != null && l.elbow
      ? [{ x1: l.x1, y1: l.y1, x2: l.mx, y2: l.my }, { x1: l.mx, y1: l.my, x2: l.x2, y2: l.y2 }]
      : [{ x1: l.x1, y1: l.y1, x2: l.mx != null ? l.mx : l.x2, y2: l.my != null ? l.my : l.y2 },
        ...(l.mx != null ? [{ x1: l.mx, y1: l.my, x2: l.x2, y2: l.y2 }] : [])].filter((sg) => sg.x1 !== sg.x2 || sg.y1 !== sg.y2);
    const drawOnce = (o) => segs.map((sg, i) => {
      const g = offSeg(sg, o);
      const d = opts.hops ? hopPath(g, obstacles) : `M${g.x1},${g.y1} L${g.x2},${g.y2}`;
      const mk = i === segs.length - 1 ? arrow : '';
      return `<path d="${d}" fill="none" stroke="${hue}" stroke-opacity="0.85" stroke-width="${wdt}"${dash}${mk}/>`;
    }).join('');
    parts.push(e.redundant ? drawOnce(-2.4) + drawOnce(2.4) : drawOnce(0));
    obstacles.push(...segs);                                   // 後から描く線がこの線を跨げるように
    if (l.dot) parts.push(`<circle cx="${l.x2}" cy="${l.y2}" r="3.4" fill="${hue}"/>`);
    if (opts.dots) {                                           // %% dots：接続点を丸点に（回路図の作法）
      parts.push(`<circle cx="${l.x1}" cy="${l.y1}" r="3" fill="${hue}"/>`);
      if (!l.dot) parts.push(`<circle cx="${l.x2}" cy="${l.y2}" r="3" fill="${hue}"/>`);
    }
    const chip = e.label || (e.vlan != null ? 'VLAN ' + e.vlan : null) || (e.redundant ? '冗長' : null);
    if (chip) {
      const s0 = segs[0];
      const mx = (s0.x1 + s0.x2) / 2, my = (s0.y1 + s0.y2) / 2;
      const tw = textW(chip, 6.2) + 12;
      parts.push(`<rect x="${mx - tw / 2}" y="${my - 8}" width="${tw}" height="16" rx="8" fill="${T.paper}" stroke="${hue}" stroke-opacity="0.6" opacity="0.92"/>`
        + `<text x="${mx}" y="${my + 3.5}" fill="${hue}" font-size="9.5" text-anchor="middle">${iesc(chip)}</text>`);
    }
  }
  for (const b of L.buses) {
    const chip = [b.label, b.vlan != null ? 'VLAN ' + b.vlan : null, b.cidr].filter(Boolean).join(' ・ ');
    const hue = b.vlan != null ? vlanHue(b.vlan) : '#8ad1f5';
    if (b.orient === 'v') {
      parts.push(`<g data-drag="node" data-id="${iesc(b.id)}" style="cursor:grab">`
        + `<line x1="${b.x}" y1="${b.y1}" x2="${b.x}" y2="${b.y2}" stroke="${hue}" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="${b.x - 10}" y="${b.y1}" width="20" height="${b.y2 - b.y1}" fill="transparent"/>`
        + `<text x="${b.x + 9}" y="${b.y1 + 14}" fill="${hue}" font-size="11" writing-mode="tb">${iesc(chip)}</text></g>`);
    } else {
      parts.push(`<g data-drag="node" data-id="${iesc(b.id)}" style="cursor:grab">`
        + `<line x1="${b.x1}" y1="${b.y}" x2="${b.x2}" y2="${b.y}" stroke="${hue}" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="${b.x1}" y="${b.y - 10}" width="${b.x2 - b.x1}" height="20" fill="transparent"/>`
        + `<text x="${b.x1 + 4}" y="${b.y - 9}" fill="${hue}" font-size="11" font-weight="600">${iesc(chip)}</text></g>`);
    }
  }
  // フェンス（保守分界・責任分界）：⚑ 付きの重い破線。またぐものの責任がひと目で分かれる。
  for (const f of L.fences) {
    const c = '#f5667a';
    if (f.orient === 'h') {
      parts.push(`<g data-drag="node" data-id="${iesc(f.id)}" style="cursor:grab">`
        + `<line x1="${f.x1}" y1="${f.y}" x2="${f.x2}" y2="${f.y}" stroke="${c}" stroke-width="2.2" stroke-dasharray="12 6"/>`
        + `<rect x="${f.x1}" y="${f.y - 10}" width="${f.x2 - f.x1}" height="20" fill="transparent"/>`
        + `<text x="${f.x1 + 6}" y="${f.y - 7}" fill="${c}" font-size="11" font-weight="600">⚑ ${iesc(f.label)}</text></g>`);
    } else {
      parts.push(`<g data-drag="node" data-id="${iesc(f.id)}" style="cursor:grab">`
        + `<line x1="${f.x}" y1="${f.y1}" x2="${f.x}" y2="${f.y2}" stroke="${c}" stroke-width="2.2" stroke-dasharray="12 6"/>`
        + `<rect x="${f.x - 10}" y="${f.y1}" width="20" height="${f.y2 - f.y1}" fill="transparent"/>`
        + `<text x="${f.x + 8}" y="${f.y1 + 16}" fill="${c}" font-size="11" font-weight="600" writing-mode="tb">⚑ ${iesc(f.label)}</text></g>`);
    }
  }
  const detail = opts.detail !== false;                      // セマンティックズーム：引いたらメタを省く
  L.nodes.forEach((n) => {
    const sel = !!opts.selected?.has?.(n.id);
    if (n.hub) {                                             // ハブ（二重円）：スポークの中心
      const hue = n.vlan != null ? vlanHue(n.vlan) : '#8ad1f5';
      const cx = n.x + n.r, cy = n.y + n.r;
      let g = `<g data-drag="node" data-id="${iesc(n.id)}" style="cursor:grab">`;
      if (sel) g += `<circle cx="${cx}" cy="${cy}" r="${n.r + 6}" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
      g += `<circle cx="${cx}" cy="${cy}" r="${n.r}" fill="${T.nodeFill}" stroke="${hue}" stroke-width="${sel ? 2.8 : 2}"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${n.r - 5}" fill="none" stroke="${hue}" stroke-opacity="0.45"/>`
        + `<text x="${cx}" y="${cy + 4}" fill="${T.ink}" font-size="12" font-weight="700" text-anchor="middle">${iesc(n.label)}</text>`;
      const chip = [n.vlan != null ? 'VLAN ' + n.vlan : null, n.cidr].filter(Boolean).join(' ・ ');
      if (chip && detail) g += `<text x="${cx}" y="${cy + n.r + 14}" fill="${T.dim}" font-size="10" text-anchor="middle">${iesc(chip)}</text>`;
      parts.push(g + `</g>`);
      if (sel && opts.selected.size === 1)
        parts.push(`<g data-connect="1" data-id="${iesc(n.id)}" style="cursor:crosshair">`
          + `<circle cx="${cx + n.r + 14}" cy="${cy}" r="8" fill="#6aa9ff"/>`
          + `<text x="${cx + n.r + 14}" y="${cy + 3.5}" fill="${T.paper}" font-size="10" text-anchor="middle" font-weight="700">→</text></g>`);
      return;
    }
    const hue = ROLE_HUE[n.role] || '#9aa3b5';
    const tag = ROLE_TAG[n.role];
    const metas = metaLines(n);
    let g = `<g data-drag="node" data-id="${iesc(n.id)}" style="cursor:grab">`;
    if (sel) g += `<rect x="${n.x - 5}" y="${n.y - 5}" width="${n.w + 10}" height="${n.h + 10}" rx="9" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    g += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7" fill="${T.nodeFill}" stroke="${hue}" stroke-width="${sel ? 2.6 : 1.5}"/>`
      + `<rect x="${n.x}" y="${n.y}" width="4" height="${n.h}" rx="2" fill="${hue}"/>`;
    if (tag) g += `<rect x="${n.x + n.w - 34}" y="${n.y + 5}" width="28" height="14" rx="4" fill="${hue}" fill-opacity="0.18"/>`
      + `<text x="${n.x + n.w - 20}" y="${n.y + 15.5}" fill="${hue}" font-size="9" font-weight="700" text-anchor="middle">${tag}</text>`;
    g += `<text x="${n.x + 12}" y="${n.y + 19}" fill="${T.ink}" font-size="12.5" font-weight="600">${iesc(n.label)}</text>`;
    if (detail) metas.forEach((m2, i) => { g += `<text x="${n.x + 12}" y="${n.y + 34 + i * 13}" fill="${T.dim}" font-size="10.5">${iesc(m2)}</text>`; });
    parts.push(g + `</g>`);
    if (sel && opts.selected.size === 1)
      parts.push(`<g data-connect="1" data-id="${iesc(n.id)}" style="cursor:crosshair">`
        + `<circle cx="${n.x + n.w + 14}" cy="${n.y + n.h / 2}" r="8" fill="#6aa9ff"/>`
        + `<text x="${n.x + n.w + 14}" y="${n.y + n.h / 2 + 3.5}" fill="${T.paper}" font-size="10" text-anchor="middle" font-weight="700">→</text></g>`);
  });
  return parts.join('\n');
}

// ---- 逆コンパイル ----------------------------------------------------------------

const attrsOf = (n) => [n.role, n.os, n.ip, n.vlan != null ? 'vlan ' + n.vlan : null].filter(Boolean).join(', ');
const linkAttrsOf = (e) => [
  e.redundant ? '冗長' : null, e.dashed ? '予備' : null, e.thick ? '幹線' : null,
  e.arrow ? '一方向' : null, e.vlan != null ? 'vlan ' + e.vlan : null, e.label,
].filter(Boolean).join(', ');

export function infraBody(model) {
  const out = ['infra'];
  if (model.meta.title) out.push(`    title ${model.meta.title}`);
  const nodeLine = (n, ind) => `${ind}${n.id}[${n.label}]${attrsOf(n) ? ' :' + attrsOf(n) : ''}`;
  const busLine = (b, ind) => {
    const attrs = [b.zone ? null : b.orient, b.vlan != null ? 'vlan ' + b.vlan : null, b.cidr,
      b.len != null ? 'len ' + b.len : null].filter(Boolean).join(', ');
    return `${ind}bus ${b.id}[${b.label}]${attrs ? ' :' + attrs : ''}`;
  };
  const hubLine = (h, ind) => {
    const attrs = [h.role, h.vlan != null ? 'vlan ' + h.vlan : null, h.cidr,
      h.len != null ? 'len ' + h.len : null].filter(Boolean).join(', ');
    return `${ind}hub ${h.id}[${h.label}]${attrs ? ' :' + attrs : ''}`;
  };
  const emitZone = (zname, ind) => {
    for (const z of model.groups.filter((g) => g.parent === zname)) {
      out.push(`${ind}zone ${z.name} {`);
      emitZone(z.name, ind + '  ');
      out.push(`${ind}}`);
    }
    for (const n of model.items.filter((x) => x.type === 'inode' && x.zone === zname)) out.push(nodeLine(n, ind));
    if (zname) for (const h of model.items.filter((x) => x.type === 'hub' && x.zone === zname)) out.push(hubLine(h, ind));
    if (zname) for (const b of model.items.filter((x) => x.type === 'bus' && x.zone === zname)) out.push(busLine(b, ind));
    if (zname) for (const f of model.items.filter((x) => x.type === 'fence' && x.zone === zname))
      out.push(`${ind}fence ${f.id}[${f.label}] :${f.orient}`);
  };
  emitZone(null, '    ');
  for (const h of model.items.filter((x) => x.type === 'hub' && !x.zone)) out.push(hubLine(h, '    '));
  for (const b of model.items.filter((x) => x.type === 'bus' && !x.zone)) out.push(busLine(b, '    '));
  for (const f of model.items.filter((x) => x.type === 'fence' && !x.zone))
    out.push(`    fence ${f.id}[${f.label}] :${f.orient}`);
  for (const e of model.edges) {
    const a = linkAttrsOf(e);
    out.push(`    ${e.from} -- ${e.to}${a ? ' :' + a : ''}`);
  }
  return out;
}
