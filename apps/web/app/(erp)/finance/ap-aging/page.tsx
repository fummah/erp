'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { FinanceSummaryCard } from '@/components/finance-ui';
import { CurrencyValue } from '@/components/sales-ui';

export default function ApAgingPage() {
  const bills = useQuery({ queryKey: ['/procurement/supplier-invoices'], queryFn: () => api('/procurement/supplier-invoices') });
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const m: Record<string, any> = {};
    (bills.data || []).forEach((i: any) => {
      const key = i.supplierId || 'none';
      if (!m[key]) m[key] = { supplier: i.supplier?.name || 'Unknown', current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
      const due = i.dueDate ? dayjs(i.dueDate) : null;
      const out = Math.max(0, Number(i.total || 0) - (i.payments || []).reduce((x: number, p: any) => x + Number(p.amount), 0));
      const daysPast = due ? dayjs().diff(due, 'day') : 0;
      if (!due || daysPast <= 0) m[key].current += out;
      else if (daysPast <= 30) m[key].d30 += out;
      else if (daysPast <= 60) m[key].d60 += out;
      else m[key].d90 += out;
      m[key].total += out;
    });
    return Object.values(m);
  }, [bills.data]);

  const filtered = rows.filter((r: any) => !q || r.supplier.toLowerCase().includes(q.toLowerCase()));
  const total = filtered.reduce((s, r) => s + r.total, 0);
  const overdue = filtered.reduce((s, r) => s + r.d30 + r.d60 + r.d90, 0);

  const cols: ColumnsType<any> = [
    { title: 'Vendor', dataIndex: 'supplier', render: (v) => <span className="text-[13px] text-[#171a2e]">{v}</span> },
    { title: 'Current', align: 'right', width: 120, render: (_v, r) => <CurrencyValue value={r.current} /> },
    { title: '1–30 Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] text-[#16a34a]">{fmtMoney(r.d30)}</span> },
    { title: '31–60 Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] text-[#f59e0b]">{fmtMoney(r.d60)}</span> },
    { title: '60+ Days', align: 'right', width: 120, render: (_v, r) => <span className="text-[13px] font-semibold text-[#ef4444]">{fmtMoney(r.d90)}</span> },
    { title: 'Total', align: 'right', width: 130, render: (_v, r) => <CurrencyValue value={r.total} /> },
  ];

  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <FinanceSummaryCard label="Total Payables" value={fmtMoney(total)} valueColor="#2563eb" />
        <FinanceSummaryCard label="Overdue Payables" value={fmtMoney(overdue)} valueColor="#EF4444" />
        <FinanceSummaryCard label="Vendors" value={filtered.length} valueColor="#7c3aed" />
        <FinanceSummaryCard label="60+ Days" value={fmtMoney(filtered.reduce((s, r) => s + r.d90, 0))} valueColor="#f97316" />
      </div>
      <div className="nex-card mb-4 px-4 py-3 flex items-center gap-3">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search vendor" className="w-72 !rounded-lg" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button icon={<ReloadOutlined />} onClick={() => bills.refetch()} />
        <span className="ml-auto text-[12px] text-[#94a3b8]">{filtered.length} vendors</span>
      </div>
      <div className="nex-card">
        <Table rowKey={(r: any) => r.supplier} loading={bills.isLoading} dataSource={filtered} columns={cols} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} vendors` }} />
      </div>
    </div>
  );
}

