'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Drawer, Form, Input, InputNumber, Modal, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CreditCardOutlined, PlusOutlined, ReloadOutlined, BankOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { FinanceSummaryCard } from '@/components/finance-ui';
import { Can } from '@/components/Can';
import { CurrencyValue } from '@/components/sales-ui';

export default function CreditCardChargesPage() {
  const qc = useQueryClient();
  const cards = useQuery({ queryKey: ['/finance/credit-cards'], queryFn: () => api('/finance/credit-cards') });
  const ledger = useQuery({ queryKey: ['/finance/accounts'], queryFn: () => api('/finance/accounts') });
  const banks = useQuery({ queryKey: ['/finance/bank-accounts'], queryFn: () => api('/finance/bank-accounts') });
  const [cardId, setCardId] = useState('');
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [range, setRange] = useState<any>([dayjs().startOf('month'), dayjs()]);
  const [chargeForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const cardAccounts = cards.data || [];
  const sel = cardAccounts.find((c: any) => c.id === cardId) || cardAccounts[0];
  const expenseAccounts = (ledger.data || []).filter((a: any) => a.type === 'EXPENSE');

  const txns = useMemo(() => {
    let r = sel?.transactions || [];
    if (range?.[0] && range?.[1]) r = r.filter((x: any) => dayjs(x.date).isAfter(dayjs(range[0])) && dayjs(x.date).isBefore(dayjs(range[1]).endOf('day')));
    return r;
  }, [sel, range]);

  const charges = (sel?.transactions || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
  const payments = (sel?.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balance = charges - payments;
  const chargesMonth = txns.reduce((s: number, t: any) => s + Number(t.amount), 0);

  async function saveCharge() {
    try {
      const v = await chargeForm.validateFields();
      await api(`/finance/credit-cards/${sel.id}/transactions`, { method: 'POST', body: JSON.stringify({ date: v.date?.format('YYYY-MM-DD'), vendor: v.vendor, description: v.description, expenseAccountId: v.expenseAccountId, amount: Number(v.amount), reference: v.reference, memo: v.memo }) });
      message.success('Charge recorded'); setChargeOpen(false); chargeForm.resetFields(); qc.invalidateQueries({ queryKey: ['/finance/credit-cards'] });
    } catch (e: any) { message.error(e.message || 'Could not record charge'); }
  }
  async function savePay() {
    try {
      const v = await payForm.validateFields();
      await api(`/finance/credit-cards/${sel.id}/payments`, { method: 'POST', body: JSON.stringify({ date: v.date?.format('YYYY-MM-DD'), amount: Number(v.amount), bankAccountId: v.bankAccountId, reference: v.reference }) });
      message.success('Card payment posted'); setPayOpen(false); payForm.resetFields(); qc.invalidateQueries({ queryKey: ['/finance/credit-cards'] });
    } catch (e: any) { message.error(e.message || 'Could not post payment'); }
  }

  const cols: ColumnsType<any> = [
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => <span className="text-[13px] text-[#475060]">{dayjs(v).format('DD MMM YY')}</span> },
    { title: 'Vendor', dataIndex: 'vendor', width: 150, render: (v) => <span className="text-[13px] text-[#171a2e]">{v || '—'}</span> },
    { title: 'Description', dataIndex: 'description', render: (v) => <span className="text-[13px] text-[#64748b]">{v || '—'}</span> },
    { title: 'Expense Account', dataIndex: 'expenseAccount', render: (_v, r: any) => <span className="text-[12px] text-[#64748b]">{r.description}</span> },
    { title: 'Amount', dataIndex: 'amount', width: 130, align: 'right', render: (v) => <CurrencyValue value={v} /> },
  ];

  return (
    <div className="nex-fade">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-[#7c3aed] text-lg"><CreditCardOutlined /></span><div><h1 className="text-[24px] font-bold text-[#171a2e] leading-tight">Credit Card Charges</h1><p className="text-[13px] text-[#64748b] mt-0.5">Persisted card register linked to GL</p></div></div>
        <Can permission="finance.bank.manage"><Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/finance/credit-cards'] })}>Refresh</Button></Can>
      </div>

      <div className="nex-card mb-4 px-4 py-3 flex flex-wrap items-center gap-3">
        <Select className="!min-w-[190px] !rounded-lg" value={sel?.id} onChange={setCardId} options={cardAccounts.map((c: any) => ({ label: `${c.name} ···· ${c.last4 || ''}`, value: c.id }))} />
        <DatePicker.RangePicker className="!rounded-lg" value={range} onChange={setRange} />
        <Can permission="finance.bank.manage">
          <div className="ml-auto flex gap-2">
            <Button icon={<BankOutlined />} onClick={() => setPayOpen(true)}>Pay Card</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setChargeOpen(true)}>Add Charge</Button>
          </div>
        </Can>
      </div>

      <div className="nex-card mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eef0f6]"><div className="text-[15px] font-semibold text-[#171a2e]">{sel ? `${sel.name} ···· ${sel.last4 || ''}` : 'No card'}</div><div className="text-[12px] text-[#64748b]">Credit Card Register</div></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          <FinanceSummaryCard label="Current Balance" value={fmtMoney(balance)} valueColor="#7c3aed" />
          <FinanceSummaryCard label="Charges This Month" value={fmtMoney(chargesMonth)} valueColor="#f97316" />
          <FinanceSummaryCard label="Payments This Month" value={fmtMoney(payments)} valueColor="#16A34A" />
        </div>
      </div>

      <div className="nex-card">
        {!sel ? <div className="text-center py-14"><InboxOutlined className="text-4xl text-[#c7ccdd]" /><div className="text-[15px] font-semibold text-[#171a2e] mt-3">No credit card accounts</div><div className="text-[13px] text-[#64748b] mt-1">Add a card account first.</div></div>
          : <Table rowKey="id" loading={cards.isLoading} dataSource={txns} columns={cols} scroll={{ x: true }} pagination={{ pageSize: 10, showSizeChanger: false }} />}
      </div>

      <Drawer open={chargeOpen} onClose={() => setChargeOpen(false)} width={520} title="Add Charge" footer={<div className="flex justify-end gap-2"><Button onClick={() => setChargeOpen(false)}>Cancel</Button><Button type="primary" onClick={saveCharge}>Save Charge</Button></div>}>
        <Form form={chargeForm} layout="vertical">
          <Form.Item label="Date" name="date" className="!mb-3" initialValue={dayjs()}><DatePicker className="w-full" /></Form.Item>
          <Form.Item label="Vendor" name="vendor" className="!mb-3"><Input placeholder="Vendor / merchant" /></Form.Item>
          <Form.Item label="Description" name="description" className="!mb-3"><Input placeholder="Description" /></Form.Item>
          <Form.Item label="Expense Account" name="expenseAccountId" className="!mb-3" rules={[{ required: true, message: 'Select expense account' }]}><Select showSearch optionFilterProp="label" options={expenseAccounts.map((a: any) => ({ label: `${a.code} ${a.name}`, value: a.id }))} /></Form.Item>
          <Form.Item label="Amount" name="amount" className="!mb-3" rules={[{ required: true, message: 'Amount required' }]}><InputNumber className="w-full" prefix="$" min={0} /></Form.Item>
          <Form.Item label="Reference" name="reference" className="!mb-3"><Input placeholder="Reference" /></Form.Item>
          <Form.Item label="Memo" name="memo" className="!mb-3"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>

      <Modal open={payOpen} onCancel={() => setPayOpen(false)} onOk={savePay} title="Pay Credit Card" okText="Post Payment" width={480}>
        <Form form={payForm} layout="vertical" className="mt-2">
          <Form.Item label="Date" name="date" initialValue={dayjs()}><DatePicker className="w-full" /></Form.Item>
          <Form.Item label="Bank Account" name="bankAccountId" rules={[{ required: true, message: 'Select bank' }]}><Select showSearch optionFilterProp="label" options={(banks.data || []).map((b: any) => ({ label: b.name, value: b.id }))} /></Form.Item>
          <Form.Item label="Amount" name="amount" rules={[{ required: true, message: 'Amount required' }]}><InputNumber className="w-full" prefix="$" min={0} /></Form.Item>
          <Form.Item label="Reference" name="reference"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

