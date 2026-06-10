# Mnema — UI/UX Polish & Craft Audit (2026-06-10)

> Companion to [`PRODUCT_GAP_ANALYSIS.md`](./PRODUCT_GAP_ANALYSIS.md) (which covers *feature* gaps).
> This doc is about **craft**: the details that separate "good" from best-in-class — empty/loading/error
> states, motion & micro-interactions, optimistic feedback, consistency, microcopy, a11y, touch ergonomics,
> and delight. Style rules live in [`UI_GUIDELINES.md`](./UI_GUIDELINES.md).

**Method.** A principal-designer audit run as a 22-agent workflow: 9 cross-cutting lenses + 11 screen/space
deep-dives read the real components, then a completeness critic + a synthesis pass. **244 findings**
(🔴 broken 14 · 🟠 friction 122 · 🟡 polish 82 · 🟢 delight 26), deduped and ranked below.

**Benchmarks.** Notion · TickTick · Duolingo · Linear · Things 3 · Superhuman · Splitwise · Apple Health ·
Anki · Obsidian · Paprika · Stripe/Vercel onboarding · Gmail.

**Product DNA the recommendations respect.** BYO-AI (users connect their *own* external AI via MCP — **no
in-app generation**; the win is *surfacing/attributing/reviewing* what the AI wrote). Calm Scandinavian
aesthetic, serif headings + sans body, full dark/light, fully bilingual en/繁中, web + PWA + Capacitor Android.

---

## 0 · Already best-in-class — protect, don't "fix" 🟢

These were independently flagged as category-leading. **Use them as the templates** for the work below; do
not refactor them away.

- **`HabitCheckButton`** — the in-house gold standard: only `aria-pressed` control, optimistic-with-revert
  (handles the refetch-clobber race), bilingual dynamic `aria-label`, native `button` + keyboard. **Template
  for every other custom control and optimistic mutation.**
- **At-risk streak urgency UI** — reset-time-aware (04:00/14:00 cutoffs), `tabular-nums` countdown, only the
  last 3h. Textbook Duolingo restraint. Only gap: missing `dark:` tokens.
- **Bottom-tab liquid blob + raised FAB + capture ripple** (memory-safe via `onAnimationComplete`) +
  safe-area. Signature native delight — reuse its spring/bloom language for new success moments.
- **Resume-last-route + per-space themed blob hue** — removes the "where was I" tax.
- **Per-space accent theming via a single `--brand` override** (4-token `.theme-*` blocks, WCAG
  `--brand-strong`, dark variants). Token architecture on par with Linear/Things.
- **Note editor: diff-aware `savedRef` autosave** (the eslint-disable is load-bearing), idle "Autosaves as you
  type" affordance, blank-note auto-discard.
- **`SplitExpenseDialog`** — penny-perfect equal-split remainder, dual balanced/remaining meter, multi-payer,
  disabled-until-balanced. **Clearer than Splitwise itself; the reference form for the app.**
- **FSRS interval hints on grade buttons** — real predicted intervals shared between client preview and server
  write, so the preview never lies.
- **Knowledge graph craft** — deterministic shared tag colors (`tagHue` single source), decluttered labels,
  clamped `fitView`, oversized touch targets. Matches/exceeds Obsidian.
- **Capture source attribution + correct EN/繁中 measure-word pluralization** (張/個/次) + enforced 24h time.
- **Tempo journal nudge** — catch-up that doesn't nag when current, mood-emoji reward, clean
  push→deep-link→auto-open loop.
- **Public trip share page** (dedicated theme, costs-hidden honoring, `safeHttps` gate, distinct invalid-link
  copy) + PWA share-target + jump-list shortcuts.
- **Integrations capability list** — live API-read "what your AI can do" (sourced from the real schema, never a
  drifting marketing list) + the add-only permission allow/deny table.
- **Galleon first-ledger empty state** — distinct first-run vs in-app, warm "build your first…" framing, CTA
  flowing into the object. **The canonical empty-state the other spaces should copy.**

---

## A · Fix-first — correctness & data integrity 🔴

