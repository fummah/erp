import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CompanyModule } from './modules/company/company.module';
import { SalesModule } from './modules/sales/sales.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { HrModule } from './modules/hr/hr.module';
import { CrmModule } from './modules/crm/crm.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { FiscalisationModule } from './modules/fiscalisation/fiscalisation.module';
import { PlatformModule } from './modules/platform/platform.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { HealthController } from './health.controller';

@Module({imports:[ConfigModule.forRoot({isGlobal:true}),PrismaModule,AuthModule,DashboardModule,CompanyModule,SalesModule,FinanceModule,InventoryModule,ProcurementModule,HrModule,CrmModule,AssetsModule,ComplianceModule,FiscalisationModule,IntegrationsModule,PlatformModule],controllers:[HealthController]})
export class AppModule {}
