# Feature spec — Mnema Voice: loading state + friendly result / deep-link

> Build this in **Codex** (keeps the hackathon session ID). It polishes the voice assistant's UX; it does NOT change the write path.

## Problem (current behavior)
In `src/components/app-shell/CaptureDialog.tsx`, `runAssistant()` calls the Worker `/assistant`, gets back `{ ok, summary, actions }` where `actions: Array<{ tool: string; summary: string }>`, then shows ONE toast: `你的 AI：<summaries joined by " · ">`.

Two problems:
1. **No progress indication** while the request is in flight (it can take a few seconds). `assistantPending` state already exists but nothing renders from it.
2. **The summaries embed raw UUIDs** the user can't read. Tool summaries look like `Created trip "Tokyo trip" (a1b2c3d4-…)`, `Created task "Book flights" (f9e8…)` — the `(uuid)` is meant for the AI, not humans. And there's no way to jump to what was created.

## Goal
- Show a **loading state** while the assistant works.
- On success, replace the raw toast with a **friendly result**: human labels (NO uuids), grouped by Space, each with a way to open it.
- **Navigation:**
  - If the actions touched **exactly one Space** → primary CTA navigates straight there (or auto-navigate on close).
  - If **multiple Spaces** → show a small result card listing each Space that got something, with a "前往 <Space> →" link each. Do NOT auto-navigate (the user chose to do several things at once).

## Recommended approach — frontend-only (no Worker redeploy)
Everything needed is derivable in the app from `action.tool`. Prefer this over changing the Worker.

1. **Strip the uuid for display.** The summary ends with ` (…)` containing an id. For display, drop a trailing `(…)` group, e.g. `summary.replace(/\s*\([0-9a-f-]{6,}\)\s*$/i, '')`. Keep a friendly fallback if the whole thing becomes empty.

2. **Map each tool → Space.** Add a small module (e.g. `src/lib/assistant-spaces.ts`) exporting `toolSpace(toolName): SpaceKey | 'capture'`. **Derive the mapping from the authoritative `// ── <Space>` banner sections in `worker/src/tools.ts`** — read those banners and assign every create/log/write tool to its Space. Reuse `SpaceKey` from `src/components/app-shell/spaces.ts`. `create_capture` → `'capture'`. Provide a sensible default (`'tempo'`) for anything unmapped so it never crashes.

3. **Map Space → landing route.** A `SPACE_ROUTE` record:
   - `study → /notes`, `travel → /trips`, `tempo → /tempo`, `galleon → /galleon`, `health → /health`, `kitchen → /kitchen`, `capture → /tempo` with `search { view: 'capture' }`.
   Reuse the Space metadata (label, icon, hue) from `spaces.ts` so the result chips match the rest of the app.

4. **Result UI in CaptureDialog:**
   - While `assistantPending`: render a loading state inside the dialog — a spinner + `t('Your AI is working…', '你的 AI 處理中…')`, and disable the inputs/buttons. (A `Loader2` from lucide with `animate-spin` matches the codebase.)
   - On success, set a `result` state: `{ actions: Array<{ label: string; space: SpaceKey | 'capture' }> }` (label = uuid-stripped summary). Render grouped by Space:
     - **Single Space:** a success line + a primary `Button variant="brand"` → `navigate(SPACE_ROUTE[space])`, then `onOpenChange(false)`. You may also just navigate immediately and show a success toast; pick whichever feels cleaner, but a visible confirmation is required.
     - **Multiple Spaces:** a compact card — one row per Space (icon + Space name + count, e.g. "Travel · 1", "Tempo · 1", "Health · 1"), each row a `Link`/button that navigates there and closes the dialog.
   - Keep the existing `queryClient.invalidateQueries()` so the destination is fresh when the user lands.
   - On error keep the current `humanizeError` toast.

5. **Conventions (non-negotiable, see CLAUDE.md):** every string is `t(en, zh)`; use `ui/*` primitives; semantic OKLCH tokens only; real `<button>`/`Link` (no clickable bare `<div>`); reuse `spaces.ts` for Space label/icon/hue; no hardcoded colors.

## Optional (only if you want exact-detail deep-links, needs a Worker change)
Frontend-only lands the user on the Space's LIST route (the new item is visible there). To deep-link to the exact record (e.g. `/trips/<id>`), the Worker must return the id:
- In `worker/src/assistant.ts`, when pushing an action, also include `id` (from `run.data?.id`) and optionally `space`: `actions.push({ tool: tool.name, summary: run.summary, id: (run.data as any)?.id })`.
- Then the frontend can route to a detail page for tools that have one (trip → `/trips/$id`, note → `/notes/$id`, deck → `/decks/$id`); fall back to the list route otherwise.
Mark this optional — the list-route version is enough for the demo and needs no redeploy.

## Verification
- `npm run typecheck` (root) clean; if you touched the Worker, `cd worker; npm run typecheck` too.
- Manual: run the voice command "add a Tokyo trip …, remind me …, log that I had curry rice for lunch". Confirm: (a) a loading state shows while it runs; (b) the result shows friendly labels with NO uuids; (c) three Spaces (Travel/Tempo/Health) appear with working links; (d) a single-Space command navigates straight there.

## Kickoff line for Codex
> Read `CLAUDE.md` and `.claude/plans/voice-ux-codex.md`. Implement the frontend-only version (loading state + friendly, uuid-free, per-Space result with navigation) in `src/components/app-shell/CaptureDialog.tsx` plus a small `src/lib/assistant-spaces.ts`, deriving the tool→Space map from the `// ── <Space>` banners in `worker/src/tools.ts`. Follow the existing conventions (`t(en,zh)`, `ui/*`, semantic tokens, reuse `spaces.ts`). Run `npm run typecheck` before finishing. Do the work in this Codex session.
