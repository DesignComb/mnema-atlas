# Mnema — UI guidelines

A short, enforceable style guide so the app feels like one product. Theme:
**Notion-style minimalist** — warm paper background, soft ink text, whisper-thin
borders, one calm editorial blue accent. Tokens are OKLCH (see `src/index.css`).

## 1. Colour — use semantic tokens, never raw colours

Always use the semantic utilities (they adapt to light/dark automatically). Do
**not** hardcode `gray-500`, `#fff`, etc. except for fixed category accents.

| Use for | Class |
| --- | --- |
| Page background | `bg-background` |
| Card / surface | `bg-card` · `border-border` · `shadow-soft` |
| Primary text | `text-foreground` |
| Secondary text | `text-muted-foreground` |
| Accent / active / links | `text-brand` · `bg-brand` · `bg-brand-muted` |
| Hover wash | `hover:bg-accent` (or `hover:bg-sidebar-accent` in the rail) |
| Destructive | `text-destructive` · `bg-destructive` |
| Inputs | `border-input` · focus `focus-visible:ring-2 focus-visible:ring-ring/40` |

Radius: `rounded-md` (controls), `rounded-xl` (cards), `rounded-full` (pills/chips).
Shadows: `shadow-soft` (resting cards), `shadow-pop` (raised/hover).
Fonts: `font-sans` (UI), `font-serif` (headings & long-form body), `font-mono`
(times/numbers, with `tabular-nums`).

## 2. Layout

- Screen = `<PageHeader title subtitle actions icon />` then a scroll region:
  `<div className="flex-1 overflow-y-auto"><div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">…`.
- Full-height app uses `h-dvh`; the sidebar is persistent at `lg:` and a slide-in
  drawer below it.
- Empty states use `<EmptyState icon title description action />`.

## 3. Components — reuse, don't reinvent

- **Button** (`ui/button`): `variant="brand" | "outline" | "ghost"`, `size="sm" | "lg"`.
  Brand = primary action; outline = secondary; ghost = tertiary/icon.
- **Input / Textarea / Label** (`ui/*`) for all form fields, in a
  `flex flex-col gap-1.5` group with a `<Label htmlFor>`.
- **Select** (`ui/select`) for every dropdown — a styled native `<select>` with a
  chevron. **Never** render a bare `<select>` (inconsistent look, no chevron).
- **Dialog** (`ui/dialog`): controlled `open`/`onOpenChange`; create/edit dialogs
  follow `NewDeckDialog` — submit calls a mutation, `toast.success/error`, then
  `onOpenChange(false)`. Long dialogs: `max-h-[90dvh] overflow-y-auto`.
- **DropdownMenu** (`ui/dropdown-menu`) for menus (e.g. the space switcher, user
  menu). Don't roll your own popover.
- Chips/badges: `rounded-full border px-2.5 py-0.5 text-[11px]`.

## 4. Interaction & affordances

- **Cursor**: every clickable is a `<button>`, `<a>`, `Link`, or has
  `role="button"`. `src/index.css` restores `cursor: pointer` on these app-wide
  (Tailwind v4 dropped the default) and sets `not-allowed` on `:disabled`. So just
  use real interactive elements — don't add `cursor-pointer` ad hoc, and never make
  a clickable `<div>` without `role="button"`.
- **Focus**: keep the `focus-visible:ring-2 focus-visible:ring-ring/40` ring on
  custom controls (Input/Select already have it). Don't remove outlines.
- **Hover**: subtle — `hover:bg-accent` / `hover:text-foreground` / `hover:border-brand/40`.
- **Disabled**: `disabled:opacity-50`; disable the submit button while a mutation
  `isPending`.
- **Tabs / section nav**: underline style (`-mb-px border-b-2`, active = `border-brand`)
  over a bottom `border-border`. Avoid the heavy muted-box segmented control.

## 5. Density & spacing

- Form field gap `gap-1.5`; field groups `gap-3`–`gap-4`; sections `space-y-4`.
- List rows: `rounded-xl border border-border bg-card px-4 py-3 shadow-soft` with a
  leading icon, truncated title, trailing meta.
- Icon sizes: `size-4` inline, `size-3.5` in dense toolbars, `size-5`/`size-6` for
  feature/empty-state icons.

## 6. Bilingual text

Every user-facing string is `t('English', '繁體中文')` from `useT()` — no key
catalog, write both inline. Sidebar nav items carry separate `label`/`zh`.

## 7. Don't

- ❌ Raw hex/`gray-*` colours, bare `<select>`, clickable `<div>` without role,
  removing focus rings, hardcoded widths that break mobile (`max-w`, `truncate`,
  `min-w-0` instead), or new one-off shadows/radii outside the tokens above.
