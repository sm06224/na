/* ============================================================
   場所 — 刺した針の覚え書きと、分かち合いのことば。

   覚え書きは端末の中だけ（保存の器は外から渡す。テストでは素の
   オブジェクト、ブラウザでは localStorage）。
   分かち合いは URL のかけら（#s=…）に座標を畳む。サーバーは無い。
   リンクを渡すことが、場所を渡すことのすべて。
   ============================================================ */

/* ----- 分かち合いのことば（URL fragment codec） -----
   緯度経度は 1e-5 度（約 1.1 m）で量子化し、負を避けるため
   +90 / +180 してから 36 進数に畳む。精度 [m] と名前を添える。 */

export function encodeSpotLink({ lat, lon, name = '', acc = 0 }) {
  const la = Math.round((lat + 90) * 1e5).toString(36);
  const lo = Math.round((lon + 180) * 1e5).toString(36);
  const ac = Math.min(9999, Math.max(0, Math.round(acc))).toString(36);
  const nm = encodeURIComponent(String(name).slice(0, 40));
  return `s=${la}.${lo}.${ac}${nm ? '.' + nm : ''}`;
}

export function decodeSpotLink(fragment) {
  const m = String(fragment || '').replace(/^#/, '').match(/(?:^|&)s=([^&]+)/);
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length < 3) return null;
  const la = parseInt(parts[0], 36), lo = parseInt(parts[1], 36), ac = parseInt(parts[2], 36);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const lat = la / 1e5 - 90, lon = lo / 1e5 - 180;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  let name = '';
  if (parts[3] !== undefined) {
    try { name = decodeURIComponent(parts.slice(3).join('.')); } catch { name = ''; }
  }
  return { lat, lon, acc: Number.isFinite(ac) ? ac : 0, name };
}

/* ----- 覚え書き ----- */

const ICONS = ['📍', '🚗', '⛺', '🚲', '🏠', '🚪', '🌸', '🅿️'];

export class Spots {
  constructor(saved = null) {
    this.list = [];
    if (saved) this.load(saved);
  }

  load(json) {
    try {
      const arr = typeof json === 'string' ? JSON.parse(json) : json;
      if (Array.isArray(arr)) {
        this.list = arr.filter(s =>
          s && Number.isFinite(s.lat) && Number.isFinite(s.lon) && s.id);
      }
    } catch { this.list = []; }
    return this;
  }

  save() { return JSON.stringify(this.list); }

  /* 刺す。名前が無ければ「針 N」。新しいものが先頭 */
  pin({ lat, lon, acc = 0, name = '', icon = '' }) {
    const spot = {
      id: `${Date.now().toString(36)}${(Math.random() * 1296 | 0).toString(36)}`,
      name: name || `針 ${this.list.length + 1}`,
      icon: icon || ICONS[0],
      lat, lon,
      acc: Math.round(acc),
      at: Date.now(),
    };
    this.list.unshift(spot);
    return spot;
  }

  get(id) { return this.list.find(s => s.id === id) ?? null; }

  rename(id, name, icon) {
    const s = this.get(id);
    if (!s) return false;
    if (name !== undefined && name !== '') s.name = String(name).slice(0, 40);
    if (icon !== undefined && icon !== '') s.icon = String(icon).slice(0, 4);
    return true;
  }

  remove(id) {
    const before = this.list.length;
    this.list = this.list.filter(s => s.id !== id);
    return this.list.length < before;
  }

  static get ICONS() { return ICONS; }
}

/* 刺した時刻のことば（一覧に添える） */
export function fmtAge(at, now = Date.now()) {
  const m = Math.floor((now - at) / 60000);
  if (m < 1) return 'たったいま';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}日前` : `${Math.floor(d / 30)}か月前`;
}
