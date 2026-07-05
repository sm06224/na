/* ============================================================
   ledger — 台帳。モデル（infra）から機器台帳と IP アドレス台帳（IPAM）を引く。
   純粋（DOM 非依存・決定的）。UI は ui/editor.js が表として描く。

   - ledgerDevices(model): 機器の台帳行（id・名前・役割・OS・IP・VLAN・ゾーン・接続数・レイヤ）
   - ledgerIpam(model): ネットワーク（cidr を持つバス/ハブ）ごとの払い出し台帳。
       割当（機器 IP・リンク両端 IP を収容）・重複 ⚠・範囲外・次の空き（払い出し提案）・利用率。
       どのネットワークにも属さない IP は「未収容」に集める。
   - CSV 化は ledgerCsv(rows) —— Excel に貼れる台帳がワンタップで出る。
   ============================================================ */

const ip2n = (ip) => ip.split('.').slice(0, 4).reduce((a, o) => a * 256 + (+o), 0);
const n2ip = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const inCidr = (ip, cidr) => {
  const [net, plenRaw] = cidr.split('/');
  const plen = +plenRaw;
  if (!(plen >= 0 && plen <= 32)) return false;
  const mask = plen === 0 ? 0 : (~0 << (32 - plen)) >>> 0;
  return ((ip2n(ip) & mask) >>> 0) === ((ip2n(net) & mask) >>> 0);
};

// モデル中の「IP を持つもの」を全部拾う：機器の ips、リンク両端の ipFrom/ipTo。
function allAssignments(model) {
  const out = [];
  for (const n of model.items.filter((x) => x.type === 'inode')) {
    const ips = (n.ips && n.ips.length ? n.ips : (n.ip ? [n.ip] : []));
    for (const ip of ips) out.push({ ip: ip.split('/')[0], owner: n.id, label: n.label, via: '機器' });
  }
  for (const e of model.edges) {
    if (e.ipFrom) out.push({ ip: e.ipFrom.split('/')[0], owner: e.from, label: e.from, via: `→ ${e.to}` });
    if (e.ipTo) out.push({ ip: e.ipTo.split('/')[0], owner: e.to, label: e.to, via: `→ ${e.from}` });
  }
  return out;
}

export function ledgerDevices(model) {
  const deg = new Map();
  for (const e of model.edges) {
    deg.set(e.from, (deg.get(e.from) || 0) + 1);
    deg.set(e.to, (deg.get(e.to) || 0) + 1);
  }
  return model.items.filter((x) => x.type === 'inode' || x.type === 'hub').map((n) => ({
    id: n.id, label: n.label, role: n.role || '', os: n.os || '',
    ips: (n.ips && n.ips.length ? n.ips : (n.ip ? [n.ip] : [])).concat(
      model.edges.flatMap((e) => e.from === n.id && e.ipFrom ? [e.ipFrom] : e.to === n.id && e.ipTo ? [e.ipTo] : [])),
    vlan: n.vlan != null ? n.vlan : '', zone: n.zone || '', layer: n.layer || '',
    links: deg.get(n.id) || 0,
  }));
}

export function ledgerIpam(model) {
  const nets = model.items.filter((x) => (x.type === 'bus' || x.type === 'hub') && x.cidr)
    .map((b) => ({ id: b.id, label: b.label, cidr: b.cidr, vlan: b.vlan, rows: [] }));
  const orphans = [];
  const asg = allAssignments(model);
  for (const a of asg) {
    const net = nets.find((nn) => inCidr(a.ip, nn.cidr));
    (net ? net.rows : orphans).push(a);
  }
  for (const net of nets) {
    net.rows.sort((a, b) => ip2n(a.ip) - ip2n(b.ip) || a.owner.localeCompare(b.owner));
    const byIp = new Map();
    for (const r of net.rows) { if (!byIp.has(r.ip)) byIp.set(r.ip, []); byIp.get(r.ip).push(r); }
    for (const [, rs] of byIp) if (new Set(rs.map((r) => r.owner)).size > 1) rs.forEach((r) => { r.dup = true; });
    // 次の空き（払い出し提案）：ネットワーク先頭+1 から線形に。.0 と最後（ブロードキャスト）は避ける。
    const plen = +net.cidr.split('/')[1];
    const base = ip2n(net.cidr.split('/')[0]) & (plen === 0 ? 0 : (~0 << (32 - plen)) >>> 0);
    const size = 2 ** (32 - plen);
    const used = new Set(net.rows.map((r) => ip2n(r.ip)));
    net.free = null;
    for (let i = 1; i < Math.min(size - 1, 4096); i++) {
      if (!used.has(base + i)) { net.free = n2ip(base + i); break; }
    }
    net.dups = net.rows.filter((r) => r.dup).length;
    net.util = size > 2 ? Math.round((new Set(net.rows.map((r) => r.ip)).size / (size - 2)) * 100) : 0;
  }
  return { nets, orphans };
}

// 台帳 → CSV（BOM つき UTF-8 で Excel 直開き可。カンマ・引用符・改行はエスケープ）。
export function ledgerCsv(headers, rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [headers, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n';
}
