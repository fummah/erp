'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileDoneOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, WalletOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { StatusPill, CurrencyValue } from '@/components/sales-ui';

export default function PayBillsPage() {
  const qc = useQueryClient();
  const bills = useQuery({ queryKey: ['/procurement/supplier-invoices'], queryFn: () => api('/procurement/supplier-invoices') });
  const suppliers = useQuery({ queryKey: ['/procurement/suppliers'], queryFn: () => api('/procurement/suppliers') });
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('');
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [paying, setPaying] = useState(false);

  const bal = (i: any) => Math.max(0, Number(i.total || 0) - (i.payments || []).reduce((x: number, p: any) => x + Number(p.amount), 0));
  const eligible = useMemo(() => bills.data?.filter((i: any) => bal(i) > 0.01) || [], [bills.data]);

  const rows = useMemo(() => {
    let r = eligible;
    if (q) r = r.filter((i: any) => `${i.invoiceNo} ${i.supplier?.name || ''} ${i.lines?.map((l: any) => l.description).join(' ') || ''}`.toLowerCase().includes(q.toLowerCase()));
    if (vendor) r = r.filter((i: any) => i.supplierId === vendor);
    return r;
  }, [eligible, q, vendor]);

  const columns: ColumnsType<any> = [
    { title: 'Bill #', dataIndex: 'invoiceNo', width: 130, render: (v) => <span className="font-mono text-[12px] font-semibold text-[#003366]">{v}</span> },
    { title: 'Vendor', dataIndex: 'supplier', render: (_v, r) => <span className="text-[13px] text-[#171a2e]">{r.supplier?.name || '—'}</span> },
    { title: 'Date', dataIndex: 'invoiceDate', width: 110, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YY')}</span> },
    { title: 'Amount', dataIndex: 'total', width: 130, align: 'right', render: (v) => <CurrencyValue value={v} /> },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <StatusPill status={v} /> },
  ];

  async function pay() {
    if (!selected.length) { message.warning('Select at least one bill'); return; }
    const chosen = eligible.filter((i: any) => selected.includes(i.id));
    if (!chosen.length) { message.warning('Nothing to pay'); return; }
    setPaying(true);
    try {
      for (const b of chosen) {
        await api('/procurement/supplier-payments', { method: 'POST', body: JSON.stringify({ supplierInvoiceId: b.id, amount: bal(b), method: 'CHECK', paidAt: dayjs().format('YYYY-MM-DD'), note: `Auto-check for ${b.invoiceNo}` }) });
      }
      message.success(`Paid ${chosen.length} bill${chosen.length > 1 ? 's' : ''}`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['/procurement/supplier-invoices'] });
      qc.invalidateQueries({ queryKey: ['/procurement/supplier-payments'] });
    } catch (e: any) { message.error(e.message || 'Payment failed'); }
    finally { setPaying(false); }
  }

  return (
    <div className="nex-fade">
      <div className="nex-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eef0f6]">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-[#003366] text-base"><WalletOutlined /></span>
            <div><div className="text-[18px] font-semibold text-[#171a2e]">Pay Bills – Auto-Create Check</div><div className="text-[12px] text-[#64748b]">Select bills to pay, then create one check per vendor</div></div>
          </div>
          <Button type="primary" icon={<PrinterOutlined />} onClick={pay} loading={paying}>Pay Selected ({selected.length})</Button>
        </div>

        <div className="px-6 py-3 border-b border-[#eef0f6] flex flex-wrap items-center gap-3">
          <Input allowClear prefix={<SearchOutlined />} placeholder="Search bill #, vendor, description" className="w-80 !rounded-lg" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Filter by vendor" className="!min-w-[180px] !rounded-lg" value={vendor || undefined} onChange={setVendor} options={(suppliers.data || []).map((s: any) => ({ label: s.name, value: s.id }))} />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/procurement/supplier-invoices'] })} />
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-14"><InboxOutlined className="text-3xl text-[#c7ccdd]" /><div className="text-[15px] font-semibold text-[#171a2e] mt-3">No bills available for payment.</div></div>
        ) : (
          <Table
            rowKey="id"
            loading={bills.isLoading}
            dataSource={rows}
            columns={columns}
            scroll={{ x: true }}
            rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (r: any) => ({ disabled: bal(r) <= 0.01 }) }}
            pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} bills` }}
          />
        )}
      </div>
    </div>
  );
}

