import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  UseGuards, 
  Request, 
  HttpCode, 
  HttpStatus, 
  Delete, 
  Param
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Sale } from './entities/sale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('sales')
@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Record a new sale', description: 'Records a new sale transaction with associated product details.' })
  @ApiBody({ type: CreateSaleDto, description: 'Sale data including product ID and quantity sold' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sale successfully recorded.',
    type: Sale,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          productId: '123e4567-e89b-12d3-a456-426614174001',
          quantity: 2,
          total_amount: 9.00, // Updated to match entity
          sale_date: '2025-07-28T16:29:00Z', // Updated to match entity
          userId: 'user-uuid-here',
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or insufficient stock.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSaleDto: CreateSaleDto, @Request() req: any) {
    return this.salesService.create(createSaleDto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all sales', description: 'Retrieves a list of all recorded sales with their details.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved list of sales.',
    type: [Sale],
    content: {
      'application/json': {
        example: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            productId: '123e4567-e89b-12d3-a456-426614174001',
            quantity: 2,
            totalPrice: 9.00,
            created_at: '2025-07-28T16:29:00Z',
            userId: 'user-uuid-here',
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            productId: '123e4567-e89b-12d3-a456-426614174004',
            quantity: 1,
            totalPrice: 4.50,
            created_at: '2025-07-28T16:30:00Z',
            userId: 'user-uuid-here',
          }
        ]
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No sales found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async findAll() {
    return this.salesService.findAll();
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a sale by ID' })
  @ApiResponse({ status: 200, description: 'Sale deleted.' })
  @ApiResponse({ status: 404, description: 'Sale not found.' })
  async remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }

  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data', description: 'Provides a dashboard with revenue, costs, and profitability insights for a specified date range.' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)', example: '2025-07-01' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)', example: '2025-07-28' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard data retrieved successfully.',
    content: {
      'application/json': {
        example: {
          totalRevenue: 150.00,
          totalCost: 75.00,
          profit: 75.00,
          profitableItems: 5,
          unprofitableItems: 1,
          dateRange: '2025-07-01 to 2025-07-28',
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid date range.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.salesService.getDashboard(new Date(startDate), new Date(endDate));
  }

  @Get('monthly-reality-check')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get monthly reality check', description: 'Generates a monthly report with waste alerts and missing recipes for a specified date range.' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)', example: '2025-07-01' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)', example: '2025-07-28' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Monthly reality check retrieved successfully.',
    content: {
      'application/json': {
        example: {
          totalWaste: 5.00,
          missingRecipes: ['Coffee Latte', 'Americano'],
          wasteAlerts: [
            { ingredient: 'Milk', quantity: 2.5, unit: 'L', date: '2025-07-15' }
          ],
          dateRange: '2025-07-01 to 2025-07-28',
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid date range.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async getMonthlyRealityCheck(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.salesService.getMonthlyRealityCheck(new Date(startDate), new Date(endDate));
  }
}