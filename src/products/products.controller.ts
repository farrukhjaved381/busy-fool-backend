import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  HttpCode, 
  BadRequestException,
  HttpStatus 
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Create a new product', description: 'Creates a new product with associated ingredients.' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product successfully created.',
    type: Product,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Coffee Latte',
          category: 'Beverage',
          sell_price: 4.50,
          total_cost: 2.50,
          margin_amount: 2.00,
          margin_percent: 44.44,
          status: 'profitable',
          created_at: '2025-07-24T11:15:00Z',
          ingredients: [
            { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false },
            { id: '123e4567-e89b-12d3-a456-426614174004', quantity: 10, unit: 'g', line_cost: 1.50, is_optional: true }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or ingredient not found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products', description: 'Retrieves a list of all products with their ingredients.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved list of products.',
    type: [Product],
    content: {
      'application/json': {
        example: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Coffee Latte',
            category: 'Beverage',
            sell_price: 4.50,
            total_cost: 2.50,
            margin_amount: 2.00,
            margin_percent: 44.44,
            status: 'profitable',
            created_at: '2025-07-24T11:15:00Z',
            ingredients: [
              { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false }
            ]
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174005',
            name: 'Americano',
            category: 'Beverage',
            sell_price: 3.00,
            total_cost: 1.50,
            margin_amount: 1.50,
            margin_percent: 50.00,
            status: 'profitable',
            created_at: '2025-07-24T11:15:00Z',
            ingredients: [
              { id: '123e4567-e89b-12d3-a456-426614174006', quantity: 150, unit: 'ml', line_cost: 0.75, is_optional: false }
            ]
          }
        ]
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No products found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID', description: 'Retrieves details of a specific product by its ID.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved product details.',
    type: Product,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Coffee Latte',
          category: 'Beverage',
          sell_price: 4.50,
          total_cost: 2.50,
          margin_amount: 2.00,
          margin_percent: 44.44,
          status: 'profitable',
          created_at: '2025-07-24T11:15:00Z',
          ingredients: [
            { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update a product', description: 'Updates an existing product and its ingredients.' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product successfully updated.',
    type: Product,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Updated Coffee Latte',
          category: 'Beverage',
          sell_price: 5.00,
          total_cost: 2.75,
          margin_amount: 2.25,
          margin_percent: 45.00,
          status: 'profitable',
          created_at: '2025-07-24T11:15:00Z',
          ingredients: [
            { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 250, unit: 'ml', line_cost: 1.25, is_optional: false }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or ingredient not found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto): Promise<Product> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a product', description: 'Deletes a product and its associated ingredients.' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product successfully deleted.'
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }

  @Post('what-if')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Simulate price change impact', description: 'Simulates the impact of price adjustments on multiple products.' })
  @ApiBody({ type: WhatIfDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated price change impacts.',
    content: {
      'application/json': {
        example: [
          { productId: '123e4567-e89b-12d3-a456-426614174002', newMargin: 50.00, newStatus: 'profitable' },
          { productId: '123e4567-e89b-12d3-a456-426614174005', newMargin: 30.00, newStatus: 'profitable' }
        ]
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'One or more products not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async whatIf(@Body() whatIfDto: WhatIfDto): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    return this.productsService.whatIf(whatIfDto);
  }

  @Post('milk-swap')
  @ApiOperation({ summary: 'Calculate margin impact of swapping an ingredient', description: 'Calculates the margin impact of replacing an ingredient.' })
  @ApiBody({ type: MilkSwapDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated margin impact.',
    content: {
      'application/json': {
        example: {
          originalMargin: 44.44,
          newMargin: 40.00,
          upchargeCovered: true
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product or ingredient not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async milkSwap(@Body() milkSwapDto: MilkSwapDto): Promise<{ originalMargin: number; newMargin: number; upchargeCovered: boolean }> {
    return this.productsService.milkSwap(milkSwapDto);
  }

  @Post(':id/quick-action')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Apply quick action (e.g., price change)', description: 'Applies a quick price change to a product.' })
  @ApiBody({ type: QuickActionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully applied quick action.',
    type: Product,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Coffee Latte',
          category: 'Beverage',
          sell_price: 5.50,
          total_cost: 2.50,
          margin_amount: 3.00,
          margin_percent: 54.55,
          status: 'profitable',
          created_at: '2025-07-24T11:15:00Z',
          ingredients: [
            { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid new sell price.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden (non-owner role)' })
  async quickAction(@Param('id') id: string, @Body() quickActionDto: QuickActionDto): Promise<Product> {
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }
    return this.productsService.quickAction(id, quickActionDto);
  }
}