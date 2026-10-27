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
