'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Can } from '@/components/Can';
import { CurrencyValue, StatusPill } from '@/components/sales-ui';

type Line = { key: number; description: string; quantity: number; unitPrice: number; taxRate: number };
function t(l: Line) { const net = Number(l.quantity || 0) * Number(l.unitPrice || 0); const tax = net * (Number(l.taxRate || 0) / 100); return { net, tax, total: net + tax }; }

export default function VendorCreditsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['/finance/vendor-credits'], queryFn: () => api('/finance/vendor-credits') });
  const suppliers = useQuery({ queryKey: ['/procurement/suppliers'], queryFn: () => api('/procurement/suppliers') });
  const bills = useQuery({ queryKey: ['/procurement/supplier-invoices'], queryFn: () => api('/procurement/supplier-invoices') });
  const [createOpen, setCreateOpen] = useState(false);
  const [applyTo, setApplyTo] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [applyBill, setApplyBill] = useState('');
  const [applyAmount, setApplyAmount] = useState(0);
  const [form] = Form.useForm();

  const total = lines.reduce((s, l) => s + t(l).total, 0);

  async function save() {
    try {
      const v = await form.validateFields();
      await api('/finance/vendor-credits', { method: 'POST', body: JSON.stringify({ supplierId: v.supplierId, reason: v.reason, lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity || 0), unitPrice: Number(l.unitPrice || 0), taxRate: Number(l.taxRate || 0) })) }) });
      message.success('Vendor credit created'); setCreateOpen(false); setLines([]); form.resetFields(); qc.invalidateQueries({ queryKey: ['/finance/vendor-credits'] });
    } catch (e: any) { message.error(e.message || 'Could not create'); }
  }
  async function post(id: string) { try { await api(`/finance/vendor-credits/${id}/post`, { method: 'POST' }); message.success('Vendor credit posted'); qc.invalidateQueries({ queryKey: ['/finance/vendor-credits'] }); } catch (e: any) { message.error(e.message); } }
  async function apply() {
    try {
      if (!applyTo) return;
      await api(`/finance/vendor-credits/${applyTo.id}/apply`, { method: 'POST', body: JSON.stringify({ supplierInvoiceId: applyBill, amount: applyAmount }) });
      message.success('Applied to bill'); setApplyTo(null); qc.invalidateQueries({ queryKey: ['/finance/vendor-credits'] });
    } catch (e: any) { message.error(e.message); }
  }
  async function del(id: string) { try { await api(`/finance/vendor-credits/${id}`, { method: 'DELETE' }).catch(() => {}); message.success('Deleted'); qc.invalidateQueries({ queryKey: ['/finance/vendor-credits'] }); } catch (e: any) { message.error(e.message); } }

  const cols: ColumnsType<any> = [
    { title: 'Credit #', dataIndex: 'vendorCreditNo', width: 130, render: (v) => <span className="font-mono text-[12px] font-semibold text-[#003366]">{v}</span> },
    { title: 'Supplier', dataIndex: 'supplier', render: (_v, r) => <span className="text-[13px] text-[#171a2e]">{r.supplier?.name || '—'}</span> },
    { title: 'Date', dataIndex: 'creditDate', width: 120, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YY')}</span> },
    { title: 'Total', dataIndex: 'total', width: 130, align: 'right', render: (v) => <CurrencyValue value={v} /> },
    { title: 'Applied', width: 130, align: 'right', render: (_, r) => <span className="text-[13px] text-[#16a34a]">{fmtMoney((r.applications || []).reduce((s: number, a: any) => s + Number(a.amount), 0))}</span> },
    { title: 'Available', width: 130, align: 'right', render: (_, r) => <span className="text-[13px] font-semibold text-[#f59e0b]">{fmtMoney(Math.max(0, Number(r.total) - (r.applications || []).reduce((s: number, a: any) => s + Number(a.amount), 0)))}</span> },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <StatusPill status={v.replace(/_/g, ' ')} /> },
    { title: 'Actions', key: 'a', width: 200, align: 'right', render: (_, r: any) => (
      <Can permission="finance.vendorcredits.manage">
        <div className="flex items-center gap-1 justify-end">
          {r.status === 'DRAFT' && <Button size="small" type="primary" onClick={() => post(r.id)}>Post</Button>}
          {['POSTED', 'PART_APPLIED'].includes(r.status) && <Button size="small" onClick={() => setApplyTo(r)}>Apply</Button>}
          <Popconfirm title="Delete?" onConfirm={() => del(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </div>
      </Can>
    ) },
  ];

  return (
    <div className="nex-fade">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[26px] font-bold text-[#171a2e] leading-tight">Vendor Credits</h1><p className="text-[13px] text-[#64748b] mt-1">Create credits when a supplier issues a credit against a bill, then apply them</p></div>
        <Can permission="finance.vendorcredits.manage">
          <div className="flex gap-2">
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/finance/vendor-credits'] })} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setLines([{ key: 1, description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]); setCreateOpen(true); }}>New Vendor Credit</Button>
          </div>
        </Can>
      </div>
      <div className="nex-card"><Table rowKey="id" loading={list.isLoading} dataSource={list.data || []} columns={cols} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false }} /></div>

      <Modal open={createOpen} onCancel={() => setCreateOpen(false)} onOk={save} title="New Vendor Credit" okText="Create" width={640}>
        <Form form={form} layout="vertical" className="mt-2">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Supplier" name="supplierId" rules={[{ required: true, message: 'Supplier required' }]}><Select showSearch optionFilterProp="label" options={suppliers.data?.map((s: any) => ({ label: s.name, value: s.id }))} /></Form.Item>
            <Form.Item label="Reason" name="reason"><Input placeholder="Reason for credit" /></Form.Item>
          </div>
          <div className="mb-2 text-[13px] font-semibold text-[#344054]">Lines</div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[2fr_0.8fr_1fr_0.8fr_40px] gap-2 items-center mb-2">
              <Input value={l.description} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)))} placeholder="Description" />
              <InputNumber className="w-full" min={0} value={l.quantity} onChange={(v) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, quantity: Number(v || 0) } : x)))} />
              <InputNumber className="w-full" min={0} prefix="$" value={l.unitPrice} onChange={(v) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, unitPrice: Number(v || 0) } : x)))} />
              <InputNumber className="w-full" min={0} prefix="%" value={l.taxRate} onChange={(v) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, taxRate: Number(v || 0) } : x)))} />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} />
            </div>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setLines((p) => [...p, { key: p.length + 1, description: '', quantity: 1, unitPrice: 0, taxRate: 0 }])}>Add Line</Button>
          <div className="flex justify-end mt-3 text-[14px] font-semibold text-[#003366]">Total: {fmtMoney(total)}</div>
        </Form>
      </Modal>

      <Modal open={!!applyTo} onCancel={() => setApplyTo(null)} onOk={apply} title="Apply Vendor Credit" okText="Apply" width={480}>
        <div className="space-y-4 mt-2">
          <div className="text-[13px] text-[#344054]">Vendor Credit <span className="font-semibold">{applyTo?.vendorCreditNo}</span> — available <span className="font-semibold text-[#f59e0b]">{fmtMoney(Math.max(0, Number(applyTo?.total || 0) - (applyTo?.applications || []).reduce((s: number, a: any) => s + Number(a.amount), 0)))}</span></div>
          <Select className="w-full" placeholder="Select bill" value={applyBill || undefined} onChange={setApplyBill} options={(bills.data || []).map((b: any) => ({ label: `${b.invoiceNo} — ${b.supplier?.name || ''} (${fmtMoney(b.total)})`, value: b.id }))} />
          <InputNumber className="w-full" prefix="$" min={0} placeholder="Amount" value={applyAmount} onChange={(v) => setApplyAmount(Number(v || 0))} />
        </div>
      </Modal>
    </div>
  );
}

