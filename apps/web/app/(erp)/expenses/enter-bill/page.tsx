'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, InputNumber, Select, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Line = { key: number; description: string; quantity: number; unitPrice: number };
function t(l: Line) { return Number(l.quantity || 0) * Number(l.unitPrice || 0); }

export default function EnterBillPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([{ key: 1, description: '', quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api('/procurement/suppliers').then((d) => setSuppliers(d || [])).catch(() => {}); }, []);
  const total = lines.reduce((s, l) => s + t(l), 0);
  const tax = total * (0.155);
  const grand = total + tax;

  function upd(k: number, p: Partial<Line>) { setLines((prev) => prev.map((l) => (l.key === k ? { ...l, ...p } : l))); }
  function rem(k: number) { setLines((prev) => prev.filter((l) => l.key !== k)); }
  function add() { setLines((prev) => [...prev, { key: prev.length + 1, description: '', quantity: 1, unitPrice: 0 }]); }

  async function submit() {
    try {
      const v = await form.validateFields();
      setSaving(true);
      await api('/procurement/supplier-invoices', { method: 'POST', body: JSON.stringify({ supplierId: v.supplierId, invoiceDate: v.invoiceDate?.format('YYYY-MM-DD'), dueDate: v.dueDate?.format('YYYY-MM-DD'), currency: 'USD', lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity || 0), unitPrice: Number(l.unitPrice || 0), taxRate: 0 })) }) });
      message.success('Bill entered');
      qc.invalidateQueries({ queryKey: ['/procurement/supplier-invoices'] });
      location.href = '/expenses/bills';
    } catch (e: any) { message.error(e.message || 'Could not save bill'); }
    finally { setSaving(false); }
  }

  return (
    <div className="nex-fade max-w-[960px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/expenses/bills" className="inline-flex items-center gap-2 rounded-lg border border-[#e6e9f0] px-3 py-1.5 text-[13px] text-[#475060] hover:border-[#cbd5e8] hover:text-[#003366]"><ArrowLeftOutlined /> Back</Link>
        <h1 className="text-[22px] font-bold text-[#171a2e] m-0">Enter Bill</h1>
      </div>

      <div className="nex-card p-6">
        <Form form={form} layout="vertical" className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          <Form.Item label="Supplier" name="supplierId" className="!mb-3" rules={[{ required: true, message: 'Select a supplier' }]}>
            <Select showSearch placeholder="Select supplier" optionFilterProp="label" options={suppliers.map((s: any) => ({ label: s.name, value: s.id }))} />
          </Form.Item>
          <Form.Item label="Bill Date" name="invoiceDate" className="!mb-3" initialValue={dayjs()}><DatePicker className="w-full" /></Form.Item>
          <Form.Item label="Due Date" name="dueDate" className="!mb-3"><DatePicker className="w-full" /></Form.Item>
        </Form>

        <div className="flex items-center gap-3 my-4"><div className="h-px flex-1 bg-[#eef0f6]" /><span className="text-[13px] font-semibold text-[#475060]">Line Items</span><div className="h-px flex-1 bg-[#eef0f6]" /></div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-3 px-3 py-2 text-[12px] font-semibold text-[#64748b] uppercase tracking-wide"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span /></div>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-3 items-center py-2 border-t border-[#f0f1f6]">
                <Input value={l.description} onChange={(e) => upd(l.key, { description: e.target.value })} placeholder="Description" />
                <InputNumber className="w-full" min={0} value={l.quantity} onChange={(v) => upd(l.key, { quantity: Number(v || 0) })} />
                <InputNumber className="w-full" min={0} prefix="$" value={l.unitPrice} onChange={(v) => upd(l.key, { unitPrice: Number(v || 0) })} />
                <div className="text-[13px] font-semibold text-[#171a2e] text-right">{fmtMoney(t(l))}</div>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => rem(l.key)} />
              </div>
            ))}
          </div>
        </div>
        <Button type="dashed" block icon={<PlusOutlined />} onClick={add} className="mt-3">Add Line</Button>

        <div className="flex flex-col items-end mt-6 space-y-1.5">
          <div className="flex items-center gap-6 text-[13px] text-[#475060]"><span>Subtotal</span><span className="min-w-[110px] text-right text-[#171a2e] font-medium">{fmtMoney(total)}</span></div>
          <div className="flex items-center gap-6 text-[13px] text-[#475060]"><span>Tax</span><span className="min-w-[110px] text-right text-[#171a2e] font-medium">{fmtMoney(tax)}</span></div>
          <div className="flex items-center gap-6 text-[16px] font-bold text-[#171a2e] border-t border-[#eef0f6] pt-2"><span>Total</span><span className="min-w-[110px] text-right text-[#003366]">{fmtMoney(grand)}</span></div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <Link href="/expenses/bills"><Button>Cancel</Button></Link>
        <Button type="primary" onClick={submit} loading={saving}>Save Bill</Button>
      </div>
    </div>
  );
}

