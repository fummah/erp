'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, DatePicker, Descriptions, Input, Modal, Popconfirm, Row, Select, Skeleton, Table, Tabs, Tag, message } from 'antd';
import { BarChartOutlined, DollarOutlined, DownloadOutlined, ProjectOutlined, ReloadOutlined, RiseOutlined, SaveOutlined, ShopOutlined, ShoppingCartOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';

function useQ(key: string, path: string) {
  return useQuery({ queryKey: [key], queryFn: () => api(path) });
}

function Summary({ data }: { data: any }) {
  if (!data || Object.keys(data).length === 0) return <Alert type="info" message="No data yet." showIcon />;
  return (
    <Descriptions column={2} size="small" bordered>
      {Object.entries(data).map(([k, v]) => (
        <Descriptions.Item key={k} label={k.replace(/([A-Z])/g, ' $1').toUpperCase()}>
          {typeof v === 'object' ? <code className="text-xs">{JSON.stringify(v)}</code> : typeof v === 'number' ? fmtNumber(Number(v)) : String(v)}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function ReportCard({ title, query, path, table }: any) {
  const q = useQ(query, path);
  if (q.isLoading) return <Skeleton active />;
  if (q.error) return <Alert type="error" message={(q.error as Error).message} showIcon />;
  const raw = q.data;
  const rows = Array.isArray(raw) ? raw : (raw?.rows || raw?.byCustomer || raw?.items || []);
  return (
    <Card title={<span className="font-bold">{title}</span>} className="nex-card mb-4" styles={{ body: { padding: 0 } }}>
      {table ? <Table size="small" rowKey={(_, i: any) => String(i)} dataSource={rows} columns={table} pagination={false} scroll={{ x: true }} /> : <div className="p-5"><Summary data={raw} /></div>}
    </Card>
  );
}

/* ------------------------------ Expense Analysis ------------------------------ */
function ExpenseAnalysis() {
  const pnl = useQuery({ queryKey: ['/finance/pnl'], queryFn: () => api('/finance/profit-loss') });
  const bills = useQuery({ queryKey: ['/procurement/supplier-invoicesbills'], queryFn: () => api('/procurement/supplier-invoices') });
  const projects = useQuery({ queryKey: ['/projects/profit'], queryFn: () => api('/projects/profitability') });
  const byAccount = Object.entries(pnl.data?.expenses || {}).map(([code, amt]) => ({ label: code, amount: Number(amt) })).sort((a, b) => b.amount - a.amount);
  const byVendor: Record<string, any> = {};
  (bills.data || []).forEach((b: any) => { const k = b.supplier?.name || 'Other'; if (!byVendor[k]) byVendor[k] = { label: k, amount: 0, count: 0 }; byVendor[k].amount += Number(b.total); byVendor[k].count++; });
  const byProject = (projects.data?.rows || []).map((p: any) => ({ label: p.name, amount: p.otherCost || 0 })).sort((a: any, b: any) => b.amount - a.amount);
  const cols: ColumnsType<any> = [
    { title: 'Dimension', render: (_v, r) => <span className="text-[13px] font-medium text-[#171a2e]">{r.label}</span> },
    { title: 'Amount', dataIndex: 'amount', align: 'right', width: 140, render: (v: any) => <span className="text-[13px] font-semibold text-[#F97316]">{fmtMoney(v)}</span> },
  ];
  const items = [
    { key: 'account', label: 'By Account', children: <Table rowKey="label" size="small" dataSource={byAccount} columns={cols} pagination={false} /> },
    { key: 'vendor', label: 'By Vendor', children: <Table rowKey="label" size="small" dataSource={Object.values(byVendor)} columns={cols} pagination={false} /> },
    { key: 'project', label: 'By Project', children: <Table rowKey="label" size="small" dataSource={byProject} columns={cols} pagination={false} /> },
  ];
  return <Card title="Expense Analysis" className="nex-card" styles={{ body: { padding: '14px 20px' } }}><Tabs defaultActiveKey="account" items={items} /></Card>;
}

/* ------------------------------ Report Builder ------------------------------ */
function ReportBuilder() {
  const qc = useQueryClient();
  const datasets = useQuery({ queryKey: ['/reports/datasets'], queryFn: () => api('/reports/datasets') });
  const saved = useQuery({ queryKey: ['/reports'], queryFn: () => api('/reports') });
  const [ds, setDs] = useState('SALES');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<any>(null);
  const [name, setName] = useState('My report');
  const [result, setResult] = useState<{ rows: any[]; meta: any } | null>(null);
  const [savingText, setSavingText] = useState('');

  const meta = (datasets.data || []).find((d: any) => d.id === ds);
  async function run() {
    try {
      const body: any = { dataset: ds, keyword, status: status || undefined, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') };
      const rows = await api('/reports/run', { method: 'POST', body: JSON.stringify(body) });
      setResult({ rows, meta });
    } catch (e: any) { message.error(e.message); }
  }
  async function save() {
    try { await api('/reports', { method: 'POST', body: JSON.stringify({ name: name || ds, dataset: ds }) }); message.success('Report saved'); qc.invalidateQueries({ queryKey: ['/reports'] }); } catch (e: any) { message.error(e.message); }
  }
  async function runSaved(d: any) {
    try { const rows = await api('/reports/run', { method: 'POST', body: JSON.stringify({ dataset: d.dataset }) }); setResult({ rows, meta: (datasets.data || []).find((x: any) => x.id === d.dataset) }); message.success(`Ran ${d.name}`); } catch (e: any) { message.error(e.message); }
  }
  function exportCsv() {
    if (!result?.rows?.length) { message.info('Nothing to export'); return; }
    const cols = result.meta?.columns || [];
    const csv = [cols.map((c: any) => c.label).join(','), ...result.rows.map((r) => cols.map((c: any) => `"${r[c.key] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${ds}.csv`; a.click(); URL.revokeObjectURL(url); message.success('Exported CSV');
  }
  const resCols: ColumnsType<any> = (result?.meta?.columns || []).map((c: any) => ({ title: c.label, dataIndex: c.key, render: (v: any) => (typeof v === 'number' ? fmtMoney(v) : v != null ? String(v) : '—') }));
  return (
    <div className="space-y-4">
      <Card title="Report Builder" className="nex-card">
        <div className="flex flex-wrap items-center gap-3">
          <Select className="!min-w-[190px]" value={ds} onChange={(v) => setDs(v)} options={(datasets.data || []).map((d: any) => ({ label: d.label, value: d.id }))} />
          <Input className="!w-64" placeholder="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          {ds === 'SALES' && <Select className="!min-w-[130px]" placeholder="Status" allowClear value={status || undefined} onChange={setStatus} options={['POSTED', 'PART_PAID', 'PAID', 'DRAFT'].map((s) => ({ label: s, value: s }))} />}
          <DatePicker.RangePicker value={range} onChange={setRange} />
          <Button type="primary" onClick={run}>Run</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>CSV</Button>
          <div className="ml-auto flex gap-2"><Input className="!w-40" defaultValue={name} onChange={(e) => setName(e.target.value)} /><Button icon={<SaveOutlined />} onClick={save}>Save</Button></div>
        </div>
      </Card>
      {result?.rows?.length ? (
        <Card title={`${result.meta?.label || ds} — ${result.rows.length} rows`} className="nex-card" styles={{ body: { padding: 0 } }}>
          <Table rowKey={(_, i: any) => String(i)} size="small" dataSource={result.rows} columns={resCols} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: true }} />
        </Card>
      ) : null}
      {saved.data?.length ? (
        <Card title="Saved Reports" className="nex-card" styles={{ body: { padding: 0 } }}>
          <Table rowKey="id" size="small" dataSource={saved.data} pagination={false} columns={[
            { title: 'Name', dataIndex: 'name', render: (v: any) => <span className="text-[13px] font-medium text-[#171a2e]">{v}</span> },
            { title: 'Dataset', dataIndex: 'dataset', width: 140 },
            { title: 'Actions', width: 160, align: 'right', render: (_v: any, r: any) => <div className="flex gap-1 justify-end"><Button size="small" onClick={() => runSaved(r)}>Run</Button><Popconfirm title="Delete?" onConfirm={() => { api(`/reports/${r.id}`, { method: 'DELETE' }).then(() => qc.invalidateQueries({ queryKey: ['/reports'] })).catch(() => {}); }}><Button size="small" danger>Del</Button></Popconfirm></div> },
          ] as ColumnsType<any>} />
        </Card>
      ) : null}
    </div>
  );
}

export default function Reports() {
  const sales = useQ('sales-report', '/sales/sales-report');
  const purchases = useQ('purchase-report', '/procurement/purchase-report');
  const debtor = useQ('debtor-age', '/sales/debtor-age');
  const valuation = useQ('valuation', '/inventory/valuation');

  const totalSales = (sales.data || []).reduce((s: number, r: any) => s + Number(r.sales), 0);
  const totalPurchases = (purchases.data || []).reduce((s: number, r: any) => s + Number(r.value), 0);
  const totalDebtors = (debtor.data?.byCustomer || []).reduce((s: number, r: any) => s + Number(r.total), 0);
  const stockValue = (valuation.data?.rows || []).reduce((s: number, r: any) => s + Number(r.value), 0);

  const salesCols: ColumnsType<any> = [
    { title: 'Month', dataIndex: 'month', width: 110, render: (v) => <span className="font-semibold">{v}</span> },
    { title: 'Sales', dataIndex: 'sales', align: 'right', render: (v: any) => <span className="text-[#10b981] font-semibold">{fmtMoney(v)}</span> },
    { title: 'Tax', dataIndex: 'tax', align: 'right', render: (v: any) => fmtMoney(v) },
  ];
  const purchaseCols: ColumnsType<any> = [
    { title: 'Month', dataIndex: 'month', width: 110, render: (v) => <span className="font-semibold">{v}</span> },
    { title: 'Purchases', dataIndex: 'value', align: 'right', render: (v: any) => <span className="text-[#f59e0b] font-semibold">{fmtMoney(v)}</span> },
  ];
  const ageCols: ColumnsType<any> = [
    { title: 'Customer', render: (_, r: any) => r.customer?.name || 'Cash/None' },
    { title: 'Current', dataIndex: 'current', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: '1-30d', dataIndex: 'd30', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: '31-60d', dataIndex: 'd60', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: '61-90d', dataIndex: 'd90', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: '90d+', dataIndex: 'd90plus', align: 'right', render: (v: any) => <span className="text-[#ef4444] font-semibold">{fmtMoney(v)}</span> },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v: any) => <Tag color="blue" style={{ borderRadius: 8 }}>{fmtMoney(v)}</Tag> },
  ];
  const valCols: ColumnsType<any> = [
    { title: 'SKU', dataIndex: 'sku', width: 110 }, { title: 'Item', dataIndex: 'name' },
    { title: 'On Hand', dataIndex: 'onHand', align: 'right', render: (v: any) => fmtNumber(v) },
    { title: 'Avg Cost', dataIndex: 'avgCost', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: 'Value', dataIndex: 'value', align: 'right', render: (v: any) => fmtMoney(v) },
  ];

  const items = [
    { key: 'sales', label: 'Sales by Month', children: <ReportCard title="Sales by Month" query="sales-report" path="/sales/sales-report" table={salesCols} /> },
    { key: 'purchase', label: 'Purchases by Month', children: <ReportCard title="Purchases by Month" query="purchase-report" path="/procurement/purchase-report" table={purchaseCols} /> },
    { key: 'debtor', label: 'Debtor Ageing', children: <ReportCard title="Customer Debtor Ageing" query="debtor-age" path="/sales/debtor-age" table={ageCols} /> },
    { key: 'valuation', label: 'Stock Valuation', children: <ReportCard title="Stock Valuation" query="valuation" path="/inventory/valuation" table={valCols} /> },
    { key: 'hr', label: 'HR Overview', children: <ReportCard title="HR Overview" query="hr-report" path="/hr/hr-report" /> },
    { key: 'crm', label: 'CRM Overview', children: <ReportCard title="CRM Overview" query="crm-report" path="/crm/crm-report" /> },
    { key: 'assets', label: 'Assets Summary', children: <ReportCard title="Asset Register Summary" query="assets-report" path="/assets/report" /> },
    { key: 'compliance', label: 'Compliance Summary', children: <ReportCard title="Compliance Summary" query="compliance-report" path="/compliance/report" /> },
    { key: 'admin', label: 'Administration Summary', children: <ReportCard title="Administration Summary" query="admin-report" path="/admin/report" /> },
    { key: 'expenses', label: 'Expense Analysis', children: <ExpenseAnalysis /> },
    { key: 'builder', label: 'Report Builder', children: <ReportBuilder /> },
  ];

  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<RiseOutlined />} label="Total sales" value={fmtMoney(totalSales)} hint="Reported sales" />
        <StatCard icon={<ShoppingCartOutlined />} label="Total purchases" value={fmtMoney(totalPurchases)} hint="Procurement" />
        <StatCard icon={<TeamOutlined />} label="Debtor balance" value={fmtMoney(totalDebtors)} hint="Receivables ageing" />
        <StatCard icon={<ShopOutlined />} label="Stock value" value={fmtMoney(stockValue)} hint="At weighted average cost" />
      </div>
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}>
        <Tabs items={items} defaultActiveKey="sales" destroyOnHidden />
      </Card>
    </div>
  );
}
