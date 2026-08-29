import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { companyIdOf } from '../../core/context';
import { CountLineDto, CreateCountDto, CreateMovementDto, ItemDto, TransferDto, WarehouseDto } from './inventory.dto';
import { NumberingService } from '../../core/common/numbering.service';
import { AuditService } from '../../core/common/audit.service';

@ApiTags('Inventory') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('inventory')
export class InventoryController {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private audit: AuditService) {}

  private sign = (t: string) => ['RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(t) ? 1 : -1;
  private onHand = (m: any[]) => m.reduce((s, x) => s + this.sign(x.type) * Number(x.quantity), 0);

  // ----- Items -----
  @Get('items') items(@Req() req: any) { return this.prisma.inventoryItem.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: { name: 'asc' } }); }
  @Post('items') async createItem(@Req() req: any, @Body() dto: ItemDto) {
    const companyId = companyIdOf(req.user);
    const sku = dto.sku || await this.numbering.next(companyId, 'SKU');
    const item = await this.prisma.inventoryItem.create({ data: { companyId, sku, name: dto.name, unit: dto.unit || 'EA', hsCode: dto.hsCode, reorderLevel: dto.reorderLevel ?? 0, trackBatch: dto.trackBatch ?? false, trackSerial: dto.trackSerial ?? false, active: dto.active ?? true } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'InventoryItem', item.id, { sku });
    return item;
  }
  @Patch('items/:id') updateItem(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<ItemDto>) {
    return this.prisma.inventoryItem.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }
  @Delete('items/:id') async deleteItem(@Req() req: any, @Param('id') id: string) {
    await this.prisma.inventoryItem.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Warehouses -----
  @Get('warehouses') warehouses(@Req() req: any) { return this.prisma.warehouse.findMany({ where: { companyId: companyIdOf(req.user) }, include: { branch: true } }); }
  @Post('warehouses') async createWarehouse(@Req() req: any, @Body() dto: WarehouseDto) {
    const companyId = companyIdOf(req.user);
    const code = dto.code || await this.numbering.next(companyId, 'WH');
    const w = await this.prisma.warehouse.create({ data: { companyId, branchId: dto.branchId, code, name: dto.name } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Warehouse', w.id, { code });
    return w;
  }
  @Patch('warehouses/:id') updateWarehouse(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<WarehouseDto>) {
    return this.prisma.warehouse.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }
  @Delete('warehouses/:id') async deleteWarehouse(@Req() req: any, @Param('id') id: string) {
    await this.prisma.warehouse.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Stock -----
  @Get('stock') async stock(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const items = await this.prisma.inventoryItem.findMany({ where: { companyId }, include: { movements: true } });
    return items.map((i: any) => {
      const onHand = this.onHand(i.movements);
      const receipts = i.movements.filter((m: any) => m.type === 'RECEIPT');
      const avgCost = receipts.length ? receipts.reduce((s: number, m: any) => s + Number(m.unitCost || 0), 0) / receipts.length : 0;
      return { ...i, movements: undefined, onHand, avgCost: Number(avgCost.toFixed(2)), value: Number((onHand * avgCost).toFixed(2)) };
    });
  }

  @Get('movements') movements(@Req() req: any) {
    return this.prisma.stockMovement.findMany({ where: { warehouse: { companyId: companyIdOf(req.user) } }, include: { item: true, warehouse: { include: { branch: true } } }, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  @Post('movements') async createMovement(@Req() req: any, @Body() dto: CreateMovementDto) {
    const companyId = companyIdOf(req.user);
    const wh = await this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, companyId } });
    if (!wh) throw new Error('Warehouse not found');
    const movement = await this.prisma.stockMovement.create({ data: { warehouseId: dto.warehouseId, itemId: dto.itemId, type: dto.type as any, quantity: Number(dto.quantity), unitCost: dto.unitCost ?? 0, reference: dto.reference } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'StockMovement', movement.id, { type: dto.type });
    return movement;
  }

  @Post('transfers') async transfer(@Req() req: any, @Body() dto: TransferDto) {
    const companyId = companyIdOf(req.user);
    const [from, to] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { id: dto.fromWarehouseId, companyId } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.toWarehouseId, companyId } }),
    ]);
    if (!from || !to) throw new Error('Warehouse not found');
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new Error('Source and destination warehouses must differ');
    const ref = dto.reference || await this.numbering.next(companyId, 'TRF');
    const results = await this.prisma.$transaction([
      this.prisma.stockMovement.create({ data: { warehouseId: from.id, itemId: dto.itemId, type: 'TRANSFER_OUT', quantity: Number(dto.quantity), unitCost: 0, reference: ref } }),
      this.prisma.stockMovement.create({ data: { warehouseId: to.id, itemId: dto.itemId, type: 'TRANSFER_IN', quantity: Number(dto.quantity), unitCost: 0, reference: ref } }),
    ]);
    await this.audit.log(companyId, req.user.sub, 'TRANSFER', 'StockMovement', results[0].id, { ref });
    return results;
  }

  // ----- Stock counts -----
  @Get('counts') counts(@Req() req: any) {
    return this.prisma.stockCount.findMany({ where: { companyId: companyIdOf(req.user) }, include: { warehouse: true, lines: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post('counts') async createCount(@Req() req: any, @Body() dto: CreateCountDto) {
    const companyId = companyIdOf(req.user);
    const countNo = await this.numbering.next(companyId, 'SC');
    const count = await this.prisma.stockCount.create({
      data: { companyId, warehouseId: dto.warehouseId, countNo, lines: { create: dto.lines.map((l: CountLineDto) => ({ itemId: l.itemId, systemQty: 0, countedQty: l.countedQty, variance: 0 })) } },
      include: { lines: true },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'StockCount', count.id, { countNo });
    return count;
  }
  @Post('counts/:id/post') async postCount(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const count = await this.prisma.stockCount.findFirst({ where: { id, companyId }, include: { lines: true, warehouse: true } });
    if (!count) throw new Error('Stock count not found');
    if (count.status !== 'DRAFT') return count;
    const movements: any[] = [];
    for (const line of count.lines) {
      const movementsAll = await this.prisma.stockMovement.findMany({ where: { warehouseId: count.warehouseId, itemId: line.itemId } });
      const onHand = movementsAll.reduce((s, m) => s + (['RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(m.type) ? Number(m.quantity) : -Number(m.quantity)), 0);
      const variance = Number(line.countedQty) - onHand;
      await this.prisma.stockCountLine.update({ where: { id: line.id }, data: { systemQty: onHand, variance } });
      if (Math.abs(variance) > 0.0001) {
        movements.push({ warehouseId: count.warehouseId, itemId: line.itemId, type: variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantity: Math.abs(variance), unitCost: 0, reference: count.countNo, occurredAt: count.countDate });
      }
    }
    if (movements.length) await this.prisma.stockMovement.createMany({ data: movements });
    await this.prisma.stockCount.update({ where: { id: count.id }, data: { status: 'POSTED' } });
    await this.audit.log(companyId, req.user.sub, 'POST', 'StockCount', count.id, { countNo: count.countNo });
    return this.prisma.stockCount.findUnique({ where: { id: count.id }, include: { lines: true } });
  }
  @Delete('counts/:id') async deleteCount(@Req() req: any, @Param('id') id: string) {
    await this.prisma.stockCount.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Reports -----
  @Get('valuation') async valuation(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const items = await this.prisma.inventoryItem.findMany({ where: { companyId }, include: { movements: true } });
    const rows = items.map((i: any) => {
      const onHand = this.onHand(i.movements);
      const receipts = i.movements.filter((m: any) => m.type === 'RECEIPT');
      const avgCost = receipts.length ? receipts.reduce((s: number, m: any) => s + Number(m.unitCost || 0), 0) / receipts.length : 0;
      return { id: i.id, sku: i.sku, name: i.name, unit: i.unit, onHand, avgCost: Number(avgCost.toFixed(2)), value: Number((onHand * avgCost).toFixed(2)) };
    });
    return { rows, totalValue: Number(rows.reduce((s, r) => s + r.value, 0).toFixed(2)) };
  }

  @Get('reorder') async reorder(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const items = await this.prisma.inventoryItem.findMany({ where: { companyId, active: true }, include: { movements: true } });
    return items
      .map((i: any) => ({ id: i.id, sku: i.sku, name: i.name, unit: i.unit, onHand: this.onHand(i.movements), reorderLevel: Number(i.reorderLevel) }))
      .filter((r: any) => r.onHand <= r.reorderLevel)
      .sort((a: any, b: any) => a.onHand - b.onHand);
  }
}