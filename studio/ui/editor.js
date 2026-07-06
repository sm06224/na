/* ============================================================
   studio のエディタ — Mermaid を書き、その場で図にし、グリグリ動かす。
   構文ハイライト・行番号・リアルタイム検証（エラー下線＋一覧）・オートコンプリート、
   ズーム/パン/フィット、スナップ付きドラッグ、サンプル、各種エクスポート（DSL/.mmd/SVG/単一HTML）。
   描画の核（parse/layout/serialize/draw）は依存ゼロ・決定的。ここはそれを操る手。
   ============================================================ */
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';
import { addDays } from '../engine/date.js';
import { csvToMermaid, universal } from '../engine/import.js';
import { toDrawio } from '../engine/drawio.js';
import { diffModels } from '../engine/diff.js';
import { GEO_LAYERS, geoProject, geoUnproject } from '../engine/geo.js';
import { MEGA_DSL } from '../engine/mega.js';
import { ledgerDevices, ledgerIpam, ledgerCsv } from '../engine/ledger.js';
import { splitInfra, mergeInfra, zipStore } from '../engine/fileset.js';

const escHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export const SAMPLES = {
  'ガント — 製品リリース計画': `gantt
    title 製品リリース計画
    dateFormat YYYY-MM-DD
    section 設計
      要件定義   :done, req, 2026-07-01, 5d
      基本設計   :active, design, after req, 7d
    section 実装
      API 実装   :api, after design, 10d
      UI 実装    :ui, after design, 12d
      基盤構築   :crit, infra, 2026-07-08, 9d
    section 検証と出荷
      結合テスト :test, after api ui, 6d
      受け入れ   :uat, after test, 4d
      出荷       :milestone, ship, after uat, 0d
%% @layout
%% today 2026-07-16`,
  'フロー — サービス構成図': `flowchart TD
    web[Web フロント] --> gw(API ゲートウェイ)
    mobile([モバイル]) --> gw
    gw -->|認証| auth{認証OK?}
    gw --> order[注文サービス]
    gw --> cat[カタログ]
    order --> pay[決済]
    order --> db[(主データベース)]
    cat --> cache((キャッシュ))
    auth --> db
    subgraph クライアント
      web
      mobile
    end
    subgraph データ基盤
      db
      cache
    end`,
  'フロー — 状態遷移': `flowchart LR
    s([開始]) --> a[下書き]
    a -->|提出| b{レビュー}
    b -->|承認| c[公開]
    b -->|差戻し| a
    c --> e([終了])`,
  'シーケンス — 認証フロー': `sequenceDiagram
    autonumber
    participant u as 利用者
    participant w as Web
    participant a as 認証サービス
    participant d as DB
    u->>w: ログイン要求
    w->>a: 資格情報を検証
    a->>d: 利用者を照会
    d-->>a: レコード
    alt 検証OK
      a-->>w: トークン発行
      w-->>u: ようこそ
    else 失敗
      a--xw: 拒否
      w-->>u: エラー表示
    end
    Note over u,w: 3回失敗でロック`,
  'インフラ — 工場 IT/OT 統合': `infra
    title 工場ネットワーク（IT/OT 統合）
    zone 本社 IT {
      core[CORE-SW] :core, NX-OS
      erp[ERP] :server, RHEL9, 10.0.10.21
      db1[基幹DB] :db, Oracle19c, 10.0.10.31
    }
    zone DMZ {
      fw1[FW-IT/OT] :firewall, FortiOS
      diode[データダイオード] :diode
      hist2[Historianミラー] :historian, Win2022
    }
    zone 工場 OT {
      zone 中央監視室 {
        scada[SCADA] :scada, Win2019, 192.168.100.10
        hmi1[HMI-1] :hmi
        ews[エンジニアリングWS] :ews, Win10
      }
      zone ライン1 {
        plc1[PLC-L1] :plc, vlan 110
        drv1[インバータ群] :drive
        sen1[温度センサ群] :sensor
      }
      hist[Historian] :historian, 192.168.100.20
    }
    bus itlan[情報LAN] :h, vlan 10, 10.0.10.0/24
    bus ctl[制御LAN] :h, vlan 100, 192.168.100.0/24
    fence f1[保守分界（当社/ベンダー保守）] :v
    core -- itlan :幹線
    erp -- itlan
    db1 -- itlan
    fw1 -- itlan
    fw1 -- diode
    diode -- hist2 :一方向
    scada -- ctl :冗長
    hmi1 -- ctl
    ews -- ctl
    plc1 -- ctl :冗長, vlan 100
    hist -- ctl
    plc1 -- drv1
    plc1 -- sen1
    hist2 -- hist :ミラー`,
  '広域 — ハブ＆スポーク（🗺 地図モード）': `infra
    title 広域網 — ハブ＆スポーク
    zone 本社 {
      core[CORE] :core
      dc1[基幹サーバ群] :server
    }
    hub wan[広域WAN] :vlan 1, 172.31.0.0/16
    sap[札幌支店] :access
    sen[仙台支店] :access
    nag[名古屋支店] :access
    osa[大阪支社] :access
    hir[広島支店] :access
    fuk[福岡支店] :access
    oki[沖縄支店] :access
    kan[金沢支店] :access
    sap -- wan :IP-VPN
    sen -- wan :IP-VPN
    nag -- wan :IP-VPN
    osa -- wan :冗長, 専用線
    hir -- wan :IP-VPN
    fuk -- wan :冗長, 専用線
    oki -- wan :IP-VPN
    kan -- wan :IP-VPN
    core -- wan :冗長, 幹線
    dc1 -- core

%% @layout
%% lod
%% zpos 本社|157|374`,
  '配線の意味 — 冗長種別・関係線・両端IP・レイヤ': `infra
    title 配線の意味 — 冗長・関係・インタフェース
    zone 東京 {
      core1[CORE-1] :core, NX-OS
      core2[CORE-2] :core, NX-OS
      db1[DB-1] :db, RHEL9, 10.1.1.6, 10.99.0.6
      mon[監視] :server, Zabbix, 10.1.1.6
      bus lan1[基幹] :vlan 10, 10.1.1.0/24
    }
    zone 大阪 {
      dbdr[DB-DR] :db, RHEL9, 10.2.1.6, 10.99.0.7
      bus lan2[基幹DR] :vlan 20, 10.2.1.0/24
    }
    fw1[FW-1] :firewall, FortiOS, layer 待機系
    core1 -- core2 :stack
    core1 -- lan1
    core2 -- lan1
    db1 -- lan1
    mon -- lan1
    dbdr -- lan2
    core1 -- fw1 :vrrp
    core1 -- dbdr :lacp, 10.1.1.1 > 10.2.1.254, 拠点間L2延伸
    db1 -- dbdr :rep, 10.99.0.6 > 10.99.0.7, 非同期

%% @layout
%% pos core1 48 72
%% pos core2 320 72
%% pos db1 48 248
%% pos mon 320 248
%% pos fw1 656 24
%% pos dbdr 720 424`,
  '全国 — メガコーポ 1000 ノード（🗾 地理×BCP）': MEGA_DSL,
  '巨大 — 全社グランドビュー（IT/OT/クラウド/拠点）': `infra
    title 全社グランドビュー — IT / OT / クラウド / 拠点
    zone 東京本社 {
      zone DC-East {
        zone コアネットワーク {
          core1[CORE-SW1] :core, NX-OS
          core2[CORE-SW2] :core, NX-OS
          fwc1[FW-C1] :firewall, FortiOS
          fwc2[FW-C2] :firewall, FortiOS
          wanrt[WAN-RT] :router, IOS-XE
        }
        zone サーバファーム {
          ad1[AD/DNS] :server, Win2022, 10.0.10.11
          erp[ERP] :server, RHEL9, 10.0.10.21
          crm[CRM] :server, RHEL9, 10.0.10.22
          mail[メール] :server, 10.0.10.23
          vmw[仮想基盤] :server, ESXi8
          db1[基幹DB-1] :db, Oracle19c, 10.0.10.31
          db2[基幹DB-2] :db, Oracle19c, 10.0.10.32
          san[SAN] :storage, 10.0.10.41
          bkp[バックアップ] :storage, 10.0.10.42
        }
        zone DMZ {
          fwd[FW-DMZ] :firewall
          px[プロキシ] :lb
          web[公開Web] :server, 192.168.1.10
          mx[メールGW] :server, 192.168.1.20
        }
      }
      zone 執務エリア {
        zone 7F 開発部 {
          sw7[SW-7F] :access, vlan 70
          pc7[開発PC x60] :pc, Win11
          ap7[AP-7F] :ap, vlan 97
        }
        zone 8F 管理部 {
          sw8[SW-8F] :access, vlan 80
          pc8[管理PC x25] :pc, Win11
          prn8[複合機] :printer
        }
      }
    }
    zone 大阪DR {
      cored[CORE-DR] :core, NX-OS
      dbdr[待機DB] :db, Oracle19c, 172.16.10.31
      sandr[SAN-DR] :storage
      vmdr[仮想基盤DR] :server, ESXi8
    }
    zone クラウド {
      vpc[AWS VPC] :cloud
      saas[SaaS 群] :cloud
      idp[IDaaS] :cloud
    }
    zone 名古屋工場 {
      otfw[FW-OT] :firewall, FortiOS
      diode[データダイオード] :diode
      zone 中央監視室 {
        scada[SCADA] :scada, Win2019, 192.168.100.10
        hmi1[HMI-1] :hmi
        ews[エンジニアリングWS] :ews, Win10
        hist[Historian] :historian, 192.168.100.20
      }
      zone ライン1 {
        plc1[PLC-L1] :plc, vlan 110
        drv1[インバータ群] :drive
        sen1[温度センサ群] :sensor
      }
      zone ライン2 {
        plc2[PLC-L2] :plc, vlan 120
        rob2[溶接ロボット] :robot
        cnc2[CNC 群] :cnc
      }
      zone 安全計装 {
        sis1[SIS] :sis
      }
    }
    zone 福岡支社 {
      swf[SW-FUK] :access
      pcf[支社PC x15] :pc, Win11
      apf[AP-FUK] :ap
    }
    inet[インターネット] :cloud
    bus wan[広域WAN] :h, 172.31.0.0/16
    bus itlan[基幹LAN] :h, vlan 10, 10.0.10.0/24
    bus dmzn[DMZセグメント] :h, vlan 20, 192.168.1.0/24
    bus ctl[制御LAN] :h, vlan 100, 192.168.100.0/24
    fence fitot[保守分界（情シス/制御ベンダー）] :v
    fence fcloud[責任分界（自社/クラウド事業者）] :v
    core1 -- itlan :冗長, 幹線
    core2 -- itlan :冗長, 幹線
    core1 -- core2 :冗長, スタック
    fwc1 -- wanrt
    fwc2 -- wanrt :予備
    wanrt -- wan :専用線
    ad1 -- itlan
    erp -- itlan
    crm -- itlan
    mail -- itlan
    vmw -- itlan
    db1 -- itlan
    db2 -- itlan
    db1 -- db2 :冗長, RAC
    san -- bkp :バックアップ
    fwd -- dmzn
    px -- dmzn
    web -- dmzn
    mx -- dmzn
    fwc1 -- fwd
    fwd -- inet
    sw7 -- core1
    sw8 -- core1 :予備
    ap7 -- sw7
    cored -- wan :専用線
    db1 -- dbdr :一方向, レプリケーション
    san -- sandr :ミラー
    wanrt -- vpc :IPsec-VPN
    idp -- saas :SSO
    swf -- wan :IP-VPN
    otfw -- wan :IP-VPN
    otfw -- diode
    diode -- hist :一方向
    scada -- ctl :冗長
    hmi1 -- ctl
    ews -- ctl
    hist -- ctl
    plc1 -- ctl :冗長, vlan 100
    plc2 -- ctl :vlan 100
    plc1 -- drv1
    plc1 -- sen1
    plc2 -- rob2
    plc2 -- cnc2
    sis1 -- plc1 :安全連動`,
  'クラス — ドメインモデル': `classDiagram
    class Animal {
      +String name
      +int age
      +speak() string
    }
    class Dog {
      +fetch() void
    }
    class Cat
    class Owner {
      +String name
      +feed(a) void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Owner --> Animal : 飼う
    Dog ..> Owner : なつく`,
};

const MODULES = ['engine/date.js', 'engine/parse.js', 'engine/layout.js', 'engine/serialize.js', 'engine/import.js', 'engine/geo.js', 'engine/infra.js', 'engine/drawio.js', 'engine/diff.js', 'engine/ledger.js', 'engine/fileset.js', 'engine/mega.js', 'render/draw.js', 'ui/editor.js'];

