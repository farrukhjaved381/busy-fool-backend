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
  @ApiResponse({ status: 201, description: 'Ingredient created', type: Ingredient })
  @ApiBody({ type: CreateIngredientDto })
  async create(@Body() createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    return await this.ingredientsService.create(createIngredientDto);
  }

  @Post('bulk')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create multiple ingredients in bulk' })
  @ApiResponse({ status: 201, description: 'Ingredients created', type: [Ingredient] })
  @ApiBody({ type: [CreateIngredientDto] })
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
        },
        unmappedColumns: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        isValid: { type: 'boolean' },
        expectedFields: { type: 'array', items: { type: 'string' } },
        note: { type: 'string' },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
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
    description: 'Ingredients imported with summary',
    schema: {
      type: 'object',
      properties: {
        importedIngredients: {
          type: 'array',
          items: { $ref: '#/components/schemas/Ingredient' },
        },
        summary: {
          type: 'object',
          properties: {
            totalRows: { type: 'number' },
            successfullyImported: { type: 'number' },
            errors: { type: 'array', items: { type: 'string' } },
            unmappedColumns: { type: 'array', items: { type: 'string' } },
            processedMappings: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            note: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        mapping: {
          type: 'string',
          description: 'User-defined column mappings as a JSON string (e.g., {"name":"name"}) based on validate-csv response',
        },
      },
    },
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
  @ApiResponse({ status: 200, description: 'List of ingredients', type: [Ingredient] })
  async findAll(): Promise<Ingredient[]> {
    return await this.ingredientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ingredient by ID' })
  @ApiResponse({ status: 200, description: 'Ingredient details', type: Ingredient })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  async findOne(@Param('id') id: string): Promise<Ingredient> {
    return await this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an ingredient' })
  @ApiResponse({ status: 200, description: 'Updated ingredient', type: Ingredient })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiBody({ type: UpdateIngredientDto })
  async update(@Param('id') id: string, @Body() updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    return await this.ingredientsService.update(id, updateIngredientDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete an ingredient' })
  @ApiResponse({ status: 204, description: 'Ingredient deleted' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.ingredientsService.remove(id);
  }
}