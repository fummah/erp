import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { AdaptersService } from './adapters.service';

@Module({ imports: [AuthModule], controllers: [IntegrationsController], providers: [AdaptersService], exports: [AdaptersService] })
export class IntegrationsModule {}
