// src/csv_mappings/csv_mappings.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  UploadedFile, 
  UseInterceptors 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CsvMappingsService } from './csv_mappings.service';
import { SaveMappingDto } from './dto/save-mapping.dto';
import { ImportSalesDto } from './dto/import-sales.dto';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';

@ApiTags('CSV Mappings')
@Controller('csv-mappings')
export class CsvMappingsController {
  constructor(private readonly csvService: CsvMappingsService) {}

  // ------------------ Upload CSV Temporarily ------------------
  @Post('upload-temp')
  @ApiOperation({
    summary: 'Upload a CSV file temporarily',
    description: 'Uploads a CSV to extract headers for mapping. The file is stored in a temporary folder.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file from POS system' }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'CSV headers extracted successfully', type: [String] })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
  }))
  async uploadTemp(@UploadedFile() file: Express.Multer.File) {
    return this.csvService.getCsvHeaders(file.path);
  }

  // ------------------ Save CSV Mapping ------------------
  @Post('save-mapping')
  @ApiOperation({
    summary: 'Save CSV column mapping',
    description: 'Maps POS CSV columns to BusyFool system fields for the given user.'
  })
  @ApiBody({
    type: SaveMappingDto,
    examples: {
      example: {
        value: {
          userId: 'uuid-of-user',
          mappings: [
            { busyfoolColumn: 'product_name', posColumnName: 'Item Name' },
            { busyfoolColumn: 'quantity_sold', posColumnName: 'Qty Sold' },
            { busyfoolColumn: 'sale_price', posColumnName: 'Price' },
            { busyfoolColumn: 'sale_date', posColumnName: 'Date' }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Mapping saved successfully' })
  async saveMapping(@Body() body: SaveMappingDto) {
    return this.csvService.saveMapping(body.userId, body.mappings);
  }

  // ------------------ Import Sales from CSV ------------------
  @Post('import-sales')
  @ApiOperation({
    summary: 'Import sales from CSV',
    description: `Uses saved mappings to import sales data from a POS CSV.
                  Supports dry-run mode (confirm=false) for preview before saving to DB.`
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'uuid-of-user' },
        confirm: { type: 'boolean', example: false, description: 'If false, runs a preview without saving' },
        file: { type: 'string', format: 'binary', description: 'CSV file from POS system' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Sales import insights',
    schema: {
      example: {
        totalSales: 1200.50,
        totalProfit: 450.75,
        avgProfitMargin: 37.55,
        rows: [
          {
            productName: 'Latte',
            quantitySold: 20,
            salePrice: 3.50,
            saleDate: '2025-08-05T00:00:00.000Z',
            profit: 1.25
          }
        ]
      }
    }
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/csv',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
  }))
  async importSales(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportSalesDto
  ) {
    return this.csvService.importSales(file.path, body.userId, body.confirm);
  }
}
