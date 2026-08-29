import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSecurityService } from './auth-security.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';
@Module({imports:[PassportModule,JwtModule.registerAsync({imports:[ConfigModule],inject:[ConfigService],useFactory:(c:ConfigService)=>({secret:c.get<string>('JWT_SECRET')||'local-dev-secret',signOptions:{expiresIn:(c.get<string>('JWT_EXPIRES_IN')||'8h') as any}})})],controllers:[AuthController],providers:[AuthService,AuthSecurityService,JwtStrategy,PermissionService,PermissionsGuard],exports:[AuthService,JwtModule,PermissionService,PermissionsGuard]}) export class AuthModule {}
