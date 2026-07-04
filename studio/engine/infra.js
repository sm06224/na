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
  const out = { role: null, os: null, ip: null, vlan: null, orient: null };
  for (const tokRaw of String(spec || '').split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const low = tok.toLowerCase();
    const mv = /^vlan\s*(\d+)$/i.exec(tok);
    if (mv) { out.vlan = +mv[1]; continue; }
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
      model.items.push({ type: 'bus', id: bm[1], label: bm[2] || bm[1], orient: a.orient || 'h', vlan: a.vlan, cidr: a.ip });
      model.order.push(bm[1]);
      continue;
    }
    const fm = FENCE_RE.exec(line);
    if (fm) {
      const a = parseAttrs(fm[3]);
      model.items.push({ type: 'fence', id: fm[1], label: fm[2] || fm[1], orient: a.orient || 'v' });
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

  const nodesAll = model.items.filter((x) => x.type === 'inode').map((n) => ({ ...n, ...inodeSize(n), x: 0, y: 0 }));
  const hiddenIn = new Map();                                 // nodeId → 畳んだゾーン名
  for (const n of nodesAll) { const fa = n.zone ? foldedAncestor(n.zone) : null; if (fa) hiddenIn.set(n.id, fa); }
  const nodes = nodesAll.filter((n) => !hiddenIn.has(n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const PAD = 14, HEAD = 24, GAP = 12;
  const foldSize = (z) => {
    const inside = nodesAll.filter((n) => hiddenIn.get(n.id) === z.name).length;
    return { w: Math.ceil(textW(z.name, 8) + 76), h: 40, count: inside };
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
  const zpos = model.layout.zpos || {};
  for (const z of zones) if (z.folded && zpos[z.name]) { z.x = zpos[z.name][0]; z.y = zpos[z.name][1]; }
  // 展開ゾーンの枠は中身の bbox を追いかける（深い順）。
  for (const z of [...zones].sort((a, b) => b.depth - a.depth)) {
    if (z.folded) continue;
    const inner = [...nodes.filter((n) => n.zone === z.name), ...zones.filter((zz) => zz.parent === z.name)];
    if (!inner.length) { z.w = Math.max(z.w, 120); z.h = Math.max(z.h, 60); continue; }
    const x0 = Math.min(...inner.map((b) => b.x)) - PAD, y0 = Math.min(...inner.map((b) => b.y)) - PAD - (HEAD - 6);
    const x1 = Math.max(...inner.map((b) => b.x + b.w)) + PAD, y1 = Math.max(...inner.map((b) => b.y + b.h)) + PAD;
    z.x = x0; z.y = y0; z.w = x1 - x0; z.h = y1 - y0;
  }
  const bx1 = Math.max(120, ...nodes.map((n) => n.x + n.w), ...zones.map((z) => z.x + z.w));
  const by1 = Math.max(80, ...nodes.map((n) => n.y + n.h), ...zones.map((z) => z.y + z.h));
  const bx0 = Math.min(20, ...nodes.map((n) => n.x), ...zones.map((z) => z.x));

  // バス：h は下に順に、v は右に順に。ドラッグ（pos）で自由に。
  // バス：pos があれば [x,y] とも自由（長さは自動 span を保ったまま平行移動）。
  const buses = [];
  let hy = by1 + 44, vx = bx1 + 56;
  for (const b of model.items.filter((x) => x.type === 'bus')) {
    const p = model.layout.pos[b.id];
    if (b.orient === 'v') {
      const span = by1 + 4;
      const x = p ? p[0] : vx, y1 = p ? p[1] : 16;
      buses.push({ ...b, x, y1, y2: y1 + span });
      if (!p) vx += 56;
    } else {
      const span = (bx1 + 20) - (bx0 - 4);
      const x1 = p ? p[0] : bx0 - 4, y = p ? p[1] : hy;
      buses.push({ ...b, y, x1, x2: x1 + span });
      if (!p) hy += 46;
    }
  }
  const busOf = new Map(buses.map((b) => [b.id, b]));

  // 接続の端点解決：畳まれたゾーンの中の機器は、その札に付け替える（多重は一本に畳む）。
  const zBox = (zname) => { const z = zoneOf.get(zname); return { x: z.x, y: z.y, w: z.w, h: z.h, id: zname }; };
  const endOf = (id) => byId.get(id) || (hiddenIn.has(id) ? zBox(hiddenIn.get(id)) : null);
  const links = [];
  const seenFold = new Set();
  const pairIndex = new Map();                                // 同じ 2 点間の何本目か（多重ネットワーク）
  for (const e of model.edges) {
    const ea = endOf(e.from), eb = endOf(e.to);
    const ba = busOf.get(e.from), bb = busOf.get(e.to);
    const aId = ea?.id || e.from, bId = eb?.id || e.to;
    if (hiddenIn.has(e.from) || hiddenIn.has(e.to)) {          // 畳み先が同じなら線ごと隠す
      if (hiddenIn.get(e.from) && hiddenIn.get(e.from) === hiddenIn.get(e.to)) continue;
      const k = `${aId}|${bId}|${e.vlan ?? ''}`;
      if (seenFold.has(k)) continue;
      seenFold.add(k);
    }
    const key = [aId, bId].sort().join('|');
    const idx = pairIndex.get(key) || 0; pairIndex.set(key, idx + 1);
    if (ea && bb) links.push({ ...stub(ea, bb), e, idx });
    else if (eb && ba) links.push({ ...stub(eb, ba), e, idx });
    else if (ea && eb) links.push({ x1: ea.x + ea.w / 2, y1: ea.y + ea.h / 2, x2: eb.x + eb.w / 2, y2: eb.y + eb.h / 2, e, idx });
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

  // フェンス（保守分界・責任分界）：既定はコンテンツの右寄り／下寄り。ドラッグで置き直す。
  const fences = [];
  let fi = 0;
  for (const f of model.items.filter((x) => x.type === 'fence')) {
    fi++;
    if (f.orient === 'h') {
      const y = model.layout.pos[f.id] ? model.layout.pos[f.id][1] : by1 + 20 + fi * 30;
      fences.push({ ...f, y, x1: bx0 - 24, x2: bx1 + 40 });
    } else {
      const x = model.layout.pos[f.id] ? model.layout.pos[f.id][0] : bx0 + (bx1 - bx0) * 0.5 + fi * 40;
      fences.push({ ...f, x, y1: 0, y2: by1 + 30 });
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
  const x0 = Math.min(...xs) - M, y0 = Math.min(...ys) - M;
  const x1 = Math.max(...xs) + M, y1 = Math.max(...ys) + M;

  return { kind: 'infra', x0, y0, width: x1 - x0, height: y1 - y0,
    nodes, zones, buses, links, fences, errors: [] };
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
  for (const z of [...L.zones].sort((a, b) => a.depth - b.depth)) {
    if (z.folded) {                                            // 畳まれたゾーン＝札。つかんで移動、▸ タップで開く
      parts.push(`<g data-drag="zone" data-id="${iesc(z.name)}" data-folded="1" style="cursor:grab">`
        + `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="9" fill="${T.chip}" stroke="${T.dim}" stroke-dasharray="5 4"/>`
        + `<text x="${z.x + 30}" y="${z.y + 25}" fill="${T.head}" font-size="12" font-weight="700">${iesc(z.name)}<tspan fill="${T.dim}" font-weight="400"> ・ ${z.count} 台</tspan></text></g>`
        + `<g data-fold="${iesc(z.name)}" style="cursor:pointer"><rect x="${z.x + 4}" y="${z.y + 10}" width="22" height="22" rx="5" fill="transparent"/><text x="${z.x + 12}" y="${z.y + 25}" fill="${T.head}" font-size="12" font-weight="700">▸</text></g>`);
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
  L.nodes.forEach((n) => {
    const hue = ROLE_HUE[n.role] || '#9aa3b5';
    const tag = ROLE_TAG[n.role];
    const sel = !!opts.selected?.has?.(n.id);
    const metas = metaLines(n);
    let g = `<g data-drag="node" data-id="${iesc(n.id)}" style="cursor:grab">`;
    if (sel) g += `<rect x="${n.x - 5}" y="${n.y - 5}" width="${n.w + 10}" height="${n.h + 10}" rx="9" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    g += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7" fill="${T.nodeFill}" stroke="${hue}" stroke-width="${sel ? 2.6 : 1.5}"/>`
      + `<rect x="${n.x}" y="${n.y}" width="4" height="${n.h}" rx="2" fill="${hue}"/>`;
    if (tag) g += `<rect x="${n.x + n.w - 34}" y="${n.y + 5}" width="28" height="14" rx="4" fill="${hue}" fill-opacity="0.18"/>`
      + `<text x="${n.x + n.w - 20}" y="${n.y + 15.5}" fill="${hue}" font-size="9" font-weight="700" text-anchor="middle">${tag}</text>`;
    g += `<text x="${n.x + 12}" y="${n.y + 19}" fill="${T.ink}" font-size="12.5" font-weight="600">${iesc(n.label)}</text>`;
    metas.forEach((m2, i) => { g += `<text x="${n.x + 12}" y="${n.y + 34 + i * 13}" fill="${T.dim}" font-size="10.5">${iesc(m2)}</text>`; });
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
  for (const f of model.items.filter((x) => x.type === 'fence'))
    out.push(`    fence ${f.id}[${f.label}] :${f.orient}`);
  for (const e of model.edges) {
    const a = linkAttrsOf(e);
    out.push(`    ${e.from} -- ${e.to}${a ? ' :' + a : ''}`);
  }
  return out;
}
