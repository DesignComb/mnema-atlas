import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { getLastRoute } from '@/lib/last-route'
import { AppLayout } from '@/components/app-shell/AppLayout'
import { LandingScreen } from '@/routes/landing'
import { HomeScreen } from '@/routes/home'
import { NotesScreen } from '@/routes/notes'
import { DeckScreen } from '@/routes/deck'
import { CardsScreen } from '@/routes/cards'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

// Public landing at the root. Logged-in visitors go straight to the app.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  async beforeLoad() {
    const { data } = await supabase.auth.getSession()
    // Resume where the user last was (space + view); fall back to /today.
    if (data.session) throw redirect({ href: getLastRoute() ?? '/today' })
  },
  component: LandingScreen,
})

// Back-compat: /login now just forwards to the landing (the sign-in CTA lives there).
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

// Public marketing pages (no auth) — code-split so the landing stays lean.
const faqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/faq',
  component: lazyRouteComponent(() => import('@/routes/faq'), 'FaqScreen'),
})
const selfHostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/self-host',
  component: lazyRouteComponent(() => import('@/routes/self-host'), 'SelfHostScreen'),
})

// Public, no-auth route: anyone with a share token can view a trip read-only.
const sharedTripRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 's/$token',
  component: lazyRouteComponent(() => import('@/routes/shared-trip'), 'SharedTripScreen'),
})

/** Pathless layout route: everything under here requires a session. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  async beforeLoad() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw redirect({ to: '/' })
    }
  },
  component: AppLayout,
})

// Light, common screens stay eager; heavy/rare leaves are code-split so a new
// user who only sees "/" doesn't download TipTap, force-graph, or motion.
const homeRoute = createRoute({ getParentRoute: () => appRoute, path: 'today', component: HomeScreen })
const notesRoute = createRoute({ getParentRoute: () => appRoute, path: 'notes', component: NotesScreen })
const deckRoute = createRoute({ getParentRoute: () => appRoute, path: 'decks/$deckId', component: DeckScreen })
const cardsRoute = createRoute({ getParentRoute: () => appRoute, path: 'cards', component: CardsScreen })
const tripsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'trips',
  component: lazyRouteComponent(() => import('@/routes/trips'), 'TripsScreen'),
})
const tripRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'trips/$tripId',
  // ?tab=… selects the trip section (driven from the sidebar on desktop).
  validateSearch: (search: Record<string, unknown>): { tab?: 'itinerary' | 'bookings' | 'budget' | 'packing' } => {
    const tab = search.tab
    return {
      tab: tab === 'bookings' || tab === 'budget' || tab === 'packing' || tab === 'itinerary' ? tab : undefined,
    }
  },
  component: lazyRouteComponent(() => import('@/routes/trip'), 'TripScreen'),
})
const tempoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'tempo',
  // ?view=… selects the Tempo view; ?list=… focuses a single list.
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: 'today' | 'upcoming' | 'all' | 'calendar' | 'habits' | 'capture'; list?: string; new?: 'list'; capture?: string } => {
    const view = search.view
    const ok =
      view === 'today' || view === 'upcoming' || view === 'all' || view === 'calendar' || view === 'habits' || view === 'capture'
    return {
      view: ok ? (view as 'today' | 'upcoming' | 'all' | 'calendar' | 'habits' | 'capture') : undefined,
      list: typeof search.list === 'string' && search.list ? search.list : undefined,
      new: search.new === 'list' ? 'list' : undefined,
      capture: typeof search.capture === 'string' && search.capture ? search.capture : undefined,
    }
  },
  component: lazyRouteComponent(() => import('@/routes/tempo'), 'TempoScreen'),
})
const galleonRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'galleon',
  // `section` (not `view`) so it never collides with Tempo's `view` search param.
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: 'overview' | 'transactions' | 'accounts' | 'budgets' | 'reports' | 'split'; ledger?: string } => {
    const s = search.section
    const ok = s === 'overview' || s === 'transactions' || s === 'accounts' || s === 'budgets' || s === 'reports' || s === 'split'
    return {
      section: ok ? (s as 'overview' | 'transactions' | 'accounts' | 'budgets' | 'reports' | 'split') : undefined,
      ledger: typeof search.ledger === 'string' && search.ledger ? search.ledger : undefined,
    }
  },
  component: lazyRouteComponent(() => import('@/routes/galleon'), 'GalleonScreen'),
})
const noteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notes/$noteId',
  component: lazyRouteComponent(() => import('@/routes/note'), 'NoteScreen'),
})
const studyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'study',
  // ?tag=… lets you review one tag across all decks.
  validateSearch: (search: Record<string, unknown>): { tag?: string } => ({
    tag: typeof search.tag === 'string' && search.tag ? search.tag : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/study'), 'StudyScreen'),
})
const studyDeckRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'study/$deckId',
  component: lazyRouteComponent(() => import('@/routes/study'), 'StudyScreen'),
})
const graphRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'graph',
  component: lazyRouteComponent(() => import('@/routes/graph'), 'GraphScreen'),
})
const guideRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'guide',
  component: lazyRouteComponent(() => import('@/routes/guide'), 'GuideScreen'),
})
const integrationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/integrations',
  component: lazyRouteComponent(() => import('@/routes/integrations'), 'IntegrationsScreen'),
})

// Back-compat: the old split settings pages now redirect into the merged one.
const redirectToIntegrations = (path: string) =>
  createRoute({
    getParentRoute: () => appRoute,
    path,
    beforeLoad: () => {
      throw redirect({ to: '/settings/integrations' })
    },
  })
const keysRedirect = redirectToIntegrations('settings/keys')
const connectRedirect = redirectToIntegrations('settings/connect')
const toolsRedirect = redirectToIntegrations('settings/tools')

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  faqRoute,
  selfHostRoute,
  sharedTripRoute,
  appRoute.addChildren([
    homeRoute,
    notesRoute,
    noteRoute,
    deckRoute,
    cardsRoute,
    tripsRoute,
    tripRoute,
    tempoRoute,
    galleonRoute,
    studyRoute,
    studyDeckRoute,
    graphRoute,
    guideRoute,
    integrationsRoute,
    keysRedirect,
    connectRedirect,
    toolsRedirect,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Honour the GitHub Pages sub-path (Vite injects BASE_URL from `base`).
  basepath: import.meta.env.BASE_URL,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
