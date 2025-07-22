import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Sale } from './entities/sale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Record a new sale' })
  @ApiResponse({ status: 201, description: 'Sale recorded', type: Sale })
  create(@Body() createSaleDto: CreateSaleDto, @Request() req: any) {
    return this.salesService.create(createSaleDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales' })
  @ApiResponse({ status: 200, description: 'List of sales', type: [Sale] })
  findAll() {
    return this.salesService.findAll();
  }

  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Dashboard data with revenue, costs, and insights' })
  getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.salesService.getDashboard(new Date(startDate), new Date(endDate));
  }

  @Get('monthly-reality-check')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get monthly reality check with waste alerts and missing recipes' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Monthly reality check with waste alerts and missing recipes' })
  getMonthlyRealityCheck(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.salesService.getMonthlyRealityCheck(new Date(startDate), new Date(endDate));
  }
}