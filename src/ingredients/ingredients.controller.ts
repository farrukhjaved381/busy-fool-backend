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
import { Request as ExpressRequest } from 'express';

@ApiTags('ingredients')
@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new ingredient' })
  @ApiResponse({ status: 201, description: 'Ingredient created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: CreateIngredientDto })
  async create(@Body() createIngredientDto: CreateIngredientDto, @Request() req: ExpressRequest): Promise<Ingredient> {
    return await this.ingredientsService.create(createIngredientDto, (req as any).user.sub);
  }

  @Post('bulk')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create multiple ingredients in bulk' })
  @ApiResponse({ status: 201, description: 'Ingredients created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: [CreateIngredientDto] })
  async bulkCreate(@Body() createIngredientDtos: CreateIngredientDto[], @Request() req: ExpressRequest): Promise<Ingredient[]> {
    return await this.ingredientsService.bulkCreate(createIngredientDtos, (req as any).user.sub);
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
  @ApiResponse({ status: 201, description: 'Ingredients imported successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        }
      }
    }
  })
  async importCsv(@UploadedFile() file: Express.Multer.File, @Request() req: ExpressRequest): Promise<any> {
    if (!file) throw new BadRequestException('No file uploaded');
    return await this.ingredientsService.importCsv(file, (req as any).user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  @ApiResponse({ status: 200, description: 'List of all ingredients' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@Request() req: ExpressRequest): Promise<Ingredient[]> {
    return await this.ingredientsService.findAll((req as any).user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ingredient by ID' })
  @ApiResponse({ status: 200, description: 'Ingredient details' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id') id: string, @Request() req: ExpressRequest): Promise<Ingredient> {
    return await this.ingredientsService.findOne(id, (req as any).user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an ingredient' })
  @ApiResponse({ status: 200, description: 'Updated ingredient' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: UpdateIngredientDto })
  async update(@Param('id') id: string, @Body() updateIngredientDto: UpdateIngredientDto, @Request() req: ExpressRequest): Promise<Ingredient> {
    return await this.ingredientsService.update(id, updateIngredientDto, (req as any).user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete an ingredient' })
  @ApiResponse({ status: 204, description: 'Ingredient deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id') id: string, @Request() req: ExpressRequest): Promise<void> {
    await this.ingredientsService.remove(id, (req as any).user.sub);
  }
}
