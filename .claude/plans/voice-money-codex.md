# Feature spec — Mnema Voice: let the assistant log money (default-ledger resolution)

> Build this in **Codex** (keeps the hackathon `/feedback` session ID). Small, surgical Worker-only change. It does NOT change the write path, the shared schemas, the tool registry, or the DB — no migration.

## Problem
Right now the voice assistant CANNOT log an expense. `POST /assistant` (`worker/src/assistant.ts`) sends **only write tools** to GPT‑5.6 (the ~40 read tools like `list_ledgers`/`get_ledger` are filtered out by `!tool.readOnly`), and the system prompt says *"Never invent ids."* But `create_transaction` requires a real `ledger_id: uuid` (`shared/schemas.ts:820`, `createTransactionInput = z.object({ ledger_id: uuid, ...txnFields })`). So GPT‑5.6 has no way to obtain a ledger id → a request like *"log that I spent 250 on curry rice"* either gets logged to Health as a meal or fails schema validation. We want it to become a real transaction in the user's ledger.

## Goal
When the user's request involves money (a price / purchase / paid meal), the assistant records it via `create_transaction` in the user's **default ledger** — so the demo command lands a 250 expense in the **Money** Space. No key paste, no read tool, no extra OpenAI round-trip.

## Approach — resolve the default ledger server-side, inject its id into the system prompt
Everything happens in **`worker/src/assistant.ts`** only.

### Key facts (verified — do not deviate)
- The `ledgers` table keys on **`owner_id`**, NOT `user_id` (`supabase/migrations/0016_galleon.sql:15`). So you **CANNOT** use `ownedSelect(env, userId, 'ledgers', …)` — that helper hard-codes `.eq('user_id', …)` and would error. Query manually with `serviceClient`.
- `transactions.account_id` is **nullable** (`0016_galleon.sql:81`, `on delete set null`) and `createTransactionInput`'s `account_id` is **optional**. So a transaction needs ONLY `ledger_id` + `type` + `amount` — you do **not** need to resolve an account.
- `create_transaction` defaults `type` to `expense` and requires `amount >= 0`.

### Steps
1. **Import** `serviceClient` from `./db` in `assistant.ts`.

2. **Resolve the default ledger** inside the `POST /` handler, after auth, before building `messages`. Pick the first non-archived ledger by `sort_order`, then `created_at` (a stable, sensible default). Wrap in try/catch — a failure here must NOT break the whole request (just skip the hint):
   ```ts
   let ledgerHint = ''
   try {
     const { data: rows } = await serviceClient(c.env)
       .from('ledgers')
       .select('id, name, base_currency')
       .eq('owner_id', c.get('userId'))
       .eq('is_archived', false)
       .order('sort_order', { ascending: true })
       .order('created_at', { ascending: true })
       .limit(1)
     const led = rows?.[0] as { id: string; name: string; base_currency: string } | undefined
     if (led) {
       ledgerHint =
         ` The user's default money ledger id is ${led.id} (base currency ${led.base_currency}).` +
         ' When the request involves spending or receiving money — a price, a bill, a purchase, or a paid meal —' +
         ' record it with create_transaction using that ledger_id: choose type "expense" or "income",' +
         ' put the item name as the payee, set amount to the number given, and omit account_id.' +
         ' A priced meal is a transaction, not a health log.'
     }
   } catch {
     // no ledger / read failed → leave ledgerHint empty; money requests fall back as before
   }
   ```

3. **Append the hint to the system message** (keep the existing `systemPrompt()` untouched otherwise):
   ```ts
   { role: 'system', content: systemPrompt() + ledgerHint },
   ```
   The existing *"Never invent ids"* line stays — it now has a real id to use, so there's no contradiction.

4. **No other changes.** Do NOT add read tools to the OpenAI `tools` array (keep the 128-cap slice as-is). Do NOT change `shared/schemas.ts`, `worker/src/tools.ts`, or add a migration. `OPENAI_API_KEY` is already set as a Worker secret — no new env.

## Out of scope (say so, don't build)
- Resolving/creating a default **account** (not needed — account_id is optional).
- A user-selectable "current ledger" (server default = first non-archived; fine for the demo).
- Multi-ledger disambiguation, currency conversion, categories.

## Verification (must pass before claiming done)
- `cd worker; npm run typecheck` clean. Root typecheck unaffected (no frontend/shared change) but run it if you touched anything shared.
- **Dry-run against a throwaway account that HAS at least one non-archived ledger** (see `docs/AI_DEV_WORKFLOW.md`). Speak/POST the exact demo command:
  *"Add a Tokyo trip from September fourteenth to the eighteenth, remind me to book the flights ten days before, and log that I spent two hundred fifty on curry rice for lunch."*
  Confirm GPT‑5.6 calls exactly three tools across three Spaces: `create_itinerary` (Travel), `create_task` (Tempo reminder), `create_transaction` (Money) — and the 250 shows in the ledger in its base currency. It should NOT also create a Health meal.
- If the account has **no** ledger, confirm it degrades gracefully (no crash; the lunch falls back to Health/capture).

## Deploy
`cd worker; npm run deploy` (publishes to `mnema-ai.dco.tw`). No secret changes.

## Product-DNA note
Consistent with BYO-AI: still the user's own OpenAI acting through the same public `create_transaction` RPC the UI/MCP/REST use. We only hand the model the user's OWN ledger id (resolved from their owned rows) — we invent no data.

## Codex kickoff prompt (paste this first)
> Read `CLAUDE.md` and `.claude/plans/voice-money-codex.md` (the spec). Make the Worker-only change so the voice assistant can log expenses: in `worker/src/assistant.ts`, resolve the caller's default ledger via `serviceClient(env).from('ledgers').eq('owner_id', userId).eq('is_archived', false).order('sort_order').order('created_at').limit(1)` (NOT `ownedSelect` — ledgers key on `owner_id`), and append a hint with that `ledger_id` + base currency to the system message instructing the model to record money via `create_transaction` (type expense/income, omit account_id). No schema/tool/registry/migration change; don't add read tools to the OpenAI tool set. Run `cd worker; npm run typecheck`. Do the work here in this Codex session so the session id is preserved.
