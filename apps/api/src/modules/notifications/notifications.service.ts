import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * Company/user-scoped notification centre built on the shared notification
 * store (type, title, body, link, userId, companyId, readAt).
 * Scope: notifications addressed to the current user (userId) plus
 * company-wide broadcasts (userId = null). Never another user's rows.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private where(companyId: string, userId: string) {
    return { companyId, OR: [{ userId }, { userId: null }] };
  }

  list(companyId: string, userId: string, limit = 50) {
    return this.prisma.performanceNotification.findMany({ where: this.where(companyId, userId), orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) });
  }

  async unreadCount(companyId: string, userId: string) {
    const count = await this.prisma.performanceNotification.count({ where: { ...this.where(companyId, userId), readAt: null } });
    return { count };
  }

  async markRead(companyId: string, userId: string, id: string) {
    await this.prisma.performanceNotification.updateMany({ where: { id, ...this.where(companyId, userId), readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(companyId, userId);
  }

  async markAllRead(companyId: string, userId: string) {
    const res = await this.prisma.performanceNotification.updateMany({ where: { ...this.where(companyId, userId), readAt: null }, data: { readAt: new Date() } });
    return { updated: res.count };
  }
}
