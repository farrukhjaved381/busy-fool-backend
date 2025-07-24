import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Ingredient } from './entities/ingredient.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as path from 'path';

@ApiTags('ingredients')
@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new ingredient' })
  @ApiResponse({ status: 201, description: 'Ingredient created successfully', type: Ingredient })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., missing required fields like name or unit)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Oat Milk' },
        unit: { type: 'string', example: '2L carton' },
        purchase_price: { type: 'number', example: 2.53 },
        waste_percent: { type: 'number', example: 10 },
        supplier: { type: 'string', example: 'Oatly', nullable: true }
      },
      required: ['name', 'unit']
    }
  })
  async create(@Body() createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    return await this.ingredientsService.create(createIngredientDto);
  }

  @Post('bulk')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create multiple ingredients in bulk' })
  @ApiResponse({ status: 201, description: 'Ingredients created successfully', type: [Ingredient] })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., no ingredients provided)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Oat Milk' },
          unit: { type: 'string', example: '2L carton' },
          purchase_price: { type: 'number', example: 2.53 },
          waste_percent: { type: 'number', example: 10 },
          supplier: { type: 'string', example: 'Oatly', nullable: true }
        },
        required: ['name', 'unit']
      }
    }
  })
  async bulkCreate(@Body() createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    return await this.ingredientsService.bulkCreate(createIngredientDtos);
  }

  @Post('validate-csv')
  @Roles(UserRole.OWNER)
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
  }))
  @ApiOperation({ summary: 'Validate CSV and suggest mappings' })
  @ApiResponse({
    status: 200,
    description: 'Validation result with mapping suggestions',
    schema: {
      type: 'object',
      properties: {
        suggestedMappings: {
          type: 'object',
          additionalProperties: { type: 'string' },
          example: { 'Ingredient Name': 'name', 'Unit Size': 'unit', 'Purchase Cost': 'purchase_price' }
        },
        unmappedColumns: { type: 'array', items: { type: 'string' }, example: ['Extra Column'] },
        warnings: { type: 'array', items: { type: 'string' }, example: ['Possible match for name in Ingredient Name (0.85)'] },
        isValid: { type: 'boolean', example: true },
        expectedFields: { type: 'array', items: { type: 'string' }, example: ['name', 'unit', 'purchase_price', 'waste_percent', 'cost_per_ml', 'cost_per_gram', 'cost_per_unit', 'supplier'] },
        note: { type: 'string', example: 'Map all expected fields, prioritizing required ones (name, unit). Use "undefined" for unmapped fields. Provide a mapping object directly like shown in `sampleMapping` when calling /import-csv.' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., no file uploaded)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to validate'
        }
      }
    }
  })
  async validateCsv(@UploadedFile() file: Express.Multer.File): Promise<any> {
    if (!file) throw new BadRequestException('No file uploaded');
    return await this.ingredientsService.validateCsv(file);
  }

  @Post('import-csv')
  @Roles(UserRole.OWNER)
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
  }))
  @ApiOperation({ summary: 'Import ingredients from CSV' })
  @ApiResponse({
    status: 201,
    description: 'Ingredients imported successfully with summary',
    schema: {
      type: 'object',
      properties: {
        importedIngredients: {
          type: 'array',
          items: { $ref: '#/components/schemas/Ingredient' },
          example: [
            {
              "id": "0175dc94-c5ab-4fb1-86d6-664eee45be18",
              "name": "Unknown",
              "unit": "1kg",
              "purchase_price": 5.00,
              "waste_percent": 0,
              "cost_per_ml": null,
              "cost_per_gram": 0.005,
              "cost_per_unit": null,
              "supplier": "Ahmad",
              "created_at": "2025-07-23T10:18:45.141Z"
            }
          ]
        },
        summary: {
          type: 'object',
          properties: {
            totalRows: { type: 'number', example: 5 },
            successfullyImported: { type: 'number', example: 4 },
            errors: { type: 'array', items: { type: 'string' }, example: ['Row 2: Invalid waste_percent: 150 (must be 0-100), using 0'] },
            unmappedColumns: { type: 'array', items: { type: 'string' }, example: ['Extra Column'] },
            processedMappings: { type: 'object', additionalProperties: { type: 'string' }, example: { 'Ingredient Name': 'name', 'Unit Size': 'unit' } },
            note: { type: 'string', example: 'Using default mapping from validate-csv.' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., no file or invalid mapping)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to import'
        },
        mapping: {
          type: 'string',
          description: 'User-defined column mappings as a JSON string (e.g., {"name":"name"}) based on validate-csv response',
          example: '{"Ingredient Name":"name","Unit Size":"unit","Purchase Cost":"purchase_price"}'
        }
      }
    }
  })
  async importCsv(@UploadedFile() file: Express.Multer.File, @Body('mapping') mapping: string): Promise<any> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!mapping) {
      throw new BadRequestException('Mapping object is required. Please run /validate-csv first and use the suggested mapping object (e.g., {"name":"name","unit":"unit","purchase_price":"purchase_price","waste_percent":"waste_percent","cost_per_ml":"cost_per_ml","cost_per_gram":"cost_per_gram","cost_per_unit":"cost_per_unit","supplier":"supplier"}) in the request body.');
    }
    let parsedMapping: Record<string, string>;
    try {
      parsedMapping = JSON.parse(mapping);
    } catch (e) {
      throw new BadRequestException('Invalid mapping format. Please provide a valid JSON object (e.g., {"name":"name","unit":"unit",...}).');
    }
    return await this.ingredientsService.importCsv(file, parsedMapping);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  @ApiResponse({ status: 200, description: 'List of all ingredients', type: [Ingredient], example: [
    {
      "id": "0175dc94-c5ab-4fb1-86d6-664eee45be18",
      "name": "Unknown",
      "unit": "1kg",
      "purchase_price": 5.00,
      "waste_percent": 0,
      "cost_per_ml": null,
      "cost_per_gram": 0.005,
      "cost_per_unit": null,
      "supplier": "Ahmad",
      "created_at": "2025-07-23T10:18:45.141Z"
    }
  ] })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async findAll(): Promise<Ingredient[]> {
    return await this.ingredientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ingredient by ID' })
  @ApiResponse({ status: 200, description: 'Ingredient details', type: Ingredient, example: {
    "id": "0175dc94-c5ab-4fb1-86d6-664eee45be18",
    "name": "Unknown",
    "unit": "1kg",
    "purchase_price": 5.00,
    "waste_percent": 0,
    "cost_per_ml": null,
    "cost_per_gram": 0.005,
    "cost_per_unit": null,
    "supplier": "Ahmad",
    "created_at": "2025-07-23T10:18:45.141Z"
  } })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async findOne(@Param('id') id: string): Promise<Ingredient> {
    return await this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an ingredient' })
  @ApiResponse({ status: 200, description: 'Updated ingredient', type: Ingredient, example: {
    "id": "0175dc94-c5ab-4fb1-86d6-664eee45be18",
    "name": "Oat Milk",
    "unit": "2L carton",
    "purchase_price": 2.53,
    "waste_percent": 10,
    "cost_per_ml": 0.0023,
    "cost_per_gram": null,
    "cost_per_unit": null,
    "supplier": "Oatly",
    "created_at": "2025-07-23T10:18:45.141Z"
  } })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., invalid data)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Oat Milk' },
        unit: { type: 'string', example: '2L carton' },
        purchase_price: { type: 'number', example: 2.53 },
        waste_percent: { type: 'number', example: 10 },
        supplier: { type: 'string', example: 'Oatly', nullable: true }
      },
      required: []
    }
  })
  async update(@Param('id') id: string, @Body() updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    return await this.ingredientsService.update(id, updateIngredientDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete an ingredient' })
  @ApiResponse({ status: 204, description: 'Ingredient deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.ingredientsService.remove(id);
  }
}