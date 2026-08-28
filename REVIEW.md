# Repository review（Windows-first）

- Review date: 2026-08-27
- Review baseline: 上游 `main` `d8409a4b0813771235555e32e3d8046a73988bfa`（`Merge pull request #2824 … tasteforge-multimodal`）
- Primary environment: Windows 11、PowerShell、Python 3.14.7（本機）、fork CI Python 3.14、產品 CI Node 18/20/22
- Status: 審查可修 findings 已關；產品 `skills/`／`agents/`／`commands/`／`hooks/` 未改寫；不回貢

## 結論

這個 fork 適合作為 Windows 本機追蹤上游 ECC 資源包的維護線。產品是 Claude Code / Cursor / Codex 等宿主的 skills、agents、commands、hooks 與安裝器，不是新引擎。

本輪只做 fork 骨架、危險 workflow 隔離、README 產品契約，以及審查裡可在本 fork 修的項目。**沒有**回貢、**沒有**發 npm。安裝請走官方來源：[`affaan-m/ECC`](https://github.com/affaan-m/ECC) 與 npm `ecc-universal`。

第一輪 overlay 曾把落地頁改成繁中並另存 `README.en.md`。產品測試把 `README.md` 當英文契約，GitHub `ci.yml` 因此紅燈；該決策已撤回。

## 已做

| ID | 項目 | 說明 |
|---|---|---|
| F-01 | GitHub fork | `SanHsien/everything-claude-code`，`upstream` = `affaan-m/ECC` |
| F-02 | 維護文件 | `FORK.md`、`NOTICE.md`、`CLAUDE.md`／`AGENTS.md` overlay、`docs/fork/` |
| F-03 | Windows gate | `tools/dev_check.ps1` + `tools/test_fork_overlay.py`（放 `tools/`，不進產品 `pytest tests/test_*.py`） |
| F-04 | 上游追蹤 | `tools/check_upstream_updates.py` + weekly `upstream-check.yml` |
| F-05 | 發佈隔離 | release／announce／metrics／maintenance／supply-chain-watch／SLSA 加官方 repo guard |
| F-06 | 產品 CI 保留 | `ci.yml`、`reusable-test.yml`、`reusable-validate.yml` **不加**官方-repo-only |

## 已關閉 findings

| ID | 嚴重度 | Finding | 修復 |
|---|---|---|---|
| R-01 | P1 | 根目錄改繁中 `README.md` 並另存 `README.en.md`，產品測試契約破裂 | 還原英文 `README.md` + 頂部 overlay；刪 `README.en.md`；`pyproject.toml` `readme` 指回 `README.md` |
| R-02 | P3 | `check_links._missing_relative` 對 repo 外路徑做 `.exists()` | `resolved.is_relative_to(ROOT)` 失敗就記「逃出 repo 根目錄」 |
| R-03 | P3 | overlay 連結掃描若含產品 `README.md`，fork gate 會變成 2000+ 行產品掃描 | `iter_documents()` 只掃 `FORK.md`／`NOTICE.md`／`REVIEW.md`／`CLAUDE.md`／`docs/fork/` |
| R-04 | P3 | workflow guard 測試是固定白名單，上游新加危險 workflow 可能漏閘 | 所有 `.github/workflows/*.yml` 必須落在 gated 或 ungated 集合；ungated 禁止官方-repo-only |
| R-05 | P2 | `SECURITY.md`／`CONTRIBUTING.md` 只指向上游，本線 PR 與 overlay 問題會打錯地方 | 開頭 overlay：本線 PR／overlay 走 SanHsien；產品漏洞與產品貢獻仍指向上游 |
| R-06 | P2 | `install.ps1`／`install.sh` clone bootstrap 跑 `npm install` 且無 `--ignore-scripts` | 兩邊都加上 `--ignore-scripts`；不改官方 npm 發佈面 |
| R-07 | P3 | fork CI Python 3.11，本機 Windows 是 3.14.7 | `fork-maintenance.yml` 與 `upstream-check.yml` 改 3.14；產品 `ci.yml` 的 Python job 仍 3.11 |

## 刻意不修

| ID | 嚴重度 | Finding | 理由 |
|---|---|---|---|
| U-01 | P2 | `package.json`／`pyproject.toml` 的 repository／homepage 仍指向上游 | 本線不是第二個官方 npm。改 metadata 會讓 fork 看起來像可發佈的 `ecc-universal` |
| U-03 | P3 | 產品 `ci.yml` 約 33 個 OS×Node×套件管理器測試職，加上 validate／lint／coverage／security／pack，一次 push 約 40+ jobs | 這是產品回歸，刻意保留。不要為了 fork 省分鐘數而加官方-repo-only |
| U-05 | P3 | Dependabot 仍會對 origin 開 PR | 讀完整 diff 再合併。不自動合併，也不關掉上游 Dependabot 設定 |
| U-06 | — | 不在本 fork 發 `ecc-universal`、不當官方 marketplace | overlay 與 `NOTICE.md` 已寫明 |

## 本輪實證

### 本機（Windows 11，Python 3.14.7，Node v26.7.0）

```text
pwsh -NoProfile -File tools\dev_check.ps1
→ compileall / ruff E9+F / pytest tools / check_links 全綠
→ 19 passed
→ check_links：10 份 overlay 文件，0 斷連結
→ WINDOWS DEV CHECK GREEN

node tests/scripts/install-ps1.test.js           → 4 passed（本機已有 node_modules）
node tests/plugin-manifest.test.js               → 68 passed
node scripts/ci/check-unicode-safety.js          → Unicode safety check passed
```

本輪驗證 fork gate、`install.ps1` 委派、plugin-manifest 與 unicode-safety。完整產品回歸仍交給 GitHub `ci.yml`。

### GitHub Actions（第一輪 overlay `36937ac0`）

| Workflow | 結果 | 說明 |
|---|---|---|
| [Fork maintenance](https://github.com/SanHsien/everything-claude-code/actions/runs/33086578954) | success | Ubuntu／Windows fork gate |
| [Upstream check](https://github.com/SanHsien/everything-claude-code/actions/runs/33086579032) | success | 仍在 `d8409a4b` |
| [CI](https://github.com/SanHsien/everything-claude-code/actions/runs/33086578965) | cancelled | 繁中 `README.md` 觸發產品文件測試失敗後取消，避免燒完矩陣 |

還原英文 `README.md` 後的產品 CI 以新 run 為準，不沿用上述 cancelled run 當綠燈。

## 已檢查、不列為 finding

- `tools/check_upstream_updates.py` 以 argv 列表呼叫 `git`，無 `shell=True`。
- Overlay Python 測試放 `tools/`，不會被產品 `ruff check src tests` 或 `pytest tests/test_*.py` 掃進去。
- 產品 `ci.yml` 的 Python job 仍用 3.11；只把 fork gate 對齊本機 3.14。
- 上游多語系 `docs/*/CONTRIBUTING.md` 未改；只 overlay 根目錄 `CONTRIBUTING.md`／`SECURITY.md`。
- `reusable-release.yml` 雖有 `workflow_dispatch`，jobs 已閘在 `affaan-m/ECC`。
- 產品文件測試禁止舊的非 URL marketplace add，以及舊長 slug 安裝指令；overlay／`docs/fork/` 不復述那些字串。
- 使用者安裝仍應走官方 `/plugin marketplace add https://github.com/affaan-m/ECC` 與 `ecc@ecc`。不要把本 fork 宣傳成第二個官方頻道。
- `origin`／`upstream` remote 正確。`gh repo set-default` 必須是 `SanHsien/everything-claude-code`。

## 尚未宣稱範圍

- **沒有**本機跑完整 `npm test`（交給 GitHub `ci.yml`）。
- **沒有**在真實 Claude Code／Cursor／Codex 上做安裝 smoke。
- `dev_check.ps1` **不含**產品 unicode-safety、npm audit、coverage。
- **不宣稱**本 fork 會發自己的 npm 或 GitHub Release。
