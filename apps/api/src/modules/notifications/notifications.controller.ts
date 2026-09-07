import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { companyIdOf } from '../../core/context';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get() list(@Req() req: any, @Query('limit') limit?: string) { return this.notifications.list(companyIdOf(req.user), req.user.sub, limit ? Number(limit) : 50); }

  @Get('unread-count') unreadCount(@Req() req: any) { return this.notifications.unreadCount(companyIdOf(req.user), req.user.sub); }

  @Patch(':id/read') markRead(@Req() req: any, @Param('id') id: string) { return this.notifications.markRead(companyIdOf(req.user), req.user.sub, id); }

  @Post('mark-all-read') markAllRead(@Req() req: any) { return this.notifications.markAllRead(companyIdOf(req.user), req.user.sub); }
}
