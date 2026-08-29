import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { companyIdOf } from '../../core/context';
import { CreateGrnDto, CreatePurchaseOrderDto, CreateRequisitionDto, CreateSupplierInvoiceDto, CreateSupplierPaymentDto, SupplierDto } from './procurement.dto';
import { NumberingService } from '../../core/common/numbering.service';
import { AuditService } from '../../core/common/audit.service';
import { PostingService } from '../finance/posting.service';
import { StatusDto } from '../sales/sales.dto';

@ApiTags('Procurement') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('procurement')
export class ProcurementController {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private audit: AuditService, private posting: PostingService) {}

  private computeLines(lines: any[]) {
    let total = 0;
    const mapped = lines.map((l) => {
      const net = Number(l.quantity) * Number(l.unitPrice ?? l.estimatedCost ?? 0);
      total += net;
      return { ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice ?? l.estimatedCost ?? 0), estimatedCost: Number(l.unitPrice ?? l.estimatedCost ?? 0), lineTotal: Number(net.toFixed(2)) };
    });
    return { mapped, total: Number(total.toFixed(2)) };
  }

  // ----- Suppliers -----
  @Get('suppliers') async suppliers(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const list = await this.prisma.supplier.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    const invoices = await this.prisma.supplierInvoice.findMany({ where: { companyId, status: { not: 'DRAFT' }, supplierId: { in: list.map((s) => s.id) } }, select: { supplierId: true, total: true, amountPaid: true, status: true } });
    const bal: Record<string, number> = {};
    for (const i of invoices) { if (i.status === 'VOID') continue; bal[i.supplierId] = (bal[i.supplierId] || 0) + Math.max(0, Number(i.total) - Number(i.amountPaid)); }
    return list.map((s) => ({ ...s, outstanding: Number((bal[s.id] || 0).toFixed(2)) }));
  }
  @Post('suppliers') async createSupplier(@Req() req: any, @Body() dto: SupplierDto) {
    const companyId = companyIdOf(req.user);
    const { code, ...rest } = dto;
    const supplier = await this.prisma.supplier.create({ data: { companyId, code: code || await this.numbering.next(companyId, 'SUP'), ...rest } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Supplier', supplier.id, { code: supplier.code });
    return supplier;
  }
  @Patch('suppliers/:id') updateSupplier(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<SupplierDto>) {
    return this.prisma.supplier.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }
  @Get('suppliers/:id') async supplierDetail(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const supplier = await this.prisma.supplier.findFirst({ where: { id, companyId } });
    if (!supplier) throw new Error('Supplier not found');
    const [orders, grns, invoices] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where: { companyId, supplierId: id }, include: { lines: true }, orderBy: { orderDate: 'desc' } }),
      this.prisma.goodsReceivedNote.findMany({ where: { companyId, supplierId: id }, include: { purchaseOrder: true, lines: true }, orderBy: { receivedAt: 'desc' } }),
      this.prisma.supplierInvoice.findMany({ where: { companyId, supplierId: id }, include: { lines: true, payments: true }, orderBy: { invoiceDate: 'desc' } }),
    ]);
    const invoiceIds = invoices.map((i) => i.id);
    const orderIds = orders.map((o) => o.id);
    const payments = await this.prisma.supplierPayment.findMany({ where: { companyId, OR: [{ supplierInvoiceId: { in: invoiceIds } }, { purchaseOrderId: { in: orderIds } }] } });
    const outstanding = invoices.filter((i) => i.status !== 'DRAFT' && i.status !== 'VOID').reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.amountPaid)), 0);
    return { supplier, outstanding: Number(outstanding.toFixed(2)), purchaseOrders: orders, grns, invoices, payments };
  }
  @Delete('suppliers/:id') async deleteSupplier(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const s = await this.prisma.supplier.findFirst({ where: { id, companyId }, include: { _count: { select: { orders: true, goodsReceivedNotes: true, supplierInvoices: true, vendorCredits: true } } } });
    if (s && (s._count.orders || s._count.supplierInvoices || s._count.goodsReceivedNotes)) throw new BadRequestException('This supplier has transaction history and cannot be deleted. Set it to INACTIVE instead.');
    await this.prisma.supplier.deleteMany({ where: { id, companyId } });
    return { ok: true };
  }

  @Get('dashboard') async dashboard(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [pos, bills, payAgg, monthPayAgg] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where: { companyId }, select: { total: true, status: true } }),
      this.prisma.supplierInvoice.findMany({ where: { companyId, status: { notIn: ['DRAFT', 'VOID'] } }, select: { total: true, amountPaid: true, balanceDue: true, paymentStatus: true, dueDate: true } }),
      this.prisma.supplierPayment.findMany({ where: { companyId }, select: { amount: true } }),
      this.prisma.supplierPayment.aggregate({ where: { companyId, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    ]);
    const committed = pos.reduce((s, p) => s + Number(p.total), 0);
    let openPayables = 0, dueOverdue = 0, overdueCount = 0;
    for (const b of bills) {
      const balance = Math.max(0, Number(b.total) - Number(b.amountPaid));
      openPayables += balance;
      if (balance > 0.005) {
        const due = b.dueDate ? new Date(b.dueDate) : null;
        if (due && due < new Date(now.getFullYear(), now.getMonth(), now.getDate()) && (b.paymentStatus === 'UNPAID' || b.paymentStatus === 'PARTIALLY_PAID')) { dueOverdue += balance; overdueCount++; }
      }
    }
    return {
      purchaseOrders: pos.length, purchaseOrderValue: Number(committed.toFixed(2)),
      openPayables: Number(openPayables.toFixed(2)),
      dueOverdue: Number(dueOverdue.toFixed(2)), overdueBills: overdueCount,
      paymentsThisMonth: Number((monthPayAgg._sum.amount || 0).toFixed(2)),
      paymentCount: payAgg.length,
    };
  }

  // ----- Purchase requisitions -----
  @Get('requisitions') requisitions(@Req() req: any) {
    return this.prisma.purchaseRequisition.findMany({ where: { companyId: companyIdOf(req.user) }, include: { branch: true, lines: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post('requisitions') async createRequisition(@Req() req: any, @Body() dto: CreateRequisitionDto) {
    const companyId = companyIdOf(req.user);
    const { mapped, total } = this.computeLines(dto.lines);
    const requisitionNo = await this.numbering.next(companyId, 'PRQ');
    const r = await this.prisma.purchaseRequisition.create({ data: { companyId, branchId: dto.branchId, requisitionNo, requestedBy: dto.requestedBy, dateRequired: dto.dateRequired ? new Date(dto.dateRequired) : undefined, notes: dto.notes, lines: { create: mapped.map((l: any) => ({ description: l.description, itemId: l.itemId, quantity: l.quantity, estimatedCost: l.estimatedCost, lineTotal: l.lineTotal })) } }, include: { lines: true } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'PurchaseRequisition', r.id, { requisitionNo });
    return r;
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('procurement.requisitions.approve', 'procurement.requisitions.create')
  @Patch('requisitions/:id/status') setRequisitionStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.prisma.purchaseRequisition.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: { status: dto.status } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('procurement.purchase_orders.create')
  @Post('requisitions/:id/convert') async convertRequisition(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const r = await this.prisma.purchaseRequisition.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!r) throw new Error('Requisition not found');
    if (r.status !== 'APPROVED') throw new Error('Requisition must be approved before conversion');
    const supplier = await this.prisma.supplier.findFirst({ where: { companyId } });
    if (!supplier) throw new Error('Create a supplier first');
    const { total } = this.computeLines(r.lines);
    const poNo = await this.numbering.next(companyId, 'PO');
    const po = await this.prisma.purchaseOrder.create({
      data: { companyId, supplierId: supplier.id, requisitionId: r.id, poNo, status: 'DRAFT', total, lines: { create: r.lines.map((l) => ({ description: l.description, itemId: l.itemId, quantity: l.quantity, unitPrice: l.estimatedCost || 0, lineTotal: l.lineTotal })) } },
      include: { lines: true },
    });
    await this.prisma.purchaseRequisition.update({ where: { id: r.id }, data: { status: 'CONVERTED' } });
    await this.audit.log(companyId, req.user.sub, 'CONVERT', 'PurchaseRequisition', r.id, { poNo });
    return po;
  }
  @Delete('requisitions/:id') async deleteRequisition(@Req() req: any, @Param('id') id: string) {
    await this.prisma.purchaseRequisition.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Purchase orders -----
  @Get('purchase-orders') orders(@Req() req: any) {
    return this.prisma.purchaseOrder.findMany({ where: { companyId: companyIdOf(req.user) }, include: { supplier: true, lines: true, goodsReceivedNotes: true, supplierInvoices: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post('purchase-orders') async createOrder(@Req() req: any, @Body() dto: CreatePurchaseOrderDto) {
    const companyId = companyIdOf(req.user);
    const { mapped, total } = this.computeLines(dto.lines);
    const poNo = await this.numbering.next(companyId, 'PO');
    const po = await this.prisma.purchaseOrder.create({ data: { companyId, supplierId: dto.supplierId, poNo, orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(), currency: dto.currency || 'USD', total, lines: { create: mapped.map((l: any) => ({ description: l.description, itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })) } }, include: { lines: true } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'PurchaseOrder', po.id, { poNo });
    return po;
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('procurement.purchase_orders.approve')
  @Patch('purchase-orders/:id/status') setOrderStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.prisma.purchaseOrder.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: { status: dto.status as any } });
  }
  @Post('purchase-orders/:id/receive') async receiveOrder(@Req() req: any, @Param('id') id: string, @Body() dto: { warehouseId?: string; reference?: string; lines?: { quantity: number }[] }) {
    const companyId = companyIdOf(req.user);
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!po) throw new Error('Purchase order not found');
    const warehouseId = dto.warehouseId || (await this.prisma.warehouse.findFirst({ where: { companyId } }))?.id;
    if (!warehouseId) throw new Error('Create a warehouse first');
    const grnNo = await this.numbering.next(companyId, 'GRN');
    const lines = dto.lines?.length ? po.lines.map((l, i) => ({ itemId: l.itemId, quantity: dto.lines![i]?.quantity ?? l.quantity, unitCost: l.unitPrice, lineTotal: Number((Number(l.unitPrice) * (dto.lines![i]?.quantity ?? l.quantity)).toFixed(2)) })) : po.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitPrice, lineTotal: l.lineTotal }));
    const grn = await this.prisma.goodsReceivedNote.create({ data: { companyId, purchaseOrderId: po.id, supplierId: po.supplierId, warehouseId, grnNo, reference: dto.reference || po.poNo, status: 'DRAFT', lines: { create: lines } }, include: { lines: true } });
    await this.audit.log(companyId, req.user.sub, 'RECEIVE', 'PurchaseOrder', po.id, { grnNo });
    return grn;
  }
  @Get('purchase-orders/:id/match') async match(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId }, include: { lines: true, goodsReceivedNotes: { include: { lines: true } }, supplierInvoices: { include: { lines: true } } } });
    if (!po) throw new Error('Purchase order not found');
    const poLines = po.lines;
    const recv = (itemId?: string) => {
      const rows = po.goodsReceivedNotes.filter((g: any) => g.status === 'POSTED').flatMap((g: any) => g.lines).filter((l: any) => l.itemId === itemId);
      return rows.reduce((s: number, l: any) => s + Number(l.quantity), 0);
    };
    const inv = (itemId?: string) => {
      const rows = po.supplierInvoices.flatMap((si: any) => si.lines).filter((l: any) => l.itemId === itemId);
      return rows.reduce((s: number, l: any) => s + Number(l.quantity), 0);
    };
    return poLines.map((l) => {
      const receivedQty = recv(l.itemId ?? undefined);
      const invoiceQty = inv(l.itemId ?? undefined);
      const invoicePrice = po.supplierInvoices[0]?.lines.find((x: any) => x.itemId === l.itemId)?.unitPrice ?? l.unitPrice;
      return { lineId: l.id, description: l.description, poQty: Number(l.quantity), receivedQty, invoiceQty, poPrice: Number(l.unitPrice), invoicePrice: Number(invoicePrice), variance: Number((Number(po.supplierInvoices[0]?.lines.find((x: any) => x.itemId === l.itemId)?.unitPrice ?? l.unitPrice) - Number(l.unitPrice)).toFixed(2)) };
    });
  }
  @Delete('purchase-orders/:id') async deleteOrder(@Req() req: any, @Param('id') id: string) {
    await this.prisma.purchaseOrder.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Goods received notes -----
  @Get('grns') grns(@Req() req: any) {
    return this.prisma.goodsReceivedNote.findMany({ where: { companyId: companyIdOf(req.user) }, include: { purchaseOrder: true, supplier: true, warehouse: true, lines: true }, orderBy: { receivedAt: 'desc' } });
  }
  @Post('grns') async createGrn(@Req() req: any, @Body() dto: CreateGrnDto) {
    const companyId = companyIdOf(req.user);
    const { mapped, total } = this.computeLines(dto.lines);
    const grnNo = await this.numbering.next(companyId, 'GRN');
    const grn = await this.prisma.goodsReceivedNote.create({ data: { companyId, purchaseOrderId: dto.purchaseOrderId, supplierId: dto.supplierId, warehouseId: dto.warehouseId, grnNo, reference: dto.reference, lines: { create: mapped.map((l: any) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitPrice, lineTotal: l.lineTotal })) } }, include: { lines: true } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'GoodsReceivedNote', grn.id, { grnNo });
    return grn;
  }
  @Post('grns/:id/post') async postGrn(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const grn = await this.prisma.goodsReceivedNote.findFirst({ where: { id, companyId }, include: { lines: true, purchaseOrder: { include: { lines: true } } } });
    if (!grn) throw new Error('GRN not found');
    if (grn.status !== 'DRAFT') return grn;
    if (!grn.warehouseId) throw new BadRequestException('GRN requires a warehouse');
    await this.prisma.$transaction(async (tx) => {
      for (const line of grn.lines) {
        if (!line.itemId) continue;
        await tx.stockMovement.create({ data: { warehouseId: grn.warehouseId!, itemId: line.itemId, type: 'RECEIPT', quantity: line.quantity, unitCost: line.unitCost, reference: grn.grnNo, occurredAt: grn.receivedAt } });
        const poi = grn.purchaseOrder?.lines.find((l: any) => l.itemId === line.itemId);
        if (poi) {
          const newRecv = Number(poi.receivedQty || 0) + Number(line.quantity);
          if (newRecv > Number(poi.quantity) + 0.001) throw new BadRequestException(`Over-receipt blocked: received exceeds ordered for ${poi.description}`);
          await tx.purchaseOrderLine.update({ where: { id: poi.id }, data: { receivedQty: newRecv } });
        }
      }
      await tx.goodsReceivedNote.update({ where: { id: grn.id }, data: { status: 'POSTED' } });
    });
    if (grn.purchaseOrderId) {
      const po = grn.purchaseOrder;
      if (po) {
        const received = await this.prisma.goodsReceivedNoteLine.aggregate({ where: { grn: { companyId, purchaseOrderId: po.id, status: 'POSTED' } }, _sum: { quantity: true } });
        const ordered = po.lines.reduce((s, l) => s + Number(l.quantity), 0);
        const rs = Number(received._sum.quantity || 0) >= ordered - 0.001 ? 'RECEIVED' : Number(received._sum.quantity || 0) > 0 ? 'PARTIALLY_RECEIVED' : 'NOT_RECEIVED';
        await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { receiptStatus: rs } });
      }
    }
    await this.audit.log(companyId, req.user.sub, 'POST', 'GoodsReceivedNote', grn.id, { grnNo: grn.grnNo });
    return this.prisma.goodsReceivedNote.findUnique({ where: { id: grn.id }, include: { lines: true } });
  }
  @Delete('grns/:id') async deleteGrn(@Req() req: any, @Param('id') id: string) {
    await this.prisma.goodsReceivedNote.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Supplier invoices -----
  @Get('supplier-invoices') supplierInvoices(@Req() req: any) {
    return this.prisma.supplierInvoice.findMany({ where: { companyId: companyIdOf(req.user) }, include: { supplier: true, purchaseOrder: true, lines: true, payments: true }, orderBy: { invoiceDate: 'desc' } });
  }
  @Post('supplier-invoices') async createSupplierInvoice(@Req() req: any, @Body() dto: CreateSupplierInvoiceDto) {
    const companyId = companyIdOf(req.user);
    if (dto.invoiceNo && dto.invoiceNo.trim()) {
      const dup = await this.prisma.supplierInvoice.findFirst({ where: { companyId, supplierId: dto.supplierId, supplierInvoiceNo: dto.invoiceNo.trim() } });
      if (dup) throw new BadRequestException(`This supplier invoice number (${dto.invoiceNo}) already exists for this supplier. Bill: ${dup.invoiceNo}`);
    }
    if (dto.purchaseOrderId) {
      const dup = await this.prisma.supplierInvoice.findFirst({ where: { companyId, purchaseOrderId: dto.purchaseOrderId, status: { notIn: ['VOID'] } } });
      if (dup) throw new BadRequestException('Purchase order already billed');
      const po = await this.prisma.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId, companyId }, include: { lines: true } });
      if (po) {
        const totalInv = dto.lines.reduce((s, l) => s + Number(l.quantity), 0);
        const received = po.lines.reduce((s, l) => s + Number(l.receivedQty || 0), 0);
        if (totalInv > received + 0.001) throw new BadRequestException('Cannot bill more than the received quantity');
      }
    }
    const { mapped, total } = this.computeLines(dto.lines);
    const invoiceNo = await this.numbering.next(companyId, 'PINV');
    const si = await this.prisma.supplierInvoice.create({ data: { companyId, purchaseOrderId: dto.purchaseOrderId, supplierId: dto.supplierId, invoiceNo, supplierInvoiceNo: dto.invoiceNo?.trim() || null, invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(), dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, currency: dto.currency || 'USD', ref: dto.ref, memo: dto.memo, subtotal: total, taxTotal: 0, total, balanceDue: total, status: 'DRAFT', paymentStatus: 'UNPAID', matchStatus: dto.purchaseOrderId ? 'NOT_MATCHED' : 'NOT_MATCHED', lines: { create: mapped.map((l: any) => ({ description: l.description, itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })) } }, include: { lines: true } });
    if (dto.purchaseOrderId && si.id) {
      await this.prisma.$transaction(async (tx) => {
        for (const l of si.lines) {
          const poi = await tx.purchaseOrderLine.findFirst({ where: { purchaseOrderId: dto.purchaseOrderId, itemId: l.itemId } });
          if (poi) await tx.purchaseOrderLine.update({ where: { id: poi.id }, data: { invoicedQty: Number(poi.invoicedQty || 0) + Number(l.quantity) } });
        }
        const po2 = await tx.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId }, include: { lines: true } });
        const received = po2!.lines.reduce((s, l) => s + Number(l.receivedQty || 0), 0);
        const invoiced = po2!.lines.reduce((s, l) => s + Number(l.invoicedQty || 0), 0);
        const bs = invoiced >= received - 0.001 ? 'BILLED' : invoiced > 0 ? 'PARTIALLY_BILLED' : 'NOT_BILLED';
        await tx.purchaseOrder.update({ where: { id: dto.purchaseOrderId }, data: { billingStatus: bs } });
      });
    }
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'SupplierInvoice', si.id, { invoiceNo });
    return si;
  }
  @Post('supplier-invoices/:id/post') postSupplierInvoice(@Req() req: any, @Param('id') id: string) {
    return this.posting.postSupplierInvoice(companyIdOf(req.user), id);
  }
  @Delete('supplier-invoices/:id') async deleteSupplierInvoice(@Req() req: any, @Param('id') id: string) {
    await this.prisma.supplierInvoice.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Supplier payments -----
  @Get('supplier-payments') supplierPayments(@Req() req: any) {
    return this.prisma.supplierPayment.findMany({ where: { companyId: companyIdOf(req.user) }, include: { supplierInvoice: { include: { supplier: true } }, purchaseOrder: true }, orderBy: { paidAt: 'desc' } });
  }
  @Post('supplier-payments') async createSupplierPayment(@Req() req: any, @Body() dto: CreateSupplierPaymentDto) {
    const companyId = companyIdOf(req.user);
    const paymentNo = await this.numbering.next(companyId, 'SP');
    const payment = await this.prisma.supplierPayment.create({ data: { companyId, supplierInvoiceId: dto.supplierInvoiceId, purchaseOrderId: dto.purchaseOrderId, paymentNo, paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), amount: Number(dto.amount), method: dto.method || 'BANK', referenceNo: dto.referenceNo, note: dto.note } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'SupplierPayment', payment.id, { paymentNo });
    return this.posting.postSupplierPayment(companyId, payment.id);
  }
  @Delete('supplier-payments/:id') async deleteSupplierPayment(@Req() req: any, @Param('id') id: string) {
    await this.prisma.supplierPayment.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  @Get('purchase-report') async purchaseReport(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const pos = await this.prisma.purchaseOrder.findMany({ where: { companyId } });
    const byMonth: Record<string, { month: string; value: number }> = {};
    for (const po of pos) {
      const key = `${po.orderDate.getFullYear()}-${String(po.orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, value: 0 };
      byMonth[key].value += Number(po.total);
    }
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }
}
