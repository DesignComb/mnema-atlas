# Mnema Atlas — 專案導覽 (Onboarding)

> Mnema Atlas 是一個 bilingual（en/zh）的「life OS」web + Android app：**所有寫入（UI / MCP / REST）都收斂到同一條 Zod schema → SECURITY DEFINER RPC → Postgres 的路徑，所以 AI 加的內容與手動在 UI 加的 byte-identical**。
> 適合誰看：想**快速上手、且不想重踩前人坑**的開發者。
> 本文件由 workflow 自動從已驗證的 source block 組裝；最後更新請以 git 歷史為準。

---

## 一分鐘總覽

- **它是什麼**：bilingual（en/zh）的多 Space life OS，前端 React 19 + Vite 8 + TanStack Router/Query，後端 Supabase（Postgres + Auth + RLS）。
- **唯一核心觀念（shared write path）**：UI、MCP、REST 三個入口最後都打到**同一份 Zod schema（`shared/schemas.ts`）→ 同名 SECURITY DEFINER RPC（如 `create_note`）→ Postgres**。schema 與 RPC 是 1:1。所以「AI 加的內容」與「UI 手動加的內容」完全 byte-identical，只差 `created_via`（`'ui'` / `'rest'` / `'mcp'`）這個 provenance 欄位。
- **信任邊界是 RPC，不是 service key**：Worker 用 service-role key 會 bypass RLS，但真正的 spine 是 DB 函式 `app.resolve_uid(p_user_id)`——它永遠 stamp「已解析出來的」user_id，client 偽造不了他人 id。RLS 守 SELECT，RPC 守所有 WRITE。
- **6 個 Space + 跨 Space 的 Today**：Study（notes/decks/cards/graph/study）、Tempo（任務/習慣/暫存）、Galleon（記帳/帳本/分帳/訂閱）、Health/Vitals、Kitchen（食譜/庫存/購物/菜單）、Trips/Voyage（行程/訂位/預算/打包/分享）。
- **3 個部署目標、同一份 `shared/`**：
  1. **Static web** — `vite build` → `dist/`，GitHub Pages 子路徑服務，production 註冊 PWA service worker。
  2. **Cloudflare Worker**（`worker/`）— `wrangler deploy`，對外開 keyless discovery + `/mcp`（MCP server）+ `/rest`（REST），並兼任排程後端。
  3. **Android APK + 自架 Capgo OTA** — Capacitor 包殼，`ota:publish`（web-only 熱更新）與 `apk:release`（native 發版）兩條獨立管線。

---

## 技術棧

monorepo，三個部署目標共用同一份 `shared/`。版本以 `package.json` 為準（皆 caret range）。

### Frontend（web app，建置進 `dist/`）
| 類別 | 套件 / 版本 | 備註 |
|---|---|---|
| UI runtime | `react` 19.2 + `react-dom` 19.2 | `main.tsx` 用 `StrictMode` + `createRoot` |
| Build | `vite` 8.0 + `@vitejs/plugin-react` 6 + `typescript` 5.9 | `tsconfig.json` 用 `moduleResolution: "bundler"`、`verbatimModuleSyntax`、`strict`、`noUnusedLocals/Parameters` |
| Routing | `@tanstack/react-router` 1.170 | `src/router.tsx`，`defaultPreload: 'intent'`、`scrollRestoration`、`basepath: import.meta.env.BASE_URL`（GitHub Pages 子路徑） |
| Server state | `@tanstack/react-query` 5.100 | reads/writes 全包在 `src/lib/hooks.ts`，query keys 集中在 `qk` |
| Styling | `tailwindcss` 4.3 + `@tailwindcss/vite` | Tailwind v4，無 `tailwind.config.js`（CSS-first） |
| Backend SDK | `@supabase/supabase-js` 2.106 | `src/lib/supabase.ts`，用 publishable(anon) key + PKCE |
| 編輯器 / 圖譜 | `@tiptap/*` 3.23、`react-force-graph-2d` + `d3-force`、`perfect-freehand`（白板）、`@radix-ui/*`、`lucide-react`、`motion`、`sonner`、`cmdk` | 重套件（TipTap、force-graph）走 `lazyRouteComponent` code-split |
| 間隔複習 | `ts-fsrs` 5.4 | card 欄位對齊 ts-fsrs v5 `Card`（見 `0001_init.sql` `public.cards`） |
| 重複規則 | `rrule` 2.8 | app 與 worker 共用 |
| 驗證 | `zod` 3.25 | 經由 `shared/schemas.ts` |

### Edge API（`worker/`，Cloudflare Worker）
| 類別 | 套件 / 版本 | 備註 |
|---|---|---|
| HTTP framework | `hono` 4.12 | `worker/src/index.ts` |
| MCP server | `mcp-lite` 0.10 + `zod-to-json-schema` | Streamable HTTP、stateless（`worker/src/mcp.ts`） |
| Backend SDK | `@supabase/supabase-js` 2.106 | service-role（secret key），見 `worker/src/db.ts` |
| Web Push | `@block65/webcrypto-web-push` | VAPID 推播 |
| Build / deploy | `wrangler` 4.95 | `npm run deploy` → `wrangler deploy` |

### Native shell（Android APK）
| 類別 | 套件 / 版本 | 備註 |
|---|---|---|
| Wrapper | `@capacitor/*` 8.4（`core`/`android`/`cli`） | `capacitor.config.ts`，`appId: tw.dco.mnema`、`webDir: dist`、`androidScheme: https` |
| OTA | `@capgo/capacitor-updater` 8.49 | 自架（self-hosted manual mode），`autoUpdate: false`，見 `src/lib/ota.ts` + `scripts/ota-publish.mjs` |
| 原生外掛 | `CapacitorHttp`（繞過 webview CORS）、`@capacitor/push-notifications`、`@capacitor/preferences` | |

### 共用層 `shared/`
`zod` schemas（`shared/schemas.ts`）+ 純函式（如 `shared/settle.ts` 拆帳）。透過 alias `@shared` 被 app 與 worker 同時引用（`vite.config.ts` + `tsconfig.json` paths）。

---

## 架構與資料流

### 一個核心觀念：所有寫入都收斂到同一條路徑
三層收斂點：
1. **同一份 Zod schema**（`shared/schemas.ts`）— single source of truth，被 React app（form validation）與 Worker（MCP tool args + REST body validation）同時 import。每個 schema 對應一個 RPC（1:1）。
2. **同一組 RPC** — UI 端 `src/lib/api.ts` 與 worker 端 `worker/src/tools.ts` 呼叫同名 RPC（如 `create_note`、`create_task`）。worker 的 MCP（`mcp.ts`）與 REST（`rest.ts`）共用同一個 `tools` registry，只差 `via`：MCP → `'mcp'`、REST → `'rest'`、UI 寫死 `p_created_via: 'ui'`，落進 `created_via` 欄位當 provenance。
3. **同一個資料庫函式** — 每個 RPC 都是 `security definer` + `set search_path = ''`（見 `0001_init.sql`）。

### 信任邊界是 RPC，不是 service key
Worker 用 service-role secret key **會 bypass RLS**（`worker/src/db.ts`）。安全的根因在 `app.resolve_uid(p_user_id)`（`0001_init.sql` L24–47），它是 security spine：
- **瀏覽器呼叫**（帶 JWT，`auth.uid()` 非 null）：若傳入 `p_user_id` 與 `auth.uid()` 不符就 `raise 'forbidden'`。所以 UI 一律傳 `p_user_id: null`，由 RPC 用 `auth.uid()` 補 owner（`api.ts` 開頭註解）。
- **service-role 呼叫**（無 JWT subject，即 Worker）：**必須**顯式傳 `p_user_id`，否則 `raise exception`。而那個 user_id 是 worker 從 API key 反查（`worker/src/auth.ts` → `verify_api_key`），不是 client 自己塞的。

