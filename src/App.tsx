import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { usePresence } from './hooks/usePresence';
import { usePushNotifications } from './hooks/usePushNotifications';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

// A small wrapper to initialize presence for logged-in users
function PresenceManager({ children }: { children: React.ReactNode }) {
  usePresence();
  return <>{children}</>;
}

// Initializes FCM push notifications and shows a banner for foreground messages
function PushNotificationsManager({ children }: { children: React.ReactNode }) {
  const { banner, dismissBanner } = usePushNotifications();
  return (
    <>
      {banner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-surface border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-[90%]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{banner.title}</p>
            <p className="text-xs text-muted-foreground truncate">{banner.body}</p>
          </div>
          <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <PresenceManager>
        <PushNotificationsManager>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Router>
        </PushNotificationsManager>
      </PresenceManager>
    </AuthProvider>
  );
}

export default App;