// ---- 構文ハイライト --------------------------------------------------------
const HL = /(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|\.\.>|<\.\.|<--|-->>|->>|-->|---|-\.->|-\.-|==>|===|--o|--x|-x|--\)|-\))|(\|[^|]*\|)|\b(gantt|flowchart|graph|sequenceDiagram|classDiagram|infra|zone|bus|hub|fence|class|participant|actor|autonumber|Note|note|over|title|dateFormat|axisFormat|section|subgraph|end|direction|after|loop|alt|opt|par|else)\b|\b(done|active|crit|milestone)\b|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|\b(\d+(?:\.\d+)?[dwh])\b/g;
function hlLine(line) {
  if (line.trimStart().startsWith('%%')) return `<span class="tk-com">${escHtml(line)}</span>`;
  let out = '', last = 0, m; HL.lastIndex = 0;
  while ((m = HL.exec(line))) {
    out += escHtml(line.slice(last, m.index));
    const cls = (m[1] || m[2]) ? 'tk-arrow' : m[3] ? 'tk-kw' : m[4] ? 'tk-tag' : 'tk-date';
    out += `<span class="${cls}">${escHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escHtml(line.slice(last));
}

export function boot() {
  const $ = (id) => document.getElementById(id);
  const src = $('src'), hl = $('hl'), gutter = $('gutter'), canvas = $('canvas'), stage = $('stage');
  const status = $('status'), kindBadge = $('kind'), problems = $('problems'), ac = $('ac');
  let model = parse(''), L = null;
  const view = { tx: 0, ty: 0, s: 1 };

  // ---- 描画パイプライン ----
  function highlight() {
    const lines = src.value.split('\n');
    hl.innerHTML = lines.map(hlLine).join('\n') + '\n';
    gutter.innerHTML = lines.map((_, i) => `<div class="ln" data-ln="${i + 1}">${i + 1}</div>`).join('');
    syncScroll();
  }
  function syncScroll() { hl.parentElement.scrollTop = src.scrollTop; hl.parentElement.scrollLeft = src.scrollLeft; gutter.scrollTop = src.scrollTop; }

  // セマンティックズーム（%% lod）：地図アプリのように、引くほど要約される。
  //   ズーム < 0.55 … 全ゾーンが札に／ < 0.9 … 子ゾーンが札・機器のメタ省略／それ以上 … 全詳細
  // 畳みは描画時だけの重ね掛け（%% fold は書き換えない——ズームは意味ではない）。
  const bucketNow = () => (!model.meta.lod || model.kind !== 'infra') ? 2 : view.s < 0.55 ? 0 : view.s < 0.9 ? 1 : 2;
  let lodBucket = 2;
  function lodFolds() {
    const b = bucketNow();
    if (b === 2) return null;
    const depth = (g) => { let d = 0, p = g.parent; while (p) { d++; p = model.groups.find((x) => x.name === p)?.parent; } return d; };
    return model.groups.filter((g) => depth(g) >= b).map((g) => g.name);
  }
  function layoutEff() {
    const lf = lodFolds();
    if (!lf || !lf.length) return layout(model);
    const saved = model.layout.fold;
    model.layout.fold = [...new Set([...(saved || []), ...lf])];
    const L2 = layout(model);
    model.layout.fold = saved;
    return L2;
  }
  const drawOpts = () => ({ selected, sketch: model.meta.style === 'sketch',
    theme: model.meta.theme || 'dark',
    hops: !!model.meta.hops, dots: !!model.meta.dots,
    detail: bucketNow() === 2,
    bg: model.meta.bg || (model.meta.theme === 'light' ? '#ffffff' : null) });
  function render() {
    model = parse(src.value);
    L = layoutEff();
    lodBucket = bucketNow();
    for (const id of [...selected]) if (!model.items.some((x) => x.id === id)) selected.delete(id);
    paint(draw(model, L, drawOpts()));
    document.body.classList.toggle('light', model.meta.theme === 'light');
    refreshDiff();
    syncAlignBar();
    applyView();
    if (!$('toc').hidden) buildToc();
    if (!$('mapPanel').hidden) buildMap();
    syncToolbar();
    kindBadge.textContent = model.kind || '—';
    const probs = [...model.errors.map((e) => ({ e, where: 'parse' })), ...(L.errors || []).map((e) => ({ e, where: 'layout' }))];
    const badLines = new Set();
    problems.innerHTML = probs.map(({ e }) => {
      const m = /^L(\d+)/.exec(e); if (m) badLines.add(+m[1]);
      return `<div class="p"${m ? ` data-ln="${m[1]}"` : ''}>${m ? `<span class="ln">L${m[1]}</span>` : '<span class="ln">•</span>'}<span>${escHtml(e.replace(/^L\d+:\s*/, ''))}</span></div>`;
    }).join('');
    for (const el of gutter.children) el.classList.toggle('bad', badLines.has(+el.dataset.ln));
    status.textContent = probs.length ? `${probs.length} 件の指摘` : (model.kind ? `${model.kind} ・ ${model.items.length} 項目 ・ OK` : '空です');
    status.dataset.bad = probs.length ? '1' : '';
    refreshIns();
  }

  // ---- ビュー（ズーム・パン・フィット） ----
  function applyView() {
    canvas.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`;
    $('zLabel').textContent = Math.round(view.s * 100) + '%';
    syncTiles();
  }

  // ---- 実地図タイル（%% tiles）：Leaflet と同じスリッピーマップの心臓部だけを自前で。 ----
  // 投影は %% geo と同じ Web メルカトルなので OSM タイルがぴったり重なる。オンライン時だけ効き、
  // オフラインの単一 HTML では静かに何も出ない（自前ベースマップが残る）。書き出しには写らない。
  const tilesDiv = document.createElement('div');
  tilesDiv.id = 'tiles';
  tilesDiv.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;z-index:0';
  stage.insertBefore(tilesDiv, canvas);
  const osmCredit = document.createElement('div');
  osmCredit.id = 'osmCredit';
  osmCredit.textContent = '© OpenStreetMap contributors';
  osmCredit.style.cssText = 'position:absolute;left:8px;bottom:8px;font-size:10px;color:#8a93a6;background:#0008;padding:1px 6px;border-radius:6px;z-index:5;display:none';
  stage.appendChild(osmCredit);
  // タイル取得失敗バナー：オフライン/プロキシで地図画像が来ないとき、黙って真っ暗にせず理由を出す。
  const tileWarn = document.createElement('div');
  tileWarn.id = 'tileWarn'; tileWarn.hidden = true;
  tileWarn.innerHTML = '<span>🌐 地図タイルを取得できません（オフライン／ネットワーク制限）。構成図はそのまま表示中です。</span><button title="閉じる">✕</button>';
  stage.appendChild(tileWarn);
  let tileWarnDismissed = false;
  tileWarn.querySelector('button').onclick = () => { tileWarn.hidden = true; tileWarnDismissed = true; };
  const showTileWarn = () => { if (!tileWarnDismissed) tileWarn.hidden = false; };
  const hideTileWarn = () => { tileWarn.hidden = true; };
  const tileCache = new Map();                                 // "z/x/y" → img
  function syncTiles() {
    const on = !!(model && model.meta && model.meta.tiles && model.meta.map && model.kind === 'infra' && L);
    osmCredit.style.display = on ? '' : 'none';
    if (!on) { tilesDiv.innerHTML = ''; tileCache.clear(); return; }
    tilesDiv.style.transform = canvas.style.transform;
    tilesDiv.classList.toggle('darkmap', model.meta.theme !== 'light');
    if (syncTiles._x0 !== (L.x0 || 0) || syncTiles._y0 !== (L.y0 || 0)) {   // 原点が動いたら貼り直し
      tilesDiv.innerHTML = ''; tileCache.clear();
      syncTiles._x0 = L.x0 || 0; syncTiles._y0 = L.y0 || 0;
    }
    const w360 = geoProject(0, 122 + 360)[0] - geoProject(0, 122)[0];        // 360° のワールド幅
    const z = Math.max(3, Math.min(12, Math.round(Math.log2((view.s * w360) / 256))));
    const n = 2 ** z;
    const r = stage.getBoundingClientRect();
    const [wx0, wy0] = toWorld(r.left, r.top), [wx1, wy1] = toWorld(r.right, r.bottom);
    const t4 = (lat, lng) => [Math.floor(((lng + 180) / 360) * n),
      Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n)];
    const [latNW, lngNW] = geoUnproject(wx0, wy0), [latSE, lngSE] = geoUnproject(wx1, wy1);
    const [txA, tyA] = t4(latNW, lngNW), [txB, tyB] = t4(latSE, lngSE);
    const want = new Set();
    let count = 0;
    for (let ty = Math.max(0, tyA); ty <= Math.min(n - 1, tyB) && count < 80; ty++)
      for (let tx = Math.max(0, txA); tx <= Math.min(n - 1, txB) && count < 80; tx++, count++) {
        const key = `${z}/${tx}/${ty}`;
        want.add(key);
        if (tileCache.has(key)) continue;
        const latN = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
        const latS = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n))) * 180) / Math.PI;
        const lngW = (tx / n) * 360 - 180, lngE = ((tx + 1) / n) * 360 - 180;
        const [px0, py0] = geoProject(latN, lngW), [px1, py1] = geoProject(latS, lngE);
        const img = document.createElement('img');
        img.src = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
        img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
        img.style.cssText = `position:absolute;left:${px0 - (L.x0 || 0)}px;top:${py0 - (L.y0 || 0)}px;width:${px1 - px0 + 0.6}px;height:${py1 - py0 + 0.6}px;opacity:.85`;
        img.onerror = () => img.remove();                     // オフラインなら静かに諦める
        tilesDiv.appendChild(img);
        tileCache.set(key, img);
      }
    for (const [key, img] of tileCache) if (!want.has(key)) { img.remove(); tileCache.delete(key); }
  }

  // ---- Leaflet（v15）：地図モードの心臓。リミッター解除——本物のスリッピーマップに
  // SVG 構成図を L.svgOverlay で貼る。投影が同じ Web メルカトルなので無変換でぴったり。
  // ベースマップは OSM / 国土地理院（淡色・写真）、実ハザードはハザードマップポータルのタイル。
  // Leaflet が無い/読めない環境では従来の自前ビューポートに静かにフォールバックする。
  const LF = (typeof window !== 'undefined' && window.L) || null;
  const BASEMAPS = {
    osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors', max: 19 },
    gsi: { url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', attr: '国土地理院（淡色地図）', max: 18 },
    photo: { url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', attr: '国土地理院（全国最新写真）', max: 18 },
  };
  const BASEMAP_JA = { none: 'なし（自前アウトライン）', osm: 'OSM 標準', gsi: '地理院 淡色', photo: '地理院 写真' };
  const HAZARD_TILE_DEFS = {
    flood: { url: 'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png', label: '洪水浸水想定（想定最大）' },
    tsunami: { url: 'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png', label: '津波浸水想定' },
    takashio: { url: 'https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png', label: '高潮浸水想定' },
    dosha: { url: 'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png', label: '土砂災害警戒（土石流）' },
  };
  let lmap = null, lsvg = null, lBase = null;
  const lHz = new Map();
  const lmapDiv = document.createElement('div');
  lmapDiv.id = 'lmap';
  lmapDiv.style.cssText = 'position:absolute;inset:0;display:none;z-index:0;background:transparent';
  stage.insertBefore(lmapDiv, tilesDiv);
  const basemapOf = () => model.meta.basemap || (model.meta.tiles ? 'osm' : 'none');
  const leafletWanted = () => !!(LF && model && model.kind === 'infra' && model.meta.map);
  const effS = () => lmap ? (256 * 2 ** lmap.getZoom()) / 144000 : view.s;
  const sToZ = (s) => Math.log2((s * 144000) / 256);
  const overlayBounds = () => {
    const [aLat, aLng] = geoUnproject(L.x0 || 0, L.y0 || 0);
    const [bLat, bLng] = geoUnproject((L.x0 || 0) + L.width, (L.y0 || 0) + L.height);
    return LF.latLngBounds([[aLat, aLng], [bLat, bLng]]);
  };
  function enterLeaflet() {
    if (lmap) return;
    lmapDiv.style.display = '';
    canvas.style.display = 'none';
    tilesDiv.style.display = 'none'; osmCredit.style.display = 'none';
    lmap = LF.map(lmapDiv, { zoomControl: false, attributionControl: true,
      zoomSnap: 0, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, maxZoom: 19, minZoom: 3 });
    lmap.setView([36.2, 137.5], 6);
    if (typeof window !== 'undefined') window.__lmap = lmap;   // ヘッドレス検証用
    lmap.on('zoom move', () => { view.s = effS(); $('zLabel').textContent = Math.round(view.s * 100) + '%'; });
    lmap.on('zoomend', () => {
      view.s = effS();
      if (bucketNow() !== lodBucket) { lodBucket = bucketNow(); redraw(); }   // 地図と同じ：引けば要約
    });
    lmap.on('click', () => { if (selected.size) { selected.clear(); redraw(); syncAlignBar(); } hidePop(); });
    enterLeaflet._fitted = false;
    if (!enterLeaflet._coached) {                             // 初回だけ、地図操作の在り処を教える
      enterLeaflet._coached = true;
      setTimeout(() => toast('🗺 右下「地図」ボタンで、ベースマップ（地理院/OSM）とハザードを切り替えられます'), 500);
    }
  }
  function exitLeaflet() {
    if (!lmap) return;
    lmap.remove(); lmap = null; lsvg = null; lBase = null; lHz.clear();
    lmapDiv.style.display = 'none';
    canvas.style.display = '';
  }
  function paintLeaflet(svgStr) {
    const tpl = document.createElement('div');
    tpl.innerHTML = svgStr;
    const el = tpl.firstElementChild;
    el.removeAttribute('width'); el.removeAttribute('height');
    el.setAttribute('preserveAspectRatio', 'none');
    el.style.pointerEvents = 'auto';
    if (lsvg) lsvg.remove();
    lsvg = LF.svgOverlay(el, overlayBounds(), { interactive: true }).addTo(lmap);
    if (!enterLeaflet._fitted) { enterLeaflet._fitted = true; lmap.fitBounds(overlayBounds(), { padding: [20, 20] }); }
    view.s = effS();
  }
  function syncLeafletLayers() {
    if (!lmap) return;
    const wantB = basemapOf() + '|' + (model.meta.theme || 'dark');
    if (syncLeafletLayers._bm !== wantB) {
      if (lBase) { lBase.remove(); lBase = null; }
      const bm = BASEMAPS[basemapOf()];
      hideTileWarn(); tileWarnDismissed = false;              // ベースマップを替えたら判定やり直し
      if (bm) { lBase = LF.tileLayer(bm.url, { attribution: bm.attr, maxZoom: bm.max,
        className: model.meta.theme !== 'light' ? 'darktiles' : '' }); watchTiles(lBase); lBase.addTo(lmap); }
      syncLeafletLayers._bm = wantB;
    }
    const hz = new Set(model.meta.hazardTiles || []);
    for (const [k, layer] of lHz) if (!hz.has(k)) { layer.remove(); lHz.delete(k); }
    for (const k of hz) if (!lHz.has(k) && HAZARD_TILE_DEFS[k]) {
      const layer = LF.tileLayer(HAZARD_TILE_DEFS[k].url, { opacity: 0.55, maxZoom: 17, attribution: 'ハザードマップポータルサイト' });
      watchTiles(layer); layer.addTo(lmap); lHz.set(k, layer);
    }
  }
  // タイルが 1 枚でも来れば成功（バナー消す）。全滅（error のみ）なら理由バナーを出す。
  function watchTiles(layer) {
    layer.on('tileload', hideTileWarn);
    layer.on('tileerror', showTileWarn);
  }
  // 描き込み口はひとつ：地図モードなら Leaflet のオーバレイへ、それ以外は従来どおり。
  function paint(svgStr) {
    if (leafletWanted()) { enterLeaflet(); paintLeaflet(svgStr); syncLeafletLayers(); }
    else { exitLeaflet(); canvas.innerHTML = svgStr; }
  }
  function fit() {
    if (!L) return;
    if (lmap && leafletWanted()) { lmap.fitBounds(overlayBounds(), { padding: [24, 24] }); return; }
    const r = stage.getBoundingClientRect(), pad = 40;
    view.s = Math.max(0.04, Math.min(2, Math.min((r.width - pad) / L.width, (r.height - pad) / L.height)));
    view.tx = (r.width - L.width * view.s) / 2; view.ty = Math.max(16, (r.height - L.height * view.s) / 2);
    applyView();
    if (bucketNow() !== lodBucket) { lodBucket = bucketNow(); redraw(); }
  }
  function zoomTo(cx, cy, ns) {
    const r = stage.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    ns = Math.max(0.04, Math.min(4, ns));
    if (lmap && leafletWanted()) { lmap.setZoomAround(LF.point(x, y), sToZ(ns)); return; }
    view.tx = x - (x - view.tx) * (ns / view.s); view.ty = y - (y - view.ty) * (ns / view.s); view.s = ns; applyView();
    if (bucketNow() !== lodBucket) { lodBucket = bucketNow(); redraw(); }   // 地図のように要約⇄詳細
  }
  const zoomAt = (cx, cy, factor) => zoomTo(cx, cy, view.s * factor);
  stage.addEventListener('wheel', (e) => { if (lmap && leafletWanted()) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  $('zIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); };
  $('zOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); };
  $('zFit').onclick = fit;

  // ---- ポインタ（選択・ドラッグ・接続・パン・ピンチ・ダブルタップ）----
  const selected = new Set();
  let drag = null, pan = null, connect = null, pinch = null;
  const pointers = new Map();
  let lastTap = { t: 0, x: 0, y: 0 };

  function toWorld(cx, cy) {
    const r = stage.getBoundingClientRect();
    if (lmap && leafletWanted()) {
      const ll = lmap.containerPointToLatLng(LF.point(cx - r.left, cy - r.top));
      return geoProject(ll.lat, ll.lng);
    }
    return [(cx - r.left - view.tx) / view.s + (L?.x0 || 0), (cy - r.top - view.ty) / view.s + (L?.y0 || 0)];
  }
  const capture = (e) => { try { stage.setPointerCapture(e.pointerId); } catch (_) { /* 合成イベントは掴めなくてよい */ } };
  // ドラッグ対象の現在位置：機器だけでなくバス・フェンスも（v9 まではバスを掴むと落ちていた）。
  function posOf(id) {
    const n = (L.nodes || []).find((x) => x.id === id); if (n) return [n.x, n.y];
    const b = (L.buses || []).find((x) => x.id === id); if (b) return b.orient === 'v' ? [b.x, b.y1] : [b.x1, b.y];
    const f = (L.fences || []).find((x) => x.id === id); if (f) return f.orient === 'h' ? [f.x1, f.y] : [f.x, f.y1];
    return null;
  }
  // ゾーン配下（子ゾーン含む）の見えている機器 id。ゾーンごとドラッグに使う。
  function zoneMembers(name) {
    const under = new Set([name]);
    let grew = true;
    while (grew) { grew = false; for (const g2 of model.groups) if (g2.parent && under.has(g2.parent) && !under.has(g2.name)) { under.add(g2.name); grew = true; } }
    return (L.nodes || []).filter((n) => n.zone && under.has(n.zone)).map((n) => n.id);
  }
  function redraw() {
    const keep = { ...view };
    paint(draw(model, L = layoutEff(), drawOpts()));
    refreshDiff();
    Object.assign(view, keep); applyView();
  }
  // ポトペタで意味部を書き換えたら、DSL に反映して履歴へ。
  function commitModel() { src.value = serialize(model); highlight(); render(); pushHistory(); }

  function tempLine(x1, y1, x2, y2) {
    const svg = canvas.querySelector('svg'); if (!svg) return;
    let l = svg.querySelector('#tmpedge');
    if (!l) {
      l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.id = 'tmpedge';
      l.setAttribute('stroke', '#6aa9ff'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-dasharray', '5 4');
      l.setAttribute('pointer-events', 'none');              // 落とし先の判定を邪魔しない
      svg.appendChild(l);
    }
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  }
  const removeTempLine = () => canvas.querySelector('#tmpedge')?.remove();

  stage.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {                               // 二本指＝ピンチ。進行中の操作は畳む。
      drag = null; pan = null; connect = null; removeTempLine(); stage.classList.remove('panning');
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s };
      capture(e); e.preventDefault(); return;
    }
    if (e.target.closest('[data-linkbtn]')) return;          // リンクは click に任せる（開くだけ）
    if (e.target.closest('[data-fold]')) return;             // ▾/▸ も click に任せる（preventDefault すると click が死ぬ）
    const now = performance.now();
    const isDouble = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24;
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (isDouble) { lastTap.t = 0; e.preventDefault(); onDoubleTap(e); return; }

    const c = e.target.closest('[data-connect]');
    if (c) { connect = { from: c.dataset.id }; capture(e); e.preventDefault(); return; }
    const g = e.target.closest('[data-drag]');
    if (g) {
      const id = g.dataset.id, kind = g.dataset.drag;
      if (kind === 'node') {
        const ids = (selected.has(id) && selected.size > 1) ? [...selected] : [id];
        const starts = new Map(ids.map((i2) => [i2, posOf(i2)]).filter(([, p2]) => p2));
        drag = { id, kind, ids: [...starts.keys()], starts, px: e.clientX, py: e.clientY, moved: false, shift: e.shiftKey };
      }
      else if (kind === 'zone') {
        if (g.dataset.folded) {                                // 畳んだ札は zpos で自由配置
          const z = L.zones.find((zz) => zz.name === id);
          drag = { id, kind: 'zfold', start: [z.x, z.y], px: e.clientX, py: e.clientY, moved: false };
        } else {                                               // 見出しをつかむと中の機器ごと動く
          const ids = zoneMembers(id);
          if (!ids.length) { if (lmap) return; pan = { tx: view.tx, ty: view.ty, px: e.clientX, py: e.clientY, moved: false }; stage.classList.add('panning'); capture(e); e.preventDefault(); return; }
          const starts = new Map(ids.map((i2) => [i2, posOf(i2)]).filter(([, p2]) => p2));
          drag = { id, kind: 'node', zone: true, ids: [...starts.keys()], starts, px: e.clientX, py: e.clientY, moved: false, shift: false };
        }
      }
      else if (kind === 'actor') {
        const as = L.actors, spacing = as.length > 1 ? (as[as.length - 1].cx - as[0].cx) / (as.length - 1) : 100;
        drag = { id, kind, order: as.map((a) => a.id), spacing, px: e.clientX, py: e.clientY, moved: false };
      }
      else { const b = L.bars.find((x) => x.id === id); drag = { id, kind, day0: b.startDay, order: L.bars.map((x) => x.id), px: e.clientX, py: e.clientY, moved: false }; }
    } else { if (lmap) return; pan = { tx: view.tx, ty: view.ty, px: e.clientX, py: e.clientY, moved: false }; stage.classList.add('panning'); }
    if (lmap && drag) lmap.dragging.disable();               // 機器をつかんだら地図は止める
    capture(e); e.preventDefault();
  });

  stage.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        zoomTo((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s0 * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d0);
      }
      return;
    }
    if (connect) {
      const n = L.nodes.find((x) => x.id === connect.from); if (!n) return;
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      tempLine(n.x + n.w + 14, n.y + n.h / 2, wx, wy);
      return;
    }
    if (drag) {
      const dxp = e.clientX - drag.px, dyp = e.clientY - drag.py;
      if (!drag.moved && Math.abs(dxp) + Math.abs(dyp) < 5) return;   // 数ピクセルはクリック扱い
      drag.moved = true;
      const dx = dxp / view.s, dy = dyp / view.s;
      if (drag.kind === 'node') {
        const snap = (v) => Math.round(v / 8) * 8;
        for (const [i2, [x0, y0]] of drag.starts) model.layout.pos[i2] = [snap(x0 + dx), snap(y0 + dy)];
      } else if (drag.kind === 'actor') {
        const steps = Math.round(dx / drag.spacing);
        const o = drag.order.slice(), f = o.indexOf(drag.id);
        o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]);
        model.layout.order = o;
      } else if (drag.kind === 'zfold') {
        const snap = (v) => Math.round(v / 8) * 8;
        model.layout.zpos = model.layout.zpos || {};
        model.layout.zpos[drag.id] = [snap(drag.start[0] + dx), snap(drag.start[1] + dy)];
      } else {
        model.layout.at[drag.id] = addDays(L.base, drag.day0 + Math.round(dx / L.dayW));
        const steps = Math.round(dy / L.rowH);
        if (steps) { const o = drag.order.slice(), f = o.indexOf(drag.id); o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]); model.layout.order = o; }
      }
      redraw();
    } else if (pan) {
      if (Math.abs(e.clientX - pan.px) + Math.abs(e.clientY - pan.py) > 3) pan.moved = true;
      view.tx = pan.tx + (e.clientX - pan.px); view.ty = pan.ty + (e.clientY - pan.py); applyView();
    }
  });

  function endPointer(e) {
    if (e) pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (connect) {
      const el = e && document.elementFromPoint(e.clientX, e.clientY);
      const tgt = el && el.closest && el.closest('[data-drag="node"]');
      removeTempLine();
      if (tgt && tgt.dataset.id !== connect.from) {
        if (model.edges.some((x) => x.from === connect.from && x.to === tgt.dataset.id)) toast('もうつながっています');
        else {
          if (model.kind === 'class') model.edges.push({ from: connect.from, to: tgt.dataset.id, kind: 'assoc', dotted: false, label: '' });
          else model.edges.push({ from: connect.from, to: tgt.dataset.id, label: '', dotted: false, thick: false, arrow: true });
          selected.clear(); commitModel(); toast('つなぎました'); return;
        }
      }
      connect = null; selected.clear(); redraw(); syncAlignBar(); return;
    }
    if (drag) {
      if (drag.moved) { src.value = serialize(model); highlight(); render(); pushHistory(); }
      else if (drag.kind === 'node' && !drag.zone) {                          // クリック＝選択（Shift で追加/除外）
        if (drag.shift) { selected.has(drag.id) ? selected.delete(drag.id) : selected.add(drag.id); }
        else if (selected.size === 1 && selected.has(drag.id)) selected.clear();
        else { selected.clear(); selected.add(drag.id); }
        redraw(); syncAlignBar();
        // シンボル → コード：単独選択でディテールをポップアップし、エディタも該当行へ。
        if (!drag.shift && selected.size === 1 && selected.has(drag.id)) { showPop(drag.id); jumpToLine(drag.id); }
        else hidePop();
      }
    } else if (pan && !pan.moved && selected.size) { selected.clear(); redraw(); syncAlignBar(); hidePop(); }       // 空クリック＝選択解除
    if (lmap) lmap.dragging.enable();
    drag = null; pan = null; connect = null; stage.classList.remove('panning');
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // ---- ハイパーリンク（↗ バッジ）＋ゾーン折りたたみ（▾/▸）----
  canvas.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-linkbtn]');
    if (lb) { e.preventDefault(); window.open(lb.dataset.url, '_blank', 'noopener'); return; }
    const fd = e.target.closest('[data-fold]');
    if (fd) {
      const name = fd.dataset.fold;
      const fold = new Set(model.layout.fold || []);
      fold.has(name) ? fold.delete(name) : fold.add(name);
      model.layout.fold = [...fold];
      commitModel();
      toast(fold.has(name) ? `「${name}」を畳みました` : `「${name}」を開きました`);
    }
  });

  // ---- ポトペタ：ダブルタップでリネーム／追加 ----
  function onDoubleTap(e) {
    const eg = e.target.closest('[data-edit]');
    if (eg && eg.dataset.edit === 'edge') { startRename('edge', +eg.dataset.i, eg); return; }
    const g = e.target.closest('[data-drag]');
    if (g) { startRename(g.dataset.drag, g.dataset.id, g); return; }
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (model.kind === 'flowchart') {                        // 空きに、新しいノードをその場へ
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      const id = 'n' + k;
      model.items.push({ type: 'node', id, label: '新しいノード', shape: 'rect' });
      model.order.push(id);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
      selected.clear(); selected.add(id); commitModel();
    } else if (model.kind === 'class') {
      let k = 1; while (model.items.some((n) => n.id === 'C' + k)) k++;
      const id = 'C' + k;
      model.items.push({ type: 'class', id, attrs: [], methods: [] });
      model.order.push(id);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
      selected.clear(); selected.add(id); commitModel();
    } else if (model.kind === 'infra') {
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      const id = 'n' + k;
      model.items.push({ type: 'inode', id, label: '新しい機器', role: null, os: null, ip: null, vlan: null, zone: null });
      model.order.push(id);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
      selected.clear(); selected.add(id); commitModel();
    } else if (model.kind === 'sequence') insert('\n    participant p{N} as 新しい人');
    else if (model.kind === 'gantt') insert('\n      新しいタスク :t{N}, after {last}, 3d');
  }

  const inline = $('inline');
  let renameCtx = null;
  function startRename(kind, ref, el) {
    const r = el.getBoundingClientRect();
    let value = kind === 'edge' ? (model.edges[ref]?.label ?? '')
      : (model.items.find((x) => x.id === ref)?.label ?? '');
    renameCtx = { kind, ref };
    inline.value = value;
    inline.style.left = Math.min(Math.max(6, r.left), window.innerWidth - 190) + 'px';
    inline.style.top = Math.max(6, r.top + r.height / 2 - 15) + 'px';
    inline.style.width = Math.max(130, Math.min(280, r.width + 40)) + 'px';
    inline.hidden = false; inline.focus(); inline.select();
  }
  function commitRename(ok) {
    if (!renameCtx) return;
    const { kind, ref } = renameCtx; renameCtx = null; inline.hidden = true;
    if (!ok) return;
    const v = inline.value.trim();
    if (kind === 'edge') { if (model.edges[ref] != null) model.edges[ref].label = v; }
    else if (model.kind === 'class') {                        // クラスは名前＝id なので、参照ごと改名する
      const nid = v.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
      const it = model.items.find((x) => x.id === ref);
      if (!it || !nid) return;
      if (nid !== ref && model.items.some((x) => x.id === nid)) { toast('その名前は使われています'); return; }
      it.id = nid;
      model.order = model.order.map((x) => (x === ref ? nid : x));
      for (const e2 of model.edges) { if (e2.from === ref) e2.from = nid; if (e2.to === ref) e2.to = nid; }
      if (model.layout.pos[ref]) { model.layout.pos[nid] = model.layout.pos[ref]; delete model.layout.pos[ref]; }
    }
    else { const it = model.items.find((x) => x.id === ref); if (it && v) it.label = v; else return; }
    commitModel();
  }
  inline.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(true); }
    else if (e.key === 'Escape') commitRename(false);
    e.stopPropagation();
  });
  inline.addEventListener('blur', () => commitRename(true));

  // ---- 整列（2 個以上選ぶと出る）----
  function syncAlignBar() {
    const bar = $('alignbar'); if (!bar) return;
    bar.hidden = !(selected.size >= 2 && (model.kind === 'flowchart' || model.kind === 'class' || model.kind === 'infra'));
  }
  $('alignbar').addEventListener('click', (e) => {
    const a = e.target.dataset.a; if (!a) return;
    const ns = [...selected].map((id) => L.nodes.find((n) => n.id === id)).filter(Boolean);
    if (ns.length < 2) return;
    if (a === 'left') { const x0 = Math.min(...ns.map((n) => n.x)); for (const n of ns) model.layout.pos[n.id] = [x0, n.y]; }
    else if (a === 'top') { const y0 = Math.min(...ns.map((n) => n.y)); for (const n of ns) model.layout.pos[n.id] = [n.x, y0]; }
    else if (a === 'hspread') {
      const so = [...ns].sort((p, q) => p.x - q.x);
      const step = (so[so.length - 1].x - so[0].x) / (so.length - 1);
      so.forEach((n, i) => { model.layout.pos[n.id] = [Math.round(so[0].x + i * step), n.y]; });
    } else if (a === 'vspread') {
      const so = [...ns].sort((p, q) => p.y - q.y);
      const step = (so[so.length - 1].y - so[0].y) / (so.length - 1);
      so.forEach((n, i) => { model.layout.pos[n.id] = [n.x, Math.round(so[0].y + i * step)]; });
    }
    commitModel(); toast('そろえました');
  });

  // ---- アンドゥ／リドゥ（ドラッグやスニペットで textarea を書き換えるので自前で持つ）----
  const history = { stack: [], idx: -1 };
  function pushHistory() {
    const v = src.value;
    if (history.stack[history.idx] === v) return;
    history.stack = history.stack.slice(0, history.idx + 1);
    history.stack.push(v);
    if (history.stack.length > 200) history.stack.shift();
    history.idx = history.stack.length - 1;
    if (typeof syncTT === 'function') syncTT();              // タイムトラベルのスライダも追随
  }
  function timeTravel(d) {
    const to = history.idx + d;
    if (to < 0 || to >= history.stack.length) return;
    history.idx = to; src.value = history.stack[to];
    highlight(); render(); hideAc();
  }

  // ---- 入力（編集 → 図）----
  let t; src.addEventListener('input', () => { highlight(); clearTimeout(t); t = setTimeout(() => { render(); pushHistory(); }, 140); autocomplete(); });
  src.addEventListener('scroll', syncScroll);
  src.addEventListener('keydown', onKey);

  // ---- オートコンプリート ----
  let acItems = [], acSel = 0, acWord = '';
  function wordBefore() { const p = src.selectionStart, left = src.value.slice(0, p); const m = /[A-Za-z0-9_]+$/.exec(left); return { word: m ? m[0] : '', start: m ? p - m[0].length : p, line: left.split('\n').pop() }; }
  function suggestions(ctx) {
    const kw = model.kind === 'gantt'
      ? ['title', 'dateFormat', 'section', 'done', 'active', 'crit', 'milestone', 'after']
      : model.kind === 'sequence'
        ? ['participant', 'autonumber', 'Note', 'loop', 'alt', 'opt', 'else', 'end', 'activate']
        : model.kind === 'class'
          ? ['classDiagram', 'class']
          : model.kind === 'infra'
            ? ['infra', 'zone', 'bus', 'vlan', 'core', 'access', 'switch', 'router', 'firewall', 'server', 'db', 'storage', 'pc', 'ap', 'cloud']
            : ['flowchart', 'graph', 'subgraph', 'end', 'direction'];
    const ids = model.items.map((n) => n.id);
    const pool = [];
    if (/after\s+[\w\s]*$/.test(ctx.line) && model.kind === 'gantt') for (const id of ids) pool.push({ k: id, d: 'task' });
    else if (/(-->|---|-\.->|==>)\s*\w*$/.test(ctx.line)) for (const id of ids) pool.push({ k: id, d: 'node' });
    else { for (const k of kw) pool.push({ k, d: 'keyword' }); for (const id of ids) pool.push({ k: id, d: 'id' }); }
    const w = ctx.word.toLowerCase();
    return pool.filter((o) => w ? o.k.toLowerCase().startsWith(w) && o.k.toLowerCase() !== w : true).slice(0, 8);
  }
  function autocomplete() {
    const ctx = wordBefore(); acWord = ctx.word;
    if (ctx.word.length < 1 && !/(after\s+|-->\s*|---\s*)$/.test(ctx.line)) return hideAc();
    acItems = suggestions(ctx); acSel = 0;
    if (!acItems.length) return hideAc();
    ac.innerHTML = acItems.map((o, i) => `<div class="opt${i === 0 ? ' sel' : ''}" data-i="${i}"><span class="k">${escHtml(o.k)}</span><span class="d">${o.d}</span></div>`).join('');
    placeAc(); ac.hidden = false;
  }
  function placeAc() {
    const cr = src.getBoundingClientRect(), lh = 20, padL = 12, padT = 12;
    const left = src.value.slice(0, src.selectionStart); const lines = left.split('\n');
    const col = lines[lines.length - 1].length, row = lines.length - 1;
    const cw = 7.8;
    ac.style.left = Math.min(cr.left + padL + col * cw - src.scrollLeft, cr.right - 180) + 'px';
    ac.style.top = (cr.top + padT + (row + 1) * lh - src.scrollTop + 4) + 'px';
  }
  function hideAc() { ac.hidden = true; acItems = []; }
  function acceptAc() {
    const o = acItems[acSel]; if (!o) return;
    const ctx = wordBefore(); const p = src.selectionStart;
    src.value = src.value.slice(0, ctx.start) + o.k + src.value.slice(p);
    const np = ctx.start + o.k.length; src.selectionStart = src.selectionEnd = np;
    hideAc(); highlight(); render();
  }
  ac.addEventListener('pointerdown', (e) => { const opt = e.target.closest('.opt'); if (opt) { acSel = +opt.dataset.i; acceptAc(); e.preventDefault(); } });
  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); timeTravel(e.shiftKey ? 1 : -1); return; }
      if (k === 'y') { e.preventDefault(); timeTravel(1); return; }
    }
    if (!ac.hidden && acItems.length) {
      if (e.key === 'ArrowDown') { acSel = (acSel + 1) % acItems.length; drawAc(); e.preventDefault(); return; }
      if (e.key === 'ArrowUp') { acSel = (acSel - 1 + acItems.length) % acItems.length; drawAc(); e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { acceptAc(); e.preventDefault(); return; }
      if (e.key === 'Escape') { hideAc(); return; }
    }
    if (e.key === 'Tab') { e.preventDefault(); const p = src.selectionStart; src.value = src.value.slice(0, p) + '  ' + src.value.slice(src.selectionEnd); src.selectionStart = src.selectionEnd = p + 2; highlight(); }
  }
  function drawAc() { for (const el of ac.children) el.classList.toggle('sel', +el.dataset.i === acSel); }

  // ---- 挿入（スニペット）----
  function snipsFor() {
    return model.kind === 'gantt'
      ? [['＋タスク', '\n      新しいタスク :t{N}, after {last}, 3d'], ['＋セクション', '\n    section 新しい区分'], ['＋マイルストン', '\n      節目 :milestone, m{N}, after {last}, 0d']]
      : model.kind === 'sequence'
        ? [['＋参加者', '\n    participant p{N} as 新しい人'], ['＋メッセージ', '\n    {last}->>p{N}: メッセージ'], ['＋ノート', '\n    Note over {last}: メモ'], ['＋ループ', '\n    loop 条件\n    end']]
        : model.kind === 'class'
          ? [['＋クラス', '\n    class C{N} {\n      +field\n    }'], ['＋継承', '\n    {last} <|-- C{N}'], ['＋関連', '\n    {last} --> C{N}']]
          : model.kind === 'infra'
            ? [['＋機器', '\n    n{N}[新しい機器] :server'], ['＋ゾーン', '\n    zone 新しいゾーン {\n    }'], ['＋バス', '\n    bus b{N}[新しいバス] :h, vlan 1'], ['＋ハブ', '\n    hub h{N}[集約ハブ]'], ['＋フェンス', '\n    fence f{N}[保守分界] :v'], ['＋接続', '\n    {last} -- n{N}']]
            : [['＋ノード', '\n    n{N}[新しいノード]'], ['＋エッジ', '\n    {last} --> n{N}'], ['＋グループ', '\n    subgraph 新グループ\n    end']];
  }
  function refreshIns() {
    const ins = $('insbar');
    const snips = snipsFor();
    ins.innerHTML = snips.map((s, i) => `<button data-i="${i}">${s[0]}</button>`).join('');
    for (const b of ins.children) b.onclick = () => insert(snips[+b.dataset.i][1]);
  }
  function insert(tpl) {
    const n = model.items.length + 1, last = model.items.length ? model.items[model.items.length - 1].id : 'x';
    const text = tpl.replace(/\{N\}/g, n).replace(/\{last\}/g, last);
    const end = src.value.replace(/\n+$/, '').length;
    src.value = src.value.slice(0, end) + text + src.value.slice(end);
    highlight(); render(); pushHistory();
  }

  // ---- サンプル ----
  const sel = $('samples');
  sel.innerHTML = Object.keys(SAMPLES).map((k) => `<option>${k}</option>`).join('');
  sel.onchange = () => setText(SAMPLES[sel.value], true);

  // ---- エクスポート ----
  const menu = $('exportMenu');
  $('bExport').onclick = () => { menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) menu.hidden = true; });
  function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  function strip(s) { return s.split('\n').filter((l) => !/^\s*import\b/.test(l)).map((l) => l.replace(/^\s*export\s+(function|const|class|let)\b/, '$1')).join('\n'); }
  async function standalone(source) {
    if (window.__STUDIO_HTML__) return window.__STUDIO_HTML__(source);   // 単一HTML自身が持つ場合
    const base = new URL('.', location.href);
    const [page, css, lcss, ljs, ...mods] = await Promise.all([
      fetch(new URL('index.html', base)).then((r) => r.text()),
      fetch(new URL('ui/editor.css', base)).then((r) => r.text()),
      fetch(new URL('vendor/leaflet/leaflet.css', base)).then((r) => r.text()).catch(() => ''),
      fetch(new URL('vendor/leaflet/leaflet.js', base)).then((r) => r.text()).catch(() => ''),
      ...MODULES.map((m) => fetch(new URL(m, base)).then((r) => r.text())),
    ]);
    const bundle = mods.map(strip).join('\n');
    // 置換は関数で（文字列だと $` などが特殊パターン展開されてコードが壊れる）。
    return page.replace(/<link rel="stylesheet" href="ui\/editor\.css">/, () => `<style>\n${css}\n</style>`)
      .replace(/<link rel="stylesheet" href="vendor\/leaflet\/leaflet\.css">/, () => `<style>\n${lcss}\n</style>`)
      .replace(/<script src="vendor\/leaflet\/leaflet\.js"><\/script>/, () => `<script>\n${ljs.replace(/<\/script>/g, '<\\/script>')}\n<\/script>`)
      .replace(/<script type="module">[\s\S]*?<\/script>/, () => `<script>\nwindow.STUDIO_SOURCE=${JSON.stringify(source)};\n${bundle}\nboot();\n<\/script>`);
  }
  const slug = (s) => (s || 'diagram').toLowerCase().replace(/[^\w぀-ヿ一-龯]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
  menu.addEventListener('click', (e) => {
    const x = e.target.dataset.x; if (!x) return; menu.hidden = true;
    doExport(x);
  });
  // パレットからも呼べるよう、エクスポートは一つの関数に。
  async function doExport(x) {
    const name = slug(model.meta.title || model.kind);
    if (x === 'dsl') { try { await navigator.clipboard.writeText(serialize(model)); toast('DSL をコピーしました'); } catch (_) { toast('コピーできませんでした'); } }
    else if (x === 'mmd') download(name + '.mmd', serialize(model), 'text/plain');
    else if (x === 'svg') { const s = canvas.querySelector('svg'); download(name + '.svg', '<?xml version="1.0"?>\n' + s.outerHTML, 'image/svg+xml'); }
    else if (x === 'png') exportPng(name);
    else if (x === 'drawio') { download(name + '.drawio', toDrawio(model, L), 'application/xml'); toast('.drawio を保存しました（draw.io で開けます）'); }
    else if (x === 'copydrawio') { try { await navigator.clipboard.writeText(toDrawio(model, L)); toast('draw.io XML をコピーしました（draw.io に貼り付け）'); } catch (_) { toast('コピーできませんでした'); } }
    else if (x === 'copysvg') copySvg();
    else if (x === 'copypng') copyPng();
    else if (x === 'html') { try { download(name + '.html', await standalone(serialize(model)), 'text/html'); toast('単一 HTML を保存しました'); } catch (_) { toast('HTML 化に失敗（オンラインのエディタでお試しを）'); } }
    else if (x === 'fileset') {
      const files = model.kind === 'infra' ? splitInfra(model) : null;
      if (!files || files.length < 2) { toast('分割できるのは最上位ゾーンを持つ infra だけです'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([zipStore(files)], { type: 'application/zip' }));
      a.download = name + '-fileset.zip'; a.click(); URL.revokeObjectURL(a.href);
      toast(`ファイルセットを保存しました（${files.length} ファイル：拠点ごと＋ _shared）`);
    }
  }
  // SVG をクリップボードへ：PowerPoint に貼って「図形に変換」すればオートシェイプになる。
  async function copySvg() {
    const el = canvas.querySelector('svg'); if (!el) return;
    const xml = '<?xml version="1.0"?>\n' + new XMLSerializer().serializeToString(el);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'image/svg+xml': new Blob([xml], { type: 'image/svg+xml' }),
        'text/plain': new Blob([xml], { type: 'text/plain' }),
      })]);
      toast('SVG をコピーしました（PowerPoint で図形に変換できます）');
    } catch (_) {
      try { await navigator.clipboard.writeText(xml); toast('SVG をテキストとしてコピーしました'); }
      catch (_2) { toast('コピーできませんでした'); }
    }
  }
  // PNG をクリップボードへ（そのまま貼れる画像）。
  function copyPng() {
    const el = canvas.querySelector('svg'); if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const k = 2, c = document.createElement('canvas');
      c.width = Math.ceil(el.viewBox.baseVal.width * k); c.height = Math.ceil(el.viewBox.baseVal.height * k);
      const g = c.getContext('2d'); g.fillStyle = pngBg(); g.fillRect(0, 0, c.width, c.height);
      g.scale(k, k); g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      c.toBlob(async (b) => {
        if (!b) { toast('PNG 化に失敗しました'); return; }
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('PNG をコピーしました'); }
        catch (_) { toast('コピーできませんでした'); }
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG 化に失敗しました'); };
    img.src = url;
  }

  // SVG → 2 倍解像度の PNG（背景を敷いてから焼く）。
  function exportPng(name) {
    const s = canvas.querySelector('svg'); if (!s) return;
    const xml = new XMLSerializer().serializeToString(s);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const k = 2, c = document.createElement('canvas');
      c.width = Math.ceil(s.viewBox.baseVal.width * k); c.height = Math.ceil(s.viewBox.baseVal.height * k);
      const g = c.getContext('2d');
      g.fillStyle = pngBg(); g.fillRect(0, 0, c.width, c.height);
      g.scale(k, k); g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        if (!b) { toast('PNG 化に失敗しました'); return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.png'; a.click();
        URL.revokeObjectURL(a.href); toast('PNG を保存しました');
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG 化に失敗しました'); };
    img.src = url;
  }

  // ---- 取り込み（CSV / TSV を貼る・選ぶ・ドロップする）----
  const dlg = $('importDlg');
  // 万能ペースト：Mermaid・表・矢印テキスト・箇条書き・JSON を判別して図にする。
  const KIND_JA = { mermaid: 'Mermaid', table: '表', arrows: '矢印テキスト', outline: '箇条書き', json: 'JSON' };
  function runImport(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const r = universal(t);
    if (r.kind === 'unknown') { toast('⚠ ' + (r.error || '読める形がありません（表・箇条書き・A -> B・JSON・Mermaid）')); return; }
    setText(r.text, true); dlg.hidden = true;
    toast(`${KIND_JA[r.kind]}${r.kind === 'mermaid' ? 'を読み込みました' : 'から図にしました'}${r.truncated ? '（大きいので一部だけ）' : ''}`);
  }
  $('bImport').onclick = () => { dlg.hidden = false; $('csvIn').focus(); };
  $('csvCancel').onclick = () => { dlg.hidden = true; };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.hidden = true; });
  $('csvGo').onclick = () => runImport($('csvIn').value);
  $('csvPick').onclick = (e) => { e.preventDefault(); $('csvFile').click(); };
  $('csvFile').onchange = async (e) => { const f = e.target.files[0]; if (f) runImport(await f.text()); e.target.value = ''; };
  // ファイルセット（.mmd 複数）→ 一枚に結合して開く。拠点ごとに分けて書き、ここで合わせる。
  $('fsPick').onclick = (e) => { e.preventDefault(); $('fsFiles').click(); };
  $('fsFiles').onchange = async (e) => {
    const fs = [...(e.target.files || [])]; e.target.value = '';
    if (!fs.length) return;
    const texts = await Promise.all(fs.map((f) => f.text()));
    const merged = mergeInfra(texts);
    const p = parse(merged);
    if (p.errors.length) { toast(`⚠ 結合しましたが ${p.errors.length} 件の指摘（未解決の接続など）`); }
    setText(merged, true); dlg.hidden = true;
    toast(`ファイルセット ${fs.length} 枚を結合しました`);
  };
  // 画面のどこへでもファイルをドロップできる（.csv/.tsv/.mmd/.txt）。
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    if (f.type.startsWith('image/')) embedImage(await fileToDataUrl(f), f.name.replace(/\.[^.]+$/, ''));
    else runImport(await f.text());
  });
  // 画像（スクショ）をノードに埋める：選択中ノードに貼り付け、なければ新ノードを作る。
  function embedImage(dataUrl, label) {
    if (model.kind !== 'flowchart') { toast('画像はフローチャートに埋められます'); return; }
    let id;
    if (selected.size === 1) { id = [...selected][0]; }
    else {
      let k = 1; while (model.items.some((n) => n.id === 'img' + k)) k++;
      id = 'img' + k;
      model.items.push({ type: 'node', id, label: label || 'スクショ', shape: 'rect' });
      model.order.push(id);
      const r = stage.getBoundingClientRect();
      const [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
    }
    model.images[id] = dataUrl;
    selected.clear(); selected.add(id);
    commitModel(); toast('画像を埋めました');
  }
  const fileToDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  // エディタの外に Ctrl+V：画像はノードへ、表（Excel の TSV そのまま）や Mermaid は図に。
  document.addEventListener('paste', async (e) => {
    const t = e.target;
    if (t === src || t === inline || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return;
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (imgItem) { e.preventDefault(); embedImage(await fileToDataUrl(imgItem.getAsFile())); return; }
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    // 構造の証拠があるものだけ拾う（ただの文章は乗っ取らない）。判別は engine/import.js。
    if (universal(text).kind !== 'unknown') { e.preventDefault(); runImport(text); }
  });

  // ---- テーマと背景（%% theme / %% bg — 見た目もコメントで往復する）----
  const pngBg = () => model.meta.bg || (model.meta.theme === 'light' ? '#ffffff' : '#0b0e14');
  function toggleTheme() {
    model.meta.theme = model.meta.theme === 'light' ? null : 'light';   // 既定は dark なので dark は書かない
    commitModel();
    toast(model.meta.theme === 'light' ? 'ライトモード ☀' : 'ダークモード 🌙');
  }
  const bgPick = $('bgPick');
  bgPick.addEventListener('input', () => { model.meta.bg = bgPick.value; commitModel(); toast('背景色 ' + bgPick.value + '（書き出しにも入ります）'); });
  function pickBg() { bgPick.value = model.meta.bg || (model.meta.theme === 'light' ? '#ffffff' : '#0b0e14'); bgPick.click(); }
  function clearBg() { model.meta.bg = null; commitModel(); toast('背景を透過に戻しました'); }

  // ---- ペイン境界のドラッグ（左は 80〜100 字程度が既定。広い画面ほど図に譲る）----
  const splitter = $('splitter');
  const setEdw = (px) => document.documentElement.style.setProperty('--edw', Math.round(px) + 'px');
  const savedW = +localStorage.getItem('studio.edw');
  if (savedW > 200) setEdw(savedW);
  let splitDrag = null;
  splitter.addEventListener('pointerdown', (e) => {
    splitDrag = true; splitter.setPointerCapture(e.pointerId); e.preventDefault();
  });
  splitter.addEventListener('pointermove', (e) => {
    if (!splitDrag) return;
    const w = Math.max(220, Math.min(window.innerWidth * 0.7, e.clientX));
    setEdw(w); localStorage.setItem('studio.edw', w);
  });
  splitter.addEventListener('pointerup', () => { splitDrag = null; });
  splitter.addEventListener('dblclick', () => {              // ダブルクリックで既定幅に戻す
    document.documentElement.style.removeProperty('--edw'); localStorage.removeItem('studio.edw');
  });

  // ---- 手描きモード（%% style sketch — 見た目もコメントで往復する）----
  function toggleSketch() {
    model.meta.style = model.meta.style === 'sketch' ? null : 'sketch';
    commitModel();
    toast(model.meta.style ? '手描きモード ✏' : '手描きを解除');
  }
  $('zSketch').onclick = toggleSketch;

  // ---- タイムトラベル：履歴をスライダでさかのぼる（見ながら戻れる undo）----
  const ttbar = $('ttbar'), ttRange = $('ttRange'), ttLabel = $('ttLabel');
  function syncTT() {
    if (ttbar.hidden) return;
    ttRange.max = Math.max(0, history.stack.length - 1);
    ttRange.value = history.idx;
    ttLabel.textContent = `${history.idx + 1} / ${history.stack.length}`;
  }
  function toggleTT() { ttbar.hidden = !ttbar.hidden; syncTT(); }
  ttRange.addEventListener('input', () => {
    const to = +ttRange.value;
    if (to === history.idx || history.stack[to] == null) return;
    history.idx = to; src.value = history.stack[to];
    highlight(); render(); hideAc();
    ttLabel.textContent = `${to + 1} / ${history.stack.length}`;
  });
  $('ttClose').onclick = toggleTT;

  // ---- 差分ビュー：旧版の Mermaid を貼ると「何が増え・消え・変わったか」を図上に ----
  // AI が返した版のレビューが目 grep でなく一目になる。比較はモデル diff（並び替えは差にしない）。
  let diffOther = null;
  function refreshDiff() {
    const bar = $('diffbar');
    if (!diffOther) { bar.hidden = true; return; }
    const res = diffModels(diffOther, model);
    if (res.kindChanged) { bar.hidden = true; diffOther = null; toast('図の種類が変わったので差分を終了'); return; }
    const chip = (cls, txt) => `<span class="chip ${cls}">${escHtml(txt)}</span>`;
    const cap = (arr) => arr.slice(0, 5);
    bar.innerHTML = `<b>差分</b>`
      + chip('add', `＋${res.added.length}`) + cap(res.added).map((x) => chip('add', x.label)).join('')
      + chip('del', `−${res.removed.length}`) + cap(res.removed).map((x) => chip('del', x.label)).join('')
      + chip('chg', `±${res.changed.length}`) + cap(res.changed).map((x) => chip('chg', x.label)).join('')
      + `<button id="diffExit">終了</button>`;
    bar.hidden = false;
    $('diffExit').onclick = () => { diffOther = null; render(); };
    for (const g of canvas.querySelectorAll('[data-drag]')) {         // 図上の色分け：追加=緑・変更=琥珀
      const id = g.dataset.id;
      const mark = res.addedIds.has(id) ? '#7ad1b0' : res.changedIds.has(id) ? '#f5b86a' : null;
      if (!mark) continue;
      for (const el of g.querySelectorAll('rect,ellipse,polygon,path'))
        { el.setAttribute('stroke', mark); el.setAttribute('stroke-width', '2.8'); }
    }
  }
  const diffDlg = $('diffDlg');
  $('diffCancel').onclick = () => { diffDlg.hidden = true; };
  diffDlg.addEventListener('click', (e) => { if (e.target === diffDlg) diffDlg.hidden = true; });
  $('diffGo').onclick = () => {
    const other = parse($('diffIn').value);
    if (!$('diffIn').value.trim() || other.errors.length) { toast('⚠ 旧版の Mermaid が読めません'); return; }
    diffOther = other; diffDlg.hidden = true; render();
  };

  // ---- コマンドパレット（Ctrl+K / ⌘K）：全部ここからできる ----
  // 打った言葉がコマンドに無ければ「その名前のノードを追加」になる——考えたらもう出来てる、が理想。
  const palette = $('palette'), pInput = $('pInput'), pList = $('pList');
  let pItems = [], pSel = 0;
  function centerPos(id) {
    const r = stage.getBoundingClientRect();
    const [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
  }
  function addNamed(label) {
    if (!model.kind) { setText(`flowchart TD\n    n1[${label}]`, true); return; }   // 白紙からでも始まる
    if (model.kind === 'flowchart') {
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      model.items.push({ type: 'node', id: 'n' + k, label, shape: 'rect' });
      model.order.push('n' + k); centerPos('n' + k);
      selected.clear(); selected.add('n' + k); commitModel();
    } else if (model.kind === 'class') {
      const cid = label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') || 'C' + (model.items.length + 1);
      if (model.items.some((x) => x.id === cid)) { toast('その名前はもうあります'); return; }
      model.items.push({ type: 'class', id: cid, attrs: [], methods: [] });
      model.order.push(cid); centerPos(cid);
      selected.clear(); selected.add(cid); commitModel();
    } else if (model.kind === 'infra') {
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      model.items.push({ type: 'inode', id: 'n' + k, label, role: null, os: null, ip: null, vlan: null, zone: null });
      model.order.push('n' + k); centerPos('n' + k);
      selected.clear(); selected.add('n' + k); commitModel();
    } else if (model.kind === 'sequence') insert(`\n    participant p{N} as ${label}`);
    else insert(`\n      ${label} :t{N}, after {last}, 3d`);
    toast(`「${label}」を足しました`);
  }
  function paletteItems(q) {
    const cmds = [];
    const noun = { gantt: 'タスク', flowchart: 'ノード', sequence: '参加者', class: 'クラス', infra: '機器' }[model.kind] || 'ノード';
    if (q.trim()) cmds.push({ t: `＋ ${noun}「${q.trim()}」を追加`, k: 'add create 追加', pin: true, run: () => addNamed(q.trim()) });
    for (const s of snipsFor()) cmds.push({ t: `挿入：${s[0]}`, k: 'insert snippet', run: () => insert(s[1]) });
    cmds.push(
      { t: '手描きモード切替 ✏', k: 'sketch rough hand 手書き てがき', run: toggleSketch },
      { t: 'ライト / ダーク切替 ☀🌙', k: 'theme light dark てーま らいと', run: toggleTheme },
      { t: '背景色を設定…（書き出しにも焼く）', k: 'background bg color はいけい', run: pickBg },
      { t: '背景を透過に戻す', k: 'background transparent とうか', run: clearBg },
      { t: 'ラインジャンプ切替 ⌒（交差を跨ぐ）', k: 'hops jump cross こうさ じゃんぷ', run: () => { model.meta.hops = !model.meta.hops || null; commitModel(); toast(model.meta.hops ? '交差をジャンプ ⌒' : 'ジャンプを解除'); } },
      { t: '接続点の丸点切替 ●', k: 'dots junction terminal まるてん せつぞくてん', run: () => { model.meta.dots = !model.meta.dots || null; commitModel(); toast(model.meta.dots ? '接続点に丸点 ●' : '丸点を解除'); } },
      { t: 'セマンティックズーム切替 🗺（引くと要約）', k: 'lod semantic zoom map ちず さまらいず', run: () => { model.meta.lod = !model.meta.lod || null; commitModel(); toast(model.meta.lod ? '🗺 地図モード：ズームで要約⇄詳細' : '地図モードを解除'); } },
      { t: '地理マップ切替 🗾（%% geo で実座標に置く）', k: 'geo map japan にほん ちり じっざひょう bcp', run: () => { model.meta.map = !model.meta.map || null; commitModel(); fit(); toast(model.meta.map ? '🗾 地理マップ：%% geo 名前|緯度|経度 で拠点が地図に立つ' : '地理マップを解除'); } },
      ...GEO_LAYERS.map((ly) => ({ t: `ハザード切替 ⚠ ${ly.label}`, k: `hazard bcp risk ${ly.key} はざーど ぼうさい`, run: () => {
        const cur = new Set(model.meta.hazard || []);
        cur.has(ly.key) ? cur.delete(ly.key) : cur.add(ly.key);
        model.meta.hazard = cur.size ? [...cur] : null;
        if (cur.size && !model.meta.map) model.meta.map = true;      // レイヤは地図の上に描く
        commitModel(); toast(cur.has(ly.key) ? `⚠ ${ly.label} を表示` : `${ly.label} を消灯`);
      } })),
      { t: 'ハザード全レイヤ ON / OFF ⚠', k: 'hazard all bcp ぜんぶ はざーど', run: () => {
        const on = !(model.meta.hazard && model.meta.hazard.length === GEO_LAYERS.length);
        model.meta.hazard = on ? GEO_LAYERS.map((l) => l.key) : null;
        if (on && !model.meta.map) model.meta.map = true;
        commitModel(); toast(on ? '⚠ 全ハザードレイヤを表示' : 'ハザードを全消灯');
      } },
      { t: '実地図タイル切替 🌍（OSM・オンライン時のみ）', k: 'tiles osm leaflet real map たいる ちず', run: () => {
        model.meta.tiles = !model.meta.tiles || null;
        if (model.meta.tiles && !model.meta.map) model.meta.map = true;
        commitModel(); toast(model.meta.tiles ? '🌍 実地図タイル ON（© OpenStreetMap・オフラインでは出ません）' : '実地図タイルを OFF');
      } },
      { t: 'ベースマップ切替 🗺（なし→OSM→地理院淡色→地理院写真）', k: 'basemap osm gsi leaflet べーすまっぷ ちず', run: () => {
        const order = ['none', 'osm', 'gsi', 'photo'];
        const cur = model.meta.basemap || (model.meta.tiles ? 'osm' : 'none');
        const next = order[(order.indexOf(cur) + 1) % order.length];
        model.meta.basemap = next === 'none' ? null : next;
        model.meta.tiles = null;
        if (next !== 'none' && !model.meta.map) model.meta.map = true;
        commitModel(); toast(`🗺 ベースマップ: ${BASEMAP_JA[next]}`);
      } },
      { t: '実ハザードタイル ⚠（洪水・津波・高潮・土砂）ON / OFF', k: 'hazardtiles flood tsunami real じつはざーど こうずい つなみ', run: () => {
        const on = !(model.meta.hazardTiles && model.meta.hazardTiles.length);
        model.meta.hazardTiles = on ? Object.keys(HAZARD_TILE_DEFS) : null;
        if (on && !model.meta.map) model.meta.map = true;
        commitModel(); toast(on ? '⚠ 実ハザードタイルを表示（出典: ハザードマップポータルサイト）' : '実ハザードタイルを消灯');
      } },
      { t: '🗺 地図パネルを開く（ベースマップ・ハザード）', k: 'map basemap hazard ちず べーすまっぷ はざーど', run: () => { if (model.kind !== 'infra') { toast('地図は infra 図種で使えます'); return; } if (mapPanel.hidden) $('zMap').click(); } },
      { t: 'レイヤパネル ◫（通常線・関係線・バス・自由レイヤ）', k: 'layers layer れいや panel', run: () => $('zLayers').click() },
      { t: '台帳 ▤（機器台帳・IP アドレス台帳）', k: 'ledger ipam daicho だいちょう 台帳 IP', run: () => $('zLedger').click() },
      { t: 'ファイルセット (.zip) — 拠点ごとに分割して保存', k: 'fileset split zip ぶんかつ ふぁいる', run: () => doExport('fileset') },
      { t: '差分を比べる…（旧版の Mermaid を貼る）', k: 'diff compare さぶん レビュー', run: () => { diffDlg.hidden = false; $('diffIn').focus(); } },
      { t: 'タイムトラベル（履歴スライダ）', k: 'history time undo りれき', run: toggleTT },
      { t: '目次（TOC）を開く / 閉じる', k: 'toc outline index もくじ ついり tree', run: toggleToc },
      { t: '取り込み（表・箇条書き・A→B・JSON）', k: 'import paste csv とりこみ', run: () => { dlg.hidden = false; $('csvIn').focus(); } },
      { t: '全体をフィット', k: 'fit zoom ふぃっと', run: fit },
      { t: 'コード ⇄ 図 切替', k: 'view code toggle', run: () => document.body.classList.toggle('viewmax') },
      { t: 'アンドゥ', k: 'undo', run: () => timeTravel(-1) },
      { t: 'リドゥ', k: 'redo', run: () => timeTravel(1) },
    );
    for (const name of Object.keys(SAMPLES)) cmds.push({ t: `サンプル：${name}`, k: 'sample さんぷる', run: () => setText(SAMPLES[name], true) });
    for (const [x, label] of [['dsl', 'DSL をコピー'], ['mmd', '.mmd を保存'], ['svg', 'SVG を保存'], ['png', 'PNG を保存'],
      ['copysvg', 'SVG をコピー（PPT 図形化用）'], ['copypng', 'PNG をコピー'], ['drawio', '.drawio を保存'],
      ['copydrawio', 'draw.io XML をコピー'], ['html', '単一 HTML を保存']])
      cmds.push({ t: `エクスポート：${label}`, k: 'export save copy ' + x, run: () => doExport(x) });
    const ql = q.trim().toLowerCase();
    // 順位：コマンド名にそのまま含まれる(3) ＞「その名前で追加」ピン(2.5) ＞ 曖昧一致(2)。
    // ピンを最上位にすると「タイムトラベル」と打った人がノードを生やしてしまう——コマンドの言葉はコマンドが勝つ。
    const score = (c) => {
      if (c.pin) return 2.5;
      if (!ql) return 1;
      const hay = (c.t + ' ' + c.k).toLowerCase();
      if (hay.includes(ql)) return 3;
      let i = 0; for (const ch of hay) { if (ch === ql[i]) i++; if (i === ql.length) return 2; }   // 部分列
      return 0;
    };
    return cmds.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 12);
  }
  function drawPalette() {
    pList.innerHTML = pItems.map((c, i) => `<div class="opt${i === pSel ? ' sel' : ''}" data-i="${i}">${escHtml(c.t)}</div>`).join('')
      || '<div class="none">見つかりません</div>';
  }
  function openPalette() { palette.hidden = false; pInput.value = ''; pItems = paletteItems(''); pSel = 0; drawPalette(); pInput.focus(); }
  function closePalette() { palette.hidden = true; }
  function runPalette() { const c = pItems[pSel]; if (!c) return; closePalette(); c.run(); }
  $('bPalette').onclick = openPalette;
  pInput.addEventListener('input', () => { pItems = paletteItems(pInput.value); pSel = 0; drawPalette(); });
  pInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { pSel = (pSel + 1) % Math.max(1, pItems.length); drawPalette(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pSel = (pSel - 1 + pItems.length) % Math.max(1, pItems.length); drawPalette(); e.preventDefault(); }
    else if (e.key === 'Enter') { runPalette(); e.preventDefault(); }
    else if (e.key === 'Escape') closePalette();
    e.stopPropagation();
  });
  pList.addEventListener('pointerdown', (e) => { const o = e.target.closest('.opt'); if (o) { pSel = +o.dataset.i; runPalette(); e.preventDefault(); } });
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); }
  });


  // ---- TOC（目次）：巨大な図の道しるべ ----------------------------------------
  // ゾーンのツリー＋機器＋バス＋フェンス。検索で絞り、クリックでそこへ飛んで選択、
  // ▸/▾ で目次から折りたたみ。エディタ側も該当行へスクロールする——迷子にならない。
  const toc = $('toc'), tocList = $('tocList'), tocQ = $('tocQ');
  function toggleToc() { toc.hidden = !toc.hidden; if (!toc.hidden) { buildToc(); tocQ.focus(); } }
  $('zToc').onclick = toggleToc;
  $('tocClose').onclick = toggleToc;
  tocQ.addEventListener('input', buildToc);
  const ROLE_TAG_UI = { core: 'CORE', dist: 'DIST', access: 'ACC', switch: 'SW', router: 'RT', firewall: 'FW',
    server: 'SV', db: 'DB', storage: 'ST', pc: 'PC', ap: 'AP', lb: 'LB', cloud: 'NET', printer: 'PR',
    plc: 'PLC', rtu: 'RTU', dcs: 'DCS', scada: 'SCD', hmi: 'HMI', historian: 'HIS', ews: 'EWS',
    sensor: 'SEN', drive: 'DRV', robot: 'ROB', cnc: 'CNC', sis: 'SIS', gateway: 'GW', diode: 'DIO' };
  function tocEntries() {
    const q = tocQ.value.trim().toLowerCase();
    const hit = (...ss) => !q || ss.some((x) => x != null && String(x).toLowerCase().includes(q));
    const out = [];
    if (model.kind === 'infra') {
      const fold = new Set(model.layout.fold || []);
      const rec = (zname, depth) => {
        const rows = [];
        for (const z of model.groups.filter((g) => g.parent === zname)) {
          const members = model.items.filter((x) => x.type === 'inode' && x.zone === z.name);
          const kids = members.filter((n) => hit(n.id, n.label, n.os, n.ip, n.role, n.vlan))
            .map((n) => ({ t: 'node', id: n.id, label: n.label, role: n.role, depth: depth + 1 }));
          const sub = rec(z.name, depth + 1);
          if (hit(z.name) || kids.length || sub.length)
            rows.push({ t: 'zone', name: z.name, depth, folded: fold.has(z.name), count: members.length }, ...kids, ...sub);
        }
        return rows;
      };
      out.push(...rec(null, 0));
      const loose = model.items.filter((x) => (x.type === 'inode' || x.type === 'hub') && !x.zone && hit(x.id, x.label, x.os, x.ip, x.role));
      out.push(...loose.map((n) => ({ t: 'node', id: n.id, label: n.label, role: n.role, depth: 0 })));
      const rest = model.items.filter((x) => (x.type === 'bus' || x.type === 'fence') && hit(x.id, x.label, x.vlan, x.cidr));
      if (rest.length) out.push({ t: 'head', label: 'バス・フェンス' },
        ...rest.map((b) => ({ t: 'node', id: b.id, label: (b.type === 'bus' ? '━ ' : '⚑ ') + b.label, depth: 0 })));
      // BCP：地理マップ時、拠点ごとのハザード露出と「同時被災」候補（同じ影響域に 2 拠点以上）。
      if (L && L.map && L.map.exposure) {
        const zoneNames = new Set(model.groups.map((g) => g.name));
        const ex = L.map.exposure.filter((s) => s.hits.length);
        if (ex.length) {
          out.push({ t: 'head', label: '⚠ BCP 露出（概略・参考）' });
          for (const s of ex) if (hit(s.name, ...s.hits.map((h) => h.name))) {
            out.push({ t: 'bcp', name: s.name, isZone: zoneNames.has(s.name), count: s.hits.length });
            for (const h of s.hits) out.push({ t: 'bcph', label: h.name });
          }
          const byHaz = new Map();
          for (const s of ex) for (const h of s.hits) { if (!byHaz.has(h.name)) byHaz.set(h.name, []); byHaz.get(h.name).push(s.name); }
          const multi = [...byHaz].filter(([, ss]) => ss.length >= 2);
          if (multi.length) {
            out.push({ t: 'head', label: '☢ 同時被災の候補（同じ影響域に複数拠点）' });
            for (const [hz, ss] of multi) if (hit(hz, ...ss)) out.push({ t: 'bcph', label: `${hz} → ${ss.join('・')}` });
          }
        }
      }
    } else {
      for (const it of model.items)
        if (hit(it.id, it.label)) out.push({ t: 'node', id: it.id, label: it.label || it.id, depth: 0 });
    }
    return out;
  }
  function buildToc() {
    if (toc.hidden) return;
    const rows = tocEntries();
    tocList.innerHTML = rows.map((r) => {
      if (r.t === 'head') return `<div class="th">${escHtml(r.label)}</div>`;
      if (r.t === 'bcp')
        return `<div class="tn" ${r.isZone ? `data-goto-zone="${escHtml(r.name)}"` : `data-goto="${escHtml(r.name)}"`}>`
          + `<span>⚠ ${escHtml(r.name)}</span><span class="tc">${r.count}</span></div>`;
      if (r.t === 'bcph')
        return `<div class="tn" style="padding-left:26px;opacity:.72;pointer-events:none"><span>${escHtml(r.label)}</span></div>`;
      if (r.t === 'zone')
        return `<div class="tz" style="padding-left:${8 + r.depth * 14}px" data-goto-zone="${escHtml(r.name)}">`
          + `<button class="tf" data-tfold="${escHtml(r.name)}">${r.folded ? '▸' : '▾'}</button>`
          + `<span>${escHtml(r.name)}</span><span class="tc">${r.count}</span></div>`;
      const tag = ROLE_TAG_UI[r.role];
      return `<div class="tn" style="padding-left:${22 + r.depth * 14}px" data-goto="${escHtml(r.id)}">`
        + `<span>${escHtml(r.label)}</span>${tag ? `<span class="tt">${tag}</span>` : ''}</div>`;
    }).join('') || '<div class="th">見つかりません</div>';
  }
  // クリック：飛ぶ・選ぶ・エディタも該当行へ。▸/▾ は折りたたみ。
  tocList.addEventListener('click', (e) => {
    const tf = e.target.closest('[data-tfold]');
    if (tf) {
      const name = tf.dataset.tfold;
      const fold = new Set(model.layout.fold || []);
      fold.has(name) ? fold.delete(name) : fold.add(name);
      model.layout.fold = [...fold];
      commitModel(); buildToc();
      return;
    }
    const gz = e.target.closest('[data-goto-zone]');
    if (gz) { centerOn(null, gz.dataset.gotoZone); return; }
    const gn = e.target.closest('[data-goto]');
    if (gn) centerOn(gn.dataset.goto, null);
  });
  function centerOn(id, zoneName) {
    if (!L) return;
    let cx = null, cy = null;
    if (zoneName) {
      const z = (L.zones || []).find((zz) => zz.name === zoneName);
      if (z) { cx = z.x + z.w / 2; cy = z.y + z.h / 2; }
    } else {
      const n = (L.nodes || []).find((x) => x.id === id);
      const b = (L.buses || []).find((x) => x.id === id);
      const f = (L.fences || []).find((x) => x.id === id);
      const bar = (L.bars || []).find((x) => x.id === id);
      const act = (L.actors || []).find((x) => x.id === id);
      if (n) { cx = n.x + n.w / 2; cy = n.y + n.h / 2; }
      else if (b) { cx = b.orient === 'v' ? b.x : (b.x1 + b.x2) / 2; cy = b.orient === 'v' ? (b.y1 + b.y2) / 2 : b.y; }
      else if (f) { cx = f.orient === 'h' ? (f.x1 + f.x2) / 2 : f.x; cy = f.orient === 'h' ? f.y : (f.y1 + f.y2) / 2; }
      else if (bar) { cx = bar.x + bar.w / 2; cy = bar.y + bar.h / 2; }
      else if (act) { cx = act.cx; cy = act.y + act.h / 2; }
    }
    if (cx == null) return;
    if (lmap && leafletWanted()) {
      const [lat, lng] = geoUnproject(cx, cy);
      lmap.setView([lat, lng], Math.max(lmap.getZoom(), sToZ(0.75)));
    } else {
      const r = stage.getBoundingClientRect();
      view.s = Math.max(view.s, 0.75);                      // 遠すぎたら少し寄る
      view.tx = r.width / 2 - (cx - (L.x0 || 0)) * view.s;
      view.ty = r.height / 2 - (cy - (L.y0 || 0)) * view.s;
      applyView();
    }
    if (id && model.items.some((x) => x.id === id && (x.type === 'inode' || x.type === 'node' || x.type === 'class'))) {
      selected.clear(); selected.add(id); redraw(); syncAlignBar();
    }
    // エディタも該当行へ（最初に出てくる行）。
    const token = id || zoneName;
    const lines = src.value.split('\n');
    const li = lines.findIndex((l) => l.includes(token));
    if (li >= 0) {
      const pos = lines.slice(0, li).join('\n').length + (li ? 1 : 0);
      src.selectionStart = src.selectionEnd = pos;
      src.scrollTop = Math.max(0, li * 20 - 80);
      syncScroll();
    }
  }

  // ---- レイヤ（v14）：通常線・関係線・バス・フェンス＋ :layer 名 の自由レイヤを見え隠れ ----
  const layersPanel = $('layers'), layersList = $('layersList');
  const BUILTIN_JA = { net: '通常線（ネットワーク）', rel: '関係線（rep・ミラー・同期）', bus: 'バス', fence: 'フェンス' };
  function layerCatalog() {
    const custom = new Map();
    for (const x of model.items) if (x.layer) custom.set(x.layer, (custom.get(x.layer) || 0) + 1);
    for (const e of model.edges) if (e.layer) custom.set(e.layer, (custom.get(e.layer) || 0) + 1);
    return [
      { key: 'net', count: model.edges.filter((e) => !e.rel).length },
      { key: 'rel', count: model.edges.filter((e) => e.rel).length },
      { key: 'bus', count: model.items.filter((x) => x.type === 'bus').length },
      { key: 'fence', count: model.items.filter((x) => x.type === 'fence').length },
      ...[...custom.keys()].sort().map((k) => ({ key: k, count: custom.get(k) })),
    ].filter((l) => l.count > 0);
  }
  // ◫ レイヤは「図の要素」専用に純化（通常線・関係線・バス・フェンス・自由レイヤ）。
  // 地図まわり（表示ON/OFF・ベースマップ・ハザード）は 🗺 地図パネルへ分けた（動線を分かりやすく）。
  function buildLayers() {
    const off = new Set(model.meta.layersOff || []);
    layersList.innerHTML = layerCatalog().map((l) =>
      `<label><input type="checkbox" data-layer="${escHtml(l.key)}" ${off.has(l.key) ? '' : 'checked'}> ${escHtml(BUILTIN_JA[l.key] || l.key)}<span class="lc">${l.count}</span></label>`).join('')
      || '<label style="color:var(--dim)">レイヤに載るものがありません（infra 図種で）</label>';
  }
  $('zLayers').onclick = () => { layersPanel.hidden = !layersPanel.hidden; if (!layersPanel.hidden) { mapPanel.hidden = true; buildLayers(); } };
  $('layersClose').onclick = () => { layersPanel.hidden = true; };
  layersList.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.layer; if (!k) return;
    const off = new Set(model.meta.layersOff || []);
    e.target.checked ? off.delete(k) : off.add(k);
    model.meta.layersOff = off.size ? [...off] : null;
    commitModel();
  });

  // ---- 🗺 地図パネル（v16）：地図の操作をひとつの分かりやすい場所に集約 ----
  const mapPanel = $('mapPanel'), mapList = $('mapList');
  function buildMap() {
    const on = !!model.meta.map, cur = basemapOf();
    const hz = new Set(model.meta.hazard || []);
    const hzt = new Set(model.meta.hazardTiles || []);
    let html = `<label class="mtop"><input type="checkbox" data-mapon ${on ? 'checked' : ''}> <b>地図に載せる</b>（拠点を実座標へ）</label>`;
    html += `<div class="lsec">🗺 ベースマップ${LF ? '' : '（Leaflet 未読込）'}</div>`
      + `<div class="mgrid"${on ? '' : ' style="opacity:.45;pointer-events:none"'}>`
      + Object.keys(BASEMAP_JA).map((k) =>
        `<label><input type="radio" name="bm" data-basemap="${k}" ${cur === k ? 'checked' : ''}> ${BASEMAP_JA[k]}</label>`).join('') + `</div>`;
    html += `<div class="lsec">⚠ ハザード（内蔵・オフライン可）</div>`
      + `<div class="mgrid">` + GEO_LAYERS.map((l) =>
        `<label><input type="checkbox" data-hz="${l.key}" ${hz.has(l.key) ? 'checked' : ''}> <span style="color:${l.hue}">■</span> ${escHtml(l.label.split('（')[0])}</label>`).join('') + `</div>`;
    html += `<div class="lsec">⚠ 実ハザードタイル（要ネット）</div>`
      + `<div class="mgrid">` + Object.keys(HAZARD_TILE_DEFS).map((k) =>
        `<label><input type="checkbox" data-hztile="${k}" ${hzt.has(k) ? 'checked' : ''}> ${escHtml(HAZARD_TILE_DEFS[k].label)}</label>`).join('') + `</div>`;
    html += `<div class="mnote">※ ベースマップと実ハザードの<b>地図画像はインターネット接続</b>が必要です（国土地理院・OpenStreetMap・ハザードマップポータル）。オフラインでは自前の日本アウトラインで表示します。</div>`;
    mapList.innerHTML = html;
  }
  $('zMap').onclick = () => { mapPanel.hidden = !mapPanel.hidden; if (!mapPanel.hidden) { layersPanel.hidden = true; buildMap(); } };
  $('mapClose').onclick = () => { mapPanel.hidden = true; };
  // infra 図種のときだけ 🗺 地図 / ◫ レイヤ / ▤ 台帳 を出す（他の図種では不要なので隠して動線を軽く）。
  function syncToolbar() {
    const isInfra = model.kind === 'infra';
    $('zMap').hidden = !isInfra; $('zLayers').hidden = !isInfra; $('zLedger').hidden = !isInfra;
    if (!isInfra) { mapPanel.hidden = true; layersPanel.hidden = true; if (!ledger.hidden) ledger.hidden = true; }
  }
  mapList.addEventListener('change', (e) => {
    const d = e.target.dataset || {};
    if ('mapon' in d) {
      model.meta.map = e.target.checked || null;
      commitModel(); buildMap(); fit();
      toast(model.meta.map ? '🗾 地図に載せました（拠点に %% geo が要ります）' : '地図表示をOFF');
    } else if (d.basemap) {
      model.meta.basemap = d.basemap === 'none' ? null : d.basemap;
      model.meta.tiles = null;
      if (model.meta.basemap && !model.meta.map) model.meta.map = true;
      commitModel(); buildMap();
    } else if (d.hz) {
      const hz = new Set(model.meta.hazard || []);
      e.target.checked ? hz.add(d.hz) : hz.delete(d.hz);
      model.meta.hazard = hz.size ? [...hz] : null;
      if (hz.size && !model.meta.map) model.meta.map = true;
      commitModel(); buildMap();
    } else if (d.hztile) {
      const hz = new Set(model.meta.hazardTiles || []);
      e.target.checked ? hz.add(d.hztile) : hz.delete(d.hztile);
      model.meta.hazardTiles = hz.size ? [...hz] : null;
      if (hz.size && !model.meta.map) model.meta.map = true;
      commitModel(); buildMap();
    }
  });

  // ---- 台帳（v14）：機器台帳と IP アドレス台帳（IPAM・重複 ⚠・次の空き） ----
  const ledger = $('ledger'), ledBody = $('ledBody'), ledQ = $('ledQ');
  let ledTab = 'dev';
  function buildLedger() {
    if (ledger.hidden) return;
    const q = ledQ.value.trim().toLowerCase();
    const hit = (...ss) => !q || ss.some((s) => s != null && String(s).toLowerCase().includes(q));
    if (model.kind !== 'infra') { ledBody.innerHTML = '<div class="nethead">台帳は infra 図種で使えます</div>'; return; }
    if (ledTab === 'dev') {
      const rows = ledgerDevices(model).filter((r) => hit(r.id, r.label, r.role, r.os, r.ips.join(' '), r.zone, r.layer));
      ledBody.innerHTML = `<table><tr><th>ID</th><th>名前</th><th>役割</th><th>OS</th><th>IP</th><th>VLAN</th><th>ゾーン</th><th>接続</th><th>レイヤ</th></tr>`
        + rows.map((r) => `<tr data-goto="${escHtml(r.id)}"><td>${escHtml(r.id)}</td><td>${escHtml(r.label)}</td><td>${escHtml(r.role)}</td><td>${escHtml(r.os)}</td><td>${escHtml([...new Set(r.ips)].join(' / '))}</td><td>${r.vlan}</td><td>${escHtml(r.zone)}</td><td>${r.links}</td><td>${escHtml(r.layer)}</td></tr>`).join('')
        + `</table><div class="nethead" style="color:var(--dim);font-weight:400">${rows.length} 台</div>`;
    } else {
      const { nets, orphans } = ledgerIpam(model);
      ledBody.innerHTML = nets.map((net) => {
        const rows = net.rows.filter((r) => hit(r.ip, r.owner, net.label, net.cidr));
        if (q && !rows.length) return '';
        return `<div class="nethead">━ ${escHtml(net.label)}（${escHtml(net.cidr)}${net.vlan != null ? ' ・ VLAN ' + net.vlan : ''}）`
          + ` — 使用 ${net.rows.length} ・ 利用率 ${net.util}%`
          + (net.dups ? ` ・ <span class="dup">⚠ 重複 ${net.dups}</span>` : '')
          + `・ 次の空き <span class="free">${net.free || 'なし'}</span></div>`
          + `<table><tr><th>IP</th><th>割当先</th><th>向き先</th><th></th></tr>`
          + rows.map((r) => `<tr data-goto="${escHtml(r.owner)}"><td>${escHtml(r.ip)}</td><td>${escHtml(r.owner)}</td><td>${escHtml(r.via)}</td><td>${r.dup ? '<span class="dup">⚠ 重複</span>' : ''}</td></tr>`).join('') + '</table>';
      }).join('')
        + (orphans.length ? `<div class="nethead">未収容（どのネットワーク cidr にも入らない IP）</div><table>`
          + orphans.filter((o) => hit(o.ip, o.owner)).map((o) => `<tr data-goto="${escHtml(o.owner)}"><td>${escHtml(o.ip)}</td><td>${escHtml(o.owner)}</td><td>${escHtml(o.via)}</td><td></td></tr>`).join('') + '</table>' : '');
    }
  }
  $('zLedger').onclick = () => { ledger.hidden = !ledger.hidden; buildLedger(); };
  $('ledClose').onclick = () => { ledger.hidden = true; };
  ledQ.addEventListener('input', buildLedger);
  for (const b of ledger.querySelectorAll('.ltab')) b.onclick = () => {
    for (const x of ledger.querySelectorAll('.ltab')) x.classList.toggle('on', x === b);
    ledTab = b.dataset.lt; buildLedger();
  };
  ledBody.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-goto]'); if (!tr) return;
    ledger.hidden = true; centerOn(tr.dataset.goto, null);
  });
  $('ledCsv').onclick = () => {
    if (model.kind !== 'infra') return;
    if (ledTab === 'dev') {
      const rows = ledgerDevices(model);
      download('devices.csv', ledgerCsv(['id', 'label', 'role', 'os', 'ip', 'vlan', 'zone', 'links', 'layer'],
        rows.map((r) => [r.id, r.label, r.role, r.os, [...new Set(r.ips)].join(' / '), r.vlan, r.zone, r.links, r.layer])), 'text/csv');
    } else {
      const { nets, orphans } = ledgerIpam(model);
      const rows = [];
      for (const net of nets) {
        for (const r of net.rows) rows.push([net.label, net.cidr, net.vlan ?? '', r.ip, r.owner, r.via, r.dup ? 'DUP' : '']);
        rows.push([net.label, net.cidr, net.vlan ?? '', net.free || '', '(次の空き)', '', 'FREE']);
      }
      for (const o of orphans) rows.push(['(未収容)', '', '', o.ip, o.owner, o.via, '']);
      download('ipam.csv', ledgerCsv(['network', 'cidr', 'vlan', 'ip', 'owner', 'via', 'flag'], rows), 'text/csv');
    }
    toast('CSV を保存しました（Excel でそのまま開けます）');
  };

  // ---- ディテール・ポップアップ（v14）：本体は薄く、詳細はここで ----
  const pop = $('pop');
  function hidePop() { pop.hidden = true; }
  function showPop(id) {
    const n = model.items.find((x) => x.id === id);
    if (!n || (n.type !== 'inode' && n.type !== 'hub')) { hidePop(); return; }
    const conns = model.edges.filter((e) => e.from === id || e.to === id).map((e) => {
      const peerId = e.from === id ? e.to : e.from;
      const pn = model.items.find((x) => x.id === peerId);
      const myIp = e.from === id ? e.ipFrom : e.ipTo;
      const kind = e.rel ? '⟳ ' + (e.label || e.rel) : (e.vlan != null ? 'VLAN ' + e.vlan : (e.label || ''));
      return `${escHtml(pn ? pn.label : peerId)}${kind ? `（${escHtml(kind)}）` : ''}${myIp ? ` — <b>${escHtml(myIp)}</b>` : ''}`;
    });
    const ips = (n.ips && n.ips.length ? n.ips : (n.ip ? [n.ip] : []));
    pop.innerHTML = `<h4>${escHtml(n.label)}<span class="ptag">${escHtml(n.id)}</span>${n.role ? `<span class="ptag">${escHtml(n.role)}</span>` : ''}</h4>`
      + (n.os ? `<div class="pr"><span class="pk">OS</span><span class="pv">${escHtml(n.os)}</span></div>` : '')
      + (ips.length ? `<div class="pr"><span class="pk">IP</span><span class="pv">${ips.map(escHtml).join('<br>')}</span></div>` : '')
      + (n.vlan != null ? `<div class="pr"><span class="pk">VLAN</span><span class="pv">${n.vlan}</span></div>` : '')
      + (n.cidr ? `<div class="pr"><span class="pk">CIDR</span><span class="pv">${escHtml(n.cidr)}</span></div>` : '')
      + (n.zone ? `<div class="pr"><span class="pk">ゾーン</span><span class="pv">${escHtml(n.zone)}</span></div>` : '')
      + (n.layer ? `<div class="pr"><span class="pk">レイヤ</span><span class="pv">${escHtml(n.layer)}</span></div>` : '')
      + (conns.length ? `<div class="pr"><span class="pk">接続</span><span class="pv">${conns.join('<br>')}</span></div>` : '');
    pop.hidden = false;
    const el = canvas.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const r = el ? el.getBoundingClientRect() : stage.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.right + 10, y = r.top;
    if (x + pw > innerWidth - 8) x = Math.max(8, r.left - pw - 10);
    if (y + ph > innerHeight - 8) y = Math.max(8, innerHeight - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
  stage.addEventListener('pointerdown', () => hidePop(), true);

  // ---- コード ⇄ シンボル（v14）：カーソル行のシンボルがネオンでまたたく ----
  let neonPrev = null;
  function cursorSync() {
    if (model.kind !== 'infra') return;
    const line = src.value.slice(0, src.selectionStart).split('\n').length - 1;
    const t = (src.value.split('\n')[line] || '').trim();
    let ids = [], mm;
    if ((mm = /^(?:bus|hub|fence)\s+([^\s\[:]+)/.exec(t))) ids = [mm[1]];
    else if ((mm = /^([^\s\[:%{}]+)\s*--\s*([^\s:]+)/.exec(t))) ids = [mm[1], mm[2]];
    else if ((mm = /^([^\s\[:%{}]+)\[/.exec(t))) ids = [mm[1]];
    const key = ids.join('|');
    if (key === neonPrev) return;
    neonPrev = key;
    for (const el of canvas.querySelectorAll('.neon')) el.classList.remove('neon');
    for (const id of ids)
      for (const el of canvas.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)) el.classList.add('neon');
  }
  src.addEventListener('keyup', cursorSync);
  src.addEventListener('click', cursorSync);
  // シンボル → コード：該当行へスクロール（クリック選択時に呼ばれる）。
  function jumpToLine(id) {
    const lines = src.value.split('\n');
    const li = lines.findIndex((l) => l.trim().startsWith(id) || l.includes(`${id}[`) || new RegExp(`(?:bus|hub|fence)\\s+${id}\\b`).test(l));
    if (li < 0) return;
    const pos = lines.slice(0, li).join('\n').length + (li ? 1 : 0);
    src.selectionStart = src.selectionEnd = pos;
    src.scrollTop = Math.max(0, li * 20 - 80);
    syncScroll();
  }

  // ---- トースト・モバイル ----
  function toast(m) { const t2 = $('toast'); t2.textContent = m; t2.hidden = false; requestAnimationFrame(() => t2.classList.add('on')); clearTimeout(toast._t); toast._t = setTimeout(() => t2.classList.remove('on'), 1600); }
  $('vToggle').onclick = () => { document.body.classList.toggle('viewmax'); setTimeout(() => lmap && lmap.invalidateSize(), 260); };
  $('edToggle').onclick = () => { document.body.classList.toggle('viewmax'); setTimeout(() => lmap && lmap.invalidateSize(), 260); };
  // スマホでは、まず図に全画面を譲る（「コード ◧」で開ける）。
  if (window.matchMedia('(max-width: 820px)').matches) document.body.classList.add('viewmax');
  problems.addEventListener('click', (e) => { const p = e.target.closest('.p'); if (!p || !p.dataset.ln) return; const ln = +p.dataset.ln; const pos = src.value.split('\n').slice(0, ln - 1).join('\n').length + (ln > 1 ? 1 : 0); src.focus(); src.selectionStart = src.selectionEnd = pos; });
  window.addEventListener('resize', () => { if (L) applyView(); if (lmap) lmap.invalidateSize(); });

  // ---- 起動 ----
  function setText(text, doFit) { src.value = text; highlight(); render(); if (doFit) fit(); hideAc(); pushHistory(); }
  const initial = window.STUDIO_SOURCE || SAMPLES[Object.keys(SAMPLES)[0]];
  setText(initial, true);
}

// 単一 HTML 版（build.js が SOURCE を注入）でも同じ boot で動く。
if (typeof window !== 'undefined' && window.STUDIO_AUTOBOOT) boot();
