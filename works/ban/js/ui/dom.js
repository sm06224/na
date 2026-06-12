/* ============================================================
   DOM 小道具 — フレームワークを使わないための最小限の腕力。
   ============================================================ */

/* h('div', {class:'x', onclick:fn}, child...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v);
    } else if (k === 'class') {
      el.className = v;
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k in el && k !== 'list' && typeof v !== 'string') {
      el[k] = v;
    } else {
      el.setAttribute(k, v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function download(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ファイル選択 → テキストを返す */
export function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

/* ポップオーバー：anchor の近くに content を出し、外側クリックで閉じる */
let _openPopover = null;
export function popover(anchor, content, { onClose } = {}) {
  closePopover();
  const pop = h('div', { class: 'popover' }, content);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = Math.min(300, innerWidth - 16);
  let x = Math.min(r.left, innerWidth - pw - 8);
  let y = r.bottom + 4;
  pop.style.left = `${Math.max(8, x)}px`;
  pop.style.top = `${y}px`;
  // 画面下にはみ出すなら上に
  requestAnimationFrame(() => {
    const pr = pop.getBoundingClientRect();
    if (pr.bottom > innerHeight - 8) {
      pop.style.top = `${Math.max(8, r.top - pr.height - 4)}px`;
    }
  });
  const close = () => {
    pop.remove();
    document.removeEventListener('pointerdown', onDoc, true);
    _openPopover = null;
    if (onClose) onClose();
  };
  const onDoc = e => { if (!pop.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  _openPopover = close;
  return close;
}
export function closePopover() {
  if (_openPopover) _openPopover();
}

/* 小さなトースト通知 */
export function toast(msg, kind = 'info', ms = 2600) {
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, ms);
}