Genuinely broken or data-losing; these undermine trust regardless of polish.

| # | Issue | Fix | Files |
|---|-------|-----|-------|
| A1 | **Guide says "Four spaces" but the app ships six** — onboarding doc contradicts the rail (no model for Health/Kitchen). | Make data-driven off `spaces.ts` so it can never drift; add HeartPulse/ChefHat cards. | `src/routes/guide.tsx`, `src/components/app-shell/spaces.ts` |
| A2 | **Links unfurl blank** — every shared URL shows a stale flashcard-only card ("Mnema Atlas / 讀書筆記背誦閃卡"); the six-space rebrand is invisible. Fatal for a share-driven growth loop. | Add OG/Twitter meta + 1200×630 og:image; update `<title>`/manifest to BYO-AI framing; set `document.title` to the trip name on the public itinerary. | `index.html`, `public/manifest.webmanifest`, `src/routes/shared-trip.tsx` |
| A3 | **Cross-currency net worth blind-sums into base** — confidently wrong (worst kind of money bug). | Group per-currency, or show `≈` + "not converted". | `src/routes/galleon.tsx`, `src/lib/money.ts` |
| A4 | **Re-saving an AI's structured `2 cups \| flour` silently destroys quantity/unit** — human surface is lower-fidelity than the MCP write path. | Preserve structured quantity/unit on edit. | `src/routes/kitchen.tsx`, `src/components/kitchen/RecipeDialog.tsx` |
| A5 | **A failed fetch masquerades as an empty state; no router error boundary** — an unexpected record shape (which AI writes will produce) = unrecoverable white screen. | Add a TanStack `defaultErrorComponent` (calm card + Reload) + `isError` branches (Retry + offline banner) so "400 transactions" never reads as "No transactions yet". | `src/router.tsx`, `src/lib/queryClient.ts`, space list routes |
| A6 | **Android widget hardcodes Chinese** (EN users see 逾期/今天) — and the capture inbox shows English `→ task` next to the localized AI tag. | Thread persisted `lang` through `WidgetSync`; add a `RESOLVED_KIND_LABEL` map. | `src/components/WidgetSync.tsx`, `src/lib/widget.ts`, `src/components/tempo/CaptureInbox.tsx` |
| A7 | **`fmtCost` uses OS locale** — the documented `toLocaleDateString(undefined)`-class gotcha. | Thread app `lang` with explicit `zh-TW`/`en` locale. | `src/lib/money.ts` |
| A8 | **Subscriptions delete with no guard at all**; task/habit/health/recipe deletes are silently irreversible. | See QW1 (undo toasts). | (see QW1) |
| A9 | **Meds collapse multiple daily doses into one boolean** — can't tell if the evening dose was taken / is overdue. | Today-progress ring + at-risk amber (reuse HabitCard). | `src/components/health/MedicationDialog.tsx`, `src/routes/health.tsx` |
| A10 | **`logged_at` time is fetched then discarded** (fasting vs post-meal glucose is lost); **kg/lb setting ignored**; AI-written entries lack `created_via`. | Keep & show time; honor unit setting; add `created_via`. | `src/routes/health.tsx`, `src/lib/health.ts`, `src/components/health/LogHealthDialog.tsx` |
| A11 | **Study: "Again" cards never re-surface in-session** — the predicted "1m" interval is a lie; you never consolidate misses. | Re-queue Again within the session window. | `src/routes/study.tsx`, `src/lib/srs.ts` |
| A12 | **No undo for the last grade** — a misclick silently rewrites FSRS. | Undo last grade (pairs with A11). | `src/routes/study.tsx` |

---

## B · Quick wins — ship this week 🟠

High impact, S/M effort, mostly front-end-only, independent, and largely **reuse patterns already in the app**.

