#!/usr/bin/env node
/* ============================================================
   メガコーポ・サンプルの生成器 — 全国 40 拠点・1000+ 機器の infra DSL を吐く。
   手で 1000 行書くのではなく「拠点の種類 × 実在都市の座標」から決定的に生成する。
   出力:
     examples/megacorp.mmd   … ビルド対象（dist/megacorp.html になる）
     engine/mega.js          … エディタのサンプル選択肢（MEGA_DSL）
   乱数なし・時刻なし——同じ入力からは常に同じ DSL（往復テストが成り立つ）。
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// 拠点表（実在都市の概略座標）。kind が構成テンプレートを決める。
const SITES = [
  { id: 'hq', name: '東京本社', lat: 35.68, lng: 139.76, kind: 'dc', floors: 4, servers: 40, region: 'kanto' },
  { id: 'dr', name: '大阪DR', lat: 34.69, lng: 135.5, kind: 'dc', floors: 2, servers: 28, region: 'kinki' },
  { id: 'sap', name: '札幌支社', lat: 43.06, lng: 141.35, kind: 'regional', region: 'hokkaido' },
  { id: 'sen', name: '仙台支社', lat: 38.27, lng: 140.87, kind: 'regional', region: 'tohoku' },
  { id: 'nag', name: '名古屋支社', lat: 35.18, lng: 136.91, kind: 'regional', region: 'chubu' },
  { id: 'hir', name: '広島支社', lat: 34.39, lng: 132.46, kind: 'regional', region: 'chushi' },
  { id: 'tak', name: '高松支社', lat: 34.34, lng: 134.05, kind: 'regional', region: 'chushi' },
  { id: 'fuk', name: '福岡支社', lat: 33.59, lng: 130.4, kind: 'regional', region: 'kyushu' },
  { id: 'tom', name: '苫小牧工場', lat: 42.63, lng: 141.6, kind: 'factory', lines: 2, region: 'hokkaido' },
  { id: 'kit', name: '北上工場', lat: 39.29, lng: 141.11, kind: 'factory', lines: 2, region: 'tohoku' },
  { id: 'ota', name: '太田工場', lat: 36.29, lng: 139.38, kind: 'factory', lines: 3, region: 'kanto' },
  { id: 'toy', name: '富山工場', lat: 36.7, lng: 137.21, kind: 'factory', lines: 2, region: 'chubu' },
  { id: 'ham', name: '浜松工場', lat: 34.71, lng: 137.73, kind: 'factory', lines: 3, region: 'chubu' },
  { id: 'yok', name: '四日市工場', lat: 34.97, lng: 136.62, kind: 'factory', lines: 2, region: 'kinki' },
  { id: 'kur', name: '倉敷工場', lat: 34.6, lng: 133.77, kind: 'factory', lines: 2, region: 'chushi' },
  { id: 'kum', name: '熊本工場', lat: 32.8, lng: 130.71, kind: 'factory', lines: 2, region: 'kyushu' },
  ...[
    ['asa', '旭川支店', 43.77, 142.36, 'hokkaido'], ['aom', '青森支店', 40.82, 140.74, 'tohoku'],
    ['aki', '秋田支店', 39.72, 140.1, 'tohoku'], ['mor', '盛岡支店', 39.7, 141.15, 'tohoku'],
    ['yam', '山形支店', 38.24, 140.36, 'tohoku'], ['kor', '郡山支店', 37.4, 140.36, 'tohoku'],
    ['nii', '新潟支店', 37.9, 139.02, 'chubu'], ['utu', '宇都宮支店', 36.56, 139.88, 'kanto'],
    ['sai', 'さいたま支店', 35.86, 139.65, 'kanto'], ['chb', '千葉支店', 35.61, 140.11, 'kanto'],
    ['ykh', '横浜支店', 35.44, 139.64, 'kanto'], ['siz', '静岡支店', 34.98, 138.38, 'chubu'],
    ['kan', '金沢支店', 36.59, 136.63, 'chubu'], ['ngn', '長野支店', 36.65, 138.18, 'chubu'],
    ['gif', '岐阜支店', 35.42, 136.76, 'chubu'], ['kyo', '京都支店', 35.01, 135.77, 'kinki'],
    ['kob', '神戸支店', 34.69, 135.2, 'kinki'], ['oka', '岡山支店', 34.66, 133.92, 'chushi'],
    ['mat', '松山支店', 33.84, 132.77, 'chushi'], ['koc', '高知支店', 33.56, 133.53, 'chushi'],
    ['ngs', '長崎支店', 32.75, 129.88, 'kyushu'], ['oit', '大分支店', 33.24, 131.61, 'kyushu'],
    ['miy', '宮崎支店', 31.91, 131.42, 'kyushu'], ['nah', '那覇支店', 26.21, 127.68, 'kyushu'],
  ].map(([id, name, lat, lng, region]) => ({ id, name, lat, lng, kind: 'branch', region })),
];

// 地域ハブ（沖合に置く論理点——シーレーンとの位置関係も見える）。
const HUBS = [
  { id: 'h_hokkaido', name: '道内網', lat: 43.6, lng: 143.9, vlan: 11 },
  { id: 'h_tohoku', name: '東北網', lat: 39.2, lng: 143.2, vlan: 12 },
  { id: 'h_kanto', name: '関東網', lat: 35.0, lng: 141.4, vlan: 13 },
  { id: 'h_chubu', name: '中部網', lat: 36.9, lng: 135.4, vlan: 14 },
  { id: 'h_kinki', name: '近畿網', lat: 33.6, lng: 134.9, vlan: 15 },
  { id: 'h_chushi', name: '中四国網', lat: 33.2, lng: 132.4, vlan: 16 },
  { id: 'h_kyushu', name: '九州網', lat: 31.0, lng: 129.2, vlan: 17 },
];
const REGION_HUB = { hokkaido: 'h_hokkaido', tohoku: 'h_tohoku', kanto: 'h_kanto', chubu: 'h_chubu', kinki: 'h_kinki', chushi: 'h_chushi', kyushu: 'h_kyushu' };

const B = [];                       // 本文
const E = [];                       // 接続（本文の後ろにまとめる）
const G = [];                       // %% geo
const put = (s) => B.push(s);
let devices = 0;
const dev = (indent, id, label, spec) => { devices++; put(`${indent}${id}[${label}] :${spec}`); };

put('infra');
put('    title 全国メガコーポ — 40 拠点・IT/OT/クラウド（🗾 地理×BCP）');

// ---- データセンター拠点（本社・DR） ----
function dcSite(s, i) {
  const p = s.id, ip = 10 + i;
  put(`    zone ${s.name} {`);
  put(`      zone ${s.name}-コア {`);
  for (let k = 1; k <= 2; k++) dev('        ', `${p}_core${k}`, `CORE-${k}`, `core, NX-OS, 10.${ip}.0.${k}`);
  for (let k = 1; k <= 2; k++) dev('        ', `${p}_fw${k}`, `FW-${k}`, `firewall, FortiOS, 10.${ip}.0.${10 + k}`);
  dev('        ', `${p}_wanrt`, 'WAN-RT', `router, IOS-XE, 10.${ip}.0.254`);
  put(`        bus ${p}_corebus[コア収容] :vlan ${ip}, 10.${ip}.0.0/24`);
  put('      }');
  put(`      zone ${s.name}-サーバ {`);
  for (let k = 1; k <= s.servers; k++) {
    const role = k % 6 === 0 ? 'db' : k % 5 === 0 ? 'storage' : 'server';
    const os = k % 3 === 0 ? 'RHEL9' : k % 3 === 1 ? 'Ubuntu22' : 'WinSv2022';
    dev('        ', `${p}_sv${k}`, `${role === 'db' ? 'DB' : role === 'storage' ? 'ST' : 'AP'}-${k}`, `${role}, ${os}, 10.${ip}.1.${k}`);
  }
  put(`        bus ${p}_svbus[サーバ収容] :vlan ${ip * 10}, 10.${ip}.1.0/24`);
  put('      }');
  put(`      zone ${s.name}-DMZ {`);
  for (const [k, r] of [['px', 'lb'], ['web1', 'server'], ['web2', 'server'], ['mx', 'server']].entries())
    dev('        ', `${p}_${r[0]}`, r[0].toUpperCase(), `${r[1]}, RHEL9, 192.168.${ip}.${k + 1}`);
  put('      }');
  for (let f = 1; f <= s.floors; f++) {
    put(`      zone ${s.name}-${f}F {`);
    dev('        ', `${p}_fsw${f}`, `SW-${f}F`, `access, IOS15, vlan ${100 + f}`);
    dev('        ', `${p}_fap${f}`, `AP-${f}F`, `ap, vlan ${100 + f}`);
    for (let c = 1; c <= 6; c++) dev('        ', `${p}_fpc${f}_${c}`, `島${c}`, `pc, Win11, vlan ${100 + f}`);
    put('      }');
  }
  put('    }');
  for (let k = 1; k <= 2; k++) E.push(`    ${p}_core${k} -- ${p}_corebus`);
  E.push(`    ${p}_core1 -- ${p}_core2 :stack`);
  for (let k = 1; k <= 2; k++) E.push(`    ${p}_fw${k} -- ${p}_corebus`);
  E.push(`    ${p}_wanrt -- ${p}_corebus`);
  for (let k = 1; k <= s.servers; k++) E.push(`    ${p}_sv${k} -- ${p}_svbus`);
  E.push(`    ${p}_svbus -- ${p}_core1 :幹線`);
  E.push(`    ${p}_px -- ${p}_fw1`);
  for (const w of ['web1', 'web2', 'mx']) E.push(`    ${p}_${w} -- ${p}_px`);
  for (let f = 1; f <= s.floors; f++) {
    E.push(`    ${p}_fsw${f} -- ${p}_core1 :vlan ${100 + f}`);
    E.push(`    ${p}_fap${f} -- ${p}_fsw${f}`);
    for (let c = 1; c <= 6; c++) E.push(`    ${p}_fpc${f}_${c} -- ${p}_fsw${f}`);
  }
  E.push(`    ${p}_wanrt -- ${REGION_HUB[s.region]} :冗長, 幹線`);
}

// ---- 地域支社 ----
function regionalSite(s, i) {
  const p = s.id, ip = 30 + i;
  put(`    zone ${s.name} {`);
  put(`      zone ${s.name}-機械室 {`);
  dev('        ', `${p}_core`, 'CORE-SW', `core, NX-OS, 10.${ip}.0.1`);
  dev('        ', `${p}_fw`, 'FW', `firewall, FortiOS, 10.${ip}.0.11`);
  dev('        ', `${p}_rt`, 'WAN-RT', `router, IOS-XE, 10.${ip}.0.254`);
  for (let k = 1; k <= 10; k++) dev('        ', `${p}_sv${k}`, `SV-${k}`, `server, ${k % 2 ? 'RHEL9' : 'WinSv2022'}, 10.${ip}.1.${k}`);
  dev('        ', `${p}_nas`, 'NAS', `storage, 10.${ip}.1.100`);
  put(`        bus ${p}_bus[支社基幹] :vlan ${ip}, 10.${ip}.0.0/23`);
  put('      }');
  for (let f = 1; f <= 2; f++) {
    put(`      zone ${s.name}-${f}F {`);
    dev('        ', `${p}_sw${f}`, `SW-${f}F`, `access, vlan ${200 + f}`);
    dev('        ', `${p}_ap${f}`, `AP-${f}F`, `ap, vlan ${200 + f}`);
    for (let c = 1; c <= 5; c++) dev('        ', `${p}_pc${f}_${c}`, `島${c}`, `pc, Win11, vlan ${200 + f}`);
    put('      }');
  }
  put('    }');
  E.push(`    ${p}_core -- ${p}_bus`, `    ${p}_fw -- ${p}_bus`, `    ${p}_rt -- ${p}_bus`);
  for (let k = 1; k <= 10; k++) E.push(`    ${p}_sv${k} -- ${p}_bus`);
  E.push(`    ${p}_nas -- ${p}_bus :バックアップ`);
  for (let f = 1; f <= 2; f++) {
    E.push(`    ${p}_sw${f} -- ${p}_core :vlan ${200 + f}`);
    E.push(`    ${p}_ap${f} -- ${p}_sw${f}`);
    for (let c = 1; c <= 5; c++) E.push(`    ${p}_pc${f}_${c} -- ${p}_sw${f}`);
  }
  E.push(`    ${p}_rt -- ${REGION_HUB[s.region]} :冗長, 専用線`);
}

// ---- 工場（IT ＋ OT。Purdue 的にレベルを分け、保守分界フェンスを立てる） ----
function factorySite(s, i) {
  const p = s.id, ip = 50 + i;
  put(`    zone ${s.name} {`);
  put(`      zone ${s.name}-情報LAN {`);
  dev('        ', `${p}_itfw`, 'IT-FW', `firewall, FortiOS, 10.${ip}.0.1`);
  dev('        ', `${p}_itsw`, 'IT-SW', `switch, 10.${ip}.0.2`);
  dev('        ', `${p}_mes`, 'MES', `server, RHEL9, 10.${ip}.0.21`);
  dev('        ', `${p}_erp`, 'ERP連携', `server, WinSv2022, 10.${ip}.0.22`);
  for (let c = 1; c <= 3; c++) dev('        ', `${p}_opc${c}`, `事務${c}`, `pc, Win11, vlan 300`);
  put('      }');
  put(`      zone ${s.name}-監視室 {`);
  dev('        ', `${p}_scada`, 'SCADA', `scada, WinSv2019, 172.16.${ip}.10`);
  dev('        ', `${p}_hist`, 'Historian', `historian, WinSv2019, 172.16.${ip}.11`);
  for (let c = 1; c <= 2; c++) dev('        ', `${p}_hmi${c}`, `HMI-${c}`, `hmi, Win10 IoT, 172.16.${ip}.${20 + c}`);
  dev('        ', `${p}_ews`, 'EWS', `ews, Win10, 172.16.${ip}.30`);
  dev('        ', `${p}_hist2`, 'Historian-Mirror', `historian, WinSv2019, 172.16.${ip}.12`);
  dev('        ', `${p}_diode`, 'データダイオード', `diode, 172.16.${ip}.99`);
  put(`        bus ${p}_ctlbus[制御LAN] :vlan ${400 + i}, 172.16.${ip}.0/24`);
  put('      }');
  for (let ln = 1; ln <= s.lines; ln++) {
    put(`      zone ${s.name}-ライン${ln} {`);
    dev('        ', `${p}_plc${ln}`, `PLC-${ln}`, `plc, 172.17.${ip}.${ln * 10}`);
    dev('        ', `${p}_rio${ln}`, `リモートIO-${ln}`, `rtu, 172.17.${ip}.${ln * 10 + 1}`);
    dev('        ', `${p}_drv${ln}`, `ドライブ-${ln}`, `drive, 172.17.${ip}.${ln * 10 + 2}`);
    dev('        ', `${p}_rob${ln}`, `ロボット-${ln}`, `robot, 172.17.${ip}.${ln * 10 + 3}`);
    dev('        ', `${p}_sen${ln}`, `センサ群-${ln}`, `sensor, 172.17.${ip}.${ln * 10 + 4}`);
    dev('        ', `${p}_cnc${ln}`, `CNC-${ln}`, `cnc, 172.17.${ip}.${ln * 10 + 5}`);
    dev('        ', `${p}_gw${ln}`, `セルGW-${ln}`, `gateway, 172.17.${ip}.${ln * 10 + 6}`);
    put('      }');
  }
  put(`      zone ${s.name}-安全計装 {`);
  dev('        ', `${p}_sis`, 'SIS', `sis, 172.18.${ip}.1`);
  put('      }');
  put(`      fence ${p}_fence[保守分界（当社/ベンダー）] :v`);
  put('    }');
  E.push(`    ${p}_itsw -- ${p}_itfw`, `    ${p}_mes -- ${p}_itsw`, `    ${p}_erp -- ${p}_itsw`);
  for (let c = 1; c <= 3; c++) E.push(`    ${p}_opc${c} -- ${p}_itsw`);
  E.push(`    ${p}_scada -- ${p}_ctlbus :冗長`, `    ${p}_hist -- ${p}_ctlbus`);
  for (let c = 1; c <= 2; c++) E.push(`    ${p}_hmi${c} -- ${p}_ctlbus`);
  E.push(`    ${p}_ews -- ${p}_ctlbus`, `    ${p}_hist2 -- ${p}_hist :ミラー`);
  E.push(`    ${p}_diode -- ${p}_hist :一方向`, `    ${p}_itfw -- ${p}_diode :一方向, 上位連携`);
  for (let ln = 1; ln <= s.lines; ln++) {
    E.push(`    ${p}_plc${ln} -- ${p}_ctlbus :vlan ${400 + i}`);
    for (const t of ['rio', 'drv', 'rob', 'sen', 'cnc']) E.push(`    ${p}_${t}${ln} -- ${p}_plc${ln}`);
    E.push(`    ${p}_gw${ln} -- ${p}_ctlbus`);
  }
  E.push(`    ${p}_sis -- ${p}_plc1 :安全連動`);
  E.push(`    ${p}_itfw -- ${REGION_HUB[s.region]} :IP-VPN`);
}

// ---- 支店（小さく・数で攻める） ----
function branchSite(s, i) {
  const p = s.id, pcs = 13 + (i % 5);                    // 19〜23 台/拠点（決定的なゆらぎ）
  put(`    zone ${s.name} {`);
  dev('      ', `${p}_rt`, 'ルータ', `router, 192.168.${i + 1}.1`);
  dev('      ', `${p}_utm`, 'UTM', `firewall, 192.168.${i + 1}.2`);
  dev('      ', `${p}_sw`, 'SW', `access, 192.168.${i + 1}.3`);
  dev('      ', `${p}_ap`, 'AP', `ap, 192.168.${i + 1}.4`);
  dev('      ', `${p}_nas`, 'NAS', `storage, 192.168.${i + 1}.5`);
  dev('      ', `${p}_prn`, '複合機', `printer, 192.168.${i + 1}.6`);
  dev('      ', `${p}_tel`, '電話GW', `gateway, 192.168.${i + 1}.7`);
  for (let c = 1; c <= pcs; c++) dev('      ', `${p}_pc${c}`, `PC島${c}`, 'pc, Win11');
  put('    }');
  E.push(`    ${p}_utm -- ${p}_rt`, `    ${p}_sw -- ${p}_utm`, `    ${p}_ap -- ${p}_sw`, `    ${p}_nas -- ${p}_sw`, `    ${p}_prn -- ${p}_sw`, `    ${p}_tel -- ${p}_sw`);
  for (let c = 1; c <= pcs; c++) E.push(`    ${p}_pc${c} -- ${p}_sw`);
  E.push(`    ${p}_rt -- ${REGION_HUB[s.region]} :IP-VPN`);
}

// ---- クラウド（沖合の南に置く：物理でない場所も BCP の一部） ----
put('    zone クラウド {');
for (const [id, label, role] of [['aws_vpc', 'AWS VPC-RT', 'router'], ['aws_lb', 'ALB', 'lb'], ['az_gw', 'Azure VPN-GW', 'router']]) dev('      ', id, label, role);
for (let k = 1; k <= 8; k++) dev('      ', `cl_sv${k}`, `EC2/VM-${k}`, `server, ${k % 2 ? 'AmazonLinux' : 'Ubuntu22'}`);
dev('      ', 'saas', 'SaaS(M365/Box)', 'cloud');
put('    }');
E.push('    aws_lb -- aws_vpc');
for (let k = 1; k <= 8; k++) E.push(`    cl_sv${k} -- ${k % 2 ? 'aws_vpc' : 'az_gw'}`);

// ---- 生成本体 ----
let dcN = 0, regN = 0, facN = 0, brN = 0;
for (const s of SITES) {
  if (s.kind === 'dc') dcSite(s, dcN++);
  else if (s.kind === 'regional') regionalSite(s, regN++);
  else if (s.kind === 'factory') factorySite(s, facN++);
  else branchSite(s, brN++);
  G.push(`%% geo ${s.name}|${s.lat}|${s.lng}`);
}
put('    hub wan[全国WAN] :vlan 1, 10.0.0.0/8');
devices++;
for (const h of HUBS) { put(`    hub ${h.id}[${h.name}] :vlan ${h.vlan}`); devices++; G.push(`%% geo ${h.id}|${h.lat}|${h.lng}`); }
dev('    ', 'inet', 'インターネット', 'cloud');
G.push('%% geo wan|37.6|143.6');
G.push('%% geo クラウド|28.6|136.0');
G.push('%% geo inet|30.5|141.8');
for (const h of HUBS) E.push(`    ${h.id} -- wan :冗長, 幹線`);
E.push('    hq_fw1 -- inet :冗長', '    dr_fw1 -- inet :予備');
E.push('    aws_vpc -- wan :IPsec-VPN', '    az_gw -- wan :IPsec-VPN', '    saas -- inet :SSO');
E.push('    hq_sv6 -- dr_sv6 :rep, 一方向, DRレプリケーション', '    hq_sv5 -- dr_sv5 :mirror, ストレージミラー');

const dsl = [...B, '', ...E, '', '%% @layout', '%% lod', '%% map', '%% hazard quake|tsunami|volcano|typhoon|snow|geopol', ...G].join('\n') + '\n';

writeFileSync(join(HERE, '..', 'examples', 'megacorp.mmd'), dsl);
writeFileSync(join(HERE, '..', 'engine', 'mega.js'),
  `/* 自動生成：tools/genmega.mjs が吐くメガコーポ・サンプル（${devices} 機器）。手で編集しない。 */\n`
  + `export const MEGA_DSL = ${JSON.stringify(dsl)};\n`);
console.log(`megacorp: ${devices} devices, ${SITES.length} sites, ${dsl.split('\n').length} lines`);
