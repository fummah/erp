import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { JwtAuthGuard } from '../auth/auth.guard';
import { companyIdOf } from '../../core/context';
import { AttendanceDto, EmployeeDto, LeaveDto, PayrollRunDto, StatutoryDto } from './hr.dto';
import { NumberingService } from '../../core/common/numbering.service';
import { AuditService } from '../../core/common/audit.service';
import { PostingService } from '../finance/posting.service';
import { StatusDto } from '../sales/sales.dto';

const round2 = (n: number) => Number(n.toFixed(2));

@ApiTags('HR & Payroll') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('hr')
export class HrController {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private audit: AuditService, private posting: PostingService) {}

  // ----- Employees -----
  @Get('employees') employees(@Req() req: any) { return this.prisma.employee.findMany({ where: { companyId: companyIdOf(req.user) }, include: { department: true } }); }
  @Post('employees') async createEmployee(@Req() req: any, @Body() dto: EmployeeDto) {
    const companyId = companyIdOf(req.user);
    const employeeNo = dto.employeeNo || await this.numbering.next(companyId, 'EMP');
    const employee = await this.prisma.employee.create({
      data: { companyId, departmentId: dto.departmentId, employeeNo, firstName: dto.firstName, lastName: dto.lastName, email: dto.email, hireDate: new Date(dto.hireDate), basicSalary: Number(dto.basicSalary), currency: dto.currency || 'USD', active: dto.active ?? true, position: dto.position, managerId: dto.managerId, contractType: dto.contractType, status: dto.status ?? 'ACTIVE', bankDetails: dto.bankDetails as any, taxDetails: dto.taxDetails as any, emergencyContact: dto.emergencyContact as any, allowances: dto.allowances as any, deductions: dto.deductions as any },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Employee', employee.id, { employeeNo });
    return employee;
  }
  @Patch('employees/:id') updateEmployee(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<EmployeeDto>) {
    const data: any = { ...dto };
    if (dto.hireDate) data.hireDate = new Date(dto.hireDate);
    return this.prisma.employee.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data });
  }
  @Delete('employees/:id') async deleteEmployee(@Req() req: any, @Param('id') id: string) {
    await this.prisma.employee.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Departments -----
  @Get('departments') departments(@Req() req: any) {
    return this.prisma.department.findMany({ where: { branch: { companyId: companyIdOf(req.user) } }, include: { branch: true } });
  }
  @Post('departments') async createDepartment(@Req() req: any, @Body() dto: { branchId: string; name: string; code?: string }) {
    const companyId = companyIdOf(req.user);
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, companyId } });
    if (!branch) throw new BadRequestException('Branch not found');
    const code = dto.code || await this.numbering.next(companyId, 'DEPT');
    const dept = await this.prisma.department.create({ data: { branchId: dto.branchId, name: dto.name, code } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Department', dept.id, { code });
    return dept;
  }
  @Patch('departments/:id') updateDepartment(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<{ name: string }>) {
    return this.prisma.department.updateMany({ where: { id, branch: { companyId: companyIdOf(req.user) } }, data: dto });
  }

  // ----- Leave -----
  @Get('leave-requests') leaveRequests(@Req() req: any) {
    return this.prisma.leaveRequest.findMany({ where: { companyId: companyIdOf(req.user) }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
  }
  @Post('leave-requests') async createLeave(@Req() req: any, @Body() dto: LeaveDto) {
    const companyId = companyIdOf(req.user);
    const leave = await this.prisma.leaveRequest.create({ data: { companyId, employeeId: dto.employeeId, leaveType: dto.leaveType || 'ANNUAL', startDate: new Date(dto.startDate), endDate: new Date(dto.endDate), days: Number(dto.days), reason: dto.reason } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'LeaveRequest', leave.id);
    return leave;
  }
  @Patch('leave-requests/:id/status') updateLeaveStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) {
    const companyId = companyIdOf(req.user);
    return this.prisma.leaveRequest.updateMany({ where: { id, companyId }, data: { status: dto.status } });
  }
  @Delete('leave-requests/:id') async deleteLeave(@Req() req: any, @Param('id') id: string) {
    await this.prisma.leaveRequest.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Attendance -----
  @Get('attendance') attendance(@Req() req: any) {
    return this.prisma.attendance.findMany({ where: { companyId: companyIdOf(req.user) }, include: { employee: true }, orderBy: { date: 'desc' }, take: 300 });
  }
  @Post('attendance') async createAttendance(@Req() req: any, @Body() dto: AttendanceDto) {
    const companyId = companyIdOf(req.user);
    const record = await this.prisma.attendance.upsert({
      where: { companyId_employeeId_date: { companyId, employeeId: dto.employeeId, date: new Date(dto.date) } },
      update: { status: dto.status, checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined, checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined, note: dto.note },
      create: { companyId, employeeId: dto.employeeId, date: new Date(dto.date), status: dto.status || 'PRESENT', checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined, checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined, note: dto.note },
    });
    return record;
  }
  @Patch('attendance/:id') updateAttendance(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<AttendanceDto>) {
    return this.prisma.attendance.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }

  // ----- Payroll -----
  @Get('payroll-runs') payrollRuns(@Req() req: any) {
    return this.prisma.payrollRun.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: [{ year: 'desc' }, { period: 'desc' }], include: { _count: { select: { payslips: true } } } });
  }
  @Post('payroll-runs') async createPayrollRun(@Req() req: any, @Body() dto: PayrollRunDto) {
    const companyId = companyIdOf(req.user);
    const existing = await this.prisma.payrollRun.findUnique({ where: { companyId_period_year: { companyId, period: dto.period, year: dto.year } } });
    if (existing) throw new BadRequestException('Payroll run already exists for this period');
    const run = await this.prisma.payrollRun.create({ data: { companyId, period: dto.period, year: dto.year } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'PayrollRun', run.id, { period: dto.period, year: dto.year });
    return run;
  }
  @UseGuards(PermissionsGuard)
  @RequirePermissions('payroll.process')
  @Post('payroll-runs/:id/process') async processPayroll(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status === 'LOCKED') throw new BadRequestException('Payroll run is locked');
    const employees = await this.prisma.employee.findMany({ where: { companyId, active: true } });
    if (!employees.length) throw new BadRequestException('No active employees');
    let totalGross = 0, totalDeductions = 0, totalNet = 0, totalEmployerNssa = 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({ where: { payrollRunId: run.id } });
      for (const e of employees) {
        const allowances = (e.allowances as any) || {};
        const allowanceTotal = Object.values(allowances).reduce((s: number, v: any) => s + Number(v || 0), 0);
        const otherDeductionsRaw = (e.deductions as any) || {};
        const otherDeductions = Object.values(otherDeductionsRaw).reduce((s: number, v: any) => s + Number(v || 0), 0);
        const gross = Number(e.basicSalary) + allowanceTotal;
        const stat = await this.statutory(companyId, gross, new Date(run.year, run.period - 1, 28));
        const net = gross - stat.paye - stat.employeeNssa - otherDeductions;
        totalGross += gross; totalDeductions += stat.paye + stat.employeeNssa + otherDeductions; totalNet += net; totalEmployerNssa += stat.employerNssa;
        await tx.payslip.create({ data: { payrollRunId: run.id, employeeId: e.id, basicSalary: round2(Number(e.basicSalary)), grossPay: round2(gross), payeTax: stat.paye, nssaDeduction: stat.employeeNssa, otherDeductions: round2(otherDeductions), netPay: round2(net), employeeNssa: stat.employeeNssa, employerNssa: stat.employerNssa, allowances, deductions: otherDeductionsRaw } });
      }
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: 'PROCESSED', processedAt: new Date(), totalGross: round2(totalGross), totalDeductions: round2(totalDeductions), totalNet: round2(totalNet) } });
    });
    await this.posting.postJournal(companyId, {
      date: new Date(run.year, run.period - 1, 28), description: `Payroll ${run.period}/${run.year}`, reference: `PR-${run.year}-${run.period}`, sourceType: 'PAYROLL', sourceId: run.id,
      lines: [
        { code: '6000', debit: round2(totalGross + totalEmployerNssa), credit: 0, description: 'Payroll expense (incl. employer NSSA)' },
        { code: '1000', debit: 0, credit: round2(totalNet), description: 'Net pay' },
        ...(round2(totalDeductions + totalEmployerNssa) > 0 ? [{ code: '2000', debit: 0, credit: round2(totalDeductions + totalEmployerNssa), description: 'Statutory deductions payable' }] : []),
      ],
    });
    await this.audit.log(companyId, req.user.sub, 'PROCESS', 'PayrollRun', run.id, { period: run.period, year: run.year });
    return this.prisma.payrollRun.findUnique({ where: { id: run.id }, include: { payslips: { include: { employee: true } } } });
  }
  @Post('payroll-runs/:id/lock') lockPayroll(@Req() req: any, @Param('id') id: string) {
    return this.prisma.payrollRun.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: { status: 'LOCKED' } });
  }
  @Get('payroll-runs/:id/payslips') payslips(@Req() req: any, @Param('id') id: string) {
    return this.prisma.payslip.findMany({ where: { payrollRun: { id, companyId: companyIdOf(req.user) } }, include: { employee: true } });
  }

  // ----- Statutory rules -----
  @Get('statutory-rules') rules() { return this.prisma.statutoryRule.findMany({ where: { active: true }, orderBy: { validFrom: 'desc' } }); }
  @Post('statutory-rules') async createRule(@Body() dto: StatutoryDto) {
    const rule = await this.prisma.statutoryRule.create({ data: { country: dto.country, authority: dto.authority, code: dto.code, name: dto.name, validFrom: new Date(dto.validFrom), validTo: dto.validTo ? new Date(dto.validTo) : undefined, configuration: dto.configuration } });
    return rule;
  }
  @Patch('statutory-rules/:id') updateRule(@Param('id') id: string, @Body() dto: Partial<StatutoryDto>) {
    const data: any = { ...dto };
    if (dto.validFrom) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo) data.validTo = new Date(dto.validTo);
    return this.prisma.statutoryRule.update({ where: { id }, data });
  }

  @Get('hr-report') async hrReport(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const [total, departments, byDept, payrollCost] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, active: true } }),
      this.prisma.department.count({ where: { branch: { companyId } } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: { companyId, active: true }, _count: true }),
      this.prisma.employee.aggregate({ where: { companyId, active: true }, _sum: { basicSalary: true } }),
    ]);
    return { total, departments, byDept, monthlyPayrollCost: Number(payrollCost._sum.basicSalary || 0) };
  }

  private async statutory(companyId: string, gross: number, date: Date) {
    const rules = await this.prisma.statutoryRule.findMany({ where: { active: true, validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gte: date } }] } });
    const payeRule = rules.find((r) => r.code === 'PAYE');
    if (!payeRule) throw new BadRequestException('PAYE statutory rule is not configured. Configure it under HR → Payroll Rules before processing payroll.');
    let paye = 0;
    const brackets: any[] = (payeRule.configuration as any)?.brackets || [];
    for (const b of brackets) {
      const from = Number(b.from || 0);
      const to = b.to == null ? Infinity : Number(b.to);
      if (gross > from) paye += (Math.min(gross, to) - from) * Number(b.rate || 0);
    }
    const nssaRule = rules.find((r) => r.code === 'NSSA');
    const cfg: any = (nssaRule?.configuration as any) || {};
    const nssaBase = nssaRule ? Math.min(gross, Number(cfg.cap || 0)) : 0;
    return { paye: round2(paye), employeeNssa: round2(nssaBase * Number(cfg.employeePct || 0)), employerNssa: round2(nssaBase * Number(cfg.employerPct || 0)) };
  }

  // ----- Statutory & payroll rules -----
  @UseGuards(PermissionsGuard) @RequirePermissions('payroll.view')
  @Get('statutory-rules') statutoryRules() {
    return this.prisma.statutoryRule.findMany({ orderBy: { validFrom: 'desc' } });
  }
  @UseGuards(PermissionsGuard) @RequirePermissions('payroll.process')
  @Post('statutory-rules') async createStatutory(@Req() req: any, @Body() body: any) {
    return this.prisma.statutoryRule.create({ data: { country: body.country || 'ZW', authority: body.authority || 'ZIMRA', code: body.code, name: body.name, validFrom: body.validFrom ? new Date(body.validFrom) : new Date(), validTo: body.validTo ? new Date(body.validTo) : undefined, configuration: body.configuration || {} } });
  }

  // ----- Recruitment -----
  @Get('vacancies') vacancies(@Req() req: any) { return this.prisma.jobVacancy.findMany({ where: { companyId: companyIdOf(req.user) }, include: { applications: { include: { candidate: true } } }, orderBy: { postedAt: 'desc' } }); }
  @Post('vacancies') createVacancy(@Req() req: any, @Body() body: any) { return this.prisma.jobVacancy.create({ data: { companyId: companyIdOf(req.user), title: body.title, departmentId: body.departmentId, location: body.location, description: body.description, status: body.status || 'OPEN' } }); }
  @Get('candidates') candidates(@Req() req: any) { return this.prisma.candidate.findMany({ where: { companyId: companyIdOf(req.user) }, include: { applications: { include: { vacancy: true } } }, orderBy: { createdAt: 'desc' } }); }
  @Post('candidates') createCandidate(@Req() req: any, @Body() body: any) { return this.prisma.candidate.create({ data: { companyId: companyIdOf(req.user), name: body.name, email: body.email, phone: body.phone, status: body.status || 'LEAD' } }); }
  @Patch('candidates/:id') updateCandidate(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.prisma.candidate.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: body }); }
  @Get('applications') applications(@Req() req: any) { return this.prisma.jobApplication.findMany({ where: { companyId: companyIdOf(req.user) }, include: { vacancy: true, candidate: true, interviews: true, offer: true }, orderBy: { appliedAt: 'desc' } }); }
  @Post('applications') createApplication(@Req() req: any, @Body() body: any) { return this.prisma.jobApplication.create({ data: { companyId: companyIdOf(req.user), vacancyId: body.vacancyId, candidateId: body.candidateId, notes: body.notes } }); }
  @Patch('applications/:id') updateApplication(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.prisma.jobApplication.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: body }); }
  @Post('applications/:id/interviews') addInterview(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.prisma.interview.create({ data: { companyId: companyIdOf(req.user), applicationId: id, scheduledAt: new Date(body.scheduledAt), interviewer: body.interviewer, result: body.result, notes: body.notes } }); }
  @Post('applications/:id/offer') addOffer(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.prisma.offer.create({ data: { companyId: companyIdOf(req.user), applicationId: id, salary: Number(body.salary || 0) } }); }
  @Post('applications/:id/hire') async hireCandidate(@Req() req: any, @Param('id') id: string) {
    const companyId = companyIdOf(req.user);
    const app = await this.prisma.jobApplication.findFirst({ where: { id, companyId }, include: { candidate: true, offer: true, vacancy: true } });
    if (!app?.candidate) throw new Error('Application not found');
    const [f, l] = (app.candidate.name || 'New Hire').split(' ');
    const employeeNo = await this.numbering.next(companyId, 'EMP');
    const emp = await this.prisma.employee.create({ data: { companyId, employeeNo, firstName: f || app.candidate.name, lastName: l || '', email: app.candidate.email, hireDate: new Date(), basicSalary: Number(app.offer?.salary || 0), position: app.vacancy?.title, status: 'ACTIVE' } });
    if (app.offer) await this.prisma.offer.update({ where: { id: app.offer.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    await this.prisma.jobApplication.update({ where: { id }, data: { status: 'HIRED' } });
    await this.audit.log(companyId, req.user.sub, 'HIRE', 'Candidate', app.candidate.id, { employeeNo });
    return emp;
  }

  // ----- Onboarding -----
  @Get('onboarding-templates') onboardingTemplates(@Req() req: any) { return this.prisma.onboardingTemplate.findMany({ where: { companyId: companyIdOf(req.user) }, include: { tasks: true } }); }
  @Post('onboarding-templates') createOnboardingTemplate(@Req() req: any, @Body() body: any) {
    return this.prisma.onboardingTemplate.create({ data: { companyId: companyIdOf(req.user), name: body.name, tasks: { create: (body.tasks || []).map((t: any) => ({ title: t.title, dueInDays: Number(t.dueInDays || 0) })) } }, include: { tasks: true } });
  }
  @Get('employee-onboardings') employeeOnboardings(@Req() req: any) { return this.prisma.employeeOnboarding.findMany({ where: { companyId: companyIdOf(req.user) }, include: { employee: true, template: { include: { tasks: true } } }, orderBy: { startedAt: 'desc' } }); }
  @Post('employees/:id/onboarding') startOnboarding(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.employeeOnboarding.upsert({ where: { employeeId: id }, update: { templateId: body.templateId, status: 'IN_PROGRESS' }, create: { companyId, employeeId: id, templateId: body.templateId } });
  }
  @Patch('employee-onboardings/:id') updateOnboarding(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.prisma.employeeOnboarding.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: { status: body.status, taskStatus: body.taskStatus, completedAt: body.status === 'COMPLETED' ? new Date() : undefined } });
  }

  // ----- Leave -----
  @Get('leave-types') leaveTypes(@Req() req: any) { return this.prisma.leaveType.findMany({ where: { companyId: companyIdOf(req.user) }, include: { policy: true } }); }
  @Post('leave-types') createLeaveType(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.leaveType.create({ data: { companyId, code: body.code, name: body.name, daysPerYear: Number(body.daysPerYear || 20), active: body.active ?? true, policy: body.policy ? { create: { companyId, maxCarryOver: Number(body.policy.maxCarryOver || 0), accrualPerMonth: Number(body.policy.accrualPerMonth || 0) } } : undefined } });
  }
  @Get('leave-policies') leavePolicies(@Req() req: any) { return this.prisma.leavePolicy.findMany({ where: { companyId: companyIdOf(req.user) }, include: { leaveType: true } }); }
  @Get('leave-balances') leaveBalances(@Req() req: any) { return this.prisma.leaveBalance.findMany({ where: { companyId: companyIdOf(req.user) }, include: { employee: true, leaveType: true } }); }
  @Post('leave-balances/accrue') accrueLeave(@Req() req: any, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.leaveBalance.upsert({ where: { companyId_employeeId_leaveTypeId: { companyId, employeeId: body.employeeId, leaveTypeId: body.leaveTypeId } }, update: { balance: { increment: Number(body.days || 0) } }, create: { companyId, employeeId: body.employeeId, leaveTypeId: body.leaveTypeId, balance: Number(body.days || 0) } });
  }
  @Post('leave-requests/:id/status') approveLeave(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = companyIdOf(req.user);
    return this.prisma.leaveRequest.updateMany({ where: { id, companyId }, data: { status: body.status, approvedBy: req.user.sub, approvedAt: new Date() } });
  }

  // ----- Benefits -----
  @Get('benefit-plans') benefitPlans(@Req() req: any) { return this.prisma.benefitPlan.findMany({ where: { companyId: companyIdOf(req.user) } }); }
  @Post('benefit-plans') createBenefitPlan(@Req() req: any, @Body() body: any) { return this.prisma.benefitPlan.create({ data: { companyId: companyIdOf(req.user), name: body.name, type: body.type || 'MEDICAL', taxable: body.taxable ?? false, employerContribution: Number(body.employerContribution || 0) } }); }
  @Get('employee-benefits') employeeBenefits(@Req() req: any) { return this.prisma.employeeBenefit.findMany({ where: { companyId: companyIdOf(req.user) }, include: { employee: true, plan: true } }); }
  @Post('employee-benefits') createEmployeeBenefit(@Req() req: any, @Body() body: any) { return this.prisma.employeeBenefit.create({ data: { companyId: companyIdOf(req.user), employeeId: body.employeeId, planId: body.planId, amount: Number(body.amount || 0) } }); }
}