1. **Replace `confirm()` + silent deletes with optimistic delete + Undo toast (app-wide)** · `M`
   The single highest-leverage consistency fix. Native `confirm()` breaks the calm aesthetic (OS chrome,
   untranslatable, no dark mode); other deletes are silently irreversible (one mis-tap wipes a streak/vitals).
   sonner action toasts are already proven in `OtaUpdater`. → **Gmail/Linear delete-then-undo**; reserve a
   styled Radix `AlertDialog` only for irrecoverable bulk deletes.
   `src/routes/tempo.tsx`, `galleon.tsx`, `kitchen.tsx`, `health.tsx`, `src/components/tempo/HabitCard.tsx`, `CaptureInbox.tsx`, `src/lib/hooks.ts`, `src/components/ui/dialog.tsx`

2. **Make task/health/shopping completion optimistic with Undo (mirror `HabitCheckButton`)** · `M`
   Completing a to-do is Tempo's most-repeated action yet feels laggy and unforgiving. Reuse the
   optimistic-with-revert recipe + `AnimatePresence` so rows slide instead of teleport.
   `src/routes/tempo.tsx`, `src/lib/hooks.ts`, `src/components/tempo/HabitCheckButton.tsx`, `health.tsx`, `kitchen.tsx`

3. **Kill the dark-mode FOUC: blocking inline theme script + on-brand first-paint shell** · `S`
   Every cold load for a dark-mode user is a white flash — the cheapest "tell" on a calm app. 3-line sync
   script in `<head>` sets the dark class before paint; a tiny inline `#root` loader (wordmark/brand dot)
   means the first frame is never blank. → **Linear/Notion/Vercel.**
   `index.html`, `src/lib/theme.tsx`

4. **Promote at-risk amber + status colors to semantic tokens with dark variants** · `M`
   The at-risk amber (Habits' emotional peak) shatters dark mode (`bg-amber-50` ≈ white). Raw
   `text-red/blue/emerald-500` lack dark variants too. Define `--warning/--success/--danger` (light+dark).
   `src/index.css`, `src/components/tempo/HabitCard.tsx`, `CalendarView.tsx`, `src/routes/galleon.tsx`

5. **Apply `prefers-reduced-motion` app-wide via `MotionConfig` + base CSS** · `S`
   Reduce-motion users get a calm landing then a fully-animated app (flips, blob glide, dialog zoom). Wrap
   `RouterProvider` in `<MotionConfig reducedMotion='user'>` + a global CSS rule. **Unblocks all
   flip/confetti/celebration work safely.**
   `src/main.tsx`, `src/index.css`, `src/components/public/PublicShell.tsx`

6. **Global `:focus-visible` fallback + fix the DialogClose ring + calendar day focus** · `M`
   Keyboard users can't Tab to a calendar day cell (it's a `div`); the most-used escape control —
   `DialogClose` — kills its own ring with `focus:outline-none`, poisoning the whole app's keyboard story.
   `src/index.css`, `src/components/ui/dialog.tsx`, `src/components/tempo/CalendarView.tsx`

7. **Render bilingual relative dates ("Today/Tomorrow/Sat") instead of raw ISO across Tempo & Trips** · `S`
   Task rows, trip day headers, and the calendar all show `2026-06-14` — cold, untranslated, forces mental
   math. Add `relativeDay(iso, today, lang)` + `fmtDayDate(iso, lang)` (explicit `zh-TW`/`en`, never
   `toLocaleDateString(undefined)`); for overdue append "· 3d".
   `src/routes/tempo.tsx`, `CalendarView.tsx`, `src/lib/tempo-date.ts`, `src/routes/trip.tsx`, `shared-trip.tsx`, `src/lib/itinerary.ts`

8. **Humanize error toasts + kill English-only "Failed" fallbacks in 繁中** · `M`
   A 繁中 user hits an RLS/unique error and gets a raw English Postgres sentence or the bare word "Failed".
   Add `humanizeError(err, t)` mapping common Postgres signatures to calm bilingual copy; route every
   `toast.error` through it; seed `'Untitled'` as `t('Untitled','無標題')`.
   `src/lib/utils.ts`, `src/lib/api.ts`, dialog/route call-sites

