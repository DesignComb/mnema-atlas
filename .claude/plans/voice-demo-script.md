# Mnema Voice — demo video voiceover scripts

For the OpenAI Build Week submission. Bracketed lines are stage directions — do NOT feed them to the TTS. Numbers are spelled out so the AI voice reads them naturally.

---

## 60‑second cut (~150 words)

**[0:00–0:08 — app home]**
This is Mnema — a bilingual life OS for your study, travel, tasks, and money. Its whole idea is "bring your own AI." So with Codex and GPT‑5.6, I gave it a voice.

**[0:08–0:22 — Codex footage]**
Codex read the project and wrote a new assistant endpoint. The trick: Mnema already exposes one hundred and fifty‑eight tools from one registry — Codex turned them straight into GPT‑5.6 function calls. No new logic.

**[0:22–0:48 — live voice demo, one take]**
Now watch. One messy request:
[speak to the app]
"Add a Tokyo trip from March fourteenth to the eighteenth, remind me to book the flights ten days before, and log that I had curry rice for lunch."
[pause as UI updates]
GPT‑5.6 split it into the right actions across three Spaces — Travel, Tempo, and Health. One sentence, zero forms.

**[0:48–1:00 — close]**
Each entry is byte‑for‑byte identical to content added by hand — same secured write path. Your life, your AI, one voice. Built with Codex and GPT‑5.6.

---

## Full 3‑minute version (~400 words)

**[0:00–0:15 — Hook / app home screen]**
Meet Mnema — a bilingual life OS that keeps your study, travel, tasks, money, and health in one place. Its whole philosophy is "bring your own AI." So for OpenAI Build Week, I used Codex and GPT‑5.6 to give it a voice — you can now just *talk* to your life.

**[0:15–1:00 — Codex development footage]**
Here's Codex building it. I pointed it at the project and it read the architecture, then wrote a new assistant endpoint from scratch. The clever part: Mnema already exposes one hundred and fifty‑eight tools from a single registry. Codex reused that registry directly — converting every tool into a GPT‑5.6 function‑calling schema. No new database code, no duplicated logic. GPT‑5.6 simply gets the same tools the app already trusts.

**[1:00–2:30 — Live voice demo, one take]**
Now watch it run. I'll say one messy, real‑world request — the kind you'd never fill out three separate forms for.
[speak to the app]
"Add a Tokyo trip from March fourteenth to the eighteenth, remind me to book the flights ten days before, and log that I had curry rice for lunch."
[pause as UI updates]
And there it is. GPT‑5.6 understood the whole sentence, split it into the right actions, and called three different tools across three different Spaces. A trip appears in Travel, dated March fourteenth to the eighteenth. A reminder to book the flights lands in Tasks — ten days out, and it did the date math itself. And the curry rice shows up in my Health log. One sentence, three Spaces, zero forms.

**[2:30–2:55 — Close / architecture payoff]**
And here's what makes it honest: the content voice just created is byte‑for‑byte identical to content I'd add by hand — because the app, the API, and GPT‑5.6 all write through the exact same secured database function. Your AI isn't a black box bolted on top. It's a first‑class citizen of your data. That's Mnema — your life, your AI, one voice. Built with Codex and GPT‑5.6.

---

## Production notes
- **60s cut** reads at ~1:00 at a natural pace. If your TTS runs fast, add a beat of silence at each scene break.
- Record the spoken command ("Add a Tokyo trip from March fourteenth…") in **your own voice**, live, so it matches the on‑screen mic interaction; let the AI voice narrate around it.
- **Verified live behavior** (2026‑07‑21): this command makes GPT‑5.6 call `create_itinerary` (Travel), `create_task` (Tempo reminder), and `log_health` meal (Health) — three Spaces. Money‑ledger logging is intentionally NOT used (the assistant has no read tools to resolve a ledger id), so the lunch lands in Health as a meal — hence "Health log", not "money ledger".
- **Dates roll forward**: since March 2026 is already past, the model resolves "March 14–18" to the next future year (2027) and sets the reminder to 2027‑03‑04. That's correct; just don't be surprised the trip shows 2027 on screen. Do a dry run before recording to confirm what appears.
- Swap in whatever trip/dates you like; keep the on‑screen result matching what the voice says.
- Video must be **public on YouTube**. In the description, include: category (Apps for Your Life), repo link, and note it uses Codex + GPT‑5.6.
- Don't forget the **`/feedback` Codex Session ID** in the Devpost submission.
