import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportService } from './report.service';
@Module({ controllers: [ReportsController], providers: [ReportService], exports: [ReportService] })
export class ReportsModule {}
