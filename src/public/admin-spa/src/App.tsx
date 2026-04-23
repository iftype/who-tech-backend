import { useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import Layout from './components/Layout.js';
import LoginPage from './components/LoginPage.js';
import MemberTab from './pages/MemberTab.js';
import { useHashLocation } from './hooks/useHashLocation.js';

const SyncTab = lazy(() => import('./pages/SyncTab.js'));
const RepoTab = lazy(() => import('./pages/RepoTab.js'));
const BlogTab = lazy(() => import('./pages/BlogTab.js'));
const ArchiveTab = lazy(() => import('./pages/ArchiveTab.js'));
const PersonTab = lazy(() => import('./pages/PersonTab.js'));
const LogTab = lazy(() => import('./pages/LogTab.js'));
const SettingsTab = lazy(() => import('./pages/SettingsTab.js'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64 text-sm text-slate-400">
    <div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-teal-700 rounded-full mr-2" />
    로딩 중...
  </div>
);

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
    if (location.startsWith('/archive')) return <ArchiveTab />;
    if (location.startsWith('/persons')) return <PersonTab />;
    if (location.startsWith('/logs')) return <LogTab />;
    if (location.startsWith('/settings')) return <SettingsTab />;
    return <MemberTab />;
  })();

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>{page}</Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
