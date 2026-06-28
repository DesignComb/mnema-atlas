# ADR — 架構決策紀錄 (Architecture Decision Records)

> 本檔記錄 mnema-atlas 已落地的重大架構決策，給後續開發（含 AI 工具）理解「為什麼這樣設計」。
> 格式：每筆含 **狀態 / 背景 / 決策 / 影響**。決策一旦寫入即 append-only，要推翻請開新 ADR 標 Superseded，不改舊文。
> 搭配 `CLAUDE.md`（怎麼做）、`docs/AI_DEV_WORKFLOW.md`（工作流）一起看。

| #    | 決策                                                  | 狀態     |
| ---- | ----------------------------------------------------- | -------- |
| 0001 | 單一寫入路徑：所有寫入走同一個 SECURITY DEFINER RPC   | Accepted |
| 0002 | `shared/schemas.ts` (Zod) 為三個介面的唯一契約        | Accepted |
| 0003 | `app.resolve_uid` 作為安全主幹，信任邊界在 RPC 不在金鑰 | Accepted |
| 0004 | BYO-AI：app 內不做 AI 生成                             | Accepted |
| 0005 | Worker 為獨立 npm package，一份 registry 餵兩個 transport | Accepted |
| 0006 | `created_via` 欄位記錄來源，不另開表                   | Accepted |
| 0007 | Migration 編號、append-only、每支 RPC 自帶 grant       | Accepted |
| 0008 | 讀走 RLS 直查、寫一律走 RPC                            | Accepted |
| 0009 | Spaces 模型：`spaces.ts` 為單一事實來源                | Accepted |
| 0010 | 前端資料層 `api.ts → hooks.ts`，元件不直接寫 Supabase  | Accepted |
| 0011 | 全面雙語：行內 `t(en, zh)`，無 key catalog            | Accepted |
| 0012 | 語意 OKLCH token + per-Space 換色                      | Accepted |
| 0013 | 日期用 `'YYYY-MM-DD'` UTC 字串、字串運算               | Accepted |
| 0014 | 行動端導覽：退掉 drawer，改 BottomTabs + SubNav         | Accepted |
| 0015 | 原生更新雙軌：自架 Capgo OTA（web）/ APK release（native）| Accepted |
| 0016 | Cron 改由 Supabase pg_cron 驅動                        | Accepted |
| 0017 | Cloudflare Pages 自動部署、無 staging、AI 在正式自助驗證 | Accepted |

---

## ADR-0001 — 單一寫入路徑：所有寫入走同一個 SECURITY DEFINER RPC

**狀態**：Accepted

**背景**：同一份內容可由三個介面寫入——React UI、MCP server、REST API。若各自寫表，三條路徑會在驗證、欄位、權限上漂移，AI 加的內容與 UI 加的會不一致。

**決策**：每一個寫入都呼叫同一支 Postgres `SECURITY DEFINER` RPC。UI（publishable key，受 RLS）與 Worker（service key，繞過 RLS）走的是同一支函式，所以 AI 加的內容與 UI 加的**位元相同**。自 `0011_p0_hardening.sql` 起，直接 insert/update/delete 的 RLS policy 已被移除，用 publishable key 物理上無法直接寫表。

**影響**：
- 新增寫入功能要照 CLAUDE.md「5 個地方」清單（schema → migration → api.ts → hooks.ts → tools.ts）。
- **禁止** 在 UI 加 `supabase.from().insert()`。
- 信任邊界是 RPC，不是 API key（見 ADR-0003）。

---

## ADR-0002 — `shared/schemas.ts` (Zod) 為三個介面的唯一契約

**狀態**：Accepted

**背景**：UI 與 Worker 是不同 build，型別容易各寫一份而漂移。

**決策**：所有寫入輸入的 Zod schema 集中在 `shared/schemas.ts`，由 app（`@shared`）與 worker（相對路徑）**同時 import**。三個介面共用同一份驗證，無法各自漂移。

