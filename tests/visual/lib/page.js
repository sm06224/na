// タブ 1 枚ぶんの操作面 — goto / evaluate / screenshot / ページの悲鳴の記録
//
// ページ内で起きた例外・console.error・リソース読み込み失敗は issues に積まれ、
// runner がスペック終了時に「よくない動き」として取り立てる。

import { sleep } from './util.js';

export class VisualPage {
  /** @param {import('./cdp.js').Cdp} cdp */
  constructor(cdp, sessionId, targetId, size) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.size = size;
    this.issues = []; // { kind, message }
  }

  static async open(cdp, { width = 1280, height = 900 } = {}) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new VisualPage(cdp, sessionId, targetId, { width, height });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Target.activateTarget', { targetId }).catch(() => {});

    cdp.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails;
      page.issues.push({ kind: 'exception', message: d?.exception?.description || d?.text || '不明な例外' });
    }, sessionId);
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error' || p.type === 'assert') {
        const msg = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        page.issues.push({ kind: `console.${p.type}`, message: msg });
      }
    }, sessionId);
    cdp.on('Log.entryAdded', (p) => {
      if (p.entry?.level === 'error') {
        page.issues.push({ kind: `log.${p.entry.source || '?'}`, message: `${p.entry.text}${p.entry.url ? ` (${p.entry.url})` : ''}` });
      }
    }, sessionId);
    return page;
  }

  async goto(url, { timeout = 20000 } = {}) {
    const loaded = this.cdp.waitFor('Page.loadEventFired', this.sessionId, { timeout });
    const nav = await this.cdp.send('Page.navigate', { url }, this.sessionId);
    if (nav.errorText) throw new Error(`遷移できない: ${url} (${nav.errorText})`);
    await loaded;
    await this.settle(150);
  }

  /** ページ内で式を評価して値を返す(Promise は await される) */
  async eval(expression) {
    const r = await this.cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, this.sessionId);
    if (r.exceptionDetails) {
      throw new Error(`ページ内評価が失敗: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
    return r.result?.value;
  }

  /** 描画フレームを 2 回またいで静定を待つ */
  async settle(ms = 100) {
    await this.eval('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))').catch(() => {});
    await sleep(ms);
  }

  /** 式が truthy になるまで待つ(遷移中の評価失敗は握って再挑戦) */
  async waitFor(expression, { timeout = 8000, every = 120, label } = {}) {
    const t0 = Date.now();
    for (;;) {
      const v = await this.eval(expression).catch(() => undefined);
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error(`待ちきれない: ${label || expression}`);
      await sleep(every);
    }
  }

  /**
   * スクリーンショット。clip はページ座標(スクロール込み)。
   * @returns {Promise<Buffer>} PNG
   */
  async screenshot({ clip } = {}) {
    const params = { format: 'png' };
    if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
    const { data } = await this.cdp.send('Page.captureScreenshot', params, this.sessionId);
    return Buffer.from(data, 'base64');
  }

  /** selector の viewport 座標の矩形(mouse 用)。無ければ null。 */
  async rect(selector) {
    return await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    })()`);
  }

  /** selector のページ座標の矩形(screenshot clip 用)。無ければ null。 */
  async pageRect(selector) {
    return await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height };
    })()`);
  }

  async close() {
    await this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}
