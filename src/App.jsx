import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/auth'
import { isSupabaseConfigured } from './lib/supabase'
import SetupNotice from './pages/SetupNotice'
import SignInGate from './pages/SignInGate'
import Lobbies from './pages/Lobbies'
import JoinLobby from './pages/JoinLobby'
import LobbyFeed from './pages/LobbyFeed'
import BetDetail from './pages/BetDetail'
import LobbyManage from './pages/LobbyManage'
import { Spinner } from './components/ui'

// The big-screen view is opened once, on a laptop. Keeping it out of the
// initial bundle means guests' phones never download it.
const LobbyDashboard = lazy(() => import('./pages/LobbyDashboard'))

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <Spinner />
    </div>
  )
}

/**
 * Renders the sign-in screen *in place* rather than redirecting, so the URL is
 * still the page the guest wanted. Google sends them back to that same URL and
 * they land exactly where they were headed.
 */
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!user) return <SignInGate />
  return children
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  return user ? <Lobbies /> : <SignInGate />
}

function Routing() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join/:code" element={<JoinLobby />} />
      <Route
        path="/lobby/:lobbyId"
        element={
          <RequireAuth>
            <LobbyFeed />
          </RequireAuth>
        }
      />
      <Route
        path="/lobby/:lobbyId/bet/:betId"
        element={
          <RequireAuth>
            <BetDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/lobby/:lobbyId/dashboard"
        element={
          <RequireAuth>
            <Suspense fallback={<FullScreenSpinner />}>
              <LobbyDashboard />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/lobby/:lobbyId/manage"
        element={
          <RequireAuth>
            <LobbyManage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routing />
      </AuthProvider>
    </BrowserRouter>
  )
}
