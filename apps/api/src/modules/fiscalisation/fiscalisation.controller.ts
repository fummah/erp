import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { companyIdOf } from '../../core/context';
import { FiscalisationService } from './fiscalisation.service';

@ApiTags('Fiscalisation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fiscalisation')
export class FiscalisationController {
  constructor(private fiscal: FiscalisationService) {}

  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.view') @Get('config') config() { return { mode: (process.env.ZIMRA_MODE || 'mock').toLowerCase() }; }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.view') @Get('devices') devices(@Req() req: any) { return this.fiscal.listDevices(companyIdOf(req.user)); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/register') register(@Req() req: any, @Param('id') id: string) { return this.fiscal.register(companyIdOf(req.user), id); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/open-day') open(@Req() req: any, @Param('id') id: string) { return this.fiscal.openDay(companyIdOf(req.user), id); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/close-day') close(@Req() req: any, @Param('id') id: string) { return this.fiscal.closeDay(companyIdOf(req.user), id); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/fiscalise') fiscalise(@Req() req: any, @Param('id') id: string, @Body() body: { invoiceId: string }) { return this.fiscal.fiscalise(companyIdOf(req.user), id, body.invoiceId); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/fiscalise-credit-note') creditNote(@Req() req: any, @Param('id') id: string, @Body() body: { creditNoteId: string }) { return this.fiscal.fiscaliseCreditNote(companyIdOf(req.user), id, body.creditNoteId); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('devices/:id/fiscalise-debit-note') debitNote(@Req() req: any, @Param('id') id: string, @Body() body: { debitNoteId: string }) { return this.fiscal.fiscaliseDebitNote(companyIdOf(req.user), id, body.debitNoteId); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.operate') @Post('retry') retry(@Req() req: any) { return this.fiscal.retryFiscalReceipts(companyIdOf(req.user)); }
  @UseGuards(PermissionsGuard) @RequirePermissions('fiscalisation.view') @Get('receipts') receipts(@Req() req: any) { return this.fiscal.receipts(companyIdOf(req.user)); }
}
