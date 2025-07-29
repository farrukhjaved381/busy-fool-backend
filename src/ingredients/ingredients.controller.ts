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
  @ApiResponse({
    status: 201,
    description: 'Ingredient created successfully',
    content: {
      'application/json': {
        example: {
          id: '0175dc94-c5ab-4fb1-86d6-664eee45be18',
          name: 'Oat Milk',
          unit: 'L',
          quantity: 2,
          purchase_price: 2.53,
          waste_percent: 10,
          cost_per_ml: 0.0023,
          cost_per_gram: null,
          cost_per_unit: null,
          supplier: 'Oatly',
         
          created_at: '2025-07-24T11:15:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., missing required fields like name, unit, or quantity)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Oat Milk' },
        unit: { type: 'string', example: 'L' },
        quantity: { type: 'number', example: 2 },
        purchase_price: { type: 'number', example: 2.53 },
        waste_percent: { type: 'number', example: 10 },
        supplier: { type: 'string', example: 'Oatly', nullable: true }
      },
      required: ['name', 'unit', 'quantity']
    }
  })
  async create(@Body() createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    return await this.ingredientsService.create(createIngredientDto);
  }

  @Post('bulk')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create multiple ingredients in bulk' })
  @ApiResponse({
    status: 201,
    description: 'Ingredients created successfully',
    content: {
      'application/json': {
        example: [
          {
            id: '0175dc94-c5ab-4fb1-86d6-664eee45be18',
            name: 'Oat Milk',
            unit: 'L',
            quantity: 2,
            purchase_price: 2.53,
            waste_percent: 10,
            cost_per_ml: 0.0023,
            cost_per_gram: null,
            cost_per_unit: null,
            supplier: 'Oatly',
          
            created_at: '2025-07-24T11:15:00Z'
          },
          {
            id: '0189ef12-d3cd-4f9a-8b7c-9e0f1a2b3c4d',
            name: 'Almond Milk',
            unit: 'L',
            quantity: 1,
            purchase_price: 2.00,
            waste_percent: 5,
            cost_per_ml: 0.0019,
            cost_per_gram: null,
            cost_per_unit: null,
            supplier: 'Almond Breeze',
           
            created_at: '2025-07-24T11:15:00Z'
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., no ingredients provided or invalid quantity)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Oat Milk' },
          unit: { type: 'string', example: 'L' },
          quantity: { type: 'number', example: 2 },
          purchase_price: { type: 'number', example: 2.53 },
          waste_percent: { type: 'number', example: 10 },
          supplier: { type: 'string', example: 'Oatly', nullable: true }
        },
        required: ['name', 'unit', 'quantity']
      }
    }
  })
  async bulkCreate(@Body() createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    return await this.ingredientsService.bulkCreate(createIngredientDtos);
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
    fileFilter: (req, file, cb) => {
      if (path.extname(file.originalname).toLowerCase() !== '.csv') {
        return cb(new BadRequestException('Only .csv files are allowed'), false);
      }
      cb(null, true);
    }
  }))
  @ApiOperation({ summary: 'Import ingredients from CSV' })
  @ApiResponse({
    status: 201,
    description: 'Ingredients imported successfully with summary',
    content: {
      'application/json': {
        example: {
          importedIngredients: [
            {
              id: 'ac3c7887-9ae1-4221-95fd-6344b432d18b',
              name: 'Milk',
              unit: 'L',
              quantity: 10,
              purchase_price: 80,
              waste_percent: 5,
           
              cost_per_ml: 0.0084,
              cost_per_gram: null,
              cost_per_unit: null,
              supplier: 'Dairy Farm',
              created_at: '2025-07-24T06:28:38.233Z'
            }
          ],
          summary: {
            totalRows: 2,
            successfullyImported: 1,
            errors: [],
            unmappedColumns: [],
            processedMappings: {
              name: 'name',
              unit: 'unit',
              purchase_price: 'purchase_price',
              waste_percent: 'waste_percent',
              supplier: 'supplier',
              quantity: 'quantity'
            },
            note: 'Ingredients imported using automatic column mapping.'
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., no file, invalid file type, or missing required fields)' })
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
          description: 'CSV file to import (e.g., with headers: name, unit, quantity, purchase_price, waste_percent, supplier)'
        }
      }
    }
  })
  async importCsv(@UploadedFile() file: Express.Multer.File): Promise<any> {
    if (!file) throw new BadRequestException('No file uploaded');
    return await this.ingredientsService.importCsv(file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  @ApiResponse({
    status: 200,
    description: 'List of all ingredients',
    content: {
      'application/json': {
        example: [
          {
            id: '0175dc94-c5ab-4fb1-86d6-664eee45be18',
            name: 'Oat Milk',
            unit: 'L',
            quantity: 2,
            purchase_price: 2.53,
            waste_percent: 10,
            cost_per_ml: 0.0023,
            cost_per_gram: null,
            cost_per_unit: null,
            supplier: 'Oatly',
          
            created_at: '2025-07-24T11:15:00Z'
          },
          {
            id: '0189ef12-d3cd-4f9a-8b7c-9e0f1a2b3c4d',
            name: 'Almond Milk',
            unit: 'L',
            quantity: 1,
            purchase_price: 2.00,
            waste_percent: 5,
            cost_per_ml: 0.0019,
            cost_per_gram: null,
            cost_per_unit: null,
            supplier: 'Almond Breeze',
    
            created_at: '2025-07-24T11:15:00Z'
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async findAll(): Promise<Ingredient[]> {
    return await this.ingredientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ingredient by ID' })
  @ApiResponse({
    status: 200,
    description: 'Ingredient details',
    content: {
      'application/json': {
        example: {
          id: '0175dc94-c5ab-4fb1-86d6-664eee45be18',
          name: 'Oat Milk',
          unit: 'L',
          quantity: 2,
          purchase_price: 2.53,
          waste_percent: 10,
          cost_per_ml: 0.0023,
          cost_per_gram: null,
          cost_per_unit: null,
          supplier: 'Oatly',
         
          created_at: '2025-07-24T11:15:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async findOne(@Param('id') id: string): Promise<Ingredient> {
    return await this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an ingredient' })
  @ApiResponse({
    status: 200,
    description: 'Updated ingredient',
    content: {
      'application/json': {
        example: {
          id: '0175dc94-c5ab-4fb1-86d6-664eee45be18',
          name: 'Oat Milk',
          unit: 'L',
          quantity: 3,
          purchase_price: 2.90,
          waste_percent: 12,
          cost_per_ml: 0.0026,
          cost_per_gram: null,
          cost_per_unit: null,
          supplier: 'Alpro',
     
          created_at: '2025-07-24T11:15:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., invalid data)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Oat Milk' },
        unit: { type: 'string', example: 'L' },
        quantity: { type: 'number', example: 3 },
        purchase_price: { type: 'number', example: 2.90 },
        waste_percent: { type: 'number', example: 12 },
        supplier: { type: 'string', example: 'Alpro', nullable: true },
      
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
  @ApiResponse({
    status: 204,
    description: 'Ingredient deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 403, description: 'Forbidden (non-owner role)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.ingredientsService.remove(id);
  }
}