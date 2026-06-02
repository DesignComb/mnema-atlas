import { useQuery } from '@tanstack/react-query'
import { WORKER_BASE } from './endpoints'
import { TW_HOLIDAYS } from './tw-holidays'

/**
 * Public-holiday calendar (toggleable, like Google/Notion). Taiwan is baked in
 * (tw-holidays.ts) since the Nager.Date API has no TW data; other countries are
 * fetched through our worker proxy (`/holidays/:country/:year`) to dodge CORS.
 * Returns a Map<date, name>.
 */
export function useHolidays(years: number[], country = 'TW', enabled = true) {
  return useQuery({
    queryKey: ['holidays', country, years.slice().sort().join(',')],
    enabled: enabled && years.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const map = new Map<string, string>()
      if (country === 'TW') {
        for (const y of years) {
          const yr = TW_HOLIDAYS[y]
          if (yr) for (const d of Object.keys(yr)) map.set(d, yr[d])
        }
        return map
      }
      await Promise.all(
        years.map(async (y) => {
          try {
            const res = await fetch(`${WORKER_BASE}/holidays/${country}/${y}`)
            if (!res.ok) return
            const list = (await res.json()) as Array<{ date: string; name: string }>
            for (const h of list) if (!map.has(h.date)) map.set(h.date, h.name)
          } catch {
            /* offline / blocked — just show no holidays */
          }
        }),
      )
      return map
    },
  })
}
