/* ============================================================
   v22: 拠点の雛形（スキャフォールド）——「描く」より速い「生やす」。
   よくある拠点構成（DC / 支社 / 工場 / 支店）を、ユニークな接頭辞つきの
   infra DSL 断片として返す。乱数なし・時刻なし——同じ引数からは常に同じ断片。
   人間は生やしてから直すだけ（コード生成 8 割・調整 2 割の要）。
   断片は自己完結：外の id を参照しない（貼った瞬間からエラーゼロ）。
   ============================================================ */

export const SCAFFOLD_KINDS = [
  { key: 'dc', label: 'データセンター（コア冗長＋サーバ＋DMZ）', ja: 'DC' },
  { key: 'regional', label: '地域支社（機械室＋フロア）', ja: '支社' },
  { key: 'factory', label: '工場（IT＋OT・制御LAN・ライン）', ja: '工場' },
  { key: 'branch', label: '支店（小規模オフィス）', ja: '支店' },
];

// oct は IP 第 2 オクテット（10.oct.x.y）。接頭辞・名前・oct を変えれば何個でも生やせる。
export function scaffoldSite(kind, prefix, name, oct = 10) {
  const p = prefix, B = [], E = [];
  const z = (s) => B.push(s);
  if (kind === 'dc') {
    z(`    zone ${name} {`);
    z(`      zone ${name}-コア {`);
    z(`        ${p}_core1[CORE-1] :core, 10.${oct}.0.1`);
    z(`        ${p}_core2[CORE-2] :core, 10.${oct}.0.2`);
    z(`        ${p}_fw1[FW-1] :firewall, 10.${oct}.0.11`);
    z(`        ${p}_fw2[FW-2] :firewall, 10.${oct}.0.12`);
    z(`        ${p}_rt[WAN-RT] :router, 10.${oct}.0.254`);
    z(`        bus ${p}_corebus[コア収容] :vlan ${oct}, 10.${oct}.0.0/24`);
    z('      }');
    z(`      zone ${name}-サーバ {`);
    for (let k = 1; k <= 4; k++) z(`        ${p}_sv${k}[AP-${k}] :server, 10.${oct}.1.${k}`);
    z(`        ${p}_db[DB] :db, 10.${oct}.1.10, value 300`);
    z(`        ${p}_st[ST] :storage, 10.${oct}.1.20`);
    z(`        bus ${p}_svbus[サーバ収容] :vlan ${oct * 10}, 10.${oct}.1.0/24`);
    z('      }');
    z(`      zone ${name}-DMZ {`);
    z(`        ${p}_px[PX] :lb, 192.168.${oct}.1`);
    z(`        ${p}_web1[WEB-1] :server, 192.168.${oct}.11`);
    z(`        ${p}_web2[WEB-2] :server, 192.168.${oct}.12`);
    z('      }');
    z('    }');
    E.push(`    ${p}_core1 -- ${p}_corebus`, `    ${p}_core2 -- ${p}_corebus`,
      `    ${p}_core1 -- ${p}_core2 :stack`,
      `    ${p}_fw1 -- ${p}_corebus`, `    ${p}_fw2 -- ${p}_corebus`, `    ${p}_rt -- ${p}_corebus`);
    for (let k = 1; k <= 4; k++) E.push(`    ${p}_sv${k} -- ${p}_svbus`);
    E.push(`    ${p}_db -- ${p}_svbus`, `    ${p}_st -- ${p}_svbus`,
      `    ${p}_svbus -- ${p}_core1 :幹線`,
      `    ${p}_px -- ${p}_fw1`, `    ${p}_web1 -- ${p}_px`, `    ${p}_web2 -- ${p}_px`);
  } else if (kind === 'regional') {
    z(`    zone ${name} {`);
    z(`      zone ${name}-機械室 {`);
    z(`        ${p}_core[CORE-SW] :core, 10.${oct}.0.1`);
    z(`        ${p}_fw[FW] :firewall, 10.${oct}.0.11`);
    z(`        ${p}_rt[WAN-RT] :router, 10.${oct}.0.254`);
    for (let k = 1; k <= 3; k++) z(`        ${p}_sv${k}[SV-${k}] :server, 10.${oct}.1.${k}`);
    z(`        ${p}_nas[NAS] :storage, 10.${oct}.1.100`);
    z(`        bus ${p}_bus[支社基幹] :vlan ${oct}, 10.${oct}.0.0/23`);
    z('      }');
    z(`      zone ${name}-1F {`);
    z(`        ${p}_sw1[SW-1F] :access, vlan 201`);
    z(`        ${p}_ap1[AP-1F] :ap, vlan 201`);
    for (let c = 1; c <= 3; c++) z(`        ${p}_pc1_${c}[島${c}] :pc, Win11`);
    z('      }');
    z('    }');
    E.push(`    ${p}_core -- ${p}_bus`, `    ${p}_fw -- ${p}_bus`, `    ${p}_rt -- ${p}_bus`);
    for (let k = 1; k <= 3; k++) E.push(`    ${p}_sv${k} -- ${p}_bus`);
    E.push(`    ${p}_nas -- ${p}_bus :バックアップ`, `    ${p}_sw1 -- ${p}_core :vlan 201`, `    ${p}_ap1 -- ${p}_sw1`);
    for (let c = 1; c <= 3; c++) E.push(`    ${p}_pc1_${c} -- ${p}_sw1`);
  } else if (kind === 'factory') {
    z(`    zone ${name} {`);
    z(`      zone ${name}-情報LAN {`);
    z(`        ${p}_itfw[IT-FW] :firewall, 10.${oct}.0.1`);
    z(`        ${p}_itsw[IT-SW] :switch, 10.${oct}.0.2`);
    z(`        ${p}_mes[MES] :server, RHEL9, 10.${oct}.0.21`);
    z('      }');
    z(`      zone ${name}-監視室 {`);
    z(`        ${p}_scada[SCADA] :scada, 172.16.${oct}.10`);
    z(`        ${p}_hist[Historian] :historian, 172.16.${oct}.11`);
    z(`        ${p}_hmi1[HMI-1] :hmi, 172.16.${oct}.21`);
    z(`        bus ${p}_ctlbus[制御LAN] :vlan 400, 172.16.${oct}.0/24`);
    z('      }');
    z(`      zone ${name}-ライン1 {`);
    z(`        ${p}_plc1[PLC-1] :plc, 172.17.${oct}.10`);
    z(`        ${p}_rio1[リモートIO-1] :rtu, 172.17.${oct}.11`);
    z(`        ${p}_drv1[ドライブ-1] :drive, 172.17.${oct}.12`);
    z('      }');
    z(`      fence ${p}_fence[保守分界（当社/ベンダー）] :v`);
    z('    }');
    E.push(`    ${p}_itsw -- ${p}_itfw`, `    ${p}_mes -- ${p}_itsw`,
      `    ${p}_scada -- ${p}_ctlbus :冗長`, `    ${p}_hist -- ${p}_ctlbus`, `    ${p}_hmi1 -- ${p}_ctlbus`,
      `    ${p}_itfw -- ${p}_scada :一方向, 上位連携`,
      `    ${p}_plc1 -- ${p}_ctlbus :vlan 400`, `    ${p}_rio1 -- ${p}_plc1`, `    ${p}_drv1 -- ${p}_plc1`);
  } else {                                                   // branch（既定）
    z(`    zone ${name} {`);
    z(`      ${p}_rt[ルータ] :router, 192.168.${oct}.1`);
    z(`      ${p}_utm[UTM] :firewall, 192.168.${oct}.2`);
    z(`      ${p}_sw[SW] :access, 192.168.${oct}.3`);
    z(`      ${p}_ap[AP] :ap, 192.168.${oct}.4`);
    z(`      ${p}_nas[NAS] :storage, 192.168.${oct}.5`);
    for (let c = 1; c <= 4; c++) z(`      ${p}_pc${c}[PC島${c}] :pc, Win11`);
    z('    }');
    E.push(`    ${p}_utm -- ${p}_rt`, `    ${p}_sw -- ${p}_utm`, `    ${p}_ap -- ${p}_sw`, `    ${p}_nas -- ${p}_sw`);
    for (let c = 1; c <= 4; c++) E.push(`    ${p}_pc${c} -- ${p}_sw`);
  }
  return [...B, ...E].join('\n');
}
