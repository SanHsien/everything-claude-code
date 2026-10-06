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
