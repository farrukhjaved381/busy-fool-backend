import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Purchase } from './entities/purchase.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('purchases')
@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Record a new purchase' })
  @ApiResponse({ status: 201, description: 'Purchase recorded', type: Purchase })
  create(@Body() createPurchaseDto: CreatePurchaseDto, @Request() req: any) {
    return this.purchasesService.create(createPurchaseDto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all purchases' })
  @ApiResponse({ status: 200, description: 'List of purchases', type: [Purchase] })
  findAll() {
    return this.purchasesService.findAll();
  }
}