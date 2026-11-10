# 變更紀錄

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，新的在上面。
本檔只記錄**本 fork 的維護歷史**（2026-08-27 起）；上游
[`affaan-m/ECC`](https://github.com/affaan-m/ECC)
的產品演進見其自身 [`CHANGELOG.md`](../../CHANGELOG.md) 與 [`docs/fork/UPSTREAM.md`](UPSTREAM.md) 的審查清冊。

## 2026-11-10

- 修 `tests/ci/audit-closed-references.test.js` CLI fixture 寫死 `2026-10-11` 日期、在 2026-11-10 超出 30 天稽核窗口而使 main CI 全紅的問題；改為相對現在的時間戳，根因與上游現況見 DECISIONS 同日條目。

## 2026-11-08

- 採用上游 PR #3650 抵達 main 的 6 個 commit（`b38be6a7..d2ef2680`，tip `d2ef2680`）：移植 open PR contributor cap 機制的 CI 產品碼（`.github/PR_MODERATION.md`、`scripts/ci/pr-burst-guard.js`、`tests/ci/pr-burst-guard*.test.js`），`.github/workflows/pr-burst-guard.yml` 引入 `queue: max` 並嚴格保留 `github.repository == 'affaan-m/ECC'` 守衛，`CONTRIBUTING.md` 套用 open PR cap 文字更新並保留 fork overlay；commit 水位推進至 `d2ef2680`。
- 上游 PR／issue 分流水位推進至 #3895／#3896，未提前引用任何 open PR；逐筆 SHA、判定理由與重看條件記在 DECISIONS。
- 重審移動的 6 筆 monitored 釘點（pr#3816 closed 未合併、pr#3849/3858/3870/3871/3876 更新 head），新釘 7 筆條件式 PR（pr#3880、#3881、#3882 [draft]、#3884、#3885、#3890、#3894），釘點總數為 30 筆。
- 補審 commit `3fea0a00`（2026-11-02 提前採用 open PR #3830）：比對 fork commit 與上游 open PR #3830 diff 忠實套用（測試碼僅 1 行 context 差異，語意 100% 吻合）；覆核 `fd7c834f`、`db0d5fb6` 記載與實際一致。

## 2026-11-05

- 修 Windows 上 `ecc install --guided --harness codex` 因 `codex.cmd` shim 無法被 `execFile` 啟動而失敗：plugin setup 重用 `resolveCodexCommand`（node 加 `codex.js`，不開 shell），並補專案本機 `.bin` 版面與回歸測試；採用上游 #3878 的做法，見 DECISIONS 同日條目。
- 上游 PR／issue 分流水位推進至 #3878／#3877，commit 水位仍為 `b38be6a7`；逐筆 SHA、fork 行號與重看條件記在 DECISIONS。
- 重審移動的 monitored 釘點；#3859 關閉並由 #3871 取代，保留歷史釘點，對新的條件式修正新增監看。沒有提前移植未合併產品碼。

## 2026-11-04

- 上游 PR #3847–#3866 與 issue #3843–#3867 逐筆分流（上游 main 無新 commit，未移植任何項目）；7 個條件式 PR 釘進 `monitored`，PR／issue 水位推進到 3866／3867，commit 水位仍為 `b38be6a7`。

## 2026-11-03

- 以 `25278e7d` 為 base 三方整合上游 `b38be6a7` 的 262 個 commit；12 個衝突的產品內容採上游版本，保留 fork 維護標頭與既有測試隔離。
- 上游審查 commit 水位推進到 `b38be6a7`。
- `npmscan.yml` 的外部依賴掃描與 PR 留言加上官方 repo 守衛，並納入逐 job 隔離回歸測試。

## 2026-10-26

- 採用上游 `25278e7d`（102 commits）；修上游 issue 3746：inline resolver 的反斜線 regex 在原生 Windows `bash -c` 下被吃掉，造成全部 hooks SyntaxError，改為無反斜線等價寫法並加回歸測試。新增 workflow（issue-submission-guard、maintenance）加上 owner 守衛，只在官方 repo 執行。

## 2026-10-25

- 採用上游 `90606c83`（914 commits）；`pr-burst-guard.yml` 只在官方 repo 執行。

## 2026-10-10

### 安全

- 透過 `package.json` overrides 與 resolutions 升級並修復 5 個依賴漏洞，同步更新 `package-lock.json` 與 `yarn.lock`，關閉 9 個 Dependabot alerts：
  - `fast-uri` 升至 3.1.8（修復 GHSA-hrr3-gc8f-f4qj）
  - `markdown-it` 升至 14.3.1（修復 GHSA-253c-mchw-3w2r）
  - `smol-toml` 升至 1.9.1（修復 GHSA-r4xh-jqrq-34v2）
  - `katex` 升至 0.18.2（修復 GHSA-238p-pmpm-9mq7）
  - `brace-expansion` 升至 5.0.12（修復 GHSA-q2hr-2g5m-vwhr）

### 維護

- 2026-10-10 維護者啟用 Actions，重新啟用工作流程並觸發遠端驗證。

## 2026-08-27

### 新增

- Windows-first 維護型 fork overlay：`FORK.md`、`NOTICE.md`、`REVIEW.md`、`docs/fork/`、`tools/dev_check.ps1`、上游檢查與連結檢查。
- `fork-maintenance.yml` 與 `upstream-check.yml`。
- 上游發佈／廣播類 workflow 的官方-repo-only guard。
- 根目錄 `README.md` 頂部 fork overlay；繁中維護入口在 `FORK.md`。

### 修正

- 撤回「繁中落地頁 + `README.en.md`」：產品測試以英文 `README.md` 為契約，還原後刪除第二份英文。
- `SECURITY.md`／`CONTRIBUTING.md` 加本 fork overlay；產品漏洞與產品貢獻仍指向上游。
- `install.ps1`／`install.sh` clone bootstrap 加上 `--ignore-scripts`。
- fork CI 改 Python 3.14，對齊 Windows 本機。
