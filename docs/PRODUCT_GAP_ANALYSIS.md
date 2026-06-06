# Mnema — Product Gap Analysis & UX Audit (2026-06-06)

Benchmarks: **Notes→Notion**, **Habits/Tasks→TickTick**, **Money→YNAB/MoneyWiz/麻布記帳/CWMoney/Splitwise**, **Travel→Wanderlog/TripIt/Klook/Google**.

## The lens — "your AI fills it; you don't type forms"
Every competitor's core friction is manual data entry. Mnema's wedge is a connected BYO-AI that creates and organises across all four spaces. So each competitor feature lands in one of three buckets:

- 🟢 **AI-win** — tedious manual entry our AI already replaces (or trivially could). Lean in.
- 🟡 **Build** — a real feature we lack; once built, our AI fills it → the *killer* version.
- 🔵 **Moat** — a data/integration AI can't fake (bank links, 電子發票載具, place DBs/maps, email inbox-sync, native OS widgets, offline, real-time collab). Decide: build / partner / position around.

---

## 1 · Atlas (Study) vs Notion (+ the Anki/Obsidian angle)
**We already beat Notion at:** native FSRS spaced repetition, a real force-directed knowledge graph, byte-faithful markdown, BYO-AI bulk authoring, a captures inbox + PWA share-target. *Notion has no native flashcards* — "Notion **+** Anki, filled by your AI" is a real position.

| Notion signature | Mnema today | Bucket | Move |
|---|---|---|---|
| Block editor + slash menu | markdown textarea + preview | 🟡 | low priority — the AI writes the body anyway |
| **Databases × multi-view** (table/board/calendar/gallery) | notes list + decks + tags | 🔵 | biggest *structural* gap; consider light "views over notes" |
| Typed properties + AI Autofill | tags (`text[]`) only | 🟢 | AI auto-structures/tags on create — surface it |
| Relations / rollups / formulas | typed `note_links` graph | 🟡 | graph ≈ relations; rollups/formulas N/A for study |
| Templates | none | 🟢 | AI generates from a prompt instead of templates |
| Web clipper (extension + share sheet) | captures + PWA share-target | 🟢/🔵 | share path ✔; a browser extension is the only gap |
| Media in pages (img/PDF/video) | text-only | 🔵 | real gap — esp. **image flashcards** |
| Real-time collab | none (study is solo) | 🔵 | low priority for personal study |

