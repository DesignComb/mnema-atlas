import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarRange, MapPin, Plus, Sparkles, Map as MapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateTripBulk, useItineraries } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { TripDialog } from '@/components/trips/TripDialog'
import { Button } from '@/components/ui/button'
import { fmtDateRange } from '@/lib/itinerary'
import { useT } from '@/lib/i18n'
import type { CreateTripBulkInput } from '@shared/schemas'

// A tiny demo trip — also exercises the whole-trip bulk path end-to-end.
const SAMPLE_TRIP: CreateTripBulkInput = {
  title: 'Kyoto sampler',
  destination: 'Kyoto, Japan',
  timezone: 'Asia/Tokyo',
  default_currency: 'JPY',
  days: [
    {
      label: 'Arrival',
      items: [
        { title: 'Check in hotel', category: 'lodging', place: 'Kyoto Station', start_time: '15:00' },
        { title: 'Dinner at Nishiki Market', category: 'food', place: 'Nishiki Market', start_time: '19:00' },
      ],
    },
    {
      label: 'East Kyoto',
      items: [
        { title: 'Kiyomizu-dera', category: 'sight', place: 'Kiyomizu-dera', start_time: '09:00' },
        { title: 'Train to Arashiyama', category: 'transport', transport_mode: 'train', start_time: '13:00' },
      ],
    },
  ],
}

export function TripsScreen() {
  const { data: trips, isLoading } = useItineraries()
  const { user } = useAuth()
  const createSample = useCreateTripBulk()
  const navigate = useNavigate()
  const t = useT()
  const [dialogOpen, setDialogOpen] = useState(false)

  async function addSample() {
    try {
      const tree = await createSample.mutateAsync(SAMPLE_TRIP)
      toast.success(t('Sample trip added', '已加入範例行程'))
      navigate({ to: '/trips/$tripId', params: { tripId: tree.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to add sample trip', '加入範例行程失敗'))
    }
  }

  const isEmpty = (trips?.length ?? 0) === 0

  return (
    <>
      <PageHeader
        title={t('Trips', '行程')}
        subtitle={trips ? t(`${trips.length} trip${trips.length === 1 ? '' : 's'}`, `${trips.length} 個行程`) : undefined}
        icon={<MapIcon className="size-4" />}
        actions={
          <Button variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> <span className="hidden sm:inline">{t('New trip', '新增行程')}</span>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-2.5 px-4 py-4 sm:px-6 sm:py-6">
          {isLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          ) : isEmpty ? (
            <EmptyState
              icon={<MapIcon className="size-6" />}
              title={t('No trips yet', '還沒有行程')}
              description={t(
                'Plan a trip day-by-day, or let a connected AI draft a whole itinerary for you.',
                '一天一天規劃你的旅程，或讓連接的 AI 幫你草擬整份行程。',
              )}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="size-4" /> {t('New trip', '新增行程')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={addSample} disabled={createSample.isPending}>
                    <Sparkles className="size-4" /> {t('Add a sample trip', '加入範例行程')}
                  </Button>
                </div>
              }
            />
          ) : (
            trips!.map((trip) => {
              const dates = fmtDateRange(trip.start_date, trip.end_date)
              return (
                <Link
                  key={trip.id}
                  to="/trips/$tripId"
                  params={{ tripId: trip.id }}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft transition hover:border-brand/40 hover:shadow-pop"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
                    <MapIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{trip.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {trip.destination ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {trip.destination}
                        </span>
                      ) : null}
                      {dates ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarRange className="size-3" /> {dates}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {user && trip.owner_id !== user.id ? (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t('Shared', '共享')}
                    </span>
                  ) : null}
                </Link>
              )
            })
          )}
        </div>
      </div>
      <TripDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
