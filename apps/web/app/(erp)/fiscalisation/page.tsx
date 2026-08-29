'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page';
import { Alert, Button, Card, Col, Descriptions, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export default function Fiscal() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api('/fiscalisation/devices') });
  const invoices = useQuery({ queryKey: ['invoices-fiscal'], queryFn: () => api('/sales/invoices') });
  const creditNotes = useQuery({ queryKey: ['credit-notes-fiscal'], queryFn: () => api('/sales/credit-notes') });
  const debitNotes = useQuery({ queryKey: ['debit-notes-fiscal'], queryFn: () => api('/sales/debit-notes') });
  const receipts = useQuery({ queryKey: ['receipts'], queryFn: () => api('/fiscalisation/receipts') });
  const config = useQuery({ queryKey: ['fiscal-config'], queryFn: () => api('/fiscalisation/config') });
  const [invoiceId, setInvoiceId] = useState<string>();
  const [creditNoteId, setCreditNoteId] = useState<string>();
  const [debitNoteId, setDebitNoteId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const d = devices.data?.[0];
  const mode = config.data?.mode || 'mock';

  async function act(path: string, body?: any, msg = 'Operation completed') {
    try { await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); message.success(msg); qc.invalidateQueries(); } catch (e: any) { message.error(e.message); }
  }
  async function retry() {
    setBusy(true); try { const r = await api('/fiscalisation/retry', { method: 'POST' }); message.success(`Retried: ${r.retried}, remaining: ${r.remaining}`); qc.invalidateQueries(); } catch (e: any) { message.error(e.message); } finally { setBusy(false); }
  }
  const readyInvoices = (invoices.data || []).filter((i: any) => i.status !== 'DRAFT' && i.fiscalRequired && !i.fiscalReceipt);
  const readyCN = (creditNotes.data || []).filter((i: any) => i.status !== 'DRAFT' && !i.fiscalReceipt);
  const readyDN = (debitNotes.data || []).filter((i: any) => i.status !== 'DRAFT' && !i.fiscalReceipt);

  const colDefs: ColumnsType<any> = [
    { title: 'Type', dataIndex: 'receiptType', width: 150 },
    { title: 'Ref', render: (_v, r: any) => r.creditNote?.creditNoteNo || r.debitNote?.debitNoteNo || r.invoice?.invoiceNo || '—' },
    { title: 'Day', dataIndex: 'fiscalDayNo', width: 70 },
    { title: 'Receipt', dataIndex: 'receiptCounter', width: 80 },
    { title: 'Global', dataIndex: 'globalReceiptNo', width: 80 },
    { title: 'ZIMRA ID', dataIndex: 'zimraReceiptId', width: 130 },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <Tag color={v === 'FISCALISED' ? 'green' : v === 'RETRY' ? 'orange' : 'default'}>{v}</Tag> },
    { title: 'Attempts', dataIndex: 'attemptCount', width: 80, render: (v) => v || 0 },
    { title: 'Created', dataIndex: 'createdAt', width: 170, render: (v) => new Date(v).toLocaleString() },
  ];

  return (
    <>
      <PageHeader title="ZIMRA Fiscalisation" subtitle="Virtual fiscal device management and receipt lifecycle. Local build uses safe mock mode." />
      {devices.error && <Alert type="error" message={(devices.error as Error).message} />}
      <Alert className="mb-4" type={mode === 'mock' ? 'warning' : 'info'} showIcon message={`ZIMRA_MODE=${mode}${mode === 'mock' ? ' — no live ZIMRA transmission occurs.' : ' — official credentials required for live transmission.'}`} />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="Fiscal Device" loading={devices.isLoading} className="shadow-sm border-0">
            {d && <>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Device">{d.name}</Descriptions.Item>
                <Descriptions.Item label="Branch">{d.branch?.name}</Descriptions.Item>
                <Descriptions.Item label="Status"><Tag>{d.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Fiscal Day"><Tag color={d.dayStatus === 'OPEN' ? 'green' : 'default'}>{d.dayStatus} #{d.fiscalDayNo}</Tag></Descriptions.Item>
                <Descriptions.Item label="Daily Receipt">{d.receiptCounter}</Descriptions.Item>
                <Descriptions.Item label="Global Receipt">{d.globalReceiptNo}</Descriptions.Item>
                {d.certificateExpiresAt && <Descriptions.Item label="Certificate">{new Date(d.certificateExpiresAt).toLocaleDateString()} </Descriptions.Item>}
              </Descriptions>
              <Space wrap className="mt-4">
                {d.status === 'UNREGISTERED' && <Button type="primary" onClick={() => act(`/fiscalisation/devices/${d.id}/register`, undefined, 'Register Mock Device')}>Register Mock Device</Button>}
                {d.status === 'ACTIVE' && d.dayStatus !== 'OPEN' && <Button type="primary" onClick={() => act(`/fiscalisation/devices/${d.id}/open-day`, undefined, 'Open Fiscal Day')}>Open Fiscal Day</Button>}
                {d.dayStatus === 'OPEN' && <Button danger onClick={() => act(`/fiscalisation/devices/${d.id}/close-day`, undefined, 'Close Fiscal Day')}>Close Fiscal Day</Button>}
                <Button icon={<ReloadOutlined />} loading={busy} onClick={retry}>Retry Failed</Button>
              </Space>
            </>}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="Fiscalise Documents" className="shadow-sm border-0">
            <Space direction="vertical" className="w-full" size="middle">
              <Space.Compact className="w-full">
                <Select className="w-full" placeholder="Posted invoice" value={invoiceId} onChange={setInvoiceId} options={readyInvoices.map((i: any) => ({ label: `${i.invoiceNo} — $${i.total}`, value: i.id }))} />
                <Button type="primary" disabled={!d || d.dayStatus !== 'OPEN' || !invoiceId} onClick={() => act(`/fiscalisation/devices/${d.id}/fiscalise`, { invoiceId }, 'Invoice fiscalised')}>Fiscalise Invoice</Button>
              </Space.Compact>
              <Space.Compact className="w-full">
                <Select className="w-full" placeholder="Posted credit note" value={creditNoteId} onChange={setCreditNoteId} options={readyCN.map((i: any) => ({ label: `${i.creditNoteNo} — $${i.total}`, value: i.id }))} />
                <Button type="primary" disabled={!d || d.dayStatus !== 'OPEN' || !creditNoteId} onClick={() => act(`/fiscalisation/devices/${d.id}/fiscalise-credit-note`, { creditNoteId }, 'Credit note fiscalised')}>Fiscalise Credit Note</Button>
              </Space.Compact>
              <Space.Compact className="w-full">
                <Select className="w-full" placeholder="Posted debit note" value={debitNoteId} onChange={setDebitNoteId} options={readyDN.map((i: any) => ({ label: `${i.debitNoteNo} — $${i.total}`, value: i.id }))} />
                <Button type="primary" disabled={!d || d.dayStatus !== 'OPEN' || !debitNoteId} onClick={() => act(`/fiscalisation/devices/${d.id}/fiscalise-debit-note`, { debitNoteId }, 'Debit note fiscalised')}>Fiscalise Debit Note</Button>
              </Space.Compact>
            </Space>
            <div className="mt-4 text-sm text-slate-500">Post a document in Sales first. A fiscal day must be open. Credit notes must reference a fiscalised invoice.</div>
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Fiscal Receipts" className="shadow-sm border-0">
            <Table rowKey="id" loading={receipts.isLoading} dataSource={receipts.data || []} columns={colDefs} pagination={{ pageSize: 12, showSizeChanger: false }} />
          </Card>
        </Col>
      </Row>
    </>
  );
}

