import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './finance.controller';
import { PostingService } from './posting.service';
import { InvoiceStatusService } from './invoice-status.service';
@Module({ imports: [AuthModule], controllers: [FinanceController], providers: [PostingService, InvoiceStatusService], exports: [PostingService, InvoiceStatusService] })
export class FinanceModule {}
