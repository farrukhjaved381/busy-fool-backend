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
  @ApiResponse({ status: 201, description: 'Ingredients imported', type: [Ingredient] })
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
  async importCsv(@UploadedFile() file: Express.Multer.File): Promise<Ingredient[]> {
    if (!file) throw new BadRequestException('No file uploaded');
    return await this.ingredientsService.importCsv(file);
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