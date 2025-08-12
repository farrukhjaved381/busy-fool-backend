import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes
} from '@nestjs/swagger';
import { Sale } from './entities/sale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import * as csvParser from 'fast-csv';
import { InjectRepository } from '@nestjs/typeorm';
import { CsvMappings } from '../csv_mappings/entities/csv-mappings.entity';
import { Repository } from 'typeorm';
import { CsvSaleDto } from './dto/csv-sale.dto';

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
  @ApiOperation({ summary: 'Record a new sale' })
  @ApiBody({ type: CreateSaleDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Sale successfully recorded.', type: Sale })
  async create(@Body() createSaleDto: CreateSaleDto, @Request() req: any) {
    return this.salesService.create(createSaleDto, req.user.sub);
  }

  // ------------------ Get All Sales ------------------
  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all sales' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of sales', type: [Sale] })
  async findAll(@Request() req: any) {
    return this.salesService.findAll(req.user.sub);
  }

  // ------------------ Delete Sale ------------------
  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a sale by ID' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.salesService.remove(id, req.user.sub);
  }

  // ------------------ Dashboard ------------------
  @Get('dashboard')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get reality check dashboard data' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Request() req: any) {
    return this.salesService.getDashboard(new Date(startDate), new Date(endDate), req.user.sub);
  }

  // ------------------ Monthly Reality Check ------------------
  @Get('monthly-reality-check')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get monthly reality check report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getMonthlyRealityCheck(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Request() req: any) {
    return this.salesService.getMonthlyRealityCheck(new Date(startDate), new Date(endDate), req.user.sub);
  }

  
  
}
