'use client';
import { Suspense, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Typography, Alert } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get('returnTo') || '/dashboard';
  const { user, token, status, setSession, setStatus } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Only redirect when we are ALREADY authenticated and actively on /login.
  useEffect(() => {
    if (status === 'authenticated' && token) {
      router.replace(user?.isPlatformAdmin ? '/platform' : returnTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, user, router]);

  if (status !== 'unauthenticated') {
    // Session is being restored (or we are about to redirect) — stay on a loader,
    // never flash a login form at an already-authenticated user.
    return <main className="min-h-screen grid place-items-center bg-slate-50"><span className="inline-block w-6 h-6 rounded-full border-[3px] border-[#003366] border-t-transparent animate-spin" /></main>;
  }

  async function submit(v: any) {
    try {
      setLoading(true); setError('');
      const r: any = await api('/auth/login', { method: 'POST', body: JSON.stringify(v) });
      const activeId = r.activeCompany?.id || r.companies?.[0]?.id || null;
      setSession({ token: r.token, user: r.user, companies: r.companies || [], activeCompanyId: activeId, lastCompanyId: activeId, permissions: r.permissions || [], roles: r.roles || [] });
      setStatus('authenticated');
      router.replace(r.user.isPlatformAdmin ? '/platform' : returnTo);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return <main className="min-h-screen grid lg:grid-cols-2 bg-slate-950"><section className="hidden lg:flex p-16 flex-col justify-between text-white bg-gradient-to-br from-[#003366] via-[#0b4a8f] to-[#0f172a]"><div><div className="text-sm uppercase tracking-[.3em] opacity-70">NexusERP Cloud</div><h1 className="text-5xl font-semibold mt-6 leading-tight">One ERP.<br/>Many companies.<br/>Built for scale.</h1><p className="mt-6 max-w-xl text-lg text-blue-100">Finance, sales, inventory, procurement, HR, CRM, assets, compliance, reporting and ZIMRA fiscalisation in one multi-tenant platform.</p></div><div className="text-sm text-blue-200">Development build • ZIMRA mock mode</div></section><section className="flex items-center justify-center p-6 bg-slate-50"><Card className="w-full max-w-md shadow-xl border-0"><Typography.Title level={2}>Welcome back</Typography.Title><Typography.Paragraph type="secondary">Sign in to your ERP workspace.</Typography.Paragraph>{error&&<Alert type="error" message={error} className="mb-4"/>}<Form layout="vertical" onFinish={submit} initialValues={{email:'admin@demo.local',password:'Password123!'}}><Form.Item label="Email" name="email" rules={[{required:true}]}><Input prefix={<MailOutlined/>} size="large"/></Form.Item><Form.Item label="Password" name="password" rules={[{required:true}]}><Input.Password prefix={<LockOutlined/>} size="large"/></Form.Item><Button type="primary" htmlType="submit" size="large" block loading={loading}>Sign in</Button></Form></Card></section></main>;
}

export default function Login() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
