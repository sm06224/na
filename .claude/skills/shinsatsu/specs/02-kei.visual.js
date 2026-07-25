// 計(読める電卓)— 人間が書き込むと、答えは右に現れるか
//
// 見どころ:
//   - 実打鍵: ASCII はキーイベント、「円」は IME 確定(insertText)で入る
//   - dead input 検出: 打っても答えの欄が変わらなければ FAIL
//   - 画面の観測点: 答えの「値そのもの」を assert(DOM が在るだけでは通さない)

export default {
  name: '計 — 読める電卓に人間が書き込む',

  async run(t) {
    await t.goto('/works/kei/');

    // まっさらにしてから書き始める(前回ノートの復元が入ることがある)
    await t.human.click('#clear');
    await t.page.settle(150);
    const emptied = await t.page.eval(`document.getElementById('src').value`);
    t.expect(emptied === '', '「消す」でノートがまっさらになる');

    await t.human.click('#src');
    await t.act('式を打鍵すると答えが右に現れる', { expect: 'change', sel: 'main.note' }, async () => {
      await t.human.type('1200円 * 3\n5 km in mi\n80 + 8%');
    });

    const rows = await t.page.eval(
      `[...document.getElementById('out').children].map((el) => el.textContent.trim())`,
    );
    t.expect(Array.isArray(rows) && rows.length >= 3, `答えの行が式のぶんある(${rows ? rows.length : 0} 行)`);
    if (Array.isArray(rows)) {
      t.expect(/3[,,]?600/.test(rows[0] || ''), `1200円 × 3 の答えが見えている(「${rows[0]}」)`);
      t.expect(/3\.1/.test(rows[1] || ''), `5 km ≒ 3.1 mi が見えている(「${rows[1]}」)`);
      t.expect(/86\.4/.test(rows[2] || ''), `80 + 8% = 86.4 が見えている(「${rows[2]}」)`);
    }
    await t.shot('書き上がったノート', { sel: 'main.note' });

    // 例ボタンは dead click でないか
    await t.act('「旅費」の例を呼ぶとノートが入れ替わる', { expect: 'change', sel: 'main.note' }, async () => {
      await t.human.click('button[data-ex="旅費"]');
    });
  },
};
