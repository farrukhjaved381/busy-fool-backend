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
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
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
  ApiConsumes,
} from '@nestjs/swagger';
import { Product } from './entities/product.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { multerConfig } from './multer.config';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a new product with associated ingredients and optional image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Coffee Latte' },
        category: { type: 'string', example: 'Beverage' },
        sell_price: { type: 'number', example: 4.5 },
        ingredients: {
          type: 'string',
          example: JSON.stringify([{
            ingredientId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 200,
            unit: 'ml',
            is_optional: false
          }]),
          description: 'JSON string of ingredients array'
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Product image file (JPG, PNG, GIF, WEBP - max 5MB)'
        }
      },
      required: ['name', 'category', 'sell_price', 'ingredients']
    }
  })
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
    @Body() createProductDto: any,
    @UploadedFile() image: Express.Multer.File,
    @Req() req: RequestWithUser,
  ): Promise<Product> {
    // Parse and convert form data
    const parsedDto: CreateProductDto = {
      name: createProductDto.name,
      category: createProductDto.category,
      sell_price: typeof createProductDto.sell_price === 'string' ? parseFloat(createProductDto.sell_price) : createProductDto.sell_price,
      ingredients: typeof createProductDto.ingredients === 'string' ? JSON.parse(createProductDto.ingredients) : createProductDto.ingredients
    };
    
    // Manual validation
    if (!parsedDto.name || !parsedDto.category) {
      throw new BadRequestException('Name and category are required');
    }
    if (!parsedDto.sell_price || parsedDto.sell_price < 0.01) {
      throw new BadRequestException('Sell price must be at least 0.01');
    }
    if (!Array.isArray(parsedDto.ingredients) || parsedDto.ingredients.length === 0) {
      throw new BadRequestException('Ingredients must be a non-empty array');
    }
    
    return this.productsService.create(parsedDto, req.user.sub, image);
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
  async findAll(@Req() req: RequestWithUser): Promise<Product[]> {
    return this.productsService.findAll(req.user.sub);
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
    @Req() req: RequestWithUser,
  ): Promise<Product> {
    return this.productsService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiOperation({
    summary: 'Update a product',
    description: 'Updates an existing product, its ingredients, and optional image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Coffee Latte' },
        category: { type: 'string', example: 'Beverage' },
        sell_price: { type: 'number', example: 5.0 },
        ingredients: {
          type: 'string',
          example: JSON.stringify([{
            ingredientId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 250,
            unit: 'ml',
            is_optional: false
          }]),
          description: 'JSON string of ingredients array'
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Product image file (JPG, PNG, GIF, WEBP - max 5MB)'
        }
      }
    }
  })
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
    @Body() updateProductDto: any,
    @UploadedFile() image: Express.Multer.File,
    @Req() req: RequestWithUser,
  ): Promise<Product> {
    // Parse and convert form data
    const parsedDto: UpdateProductDto = {};
    
    if (updateProductDto.name) parsedDto.name = updateProductDto.name;
    if (updateProductDto.category) parsedDto.category = updateProductDto.category;
    if (updateProductDto.sell_price) {
      parsedDto.sell_price = typeof updateProductDto.sell_price === 'string' ? parseFloat(updateProductDto.sell_price) : updateProductDto.sell_price;
      if (parsedDto.sell_price && parsedDto.sell_price < 0.01) {
        throw new BadRequestException('Sell price must be at least 0.01');
      }
    }
    if (updateProductDto.ingredients) {
      parsedDto.ingredients = typeof updateProductDto.ingredients === 'string' ? JSON.parse(updateProductDto.ingredients) : updateProductDto.ingredients;
      if (!Array.isArray(parsedDto.ingredients)) {
        throw new BadRequestException('Ingredients must be an array');
      }
    }
    
    return this.productsService.update(id, parsedDto, req.user.sub, image);
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
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.productsService.remove(id, req.user.sub);
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
    @Req() req: RequestWithUser,
  ): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    return this.productsService.whatIf(whatIfDto, req.user.sub);
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
    @Req() req: RequestWithUser,
  ): Promise<{
    originalMargin: number;
    newMargin: number;
    upchargeCovered: boolean;
  }> {
    return this.productsService.milkSwap(milkSwapDto, req.user.sub);
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
    @Req() req: RequestWithUser,
  ): Promise<GetMaxProducibleQuantityResponseDto> {
    return this.productsService.getMaxProducibleQuantity(
      productId,
      req.user.sub,
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
    @Req() req: RequestWithUser,
  ): Promise<Product> {
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }
    return this.productsService.quickAction(id, quickActionDto, req.user.sub);
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

  @Get('image/:filename')
  @ApiOperation({ summary: 'Get product image (legacy)' })
  async getImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    throw new NotFoundException('Image not found - please re-upload');
  }
}
