import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get dashboard data for the logged-in user' })
  @Get()
  getDashboardData(@Request() req: ExpressRequest) {
    return this.dashboardService.getDashboardData((req as any).user.sub); // pass userId
  }
}