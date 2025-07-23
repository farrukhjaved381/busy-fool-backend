import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  BadRequestException,
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
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
  @ApiBody({
    type: CreateProductDto,
    description: 'Data to create a new product, including name, category, sell price, and ingredient details.',
    examples: {
      default: {
        value: {
          name: 'Coffee Latte',
          category: 'Beverage',
          sell_price: 4.50,
          ingredients: [
            { ingredientId: '123e4567-e89b-12d3-a456-426614174000', quantity: 200, unit: 'ml', is_optional: false },
            { ingredientId: '123e4567-e89b-12d3-a456-426614174001', quantity: 10, unit: 'g', is_optional: true },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product successfully created.',
    type: Product,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Coffee Latte',
        category: 'Beverage',
        sell_price: 4.50,
        total_cost: 2.50,
        margin_amount: 2.00,
        margin_percent: 44.44,
        status: 'profitable',
        ingredients: [
          { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false },
          { id: '123e4567-e89b-12d3-a456-426614174004', quantity: 10, unit: 'g', line_cost: 1.50, is_optional: true },
        ],
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or ingredient not found.' })
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
    schema: {
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
          ingredients: [
            { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false },
          ],
        },
      ],
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No products found.' })
  async findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID', description: 'Retrieves details of a specific product by its ID.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved product details.',
    type: Product,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Coffee Latte',
        category: 'Beverage',
        sell_price: 4.50,
        total_cost: 2.50,
        margin_amount: 2.00,
        margin_percent: 44.44,
        status: 'profitable',
        ingredients: [
          { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false },
        ],
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update a product', description: 'Updates an existing product and its ingredients.' })
  @ApiBody({
    type: UpdateProductDto,
    description: 'Data to update a product, including optional fields and ingredients.',
    examples: {
      default: {
        value: {
          name: 'Updated Coffee Latte',
          sell_price: 5.00,
          ingredients: [
            { ingredientId: '123e4567-e89b-12d3-a456-426614174000', quantity: 250, unit: 'ml', is_optional: false },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product successfully updated.',
    type: Product,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Updated Coffee Latte',
        category: 'Beverage',
        sell_price: 5.00,
        total_cost: 2.75,
        margin_amount: 2.25,
        margin_percent: 45.00,
        status: 'profitable',
        ingredients: [
          { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 250, unit: 'ml', line_cost: 1.25, is_optional: false },
        ],
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or ingredient not found.' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto): Promise<Product> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a product', description: 'Deletes a product and its associated ingredients.' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Product successfully deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }

  @Post('what-if')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Simulate price change impact', description: 'Simulates the impact of price adjustments on multiple products.' })
  @ApiBody({
    type: WhatIfDto,
    description: 'Data for price adjustment simulation.',
    examples: {
      default: {
        value: {
          productIds: ['123e4567-e89b-12d3-a456-426614174002', '123e4567-e89b-12d3-a456-426614174005'],
          priceAdjustment: 1.00,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated price change impacts.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174002' },
          newMargin: { type: 'number', example: 50.00 },
          newStatus: { type: 'string', example: 'profitable' },
        },
      },
      example: [
        { productId: '123e4567-e89b-12d3-a456-426614174002', newMargin: 50.00, newStatus: 'profitable' },
        { productId: '123e4567-e89b-12d3-a456-426614174005', newMargin: 30.00, newStatus: 'profitable' },
      ],
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'One or more products not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  async whatIf(@Body() whatIfDto: WhatIfDto): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    return this.productsService.whatIf(whatIfDto);
  }

  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data', description: 'Provides financial insights for a given date range.' })
  @ApiQuery({ name: 'startDate', type: String, required: true, description: 'Start date (YYYY-MM-DD)', example: '2025-07-01' })
  @ApiQuery({ name: 'endDate', type: String, required: true, description: 'End date (YYYY-MM-DD)', example: '2025-07-23' })
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
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid date range.' })
  async getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string): Promise<any> {
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('Invalid date range');
    }
    return this.productsService.getDashboard(new Date(startDate), new Date(endDate));
  }

  @Post('milk-swap')
  @ApiOperation({ summary: 'Calculate margin impact of swapping an ingredient', description: 'Calculates the margin impact of replacing an ingredient.' })
  @ApiBody({
    type: MilkSwapDto,
    description: 'Data for ingredient swap calculation.',
    examples: {
      default: {
        value: {
          productId: '123e4567-e89b-12d3-a456-426614174002',
          originalIngredientId: '123e4567-e89b-12d3-a456-426614174000',
          newIngredientId: '123e4567-e89b-12d3-a456-426614174001',
          upcharge: 0.50,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated margin impact.',
    schema: {
      type: 'object',
      properties: {
        originalMargin: { type: 'number', example: 44.44 },
        newMargin: { type: 'number', example: 40.00 },
        upchargeCovered: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product or ingredient not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  async milkSwap(@Body() milkSwapDto: MilkSwapDto): Promise<{ originalMargin: number; newMargin: number; upchargeCovered: boolean }> {
    return this.productsService.milkSwap(milkSwapDto);
  }

  @Post(':id/quick-action')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Apply quick action (e.g., price change)', description: 'Applies a quick price change to a product.' })
  @ApiBody({
    type: QuickActionDto,
    description: 'Data for quick action (e.g., new sell price).',
    examples: {
      default: {
        value: { new_sell_price: 5.50 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully applied quick action.',
    type: Product,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Coffee Latte',
        category: 'Beverage',
        sell_price: 5.50,
        total_cost: 2.50,
        margin_amount: 3.00,
        margin_percent: 54.55,
        status: 'profitable',
        ingredients: [
          { id: '123e4567-e89b-12d3-a456-426614174003', quantity: 200, unit: 'ml', line_cost: 1.00, is_optional: false },
        ],
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid new sell price.' })
  async quickAction(@Param('id') id: string, @Body() quickActionDto: QuickActionDto): Promise<Product> {
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }
    return this.productsService.quickAction(id, quickActionDto);
  }
}