9. **Make Today a true cross-space day** (tasks due, habits left, at-risk streak, meal, budget) · `M`
   The screen the whole app funnels to is titled "Today" but is actually the Memoria home — five spaces are
   absent, and it shows *less* than the Android widget that opens it. The today-predicate already exists in
   `WidgetSync`; extract to `lib/today.ts`, render calm cross-space sections (hidden when empty) with inline
   complete/check + a time-of-day greeting. → **TickTick/Things Today, Sunsama.**
   `src/routes/home.tsx`, `src/components/WidgetSync.tsx`, `src/lib/hooks.ts`, `src/lib/today.ts`

10. **Surface AI authorship: one shared "AI" chip + "new since" dot wherever `source==='mcp'`** · `M`
    The product's entire thesis is *your AI writes your data*, yet attribution is one unstyled 2-letter string
    in one space. Build one Sparkles pill (reuse `FlashcardTile`) on AI-written task/note/transaction/
    recipe/health rows + a "new since last visit" dot (localStorage timestamp). **Pure surfacing — highest
    trust win.** → **Linear "created by integration" / Notion AI attribution.**
    `src/routes/tempo.tsx`, `galleon.tsx`, `notes.tsx`, `kitchen.tsx`, `health.tsx`, `CaptureInbox.tsx`

11. **Give every empty state a CTA + a "Connect an AI" link when no key exists** · `M`
    Empties dangle the BYO-AI value but give no way to act; Tempo/Kitchen/Health empties dead-end with no
    button despite `EmptyState` supporting `action`. Wire each primary action + append a "Connect an AI →"
    link (only while `listApiKeys` is empty).
    `src/routes/tempo.tsx`, `kitchen.tsx`, `health.tsx`, `galleon.tsx`, `graph.tsx`, `PageHeader.tsx`

12. **Move the Toaster to top-center on mobile with a close button** · `S`
    Toasts (incl. the new **must-be-tappable Undo toasts**) render bottom-right over the tab bar + FAB, in the
    right-thumb swipe path. Make position responsive (top-center below `lg`), clear safe-area-top,
    `closeButton`. **Prerequisite for all undo-toast wins.**
    `src/main.tsx`, `src/components/app-shell/BottomTabs.tsx`

13. **Celebrate habit/task completion: spring check + haptic + milestone toast at 7/30/100** · `M`
    Habit check-in is Tempo's emotional core but the reward is flat. Spring the `CheckCircle2`, fire
    `navigator.vibrate?.(15)` / Capacitor Haptics, and on a streak threshold/personal best fire a one-time
    celebratory toast + lazy confetti. Gate behind reduced-motion. → **Duolingo lesson-complete.**
    `src/components/tempo/HabitCheckButton.tsx`, `HabitCard.tsx`, `src/lib/hooks.ts`, `src/lib/fcm.ts`

14. **Add a "Test connection" / live status to Integrations + always-visible copy on touch** · `M`
    The make-or-break activation moment: the user configures their AI and can't tell it worked. Poll
    `last_used_at` for "Waiting for your AI's first request…" → "Connected! used just now"; drop the
    hover-only gating on copy snippets (invisible on the phone the flow markets). → **Stripe/Vercel.**
    `src/routes/integrations.tsx`, `src/lib/utils.ts`, `src/lib/api.ts`, `worker/src/index.ts`

15. **Make hover-only row actions reachable on touch + add inline validation/disabled-submit** · `S`
    On phones, hover-only row menus in Kitchen/Galleon/HabitCard are permanently invisible — deleting a pantry
    item is impossible. Pair every `group-hover:opacity-100` with `[@media(hover:none)]:opacity-100`.
    Propagate `SplitExpenseDialog`'s `canSubmit`/disabled pattern to the other dialogs.
    `src/routes/kitchen.tsx`, `galleon.tsx`, `HabitCard.tsx`, `TransactionDialog.tsx`, `LogHealthDialog.tsx`, `ItemDialog.tsx`

16. **Update the Guide to six spaces (data-driven off `spaces.ts`)** · `S` *(= A1)*

---

## C · High-impact bets — bigger investments that raise the ceiling 🔵

