import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/prisma/prisma.service';
import bcrypt from 'bcryptjs';
@Injectable() export class AuthService {
  constructor(private prisma:PrismaService, private jwt:JwtService){}
  async login(email:string,password:string){
    const user=await this.prisma.user.findUnique({where:{email},include:{memberships:{include:{company:true,tenant:true}}}});
    if(!user || !await bcrypt.compare(password,user.passwordHash)) throw new UnauthorizedException('Invalid credentials');
    if(user.isPlatformAdmin){ const token=this.jwt.sign({sub:user.id,email:user.email,isPlatformAdmin:true}); return {token,user:{id:user.id,email:user.email,name:`${user.firstName} ${user.lastName}`,isPlatformAdmin:true},companies:[]}; }
    const m=user.memberships[0]; if(!m) throw new ForbiddenException('No company access');
    const token=this.signMembership(user.id,user.email,m.tenantId,m.companyId,m.role,false);
    return {token,user:{id:user.id,email:user.email,name:`${user.firstName} ${user.lastName}`,isPlatformAdmin:false},companies:user.memberships.map(x=>({id:x.company.id,name:x.company.tradingName||x.company.legalName,tenantId:x.tenantId,role:x.role}))};
  }
  signMembership(userId:string,email:string,tenantId:string,companyId:string,role:string,isPlatformAdmin=false){return this.jwt.sign({sub:userId,email,tenantId,companyId,role,isPlatformAdmin})}
  async switchCompany(userId:string,companyId:string,email:string){ const m=await this.prisma.membership.findUnique({where:{userId_companyId:{userId,companyId}}}); if(!m) throw new ForbiddenException('No access to company'); return {token:this.signMembership(userId,email,m.tenantId,m.companyId,m.role)} }
}
