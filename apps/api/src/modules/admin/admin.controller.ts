import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { companyIdOf, tenantIdOf } from '../../core/context';
import { BranchDto, ConfigDto, CreateUserDto, MembershipDto, UpdateMembershipDto } from './admin.dto';
import { NumberingService } from '../../core/common/numbering.service';
import { AuditService } from '../../core/common/audit.service';
import * as bcrypt from 'bcryptjs';

@ApiTags('Administration') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService, private numbering: NumberingService, private audit: AuditService) {}

  // ----- Users -----
  @Get('users') async users(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const memberships = await this.prisma.membership.findMany({ where: { companyId }, include: { user: true } });
    return memberships.map((m) => ({ membershipId: m.id, userId: m.user.id, email: m.user.email, firstName: m.user.firstName, lastName: m.user.lastName, status: m.user.status, role: m.role, isPlatformAdmin: m.user.isPlatformAdmin }));
  }
  @Post('users') async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const companyId = companyIdOf(req.user);
    const tenantId = tenantIdOf(req.user);
    const passwordHash = await bcrypt.hash(dto.password || 'Password123!', 12);
    const user = await this.prisma.user.upsert({
      where: { email: dto.email.toLowerCase() },
      update: { firstName: dto.firstName, lastName: dto.lastName },
      create: { email: dto.email.toLowerCase(), firstName: dto.firstName, lastName: dto.lastName, passwordHash },
    });
    const membership = await this.prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { role: dto.role || 'STAFF' },
      create: { userId: user.id, tenantId, companyId, role: dto.role || 'STAFF' },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'User', user.id, { email: user.email });
    return { ...user, membershipId: membership.id };
  }
  @Patch('users/:id/status') async updateUserStatus(@Req() req: any, @Param('id') id: string, @Body() dto: { status: string }) {
    const companyId = companyIdOf(req.user);
    const membership = await this.prisma.membership.findFirst({ where: { userId: id, companyId } });
    if (!membership) throw new BadRequestException('User not in company');
    await this.prisma.user.update({ where: { id }, data: { status: dto.status as any } });
    await this.audit.log(companyId, req.user.sub, 'UPDATE', 'User', id, { status: dto.status });
    return { ok: true };
  }

  // ----- Memberships / roles -----
  @Get('memberships') memberships(@Req() req: any) {
    return this.prisma.membership.findMany({ where: { companyId: companyIdOf(req.user) }, include: { user: true } });
  }
  @Post('memberships') async addMember(@Req() req: any, @Body() dto: MembershipDto) {
    const companyId = companyIdOf(req.user);
    const tenantId = tenantIdOf(req.user);
    let user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      const passwordHash = await bcrypt.hash(dto.password || 'Password123!', 12);
      user = await this.prisma.user.create({ data: { email: dto.email.toLowerCase(), firstName: dto.email.split('@')[0], lastName: '', passwordHash } });
    }
    const membership = await this.prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { role: dto.role || 'STAFF' },
      create: { userId: user.id, tenantId, companyId, role: dto.role || 'STAFF' },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Membership', membership.id, { email: user.email, role: membership.role });
    return membership;
  }
  @Patch('memberships/:id') async updateMembership(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMembershipDto) {
    const companyId = companyIdOf(req.user);
    const membership = await this.prisma.membership.updateMany({ where: { id, companyId }, data: { role: dto.role } });
    await this.audit.log(companyId, req.user.sub, 'UPDATE', 'Membership', id, { role: dto.role });
    return membership;
  }
  @Delete('memberships/:id') async deleteMembership(@Req() req: any, @Param('id') id: string) {
    await this.prisma.membership.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  // ----- Branches -----
  @Get('branches') branches(@Req() req: any) {
    return this.prisma.branch.findMany({ where: { companyId: companyIdOf(req.user) }, include: { departments: true } });
  }
  @Post('branches') async createBranch(@Req() req: any, @Body() dto: BranchDto) {
    const companyId = companyIdOf(req.user);
    const code = dto.code || await this.numbering.next(companyId, 'BR');
    const branch = await this.prisma.branch.create({ data: { companyId, name: dto.name, code, address: dto.address, city: dto.city } });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'Branch', branch.id, { code });
    return branch;
  }
  @Patch('branches/:id') updateBranch(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<BranchDto>) {
    return this.prisma.branch.updateMany({ where: { id, companyId: companyIdOf(req.user) }, data: dto });
  }

  // ----- Audit logs -----
  @Get('audit-logs') auditLogs(@Req() req: any) {
    return this.prisma.auditLog.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: { createdAt: 'desc' }, take: 300 });
  }

  // ----- System config -----
  @Get('config') config(@Req() req: any) { return this.prisma.systemConfig.findMany({ where: { companyId: companyIdOf(req.user) } }); }
  @Post('config') async createConfig(@Req() req: any, @Body() dto: ConfigDto) {
    const companyId = companyIdOf(req.user);
    const config = await this.prisma.systemConfig.upsert({
      where: { companyId_key: { companyId, key: dto.key } },
      update: { value: dto.value, description: dto.description },
      create: { companyId, key: dto.key, value: dto.value, description: dto.description },
    });
    await this.audit.log(companyId, req.user.sub, 'CREATE', 'SystemConfig', config.id, { key: dto.key });
    return config;
  }
  @Delete('config/:id') async deleteConfig(@Req() req: any, @Param('id') id: string) {
    await this.prisma.systemConfig.deleteMany({ where: { id, companyId: companyIdOf(req.user) } });
    return { ok: true };
  }

  @Get('report') async report(@Req() req: any) {
    const companyId = companyIdOf(req.user);
    const [users, branches, auditCount] = await Promise.all([
      this.prisma.membership.count({ where: { companyId } }),
      this.prisma.branch.count({ where: { companyId } }),
      this.prisma.auditLog.count({ where: { companyId } }),
    ]);
    return { users, branches, auditCount };
  }
}