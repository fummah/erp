import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { FinanceModule } from '../finance/finance.module';
import { DocumentTrailModule } from '../document-trail/document-trail.module';
import { CustomerPaymentsService } from './customer-payments.service';
import { PricingService } from './pricing.service';

@Module({ imports: [FinanceModule, DocumentTrailModule], controllers: [SalesController], providers: [CustomerPaymentsService, PricingService], exports: [CustomerPaymentsService, PricingService] })
export class SalesModule {}
