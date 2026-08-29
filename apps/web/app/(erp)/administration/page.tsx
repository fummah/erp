'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tabs, Tag } from 'antd';
import { ApartmentOutlined, FileSearchOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/lib/api';
import { CrudPage, StatusTag } from '@/components/crud-page';
import { StatCard } from '@/components/stat-card';
import { fmtDate } from '@/lib/format';

function AuditLogs() {
  const q = useQuery({ queryKey: ['/admin/audit-logs'], queryFn: () => api('/admin/audit-logs') });
  const cols: ColumnsType<any> = [
    { title: 'When', dataIndex: 'createdAt', width: 160, render: (v: any) => (v ? fmtDate(v) : '—') },
    { title: 'User', render: (_, r: any) => r.user?.email || r.userId || '—' },
    { title: 'Action', dataIndex: 'action', width: 110 },
    { title: 'Resource', dataIndex: 'resource', width: 140 },
    { title: 'Details', render: (_, r: any) => <code className="text-xs">{JSON.stringify(r.details || {})}</code> },
  ];
  return <Table size="small" rowKey="id" loading={q.isLoading} dataSource={q.data || []} columns={cols} pagination={{ pageSize: 20 }} scroll={{ x: true }} />;
}

export default function Administration() {
  const users = useQuery({ queryKey: ['/admin/users'], queryFn: () => api('/admin/users') });
  const branches = useQuery({ queryKey: ['/admin/branches'], queryFn: () => api('/admin/branches') });
  const audit = useQuery({ queryKey: ['/admin/audit-logs'], queryFn: () => api('/admin/audit-logs') });
  const config = useQuery({ queryKey: ['/admin/config'], queryFn: () => api('/admin/config') });

  const activeUsers = (users.data || []).filter((u: any) => u.status === 'ACTIVE').length;

  const items = [
    { key: 'users', label: 'Users', children: <CrudPage title="Users" path="/admin/users" createLabel="User" createPayload={(v) => ({ email: v.email, firstName: v.firstName, lastName: v.lastName, password: v.password, role: v.role })}
      columns={[
        { title: 'Name', render: (_, r: any) => `${r.firstName} ${r.lastName}` }, { title: 'Email', dataIndex: 'email' },
        { title: 'Role', dataIndex: 'role', width: 130, render: (v: any) => <StatusTag value={v} /> },
        { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
      ]}
      fields={[
        { name: 'firstName', label: 'First name', required: true }, { name: 'lastName', label: 'Last name', required: true },
        { name: 'email', label: 'Email', required: true }, { name: 'password', label: 'Password' },
        { name: 'role', label: 'Role', type: 'select', options: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES', 'PURCHASER', 'HR', 'VIEWER'].map((r) => ({ label: r, value: r })), defaultValue: 'VIEWER' },
      ]}
      rowActions={[{ key: 'toggle', label: 'Toggle Status', type: 'default', url: (r) => `/admin/users/${r.id}/status`, body: (r) => ({ status: r.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }), method: 'PATCH' }]}
    /> },
    { key: 'memberships', label: 'Memberships', children: <CrudPage title="Company Memberships" path="/admin/memberships" createLabel="Add member" canDelete createPayload={(v) => ({ email: v.email, role: v.role, password: v.password })}
      columns={[
        { title: 'User', render: (_, r: any) => r.user?.email || r.email }, { title: 'Role', dataIndex: 'role', width: 130, render: (v: any) => <StatusTag value={v} /> },
        { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
      ]}
      fields={[{ name: 'email', label: 'Email', required: true }, { name: 'password', label: 'Password' }, { name: 'role', label: 'Role', type: 'select', options: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES', 'PURCHASER', 'HR', 'VIEWER'].map((r) => ({ label: r, value: r })), defaultValue: 'VIEWER' }]}
    /> },
    { key: 'branches', label: 'Branches', children: <CrudPage title="Branches" path="/admin/branches" createLabel="Branch" canDelete
      columns={[{ title: 'Code', dataIndex: 'code', width: 110 }, { title: 'Branch', dataIndex: 'name' }, { title: 'City', dataIndex: 'city', width: 130 }, { title: 'Active', dataIndex: 'active', width: 90, render: (v: any) => (v ? 'Yes' : 'No') }]}
      fields={[{ name: 'code', label: 'Code' }, { name: 'name', label: 'Name', required: true }, { name: 'address', label: 'Address' }, { name: 'city', label: 'City' }, { name: 'active', label: 'Active', type: 'select', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], defaultValue: true }]}
    /> },
    { key: 'audit', label: 'Audit Logs', children: <AuditLogs /> },
    { key: 'config', label: 'Configuration', children: <CrudPage title="System Configuration" path="/admin/config" createLabel="Setting" canDelete createPayload={(v) => ({ key: v.key, value: JSON.parse(v.value || '{}'), description: v.description })}
      columns={[{ title: 'Key', dataIndex: 'key' }, { title: 'Value', render: (_, r: any) => <code className="text-xs">{JSON.stringify(r.value || {})}</code> }, { title: 'Description', dataIndex: 'description' }]}
      fields={[{ name: 'key', label: 'Key', required: true }, { name: 'value', label: 'Value (JSON)', type: 'json', required: true }, { name: 'description', label: 'Description' }]}
    /> },
  ];
  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<UserOutlined />} label="Users" value={users.data?.length || 0} hint={`${activeUsers} active`} />
        <StatCard icon={<SafetyCertificateOutlined />} label="Branches" value={branches.data?.length || 0} hint="Company locations" />
        <StatCard icon={<FileSearchOutlined />} label="Audit events" value={audit.data?.length || 0} hint="Latest activity" />
        <StatCard icon={<ApartmentOutlined />} label="Config keys" value={config.data?.length || 0} hint="System settings" />
      </div>
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}>
        <Tabs items={items} defaultActiveKey="users" destroyOnHidden />
      </Card>
    </div>
  );
}

