import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import Layout from './components/Layout.js';
import LoginPage from './components/LoginPage.js';
import MemberTab from './pages/MemberTab.js';
import SyncTab from './pages/SyncTab.js';
import RepoTab from './pages/RepoTab.js';
import BlogTab from './pages/BlogTab.js';
import SettingsTab from './pages/SettingsTab.js';
import { useHashLocation } from './hooks/useHashLocation.js';

function Router() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useHashLocation();

  useEffect(() => {
    if (isAuthenticated && (location === '/' || location === '/login')) {
      navigate('/members');
    }
  }, [isAuthenticated, location, navigate]);

  if (!isAuthenticated) return <LoginPage />;

  const page = (() => {
    if (location.startsWith('/members')) return <MemberTab />;
    if (location.startsWith('/sync')) return <SyncTab />;
    if (location.startsWith('/repos')) return <RepoTab />;
    if (location.startsWith('/blog')) return <BlogTab />;
    if (location.startsWith('/settings')) return <SettingsTab />;
    return <MemberTab />;
  })();

  return <Layout>{page}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
