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

## 2026-08-29：上游檢查補上 PR 與 issue 兩個面向

**決定**：`check_upstream_updates.py` 補上以 `--state all` 收集上游 PR／issue 的邏輯，
`upstream-check.yml` 補 `GH_TOKEN: ${{ github.token }}`，新增 `tests/test_upstream_updates.py`。
Baseline 既有的水位不動。

**理由**：`docs/UPSTREAM.md` 早就寫著「四個面向都要看」，`upstream_baseline.json` 也記著
`reviewed_pr_through` 與 `reviewed_issue_through`——但**沒有任何程式讀那兩個欄位**，檢查器只比對
commit 水位。那兩個面向不是「查過沒發現」，是根本沒查，而每週的排程報告長得跟查過一樣綠。
這是艦隊層級的問題：24 個 fork 裡 21 個都這樣（`SanHsien/repo-fleet-ops` 的 `docs/INCIDENTS.md`
第十條）。參考實作是 `SanHsien/harness-guard`。

三個性質，缺一不可：

- **`--state all`**：只查 `open` 看不到「開了又關、沒有合併」的 PR，而那正是「上游拒收、但可能對
  本 fork 有價值」的一類——已合併的遲早會經由 commit 抵達，被關掉的永遠不會。
- **`gh` 失敗時回 `None` 不回 `[]`**，報告寫 `Not checked` 並 **fail closed**（exit 2）。
  「沒查到」和「沒有」在綠色報告裡長得一樣，只有一個是真的。
- **`GH_TOKEN`**：`gh` 在 Actions 裡沒有憑證就列舉不到，配上 fail closed 會讓紅燈的意思變成
  「檢查器壞了」而不是「上游有東西」。

**證據**：落地後實跑 `python tools/check_upstream_updates.py`，三個面向都印出水位與待辦數；
本 repo 的 gate 全綠。

**已知代價**：水位以上真的有東西時，每週的 upstream-check 會回 exit 1。那是它該做的事——先前的
綠燈不是「沒有待辦」，是沒有人看。

**觸發條件**：報告列出項目時逐筆讀 diff、把採用／略過理由寫進本檔，然後才推進 baseline 的水位。


## 2026-08-30：上游 #2892–#2906 的逐筆判定

PR 水位 2891 → 2904；issue 水位 2886 → 2906。**commit 水位不推進**——上游在 `5eddf1a` 之後
累積 **118 個 commit**，那批還沒讀，推進等於宣稱審過。

### 採用：`hooks.json` 的 `matcher: "*"` 讓 16 組 hook 從來沒載入過（對齊上游 #2904／#2751）

**自己驗證過的事實**（不是照抄 PR 描述）：`node -e "new RegExp('*')"` 丟
`Invalid regular expression: /*/: Nothing to repeat`。Claude Code 把字串 matcher 當**正規表示式**，
所以 `"*"` 不是萬用字元，是**無效**——整組會被 loader 靜靜丟掉。

**本 fork 的實際狀況**：`hooks/hooks.json` 23 個 matcher 裡有 **16 個**是 `"*"`，
`hooks/codex-hooks.json` 1 個。受影響的包含**全部 7 個 `Stop`** 與 `SessionEnd`、
`PreCompact`、兩個 `SessionStart`、兩個 `PreToolUse`、兩個 `PostToolUse`、`PostToolUseFailure`。
也就是說這些 hook 一直都沒有在跑。全部改成 `.*`。

**為什麼沒有被發現**：`scripts/ci/validate-hooks.js` 印的是
`Validated 23 hook matchers`——它**數**了 23 個，但從來沒有**編譯**過任何一個。
已補上：每個字串 matcher 都 `new RegExp()` 一次，失敗就報錯並指出萬用字元是 `.*`。
反向驗證過：把一個 `.*` 改回 `*`，檢查器立刻報
`PreToolUse[3] matcher "*" is not a valid regular expression`；還原後回綠。

### 採用：`pr` 與 `prp-pr` 的描述逐位元組相同（上游 issue #2905）

**在本 fork 重現**：兩支指令的 `description:` 完全一樣。描述是模型從指令清單挑選時**唯一**看得到的
文字，所以這不是「相似」，是**無法決定**。

兩者實際的差別（讀 diff）：`prp-pr` 走 PRP 工作流——連結 `.claude/PRPs/` 底下的 reports／plans／
PRDs，未提交時指向 `/prp-commit`；`pr` 是通用版，連結 `.claude/prds/` 與 `.claude/plans/`。
描述照這個差別改寫，並各自寫出「什麼時候該用另一支」。

同樣補上防止再犯的檢查：`validate-commands.js` 現在會把共用同一句描述的指令報成錯誤。
全庫實查：94 個指令，改完之後 **0 組**重複描述。反向驗證過。

### 已涵蓋：`block-no-verify` 誤判引號內文字（上游 #2897，OPEN）

**實測本 fork 的 `scripts/hooks/block-no-verify.js`**：

| 輸入 | 結果 |
| --- | --- |
| `git commit --no-verify -m x` | **擋下**（真的用了旗標） |
| `git commit -m "do not use --no-verify here"` | 放行 |
| `git commit -am "explain why --no-verify is banned"` | 放行 |
| `git commit -F - <<EOF … --no-verify … EOF` | 放行 |

本 fork 已經是旗標位置感知的 tokenizer，沒有上游要修的那個誤判。無可引用內容。

### 不引用：其餘各筆

| 項目 | 狀態 | 理由 |
| --- | --- | --- |
| `#2899`／`#2902` | **MERGED** | 依本 fork 既定規則（見 `FORK.md` 2026-08-28 節），已合併的 PR 隨下次 `git merge upstream/main` 進來，不在 PR 軸逐筆看 |
| `#2895` | CLOSED 未合併 | 把 `.omo/` 加進 `.gitignore`。實查本 fork：`.gitignore` 沒有該項、目錄也不存在——本線沒有那個 runtime，沒有東西要忽略 |
| `#2893`／`#2894` | OPEN | 分別是 ito-compute 文件與 plan-canvas 的 PDF 匯出。依既定規則 open PR 預設不提前引用（那是提案不是上游已接受的變更），且兩者都不是本 fork 現在就在痛的缺陷 |
| `#2892` | CLOSED 未合併 | GateGuard 的分級復原提示，只動 `gateguard-fact-force.js`。是體驗增強不是缺陷，上游自己也沒有合併 |
| `#2898`／`#2903` | CLOSED 未合併 | 上游自己的 forward-port 批次（內容修正、truth／privacy 五筆）。上游未採納，且其中點名的檔案要逐筆對照才知道適用性——**留待 118 個 commit 的批次審查時一併處理**，那時它們的內容若進了 `main` 會經由 commit 軸抵達 |
| `#2896`／`#2900`／`#2901` | issue | 分別是空白 issue、第三方掃描報告、外部索引邀請。無可引用內容 |
| `#2906` | issue，**已驗證成立但本輪不做** | 「94 個指令描述沒有一個帶觸發語句」。實查本 fork 確實如此。但那是 94 份檔案的批次改寫，且每一份都要讀內容才寫得出真的觸發語句——不是這一輪的範圍。**觸發條件**：安排一次指令描述的整體改寫時處理 |
