# 上游維護

## Remote

- Fork：`origin` → `https://github.com/SanHsien/everything-claude-code.git`
- 原作者：`upstream` → `https://github.com/affaan-m/ECC.git`
- 追蹤分支：`main`

## 檢查新提交

```powershell
git fetch upstream main
python tools\check_upstream_updates.py --strict
```

工具以 `tools/upstream_baseline.json` 的 `reviewed_through` 為起點，列出所有未審查提交。
有新提交或檢查失敗時，`--strict` 回傳非零；排程 workflow 也會因此明確失敗。

## 審查清冊

每次只做一次批次審查：

1. 讀 commit 主旨與變更檔案。
2. 判斷是否與英文 `README.md` 產品契約、Windows gate、workflow guard 或測試衝突。
3. 可直接同步的提交用 merge；只需要部分修正時 cherry-pick 或最小重做。
4. 跑 `pwsh -NoProfile -File tools\dev_check.ps1`。產品檔有改再跑 `npm test`。
5. 在 `docs/fork/DECISIONS.md` 記錄採用／略過理由。
6. 驗證完成後才把 baseline 推進到已審查的完整 40 字元 SHA。

Baseline 代表「已審查」，不代表「全部已合併」。

README 衝突的解法：接受上游英文產品說明，只保留頂部 fork overlay。不要另存第二份英文、不要把落地頁改寫成繁中維護索引。來源與授權 credit 留在 README overlay 與 `NOTICE.md`。

workflow 變更必須核對官方-repo-only guard 是否仍在。

## 2026-08-27：fork 起點

本 fork 自上游 `main` `d8409a4b0813771235555e32e3d8046a73988bfa`
（`Merge pull request #2824 from affaan-m/agent/tasteforge-multimodal-20260819`）建立。
此 SHA 設為第一個 `reviewed_through`。之後的上游 commit 才需要進入審查清冊。
