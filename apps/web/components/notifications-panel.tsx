'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Skeleton } from 'antd';
import {
  BellOutlined, CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, FileTextOutlined,
  MailOutlined, SyncOutlined, ThunderboltOutlined, UserOutlined, WalletOutlined, WarningOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

const TYPE_ICON: Record<string, React.ReactNode> = {
  PAYMENT_RECEIVED: <DollarOutlined />, INVOICE_CREATED: <FileTextOutlined />, INVOICE_OVERDUE: <WarningOutlined />,
  SUBMISSION_REMINDER: <ClockCircleOutlined />, MANAGER_REVIEW_DUE: <ClockCircleOutlined />, QA_REVIEW_DUE: <ClockCircleOutlined />,
  PERFORMANCE_APPROVED: <CheckCircleOutlined />, ACKNOWLEDGEMENT_REQUEST: <UserOutlined />, KPI_TEMPLATE_MISSING: <ThunderboltOutlined />,
  BILL_DUE: <WalletOutlined />, LOW_STOCK: <SyncOutlined />, EMAIL_SENT: <MailOutlined />, DEFAULT: <BellOutlined />,
};
const TYPE_TONE: Record<string, string> = {
  PAYMENT_RECEIVED: '#16a34a', INVOICE_OVERDUE: '#dc2626', BILL_DUE: '#f59e0b', LOW_STOCK: '#f59e0b',
  KPI_TEMPLATE_MISSING: '#dc2626', SUBMISSION_REMINDER: '#f59e0b', MANAGER_REVIEW_DUE: '#f59e0b', QA_REVIEW_DUE: '#f59e0b',
  PERFORMANCE_APPROVED: '#16a34a', ACKNOWLEDGEMENT_REQUEST: '#003366', INVOICE_CREATED: '#003366', EMAIL_SENT: '#0284c7', DEFAULT: '#003366',
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? '' : 's'} ago`;
}

export function useUnreadCount() {
  const { activeCompanyId } = useAuth();
  const q = useQuery({
    queryKey: ['notifications-unread', activeCompanyId],
    queryFn: () => api('/notifications/unread-count'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return { count: q.data?.count ?? 0, isLoading: q.isLoading };
}

export function NotificationPanel({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const [localRead, setLocalRead] = useState<Record<string, boolean>>({});

  const list = useQuery({
    queryKey: ['notifications-list', activeCompanyId],
    queryFn: () => api('/notifications?limit=30'),
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onMutate: (id) => setLocalRead((m) => ({ ...m, [id]: true })),
    onError: (e: any, id) => { setLocalRead((m) => ({ ...m, [id]: false })); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications-unread'] }),
  });

  const markAll = useMutation({
    mutationFn: () => api('/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: () => { setLocalRead((m) => { const n = { ...m }; for (const r of list.data || []) n[r.id] = true; return n; }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); },
    onError: (e: any) => qc.invalidateQueries({ queryKey: ['notifications-unread'] }),
  });

  const rows = (list.data || []).map((r: any) => ({ ...r, unread: r.readAt == null || localRead[r.id] === true }));
  const unreadInList = rows.filter((r: any) => r.unread).length;

  function open(n: any) {
    if (n.unread && !localRead[n.id]) markRead.mutate(n.id);
    onNavigate?.();
    if (n.link) router.push(n.link);
  }

  if (list.isLoading) {
    return (
      <div className="w-[min(380px,calc(100vw-32px))]">
        <div className="px-4 py-3 border-b border-[#eef0f6] text-[13px] font-semibold text-[#171a2e]">Notifications</div>
        <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} active title={{ width: '40%' }} paragraph={{ rows: 1 }} />)}</div>
      </div>
    );
  }

  if (list.error) {
    return (
      <div className="w-[min(380px,calc(100vw-32px))] p-6 text-center">
        <div className="text-[13px] font-semibold text-[#344054]">Unable to load notifications.</div>
        <div className="text-[12px] text-[#94a3b8] mt-1 mb-3">The notification service could not be reached.</div>
        <Button size="small" icon={<SyncOutlined />} onClick={() => list.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="w-[min(380px,calc(100vw-32px))]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef0f6]">
        <span className="text-[13px] font-bold text-[#171a2e]">Notifications {unreadInList > 0 && <span className="text-[11px] font-medium text-[#94a3b8] ml-1">{unreadInList} unread</span>}</span>
        {unreadInList > 0 && (
          <Button size="small" type="link" className="!px-0 !text-[12px]" loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all as read</Button>
        )}
      </div>
      <div className="max-h-[440px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-11 h-11 rounded-full bg-[#f0f6ff] text-[#003366] grid place-items-center mx-auto text-[17px]"><BellOutlined /></div>
            <div className="text-[13px] font-semibold text-[#171a2e] mt-3">You're all caught up</div>
            <div className="text-[12px] text-[#94a3b8] mt-0.5">No new notifications.</div>
          </div>
        ) : rows.map((n: any) => {
          const icon = TYPE_ICON[n.type] || TYPE_ICON.DEFAULT;
          const tone = TYPE_TONE[n.type] || TYPE_TONE.DEFAULT;
          const inner = (
            <div className={`flex gap-3 px-4 py-3 border-b border-[#f4f5f9] cursor-pointer transition-colors hover:bg-[#f6f8ff] ${n.unread ? 'bg-[#f2f7ff]' : 'bg-white'}`}>
              <span className="shrink-0 w-8 h-8 rounded-lg grid place-items-center text-[14px]" style={{ color: tone, background: `${tone}14` }}>{icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-1.5 text-[13px] ${n.unread ? 'font-semibold text-[#171a2e]' : 'font-medium text-[#344054]'}`}>
                  {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#1d5fb5] shrink-0" />}<span className="truncate">{n.title}</span>
                </span>
                {n.body && <span className="block text-[12px] text-[#64748b] mt-0.5 line-clamp-2">{n.body}</span>}
                <span className="block text-[11px] text-[#94a3b8] mt-1">{timeAgo(n.createdAt)}</span>
              </span>
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} onClick={() => open(n)} className="block">{inner}</Link>
          ) : (
            <div key={n.id} onClick={() => open(n)}>{inner}</div>
          );
        })}
      </div>
      <div className="border-t border-[#eef0f6] px-4 py-2.5 text-center">
        <Link href="/notifications" onClick={onNavigate} className="text-[12px] font-semibold text-[#1d5fb5] hover:underline">View all notifications</Link>
      </div>
    </div>
  );
}
