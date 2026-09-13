# Fork 維護說明

本 repo fork 自 [`affaan-m/ECC`](https://github.com/affaan-m/ECC)
（GitHub 上仍可用舊名 [`everything-claude-code`](https://github.com/affaan-m/everything-claude-code)），
沿用 MIT License 與完整 Git 歷史。

## 為什麼維護 fork

- 保留上游持續更新的 skills、agents、commands、hooks 與跨宿主安裝器。
- 採 Windows-first 維護：Windows 11 + PowerShell 是主要開發、除錯與完整驗收環境。
- 繁中維護規則放 `FORK.md`；根目錄 `README.md` 必須保持上游英文產品說明（產品測試契約）。
- 建立可重現的 Windows fork gate、fork CI，以及逐筆審查的上游追蹤。
- 把會發 npm、Discord、SLSA provenance 的 workflow 隔離在官方 repo。

**回貢判準：修的是上游的 bug 就送回去；這裡獨創的文件／Windows 維護骨架留在這裡。**
回貢前必須在當次對話取得維護者明確同意；「fork」「建開發環境」「開 PR」都不是同意。

## 與上游的差異

| 項目 | 說明 |
|---|---|
| `README.md` | 上游英文產品說明 + 頂部 fork overlay。繁中維護在 `FORK.md`／`REVIEW.md`。上游其餘語系文件保留、不刪 |
| `REVIEW.md` | 本 fork 的倉庫審查紀錄 |
| `SECURITY.md` / `CONTRIBUTING.md` | 開頭 overlay：本線 PR／overlay 問題走 SanHsien；產品漏洞與產品貢獻仍指向上游 |
| `install.ps1` / `install.sh` | clone bootstrap 加上 `--ignore-scripts` |
| `AGENTS.md` / `CLAUDE.md` | 開頭加上本 fork overlay；下文仍是上游產品規則 |
| `NOTICE.md` / `FORK.md` | 來源、授權與同步說明 |
| `tools/dev_check.ps1` | Windows 本機一鍵 fork gate |
| `.github/workflows/fork-maintenance.yml` | fork 文件與連結檢查 |
| `.github/workflows/upstream-check.yml` | 每週對 `upstream/main` 做未審查 commit 檢查 |
| 上游 release／announce／metrics／SLSA／maintenance／supply-chain-watch | 加上只在官方 `affaan-m/ECC` 執行的 guard |
| `docs/fork/` | Windows 開發、上游審查、決策 |
| 上游 `ci.yml` | **保留並在本 fork 跑**，這是產品回歸 |

產品 `skills/`、`agents/`、`commands/`、`hooks/` 以上游為準。`install.ps1`／`install.sh` 僅有已記錄的 fork 修正（`--ignore-scripts`）。

## 分支與 remote

- `origin/main`：SanHsien 維護線，也是唯一長期分支。
- 日常修改在本機跑 gate 後直接推 `origin/main`。
- `upstream/main`：affaan-m 原始專案，只追蹤、不推送。
- Dependabot 或外部 fork 的變更走 PR，讀 diff 並通過 CI 後再合併。

不要 `git push upstream`。同步方式見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)。

上游更新英文 `README.md` 時，保留頂部 overlay，不要把產品說明改寫成維護索引。繁中維護差異寫在 `FORK.md`。來源 credit 留在 README 與 [`NOTICE.md`](NOTICE.md)。

## 換一台電腦怎麼開發

```powershell
git clone https://github.com/SanHsien/everything-claude-code.git
cd everything-claude-code
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements-dev.txt
pwsh -NoProfile -File tools\dev_check.ps1
```

這是 fork 文件與 guard 的硬閘門，不是完整產品回歸。產品行為變更再跑：

```powershell
npm ci --ignore-scripts
npm test
```

只想安裝產品、不開發時，請走上游官方來源（見 [`README.md`](README.md)）。不要把 `tools/`、`docs/fork/`、`.github/workflows/fork-maintenance.yml` 當成產品裝包。

## 審查紀錄

本輪倉庫審查見 [`REVIEW.md`](REVIEW.md)。

## 2026-08-28：首次上游同步，並補上 PR／issue 兩個面向

### 同步方式：合併，不是逐筆 cherry-pick

`d8409a4`（fork 起點）之後上游累積 **56 個 commit**（24 個 `fix`、22 個 `test`、9 個 `docs`）。
本輪用 `git merge upstream/main` 整批取用，理由是可查證的：

- 本 fork 相對起點只改了 **32 個檔案**（overlay：workflow 的 repo guard、`FORK.md`／`AGENTS.md`
  等維護文件、`.cursor` 規則、上游檢查工具）。
- 上游那 56 個 commit 動到 70 個檔案，與本 fork 改過的檔案**只有 3 個重疊**：
  `.github/workflows/release.yml`、`.github/workflows/reusable-release.yml`、`README.md`。
- 三個重疊處 git 都自動合併成功，合併後實查 overlay 仍在（兩支 workflow 各 3 處
  `github.repository ==` guard、README 的 fork 標示、`.cursor/rules/no-upstream-pr.mdc`）。

亦即「逐筆審查」在這裡沒有多餘資訊可給：上游改的是本 fork 沒有碰過的產品程式碼，而衝突面
只有三個檔、且已逐一確認。合併帶進 70 檔、+3212/−299。

**測試狀態**：`node tests/run-all.js` 在本機有失敗，但**合併前的 `HEAD` 用同一份環境跑也一樣
失敗**（`lib/claude-plugin-setup.test.js` 的 fail-closed 案例，需要本機沒有的 Claude Code
安裝狀態）。亦即那不是本次合併造成的回歸。CI 是那套測試的權威環境。

### PR／issue：本檔先前完全沒有這兩個面向

`tools/upstream_baseline.json` 原本只有 `reviewed_through`。也就是說 PR 與 issue 不是「查過沒
發現」，而是**根本沒查**。本輪補上，查詢一律 `--state all`——一個項目在兩次檢查之間被開了又關，
對本 fork 來說仍然是從沒審過。

上游是**高速開發中**的專案：PR 編號已到 **#2891**、issue 到 **#2886**，其中 **56 筆是未合併
就關閉**的。逐筆讀 2800 多筆不是可行的做法，也不是必要的——本 fork 的取用方式是**合併
`upstream/main`**，上游合併掉的 PR 會直接隨合併進來。

因此判準定為：

- **已合併的 PR**：不逐筆看，隨下次 `git merge upstream/main` 進來。
- **open 的 PR**：預設不提前引用（那是提案，不是上游已接受的變更）。**例外**：本 fork 現在就
  在痛的缺陷——那時才提前移植，並在本檔記下對照證據。
- **issue**：只追「會改變本 fork 要驗什麼」的（Windows 行為、安裝器對使用者檔案的寫入、授權）。

本輪掃過 open PR 標題，兩筆列入觀察但**不提前引用**（本 fork 剛與上游同步，尚未出現實例）：

| PR | 為什麼值得記 | 觸發條件 |
| --- | --- | --- |
| [#2889](https://github.com/affaan-m/ECC/pull/2889) `fix: ignore heredoc prose in GateGuard` | GateGuard 把 heredoc **內容**當成指令讀——本 session 在別的 repo 實際踩過同一類問題（hook 讀 heredoc body）。 | 本線實際遇到 GateGuard 誤擋 heredoc，或該 PR 被上游合併。 |
| [#2880](https://github.com/affaan-m/ECC/pull/2880) `fix(memory-mcp): accept the reserved _meta param` | MCP `tools/list`／`ping` 收到保留參數就失敗。 | 本線啟用 memory-mcp 後遇到，或隨合併進來。 |

### 水位

- commit：`upstream/main` 的合併點（見本次 merge commit）
- PR：**#2891**、issue：**#2886**（首次記錄）
