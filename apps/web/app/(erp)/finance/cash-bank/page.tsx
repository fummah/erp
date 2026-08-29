'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BankOutlined, PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Can } from '@/components/Can';
import { StatusPill } from '@/components/sales-ui';

export default function CashBankPage() {
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ['/finance/bank-accounts'], queryFn: () => api('/finance/bank-accounts') });
  const ledger = useQuery({ queryKey: ['/finance/accounts'], queryFn: () => api('/finance/accounts') });
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const assetAccounts = (ledger.data || []).filter((a: any) => a.type === 'ASSET');

  async function createAccount() {
    try {
      const v = await createForm.validateFields();
      await api('/finance/bank-accounts', { method: 'POST', body: JSON.stringify(v) });
      message.success('Account created'); setCreateOpen(false); createForm.resetFields(); qc.invalidateQueries({ queryKey: ['/finance/bank-accounts'] });
    } catch (e: any) { message.error(e.message || 'Could not create account'); }
  }
  async function transfer() {
    try {
      const v = await transferForm.validateFields();
      await api('/finance/bank-transfers', { method: 'POST', body: JSON.stringify({ fromAccountId: v.from, toAccountId: v.to, date: v.date?.format('YYYY-MM-DD'), amount: Number(v.amount), reference: v.reference, memo: v.memo }) });
      message.success('Transfer posted'); setTransferOpen(false); transferForm.resetFields(); qc.invalidateQueries({ queryKey: ['/finance/bank-transfers'] });
    } catch (e: any) { message.error(e.message || 'Could not post transfer'); }
  }

  const cols: ColumnsType<any> = [
    { title: 'Name', dataIndex: 'name', render: (v) => <span className="text-[13px] font-medium text-[#171a2e]">{v}</span> },
    { title: 'Type', dataIndex: 'type', width: 100, render: (v) => <StatusPill status={v} /> },
    { title: 'Bank', dataIndex: 'bankName', render: (v) => <span className="text-[13px] text-[#64748b]">{v || '—'}</span> },
    { title: 'Account', dataIndex: 'accountNumberMasked', render: (v) => <span className="font-mono text-[12px] text-[#475060]">{v || '—'}</span> },
    { title: 'Currency', dataIndex: 'currency', width: 90 },
    { title: 'GL Account', render: (_v, r) => <span className="text-[12px] text-[#64748b]">{r.ledgerAccount?.code} · {r.ledgerAccount?.name}</span> },
    { title: 'Status', dataIndex: 'active', width: 100, render: (v) => <StatusPill status={v ? 'Active' : 'Inactive'} /> },
  ];

  return (
    <div className="nex-fade">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><h1 className="text-[26px] font-bold text-[#171a2e] m-0">Cash & Bank</h1></div>
        <Can permission="finance.bank.manage">
          <div className="flex items-center gap-2">
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['/finance/bank-accounts'] })} />
            <Button icon={<SwapOutlined />} onClick={() => setTransferOpen(true)}>Bank Transfer</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Account</Button>
          </div>
        </Can>
      </div>
      <div className="nex-card"><Table rowKey="id" loading={accounts.isLoading} dataSource={accounts.data || []} columns={cols} scroll={{ x: true }} pagination={false} /></div>

      <Modal open={createOpen} onCancel={() => setCreateOpen(false)} onOk={createAccount} title="New Bank / Cash Account" okText="Save" width={560}>
        <Form form={createForm} layout="vertical" className="mt-2">
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Name required' }]}><Input placeholder="e.g. Main Bank" /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Type" name="type" initialValue="BANK"><Select options={['BANK', 'CASH'].map((t) => ({ label: t, value: t }))} /></Form.Item>
            <Form.Item label="Currency" name="currency" initialValue="USD"><Input /></Form.Item>
          </div>
          <Form.Item label="Bank Name" name="bankName"><Input placeholder="Bank name" /></Form.Item>
          <Form.Item label="Account No. (masked)" name="accountNumberMasked"><Input placeholder="•••• 1234" /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Opening Balance" name="openingBalance" initialValue={0}><InputNumber className="w-full" prefix="$" min={0} /></Form.Item>
            <Form.Item label="GL Account" name="ledgerAccountId" rules={[{ required: true, message: 'GL account required' }]}><Select showSearch optionFilterProp="label" placeholder="Select asset account" options={assetAccounts.map((a: any) => ({ label: `${a.code} ${a.name}`, value: a.id }))} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal open={transferOpen} onCancel={() => setTransferOpen(false)} onOk={transfer} title="Bank Transfer" okText="Post Transfer" width={560}>
        <Form form={transferForm} layout="vertical" className="mt-2">
          <Form.Item label="From Account" name="from" rules={[{ required: true, message: 'From required' }]}><Select options={(accounts.data || []).map((a: any) => ({ label: a.name, value: a.id }))} /></Form.Item>
          <Form.Item label="To Account" name="to" rules={[{ required: true, message: 'To required' }]}><Select options={(accounts.data || []).map((a: any) => ({ label: a.name, value: a.id }))} /></Form.Item>
          <Form.Item label="Date" name="date"><DatePicker className="w-full" /></Form.Item>
          <Form.Item label="Amount" name="amount" rules={[{ required: true, message: 'Amount required' }]}><InputNumber className="w-full" prefix="$" min={0} /></Form.Item>
          <Form.Item label="Reference" name="reference"><Input placeholder="Reference" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

