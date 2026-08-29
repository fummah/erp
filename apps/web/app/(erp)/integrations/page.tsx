'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page';
import { Alert, Button, Card, Col, Descriptions, Input, Row, Space, Table, Tag, message } from 'antd';
import { CheckOutlined, CloudServerOutlined, CreditCardOutlined, DatabaseOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons';

function Adapters() {
  const providers = useQuery({ queryKey: ['/integrations/providers'], queryFn: () => api('/integrations/providers') });
  const billing = useQuery({ queryKey: ['/integrations/billing'], queryFn: () => api('/integrations/billing') });
  const usage = useQuery({ queryKey: ['/integrations/usage'], queryFn: () => api('/integrations/usage') });
  const [amount, setAmount] = useState('100');
  const [to, setTo] = useState('ops@demo.local');

  async function charge() {
    try { const r = await api('/integrations/payments', { method: 'POST', body: JSON.stringify({ amount: Number(amount), currency: 'USD', method: 'card' }) }); message.success(`Charge ${r.status} — ${r.reference}`); } catch (e: any) { message.error(e.message); }
  }
  async function send() {
    try { const r = await api('/integrations/messages/send', { method: 'POST', body: JSON.stringify({ to, via: 'email', subject: 'NexusERP test', text: 'Hello from NexusERP' }) }); message.success(`Message ${r.status} — ${r.id}`); } catch (e: any) { message.error(e.message); }
  }
  async function enqueue() {
    try { const r = await api('/integrations/queue', { method: 'POST', body: JSON.stringify({ type: 'EMAIL', payload: { to } }) }); message.success(`Task ${r.accepted ? 'accepted' : 'rejected'} — ${r.id} (${r.provider})`); } catch (e: any) { message.error(e.message); }
  }

  const p = providers.data || {};
  const mode = (k: string) => (p[k] || 'mock') as string;
  const useCases = [
    { key: 'payment', label: 'Payment gateway', icon: <CreditCardOutlined />, value: mode('payment') },
    { key: 'storage', label: 'Object storage', icon: <DatabaseOutlined />, value: mode('objectStore') },
    { key: 'message', label: 'Email / SMS', icon: <SendOutlined />, value: mode('message') },
    { key: 'queue', label: 'Background queue', icon: <SyncOutlined />, value: mode('queue') },
    { key: 'zimra', label: 'ZIMRA fiscalisation', icon: <CloudServerOutlined />, value: mode('zimra') },
  ];

  return (
    <div className="space-y-4">
      <Alert className="mb-2" type="warning" showIcon message="Adapters run in safe mode until official credentials are configured. Mock providers never touch live systems and test-ready providers throw a clear config error." />
      <Row gutter={[16, 16]}>
        {useCases.map((u) => (
          <Col xs={24} sm={12} lg={u.key === 'zimra' ? 24 : 8} key={u.key}>
            <Card className="nex-card" styles={{ body: { padding: 16 } }}>
              <Space align="center">{u.icon}<span className="text-[13px] font-medium text-slate-600">{u.label}</span></Space>
              <div className="mt-2 text-lg font-bold" style={{ color: u.value === 'mock' ? '#f59e0b' : '#003366' }}>{u.value}</div>
              <div className="text-[11px] text-slate-400">{u.value === 'mock' ? 'safe mock' : 'credentials required'}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Live adapter smoke tests" className="nex-card">
        <Space wrap>
          <Input className="!w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button icon={<CreditCardOutlined />} onClick={charge}>Charge (mock)</Button>
          <Input className="!w-56" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button icon={<SendOutlined />} onClick={send}>Send message</Button>
          <Button icon={<SyncOutlined />} onClick={enqueue}>Enqueue job</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Usage metering" className="nex-card" styles={{ body: { padding: 0 } }}>
            <Table rowKey="id" size="small" dataSource={usage.data || []} pagination={false} columns={[
              { title: 'Metric', dataIndex: 'metric' }, { title: 'Period', dataIndex: 'period' }, { title: 'Qty', dataIndex: 'value', align: 'right' }, { title: 'Updated', dataIndex: 'createdAt', render: (v) => new Date(v).toLocaleString() },
            ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Subscription billing" className="nex-card" styles={{ body: { padding: 16 } }}>
            {billing.data && <Descriptions column={1} size="small">
              <Descriptions.Item label="Plan">{billing.data.plan}</Descriptions.Item>
              <Descriptions.Item label="MRR">${billing.data.mrr}</Descriptions.Item>
              <Descriptions.Item label="Currency">{billing.data.currency}</Descriptions.Item>
              <Descriptions.Item label="Metered">{billing.data.metered.map((m: any) => `${m.metric}=${m.qty}`).join(', ') || '—'}</Descriptions.Item>
            </Descriptions>}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="External Integrations" subtitle="Connection registry and adapter provider modes for payments, storage, messaging, queue and ZIMRA." />
      <Adapters />
    </>
  );
}