| Bet | Why | Benchmark | Effort |
|-----|-----|-----------|--------|
| **Cross-space command palette + global search parity** | In a six-space OS Cmd-K is the universal jump but only knows Memoria — users learn it's unreliable and stop. A `$42` dinner / Kyoto trip / logged headache can't be found by name. Mostly wiring existing view arrays + a Recent (MRU) group + fuzzy entity search with colored dots. | Linear / VS Code / Slack | `L` |
| **Mobile interaction layer: bottom-sheet dialogs + swipe-to-act + pull-to-refresh** | The biggest "feels like a website" tell on the native shell. Add a `sheet` variant to the shared `DialogContent` (one change upgrades ~25 dialogs), a reusable `SwipeRow` (motion drag), and pull-to-refresh on list containers. | Things 3 / Apple Reminders / Vaul / TickTick | `L` |
| **BYO-AI review surface** | Beyond the AI chip: a cross-space "From your AI / Recently added" digest on Today, a "By AI" filter in Galleon, dashed AI links + a "Recent" overlay in the graph, change-highlight on co-edited trips. Pure surfacing/attribution — no generation. | Linear / Notion AI / GitHub bot | `L` |
| **Account screen: data export, account delete, discoverable theme/language** | A life OS holding money/health/journal data — positioned MIT/self-hostable — has no "download everything" backup and no delete path (trust + compliance gap); data only goes *in* via AI. Add `/settings/account`: profile, theme+lang (also Cmd-K actions), "Export all" (JSON/MD/CSV ZIP), guarded typed-confirm delete. | — | `L` |
| **Streak depth: weekly-goal habits, streak repair/freeze, richer heatmaps** | All-or-nothing daily streaks punish one slip as harshly as quitting (#1 reason trackers are abandoned) and can't model "gym 4×/week". Add "N times/week" + weekly ring, a calm "restore your N-day streak" (backdated RPC already exists), a "perfect week" marker, completion-ratio calendar tint. **The retention lever.** | Duolingo / TickTick | `L` |
| **Study upgrade: real card flip, swipe-to-grade, in-session "Again" re-queue, session summary** | The screen named after a flip has no flip; Again never re-surfaces (A11); no swipe-grade; no undo (A12); the end is just a checkmark. Add `rotateY` flip (crossfade under reduced-motion), drag-to-grade, re-queue, Undo, a Duolingo-grade count-up ribbon. | Anki + Duolingo | `L` |
| **Activate the notes graph: in-editor `[[wikilinks]]` + backlinks, list filtering, graph search/legend/filter** | The connective magic is half-built — wikilink CSS shipped but `[[` behavior + backlinks are absent; the note list is an unnavigable `updated_at` stack past 30 notes; the graph has no search/legend/filter + silent-error-as-empty. | Obsidian / Notion | `L` |
| **Health & Kitchen become real tools** | Both can't do their core job today: Health is raw number lists (no trend), meds collapse doses (A9), units ignored (A10); Kitchen drops you into an edit form when you want to cook + destroys structured qty (A4). Add per-metric sparklines + deltas, meds today-ring, a read-first `RecipeView` cook mode + serving scaling. | Apple Health / Daylio / Paprika / Mela | `L` |
| **Quick-add NLP** | The placeholder promises "gym at 19:00" schedules something, but text just sits in the inbox until an AI runs — killing flow for on-the-go humans. A tiny deterministic parser (date-fns + regex for tomorrow/today/HH:MM/!p1/#list) with removable token chips; unparsed text still takes the BYO-AI inbox path. | TickTick / Todoist | `M` |
| **Per-space sidebar/view parity + in-screen segmented switcher for Tempo** | IA is inconsistent: Study/Tempo get a full second rail while Galleon/Health/Kitchen show a near-empty sidebar; Tempo's Today/Upcoming/Habits live only in the sidebar vs others' one-tap segmented control. Generalize the `TEMPO_VIEWS` pattern off the per-space section arrays. | — | `M` |
| **Money correctness: per-currency net worth + budget remaining/over + settle-up "you" hero** | A3 + "NT$420 left / NT$80 over" pace feedback under budget bars + lead the split view with the signed "you owe / are owed" hero Splitwise opens with. | Splitwise | `M` |

---

## D · Cross-cutting themes

Each recurred across multiple spaces; fixing the theme once (a shared component/util) beats per-screen patches.

1. **Optimistic feedback & undo everywhere** — destructive + completion actions should be instant-and-reversible, not laggy-then-permanent or guarded by `confirm()`. Standardize on the Gmail/Linear delete-then-undo-toast + the `HabitCheckButton` optimistic-with-revert recipe.
2. **BYO-AI: surface, attribute & review what your AI wrote** — the defining differentiator is the least-crafted surface. One calm "AI" chip + "new since" dot + a cross-space "review what your AI did" digest. Pure surfacing, no generation.
3. **Every empty state should teach the next action + the AI path** — branch true-zero from earned-empty, wire each `EmptyState.action`, append "Connect an AI →" while no key exists, add opt-in per-space seeders.
4. **Keyboard & command-palette parity** — full nav parity + recents + cross-space search + a `?` cheat-sheet + inline shortcut hints; route add-transaction/theme/language through the palette.
5. **Celebrate completion (delight + haptics)** — springy check, native/web haptics, milestones at 7/30/100, study session-summary, a cross-space "caught up" moment — all reduced-motion-gated and Scandinavian-calm.
6. **Dark-mode & design-token discipline** — promote `--warning/--success/--danger` + the radius scale to live tokens with light+dark; standardize focus-ring, type scale, icon ramp, overlay radius.
7. **Mobile & touch ergonomics** — bottom sheets, swipe rows, touch-fallback menus, responsive toaster, keyboard plugin, ≥44px targets, discoverable long-press.
8. **Accessibility safety net** — global focus-visible fallback, a polite live region (route through sonner) for optimistic/AI changes, ARIA on custom controls (calendar grid, segmented = tablist, drag = keyboard reorder), no color-only status.
9. **Honest loading, errors & first paint** — content-shaped skeletons, gated onboarding, `isError`+retry branches, a router error boundary, an offline banner, a no-flash theme script + branded first-paint shell.
10. **Locale, microcopy & metadata craft** — sweep CJK half-width commas, humanize errors, thread app-lang through every formatter, translate "pin"/"Failed", refresh title/manifest/OG to the six-space framing.

---

## E · Per-space highlights

**Global / Onboarding** — no first-run moment teaches the six-space + BYO-AI value or points to "Connect an AI"; Guide still says four spaces; empties dangle AI with no link; four spaces start dead-empty (no seeders). *Protect:* resume-last-route, per-space themed blob, token-based accent theming.

**Tempo** — task complete/delete is non-optimistic & unrecoverable while `HabitCheckButton` is the gold standard (refactor toward it); streaks are all-or-nothing daily-only (no weekly goal/repair/celebration); at-risk amber is excellent but breaks dark mode; quick-add drops all structure; raw ISO dates + ungrouped overdue hurt scanning.

**Memoria** — the flip screen has no flip, Again never re-surfaces, the end is just a checkmark; the graph is the magic surface but half-built (dead `[[ ]]` CSS, no backlinks/search/legend/filter, silent-error-as-empty); note list is an unnavigable `updated_at` stack. *Protect:* diff-aware autosave, FSRS hints, graph color/hit-area craft.

**Galleon** — net worth blind-sums currencies; deletes use `confirm()` (subscriptions: none at all); budgets lack remaining/over; split view never leads with a personal "you owe/are owed" hero; no Cmd-K path to the highest-frequency action (log a transaction); category picker is a native `select`, not an icon grid. *Protect:* `SplitExpenseDialog`.

**Health** — raw number lists can't answer "is my weight trending down?"; meds collapse doses + never show an overdue dose; `logged_at` time discarded; kg/lb ignored; AI entries unattributed. *Protect:* the calm reflect-card + module toggles — don't over-instrument.

**Kitchen** — no read-only cook mode (dropped into an edit form to cook; `description`/`image_url` stored but never shown); re-saving destroys structured qty; hover-only actions invisible on the phone you cook/shop with; shopping list doesn't dedupe or group by aisle. *Protect:* the bilingual AI-prompt-quoting empty states.

**Trips** — timeline carries no temporal meaning (no gap/overlap detection); raw ISO day dates; silent deletes; no day-index overview for long trips; lat/lng stored but no map; no collaborator presence on co-edit. *Protect:* the public `/s/$token` share page.

**Integrations / Landing** — activation dies in an uncertainty gap (no "Test connection"/live confirmation; copy snippets hover-only on the marketed phone); key revoke is one-tap/no-confirm/irreversible; the marketing site shows abstract art, never the real UI, and unfurls a blank OG. *Protect:* the live capability list + the add-only permission table.

---

## F · Patterns worth stealing (source → where to apply)

| Pattern | From | Apply to |
|---------|------|----------|
| Delete-then-Undo toast (instant, reversible, non-modal) | Gmail / Superhuman / Linear | Every destructive + completion action; reuse the sonner action toast already in `OtaUpdater` |
| Optimistic-with-reconcile toggle (`onMutate` write + rollback) | Linear | `useCompleteTask/useDeleteTask`, health/shopping/graph-link, trip reorder — copy `HabitCheckButton` verbatim |
| Source/actor badge on machine-written records + "new since" dot | Linear / Notion AI / GitHub bot | Every AI-writable row; reuse `FlashcardTile`'s pill as one shared component |
| Command palette = total nav parity + recents (MRU) + name-search deep-links | Linear / VS Code / Slack | `CommandPalette` over `SPACES` + per-space view arrays + `last-route.ts` |
| Bottom-sheet editor with grabber + safe-area pad | Things 3 / Apple Reminders / Vaul | A `sheet` variant on shared `DialogContent` (below `sm`) |
| Swipe-right-to-complete / swipe-left-to-delete with color reveal | TickTick / Things / Apple Mail | Reusable `SwipeRow` (motion drag-x); dropdown stays as desktop/keyboard fallback |
| Streak forgiveness: freeze + repair-yesterday grace window | Duolingo / TickTick | `HabitCard` "restore your N-day streak" (backdated RPC exists) |
| Weekly-target habit with a progress ring | TickTick / Streaks | `TaskDialog` habit section + `HabitCard` "N times/week" |
| Per-metric sparkline + delta vs prior reading | Apple Health / Daylio | Health Overview + Journal mood calendar (reuse HabitCard 14-day strip) |
| Read-first "Cook Mode" + serving scaling + wake-lock | Paprika / Mela | A `RecipeView` sheet; Edit behind a pencil; surface stored `description`/`image_url` |
| Inline NLP quick-entry with live highlighted token chips | TickTick / Todoist | `CaptureDialog` + Tempo quick-add; keep the BYO-AI inbox path for unparsed text |
| Connection-test / "we received your first request" activation | Stripe / Vercel | Integrations step 2 — poll `last_used_at` |
| Personal "you owe / you are owed" hero above the split roster | Splitwise | Galleon split view |
| Blocking inline no-flash theme script + branded `#root` first-paint shell | Linear / Vercel / GitHub / Notion | `index.html <head>` + `#root` |

---

## Sequencing suggestion

1. **Foundations that unblock everything** (do first): QW3 no-flash theme · QW5 reduced-motion · QW6 focus-visible · QW12 responsive toaster. Cheap, and they de-risk the motion/undo/celebration work.
2. **The undo+optimistic spine**: QW1 → QW2 → QW13 (celebrate) — turns the most-repeated actions delightful and safe in one arc; closes A8.
3. **Correctness sweep**: A1/A2/A7 (`S`) then A3/A4/A5/A6/A9–A12 alongside the relevant bets.
4. **Trust & locale polish**: QW7 dates · QW8 errors · QW10 AI chip · QW11 empties.
5. **Bets** as planned chunks, each behind its own PR.

*Regenerate this audit:* the workflow script is saved under the session's `workflows/scripts/` dir
(`mnema-uiux-polish-audit-*.js`) — re-run via `Workflow({scriptPath})`.
