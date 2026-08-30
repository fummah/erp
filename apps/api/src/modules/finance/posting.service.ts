import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NumberingService } from '../../core/common/numbering.service';
import { InvoiceStatusService } from './invoice-status.service';

type JournalLine = { code: string; debit: number; credit: number; description?: string };

@Injectable()
export class PostingService {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private invoiceStatus: InvoiceStatusService) {}

  async accountsByCode(companyId: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({ where: { companyId } });
    return Object.fromEntries(accounts.map((a) => [a.code, a]));
  }

  async requireAccount(byCode: Record<string, any>, code: string) {
    if (!byCode[code]) throw new BadRequestException(`Required control account ${code} is missing from the chart of accounts`);
    return byCode[code];
  }

  async postJournal(companyId: string, opts: { date: Date; description: string; reference?: string; sourceType: string; sourceId?: string; lines: JournalLine[] }) {
    const period = await this.prisma.fiscalPeriod.findFirst({ where: { companyId, startDate: { lte: opts.date }, endDate: { gte: opts.date } } });
    if (period && period.status === 'CLOSED') throw new BadRequestException(`Posting blocked: ${period.name} is closed`);
    const byCode = await this.accountsByCode(companyId);
    for (const l of opts.lines) await this.requireAccount(byCode, l.code);
    const number = await this.numbering.next(companyId, 'JE');
    const journal = await this.prisma.journalEntry.create({
      data: {
        companyId, number, date: opts.date, description: opts.description, reference: opts.reference,
        sourceType: opts.sourceType, sourceId: opts.sourceId, status: 'POSTED',
        lines: { create: opts.lines.map((l) => ({ accountId: byCode[l.code].id, debit: l.debit, credit: l.credit, description: l.description })) },
      },
      include: { lines: true },
    });
    return journal;
  }

  async postSalesInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({ where: { id: invoiceId, companyId }, include: { lines: true } });
    if (!invoice) throw new BadRequestException('Invoice not found');
    if (invoice.status !== 'DRAFT') return invoice;
    await this.postJournal(companyId, {
      date: invoice.invoiceDate,
      description: `Sales invoice ${invoice.invoiceNo}`,
      reference: invoice.invoiceNo,
      sourceType: 'SALES_INVOICE', sourceId: invoice.id,
      lines: [
        { code: '1100', debit: Number(invoice.total), credit: 0, description: 'Accounts receivable' },
        { code: '4000', debit: 0, credit: Number(invoice.subtotal), description: 'Sales revenue' },
        ...(Number(invoice.taxTotal) > 0 ? [{ code: '2100', debit: 0, credit: Number(invoice.taxTotal), description: 'VAT payable' }] : []),
      ],
    });
    await this.prisma.salesInvoice.update({ where: { id: invoice.id }, data: { status: 'POSTED', invoiceStatus: 'POSTED', fiscalStatus: invoice.fiscalRequired ? 'READY' : 'NOT_REQUIRED' } });
    const updated = await this.invoiceStatus.recalc(companyId, invoice.id);
    return this.prisma.salesInvoice.findUnique({ where: { id: invoice.id }, include: { lines: true } });
  }

  async postCreditNote(companyId: string, creditNoteId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId }, include: { lines: true } });
    if (!cn) throw new BadRequestException('Credit note not found');
    if (cn.status !== 'DRAFT') return cn;
    await this.postJournal(companyId, {
      date: cn.creditNoteDate,
      description: `Credit note ${cn.creditNoteNo}`,
      reference: cn.creditNoteNo,
      sourceType: 'CREDIT_NOTE', sourceId: cn.id,
      lines: [
        { code: '4000', debit: Number(cn.subtotal), credit: 0, description: 'Sales returns' },
        ...(Number(cn.taxTotal) > 0 ? [{ code: '2100', debit: Number(cn.taxTotal), credit: 0, description: 'VAT reversal' }] : []),
        { code: '1100', debit: 0, credit: Number(cn.total), description: 'Accounts receivable reduction' },
      ],
    });
    await this.prisma.creditNote.update({ where: { id: cn.id }, data: { status: 'POSTED', applicationStatus: cn.invoiceId ? 'APPLIED' : 'UNAPPLIED', appliedAmount: cn.invoiceId ? Number(cn.total) : 0, fiscalStatus: cn.fiscalStatus || 'READY' } });
    if (cn.invoiceId) { try { await this.invoiceStatus.recalc(companyId, cn.invoiceId); } catch {} }
    return this.prisma.creditNote.findUnique({ where: { id: cn.id }, include: { lines: true } });
  }

  async postDebitNote(companyId: string, debitNoteId: string) {
    const dn = await this.prisma.debitNote.findFirst({ where: { id: debitNoteId, companyId }, include: { lines: true } });
    if (!dn) throw new BadRequestException('Debit note not found');
    if (dn.status !== 'DRAFT') return dn;
    await this.postJournal(companyId, {
      date: dn.date,
      description: `Debit note ${dn.debitNoteNo}`,
      reference: dn.debitNoteNo,
      sourceType: 'DEBIT_NOTE', sourceId: dn.id,
      lines: [
        { code: '1100', debit: Number(dn.total), credit: 0, description: 'Accounts receivable increase' },
        { code: '4000', debit: 0, credit: Number(dn.subtotal), description: 'Sales revenue' },
        ...(Number(dn.taxTotal) > 0 ? [{ code: '2100', debit: 0, credit: Number(dn.taxTotal), description: 'VAT' }] : []),
      ],
    });
    await this.prisma.debitNote.update({ where: { id: dn.id }, data: { status: 'POSTED', paymentStatus: 'UNPAID', balanceDue: Number(dn.total), amountPaid: 0, fiscalStatus: dn.fiscalStatus || 'READY' } });
    return this.prisma.debitNote.findUnique({ where: { id: dn.id }, include: { lines: true } });
  }

  async postCustomerPayment(companyId: string, input: { amount: number; depositAccountCode?: string; reference: string; date: Date; sourceId: string }) {
    // Option A — unapplied customer AR credit: Dr deposit / cash, Cr Accounts Receivable.
    await this.postJournal(companyId, {
      date: input.date,
      description: `Customer payment ${input.reference}`,
      reference: input.reference,
      sourceType: 'RECEIPT', sourceId: input.sourceId,
      lines: [
        { code: input.depositAccountCode || '1000', debit: Number(input.amount), credit: 0, description: 'Cash / bank' },
        { code: '1100', debit: 0, credit: Number(input.amount), description: 'Accounts receivable' },
      ],
    });
  }

  async postReceipt(companyId: string, receiptId: string) {
    const receipt = await this.prisma.receipt.findFirst({ where: { id: receiptId, companyId }, include: { invoice: true } });
    if (!receipt) throw new BadRequestException('Receipt not found');
    await this.postJournal(companyId, {
      date: receipt.receiptDate,
      description: `Receipt ${receipt.receiptNo}${receipt.invoice ? ` for invoice ${receipt.invoice.invoiceNo}` : ''}`,
      reference: receipt.receiptNo,
      sourceType: 'RECEIPT', sourceId: receipt.id,
      lines: [
        { code: '1000', debit: Number(receipt.amount), credit: 0, description: 'Cash / bank' },
        ...(receipt.invoice ? [{ code: '1100', debit: 0, credit: Number(receipt.amount), description: 'Accounts receivable' }] : []),
      ],
    });
    if (receipt.invoice) {
      const totalPaid = await this.prisma.receipt.aggregate({ where: { companyId, invoiceId: receipt.invoiceId }, _sum: { amount: true } });
      const paid = Number(totalPaid._sum.amount || 0);
      const status = paid >= Number(receipt.invoice.total) - 0.005 ? 'PAID' : 'PART_PAID';
      if (receipt.invoice.status === 'POSTED' || receipt.invoice.status === 'PART_PAID' || receipt.invoice.status === 'PAID') {
        await this.prisma.salesInvoice.update({ where: { id: receipt.invoice.id }, data: { status, invoiceStatus: 'POSTED' } });
      }
      if (receipt.invoiceId) { try { await this.invoiceStatus.recalc(companyId, receipt.invoiceId); } catch {} }
    }
    return receipt;
  }

  async postSupplierInvoice(companyId: string, supplierInvoiceId: string) {
    const si = await this.prisma.supplierInvoice.findFirst({ where: { id: supplierInvoiceId, companyId }, include: { lines: true } });
    if (!si) throw new BadRequestException('Supplier invoice not found');
    if (si.status === 'POSTED') return si;
    if (!si.lines.length) throw new BadRequestException('Bill has no lines');
    const byCode = await this.accountsByCode(companyId);
    const drLines: { code: string; debit: number; credit: number; description: string }[] = [];
    for (const l of si.lines) {
      let code = l.accountCode;
      if (!code && l.accountId) {
        const acc = await this.prisma.ledgerAccount.findFirst({ where: { id: l.accountId, companyId } });
        code = acc?.code || '';
      }
      if (!code) code = l.itemId ? '1200' : '6000';
      if (!byCode[code]) throw new BadRequestException(`Line account ${code} not found for "${l.description}". Add an account to every bill line.`);
      const net = Number(l.lineTotal) - Number(l.taxAmount || 0);
      drLines.push({ code, debit: Number(net.toFixed(2)), credit: 0, description: l.description });
    }
    const taxTotal = Number(si.taxTotal || 0);
    if (taxTotal > 0) drLines.push({ code: '2100', debit: Number(taxTotal.toFixed(2)), credit: 0, description: 'Input VAT' });
    const total = Number(si.total);
    drLines.push({ code: '2000', debit: 0, credit: Number(total.toFixed(2)), description: 'Accounts payable' });
    const totalDebit = drLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = drLines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.02) throw new BadRequestException(`Bill does not balance (Dr ${totalDebit.toFixed(2)} vs Cr ${totalCredit.toFixed(2)}). Check line amounts and tax.`);
    await this.postJournal(companyId, {
      date: si.invoiceDate,
      description: `Supplier invoice ${si.invoiceNo}`,
      reference: si.invoiceNo,
      sourceType: 'SUPPLIER_INVOICE', sourceId: si.id,
      lines: drLines,
    });
    const po = si.purchaseOrderId ? await this.prisma.purchaseOrder.findFirst({ where: { id: si.purchaseOrderId, companyId }, include: { lines: true } }) : null;
    let matchStatus = 'NOT_MATCHED';
    if (po) {
      const diff = si.lines.some((l) => {
        const poLine = po.lines.find((p: any) => p.itemId === l.itemId);
        if (!poLine) return true;
        const overBill = Number(l.quantity) > Number(poLine.quantity) + 0.001;
        const overPrice = Number(l.unitPrice) > Number(poLine.unitPrice) * 1.02 + 0.001;
        return overBill || overPrice;
      });
      matchStatus = diff ? 'EXCEPTION' : 'MATCHED';
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({ where: { id: si.id }, data: { status: 'POSTED', paymentStatus: 'UNPAID', amountPaid: 0, balanceDue: Number(si.total), matchStatus } });
      if (po) {
        const invoiced = po.lines.reduce((s, l) => s + Number(l.invoicedQty || 0), 0);
        const received = po.lines.reduce((s, l) => s + Number(l.receivedQty || 0), 0);
        const bs = invoiced >= received - 0.001 ? 'BILLED' : invoiced > 0 ? 'PARTIALLY_BILLED' : 'NOT_BILLED';
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { billingStatus: bs } });
      }
    });
    return this.prisma.supplierInvoice.findUnique({ where: { id: si.id }, include: { lines: true, attachments: true } });
  }

  async postSupplierPayment(companyId: string, paymentId: string) {
    const payment = await this.prisma.supplierPayment.findFirst({ where: { id: paymentId, companyId }, include: { supplierInvoice: true } });
    if (!payment) throw new BadRequestException('Payment not found');
    await this.postJournal(companyId, {
      date: payment.paidAt,
      description: `Supplier payment ${payment.paymentNo}${payment.supplierInvoice ? ` for invoice ${payment.supplierInvoice.invoiceNo}` : ''}`,
      reference: payment.paymentNo,
      sourceType: 'SUPPLIER_PAYMENT', sourceId: payment.id,
      lines: [
        ...(payment.supplierInvoice ? [{ code: '2000', debit: Number(payment.amount), credit: 0, description: 'Accounts payable' }] : [{ code: '6000', debit: Number(payment.amount), credit: 0, description: 'Expense payment' }]),
        { code: '1000', debit: 0, credit: Number(payment.amount), description: 'Cash / bank' },
      ],
    });
    if (payment.supplierInvoice) {
      const totalPaid = await this.prisma.supplierPayment.aggregate({ where: { companyId, supplierInvoiceId: payment.supplierInvoiceId }, _sum: { amount: true } });
      const paid = Number(totalPaid._sum.amount || 0);
      const total = Number(payment.supplierInvoice.total);
      const balance = Math.max(0, total - paid);
      const payStatus = paid <= 0.005 ? 'UNPAID' : balance <= 0.005 ? 'PAID' : 'PARTIALLY_PAID';
      await this.prisma.supplierInvoice.update({ where: { id: payment.supplierInvoice.id }, data: { status: 'POSTED', amountPaid: paid, balanceDue: balance, paymentStatus: payStatus } });
    }
    return this.prisma.supplierPayment.findUnique({ where: { id: payment.id }, include: { supplierInvoice: { include: { supplier: true } } } });
  }
}
