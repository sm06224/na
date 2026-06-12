; ============================================================
; 蛍 — この作品集の川辺に棲む生き物が、機械の中でもう一度生きる。
;
; なにか：八匹の蛍。それぞれが居場所と明滅の位相を持ち、
;         乱数に揺られてさまよい、めいめいの拍で灯っては消える。
;         灯りの芯は刈安（色12）、灯りはじめと消えぎわは金茶（色13）。
;         消えているあいだは、闇にまぎれて見えない——
;         端末に棲む『蛍』がそうであるように、灯っているあいだだけ
;         そこにいるとわかる。画面の下端には土手の草（色10/11）。
; あそびかた：十字キーで風が吹く。八匹がいっせいに流される。
;         風が止めば、また思い思いにさまよう。
;
; たくらみ：位置と位相は .space の配列に持ち、RAND で蒔く。
; 乱数は決定的（同じ種なら同じ夜）だが、それでも揺らぎは揺らぎ。
; ============================================================

.const 画面, 0x8000      ; VRAM の先頭
.const 見せろ, 0xF000    ; FLIP
.const 釦, 0xF002        ; いま押されているボタン
.const 乱, 0xF004        ; 読むたび次の乱数
.const 匹数, 8

; ---- はじめに：蛍を乱数でばらまく ----
  LDI r6, 0              ; r6 = 何匹目
蒔く:
  LDI r0, 乱
  LD r1, [r0]
  LDI r2, 127
  AND r1, r2             ; x は 0..127 のどこか
  ST [r6+蛍x], r1
  LD r1, [r0]
  LDI r2, 63
  AND r1, r2
  ADDI r1, 12            ; y は 12..75 — 草より上の闇に
  ST [r6+蛍y], r1
  LD r1, [r0]
  LDI r2, 31
  AND r1, r2             ; 明滅の位相 — 最初はばらばら
  ST [r6+蛍相], r1
  ADDI r6, 1
  CMPI r6, 匹数
  JNZ 蒔く

; ---- 毎フレーム：夜を描き直す ----
主:
  CALL 消す              ; 夜は毎晩あたらしい闇から
  CALL 草

  ; ---- 風を読む（十字キー → 全員が流れる向き） ----
  LDI r0, 釦
  LD r0, [r0]
  LDI r4, 0              ; r4 = 風x
  LDI r5, 0              ; r5 = 風y
  MOV r1, r0
  LDI r2, 8
  AND r1, r2
  JZ 右風なし
  ADDI r4, 1             ; → で東風
右風なし:
  MOV r1, r0
  LDI r2, 4
  AND r1, r2
  JZ 左風なし
  SUBI r4, 1             ; ← で西風
左風なし:
  MOV r1, r0
  LDI r2, 1
  AND r1, r2
  JZ 上風なし
  SUBI r5, 1             ; ↑ で吹き上げ
上風なし:
  MOV r1, r0
  LDI r2, 2
  AND r1, r2
  JZ 下風なし
  ADDI r5, 1             ; ↓ で吹き下ろし
下風なし:

  ; ---- 一匹ずつ：ゆらぎ、流され、灯る ----
  LDI r6, 0
一匹:
  ; x のゆらぎ（-1, 0, +1 のどれか）と風
  LDI r0, 乱
  LD r1, [r0]
  LDI r2, 3
  MOD r1, r2
  SUBI r1, 1
  LD r3, [r6+蛍x]
  ADD r3, r1
  ADD r3, r4
  CMPI r3, 1
  JGE x左よし
  LDI r3, 1              ; 左の岸で立ち止まる
x左よし:
  CMPI r3, 126
  JLE x右よし
  LDI r3, 126            ; 右の岸で立ち止まる
x右よし:
  ST [r6+蛍x], r3

  ; y のゆらぎと風
  LDI r0, 乱
  LD r1, [r0]
  LDI r2, 3
  MOD r1, r2
  SUBI r1, 1
  LD r3, [r6+蛍y]
  ADD r3, r1
  ADD r3, r5
  CMPI r3, 2
  JGE y上よし
  LDI r3, 2              ; 空には昇りすぎない
y上よし:
  CMPI r3, 88
  JLE y下よし
  LDI r3, 88             ; 草には潜らない
y下よし:
  ST [r6+蛍y], r3

  ; 明滅：位相を進め、32 拍のうち前 20 拍だけ灯る
  LD r3, [r6+蛍相]
  ADDI r3, 1
  ST [r6+蛍相], r3
  LDI r2, 31
  AND r3, r2
  CMPI r3, 20
  JGE 灯らない           ; 拍の後ろは闇にまぎれている
  LDI r2, 12             ; 刈安 — いちばん明るいとき
  CMPI r3, 10
  JLT 色よし
  LDI r2, 13             ; 金茶 — 灯りはじめ・消えぎわ
色よし:
  LD r0, [r6+蛍x]
  LD r1, [r6+蛍y]
  CALL 点
灯らない:
  ADDI r6, 1
  CMPI r6, 匹数
  JNZ 一匹

  CALL 見せる
  JMP 主                 ; 夜は明けない

; ---- 消す：画面ぜんぶを墨（色0）に返す ----
消す:
  LDI r0, 画面
  LDI r1, 0
消し続き:
  ST [r0], r1
  ADDI r0, 1
  CMPI r0, 0x8C00        ; VRAM の終わりまで
  JNZ 消し続き
  RET

; ---- 草：下端の土手。背丈は x から決まる（毎晩おなじ岸辺） ----
草:
  PUSH r4
  PUSH r5
  LDI r4, 0              ; r4 = x
草続き:
  MOV r5, r4
  LDI r1, 13
  MUL r5, r1
  LDI r1, 7
  AND r5, r1             ; 背丈のたね（0..7）
  MOV r0, r4
  LDI r1, 95
  LDI r2, 10             ; 萌黄
  CALL 点
  CMPI r5, 2
  JLT 草低い
  MOV r0, r4
  LDI r1, 94
  LDI r2, 11             ; 若竹
  CALL 点
草低い:
  CMPI r5, 5
  JLT 草次へ
  MOV r0, r4
  LDI r1, 93
  LDI r2, 10
  CALL 点
草次へ:
  ADDI r4, 1
  CMPI r4, 128
  JNZ 草続き
  POP r5
  POP r4
  RET

; ---- 点を打つ：r0=x r1=y r2=色。r0-r3 を壊し、r4 以降は守る ----
; 画素 (x,y) は 語 0x8000+y*32+(x>>2) の中の (x&3)*4 ビット目から 4bit。
; 語を読み、その升だけ消し、新しい色を置いて書き戻す。
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
  NOT r5                 ; その升だけ穴のあいた覆い
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

; ---- 蛍たちの記憶 ----
蛍x:  .space 8           ; 居場所
蛍y:  .space 8
蛍相: .space 8           ; 明滅の位相
