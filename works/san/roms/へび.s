; ============================================================
; へび — 4 画素角の升目 32×24 を這う、いちばん古いかたちの遊び。
;
; なにか：若竹色（色11）の体に刈安色（色12）の頭。茜色（色4）の
;         餌を食べると一升ぶん伸び、得点がシリアルに「得点 N」と
;         流れる。壁か自分にぶつかると止まり、開始ボタンを待つ。
; あそびかた：十字キーで向きを変える（真後ろへは戻れない）。
;         8 フレームに一歩。死んだら開始（64）でもう一度。
;         最初の餌だけは道の先（24,12）に置いてある——
;         電源を入れてなにもしなくても、一口は食べられるように。
;
; たくらみ：体は添字 64 のリングバッファ。頭の添字だけ進め、
; 尻尾は長さの外に置き去りにする。伸びるとは、置き去りに
; しないこと。
; ============================================================

.const 画面, 0x8000      ; VRAM の先頭
.const 見せろ, 0xF000    ; FLIP
.const 押下, 0xF003      ; このフレームに押された瞬間のボタン
.const 乱, 0xF004        ; 乱数
.const 口, 0xF006        ; シリアル出力
.const 環, 63            ; リングの覆い（64 升ぶん）

; ---- 初期化：死んで戻ってくるのもここ ----
初期化:
  LDI r6, 0
  ; 向きは右。願い（押された向き）も右
  LDI r0, 1
  ST [r6+向きx], r0
  ST [r6+願いx], r0
  LDI r0, 0
  ST [r6+向きy], r0
  ST [r6+願いy], r0
  ; 体は 3 升、(14,12)(15,12)(16,12)。頭は添字 2
  LDI r0, 14
  ST [r6+体x], r0
  LDI r0, 15
  ST [r6+体x+1], r0
  LDI r0, 16
  ST [r6+体x+2], r0
  LDI r0, 12
  ST [r6+体y], r0
  ST [r6+体y+1], r0
  ST [r6+体y+2], r0
  LDI r0, 2
  ST [r6+頭], r0
  LDI r0, 3
  ST [r6+長さ], r0
  ; 最初の餌は道の先に
  LDI r0, 24
  ST [r6+餌x], r0
  LDI r0, 12
  ST [r6+餌y], r0
  LDI r0, 0
  ST [r6+得点], r0
  ST [r6+鼓動], r0
  LDI r0, 1
  ST [r6+生死], r0

; ---- 毎フレーム ----
主:
  LDI r6, 0
  LD r0, [r6+生死]
  CMPI r0, 0
  JZ 屍                  ; 死んでいるなら、開始を待つだけ

  ; ---- 願う向き：押した瞬間で受けておく ----
  LDI r0, 押下
  LD r0, [r0]
  MOV r1, r0
  LDI r2, 1
  AND r1, r2
  JZ 上でない
  LDI r1, 0
  ST [r6+願いx], r1
  LDI r1, -1
  ST [r6+願いy], r1
上でない:
  MOV r1, r0
  LDI r2, 2
  AND r1, r2
  JZ 下でない
  LDI r1, 0
  ST [r6+願いx], r1
  LDI r1, 1
  ST [r6+願いy], r1
下でない:
  MOV r1, r0
  LDI r2, 4
  AND r1, r2
  JZ 左でない
  LDI r1, -1
  ST [r6+願いx], r1
  LDI r1, 0
  ST [r6+願いy], r1
左でない:
  MOV r1, r0
  LDI r2, 8
  AND r1, r2
  JZ 右でない
  LDI r1, 1
  ST [r6+願いx], r1
  LDI r1, 0
  ST [r6+願いy], r1
右でない:

  ; ---- 鼓動：8 フレームに一歩 ----
  LD r0, [r6+鼓動]
  ADDI r0, 1
  ST [r6+鼓動], r0
  LDI r1, 7
  AND r0, r1
  JNZ 描画               ; まだ歩く時ではない

  ; ---- 向きを改める。真後ろ（足し合わせて両方 0）は聞き流す ----
  LD r0, [r6+願いx]
  LD r1, [r6+願いy]
  LD r2, [r6+向きx]
  LD r3, [r6+向きy]
  ADD r2, r0
  JNZ 向き採用           ; x が打ち消し合わなければ真後ろではない
  ADD r3, r1
  JZ 向き据え置き        ; 両方打ち消し合う＝真後ろ。へびは折れない
向き採用:
  ST [r6+向きx], r0
  ST [r6+向きy], r1
向き据え置き:

  ; ---- 新しい頭の升 (r2, r3) ----
  LD r0, [r6+頭]
  LD r2, [r0+体x]
  LD r3, [r0+体y]
  LD r1, [r6+向きx]
  ADD r2, r1
  LD r1, [r6+向きy]
  ADD r3, r1

  ; ---- 壁：升目の外は世界の外 ----
  CMPI r2, 0
  JLT 死ぬ
  CMPI r2, 32
  JGE 死ぬ
  CMPI r3, 0
  JLT 死ぬ
  CMPI r3, 24
  JGE 死ぬ

  ; ---- 自分：体のどこかに頭から突っ込んだら終わり ----
  LDI r4, 0              ; r4 = 頭から数えて何節目
自分調べ:
  LD r1, [r6+長さ]
  CMP r4, r1
  JGE 自分調べ終わり
  LD r0, [r6+頭]
  SUB r0, r4
  LDI r1, 環
  AND r0, r1             ; 添字 = (頭-節)&63
  LD r1, [r0+体x]
  CMP r1, r2
  JNZ 自分次
  LD r1, [r0+体y]
  CMP r1, r3
  JZ 死ぬ
