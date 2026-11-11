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

### 採用：`hooks.json` 的 `matcher` 從 `"*"` 改成 `".*"`（對齊上游 #2904／#2751）

> **2026-09-11 更正：本條原本的結論是錯的。** 原文宣稱「`"*"` 是無效 regex，16 組 hook
> **從來沒載入過**」，那個前提不成立。官方文件（<https://code.claude.com/docs/en/hooks> 的 matcher
> 表）明列 `"*"`、`""` 或省略**一律是 match-all**，在走 regex 之前就特判；只有含其他字元的值才以
> JavaScript regex 求值。所以**那些 hook 一直都有載入**。當時只用 `node -e "new RegExp('*')"`
> 丟 `Nothing to repeat` 就下結論，沒有查 Claude Code 自己怎麼解讀 matcher——驗證了一個不是
> 問題所在的東西。
>
> 改成 `".*"` 本身無害（同樣是 match-all，上游之後也自己改成 `.*`），所以保留。**但同一個 commit
> 造成兩個真問題**，都在 2026-09-11 修正：
>
> 1. **`validate-hooks.js` 會拒絕文件明文支援的 `"*"`。** 現在 `"*"`、`""` 先放行，其餘才編譯；
>    `tests/ci/validators.test.js` 兩條新測試釘住兩個方向（拿掉特判會紅，已反向驗證）。
> 2. **改了 `hooks.json` 卻沒跑 `tests/hooks/`**：`hooks.test.js` 與 `posttooluse-dispatcher.test.js`
>    各有一條斷言 `entry.matcher === '*'`，從那個 commit 起全平台紅。改成 `'.*'`（與上游現行測試相同）。
>
> 下面保留原文，作為「數字全真、結論全假」的紀錄——不要照它的推理再做一次。

**原文（前提錯誤）**：`node -e "new RegExp('*')"` 丟 `Invalid regular expression: /*/: Nothing to
repeat`，據此推論 `"*"` 會讓整組被 loader 丟掉。`hooks/hooks.json` 23 個 matcher 裡 16 個是 `"*"`、
`hooks/codex-hooks.json` 1 個，全部改成 `.*`；並在 `validate-hooks.js` 對每個字串 matcher 呼叫
`new RegExp()`。

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

## 2026-09-01：129 commits 維持 bounded defer

僅審入口三筆；其餘混合 host/CI/product，不能 raw merge。維持 `5eddf1a`，下一次按十筆 runtime/CI
切片並通過 Windows `tools\dev_check.ps1` 才採用。

## 2026-09-11～12：main 上紅了 16 天的 CI，五個成因

`main` 的產品 CI 自 2026-08-27 起就沒有綠過。這輪逐一查完，成因有五個，其中**兩個是本 fork
2026-08-30 的 `50b19e47` 自己造成的**：

| job | 成因 | 來源 |
|---|---|---|
| Test（全矩陣） | `hooks.test.js`／`posttooluse-dispatcher.test.js` 各一條斷言 `matcher === '*'`，而 `50b19e47` 把 `hooks.json` 改成 `.*` 卻沒跑 `tests/hooks/` | 本 fork |
| Validate Components | `docs/COMMAND-REGISTRY.json` 過期——同一個 commit 改了 `pr`／`prp-pr` 的描述沒重生 registry | 本 fork |
| Security Scan | `fast-uri` 經 `ajv` 的 high 公告（後續又多了 `js-yaml`、`smol-toml`、`toml`、`@humanfs/node`） | 依賴 |
| Lint | `docs/fork/UPSTREAM.md` 連續空行、`NOTICE.md` 裸 URL | 既有 |
| Coverage | 隨 Test 一起紅 | 連帶 |

**依賴升版的做法**：`package.json` 的 `dependencies`／`overrides`／`resolutions` 對齊上游現行值
（`js-yaml` 4.3.2、`fast-uri` 3.1.7、`markdownlint-cli` 0.49.1），而不是自己挑版本。依據是上游
`main` 的 `c9148d0b` 以同一組版本在同樣的 CI 形狀（Node 20 的 Lint／Security Scan／Validate／
Coverage／Test）全綠——用上游驗過的組合，之後 merge 也不會在 lockfile 打架。
`yarn.lock` 以 repo 釘的 yarn 4.9.2 重生並補齊 checksum，`yarn install --immutable
--mode=skip-build` 通過（CI 的 yarn lane 是 immutable，lockfile 不合就裝不起來）。

