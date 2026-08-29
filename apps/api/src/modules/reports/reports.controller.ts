import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ReportService, DATASETS } from './report.service';
import { companyIdOf } from '../../core/context';

@ApiTags('Reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService, private reports: ReportService) {}

  @Get('datasets') datasets() { return DATASETS; }
  @Post('run') run(@Req() req: any, @Body() body: any) { return this.reports.run(companyIdOf(req.user), body); }
  @Get() saved(@Req() req: any) { return this.prisma.reportDefinition.findMany({ where: { companyId: companyIdOf(req.user) } }); }
  @Post() async save(@Req() req: any, @Body() body: any) { return this.prisma.reportDefinition.create({ data: { companyId: companyIdOf(req.user), name: body.name, dataset: body.dataset, columns: body.columns || [], filters: body.filters || {}, groupBy: body.groupBy } }); }
  @Delete(':id') async remove(@Req() req: any, @Param('id') id: string) { return this.prisma.reportDefinition.deleteMany({ where: { id, companyId: companyIdOf(req.user) } }); }
}
