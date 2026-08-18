import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { usePresence } from './hooks/usePresence';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

// A small wrapper to initialize presence for logged-in users
function PresenceManager({ children }: { children: React.ReactNode }) {
  usePresence();
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <PresenceManager>
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
      </PresenceManager>
    </AuthProvider>
  );
}

export default App;
