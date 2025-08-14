import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CsvMappingsService } from './csv_mappings.service';
import { SaveMappingDto } from './dto/save-mapping.dto';
import { ImportSalesDto } from './dto/import-sales.dto';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('CSV Mappings')
@Controller('csv-mappings')
export class CsvMappingsController {
  constructor(private readonly csvService: CsvMappingsService) {}

  // ------------------ Upload CSV Temporarily ------------------
  @Post('upload-temp')
  @ApiOperation({
    summary: 'Upload a CSV/XLSX temporarily to extract headers',
    description:
      'Uploads a CSV or Excel file to extract headers so the user can map POS columns to BusyFool fields.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or XLSX file',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'CSV/XLSX headers extracted',
    type: [String],
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = '/tmp/temp';
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async uploadTemp(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.csvService.getCsvHeaders(file.path);
  }

  // ------------------ Save CSV Mapping ------------------
  @Post('save-mapping')
  @ApiOperation({ summary: 'Save CSV -> BusyFool mappings for a user' })
  @ApiBody({
    type: SaveMappingDto,
    description:
      'userId and mappings array mapping POS headers -> busyfool fields',
  })
  @ApiResponse({ status: 201, description: 'Mapping saved successfully' })
  async saveMapping(@Body() body: SaveMappingDto) {
    // DTO will validate mapping shape if you have class-validator on SaveMappingDto
    return this.csvService.saveMapping(body.userId, body.mappings);
  }

  // ------------------ Import Sales from CSV/XLSX ------------------
  @Post('import-sales')
  @ApiOperation({
    summary: 'Import sales from CSV/XLSX (preview or confirm)',
    description:
      'Upload CSV/XLSX with per-row total amount (Amount). confirm=false => dry-run, confirm=true => saves Sale rows.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'uuid-of-user' },
        confirm: {
          type: 'boolean',
          example: false,
          description: 'If false, dry-run (preview) only',
        },
        file: { type: 'string', format: 'binary' },
      },
      required: ['userId', 'file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sales import insights (per-row + totals)',
    schema: {
      example: {
        totalSales: 489.3,
        totalProfit: 0,
        avgProfitMargin: 0,
        rows: [
          {
            productName: 'Banana Bread',
            quantitySold: 4,
            amount: 15.2,
            unitPrice: 3.8,
            saleDate: '2025-08-06T00:00:00.000Z',
            profit: 0,
            profitMargin: 0,
          },
        ],
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = '/tmp/csv';
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async importSales(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any, // Accept raw body because multipart fields arrive as strings
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!body || !body.userId)
      throw new BadRequestException('userId is required');

    // Coerce userId (strip quotes if user pasted string with quotes)
    let userId = String(body.userId).trim();
    if (userId.startsWith('"') && userId.endsWith('"'))
      userId = userId.slice(1, -1);

    // Coerce confirm to boolean (multipart/form-data sends strings)
    let confirm = false;
    if (typeof body.confirm === 'string') {
      confirm = ['true', '1', 'yes'].includes(body.confirm.toLowerCase());
    } else {
      confirm = !!body.confirm;
    }

    return this.csvService.importSales(file.path, userId, confirm);
  }

  // ------------------ Import Daily Sales (filename date fallback) ------------------
  @Post('import-daily-sales')
  @ApiOperation({
    summary: 'Import daily sales (filename date fallback)',
    description:
      'Similar to import-sales but will use date from filename (e.g. items-report-YYYY-MM-DD_YYYY-MM-DD.csv) when sale_date column missing.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        confirm: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['userId', 'file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Daily import preview or saved results',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = '/tmp/csv';
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async importDailySales(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!body || !body.userId)
      throw new BadRequestException('userId is required');

    let userId = String(body.userId).trim();
    if (userId.startsWith('"') && userId.endsWith('"'))
      userId = userId.slice(1, -1);

    let confirm = false;
    if (typeof body.confirm === 'string') {
      confirm = ['true', '1', 'yes'].includes(body.confirm.toLowerCase());
    } else {
      confirm = !!body.confirm;
    }

    return this.csvService.importDailySales(file.path, userId, confirm);
  }
}

// ------------------ Lightweight Sales controller for daily summary ------------------

import { Controller as C2, Get as G2 } from '@nestjs/common';
import {
  ApiTags as ApiTags2,
  ApiOperation as ApiOperation2,
  ApiQuery as ApiQuery2,
  ApiResponse as ApiResponse2,
} from '@nestjs/swagger';

@ApiTags2('Sales')
@C2('sales')
export class SalesDailyController {
  constructor(private readonly csvService: CsvMappingsService) {}

  @G2('daily')
  @ApiOperation2({
    summary: 'Get daily sales summary',
    description:
      'Returns aggregated daily sales for a user and optional date range',
  })
  @ApiQuery2({ name: 'userId', required: true, type: String })
  @ApiQuery2({ name: 'startDate', required: false, type: String })
  @ApiQuery2({ name: 'endDate', required: false, type: String })
  @ApiResponse2({
    status: 200,
    description: 'Daily sales summary array',
    schema: {
      example: [
        {
          date: '2025-08-06',
          totalSales: 489.3,
          totalProfit: 0,
          itemsSold: 127,
        },
      ],
    },
  })
  async getDailySales(
    @Query('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.csvService.getDailySales(userId, startDate, endDate);
  }
}
