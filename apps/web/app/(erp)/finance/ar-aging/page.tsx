'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { FinanceSummaryCard } from '@/components/finance-ui';
import { CurrencyValue, CustomerAvatar } from '@/components/sales-ui';

export default function ArAgingPage() {
  const aging = useQuery({ queryKey: ['debtor-age'], queryFn: () => api('/sales/debtor-age') });
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    let r = aging.data?.byCustomer || [];
    if (q) r = r.filter((x: any) => (x.customer?.name || '').toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [aging.data, q]);

  const s = aging.data?.summary;
  const total = s ? s.current + s.d30 + s.d60 + s.d90plus : 0;
  const overdue = s ? s.d30 + s.d60 + s.d90plus : 0;

  const cols: ColumnsType<any> = [
    { title: 'Customer', render: (_v, r) => (<span className="flex items-center gap-2.5"><CustomerAvatar name={r.customer?.name} size={28} /><span className="text-[13px] text-[#171a2e]">{r.customer?.name || '—'}</span></span>) },
    { title: 'Current', align: 'right', width: 120, render: (_v, r) => <CurrencyValue value={r.current} /> },
    { title: '31–60 Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] text-[#16a34a]">{fmtMoney(r.d30)}</span> },
    { title: '61–90 Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] text-[#f59e0b]">{fmtMoney(r.d60)}</span> },
    { title: '90+ Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] font-semibold text-[#ef4444]">{fmtMoney(r.d90plus)}</span> },
    { title: 'Total', align: 'right', width: 130, render: (_v, r) => <CurrencyValue value={r.total} /> },
  ];

  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <FinanceSummaryCard label="Total Receivables" value={fmtMoney(total)} valueColor="#2563eb" />
        <FinanceSummaryCard label="Overdue Amount" value={fmtMoney(overdue)} valueColor="#EF4444" />
        <FinanceSummaryCard label="Customers" value={rows.length} valueColor="#7c3aed" />
        <FinanceSummaryCard label="90+ Days" value={fmtMoney(s?.d90plus || 0)} valueColor="#f97316" />
      </div>
      <div className="nex-card mb-4 px-4 py-3 flex items-center gap-3">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search customer" className="w-72 !rounded-lg" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button icon={<ReloadOutlined />} onClick={() => aging.refetch()} />
        <span className="ml-auto text-[12px] text-[#94a3b8]">{rows.length} customers</span>
      </div>
      <div className="nex-card">
        <Table rowKey={(r: any) => r.customer?.id || 'none'} loading={aging.isLoading} dataSource={rows} columns={cols} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} customers` }} />
      </div>
    </div>
  );
}

