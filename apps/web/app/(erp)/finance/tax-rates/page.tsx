'use client';
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'antd';
import { CrudPage, StatusTag, type Kpi } from '@/components/crud-page';
import { AccountBookOutlined, PercentageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { fmtNumber } from '@/lib/format';

export default function TaxRatesPage() {
  const list = useQuery({ queryKey: ['/finance/tax-rates'], queryFn: () => api('/finance/tax-rates') });
  const kpis: Kpi[] = [
    { label: 'Tax rates', value: list.data?.length || 0, icon: <AccountBookOutlined />, color: '#003366' },
    { label: 'Average rate', value: `${fmtNumber((list.data || []).reduce((s: number, r: any) => s + Number(r.rate), 0) / Math.max(1, (list.data || []).length))}%`, icon: <PercentageOutlined />, color: '#0ea5e9' },
    { label: 'Defaults', value: (list.data || []).filter((r: any) => r.isDefault).length, icon: <CheckCircleOutlined />, color: '#10b981' },
  ];

  return (
    <CrudPage title="Tax Rates" subtitle="Sales tax / VAT rates used on documents" path="/finance/tax-rates" createLabel="Tax rate" canDelete kpis={kpis}
      columns={[
        { title: 'Name', dataIndex: 'name', render: (v) => <span className="font-medium">{v}</span> },
        { title: 'Rate %', dataIndex: 'rate', width: 120, render: (v) => <span className="font-semibold">{fmtNumber(v)}%</span> },
        { title: 'Default', dataIndex: 'isDefault', width: 100, render: (v) => (v ? <Tag color="blue" style={{ borderRadius: 8 }}>Default</Tag> : <span className="text-[#c3c7dc]">—</span>) },
        { title: 'Active', dataIndex: 'active', width: 90, render: (v) => <StatusTag value={v ? 'ACTIVE' : 'INACTIVE'} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. VAT 15%' },
        { name: 'rate', label: 'Rate (%)', type: 'number', required: true, defaultValue: 15.5 },
        { name: 'isDefault', label: 'Default', type: 'select', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], defaultValue: false },
        { name: 'active', label: 'Active', type: 'select', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], defaultValue: true },
      ]}
    />
  );
}
