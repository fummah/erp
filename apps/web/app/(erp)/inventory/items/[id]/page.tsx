'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Checkbox, Descriptions, Drawer, Empty, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useMeta } from '@/lib/meta';
import { StatusTag } from '@/components/crud-page';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const meta = useMeta();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['/inventory/items', id], queryFn: () => api(`/inventory/items/${id}`) });
  const sales = useQuery({ queryKey: ['/inventory/reports/sales-by-item', id], queryFn: () => api(`/inventory/reports/sales-by-item?itemId=${id}`) });
  const [tab, setTab] = useState('overview');
  const [drawer, setDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Populate the edit drawer from the loaded item master.
  useEffect(() => {
    if (drawer && data?.item) {
      const item = data.item;
      form.setFieldsValue({
        sku: item.sku, name: item.name, unit: item.unit, type: item.type || 'INVENTORY', categoryId: item.categoryId || undefined,
        sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : undefined,
        minSellingPrice: item.minSellingPrice != null ? Number(item.minSellingPrice) : undefined,
        purchaseCost: item.purchaseCost != null ? Number(item.purchaseCost) : undefined,
        reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : undefined,
        barcode: item.barcode, brand: item.brand, hsCode: item.hsCode, description: item.description,
        salesTaxCode: item.salesTaxCode || undefined, purchaseTaxCode: item.purchaseTaxCode || undefined,
        defaultWarehouseId: item.defaultWarehouseId || undefined, preferredSupplierId: item.preferredSupplierId || undefined,
        costingMethod: item.costingMethod || 'WEIGHTED_AVERAGE',
        trackBatch: !!item.trackBatch, trackSerial: !!item.trackSerial, trackExpiry: !!item.trackExpiry, allowDiscount: item.allowDiscount !== false,
        active: item.active !== false,
      });
    }
  }, [drawer, data]);

  async function saveItem() {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    try {
      const payload = { ...v, unit: v.unit || 'EA', categoryId: v.categoryId || undefined, defaultWarehouseId: v.defaultWarehouseId || undefined, preferredSupplierId: v.preferredSupplierId || undefined };
      await api(`/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      message.success('Item updated');
      setDrawer(false);
      refetch();
      qc.invalidateQueries({ queryKey: ['meta'] });
      qc.invalidateQueries({ queryKey: ['/inventory/items'] });
    } catch (e: any) { message.error(e.message); } finally { setSaving(false); }
  }

  if (isLoading) return <div className="p-8 text-[#8a90ad]">Loading item…</div>;
  if (!data) return <Empty description="Item not found" />;
  const { item, stock, total, movements, priceListItems } = data;
  const perf = (sales.data || [])[0] || { qty: 0, net: 0, invoiceCount: 0, lastSale: null, sales: [] };

  const detailRows = [
    { label: 'SKU', value: item.sku }, { label: 'Name', value: item.name }, { label: 'Type', value: item.type },
    { label: 'Category', value: item.itemCategory }, { label: 'Unit', value: item.unit }, { label: 'Barcode', value: item.barcode },
    { label: 'Brand', value: item.brand }, { label: 'HS Code', value: item.hsCode },
    { label: 'Sales Price', value: <span className="font-semibold text-[#2563eb]">{fmtMoney(item.sellingPrice)}</span> },
    { label: 'Purchase Cost', value: <span className="text-[#f97316]">{fmtMoney(item.purchaseCost)}</span> },
    { label: 'Avg Cost (value)', value: <span className="text-[#8b5cf6]">{fmtMoney(total.avgCost)}</span> },
    { label: 'On Hand', value: fmtNumber(total.onHand) }, { label: 'Reserved', value: fmtNumber(total.reserved) },
    { label: 'Available', value: <span className="font-semibold">{fmtNumber(total.available)}</span> },
    { label: 'Stock Value', value: fmtMoney(total.value) },
    { label: 'Costing Method', value: item.costingMethod || 'WEIGHTED_AVERAGE' },
    { label: 'Sales Tax', value: item.salesTaxCode || '—' }, { label: 'Purchase Tax', value: item.purchaseTaxCode || '—' },
    { label: 'Status', value: item.active ? 'ACTIVE' : 'INACTIVE' },
  ];

  const stockCols: ColumnsType<any> = [
    { title: 'Warehouse', dataIndex: 'warehouse' }, { title: 'On Hand', dataIndex: 'onHand', align: 'right', render: (v: any) => fmtNumber(v) },
    { title: 'Reserved', dataIndex: 'reserved', align: 'right', render: (v: any) => fmtNumber(v) },
    { title: 'Available', dataIndex: 'available', align: 'right', render: (v: any) => <span className="font-semibold">{fmtNumber(v)}</span> },
    { title: 'Unit Cost', dataIndex: 'unitCost', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: 'Value', dataIndex: 'value', align: 'right', render: (v: any) => fmtMoney(v) },
  ];
  const moveCols: ColumnsType<any> = [
    { title: 'Date', dataIndex: 'occurredAt', width: 110, render: fmtDate }, { title: 'Warehouse', render: (_: any, r: any) => r.warehouse?.name || '—' },
    { title: 'Type', dataIndex: 'type', width: 140, render: (v: any) => <StatusTag value={v} /> }, { title: 'Qty', dataIndex: 'quantity', align: 'right', render: (v: any) => fmtNumber(v) },
    { title: 'Unit Cost', dataIndex: 'unitCost', align: 'right', render: (v: any) => fmtMoney(v) }, { title: 'Reference', dataIndex: 'reference' },
  ];
  const salesCols: ColumnsType<any> = [
    { title: 'Invoice', dataIndex: 'invoiceNo', render: (v: any, r: any) => <a className="text-[#2563eb] cursor-pointer" onClick={() => router.push(`/sales/invoices/${r.invoiceId}/edit`)}>{v}</a> },
    { title: 'Date', dataIndex: 'date', render: fmtDate }, { title: 'Customer', dataIndex: 'customer' },
    { title: 'Qty', dataIndex: 'qty', align: 'right', render: (v: any) => fmtNumber(v) }, { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v: any) => fmtMoney(v) },
  ];
  const priceCols: ColumnsType<any> = [
    { title: 'Price List', render: (_: any, r: any) => r.priceList?.name }, { title: 'Price', dataIndex: 'price', align: 'right', render: (v: any) => fmtMoney(v) },
    { title: 'Currency', render: (_: any, r: any) => r.priceList?.currency || 'USD' },
    { title: 'Active', render: (_: any, r: any) => (r.priceList?.active ? 'Yes' : 'No') },
  ];

  const tabs = [
    { key: 'overview', label: 'Overview', children: <Descriptions column={3} size="small" bordered items={detailRows.map((v) => ({ key: v.label, label: v.label, children: <span className="text-[13px]">{v.value}</span> }))} /> },
    { key: 'stock', label: 'Stock', children: <Table rowKey="warehouseId" dataSource={stock} columns={stockCols} pagination={false} size="small" /> },
    { key: 'sales', label: 'Sales', children: <Table rowKey="invoiceId" dataSource={perf.sales || []} columns={salesCols} pagination={false} size="small" /> },
    { key: 'pricing', label: 'Pricing', children: <Table rowKey="id" dataSource={priceListItems} columns={priceCols} pagination={false} size="small" /> },
    { key: 'movements', label: 'Movements', children: <Table rowKey="id" dataSource={movements} columns={moveCols} pagination={false} size="small" /> },
  ];

  return (
    <div className="nex-fade">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
          <div>
            <div className="flex items-center gap-2"><h1 className="text-[24px] font-bold text-[#171a2e]">{item.name}</h1><Tag style={{ borderRadius: 8 }}>{item.sku}</Tag><StatusTag value={item.type} /></div>
            <div className="text-[13px] text-[#64748b]">{item.itemCategory || item.unit} · {item.brand || '—'}</div>
          </div>
        </div>
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => setDrawer(true)}>Edit</Button>
          <Button icon={<DollarOutlined />} onClick={() => router.push('/inventory')}>+ Adjustment</Button>
        </Space>
      </div>
      <div className="nex-card mb-5 px-5 py-4 flex flex-wrap gap-8 !rounded-xl">
        {[{ l: 'Sales Price', v: fmtMoney(item.sellingPrice), c: '#2563eb' }, { l: 'Qty Sold 30d', v: fmtNumber(perf.qty), c: '#003366' }, { l: 'Net Sales 30d', v: fmtMoney(perf.net), c: '#16a34a' }, { l: 'Last Sale', v: perf.lastSale ? fmtDate(perf.lastSale) : 'Never', c: '#f59e0b' }, { l: 'Purchase Cost', v: fmtMoney(item.purchaseCost), c: '#f97316' }, { l: 'Avg Cost', v: fmtMoney(total.avgCost), c: '#8b5cf6' }, { l: 'On Hand', v: fmtNumber(total.onHand), c: '#003366' }, { l: 'Available', v: fmtNumber(total.available), c: '#16a34a' }, { l: 'Stock Value', v: fmtMoney(total.value), c: '#f59e0b' }].map((k) => (<div key={k.l}><div className="text-[12px] text-[#64748b]">{k.l}</div><div className="text-[18px] font-bold" style={{ color: k.c }}>{k.v}</div></div>))}
      </div>
      <Card className="nex-card" styles={{ body: { padding: '14px 20px' } }}><Tabs items={tabs} activeKey={tab} onChange={setTab} destroyOnHidden /></Card>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={`Edit Item — ${item.name}`} width={680} destroyOnClose
        extra={<Button onClick={() => setDrawer(false)}>Cancel</Button>}
        footer={<Space className="w-full justify-end"><Button onClick={() => setDrawer(false)}>Cancel</Button><Button type="primary" loading={saving} onClick={saveItem}>Save Item</Button></Space>}>
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="SKU" name="sku"><Input placeholder="Auto if blank" /></Form.Item>
            <Form.Item label="Item Name" name="name" rules={[{ required: true, message: 'Name is required' }]}><Input /></Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Item Type" name="type"><Select options={['INVENTORY', 'NON_INVENTORY', 'SERVICE'].map((t) => ({ label: t.replace(/_/g, ' '), value: t }))} /></Form.Item>
            <Form.Item label="Unit of Measure" name="unit"><Input /></Form.Item>
          </div>
          <Form.Item label="Category" name="categoryId"><Select allowClear placeholder="Select category" options={(meta.data?.categories || []).map((c: any) => ({ label: c.name, value: c.id }))} /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Sales Price" name="sellingPrice" extra="Used to auto-populate the Rate on quotes, orders and invoices."><InputNumber prefix="$" className="w-full" min={0} /></Form.Item>
            <Form.Item label="Min Selling Price" name="minSellingPrice"><InputNumber prefix="$" className="w-full" min={0} /></Form.Item>
            <Form.Item label="Purchase Cost" name="purchaseCost"><InputNumber prefix="$" className="w-full" min={0} /></Form.Item>
            <Form.Item label="Reorder Level" name="reorderLevel"><InputNumber className="w-full" min={0} /></Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Default Warehouse" name="defaultWarehouseId"><Select allowClear options={(meta.data?.warehouses || []).map((w: any) => ({ label: w.name, value: w.id }))} /></Form.Item>
            <Form.Item label="Preferred Supplier" name="preferredSupplierId"><Select allowClear options={(meta.data?.suppliers || []).map((s: any) => ({ label: s.name, value: s.id }))} /></Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Barcode" name="barcode"><Input /></Form.Item>
            <Form.Item label="Brand" name="brand"><Input /></Form.Item>
          </div>
          <Form.Item label="Description" name="description"><Input.TextArea rows={2} /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Costing Method" name="costingMethod"><Select options={[{ label: 'Weighted Average', value: 'WEIGHTED_AVERAGE' }, { label: 'FIFO', value: 'FIFO' }]} /></Form.Item>
            <Form.Item label="Sales Tax Code" name="salesTaxCode"><Input placeholder="e.g. VAT 15%" /></Form.Item>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Form.Item label="Track Batch" name="trackBatch" valuePropName="checked"><Checkbox /></Form.Item>
            <Form.Item label="Track Serial" name="trackSerial" valuePropName="checked"><Checkbox /></Form.Item>
            <Form.Item label="Allow Discount" name="allowDiscount" valuePropName="checked"><Checkbox /></Form.Item>
            <Form.Item label="Active" name="active" valuePropName="checked"><Checkbox /></Form.Item>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
