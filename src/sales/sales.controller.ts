import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
  HttpStatus,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';

import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Sale } from './entities/sale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { CsvMappings } from '../csv_mappings/entities/csv-mappings.entity';
import { Repository } from 'typeorm';

@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    @InjectRepository(CsvMappings)
    private csvMappingRepository: Repository<CsvMappings>,
  ) {}

  // ------------------ Create Sale ------------------
  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Record a new sale',
    description:
      "Records a new sale transaction and automatically updates the product's quantity_sold.",
  })
  @ApiBody({ type: CreateSaleDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Sale successfully recorded and product quantity_sold updated.',
    type: Sale,
  })
  async create(@Body() createSaleDto: CreateSaleDto, @Req() req: RequestWithUser) {
    return this.salesService.create(createSaleDto, req.user.sub);
  }

  // ------------------ Get All Sales ------------------
  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all sales' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sales',
    type: [Sale],
  })
  async findAll(@Req() req: RequestWithUser) {
    return this.salesService.findAll(req.user.sub);
  }

  // ------------------ Delete Sale ------------------
  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete a sale by ID',
    description:
      "Deletes a sale transaction and automatically decrements the product's quantity_sold.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Sale successfully deleted and product quantity_sold decremented.',
  })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.salesService.remove(id, req.user.sub);
  }

  // ------------------ Update Sale ------------------
  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Update a sale by ID',
    description:
      "Updates an existing sale transaction and automatically adjusts the product's quantity_sold.",
  })
  @ApiBody({ type: UpdateSaleDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Sale successfully updated and product quantity_sold adjusted.',
    type: Sale,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sale not found.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.update(id, updateSaleDto, req.user.sub);
  }

  // ------------------ Dashboard ------------------
  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getDashboard(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.getDashboard(
      new Date(startDate),
      new Date(endDate),
      req.user.sub,
    );
  }

  // ------------------ Monthly Reality Check ------------------
  @Get('monthly-reality-check')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get monthly reality check report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getMonthlyRealityCheck(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.getMonthlyRealityCheck(
      new Date(startDate),
      new Date(endDate),
      req.user.sub,
    );
  }
}