**On-thesis builds:** note → flashcards ("turn this note into cards" via the connected AI), **screenshot/PDF → cards** (multimodal OCR via the user's AI), AI auto-tag, AI-*suggested* graph links (inferred backlinks). **Platform gaps:** media attachments, `[[wikilink]]` + auto-backlinks, a light multi-view over notes.

---

## 2 · Tempo (Tasks/Habits) vs TickTick
**Have:** habits + streaks + per-habit `reset_time`, RRULE recurrence, push reminders, calendar/time-block, captures + share-target, and (just shipped) optimistic, **undoable** check-in.

### Habits (your current focus)
| TickTick | Mnema | Bucket | Move |
|---|---|---|---|
| Binary **+ amount** goals (drink ×8, run 5k) + Auto/Manual/Complete-all | binary check-in only | 🟡 | add amount/target habits |
| **Back-fill a missed day** (tap a past date) | today only | 🟡 | **easy, high value** — tap a heat-strip cell to check a past day |
| Per-check-in **note + mood** journal | `check_in` already takes `p_note` (no UI) | 🟢🟡 | surface the existing note field + a mood |
| Yearly GitHub heatmap + heatmap **widget** | 14-day strip | 🟡/🔵 | longer heatmap; OS widget = moat (see §Moats) |
| Per-habit reminders | task reminders only | 🟡 | habit reminders (push infra already exists) |

### Tasks
NL quick-add / smart-date ("買菜 明天 !3") 🟢 (AI does it; in-app parse is a UX baseline) · kanban/board 🟡 · sub-subtasks & dependencies 🟡 · drag reorder 🟡 · Pomodoro 🔵 · 2-way Google Calendar sync 🔵 · native OS widget 🔵 (bridge today via the REST one-tap recipe).

---

## 3 · Galleon (Money) vs YNAB / MoneyWiz / 麻布記帳 / CWMoney / Splitwise
**Have (genuinely strong):** ledgers/accounts/budgets, recurring templates, **Splitwise-level paid/owed splits + greedy settle-up**, multi-currency at creation, categories, reports/trends.

| Competitor signature | Mnema | Bucket | Move |
|---|---|---|---|
| 🇹🇼 **電子發票 / 手機條碼載具 auto-記帳 + 對獎** (CWMoney/麻布 via 財政部 API) | manual / AI entry | 🔵🔵 | **THE Taiwan killer.** AI can't fake it. Decide: integrate the MOF e-invoice API, or position as the brain *on top* |
| Open-Banking bank sync (麻布 30+ TW banks; YNAB Plaid) | none | 🔵 | data moat; big build/partner |
| Receipt **OCR → line items** (Splitwise/CWMoney) | `receipt_url` field, no upload/OCR | 🟢/🔵 | AI-bridge: photo → your AI → split; native OCR+storage is the gap |
| Zero-based/envelope budgeting + rollover (YNAB) | category budgets; `rollover` field unwired | 🟡 | wire rollover logic |
| Recurring **bill reminders** | templates stored, no push | 🟡 | wire push (infra exists) |
| CSV/PDF export, reconcile | none | 🟡 | export is easy + expected |
| Splitwise "simplify debts" + multi-currency settle | greedy settle-up ✔ | 🟢 | near-parity; add multi-currency settle |

**Strategic call:** in TW the 載具/bank-sync moat is decisive for *everyday* 記帳. Either invest in the MOF 電子發票 integration (a real moat), or honestly position Galleon as the **"AI + splitting + budget brain"** for the cash / split-the-dinner / forecast cases, layered above auto-記帳.

---

## 4 · Voyage (Travel) vs Wanderlog / TripIt / Klook / Google
**Have:** trips→days→items, bookings, packing, lat/lng, public share link, collaborator co-edit, and **AI whole-trip drafting** (`create_trip_bulk` — literally Gemini Canvas's pitch, via *your* AI).

| Competitor signature | Mnema | Bucket | Move |
|---|---|---|---|
| **Email auto-import** of bookings (TripIt/Wanderlog) | none | 🟢/🔵 | AI-bridge: paste/forward a confirmation → AI adds it; native inbox-sync is the moat |
| Place/POI **cards** (photos/reviews/hours) — Google Places | lat/lng only | 🔵 | biggest *data* gap |
| **Map view + route optimiser** | list-only (no map) | 🔵 | **biggest UX gap** — Wanderlog is map-first |
| AI itinerary generation (Gemini Canvas) | `create_trip_bulk` via BYO-AI | 🟢 | we already do this — surface it louder |
| Per-trip budget + split | none (Galleon separate) | 🟡 | link trips ↔ a Galleon ledger |
| Offline maps/vouchers, flight tracking, bookable inventory | none | 🔵 | platform/partner |

---

## Cross-cutting — the AI-replaces-entry shortlist (highest ROI, dead on-thesis)
Turn "the AI *could* do it" into "one tap inside the app asks your AI to do it":
1. **Note → flashcards** + **screenshot/PDF → cards** (Atlas, multimodal).
2. **Receipt photo → transaction/split** (Galleon).
3. **Booking email/paste → trip item** (Voyage).
4. **In-app NL date parse** for tasks/habits (Tempo) — or keep leaning on the AI.
5. **Generalise Captures** into a universal "throw anything in → AI files it into the right space" — already started; make it the front door.
6. **AI auto-tag + AI-suggested links** (Atlas graph).

## Data moats AI can't fake (decide build / partner / position)
🇹🇼 **電子發票/手機條碼載具** (財政部 API) — decisive for TW 記帳 · Open-Banking bank sync · **map + place/POI data** (travel) · email inbox-sync · **native OS widgets** (bridgeable today via REST one-tap; native via a small TWA+widget) · offline-first · real-time CRDT collab.

## UX/polish gaps (cross-space)
Bulk-edit & multi-select (all spaces) · drag-and-drop reorder · CSV/ICS export · media attachments · calendar sync · OS widgets · offline.

---

## Navigation redesign — "make switching 4 spaces simpler"
**Today:** the four spaces hide inside a dropdown (`Mnema Atlas ▾`) in the sidebar → 2 taps on desktop, ~3 on mobile (drawer → dropdown → pick), and a new user can't even *see* the other three spaces exist.

**Proposed:** a persistent **space rail** — always visible, 1 tap, and it scales as spaces grow.

```
DESKTOP                                  MOBILE
┌──┬───────────────┬──────────────┐      ┌─────────────────────────┐
│▣ │ Today         │              │      │  (content)              │
│◇ │ Decks         │   content    │      │                         │
│◷ │ Graph         │              │      ├─────────────────────────┤
│$ │ ...           │              │      │  ▣    ◇    ◷    $        │ ← bottom tabs
└──┴───────────────┴──────────────┘      │ Study Trip Tempo Money   │
 ↑ space rail (active = space hue)       └─────────────────────────┘
```

Plus a **global, space-agnostic Capture/Ask** button: because the AI decides where things go, you usually shouldn't have to pick a space to *add* something — capture once, the AI files it. This reframes nav from "4 separate apps you switch between" → **"one home, four lenses, and a global front door."**

(Lighter fallback if a full rail is too much: replace the dropdown with an always-visible 4-pill segmented switcher in the sidebar header — still 1 tap, still discoverable.)
