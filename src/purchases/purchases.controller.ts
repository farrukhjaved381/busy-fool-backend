import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Purchase } from './entities/purchase.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@ApiTags('purchases')
@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Record a new purchase',
    description: 'Records a new purchase transaction for an ingredient.',
  })
  @ApiBody({
    type: CreatePurchaseDto,
    description: 'Purchase data including ingredient ID and quantity',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase recorded successfully.',
    type: Purchase,
    content: {
      'application/json': {
        example: {
          id: '123e4567-e89b-12d3-a456-426614174009',
          ingredientId: '123e4567-e89b-12d3-a456-426614174010',
          quantity: 10,
          unit: 'L',
          purchasePrice: 2.5, // Per unit price
          total_cost: 25.0, // quantity * purchasePrice
          purchase_date: '2025-07-28T16:29:00Z',
          userId: 'user-uuid-here',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ingredient not found.',
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
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.purchasesService.create(createPurchaseDto, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a purchase by ID' })
  @ApiResponse({ status: 200, description: 'Purchase deleted.' })
  @ApiResponse({ status: 404, description: 'Purchase not found.' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.purchasesService.remove(id, req.user.sub);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Get all purchases',
    description: 'Retrieves a list of all recorded purchases.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of purchases retrieved successfully.',
    type: [Purchase],
    content: {
      'application/json': {
        example: [
          {
            id: '123e4567-e89b-12d3-a456-426614174009',
            ingredientId: '123e4567-e89b-12d3-a456-426614174010',
            quantity: 10,
            unit: 'L',
            purchasePrice: 25.0,
            created_at: '2025-07-28T16:29:00Z',
            userId: 'user-uuid-here',
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174011',
            ingredientId: '123e4567-e89b-12d3-a456-426614174012',
            quantity: 5,
            unit: 'kg',
            purchasePrice: 15.0,
            created_at: '2025-07-28T16:30:00Z',
            userId: 'user-uuid-here',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No purchases found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden (non-owner role)',
  })
  async findAll(@Req() req: RequestWithUser) {
    return this.purchasesService.findAll(req.user.sub);
  }
}
