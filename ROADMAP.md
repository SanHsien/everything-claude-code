# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-10-29 依 `main` `b96ccc2e2319` 查的快照，開工前先重查 GitHub。

## 現況
這是 ECC 的 Windows 維護型 fork，提供跨宿主 skills、agents、commands、hooks 與安裝器；產品說明與本線維護界線見 [FORK](FORK.md)。2026-10-29 `gh` 查詢顯示 CI、CodeQL、Fork maintenance、Upstream check 最近成功，Dependabot／Code scanning 均為 0；上游 hook 的已知風險仍有條件式待辦，不能用告警為零推論不存在行為缺陷（2026-10-29 `gh` 查詢；`docs/fork/DECISIONS.md:397-398`）。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 無 | 目前沒有可以直接動手的項目 | 無 | 無 | 無 |

## 中期：等條件成立再做

| 項目 | 觸發條件 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 降低 `scripts/ci/validate-context-profiles.js` 在逐檔掃描成本高的 Windows 主機上的耗時（本機 2026-11-04 兩次實測 44.0 秒、55.2 秒，`tests/ci/context-profiles.test.js:12` 上限 60 秒，餘裕很薄） | 該測試在 fork CI（windows-latest）逾時；或本機逾時變成常態，且確認 Defender 排除該目錄後仍超過 60 秒 | 先在 CI 或排除掃描後的本機量同一支 `--cpu-prof`；若要改碼，只在 `validate()` 內共用單一 registry／reader 並證明不削弱 `context-profile-support.js` 的身分重驗，量測前後耗時；不放寬 timeout 除非有此量測 | Codex | 2026-11-04 實測：本機環境問題，非程式缺陷。`--cpu-prof` 52.7 秒中 `lstat` 24.4 秒、`open` 16.2 秒；674,650 次 `lstatSync`（約 33 µs／次）、21,973 次 `openSync`；空檔微基準 `lstat` 27 µs、`open`+`close` 530 µs（repo 內與 `%TEMP%` 相同）；Defender 即時防護開啟，排除清單無權限讀取。放大來源：`scripts/lib/context-profiles.js:15,102` 每次編譯新建 reader 並重載 registry，34 個投影各重讀約 646 個來源檔；`scripts/lib/context-profile-support.js:62-84` 每檔 `lstat` 祖先鏈重驗（刻意的 TOCTOU 防護，不動）。docs/fork/DECISIONS.md 2026-11-03 條目 |
| 重評 2026-11-04 分流後釘進 `monitored` 的 7 個上游 open PR 與 issue #3867：#3849、#3858（祕密遮罩缺 `sk-`／JWT）、#3862、#3864（gateguard 設定檔豁免與拒絕訊息）、#3853（hook in-process 化）、#3859（Python Install Manager 別名）、#3860（Windows CI 並行，draft）、#3867（SessionStart 重注入 classifier 通知） | 維護者安裝本 fork 的 hook（含啟用 continuous-learning observe hook），或上述任一 PR 合併／head 移動（`python tools/check_upstream_updates.py --strict` 的 monitored 區段會報）；#3860 另需 fork 的 windows-latest full lane 逾時 | 合併前：先在 fork 重現缺陷，移植並附舊碼紅、新碼綠測試；合併後：整棵採用時取上游版本，重跑 `tests/hooks/gateguard-fact-force.test.js`、`tests/scripts/post-bash-command-log.test.js`、`tests/hooks/observe-secret-redaction.test.js`、`tests/hooks/plugin-hook-bootstrap.test.js`，且保留 fork 的 EPIPE 回歸（`7fcc3a5a`） | Codex | docs/fork/DECISIONS.md 2026-11-04「PR #3847–#3866」條目；缺口實測：`scripts/hooks/post-bash-command-log.js:21-34`、`skills/continuous-learning-v2/hooks/observe.sh:288,373`、`scripts/hooks/gateguard-fact-force.js:2013,2447,2621` |
| 重評 compact 視窗與其他未採用產品提案 | 實際 session 出現 CLAUDE_CODE_AUTO_COMPACT_WINDOW，或上游合併相關修正；其他提案命中既有裁決條件 | 對照實際設定與上游依據後補回歸；compact 判斷不誤用觸發值，產品測試不呼叫真實付費 CLI，採用理由可追溯 | Codex | docs/fork/DECISIONS.md:390、393-394；tests/scripts/claw.test.js |

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
