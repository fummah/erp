'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, InputNumber, Modal, Select, Space, Table, Tabs, message } from 'antd';
import { AppstoreOutlined, DeleteOutlined, DollarOutlined, PlusOutlined, RiseOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/lib/api';
import { CrudPage, StatusTag } from '@/components/crud-page';
import { StatCard } from '@/components/stat-card';
import { useMeta } from '@/lib/meta';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';

function CountsTab() {
  const qc = useQueryClient();
  const meta = useMeta();
  const list = useQuery({ queryKey: ['/inventory/counts'], queryFn: () => api('/inventory/counts') });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const itemOptions = (meta.data?.items || []).map((i: any) => ({ label: `${i.sku} — ${i.name}`, value: i.id }));

  async function submit(v: any) {
    try {
      setSaving(true);
      await api('/inventory/counts', { method: 'POST', body: JSON.stringify({ warehouseId: v.warehouseId, lines: v.lines.map((l: any) => ({ itemId: l.itemId, countedQty: l.countedQty })) }) });
      message.success('Count created'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['/inventory/counts'] });
    } catch (e: any) { message.error(e.message); } finally { setSaving(false); }
  }

  async function post(id: string) {
    try { await api(`/inventory/counts/${id}/post`, { method: 'POST' }); message.success('Count posted'); qc.invalidateQueries({ queryKey: ['/inventory/counts'] }); qc.invalidateQueries({ queryKey: ['/inventory/stock'] }); }
    catch (e: any) { message.error(e.message); }
  }

  return (
    <>
      <div className="flex justify-end mb-4"><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>New Count</Button></div>
      <Table loading={list.isLoading} rowKey="id" dataSource={list.data || []} scroll={{ x: true }}
        columns={[
          { title: 'Count No', dataIndex: 'countNo', width: 120 }, { title: 'Warehouse', render: (_, r: any) => r.warehouse?.name || '—' },
          { title: 'Lines', dataIndex: 'countNo', width: 90, render: (_, r: any) => (r.lines || []).length },
          { title: 'Status', dataIndex: 'status', width: 110, render: (v: any) => <StatusTag value={v} /> },
          { title: 'Actions', width: 100, render: (_, r: any) => r.status === 'DRAFT' && <Button size="small" type="primary" onClick={() => post(r.id)}>Post</Button> },
        ]}
      />
      <Modal title="New stock count" open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} width={620} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label="Warehouse" name="warehouseId" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={(meta.data?.warehouses || []).map((w: any) => ({ label: w.name, value: w.id }))} />
          </Form.Item>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" className="w-full mb-2" wrap>
                    <Form.Item name={[name, 'itemId']} {...rest} rules={[{ required: true }]} className="!mb-0 w-64"><Select showSearch optionFilterProp="label" placeholder="Item" options={itemOptions} /></Form.Item>
                    <Form.Item name={[name, 'countedQty']} {...rest} rules={[{ required: true }]} className="!mb-0"><InputNumber placeholder="Counted qty" min={0} /></Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ countedQty: 0 })}>Add line</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}

