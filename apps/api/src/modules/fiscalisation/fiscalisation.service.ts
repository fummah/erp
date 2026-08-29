import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FiscalProviderFactory } from './providers/provider.factory';
import { createHash } from 'crypto';

@Injectable()
export class FiscalisationService {
  constructor(private prisma: PrismaService, private factory: FiscalProviderFactory) {}

  async listDevices(companyId: string) {
    return this.prisma.fiscalDevice.findMany({ where: { branch: { companyId } }, include: { branch: true, fiscalDays: { orderBy: { dayNo: 'desc' }, take: 3 } } });
  }

  async register(companyId: string, deviceId: string) {
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } }, include: { branch: { include: { company: true } } } });
    if (!d) throw new BadRequestException('Device not found');
    const p = this.factory.get();
    const verified = await p.verifyTaxpayer({ tin: d.branch.company.tin, vatNumber: d.branch.company.vatNumber });
    const res = await p.registerDevice({ serialNumber: d.serialNumber, company: verified });
    await this.prisma.fiscalIntegrationLog.create({ data: { deviceId: d.id, operation: 'registerDevice', status: 'OK', request: { serialNumber: d.serialNumber }, response: res } });
    return this.prisma.fiscalDevice.update({ where: { id: d.id }, data: { status: 'ACTIVE', zimraDeviceId: res.zimraDeviceId, certificateRef: res.certificateRef, certificateExpiresAt: new Date(res.expiresAt) } });
  }

  async openDay(companyId: string, deviceId: string) {
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } } });
    if (!d) throw new BadRequestException('Device not found');
    if (d.status !== 'ACTIVE') throw new BadRequestException('Register device first');
    if (d.dayStatus === 'OPEN') throw new BadRequestException('Fiscal day already open');
    const dayNo = d.fiscalDayNo + 1;
    const res = await this.factory.get().openDay({ dayNo });
    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalIntegrationLog.create({ data: { deviceId: d.id, operation: 'openDay', status: 'OK', response: res } });
      await tx.fiscalDay.create({ data: { deviceId: d.id, dayNo, status: 'OPEN', openedAt: new Date() } });
      return tx.fiscalDevice.update({ where: { id: d.id }, data: { fiscalDayNo: dayNo, receiptCounter: 0, dayStatus: 'OPEN' } });
    });
  }

  private async allocate(deviceId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ fiscalDayNo: number; receiptCounter: number; globalReceiptNo: number }>>`UPDATE "FiscalDevice" SET "receiptCounter" = "receiptCounter" + 1, "globalReceiptNo" = "globalReceiptNo" + 1 WHERE id = ${deviceId} AND "dayStatus" = 'OPEN' RETURNING id, "fiscalDayNo", "receiptCounter", "globalReceiptNo"`;
    if (!rows[0]) throw new BadRequestException('Unable to allocate receipt sequence');
    return rows[0];
  }

  private async submitAndLink(a: { deviceId: string; zimraDeviceId: string | null; fiscalDayNo: number; receiptCounter: number; globalReceiptNo: number; receiptType: string; payload: any; receiptId: string; link: { invoiceId?: string; creditNoteId?: string; debitNoteId?: string } }) {
    try {
      const res = await this.factory.get().submitReceipt({ ...a.payload, receiptHash: a.payload.receiptHash });
      await this.prisma.$transaction(async (tx) => {
        await tx.fiscalReceipt.update({ where: { id: a.receiptId }, data: { status: 'FISCALISED', zimraReceiptId: res.receiptID, serverSignature: res.receiptServerSignature, rawResponse: res, submittedAt: new Date(), attemptCount: { increment: 1 }, lastAttemptAt: new Date() } });
        const target: any = {};
        if (a.link.invoiceId) target.invoice = { update: { fiscalStatus: 'FISCALISED' } };
        if (a.link.creditNoteId) target.creditNote = { update: { fiscalStatus: 'FISCALISED' } };
        if (a.link.debitNoteId) target.debitNote = { update: { fiscalStatus: 'FISCALISED' } };
        await tx.fiscalDay.update({ where: { deviceId_dayNo: { deviceId: a.deviceId, dayNo: a.fiscalDayNo } }, data: { receiptCount: { increment: 1 }, grossTotal: { increment: a.payload.total }, taxTotal: { increment: a.payload.tax } } });
        await tx.fiscalIntegrationLog.create({ data: { deviceId: a.deviceId, operation: 'submitReceipt', status: 'OK', request: a.payload, response: res } });
      });
      return this.prisma.fiscalReceipt.findUnique({ where: { id: a.receiptId } });
    } catch (e: any) {
      await this.prisma.fiscalReceipt.update({ where: { id: a.receiptId }, data: { status: 'RETRY', rawResponse: { error: e.message }, attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: e.message } });
      throw e;
    }
  }

  async fiscalise(companyId: string, deviceId: string, invoiceId: string) {
    const inv = await this.prisma.salesInvoice.findFirst({ where: { id: invoiceId, companyId }, include: { lines: true, customer: true, fiscalReceipt: true } });
    if (!inv) throw new BadRequestException('Invoice not found');
    if (inv.status === 'DRAFT') throw new BadRequestException('Post invoice before fiscalisation');
    if (!inv.fiscalRequired) throw new BadRequestException('Invoice does not require fiscalisation');
    if (inv.fiscalReceipt) throw new BadRequestException('Invoice already has fiscal receipt');
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } } });
    if (!d || d.dayStatus !== 'OPEN') throw new BadRequestException('Fiscal day is not open');
    const allocated = await this.allocate(deviceId);
    const payload = { deviceID: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalInvoice', invoiceNo: inv.invoiceNo, currency: inv.currency, total: Number(inv.total), tax: Number(inv.taxTotal), lines: inv.lines.map((l) => ({ name: l.description, qty: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate), taxAmount: Number(l.taxAmount), total: Number(l.lineTotal), hsCode: l.hsCode })) };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const receipt = await this.prisma.fiscalReceipt.create({ data: { deviceId: d.id, invoiceId: inv.id, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptHash: hash, rawRequest: payload, status: 'PENDING' } });
    return this.submitAndLink({ deviceId: d.id, zimraDeviceId: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalInvoice', payload: { ...payload, receiptHash: hash }, receiptId: receipt.id, link: { invoiceId: inv.id } });
  }

  async fiscaliseCreditNote(companyId: string, deviceId: string, creditNoteId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId }, include: { lines: true, invoice: { include: { fiscalReceipt: true } }, fiscalReceipt: true } });
    if (!cn) throw new BadRequestException('Credit note not found');
    if (cn.status === 'DRAFT') throw new BadRequestException('Post credit note before fiscalisation');
    if (cn.fiscalReceipt) throw new BadRequestException('Credit note already has fiscal receipt');
    const original = cn.invoice?.fiscalReceipt;
    if (!cn.invoice || !original) throw new BadRequestException('Credit note must reference a fiscalised invoice');
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } } });
    if (!d || d.dayStatus !== 'OPEN') throw new BadRequestException('Fiscal day is not open');
    const allocated = await this.allocate(deviceId);
    const payload = { deviceID: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalCreditNote', referenceReceipt: original.zimraReceiptId || original.globalReceiptNo, creditNoteNo: cn.creditNoteNo, currency: cn.invoice.currency, total: -Number(cn.total), tax: -Number(cn.taxTotal), lines: cn.lines.map((l) => ({ name: l.description, qty: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate), taxAmount: -Number(l.taxAmount), total: -Number(l.lineTotal) })) };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const receipt = await this.prisma.fiscalReceipt.create({ data: { deviceId: d.id, creditNoteId: cn.id, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalCreditNote', receiptHash: hash, rawRequest: payload, status: 'PENDING' } });
    return this.submitAndLink({ deviceId: d.id, zimraDeviceId: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalCreditNote', payload: { ...payload, receiptHash: hash }, receiptId: receipt.id, link: { creditNoteId: cn.id } });
  }

  async fiscaliseDebitNote(companyId: string, deviceId: string, debitNoteId: string) {
    const dn = await this.prisma.debitNote.findFirst({ where: { id: debitNoteId, companyId }, include: { lines: true, invoice: { include: { fiscalReceipt: true } }, fiscalReceipt: true } });
    if (!dn) throw new BadRequestException('Debit note not found');
    if (dn.status === 'DRAFT') throw new BadRequestException('Post debit note before fiscalisation');
    if (dn.fiscalReceipt) throw new BadRequestException('Debit note already has fiscal receipt');
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } } });
    if (!d || d.dayStatus !== 'OPEN') throw new BadRequestException('Fiscal day is not open');
    const allocated = await this.allocate(deviceId);
    const payload = { deviceID: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalDebitNote', debitNoteNo: dn.debitNoteNo, currency: 'USD', total: Number(dn.total), tax: Number(dn.taxTotal), lines: dn.lines.map((l) => ({ name: l.description, qty: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate), taxAmount: Number(l.taxAmount), total: Number(l.lineTotal) })) };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const receipt = await this.prisma.fiscalReceipt.create({ data: { deviceId: d.id, debitNoteId: dn.id, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalDebitNote', receiptHash: hash, rawRequest: payload, status: 'PENDING' } });
    return this.submitAndLink({ deviceId: d.id, zimraDeviceId: d.zimraDeviceId, fiscalDayNo: allocated.fiscalDayNo, receiptCounter: allocated.receiptCounter, globalReceiptNo: allocated.globalReceiptNo, receiptType: 'FiscalDebitNote', payload: { ...payload, receiptHash: hash }, receiptId: receipt.id, link: { debitNoteId: dn.id } });
  }

  async retryFiscalReceipts(companyId: string) {
    const receipts = await this.prisma.fiscalReceipt.findMany({ where: { status: 'RETRY', OR: [{ invoice: { companyId } }, { creditNote: { companyId } }, { debitNote: { companyId } }] }, include: { device: true } });
    let done = 0;
    for (const r of receipts) {
      try {
        const res = await this.factory.get().submitReceipt({ ...(r.rawRequest as any), receiptHash: r.receiptHash });
        await this.prisma.$transaction(async (tx) => {
          await tx.fiscalReceipt.update({ where: { id: r.id }, data: { status: 'FISCALISED', zimraReceiptId: res.receiptID, serverSignature: res.receiptServerSignature, rawResponse: res, submittedAt: new Date(), lastError: null } });
          if (r.invoiceId) await tx.salesInvoice.update({ where: { id: r.invoiceId }, data: { fiscalStatus: 'FISCALISED' } });
          if (r.creditNoteId) await tx.creditNote.update({ where: { id: r.creditNoteId }, data: { fiscalStatus: 'FISCALISED' } });
          if (r.debitNoteId) await tx.debitNote.update({ where: { id: r.debitNoteId }, data: { fiscalStatus: 'FISCALISED' } });
          await tx.fiscalIntegrationLog.create({ data: { deviceId: r.deviceId, operation: 'retrySubmit', status: 'OK', request: r.rawRequest as any, response: res } });
        });
        done++;
      } catch (e: any) {
        await this.prisma.fiscalReceipt.update({ where: { id: r.id }, data: { lastAttemptAt: new Date(), lastError: e.message, nextRetryAt: new Date(Date.now() + 120000) } });
      }
    }
    return { retried: done, remaining: receipts.length - done };
  }

  async closeDay(companyId: string, deviceId: string) {
    const d = await this.prisma.fiscalDevice.findFirst({ where: { id: deviceId, branch: { companyId } } });
    if (!d || d.dayStatus !== 'OPEN') throw new BadRequestException('No open fiscal day');
    const day = await this.prisma.fiscalDay.findUnique({ where: { deviceId_dayNo: { deviceId: d.id, dayNo: d.fiscalDayNo } } });
    const res = await this.factory.get().closeDay({ deviceId: d.zimraDeviceId, dayNo: d.fiscalDayNo, receiptCount: day?.receiptCount, grossTotal: Number(day?.grossTotal || 0), taxTotal: Number(day?.taxTotal || 0) });
    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalDay.update({ where: { deviceId_dayNo: { deviceId: d.id, dayNo: d.fiscalDayNo } }, data: { status: 'CLOSED', closedAt: new Date() } });
      await tx.fiscalIntegrationLog.create({ data: { deviceId: d.id, operation: 'closeDay', status: 'OK', response: res } });
      return tx.fiscalDevice.update({ where: { id: d.id }, data: { dayStatus: 'CLOSED' } });
    });
  }

  async receipts(companyId: string) {
    return this.prisma.fiscalReceipt.findMany({ where: { OR: [{ invoice: { companyId } }, { creditNote: { companyId } }, { debitNote: { companyId } }] }, include: { invoice: true, creditNote: true, debitNote: true, device: { include: { branch: true } } }, orderBy: { createdAt: 'desc' } });
  }
}

