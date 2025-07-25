import { Controller, Post, Body, Get, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('stock')
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new stock batch' })
  @ApiBody({ type: CreateStockDto })
  @ApiResponse({ status: 201, description: 'Stock batch created successfully.' })
  @ApiResponse({ status: 404, description: 'Ingredient not found.' })
  async create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all stock batches' })
  @ApiResponse({ status: 200, description: 'List of stock batches retrieved.' })
  async findAll() {
    return this.stockService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get a stock batch by ID' })
  @ApiResponse({ status: 200, description: 'Stock batch retrieved.' })
  @ApiResponse({ status: 404, description: 'Stock batch not found.' })
  async findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update a stock batch' })
  @ApiResponse({ status: 200, description: 'Stock batch updated successfully.' })
  @ApiResponse({ status: 404, description: 'Stock batch not found.' })
  async update(@Param('id') id: string, @Body() updateStockDto: any) {
    return this.stockService.update(id, updateStockDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a stock batch' })
  @ApiResponse({ status: 200, description: 'Stock batch deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Stock batch not found.' })
  async remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}