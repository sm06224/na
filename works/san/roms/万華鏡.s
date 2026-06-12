; ============================================================
; 万華鏡 — 紙きれ一枚ぶんの乱数が、鏡で八枚になる。
;
; なにか：毎フレーム、乱数で点をいくつか選び、八回対称
;         （左右・上下・斜めの鏡）に同じ色を置いてゆく。
;         色は時（FRAME）からゆっくり巡る。数百フレームに一度、
;         夜が偶数の段をさらって、模様が入れ替わる。
; あそびかた：見る。筒をのぞく遊びなので、ボタンはない。
;         回したければ、待てばよい。
;
; たくらみ：画面は 128×96 で正方形ではないから、斜めの鏡は
; 中央の正方形（x が 16..111 の 96×96）の中に立てる。
; 点 (u,v) は (16+u,v) (111-u,v) (16+u,95-v) (111-u,95-v) と、
; u と v を入れ替えた 4 つ、あわせて 8 つになって現れる。
; 111-u = 127-(16+u) だから、左右の鏡は画面全体でも成り立つ。
; ============================================================

.const 画面, 0x8000      ; VRAM の先頭
.const 見せろ, 0xF000    ; FLIP
.const 時, 0xF001        ; FRAME
.const 乱, 0xF004        ; 乱数

主:
  ; ---- 240 フレームに一度、夜が偶数の段をさらう ----
  ; 段ごと消すので左右の鏡は壊れない。模様は半分だけ残って
  ; 次の模様と混ざり、万華鏡が回ったように見える。
  LDI r0, 時
  LD r7, [r0]
  MOV r0, r7
  LDI r1, 240
  MOD r0, r1
  CMPI r0, 0
  JNZ 夜はまだ
  CALL 夜が拭く
夜はまだ:

  ; ---- 色は時からゆっくり（16 フレームでひと色、墨は使わない） ----
  MOV r6, r7
  LDI r0, 4
  SHR r6, r0
  LDI r0, 15
  MOD r6, r0
  ADDI r6, 1             ; r6 = 1..15

  ; ---- 1 フレームに 4 粒、それぞれ 8 つの鏡像に ----
  LDI r5, 4
粒:
  PUSH r5
  LDI r0, 乱
  LD r4, [r0]
  LDI r1, 96
  MOD r4, r1             ; r4 = u（0..95）
  LD r5, [r0]
  LDI r1, 96
  MOD r5, r1             ; r5 = v（0..95）

  ; (16+u, v)
  MOV r0, r4
  ADDI r0, 16
  MOV r1, r5
  MOV r2, r6
  CALL 点
  ; (111-u, v) — 左右の鏡
  LDI r0, 111
  SUB r0, r4
  MOV r1, r5
  MOV r2, r6
  CALL 点
  ; (16+u, 95-v) — 上下の鏡
  MOV r0, r4
  ADDI r0, 16
  LDI r1, 95
  SUB r1, r5
  MOV r2, r6
  CALL 点
  ; (111-u, 95-v) — 点対称
  LDI r0, 111
  SUB r0, r4
  LDI r1, 95
  SUB r1, r5
  MOV r2, r6
  CALL 点
  ; (16+v, u) — 斜めの鏡
  MOV r0, r5
  ADDI r0, 16
  MOV r1, r4
  MOV r2, r6
  CALL 点
  ; (111-v, u)
  LDI r0, 111
  SUB r0, r5
  MOV r1, r4
  MOV r2, r6
  CALL 点
  ; (16+v, 95-u)
  MOV r0, r5
  ADDI r0, 16
  LDI r1, 95
  SUB r1, r4
  MOV r2, r6
  CALL 点
  ; (111-v, 95-u)
  LDI r0, 111
  SUB r0, r5
  LDI r1, 95
  SUB r1, r4
  MOV r2, r6
  CALL 点

  POP r5
  SUBI r5, 1
  JNZ 粒

  CALL 見せる
  JMP 主                 ; 筒は回りつづける

; ---- 夜が拭く：偶数の段（y が偶数）を墨に返す ----
夜が拭く:
  PUSH r4
  PUSH r5
  LDI r4, 0              ; y（偶数だけ）
拭く段:
  MOV r0, r4
  LDI r1, 5
  SHL r0, r1
  ADDI r0, 画面          ; 段の先頭の語
  LDI r1, 0
  LDI r5, 32
拭く語:
  ST [r0], r1
  ADDI r0, 1
  SUBI r5, 1
  JNZ 拭く語
  ADDI r4, 2
  CMPI r4, 96
  JNZ 拭く段
  POP r5
  POP r4
  RET

; ---- 点を打つ：r0=x r1=y r2=色。r0-r3 を壊し、r4 以降は守る ----
点:
  PUSH r4
  PUSH r5
  MOV r3, r1
  LDI r4, 5
  SHL r3, r4             ; y*32
  MOV r4, r0
  LDI r5, 2
  SHR r4, r5             ; x>>2
  ADD r3, r4
  ADDI r3, 画面          ; r3 = 語の番地
  LDI r4, 3
  AND r4, r0             ; x&3
  LDI r5, 2
  SHL r4, r5             ; ずらし幅 = (x&3)*4
  LDI r5, 0xF
  SHL r5, r4
  NOT r5
  LD r0, [r3]
  AND r0, r5             ; 古い色を消す
  MOV r5, r2
  SHL r5, r4
  OR r0, r5              ; 新しい色を据える
  ST [r3], r0
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
