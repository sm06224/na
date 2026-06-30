#!/usr/bin/env node
/* ============================================================
   studio のビルダ — .studio 図ひとつ → 自己完結の単一 HTML。
   エンジン（date/parse/layout/serialize/draw/interact）を import/export を
   剥がして 1 本の <script> に畳み、図の DSL を埋め込む。
   出来上がりは依存ゼロ・オフライン・どこでも開ける一枚。
     node build.js examples/release.studio                 → dist/release.html
     node build.js examples/release.studio out.html        → out.html
     node build.js --all                                   → examples/*.studio をすべて
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = ['engine/date.js', 'engine/parse.js', 'engine/layout.js',
  'engine/serialize.js', 'render/draw.js', 'ui/interact.js'];

// ESM を素の <script> 用に畳む：import 行を消し、export キーワードを剥がす。
function bundle() {
  return MODULES.map((m) => {
    const src = readFileSync(join(HERE, m), 'utf8');
    return src.split('\n')
      .filter((l) => !/^\s*import\b/.test(l))
      .map((l) => l.replace(/^\s*export\s+(function|const|class|let)\b/, '$1'))
      .join('\n');
  }).join('\n\n');
}

function html(title, source, engine) {
  const T = title || 'studio diagram';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${escapeHtml(T)} — studio</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body { display: flex; flex-direction: column; background: #0b0e14; color: #e7ebf4;
    font-family: ui-sans-serif, system-ui, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; overflow: hidden;
    -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
  header { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem .6rem;
    padding: calc(.5rem + env(safe-area-inset-top)) .8rem .5rem; border-bottom: 1px solid #1c2230; background: #0e121b; }
  header h1 { font-size: .92rem; font-weight: 600; letter-spacing: .02em; }
  header .sp { flex: 1; }
  #status { font-size: .72rem; color: #8a93a6; flex-basis: 100%; order: 3; }
  #status[data-bad="1"] { color: #f5a36a; }
  button { font: inherit; font-size: .76rem; color: #cfd6e6; background: #18202e; border: 1px solid #2a3344;
    padding: .4em 1em; border-radius: 7px; cursor: pointer; transition: background .15s, border-color .15s; touch-action: manipulation; }
  button:hover { background: #20293a; border-color: #3a4660; }
  main { flex: 1; display: flex; min-height: 0; }
  /* 空きをドラッグすると図がスクロール（パン）し、要素をつかむと動かせる。 */
  #canvas { flex: 1; min-width: 0; overflow: auto; padding: 18px; -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y; background: radial-gradient(120% 100% at 30% 0%, #0f1420, #0b0e14); }
  #canvas svg { display: block; }
  #canvas [data-drag] { touch-action: none; }              /* つかんだ要素はスクロールに取られない */
  #panel { width: 380px; border-left: 1px solid #1c2230; display: flex; flex-direction: column; background: #0c1119; min-height: 0; }
  #panel.hidden { display: none; }
  #panel .lbl { font-size: .68rem; letter-spacing: .12em; color: #6b748a; padding: .5rem .7rem .2rem; text-transform: uppercase; }
  #dsl { flex: 1; resize: none; border: 0; outline: none; background: transparent; color: #cdd5e6;
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12.5px; line-height: 1.65; padding: .3rem .8rem calc(.8rem + env(safe-area-inset-bottom)); tab-size: 2; }
  #toast { position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom)); transform: translateX(-50%); background: #18202e;
    border: 1px solid #2a3344; padding: .5em 1.1em; border-radius: 999px; font-size: .76rem; opacity: 0; transition: opacity .4s; pointer-events: none; }
  #toast.on { opacity: 1; }

  /* スマホ・縦置き：図を上、DSL を下のドロワーに積む。 */
  @media (max-width: 760px) {
    header { gap: .4rem .5rem; }
    header h1 { font-size: .86rem; width: 100%; }
    #status { order: 0; flex-basis: auto; }
    header .sp { display: none; }
    button { font-size: .74rem; padding: .5em .9em; }       /* 指で押しやすく */
    main { flex-direction: column; }
    #canvas { padding: 12px; }
    #panel { width: 100%; height: 44vh; border-left: 0; border-top: 1px solid #1c2230; }
    #dsl { font-size: 13px; }
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(T)}</h1>
  <span id="status"></span>
  <span class="sp"></span>
  <button id="bCopy">コピー</button>
  <button id="bDown">保存</button>
  <button id="bReset">戻す</button>
  <button id="bPanel">DSL ◧</button>
</header>
<main>
  <div id="canvas"></div>
  <div id="panel">
    <div class="lbl">DSL — 書けば図に、図を動かせば書き戻る</div>
    <textarea id="dsl" spellcheck="false"></textarea>
  </div>
</main>
<div id="toast"></div>
<script>
const SOURCE = ${JSON.stringify(source)};
${engine}
const APP = init({
  canvas: document.getElementById('canvas'),
  dsl: document.getElementById('dsl'),
  status: document.getElementById('status'),
  source: SOURCE,
});
const toast = (m) => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1500); };
document.getElementById('bCopy').onclick = async () => { try { await navigator.clipboard.writeText(APP.export()); toast('DSL をコピーしました'); } catch (_) { toast('コピーできませんでした'); } };
document.getElementById('bDown').onclick = () => {
  const blob = new Blob([APP.export()], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = ${JSON.stringify((slug(title) || 'diagram') + '.studio')}; a.click(); URL.revokeObjectURL(a.href); toast('保存しました');
};
document.getElementById('bReset').onclick = () => { APP.reset(); toast('元に戻しました'); };
document.getElementById('bPanel').onclick = () => document.getElementById('panel').classList.toggle('hidden');
// スマホでは、まず図に画面いっぱいを譲る（DSL は「DSL ◧」で開ける）。
if (window.matchMedia('(max-width: 760px)').matches) document.getElementById('panel').classList.add('hidden');
</script>
</body>
</html>
`;
}

const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const slug = (s) => String(s || '').toLowerCase().replace(/[^\w぀-ヿ一-龯]+/g, '-').replace(/^-|-$/g, '');

function titleOf(source) {
  const m = /^\s*title\s+(.+)$/m.exec(source);
  return m ? m[1].trim() : null;
}

function build(input, output) {
  const source = readFileSync(input, 'utf8');
  const out = output || join(HERE, 'dist', basename(input).replace(/\.studio$/, '') + '.html');
  writeFileSync(out, html(titleOf(source), source, bundle()));
  return out;
}

// CLI は直接実行のときだけ走らせる（import 時は静かに）。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--all') {
    const dir = join(HERE, 'examples');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.studio')))
      console.log('built', build(join(dir, f)));
  } else if (argv.length) {
    console.log('built', build(argv[0], argv[1]));
  } else {
    console.error('usage: node build.js <file.studio> [out.html]  |  node build.js --all');
    process.exit(1);
  }
}

export { bundle, html, build };
