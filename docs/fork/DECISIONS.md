# 維護決策

## 2026-08-27：建立 Windows-first 維護型 fork

**決定**：fork [`affaan-m/ECC`](https://github.com/affaan-m/ECC)，本地與 origin 使用名稱 `everything-claude-code`，保留 MIT 授權與完整歷史，預設分支維持 `main`。本線聚焦 Windows fork gate、危險 workflow 隔離、繁中維護文件，以及逐筆審查的上游追蹤。

**理由**：上游已是跨宿主的 skills／agents／hooks 資源庫，符合「少走彎路的操作指南庫」用途。缺的是 Windows 11 上可重現的維護骨架。直接用上游 repo 難以長期記錄 fork 取捨。GitHub 顯示的 repo 名稱是 `ECC`；舊名 `everything-claude-code` 仍會導向同一份上游。

**限制**：

- 不把 fork 包裝成原創專案，不移除原作者與 MIT 標示。
- 不在本 fork 發 `ecc-universal`、不當官方產品站。
- `AGENTS.md` 只加開頭 overlay，不覆寫產品規則。
- 不刪上游多語系文件。
- 上游更新必須逐筆審查。
- 不回貢，除非維護者在當次對話明確同意。

## 2026-08-27：維護線直接推 main

**決定**：fork 維護不再開功能分支。改完在本機跑 gate，通過後直接推 `origin/main`。遠端只留 `main`；`upstream/main` 只追蹤。

**理由**：這是單人維護 fork，分支與 PR 沒有第二審查者，只增加同步成本。

**限制**：

- Dependabot 與外部 fork 仍可能開 PR，讀 diff 後再合併，不自動合併。
- 不推 `upstream`，不 force-push `main`。
- 不刪 `upstream` remote。

## 2026-08-27：公開入口繁中、完整英文另存（已撤回）

**當時決定**：`git mv README.md README.en.md`，根目錄 `README.md` 改為繁中 fork 入口。

**撤回**：產品測試把根目錄 `README.md` 當英文契約（Copilot、MCP、release surface、sponsor 文案、legacy marketplace 掃描）。繁中落地頁會讓產品 CI 紅燈。見下條。

## 2026-08-27：README 保持上游英文產品契約

**決定**：還原根目錄 `README.md` 為上游英文產品說明，只在頂部加 fork overlay。刪除 `README.en.md`，避免雙份英文漂移。`pyproject.toml` 的 `readme` 指回 `README.md`。繁中維護規則在 `FORK.md`；本輪審查在 `REVIEW.md`。上游 `README.zh-CN.md` 與 `docs/zh-TW/` 等語系文件保留。

**理由**：產品 CI 以 `README.md` 字串為契約。本 fork 不是第二個官方產品站；GitHub 落地頁應與安裝說明、測試、npm metadata 同一份英文。維護者看繁中走 `FORK.md`。

## 2026-08-27：危險 workflow 只在官方 repo 跑

**決定**：為 release、reusable-release、discussion-announce、release-announce、monthly-metrics、maintenance、supply-chain-watch、SLSA generator 加上 `github.repository == 'affaan-m/ECC'`。`ci.yml` 與 reusable test／validate **不加** 這道閘門。

**理由**：fork 沒有上游的 npm token、Discord webhook 與 provenance 發佈需求；排程失敗只是噪音。產品回歸仍要在本 fork 的 Windows／macOS／Linux 上跑。

## 2026-08-27：審查可修項在 fork 內關閉、不回貢

**決定**：`SECURITY.md`／`CONTRIBUTING.md` 加 fork overlay；`install.ps1`／`install.sh` clone bootstrap 加上 `--ignore-scripts`；fork CI（`fork-maintenance.yml`、`upstream-check.yml`）改 Python 3.14。`package.json` 的 repository／homepage 仍指向上游。產品 `ci.yml` 矩陣與 Dependabot 不改。

**理由**：維護者要求審查裡可修的都修，且這次不回貢。文件 overlay 避免本線 PR 打錯 repo；安裝器 hardening 只影響 git clone bootstrap，不改官方 npm 發佈面。fork gate 對齊 Windows 本機 3.14。產品身份與回歸範圍維持上游契約。
