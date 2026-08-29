'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { Can } from '@/components/Can';
import { StatusPill } from '@/components/sales-ui';

export default function FinancialPeriodsPage() {
  const qc = useQueryClient();
  const years = useQuery({ queryKey: ['/finance/periods'], queryFn: () => api('/finance/periods') });

  async function setStatus(id: string, action: 'close' | 'reopen') {
    try { await api(`/finance/periods/${id}/${action}`, { method: 'POST' }); message.success(action === 'close' ? 'Period closed' : 'Period reopened'); qc.invalidateQueries({ queryKey: ['/finance/periods'] }); }
    catch (e: any) { message.error(e.message); }
  }

  const cols: ColumnsType<any> = [
    { title: 'Period', dataIndex: 'name', render: (v, r) => <span className="text-[13px] font-medium text-[#171a2e]">{v} {dayjs().year() === dayjs(r.startDate).year() ? '' : dayjs(r.startDate).year()}</span> },
    { title: 'Start', dataIndex: 'startDate', width: 130, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YYYY')}</span> },
    { title: 'End', dataIndex: 'endDate', width: 130, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YYYY')}</span> },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <StatusPill status={v.replace(/_/g, ' ')} /> },
    { title: 'Closed By', dataIndex: 'closedBy', width: 120, render: (v) => <span className="text-[12px] text-[#94a3b8]">{v ? 'User' : '—'}</span> },
    { title: 'Actions', key: 'a', width: 140, align: 'right', render: (_, r: any) => (
      <Can permission="finance.periods.manage">
        {r.status === 'OPEN'
          ? <Button size="small" danger onClick={() => setStatus(r.id, 'close')}>Close</Button>
          : <Button size="small" onClick={() => setStatus(r.id, 'reopen')}>Reopen</Button>}
      </Can>
    ) },
  ];

  return (
    <div className="nex-fade">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[26px] font-bold text-[#171a2e] leading-tight">Financial Periods</h1><p className="text-[13px] text-[#64748b] mt-1">Open and close accounting periods; posting is blocked in closed periods</p></div>
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/finance/periods'] })}>Refresh</Button>
      </div>
      {(years.data || []).map((fy: any) => (
        <div key={fy.id} className="nex-card mb-4">
          <div className="px-5 py-3 border-b border-[#eef0f6] flex items-center gap-2"><span className="text-[14px] font-semibold text-[#171a2e]">FY {fy.year}</span></div>
          <Table rowKey="id" loading={years.isLoading} dataSource={fy.periods || []} columns={cols} pagination={false} />
        </div>
      ))}
    </div>
  );
}

