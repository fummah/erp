import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
@Module({imports:[PassportModule,JwtModule.registerAsync({imports:[ConfigModule],inject:[ConfigService],useFactory:(c:ConfigService)=>({secret:c.get<string>('JWT_SECRET')||'local-dev-secret',signOptions:{expiresIn:(c.get<string>('JWT_EXPIRES_IN')||'8h') as any}})})],controllers:[AuthController],providers:[AuthService,JwtStrategy],exports:[AuthService,JwtModule]}) export class AuthModule {}
