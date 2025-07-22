import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import * as csv from 'csv-parse';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    const ingredient = this.ingredientRepository.create(createIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async bulkCreate(createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    if (!createIngredientDtos.length) throw new BadRequestException('No ingredients provided');
    const ingredients = createIngredientDtos.map(dto => this.ingredientRepository.create(dto));
    return await this.ingredientRepository.save(ingredients);
  }

  async importCsv(file: Express.Multer.File): Promise<Ingredient[]> {
    if (!file || !file.path) throw new BadRequestException('No file uploaded');

    const results: Ingredient[] = [];
    try {
      return await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv.parse({ columns: true, trim: true, skip_empty_lines: true }))
          .on('data', async (row) => {
            try {
              const createDto: CreateIngredientDto = {
                name: row.name || '',
                unit: row.unit || '',
                purchase_price: parseFloat(row.purchase_price) || 0,
                waste_percent: parseFloat(row.waste_percent) || 0,
                cost_per_ml: parseFloat(row.cost_per_ml) || undefined,
                cost_per_gram: parseFloat(row.cost_per_gram) || undefined,
                cost_per_unit: parseFloat(row.cost_per_unit) || undefined,
                supplier: row.supplier || undefined,
              };
              const ingredient = this.ingredientRepository.create(createDto);
              const savedIngredient = await this.ingredientRepository.save(ingredient);
              results.push(savedIngredient);
            } catch (error) {
              this.logger.error(`Error processing row: ${JSON.stringify(row)}`, error.stack);
            }
          })
          .on('end', () => {
            // Clean up file after processing
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            resolve(results);
          })
          .on('error', (error) => {
            reject(new BadRequestException(`CSV parsing error: ${error.message}`));
          });
      });
    } catch (error) {
      this.logger.error('File processing error', error.stack);
      throw new BadRequestException('Failed to process the uploaded file');
    }
  }

  async findAll(): Promise<Ingredient[]> {
    return await this.ingredientRepository.find();
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOneBy({ id });
    if (!ingredient) throw new BadRequestException(`Ingredient with ID ${id} not found`);
    return ingredient;
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);
    Object.assign(ingredient, updateIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.ingredientRepository.remove(ingredient);
  }
}