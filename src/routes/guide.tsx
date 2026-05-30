import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell/PageHeader'

export function GuideScreen() {
  return (
    <>
      <PageHeader title="How Mnema works" subtitle="A 2-minute guide" icon={<BookOpenCheck className="size-4" />} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-9 px-6 py-8">
          {/* The idea */}
          <section className="space-y-2">
            <h2 className="font-serif text-xl text-foreground">The idea</h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Capture study notes, turn them into flashcards, and review a few each day — spaced repetition
              makes them stick for the long term. You can even let an AI fill your library for you.
            </p>
          </section>

          {/* Daily loop */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl text-foreground">Your daily loop</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Step icon={<FileText />} title="1 · Capture" body="Write a note, or paste something you want to remember." />
              <Step icon={<Layers />} title="2 · Make cards" body="Turn a note into flashcards — a question and its answer." />
              <Step icon={<GraduationCap />} title="3 · Review" body="Open Study and review what's due. We schedule the rest for you." />
              <Step icon={<Share2 />} title="See connections" body="The Graph shows how your notes link together." />
            </div>
          </section>

          {/* AI */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              <h2 className="font-serif text-xl text-foreground">Let an AI fill your library</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Already chatting with ChatGPT, Claude, or another AI? You can have it drop notes and flashcards
              straight into Mnema, so you never have to type them yourself.
            </p>

            <div className="rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <KeyRound className="size-3.5 text-brand" /> What's an "API key"?
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Think of it as a <strong className="text-foreground">guest pass</strong> you hand your AI. With it, the AI can{' '}
                <strong className="text-foreground">only add</strong> notes &amp; flashcards to <em>your</em> library — it can
                never edit or delete your things, and never touch anyone else's.
              </p>
            </div>

            <ol className="space-y-2.5 text-[14px] leading-relaxed text-foreground">
              <li>
                <Num>1</Num> Go to{' '}
                <Link to="/settings/keys" className="font-medium text-brand hover:underline">Settings → API keys</Link>, click{' '}
                <strong>Create</strong>, and copy the key (it looks like <code className="rounded bg-muted px-1 text-[12px]">mk_…</code>). Keep it private.
              </li>
              <li>
                <Num>2</Num> Go to{' '}
                <Link to="/settings/connect" className="font-medium text-brand hover:underline">Connect an AI</Link>, pick the
                assistant you use, and follow the one-line setup (paste your key where it asks).
              </li>
              <li>
                <Num>3</Num> Back in your AI, just say <em>"save this as flashcards in Mnema."</em> They appear here instantly.
              </li>
            </ol>

            <div className="rounded-xl border border-dashed border-border p-3.5 text-[13px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Using plain ChatGPT or Gemini (no setup)?</strong> Press{' '}
              <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">⌘I</kbd> for{' '}
              <strong className="text-foreground">Import from AI</strong>: copy the prompt, paste it to your AI, then paste its
              answer back here — it builds everything for you.
            </div>
          </section>

          {/* Safety */}
          <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Is it safe?</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Yes. Keys are <strong className="text-foreground">add-only</strong> by default — an AI can only add to your
                library, never change or delete it, and never see anyone else's. You can revoke a key anytime in{' '}
                <Link to="/settings/keys" className="text-brand hover:underline">Settings → API keys</Link>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-brand [&_svg]:size-4">{icon}</span>
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Num({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full bg-brand-muted text-[11px] font-semibold text-brand">
      {children}
    </span>
  )
}
