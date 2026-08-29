'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Descriptions, Empty, Space, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, EditOutlined, FileDoneOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusTag } from '@/components/crud-page';
import { fmtDate, fmtMoney } from '@/lib/format';

export default function SupplierDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['/procurement/suppliers', id], queryFn: () => api(`/procurement/suppliers/${id}`) });
  const [tab, setTab] = useState('overview');
  if (isLoading) return <div className="p-8 text-[#8a90ad]">Loading supplier…</div>;
  if (!data) return <Empty description="Supplier not found" />;
  const { supplier, outstanding, purchaseOrders, grns, invoices, payments } = data;

  const invCols: ColumnsType<any> = [
    { title: 'Bill #', dataIndex: 'invoiceNo', render: (v: any) => <span className="font-medium">{v}</span> },
    { title: 'Supplier Inv #', dataIndex: 'supplierInvoiceNo' },
    { title: 'Date', dataIndex: 'invoiceDate', width: 100, render: fmtDate },
    { title: 'Due', dataIndex: 'dueDate', width: 100, render: (v: any) => (v ? fmtDate(v) : '—') },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: 'Balance', dataIndex: 'balanceDue', align: 'right', render: (v: any) => <span className="font-semibold text-[#F97316]">{fmtMoney(v)}</span> },
    { title: 'Payment', dataIndex: 'paymentStatus', width: 120, render: (v: any) => <StatusTag value={v} /> },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
  ];
  const orderCols: ColumnsType<any> = [
    { title: 'PO #', dataIndex: 'poNo', width: 110 },
    { title: 'Date', dataIndex: 'orderDate', width: 100, render: fmtDate },
    { title: 'Expected', dataIndex: 'expectedDate', width: 100, render: (v: any) => (v ? fmtDate(v) : '—') },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v: any) => <StatusTag value={v} /> },
    { title: 'Receipt', dataIndex: 'receiptStatus', width: 150, render: (v: any) => <StatusTag value={v} /> },
    { title: 'Billing', dataIndex: 'billingStatus', width: 150, render: (v: any) => <StatusTag value={v} /> },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v: any) => fmtMoney(v) },
  ];
  const grnCols: ColumnsType<any> = [
    { title: 'GRN', dataIndex: 'grnNo', width: 110 },
    { title: 'Date', dataIndex: 'receivedAt', width: 110, render: fmtDate },
    { title: 'PO', render: (_: any, r: any) => r.purchaseOrder?.orderNo || '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
  ];
  const payCols: ColumnsType<any> = [
    { title: 'Payment', dataIndex: 'paymentNo', width: 110 },
    { title: 'Date', dataIndex: 'paidAt', width: 110, render: fmtDate },
    { title: 'Method', dataIndex: 'method', width: 100 },
    { title: 'Reference', dataIndex: 'referenceNo' },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v: any) => fmtMoney(v) },
  ];

  const statementRows: any[] = [];
  invoices.filter((i: any) => i.status !== 'DRAFT').forEach((i: any) => statementRows.push({ key: `inv-${i.id}`, date: i.invoiceDate, type: 'Supplier Invoice', doc: i.invoiceNo, debit: 0, credit: Number(i.total), balance: 0 }));
  payments.forEach((p: any) => statementRows.push({ key: `pay-${p.id}`, date: p.paidAt, type: 'Payment', doc: p.paymentNo, debit: Number(p.amount), credit: 0, balance: 0 }));
  statementRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let run = 0;
  statementRows.forEach((r) => { run += Number(r.credit) - Number(r.debit); r.balance = run; });

  const overviewItems = [
    { label: 'Supplier Code', value: supplier.code },
    { label: 'Supplier Type', value: supplier.vendorType },
    { label: 'Status', value: supplier.status },
    { label: 'Contact', value: [supplier.contactName, supplier.jobTitle].filter(Boolean).join(' · ') || '—' },
    { label: 'Email', value: supplier.email },
    { label: 'Phone', value: supplier.phone },
    { label: 'Mobile', value: supplier.mobile },
    { label: 'Address', value: [supplier.address1, supplier.address2, supplier.city, supplier.country].filter(Boolean).join(', ') },
    { label: 'TIN', value: supplier.tin },
    { label: 'VAT', value: supplier.vatRegistered ? supplier.vatNumber || 'VAT registered' : 'Not registered' },
    { label: 'Payment Terms', value: supplier.paymentTerms },
    { label: 'Currency', value: supplier.currency },
    { label: 'Credit Limit', value: fmtMoney(supplier.creditLimit) },
    { label: 'Preferred', value: supplier.preferred ? 'Yes' : 'No' },
    { label: 'Website', value: supplier.website },
  ].filter((i) => i.value != null && i.value !== '' && i.value !== '—');

  const tabItems = [
    { key: 'overview', label: 'Overview', children: <Descriptions column={2} size="small" bordered items={overviewItems.map((v) => ({ key: v.label, label: v.label, children: <span className="text-[13px]">{v.value}</span> }))} /> },
    { key: 'orders', label: 'Purchase Orders', children: <Table rowKey="id" dataSource={purchaseOrders} columns={orderCols} pagination={false} size="small" /> },
    { key: 'grns', label: 'GRNs', children: <Table rowKey="id" dataSource={grns} columns={grnCols} pagination={false} size="small" /> },
    { key: 'bills', label: 'Supplier Invoices', children: <Table rowKey="id" dataSource={invoices} columns={invCols} pagination={false} size="small" /> },
    { key: 'payments', label: 'Payments', children: <Table rowKey="id" dataSource={payments} columns={payCols} pagination={false} size="small" /> },
    { key: 'statement', label: 'Statement', children: <Table rowKey="key" dataSource={statementRows} pagination={false} size="small" columns={[{ title: 'Date', dataIndex: 'date', render: fmtDate }, { title: 'Type', dataIndex: 'type', width: 150 }, { title: 'Document', dataIndex: 'doc', width: 130 }, { title: 'Debit', dataIndex: 'debit', align: 'right', render: (v: any) => fmtMoney(v) }, { title: 'Credit', dataIndex: 'credit', align: 'right', render: (v: any) => fmtMoney(v) }, { title: 'Balance', dataIndex: 'balance', align: 'right', render: (v: any) => <span className="font-semibold">{fmtMoney(v)}</span> }]} /> },
  ];

  return (
    <div className="nex-fade">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
          <div>
            <div className="flex items-center gap-2"><h1 className="text-[24px] font-bold text-[#171a2e]">{supplier.name}</h1><Tag style={{ borderRadius: 8 }}>{supplier.code}</Tag><StatusTag value={supplier.status} /></div>
            <div className="text-[13px] text-[#64748b]">{supplier.vendorType || 'Supplier'} · {supplier.currency}{supplier.paymentTerms ? ` · ${supplier.paymentTerms}` : ''}</div>
          </div>
        </div>
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => router.push('/procurement')}>Edit</Button>
          <Button icon={<FileDoneOutlined />} onClick={() => router.push('/procurement')} disabled>New Purchase Order</Button>
        </Space>
      </div>
      <div className="nex-card mb-5 px-5 py-4 flex flex-wrap gap-8 !rounded-xl">
        {[{ l: 'Outstanding AP', v: outstanding, c: '#F97316' }, { l: 'Purchase Orders', v: purchaseOrders.length, c: '#003366' }, { l: 'Open Bills', v: invoices.filter((i: any) => i.status !== 'DRAFT' && Number(i.balanceDue) > 0).length, c: '#2563eb' }, { l: 'Total Payments', v: fmtMoney(payments.reduce((s: number, p: any) => s + Number(p.amount), 0)), c: '#10b981' }].map((k) => (<div key={k.l}><div className="text-[12px] text-[#64748b] flex items-center gap-1"><UserOutlined className="text-[#a1a6c0]" />{k.l}</div><div className="text-[20px] font-bold" style={{ color: k.c }}>{k.v}</div></div>))}
      </div>
      <Card className="nex-card" styles={{ body: { padding: '14px 20px' } }}><Tabs items={tabItems} activeKey={tab} onChange={setTab} destroyOnHidden /></Card>
    </div>
  );
}
