# 開發 TODO(供 agent 執行)

> 排序邏輯:P0 = 影片黃金路徑(兩週內拍第一支影片所需)+ 零成本驗證;P1 = 轉換路徑;P2 = 進水口與擴充。
> 策略背景見 `docs/BUSINESS_STRATEGY.md`。動工前必讀 `CLAUDE.md`(單一寫入路徑、`t(en, zh)` 雙語、OKLCH tokens、新增寫入工具的 5 步 checklist)與 `docs/AI_DEV_WORKFLOW.md`。唯一靜態檢查是 `npm run typecheck`(前端+worker 各跑一次)+ `npm test`。

---

## P0 — 影片黃金路徑與零成本驗證

### P0-1 AI 匯入流程(第一層引擎)——影片 1、3 的核心

**目標**:用戶不接任何 connector,靠「複製 prompt → 貼給任何 chatbot → 把 JSON 貼回來」完成批次匯入。

- 先盤現況:`AppLayout` 已掛 `⌘I` import——先確認既有匯入對話框的能力範圍,在其上擴充,不要重蓋。
- 場景化 prompt 模板(每個場景一鍵複製,模板要求 chatbot 輸出符合既有 Zod schema 的 JSON):
  - 字卡:`createFlashcardsBulk`(含 deck 建立)
  - 行程:`createTripBulk`(天數+項目+訂房)
  - 記帳:`createTransactionsBulk`
  - 任務:`createTasksBulk`
- 貼回流程:paste textarea → `@shared/schemas` 的對應 schema `safeParse` → **預覽畫面**(卡片/天數/交易列表)→ 確認 → 走既有 bulk RPC(`p_created_via: 'ui'`)。解析失敗給人話錯誤(雙語),不要吐 Zod 原始訊息。
- prompt 模板存前端常數即可,不需後端。
- **驗收**:從 ChatGPT 網頁版貼回 50 張字卡 JSON,30 秒內出現在 deck 裡;格式錯誤時有可讀的雙語錯誤提示。



### P0-2 雙 fake-door(需求驗證,決定 ISO27001 投資)

**目標**:量測「發票自動記帳」與「食材自動入庫/過期提醒」的需求強度,兩者分開統計。

- Galleon 設定/明顯位置:「自動同步雲端發票(即將推出)」入口;Kitchen:「發票明細自動進食材庫、過期提醒(即將推出)」入口。
- 點擊後:說明頁(一句賣點)+「留下 email,上線通知你」表單。
- 事件記錄:曝光/點擊/留 email 三層,分 feature 統計(新表或既有 captures 機制皆可,但要能分開查詢兩個 feature 的漏斗)。
- 誠實標示「即將推出」,不假裝功能存在。
- **驗收**:能查詢兩個 feature 各自的 曝光→點擊→留 email 轉換數。



### P0-3 Captures 畫面加「AI 整理」引導(影片 2 的黃金路徑)

**目標**:MCP/connector 用戶對 AI 說一句就能清空暫存區——工具(`list_captures`/`resolve_capture`/`create_`*)已存在,缺的是 UI 引導。

- Captures 畫面加「複製整理指令」按鈕:一鍵複製一段給 Claude/ChatGPT 的 prompt(「讀取我的暫存區,把每一則分流成任務/帳/筆記並標記完成」)。
- 確認 AI 分流後的項目在 UI 上有 `created_via` 提示(AI chip)——已有 provenance 欄位,檢查各列表是否都有渲染。
- **驗收**:自己的帳號透過 Claude Code MCP 跑完「一句話清空 10 則 capture」全程,無需碰 UI。



### P0-4 影片黃金路徑打磨(依腳本反推,只修鏡頭內的)

- 影片 1(字卡):匯入完成 → deck → 開始複習的動線流暢;複習畫面(翻卡/評分)無視覺瑕疵。
- 影片 3(行程):`create_trip_bulk` 建出的行程在 Trip 頁完整漂亮(天數、項目、訂房分頁);**用既有** `s/$token` **分享連結當影片 CTA**(觀眾點開看 AI 排的真實行程)——確認分享頁在手機上體面。
- 影片 2(暫存區):capture 列表的清空前/後對比視覺清楚。
- **驗收**:三條路徑各自從零到完成錄一次螢幕,無卡頓、無錯字、無英文殘留(雙語檢查)。

---



## P1 — 轉換路徑



### P1-1 OAuth 2.1 + PKCE + DCR(Phase 3b)——最大單項,一切 connector 的閘門

**目標**:claude.ai 與 ChatGPT 的一般用戶能用「貼網址 → 跳轉授權 → 完成」接上 mnema。

