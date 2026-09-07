'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, Input, Segmented, Select, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { SoftBadge } from '@/components/crud-page';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');

  const list = useQuery({ queryKey: ['notifications-page'], queryFn: () => api('/notifications?limit=100') });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['notifications-page'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); },
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: (r: any) => { message.success(`${r.updated} notification(s) marked as read`); qc.invalidateQueries({ queryKey: ['notifications-page'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); },
  });

  const rows = (list.data || []).filter((n: any) => {
    if (view === 'unread' && n.readAt != null) return false;
    if (view === 'read' && n.readAt == null) return false;
    if (q && !`${n.title} ${n.body || ''} ${n.type}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const unreadCount = (list.data || []).filter((n: any) => n.readAt == null).length;

  const cols: ColumnsType<any> = [
    { title: 'Notification', render: (_v, r) => (
      <div className="min-w-0">
        <div className={`text-[13px] flex items-center gap-2 ${r.readAt == null ? 'font-semibold text-[#171a2e]' : 'font-medium text-[#344054]'}`}>{r.readAt == null && <span className="w-1.5 h-1.5 rounded-full bg-[#1d5fb5] shrink-0" />}{r.title}</div>
        {r.body && <div className="text-[12px] text-[#64748b] mt-0.5 truncate max-w-[420px]">{r.body}</div>}
      </div>
    ) },
    { title: 'Module', width: 130, render: (_v, r) => {
      const mod = (r.link || '').split('/')[1];
      return <Tag>{(mod || 'system').toUpperCase()}</Tag>;
    } },
    { title: 'Date', width: 150, render: (_v, r) => <span className="text-[12px] text-[#64748b]">{dayjs(r.createdAt).format('DD MMM YYYY, HH:mm')}</span> },
    { title: 'Status', width: 100, render: (_v, r) => <SoftBadge tone={r.readAt == null ? 'blue' : 'grey'} dotless>{r.readAt == null ? 'UNREAD' : 'READ'}</SoftBadge> },
    { title: 'Actions', width: 150, align: 'right', render: (_v, r) => (
      <div className="flex gap-1 justify-end">
        {r.link && <Button size="small" onClick={() => router.push(r.link)}>Open</Button>}
        {r.readAt == null && <Tooltip title="Mark as read"><Button size="small" loading={markRead.isPending && markRead.variables === r.id} onClick={() => markRead.mutate(r.id)}>Mark read</Button></Tooltip>}
      </div>
    ) },
  ];

  return (
    <div className="nex-fade">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Link href="/"><Button shape="circle" icon={<ArrowLeftOutlined />} /></Link>
          <div>
            <h1 className="text-[26px] font-bold text-[#171a2e] leading-tight">Notifications</h1>
            <p className="text-[13px] text-[#64748b] mt-0.5">{unreadCount} unread · {(list.data || []).length} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ReloadOutlined />} onClick={() => list.refetch()}>Refresh</Button>
          {unreadCount > 0 && <Button type="primary" loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all as read</Button>}
        </div>
      </div>

      <div className="nex-card rounded-xl mb-4 px-4 py-3 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={(v: any) => setView(v)} options={[{ label: 'All', value: 'all' }, { label: 'Unread', value: 'unread' }, { label: 'Read', value: 'read' }]} />
        <Input allowClear placeholder="Search notifications…" className="!w-64 !rounded-xl" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="nex-card rounded-xl overflow-hidden">
        <Table rowKey="id" loading={list.isLoading} dataSource={rows} columns={cols} pagination={{ pageSize: 20, showTotal: (t) => `${t} notifications` }} />
      </div>
    </div>
  );
}