**驗收**：`55d77607` 的 CI run
[34669027572](https://github.com/SanHsien/everything-claude-code/actions/runs/34669027572)
**42 個 job 全綠**——含整個 Test 矩陣（4 個套件管理器 × 3 個 Node × 3 個 OS）、Validate
Components、Security Scan、Coverage、Lint。這是 `main` 自 2026-08-27 以來第一次綠。

### 兩個踩過的坑，寫下來免得再犯

**一、本機 `npm run lint` 是假綠。** Windows 的 npm script 走 `cmd`，lint 腳本裡的 `'**/*.md'`
單引號不被 `cmd` 當引號，glob 沒有遞迴展開到子目錄，所以本機掃不到 `docs/fork/` 底下的檔。
要重現 CI 請用 `npx markdownlint "**/*.md" --ignore node_modules`（雙引號）。

**二、跑本機測試會把 `yarn.lock` 改寫成 Yarn v1 格式。** 有測試會呼叫 classic yarn，把 Berry 的
`__metadata: version: 8` 檔頭換成 `# yarn lockfile v1` 並重排全檔（約 3600 行變動）。提交前務必
確認檔頭仍是 Berry，否則會把測試產生的污染推上去。

### 本機全套測試的既有失敗

`node tests/run-all.js` 在本機 Windows（Node 26、有 Git Bash、無 corepack）是 3836 過、58 敗，
分布在 10 個檔。那 58 條在**乾淨 `HEAD` 加 `HEAD` 自己的 lockfile 重裝**之後逐條同名失敗，
且 CI 上這 10 個檔是過的——屬本機環境，不是回歸。判斷改動有沒有引入失敗時以此為基準線。

## 2026-09-30：上游 556 commits／271 PRs／91 issues 的分組判定（全部 adoption pending）

範圍：commit `5eddf1a`..`c70874f`（556）、PR #2907–#3278（271）、issue #2909–#3279（91）。
`origin/main` 已於 2026-09-27 壓成單一 root commit（`git merge-base HEAD upstream/main` 為空），
`git diff --stat HEAD upstream/main` 為 1307 檔，故無法 merge，逐筆 `cherry-pick -x` 也無法在本機以
完整 `npm test` 驗收（本機已有 58 條既存失敗，見 2026-09-11 條）。本輪**不採用任何 commit**，
水位只代表「已審」。

### 依類別判定

| 類別 | 數量級 | 判定 |
| --- | --- | --- |
| 版本／release／依賴 bump（`2.2.1`／`2.2.2`、`chore(deps)`、Dependabot、SLSA／簽章 release gate） | 約 60 commit | not-applicable：本 fork 不發 npm；依賴另依 2026-09-11 條對齊上游驗過的版本 |
| CI／測試穩定性（Windows／macOS timeout、fixture 隔離、catalog count 驗證） | 約 70 commit | follow-upstream：隨產品碼同步時一併帶入 |
| 翻譯與 locale（uk-UA、pl-PL、ja-JP、tr、zh-TW、es） | 約 20 commit／PR | follow-upstream：文件層，無 fork 特有內容 |
| 贊助、README 徽章、宣傳、社群 PR／issue（SerpApi、Atlas Cloud、Kimi、DevScratchpad、空白／`[Copilot]` 類 issue、測試用 PR） | 約 40 項 | not-applicable：上游專屬服務或無內容 |
| 新功能（control-pane、plan-canvas、sandbox Tier 0–2、Agent IR、Lean/Full profiles、Rails／TypeScript／mlops／OSINT 等 skills、Antigravity／Vibe／Copilot／DeepSeek／Grok／Hermes adapters、ruby-reviewer、eval-harness） | 約 120 項 | follow-upstream：產品增量，非缺陷；open PR 依既定規則不提前引用 |
| ecc2（Rust）與 LLM provider（Ollama／OpenAI 序列化、reasoning 剝除、cargo bump） | 約 25 項 | follow-upstream：本線不驗 Rust／provider 路徑 |
| 安裝器與 OpenCode／Codex／Cursor 路徑（hook consent、settings 原子寫入、保留使用者檔案、uninstall `--dry-run`、Windows dev id、UTF-8 BOM、install-state stale ops） | 約 60 項 | adoption pending：資料遺失與 Windows 行為修正，但跨 install-lifecycle 多檔，需成組移植並跑 `tests/lib` 安裝測試 |
| GateGuard／block-no-verify／PowerShell 破壞性指令閘（heredoc、SQL client、`dd`、git ref／history 破壞、匿名 exempt glob 限縮） | 約 60 項 | adoption pending：安全邊界修正，需整組帶入並跑 `tests/hooks` |
| `hooks.json` schema 鍵（`$schema`／`id`／`description`，issue #3053／#3062／#3063／#3114／#3131／#3138／#3139／#3169；PR #3058／#3086／#3163） | 8 issue／3 PR | adoption pending：Claude Code 載入警告，本 fork `hooks/hooks.json` 同樣帶這些鍵；需連同 `validate-hooks.js` 與相關測試一起改 |
| 其餘 hook／skill／agent 小修（observer、session-start worktree 範圍、config-protection、skill-stocktake、frontend-slides 路徑限制 #3101、memory-mcp `_meta` #2880） | 約 60 項 | adoption pending：逐項獨立，待下輪依 `tests/hooks`／`tests/lib` 切片 |

### 下輪優先切片（觸發條件：安排一次產品碼同步）

1. GateGuard／block-no-verify／PowerShell gate 整組（`tests/hooks`）。
2. 安裝器 settings／consent／uninstall 整組（`tests/lib`）。
3. `hooks.json` schema 鍵清理。
4. frontend-slides 路徑限制（issue #3101，`[HIGH][SECURITY]`）。

因 root commit 已重寫，建議以「對 `upstream/main` 做 tree 級 diff、排除 fork overlay 檔案」的方式一次同步，
再跑完整 `npm test` 與 `tools\dev_check.ps1`；不要逐筆 cherry-pick 556 個 commit。

### 水位

- commit：`c70874fae9eb0e5ad0365beb7e2955899fd1d30f`
- PR：#3278；issue：#3279

## 2026-10-06：整棵採用上游 `ef648e01`（2.2.3）

**決定**：採用 `5eddf1a..ef648e01` 共 559 個上游 commit（含 2026-09-30 列為 adoption pending 的全部分組），以整棵樹方式進 `main`，壓成單一 commit；上游歷史不帶回 `main`。觸發條件由維護者 2026-10-02 指示「上游待採用全部處理」成立。

**做法**：本機暫時分支先 `git merge -s ours --allow-unrelated-histories 5eddf1a`（不改樹，只給三方合併一個 base；`5eddf1a` 是本 fork 2026-09-27 壓縮前最後同步到的上游點，根樹與它只差 48 個 fork 檔），再 `git merge upstream/main`。暫時分支不推送。

**衝突與取捨**（9 個衝突檔；fork 改過的 48 檔中有 25 檔上游也動過，其餘自動合併）：

| 檔案 | 解法 |
| --- | --- |
| `AGENTS.md` | 保留 fork 開頭的維護區塊，其餘採上游（skill 數 286 → 293） |
| `hooks/hooks.json` | 採上游。fork 2026-08-30 把無效 regex `"*"` 改成 `".*"`，上游已做同樣修正，另把 MCP 健康檢查限縮為 `"^mcp__"`（#2838）。同一修正在 `hooks/codex-hooks.json`、`tests/hooks/hooks.test.js`、`tests/hooks/posttooluse-dispatcher.test.js` 自動合併後與上游相同 |
| `commands/prp-pr.md` | 採上游。fork 為了和 `pr` 描述不同而改寫，上游已改成「`/pr` 的別名」，同樣解決重複；`commands/pr.md` 保留 fork 版描述 |
| `install.ps1`、`install.sh` | 採上游。fork 加的 `npm install --ignore-scripts` 上游已採用 |
| `package.json`、`package-lock.json`、`yarn.lock`、`docs/COMMAND-REGISTRY.json` | 採上游；註冊表以 `npm run command-registry:write` 重產（反映 fork 的 `pr.md` 描述） |

**合併後的 fork 修正**（非衝突，合併後驗證或 PR CI 發現）：

| 檔案 | 修正 |
| --- | --- |
| `tests/ci/validators.test.js` | fork 自加的兩個 matcher 測試補上 `id`：上游新規定物件格式的 hooks.json 每組 matcher 必須有穩定 `id`，否則測試資料先被 id 規則擋下 |
| `tools/test_fork_overlay.py` | 上游新增 `.github/workflows/taste-skills.yml`（只跑離線單元測試，`contents: read`、不發佈），歸入可在 fork 執行的 `UNGATED_WORKFLOWS` |
| `pi/core/commands/pr.md` | 以 `node scripts/build-pi-core.js` 重產，反映 fork 的 `pr.md` 描述。`pi/core/` 是上游新增的衍生檔，第一版漏了，PR CI 的 Pi Core Profile 因此失敗 |
| `tests/run-all.js` | 上游缺陷：結尾 `process.exit()` 在 POSIX 管線上會丟掉未寫完的輸出。CI run 37455773240（`55bfdd8b`）的 Ubuntu job 112242882787 日誌停在 `block-no-verify` 輸出的半行就 `exit code 1`，看不到失敗檔。改為設定 `process.exitCode` 並在最後列出失敗檔名；找不到測試檔的早期 `process.exit(1)` 不變 |
| `tests/ci/run-all.test.js` | 配合上一列：契約測試原本攔截 `process.exit()` 讀結束碼，改為攔截不到時讀 `process.exitCode`（斷言的值不變），並新增一條釘住「最後一行是設定 exitCode」 |
| `tests/scripts/codex-hooks.test.js` | 上游缺陷，Ubuntu 紅燈的根因：「大小寫折疊」案例用 `__filename` 轉大寫或小寫後是否存在來判斷檔案系統不分大小寫；本 fork 的 CI 路徑 `/home/runner/work/everything-claude-code/...` 全小寫，轉小寫就是原檔，Linux 上誤判並執行而失敗（run 37472728926 的 Ubuntu job 112300266161）。改為只用與原路徑不同的拼法判斷；macOS、Windows 照跑 |

**驗證**

本機逐檔測試（每個測試檔獨立程序、每檔 180 秒上限，逾時者單獨以 600 秒重跑）跑在合併後、壓成 `55bfdd8b` 之前的本機 bridge 樹（2026-10-05 19:58 至 10-06 07:49；325 檔），對照 `main` `b9c6aa93`（248 檔）：

- 兩邊都有的檔：合併後才失敗的只有 `tests/ci/validators.test.js`（已修，修後單獨重跑 191 pass／0 fail）與 `tests/scripts/codex-hooks.test.js`（本機只剩新增的 symlink 案例，見下）。逾時的 `tests/lib/install-executor.test.js`、`tests/scripts/repair.test.js` 單獨重跑通過（116 秒、60 秒）。
- 上游新增檔首輪失敗、單獨重跑通過的兩檔，屬負載下的不穩定：`tests/lib/powershell-destructive-command.test.js`（hook 時間預算案例）、`tests/scripts/profile-interactive.test.js`。
- 上游新增檔首輪超過 180 秒而逾時、以 600 秒單獨重跑通過的 7 檔：`tests/lib/context-carriers.test.js`、`context-profile-eval`、`context-profile-interactive`（193 秒）、`context-profile-native`、`context-profile-store`、`context-selection`、`tests/scripts/profile-selection.test.js`。
- `main` 原本就失敗或逾時的 10 檔（`claude-plugin-setup`、`claude-scope-migration`、`codex-legacy-sync`、`memory-vault`、`state-store`、`ecc-universal-bin`、`install-apply`、`memory-mcp`、`setup`、`uninstall`）：以純上游 `ef648e01` 副本在本機對照，除 `uninstall` 兩邊都通過外，其餘在上游樹同樣失敗，屬 Windows 本機環境，不是 fork 造成。
- 上游新增檔中仍失敗的 6 檔都是本機環境限制：
  - 無法建立 symlink（`EPERM`）：`tests/lib/eval-harness/security.test.js`、`tests/lib/opencode-consent-legacy-lock.test.js`、`tests/scripts/coordination-inventory.test.js`、`tests/skills/build-agreement.test.js`、`tests/scripts/codex-hooks.test.js` 的一個案例。
  - `tests/ci/context-profiles.test.js`：子程序上限 30 秒，本機實測 `validate-context-profiles.js --json` 成功但需 32.6 秒（repo 在 OneDrive 下）。不放寬測試。
  - `tests/scripts/eval-harness-package.test.js`：Git Bash 的 GNU tar 把 `C:` 當成遠端主機；其聚合案例連帶失敗於上一列的 symlink 案例。
- 壓成 commit 之後的修正（上表後四列）以個別測試驗證：`node tests/ci/run-all.test.js` 9 pass、`node tests/scripts/codex-hooks.test.js` 40 pass（唯一失敗為本機 symlink 案例）、`node scripts/build-pi-core.js --check` 為最新；`tools\dev_check.ps1` 綠。

PR #4 的 CI workflow（每次 43 個 job）：run 37455773240（`55bfdd8b`，整體 cancelled，被下一次推送取代）14 個失敗（Ubuntu 12 個 Test、Coverage、Pi Core Profile）、5 個在取消前未跑完（4 個 macOS、1 個 Windows）；run 37472728926（`daacacd0`）34 個失敗（33 個 Test 加 Coverage；三平台都是 `ci/run-all.test.js`，Ubuntu 另有 `scripts/codex-hooks.test.js`）；run 37544105599（`dc582031`）43 個全部通過。之後只改文件的提交，以合併前最新一次 run 為準。這些失敗正是本機 Windows 無法重現、只有 PR CI 才抓得到的部分；symlink 類安全測試由 CI 的 Linux／macOS 執行。

**CodeQL**：PR 帶入的上游程式碼新增 12 個高嚴重度警示（#197–#208），2026-10-06 21:37（+0800）依維護者授權附理由關閉（#204 的理由寫錯，10-07 07:33 重新開啟後以正確理由再關閉）：測試與 fixture 6 個（#199–#201、#206–#208）標 used in tests；`scripts/build-pi-core.js` 2 個（#197、#198，輸入為 repo 自己的 manifest）、`scripts/lib/context-pack-registry.js`（#205）、`scripts/ci/validate-hooks.js`（#203）、`scripts/lib/claude-dry-run-sandbox.js`（#204，讀使用者自己的 Claude 設定複製進 dry-run 沙箱，競態需要已能替換使用者設定檔）標 won't fix；`docker/context-profiles/run-sandbox.js`（#202，讀檔前後已比對 dev／ino／size）標 false positive。

**PR／issue 軸**：本輪只採用 commit；PR #3279 起、issue #3280 起未逐筆審，水位不推進。

## 2026-10-24：`markdown-it` override 由 14.3.1 升到 14.3.3

**決定**：`package.json` 的 `overrides` 與 `resolutions` 把 `markdown-it` 由 `14.3.1` 改為 `14.3.3`，`package-lock.json` 與 `yarn.lock` 用各自工具重產（`npm install --ignore-scripts`、yarn 4.9.2 `install --mode=skip-build`）。關閉 Dependabot 高嚴重度警示 #37（package-lock.json）與 #38（yarn.lock）。

**理由**：兩處 override 原本釘死精確版本 14.3.1，Dependabot 的 security update 因此在 10-07、10-23 兩次都以 `security_update_not_possible` 失敗（可解析的最新版 14.3.1，最低安全版 14.3.3）。唯一的上游父套件 `markdownlint-cli@0.49.1` 要求 `~14.3.0`，本來就允許 14.3.3，所以只需改 override，不必升父套件。

**移除條件**：`markdownlint-cli` 的範圍不再需要 override 才能取得 >=14.3.3 時（例如父套件自己的依賴下限已 >=14.3.3），即可刪除這兩條 `markdown-it` 項目。yarn 重產時順帶補上 5 個既有條目缺的 `checksum` 欄位，內容由 yarn 計算，未手改。

## 2026-10-24：新增 `toml` override 5.0.1

**決定**：`package.json` 的 `overrides` 與 `resolutions` 新增 `toml: 5.0.1`，`package-lock.json` 與 `yarn.lock` 用各自工具重產（`npm install --ignore-scripts`、yarn 4.9.2 `install --mode=skip-build`）。關閉 Dependabot 高嚴重度警示 #43、#44（package-lock.json）與 #47、#48（yarn.lock）；受影響範圍 `<= 5.0.0`，最低安全版 5.0.1。

**理由**：`toml` 只由 devDependency 的 `effect@4.0.0-beta.83` 以 `^4.1.1` 引入，該範圍不含 5.x，Dependabot 無法在不動 override 的情況下升級。lock 差異只有 `toml` 一個條目（4.3.0 到 5.0.1），來源皆為 registry.npmjs.org。專案自身的 TOML 解析用 `@iarna/toml`，與此套件無關。

**移除條件**：`effect` 的 `toml` 範圍放寬到涵蓋 >=5.0.1 時，刪除這兩條 `toml` 項目。

## 2026-10-24：`fast-uri` override 升到 3.1.9

**決定**：`package.json` 的 `overrides` 與 `resolutions` 把 `fast-uri` 從 `3.1.8` 升到 `3.1.9`，`package-lock.json` 與 `yarn.lock` 用各自工具重產（`npm install --package-lock-only --ignore-scripts`、yarn 4.9.2 `install --mode=update-lockfile`）。對應 Dependabot 警示 #50–#57（package-lock.json 與 yarn.lock 各 4 個），修補版 3.1.9。

**理由**：`fast-uri` 只經 `ajv` 引入，先前為了高嚴重度公告釘在 3.1.8，之後又出新公告，最低安全版變成 3.1.9。lock 差異只有 `fast-uri` 一個條目，來源皆為 registry.npmjs.org。

## 2026-10-25：整棵採用上游 `90606c83`（ef648e01 之後 914 commits）

**決定**：採用 `ef648e01..90606c83` 共 914 個上游 commit（815 檔、約 +10 萬／−7 千行），水位推進到 **`90606c8315ee09cafc303515c5f33024db6b9882`**。方式同 10-06：本機暫時分支先 `git merge -s ours --allow-unrelated-histories ef648e01` 給三方合併一個 base，再 `git merge upstream/main`；暫時分支不推送，結果以單一 commit 進 `main`（`origin/main` 為 2026-09-27 起的 root commit，與上游無共同祖先）。

**合併前掃描**：對 `ef648e01..upstream/main` 的新增行找藏起來的內容（超長單行、`eval`／`new Function(`、`global.require`、長 base64／hex）。超過 1500 字元的行只有 `hooks/hooks.json` 與 `hooks/codex-hooks.json` 的 `node -e` 外掛根目錄解析器（與既有 24 條同一個樣板，新增 3 條）和三份文件；`eval` 只出現在測試資料與 `String.fromCharCode` 解 tar 標頭。無命中。

**衝突與取捨**（11 個）：

| 檔案 | 解法 |
| --- | --- |
| `CLAUDE.md` | fork 已刪除（repo 只用 `AGENTS.md`），上游改動不採 |
| `AGENTS.md` | 保留 fork 開頭維護區塊，其餘採上游（71 agents／311 skills／97 commands） |
| `README.md` | 語言列保留 fork 的繁中連結並加入上游新增的阿拉伯文連結 |
| `CHANGELOG.md` | 上游 `Unreleased` 在前，fork 的 `2.2.4` 安全條目在後 |
| `package.json` | `overrides`／`resolutions` 保留 fork 較新的釘版（fast-uri 3.1.9、markdown-it 14.3.3、toml 5.0.1），其餘採上游 |
| `package-lock.json`、`yarn.lock` | 取上游版後用 `npm install --package-lock-only --ignore-scripts`、yarn 4.9.2 `install --mode=update-lockfile` 重產 |
| `tests/run-all.js`、`tests/ci/run-all.test.js` | 採上游：上游已改為設定 `process.exitCode`（10-06 fork 修正同一缺陷），並新增工作池與 `ECC_TEST_ONLY` |
| `scripts/ci/validate-hooks.js` | 採上游（拆成各形狀驗證器），再把 fork 的 matcher 正規式編譯檢查（含 `*`／`""` match-all 特判）補進新的 `validateObjectMatcher`——上游重構時整段拿掉了，`tests/ci/validators.test.js` 的「matcher is not a valid regular expression」案例因此紅，補回後 194 pass／0 fail |
| `tests/scripts/codex-hooks.test.js` | 保留 fork 修正：大小寫折疊案例只用與 `__filename` 不同的拼法判斷（上游仍有 Linux 全小寫路徑誤判） |

**合併後的 fork 修正**：上游新增 `.github/workflows/pr-burst-guard.yml`（`pull_request_target`，會對他人 PR 留言、關閉並封鎖作者）。本 fork 不該對外部貢獻者執行，job 加 `github.repository == 'affaan-m/ECC'` 守衛，並在 `tools/test_fork_overlay.py` 的 `GATED_WORKFLOWS` 登記。`docs/COMMAND-REGISTRY.json`、`pi/core/` 重產後無差異。

**PR／issue 軸**：PR #3279–#3711（204 筆：75 merged、20 closed、109 open）與 issue #3280–#3722（86 筆）逐筆掃過標題。已合併的隨 commit 進來；**未提前引用任何 open PR／open issue**，判準同 `FORK.md`（本 fork 現在就在痛才引）。列入觀察、觸發條件為「本 fork 的 hook 在實際使用時出現同症狀」：#3665／#3669（hook 讀 stdin 無逾時）、#3663（hook 讀 `tool_response`）、#3600／#3601（無 `xdg-open` 的 Linux 儀表板崩潰）、#3459（Windows 上 `observe.sh` 鎖殘留）。issue #3721、#3722（回饋型文件建議）與本 fork 驗證項目無關，略過；#3721 要求補一個「測試時限 vs 執行期需求」的範例，是文件建議，與本 fork 驗證項目無關，略過。OpenCode v2 系列（#3617、#3635、#3660、#3676）本 fork 不用 OpenCode，略過。

**水位**：commit `90606c8315ee09cafc303515c5f33024db6b9882`、PR #3711、issue #3722、日期 2026-10-25。

## 2026-10-26：整棵採用上游 `25278e7d`（90606c83 之後 102 commits），並修正原生 Windows 下全部 hook 失效

**決定**：採用 `90606c83..25278e7d` 共 102 個上游 commit，水位推進到 **`25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b`**。方式：以 `90606c83` 當 base 做三方合併（`git merge-recursive 90606c83 -- HEAD upstream/main`），結果以單一 commit 進 `main`。

**合併前掃描**：對 `90606c83..upstream/main` 的新增行找行內長串空白、超長單行、`eval`／`new Function(`／`global.require`、長 base64／hex、零寬與雙向控制字元。命中只有 `hooks/hooks.json` 27 條 hook 命令裡既有的 `String.fromCharCode(10)`（換行字元，訊息拼接），無隱藏內容。

**衝突**：只有 `package.json`、`package-lock.json`、`yarn.lock`。`overrides`／`resolutions` 保留 fork 的 `markdown-it` 14.3.3、`toml` 5.0.1，並加入上游的 `zod` 4.6.7；兩個 lock 取上游版後，`package-lock.json` 用 `npm install --package-lock-only --ignore-scripts`、`yarn.lock` 用 yarn 4.9.2 `install --mode=update-lockfile` 重產（lock 與上游版只差 `markdown-it` 一個條目）。注意：npm 會把 `yarn.lock` 改寫成 yarn v1 格式，npm 之後必須還原 `yarn.lock`。

**依賴警示**：上游改用 `@opencode-ai/plugin` 1.4.3 後，依賴樹不再經 `node-gyp` 引入 `undici` 6.x，`yarn.lock` 沒有任何 `undici` 條目，Dependabot #58、#59（修補版 6.29.1）隨之消失；上游對應的 undici 升級 PR（3724）也已關閉。

**合併後的 fork 修正**

1. **原生 Windows 下全部 hook 失效（上游 issue 3746，已重現）**：上游新增的行內解析器 WSL 片段含 `/^([A-Za-z]):[\\\\/]/` 之類的反斜線 regex。原生 Windows 以 `bash.exe -c "<command>"` 執行 hook，反斜線在 argv／MSYS／bash 雙引號三層被折疊，regex 字面值吞掉後面的程式，`[eval]:1 SyntaxError`。實測：用 Node `spawnSync` 以 Git Bash 逐條執行 `hooks/hooks.json`，合併前 27 條 0 錯誤，原樣合併後 27 條全部 SyntaxError。上游測試在 win32 一律跳過，所以沒抓到。改成語意相同、不含反斜線的寫法（`/^[A-Za-z]:/` 加字元檢查，`String.fromCharCode(92)` 換分隔符號），同步改 `scripts/lib/install-targets/helpers.js`、`scripts/lib/resolve-ecc-root.js` 的來源字串，以及由它們產生的 `hooks/hooks.json`、`hooks/codex-hooks.json` 與 5 份 `commands/*.md`，`docs/COMMAND-REGISTRY.json` 重產。新增 `tests/lib/inline-resolver-backslash-free.test.js`：斷言這些行內命令不含反斜線、WSL 轉換行為正確、並在有 bash 的平台（含 Windows）用 `bash -c` 實跑解析器；對上游版本跑為紅（6 項失敗），修正後綠。**移除條件**：上游發佈等價修正並在 Windows 上實跑後，可改回採上游版本。
2. **新 workflow 的官方 repo 守衛**：`issue-submission-guard.yml`（會對他人 Issue 留言、鎖定）與 `maintenance.yml` 新增的 `closed-reference-audit` job 加 `github.repository == 'affaan-m/ECC'`，前者登記進 `tools/test_fork_overlay.py` 的 `GATED_WORKFLOWS`。

**CodeQL 逐項判斷（11 筆，掃描基準 `0a7fc0f1`）**

| # | 規則／位置 | 判斷 | 處置 |
|---:|---|---|---|
| 209 | `js/polynomial-redos` `scripts/ci/validate-skills.js:123` | 實務上不可利用（`.` 排除的字元都在 `\s` 內，匹配不會失敗），但 `\s*(.*)` 結構確實重疊 | 修：改為 `(.*)` 後以 `^\s+` 去除前導空白 |
| 210、211 | `js/bad-tag-filter` `tests/scripts/dashboard-web.test.js:56,73` | 測試解析自家輸出的 HTML，非消毒；但正規式確實不處理大寫與屬性 | 修：`/<script\b[^>]*>…<\/script\s*>/gi`，71 項測試通過 |
| 212、213、214 | `js/shell-command-injection-from-environment` `quality-gate.js:37`、`pre-bash-commit-quality.js:325`、測試 | 假陽性：`shell:false`、參數為陣列，唯一來自環境的可執行檔是 `ComSpec`（Windows 的 `.cmd` 墊片路徑），信任邊界與使用者環境相同；改成裸 `cmd.exe` 反而會讓 Windows 先搜尋 cwd | 不改產品碼；建議以假陽性關閉 |
| 215 | `js/insecure-temporary-file` `tests/hooks/cursor-hook-dispatchers.test.js:95` | 測試 fixture 重現 hook 的暫存檔名 | 不改；建議以 used in tests 關閉 |
| 216、217、218 | `js/file-system-race` 三處測試 | 皆已採 `open` 後 `fstat` 的 fd 檢查；測試碼 | 不改；建議以 used in tests 關閉 |
| 219 | `js/file-access-to-http` `scripts/hooks/plan-canvas-pending.js:122` | 假陽性：目的地固定為 loopback，port 與 key 先經 `validServerPort`／`validSessionKey` 驗證 | 不改；建議以假陽性關閉 |

本輪沒有代為關閉任何警示（要等推送後重掃確認 209–211 消失）。

**PR／issue 軸**：PR #3723–#3744（21 筆）與 issue #3742、#3745、#3746 逐筆掃過。已合併的（3723、3732、3736 及其 commit）隨合併進來；3724 已關閉（見上）。**未提前引用任何 open PR**；觀察項：#3739（js-yaml 5.5.0，本 fork 釘 4.3.2，不跟）、#3737／#3738（依賴升級，等 Dependabot 自己的流程）、#3744（Python 3.11／Windows 的 selector 輸出可攜性，與本 fork Windows 主線相關，合併後採用）、#3741（文件稽核輸出編碼，同上）。issue 3745（`@opencode-ai/plugin` 缺 runtime 依賴）已由範圍內的上游 commit 修正；3742（Codex 外掛快取的 symlink）本 fork 不用 Codex 外掛快取，略過；3746 見上。

**水位**：commit `25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b`、PR #3744、issue #3746、日期 2026-10-26。

## 2026-10-28：深度掃描 fork 自加程式；CodeQL 212–222 逐筆關閉

**範圍**：`git diff 25278e7d..main` 的 fork 改動（`scripts/ci/validate-*.js`、行內解析器來源與產物、`tools/`、fork workflow 與守衛、fork 測試）。上游程式不改，觀察項記在下方。`tools/check_upstream_updates.py` 是艦隊共用正本，不在本 repo 單獨改。

**修正**（各附修前失敗的證據）

1. `c4c27ff9`：`tests/lib/serialized-hook-wsl.test.js` 自 `df46e59e` 起在所有 POSIX CI 職失敗（`Mutation must modify the shipped replacement`，main run 40537752542）。原因屬於 fork：10-26 改成無反斜線的 `.split(String.fromCharCode(92)).join('/')` 後，測試仍找上游的 `,'/'` 來突變。改成突變 `.join('/')`。本測試在 win32 跳過、本機沒有 WSL／docker，修後以 CI 驗證。上游 open PR #3748、#3759 是同一修正，上游合併後可改回上游版本。
2. `908deb39`：fork 的重複描述檢查改為只讀前置資料。修前「reads the description from frontmatter only」失敗（`one.md, two.md share one description ... "shared example text"`）；另一筆新測試「fails when two commands share one description」修前修後都過，用來釘住原有行為。修後 196／196。
3. `814107d1`：gated workflow 守衛測試改為逐 job 檢查。舊檢查對「只守一半」的合成 workflow 和拿掉 `maintenance.yml` `stale` 守衛的突變都會通過；新檢查抓到 `['announce']`、`['stale']`。目前 18 個 job 全部有守衛。

**CodeQL 212–222（11 筆）**：全部是上游程式或測試碼，逐筆附理由關閉。212、213、219 假陽性（`shell:false` 加 `%ECC_CMD_TOKEN_n%` 間接傳參與引號／控制字元拒絕；loopback 固定位址加 port／key 驗證）；214–218、220–222 used in tests。220、221 是 10-26 改過正規式的 210、211 換了規則訊息重新出現，判定改為不再改測試、直接關閉。

**觀察項（上游程式，不在 fork 修）**：issue #3761（config-protection 對 MultiEdit 逐項 `file_path` 可繞過）、#3762（run-with-flags 遇超大 Bash 輸入對 GateGuard fail-open）——兩者都在本 fork 隨附的 `hooks/hooks.json` 裡（維護者本機目前沒安裝 ECC plugin，見下一條目），上游修正後隨合併進來；#3756、#3765（原生 Windows hook 失效）已由 fork 的 10-26 修正涵蓋。

## 2026-10-28：上游 PR #3747–#3764、issue #3754–#3765 逐筆分流

commit 軸為 0（上游 main 仍是 `25278e7d`）。PR、issue 一律 `--state all` 列舉；14 筆 PR 全部 open，5 筆 issue 4 open、1 closed。判準照 `FORK.md`：open PR 預設不提前引用，例外是本 fork 現在就在痛的缺陷。

**引進：PR #3764**（`test(claw)`，head `0618bdc7a81c`，+85／-9，只動 `tests/scripts/claw.test.js`）。cherry-pick 上游 commit，未改寫。

- 痛點實查：fork 的舊測試以一般 PATH 呼叫 `askClaude('sys','hist','msg')`。維護者機器有 `%USERPROFILE%\.local\bin\claude.exe`，而 `scripts/claw.js:118-131` 在 Windows 先找 `.exe`，所以跑全套測試會真的送出一次 `claude -p`（最多等 300 秒）。2026-10-28 本輪驗證時就因此實際呼叫過一次。違反「測試不得在維護者桌面啟動程式」。
- 修前修後對照：PATH 只放一個會寫紀錄的假 `claude.cmd`＋System32＋node，舊測試紀錄 `called -p`，新測試 0 次；新測試 21／21 通過（其中 2 筆在 Windows 只印 skipped、仍計為通過）。Windows 上兩個 POSIX stub 測試會跳過，空 PATH 的錯誤路徑測試會跑，`where` 與 `claude` 都找不到，回 `[Error: ...]`。
- 隱藏內容掃描：119 行 diff，無「空白夾內容」、無超長行、無 `eval`／`new Function(`／`globalThis`／長 base64。
- 移除條件：上游合併 #3764 後，下次整棵採用時直接取上游版本。

**不引進（附證據與重看條件）**

| 項目 | 內容 | 本 fork 實況 | 重看條件 |
|---|---|---|---|
| PR #3748、#3759 | 行內解析器去反斜線（+115／-77、+143／-72，動 `hooks/*.json`、5 份 `commands/*.md`、`helpers.js`、`resolve-ecc-root.js`） | fork 已有等價修正（`df46e59e`）；`hooks/hooks.json` 的 SessionStart 命令不含反斜線、`.join('/')` 恰 1 處；`tests/lib/inline-resolver-backslash-free.test.js` 12／12 | 其中一筆被上游合併：改採上游版本，移除 fork 的 overlay 與 `c4c27ff9` 的測試改動 |
| PR #3760 | `transcript-context.js` 把 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 降為最後順位（+14／-5） | 本機 session 沒有這個變數；fork 的 `tests/hooks/suggest-compact.test.js` 44／44。手動設 `786432` 才重現 2 筆失敗。PR 的前提（這個變數是觸發點而非視窗大小）未經 Claude Code 文件證實，改的是產品判斷順序 | 維護者的 session 出現這個變數，或上游合併 |
| PR #3747 | 新 skill `web-perimeter-owasp-2025-audit`（+160） | 產品新增內容，無痛點 | 上游合併 |
| PR #3749、#3750、#3751 | `examples/evaluator-rag-prototype/` 範例與文件（+372、+231、+358） | fork 不用 evaluator RAG 原型 | 上游合併 |
| PR #3752 | Codex 外掛快取文件＋`scripts/codex/check-plugin-cache.js`（+86／-9） | fork 不用 Codex 外掛快取（同 2026-10-26 對 issue 3742 的判斷） | 維護者改用 Codex 外掛，或上游合併 |
| PR #3753、#3758、#3763 | skill 文件更新（flox 指向、tinystruct 1.7.37、golang-patterns 池化 buffer 範例回傳前要複製） | 只是文件；#3763 是範例程式的正確性問題，但不影響 fork 的程式 | 上游合併；或維護者實際照 golang-patterns 範例寫程式 |
| PR #3755 | `ecc2/src/session/store.rs` 略過未註冊 session（+57） | fork 不建置、不發佈 ecc2 | 上游合併 |
| PR #3757 | Continue CLI 安裝器與轉換器（+2174，新增安裝腳本） | 產品新功能，大型新增，無痛點 | 上游合併 |
| issue #3761 | config-protection 對 MultiEdit 逐項 `file_path` 可繞過 | 缺陷存在：`scripts/hooks/config-protection.js:160` 只讀 `tool_input.file_path`／`file`。維護者本機沒安裝 ECC plugin（`~/.claude/settings.json` 與 plugin cache 都沒有），目前不受影響 | 維護者安裝本 fork 的 hook，或上游修正 |
| issue #3762 | 超大 Bash 輸入讓 GateGuard fail-open | 缺陷存在：`scripts/hooks/run-with-flags.js` 的 fail-closed 清單沒有 `pre:bash:gateguard-fact-force`；需要 >1 MiB 的命令才觸發 | 同上 |
| issue #3756 | Windows plugin 安裝因 `overrides` 不裝依賴、hooks=off 仍註冊 | `[eval]:1` 的部分已由 fork 的 `df46e59e` 涵蓋；`overrides` 的部分 fork 也有（`markdown-it`、`toml`），但只在以 marketplace plugin 安裝時發生，維護者沒這樣裝 | 維護者以 plugin 方式安裝本 fork |
| issue #3765 | 原生 Windows SessionStart／SessionEnd SyntaxError | 已由 `df46e59e` 修正 | 無 |
| issue #3754（closed） | 使用者端 install-state 與 plugin 重疊的錯誤訊息 | 使用者環境問題，非程式缺陷 | 無 |

**水位**：commit `25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b`（不變）、PR #3764、issue #3765、日期 2026-10-28。

## 2026-11-02：上游 PR #3771–#3841、issue #3766–#3831 逐筆分流；commit 軸（262 筆）延後整棵採用

**範圍**：`25278e7d..b38be6a7`（上游 main tip）共 262 個 commit，`git diff --shortstat` 為 266 檔、+17186／−827。PR、issue 一律 `--state all` 列舉：PR 55 筆（25 MERGED、26 OPEN、4 CLOSED），issue 19 筆（6 CLOSED、13 OPEN）。每個 PR 取 2026-11-02 當下的 head、讀完整 diff，依判準八掃隱藏內容（新增行的長空白夾帶、超過 600 字元、`eval(`／`new Function(`／`globalThis`／`global.require`／`<script`／`javascript:`、80 字元以上 base64／hex、Unicode 控制與零寬字元）。命中全部為正常內容：`package-lock.json`／`yarn.lock` 的 integrity 雜湊（#3806、#3808）、`hooks/hooks.json` 既有的長行內命令（#3772、#3806 各 27 行）、文件長行與連結（#3806、#3809、#3811、#3812、#3823、#3837），以及測試碼的 `globalThis.crypto = crypto.webcrypto`（#3806）與 `new Function('exports', emitted)(fixtureExports)`（#3809，測試載入自己編譯的輸出）。沒有隱藏程式。

**commit 軸：本輪不採用，水位 `25278e7d` 不動**。以 `git merge-tree --write-tree --merge-base=25278e7d HEAD upstream/main` 試算（不動工作樹）：266 檔、**12 個衝突檔**（`AGENTS.md`、5 份 `commands/*.md`、`hooks/codex-hooks.json`、`hooks/hooks.json`、`hooks/hooks.metadata.json`、`scripts/lib/install-targets/helpers.js`、`scripts/lib/resolve-ecc-root.js`、`tests/lib/serialized-hook-wsl.test.js`），全是 fork 在 10-26 為行內解析器去反斜線所改的檔。這筆整棵採用會動 hooks 與安裝器主流程，超出單輪小改動範圍，依派工說明寫進 `ROADMAP.md` 近期表，由維運長決定時機。證據顯示現在採用的條件已成立：上游 `dc9bb9f2`（2026-10-26）已做同樣的去反斜線修正，實測上游 tip 的 `hooks/hooks.json` 雙反斜線 0 處、`String.fromCharCode(92)` 27 處，與 fork 目前相同；先前 ROADMAP 記的觸發項 #3748 已 MERGED、#3760 已 MERGED、issue #3761／#3762 已 CLOSED 且各有 commit（#3775、#3776）。合併時衝突應以上游版本為準並移除 fork 的等價 overlay。

**採用：PR #3830（OPEN，head `fbd14b44`，+161／−27，14 檔，全為測試）**。`gh pr diff 3830` 以 `git apply` 套用，未改寫。
- 痛點實查：此機器 `fs.symlinkSync` 回 `EPERM`（Windows 未啟用開發人員模式，Node 實測 `symlink refused EPERM`）。修前逐一用 `node <test>` 跑 PR 動到的 12 個測試檔：10 個 exit 1（輸出含 `EPERM`）、另 2 個（`tests/scripts/codex-hooks.test.js`、`tests/scripts/command-runtime.test.js`）120 秒逾時；修後 12 個全部 exit 0，`codex-hooks` 54 passed／0 failed、`command-runtime` 46 passed／0 failed，新增的 `tests/lib/helpers/symlink-support.test.js` 也 exit 0。符合「本 fork 現在就在痛」的例外（同 #3764）。
- 只動測試，不動產品碼；沒有符號連結權限時顯示 skip 而不是失敗，有權限的平台行為不變（PR 的 7 個 commit 以單一 diff 套用）。
- 移除條件：上游合併 #3830 後，整棵採用時直接取上游版本。

**已合併 25 筆**（#3771、#3773–#3780、#3789–#3796、#3798–#3801、#3803、#3804、#3806、#3807、#3809）：每筆 `git log 25278e7d..upstream/main --grep="#<編號>"` 至少命中 1 個 commit，隨 commit 軸整棵採用抵達，本輪不逐筆摘取。其中值得合併時優先驗的：#3775／#3776／#3777（config-protection、run-with-flags、gateguard，對應先前觀察的 issue #3761／#3762）、#3806／#3809（兩個整合 PR，243 檔與 53 檔，合併時最需要掃描的兩筆）、#3801（shell 引號解析）。

**已關閉未合併 4 筆**

| PR | 內容 | 本 fork 實況與判定 |
|---|---|---|
| #3772（+179／−79，13 檔） | hooks 行內 WSL 路徑去反斜線 | 不採用：上游改用 `dc9bb9f2` 直接修（見上），fork 已有等價修正（`df46e59e`）。 |
| #3784（+257／−56） | `skills/frontend-slides/scripts/static-server.mjs` 符號連結強化 | 不採用：fork 與上游 tip 都沒有 `static-server.mjs`（`git show upstream/main:…` 回 does not exist），沒有可修的對象。 |
| #3797（+117） | ecc2 排程文字就地編輯 | 不採用：fork 不建置、不發佈 ecc2；同題材的 #3798 已合併。 |
| #3805（+29／−3） | `docker/gateguard-effectiveness/fake-claude.js` 的 shell 注入 | 不採用：只影響上游的 docker 測試 fake，fork 不跑該 harness，上游也未收。重看條件：fork 開始跑 docker harness。 |

**OPEN 26 筆**：不提前引用（FORK.md），#3830 例外見上。其餘：

| PR | 判定 | 理由與重看條件 |
|---|---|---|
| #3813, #3814, #3816, #3818, #3819, #3820, #3822, #3824 | 條件式，釘到 `monitored` | 都是 hooks、安裝器或 continuous-learning 的行為修正（#3813 Copilot helper 的 ESM 隔離、#3814 父行程消失時結束 hook runner、#3816 `@opencode-ai/plugin` 改為選用 peer 依賴、#3818 observer 專案範圍隔離、#3819 Node 腳本資料內的 bypass 文字、#3820 認得 `npm-shrinkwrap.json`、#3822 stdin 監聽與 tsc 路徑、#3824 commit-quality 的 `!` 破壞性變更標記）。本輪沒有逐一在 fork 重現缺陷（判準四要求的步驟留到合併時），維護者目前沒有遇到。上游合併或 head 移動時，檢查器會再報；合併後隨整棵採用抵達。 |
| #3808 | 不採用 | 依賴升級（`yarn.lock` +501／−74，49 行 integrity）；fork 的 `overrides`／`resolutions` 有自己的釘版（`markdown-it`、`toml`），依賴走 Dependabot 自己的流程（同 10-26 對 #3737／#3738）。 |
| #3787、#3811、#3817、#3829、#3833、#3835、#3836、#3837 | 不採用 | 產品新功能或非 Windows 主線的行為（benchmark 最佳化、harness 合規、ecc2 狀態刷新、continuous-learning Stop 提示、Pi 擴充兩筆、MCP 設定 deja-vu、`block-no-verify` 套件整合）；fork 無痛點。重看條件：上游合併，或維護者實際使用該功能。 |
| #3812、#3823、#3827、#3832、#3834、#3838、#3839、#3841 | 不採用 | 文件、翻譯、skill 描述與命名（義大利文 README、Firecrawl 範例、gacha 輸出編碼、i18n 連結、第三人稱描述、DevFleet 名稱、連結、README 排版）；fork 保持上游英文 README 契約（見 2026-08-27），不自行改字。上游合併後經 commit 軸抵達。 |

**issue（19 筆）**

| issue | 判定 | 理由 |
|---|---|---|
| #3768、#3769、#3770、#3781、#3786（CLOSED） | 隨整棵採用抵達 | 分別由已合併的 #3773、#3779、#3774、#3780／#3789、#3794 修正。 |
| #3767（CLOSED，標題 `D`） | 不收 | 內容空洞，無可處理項目。 |
| #3802（OPEN）原生 Windows 的 Stop hook 反斜線 SyntaxError | 已涵蓋 | 與 10-26 的 issue 3746 同一缺陷。fork 的 `hooks/hooks.json` 雙反斜線 0 處、`fromCharCode(92)` 27 處（2026-11-02 實測），與上游 tip 相同。 |
| #3793（OPEN）plugin marketplace 目錄缺 `js-yaml` | 不採用 | 只在以 marketplace plugin 方式安裝時發生（同 10-28 對 #3756 的判斷），維護者沒這樣裝。重看條件：維護者以 plugin 安裝本 fork。 |
| #3810（OPEN）、#3821（OPEN） | 對應 PR #3816、#3822 | 已一併釘在 `monitored`。 |
| #3788（OPEN） | 隨整棵採用抵達 | 由已合併的 #3789 補文件。 |
| #3783（OPEN）34 個 skill 超過 500 行、一個名稱含保留字 | 不採用 | 上游 skill 品質規範；保留字部分由 OPEN 的 #3838 處理。 |
| #3766、#3782、#3785、#3815、#3825、#3826、#3831（OPEN） | 不收 | 上游 GitHub App 權限、兩筆無實質內容的 `[Copilot]`、上游貢獻流程、MCP 設定遮蔽的回饋、Pi 擴充兩筆；與 fork 的 Windows 維護線無關。#3785 問的是透過 fork 回貢的流程，本 fork 規則是不回貢（見 2026-08-27）。 |

**水位**：commit `25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b`（不變，上游 tip `b38be6a7`，behind 262）、PR #3841、issue #3831、日期 2026-11-02。`--strict` 仍會因 commit 軸 exit 1，這是刻意的：整棵採用前不能把 262 個 commit 當成審過。

## 2026-11-03：以明確 base 三方整合上游 `b38be6a7`

**範圍**：開工時 `git fetch upstream main` 的 `upstream/main` 為 `b38be6a7f6350964d59328b52f0624e1d1d552d1`；`25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b..b38be6a7` 共 262 個 commit、266 個上游變更檔。以 `git merge-tree --write-tree --merge-base=25278e7d HEAD upstream/main` 計算三方結果，衝突解決前的計算樹為 `d2fa0b866fba14563149eee6ea0765fe1e3f9660`；只將結果檔案寫入工作目錄，保留 Git index 與 HEAD。

**合併前掃描**：以 `git diff --no-ext-diff --unified=0 25278e7d upstream/main` 取得新增 17,165 行；檢查長空白（40 字元以上）、超長單行（2,000 字元以上）、`eval`／`new Function`／`global.require`、長 base64／hex（160 字元以上）、零寬與雙向控制字元。9 條超長行為公開的 hook bootstrap；唯一動態函式為 `tests/skills/typescript-patterns.test.js` 執行本地編譯 fixture 的 `new Function`。未發現長空白、長編碼或隱藏控制字元。

**衝突裁決**：12 檔的產品內容全部採上游：`AGENTS.md`、`commands/auto-update.md`、`commands/instinct-status.md`、`commands/sessions.md`、`commands/skill-health.md`、`commands/skill-host-compat.md`、`hooks/codex-hooks.json`、`hooks/hooks.json`、`hooks/hooks.metadata.json`、`scripts/lib/install-targets/helpers.js`、`scripts/lib/resolve-ecc-root.js`、`tests/lib/serialized-hook-wsl.test.js`。`AGENTS.md` 保留 fork 維護標頭，以及 fork 專屬的 `## Roadmap`、Prompt injection defense baseline、`Claude Code Entry Point & Dev Notes` 三段，其餘採上游；行內解析器與 serialized WSL 測試的等價 fork 產品 overlay 由上游修正取代。保留額外的無反斜線回歸測試、既有假 CLI 隔離及 Windows 符號連結能力測試；沒有新增提前引用 open PR，也沒有刪除既有檔案。

**新增 fork 守衛**：`npmscan.yml` 會向第三方傳送依賴檔並對 PR 留言，故 `scan` job 限定 `github.repository == 'affaan-m/ECC'`，納入逐 job 守衛清冊。回歸先紅（`scan` 缺守衛，1 failed／1 passed），加上守衛後綠（2 passed）。產品 `ci.yml` 維持在 fork 執行。

**鎖檔與驗收界線**：上游已移除 `effect`，`package-lock.json` 與 `yarn.lock` 都不再含 `toml`，故刪除 `overrides` 與 `resolutions` 的兩條 `toml` 項目（2026-10-24 條目的移除條件，以鎖檔實查成立）；上游已含等價 `markdown-it` 修補。`npm ci --ignore-scripts` 成功後還原其改寫的 Yarn v1 鎖檔，維持三方結果的 Yarn 4 格式，該檔與上游一致。27 條 hook 命令透過 Node／Git Bash、隔離 bootstrap stub 逐條驗證，沒有 SyntaxError；此證據只涵蓋命令解析，不代表真實宿主安裝或 hook 副作用驗收。commit 水位以 fork CI（windows-latest）為準，本機的兩個失敗另列於下方裁決；PR／issue 缺乏新的逐筆分流證據，維持 #3841／#3831 與既有 monitored 清冊。

**驗收與水位裁決**：`npm ci --ignore-scripts` exit 0；完整 `npm test`（包含 `node tests/run-all.js`）exit 1，8,000 個測試中 7,998 passed／2 failed，456 個檔通過／2 個檔失敗。`ci/context-profiles.test.js` 子程序固定 60 秒上限，單檔診斷重跑在 60,031.57 ms 回 `ETIMEDOUT`／`status: null`，2 passed／1 failed（exit 1）；同一驗證器在前置閘門無此測試上限時已成功完成 34 個 profile／target 投影。`lib/install-state.test.js` 的並行 rename 曾回 `EPERM`，單檔重跑 10 passed／0 failed（exit 0）；atomic-write、install-state 與該測試在採用範圍內均未變動。不放寬 timeout、不修改無關產品碼；完整本機綠燈未達成，但兩筆失敗皆非本次採用造成：`ci/context-profiles.test.js` 在乾淨 HEAD 以舊的 30 秒上限同樣回 `ETIMEDOUT`，`lib/install-state.test.js` 單檔重跑通過；計入勝負的是 fork CI（windows-latest）。**水位推進到 `b38be6a7`**（262 個 commit 全數審過並整合）；本機逾時另列 ROADMAP 近期列追查。PR／issue 水位仍為 #3841／#3831，open PR #3830 上游尚未合併，仍留在 `monitored`。

## 2026-11-03：新增 `minimatch` override 11.0.1

**決定**：`package.json` 的 `overrides` 與 `resolutions` 新增 `minimatch: 11.0.1`（精確釘版，同其他項目），`package-lock.json` 用 `npm install --package-lock-only --ignore-scripts` 重產，`yarn.lock` 用 yarn 4.9.2 `install --mode=update-lockfile` 重產。對應 Dependabot 警示 #61（package-lock.json）與 #63（yarn.lock），受影響範圍 `< 11.0.1`（GHSA-g3hv-75wg-m249，medium），最低安全版 11.0.1。

**理由**：Dependabot security update 失敗是因為所有上游父套件都把 minimatch 鎖在 10.x，解析器只能裝到 10.2.5。兩份鎖檔都只有一個 `minimatch` 條目（10.2.5），皆為 devDependency，經 `eslint`（直接與 `@eslint/config-array`）、`markdownlint-cli`（`~10.2.5`）、`c8` → `test-exclude` → `glob`（皆為 10.x 範圍）；`package.json` 的 `dependencies` 沒有 minimatch，`files` 發佈清單也不含 `node_modules`，所以不隨產品內容出貨。三個呼叫端都用 `require('minimatch')` 或 `import {minimatch}` 取具名匯出，並使用 `minimatch()` 函式與 `new minimatch.Minimatch(...)`；11.0.1 仍匯出同一組，實測 `minimatch.Minimatch` 為 function。11.x 新增 `@isaacs/nonrecursive-glob-match` 作為匹配引擎，沒有 `engines` 限制。

**為何釘 11.0.1 而不是 `^11.0.1`**：11.0.4 把 `engines.node` 收緊為 `20 || >=22`，而產品 `ci.yml` 矩陣含 Node 18.x；11.0.0 至 11.0.3 與 11.0.1 一樣宣告 `18 || 20 || >=22`。精確釘在最低安全版，Node 18 矩陣不會被拉進不支援的版本。

**驗收**：`npm ls minimatch --all` 全部解析到 11.0.1；`npm audit --package-lock-only` 由 8 個 moderate 降為 3 個，minimatch 與經它連帶的 `eslint`、`markdownlint-cli` 項目消失，剩下的是不同公告（`glob` 的 GHSA-3g3m-2fjr-6pw4，經 `c8`／`test-exclude`），無 Dependabot 警示。在 yarn 4.9.2 以乾淨副本跑 `yarn install --immutable --mode=skip-build` exit 0，解析到 11.0.1。`eslint .` 與 `markdownlint` 實際以 11.0.1 跑完；`test-exclude` 的 `shouldInstrument` 與 `globSync` 直接呼叫結果正確。`npm test` 完整一輪：8,001 個測試中 7,999 passed／2 failed；`lib/install-state.test.js` 為既有的並行 rename 不穩定，`hooks/context-prompt-suggestions.test.js` 在滿載下因時間限制回空輸出，單檔重跑 10 passed／0 failed，兩者都與 minimatch 無關。`c8` 在本機 Node 26 於 `yargs` 載入階段即失敗（ESM／CJS），未走到 minimatch；覆蓋率以 fork CI 為準。

**移除條件**：`eslint`、`markdownlint-cli`、`test-exclude`／`glob` 的 minimatch 範圍都涵蓋 `>=11.0.1` 時，刪除這兩條 `minimatch` 項目。

## 2026-11-04：hook 子程序的 stdin 管線錯誤不再讓阻擋變成放行

**根因**：`scripts/hooks/plugin-hook-bootstrap.js` 的 `spawnNode` 與 `spawnShell` 用 `spawnSync(..., { input })` 把 stdin 轉給子 hook。子 hook 沒讀 stdin 就寫完輸出並 `exit 2`，父端寫入時撞到已關閉的管線，`spawnSync` 回傳 `result.error`（macOS 為 `EPIPE`，本機 Windows 為 `EOF`），但 `result.status`、`stdout`、`stderr` 其實是子程序的真實結果。bootstrap 看到 `result.error` 就 fail-open 成 `exit 0`，吞掉阻擋語意：一個 blocking hook 會隨機被放行。

**證據**：CI run for `2afe6427`，job Test macos-latest Node 22.x full，在 `tests/hooks/plugin-hook-bootstrap.test.js` 的 `node mode forwards child stdout and exit status for blocking hooks` 加診斷後印出 `stderr: "blocked stderr
[Hook] bootstrap execution failed: spawnSync .../bin/node EPIPE
", signal: null`。先前 run 41762172644（`ff03b3e3`）兩次 attempt 失敗點不同，是同一類競態：子程序是否在父端寫完前退出取決於排程。

**修法**：`scripts/hooks/hook-input.js` 新增 `isBenignStdinPipeError(result)`，只在「`error.code` 為 `EPIPE`／`EOF`、`status` 為整數、無 `signal`」時成立；`plugin-hook-bootstrap.js`、`run-with-flags.js`（legacy 子程序路徑）、`lifecycle-hook-bootstrap.js`、`session-start-bootstrap.js` 在判斷執行失敗前先排除這個形狀，改照子程序的 status／stdout／stderr 轉發。spawn 失敗、`ETIMEDOUT`、signal、`status === null` 維持原本的失敗處理。

**驗證**：新增兩個測試。一個用 1 MiB（stdin 上限，遠大於管線緩衝）餵不讀 stdin 就 `exit 2` 的子 hook，斷言 bootstrap 回 `2` 且轉發 stdout；另一個直接測判定函式的邊界。helper 暫時停用時前者在本機 Windows 3 次都紅（`bootstrap execution failed ... EOF`），恢復後 5 次全綠。測試斷言保留診斷訊息。

## 2026-11-04：上游 PR #3847–#3866、issue #3843–#3867 逐筆分流；commit 軸為 0

**範圍**：`git fetch upstream main` 後 `upstream/main` 仍是 `b38be6a7f6350964d59328b52f0624e1d1d552d1`（`git log b38be6a7..upstream/main` 0 筆，`gh api repos/affaan-m/ECC/commits/main` 回同一 SHA），亦即水位之後上游 main 沒有新 commit，**沒有可移植的已合併修正，也就沒有需要記 Co-authored-by 的上游作者**。`python tools/check_upstream_updates.py` 列出 PR 16 筆（#3847–#3866）、issue 8 筆（#3843–#3867）；`gh pr list／issue list --state all` 對照一致：PR 全部 OPEN（其中 #3860 是 draft）、無 MERGED 與 CLOSED，issue 全部 OPEN。編號 #3842、#3851 在 `gh api repos/affaan-m/ECC/issues/<n>` 回 404（issue 與 PR 共用編號空間），沒有內容可審，記為缺號而不是漏審。每筆 PR 以 `gh pr diff` 讀完整 diff（head 見下），照判準八掃新增行：長空白、超過 600 字元、`eval(`／`new Function(`／`globalThis`／`<script`、80 字元以上 base64、零寬與控制字元。命中全部正常：#3847 的 `globalThis.fetch` 預設參數與 Chrome 擴充頁面的 `<script type="module">`、#3853 的 `hooks/hooks.json` 既有長行內命令（7 行）、#3854 的 `globalThis` 重複註冊守衛、#3858 測試裡的 1×1 PNG data URI；無隱藏程式。

**移植：本輪 0 筆**。FORK.md 的判準是 open PR 預設不提前引用，例外限於「本 fork 現在就在痛」。逐筆實查後沒有任何一筆成立：三組有實際缺陷的（#3849／#3858 的祕密遮罩缺口、#3862 的 gateguard 豁免、#3864 的拒絕訊息）都在本 fork 隨附的 hook 裡，但維護者本機沒有安裝 ECC plugin（`~/.claude/plugins/installed_plugins.json` 與 `~/.claude/settings.json` 都查無 ECC 條目，`~/.claude/plugins/cache` 只有 agent-advisor、claude-plugins-official、myr2d2），缺陷不會在維護者的 session 發生；它們也不是已合併的上游修正，不符合「安全修正且本 fork 明確需要」。判定為延後並釘進 `monitored`，上游合併後隨整棵採用抵達。

**PR（16 筆，head 為 2026-11-04 讀 diff 時的值）**

| PR | 判定 | 上游證據 | fork 端證據與理由／重看條件 |
|---|---|---|---|
| #3847 `0f628d3c`（+3586，49 檔） | 不適用 | 新增頂層 `chrome-ugc-video-generator/`（Chrome 擴充：Gemini＋Veo） | 產品新功能，fork 無對應目錄也無痛點。重看：上游合併後經整棵採用抵達，不單獨處理 |
| #3848 `cb531fef` | 不適用 | `scripts/hooks/desktop-notify.js` hunk `@@ -68,15 +68,23 @@`：PowerShell 單引號字串只雙寫 ASCII `'`，但 U+2018–U+201B 也會結束字串（新增 `quotePowerShellString`） | 缺陷屬實：fork `scripts/hooks/desktop-notify.js:77-79` 只替換 ASCII `'`，助理訊息含彎引號即可跳出字串。但這條路徑只在 WSL 執行：`:208` `else if (isWSL)`，`isWSL` 在 `:34-41` 僅 `process.platform === 'linux'` 且 `/proc/version` 含 microsoft 時為真；原生 Windows 與 macOS 都不走 `notifyWindows`。維護者是原生 Windows。重看：維護者開始在 WSL 內使用本 fork 的 Stop hook，或上游合併 |
| #3849 `4d3e66e0` | 延後（釘 monitored） | `scripts/hooks/post-bash-command-log.js` hunk `@@ -19,9 +19,110 @@`：新增 `sk-`、JWT、PEM 遮罩與 `secret=`／`api_key=` 值的引號感知遮罩 | 缺口屬實：fork `post-bash-command-log.js:21-34` 的 `sanitizeCommand` 只認 `--token`、`Authorization`、AKIA／ASIA、`password`、`ghp_`／`gho_`／`ghs_`／`github_pat_`。實測：以暫存 `CLAUDE_CONFIG_DIR` 呼叫 `run()`，命令 `curl -H "x: sk-ant-api03-…" https://x` 原樣寫進 `bash-commands.log`。只寫本機 `~/.claude/*.log`，不外送，且 hook 未安裝。重看：維護者安裝本 fork 的 hook，或上游合併（對應 issue #3846） |
| #3853 `1902461a` | 延後（釘 monitored） | `scripts/hooks/plugin-hook-bootstrap.js` hunks `@@ -189,6 +189,24 @@`、`@@ -283,7 +301,10 @@`；`run-with-flags.js` 抽出 `runHook()`；`hooks/hooks.json` 7 條命令改動。每個 hook 省約 85 ms（PR 自量） | 效能優化，非缺陷。它動的正是 fork 今天剛修的區域：`plugin-hook-bootstrap.js:172` `spawnNode`、`:306` 的 `isBenignStdinPipeError` 判斷（`7fcc3a5a`）；in-process 呼叫會改變 hook 的行程隔離與 `process.env` 汙染面，需要重做 EPIPE 回歸。重看：上游合併，或維護者實測 hook 延遲造成困擾 |
| #3854 `76f8ea4b`（+1756／−565，14 檔） | 不適用 | `.opencode/plugins/ecc-hooks.ts` 改 OpenCode 2.x V2 外掛介面；另動 `scripts/lib/install/apply.js`、`content-transform.js`、`hook-consent.js` | fork 有 `.opencode/plugins/ecc-hooks.ts`、`.opencode/opencode.json:20` 的 `plugin` 條目，但維護者不用 OpenCode；PR 同時動安裝器主流程，不是獨立小修。重看：維護者使用 OpenCode，或上游合併 |
| #3855 `f408fb12` | 延後 | `README.md` hunk `@@ -1345,7 +1345,7 @@`、`commands/setup-pm.md` hunk `@@ -32,7 +32,7 @@`：fallback 寫 npm | 文件主張屬實：`scripts/lib/package-manager.js:225-236` 無任何設定時直接回 npm，`tests/lib/package-manager.test.js:757` 釘住；fork 文件仍寫「First available」（`README.md:1351`、`commands/setup-pm.md:35`）。README 保持上游英文契約，不自行改字；隨上游合併抵達 |
| #3857 `1cf547bf` | 不適用 | `rules/common/coding-style.md`、`code-review.md` 各加一條規則 | 規則偏好文字，非缺陷（`coding-style.md:32` 已有同題材的 Avoid speculative generality）；上游合併後抵達 |
| #3858 `b56f5e77` | 延後（釘 monitored） | `skills/continuous-learning-v2/hooks/observe.sh` hunks `@@ -278,8 +278,10 @@`、`@@ -363,8 +366,10 @@`：兩份 `_SECRET_VALUE_RE` 各加 `sk-` 家族與 JWT 分支 | 缺口屬實：fork `observe.sh:288`、`:373` 兩份 `_SECRET_VALUE_RE` 只有 PEM、`gh*_`、`github_pat_`、AKIA／ASIA 與 DSN。以 fork 的兩個正規式（原樣複製）實測：`output: sk-ant-api03-…`、`output: eyJ….….…` 都不被遮罩。`pre:observe:continuous-learning` 在 fork hooks 內，但 plugin 未安裝。重看：同 #3849 |
| #3859 `467bd44b`（+710／−69） | 延後（釘 monitored） | 新增 `skills/continuous-learning-v2/scripts/lib/python-cmd.sh`，`observe.sh` hunk `@@ -39,61 +39,20 @@` 與 `detect-project.sh` 改用它；對 Python Install Manager 別名只探測一次並快取 | 場景與本機一致：`command -v python3` 解析到 `%LOCALAPPDATA%\Microsoft\WindowsApps\python3`，該目錄的 `python3.exe` 是 `PythonSoftwareFoundation.PythonManager_26.4.240.0` 的符號連結。fork `observe.sh:69` 起的 `resolve_python_cmd` 只跳過 `AppInstallerPythonRedirector` 殘樁，依 PR 描述的機制，重複 App Installer 更新檢查應會發生（推論，本輪未量測事件記錄）。但只有 observe hook 啟用時才觸發（未安裝），且 PR 是 710 行新增 shell 加快取，沒有對應的本機重現。重看：維護者啟用 continuous-learning 的 observe hook（立即改為提前引用候選），或上游合併 |
| #3860 `f841420f`（draft，+556／−38） | 延後（釘 monitored，state `draft`） | `.github/workflows/ci.yml`、`tests/run-all.js`、`tests/ci/run-all.test.js` 與 4 個測試檔：Windows 全套 2 個 worker、新增 junction 案例 | 與 #3830（已採用）同在 symlink 測試區，且改全套 runner；PR 自述本機仍有 24 個失敗（EPERM）、未在雲端跑過此版本。fork CI 現況：最近 `ci.yml` run `41777229226`（`7fcc3a5a`）約 28 分鐘、success，沒有逾時。重看：fork 的 windows-latest full lane 逾時或成為瓶頸，且該 PR 已非 draft 並合併 |
| #3861 `5805fbec` | 不適用 | `package.json` 把 `@opencode-ai/plugin` 由 devDependencies 移到 dependencies，`package-lock.json` 同步 | fork 的 `package.json:567` 在 devDependencies；fork 不發 npm 套件，沒有「消費者缺依賴」的場景；同題材的 #3816（改 optional peer）已在 `monitored`，兩案互相競爭，等上游選定。重看：上游合併其中一案 |
| #3862 `eb770f26` | 延後（釘 monitored） | `scripts/hooks/gateguard-fact-force.js` hunks `@@ -2010,12 +2010,6 @@`、`@@ -2444,7 +2438,9 @@`、`@@ -2618,7 +2614,7 @@`：移除 `.claude/settings*.json` 免閘門；`tests/hooks/gateguard-fact-force.test.js` Test 16 由「允許」改為「拒絕」 | 缺陷屬實（即 issue #3845）：fork `gateguard-fact-force.js:2013` `isClaudeSettingsPath`、`:2447` 回 `claude-settings` 豁免、`:2621` MultiEdit 子代理路徑同樣豁免。但上游測試與 `skills/gateguard/SKILL.md:258` 明載這是刻意設計（Claude settings files 允許編輯，讓人能關掉 hook），PR 反轉設計取向。重看：維護者安裝本 fork 的 hook，或上游合併 |
| #3863 `ce800017` | 不適用 | 只動 `ecc2/src/worktree/mod.rs` | fork 不建置、不發佈 ecc2（同 10-28 對 #3755） |
| #3864 `54989037` | 延後（釘 monitored） | `config-protection.js` hunks `@@ -145,6 +145,10 @@`、`@@ -221,8 +227,10 @@`；`gateguard-fact-force.js` hunk `@@ -115,6 +115,13 @@`；`run-with-flags.js` hunk `@@ -138,9 +138,14 @@`：拒絕訊息預設不再點名關閉 hook 的環境變數，新增 `ECC_SHOW_RECOVERY_HINTS` | 缺陷屬實（即 issue #3844）：fork `config-protection.js:155,225`、`gateguard-fact-force.js:2111`（`ECC_GATEGUARD=off disables this gate`）、`run-with-flags.js:143` 的拒絕文字都直接給出繞過方法。PR 改的是使用者可見的預設文字並新增環境變數，另外把 `run-with-flags.js` 檔案模式由 755 改 644；這是產品判斷，不是自足修正。重看：同 #3862 |
| #3865 `f5b18672` | 不適用 | `scripts/skills-health.js` 缺 `scripts/lib` 時印補救訊息而非 `MODULE_NOT_FOUND` 堆疊（PR 內註解引用 #3259） | 只在 marketplace 託管安裝缺 `scripts/lib` 時發生（同 11-02 對 #3793 的判斷）；fork 完整 checkout 有 `scripts/lib/skill-evolution/`（`health.js`、`dashboard.js`、`index.js`），`scripts/skills-health.js:4` 的 require 成功。重看：維護者以 plugin 安裝本 fork |
| #3866 `9142afa7` | 延後 | `skills/gateguard/SKILL.md` hunks `@@ -691,7 +691,9 @@`、`@@ -703,7 +705,7 @@`：改正「hook 讀 `.gateguard.yml`」的說法 | 文件主張屬實：`grep -rn gateguard.yml scripts` 無任何命中，fork `skills/gateguard/SKILL.md:694,706` 的敘述不符實況。僅文件，隨上游合併抵達 |

**issue（8 筆，全部 OPEN）**

| issue | 判定 | 理由與重看條件 |
|---|---|---|
| #3843、#3852 | 不收 | 兩筆 `[Copilot]` 都是未填的範本（#3843 只有勾選框、#3852 只有一個 repo 網址），沒有可處理項目（同 11-02 的 #3782、#3785 類型） |
| #3844 | 對應 PR #3864 | 缺陷屬實，見上表；已隨 #3864 釘在 `monitored` |
| #3845 | 對應 PR #3862 | 同上；注意上游自己的測試與 skill 文件把它寫成刻意行為 |
| #3846 | 對應 PR #3849、#3858 | 缺口以暫存目錄實測重現（命令記錄）與正規式實測重現（observe）；兩個 PR 都已釘 |
| #3850 | 不收 | `[Feedback]`：建議替 `intent-driven-development` skill 補一個「對照 issue 描述與留言進度」的範例；自述「ECC 的介入程度未知」，是使用回饋不是缺陷，與 fork 維護線無關 |
| #3856 | 不收 | `[Feedback]`：委派資料審查時應限縮輸出欄位；自述「未重現 ECC 的弱點，未檢視原始結果」，無可驗證的 ECC 行為 |
| #3867 | 延後 | 缺陷在 fork 成立的條件齊備：fork `scripts/hooks/session-start.js:733` 同樣把前次 session 摘要包進「HISTORICAL REFERENCE ONLY — NOT LIVE INSTRUCTIONS」再注入，issue 描述 classifier 通知被記成使用者任務後自我延續。屬 session-start／session-end 產品行為，維護者沒裝 plugin，不在本機發生。issue 自附 workaround：`ECC_SESSION_START_CONTEXT=off`。重看：維護者安裝本 fork 的 SessionStart hook，或上游出修正 |

**monitored 新增 7 筆**：`pr#3849`、`pr#3853`、`pr#3858`、`pr#3859`、`pr#3860`（state `draft`）、`pr#3862`、`pr#3864`，各釘上表 head。#3855、#3866 是純文件、#3847／#3848／#3854／#3857／#3861／#3863／#3865 判為不適用，不釘；它們若被上游合併，會經 commit 軸出現。

**水位**：commit 軸 `b38be6a7f6350964d59328b52f0624e1d1d552d1`（不變，behind 0）、PR #3866、issue #3867、日期 2026-11-04。PR／issue 軸本輪連續且逐筆有證據（#3842、#3851 為 404 缺號，見範圍段）。

## 2026-11-05：PR #3868–#3878、issue #3875／#3877 分流與監看釘點重審

**範圍與依據**：起始 fork `db0d5fb628944b4ccb5e2ac5c411684dad7fb312`，工作樹乾淨。先執行 `python tools/check_upstream_updates.py --strict`（exit 1），再以唯讀 `gh api repos/affaan-m/ECC/pulls/<n>`、`pulls/<n>/files`、`gh pr diff <n> --repo affaan-m/ECC` 讀提案與 patch；已移動的釘點另讀 `compare/<舊 head>...<新 head>`。不是以 --stat 作裁決。`gh api repos/affaan-m/ECC/commits/main` 回 `b38be6a7f6350964d59328b52f0624e1d1d552d1`，與本機 upstream/main／commit 水位相同；沒有已合併且獨立的修正可移植。沒有產品改碼，也沒有移植作者需要提供 Co-authored-by；文件不記 email。

政策：合法可用的上游做法依技術、Windows 適用性與安全回歸評估；open PR 依維護者指定不提前移植，釘 head／state 與重看條件。下列編號覆蓋 #3868 至 #3878 的共享 issue／PR 編號空間，沒有缺號。來源連結釘完整 head SHA；fork 行號以起始 SHA 為準。

| PR | 判定 | 上游 SHA:檔案:行號 | fork 證據、理由與重看條件 |
|---|---|---|---|
| [#3868](https://github.com/affaan-m/ECC/pull/3868) | 關閉未合併；不採用 | [`c94355f21354f82b9c95a0df6b103a161640d714:scripts/hooks/plugin-hook-bootstrap.js:339`](https://github.com/affaan-m/ECC/blob/c94355f21354f82b9c95a0df6b103a161640d714/scripts/hooks/plugin-hook-bootstrap.js#L339)；[`c94355f21354f82b9c95a0df6b103a161640d714:scripts/hooks/session-start.js:481`](https://github.com/affaan-m/ECC/blob/c94355f21354f82b9c95a0df6b103a161640d714/scripts/hooks/session-start.js#L481)；[`c94355f21354f82b9c95a0df6b103a161640d714:scripts/lib/state-store/queries.js:502`](https://github.com/affaan-m/ECC/blob/c94355f21354f82b9c95a0df6b103a161640d714/scripts/lib/state-store/queries.js#L502) | fork `scripts/hooks/plugin-hook-bootstrap.js:306` 已保留 EPIPE／EOF 子程序結果；`scripts/hooks/session-start.js:493` 只有 confidence 篩選，`scripts/lib/state-store/queries.js:498` 仍按 updated_at 排序。提案同時改 hook 失敗語意、instinct 信任與 Rust／UI／資料庫，不能當獨立已合併修正移植。技術提案可用性不因關閉而否定；重看：上游以獨立 PR 接受相關修正，經 commit 軸審查。 |
| [#3869](https://github.com/affaan-m/ECC/pull/3869) | 觀察；不提前引用 | [`b4a873040b471281bcf6ae56c5ee87ccb4a0fea8:skills/leanrea/SKILL.md:2`](https://github.com/affaan-m/ECC/blob/b4a873040b471281bcf6ae56c5ee87ccb4a0fea8/skills/leanrea/SKILL.md#L2) | fork `manifests/install-modules.json:188` 起的 skill 清冊沒有 leanrea，`FORK.md:11` 保留上游產品內容的原則適用。這是新增逆向工作流程而非 bug fix；Windows PE／PowerShell 範例可用，但還強制 uv／bun／Rust 工具選擇。重看：上游合併後經 commit 軸整合並驗 manifest／host compatibility。 |
| [#3870](https://github.com/affaan-m/ECC/pull/3870) | 延後；釘 monitored | [`a08d5da8c9017a891ff7c142b6176373724a2b01:scripts/hooks/session-end.js:24`](https://github.com/affaan-m/ECC/blob/a08d5da8c9017a891ff7c142b6176373724a2b01/scripts/hooks/session-end.js#L24)、同檔 :43 | fork `scripts/hooks/session-end.js:22,41` 只濾 HARNESS_NOISE，classifier 通知可成為任務；對應既有 issue #3867。anchored filter 與保留句中引用的測試方向可用，尚未合併。重看：PR 合併／head 移動；採用時跑 session-end／session-start 測試並保留真正使用者提問。 |
| [#3871](https://github.com/affaan-m/ECC/pull/3871) | 延後；釘 monitored | [`697c1d0e71b6eca050e5522ff8d36351d7f34cb2:skills/continuous-learning-v2/hooks/observe.sh:69`](https://github.com/affaan-m/ECC/blob/697c1d0e71b6eca050e5522ff8d36351d7f34cb2/skills/continuous-learning-v2/hooks/observe.sh#L69) | fork `skills/continuous-learning-v2/hooks/observe.sh:69-81` 回傳 python3／python 名稱，未改走 Install Manager launcher。新案以同目錄身分（-ef）與可執行檔檢查決定，保留顯式 CLV2_PYTHON_CMD 與 Store Python fallback，比 #3859 的 probe／cache 範圍小；Windows 可用，仍是 open。重看：合併／head 移動；採用須跑 launcher、observe 與 digest 驗證。 |
| [#3872](https://github.com/affaan-m/ECC/pull/3872) | 延後；釘 monitored | [`cfe051de5f28684bbac235277e37f9457098867d:scripts/lib/memory-vault-format.js:54`](https://github.com/affaan-m/ECC/blob/cfe051de5f28684bbac235277e37f9457098867d/scripts/lib/memory-vault-format.js#L54) | fork `scripts/lib/memory-vault-format.js:54` 的 gh[pors] 缺 u，vault scanner 不涵蓋該 token 類型。新增字元分支為獨立小修且平台中立，但尚未合併。重看：合併／head 移動；採用須證明 save 拒絕與 import quarantine，測試只用組裝的假值。 |
| [#3873](https://github.com/affaan-m/ECC/pull/3873) | 延後；釘 monitored | [`3d7034872ea028e5999aadc48e68e2c622892f3d:scripts/lib/memory-vault-format.js:282`](https://github.com/affaan-m/ECC/blob/3d7034872ea028e5999aadc48e68e2c622892f3d/scripts/lib/memory-vault-format.js#L282)；[`3d7034872ea028e5999aadc48e68e2c622892f3d:scripts/lib/memory-vault.js:322`](https://github.com/affaan-m/ECC/blob/3d7034872ea028e5999aadc48e68e2c622892f3d/scripts/lib/memory-vault.js#L322)、同檔 :504 | fork `scripts/lib/memory-vault.js:322,504` 掃 JSON.stringify(memory)，`scripts/lib/memory-vault-format.js:282-287` 只接受字串。JSON 跳脫後的 n／t 與 token 前綴相鄰會破壞 word boundary；逐欄解碼掃描方向可用且與 Windows 無衝突，仍未合併。重看：合併／head 移動；採用須驗換行／tab、儲存拒絕及匯入隔離，保留 size／symlink 防護。 |
| [#3874](https://github.com/affaan-m/ECC/pull/3874) | 延後；釘 monitored | [`3d8a6a140143897ff630cd892652f92ed0170c82:skills/skill-stocktake/scripts/quick-diff.sh:94`](https://github.com/affaan-m/ECC/blob/3d8a6a140143897ff630cd892652f92ed0170c82/skills/skill-stocktake/scripts/quick-diff.sh#L94) | fork `skills/skill-stocktake/scripts/quick-diff.sh:92-99` 對已知檔只比全域 evaluated_at，會漏掉批次執行中已變動的早期項目。改比各 skill mtime 並 fallback 舊快取合理；但上游 `3d8a6a140143897ff630cd892652f92ed0170c82:tests/scripts/skill-stocktake-discovery.test.js:356` 新測試排除原生 Windows，不能宣稱 Windows runtime 已驗。重看：合併／head 移動；採用驗 array／path-keyed／name-keyed、時間戳倒退與 Git Bash。 |
| [#3876](https://github.com/affaan-m/ECC/pull/3876) | 延後；釘 monitored | [`d64b34137b2b18d60b9a6728e4533fcf5f2d0a5f:skills/continuous-learning-v2/scripts/instinct-cli.py:264`](https://github.com/affaan-m/ECC/blob/d64b34137b2b18d60b9a6728e4533fcf5f2d0a5f/skills/continuous-learning-v2/scripts/instinct-cli.py#L264)、同檔 :2236 | fork `skills/continuous-learning-v2/scripts/instinct-cli.py:257,270,343` 依 locale 解碼 git，`:515,527` 用 builtin generic／removeprefix。顯式 UTF-8 可避免 Windows 非 ASCII 路徑亂碼；Python 3.6 相容及 EOL notice 同案改動需一起評估，不以本機新 Python 成功推論舊版本。重看：合併／head 移動；採用驗 cp1252／非 ASCII remote ID、strict warnings 與 quiet notice。 |
| [#3878](https://github.com/affaan-m/ECC/pull/3878) | 作者關閉未合併；方向可用，fork 已自行採用同做法（見文末同日修正條目），釘 closed 監看 | [`1d15f4d0bfe5f9f9fe63eb5f5a2af9a6bbfc4cbe:scripts/lib/codex-plugin-setup.js:163`](https://github.com/affaan-m/ECC/blob/1d15f4d0bfe5f9f9fe63eb5f5a2af9a6bbfc4cbe/scripts/lib/codex-plugin-setup.js#L163)；[`1d15f4d0bfe5f9f9fe63eb5f5a2af9a6bbfc4cbe:scripts/lib/astra-review/codex.js:145`](https://github.com/affaan-m/ECC/blob/1d15f4d0bfe5f9f9fe63eb5f5a2af9a6bbfc4cbe/scripts/lib/astra-review/codex.js#L145) | fork `scripts/lib/codex-plugin-setup.js:163` 的 `runCodexCommand` （採用前）仍固定 `execFile('codex')`（`shell: false`），Windows npm 的 `codex.cmd` shim 無法被 spawn，`ecc install --guided --harness codex` 會回報 Codex 未安裝；`scripts/lib/astra-review/codex.js:130-149` 已有 `resolveCodexCommand` 但 plugin setup 未使用。提案重用該 helper 並補專案本機 `node_modules/.bin` 版面與兩組測試，方向可用且是 Windows 真缺陷；作者於 2026-11-05 無說明關閉，base 為 `b38be6a7`，上游 main 未含此修正，不能當已合併修正移植。重看：作者重開／上游以其他 PR 合併，或維護者實際跑 guided codex 安裝失敗；採用須先在 fork 重現（舊碼紅、新碼綠）並保留 argv 不含 launcher prefix。 |

| issue | 判定 | 上游證據 | fork 證據與重看條件 |
|---|---|---|---|
| [#3875](https://github.com/affaan-m/ECC/issues/3875) | 使用回饋；不移植 | issue 本文要求 first-write permission fixture，明述未建立 ECC 漏洞／因果，也未執行所建議 fixture | `skills/agent-security-hardening/SKILL.md:17,115,121,150` 已要求副作用前 fail closed、owner-only 建檔與真實 OS 邊界驗證。回饋並非此規則缺席的證明；不因 macOS 個案修改 Windows 安裝器。重看：上游提供對應實作或可重現 ECC 缺陷，經 commit／新 PR 軸分流。 |
| [#3877](https://github.com/affaan-m/ECC/issues/3877) | 無可執行內容 | API title 為 Software Engineering、body 為 null，沒有重現步驟或需求 | `FORK.md:9-13` 的 Windows fork 維護範圍無可對照的具體項目，不猜測成產品需求。重看：issue 提供具體 ECC 重現與 fork 受影響路徑。 |

**既有 monitored 重審**（保留其他未移動釘點）：

| PR | 上游證據 | fork 證據與裁決／重看條件 |
|---|---|---|
| [#3849](https://github.com/affaan-m/ECC/pull/3849) | [`71084e055545dae6c11102d079788b6a04c33a32:scripts/hooks/post-bash-command-log.js:41`](https://github.com/affaan-m/ECC/blob/71084e055545dae6c11102d079788b6a04c33a32/scripts/hooks/post-bash-command-log.js#L41) | fork `scripts/hooks/post-bash-command-log.js:22-34` 遮罩仍不含裸 sk／JWT／PEM。新 delta 逐段線性掃描 JWT chain，補 hyphen prefix 與長 ey-run 測試，方向可用；仍 open，更新 head 並延後。重看：合併／head 移動；採用驗 secret redaction 與線性成本。 |
| [#3858](https://github.com/affaan-m/ECC/pull/3858) | [`0cc28648188d2cd03e0791d93b1b26efbbd85fdb:skills/continuous-learning-v2/hooks/observe.sh:295`](https://github.com/affaan-m/ECC/blob/0cc28648188d2cd03e0791d93b1b26efbbd85fdb/skills/continuous-learning-v2/hooks/observe.sh#L295)、同檔 :304,398,407 | fork `skills/continuous-learning-v2/hooks/observe.sh:274-291,359-376` 仍有 256 上限與舊遮罩。新 delta 先遮 PEM，再遮 labeled secret，完整消耗長值，僅確定截斷時遮短尾；補 parse-error／5000 字元邊界測試。仍 open，更新 head，合併／head 移動時重看並驗兩條 Python 路徑與 digest。 |
| [#3859](https://github.com/affaan-m/ECC/pull/3859) | head `467bd44b6760eaacf41a098d4ffff77b7c1d6d4c`；[作者關閉說明](https://github.com/affaan-m/ECC/pull/3859#issuecomment-6637114381) | 作者明述由 #3871 取代；fork `skills/continuous-learning-v2/hooks/observe.sh:69-81` 對應問題不變。保留既有 head，state 改 closed，未合併所以不採用；Windows 修正的後續由 #3871 釘點追蹤。 |
| [#3862](https://github.com/affaan-m/ECC/pull/3862) | [`01c2426b2ce80354baaa31fd134f1772e4007332:scripts/lib/gateguard-target-class.js:303`](https://github.com/affaan-m/ECC/blob/01c2426b2ce80354baaa31fd134f1772e4007332/scripts/lib/gateguard-target-class.js#L303)、同檔 :333 | fork `scripts/hooks/gateguard-fact-force.js:2447,2621` 仍豁免 settings，`scripts/lib/gateguard-target-class.js:301-325` 未特判 settings。新 delta 補 lexical／realpath／project root 為 .claude 的敏感分類與 subagent Edit／Write／MultiEdit 測試，較舊案完整。仍 open；更新 head，合併／head 移動後重看，保留 Windows path／symlink／subagent 邊界回歸。 |
| [#3864](https://github.com/affaan-m/ECC/pull/3864) | [`464440aa5134311f327c4254d35e286b6af43037:scripts/lib/hooks/recovery-hints.js:8`](https://github.com/affaan-m/ECC/blob/464440aa5134311f327c4254d35e286b6af43037/scripts/lib/hooks/recovery-hints.js#L8) | fork `scripts/hooks/config-protection.js:155,225`、`scripts/hooks/gateguard-fact-force.js:2111,2192`、`scripts/hooks/run-with-flags.js:143` 仍給繞過提示。新 delta 抽共用 truthy 解析，trim／enable 一致，補 config／truncation／helper 測試。仍 open；更新 head，合併／head 移動後重看，採用時保留 fork bootstrap 的 EPIPE／EOF status 轉發。 |

**水位**：PR `reviewed_pr_through` 推至 3878，issue `reviewed_issue_through` 推至 3877，reviewed_date 為 2026-11-05；commit 水位不變。既有 closed 釘點保留以保存來源，取代案另釘；新釘 #3870、#3871、#3872、#3873、#3874、#3876、#3878（closed）。可變的未審剩餘量只由忽略的 `upstream-review-report.md` 產生，不複製到維護文件。

## 2026-11-05：修 Windows codex.cmd shim 無法啟動（上游 #3878 描述的缺陷）

fork 自行修正，採用上游 PR #3878（作者 jin0205，已關閉未合併）的做法：`scripts/lib/codex-plugin-setup.js` 的 `runCodexCommand` 改用 `astra-review/codex.js` 既有的 `resolveCodexCommand`，在 Windows 把 npm 的 `codex.cmd` shim 解析成 `node` 加 `codex.js` 入口，維持 `shell: false`，不碰 CVE-2024-27980 的 `.cmd` 限制。明確指定的 `command` 原樣使用；錯誤回報的 argv 不含 launcher prefix。`resolveCodexCommand` 另補專案本機 `node_modules/.bin` 的同層入口（全域版面優先）。回歸測試：舊碼紅（launcher 與 shim 兩案失敗）、新碼綠（`codex-plugin-setup` 27 項、`astra-review-codex` 27 項皆 0 失敗）。Co-authored-by：jin0205。上表 #3878 列「不移植」的裁決改為已採用；釘點保留，上游若以他案合併再比對。

## 2026-11-08：補審 3fea0a00；採用上游 PR #3650 抵達 main 的 6 個 commit（tip d2ef2680）；PR #3880–#3895、issue #3879–#3896 分流

### 一、補審 3fea0a00（2026-11-02 提前採用上游 open PR #3830）與分流紀錄覆核
- **PR #3830 現況與比對**：以 `gh pr view 3830 --repo affaan-m/ECC` 查詢，狀態為 `OPEN`，`headRefOid` 仍為 `fbd14b443190a8f3ef4ba0c73eca0be1525db6d6`，未改版、未合併。提取 `gh pr diff 3830` 與 commit `3fea0a00` 中 `tests/` 的 diff 比對，除 `tests/scripts/codex-hooks.test.js` 因 fork 既有大小寫感知 overlay 有一行 context 差異外，所有 14 個測試檔的 patch hunk 完全忠實套用（100% 語意一致）。上游未變動，fork 維持既有套用，仍在 `monitored`。
- **分流 commit 覆核**：`fd7c834f`（2026-11-05）與 `db0d5fb6`（2026-11-04）記載之 PR／issue 水位、monitored 釘點及處置與實際 commit 內容完全一致。

### 二、commit 軸：採用 `b38be6a7..d2ef2680` 共 6 個 commit（上游 PR #3650）
- **逐筆 commit 與 numstat 實算**（`git show <sha> --numstat`）：
  1. `4062ffbb` fix(ci): grandfather open PRs under contributor cap（`.github/PR_MODERATION.md` +15/-10、`.github/workflows/pr-burst-guard.yml` +3/-2、`CONTRIBUTING.md` +3/-2、`scripts/ci/pr-burst-guard.js` +8/-5、`tests/ci/pr-burst-guard-workflow.test.js` +55/-2、`tests/ci/pr-burst-guard.test.js` +44/-7）
  2. `3b31c2af` test(ci): reject duplicate burst lock requests（`tests/ci/pr-burst-guard-workflow.test.js` +1/-0）
  3. `bac1e475` fix(ci): apply open PR cap to every author（`.github/PR_MODERATION.md` +6/-3、`CONTRIBUTING.md` +4/-3、`scripts/ci/pr-burst-guard.js` +26/-16、`tests/ci/pr-burst-guard-workflow.test.js` +23/-10、`tests/ci/pr-burst-guard.test.js` +35/-10）
  4. `688cefe9` docs(ci): clarify open PR grandfathering（`CONTRIBUTING.md` +4/-3、`tests/ci/pr-burst-guard-workflow.test.js` +8/-7）
  5. `6cf1eb55` chore(ci): sync main before PR cap integration（作者分支整合上游 main 節點，淨變更見 merge commit）
  6. `d2ef2680` Merge pull request #3650 from haelyra/fix/pr-open-cap-grandfather（淨變更總計：`.github/PR_MODERATION.md` +19/-11、`.github/workflows/pr-burst-guard.yml` +3/-2、`CONTRIBUTING.md` +6/-3、`scripts/ci/pr-burst-guard.js` +29/-16、`tests/ci/pr-burst-guard-workflow.test.js` +70/-2、`tests/ci/pr-burst-guard.test.js` +76/-14）
- **處置與 fork overlay 保留**：
  - `.github/PR_MODERATION.md`、`scripts/ci/pr-burst-guard.js`、`tests/ci/pr-burst-guard.test.js`、`tests/ci/pr-burst-guard-workflow.test.js` 採上游最新版本。
  - `.github/workflows/pr-burst-guard.yml` 引入 `queue: max` 與註解，嚴格保留 `if: github.repository == 'affaan-m/ECC'` 守衛。
  - `CONTRIBUTING.md` 套用 open PR cap 文字更新，保留頂部與結尾 fork overlay。
- **驗證**：`node tests/ci/pr-burst-guard.test.js` 27 pass / 0 fail；`node tests/ci/pr-burst-guard-workflow.test.js` 4 pass / 0 fail；`pytest tools/test_fork_overlay.py` 20 pass / 0 fail。

### 三、PR 軸分流（#3880–#3895，10 筆）

| PR | 狀態 | head | 判定 | 理由與重看條件 |
|---|---|---|---|---|
| #3880 | OPEN | `df742084cc7802a64f09fd0cd1967a0fc60afb98` | 延後（釘 monitored） | 新增 Antigravity 2.0 / agy CLI 介面（16 檔，+866/-15），為產品新增功能；本 fork 目前無痛點（fork 內無 `.antigravity`、`.agy` 目錄，沒有對應介面可受影響）。重看：上游合併，或 PR 的 head 移動／檔數與行數（目前 16 檔，+866/-15）變動時再量。 |
| #3881 | OPEN | `9470dc69a1369e1b91130d0df23ac254e17926df` | 延後（釘 monitored） | 套件管理器名稱原型污染防護（5 檔，+134/-10）；環境變數設為 constructor 時的邊界防護，本機未重現痛點。重看：上游合併。 |
| #3882 | OPEN (draft) | `b2cb4b399bb6a390802e96abcc6af8df88ac1fd2` | 延後（釘 monitored） | 整合 68 個 contribution 的草稿 PR（326 檔，+26115/-1917），尚未定稿。重看：上游非 draft 並合併。 |
| #3884 | OPEN | `c449f076f5c6dbdbea8e598f116f42349ef3822b` | 延後（釘 monitored） | 供應鏈 advisory sources 強化（2 檔，+110/-17，對應 issue #3883）；修 Windows 含空格路徑與 GET fallback。本機測試已 10/10 通過，無痛點。重看：上游合併。 |
| #3885 | OPEN | `d9453df6fb3e6270a061fa4e8b3aa5a32c086881` | 延後（釘 monitored） | CI context routing 品質閘門（5 檔，+344/-8）；產品新功能測試，無痛點。重看：上游合併。 |
| #3890 | OPEN | `e4fcc2b19e5fdbdc9a5457d9ea950dc606dc5e09` | 延後（釘 monitored） | workflow 安全驗證器邊界強化（2 檔，+180/-19，對應 issue #3889）；本 fork 既有 18 份 workflow 均合規且測試 26/26 通過。重看：上游合併。 |
| #3891 | OPEN | `e26803e890fe9daadd86f0425c6b238e4b06ab7a` | 不採用（等合併） | `intent-driven-development` skill 補充 handoff 範例（4 檔，+301/-1，對應 issue #3850）；純文件與測試，無痛點。重看：上游合併。 |
| #3893 | CLOSED | `f8348f91c629290580285a5c2e2ef5f6264275eb` | 關閉未合併；不採用 | 誤刪大量 skill 目錄（4782 檔，+9968/-985534），已關閉。不處理。 |
| #3894 | OPEN | `b37b73248b75725c58fe14d4f5700b64e8ebc191` | 延後（釘 monitored） | `block-no-verify.js` 阻擋指令行自訂 Git alias 繞過（2 檔，+82/-35）；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單 2026-11-08 實查，均無 ECC 條目，無痛點。重看：上游合併或本機啟用該 hook。 |
| #3895 | OPEN | `00755768d54d2845b5f78a504b4d7995cecafb09` | 不採用（等合併） | 新增 arcmira MCP catalog 項目（1 檔，+8/-0）；產品新目錄。重看：上游合併。 |

### 四、issue 軸分流（#3879–#3896，8 筆）

| issue | 狀態 | 判定 | 理由與重看條件 |
|---|---|---|---|
| #3879 | OPEN | 使用回饋；不收 | 建議在 Codex 審查時跨 candidate 與 squash commit 讀 review 留言；無可執行缺陷。 |
| #3883 | OPEN | 對應 PR #3884 | 已隨 PR #3884 釘在 `monitored`。 |
| #3886 | OPEN | 無實質內容；不收 | 標題 `...`，body 為空。 |
| #3887 | OPEN | 範本空白；不收 | Copilot issue 範本未填。 |
| #3888 | CLOSED | 範本空白；不收 | Copilot issue 範本未填，已關閉。 |
| #3889 | OPEN | 對應 PR #3890 | 已隨 PR #3890 釘在 `monitored`。 |
| #3892 | CLOSED | 使用者環境問題；不收 | `/plugin marketplace add` 安裝失敗回報，已關閉。 |
| #3896 | OPEN | 產品改進建議；暫不處理 | `frontend-slides` skill 建議支援單頁模式；隨上游後續修正抵達。 |

### 五、monitored 重審與新釘

**重審移動釘點（6 筆）：**

| PR | 上游變更證據（舊 head → 新 head） | fork 影響、裁決維持理由與重看條件 |
|---|---|---|
| [#3816](https://github.com/affaan-m/ECC/pull/3816) | `5518e7fde9f4c5a63c2653db8a4735f5c45e10d3`；[haelyra 關閉說明](https://github.com/affaan-m/ECC/pull/3816#issuecomment-6676611016)：上游 main 在 commit `87e8d734` 已將工具改為本地 runtime wrapper 與純 TypeScript 型別匯入，打包發佈環境在實體無 `@opencode-ai/plugin` 下成功執行，optional peer dependency 提案已不需要，關閉未合併。 | **對 fork 影響**：本 fork 已於 2026-10-26 整棵採用 25278e7d（`df46e59e`）時帶入，fork 現有 `.opencode/tools/tool.ts`，原始碼已修；且本 fork 隔離發佈 workflow、不發佈 npm 套件（`FORK.md:13,31`），故 #3816 關閉對本 fork 無任何不良影響。state 更新為 `closed` 保留歷史釘點，裁決維持不採用。<br>**對應 issue #3810 處置**：#3810（仍 OPEN）指出已發佈之 `ecc-universal@2.2.3` npm 產物問題，此屬上游官方發行包範疇；本 fork 原始碼已修復且不發 npm，故 issue #3810 在 fork 端不需處理、不移植額外程式碼。 |
| [#3849](https://github.com/affaan-m/ECC/pull/3849) | `71084e055545dae6c11102d079788b6a04c33a32` → [`5f72adbd83fb83d15bb4134ac0161e83f1f3cfef`](https://github.com/affaan-m/ECC/pull/3849)（2 檔，+72/-28）：`scripts/hooks/post-bash-command-log.js` 重構 JWT 遮罩邏輯，新增底線前綴支援（`session_<JWT>`、`bearer_<JWT>`）；引入 `mayBeJwtHeader` 常數時間過濾第二位元組以提早排除非 JWT 單字；限制 `MAX_HEADER_DECODES = 8`；重構 `findJwtHeader` 使先前候選失敗後仍向後尋找有效 header，在 `redactJwtsInChain` 維持線性時間複雜度；`tests/scripts/post-bash-command-log.test.js` 補底線前綴、後續候選與 200,000 次長輸入防 ReDoS 線性效能測試。 | 裁決維持延後（釘 monitored）。PR 仍為 OPEN 狀態未合併；改動位於 PostBashCommand hook；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單 2026-11-08 實查，均無 ECC 條目，本機無痛點。重看條件維持：本機啟用該 hook 或上游合併。 |
| [#3858](https://github.com/affaan-m/ECC/pull/3858) | `0cc28648188d2cd03e0791d93b1b26efbbd85fdb` → [`f0f68e6307a3a976738348dca709fa612483e04d`](https://github.com/affaan-m/ECC/pull/3858)（3 檔，+60/-4）：`skills/continuous-learning-v2/hooks/observe.sh` 微調 `_SECRET_VALUE_RE`，允許 legacy `sk-` 金鑰帶後綴（`sk-[A-Za-z0-9]{20,}[A-Za-z0-9_-]*`，原 negative lookahead 改為貪婪吸收）；JWT claims 區段匹配由 `{8,}` 改為 `+`（支援空 claims 字典 `e30`）；`manifests/context-packs/skill-triggers@1.json` 更新 registryDigest；`tests/hooks/observe-secret-redaction.test.js` 補空 claims JWT、含後綴 sk- 測試及 300KB 對抗性輸入線性防回溯測試。 | 裁決維持延後（釘 monitored）。PR 仍為 OPEN 狀態未合併；改動位於 continuous-learning 的 observe hook；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單 2026-11-08 實查，均無 ECC 條目，本機無痛點。重看條件維持：本機啟用該 hook 或上游合併。 |
| [#3870](https://github.com/affaan-m/ECC/pull/3870) | `a08d5da8c9017a891ff7c142b6176373724a2b01` → [`feac4f52ba9949619a1172ab8799256d18940a3f`](https://github.com/affaan-m/ECC/pull/3870)（4 檔，+87/-68）：`scripts/lib/llm-summary.js` 抽出 `isClassifierNotice` helper，正則精確錨定全行（`^Your response above was stopped by a safety classifier\s*[—–-]\s*this is not a tool or API error\.?$/i`），並讓 `extractConversationText` 亦過濾 classifier notice 避免其送入 LLM summary；`scripts/hooks/session-end.js` 改調用該 helper；`tests/hooks/session-end.test.js` 與 `tests/lib/llm-summary.test.js` 補測試（包含純 notice 時不產生 summary、引用 notice 的真實使用者提問予以保留）。 | 裁決維持延後（釘 monitored）。對應 issue #3867。PR 仍為 OPEN 狀態未合併；涉及 SessionEnd hook / LLM summary 產品行為；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單 2026-11-08 實查，均無 ECC 條目，本機無痛點。重看條件維持：上游合併或本機啟用 SessionEnd hook。 |
| [#3871](https://github.com/affaan-m/ECC/pull/3871) | `697c1d0e71b6eca050e5522ff8d36351d7f34cb2` → [`cd51c1ee063028985ed101f87bbbf92d5d847d72`](https://github.com/affaan-m/ECC/pull/3871)（3 檔，+32/-3）：`skills/continuous-learning-v2/hooks/observe.sh` 的 `_python_install_manager_launcher` 新增守衛：若存在 `PYTHON_MANAGER_DEFAULT` 則保留別名（避免 shortcut 固定指向單一 runtime）；若檢查到 Microsoft Store Python 亦保留別名；`manifests/context-packs/skill-triggers@1.json` 更新 registryDigest；`tests/hooks/clv2-pymanager-launcher.test.js` 補 Store Python 共存與 `PYTHON_MANAGER_DEFAULT` 測試。 | 裁決維持延後（釘 monitored）。PR 仍為 OPEN 狀態未合併；改動位於 continuous-learning observe hook；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單 2026-11-08 實查，均無 ECC 條目，本機無痛點。重看條件維持：上游合併或本機啟用該 hook。 |
| [#3876](https://github.com/affaan-m/ECC/pull/3876) | `d64b34137b2b18d60b9a6728e4533fcf5f2d0a5f` → [`25c838253f61ecb4e931ceaf8c1b53f67b4850e5`](https://github.com/affaan-m/ECC/pull/3876)（1 檔，+59/-32）：`skills/continuous-learning-v2/scripts/instinct-cli.py` 本身無變動；僅修改 `tests/scripts/instinct-cli-python-compat.test.js`，靜態 AST 檢查器增加對未加引號的 `X \| Y`（PEP 604 union）型別標註之檢查，並拆分/強化跨 Python 版本相容性測試（f-string 等）。 | 裁決維持延後（釘 monitored）。PR 仍為 OPEN 狀態未合併；純上游測試案例強化，產品程式無改動且本機無痛點。重看條件維持：上游合併。 |

- **新釘 monitored**（7 筆）：`pr#3880`、`pr#3881`、`pr#3882`（draft）、`pr#3884`、`pr#3885`、`pr#3890`、`pr#3894`。全部 30 筆 pinned 實查對齊無 drift。

### 六、水位
commit 水位推進至 **`d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`**；PR `reviewed_pr_through` 推進至 **3895**；issue `reviewed_issue_through` 推進至 **3896**；`reviewed_date` 為 **2026-11-08**。`python tools/check_upstream_updates.py --strict` 乾淨通過（exit 0）。

## 2026-11-10：上游 PR #3897–#3900 分流；pr#3870 重審；commit 軸與 issue 軸無新項

### 一、起點與範圍
- `python tools/check_upstream_updates.py --strict` 實跑回報：commit 軸 `d2ef268` 之後 behind 0（無新 commit）；issue 軸 `#3896` 之上無新項；PR 軸 4 筆新項（#3897、#3898、#3899、#3900）；monitored 30 筆中 1 筆移動（pr#3870）。
- 4 筆 PR 的 diff 以 `gh pr diff <n> --repo affaan-m/ECC` 唯讀取得並逐筆讀過；`gh pr view` 取 head 與檔數、行數。

### 二、PR 軸分流（#3897–#3900，4 筆）

| PR | 狀態 | head | 判定 | 理由與重看條件 |
|---|---|---|---|---|
| #3897 | OPEN | `adb525dc2cd494e2c00a0e8fa316d81ada336aa2` | 不採用（等合併） | dependabot 升 GitHub Actions 釘點（10 檔，+40/-40，皆為 `.github/workflows/*.yml` 的 `uses:` SHA 與版本註解：setup-node 7.0.0→7.1.0、pnpm/action-setup 6.1.0→6.1.1、upload-artifact 7.0.1→7.0.2、download-artifact 8.0.1→8.0.2、action-gh-release 3.0.3→3.0.4）。diff 內只有 `uses:` 行變動，無 `run:` 或權限變更；本 fork 的 CI 依自己的釘點維護，不在上游 dependabot 節奏上追單一升級。重看：上游合併（隨整棵採用抵達）。 |
| #3898 | OPEN | `c21282b7a409cd96197746c8a5244052e8cea822` | 不採用（等合併） | dependabot 升 npm 依賴（2 檔 `package.json`、`yarn.lock`，+536/-109）：`@opencode-ai/plugin` 1.4.3→1.19.5、`sql.js` 1.14.2→1.15.2、`eslint` 10.11.0→10.14.0、`markdownlint-cli` 0.49.1→0.50.0 等，並新增 `@opentui/keymap` 與 `@ai-sdk/provider`。`yarn.lock` 的 `resolved` 皆為 npm registry；無 install 腳本新增。大版本跨度的 `@opencode-ai/plugin` 升級需在整棵採用時連同 fork 的 lockfile 一起驗，不單獨取用。重看：上游合併。 |
| #3899 | OPEN | `6f106b85553844d197e6da874c3ff0e9cab25e17` | 延後（釘 monitored） | 擴充 Copilot port 與 Windows 驗收覆蓋（173 檔，+134103/-125）：新增大量 `scripts/copilot-*.js`、`scripts/lib/copilot-*.js`、`docs/COPILOT-*.md`、`manifests/copilot-*.json`，並改動 `README.md`、`.gitattributes`、`package.json`、`scripts/install-apply.js`、`scripts/hooks/pre-bash-commit-quality.js`、`design-quality-check.js`、`install-modules.json`。屬產品新介面，體量過大，且 `README.md`／`.gitattributes` 是 fork 有 overlay 的檔，不單獨取用。本 fork 沒有 Copilot 使用面的痛點。隱藏內容掃描見第三節。重看：上游合併，或 head／檔數與行數變動後再量。 |
| #3900 | OPEN | `7eb5ef12fad3e22cfc0f4368e0c52f083f6db37f` | 延後（釘 monitored） | 純測試（1 檔 `tests/lib/copilot-install-target.test.js`，+37/-0），補 Copilot 規則 `paths` 驗證與連結標籤邊界。被測的 `adaptCopilotRule` 屬 Copilot 安裝目標，與 #3899 同一條線，單獨取用沒有意義。重看：上游合併，或 #3899 合併。 |

### 三、隱藏內容與危險片語掃描
- 對四份 diff 掃描 `curl|sh`、`iwr`、`iex`、`Invoke-Expression`、`dangerously`、`bypassPermissions`、`ignore previous`、`system prompt`、HTML 註解、`base64 -d`、`eval(`。#3897、#3898、#3900 無命中。
- #3899 命中 2 處，皆讀過上下文：新檔 `scripts/hooks/copilot-guard.js`（函式 `powerShellNoVerify`）的 wrapper 名單含 `iex`、`invoke-expression`，是 `git commit --no-verify` 偵測器把 PowerShell 包裝器納入檢查，屬防禦邏輯（該 PR 對 `pre-bash-commit-quality.js` 只改 7 行，無此二字）；`tests/hooks/copilot-guard.test.js` 的 PowerShell 拒絕案例清單含 `Invoke-Expression 'git commit --no-verify'`，是預期被擋的輸入。非隱藏指令。
- #3899 新增 `.github/workflows/copilot-verification.yml`：僅 `workflow_dispatch`、`permissions: contents: read`、action 以 SHA 釘死。diff 中出現的外部網域為 `docs.github.com`、`github.com` 與測試用 `*.invalid`／`example.*`、`127.0.0.1`，另有 `agent-plugins.org`、`kimi.ai`、`iconify` 等文件／測試字串，未見新增的下載後執行流程；`package.json` 無 `preinstall`／`postinstall`／`prepare` 新增。

### 四、issue 軸
`gh issue list --state all` 最新編號仍為 #3896，水位之上無新項；`reviewed_issue_through` 維持 3896。

### 五、monitored 重審（1 筆）

| PR | 上游變更證據（舊 head → 新 head） | fork 影響、裁決維持理由與重看條件 |
|---|---|---|
| [#3870](https://github.com/affaan-m/ECC/pull/3870) | `feac4f52ba9949619a1172ab8799256d18940a3f` → [`882ba18c10064b7fd1be02a5a013d3b7655236f0`](https://github.com/affaan-m/ECC/pull/3870)（現為 4 檔，+126/-5）。經 `gh api repos/affaan-m/ECC/compare/feac4f52...882ba18c` 取得的增量只有 3 檔：`scripts/lib/llm-summary.js` +1/-1、`tests/hooks/session-end.test.js` +13/-0、`tests/lib/llm-summary.test.js` +15/-0。`CLASSIFIER_NOTICE` 正則加上選用的第二句（`The rest of it was withheld, and tool calls in it that had not finished did not run. Do not produce that content again...`），使較長的 classifier 通知也被辨認。數字口徑：11-08 所記 +87/-68 是 `a08d5da8`→`feac4f52` 的增量；`feac4f52` 對 merge base `b38be6a7` 的總量為 +98/-5，本次增量為 +29/-1（`llm-summary.js` 同一行被兩次改動，故總量不是兩者相加）；`b38be6a7`→`882ba18c` 直接量得 +126/-5（皆為 `gh api compare` 的 additions／deletions 加總）。 | 裁決維持延後（釘 monitored）。PR 仍為 OPEN 未合併；改動位於 SessionEnd hook／LLM summary；本機 Claude Code 設定的 hooks 與已安裝 plugin 清單沒有 ECC 條目（2026-11-08 實查，此次未重查，裁決依該次實查）。重看條件維持：上游合併或本機啟用 SessionEnd hook。 |

- **新釘 monitored**（2 筆）：`pr#3899`、`pr#3900`。重釘 `pr#3870` 的 head。monitored 共 32 筆。

### 六、水位
commit 水位維持 **`d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`**；PR `reviewed_pr_through` 推進至 **3900**；issue `reviewed_issue_through` 維持 **3896**；`reviewed_date` 為 **2026-11-10**。未移植任何產品碼。

## 2026-11-10：修 audit-closed-references 測試的固定日期（時間炸彈）

**決定**：`tests/ci/audit-closed-references.test.js` 的 CLI fixture「page-two issue is audited…」把 stub gh 的 `closed_at`／`created_at` 由寫死的 `2026-10-11T00:00:00Z` 改為相對現在（一天前）。

**根因**：`scripts/ci/audit-closed-references.js` 只稽核 30 天窗口（`DEFAULT_WINDOW_DAYS`）內關閉的 issue。寫死的 10-11 在 2026-11-10 滿 30 天，issue 被窗口濾掉，稽核變成「0 claim 全清」，`/Delivered through #3500/` 比對失敗。f559e9be 當時（窗口內）綠，之後只是日曆到期，與 5cd0867f 的文件變更無關；與網路、環境變數、執行順序無關。同檔的 101 PR fixture 早就用 `new Date()`，故不受影響。

**上游**：上游 `affaan-m/ECC` main 的同檔（2026-11-10 以 `gh api` 取得）仍是同樣寫死日期，尚未修；此為本 fork 對上游持有檔的最小本機修正，上游修了或改寫此檔時以上游版為準。

## 2026-11-12：安全類 hook 解析／執行失敗時改為 fail-closed（覆核 F1）

**根因**：Claude Code 對 PreToolUse 的退出碼只有 2 代表阻擋，0 放行，其餘非零是「非阻擋錯誤」（工具照跑）。上游的 `run-with-flags.js`、`bash-hook-dispatcher.js`、`plugin-hook-bootstrap.js` 在「檢查沒做完」時一律走 `exit 0`（腳本不存在、`run()` 拋例外、spawn 逾時／被 signal 終止）或 `exit 1`（舊式子程序失敗），而 GateGuard 與 config-protection 對無法解析的 JSON 自己回「放行」。結果是啟用中的安全 hook 在無法完成檢查時等於沒擋。覆核重現：`tool_name` 為數字時 GateGuard 拋 `rawToolName.toLowerCase is not a function` 卻 status 0；啟用中的 GateGuard 指向不存在模組 status 0；`pre-bash-dispatcher.js` 收到 `{` 後 EOF status 0 且無診斷；dispatcher 注入 block-no-verify 例外後 exitCode 0。

**修法**：新增 fork 自有模組 `scripts/hooks/safety-hooks.js`，集中「哪些是安全 hook」（`pre:bash:block-no-verify`、三個 `*:gateguard-fact-force`、`pre:config-protection`）與判定函式；`mcp-health-check` 不列入（它是可用性檢查，且已有 `ECC_MCP_HEALTH_FAIL_OPEN` 明示開關），提示、記錄、格式化、commit-quality 等維持不打斷。

- `run-with-flags.js`：安全 hook 啟用時，輸入須是完整 JSON 物件且 `tool_name` 若存在必為字串，否則 exit 2 並說明原因；腳本不存在、路徑逃出 plugin root、`run()` 拋例外、runner 本身例外、舊式子程序的 spawn 錯誤／逾時／signal／status 非 0 或 2，一律 exit 2（原本是 0 或 1）。GateGuard 的專用關閉（`ECC_GATEGUARD=off`、`GATEGUARD_DISABLED=1`）與 profile／`ECC_DISABLED_HOOKS` 停用仍照舊放行，因為那是使用者明示關閉，不是失敗。
- `bash-hook-dispatcher.js`：block-no-verify 與 GateGuard 子 hook 標 `safety`，其例外回 exit 2；`runPreBash` 在有啟用的安全子 hook 時先驗輸入；pre 模式的未預期例外 exit 2（post 維持 0）。`pre-bash-dispatcher.js` 本來就 catch 後 exit 2，經 `runPreBash` 取得輸入驗證。
- `plugin-hook-bootstrap.js`：入口為 `pre-bash-dispatcher.js` 或 `run-with-flags.js` 加安全 hook id 時，缺參數、未知 mode、路徑解析失敗、spawn 錯誤／逾時（30 秒）／signal／status 非 0 或 2 都 exit 2；伴隨 EPIPE／EOF 但有真實 status 的情形（2026-11-04 條目）仍採子程序自己的 status。非安全入口維持原行為。

**測試**：新增 `tests/hooks/safety-hooks-fail-closed.test.js`（17 項，涵蓋非字串 `tool_name`、半截 JSON、非物件 JSON、config-protection 無效 JSON、缺腳本、`run()` 拋例外、舊式子程序逾時、dispatcher 例外、bootstrap exit 1／0／2、逾時與 signal 的判定函式，以及非安全 hook 與已明示停用者維持放行）。修前 11 項紅、修後全綠。`tests/hooks/gateguard-fact-force.test.js` 的「malformed JSON passes through unchanged」原本把 fail-open 當規格釘住，改為「exit 2、stderr 含 BLOCKED、stdout 空」。

**範圍界線**：只處理 Claude Code PreToolUse 路徑。`.cursor/hooks/before-shell-execution.js` 等其他宿主的 hook 協定不同，未動。**上游**：2026-11-12 `git fetch upstream` 的 `upstream/main` 仍為 `d2ef2680`（本 fork 水位），上游尚未修；這是對上游持有檔（上述三支加兩個測試）的本機最小修正，上游修了或改寫這些檔時以上游版為準並保留 `safety-hooks.js` 的測試意圖。

## 2026-11-12：安裝 MCP 設定時不覆寫使用者的同名 server（覆核 F2）

**根因**：Cursor（及 kimi）的 `.mcp.json` 以 `merge-json` 操作寫入 `mcp.json`，`apply.js` 對它做整份 `deepMergeJson`，同名 `mcpServers.<name>` 直接被 ECC 的定義覆蓋。使用者的 `chrome-devtools` 若用自己的 `command`／`args`（覆核探針：`custom-local-command` 變成 `npx -y chrome-devtools-mcp@1.10.1`），重裝就被換掉，且 ledger 把它記成 ECC 管理，之後 repair 還會再蓋回去。`copy-file` 才有的「使用者檔案保護」不適用於 `merge-json`。

**修法**：新增 fork 自有模組 `scripts/lib/install/mcp-user-servers.js`，在 `apply.js` 的 `previewInstallPlan` 與 `applyInstallPlanLocked` 於 `withMcpMergeExclusions` 之後接 `withPreservedUserMcpServers`（plan 層調整，operations、`statePreview` 與 ledger 一致）。逐 server 名稱判定：不存在就加；與 ECC 定義相同就略過；與「前次 install-state 記錄的 ECC 定義」相同（使用者沒動過）就視為仍由 ECC 管理並更新；其餘一律是使用者自己的，保留原值、從 payload 與 ledger 移除（repair／uninstall 不會碰）並產生警告（含 server 名與檔案路徑，preview 與 apply 的 `warnings` 都有）。全部 server 都衝突且無其他鍵時整個 operation 不進 ledger。寫入時（`merge-json` 分支）改用 `mergeMcpConfig`：ECC 管理的 server 整筆取代，避免新 command 搭舊 env 的混合狀態；並重驗規劃後才出現的使用者同名 server，出現就中止（同 `assertNoNewUserOwnedFile` 的語意）。

**測試**：新增 `tests/lib/install-mcp-user-servers.test.js`（7 項：保留 command／args／env 並警告、preview 不寫入、repair／uninstall 不碰、全新安裝與相同定義無警告、未改動的 ECC 條目可更新、使用者改過的條目被保留、全衝突時不認領）。修前 5 項紅、修後 7 項全綠；`install` 相關 36 個測試檔 693 項通過（見下方本機失敗說明）。

**本機失敗紀錄（未修，依裁決只記錄）**：`ECC_TEST_JOBS=4` 平行跑 install 相關測試時，`lib/install-state.test.js` 的「concurrent writeInstallState calls always leave a complete valid state」在本機 Windows 重現 `EPERM: rename ... .ecc-install-state.json.<pid>.<id>.tmp -> ecc-install-state.json`（`scripts/lib/atomic-write.js:89`），單檔重跑 10 項全過；`lib/install-executor.test.js` 同輪因 `.opencode/dist/index.js` 不存在（`ENOENT copyfile`，該檔需先建置）失敗，單檔重跑 26 項全過。兩者與本次變更無關，也沒有捕獲鎖持有者或防毒狀態，維持 2026-11-03 條目的判斷：不放寬斷言、不修產品碼，計入勝負的是 fork CI。

**上游**：`upstream/main` 仍為 `d2ef2680`，同檔未修；這是對上游持有檔 `scripts/lib/install/apply.js` 的最小接線修正，其餘邏輯在 fork 自有的新檔。上游修了或改寫此段時以上游版為準。

## 2026-11-12：Cursor `hooks.json` 重裝／repair／uninstall 改為合併，保留使用者加入的 hook（覆核 F3）

**根因**：`.cursor/hooks.json` 以受管 `copy-file` 記錄，只有「ledger 記錄為受管」的判斷（`prepareUserOwnedFileGuard`）。一旦首次安裝寫入，檔案就整份視為 ECC 所有：之後使用者往同一檔加自己的 hook，重裝與 repair 整檔 `copyFileSync` 覆蓋，uninstall 在內容與記錄 digest 相符時整檔刪除。覆核探針：ledger digest 與現況不同，`prepareUserOwnedFileGuard()` 仍是 applied 1／skipped 0（Codex 的使用者設定檔有 digest 保護，Cursor hooks 沒有）。

**修法**：新增 fork 自有模組 `scripts/lib/install/cursor-hooks-merge.js`。ECC 擁有的條目定義為 `command` 以 `node .cursor/hooks/` 開頭者（ECC 自己安裝的腳本目錄；實查出貨的 `.cursor/hooks.json` 15 個事件的 command 全部符合）；其餘一律是使用者的。
- 重裝（`apply.js`）與 repair（`install-lifecycle.js` 的 `repairCopyFile`）：對已存在的檔案，每個事件放 ECC 來源條目、再接使用者條目；來源沒有的事件與頂層其他鍵原樣保留；來源裡已不存在的舊 ECC 條目移除，因此重複重裝是冪等的（出貨檔實測 `merge(merge(x,x),x) === merge(x,x)`）。檔案不存在時仍整份寫入來源。既有檔案無法解析為 JSON 物件時拋錯、不覆寫。
- uninstall（`uninstallCopyFile`）：只移除 ECC 條目，使用者條目與其他鍵留下；只剩 ECC 內容時照舊刪檔；無法解析時保留該檔。
- ledger 仍是 `copy-file`，記錄的 digest 是合併後內容，所以 doctor 在無額外編輯時為 ok；使用者之後再加 hook 時 doctor 會報 drifted，由 repair 合併處理，不會蓋掉。

**未處理（另記）**：首次安裝時若 `.cursor/hooks.json` 已存在但不在 ledger（使用者自己的檔），沿用既有行為——跳過並警告，不合併也不安裝 ECC hook；這是另一個決策，未在本次改動範圍。

**測試**：新增 `tests/lib/install-cursor-hooks-merge.test.js`（7 項：首次安裝、重裝保留使用者 hook 且 ECC 不重複、ECC 定義更新不重複、repair 保留、uninstall 只移除 ECC、僅 ECC 時整檔刪除、無法解析的檔案不被覆寫）。修前 5 項紅、修後全綠；`lib/install*` 18 個檔 311 項、`scripts/uninstall`／`repair`／`doctor` 全綠。

**上游**：`upstream/main` 仍為 `d2ef2680`，未修；對上游持有檔 `apply.js`、`install-lifecycle.js` 為最小接線，邏輯在新檔。上游修了或改寫時以上游版為準。

## 2026-11-12：Windows 格式化 hook 支援含空白與特殊字元的路徑（覆核 F4）

**根因**：`stop-format-typecheck.js`（已註冊的 Stop hook）把空白列為 unsafe，路徑含空白（例如使用者目錄名稱含空白）時整批略過格式化；`post-edit-format.js`（舊式、未註冊）允許空白，卻以 `spawnSync(shim, argsArray, { shell: true })` 啟動 `.cmd`，陣列在 `shell: true` 下不會加引號，`two words.js` 被拆成兩個參數（Node 同時報 DEP0190）。

**修法**：新增 fork 自有模組 `scripts/lib/windows-cmd.js`，沿用 `pre-bash-commit-quality.js` 已驗證的做法：每個 token（shim 本身與每個參數）各放一個環境變數，cmd 命令列只含加引號的 `%NAME%` 參照，`shell: false`、`/d /v:off /s /c`。值不會變成 cmd 原始碼，所以 `& | < > ^ ( ) ! ; %` 與空白都保持字面；只有可能跳出引號的 `"`、NUL、CR、LF 才拒絕（Windows 路徑本來就不可能有），拒絕時略過該批並說明原因。兩支 hook 改用它，移除各自的 `UNSAFE_PATH_CHARS`。

**測試**：新增 `tests/hooks/format-windows-paths.test.js`（6 項）：建構器單元測試（參數不進命令列、舊 token 清除、危險字元拒絕）加 Windows 上以真的 `.cmd` shim（放在含空白與括號的目錄、目標檔名含 `& % ! ( )`）驗證 `post-edit-format` 與 `stop-format-typecheck` 都把路徑當一個參數交給 shim；修前兩項 e2e 紅（shim 從未執行／Stop 略過整批）、修後全綠。`tests/hooks/hooks.test.js` 兩項原本釘住舊實作（原始碼含 `UNSAFE_PATH_CHARS`、`;` 反引號 `$()` 括號路徑須在 spawn 前被擋），改成釘住性質：不用 `shell: true`、路徑作為單一環境 token 傳遞、含 `"` 的路徑才被拒絕。`hooks` 260 項、`stop-format-typecheck` 33 項、`quality-gate` 24 項全綠。

**上游**：`upstream/main` 仍為 `d2ef2680`，兩支 hook 未修；本機最小修正，上游改寫時以上游版為準。

## 2026-11-12：context validator 只載入一次 registry（覆核 F6，完成 ROADMAP 中期列）

**根因**：`scripts/ci/validate-context-profiles.js` 先 `loadContextRegistry`，又對 2 個 profile × 17 個 target 各呼叫一次 `compileContextProfile`，後者每次重新載入 registry（逐檔 `open` ＋ `lstat` 祖先鏈重驗，約 314 個 skill 來源）。35 次完整載入在逐檔 I/O 成本高的 Windows 主機上超過 `tests/ci/context-profiles.test.js` 的 60 秒上限（覆核 60.3 秒逾時；本機修前實測同一驗證器 96.7 秒，同時另有安裝測試在跑）。

**修法**：`scripts/lib/context-profiles.js` 新增並匯出 `compileContextProfileMatrix`：registry 仍由模組內的正規載入器產生（呼叫端不能注入，維持原註解的界線），載入一次後對每個 profile × target 呼叫 `compileContextPlan`，回傳 `{ registry, plans }`。`validate()` 改用它，並以同一份 registry 做 trigger 檢查。來源身分重驗（`context-profile-support.js` 的 `lstat` 祖先鏈與開啟前後驗證）一行未動，只是不再重複 35 次。副作用：registry／profile 編譯錯誤會早於 trigger 檢查錯誤出現（兩者同時錯時訊息順序不同）。

**測試與量測**：新增 `tests/ci/context-profiles-registry-reuse.test.js`（3 項）：`validate()` 只載入 registry 1 次（修前 35 次，紅）、共享 registry 的 plan digest 與獨立編譯同一組完全相同、未知 target／profile 仍拋錯；另在 `tests/ci/context-profiles.test.js` 斷言訊息加上 `status／signal／error.code／elapsedMs`，逾時不再只剩 `null !== 0`（60 秒上限沒有放寬）。同機同負載前後：`validate-context-profiles.js` 修前 96.7 秒（35 次載入）→ 修後 1.7 秒（1 次載入）；34 個投影結果、`planDigest` 不變。`context` 相關 84 項測試全綠。報告另建議的「外層 runner deadline 大於內層預算」未做（沒有可獨立量測的失敗證據）。

**上游**：`upstream/main` 仍為 `d2ef2680`，同檔未修；本機最小修正。

## 2026-11-12：舊式 post-edit-typecheck 在 Windows 能啟動 tsc，啟動失敗要明確報錯（覆核 F5）

**根因**：`scripts/hooks/post-edit-typecheck.js`（舊式，目前出貨的 `hooks/hooks.json` 未註冊；現行 Stop 的 typecheck 是 `stop-format-typecheck.js`）在 Windows 用 `execFileSync('npx.cmd', ...)`，Node 無法直接啟動 `.cmd`（`EINVAL`，CVE-2024-27980 後的行為），而 catch 把「啟動失敗」當成「tsc 回報型別錯誤」，過濾不出該檔的診斷就什麼都不輸出，外層 status 0、stderr 空白：沒跑的檢查看起來和乾淨一樣。

**修法**：改用 `spawnSync` 並區分三種結果。專案本機的 `node_modules/typescript/bin/tsc` 存在就以 `process.execPath` 直接執行（不經 shell、不經 shim）；否則 Windows 走 `scripts/lib/windows-cmd.js`（F4 新增）啟動 `npx.cmd`，其他平台照舊 `npx`。`result.error`（無法啟動、逾時）輸出 `[Hook] TypeScript check was not run: <原因>`；tsc 非零退出但輸出沒有任何 `error TS` 診斷時輸出 `[Hook] TypeScript check failed without diagnostics (exit N): <第一行>`；有診斷才照原本過濾出該檔的錯誤。hook 本身仍不阻擋。

**測試**：新增 `tests/hooks/post-edit-typecheck.test.js`（3 項）：Windows 上放真的 `npx.cmd` 假 shim（印出 TS2322 診斷並 exit 2）驗證診斷被轉出；PATH 中沒有 npx 時必須報 not run／without diagnostics（任何平台）；stdin 仍原樣傳回。修前前兩項紅（stderr 空白），修後綠。未啟動真的 tsc、未下載套件。

**上游**：`upstream/main` 仍為 `d2ef2680`，未修；本機最小修正。

## 2026-11-12：F1 補強——fail-closed 不得吞掉使用者的明示停用（推送前審查）

**問題**：bb514f87 的 fail-closed 有兩個洞，讓 BLOCKED 訊息建議的逃生口（`ECC_DISABLED_HOOKS`）失效。(1) `pre-bash-dispatcher.js` 頂層 `require('./bash-hook-dispatcher')` 早於 `isHookEnabled('pre:bash:dispatcher')`，任一子 hook 模組載入失敗（審查以 `auto-tmux-dev.js` 加語法錯誤實測）就 exit 1，bootstrap 把它判為安全入口而轉成 exit 2，即使使用者已停用 dispatcher 與全部安全子 hook。(2) 同檔 `truncated` 分支無條件 exit 2。

**修法**：`scripts/hooks/safety-hooks.js` 集中 pre-Bash 安全子 hook 的 id／profile 清單（`PRE_BASH_SAFETY_HOOKS`，測試釘住 `bash-hook-dispatcher.js` 的宣告與它一致）並新增 `hasActivePreBashSafetyHook()`。`pre-bash-dispatcher.js` 改為：先看 dispatcher 是否停用，`truncated` 時只在仍有啟用的安全子 hook 才擋，`bash-hook-dispatcher` 延遲到這些檢查之後才 `require`，載入失敗時有啟用的安全子 hook 才 exit 2，否則 exit 0 並說明原因；最外層 catch 同理。`isSafetyEntrypoint`（bootstrap 判斷用）也改為「該 hook 目前仍啟用」才算安全入口：dispatcher 要啟用且有啟用的安全子 hook；`run-with-flags` 入口要該 hook 的 profile／`ECC_DISABLED_HOOKS`／`ECC_GATEGUARD` 都沒關掉。所以使用者停用後，崩潰或載入失敗不再被 bootstrap 轉成阻擋。

**測試**：新增 `tests/hooks/safety-hooks-optout.test.js`（9 項，修前 4 項紅）：用複製出來的 plugin root 讓 `auto-tmux-dev.js` 帶語法錯誤；啟用時 exit 2、停用 dispatcher／停用全部安全子 hook／`ECC_GATEGUARD=off` 加停用 block-no-verify 時 exit 0、只停用其中之一仍 exit 2；超大請求同樣只在有啟用的安全子 hook 時才擋；`run-with-flags` 入口崩潰在 hook 停用後不再 exit 2。

## 2026-11-12：Cursor `beforeShellExecution` 的安全 guard 改為 fail-closed（F1 補漏，推送前審查）

**問題**：bb514f87 只處理 Claude Code 的 PreToolUse。`.cursor/hooks/before-shell-execution.js` 經 `adapter.js` 的 `runExistingHook` 跑 `block-no-verify.js`（及非 Windows 的 `pre-bash-dev-server-block.js`），Cursor 只在 exit code 2 時拒絕命令，其餘一律繼續；而 `runExistingHook` 對 spawn 錯誤、15 秒逾時、signal、非 0／2 的退出碼、腳本缺失都只寫 stderr 就放行，外層 `.catch(() => process.exit(0))` 與內層 `catch { /* noop */ }` 也放行。

**修法**：`runExistingHook` 新增 `options.failClosed`，為真時上述所有情形改為 `[Cursor Hook] BLOCKED: …` 加 `exit 2`（Cursor 的拒絕方式；`.cursor/hooks.json` 沒有 `failClosed` 欄位，Cursor 協定只看退出碼）。`before-shell-execution.js` 對兩個 guard 傳 `failClosed: true`，外層 catch 與內層 catch 在仍有啟用的 blocking guard（沿用既有 `hasBlockingGuard` 判斷：block-no-verify 或非 Windows 的 dev-server-block）時 exit 2，使用者以 `ECC_DISABLED_HOOKS` 停用後照舊放行。新增 `ECC_CURSOR_HOOK_TIMEOUT_MS`（正整數毫秒，預設仍 15 秒，明確的 `options.timeout` 優先），讓慢機器與測試能調整委派 hook 的預算。其他事件的 Cursor hook（提醒、記錄、格式化）維持非阻擋。

**測試**：新增 `tests/hooks/cursor-fail-closed.test.js`（6 項，修前 3 項紅）：以安裝版型（`.cursor/hooks` 加 `scripts/{hooks,lib}`）搭配可替換的 `block-no-verify.js`，crash（exit 1）、腳本缺失、逾時皆 exit 2；正常放行、exit 2 拒絕、使用者停用後即使壞掉也放行。`cursor-block-no-verify` 15 項、`cursor-hook-dispatchers` 27 項維持綠。

**限制**：Cursor 本身若在 hook 逾時（`hooks.json` 的 `timeout`）時繼續執行是宿主協定，hook 內做不到；本修補只保證 hook 自己能控制的失敗路徑。

## 2026-11-12：F3 補強——只認得出確切是 ECC 寫的 hook 條目（推送前審查）

**問題**：ba1e1205 以 `node .cursor/hooks/` 前綴判斷 ECC 條目。使用者自己放在同一目錄的 `node .cursor/hooks/my-own-script.js` 會被當成 ECC 條目，在重裝／repair 被丟掉；uninstall 移除後若沒剩東西就刪檔。另外 `stripEccHooksConfig` 在沒有任何 ECC 條目可移除時（例如 `{"version":1,"hooks":{}}`）仍回 null 而刪檔。

**修法**：ECC 條目改為精確比對 command：ECC 來源 `.cursor/hooks.json` 的 command 集合，加上 install-state ledger 裡 `<target>/.cursor/hooks/` 下由 ECC 安裝的檔案（`node .cursor/hooks/<檔名>`，涵蓋舊版 ECC 寫入、新版來源已不存在的條目）。apply 用規劃前的 ledger（`previousManagedOperations`）、repair 用 `record.state`、uninstall 用整份受管 operations（uninstall 沒有來源檔，只靠 ledger）。`stripEccHooksConfig` 改回傳 `{ changed, text }`：沒有移除任何條目時原樣不動（不寫、不刪），只有「確實移除了 ECC 條目且什麼都沒剩」才刪檔。

**合併順序（建議 7）**：維持 ECC 條目在前、使用者條目在後。查 Cursor 官方文件（2026-11-12 取得 cursor.com/docs/agent/hooks 的「Configuration」段）：「All matching hooks from every source run, and Cursor merges their responses: any deny wins over ask, and ask wins over allow」，亦即同一事件的多個 hook 都會執行，順序不影響使用者 hook 是否被執行，不需要調換。`before-shell-execution.js` 內「Cursor may execute only the first hook registered for an event」的舊註解與官方文件現況不符，但那是上游持有檔的註解，未改。

**測試**：`tests/lib/install-cursor-hooks-merge.test.js` 增至 10 項：使用者自己的 `node .cursor/hooks/my-own-script.js` 在重裝、repair、uninstall 都保留（修前紅）；沒有 ECC 條目的 hooks.json 在 uninstall 不被刪（修前紅）；舊版 ECC 條目（腳本記在 ledger）在重裝時被移除。

## 2026-11-12：安全 hook 不再設 5 秒 timeout（F1 補強，推送前審查）

**問題**：`hooks/hooks.json` 的 `pre:powershell:gateguard-fact-force`、`pre:edit-write:gateguard-fact-force`、`pre:config-protection` 各有 `"timeout": 5`。Claude Code 對逾時的 command hook 視為非阻擋錯誤，工具照跑；冷磁碟或防毒掃描下 Node 啟動加載入 GateGuard 超過 5 秒時，安全檢查就變成放行，與 bb514f87 的 fail-closed 相矛盾。

**修法**：移除這三個 `timeout`，與 Bash 的 `pre-bash-dispatcher` 條目一致（用宿主預設，遠大於 bootstrap 子程序的 30 秒上限，所以逾時由 bootstrap 先判定並 exit 2）；`hooks/hooks.metadata.json` 的指紋用 `validate-hooks.js --update-fingerprints` 重產。新增 `tests/hooks/safety-hooks-timeouts.test.js`：四個安全入口（dispatcher、兩個 GateGuard、config-protection）都必須註冊，且 timeout 不得短於 bootstrap 子程序逾時（修前紅）。

**協定限制（仍是 fail-open）**：宿主端逾時（hook 設了 `timeout`，或宿主預設上限到了）本身是 Claude Code 的非阻擋錯誤，hook 內無法改成阻擋；本 fork 只能保證 hook 自己控制得到的失敗路徑（解析、載入、例外、子程序逾時）都 exit 2，並避免主動設定會提早觸發宿主逾時的短 timeout。

## 2026-11-12：上游 PR #3901–#3923 與 issue #3903／#3905／#3922 分流；pr#3862、pr#3870 重審；commit 軸無新項

### 一、起點與範圍
- `python tools/check_upstream_updates.py --strict` 實跑回報：commit 軸 `d2ef268` 之後 behind 0（無新 commit，`git fetch upstream main` 取得的 tip 仍是 `d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`）；PR 軸 20 筆新項（#3901、#3902、#3904、#3906–#3921、#3923）；issue 軸 3 筆新項（#3903、#3905、#3922）；monitored 32 筆中 2 筆移動（pr#3862、pr#3870）。
- 20 筆 PR 的 diff 以 `gh pr diff <n> --repo affaan-m/ECC` 唯讀取得並逐筆讀過；`gh pr view` 取 head、檔數與行數。全部為 OPEN，沒有已合併者，所以沒有可隨下次合併帶進來的內容，也沒有提前引用任何 open PR。

### 二、PR 軸分流（20 筆）

| PR | 狀態 | head | 規模 | 判定 | 理由與重看條件 |
|---|---|---|---|---|---|
| #3901 | OPEN | `7f379cb553f9decbba52c8c2ba3c0d7d6b8c959e` | 4 檔 +61/-7 | 不採用（等合併；釘 monitored） | grok 轉接器改用原生 realpath 讓 Windows npm lane 過；修的是 #3882（未合併、本 fork 未採用）引入的程式，另動 `quality-gate.js`。重看：#3882 或本 PR 合併。 |
| #3902 | OPEN | `2b9c43b008c1f3857f47da61797d5900d5154c88` | 2 檔 +205/-2 | 不採用（等合併） | ecc2（Rust）session board 的 handoff 派送；本 fork 不建置 ecc2 為產品行為驗收範圍。 |
| #3904 | OPEN | `b4a4b582d5befe60aed19d3a85dc5f070d781f26` | 1 檔 +93/-1 | 不採用（等合併） | ecc2 `store.rs` board 重寫；同上。 |
| #3906 | OPEN | `d102c6af5da83d808c0f25d770f479586e56f3ac` | 1 檔 +28/-2 | 不採用（等合併） | ecc2 `store.rs` board 原子更新；同上。 |
| #3907 | OPEN | `1b87fb3f432706fe5ff2daf97acdef8f37788dba` | 2 檔 +16/-1 | 不採用（等合併） | frontend-slides 技能文字（SKILL.md、STYLE_PRESETS.md），無程式。 |
| #3908 | OPEN | `08bf8e18f7a46f8c960812d243201f00116c2a4e` | 2 檔 +51/-1 | 不採用（等合併） | OpenCode `run-tests.ts` 把 Vitest 檔案過濾改為位置參數；OpenCode 工具本 fork 不啟用。 |
| #3909 | OPEN | `82bf65024fcc135aaa3f0fb77888ecb3b004793d` | 2 檔 +108/-116 | 不採用（等合併） | `session-manager.js` 保留完整 Markdown 段落；本 fork 目前沒有遇到實例。 |
| #3910 | OPEN | `21ae946484cf9954a01357bbaf78ed89dc741773` | 2 檔 +224/-9 | 不採用（等合併） | `project-detect.js` 讀取所有 Go require；無本 fork 實例。 |
| #3911 | OPEN | `6c1d7ae23fae92764254df07aaff9215f56eac27` | 4 檔 +878/-2 | 不採用（等合併） | Python LLM provider 請求移出事件迴圈（`executor.py`）；本 fork 不呼叫付費 provider。 |
| #3912 | OPEN | `ca422f3c195f000a9a3bc15a45e697fa2ce33a87` | 2 檔 +136/-2 | 不採用（等合併） | `auto-update.js` 子程序被 signal 終止後停止；本 fork 不用 auto-update。 |
| #3913 | OPEN | `436517dfc0060f4b2e77ffff15f388590c7e72bb` | 5 檔 +109/-8 | 不採用（等合併） | Python provider 依 HTTP 狀態分類 SDK 失敗；同 #3911。 |
| #3914 | OPEN | `87b4eed5c1678e8a52376498f2ca98bd7ed04bce` | 2 檔 +94/-4 | 不採用（等合併） | `ecc-metrics-bridge.js` 追蹤 notebook 編輯；本 fork 不依賴該指標。 |
| #3915 | OPEN | `3fffe12cd3f9ce6ccba1face410de946a579a69f` | 5 檔 +210/-14 | 不採用（等合併） | session 精確 ID 優先於較新的前綴匹配（4 個 JS 檔）；無本 fork 實例。 |
| #3916 | OPEN | `8d0e58094cf72278dd61768210a42c46d2f1d836` | 3 檔 +73/-4 | 不採用（等合併） | `context-selection.js` 工作流程意圖變更時使 selection 失效；本 fork 的 context 驗證不受影響（F6 已共用單一 registry）。 |
| #3917 | OPEN | `13710577330649bb1263336f1a60948302ae8c76` | 2 檔 +106/-0 | 不採用（等合併） | Ollama 原生 token 用量（Python）；同 #3911。 |
| #3918 | OPEN | `96d99c2e289347002029885d74b4e48d9d37914e` | 2 檔 +138/-28 | 不採用（等合併；釘 monitored） | `validate-workflow-security.js` 補 workflow 安全繞過；與本 fork 的逐 job 官方 repo guard 同一主題，合併後須核對 guard 清冊仍通過。重看：合併。 |
| #3919 | OPEN | `3d99184af705987f16de8be408f69a4889f51fc0` | 2 檔 +77/-7 | 不採用（等合併） | PostgreSQL ADD COLUMN 技能文字與範例 SQL。 |
| #3920 | OPEN | `9a6e1d881a13091bef3663c852c209768cca6f95` | 7 檔 +418/-48 | 不採用（等合併） | PostgreSQL 欄位改名技能文字與範例 SQL，並更新 `pi-core.json`。 |
| #3921 | OPEN | `322e347a86f206dff8063bfc330889087ed74c40` | 6 檔 +46/-5 | 不採用（等合併；釘 monitored） | GateGuard 增加 DROP DATABASE／DROP SCHEMA／ALTER TABLE 的首次接觸閘；與本 fork 的 GateGuard fail-closed 修正（bb514f87）同一檔案群，合併後須重跑 `safety-hooks-*` 測試。重看：合併。 |
| #3923 | OPEN | `2d2d64408c5a00ba1282cba695442ee3889ce03d` | 2 檔 +72/-2 | 不採用（等合併） | `ck` 技能 `save.mjs` 避免重新 init 時清掉已存 session（對應 issue #3922）；本 fork 不用 ck。 |

### 三、隱藏內容與危險片語掃描
對 20 份 diff 的新增行掃描 `curl … | sh`、`iwr`、`iex`、`Invoke-Expression`、`dangerously`、`bypassPermissions`、`ignore previous`、`system prompt`、HTML 註解、`base64 -d`、`eval(`、零寬與雙向控制字元：**0 筆命中**。

### 四、issue 軸（3 筆）

| issue | 判定 | 理由 |
|---|---|---|
| #3903 | 不處理 | 標題只有「GateGuard f」，內文為空，無法判斷內容；若之後補完且描述 GateGuard 行為缺陷，再對照本 fork 的 GateGuard 測試。 |
| #3905 | 不處理 | 外部使用者宣傳自己維護的 Antigravity／OpenCode 衍生 repo，內含外部連結；屬第三方內容，不讀取、不安裝、不採用。 |
| #3922 | 不處理 | `ck` 技能重新 init 會清掉已存 session；本 fork 不用 ck；對應修正是 #3923（已判不採用）。 |

### 五、monitored 重審（2 筆）

| PR | 上游變更證據（舊 head → 新 head） | fork 影響、裁決維持理由與重看條件 |
|---|---|---|
| [#3862](https://github.com/affaan-m/ECC/pull/3862) | `01c2426b2ce80354baaa31fd134f1772e4007332` → `fc7ec24d567abaf5c6771efe20c901dbc3dcbd1a`。`gh api repos/affaan-m/ECC/compare/<舊>...<新>`：ahead 1，2 檔：`scripts/lib/gateguard-target-class.js` +1/-1、`tests/lib/gateguard-target-class.test.js` +18/-0。現為 4 檔，+110/-17。 | 只是在原有 GateGuard 目標分類上微調一行與補測試，裁決不變：不採用、等合併。合併後須重跑 GateGuard 與 `safety-hooks-*` 測試。 |
| [#3870](https://github.com/affaan-m/ECC/pull/3870) | `882ba18c10064b7fd1be02a5a013d3b7655236f0` → `0b4560ef902cf01321af6d97c4bbfd8844e3c9d2`。compare：ahead 8，9 檔：`.github/PR_MODERATION.md` +19/-11、`.github/workflows/pr-burst-guard.yml` +3/-2、`CONTRIBUTING.md` +6/-3、`scripts/ci/pr-burst-guard.js` +29/-16、`scripts/lib/llm-summary.js` +3/-2、`tests/ci/pr-burst-guard-workflow.test.js` +70/-2、`tests/ci/pr-burst-guard.test.js` +76/-14、`tests/hooks/session-end.test.js` +12/-0、`tests/lib/llm-summary.test.js` +9/-0。現為 4 檔，+148/-5。 | 增量多數是上游自己的 PR 治理 workflow（本 fork 以官方 repo guard 隔離，不執行），與 `llm-summary.js` 小改；裁決不變：不採用、等合併。 |

- **新釘 monitored**（3 筆）：`pr#3901`、`pr#3918`、`pr#3921`。重釘 `pr#3862`、`pr#3870` 的 head。monitored 共 35 筆。

### 六、水位
commit 水位維持 **`d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`**；PR `reviewed_pr_through` 推進至 **3923**；issue `reviewed_issue_through` 推進至 **3922**；`reviewed_date` 為 **2026-11-12**。未移植任何產品碼。

## 2026-11-12：上游 PR #3925、issue #3924 補審（同日稍晚新增）

`check_upstream_updates.py --strict` 在上一條目提交後再跑，上游又新增 PR #3925 與 issue #3924（commit 軸仍是 `d2ef2680`，behind 0）。
- [#3925](https://github.com/affaan-m/ECC/pull/3925) OPEN，head `d55d6f9e07c7c751a59961d57233f347beb83820`，7 檔 +51/-13（`manifests/context-packs/skill-triggers@1.json`、`skills/ck/commands/{init,resume,save,shared}.mjs`、`skills/ck/hooks/session-start.mjs`、`tests/skills/ck-paths.test.js`）：`ck` 技能在 Windows 上同一資料夾以 `C:/...` 與 `C:\...` 兩種寫法被登記兩次的修正。已讀 diff，對新增行掃描 `curl … | sh`、`iwr`、`Invoke-Expression`、`dangerously`、`bypassPermissions`、`ignore previous`、`system prompt`、HTML 註解、`base64 -d`、`eval(`：0 筆命中。**不採用（等合併）**：本 fork 不用 `ck`（同 #3922／#3923 的判斷）；重看：上游合併。
- [#3924](https://github.com/affaan-m/ECC/issues/3924) OPEN：同一個 `ck` 路徑問題的回報，對應 #3925，同樣不處理。

水位：`reviewed_pr_through` 推進至 **3925**、`reviewed_issue_through` 推進至 **3924**；`reviewed_date` 仍為 2026-11-12；未移植任何產品碼；未新增 monitored。

## 2026-11-12：uninstall 在 ledger 缺 hooks 目錄記錄時仍能移除 ECC 的 Cursor hook 條目（複審 B）

9059e159 讓 uninstall 只靠 ledger 裡 `.cursor/hooks/` 下的 ECC 檔案辨認 ECC 條目；ledger 殘缺（只剩 `hooks.json` 那筆）時什麼都辨認不出，ECC 條目會留在使用者檔案裡。現在 `uninstallInstalledStates` 把 `repoRoot`（`options.repoRoot`，預設為本 repo）帶進 `uninstallCursorHooks`，讀倉庫內的 `.cursor/hooks.json` 當來源，與 ledger 取聯集；來源讀不到或無法解析時退回只用 ledger。使用者條目照舊保留。`tests/lib/install-cursor-hooks-merge.test.js` 增至 11 項（新增：刪掉 ledger 中 hooks 目錄記錄後 uninstall，ECC 條目移除、使用者的 `node .cursor/hooks/my-own-script.js` 保留；修前紅）。

## 2026-11-12：Cursor guard 的逾時覆寫加上下限；stdin 不可用時 fail-closed（複審 A、D）

**A. `ECC_CURSOR_HOOK_TIMEOUT_MS` 沒有範圍**：edebe4a3 新增的覆寫接受任何正整數。設 1 會讓每個健康的 guard 逾時，而 guard 是 fail-closed，結果每個 shell 指令都被擋（實測 `ls` exit 2）；設超大值則讓掛住的 guard 一直等。`resolveHookTimeout` 現在只接受 1000–60000 的整數（純數字字串），非數字、小數、負數、0、超界一律退回預設 15000 並在 stderr 警告一次（含原值與合法範圍）；明確的 `options.timeout` 仍優先。

**D. stdin 空或無法解析**：`before-shell-execution.js` 原本把空輸入當 `{}`、非 JSON 當成指令字串繼續跑，Claude Code 路徑則對無法檢查的請求 exit 2。現在 JSON 解析失敗、空輸入、或解析結果不是物件（`null`、陣列）時，只要仍有啟用的 blocking guard 就 exit 2（BLOCKED 訊息說明原因），guard 都被使用者停用時照舊放行。`tests/hooks/cursor-block-no-verify.test.js` 原有兩項把「空輸入／非 JSON 放行」釘成規格，改為預期 exit 2（非 JSON 內含 `--no-verify` 的案例本來就是 2）。

**測試**：`tests/hooks/cursor-fail-closed.test.js` 增至 21 項，修前 12 項紅：逾時覆寫 1、999、0、-5、abc、1.5、60001、99999999999 皆警告並用預設、健康 guard 不被擋；邊界 1000、60000 接受且無警告；空、非 JSON、`null`、陣列 stdin 皆 exit 2；guard 停用後不擋。

## 2026-11-12：CI 修補——dev-server guard 不是安全控制；Pi 測試骨架補上 `safety-hooks.js`；MD058

main CI（run 43077452803，commit 989a6bfa）紅了三處，原因都在本輪自己的改動：

1. **`tests/hooks/cursor-fail-closed.test.js`（macOS／Linux 才紅，本機 Windows 綠）**：`before-shell-execution.js` 在非 Windows 會再跑 `pre-bash-dev-server-block.js`，測試的暫存安裝沒放這支，而 989a6bfa／edebe4a3 又把它標成 `failClosed`，所以「找不到檔」就 exit 2，所有案例（包含逾時覆寫與健康 guard）都被擋。(a) 是 fixture 漏複製，不是安裝清單的產品問題（安裝模組以整個 `scripts/hooks` 目錄為單位，真實安裝帶得到）。(b) dev-server guard 是工作流程提醒（要求在 tmux 啟 dev server），不是安全控制：它自己失敗時不該擋下無關的 shell 指令。修法：只有 `block-no-verify` 維持 fail-closed；dev-server guard 不再傳 `failClosed`，`stdin 不可用` 與兩個 catch 改用 `hasSecurityGuard()`（只看 block-no-verify 是否啟用），原有的 `hasBlockingGuard()`（含 dev-server，截斷輸入時用）不動。測試 fixture 補上健康的 dev-server stub，並用 `NODE_OPTIONS` 預載把 `process.platform` 設為 `linux`，讓 Windows 本機也走 CI 的 POSIX 派送路徑；新增 3 項（dev-server guard 缺失、崩潰、只剩它啟用時 stdin 不可用都不擋）。對 HEAD 版 `before-shell-execution.js` 跑：24 項中 21 過 3 敗；修後 24 / 0。
2. **`tests/pi/pi-extension-adapter.test.js`（3 項）**：Pi 測試手動列出 `run-with-flags.js` 執行時要 `require` 的檔案來建最小骨架，沒列新增的 `scripts/hooks/safety-hooks.js`，出現 `Cannot find module './safety-hooks'`。清單補上 `safety-hooks.js`（產品安裝不受影響，同上）。
3. **markdownlint MD058**：上一條上游分流的「四、issue 軸」表格前缺空行，補上。
