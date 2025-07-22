import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Product } from './entities/product.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created', type: Product })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product details', type: Product })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Updated product', type: Product })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 204, description: 'Product deleted' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post('what-if')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Simulate price change impact' })
  @ApiResponse({ status: 200, description: 'Impact of price changes', type: [Object] })
  whatIf(@Body() whatIfDto: WhatIfDto) {
    return this.productsService.whatIf(whatIfDto);
  }

  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Dashboard data with revenue, costs, and insights' })
  getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.productsService.getDashboard(new Date(startDate), new Date(endDate));
  }

  @Post('milk-swap')
  @ApiOperation({ summary: 'Calculate margin impact of swapping an ingredient' })
  @ApiResponse({ status: 200, description: 'Margin impact of ingredient swap' })
  milkSwap(@Body() milkSwapDto: MilkSwapDto) {
    return this.productsService.milkSwap(milkSwapDto);
  }

  @Post(':id/quick-action')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Apply quick action (e.g., price change)' })
  @ApiResponse({ status: 200, description: 'Updated product after quick action', type: Product })
  quickAction(@Param('id') id: string, @Body() quickActionDto: QuickActionDto) {
    return this.productsService.quickAction(id, quickActionDto);
  }
}