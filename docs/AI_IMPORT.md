# 讓 AI 幫你匯入 / 調整內容

mnema 的 DNA 是 **BYO-AI**:app 本身不做 AI 生成,而是讓**你自己的 AI**(ChatGPT / Claude / Cursor / Gemini…)把內容寫進來。共有三條路,從「完全免設定」到「全自動」:

| 路徑 | 要設定嗎 | 適合 | 入口 |
| --- | --- | --- | --- |
| **A. 各區塊「用 AI 匯入」(REST)** | 一把 API key | 批次新增任務/帳目/食譜/行程… | 任一非 Study 區塊頁首 ✨「用 AI 匯入」 |
| **B. 旅遊「用 AI 調整」(round-trip)** | **免設定** | 編輯**現有**行程(加/改/移/刪) | 行程詳情頁 ✨「用 AI 調整」 |
| **C. Study 貼上(mnema 區塊)** | **免設定** | 新增筆記 + 閃卡 | ⌘I / 命令面板 / 側欄「從 AI 匯入」 |
| (進階) MCP | 連線設定 | 全自動、雙向 | Settings → 連接 AI |

---

## A. 各區塊「用 AI 匯入」(REST)

每個 Space 都能讓 AI 透過 REST API 直接寫入,**不用把結果貼回來**。

1. **拿一把 API key** — Settings → **連接 AI**,產一把(「僅新增」金鑰就夠了,create/bulk 工具不需要 edit scope)。
2. 進任一區塊(Tempo / Money / Health / Kitchen / Travel)頁首點 ✨「**用 AI 匯入**」→ **複製提示詞**。
3. 貼到你的 AI,它要金鑰時貼上 key,然後用自然語言說要加什麼(例:「把這 12 項任務加到我的工作清單」)。

提示詞裡已帶好**該區塊專屬**的端點,例如:

| 區塊 | 主要批次端點 |
| --- | --- |
| Tempo | `create_tasks_bulk` |
| Money | `create_transactions_bulk` |
| Health | `log_health` |
| Kitchen | `add_shopping_items` |
| Travel | `create_trip_bulk` |
| Study | `create_flashcards_bulk` |

AI 會先讀 `‹base›/openapi.json`(完整 schema)再呼叫 `POST ‹base›/rest/‹tool›`。`‹base›` 來自 `VITE_REST_URL`;沒設定時提示詞會用佔位字串並顯示提醒。

---

## B. 旅遊「用 AI 調整」(copy-out / paste-back round-trip)

**完全免設定**,專門用來**改現有行程**。流程:複製現況 → 給 AI 改 → 貼回 → 預覽差異 → 套用。

1. 行程詳情頁(可編輯者)頁首點 ✨「**用 AI 調整**」。
2. **複製目前的行程** — 會得到一段固定格式的 ```` ```mnema-trip ```` JSON 區塊,每個 day/item 都帶 `id`。
3. 貼給任何 AI,用自然語言說要怎麼改(加一天、移動景點到別天、刪掉某項、改時間…)。AI 回傳**同格式**的區塊。
4. 把回覆**貼回**對話框 → 即時顯示**差異預覽**(➕新增 / ✏️修改 / 🗑️刪除 的天數與項目 + 計數)。
5. 確認後**套用** — 透過與 UI 相同的寫入路徑逐筆落地(建新天 → 改既有 → 移動 → 新增 → 刪除 → 還原排序)。

**格式規則**(已寫在複製出來的提示詞裡):保留要保留/修改之物的 `id`;新東西**省略** `id`;要刪除就不要列出;移動就放到目標日底下。日期 `YYYY-MM-DD`、時間 `HH:MM`、`category ∈ food|transport|sight|lodging|activity|shopping|other`。

**已知取捨(v1)**:
- 把欄位**清空**(例:已有的備註改成空白)不會套用 —— 要移除請**整筆刪掉**(對齊 `api.*` 的「null = 不變動」語意,避免誤清)。
- 同一個 `id` 在貼回內容中重複出現時,**以第一筆為準**,其餘忽略。
- 範圍只含**行程本體**(天數 + 每日/未排程項目 + 標題);訂位 / 預算 / 打包不在內。

---

## C. Study 貼上(mnema 區塊)

⌘I(或命令面板 / 側欄的「從 AI 匯入」)→ 複製提示詞給 AI → AI 回一段 ```` ```mnema ```` 區塊(筆記 + 閃卡 + 可選牌組)→ 貼回 → 匯入。這條是純新增,不編輯既有內容。

---

## 相關程式

- 各區塊 REST 提示詞:`src/lib/ai-import.ts` + `src/components/cards/QuickImportDialog.tsx`
- 旅遊 round-trip:`src/lib/trip-roundtrip.ts`(序列化/解析/diff)、`trip-roundtrip-apply.ts`(套用)、`src/components/trips/TripAiEditDialog.tsx`
- 端點來源:`src/lib/endpoints.ts`(`REST_URL` / `OPENAPI_URL` / `LLMS_URL`)
- 工具註冊表(REST/MCP 同源):`worker/src/tools.ts`
