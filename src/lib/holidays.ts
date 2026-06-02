import { useQuery } from '@tanstack/react-query'

/**
 * Public-holiday calendar (toggleable, like Google/Notion). Sourced from the
 * free Nager.Date API (browser-side, CORS-enabled), cached in localStorage so
 * it survives reloads/offline. Defaults to Taiwan. Returns a Map<date, name>.
 */
export interface Holiday {
  date: string
  name: string
}

const lsKey = (country: string, year: number) => `mnema-holidays-${country}-${year}`

async function fetchYear(year: number, country: string): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
  if (!res.ok) throw new Error(`holidays ${res.status}`)
  const data = (await res.json()) as Array<{ date: string; localName?: string; name?: string }>
  return data.map((h) => ({ date: h.date, name: h.localName || h.name || '' }))
}

export function useHolidays(years: number[], country = 'TW', enabled = true) {
  const key = years.slice().sort().join(',')
  return useQuery({
    queryKey: ['holidays', country, key],
    enabled: enabled && years.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const map = new Map<string, string>()
      await Promise.all(
        years.map(async (y) => {
          try {
            const list = await fetchYear(y, country)
            try {
              localStorage.setItem(lsKey(country, y), JSON.stringify(list))
            } catch {
              /* storage full / disabled — ignore */
            }
            for (const h of list) if (!map.has(h.date)) map.set(h.date, h.name)
          } catch {
            // Network/CORS failure → fall back to any cached copy.
            try {
              const cached = localStorage.getItem(lsKey(country, y))
              if (cached) for (const h of JSON.parse(cached) as Holiday[]) if (!map.has(h.date)) map.set(h.date, h.name)
            } catch {
              /* ignore */
            }
          }
        }),
      )
      return map
    },
  })
}
