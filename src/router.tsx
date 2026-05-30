import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { AppLayout } from '@/components/app-shell/AppLayout'
import { LoginScreen } from '@/routes/login'
import { HomeScreen } from '@/routes/home'
import { NotesScreen } from '@/routes/notes'
import { NoteScreen } from '@/routes/note'
import { DeckScreen } from '@/routes/deck'
import { StudyScreen } from '@/routes/study'
import { GraphScreen } from '@/routes/graph'
import { ApiKeysScreen } from '@/routes/api-keys'
import { ConnectScreen } from '@/routes/connect'
import { ToolsScreen } from '@/routes/tools'
import { CardsScreen } from '@/routes/cards'
import { GuideScreen } from '@/routes/guide'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  async beforeLoad() {
    const { data } = await supabase.auth.getSession()
    if (data.session) throw redirect({ to: '/' })
  },
  component: LoginScreen,
})

/** Pathless layout route: everything under here requires a session. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  async beforeLoad({ location }) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AppLayout,
})

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: HomeScreen })
const notesRoute = createRoute({ getParentRoute: () => appRoute, path: 'notes', component: NotesScreen })
const noteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notes/$noteId',
  component: NoteScreen,
})
const deckRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'decks/$deckId',
  component: DeckScreen,
})
const studyRoute = createRoute({ getParentRoute: () => appRoute, path: 'study', component: StudyScreen })
const studyDeckRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'study/$deckId',
  component: StudyScreen,
})
const graphRoute = createRoute({ getParentRoute: () => appRoute, path: 'graph', component: GraphScreen })
const cardsRoute = createRoute({ getParentRoute: () => appRoute, path: 'cards', component: CardsScreen })
const guideRoute = createRoute({ getParentRoute: () => appRoute, path: 'guide', component: GuideScreen })
const apiKeysRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/keys',
  component: ApiKeysScreen,
})
const connectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/connect',
  component: ConnectScreen,
})
const toolsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/tools',
  component: ToolsScreen,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    homeRoute,
    notesRoute,
    noteRoute,
    deckRoute,
    studyRoute,
    studyDeckRoute,
    graphRoute,
    cardsRoute,
    guideRoute,
    apiKeysRoute,
    connectRoute,
    toolsRoute,
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
