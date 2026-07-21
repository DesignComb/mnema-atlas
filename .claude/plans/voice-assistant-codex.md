# Feature spec — "Mnema Voice": talk to your life OS, powered by GPT‑5.6

> Built for the OpenAI Build Week hackathon. This is the feature to develop **inside Codex with GPT‑5.6** — the primary development session here is what produces the `/feedback` Codex Session ID we submit. The runtime feature also **uses GPT‑5.6** (function calling), so the demo video satisfies both "built with Codex" and "uses GPT‑5.6".

## One‑line pitch
Tap the mic, say *"add a trip to Tokyo next month, put Skytree on day 1, and log a ¥3000 lunch"*, and it appears in the right Spaces — because **GPT‑5.6 function‑calls the existing tool registry**, so voice‑added content is byte‑identical to UI‑added content.

## Why this fits the architecture (read `CLAUDE.md` first)
- The Worker already exposes ~158 tools from one registry (`worker/src/tools.ts`). `worker/src/openapi.ts` already converts each tool's Zod schema to JSON Schema via `zodToJsonSchema`. **OpenAI function‑calling needs exactly that JSON Schema** → we reuse it directly.
- Every tool's `run()` goes through `callRpc` → the same `SECURITY DEFINER` RPC as the UI. So GPT‑5.6 driving these tools produces identical writes. No new write path, no new RPC, no migration.
- Product DNA is **BYO‑AI**. This feature is consistent with that: it's the user's own OpenAI (GPT‑5.6) acting through the same public write path, just invoked from inside the app for convenience. (See "Product‑DNA note" at the end — do NOT turn this into generic in‑app generation.)

## Architecture
```
 mic (browser)
   └─ transcribe → text            [MVP: Web Speech API in the browser; no backend]
        └─ POST /assistant { text } [NEW Worker endpoint]
             └─ OpenAI Responses API, model "gpt-5.6"
                  tools = tool registry → JSON Schema (reuse zodToJsonSchema)
                  loop: GPT picks tool+args → tool.run(ctx) → same RPC → feed result back
             └─ returns { summary, actions: [{ tool, summary }] }
        └─ UI shows "✓ Added Tokyo trip · ✓ Skytree on Day 1 · ✓ Logged ¥3000 lunch"
             └─ invalidate React Query caches (broad — GPT may touch any Space)
```

---

## Backend — Cloudflare Worker (`worker/`)