- Worker 新增:OAuth authorization server metadata(RFC 8414)、`/authorize`、`/token`、Dynamic Client Registration(RFC 7591,claude.ai 要求)。
- `/authorize` 導向前端授權頁:用既有 Supabase session 確認身分 → 同意畫面(顯示 scopes)→ 發 code。
- Token 沿用既有架構:hash 存表、綁 `user_id` + scopes、`last_used_at`/`expires_at`/revoke——比照 `verify_api_key` 模式,新增 migration(append-only,記得 revoke/grant 收尾)。
- 驗收路徑:claude.ai(Pro 帳號)加自訂 connector → 授權 → 在對話中建一筆任務成功;ChatGPT developer mode 同樣打通。
- 後續(人工,非 agent):Anthropic connector 目錄與 ChatGPT App Directory 送審。



### P1-2 AI capture 分流引擎(第三層 thin edge)

**目標**:app 內建 AI 把 capture 分類成任務/帳/筆記的「提議」,用戶確認後寫入。

- Worker 新增 endpoint:取用戶未處理 captures → 小模型(Haiku 級)分類 → 回提議清單(目標 schema 的草稿)。
- **提議制**:UI 顯示草稿,用戶確認才走 RPC(`created_via` 標 AI 來源);不自動寫入。
- 配額:免費層每月 N 則(常數,先 30),超過顯示升級提示。用量記錄進 DB。
- 模型金鑰是新的 Worker secret(`wrangler secret put`);成本封頂:單則輸入截斷、輸出限長。
- 同引擎第二個皮(可後續):capture 內容像「目標」時(如「我養了一隻貓」),提議一組週期任務(`create_tasks_bulk`+`set_recurrence`+`add_reminder`)。
- **驗收**:丟 10 則混合 capture(任務/消費/雜記),分類正確率肉眼可接受,確認後各自落到正確 Space,配額遞減正確。



### P1-3 麻布記帳 CSV 匯入

**目標**:接住麻布流失用戶(有時效)。

- 取得麻布匯出格式樣本(欄位:日期/金額/分類/帳戶/備註——需先實際匯出一份確認)。
- 匯入對話框(可併入 P0-1 的匯入流程):上傳 CSV → 欄位對映預覽 → 分類對映到 Galleon categories(不認識的建新分類)→ `createTransactionsBulk` 分批寫入。
- **驗收**:1,000 筆的 CSV 匯入成功、分類正確、金額總和與原檔一致。



### P1-4 Deck 分享連結(病毒迴圈)

**目標**:老師/考生分享牌組,接收者一鍵 clone(順便註冊)——複製既有 trip share link 模式。

- 參照 `create_share_link`/`s/$token` 的 trips 實作,擴充到 deck:唯讀分享頁(卡片預覽)+「複製到我的帳號」CTA(未登入導註冊)。
- 新 migration:share link 支援 deck 資源型別;clone = 走既有 bulk RPC 複製 deck+cards 到新 user。
- **驗收**:無痕視窗開分享連結 → 註冊 → deck 出現在自己帳號。

---



## P2 — 進水口與擴充



### P2-1 信件轉寄進水口

- 每用戶專屬地址(Cloudflare Email Routing → Worker);來信解析:先 schema.org 標記,fallback 規則解析。
- 解析器第一批:高鐵、台鐵、agoda/Booking、KKday/Klook → trip bookings;解析失敗落 captures(不丟信)。
- **不走 Gmail API**(restricted scope + CASA 稽核)。



### P2-2 LINE 分享捕捉

- LINE 官方帳號 webhook → Worker → `create_capture`(帳號綁定:app 內產生一次性綁定碼)。
- 只做捕捉,不做對話 AI。



### P2-3 AI 可操作的自訂欄位

- 受約束的型別化 key-value 擴充(文字/數字/日期/布林),掛在 trip item/task 等實體上。
- 走完 5 步 checklist(schema → migration → api.ts → hooks → tools.ts),讓 connector 的 AI 能建欄位+填值;UI 通用渲染,**不做欄位編輯器**。



### P2-4 模組化 UI 隱藏

- Space 級與區塊級「隱藏」偏好(推廣既有 user layout 機制);隱藏的 Space 不出現在 rail/tabs/SpacesSheet。



### P2-5 (fake-door 達標後)雲端發票 API

- 前置:公司主體 + ISO27001(非 agent 任務)。
- `carrierInvChk`/`carrierInvDetail` → `create_transactions_bulk` + Kitchen pantry;同意流程半年可續(法規要求);原始發票資料不落地超過領獎期限。

---



## 給執行 agent 的通用驗收標準

1. `npm run typecheck`(root + worker)與 `npm test` 全綠。
2. 所有新 UI 字串 `t(en, zh)` 雙語;顏色只用語意 tokens;互動元素用真按鈕/`role="button"`。
3. 任何寫入走 RPC,絕不 `supabase.from().insert()`;新 RPC 走 5 步 checklist,migration append-only 且以 revoke/grant 收尾。
4. 新增工具同步進 `worker/src/tools.ts`(單一 registry,MCP/REST/discovery 自動同步)。
5. 改動範圍外的東西不動;完成後在 PR 描述寫清楚驗收路徑怎麼手動重現。