export default function Inventory() {
  const stock = useQuery({ queryKey: ['/inventory/stock'], queryFn: () => api('/inventory/stock') });
  const valuation = useQuery({ queryKey: ['/inventory/valuation'], queryFn: () => api('/inventory/valuation') });
  const reorder = useQuery({ queryKey: ['/inventory/reorder'], queryFn: () => api('/inventory/reorder') });
  const itemList = useQuery({ queryKey: ['/inventory/items'], queryFn: () => api('/inventory/items') });
  const warehouses = useQuery({ queryKey: ['/inventory/warehouses'], queryFn: () => api('/inventory/warehouses') });

  const stockCols: ColumnsType<any> = [
    { title: 'SKU', dataIndex: 'sku', width: 110 }, { title: 'Item', dataIndex: 'name' },
    { title: 'On Hand', dataIndex: 'onHand', align: 'right', render: (v: any) => fmtNumber(v) },
    { title: 'Avg Cost', dataIndex: 'avgCost', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: 'Value', dataIndex: 'value', align: 'right', render: (v: any) => fmtMoney(v) },
  ];

  const items = [
    { key: 'items', label: 'Items', children: <CrudPage title="Inventory Items" path="/inventory/items" createLabel="Item" canDelete selectable
      columns={[
        { title: 'SKU', dataIndex: 'sku', width: 110 }, { title: 'Item', dataIndex: 'name' }, { title: 'Unit', dataIndex: 'unit', width: 90 },
        { title: 'HS Code', dataIndex: 'hsCode', width: 110 }, { title: 'Reorder Level', dataIndex: 'reorderLevel', width: 110 },
        { title: 'Active', dataIndex: 'active', width: 90, render: (v: any) => (v ? 'Yes' : 'No') },
      ]}
      fields={[
        { name: 'sku', label: 'SKU' }, { name: 'name', label: 'Name', required: true }, { name: 'unit', label: 'Unit' },
        { name: 'hsCode', label: 'HS Code' }, { name: 'reorderLevel', label: 'Reorder level', type: 'number' },
        { name: 'trackBatch', label: 'Track batch', type: 'select', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }], defaultValue: false },
        { name: 'trackSerial', label: 'Track serial', type: 'select', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }], defaultValue: false },
        { name: 'active', label: 'Active', type: 'select', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], defaultValue: true },
      ]}
    /> },
    { key: 'warehouses', label: 'Warehouses', children: <CrudPage title="Warehouses" path="/inventory/warehouses" createLabel="Warehouse" canDelete
      columns={[{ title: 'Code', dataIndex: 'code', width: 110 }, { title: 'Warehouse', dataIndex: 'name' }, { title: 'Branch', render: (_, r: any) => r.branch?.name || '—' }]}
      fields={[{ name: 'branchId', label: 'Branch', type: 'select', metaKey: 'branches', required: true }, { name: 'code', label: 'Code' }, { name: 'name', label: 'Name', required: true }]}
    /> },
    { key: 'stock', label: 'Stock', children: <Table size="small" rowKey="id" loading={stock.isLoading} dataSource={stock.data || []} columns={stockCols} scroll={{ x: true }} pagination={false} /> },
    { key: 'movements', label: 'Movements', children: <CrudPage title="Stock Movements" path="/inventory/movements" createLabel="Movement"
      columns={[
        { title: 'Date', dataIndex: 'createdAt', width: 110, render: fmtDate }, { title: 'Item', render: (_, r: any) => r.item?.name || r.itemId },
        { title: 'Type', dataIndex: 'type', width: 120, render: (v: any) => <StatusTag value={v} /> }, { title: 'Qty', dataIndex: 'quantity', align: 'right' },
        { title: 'Unit Cost', dataIndex: 'unitCost', align: 'right', render: (v: any) => fmtMoney(v) }, { title: 'Reference', dataIndex: 'reference' },
      ]}
      fields={[
        { name: 'warehouseId', label: 'Warehouse', type: 'select', metaKey: 'warehouses', required: true },
        { name: 'itemId', label: 'Item', type: 'select', metaKey: 'items', metaLabel: 'name', required: true },
        { name: 'type', label: 'Type', type: 'select', required: true, options: ['RECEIPT', 'ISSUE', 'ADJUST', 'RETURN'].map((t) => ({ label: t, value: t })) },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        { name: 'unitCost', label: 'Unit cost', type: 'money' }, { name: 'reference', label: 'Reference' },
      ]}
    /> },
    { key: 'transfers', label: 'Transfers', children: <CrudPage title="Stock Transfers" path="/inventory/transfers" createLabel="Transfer" hideCreate
      columns={[
        { title: 'Date', dataIndex: 'createdAt', width: 110, render: fmtDate }, { title: 'Item', render: (_, r: any) => r.item?.name || r.itemId },
        { title: 'From', render: (_, r: any) => r.fromWarehouse?.name || r.fromWarehouseId }, { title: 'To', render: (_, r: any) => r.toWarehouse?.name || r.toWarehouseId },
        { title: 'Qty', dataIndex: 'quantity', align: 'right' }, { title: 'Status', dataIndex: 'status', width: 100, render: (v: any) => <StatusTag value={v} /> },
      ]}
      canDelete
    /> },
    { key: 'counts', label: 'Stock Counts', children: <CountsTab /> },
    { key: 'valuation', label: 'Valuation', children: <CardWrapper loading={valuation.isLoading} extra={`Total value: ${fmtMoney(valuation.data?.totalValue)}`}>
      <Table size="small" rowKey="id" dataSource={valuation.data?.rows || []} columns={[
        { title: 'SKU', dataIndex: 'sku', width: 110 }, { title: 'Item', dataIndex: 'name' },
        { title: 'On Hand', dataIndex: 'onHand', align: 'right', render: (v: any) => fmtNumber(v) },
        { title: 'Avg Cost', dataIndex: 'avgCost', align: 'right', render: (v: any) => fmtMoney(v) },
        { title: 'Value', dataIndex: 'value', align: 'right', render: (v: any) => fmtMoney(v) },
      ]} pagination={false} scroll={{ x: true }} />
    </CardWrapper> },
    { key: 'reorder', label: 'Reorder Alerts', children: <Table size="small" rowKey="id" loading={reorder.isLoading} dataSource={reorder.data || []} columns={[
      { title: 'SKU', dataIndex: 'sku', width: 110 }, { title: 'Item', dataIndex: 'name' },
      { title: 'On Hand', dataIndex: 'onHand', align: 'right', render: (v: any) => <span className="text-red-600 font-medium">{fmtNumber(v)}</span> },
      { title: 'Reorder Level', dataIndex: 'reorderLevel', align: 'right' },
    ]} pagination={false} scroll={{ x: true }} /> },
  ];
  return (
    <div className="nex-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<AppstoreOutlined />} label="Items" value={itemList.data?.length || 0} hint={`${warehouses.data?.length || 0} warehouses`} />
        <StatCard icon={<DollarOutlined />} label="Stock value" value={fmtMoney(valuation.data?.totalValue)} hint="At weighted average cost" />
        <StatCard icon={<RiseOutlined />} label="Units on hand" value={fmtNumber((stock.data || []).reduce((s: number, r: any) => s + Number(r.onHand), 0))} hint={`${stock.data?.length || 0} SKUs`} />
        <StatCard icon={<WarningOutlined />} label="Reorder alerts" value={reorder.data?.length || 0} hint="Below reorder level" gradient="linear-gradient(135deg,#fffbeb,#fefce8)" />
      </div>
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}>
        <Tabs items={items} defaultActiveKey="stock" destroyOnHidden />
      </Card>
    </div>
  );
}

function CardWrapper({ loading, extra, children }: any) {
  return <Card className="shadow-sm border-0 mb-4" loading={loading} extra={extra}>{children}</Card>;
}

