# 變更紀錄

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，新的在上面。
本檔只記錄**本 fork 的維護歷史**（2026-08-27 起）；上游
[`affaan-m/ECC`](https://github.com/affaan-m/ECC)
的產品演進見其自身 [`CHANGELOG.md`](../../CHANGELOG.md) 與 [`docs/fork/UPSTREAM.md`](UPSTREAM.md) 的審查清冊。

## 2026-10-10

### 安全

- 透過 `package.json` overrides 與 resolutions 升級並修復 5 個依賴漏洞，同步更新 `package-lock.json` 與 `yarn.lock`，關閉 9 個 Dependabot alerts：
  - `fast-uri` 升至 3.1.8（修復 GHSA-hrr3-gc8f-f4qj）
  - `markdown-it` 升至 14.3.1（修復 GHSA-253c-mchw-3w2r）
  - `smol-toml` 升至 1.9.1（修復 GHSA-r4xh-jqrq-34v2）
  - `katex` 升至 0.18.2（修復 GHSA-238p-pmpm-9mq7）
  - `brace-expansion` 升至 5.0.12（修復 GHSA-q2hr-2g5m-vwhr）

### 維護

- 2026-10-10 主人啟用 Actions，重新啟用工作流程並觸發遠端驗證。

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
