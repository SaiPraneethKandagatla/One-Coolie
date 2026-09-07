import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';

import { useContext, lazy, Suspense } from 'react';

import { AuthContext } from './context/AuthContext';

import OfflineBanner from './components/OfflineBanner';
import TrainLoader from './components/TrainLoader';

// Lazy-loaded routes for code-splitting & optimal bundle performance (Phase 7)
const HomePage = lazy(() => import('./pages/HomePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const PassengerDashboard = lazy(() => import('./pages/PassengerDashboard'));
const AssistantDashboard = lazy(() => import('./pages/AssistantDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BookingLive = lazy(() => import('./pages/BookingLive'));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage'));

function ProtectedRoute({
  children,
  allowedRoles
}) {
  const {
    user,
    authLoading
  } = useContext(AuthContext);
  const location = useLocation();

  // Wait until localStorage authentication is restored
  if (authLoading) {
    return (
      <TrainLoader
        text="Loading OneCoolie..."
        subtext="Verifying security credentials & station telemetry..."
      />
    );
  }

  // Not logged in
  if (!user) {
    if (allowedRoles.includes('admin')) {
      return <Navigate to={`/admin-auth${location.search}`} replace />;
    }

    if (allowedRoles.includes('assistant')) {
      return <Navigate to={`/assistant-auth${location.search}`} replace />;
    }

    return <Navigate to={`/auth${location.search}`} replace />;
  }

  // Wrong role
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function SmartRedirect() {
  const {
    user,
    authLoading
  } = useContext(AuthContext);
  const location = useLocation();

  if (authLoading) {
    return (
      <TrainLoader
        text="Redirecting to Station Console..."
        subtext="Connecting your dashboard..."
      />
    );
  }

  if (!user) {
    return <Navigate to={`/auth${location.search}`} replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'assistant') {
    return <Navigate to="/assistant" replace />;
  }

  if (user.role === 'passenger') {
    return <Navigate to={`/dashboard${location.search}`} replace />;
  }

  return <Navigate to={`/auth${location.search}`} replace />;
}

export default function App() {
  const {
    user,
    authLoading
  } = useContext(AuthContext);

  if (authLoading) {
    return (
      <TrainLoader
        text="Loading OneCoolie..."
        subtext="Starting station assistance network..."
      />
    );
  }

  return (
    <>
      <OfflineBanner />

      <BrowserRouter>
        <Suspense
          fallback={
            <TrainLoader
              text="Loading OneCoolie..."
              subtext="Connecting to station dispatch network..."
            />
          }
        >
          <Routes>

            {/* Public Home */}
            <Route
              path="/"
              element={<HomePage />}
            />

            {/* Passenger Login */}
            <Route
              path="/auth"
              element={
                !user
                  ? <AuthPage role="passenger" />
                  : <SmartRedirect />
              }
            />

            {/* Assistant Login */}
            <Route
              path="/assistant-auth"
              element={
                !user
                  ? <AuthPage role="assistant" />
                  : <SmartRedirect />
              }
            />

            {/* Admin Login */}
            <Route
              path="/admin-auth"
              element={
                !user
                  ? <AdminLogin />
                  : <SmartRedirect />
              }
            />

            {/* Passenger Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={['passenger']}
                >
                  <PassengerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Passenger Booking */}
            <Route
              path="/booking/:id"
              element={
                <ProtectedRoute
                  allowedRoles={['passenger']}
                >
                  <BookingLive />
                </ProtectedRoute>
              }
            />

            {/* Help & Support */}
            <Route
              path="/help"
              element={
                <ProtectedRoute
                  allowedRoles={['passenger', 'assistant']}
                >
                  <HelpSupportPage />
                </ProtectedRoute>
              }
            />

            {/* Passenger Support redirect */}
            <Route
              path="/support"
              element={
                <Navigate
                  to="/dashboard?tab=support"
                  replace
                />
              }
            />

            {/* Assistant */}
            <Route
              path="/assistant"
              element={
                <ProtectedRoute
                  allowedRoles={['assistant']}
                >
                  <AssistantDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute
                  allowedRoles={['admin']}
                >
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Unknown URL */}
            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}