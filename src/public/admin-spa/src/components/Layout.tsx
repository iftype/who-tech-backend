import { type ReactNode } from 'react';
import TabNav from './TabNav.js';
import { useAuth } from '../context/AuthContext.js';

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">who.tech 어드민</h1>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
          로그아웃
        </button>
      </header>
      <TabNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
