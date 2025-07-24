import { Controller, Get, Query, UseGuards, HttpStatus, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('analytics')
@Controller('products/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ 
    summary: 'Get reality check dashboard data', 
    description: 'Provides financial insights for a given date range. This endpoint does not require a product ID.' 
  })
  @ApiQuery({ 
    name: 'startDate', 
    type: String, 
    required: true, 
    description: 'Start date (YYYY-MM-DD)', 
    example: '2025-07-01' 
  })
  @ApiQuery({ 
    name: 'endDate', 
    type: String, 
    required: true, 
    description: 'End date (YYYY-MM-DD)', 
    example: '2025-07-23' 
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved dashboard data.',
    schema: {
      type: 'object',
      properties: {
        revenue: { type: 'string', example: '100.00' },
        costs: { type: 'string', example: '60.00' },
        profit: { type: 'string', example: '40.00' },
        profitMargin: { type: 'string', example: '40.00' },
        losingMoney: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string', example: 'Lossy Product' }, margin_amount: { type: 'number', example: -5.00 } } },
        },
        winners: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string', example: 'Winner Product' }, margin_amount: { type: 'number', example: 10.00 } } },
        },
        quickWins: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string', example: 'Lossy Product' }, suggestion: { type: 'string', example: 'Raise price by £5.50' } } },
        },
      },
      example: {
        revenue: '100.00',
        costs: '60.00',
        profit: '40.00',
        profitMargin: '40.00',
        losingMoney: [{ name: 'Lossy Product', margin_amount: -5.00 }],
        winners: [{ name: 'Winner Product', margin_amount: 10.00 }],
        quickWins: [{ name: 'Lossy Product', suggestion: 'Raise price by £5.50' }],
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid date range or missing query parameters.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error due to database query failure.' })
  async getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string): Promise<any> {
    console.log('Dashboard request params:', { startDate, endDate });
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('Invalid date range. Start date must be before end date.');
    }
    return this.analyticsService.getDashboard(new Date(startDate), new Date(endDate));
  }
}