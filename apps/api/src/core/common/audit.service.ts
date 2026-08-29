import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(companyId: string | undefined, userId: string | undefined, action: string, entityType: string, entityId?: string, metadata?: any) {
    try {
      await this.prisma.auditLog.create({ data: { companyId, userId, action, entityType, entityId, metadata: metadata ?? undefined } });
    } catch {
      /* audit must never break the business operation */
    }
  }
}
