'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { ErpShell } from '@/components/erp-shell';

function MinimalLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6fa]">
      <div className="flex flex-col items-center gap-3">
        <span className="inline-block w-6 h-6 rounded-full border-[3px] border-[#003366] border-t-transparent animate-spin" />
        <div className="text-[14px] font-semibold text-[#3c4263]">Loading workspace…</div>
      </div>
    </div>
  );
}

// Central protected layout guard. Only three states are possible:
//  - initializing: session is being restored silently — show a subtle loader.
//  - unauthenticated: real logout/expiry — redirect to /login.
//  - authenticated: render the ERP shell, preserving the current route.
export function ProtectedArea({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const token = useAuth((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !token) return <MinimalLoader />;
  return <ErpShell>{children}</ErpShell>;
}
