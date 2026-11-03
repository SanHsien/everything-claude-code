# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-10-29 依 `main` `b96ccc2e2319` 查的快照，開工前先重查 GitHub。

## 現況
這是 ECC 的 Windows 維護型 fork，提供跨宿主 skills、agents、commands、hooks 與安裝器；產品說明與本線維護界線見 [FORK](FORK.md)。2026-10-29 `gh` 查詢顯示 CI、CodeQL、Fork maintenance、Upstream check 最近成功，Dependabot／Code scanning 均為 0；上游 hook 的已知風險仍有條件式待辦，不能用告警為零推論不存在行為缺陷（2026-10-29 `gh` 查詢；`docs/fork/DECISIONS.md:397-398`）。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 追查 Windows 本機 `scripts/ci/validate-context-profiles.js` 逾 60 秒的原因 | `tests/ci/context-profiles.test.js` 在這台機器於乾淨 HEAD 以舊的 30 秒上限同樣 `ETIMEDOUT`，整合後以 60 秒上限仍逾時，而 fork CI（windows-latest）先前能過；本機閘門因此無法全綠 | 找出本機比 CI 慢的原因（例如逐 profile／target 投影的檔案 I/O、防毒掃描或磁碟）並量測前後耗時；除非有依據，不放寬 timeout | Codex | docs/fork/DECISIONS.md 2026-11-03 條目；`tests/ci/context-profiles.test.js` |

## 中期：等條件成立再做

| 項目 | 觸發條件 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
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