換句話說：拿到 service key 也只能透過 RPC 寫入，RPC 永遠 stamp「已解析出來的」user_id。

### 一筆寫入怎麼跑（UI 路徑）
```
React component (e.g. routes/notes)
   │  呼叫 hook
   ▼
src/lib/hooks.ts  useMutation({ mutationFn: api.createNote })  ← React Query
   │              成功後 invalidate qk.notes(...)（樂觀更新 + 快取失效）
   ▼
src/lib/api.ts    supabase.rpc('create_note', { p_user_id: null, ... })
   │              全部包在 unwrap()：res.error → throw new Error
   ▼
@supabase/supabase-js  (publishable key + JWT, PKCE session)
   ▼
Postgres RPC public.create_note  [SECURITY DEFINER, search_path='']
   │   v_uid := app.resolve_uid(p_user_id)   ← 信任邊界
   ▼
INSERT into public.notes (user_id = v_uid, ...)  → 回傳整列
```
讀取則大多直接 `supabase.from('notes').select()` 走 RLS（如 `listNotes`），少數聚合走 read RPC（`get_graph`、`get_itinerary`、`list_tasks`、`search_notes`）。

### 全貌 ASCII
```
        ┌──────────────────────────────┐   ┌──────────────────────────────┐
        │  Browser / Capacitor WebView │   │  External AI (Claude, Cursor)│
        │  React 19 + TanStack Router  │   │  + REST clients / bookmarklet│
        └───────────────┬──────────────┘   └───────────────┬──────────────┘
                        │ hooks.ts (React Query)            │ Bearer API key
                        │ api.ts  supabase.rpc(..,           │
                        │         p_user_id:null)            ▼
                        │                         ┌────────────────────────┐
                        │                         │ Cloudflare Worker(Hono)│
                        │                         │  /mcp  (mcp-lite)       │
                        │                         │  /rest (REST)           │
                        │                         │  auth.ts verify_api_key │
                        │  publishable(anon) key  │  → resolved userId      │
                        │  + JWT (RLS)            │  tools.ts (shared reg.) │
                        │                         │  db.ts service key⇒RLS  │
                        │                         │       bypass            │
                        ▼                         ▼   via:'mcp' | 'rest'
              ┌───────────────────────────────────────────────────────────┐
              │   shared/schemas.ts  (Zod — single source of truth)        │
              └───────────────────────────────┬───────────────────────────┘
                                              ▼
              ┌───────────────────────────────────────────────────────────┐
              │  Postgres  public.<rpc>  [SECURITY DEFINER, search_path=''] │
              │     app.resolve_uid(p_user_id)  ◀── TRUST BOUNDARY          │
              │     INSERT/UPDATE (user_id = resolved uid, created_via=via) │
              │  RLS guards SELECT; RPC guards every WRITE                  │
              └───────────────────────────────────────────────────────────┘
                          Supabase (Postgres + Auth + Storage)
```

### 三個部署目標及其關係
1. **Static web** — `vite build` → `dist/`，GitHub Pages 子路徑服務，`vite.config.ts` 用 `VITE_BASE` 控制 `base`（部署 workflow 設定，本地維持 `/`）。production 會註冊 PWA service worker（`/sw.js`），但在 Capacitor native shell 內跳過（`main.tsx` 用 `Capacitor.isNativePlatform()` 判斷）。
2. **Cloudflare Worker**（`worker/`）— `wrangler deploy`。對外三種面：keyless discovery（`/`、`/openapi.json`、`/llms.txt`、`/.well-known/mnema`）、`/mcp`、`/rest`。同時兼任排程後端：pg_cron 每分鐘 POST `/_cron/run-reminders`（用 `CRON_SECRET` 守），跑提醒 / todo digest / 習慣推播。
3. **Android APK + OTA** — `cap:sync`（`scripts/build-web.mjs` + `cap sync android`）→ `cap:apk`（gradlew assembleDebug）。發版後用 `ota:publish` 把新 web bundle 推到自架 Capgo manifest（存 Supabase Storage）；APK 內建 bundle 用 `__BUILD_VERSION__` 標記版本，app 比對 manifest 後由使用者「點一下才更新」（`autoUpdate: false`，`notifyReady()` 在 `main.tsx` 最早呼叫以避免 10 秒 auto-rollback）。

關係上：web build（`dist/`）是 OTA bundle 與 APK builtin 的「同一份產物」，差別只在 `base` 與 build 版號；Worker 與 Supabase 對三個 client 是同一個後端，無論從哪個入口進來，寫入結果都收斂到同一個 Postgres 狀態。

---

## 功能地圖（Spaces）

6 個 top-level **Space**（`src/components/app-shell/spaces.ts` 的 `SPACES` 是唯一真實來源）+ 跨 Space 的 **Today**。每個 Space 有自己的 hue/brand wordmark，決定 SpaceRail、BottomTabs、Spaces sheet 與 sidebar header。Space ↔ route 由 `activeSpace(pathname)`（`spaces.ts:50`）決定。

讀程式前要先知道的跨 Space 慣例：
- **每個 Space 用「自己獨有」的 search param 當 section/view**，刻意避免互撞：Tempo `?view=`、Galleon `?section=`、Health `?section=`（值不同）、Kitchen `?ksection=`、Trip detail `?tab=`（理由見 `src/router.tsx:149`）。
- **AI 寫入與 UI 寫入 byte-identical**：`created_via === 'mcp'` 的 row，UI 掛一顆 `<AiChip>`。
- **刪除幾乎都走 `undoableDelete`**（grace window + Undo toast），列表用 `useHiddenKeys()` 過濾掉 grace 期間的 row（`src/lib/undoable`）。

### Today / home（Study space 的入口）
- **Route**：`/today`（`HomeScreen`，eager；`src/routes/home.tsx`）。`?review=1` 從每日回顧推播 deep-link 進來自動開 journal dialog（`router.tsx:80`、`home.tsx:126`）。
- 聚合所有 Space 的今日卡片：日記 nudge（含補記昨天）、今天到期任務（inline 完成）、未打卡習慣（at-risk 高亮 + inline check-in）、今日菜單、本月預算 pace、Study hero（待複習張數 / seed 範例牌組）、最近筆記。
- ⚙ 開 `TodayCustomizeDialog`：每 section 可重排/隱藏，per-user 存 `user_layout['today']`（migration `0041_user_layout`，mirror 到 localStorage 讓回訪首屏不閃）。`TODAY_SECTIONS` 在 `home.tsx:64`。
- 新帳號：`StudySection` 偵測 0 decks/0 notes 時顯示 Welcome +「加入範例牌組」(`useSeedSample`)。

