'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, InputNumber, Select, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { api } from '@/lib/api';

export default function WriteCheckPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api('/procurement/suppliers').then((d) => setSuppliers(d || [])).catch(() => {}); }, []);

  async function submit() {
    try {
      const v = await form.validateFields();
      setSaving(true);
      await api('/procurement/supplier-payments', { method: 'POST', body: JSON.stringify({ amount: Number(v.amount), method: 'CHECK', referenceNo: v.referenceNo, note: v.note, paidAt: v.paidAt?.format('YYYY-MM-DD') }) });
      message.success('Check recorded');
      qc.invalidateQueries({ queryKey: ['/procurement/supplier-payments'] });
      location.href = '/expenses/pay-bill';
    } catch (e: any) { message.error(e.message || 'Could not record check'); }
    finally { setSaving(false); }
  }

  return (
    <div className="nex-fade max-w-[720px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/expenses/pay-bill" className="inline-flex items-center gap-2 rounded-lg border border-[#e6e9f0] px-3 py-1.5 text-[13px] text-[#475060] hover:border-[#cbd5e8] hover:text-[#003366]"><ArrowLeftOutlined /> Back</Link>
        <h1 className="text-[22px] font-bold text-[#171a2e] m-0">Write Check</h1>
      </div>

      <div className="nex-card p-6">
        <Form form={form} layout="vertical" className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Form.Item label="Payee / Supplier" name="referenceNo" className="!mb-3 md:col-span-2">
            <Select showSearch placeholder="Write payee name" optionFilterProp="label" options={suppliers.map((s: any) => ({ label: s.name, value: s.name }))} />
          </Form.Item>
          <Form.Item label="Amount" name="amount" className="!mb-3" rules={[{ required: true, message: 'Amount required' }]}><InputNumber className="w-full" prefix="$" min={0} /></Form.Item>
          <Form.Item label="Date" name="paidAt" className="!mb-3" initialValue={dayjs()}><DatePicker className="w-full" /></Form.Item>
          <Form.Item label="Check / Reference No" name="referenceNo2" className="!mb-3"><Input placeholder="Check number" /></Form.Item>
          <Form.Item label="Memo" name="note" className="!mb-3"><Input placeholder="Memo" /></Form.Item>
        </Form>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <Link href="/expenses/pay-bill"><Button>Cancel</Button></Link>
        <Button type="primary" onClick={submit} loading={saving}>Record Check</Button>
      </div>
    </div>
  );
}

