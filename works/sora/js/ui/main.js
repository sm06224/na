/* ============================================================
   宙 — main. メガデモ本体。オーディオ時計に同期して、演出表の
   とおりに場面を描き、変わり目で溶暗し、スクローラーを流す。
   音は最初のクリック（起動）で目を覚ます。
   ============================================================ */

import { sceneAt, intensityAt, SCENES } from '../core/director.js';
import { stepAt, notesAtStep, STEP } from '../core/music.js';
import { Engine } from './audio.js';
import * as fx from './fx.js';

const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
const engine = new Engine();

const GREETS =
  '宙  SORA  —  a space megademo, conjured from nothing.    ' +
  'greetings fly out to every work in this little cosmos:  ' +
  '庭 ・ 生 ・ 史 ・ 番 ・ 言 ・ 歌 ・ 備 ・ 奏 ・ 苔 ・ 織 ・ 算 ・ 針 ・ 狐 ・ 星 ・ 雷 ・ 陽 ・ 割 ・ 窟 ・ 種 ・ 籤 ・ 波 ・ 陣 ・ 層 ・ 雪 ・ 響 ・ 段 ・ 宙 .    ' +
  'and to the hands that dug before us — ユツヤ, and everyone who left a stripe in the rock.    ' +
  'code is a place you can live in.  leave it warmer than you found it.    ' +
  '— 六花のロク was here —      wrap around …        ';
const INFO =
  '宙 / sora ... press [F] fullscreen ... [space] pause ... [R] restart ... no dependencies, no assets — sound and stars are synthesized from nothing ... same as it ever was ...        ';

const st = { last: 0, t: 0, paused: false, started: false, greetX: 0, infoX: 0, greetW: 1, infoW: 1 };

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.floor(innerWidth * dpr);
  cv.height = Math.floor(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
}
addEventListener('resize', fit); fit();

/* 場面ひとつを描く。 */
function renderScene(id, t, s, W, H) {
  switch (id) {
    case 'title': fx.title(ctx, W, H, t, s ? s.u : 0); break;
    case 'warp': fx.starfield(ctx, W, H, { streak: 1 }); break;
    case 'nebula': fx.nebula(ctx, W, H, t); break;
    case 'planet': fx.planet(ctx, W, H, t); break;
    case 'tunnel': fx.wormhole(ctx, W, H, t); break;
    case 'greets': fx.copperScroller(ctx, W, H, t, GREETS, st.greetX); break;
  }
}

/* 星の速さ：ワープで加速、ほかはゆっくり漂う。 */
function starSpeed(s) {
  if (s.id === 'warp') return 140 + 520 * Math.min(1, s.local / 8);
  if (s.id === 'greets' || s.id === 'title') return 24;
  return 12;
}

function frame(now) {
  requestAnimationFrame(frame);
  const W = cv.width, H = cv.height;
  let dt = (now - st.last) / 1000; st.last = now;
  if (!isFinite(dt) || dt > 0.1) dt = 0.016;
  if (st.paused || !st.started) return;

  const t = engine.now();
  st.t = t;
  const s = sceneAt(t);
  engine.setScene(s.id);

  fx.advanceStars(dt, starSpeed(s));

  // 現在の場面
  renderScene(s.id, t, s, W, H);
  // 溶暗で次の場面を重ねる
  if (s.blend) {
    ctx.save(); ctx.globalAlpha = s.blend.k;
    const next = SCENES[s.blend.to];
    renderScene(next.id, t, { u: 0, local: 0 }, W, H);
    ctx.restore();
  }

  // ビートの閃光（キックに合わせて淡く）
  const kf = t / STEP, step = Math.floor(kf);
  if (notesAtStep(step).kick) {
    const a = (1 - (kf - step)) * 0.12;
    ctx.fillStyle = `rgba(180,210,255,${a})`; ctx.fillRect(0, 0, W, H);
  }

  // スクローラー（情報行は全編、グリーティングは挨拶の場面で動かす）
  st.infoX += dt * 90; if (st.infoX > st.infoW + W) st.infoX -= st.infoW + W;
  st.infoW = fx.infoLine(ctx, W, H, t, INFO, st.infoX);
  if (s.id === 'greets') { st.greetX += dt * 120; if (st.greetX > st.greetW + W) st.greetX = 0; }
  // greetW を毎フレーム概算（フォント幅から）
  st.greetW = Math.min(W * 0.07, 40) * 0.62 * GREETS.length;
}
requestAnimationFrame(frame);

/* 起動・操作 */
const overlay = document.getElementById('overlay');
function launch() {
  if (st.started) return;
  st.started = true;
  engine.start();
  st.last = performance.now();
  overlay.classList.add('gone');
}
document.getElementById('launch').onclick = launch;
overlay.onclick = launch;

addEventListener('keydown', e => {
  if (e.key === ' ') { st.paused = !st.paused; if (!st.paused) { st.last = performance.now(); engine.resume(); } e.preventDefault(); }
  else if (e.key === 'f' || e.key === 'F') { if (!document.fullscreenElement) cv.requestFullscreen?.(); else document.exitFullscreen?.(); }
  else if (e.key === 'r' || e.key === 'R') { if (engine.ctx) { engine.t0 = engine.ctx.currentTime + 0.1; engine.nextStep = 0; } }
});
