import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { FinanceModule } from '../finance/finance.module';
import { DocumentTrailModule } from '../document-trail/document-trail.module';
import { CustomerPaymentsService } from './customer-payments.service';

@Module({ imports: [FinanceModule, DocumentTrailModule], controllers: [SalesController], providers: [CustomerPaymentsService], exports: [CustomerPaymentsService] })
export class SalesModule {}
