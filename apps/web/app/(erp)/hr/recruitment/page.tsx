'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, InputNumber, Modal, Select, Table, Tabs, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, RiseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { Can } from '@/components/Can';
import { StatusPill } from '@/components/sales-ui';

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const vacancies = useQuery({ queryKey: ['/hr/vacancies'], queryFn: () => api('/hr/vacancies') });
  const candidates = useQuery({ queryKey: ['/hr/candidates'], queryFn: () => api('/hr/candidates') });
  const applications = useQuery({ queryKey: ['/hr/applications'], queryFn: () => api('/hr/applications') });
  const [appOpen, setAppOpen] = useState(false);
  const [offerApp, setOfferApp] = useState<any>(null);
  const [offerSalary, setOfferSalary] = useState(0);

  const vCols: ColumnsType<any> = [
    { title: 'Title', dataIndex: 'title', render: (v) => <span className="text-[13px] font-medium text-[#171a2e]">{v}</span> },
    { title: 'Location', dataIndex: 'location', width: 140 },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <StatusPill status={v} /> },
    { title: 'Applicants', width: 100, render: (_, r) => r.applications?.length || 0 },
    { title: 'Posted', dataIndex: 'postedAt', width: 120, render: (v) => <span className="text-[13px] text-[#64748b]">{dayjs(v).format('DD MMM YY')}</span> },
  ];
  const aCols: ColumnsType<any> = [
    { title: 'Candidate', render: (_v, r) => <span className="text-[13px] font-medium text-[#171a2e]">{r.candidate?.name}</span> },
    { title: 'Vacancy', render: (_v, r) => <span className="text-[12px] text-[#64748b]">{r.vacancy?.title}</span> },
    { title: 'Applied', dataIndex: 'appliedAt', width: 120, render: (v) => <span className="text-[12px] text-[#64748b]">{dayjs(v).format('DD MMM YY')}</span> },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <StatusPill status={v.replace(/_/g, ' ')} /> },
    { title: 'Actions', key: 'a', width: 200, align: 'right', render: (_, r: any) => (
      <div className="flex gap-1 justify-end">
        {!r.offer && <Button size="small" onClick={() => { setOfferApp(r); setOfferSalary(0); }}>Offer</Button>}
        {!r.offer && r.status !== 'HIRED' && <Button size="small" type="primary" onClick={() => api(`/hr/applications/${r.id}/hire`, { method: 'POST' }).then(() => { message.success('Hired'); qc.invalidateQueries({ queryKey: ['/hr/applications'] }); }).catch((e) => message.error(e.message))}>Hire</Button>}
        <Select size="small" className="!w-28" value={r.status} onChange={(v) => api(`/hr/applications/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: v }) }).then(() => qc.invalidateQueries({ queryKey: ['/hr/applications'] }))} options={['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'].map((s) => ({ label: s, value: s }))} />
      </div>
    ) },
  ];

  async function saveOffer() { if (!offerApp) return; try { await api(`/hr/applications/${offerApp.id}/offer`, { method: 'POST', body: JSON.stringify({ salary: offerSalary }) }); message.success('Offer sent'); setOfferApp(null); qc.invalidateQueries({ queryKey: ['/hr/applications'] }); } catch (e: any) { message.error(e.message); } }

  return (
    <div className="nex-fade">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[26px] font-bold text-[#171a2e] leading-tight">Recruitment</h1><p className="text-[13px] text-[#64748b] mt-1">Vacancies, candidates and the hiring pipeline</p></div>
        <Can permission="hr.employees.manage"><Button icon={<ReloadOutlined />} onClick={() => { vacancies.refetch(); candidates.refetch(); applications.refetch(); }}>Refresh</Button></Can>
      </div>
      <Tabs defaultActiveKey="vacancies" items={[
        { key: 'vacancies', label: `Vacancies (${vacancies.data?.length || 0})`, children: <div className="nex-card"><Table rowKey="id" loading={vacancies.isLoading} dataSource={vacancies.data || []} columns={vCols} pagination={false} /></div> },
        { key: 'candidates', label: `Candidates (${candidates.data?.length || 0})`, children: <div className="nex-card"><Table rowKey="id" loading={candidates.isLoading} dataSource={candidates.data || []} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Email', dataIndex: 'email', width: 200 }, { title: 'Phone', dataIndex: 'phone', width: 140 }, { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <StatusPill status={v} /> }]} pagination={false} /></div> },
        { key: 'applications', label: `Applications (${applications.data?.length || 0})`, children: <div className="nex-card"><Table rowKey="id" loading={applications.isLoading} dataSource={applications.data || []} columns={aCols} pagination={false} /></div> },
      ]} />
      <Modal open={!!offerApp} onCancel={() => setOfferApp(null)} onOk={saveOffer} title={`Offer — ${offerApp?.candidate?.name}`} okText="Send Offer" width={420}>
        <div className="space-y-4 mt-2">
          <div className="text-[13px] text-[#344054]">Salary (monthly)</div>
          <InputNumber className="w-full" prefix="$" min={0} value={offerSalary} onChange={(v) => setOfferSalary(Number(v || 0))} />
        </div>
      </Modal>
    </div>
  );
}

