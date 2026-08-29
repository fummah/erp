'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { FinanceSummaryCard } from '@/components/finance-ui';

export default function CostingPage() {
  const q = useQuery({ queryKey: ['inv-valuation'], queryFn: () => api('/inventory/valuation') });
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    let r = q.data?.rows || [];
    if (search) r = r.filter((x: any) => `${x.sku} ${x.name}`.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [q.data, search]);

  const value = q.data?.totalValue || 0;
  const cost = rows.reduce((s: number, r: any) => s + Number(r.value || 0), 0);
  const qty = rows.reduce((s: number, r: any) => s + Number(r.onHand || 0), 0);

  const cols: ColumnsType<any> = [
    { title: 'SKU', dataIndex: 'sku', width: 120, render: (v) => <span className="font-mono text-[12px] font-semibold text-[#003366]">{v}</span> },
    { title: 'Item', dataIndex: 'name', render: (v) => <span className="text-[13px] text-[#171a2e]">{v}</span> },
    { title: 'On Hand', dataIndex: 'onHand', align: 'right', width: 110, render: (v) => <span className="text-[13px] text-[#475060]">{v}</span> },
    { title: 'Avg Cost', dataIndex: 'avgCost', align: 'right', width: 120, render: (v) => <span className="text-[13px] text-[#64748b]">{fmtMoney(v)}</span> },
    { title: 'Value', dataIndex: 'value', align: 'right', width: 130, render: (v) => <span className="text-[13px] font-semibold text-[#003366]">{fmtMoney(v)}</span> },
  ];

  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <FinanceSummaryCard label="Inventory Value" value={fmtMoney(value)} valueColor="#2563eb" />
        <FinanceSummaryCard label="Items in Stock" value={rows.length} valueColor="#7c3aed" />
        <FinanceSummaryCard label="Units on Hand" value={qty} valueColor="#f59e0b" />
        <FinanceSummaryCard label="Total Cost" value={fmtMoney(cost)} valueColor="#16A34A" />
      </div>
      <div className="nex-card mb-4 px-4 py-3 flex items-center gap-3">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search SKU or item" className="w-72 !rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} />
        <span className="ml-auto text-[12px] text-[#94a3b8]">{rows.length} items</span>
      </div>
      <div className="nex-card">
        <Table rowKey={(r: any) => r.sku} loading={q.isLoading} dataSource={rows} columns={cols} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} items` }} />
      </div>
    </div>
  );
}