### Study（Mnema Atlas）— notes / decks / cards / graph / study
default/catch-all space（`spaces.ts:56`），SubNav 6 分頁（`STUDY_NAV`，`spaces.ts:79`）。
- **Notes**：`/notes`，`?tag=`（`notes.tsx`）。三檢視（localStorage 記憶）：依標籤分組 / 最近 / 塗鴉。建立、star/unstar（`set_note_starred`，`0044_note_starred`）、tag 篩選、匯出單一 Markdown、刪除（undoable）。
- **Note 編輯器**：`/notes/$noteId`（`note.tsx`，**lazy** 載 TipTap ~0.5MB）。debounced autosave、指派 deck、tag editor、生 flashcards（`NewCardDialog`）、Ask AI、空白筆記離開時自動丟棄。
- **[[wikilinks]] + Graph**：`/graph`（`graph.tsx`，lazy，`react-force-graph-2d` + `d3-force`）。三 layout（force/radial/tree）、依 tag/deck 上色 + convex-hull 群組外框。**Link mode**：點兩則建立關聯（`useLinkNotes`）、點線移除（`useUnlinkNotes`）。`[[…]]` 與顯式關聯都成為 edge。
- **Flashcards 瀏覽**：`/cards`，`?tag=`（`cards.tsx`）。依 deck 樹（`buildDeckTree`/`flattenTree`）與 tag 瀏覽，顯示 FSRS state 分佈與 due 數。卡片支援圖片（`0025_card_images`）。
- **Decks**：`/decks`（lazy）全螢幕 deck 樹（可拖拉排序）；`/decks/$deckId` 進單一 deck。巢狀 + 防環見 `0040_note_provenance_deck_nesting`、`0043_deck_parent_cycle_hardening`。
- **Study（FSRS）**：`/study`（`?tag=` 跨牌組複習單一 tag）與 `/study/$deckId`（`study.tsx`，lazy）。翻牌、1–4 評分（`ts-fsrs`，`src/lib/srs`，preview 下次間隔）、**Again 牌 re-queue**、**一層 undo（Z/U，rating 0 = Manual）**、**mid-session discard（D，undoable）**、**Study ahead / cram**（`listAheadCards`）、評分失敗 background retry。鍵盤：Space 翻牌/=Good、1–4 評分、Z 復原、D 丟棄。

