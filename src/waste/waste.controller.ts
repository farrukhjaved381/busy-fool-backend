import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WasteService } from './waste.service';
import { CreateWasteDto } from './dto/create-waste.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('waste')
@Controller('waste')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Record waste' })
  @ApiBody({ type: CreateWasteDto })
  @ApiResponse({ status: 201, description: 'Waste recorded successfully.' })
  @ApiResponse({ status: 404, description: 'Stock not found.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or insufficient stock.',
  })
  async create(@Body() createWasteDto: CreateWasteDto) {
    return this.wasteService.create(createWasteDto);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all waste records' })
  @ApiResponse({ status: 200, description: 'List of waste records retrieved.' })
  async findAll() {
    return this.wasteService.findAll();
  }
}
