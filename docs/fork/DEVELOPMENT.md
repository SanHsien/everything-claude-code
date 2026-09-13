# 開發環境

維護者與 AI 接手用的開發文件。產品用法看 [`README.md`](../../README.md)；上游同步在 [`UPSTREAM.md`](UPSTREAM.md)；決策在 [`DECISIONS.md`](DECISIONS.md)。

## 架構

```text
Claude Code / Cursor / Codex / OpenCode / 其他宿主
        │
        ▼
 skills/  agents/  commands/  hooks/  rules/  mcp-configs/
        │
        ├─ install.ps1 / scripts/install-apply.js
        ├─ 各宿主適配目錄（.cursor/、.claude-plugin/、.codex/ …）
        └─ tests/run-all.js 與 scripts/ci/* 產品驗證
```

根目錄 `FORK.md`、`tools/`、`docs/fork/` 是本 fork 的開發與治理骨架。`skills/`、`agents/`、`commands/`、`hooks/`、`scripts/` 以上游為準。

## 本機開發（Windows）

需要 Python 3.11+（fork gate）與 Node 18+（產品測試）。

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements-dev.txt
$env:PYTHONUTF8 = "1"
pwsh -NoProfile -File tools\dev_check.ps1
```

## Canonical fork gate

`tools\dev_check.ps1` 會依序：

1. `python -m compileall`（`tools`）
2. `ruff check`（E9 + F，僅 `tools`）
3. `pytest tools -q`
4. `python tools/check_links.py`

這是 fork 文件與 guard 的硬閘門，不是完整產品回歸。

產品行為變更再跑：

```powershell
npm ci --ignore-scripts
npm test
```

上游 `ci.yml` 仍會在本 fork 的 `main` 上跑 Linux / Windows / macOS。不要把那條 workflow 加上官方-repo-only guard。

## 不要做的事

- 不要把產品 `CONTRIBUTING.md` / `SECURITY.md` 的上游流程改寫掉；只加開頭 overlay，產品漏洞回報仍指向上游。
- 不要把產品 `AGENTS.md` 整份改寫成維護索引；只保留開頭 overlay。
- 不要在本 fork 觸發 release、npm publish、Discord announce 或 SLSA 發佈。
- 不要提交 `.env`、API key、session 記憶或帳號資料。
- 不要刪上游多語系文件來「統一語系」；根目錄 `README.md` 保持上游英文產品說明，繁中維護寫在 `FORK.md`。
