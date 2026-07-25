// 反(リバーシ)— 盤に置く手と、動いてはいけない盤
//
// 見どころ:
//   - 期待どおり「効かない」ことの検証: 打てない隅を押しても盤は動かない
//     (勝手に石が置けたらそれこそバグ)
//   - 候補マスへの実クリック → AI の応手まで待つ → 石とスコアで確かめる
//   - 画面が嘘をつかないこと: スコア表示と盤上の石の数の一致(parity)

export default {
  name: '反 — 盤に石を置く手、動いてはいけない盤',

  async run(t) {
    await t.goto('/works/han/');

    const discs0 = await t.page.eval(`document.querySelectorAll('#board .disc').length`);
    t.expect(discs0 === 4, `初期盤面に石が 4 つ(実際 ${discs0})`);
    await t.shot('初期盤面', { sel: 'main' });

    // 打てないマス(隅)は押しても何も起きないのが正しい
    await t.act('打てない隅を押しても盤は動かない', { expect: 'none', sel: '#board', ratio: 0.004 }, async () => {
      await t.human.click('#board .cell[data-i="0"]');
    });

    // 候補マスに置く → AI が応じ終わるまで(status が「あなたの番」へ戻る)
    await t.act('候補マスに石を置くと盤が応える', { expect: 'change', sel: '#board' }, async () => {
      await t.human.click('#board .cell.playable');
      await t.page.waitFor(
        `document.getElementById('status').textContent === 'あなたの番'`,
        { timeout: 20000, label: 'AI の応手が終わる' },
      );
    });

    const discs1 = await t.page.eval(`document.querySelectorAll('#board .disc').length`);
    t.expect(discs1 >= 6, `一往復で石が 6 つ以上に増える(実際 ${discs1})`);

    const nb = Number(await t.page.eval(`document.getElementById('n-black').textContent`));
    const nw = Number(await t.page.eval(`document.getElementById('n-white').textContent`));
    t.expect(nb + nw === discs1, `スコア表示(黒 ${nb} + 白 ${nw})と盤上の石(${discs1})が一致 — 画面が嘘をつかない`);
    await t.shot('一往復後の盤面', { sel: 'main' });
  },
};
