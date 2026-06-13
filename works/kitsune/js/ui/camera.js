/* 写真の証明 — その場の一枚を、思い出の大きさに畳む。

   端末の中だけで完結する。標準のカメラ入力（capture）で撮り、
   canvas で長辺 360px まで縮めて JPEG にする。原寸は保存しない
   （localStorage に何百枚も入れない・写真は外へ出さない）。 */

const MAX_EDGE = 360;
const QUALITY = 0.6;

/* <input type=file accept=image/* capture> から来た File を縮小 dataURL に。
   返り値は Promise<dataURL> か、読めなければ Promise<null>。 */
export function shrinkPhoto(file) {
  return new Promise(resolve => {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', QUALITY));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* カメラを開いて一枚もらう。<input capture=environment> を一度きり生成して押す。
   ユーザー操作（クリック）の中から呼ぶこと。 */
export function takePhoto() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let settled = false;
    const finish = async file => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file ? await shrinkPhoto(file) : null);
    };
    input.addEventListener('change', () => finish(input.files && input.files[0]));
    // キャンセルを拾う術は限られるので、フォーカスが戻って暫くしても
    // change が来なければ諦める（写真なしで返す）
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
