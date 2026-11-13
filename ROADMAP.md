# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-11-13 依 `main` `c069998c` 查的快照，開工前先重查 GitHub。

## 現況
這是 ECC 的 Windows 維護型 fork，提供跨宿主 skills、agents、commands、hooks 與安裝器；產品說明與本線維護界線見 [FORK](FORK.md)。2026-11-13 `gh` 查詢顯示 `c069998c` 的 CI、CodeQL、Fork maintenance 成功，Upstream check 最近一次成功（2026-11-11），Dependabot 為 0；Code scanning 的 #223、#224（2026-11-11 本線 Cursor guard 修補後出現）已在 2026-11-13 處理：#224 修掉 `apply.js` 的檢查後讀取，#223 屬測試碼，依 #215 先例以 used in tests 關閉（`docs/fork/DECISIONS.md` 2026-11-13 Code scanning 條目）。`block-no-verify` 另有已記錄、實測放行的繞過變體（見中期表）；上游 hook 的已知風險仍有條件式待辦，不能用告警為零推論不存在行為缺陷（2026-11-13 `gh` 查詢；`docs/fork/DECISIONS.md:397-398`）。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 無 | 目前沒有可以直接動手的項目 | 無 | 無 | 無 |

## 中期：等條件成立再做

| 項目 | 觸發條件 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 重評上游條件式監看項目 | `python tools/check_upstream_updates.py --strict` 回報 monitored head／state 移動；或維護者選定對應使用場景。#3859 已由 #3871 取代，#3867 的修正提案由 #3870 追蹤 | 依 `tools/upstream_baseline.json` 的釘點與 `docs/fork/DECISIONS.md` 的逐筆條件重審；已合併且獨立的修正才移植，先紅後綠，保留 Windows／secret redaction／EPIPE 邊界；未合併案更新有證據的監看裁決 | Codex | docs/fork/DECISIONS.md 2026-11-04、2026-11-05 與 2026-11-08 條目；tools/upstream_baseline.json monitored |
| 重評 compact 視窗與其他未採用產品提案 | 實際 session 出現 CLAUDE_CODE_AUTO_COMPACT_WINDOW，或上游合併相關修正；其他提案命中既有裁決條件 | 對照實際設定與上游依據後補回歸；compact 判斷不誤用觸發值，產品測試不呼叫真實付費 CLI，採用理由可追溯 | Codex | docs/fork/DECISIONS.md:390、393-394；tests/scripts/claw.test.js |
| 補上 block-no-verify 已記錄、實測放行的繞過變體 | 出現真實世界的繞過（實際 session、使用者回報或覆核），或上游合併相關修正，或維護者選定要把 `scripts/hooks/block-no-verify.js` 從字面旗標防護擴到變數間接引用。已知放行：外層雙引號 `g=git; bash -c "$g commit --no-verify"`、ANSI-C `g=git; $'\x24g commit --no-verify'`、`declare -n` nameref、賦值值側引用變數（`h=0; HUSKY=$h git commit`、`GIT_CONFIG_KEY_0=$k`）、未知執行檔 `u=$(x); $u commit --no-verify` | 每個變體先寫紅燈測試（放行 exit 0）再修到擋下（exit 2）；不得讓 `block-no-verify` 既有 819 項、`block-no-verify-shell-state`、`block-no-verify-bypass-review` 轉紅；`HUSKY=False`、`LEFTHOOK=0` 等刻意不擋項維持不擋；分析預算耗盡仍 fail closed | Codex | docs/fork/DECISIONS.md 2026-11-12 F1–F5 已知限制段、2026-11-13 複審與第四輪條目（c069998c、0d6812fe、7e0ca207、8ceb8045、dd1a874f） |
| 補上 block-no-verify 其餘已記錄的未解析寫法 | 同上，或使用者實際依賴 shell alias、`GIT_CONFIG_*`／`--config-env` alias、PowerShell `Set-Variable`／`${!name}`、變數串接 `h=$g; $h commit`、`"$a$b"` 拼接 | 逐項決定採用或維持「不猜」；採用者先紅後綠，維持者在 DECISIONS 留下理由；不為此引入完整 shell parser 而讓誤擋增加 | Codex | docs/fork/DECISIONS.md 2026-11-12 F1–F5 已知限制段（`alias g=git`、`GIT_CONFIG_*`、`Set-Variable`、串接各條） |

## 刻意不做

| 不做什麼 | 理由 | 什麼情況下重新考慮 |
| --- | --- | --- |
| 把上游 docs/ROADMAP.md 的產品與商業方向全部當成本線承諾 | 上游產品規劃與 fork 維護責任不同，見 FORK.md | 維護者選定具體本線需求與驗收範圍 |
| 把 README 改為繁中或重建英文鏡像 | 上游產品測試以英文 README 為契約，見 docs/fork/DECISIONS.md:38-40 | 上游變更文件契約，且本線測試確認可保留 |
| 全測試時讓測試碰真實 claude CLI、個人設定或付費後端 | 已有隔離測試與實際誤呼叫教訓，見 docs/fork/DECISIONS.md:378-380 | 維護者另授權一個有用量上限的整合驗收 |
| 啟用官方發佈／管理他人 PR 流程，或為無共同祖先強推 | FORK.md 的工作流程隔離與已知歷史形態 | 維護者另行授權自己的發布或治理目標 |

## 維護方式
每週依 [上游流程](docs/fork/UPSTREAM.md) 與 `tools/upstream_baseline.json` 審 commit／PR／issue；新上游內容先核對逐 job guard、hook 解析器與 fork overlay，裁決只寫 [DECISIONS](docs/fork/DECISIONS.md)。
依賴更新讀完整 diff，維護變更跑 `pwsh -NoProfile -File tools/dev_check.ps1`；產品改動依 FORK.md 執行 `npm ci --ignore-scripts` 與 `npm test`，保持假 CLI 隔離並以受影響宿主 CI 驗收。