### Tempo（Mnema Tempo）— 任務 / 習慣 / 暫存
- **Route**：`/tempo`（lazy，`tempo.tsx`）。`?view=`（today/upcoming/all/calendar/habits/capture/lists）、`?list=`（特例 `inbox`）、`?new=list`、`?capture=`。`?view=all` 被正規化成清空 param（`router.tsx:138`）。SubNav 即 `TEMPO_VIEWS`（`spaces.ts:89`）。
- **任務**：quick-add、priority（旗標 4→1）、due/scheduled、完整 RRULE recurrence（`computeOccurrence`，含 `recurrence_after_completion`）、labels(#tag)、URL（`0030_task_url`）、清單/Inbox 歸屬、清單內拖拉、swipe 完成/刪除。完成有 Undo（recurring 則 roll 到下次、不可 undo）。
- **習慣**：`kind='habit'`，每日 check-in 累 streak，**reset-aware「今天」**（`habitTodayISO(reset_time, tz)`，例如 14:00 cutoff，畫面每分鐘 re-render）。見 `0023_habit_reset_time`、`0033_checkin_reset_aware`、`0038/0039_habit_reminders`。
- **Calendar view**：`CalendarView` 月曆。
- **Capture**：`CaptureInbox`，AI/分享快速丟進來，可 resolve/dismiss/reopen（`0024_captures`）。
- **Lists**：全螢幕清單選擇器（All / Inbox / 自訂）。
- 背景作業：daily todo digest（`0034_todo_digest`）、reminder/recurrence（`0015`、`0035_reminder_actions`）。

### Galleon / Money（Mnema Galleon）— 記帳 / 帳本 / 分帳 / 訂閱
- **Route**：`/galleon`（lazy，`galleon.tsx`）。`?section=`（overview/transactions/accounts/budgets/reports/split/subscriptions，`router.tsx:150-160` validateSearch）、`?ledger=`。`spaceSubnav()` 對 galleon 回 `[]`（無 SubNav strip），改由頁內自渲染 pill 列切。協作者 `viewer` 唯讀。
- **多帳本/帳戶/幣別**：每帳本多 account，**淨資產按幣別分行、絕不盲加總**（`netWorthByCurrency`，audit A3）。account 刪除給「改派交易 vs 留無歸屬」dialog。
- **交易**：income/expense/transfer，分類/payee/note，依日期分組；swipe 編輯/刪除（undoable）。
- **預算**：每月每分類，inline 設定、進度條、超支變紅（`set_budget`/`delete_budget`，`0017_galleon_budgets_recurring`）。
- **Recurring**：`RecurringDialog`，開帳本時冪等補貼到期定期交易（`useRunDueRecurring`）。
- **Reports**：近 6 月收入 vs 支出、本月分類佔比（`useMonthlyTrend`/`useLedgerSummary`）。
- **Split**：成員、`SplitExpenseDialog`、每人餘額、**settle-up 最少轉帳建議**（`@shared/settle` 的 `settleUp`）、結算歷史（undoable）。`0018_galleon_splitting`、`0020_galleon_split_integrity`。
- **Subscriptions**：`SubscriptionDialog`，估每月成本、續訂日 + 取消提醒、續訂時**自動 post 一筆支出**（`usePostDueSubscriptions`）。`0029_galleon_subscriptions`。

### Health / Vitals（Mnema Vitals）— 紀錄 / 日記 / 用藥
- **Route**：`/health`（lazy，`health.tsx`）。`?section=`（overview/journal/meds/history/settings）。`0027_health`。
- **模組化**：Settings 勾選追蹤哪些 module（`HEALTH_MODULES`），存 `health_settings.enabled_modules`，決定 quick-log 種類與分頁。體重單位 kg/lb 可切。
- **Quick log**：weight/meal/workout/water/sleep/blood_pressure 等 `HealthLogKind`（`log_health`，型別來自 `@shared/schemas`）。
- **Journal**：mood（emoji）、energy 1–5、body 文字、tags。
- **Medications**：名稱/劑量/多服藥時間；overview「今日用藥」**逐 dose 追蹤**（早上吃了不算進晚上那顆，audit A9），overdue 高亮。
- **Daily review**：Settings 可開「每晚提醒回顧」（`set_review_prefs`，需先開過推播一次）。`0031_daily_review`、`0036_widget_review_fixes`。

### Kitchen（Mnema Kitchen）— 食譜 / 庫存 / 購物 / 菜單
- **Route**：`/kitchen`（lazy，`kitchen.tsx`）。`?ksection=`（recipes/pantry/shopping/plan）、`?recipe=`。`0028_kitchen`。
- **Recipes**：標題/份數/總分鐘/ingredients（`RecipeIngredient[]`）/封面圖/star。一鍵「加入購物清單」（`0042_recipe_image_clear` 處理換圖清理）。
- **Pantry**：依 category 分組，記數量/單位/到期；設計意圖是「讓 AI 依現有食材想菜」。
- **Shopping**：快速新增、勾選（swipe）、清除已勾選；可從食譜帶入（`recipe_id`）。
- **Meal plan**：未來 7 天 breakfast/lunch/dinner/snack slot，綁食譜或自由 title（`set_meal_plan`）。Today 的「今日菜單」讀這裡。

### Travel / Trips（Mnema Voyage）— 行程 / 訂位 / 預算 / 打包 / 分享
- **Routes**：`/trips`（index，lazy，`trips.tsx`，可一鍵加 Kyoto 範例 trip 走 bulk 寫入）、`/trips/$tripId`（detail，lazy，`trip.tsx`）。Detail `?tab=`（itinerary/bookings/budget/packing，`TRIP_SECTIONS` in `spaces.ts:100`）。
- **Itinerary**：多天 + Unscheduled bucket；每 activity 有 time/place（連 Google Maps）/category/status/assignees/cost(多幣別)/notes/booking URL。三檢視 **Timeline / Table / Board**（`ItineraryViews`），可拖拉、篩選；cost rollup 按幣別。`0008_itineraries`、`0013_trip_v2`、`0012_more_item_categories`。
- **Bookings**：flight/lodging/transport/ticket/car/other（`TripSections.tsx` `BookingsTab`）。
- **Budget**：`BudgetTab`。
- **Packing**：`PackingTab` checklist（`create_checklist_*`），可批次建立。
- **協作/分享**：collaborator（editor/viewer，`MembersDialog`）、公開 **share link**（`/s/$token` 無需登入唯讀，`router.tsx:55`、`ShareDialog`）。**realtime**（`useItineraryRealtime`）。`0009_share_links`、`0010_itinerary_members`。

### 其他（非 Space）
- **Guide**：`/guide` 說明 AI 如何運作。
- **Integrations / Settings**：`/settings/integrations`（lazy）；舊 `/settings/keys`、`/settings/connect`、`/settings/tools` 都 redirect（`router.tsx:228`）。`0002_api_key_scopes`、`0037_fcm_tokens`。
- **公開行銷頁**：`/`（landing，登入者導回 `getLastRoute() ?? '/today'`）、`/faq`、`/self-host`。
- **Sketch / Whiteboard**：在 Notes 裡（`WhiteboardDialog`），存成 `kind='sketch'` 的筆記 + image，scene 存 `sketch_scene`。`0045_note_sketch`。

---

## 開發歷史與工作流

### 一句話總覽
git 歷史只有 **~140 個 commit、約 3.5 週**（`2026-05-30` → `2026-06-22`），卻從「FSRS 背誦閃卡 app」長成多 Space life OS。最快理解的方式是讀成兩條時間軸：**(1) `supabase/migrations/0001 → 0045` 的編號 = 功能落地時序；(2) commit message 的 `type(scope):` = 各 Space 演進敘事。**

> ⚠️ 文件漂移：`README.md:11` 指向的架構文件 `.claude/plans/woolly-greeting-whisper.md` **已不存在**。要理解架構決策，最權威的單一來源是 `CLAUDE.md`（架構決策、完整指令表、測試/發版工作流），再搭配現存的 `.claude/plans/next-phase-plan.md` + `.claude/plans/review-action-plan.md` + `0001_init.sql` 頂部註解。`README.md:96-110` 的 Phase 0–5 Status 表只停在 study app 階段、已被現實超車（程式碼有 6 個 Space）——別把它當目前藍圖；真正 roadmap 在 `next-phase-plan.md`。pgvector 至今仍 deferred（`0001_init.sql` 頂部說明 embeddings 故意延後到 Phase 5）。

### Migration 時間線 = 功能落地敘事（`0001 → 0045`）
- **`0001_init`** — 安全脊椎一次定型：每個 user-owned row 帶 `user_id` + RLS，所有寫入走 `SECURITY DEFINER` RPC，核心 `app.resolve_uid(p_user_id)`（`0001_init.sql:24` 起）。這是 UI/MCP/REST byte-identical 的根因。
- **`0002`–`0007`** — study 補完：api key scopes、修 `cards.note_id` CASCADE bug、edit/delete RPC、deck rename/refile、note/card tags。
- **`0008`–`0013`** — Trips/Voyage：itineraries → share_links → itinerary_members → `0011_p0_hardening`（把「所有寫入走 RPC」從慣例升級成強制控制）→ trip v2。
- **`0014`–`0015`、`0023`** — Tempo（`0014_tempo.sql` 註解「沿用 study 同一條 security spine」）；`0023` 加 habit reset_time。
- **`0016`–`0022`、`0029`** — Galleon。`0016` ledger **從一開始就 membership-aware**（owner + ledger_members + `can_access_ledger`），為分帳鋪路。budgets/recurring(`0017`)、splitting(`0018`)、split integrity(`0020`)、readonly RPC(`0021`)、subscriptions(`0029`)。
- **`0024`** — Captures（跨 Space quick-capture inbox + BYO-AI triage）。
- **`0025`** — card images（Supabase Storage）。
- **`0027` Health / `0028` Kitchen** — 第五、六 Space 同一波（`0027`–`0031` 由 `apply-migrations.mjs` 一次批次套用）。
- **`0031`–`0045`** — 平台化收尾：AI 每日回顧(`0031`)、reminder digest/actions(`0034`/`0035`)、native push 基建(`0037_fcm_tokens`：Web Push 只到瀏覽器、Capacitor 需 FCM)、habit reminders、note provenance + deck nesting(`0040`)、user layout(`0041`)、note starred / sketch(`0044`/`0045`)。

**敘事重點**：每加一個 Space 都複製同一 pattern（table + owner-only RLS + `SECURITY DEFINER` RPC + MCP/REST tool），6 個 Space 後端幾乎同構——所以一個 `mcp__mnema__*` 工具集能涵蓋全部 Space。

### Commit message 慣例（實際在用的）
格式 **`type(scope): subject`**（Conventional-Commits 風，scope = Space/子系統名）。
- **type**：`feat`（主力 80+）、`fix`、`refactor`、`test`、`docs`、`chore`、`ci`，以及 repo 自創的 **`polish`**（非修 bug 的體驗打磨）。
- **scope**：`(tempo)`（最活躍）、`(trips)/(trip)`、`(galleon)`、`(widgets)/(widget)`、`(mobile)/(mobile-nav)/(native)`、`(study)/(notes)/(cards)/(graph)/(whiteboard)`、`(worker)/(mcp)/(security)/(ai)`、`(landing)/(today)/(ota)/(android)` 等。
- **慣用語意**：`chore(android): versionCode N (...)` 專指「APK 版本號 bump」標記 commit；`fix(...): adversarial-review fixes (N findings, M high)` 代表「跑一輪對抗式 review 一次修掉」；`fix(correctness): A1...A12` / `feat(polish): QW1...QW15` 對應 `docs(uiux)` 那份 244-finding audit 條目編號。
- **寫 commit 請照此風格**：`type(space): 具體做了什麼`；native 版本 bump 用 `chore(android): versionCode N (一句話)`。

### Release / 發版工作流（兩條獨立管線）
心智模型：**web-only 改動走 OTA、native 改動走 APK**，兩者用同一個 public Supabase Storage bucket `ota` 散佈 manifest。版本戳記由 `scripts/_build-web.mjs` 統一：`BUILD_VERSION = YYYYMMDDHHmm`，且 `buildWeb()` 取 `max(now, 已發佈 OTA 版本)` 避免剛裝 APK 被誤判要降級。

`package.json` scripts 入口：`cap:sync`、`cap:apk`、`ota:publish`、`apk:release`。各 script 職責：
- **`scripts/ota-publish.mjs`**（`npm run ota:publish "notes"`）— **web-only 熱更新**：build → zip `dist/` → sha256 → 上傳 `bundle-<version>.zip` + `manifest.json` 到 public bucket `ota`。版本用 `max(genVersion(), latestPublished+1)` 嚴格遞增；主動驗證 manifest 公開可達。
- **`scripts/apk-release.mjs`**（`npm run apk:release "notes"`，`--dry-run` 只 build）— **native 一條龍**：(1) bump `android/app/build.gradle` `versionCode +1`；(2) `cap:sync` + `gradlew.bat assembleDebug`（`JAVA_HOME` 未設 fallback 到 Android Studio JBR）；(3) `gh release create ... --latest` 以固定資產名 `mnema.apk` 發 GitHub Release；(4) 上傳 `apk-manifest.json`。**收尾要 commit `build.gradle` 版本 bump**（對應 `chore(android): versionCode N`）。
- **`scripts/apply-migrations.mjs`**（`node scripts/apply-migrations.mjs 0027 0028 ...`）— 用 Supabase **Management API** 套 migration（token 從 `.env.local`/`worker/.dev.vars` 讀，永不出現在命令列）。migration 都冪等（`create table if not exists` / `create or replace function`），套完自動驗證。**不接受無參數「套全部」，必須明列編號**。
- **`scripts/setup-test-user.mjs`** — 冪等建/重設 e2e 測試帳號，憑證寫到 gitignored 的 `.env.test`，供 Playwright authed 測試用。
- **`scripts/verify-new-spaces.mjs`** — 在**會 ROLLBACK 的 transaction** 內 smoke-test 新 RPC（驗 `resolve_uid` + insert 路徑不留資料）。
- **CI**：`82073fa` 帶 Cloudflare deploy CI；`8b84e14` 加 Vitest 單測 + public-surface Playwright e2e；`289bbcb` 升成 authed Playwright suite；`e94e1e2` 升 actions 到 Node 24。

### AI / MCP 驅動的內容創建 = 一級工作流（不是 demo）
這是最核心、最容易被忽略的工作方式：**內容不是「人在 UI 輸入」，而是「AI 把 app 當工具呼叫」**。
- **腳本層**：`scripts/_agent-create.mjs` 直接扮演外部 AI agent——provision `create+edit` scope API key，打**已部署 Worker** 的 public REST（`https://mnema-ai.dco.tw/rest/create_task`）建習慣再讀回 DB 確認（同時是 Worker + 新工具的 e2e 測試）。`scripts/_create-genshin.mjs` 是同類劇本化內容創建。
- **工具層**：本環境掛載整套 `mcp__mnema__*`（~158 tool，`worker/src/tools.ts` 的 `tools` registry，涵蓋全部 6 Space），`created_via` 標 `mcp`/`rest`。
- **commit 層**：`d76b18c`（capture inbox + BYO-AI triage）、`71dfde3`（`docs(ai): reframe as BYO-AI workspace`）、`b88a0a9`（dogfooding live AI tool layer 後的 gap-review remediation）。

**對新進開發者的意義**：任何新功能要 land，通常要**同步動三層**——`supabase/migrations`（RPC）、`shared/schemas.ts`（Zod 單一真相）、`worker/src/tools.ts`（MCP/REST tool，標 `requiresScope`）。漏掉 Worker tool，AI 就碰不到這個功能。OpenAPI / llms.txt / 貼上匯入都是 `tools.ts` 的純函數產物（`next-phase-plan.md:15-18`）。

---

## 過去的坑與避雷指南

這是本文件最重要的一節。每條都是原始碼 defensive code + 註解或修復史封存的真坑。讀 code 前先讀這份，能省下重踩一次的時間。

### A. 資料 / 安全（架構級鐵律）

1. **UI 寫入一律傳 `p_user_id: null`**（`src/lib/api.ts:101-108`）。直覺會想塞 user id，但 authenticated browser caller 由 RPC 內 `app.resolve_uid` 用 `auth.uid()` 補；若傳一個與 `auth.uid()` 不符的 id，RPC `raise 'forbidden'`（`0001_init.sql:34-36`）。UI **永遠不可**直接 insert table（`src/lib/supabase.ts:14-17` 重申用 publishable/anon key + RLS + RPC）。

2. **Worker 的 service key BYPASS RLS——RPC 是唯一信任邊界**（`worker/src/db.ts:5-14`）。**絕不**在 worker 裡裸 `.insert()/.update()` 或自組 user_id——一定走 `callRpc()`（L17-26 一律帶 server 解析出的 `p_user_id: userId`）。bypass-RLS 的讀取走 `ownedSelect`（L28-38）並自己 `.eq('user_id', userId)`，RLS 不會幫你擋。

3. **所有 write 只能走 SECURITY DEFINER RPC**（migration `0011` / `f491de0` 把它從慣例變成強制控制）：drop 掉各表的直接 INSERT/UPDATE/DELETE RLS policy（RLS 開 + 無 write policy = 只有 definer RPC 能寫）、鎖 `api_keys`（隱藏 `key_hash`）、per-user row quota trigger、DB 層 input cap mirror Zod。**新表要可寫就只能新增 definer RPC，別加直接 write policy**；DB 端 quota/cap 是刻意要擋繞過 worker 的直連呼叫者。

4. **`shared/schemas.ts` 是 UI/MCP/REST 的單一真相，禁止繞過**（`shared/schemas.ts:1-9`「so UI / MCP / REST cannot drift」，與 RPC 1:1）。新增寫入欄位**先改 schema**，三邊自動跟上；別在某一端硬塞額外欄位。`worker/src/openapi.ts:7` 的 OpenAPI 也從同一 registry 生成以免漂移。

5. **provenance `created_via`（`'ui'|'rest'|'mcp'`）不可由 client 設定**——worker 一律用 `ctx.via` 蓋掉（`worker/src/tools.ts:1449`「source is the channel, not caller-settable」），UI 端 `api.ts` 全寫死 `'ui'`。新 RPC 別忘加這個參數，否則來源無法區分。

6. **add-only key 的限制在 DB + scope 兩層，不只 UI**：行銷頁宣稱「連上的 AI 只能 add，不能 edit/complete/delete」。實作 = `worker/src/tools.ts:2610-2616` 的 `toolAllowed()`（缺 `'edit'` scope 擋 mutating tool）+ `worker/src/mcp.ts:29-31` dispatch 前檢查 + RPC 內 `raise 42501`。新增「會修改既有資料」的 tool 時，**務必在 ToolDef 掛 `requiresScope: 'edit'`**，否則 add-only key 也能呼叫。

7. **對外 API 錯誤訊息不能漏 schema**（`worker/src/errors.ts`）：raw Postgres error（欄位名/constraint/search_path）一旦回傳就洩漏 DB 結構。`cleanError()` 只放行自己 `raise exception` 的 business 訊息，靠 SQLSTATE 白名單 `AUTHORED_CODES = {'P0001','22023'}` + `LEAK` regex 雙重把關。**新增會 `raise exception` 的 RPC 必須用這兩個 errcode 之一**，否則 business 訊息被吃成「Something went wrong」（曾爆過：`bf66507` `callRpc` 丟掉 SQLSTATE 讓驗證訊息變籠統 500 → 改帶 `RpcError.code`）。

8. **secrets 永遠不進 client、不進 git**（`worker/src/env.ts:9`、`worker/wrangler.toml:34-40`、`worker/.dev.vars.example:1`、`src/routes/self-host.tsx:24`）：`SUPABASE_SECRET_KEY`（service/secret key，bypass RLS）是 server-only。瀏覽器只能拿 publishable/anon key。**別把 secret key 放進任何 `VITE_` 前綴的環境變數**（會被打包進 bundle）。

### B. 日期 / 時區 / locale

9. **永遠不要用 local-time `Date` 對 Tempo 日期做加減**（`src/lib/tempo-date.ts`）：跨時區/DST 會 drift，行事曆少/多一天。所有日期當成 `'YYYY-MM-DD'` 字串，一律用 `Date.UTC(...)`/`getUTC*()`（`parseISO`/`addDays`/`dayDiff`）。陷阱：`todayISO()`（L19-22）刻意用**本地** `getFullYear/getMonth/getDate`——「今天」要看裝置時鐘，但兩日期相減要 UTC-safe，混用是故意的。別退回 `new Date(iso)`（會被當 UTC 午夜再轉本地，可能倒退一天）。

10. **habit「今天是哪一天」要用 server 端 `app.habit_today(reset_time, tz)`，絕不在 client 或點擊當下臨時算**——這個坑爆過至少四次：`6c21d75`（app 開著不翻日 → 每分鐘 tick 重算）、`f5e27ba`（AI `check_in` 用 server UTC `current_date` 把 14:00-reset 台北習慣算進隔天 → migration `0033`）、`7787069`（點擊時重算讓 streak 還是斷 → 把 `habit_date` thread 進 push payload）、`571a4a9`（widget toggle 錯誤那天 → 新 `toggle_check_in` RPC by server 決定狀態，migration `0036`）。關鍵：`habitTodayISO()`（`src/lib/recurrence.ts`）`tz` 為 null 時 fallback `'UTC'`（不是裝置時區），因為 server 對 null tz 也 coalesce 成 UTC——兩邊必須同 fallback。**所有習慣都存 tz**（`src/components/tempo/TaskDialog.tsx:177-180`，否則 plain habit 近午夜 device-local vs UTC 分裂），client/server/widget 三邊要對齊。

11. **任何 formatter（日期/金錢/數字/widget 字串）都要 thread app `lang` + 顯式 `zh-TW`/`en`，絕不讓 OS locale 漏進來**：`toLocaleDateString(undefined)` / `fmtCost` 用 OS locale 會出「永遠中文」之類錯誤（`9873cbc` A7、`0744cfa`）；Android widget 與 capture inbox label 曾硬寫中文讓 EN 使用者看到「逾期/今天」（`603d6d1` A6）。`src/lib/itinerary.ts:141-145` 與 `src/lib/money.ts` 用 explicit `'en-US'`/`'zh-TW'`。TWD/JPY 是 0 位小數（`currencyDecimals`），別硬套 2 位。

12. **多幣別淨值絕不能盲目相加**：NT$ 和 ¥ 直接相加是「自信的錯數字」（最糟的 money bug，`9873cbc` A3）。用 `src/lib/money.ts:25-41` 的 `netWorthByCurrency()` 按幣別分組，UI（`galleon.tsx:467`）一行一幣別。

13. **拆帳 rounding drift 要倒在最後一份，sum 必須等於 total**：按比例分攤有分位誤差。`SplitExpenseDialog.tsx:93-99` 把 drift 累積後丟最後一份（`total - acc`），確保 `sum(owed) === amount`；server RPC 也會 `raise '...splits must sum to the amount'`。拆帳金額守恆是 **DB 層約束**（`create_split_expense`/`get_balances`，`72add73`），改拆帳邏輯要跑 rollback 測試（split 600 → +300/-300 → settle 歸零）。

14. **用藥要 per-dose 計算**：「早上吃了那顆」不可讓晚上那顆顯示已完成。`health.tsx:230` 用 `takenCount` vs `m.times.length` 逐 dose 比對（audit A9）。

### C. 行動端 / Capacitor / OTA / Native

15. **Capacitor 的 origin 是 `https://localhost`，fetch 必須走 native HTTP stack**（`capacitor.config.ts:17-24`）：AI Worker（mnema-ai.dco.tw）與 Supabase 沒把 localhost 加進 CORS allowlist，瀏覽器 fetch 會被擋。開 `CapacitorHttp.enabled` 把 fetch/XHR 改走 native；`androidScheme: 'https'` 讓 secure-context API（crypto、Supabase）與 web 一致。改 server CORS 或新增外部呼叫時，native 與 web 兩條路徑都要驗。

16. **OTA 是 manual 模式（`autoUpdate: false`）；`notifyReady()` 必須在 JS entry、provider tree render 之前最早呼叫**（`src/main.tsx:21`，內部呼叫 Capgo 的 `notifyAppReady()`，wrapper 在 `src/lib/ota.ts:36`），否則慢首屏會踩到 Capgo `appReadyTimeout: 10000`（`capacitor.config.ts:30`）的 10 秒 auto-rollback。**別把這行移到 component 內或 await 後面**。

17. **OTA 與 APK 是兩條獨立管線**：web-only 改動用 `npm run ota:publish`，native 改動（widgets/plugins/manifest）用 `npm run apk:release`。用錯管線 native 改動不會生效。

18. **BUILD_VERSION downgrade guard**：新 build 版本號不能落後線上 OTA，否則剛裝 APK 一開就被提示「更新」到更舊/相同 bundle，無限迴圈。`scripts/_build-web.mjs:29-47` 的 `latestPublishedVersion()` 讓新 build 的 `YYYYMMDDHHmm` 永不 trail；`src/lib/ota.ts:60-72` 的 `checkForUpdate()` 只在 `target > running` 才提示（dev build version=0 永不提示）。**別手動塞比線上小的時間戳**。碰 OTA 一定看 `bcd3147`（14 findings：dismiss 持久化 skip、module flag 擋並發下載、version-keyed 穩定 toast id、APK builtin 蓋 `max(now, latest OTA)` 避免新裝機降級 nag）。

19. **APK 更新優先於 web OTA**：兩者同時存在時只提示 APK（APK 已內含最新 web bundle）。`src/components/OtaUpdater.tsx:43` 先查 APK，有就 early `return`；toast 用 version-keyed 穩定 `id`（resume 不疊出多個）。

20. **Android 只在 versionCode 增加時才安裝更新**，in-app updater 也比對 versionCode。`apk-release.mjs` 自動 bump `build.gradle` 但**不會 commit**——發完 APK 必須手動 commit 版本 bump（`chore(android): versionCode N`），否則下次 build 版本號錯亂。

21. **OTA bucket `ota` 必須 public**：`ota-publish.mjs` 對既有 bucket 用 PUT 強制設回 public + size/MIME caps，因為 bucket 變私有會讓 app 依賴的 `/object/public/` 抓取默默失效。

22. **native 殼層不要註冊 web service worker**（`src/main.tsx:45-54` 用 `Capacitor.isNativePlatform()` 判斷）：app 從 bundled assets 提供，web SW 只多一層 stale cache，install/push 走 native 外掛（dev 也不註冊，避免 dev caching 之苦）。

23. **native Google 登入：產生 PKCE URL 但不要在 webview 內導頁**（`src/lib/auth.tsx:81-94`）：native 用 `skipBrowserRedirect: true` + 系統瀏覽器 `Browser.open()`，由 deep-link handler 完成 `exchangeCodeForSession`；web 靠 `detectSessionInUrl`（`src/lib/supabase.ts:23`）。web 的 `redirectTo` 用 `BASE_URL` 帶 GitHub Pages 子路徑，**必須**登錄在 Supabase Auth → Redirect URLs，否則回跳失敗。

24. **Android widget layout 只能用 RemoteViews 支援的 view**：裸 `<View>`（非 RemoteViews-safe）一個 exception 就讓整個 widget 顯示「Can't load widget」（`d799a56`）。改 `FrameLayout` + 全 body try/catch fallback + 可見版本戳。

### D. 導航 / 路由 / UI 手勢

25. **每個 Space 的 search-param 名稱要唯一，不能都叫 `view`**：否則切 Space 時 query string 互相污染。`src/router.tsx` 刻意讓 Galleon/Health 用 `section`（L149「so it never collides with Tempo's `view`」）、Kitchen 用 `ksection`（L179）、Trip detail 用 `tab`。另一坑：Tempo 的 `?view=all` 是**預設值**，`validateSearch`（L134-138）canonicalise 成 `undefined`（SubNav active 把 undefined 當「All tasks」），手打 `?view=all` 也會被清掉。新增 view 要照這個 default-clearing 慣例。

26. **note/deck detail 頁刻意「沒有」SubNav strip**（`NO_STRIP = /^\/(notes|decks)\/[^/]+/`，`spaces.ts:109`；`spaceSubnav()` 對這些專注頁回 `[]`）：有 strip 就有 swipe-nav，一個誤觸橫滑會把人從編輯器滑走。新增 detail route 若不想被橫滑切走，要加進這個 regex。

27. **mobile 手勢層（swipe-nav / SwipeRow / pull-to-refresh）只在 touch-end 動作、從不 `preventDefault()`**，且要忽略起點在 input / 橫向 scroller / `touch-action:none|pan-y` 元素上的滑動；swipe 要**每次 move 重新評估方向、偏垂直就 disarm**（對角線捲動不該觸發 tab flip，`4a3ac47`、`a31d257`）。`src/components/app-shell/spaces.ts` 是 nav 的單一真相來源（anchors / 標題 / sub-nav）。

28. **route crash 要降落到 recovery card，不能白屏**：AI 寫入可能產生非預期 record shape 讓 route 爆掉。`src/router.tsx:274-276` 設 `defaultErrorComponent`（audit A5）給 `RouteErrorScreen`。同理 `PageHeader.tsx:103`：「A failed fetch must never masquerade as an empty state」——fetch 失敗要顯示錯誤，不能假裝成空清單。

29. **重的葉子路由全部 code-split**（trips/trip/tempo/galleon/health/kitchen/study/graph/note/decks 都 lazy；只有 home/notes/deck/cards eager）。graph 用 `react-force-graph-2d`、note 用 TipTap（~0.5MB）。新功能 import 這類重套件**務必維持 lazy**，否則只看 `/` 的新用戶被迫下載（`src/router.tsx:74`）。

30. **canvas overlay（graph 的 hint banner/toolbar）預設會吃掉節點上的 tap 手勢**：必須全部 `pointer-events-none`、只有按鈕 `pointer-events-auto`。graph 連結功能因此連環修三次（`d27966c`→`63335bd`→`c05760e`），最後加 list-based「Connect to…」下拉當 100% 可靠退路、link mode 關 node drag。

### E. 排程 / 通知 / Worker

31. **Cloudflare Cron Trigger 需要帳號開 workers.dev subdomain**（沒有整個 worker deploy 掛，API 10063，`290eb21`）；此專案改用 Supabase pg_cron 每分鐘 POST `/_cron/run-reminders`，用 `x-cron-secret`（`CRON_SECRET`）比對保護（`worker/src/index.ts:128-148`）。`[triggers]` 可能被刻意註解成 inert（看 `SELF_HOST.md` cron 註記）。**新增排程任務要掛在這個 per-minute ping 上並自己 gate 時鐘**，而非假設有原生 cron。

32. **cron 必須 idempotent——at-least-once ping 不能重複送通知**（`worker/src/scheduled.ts`，Worker 無狀態）：finder RPC `due_reminders_for_cron`（L15-19）只回 `status='pending'` row，送完 `mark_reminder_delivered` 翻成 sent（never double-sends）。digest（L210-211）即使 `count=0` 也要 `mark_todo_digest_sent`，否則整天重查晚送；daily review（L152-153）靠 `mark_daily_review_prompted` 防重。**新增 cron 任務的 finder RPC 要自帶 clock self-gate + mark-done，別在 Worker 端用記憶體判重**。

33. **cron 端點要有 shared-secret guard**（`worker/src/index.ts:131-148`）：`/_cron/*` 檢查 `x-cron-secret === CRON_SECRET`。`/_action`（service worker 通知按鈕回呼，L153-185）沒有 API key，改用「service worker 自己的 push endpoint」當 per-user secret，server 端 `user_id_for_push_endpoint` 解析 uid 再以 service-role 執行——**別把 `_action` 做成可任意指定 user_id**。

34. **rate limit 對 authed 流量要 key by API key、不能 key by IP**（`worker/src/ratelimit.ts:4-12`）：外部 agent（Claude、ChatGPT）從 provider 共享 egress IP 連入，per-IP 限流會連坐不相干使用者。authed（/mcp、/rest）用 API key 當 key、keyless discovery 才用 IP；bindings 都 optional（「a missing binding never 500s」）。

35. **`wrangler.toml` 排序敏感**：top-level `routes` 陣列**必須排在** `[vars]`/`[triggers]` table **之前**，否則 TOML 把 routes 吃進 `[vars]`、deploy 看不到 route 就失敗（`e79ec69`）。

36. **MCP `structuredContent` 必須是 JSON object，但 list/bulk 工具回傳裸 array**：strict client 會拒收，`mcp.ts:42-44` 用 `{ items }` 包起來。寫回傳 array 的工具時記得這層包裝。`create/update_note` 還曾回傳 stale tags（要回 `set_note_tags` 之後的 fresh tags）。這兩個是 `KNOWN_ISSUES` 唯二記過又修掉的老坑（`3c23813`）——動到 MCP list/bulk 工具或 note tags 前先 `git show 3c23813`。

### F. 狀態管理 / UI 規範

37. **Note 編輯器 autosave 要 diff 對 `savedRef`（最後真正存上的值），不是 react-query 的 `note` 物件**（`src/routes/note.tsx:57-61`）：後者每次 refetch 都換 reference，會把 effect 觸發成卡在「Saving…」（`0744cfa` 修過）。deps 只留 `[title, body, note.id]`，**那個 `eslint-disable` 是 load-bearing 的**。markdown 要 raw textarea byte-for-byte round-trip（TipTap 只做唯讀 Preview），別用 WYSIWYG `getMarkdown()` 重序列化（會弄壞手寫/AI 寫的 markdown）。空白筆記離開（unmount）時自動 `deleteNote` 清掉。

38. **undoable delete 的隱藏狀態要放在 react-query cache 之外**（`src/lib/undoable.ts:14-20`）：否則 grace window 內任何 refetch（如完成另一 task invalidate `['tasks']`）會把 optimistic 移除 clobber 掉，被刪的列鬼影復活。用 render-time filter（`useHiddenKeys`，key 形如 `task:`/`txn:`/`recipe:`/`hlog:`/`sub:`/`settlement:`…）。同 key 二次刪除前要先 `fire()` 舊的（L82-88「never interleave」）；tab 在 grace window 內死掉就丟失刪除、下次 session 復活（「safe direction to fail」），靠 `pagehide`/`visibilitychange` flush 把窗口縮到趨近零。**新增列表忘了套這個過濾，被刪項目會鬼影復活**。

39. **study 評分的重試寫入不能 land 在 undo 之後**（FSRS 有狀態，`src/routes/study.tsx:80-99,138-141`，audit A12）：retry 的 grade write 若晚於 undo 的 restore 抵達，會把復原蓋掉、悄悄改寫排程。保留 grade 的 settled promise，`undoLast` 用 `write.then(() => recordReviewSafe(...))` 把 restore 排在 grade write 之後。undo 一律寫一筆 `review_logs`（rating 0 = Manual）標記為 undo 而非 review；Again 牌 re-queue，undo 時從尾端 slice 掉；discard 先 `setLastGrade(null)`（L158-160）讓 grade-undo 不會 rewind 到 stale index。

40. **task 完成的 optimistic flip 要先 `cancelQueries` 再存 snapshot 以便 rollback**（`src/lib/hooks.ts:687-716`）：`useCompleteTask` 在 `onMutate` 先 `cancelQueries`、跨所有 `['tasks', …]` cache flip 並回傳 snapshots，`onError` 用 `rollbackTasks` 還原。少了 `cancelQueries`，飛在路上的 refetch 會覆蓋 optimistic 更新。

41. **shared trip 的外連只放行 https，擋掉 `javascript:`/`data:`**（`src/lib/itinerary.ts:132-136` 的 `safeHttps()` 只回 `^https://`）：公開分享頁（`/s/$token`，無 auth）render 任意 URL 有 XSS 風險。任何進入 shared 視圖、來自使用者/AI 的 URL 都要過這關。

42. **orphan 圖片清理是 best-effort，且禁止刪「還被別人引用」的圖**（`src/lib/upload.ts:29-44` 的 `removeUploadedImage()`）：AI 可能把同一張圖重用在多張 card/recipe/note；誤刪共享圖無法復原，留 orphan 可回收。對非本 bucket URL 靜默 no-op、吞掉 error，仍有 row 引用同 URL 時拒刪。刪圖要在「引用它的 row 真的消失之後」才 fire，並注意 undo 視窗。

43. **`isDueToday` 是唯一的「今天」判定，Today 畫面與 Android widget 共用**（`src/lib/today.ts:3-9`，audit QW9）：兩處各自實作就會顯示不同清單。`WidgetSync` 與 Today 都用它「so they can never disagree」；`mergeLayout`（L48-61）保證 widget/畫面對自訂版面 reconcile 一致。改「今天」定義時只改這一個函式。

44. **新增 Space 但忘了寫對應 metadata 是「編譯錯誤」而非靜默不一致**：guide 的 per-space 文案用 `Record<SpaceKey, ...>`（`src/routes/guide.tsx:17-19`），少一個 Space 的 blurb 就是 TYPE ERROR（audit A1，「the guide can never drift from the rail」）；`BottomTabs`（`BottomTabs.tsx:18-19`）錨點固定在 `spaces.ts`。新增 Space 時讓 TypeScript 逼你補齊所有 keyed map。

45. **`UI_GUIDELINES.md` §7 Don't 是會直接造成 bug 的硬規則**：禁裸 `<select>`（用 `ui/select`）、禁無 `role` 的 clickable `<div>`、禁移除 focus ring、禁 raw hex/`gray-*`、禁寫死寬度破 mobile。**改 UI 前先看 `UIUX_POLISH_AUDIT.md` §0「已是 best-in-class 別重構掉」清單**（`HabitCheckButton`、`SplitExpenseDialog`、note autosave 是該抄的黃金模板）。

46. **`cards.note_id` 的 `ON DELETE CASCADE` 是已知地雷**（`0001_init.sql:97`，`next-phase-plan.md:7` 抓到）：刪一個 note 會默默連帶刪掉它的 flashcards。已靠 migration `0003` 改成 `ON DELETE SET NULL`，並把 `note_id` 從「歸檔位置」降級為「provenance 反向連結」。

47. **`React.lazy` 對「default 不是 component」的第三方套件（如 `lottie-react`）會炸壓縮後的 React #306**：`React.lazy(() => import('lottie-react'))` 的 default 解析成物件而非 component。改用 `lottie-web` 在 `useEffect` 裡 imperative driving（`3a47a14`）。

---

## 快速上手 (Quickstart)

> 以下命令全部取自 source block（`package.json` scripts 與 repo 腳本），未杜撰。secrets 從 `.env.local` / `worker/.dev.vars` 讀，永不放命令列；secret key 絕不進 `VITE_` 環境變數。

**前端（web app）**
```bash
npm install
npm run dev          # 本地維持 base '/'（不要設 VITE_BASE；那是 GitHub Pages 子路徑專用）
```

**Worker（Cloudflare，Hono + MCP + REST）**
```bash
cd worker
# 從 .dev.vars.example 複製出 .dev.vars，填入 SUPABASE_SECRET_KEY（server-only）等
npm install
npm run dev          # wrangler dev
npm run deploy       # → wrangler deploy
```

**DB（套 migration 到遠端 Supabase）**
```bash
# 必須明列要套的編號，不接受「套全部」；冪等可重跑
node scripts/apply-migrations.mjs 0027 0028 ...
node scripts/verify-new-spaces.mjs   # 在會 ROLLBACK 的 transaction 內 smoke-test 新 RPC
```

**測試**
```bash
node scripts/setup-test-user.mjs     # 冪等建/重設 e2e 帳號，憑證寫到 gitignored .env.test
# Vitest 單測 + public-surface / authed Playwright e2e（CI 由 8b84e14 / 289bbcb 建立）
npx vitest run                       # 跑全部單測
npx vitest run <檔名或 -t "測試名">   # 單一測試
```

**Android APK + OTA（兩條獨立管線）**
```bash
npm run cap:sync                     # build web + cap sync android（此路徑 base 必須 '/'）
npm run cap:apk                      # gradlew assembleDebug
npm run ota:publish "notes"          # web-only 熱更新：推新 bundle 到 public bucket ota
npm run apk:release "notes"          # native 一條龍發版（--dry-run 只 build 不發佈）
                                     #   完成後記得 commit build.gradle 的 versionCode bump
```

---

## 延伸閱讀

- **`README.md`** — 專案入口與 Phase 0–5 Status 表，但**該表只停在 study app 階段、已被現實超車**（`README.md:96-110`），且 `README.md:11` 指向的 `.claude/plans/woolly-greeting-whisper.md` **已不存在**。當入門讀，別當目前藍圖。
- **`.claude/plans/next-phase-plan.md`** — 真正的後續 roadmap（2026-05-30 的 5-agent 設計 pass，Phase 0/A/B/C/D），第一批 commit 照此一比一執行；L15-18 把「shared seam」（`shared/schemas.ts` 為樞紐、各 artifact 是 `tools.ts` 純函數產物）講得最白。
- **`.claude/plans/review-action-plan.md`** — 同日的 5-agent review。
- **`CLAUDE.md`** — 架構決策、完整指令表、測試/發版工作流的權威來源（記錄 shared write-path、BYO-AI DNA、two-package/two-port dev setup，以及 typecheck 是唯一靜態檢查、無 lint 等慣例）。入門先讀這份。
- **`supabase/migrations/0001_init.sql`** — 頂部註解 + `app.resolve_uid` 是理解 security spine 與 byte-identical 寫入路徑的根本。
- **`worker/README.md`** — Worker（MCP server + REST + 排程後端）的細節。
- **`docs/SELF_HOST.md`** — 自架部署，含 cron 為何可能 inert（workers.dev subdomain）的註記。
- **`docs/KNOWN_ISSUES.md`** — 目前空的（規矩：發現 bug 記進去、修好刪掉，所以「空」= 無已知未修 bug）。
- **`docs/UI_GUIDELINES.md`** — §7 Don't 是會直接造成 bug 的硬規則。
- **`docs/UIUX_POLISH_AUDIT.md`**（2026-06-10，244 findings）— §0 best-in-class 黃金模板清單（改 UI 前必看，別重構掉）、§A 資料正確性 A1–A12（多對應修復史）、§B Quick wins、§C/§D。改 UI、找某畫面已知 UX 缺陷與該抄哪個 pattern 就查這裡。
- **`docs/PRODUCT_GAP_ANALYSIS.md`**（2026-06-06）— feature gap（拿 Notion/TickTick/YNAB·Splitwise/Wanderlog 當 benchmark，分 🟢 AI-win / 🟡 Build / 🔵 Moat）。決定「該不該蓋某功能、它落在哪個 bucket」就查這裡。