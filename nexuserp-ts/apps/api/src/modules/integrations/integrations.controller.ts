import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma/prisma.service';
import { companyIdOf } from '../../core/context';
import { JwtAuthGuard } from '../auth/auth.guard';
@ApiTags('Integrations') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('integrations')
export class IntegrationsController {
  constructor(private prisma: PrismaService) {}
  @Get() list(@Req() req:any){
    return this.prisma.integrationConnection.findMany({where:{companyId:companyIdOf(req.user)},orderBy:[{type:'asc'},{name:'asc'}]});
  }
}
