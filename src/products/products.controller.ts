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
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetMaxProducibleQuantityResponseDto } from './dto/maxProducible-quantity-response.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Product } from './entities/product.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { Request as ExpressRequest } from 'express';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a new product with associated ingredients.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product successfully created.',
    type: Product,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or ingredient not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: ExpressRequest,
  ): Promise<Product> {
    return this.productsService.create(createProductDto, (req as any).user.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description: 'Retrieves a list of all products with their ingredients.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved list of products.',
    type: [Product],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No products found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async findAll(@Req() req: ExpressRequest): Promise<Product[]> {
    return this.productsService.findAll((req as any).user.sub);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a product by ID',
    description: 'Retrieves details of a specific product by its ID.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved product details.',
    type: Product,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async findOne(
    @Param('id') id: string,
    @Req() req: ExpressRequest,
  ): Promise<Product> {
    return this.productsService.findOne(id, (req as any).user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Update a product',
    description: 'Updates an existing product and its ingredients.',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product successfully updated.',
    type: Product,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or ingredient not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: ExpressRequest,
  ): Promise<Product> {
    return this.productsService.update(
      id,
      updateProductDto,
      (req as any).user.sub,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete a product',
    description: 'Deletes a product and its associated ingredients.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: ExpressRequest,
  ): Promise<void> {
    return this.productsService.remove(id, (req as any).user.sub);
  }

  @Post('what-if')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Simulate price change impact',
    description:
      'Simulates the impact of price adjustments on multiple products.',
  })
  @ApiBody({ type: WhatIfDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated price change impacts.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'One or more products not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async whatIf(
    @Body() whatIfDto: WhatIfDto,
    @Req() req: ExpressRequest,
  ): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    return this.productsService.whatIf(whatIfDto, (req as any).user.sub);
  }

  @Post('milk-swap')
  @ApiOperation({
    summary: 'Calculate margin impact of swapping an ingredient',
    description: 'Calculates the margin impact of replacing an ingredient.',
  })
  @ApiBody({ type: MilkSwapDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully calculated margin impact.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product or ingredient not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async milkSwap(
    @Body() milkSwapDto: MilkSwapDto,
    @Req() req: ExpressRequest,
  ): Promise<{
    originalMargin: number;
    newMargin: number;
    upchargeCovered: boolean;
  }> {
    return this.productsService.milkSwap(milkSwapDto, (req as any).user.sub);
  }

  @Post('max-producible')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get maximum producible quantity for a product based on stock',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns max producible quantity and stock updates',
    type: GetMaxProducibleQuantityResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid product ID or insufficient stock',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getMaxProducibleQuantity(
    @Body('productId') productId: string,
    @Req() req: ExpressRequest,
  ): Promise<GetMaxProducibleQuantityResponseDto> {
    return this.productsService.getMaxProducibleQuantity(
      productId,
      (req as any).user.sub,
    );
  }

  @Post(':id/quick-action')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Apply quick action (e.g., price change)',
    description: 'Applies a quick price change to a product.',
  })
  @ApiBody({ type: QuickActionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully applied quick action.',
    type: Product,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid new sell price.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async quickAction(
    @Param('id') id: string,
    @Body() quickActionDto: QuickActionDto,
    @Req() req: ExpressRequest,
  ): Promise<Product> {
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }
    return this.productsService.quickAction(
      id,
      quickActionDto,
      (req as any).user.sub,
    );
  }

  @Post('recalculate-quantities')
  @Roles(UserRole.OWNER) // Assuming only owner can trigger this
  @ApiOperation({
    summary: 'Recalculate all product quantities sold',
    description:
      'Aggregates sales data to correct quantity_sold for all products.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product quantities recalculated successfully.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async recalculateQuantities() {
    await this.productsService.recalculateAllProductQuantities();
    return { message: 'Product quantities recalculated successfully.' };
  }
}
