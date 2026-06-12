/**
 * App.tsx — Root component with:
 * - AuthContext (JWT state management)
 * - React Router v6 route definitions
 * - Protected route guard
 * - React Query Provider
 */

import { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import type { AuthContextValue, User } from '@/types/auth';
import { authApi } from '@/api/auth';
import { tokenStorage } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { Loader } from '@/components/ui/Loader';

// ── Pages ─────────────────────────────────────────────────────────────────────
import { LoginPage }         from '@/pages/LoginPage';
import { SignupPage }        from '@/pages/SignupPage';
import { DashboardPage }     from '@/pages/DashboardPage';
import { PortfolioPage }     from '@/pages/PortfolioPage';
import { ProfilePage }       from '@/pages/ProfilePage';
import { TransactionsPage } from '@/pages/TransactionsPage';

// ── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Auth Context ──────────────────────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading]     = useState(true);
  const initialized                   = useRef(false);

  // On mount: try to restore session from stored token
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token = tokenStorage.get();
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .getMe()
      .then((me) => {
        setUser(me);
        setAccessToken(token);
      })
      .catch(() => {
        // Token invalid — clear it
        tokenStorage.clear();
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for force-logout events (triggered by 401 interceptor)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login({ email, password });
    tokenStorage.set(access_token);
    setAccessToken(access_token);
    const me = await authApi.getMe();
    setUser(me);
    queryClient.clear(); // Clear any stale cache from a previous session
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors — clear client state regardless
    } finally {
      tokenStorage.clear();
      setUser(null);
      setAccessToken(null);
      queryClient.clear();
    }
  }, []);

  const setTokenAndUser = useCallback((token: string, u: User) => {
    tokenStorage.set(token);
    setAccessToken(token);
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isAuthenticated: !!user, isLoading, login, logout, setTokenAndUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Protected Route ───────────────────────────────────────────────────────────
function ProtectedRoute() {
  const auth = useContext(AuthContext);
  if (!auth?.accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

// ── Public Route (redirect to dashboard if logged in) ─────────────────────────
function PublicRoute() {
  const auth = useContext(AuthContext);
  if (auth?.accessToken) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

// ── Stub pages for phase 2+ routes ───────────────────────────────────────────
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-white/50 text-sm">Coming in the next phase of development.</p>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function AppContent() {
  // Show loader while restoring session
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Give AuthProvider a tick to finish initializing
    const t = setTimeout(() => setLoading(false), 50);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" text="Loading Finance Copilot..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/portfolio"    element={<PortfolioPage />} />
          {/* Phase 3+ stubs */}
          <Route path="/networth"     element={<ComingSoon title="Net Worth" />} />
          <Route path="/goals"        element={<ComingSoon title="Goals" />} />
          <Route path="/analytics"    element={<ComingSoon title="Analytics" />} />
          <Route path="/ai-chat"      element={<ComingSoon title="AI Assistant" />} />
          <Route path="/import"       element={<ComingSoon title="Import" />} />
        </Route>
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