**影響**：改契約先動 `shared/schemas.ts`；MCP/REST 的 schema、UI 的型別都跟著它。

---

## ADR-0003 — `app.resolve_uid` 作為安全主幹，信任邊界在 RPC 不在金鑰

**狀態**：Accepted

**背景**：Worker 持 service key 會繞過 RLS，若直接信任 client 傳的 user_id 就能假冒任何人。

**決策**：`app.resolve_uid(p_user_id)`（`0001_init.sql:24`）統一裁決身份。有 JWT（瀏覽器）時只能操作自己，傳不同 id 直接 `forbidden (42501)`；無 JWT（worker service 呼叫）時 `p_user_id` 為必填且被信任，而該 id 是 API key 經 `verify_api_key` 解析出來的，Worker 無法偽造金鑰沒給的 id。瀏覽器一律傳 `p_user_id: null`。

**影響**：洩漏 publishable key 也無法假冒他人；Worker 讀取需自行 `ownedSelect` 補 `.eq('user_id', userId)`，裸查會洩漏全體資料。

---

## ADR-0004 — BYO-AI：app 內不做 AI 生成

**狀態**：Accepted

**背景**：產品定位是讓使用者接「自己的」外部 AI 進來寫資料，而非內建生成。

**決策**：app 內**不做**任何 in-app AI generation。AI 透過 Worker 的 MCP/REST 寫入路徑進來；app 只負責呈現/標註/回顧 AI 寫的內容（`created_via` provenance、AI chip）。

**影響**：不要新增 in-app 生成功能。AI 相關功能都圍繞「呈現與歸因外部 AI 的產出」。

---

## ADR-0005 — Worker 為獨立 npm package，一份 registry 餵兩個 transport

**狀態**：Accepted

**背景**：MCP 與 REST 兩種傳輸若各自維護工具清單會漂移。

**決策**：`worker/` 是獨立 npm package（自有 deps / wrangler.toml）。`worker/src/tools.ts` 是**唯一**工具 registry，MCP（`POST /mcp`）與 REST（`/rest`）共用；`openapi.json` / `llms.txt` / discovery 三個 keyless endpoint 也都由同一份 `tools` 陣列衍生，不手維護第二份清單。

**影響**：新增工具只動 `tools.ts` 一處，兩個 transport 與所有 discovery 自動同步。MCP 因規格禁止頂層陣列，list 類結果包成 `{ items }`；REST 直接回陣列。

---

## ADR-0006 — `created_via` 欄位記錄來源，不另開表

**狀態**：Accepted

**背景**：要區分「AI 加的」與「UI 加的」內容，但不想為此切第二套資料表。

**決策**：每張表加 `created_via text`（`'ui' | 'rest' | 'mcp'`，CHECK 約束）。UI 寫死 `'ui'`，Worker 傳 `ctx.via`。

**影響**：provenance 是欄位不是表；查詢/呈現 AI 內容靠它。新表沿用此欄位。

---

## ADR-0007 — Migration 編號、append-only、每支 RPC 自帶 grant

**狀態**：Accepted

**背景**：DB 即 schema 又即寫入邏輯（RPC），需要可審計、可重放、不退步。

**決策**：`supabase/migrations/NNNN_*.sql` 編號、**append-only**，每支 migration 同時定義表與其 RPC。所有 RPC 為 `SECURITY DEFINER` + `set search_path = ''`，故識別字全部完整限定（`public.x`/`app.x`/`extensions.x`）。新函式預設對 PUBLIC 開放 EXECUTE，**每支 migration 結尾必須** `revoke … from public; grant execute … to authenticated, service_role;`，漏了會把函式暴露給 anon。

**影響**：**永不修改已上線 migration**，要改就開新號。本地 `db:reset` 驗證、`db:push` 推遠端。

---

## ADR-0008 — 讀走 RLS 直查、寫一律走 RPC

**狀態**：Accepted

**背景**：寫入需強一致與單一路徑（ADR-0001），但讀取若全走 RPC 會犧牲彈性與效能。

