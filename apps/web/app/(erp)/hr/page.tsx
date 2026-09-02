'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, Tabs } from 'antd';
import { DollarOutlined, FileDoneOutlined, TeamOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { CrudPage, StatusTag } from '@/components/crud-page';
import { StatCard } from '@/components/stat-card';
import { fmtDate, fmtMoney } from '@/lib/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (p: number) => (p >= 1 && p <= 12 ? MONTHS[p - 1] : `Period ${p}`);

export default function Hr() {
  const employees = useQuery({ queryKey: ['/hr/employees'], queryFn: () => api('/hr/employees') });
  const leave = useQuery({ queryKey: ['/hr/leave-requests'], queryFn: () => api('/hr/leave-requests') });
  const payroll = useQuery({ queryKey: ['/hr/payroll-runs'], queryFn: () => api('/hr/payroll-runs') });

  const activeEmployees = (employees.data || []).filter((e: any) => e.active).length;
  const pendingLeave = (leave.data || []).filter((l: any) => l.status === 'PENDING').length;
  const grossYtd = (payroll.data || []).reduce((s: number, r: any) => s + Number(r.totalGross), 0);

  const items = [
    { key: 'employees', label: 'Employees', children: <CrudPage title="Employees" path="/hr/employees" createLabel="Employee" canDelete
      columns={[
        { title: 'No', dataIndex: 'employeeNo', width: 100 }, { title: 'First name', dataIndex: 'firstName' }, { title: 'Last name', dataIndex: 'lastName' },
        { title: 'Department', render: (_, r: any) => r.department?.name || '—' }, { title: 'Basic Salary', dataIndex: 'basicSalary', align: 'right', render: (v: any) => fmtMoney(v) },
        { title: 'Status', dataIndex: 'active', width: 90, render: (v: any) => (v ? 'Active' : 'Inactive') },
      ]}
      fields={[
        { name: 'employeeNo', label: 'Employee no' }, { name: 'firstName', label: 'First name', required: true }, { name: 'lastName', label: 'Last name', required: true },
        { name: 'departmentId', label: 'Department', type: 'select', metaKey: 'departments', metaLabel: 'name' },
        { name: 'position', label: 'Position' }, { name: 'managerId', label: 'Manager (employee id)' }, { name: 'contractType', label: 'Contract type', type: 'select', options: ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'INTERN'].map((c) => ({ label: c, value: c })) },
        { name: 'email', label: 'Email' }, { name: 'hireDate', label: 'Hire date', type: 'date', required: true },
        { name: 'basicSalary', label: 'Basic salary', type: 'money', required: true },
        { name: 'currency', label: 'Currency', type: 'select', options: ['USD', 'ZWL'].map((c) => ({ label: c, value: c })), defaultValue: 'USD' },
        { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'ON_LEAVE', 'TERMINATED'].map((c) => ({ label: c, value: c })), defaultValue: 'ACTIVE' },
        { name: 'active', label: 'Active', type: 'select', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], defaultValue: true },
        { name: 'bankName', label: 'Bank name' }, { name: 'accountHolder', label: 'Account holder' }, { name: 'accountNumber', label: 'Account number' },
        { name: 'accountType', label: 'Account type', type: 'select', options: ['BANK', 'SAVINGS', 'CHEQUE', 'CREDIT_CARD'].map((c) => ({ label: c.replace(/_/g, ' '), value: c })) },
        { name: 'branchCode', label: 'Branch code' },
        { name: 'tin', label: 'Tax ID / TIN' },
        { name: 'contactName', label: 'Emergency contact' }, { name: 'contactRelationship', label: 'Relationship' }, { name: 'contactPhone', label: 'Contact phone' }, { name: 'contactEmail', label: 'Contact email' },
        { name: 'allowanceAmount', label: 'Monthly allowance', type: 'money' }, { name: 'deductionAmount', label: 'Monthly deduction', type: 'money' },
      ]}
      createPayload={(v: any) => ({
        employeeNo: v.employeeNo, firstName: v.firstName, lastName: v.lastName, departmentId: v.departmentId, position: v.position, managerId: v.managerId,
        contractType: v.contractType, email: v.email, hireDate: v.hireDate, basicSalary: Number(v.basicSalary || 0), currency: v.currency, status: v.status, active: v.active !== false,
        bankDetails: { bank: v.bankName, accountHolder: v.accountHolder, accountNumber: v.accountNumber, accountType: v.accountType, branchCode: v.branchCode },
        taxDetails: { tin: v.tin },
        emergencyContact: { name: v.contactName, relationship: v.contactRelationship, phone: v.contactPhone, email: v.contactEmail },
        allowances: { total: Number(v.allowanceAmount || 0) },
        deductions: { total: Number(v.deductionAmount || 0) },
      })}
      editPayload={(v: any) => ({
        firstName: v.firstName, lastName: v.lastName, departmentId: v.departmentId, position: v.position, managerId: v.managerId,
        contractType: v.contractType, email: v.email, basicSalary: Number(v.basicSalary || 0), currency: v.currency, status: v.status, active: v.active !== false,
        bankDetails: { bank: v.bankName, accountHolder: v.accountHolder, accountNumber: v.accountNumber, accountType: v.accountType, branchCode: v.branchCode },
        taxDetails: { tin: v.tin },
        emergencyContact: { name: v.contactName, relationship: v.contactRelationship, phone: v.contactPhone, email: v.contactEmail },
        allowances: { total: Number(v.allowanceAmount || 0) },
        deductions: { total: Number(v.deductionAmount || 0) },
      })}
      editValues={(r: any) => { const b = r.bankDetails || {}, t = r.taxDetails || {}, e = r.emergencyContact || {}, al = r.allowances || {}, de = r.deductions || {}; return { bankName: b.bank, accountHolder: b.accountHolder, accountNumber: b.accountNumber, accountType: b.accountType, branchCode: b.branchCode, tin: t.tin, contactName: e.name, contactRelationship: e.relationship, contactPhone: e.phone, contactEmail: e.email, allowanceAmount: al.total, deductionAmount: de.total }; }}
    /> },
    { key: 'departments', label: 'Departments', children: <CrudPage title="Departments" path="/hr/departments" createLabel="Department" canDelete
      columns={[{ title: 'Code', dataIndex: 'code', width: 110 }, { title: 'Department', dataIndex: 'name' }, { title: 'Branch', render: (_, r: any) => r.branch?.name || '—' }]}
      fields={[{ name: 'branchId', label: 'Branch', type: 'select', metaKey: 'branches', required: true }, { name: 'code', label: 'Code' }, { name: 'name', label: 'Name', required: true }]}
    /> },
    { key: 'leave', label: 'Leave', children: <CrudPage title="Leave Requests" path="/hr/leave-requests" createLabel="Leave request" canDelete
      columns={[
        { title: 'Employee', render: (_, r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
        { title: 'Type', dataIndex: 'leaveType', width: 110 }, { title: 'Start', dataIndex: 'startDate', width: 110, render: fmtDate },
        { title: 'End', dataIndex: 'endDate', width: 110, render: fmtDate }, { title: 'Days', dataIndex: 'days', width: 70, align: 'right' },
        { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee', type: 'select', metaKey: 'employees', metaLabel: 'firstName', required: true },
        { name: 'leaveType', label: 'Type', type: 'select', options: ['ANNUAL', 'SICK', 'STUDY', 'UNPAID', 'MATERNITY', 'OTHER'].map((t) => ({ label: t, value: t })), defaultValue: 'ANNUAL' },
        { name: 'startDate', label: 'Start date', type: 'date', required: true }, { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'days', label: 'Days', type: 'number', required: true }, { name: 'reason', label: 'Reason', type: 'textarea' },
      ]}
      rowActions={[{ key: 'approve', label: 'Approve', type: 'primary', show: (r) => r.status === 'PENDING', url: (r) => `/hr/leave-requests/${r.id}/status`, body: () => ({ status: 'APPROVED' }), method: 'PATCH' }]}
    /> },
    { key: 'attendance', label: 'Attendance', children: <CrudPage title="Attendance" path="/hr/attendance" createLabel="Record"
      columns={[
        { title: 'Date', dataIndex: 'date', width: 110, render: fmtDate }, { title: 'Employee', render: (_, r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
        { title: 'Status', dataIndex: 'status', width: 100, render: (v: any) => <StatusTag value={v} /> },
        { title: 'Check In', dataIndex: 'checkIn', width: 90 }, { title: 'Check Out', dataIndex: 'checkOut', width: 90 },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee', type: 'select', metaKey: 'employees', metaLabel: 'firstName', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'].map((t) => ({ label: t, value: t })), defaultValue: 'PRESENT' },
        { name: 'checkIn', label: 'Check in (HH:MM)' }, { name: 'checkOut', label: 'Check out (HH:MM)' }, { name: 'note', label: 'Note' },
      ]}
    /> },
    { key: 'payroll', label: 'Payroll Runs', children: <CrudPage title="Payroll Runs" path="/hr/payroll-runs" createLabel="Run" canDelete
      columns={[
        { title: 'Payroll Period', render: (_v: any, r: any) => <span className="font-medium">{monthName(r.period)} {r.year}</span> },
        { title: 'Gross', dataIndex: 'totalGross', align: 'right', render: (v: any) => fmtMoney(v) }, { title: 'Net', dataIndex: 'totalNet', align: 'right', render: (v: any) => fmtMoney(v) },
        { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
      ]}
      fields={[{ name: 'period', label: 'Period / Month', type: 'select', required: true, options: MONTHS.map((m, i) => ({ label: m, value: i + 1 })) }, { name: 'year', label: 'Year', type: 'number', required: true, defaultValue: new Date().getFullYear() }]}
      rowActions={[
        { key: 'process', label: 'Process', type: 'primary', show: (r) => r.status === 'DRAFT', url: (r) => `/hr/payroll-runs/${r.id}/process`, confirm: 'Process this payroll run (posts journals)?', extraInvalidate: ['/finance/journals'] },
        { key: 'lock', label: 'Lock', type: 'default', show: (r) => r.status === 'PROCESSED', url: (r) => `/hr/payroll-runs/${r.id}/lock` },
      ]}
    /> },
  ];
  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<TeamOutlined />} label="Employees" value={activeEmployees} hint={`${employees.data?.length || 0} total on record`} />
        <StatCard icon={<FileDoneOutlined />} label="Pending leave" value={pendingLeave} hint={`${leave.data?.length || 0} requests`} />
        <StatCard icon={<WalletOutlined />} label="Gross payroll" value={fmtMoney(grossYtd)} hint={`${payroll.data?.length || 0} runs`} />
        <StatCard icon={<DollarOutlined />} label="Avg salary" value={fmtMoney(activeEmployees ? (employees.data || []).reduce((s: number, e: any) => s + Number(e.basicSalary), 0) / activeEmployees : 0)} hint="Active workforce" />
      </div>
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}>
        <Tabs items={items} defaultActiveKey="employees" destroyOnHidden />
      </Card>
    </div>
  );
}

