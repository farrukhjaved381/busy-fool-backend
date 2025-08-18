import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { StockService } from './stock.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@ApiTags('stock')
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all stock batches' })
  @ApiResponse({ status: 200, description: 'List of stock batches retrieved.' })
  async findAll(@Req() req: RequestWithUser) {
    return this.stockService.findAll(req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get a stock batch by ID' })
  @ApiResponse({ status: 200, description: 'Stock batch retrieved.' })
  @ApiResponse({ status: 404, description: 'Stock batch not found.' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.stockService.findOne(id, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a stock batch by ID' })
  @ApiResponse({ status: 200, description: 'Stock batch deleted.' })
  @ApiResponse({ status: 404, description: 'Stock batch not found.' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.stockService.remove(id, req.user.sub);
  }

  @Get('ingredient/:ingredientId')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all stock batches by ingredient ID' })
  @ApiResponse({
    status: 200,
    description: 'List of stock batches for the ingredient retrieved.',
  })
  @ApiResponse({
    status: 404,
    description: 'No stock batches found for the ingredient.',
  })
  async findAllByIngredientId(
    @Param('ingredientId') ingredientId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.stockService.findAllByIngredientId(ingredientId, req.user.sub);
  }
}
