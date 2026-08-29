import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma/prisma.service';
import { companyIdOf, tenantIdOf } from '../../core/context';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AdaptersService } from './adapters.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private prisma: PrismaService, private adapters: AdaptersService) {}

  @Get() list(@Req() req: any) { return this.prisma.integrationConnection.findMany({ where: { companyId: companyIdOf(req.user) }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }); }

  // Provider modes (which backend each adapter is wired to)
  @Get('providers') providers() { return this.adapters.providers(); }

  // Payments
  @Post('payments') charge(@Req() req: any, @Body() body: any) { return this.adapters.charge({ ...body, companyId: companyIdOf(req.user) }); }
  @Get('payments/:reference') paymentStatus(@Param('reference') reference: string) { return this.adapters.paymentStatus(reference); }

  // Object storage
  @Post('storage/upload') upload(@Body() body: { key: string; dataUrl: string; mime?: string }) { return this.adapters.upload(body.key, body.dataUrl, body.mime); }
  @Get('storage/:key') async download(@Req() req: any, @Param('key') key: string, @Res() res: any) { const buf = await this.adapters.download(key); res.set({ 'Content-Type': 'application/octet-stream' }); res.send(buf); }

  // Messaging (email / SMS)
  @Post('messages/send') sendMessage(@Body() body: any) { return this.adapters.sendMessage(body); }

  // Queue (background workers)
  @Post('queue') enqueue(@Body() body: { type: string; payload: any }) { return this.adapters.enqueue(body.type, body.payload); }

  // Usage metering + billing
  @Post('usage') usage(@Req() req: any, @Body() body: { metric: string; value: number; period?: string }) { return this.adapters.recordUsage(tenantIdOf(req.user), body.metric, Number(body.value || 0), body.period || new Date().toISOString().slice(0, 7)); }
  @Get('usage') usageList(@Req() req: any) { return this.adapters.usage(tenantIdOf(req.user)); }
  @Get('billing') billing(@Req() req: any) { return this.adapters.billing(tenantIdOf(req.user)); }
}