**決策**：UI **讀**用 `supabase.from(...).select()`，由 per-table `_select` RLS（`auth.uid() = user_id`）把關；**寫**一律走 RPC。需整棵樹一次取回的讀（`get_graph`/`search_notes`/`get_itinerary`/`list_tasks`…）才用 RPC。Worker 已繞過 RLS，讀必須自行 `ownedSelect` 補 user_id 範圍。

**影響**：UI 新讀取可直查表；新寫入不可直查，走 RPC。

---

## ADR-0009 — Spaces 模型：`spaces.ts` 為單一事實來源

**狀態**：Accepted

**背景**：一個 app shell 承載多個頂層 Space（study/travel/tempo/galleon/health/kitchen + graph），各有 wordmark、色相、icon、子導覽，分散維護會不一致。

**決策**：`src/components/app-shell/spaces.ts` 的 `SPACES` 陣列為單一事實來源，餵桌面 rail、行動底部 tab、Spaces sheet、sidebar header。各 Space 的色相是 `.theme-*` class，由 `AppLayout` 依 pathname 切換；active UI 一律用共用 `bg-brand`/`text-brand` token。

**影響**：新增 Space **不是一檔搞定**——還要補 `AppSidebar.tsx` 的 `SPACE_SIDEBAR`（不補不編譯）、`last-route.ts` 的 `APP_PREFIXES`、`AppLayout` 的 `theme-*` map。各 Space 的 search param 取**不同名**避免碰撞（見 CLAUDE.md）。

---

## ADR-0010 — 前端資料層 `api.ts → hooks.ts`，元件不直接寫 Supabase

**狀態**：Accepted

**背景**：要讓 UI 寫入與 Worker 寫入共用同一條 RPC 路徑（ADR-0001），且快取失效要集中管理。

**決策**：`src/lib/api.ts` 是型別化 RPC wrapper（讀 RLS 直查、寫走 RPC）；`src/lib/hooks.ts` 是 React Query 介面（`useQuery` 讀、`useMutation` 寫後 `onSuccess` 失效對應 key）。元件**永不**為了寫入直接呼叫 `supabase`；熱路徑用樂觀更新 + rollback。

**影響**：新功能照 `api.ts → hooks.ts` 兩層走；少數合法的元件內直查是窄例外。

---

## ADR-0011 — 全面雙語：行內 `t(en, zh)`，無 key catalog

**狀態**：Accepted

**背景**：en/zh 雙語產品；傳統 i18n key/locale JSON 維護成本高且容易漏。

**決策**：每個面向使用者的字串都在呼叫點寫 `t('English', '中文')`（`useT()`），`t` 回傳當前語言的引數。日期/星期用 `tempo-date.ts` 的雙語 helper，不手刻。Sidebar/nav 例外（分離 `label`/`zh` 欄位）。

**影響**：不建 key catalog；新字串直接行內雙語。元件必須在 `<I18nProvider>` 內。

---

## ADR-0012 — 語意 OKLCH token + per-Space 換色

**狀態**：Accepted

**背景**：要支援 light/dark + 六個 Space 各自色相，硬寫顏色會失控。

**決策**：只用 `src/index.css` 的語意 OKLCH token（`bg-background`/`bg-card`/`text-foreground`/`text-brand`…）。寫 `text-brand`/`bg-brand` 會自動跟隨當前 Space 的 `.theme-*`，不硬寫某 Space 的色。light/dark（`.dark` class）與 Space 色相（`.theme-*` class）是**兩套獨立系統**，不可混為一談。`--color-capture` 刻意固定不換色。

**影響**：禁止 hex/`gray-500`/一次性陰影；用 `ui/*` primitives。

---

## ADR-0013 — 日期用 `'YYYY-MM-DD'` UTC 字串、字串運算

**狀態**：Accepted

**背景**：跨時區/DST 用 `Date` 做日數運算會漂移。

