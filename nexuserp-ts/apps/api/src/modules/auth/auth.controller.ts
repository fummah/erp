import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service'; import { LoginDto, SwitchCompanyDto } from './auth.dto'; import { JwtAuthGuard } from './auth.guard';
@ApiTags('Auth') @Controller('auth') export class AuthController { constructor(private auth:AuthService){}
@Post('login') login(@Body() dto:LoginDto){return this.auth.login(dto.email,dto.password)}
@ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('me') me(@Req() req:any){return req.user}
@ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post('switch-company') switch(@Req() req:any,@Body() dto:SwitchCompanyDto){return this.auth.switchCompany(req.user.sub,dto.companyId,req.user.email)} }
