# AI_DEV_WORKFLOW.md — AI 開發必讀工作流

> 給後續任何 AI 工具參考的最精簡工作流。先讀 `CLAUDE.md`（架構與規範），本文只規範「怎麼做事」。
>
> 基礎設施：**DB = Supabase migration**｜**CI/CD = GitHub Actions**｜**前端 = Cloudflare Pages**。
> **沒有 staging，合併即上正式環境。** AI 可自行在正式環境開 Supabase 測試帳號驗證。

---

## 黃金守則

1. **寫程式前先讀 `CLAUDE.md`**，照它的架構走，不要自創第二條路徑。
2. **每一個寫入都走 RPC**（UI / MCP / REST 共用同一個 `SECURITY DEFINER` RPC）。**禁止** UI 直接 `supabase.from().insert()`。
3. **Migration 是 append-only**：只新增 `NNNN_*.sql`，**永不修改已上線的 migration**。
4. **每個面向字串都雙語** `t('English', '中文')`；顏色只用語意 OKLCH token，不寫死 hex / gray。
5. **推上去就是正式環境**，所以推之前一定先在本地把關（見下方流程），合併後一定要驗證。

---

## 標準流程（每個任務都照走）

```
1. 理解  → 讀 CLAUDE.md 相關章節 + 既有同類程式，沿用既有模式
2. 改動  → 改最小範圍；新寫入照「5 個地方」清單（見 CLAUDE.md）
3. 把關  → npm run typecheck            # 前端，唯一靜態檢查
          cd worker; npm run typecheck  # 有動到 worker 才需要
          npm test                      # 有相關單元測試就跑（改 worker 寫入要補 unit test）
4. DB    → 新 migration 先 npm run db:reset 本地驗證，再 npm run db:push 推遠端
5. 提交  → 先開分支（不在 main 直接 commit）；commit 訊息照下方慣例
6. 推送  → push → GitHub Actions 跑 typecheck + test → 綠燈才合併進 main
7. 驗證  → 合併後在正式環境用 Supabase 測試帳號實測本次改動
8. 部署  → 驗證通過即自動上正式（Cloudflare Pages 由 main 觸發）；
          驗證沒過 → 立即修；修不了 → 回退（revert）並回報
```

> 合併進 `main` = 自動部署到正式。**所以第 6 步合併前一定要 typecheck/test 全綠，第 7 步驗證一定要做。**
> 較大或有風險的改動（DB schema、寫入路徑、auth），合併前先跑 `/code-review`（repo 慣例：大改動後做 adversarial review，見 commit 史的「review fixes」）。

---

## 正式環境驗證（AI 自助測試）

合併到正式後，用 Supabase 測試帳號驗證**這次改動的實際行為**，不要只信 typecheck 過了：

- 在正式環境建立 / 使用 Supabase 測試帳號（不要動到真實使用者資料）。
- 走一遍本次改動的 happy path；若是寫入功能，確認資料正確落地且 `created_via` 正確。
- 三個寫入面（UI / MCP / REST）有動到就都要驗：AI 加的內容必須與 UI 加的位元相同。
- 測完清掉測試帳號產生的資料（參考 `e2e/auth.teardown.ts` 的清理方式）。
- **驗證通過 → 完成，可自動部署。發現壞掉 → 馬上修或 revert，別留在正式環境。** 沒有 staging，正式就是第一線。

---

## Commit 慣例（照 git 史的既有風格）

格式：`type(scope): 小寫簡述`

- **type**：`feat`｜`fix`｜`polish`（純視覺/微調）｜`chore`（版本/腳本/設定）｜`docs`｜`test`
- **scope**：用 Space / 子系統名，例：`tempo` `galleon` `study` `notes` `mobile-nav` `widgets` `worker` `mcp` `ci` `android` `ota`
- 一個 commit 一件事；訊息講「為什麼/做了什麼」，例：
  `fix(mobile-nav): swipe direction re-eval, no strip on detail pages`
- adversarial review 後的修正用：`fix(<scope>): review fixes — N confirmed findings`
- commit message 結尾照 repo 規定加上 `Co-Authored-By` 行。

## 從專案歷史學到、後續要 follow 的點

- **大改動後做 adversarial review 再合併** — 史上多次 `review fixes`，這是專案習慣，別跳過。
- **動到原生層（plugin / widget / AndroidManifest）→ 一定要 bump `versionCode`** 並單獨 commit（例 `chore(android): versionCode N`），否則 APK 視為舊版裝不上。
  - 純 web 改動走 OTA（`npm run ota:publish`）；原生改動走 `npm run apk:release`，兩者不可互換。
- **新增寫入功能 → 補 worker unit test + 必要時 e2e round-trip**（史上有 `test(e2e): … round-trip` 慣例）。
- **Worker 把錯誤講清楚**：回傳我們自己的 RPC 驗證原因，不要吐一個籠統的 500（見 `fix(worker): surface our own RPC validation reasons`）。
- **`wrangler.toml` 順序**：`routes` 必須在 `[triggers]`/`[vars]` 之前，否則 deploy 失敗。
- **Cron 目前走 Supabase pg_cron**（Cloudflare Cron Trigger 因 workers.dev 子網域問題停用）；改 cron 別去打開那段註解。
- **有問題先記進 `docs/KNOWN_ISSUES.md`**，修掉再移除（史上 docs commit 都這樣管已知問題）。

## 不要做的事

- ❌ 改已上線的 migration（要改就開新的）。
- ❌ UI 端直接寫表（一律走 RPC）。
- ❌ 在 app 內做 AI 生成（產品 DNA 是 BYO-AI，使用者接自己的 AI）。
- ❌ 寫死顏色 / 單一 Space 的色、用裸 `<select>` / 可點 `<div>`（用 `ui/*` primitives）。
- ❌ 未經同意就 push / 部署到正式環境。

---

## 出問題時

- Typecheck 紅 → 先修型別，不要 `// @ts-ignore` 蓋過去。
- CI 紅 → 看 GitHub Actions log，本地重現再修，不要靠重跑碰運氣。
- 正式環境壞掉 → 立即修正並重新驗證；無法即時修則回報使用者並說明影響範圍。
