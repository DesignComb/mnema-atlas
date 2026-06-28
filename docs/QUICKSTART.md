# 快速上手（Quickstart）

> 給工程師的最短上手路徑。深入細節看 [`ONBOARDING.md`](./ONBOARDING.md)，規則看 [`../CLAUDE.md`](../CLAUDE.md)。

## 這是什麼

mnema-atlas 是一個雙語（en/zh）的個人「life OS」——一個 React 19 + Vite + Supabase 的 App 殼，裡面裝了好幾個 **Space**：Study（筆記／牌組／閃卡＋知識圖）、Tempo（任務／習慣）、Galleon（記帳）、Health（健康）、Kitchen（食譜／採買）、Travel（行程）。

**一個核心概念先記住**：所有「寫入」（不管來自網頁 UI、AI 的 MCP、還是 REST API）都走**同一條** Postgres `SECURITY DEFINER` RPC，所以 AI 寫進去的資料和你手動加的長得一模一樣。

## 環境需求

- Node.js（看 `package.json`）、npm
- Supabase CLI（本機 DB）
- Windows + PowerShell 是預設 shell

前端（根目錄）和 Cloudflare Worker（`worker/`）是**兩個獨立的 npm 套件**，要各自 `npm install`。

## 跑起來（最少步驟）

```powershell
# 1. 安裝兩個套件
npm install
cd worker; npm install; cd ..

# 2. 設定環境變數
#   前端：複製範本成 .env.local，填 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_MCP_URL / VITE_REST_URL
#   Worker：worker/.dev.vars 填 SUPABASE_URL / SUPABASE_SECRET_KEY（service key，伺服器專用，絕不可進瀏覽器）

# 3. 啟動本機 Supabase（DB / API / Studio）
npm run db:start
npm run db:reset      # 套用 migrations + seed

# 4. 兩個 dev server（分開兩個終端機跑）
npm run dev                 # 前端 → http://localhost:5173
cd worker; npm run dev      # Worker → http://localhost:8787（MCP + REST）
```

## 每天會用到的指令

```powershell
npm run typecheck            # 唯一的靜態檢查（沒有 ESLint/Prettier）
npm test                     # Vitest 單元測試
npx vitest run -t "名稱"      # 跑單一測試
npm run test:e2e             # Playwright（baseURL :4173）
npm run db:types             # DB schema 改了之後重新產型別
```

> ⚠️ 沒有 lint。原始碼裡的 `eslint-disable` 註解是失效的。CI 只跑 `typecheck` + `test`。

## 改 code 前，先懂這一條規則

**寫入永遠是 RPC，不是直接寫表。**

- UI **讀**資料：可以直接 `supabase.from(...).select()`（RLS 會自動只回你自己的列）。
- UI **寫**資料：**不行**直接 `.insert()`／`.update()`——自 migration `0011` 起，直接寫入的 RLS policy 已被移除，DB 會拒絕。一律走 `src/lib/api.ts` 裡的 RPC 包裝。

要新增一個「會寫入」的功能，固定改這 5 個地方（順序很重要）：

1. `shared/schemas.ts` — 加 Zod schema（這是契約，App 和 Worker 都 import 它）
2. `supabase/migrations/NNNN_*.sql` — 新增 `SECURITY DEFINER` RPC（append-only，**絕不改已出貨的 migration**）
3. `src/lib/api.ts` — 薄薄一層 RPC 包裝
4. `src/lib/hooks.ts` — React Query 的 `useMutation`
5. `worker/src/tools.ts` — 加一個 tool（一個 registry 同時餵 MCP 和 REST）

## 接下來看哪裡

- 規則與雷區：[`../CLAUDE.md`](../CLAUDE.md)
- 完整架構與歷史：[`ONBOARDING.md`](./ONBOARDING.md)
- UI 樣式規範：[`UI_GUIDELINES.md`](./UI_GUIDELINES.md)
- Spaces 的單一真相來源：`src/components/app-shell/spaces.ts`
- 路由樹：`src/router.tsx`
