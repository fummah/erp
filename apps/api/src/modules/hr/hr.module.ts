import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AuthModule } from '../auth/auth.module';
import { HrController } from './hr.controller';
@Module({ imports: [FinanceModule, AuthModule], controllers: [HrController] })
export class HrModule {}
