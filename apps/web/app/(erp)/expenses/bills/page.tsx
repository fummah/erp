'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input, Select, Table, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { InboxOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { FinanceSummaryCard } from '@/components/finance-ui';
import { FilterBar, StatusPill, CurrencyValue } from '@/components/sales-ui';

const TABS = [
  { key: '/expenses/bills', label: 'Bill Management' },
  { key: '/expenses/enter-bill', label: 'Enter Bill' },
  { key: '/expenses/pay-bill', label: 'Pay Bill' },
];

export default function BillManagementPage() {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['/procurement/supplier-invoices'], queryFn: () => api('/procurement/supplier-invoices') });
  const suppliers = useQuery({ queryKey: ['/procurement/suppliers'], queryFn: () => api('/procurement/suppliers') });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');
  const [range, setRange] = useState<any>(null);

  const rows = useMemo(() => {
    let r = list.data || [];
    if (q) r = r.filter((i: any) => `${i.invoiceNo} ${i.supplier?.name || ''}`.toLowerCase().includes(q.toLowerCase()));
    if (status) r = r.filter((i: any) => i.status === status);
    if (vendor) r = r.filter((i: any) => i.supplierId === vendor);
    if (range?.[0] && range?.[1]) r = r.filter((i: any) => dayjs(i.invoiceDate).isAfter(dayjs(range[0])) && dayjs(i.invoiceDate).isBefore(dayjs(range[1]).endOf('day')));
    return r;
  }, [list.data, q, status, vendor, range]);

  const bal = (i: any) => Math.max(0, Number(i.total || 0) - (i.payments || []).reduce((x: number, p: any) => x + Number(p.amount), 0));
  const outstanding = rows.reduce((s: number, i: any) => s + bal(i), 0);
  const overdue = rows.filter((i: any) => i.dueDate && dayjs(i.dueDate).isBefore(dayjs(), 'day') && bal(i) > 0).length;
  const dueWeek = rows.filter((i: any) => i.dueDate && !dayjs(i.dueDate).isBefore(dayjs(), 'day') && dayjs(i.dueDate).isBefore(dayjs().add(7, 'day')) && bal(i) > 0).length;
  const paidMonth = rows.filter((i: any) => dayjs(i.invoiceDate).isSame(dayjs(), 'month')).reduce((s: number, i: any) => s + (i.payments || []).reduce((x: number, p: any) => x + Number(p.amount), 0), 0);

  const statusOpts = Array.from(new Set((list.data || []).map((i: any) => i.status))).map((s: any) => ({ label: s.replace(/_/g, ' '), value: s }));

  const columns: ColumnsType<any> = [
    { title: 'Bill #', dataIndex: 'invoiceNo', width: 130, sorter: (a: any, b: any) => String(a.invoiceNo).localeCompare(String(b.invoiceNo)), render: (v) => <span className="font-mono text-[12px] font-semibold text-[#003366]">{v}</span> },
    { title: 'Vendor', dataIndex: 'supplier', render: (_v, r) => <span className="text-[13px] text-[#171a2e]">{r.supplier?.name || '—'}</span> },
    { title: 'Bill Date', dataIndex: 'invoiceDate', width: 110, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YY')}</span> },
    { title: 'Due Date', dataIndex: 'dueDate', width: 110, render: (v) => <span className="text-[13px] text-[#64748b]">{v ? dayjs(v).format('DD MMM YY') : '—'}</span> },
    { title: 'Amount', dataIndex: 'total', width: 130, align: 'right', sorter: (a: any, b: any) => a.total - b.total, render: (v) => <CurrencyValue value={v} /> },
    { title: 'Paid', align: 'right', width: 120, render: (_, r: any) => <span className="text-[13px] font-semibold text-[#16A34A]">{fmtMoney((r.payments || []).reduce((x: number, p: any) => x + Number(p.amount), 0))}</span> },
    { title: 'Remaining', align: 'right', width: 120, render: (_, r: any) => <span className="text-[13px] font-semibold text-[#F97316]">{fmtMoney(bal(r))}</span> },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <StatusPill status={v} /> },
    { title: '', width: 60, align: 'right', render: (_v, r: any) => <Link href={`/documents/supplier-invoice/${r.id}`} target="_blank"><Tooltip title="Print / PDF"><Button size="small" type="text" icon={<PrinterOutlined />} /></Tooltip></Link> },
  ];

  return (
    <div className="nex-fade">
      <div className="flex items-center gap-6 border-b border-[#eef0f6] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => router.push(t.key)} className={`pb-3 text-[14px] font-medium border-b-2 whitespace-nowrap transition-colors ${path === t.key ? 'text-[#003366] border-[#003366]' : 'text-[#344054] border-transparent hover:text-[#003366]'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[26px] font-bold text-[#171a2e] leading-tight">Bill Management</h1><p className="text-[13px] text-[#64748b] mt-1">Supplier bills and payables</p></div>
        <Link href="/expenses/vendor-credits"><Button icon={<SwapOutlined />}>Vendor Credits</Button></Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <FinanceSummaryCard label="Total Outstanding" value={fmtMoney(outstanding)} valueColor="#F97316" />
        <FinanceSummaryCard label="Overdue Bills" value={`${overdue} bills`} valueColor="#EF4444" />
        <FinanceSummaryCard label="Due This Week" value={`${dueWeek} bills`} valueColor="#2563eb" />
        <FinanceSummaryCard label="Paid This Month" value={fmtMoney(paidMonth)} valueColor="#16A34A" />
      </div>

      <FilterBar extra={<Button size="small" onClick={() => { setStatus(''); setVendor(''); setRange(null); }}>Clear</Button>}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search bill or vendor" className="w-64 !rounded-lg" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select allowClear placeholder="Status" className="!min-w-[140px] !rounded-lg" value={status || undefined} onChange={setStatus} options={statusOpts} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Vendor" className="!min-w-[170px] !rounded-lg" value={vendor || undefined} onChange={setVendor} options={(suppliers.data || []).map((s: any) => ({ label: s.name, value: s.id }))} />
        <DatePicker.RangePicker className="!rounded-lg" value={range} onChange={setRange} />
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/procurement/supplier-invoices'] })} />
      </FilterBar>

      <div className="nex-card">
        {rows.length === 0 ? (
          <div className="text-center py-14"><InboxOutlined className="text-3xl text-[#c7ccdd]" /><div className="text-[15px] font-semibold text-[#171a2e] mt-3">No bills found</div><div className="text-[13px] text-[#64748b] mt-1">No vendor bills match the selected filters.</div><div className="mt-4"><Link href="/expenses/enter-bill"><Button type="primary" icon={<PlusOutlined />}>Enter Bill</Button></Link></div></div>
        ) : (
          <Table rowKey="id" loading={list.isLoading} dataSource={rows} columns={columns} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} bills` }} />
        )}
      </div>
    </div>
  );
}

