import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { companyIdOf } from '../../core/context';

export const DATASETS = [
  { id: 'GL', label: 'General Ledger', columns: [{ key: 'date', label: 'Date' }, { key: 'accountCode', label: 'Account' }, { key: 'accountName', label: 'Account Name' }, { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'journalNo', label: 'Journal' }] },
  { id: 'SALES', label: 'Sales', columns: [{ key: 'invoiceNo', label: 'Invoice' }, { key: 'customer', label: 'Customer' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount' }, { key: 'tax', label: 'Tax' }, { key: 'status', label: 'Status' }] },
  { id: 'CUSTOMERS', label: 'Customers', columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' }, { key: 'creditLimit', label: 'Credit Limit' }] },
  { id: 'SUPPLIERS', label: 'Suppliers', columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' }] },
  { id: 'INVENTORY', label: 'Inventory', columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Item' }, { key: 'onHand', label: 'On Hand' }, { key: 'avgCost', label: 'Avg Cost' }, { key: 'value', label: 'Value' }] },
  { id: 'ASSETS', label: 'Assets', columns: [{ key: 'assetNo', label: 'Asset No' }, { key: 'name', label: 'Asset' }, { key: 'cost', label: 'Cost' }, { key: 'nbv', label: 'Net Book Value' }, { key: 'status', label: 'Status' }] },
  { id: 'PROJECTS', label: 'Projects', columns: [{ key: 'name', label: 'Project' }, { key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' }, { key: 'margin', label: 'Margin' }] },
];

const sign = (t: string) => ['RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(t) ? 1 : -1;

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async run(companyId: string, body: any) {
    const { dataset, from, to, keyword, status } = body;
    const range = (from || to) ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
    const kw = (keyword || '').toLowerCase();
    if (dataset === 'GL') {
      const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' } }, include: { account: true, journal: true } });
      let rows = lines;
      if (range) {
        const start = range.gte || new Date(0);
        const end = range.lte || new Date('9999-12-31');
        rows = lines.filter((l) => l.journal.date >= start && l.journal.date <= end);
      }
      if (kw) rows = rows.filter((l) => `${l.account?.code} ${l.account?.name} ${l.journal?.number}`.toLowerCase().includes(kw));
      return rows.map((l) => ({ date: l.journal.date, accountCode: l.account?.code, accountName: l.account?.name, debit: Number(l.debit), credit: Number(l.credit), journalNo: l.journal?.number }));
    }
    if (dataset === 'SALES') {
      let rows = (await this.prisma.salesInvoice.findMany({ where: { companyId, ...(range ? { invoiceDate: range } : {}) }, include: { customer: true } }));
      if (status) rows = rows.filter((i) => i.status === status);
      if (kw) rows = rows.filter((i) => `${i.invoiceNo} ${i.customer?.name}`.toLowerCase().includes(kw));
      return rows.map((i) => ({ invoiceNo: i.invoiceNo, customer: i.customer?.name, date: i.invoiceDate, amount: Number(i.total), tax: Number(i.taxTotal), status: i.status }));
    }
    if (dataset === 'CUSTOMERS') {
      let rows = await this.prisma.customer.findMany({ where: { companyId } });
      if (kw) rows = rows.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(kw));
      return rows.map((c) => ({ name: c.name, email: c.email, phone: c.phone, city: c.city, country: c.country, creditLimit: Number(c.creditLimit || 0) }));
    }
    if (dataset === 'SUPPLIERS') {
      let rows = await this.prisma.supplier.findMany({ where: { companyId } });
      if (kw) rows = rows.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(kw));
      return rows.map((s) => ({ name: s.name, email: s.email, phone: s.phone, city: s.city, country: s.country }));
    }
    if (dataset === 'INVENTORY') {
      let rows = await this.prisma.inventoryItem.findMany({ where: { companyId }, include: { movements: true } });
      if (kw) rows = rows.filter((i) => `${i.sku} ${i.name}`.toLowerCase().includes(kw));
      return rows.map((i) => {
        const onHand = i.movements.reduce((s, m) => s + sign(m.type) * Number(m.quantity), 0);
        const receipts = i.movements.filter((m) => m.type === 'RECEIPT');
        const qty = receipts.reduce((s, m) => s + Number(m.quantity), 0);
        const avg = qty ? receipts.reduce((s, m) => s + Number(m.unitCost) * Number(m.quantity), 0) / qty : 0;
        return { sku: i.sku, name: i.name, onHand: Number(onHand.toFixed(2)), avgCost: Number(avg.toFixed(2)), value: Number((onHand * avg).toFixed(2)) };
      });
    }
    if (dataset === 'ASSETS') {
      let rows = await this.prisma.asset.findMany({ where: { companyId } });
      if (kw) rows = rows.filter((a) => `${a.assetNo} ${a.name}`.toLowerCase().includes(kw));
      return rows.map((a) => ({ assetNo: a.assetNo, name: a.name, cost: Number(a.cost), nbv: Number((Number(a.cost) - Number(a.accumulatedDepreciation)).toFixed(2)), status: a.status }));
    }
    if (dataset === 'PROJECTS') {
      let rows = await this.prisma.project.findMany({ where: { companyId }, include: { invoices: true, timesheets: true, supplierInvoices: true } });
      if (kw) rows = rows.filter((p) => p.name.toLowerCase().includes(kw));
      return rows.map((p) => {
        const revenue = p.invoices.filter((i) => ['POSTED', 'PART_PAID', 'PAID'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0);
        const cost = Number(p.timesheets.reduce((s, t) => s + Number(t.hours) * Number(t.costRate), 0)) + p.supplierInvoices.reduce((s, b) => s + Number(b.total), 0);
        const profit = revenue - cost;
        return { name: p.name, revenue: Number(revenue.toFixed(2)), cost: Number(cost.toFixed(2)), profit: Number(profit.toFixed(2)), margin: revenue ? Number(((profit / revenue) * 100).toFixed(2)) : 0 };
      });
    }
    return [];
  }
}
