import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { JwtAuthGuard } from '../auth/auth.guard';
import { companyIdOf } from '../../core/context';
import { AccountDto, BudgetDto, CreateJournalDto, TaxRateDto } from './finance.dto';
import { NumberingService } from '../../core/common/numbering.service';
import { AuditService } from '../../core/common/audit.service';
import { PostingService } from './posting.service';

@ApiTags('Finance') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('finance')
export class FinanceController {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private audit: AuditService, private posting: PostingService) {}

  // ----- Chart of accounts -----
  @Get('accounts') accounts(@Req() req: any) { return this.prisma.ledgerAccount.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: { code: 'asc' } }); }
  @Post('accounts') async createAccount(@Req() req: any, @Body() dto: AccountDto) {
    const companyId = companyIdOf(req.user);
    const code = dto.code || await this.numbering.next(companyId, 'ACC');
    const account = await this.prisma.ledgerAccount.create({ data: { companyId, code, name: dto.name, type: dto.type as any, parentId: dto.parentId, active: dto.active ?? true } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'LedgerAccount', account.id, { code });
    return account;
  }
  @Patch('accounts/:id') updateAccount(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<AccountDto>) {
    return this.prisma.ledgerAccount.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto as any });
  }
  @Delete('accounts/:id') async deleteAccount(@Req() req: any, @Param('id') id: string) {
    await this.prisma.ledgerAccount.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Journals -----
  @Get('journals') journals(@Req() req: any) {
    return this.prisma.journalEntry.findMany({ where: { companyId: companyIdOf(req.user) }, include: { lines: { include: { account: true } } }, orderBy: { date: 'desc' }, take: 200 });
  }
  @Post('journals') async createJournal(@Req() req: any, @Body() dto: CreateJournalDto) {
    const companyId = companyIdOf(req.user);
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) throw new BadRequestException('Journal is not balanced');
    const number = await this.numbering.next(companyId, 'JE');
    const journal = await this.prisma.journalEntry.create({
      data: { companyId, number, date: dto.date ? new Date(dto.date) : new Date(), description: dto.description, reference: dto.reference, sourceType: 'MANUAL', status: 'POSTED', lines: { create: dto.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), description: l.description })) } },
      include: { lines: true },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'JournalEntry', journal.id, { number });
    return journal;
  }
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.journals.reverse')
  @Post('journals/:id/reverse') async reverseJournal(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const journal = await this.prisma.journalEntry.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!journal) throw new BadRequestException('Journal not found');
    if (journal.status === 'REVERSED') return journal;
    const number = await this.numbering.next(companyId, 'JE');
    const reversed = await this.prisma.journalEntry.create({
      data: { companyId, number, date: new Date(), description: `Reverse of ${journal.number}`, reference: journal.reference, sourceType: 'REVERSAL', sourceId: journal.id, status: 'POSTED', lines: { create: journal.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: `Reverse: ${l.description}` })) } },
    });
    await this.prisma.journalEntry.update({ where: { id: journal.id }, data: { status: 'REVERSED' } });
    await this.audit.log(companyId, req.user.sub, 'REVERSE', 'JournalEntry', journal.id, { number });
    return reversed;
  }

  // ----- Budgets -----
  @Get('budgets') budgets(@Req() req: any) {
    return this.prisma.budget.findMany({ where: { companyId: companyIdOf(req.user) }, include: { account: true } });
  }
  @Post('budgets') async createBudget(@Req() req: any, @Body() dto: BudgetDto) {
    const companyId = companyIdOf(req.user);
    const budget = await this.prisma.budget.create({ data: { companyId, fiscalYear: dto.fiscalYear, period: dto.period, accountId: dto.accountId, amount: Number(dto.amount) } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Budget', budget.id);
    return budget;
  }
  @Patch('budgets/:id') updateBudget(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<BudgetDto>) {
    return this.prisma.budget.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }
  @Delete('budgets/:id') async deleteBudget(@Req() req: any, @Param('id') id: string) {
    await this.prisma.budget.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Tax rates -----
  @Get('tax-rates') taxRates(@Req() req: any) { return this.prisma.taxRate.findMany({ where: { companyId: companyIdOf(req.user) } }); }
  @Post('tax-rates') async createTaxRate(@Req() req: any, @Body() dto: TaxRateDto) {
    const companyId = companyIdOf(req.user);
    const code = dto.code || await this.numbering.next(companyId, 'TAX');
    const tax = await this.prisma.taxRate.create({ data: { companyId, code, name: dto.name, rate: Number(dto.rate), active: dto.active ?? true } });
    return tax;
  }
  @Patch('tax-rates/:id') updateTaxRate(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<TaxRateDto>) {
    return this.prisma.taxRate.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }
  @Delete('tax-rates/:id') async deleteTaxRate(@Req() req: any, @Param('id') id: string) {
    await this.prisma.taxRate.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Reports -----
  @Get('trial-balance') async trialBalance(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' } }, include: { account: true } });
    const out: Record<string, any> = {};
    for (const l of lines) {
      if (!out[l.account.code]) out[l.account.code] = { code: l.account.code, name: l.account.name, type: l.account.type, debit: 0, credit: 0 };
      out[l.account.code].debit += Number(l.debit);
      out[l.account.code].credit += Number(l.credit);
    }
    return Object.values(out).sort((a: any, b: any) => a.code.localeCompare(b.code));
  }

  @Get('profit-loss') async pnl(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { type: { in: ['REVENUE', 'EXPENSE'] } } }, include: { account: true } });
    const grouped: any = { revenue: {}, expenses: {} };
    for (const l of lines) {
      const target = l.account.type === 'REVENUE' ? grouped.revenue : grouped.expenses;
      const amount = l.account.type === 'REVENUE' ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
      target[l.account.code] = (target[l.account.code] || 0) + amount;
    }
    const totals = { revenue: Object.values(grouped.revenue).reduce((s: number, v: any) => s + v, 0), expenses: Object.values(grouped.expenses).reduce((s: number, v: any) => s + v, 0) };
    return { ...grouped, totals, netProfit: Number((totals.revenue - totals.expenses).toFixed(2)) };
  }

  @Get('balance-sheet') async bs(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } } }, include: { account: true } });
    const out: any = { ASSET: {}, LIABILITY: {}, EQUITY: {} };
    for (const l of lines) {
      const normal = l.account.type === 'ASSET' ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit);
      out[l.account.type][l.account.code] = (out[l.account.type][l.account.code] || 0) + normal;
    }
    const totals = {
      ASSET: Number(Object.values(out.ASSET).reduce((s: number, v: any) => s + v, 0).toFixed(2)),
      LIABILITY: Number(Object.values(out.LIABILITY).reduce((s: number, v: any) => s + v, 0).toFixed(2)),
      EQUITY: Number(Object.values(out.EQUITY).reduce((s: number, v: any) => s + v, 0).toFixed(2)),
    };
    const pnlLines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { type: { in: ['REVENUE', 'EXPENSE'] } } }, include: { account: true } });
    const pnl = { revenue: 0, expenses: 0 };
    for (const l of pnlLines) {
      if (l.account.type === 'REVENUE') pnl.revenue += Number(l.credit) - Number(l.debit);
      else pnl.expenses += Number(l.debit) - Number(l.credit);
    }
    const retainedEarnings = Number((pnl.revenue - pnl.expenses).toFixed(2));
    out.EQUITY['retainedEarnings'] = (out.EQUITY['retainedEarnings'] || 0) + retainedEarnings;
    const finalEquity = totals.EQUITY + retainedEarnings;
    return { ...out, totals: { ...totals, EQUITY: Number(finalEquity.toFixed(2)), totalEquityAndLiabilities: Number((totals.LIABILITY + finalEquity).toFixed(2)) }, retainedEarnings };
  }

  @Get('cashflow') async cashflow(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { code: '1000' } }, include: { journal: true } });
    const byMonth: Record<string, { month: string; inflow: number; outflow: number; net: number }> = {};
    for (const l of lines) {
      const d = l.journal.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, inflow: 0, outflow: 0, net: 0 };
      byMonth[key].inflow += Number(l.debit);
      byMonth[key].outflow += Number(l.credit);
      byMonth[key].net += Number(l.debit) - Number(l.credit);
    }
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }

  @Get('budget-vs-actual') async budgetVsActual(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const year = new Date().getFullYear();
    const budgets = await this.prisma.budget.findMany({ where: { companyId, fiscalYear: year }, include: { account: true } });
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { type: { in: ['REVENUE', 'EXPENSE'] } } }, include: { account: true } });
    const actualByAccount: Record<string, number> = {};
    for (const l of lines) {
      if (!actualByAccount[l.accountId]) actualByAccount[l.accountId] = 0;
      const amount = l.account.type === 'REVENUE' ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
      actualByAccount[l.accountId] += amount;
    }
    const rows = budgets.map((b) => {
      const actual = actualByAccount[b.accountId] || 0;
      const budget = Number(b.amount);
      return { accountCode: b.account.code, accountName: b.account.name, type: b.account.type, budget, actual: Number(actual.toFixed(2)), variance: Number((actual - budget).toFixed(2)) };
    });
    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    return { year, rows, totals: { budget: totalBudget, actual: Number(totalActual.toFixed(2)), variance: Number((totalActual - totalBudget).toFixed(2)) } };
  }

  private async ensurePeriods(companyId: string) {
    const now = new Date();
    for (const year of [now.getFullYear() - 1, now.getFullYear()]) {
      const fy = await this.prisma.financialYear.upsert({ where: { companyId_year: { companyId, year } }, update: {}, create: { companyId, year } });
      for (let m = 1; m <= 12; m++) {
        const startDate = new Date(year, m - 1, 1);
        const endDate = new Date(year, m, 0, 23, 59, 59);
        await this.prisma.fiscalPeriod.upsert({ where: { companyId_yearId_periodNumber: { companyId, yearId: fy.id, periodNumber: m } }, update: {}, create: { companyId, yearId: fy.id, periodNumber: m, name: new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'long' }), startDate, endDate } });
      }
    }
  }

  @UseGuards(PermissionsGuard) @RequirePermissions('finance.periods.manage')
  @Get('periods') async periods(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    await this.ensurePeriods(companyId);
    const years = await this.prisma.financialYear.findMany({ where: { companyId }, include: { periods: { orderBy: { periodNumber: 'asc' } } }, orderBy: { year: 'desc' } });
    return years;
  }

  @UseGuards(PermissionsGuard) @RequirePermissions('finance.periods.manage')
  @Post('periods/:id/close') async closePeriod(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    await this.prisma.fiscalPeriod.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user.sub } });
    await this.audit.log(companyId, req.user.sub, 'CLOSE_PERIOD', 'FiscalPeriod', id);
    return { ok: true };
  }

  @UseGuards(PermissionsGuard) @RequirePermissions('finance.periods.manage')
  @Post('periods/:id/reopen') async reopenPeriod(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    await this.prisma.fiscalPeriod.update({ where: { id }, data: { status: 'OPEN', closedAt: null, closedBy: null } });
    await this.audit.log(companyId, req.user.sub, 'REOPEN_PERIOD', 'FiscalPeriod', id);
    return { ok: true };
  }

  // ----- Bank & Cash -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('bank-accounts') bankAccounts(@Req() req: any) { return this.prisma.bankAccount.findMany({ where: { companyId: companyIdOf(req.user) }, include: { ledgerAccount: true }, orderBy: { name: 'asc' } }); }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('bank-accounts') async createBankAccount(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.bankAccount.create({ data: { companyId, ledgerAccountId: body.ledgerAccountId, name: body.name, bankName: body.bankName, accountNumberMasked: body.accountNumberMasked, currency: body.currency || 'USD', openingBalance: Number(body.openingBalance || 0), type: body.type || 'BANK' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('bank-transfers') bankTransfers(@Req() req: any) { return this.prisma.journalEntry.findMany({ where: { companyId: companyIdOf(req.user), sourceType: 'BANK_TRANSFER' }, orderBy: { date: 'desc' } }); }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('bank-transfers') async bankTransfer(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    if (!body.fromAccountId || !body.toAccountId) throw new BadRequestException('Select source and destination');
    if (body.fromAccountId === body.toAccountId) throw new BadRequestException('Source and destination must differ');
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const [from, to] = await Promise.all([
      this.prisma.bankAccount.findFirst({ where: { id: body.fromAccountId, companyId }, include: { ledgerAccount: true } }),
      this.prisma.bankAccount.findFirst({ where: { id: body.toAccountId, companyId }, include: { ledgerAccount: true } }),
    ]);
    if (!from?.ledgerAccount || !to?.ledgerAccount) throw new BadRequestException('Bank account(s) not found');
    const journal = await this.posting.postJournal(companyId, {
      date: body.date ? new Date(body.date) : new Date(),
      description: `Bank transfer ${from.name} → ${to.name}${body.reference ? ` (${body.reference})` : ''}`,
      reference: body.reference, sourceType: 'BANK_TRANSFER',
      lines: [
        { code: to.ledgerAccount.code, debit: amount, credit: 0, description: 'Transfer in' },
        { code: from.ledgerAccount.code, debit: 0, credit: amount, description: 'Transfer out' },
      ],
    });
    await this.audit.log(companyId, req.user.sub, 'TRANSFER', 'BankAccount', body.fromAccountId, { to: body.toAccountId, amount });
    return journal;
  }

  // ----- Vendor Credits -----
  private computeVc(lines: any[]) {
    let subtotal = 0, taxTotal = 0;
    const mapped = lines.map((l) => {
      const net = Number(l.quantity) * Number(l.unitPrice);
      const tax = net * (Number(l.taxRate) / 100);
      subtotal += net; taxTotal += tax;
      return { ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate), taxAmount: Number(tax.toFixed(2)), lineTotal: Number((net + tax).toFixed(2)) };
    });
    return { mapped, subtotal: Number(subtotal.toFixed(2)), taxTotal: Number(taxTotal.toFixed(2)), total: Number((subtotal + taxTotal).toFixed(2)) };
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.vendorcredits.manage')
  @Get('vendor-credits') vendorCredits(@Req() req: any) {
    return this.prisma.vendorCredit.findMany({ where: { companyId: companyIdOf(req.user) }, include: { supplier: true, lines: true, applications: true }, orderBy: { createdAt: 'desc' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.vendorcredits.manage')
  @Post('vendor-credits') async createVendorCredit(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    const { mapped, subtotal, taxTotal, total } = this.computeVc(body.lines || []);
    const no = await this.numbering.next(companyId, 'VC');
    return this.prisma.vendorCredit.create({ data: { companyId, supplierId: body.supplierId, vendorCreditNo: no, reason: body.reason, subtotal, taxTotal, total, lines: { create: mapped } }, include: { lines: true } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.vendorcredits.manage')
  @Post('vendor-credits/:id/post') async postVendorCredit(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const vc = await this.prisma.vendorCredit.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!vc) throw new BadRequestException('Vendor credit not found');
    if (vc.status !== 'DRAFT') return vc;
    const hasStock = vc.lines.some((l: any) => l.itemId);
    await this.posting.postJournal(companyId, {
      date: vc.creditDate, description: `Vendor credit ${vc.vendorCreditNo}`, reference: vc.vendorCreditNo, sourceType: 'VENDOR_CREDIT', sourceId: vc.id,
      lines: [
        ...(Number(vc.taxTotal) > 0 ? [{ code: '2100', debit: Number(vc.taxTotal), credit: 0, description: 'Input VAT reversal' }] : []),
        { code: hasStock ? '1200' : '6000', debit: 0, credit: Number(vc.subtotal), description: hasStock ? 'Inventory reduction' : 'Purchase reduction' },
        { code: '2000', debit: Number(vc.total), credit: 0, description: 'Accounts payable reduction' },
      ],
    });
    await this.prisma.vendorCredit.update({ where: { id }, data: { status: 'POSTED' } });
    await this.audit.log(companyId, req.user.sub, 'POST', 'VendorCredit', vc.id, { vcNo: vc.vendorCreditNo });
    return this.prisma.vendorCredit.findUnique({ where: { id }, include: { lines: true, applications: true } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.vendorcredits.manage')
  @Post('vendor-credits/:id/apply') async applyVendorCredit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    const vc = await this.prisma.vendorCredit.findFirst({ where: { id, companyId }, include: { applications: true } });
    if (!vc) throw new BadRequestException('Vendor credit not found');
    if (vc.status === 'DRAFT') throw new BadRequestException('Post the vendor credit before applying');
    const applied = vc.applications.reduce((s, a) => s + Number(a.amount), 0);
    const remaining = Number(vc.total) - applied;
    const amount = Number(body.amount || 0);
    if (amount <= 0 || amount > remaining + 0.001) throw new BadRequestException(`Cannot apply more than remaining balance ${remaining}`);
    const bill = await this.prisma.supplierInvoice.findFirst({ where: { id: body.supplierInvoiceId, companyId } });
    if (!bill) throw new BadRequestException('Supplier invoice not found');
    await this.prisma.vendorCreditApplication.create({ data: { vendorCreditId: id, supplierInvoiceId: body.supplierInvoiceId, amount } });
    const newApplied = applied + amount;
    const status = newApplied >= Number(vc.total) - 0.001 ? 'APPLIED' : 'PART_APPLIED';
    await this.prisma.vendorCredit.update({ where: { id }, data: { status } });
    await this.audit.log(companyId, req.user.sub, 'APPLY', 'VendorCredit', vc.id, { billId: body.supplierInvoiceId, amount });
    return this.prisma.vendorCredit.findUnique({ where: { id }, include: { applications: true } });
  }

  // ----- Checks -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('checks') checks(@Req() req: any) {
    return this.prisma.check.findMany({ where: { companyId: companyIdOf(req.user) }, include: { bankAccount: true, allocations: true }, orderBy: { createdAt: 'desc' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('checks') async createCheck(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    const bank = await this.prisma.bankAccount.findFirst({ where: { id: body.bankAccountId, companyId }, include: { ledgerAccount: true } });
    if (!bank?.ledgerAccount) throw new BadRequestException('Bank account not found');
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const allocations: any[] = body.allocations || [];
    const allocTotal = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
    if (allocations.length && Math.abs(allocTotal - amount) > 0.01) throw new BadRequestException('Allocations must total the check amount');
    const number = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.checkSequence.upsert({ where: { companyId_bankAccountId: { companyId, bankAccountId: bank.id } }, update: {}, create: { companyId, bankAccountId: bank.id, lastNumber: 0 } });
      const next = seq.lastNumber + 1;
      await tx.checkSequence.update({ where: { id: seq.id }, data: { lastNumber: next } });
      return String(next).padStart(6, '0');
    });
    const check = await this.prisma.check.create({
      data: { companyId, bankAccountId: bank.id, checkNo: number, date: body.date ? new Date(body.date) : new Date(), payTo: body.payTo || 'Manual payee', amount, amountInWords: body.amountInWords, memo: body.memo, payeeOverride: body.payeeOverride, status: 'RECORDED', allocations: { create: allocations.map((a) => ({ accountId: a.accountId, supplierInvoiceId: a.supplierInvoiceId, description: a.description, amount: Number(a.amount || 0) })) } },
      include: { allocations: true },
    });
    const lines: any[] = [];
    for (const a of allocations) {
      if (a.supplierInvoiceId) lines.push({ code: '2000', debit: Number(a.amount), credit: 0, description: 'Accounts payable' });
      else lines.push({ code: (await this.prisma.ledgerAccount.findFirst({ where: { id: a.accountId } }))?.code || '6000', debit: Number(a.amount), credit: 0, description: a.description || 'Expense' });
    }
    if (!lines.length) lines.push({ code: '6000', debit: amount, credit: 0, description: 'Expense' });
    lines.push({ code: bank.ledgerAccount.code, debit: 0, credit: amount, description: 'Cash / bank' });
    await this.posting.postJournal(companyId, { date: check.date, description: `Check ${check.checkNo}`, reference: check.checkNo, sourceType: 'CHECK', sourceId: check.id, lines });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Check', check.id, { checkNo: check.checkNo });
    return this.prisma.check.findUnique({ where: { id: check.id }, include: { bankAccount: true, allocations: true } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('checks/:id/print') async printCheck(@Req() req: any, @Param('id') id: string) {
    await this.prisma.check.update({ where: { id }, data: { status: 'PRINTED' } });
    await this.audit.log(companyIdOf(req.user), req.user.sub, 'PRINT', 'Check', id);
    return { ok: true };
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('checks/:id/status') async checkStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    await this.prisma.check.update({ where: { id }, data: { status: body.status } });
    await this.audit.log(companyIdOf(req.user), req.user.sub, body.status.toUpperCase(), 'Check', id);
    return { ok: true };
  }

  // ----- Credit Cards -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('credit-cards') creditCards(@Req() req: any) {
    return this.prisma.creditCardAccount.findMany({ where: { companyId: companyIdOf(req.user) }, include: { ledgerAccount: true, transactions: { orderBy: { date: 'desc' } }, payments: { orderBy: { date: 'desc' } } }, orderBy: { name: 'asc' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('credit-cards') async createCard(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.creditCardAccount.create({ data: { companyId, name: body.name, last4: body.last4, ledgerAccountId: body.ledgerAccountId, currency: body.currency || 'USD', creditLimit: Number(body.creditLimit || 0) } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('credit-cards/:id/transactions') async cardCharge(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    const card = await this.prisma.creditCardAccount.findFirst({ where: { id, companyId }, include: { ledgerAccount: true } });
    if (!card?.ledgerAccount) throw new BadRequestException('Card not found');
    const exp = await this.prisma.ledgerAccount.findFirst({ where: { id: body.expenseAccountId, companyId } });
    if (!exp) throw new BadRequestException('Expense account not found');
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const tx = await this.prisma.creditCardTransaction.create({ data: { companyId, cardAccountId: id, date: body.date ? new Date(body.date) : new Date(), vendor: body.vendor, description: body.description, expenseAccountId: exp.id, amount, reference: body.reference, memo: body.memo } });
    await this.posting.postJournal(companyId, { date: tx.date, description: `Credit card charge ${card.name}${body.vendor ? ` - ${body.vendor}` : ''}`, reference: tx.reference ?? undefined, sourceType: 'CREDIT_CARD_CHARGE', sourceId: tx.id, lines: [
      { code: exp.code, debit: amount, credit: 0, description: body.description || 'Expense' },
      { code: card.ledgerAccount.code, debit: 0, credit: amount, description: 'Credit card payable' },
    ] });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'CreditCardTransaction', tx.id, { amount });
    return tx;
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('credit-cards/:id/payments') async cardPayment(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    const card = await this.prisma.creditCardAccount.findFirst({ where: { id, companyId }, include: { ledgerAccount: true } });
    if (!card?.ledgerAccount) throw new BadRequestException('Card not found');
    const bank = body.bankAccountId ? await this.prisma.bankAccount.findFirst({ where: { id: body.bankAccountId, companyId }, include: { ledgerAccount: true } }) : null;
    if (!bank?.ledgerAccount) throw new BadRequestException('Select a bank account');
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const pmt = await this.prisma.creditCardPayment.create({ data: { companyId, cardAccountId: id, date: body.date ? new Date(body.date) : new Date(), amount, bankAccountId: bank.id, reference: body.reference } });
    await this.posting.postJournal(companyId, { date: pmt.date, description: `Credit card payment ${card.name}`, reference: pmt.reference ?? undefined, sourceType: 'CREDIT_CARD_PAYMENT', sourceId: pmt.id, lines: [
      { code: card.ledgerAccount.code, debit: amount, credit: 0, description: 'Credit card payable' },
      { code: bank.ledgerAccount.code, debit: 0, credit: amount, description: 'Cash / bank' },
    ] });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'CreditCardPayment', pmt.id, { amount });
    return pmt;
  }

  // ----- Budget control -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.budget.manage')
  @Get('budget-control') budgetRules(@Req() req: any) {
    return this.prisma.budgetControlRule.findMany({ where: { companyId: companyIdOf(req.user) }, include: { account: true }, orderBy: { id: 'asc' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.budget.manage')
  @Post('budget-control') async createBudgetRule(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.budgetControlRule.create({ data: { companyId, accountId: body.accountId, departmentId: body.departmentId, projectId: body.projectId, mode: body.mode || 'INFORMATION_ONLY', active: body.active ?? true } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.budget.manage')
  @Get('budget-control/evaluate') async evaluate(@Req() req: any, @Query() q: any) {
    const companyId = companyIdOf(req.user);
    const accountId = q.accountId;
    const amount = Number(q.amount || 0);
    const year = new Date().getFullYear();
    const budgets = await this.prisma.budget.findMany({ where: { companyId, accountId, fiscalYear: year } });
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, accountId } });
    const actual = Number(lines.reduce((s, l) => s + (Number(l.debit) - Number(l.credit)), 0).toFixed(2));
    const budget = Number(budgets.reduce((s, b) => s + Number(b.amount), 0).toFixed(2));
    const remaining = budget - actual - amount;
    const rule = await this.prisma.budgetControlRule.findFirst({ where: { companyId, accountId, active: true } });
    return { budget, actual, committed: amount, remaining: Number(remaining.toFixed(2)), mode: rule?.mode || 'INFORMATION_ONLY', exceeded: remaining < 0 };
  }

  // ----- Currencies & exchange rates -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('currencies') currencies(@Req() req: any) { return this.prisma.currency.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: { code: 'asc' } }); }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('currencies') async createCurrency(@Req() req: any, @Body() body: any) {
    return this.prisma.currency.create({ data: { companyId: companyIdOf(req.user), code: body.code, name: body.name, symbol: body.symbol, active: body.active ?? true } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('exchange-rates') rates(@Req() req: any) { return this.prisma.exchangeRate.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: { effectiveDate: 'desc' } }); }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Post('exchange-rates') async createRate(@Req() req: any, @Body() body: any) {
    return this.prisma.exchangeRate.create({ data: { companyId: companyIdOf(req.user), fromCurrency: body.fromCurrency, toCurrency: body.toCurrency || 'USD', rate: Number(body.rate), effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(), source: body.source || 'MANUAL' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.bank.manage')
  @Get('resolve-rate/:currency') async resolveRate(@Req() req: any, @Param('currency') currency: string) {
    const companyId = companyIdOf(req.user);
    const r = await this.prisma.exchangeRate.findFirst({ where: { companyId, fromCurrency: currency, toCurrency: 'USD' }, orderBy: { effectiveDate: 'desc' } });
    return { rate: Number(r?.rate || 1) };
  }

  // ----- VAT report -----
  @UseGuards(PermissionsGuard) @RequirePermissions('finance.tax.manage')
  @Get('tax/vat-report') async vatReport(@Req() req: any, @Query() q: any) {
    const companyId = companyIdOf(req.user);
    const { from, to } = q;
    const fromD = from ? new Date(from) : undefined;
    const toD = to ? new Date(to) : undefined;
    const lines = await this.prisma.journalLine.findMany({ where: { journal: { companyId, status: 'POSTED' }, account: { code: '2100' } }, include: { journal: true } });
    let outputVAT = 0, inputVAT = 0;
    for (const l of lines) {
      const d = l.journal.date;
      if (fromD && d < fromD) continue;
      if (toD && d > toD) continue;
      if (Number(l.credit) > 0) outputVAT += Number(l.credit);
      else inputVAT += Number(l.debit);
    }
    const salesWhere: any = { companyId, status: { in: ['POSTED', 'PART_PAID', 'PAID'] } };
    if (fromD || toD) salesWhere.invoiceDate = {}; if (fromD) salesWhere.invoiceDate.gte = fromD; if (toD) salesWhere.invoiceDate.lte = toD;
    const purchasesWhere: any = { companyId }; if (fromD || toD) purchasesWhere.invoiceDate = {}; if (fromD) purchasesWhere.invoiceDate.gte = fromD; if (toD) purchasesWhere.invoiceDate.lte = toD;
    const sales = await this.prisma.salesInvoice.findMany({ where: salesWhere });
    const purchases = await this.prisma.supplierInvoice.findMany({ where: purchasesWhere });
    const taxableSales = sales.reduce((s, i) => s + Number(i.total), 0);
    const taxablePurchases = purchases.reduce((s, i) => s + Number(i.total), 0);
    return { outputVAT: Number(outputVAT.toFixed(2)), inputVAT: Number(inputVAT.toFixed(2)), netVAT: Number((outputVAT - inputVAT).toFixed(2)), taxableSales: Number(taxableSales.toFixed(2)), taxablePurchases: Number(taxablePurchases.toFixed(2)) };
  }
}