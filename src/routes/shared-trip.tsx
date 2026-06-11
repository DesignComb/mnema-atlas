import { useEffect } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, CalendarRange, ExternalLink, Eye, MapPin } from 'lucide-react'
import { getSharedItinerary, type ItineraryItem } from '@/lib/api'
import { CATEGORY_META, categoryOf, fmtCost, fmtDateRange, fmtTimeRange, mapsUrl, safeHttps } from '@/lib/itinerary'
import { fmtDayDate } from '@/lib/tempo-date'
import { useI18n, useT } from '@/lib/i18n'

export function SharedTripScreen() {
  const { token } = useParams({ strict: false }) as { token: string }
  const t = useT()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared-trip', token],
    queryFn: () => getSharedItinerary(token),
    enabled: !!token,
    retry: false,
  })

  // The browser tab (and anything that reads the live DOM title) should carry
  // the trip's name, not the app default (A2).
  useEffect(() => {
    if (!data?.title) return
    const prev = document.title
    document.title = `${data.title} · Mnema`
    return () => {
      document.title = prev
    }
  }, [data?.title])

  return (
    <div className="theme-voyage min-h-dvh bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <BookOpenCheck className="size-4" />
          </span>
          <span className="font-serif text-[16px] font-semibold tracking-tight">Mnema</span>
        </Link>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Eye className="size-3" /> {t('View only', '唯讀檢視')}
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-8 w-2/3 animate-pulse rounded bg-card" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MapPin className="size-6" />
            </div>
            <h1 className="text-lg font-semibold">{t('Link not available', '連結無法使用')}</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t(
                'This share link is invalid, has expired, or was revoked by its owner.',
                '這個分享連結無效、已過期，或已被擁有者撤銷。',
              )}
            </p>
            <Link
              to="/"
              className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
            >
              {t('Go to Mnema', '前往 Mnema')}
            </Link>
          </div>
        ) : (
          <SharedTripBody data={data} t={t} />
        )}
      </main>

      {!isLoading && data ? (
        <footer className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
          <div className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-[13px] text-muted-foreground">
            {t('Planned with', '使用')}{' '}
            <Link to="/" className="font-medium text-brand hover:underline">
              Mnema
            </Link>{' '}
            {t('— plan and share your own trips.', '——規劃並分享你自己的行程。')}
          </div>
        </footer>
      ) : null}
    </div>
  )
}

type Tr = (en: string, zh: string) => string

function SharedTripBody({
  data,
  t,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getSharedItinerary>>>
  t: Tr
}) {
  const { lang } = useI18n()
  const dates = fmtDateRange(data.start_date, data.end_date)
  const subtitle = [data.destination, dates].filter(Boolean).join(' · ')
  const costEntries = Object.entries(data.cost_by_currency ?? {})

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{data.title}</h1>
        {subtitle ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {data.destination ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {data.destination}
              </span>
            ) : null}
            {dates ? (
              <span className="inline-flex items-center gap-1">
                <CalendarRange className="size-3.5" /> {dates}
              </span>
            ) : null}
          </p>
        ) : null}
        {data.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.notes}</p> : null}
      </div>

      {!data.hide_costs && costEntries.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t('Estimated cost', '預估花費')}
          </span>
          {costEntries.map(([cur, total]) => (
            <span key={cur} className="rounded-full bg-brand-muted px-2.5 py-0.5 text-sm font-medium text-brand">
              {fmtCost(total, cur === '?' ? null : cur)}
            </span>
          ))}
        </div>
      ) : null}

      {data.days.map((day, i) => (
        <section key={day.id} className="rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-muted text-[11px] font-semibold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {day.label || (day.day_date ? fmtDayDate(day.day_date, lang) : t(`Day ${i + 1}`, `第 ${i + 1} 天`))}
              </p>
              {day.label && day.day_date ? <p className="text-[11px] text-muted-foreground">{fmtDayDate(day.day_date, lang)}</p> : null}
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {day.items.length ? (
              day.items.map((item) => <SharedItem key={item.id} item={item} t={t} />)
            ) : (
              <p className="px-3 py-3 text-center text-[12.5px] text-muted-foreground/70">{t('No activities.', '沒有活動。')}</p>
            )}
          </div>
        </section>
      ))}

      {data.unscheduled.length ? (
        <section className="space-y-1.5">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{t('Unscheduled', '未排程')}</h2>
          <div className="rounded-xl border border-border bg-card shadow-soft divide-y divide-border/60">
            {data.unscheduled.map((item) => (
              <SharedItem key={item.id} item={item} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SharedItem({ item, t }: { item: ItineraryItem; t: Tr }) {
  const cat = CATEGORY_META[categoryOf(item.category)]
  const Icon = cat.icon
  const time = fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)
  const maps = mapsUrl(item.place, item.lat, item.lng)
  const booking = safeHttps(item.booking_url)
  const cost = fmtCost(item.cost, item.currency)

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 sm:px-4">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border ${cat.chip}`}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {time ? <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{time}</span> : null}
          <span className="text-sm font-medium">{item.title}</span>
          {cost ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{cost}</span>
          ) : null}
        </div>
        {item.transport_detail ? <p className="text-[12px] text-muted-foreground">{item.transport_detail}</p> : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-brand"
            >
              <MapPin className="size-3" /> {item.place || t('Map', '地圖')}
            </a>
          ) : item.place ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" /> {item.place}
            </span>
          ) : null}
          {booking ? (
            <a
              href={booking}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-brand"
            >
              <ExternalLink className="size-3" /> {t('Booking', '訂購')}
            </a>
          ) : null}
        </div>
        {item.notes ? <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{item.notes}</p> : null}
      </div>
    </div>
  )
}
