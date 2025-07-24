import { Injectable, BadRequestException } from '@nestjs/common';
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
  private readonly expectedFields: string[] = ['name', 'unit', 'quantity', 'purchase_price', 'waste_percent', 'cost_per_ml', 'cost_per_gram', 'cost_per_unit', 'supplier', 'stock'];
  private readonly requiredFields: string[] = ['name', 'unit', 'quantity'];
  private readonly fieldTypes: Record<string, string> = {
    name: 'string',
    unit: 'string',
    quantity: 'number',
    purchase_price: 'number',
    waste_percent: 'number',
    cost_per_ml: 'number',
    cost_per_gram: 'number',
    cost_per_unit: 'number',
    supplier: 'string',
    stock: 'number',
  };

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    if (!createIngredientDto.quantity || createIngredientDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive number');
    }
    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      createIngredientDto.purchase_price,
      createIngredientDto.waste_percent,
      createIngredientDto.unit,
      createIngredientDto.quantity
    );
    const ingredient = this.ingredientRepository.create({
      ...createIngredientDto,
      cost_per_ml,
      cost_per_gram,
      cost_per_unit,
      stock: createIngredientDto.quantity, // Initialize stock to quantity
    });
    return this.ingredientRepository.save(ingredient);
  }

  async bulkCreate(createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    if (!createIngredientDtos.length) {
      throw new BadRequestException('No ingredients provided');
    }
    const ingredients = createIngredientDtos.map(dto => {
      if (!dto.quantity || dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive number');
      }
      const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
        dto.purchase_price,
        dto.waste_percent,
        dto.unit,
        dto.quantity
      );
      return this.ingredientRepository.create({
        ...dto,
        cost_per_ml,
        cost_per_gram,
        cost_per_unit,
        stock: dto.quantity, // Initialize stock to quantity
      });
    });
    return this.ingredientRepository.save(ingredients);
  }

  async importCsv(file: Express.Multer.File): Promise<any> {
    if (!file || !file.path) {
      throw new BadRequestException('No file uploaded');
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (fileExtension !== '.csv') {
      throw new BadRequestException('Only .csv files are supported');
    }
    if (!file.mimetype || !file.mimetype.includes('csv')) {
      throw new BadRequestException('Invalid file type. Please upload a .csv file');
    }

    const headers = await this.extractHeaders(file.path);
    const { suggestedMappings, unmappedColumns, warnings } = this.generateMappings(headers);
    const autoMapping = this.generateAutoMapping(headers, suggestedMappings);

    const missingRequired = this.requiredFields.filter(f => !Object.values(autoMapping).some(v => v === f));
    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required fields in CSV: ${missingRequired.join(', ')}. Ensure your CSV includes columns for ${this.requiredFields.join(', ')}.`);
    }

    const results: Ingredient[] = [];
    const unmappedColumnsImport: string[] = [];
    let dataRows = 0;
    const errors: string[] = [];
    const processedMappings: Record<string, string> = {};

    const parser = fs.createReadStream(file.path)
      .pipe(csv.parse({ columns: true, trim: true, skip_empty_lines: true }));
    for await (const row of parser) {
      if (Object.keys(row).length === 0) continue;
      dataRows++;
      try {
        const createDto: CreateIngredientDto = {
          name: 'Unknown',
          unit: 'Unknown',
          quantity: 1,
          purchase_price: 0,
          waste_percent: 0,
          supplier: undefined,
        };

        for (const header of headers) {
          const mappedField = autoMapping[header];
          processedMappings[header] = mappedField || 'undefined';
          const value = row[header];
          if (!mappedField || mappedField === 'undefined') {
            unmappedColumnsImport.push(header);
            continue;
          }
          switch (mappedField) {
            case 'name':
              createDto.name = value || 'Unknown';
              break;
            case 'unit':
              createDto.unit = value || 'Unknown';
              break;
            case 'quantity':
              createDto.quantity = parseFloat(value) || 1;
              if (createDto.quantity <= 0) {
                errors.push(`Row ${dataRows}: Invalid quantity: ${value} (must be positive), using 1`);
                createDto.quantity = 1;
              }
              break;
            case 'purchase_price':
              createDto.purchase_price = parseFloat(value) || 0;
              break;
            case 'waste_percent':
              createDto.waste_percent = parseFloat(value) || 0;
              if (isNaN(createDto.waste_percent) || createDto.waste_percent > 100) {
                errors.push(`Row ${dataRows}: Invalid waste_percent: ${value} (must be 0-100), using 0`);
                createDto.waste_percent = 0;
              }
              break;
            case 'supplier':
              createDto.supplier = value || undefined;
              break;
          }
        }

        const ingredient = this.ingredientRepository.create({
          ...createDto,
          cost_per_ml: null,
          cost_per_gram: null,
          cost_per_unit: null,
          stock: createDto.quantity, // Set stock to imported quantity
        });
        const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
          createDto.purchase_price,
          createDto.waste_percent,
          createDto.unit,
          createDto.quantity
        );
        ingredient.cost_per_ml = cost_per_ml ?? null;
        ingredient.cost_per_gram = cost_per_gram ?? null;
        ingredient.cost_per_unit = cost_per_unit ?? null;

        const existingIngredient = await this.ingredientRepository.findOne({
          where: { name: createDto.name, unit: createDto.unit, quantity: createDto.quantity },
        });

        if (existingIngredient) {
          existingIngredient.purchase_price = createDto.purchase_price;
          existingIngredient.waste_percent = createDto.waste_percent;
          existingIngredient.supplier = createDto.supplier ?? '';
          existingIngredient.cost_per_ml = cost_per_ml ?? null;
          existingIngredient.cost_per_gram = cost_per_gram ?? null;
          existingIngredient.cost_per_unit = cost_per_unit ?? null;
          existingIngredient.stock += createDto.quantity; // Increment stock by imported quantity
          results.push(await this.ingredientRepository.save(existingIngredient));
        } else {
          results.push(await this.ingredientRepository.save(ingredient));
        }
      } catch (error) {
        errors.push(`Row ${dataRows}: ${error.message} (Details: ${JSON.stringify(row)})`);
      }
    }

    await fs.promises.unlink(file.path);
    return {
      importedIngredients: results,
      summary: {
        totalRows: dataRows + 1,
        successfullyImported: results.length,
        errors,
        unmappedColumns: unmappedColumnsImport,
        processedMappings,
        note: 'Ingredients imported using automatic column mapping. Stock updated based on quantity.',
      },
    };
  }

  async findAll(): Promise<Ingredient[]> {
    return this.ingredientRepository.find();
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOneBy({ id });
    if (!ingredient) {
      throw new BadRequestException(`Ingredient with ID ${id} not found`);
    }
    return ingredient;
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);
    const newPurchasePrice = updateIngredientDto.purchase_price ?? ingredient.purchase_price;
    const newWastePercent = updateIngredientDto.waste_percent ?? ingredient.waste_percent;
    const newUnit = updateIngredientDto.unit ?? ingredient.unit;
    const newQuantity = updateIngredientDto.quantity ?? ingredient.quantity;

    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      newPurchasePrice,
      newWastePercent,
      newUnit,
      newQuantity
    );

    Object.assign(ingredient, updateIngredientDto, {
      purchase_price: newPurchasePrice,
      waste_percent: newWastePercent,
      unit: newUnit,
      quantity: newQuantity,
      cost_per_ml: cost_per_ml ?? null,
      cost_per_gram: cost_per_gram ?? null,
      cost_per_unit: cost_per_unit ?? null,
      stock: updateIngredientDto.stock ?? ingredient.stock,
    });

    return this.ingredientRepository.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.ingredientRepository.remove(ingredient);
  }

  private calculateSimilarity(s1: string, s2: string): number {
    const tokens1 = s1.split(/[_ ]/).filter(t => t.toLowerCase());
    const tokens2 = s2.split(/[_ ]/).filter(t => t.toLowerCase());
    let commonTokens = 0;
    const weightMap: Record<string, number> = {
      name: 1.0,
      unit: 0.55,
      quantity: 0.75,
      purchase_price: 0.75,
      waste_percent: 0.75,
      cost_per_ml: 0.75,
      cost_per_gram: 0.75,
      cost_per_unit: 0.75,
      supplier: 0.75,
      stock: 0.75,
    };
    const lastTokenWeight = 2;

    for (let i = 0; i < tokens1.length; i++) {
      for (let j = 0; j < tokens2.length; j++) {
        if (tokens1[i] === tokens2[j]) {
          const weight = (i === tokens1.length - 1 || j === tokens2.length - 1) ? lastTokenWeight : 1;
          commonTokens += weight * (weightMap[tokens2[j]] || 1);
        }
      }
    }

    const maxTokens = Math.max(
      tokens1.reduce((sum, t, i) => sum + ((i === tokens1.length - 1) ? lastTokenWeight : 1) * (weightMap[t] || 1), 0),
      tokens2.reduce((sum, t, i) => sum + ((i === tokens2.length - 1) ? lastTokenWeight : 1) * (weightMap[t] || 1), 0)
    );
    return maxTokens ? commonTokens / maxTokens : 0;
  }

  private isValidMapping(header: string, field: string): boolean {
    const headerTokens = header.toLowerCase().split(/[_ ]/).filter(t => t);
    const fieldType = this.fieldTypes[field];
    return !(fieldType === 'number' && !headerTokens.some(t => ['price', 'cost', 'percent', 'quantity', 'stock'].includes(t))) &&
      !(fieldType === 'string' && headerTokens.some(t => ['price', 'cost', 'percent', 'quantity', 'stock'].includes(t)));
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s2.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[s2.length][s1.length];
  }

  private extractHeaders(filePath: string): Promise<string[]> {
    const fileContent = fs.promises.readFile(filePath, 'utf8');
    return fileContent.then(content => {
      const firstLine = content.split('\n')[0].trim();
      return firstLine ? firstLine.split(',').map(header => header.trim()) : [];
    });
  }

  private generateMappings(headers: string[]): { suggestedMappings: Record<string, string>; unmappedColumns: string[]; warnings: string[] } {
    const suggestedMappings: Record<string, string> = {};
    const unmappedColumns: string[] = [];
    const warnings: string[] = [];
    const uniqueWarnings = new Set<string>();

    for (const header of headers) {
      let bestMatch = header;
      let maxSimilarity = 0;
      const normalizedHeader = header.toLowerCase().replace(/^(my_|my|_full(name)?)$/, '').trim();

      for (const field of this.expectedFields) {
        const normalizedField = field.toLowerCase();
        let similarity = this.calculateSimilarity(normalizedHeader, normalizedField);
        const distance = this.levenshteinDistance(normalizedHeader, normalizedField);
        if (distance <= 2 && this.requiredFields.includes(field)) {
          similarity += 0.4;
        }
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = field;
        }
        const warningThreshold = this.requiredFields.includes(field) ? 0.5 : 0.4;
        if (similarity >= warningThreshold) {
          uniqueWarnings.add(`Possible match for ${field} in ${header} (${similarity.toFixed(2)})`);
        }
      }

      const distance = this.levenshteinDistance(header.toLowerCase(), bestMatch.toLowerCase());
      if (maxSimilarity >= 0.5 || (distance <= 2 && this.requiredFields.includes(bestMatch))) {
        suggestedMappings[header] = bestMatch;
      } else {
        unmappedColumns.push(header);
        const typoSuggestions = this.expectedFields
          .filter(f => {
            const dist = this.levenshteinDistance(header.toLowerCase(), f.toLowerCase());
            return dist <= 2;
          })
          .map(f => `Possible typo correction: ${header} → ${f}`);
        if (typoSuggestions.length > 0) {
          warnings.push(...typoSuggestions);
        }
      }
    }

    warnings.push(...uniqueWarnings);
    return { suggestedMappings, unmappedColumns, warnings };
  }

  private generateAutoMapping(headers: string[], suggestedMappings: Record<string, string>): Record<string, string> {
    const autoMapping: Record<string, string> = {};
    for (const header of headers) {
      autoMapping[header] = suggestedMappings[header] || 'undefined';
    }
    return autoMapping;
  }

  private calculateCosts(purchase_price: number, waste_percent: number, unit: string, quantity: number): {
    cost_per_ml: number | undefined;
    cost_per_gram: number | undefined;
    cost_per_unit: number | undefined;
  } {
    const usablePercentage = 1 - (waste_percent / 100);
    if (usablePercentage <= 0) {
      throw new BadRequestException('Waste percent results in zero or negative usable quantity.');
    }

    let totalQuantity = quantity || 1;
    let isMilliliters = false;
    let isGrams = false;
    let isUnits = false;

    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      totalQuantity = unit.toLowerCase().includes('l') ? totalQuantity * 1000 : totalQuantity;
      isMilliliters = true;
    } else if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      totalQuantity = unit.toLowerCase().includes('kg') ? totalQuantity * 1000 : totalQuantity;
      isGrams = true;
    } else if (unit.toLowerCase().includes('unit')) {
      totalQuantity = totalQuantity || 1;
      isUnits = true;
    } else {
      throw new BadRequestException('Unsupported unit. Use ml, L, g, kg, or unit.');
    }

    const usableQuantity = totalQuantity * usablePercentage;
    const cost_per_ml = isMilliliters ? (purchase_price / usableQuantity) : undefined;
    const cost_per_gram = isGrams ? (purchase_price / usableQuantity) : undefined;
    const cost_per_unit = isUnits ? (purchase_price / usableQuantity) : undefined;

    return {
      cost_per_ml: cost_per_ml !== undefined ? Number(cost_per_ml.toFixed(4)) : undefined,
      cost_per_gram: cost_per_gram !== undefined ? Number(cost_per_gram.toFixed(4)) : undefined,
      cost_per_unit: cost_per_unit !== undefined ? Number(cost_per_unit.toFixed(4)) : undefined,
    };
  }
}