自分次:
  ADDI r4, 1
  JMP 自分調べ
自分調べ終わり:

  ; ---- 餌：頭が重なったら、伸びて、点が入り、次の餌が湧く ----
  LD r0, [r6+餌x]
  CMP r0, r2
  JNZ 餌でない
  LD r0, [r6+餌y]
  CMP r0, r3
  JNZ 餌でない
  LD r0, [r6+長さ]
  ADDI r0, 1
  CMPI r0, 60
  JLE 伸びてよし         ; リングが一周しない程度に
  LDI r0, 60
伸びてよし:
  ST [r6+長さ], r0
  LD r0, [r6+得点]
  ADDI r0, 1
  ST [r6+得点], r0
  CALL 得点告げ
  LDI r0, 乱             ; 次の餌は乱数の置くところに
  LD r1, [r0]
  LDI r5, 31
  AND r1, r5
  ST [r6+餌x], r1
  LD r1, [r0]
  LDI r5, 24
  MOD r1, r5
  ST [r6+餌y], r1
餌でない:

  ; ---- 頭を進める。尻尾は長さの外に置き去りになる ----
  LD r0, [r6+頭]
  ADDI r0, 1
  LDI r1, 環
  AND r0, r1
  ST [r6+頭], r0
  ST [r0+体x], r2
  ST [r0+体y], r3
  JMP 描画

死ぬ:
  LDI r0, 0
  ST [r6+生死], r0
  JMP 描画               ; 最期の姿を描いてから止まる

; ---- 屍：画面はそのまま、開始（64）だけを聞いている ----
屍:
  LDI r0, 押下
  LD r0, [r0]
  LDI r1, 64
  AND r0, r1
  JZ 屍待ち
  JMP 初期化             ; もう一度
屍待ち:
  CALL 見せる
  JMP 主

; ---- 描画：闇に返し、餌と体を升で塗る ----
描画:
  CALL 消す
  LD r0, [r6+餌x]
  LD r1, [r6+餌y]
  LDI r2, 4              ; 茜の餌
  CALL 升
  LDI r4, 0              ; 頭から尻尾へ
体描き:
  LD r1, [r6+長さ]
  CMP r4, r1
  JGE 体描き終わり
  LD r3, [r6+頭]
  SUB r3, r4
  LDI r1, 環
  AND r3, r1
  LD r0, [r3+体x]
  LD r1, [r3+体y]
  LDI r2, 11             ; 若竹の体
  CMPI r4, 0
  JNZ 体色よし
  LDI r2, 12             ; 頭だけ刈安
体色よし:
  CALL 升
  ADDI r4, 1
  JMP 体描き
体描き終わり:
  CALL 見せる
  JMP 主

; ---- 升：r0=升x r1=升y r2=色。4×4 画素を語 4 つで塗る ----
; 升の幅はちょうど 1 語（4 画素）なので、同じ色 4 つの語を
; 4 段に置くだけでよい。
升:
  LDI r3, 7
  SHL r1, r3             ; 升y*128 = 画素 4 段ぶん
  ADD r1, r0
  ADDI r1, 画面          ; r1 = 左上の語
  LDI r3, 0x1111
  MUL r2, r3
  ST [r1], r2
  ST [r1+32], r2
  ST [r1+64], r2
  ST [r1+96], r2
  RET

; ---- 消す：画面ぜんぶを墨に ----
消す:
  LDI r0, 画面
  LDI r1, 0
消し続き:
  ST [r0], r1
  ADDI r0, 1
  CMPI r0, 0x8C00
  JNZ 消し続き
  RET

; ---- 得点告げ：シリアルに「得点 N」と一行 ----
得点告げ:
  PUSH r2
  PUSH r3
  LDI r0, 口
  LDI r1, '得'
  ST [r0], r1
  LDI r1, '点'
  ST [r0], r1
  LDI r1, ' '
  ST [r0], r1
  LD r0, [r6+得点]
  CALL 十進
  LDI r0, 口
  LDI r1, '\n'
  ST [r0], r1
  POP r3
  POP r2
  RET

; ---- 十進：r0 の値を十進の字で口へ。r0, r1 を壊す ----
; 10 で割っては余りを積み、積んだ順の逆に吐く。
十進:
  PUSH r4
  PUSH r5
  LDI r4, 0              ; 積んだ桁の数
  LDI r5, 10
十進割り:
  MOV r1, r0
  MOD r1, r5
  ADDI r1, '0'
  PUSH r1
  ADDI r4, 1
  DIV r0, r5
  CMPI r0, 0
  JNZ 十進割り
十進吐き:
  POP r1
  LDI r0, 口
  ST [r0], r1
  SUBI r4, 1
  JNZ 十進吐き
  POP r5
  POP r4
  RET

; ---- 見せる：FLIP に書き、ホストが下ろすまで待つ ----
見せる:
  LDI r0, 見せろ
  LDI r1, 1
  ST [r0], r1
見せ待ち:
  LD r1, [r0]
  CMPI r1, 0
  JNZ 見せ待ち
  RET

; ---- へびの記憶 ----
向きx: .word 0           ; いま進んでいる向き
向きy: .word 0
願いx: .word 0           ; 次に進みたい向き（ボタンの願い）
願いy: .word 0
頭:    .word 0           ; リングの中の頭の添字
長さ:  .word 0
餌x:   .word 0
餌y:   .word 0
得点:  .word 0
生死:  .word 0           ; 1 で生きている
鼓動:  .word 0           ; 歩く間合いの数え
体x:   .space 64         ; 体のリングバッファ
体y:   .space 64