**決策**：所有日曆日期是 UTC 純字串，用 `src/lib/tempo-date.ts`（`addDays`/`dayDiff`/`startOfWeek`/`weekday`）做字串運算，不用 `new Date(iso)` 本地時間運算、不傳 `Date` 物件。（`todayISO()` 刻意本地時間，讓「今天」對齊牆上時鐘。）

**影響**：新日期邏輯一律走 `tempo-date.ts` helper。

---

## ADR-0014 — 行動端導覽：退掉 drawer，改 BottomTabs + SubNav

**狀態**：Accepted（supersedes 早期 drawer space switcher）

**背景**：早期行動端用 drawer 切 Space，觸控動線差、Space 切換要兩步。

**決策**：退掉 drawer。行動端用固定 `BottomTabs`（Spaces + 中央 Capture FAB + 常駐 Spaces tab，liquid blob 追蹤 active）＋ `SpacesSheet`（全 Space 格狀底部 sheet）。Space 內導覽是 `SubNav` strip，資料驅動自 `spaceSubnav()`；只有 Study 與 Tempo 渲染 strip。Note/deck **detail** 頁匹配 `NO_STRIP`：無 SubNav 且無 swipe-nav（編輯器內橫滑不可翻頁）。

**影響**：新增類編輯器的 detail 路由要更新 `NO_STRIP`。within-Space 橫滑由 `useSwipeNav` 在 strip items 間移動。

---

## ADR-0015 — 原生更新雙軌：自架 Capgo OTA（web）/ APK release（native）

**狀態**：Accepted

**背景**：Capacitor app 既有 web 層（JS/CSS）也有 native 層（plugin/widget/manifest），更新節奏不同。

**決策**：兩條獨立 channel——`src/lib/ota.ts` 用自架 Capgo（manual mode，`autoUpdate: false`）推 **web 層** bundle（`ota:publish`）；`src/lib/apk-update.ts` 用 `ApkInstaller` plugin 推 **native** 變更（`apk:release`）。OTA 偵測比對 `__BUILD_VERSION__`（`YYYYMMDDHHmm`，`'dev'` 永不提示）。`cap:sync` 把 BUILD_VERSION 鎖為 `max(now, 最新 OTA 版本)`，新 APK 不會被當成降版。

**影響**：純 web 改動走 OTA；**動到 native 層必走 `apk:release` 並 bump `versionCode`**，兩者不可互換。Capgo 需 `notifyReady()` 開機執行否則回滾。

---

## ADR-0016 — Cron 改由 Supabase pg_cron 驅動

**狀態**：Accepted

**背景**：Cloudflare Cron Trigger 需要 workers.dev 子網域，目前因 API error 10063 無法啟用。

**決策**：`wrangler.toml` 的 Cron Trigger 區塊註解停用，改由 **Supabase pg_cron** POST `/_cron/run-reminders` 與 `/_cron/run-daily-reviews`，以 `x-cron-secret`（`CRON_SECRET`）保護。Worker 的四個掃描（reminder/todo-digest/habit/daily-review）皆 idempotent，各自 `mark_*` 並清掉死掉的 404/410 訂閱。

**影響**：改 cron 邏輯時，排程來源是 pg_cron 不是 Cloudflare；別去打開 wrangler.toml 那段註解（會撞 10063）。

---

## ADR-0017 — Cloudflare Pages 自動部署、無 staging、AI 在正式自助驗證

**狀態**：Accepted

**背景**：小團隊/個人專案，維護 staging 環境成本高、回饋慢。

**決策**：前端由 Cloudflare Pages 在 `main` 更新時自動部署，**無 staging，合併即上正式**。CI（GitHub Actions）跑 `typecheck + test` 把關。AI 工具可在正式環境自開 Supabase 測試帳號驗證本次改動，**驗證通過即視為部署完成**；發現問題立即修或 `revert`。

**影響**：合併進 `main` = 上正式，所以合併前 CI 必須全綠、合併後必須驗證（流程見 `docs/AI_DEV_WORKFLOW.md`）。風險改動（DB schema / 寫入路徑 / auth）合併前先做 adversarial review（`/code-review`）。