### 1. New endpoint file `worker/src/assistant.ts`
A hono router mounted at `/assistant` (mirror `rest.ts`'s structure and auth middleware).

- **Auth**: reuse `authenticate()` from `auth.ts` so an `mk_` Bearer works. ALSO support the in‑app case (see task 4) so the app can call it with the user's Supabase session — no key paste. Resolve `{ userId, scopes }` the same way.
- **`POST /assistant`**, body `{ text: string }`:
  1. Build OpenAI `tools` array from the registry: for each `tool` in `tools`, and **only if `toolAllowed(tool, scopes)`** (respect add‑only vs edit), emit
     ```ts
     { type: 'function', function: {
         name: tool.name,
         description: tool.description,
         parameters: zodToJsonSchema(tool.schema, { $refStrategy: 'none' }),
     } }
     ```
     Reuse the exact conversion used in `openapi.ts`.
  2. Call OpenAI (`https://api.openai.com/v1/responses` or `/chat/completions` — pick one, chat/completions function calling is simplest) with `model: 'gpt-5.6'`, a system prompt (below), the user text, and the tools.
  3. **Tool‑call loop** (cap at ~6 rounds to stay bounded): for each tool call GPT returns, look up `toolByName.get(name)`, `safeParse` the args with `tool.schema`, run `tool.run({ env, userId, via: 'rest' }, args)`, push the tool result back into the messages, and re‑ask GPT until it stops calling tools.
  4. Return `{ ok: true, summary, actions }` where `actions` is `[{ tool, summary }]` collected from each executed `tool.run` result. Keep `via: 'rest'` so provenance is honest (`created_via = 'rest'`), OR add a new provenance value `'voice'` (see optional task 6).
- **System prompt** (keep tight): *"You are a tool‑calling agent for Mnema, a personal life OS. Turn the user's request into the smallest correct set of tool calls. Infer the right Space from context. Dates are YYYY‑MM‑DD. If the request is a vague single thought that doesn't map cleanly to a tool, call `create_capture` so it lands in the inbox. Never invent data the user didn't give."*
- **Errors**: reuse `cleanError` from `errors.ts`.

### 2. Mount it — `worker/src/index.ts`
Add `app.route('/assistant', assistant)` next to the existing `/rest` mount.

### 3. Secrets / env — `worker/src/env.ts` + `wrangler.toml` + `worker/.dev.vars`
- Add `OPENAI_API_KEY` to the `Env` type. Local: put it in `worker/.dev.vars`. Prod: `wrangler secret put OPENAI_API_KEY`.
- Do NOT commit the key. (For the hackathon a single server‑side key is fine; a future per‑user "bring your own OpenAI key" is out of scope — note it in a comment.)

### 4. In‑app auth (session JWT) — small addition to `worker/src/auth.ts`
So the app can call `/assistant` without the user pasting an `mk_` key:
- If the Bearer token starts with `mk_` → existing API‑key path (unchanged).
- Else → treat it as a Supabase access token: verify with `serviceClient(env).auth.getUser(token)`; on success resolve `{ userId: user.id, scopes: ['create','edit'] }` (the owner acting as themselves, same trust level as the UI).
- Only wire this new branch into the `/assistant` route (keep `/rest` and `/mcp` `mk_`‑only to avoid surface changes).

---

## Frontend — React app (`src/`)

### 5. Endpoint constant — `src/lib/endpoints.ts`
Add `export const ASSISTANT_URL = WORKER_BASE ? `${WORKER_BASE}/assistant` : ''`.

### 6. Voice capture + wire into the Capture front door — `src/components/app-shell/CaptureDialog.tsx`
This dialog is already "capture anything, AI files it later" — the perfect home.
- Add a **mic button** next to the whiteboard button. MVP transcription = **Web Speech API** (`window.SpeechRecognition ?? window.webkitSpeechRecognition`), `lang` from the active i18n locale (`en-US` / `zh-TW`). Feature‑detect; hide the button if unsupported. (Web Speech avoids audio‑upload plumbing and is reliable in a Chrome demo. OpenAI transcription is an optional upgrade — see below.)
- On final transcript: fill the textarea so the user sees the words, then POST to `ASSISTANT_URL`:
  ```ts
  await fetch(ASSISTANT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text }),
  })
  ```
  Get the Supabase session token from the existing auth layer (`supabase.auth.getSession()`).
- On success: `toast.success` summarizing `actions` (e.g. "✓ Added Tokyo trip · ✓ Logged ¥3000 lunch"), close the dialog, and **broadly invalidate** React Query (GPT may have touched any Space — simplest correct move is `queryClient.invalidateQueries()` with no key, or call every `bump*` helper). Import `queryClient` from `src/lib/queryClient.ts`.
- Keep the existing text `save()` (capture) path untouched. Add a small toggle/segmented affordance: **"Just capture"** (current behavior → `captures` inbox) vs **"Do it now"** (→ `/assistant`, GPT‑5.6 executes). Both use the same textarea.
- Follow existing conventions: `t(en, zh)` for every string, `ui/*` primitives, semantic tokens, `humanizeError` for failures.

### 7. (Optional upgrade, only if time) OpenAI transcription
Replace/augment Web Speech with `POST /assistant/transcribe` (multipart audio → OpenAI `gpt-4o-mini-transcribe` → `{ text }`) recorded via `MediaRecorder`. Strengthens the "OpenAI usage" story but adds audio‑upload plumbing. Skip for MVP.

---

## Out of scope (say so, don't build)
- Native (Capacitor/Android) mic — web demo only for the hackathon. Note `CapacitorHttp` + `https://localhost` origin caveats for later.
- Per‑user "bring your own OpenAI key" storage.
- Streaming partial results / a full chat UI. One‑shot request → summary is enough.
- New Spaces, schema changes, migrations. **None needed** — reuse the registry.

## Verification (must pass before claiming done)
- `cd worker; npm run typecheck` and root `npm run typecheck` both clean.
- Manual: `npm run dev` (app) + `cd worker; npm run dev` (worker with `OPENAI_API_KEY` in `.dev.vars`). Speak a multi‑part request; confirm rows land in the right Spaces and `created_via` is correct. Verify with a throwaway Supabase test account (see `docs/AI_DEV_WORKFLOW.md`).
- Confirm add‑only vs edit scope is respected (voice can create; editing existing needs the edit scope / owner session).

## Product‑DNA note (important)
`CLAUDE.md` says "no in‑app AI generation." This feature stays consistent because: (a) it's the **user's own OpenAI** acting through the **same public write path** external agents use, and (b) it **creates structured data via existing tools**, it does not generate note/flashcard *content* out of thin air. Frame it in UI copy as "your AI, hands‑free" — an input method, not a content generator. If in doubt, prefer routing ambiguous input to `create_capture` over inventing content.

---

## Codex kickoff prompt (paste this first)
> This is an existing React 19 + Vite + Supabase project (a bilingual "life OS"). **Read `CLAUDE.md` and `.claude/plans/voice-assistant-codex.md` first** — the plan file is the spec. Then implement it, following the existing conventions (single‑RPC write path, `t(en, zh)` strings, `ui/*` primitives, semantic OKLCH tokens). Start with the Worker `/assistant` endpoint (backend), then the CaptureDialog mic wiring. Run `npm run typecheck` in both the root and `worker/` before finishing. Do the work here in this Codex session — this session's ID is what I submit.

### Reminders
- Past commits (from a different tool) can stay — no history rewriting. Only the hackathon feature needs to be built in Codex.
- Keep `git` history clean: one or a few focused commits for this feature.
- The demo video: show Codex building this, then show yourself speaking to the app and GPT‑5.6 executing across Spaces.
