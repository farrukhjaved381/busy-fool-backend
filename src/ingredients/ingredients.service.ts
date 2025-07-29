import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import * as csv from 'csv-parse';
import * as fs from 'fs';
import * as path from 'path';
import { Stock } from '../stock/entities/stock.entity';

/**
 * Service to manage ingredient-related operations including creation, updates, and CSV import.
 */
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
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
  ) {}

  /**
   * Creates a new ingredient with an initial stock batch.
   * @param createIngredientDto Data for the new ingredient
   * @returns The created ingredient
   * @throws BadRequestException if quantity is invalid or waste percent is out of range
   */
  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    if (!createIngredientDto.quantity || createIngredientDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive number');
    }
    if (createIngredientDto.waste_percent < 0 || createIngredientDto.waste_percent > 100) {
      throw new BadRequestException('Waste percentage must be between 0 and 100');
    }

    const ingredient = this.ingredientRepository.create(createIngredientDto);
    const savedIngredient = await this.ingredientRepository.save(ingredient);

    const usablePercentage = 1 - (createIngredientDto.waste_percent / 100);
    const purchasePricePerUnit = createIngredientDto.purchase_price / createIngredientDto.quantity;
    const totalPurchasedPrice = createIngredientDto.purchase_price;
    const stock = this.stockRepository.create({
      ingredient: { id: savedIngredient.id },
      purchased_quantity: createIngredientDto.quantity,
      unit: createIngredientDto.unit,
      total_purchased_price: totalPurchasedPrice,
      purchase_price_per_unit: purchasePricePerUnit,
      waste_percent: createIngredientDto.waste_percent,
      remaining_quantity: createIngredientDto.quantity * usablePercentage,
      wasted_quantity: 0,
      purchased_at: new Date(),
    });
    await this.stockRepository.save(stock);

    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      createIngredientDto.purchase_price,
      createIngredientDto.waste_percent,
      createIngredientDto.unit,
      createIngredientDto.quantity,
    );
    savedIngredient.cost_per_ml = cost_per_ml ?? null;
    savedIngredient.cost_per_gram = cost_per_gram ?? null;
    savedIngredient.cost_per_unit = cost_per_unit ?? null;
    return this.ingredientRepository.save(savedIngredient);
  }

  async bulkCreate(createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    if (!createIngredientDtos.length) {
      throw new BadRequestException('No ingredients provided');
    }
    const ingredients = [];
    for (const dto of createIngredientDtos) {
      if (!dto.quantity || dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive number');
      }
      if (dto.waste_percent < 0 || dto.waste_percent > 100) {
        throw new BadRequestException('Waste percentage must be between 0 and 100');
      }

      const ingredient = this.ingredientRepository.create(dto);
      const savedIngredient = await this.ingredientRepository.save(ingredient);

      const usablePercentage = 1 - (dto.waste_percent / 100);
      const purchasePricePerUnit = dto.purchase_price / dto.quantity;
      const totalPurchasedPrice = dto.purchase_price;
      const stock = this.stockRepository.create({
        ingredient: { id: savedIngredient.id },
        purchased_quantity: dto.quantity,
        unit: dto.unit,
        total_purchased_price: totalPurchasedPrice,
        purchase_price_per_unit: purchasePricePerUnit,
        waste_percent: dto.waste_percent,
        remaining_quantity: dto.quantity * usablePercentage,
        wasted_quantity: 0,
        purchased_at: new Date(),
      });
      await this.stockRepository.save(stock);

      const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
        dto.purchase_price,
        dto.waste_percent,
        dto.unit,
        dto.quantity,
      );
      savedIngredient.cost_per_ml = cost_per_ml ?? null;
      savedIngredient.cost_per_gram = cost_per_gram ?? null;
      savedIngredient.cost_per_unit = cost_per_unit ?? null;
      ingredients.push(savedIngredient);
    }
    return this.ingredientRepository.save(ingredients);
  }

  /**
   * Imports ingredients from a CSV file with stock batches.
   * @param file Uploaded CSV file
   * @returns Import summary with created ingredients and errors
   * @throws BadRequestException if file is invalid or required fields are missing
   */
  async importCsv(file: Express.Multer.File): Promise<any> {
    if (!file || !file.path) {
      throw new BadRequestException('No file uploaded');
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (fileExtension !== '.csv') {
      throw new BadRequestException('Only .csv files are supported');
    }

    const headers = await this.extractHeaders(file.path);
    const { suggestedMappings, unmappedColumns, warnings } = this.generateMappings(headers);
    const autoMapping = this.generateAutoMapping(headers, suggestedMappings);

    const missingRequired = this.requiredFields.filter(f => !Object.values(autoMapping).some(v => v === f));
    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required fields in CSV: ${missingRequired.join(', ')}. Ensure your CSV includes columns for ${this.requiredFields.join(', ')}.`);
    }

    const results: Ingredient[] = [];
    const errors: string[] = [];
    let dataRows = 0;

    const parser = fs.createReadStream(file.path)
      .pipe(csv.parse({ columns: true, trim: true, skip_empty_lines: true }));
    for await (const row of parser) {
      dataRows++;
      try {
        const createDto: CreateIngredientDto = {
          name: row[autoMapping['name']] || 'Unknown',
          unit: row[autoMapping['unit']] || 'Unknown',
          quantity: parseFloat(row[autoMapping['quantity']]) || 1,
          purchase_price: parseFloat(row[autoMapping['purchase_price']]) || 0,
          waste_percent: parseFloat(row[autoMapping['waste_percent']]) || 0,
          supplier: row[autoMapping['supplier']] || undefined,
        };

        if (!createDto.quantity || createDto.quantity <= 0) {
          throw new Error('Quantity must be a positive number');
        }
        if (createDto.waste_percent < 0 || createDto.waste_percent > 100) {
          throw new Error('Waste percentage must be between 0 and 100');
        }

        const ingredient = this.ingredientRepository.create(createDto);
        const savedIngredient = await this.ingredientRepository.save(ingredient);

        const usablePercentage = 1 - (createDto.waste_percent / 100);
        const purchasePricePerUnit = createDto.purchase_price / createDto.quantity;
        const totalPurchasedPrice = createDto.purchase_price;
        const stock = this.stockRepository.create({
          ingredient: { id: savedIngredient.id },
          purchased_quantity: createDto.quantity,
          unit: createDto.unit,
          total_purchased_price: totalPurchasedPrice,
          purchase_price_per_unit: purchasePricePerUnit,
          waste_percent: createDto.waste_percent,
          remaining_quantity: createDto.quantity * usablePercentage,
          wasted_quantity: 0,
          purchased_at: new Date(),
        });
        await this.stockRepository.save(stock);

        const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
          createDto.purchase_price,
          createDto.waste_percent,
          createDto.unit,
          createDto.quantity,
        );
        savedIngredient.cost_per_ml = cost_per_ml ?? null;
        savedIngredient.cost_per_gram = cost_per_gram ?? null;
        savedIngredient.cost_per_unit = cost_per_unit ?? null;
        results.push(await this.ingredientRepository.save(savedIngredient));
      } catch (error) {
        errors.push(`Row ${dataRows}: ${error.message} (Details: ${JSON.stringify(row)})`);
      }
    }

    try {
      await fs.promises.unlink(file.path);
    } catch (err) {
      console.warn(`Failed to delete file ${file.path}: ${err.message}`);
    }

    return {
      importedIngredients: results,
      summary: {
        totalRows: dataRows,
        successfullyImported: results.length,
        errors,
        unmappedColumns,
        note: 'Ingredients imported with stock batches using automatic column mapping.',
      },
    };
  }

  /**
   * Retrieves all ingredients with their stock batches.
   * @returns List of all ingredients
   */
  async findAll(): Promise<Ingredient[]> {
    return this.ingredientRepository.find({ relations: ['stocks'] });
  }

  /**
   * Retrieves an ingredient by ID with its stock batches.
   * @param id Ingredient ID
   * @returns The ingredient
   * @throws NotFoundException if ingredient is not found
   */
  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOne({ where: { id }, relations: ['stocks'] });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    }
    return ingredient;
  }

  /**
   * Updates an existing ingredient and its stock batches.
   * @param id Ingredient ID
   * @param updateIngredientDto Updated data
   * @returns The updated ingredient
   * @throws BadRequestException if waste percent is out of range or quantity is insufficient
   */
  async update(id: string, updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);
    if (updateIngredientDto.waste_percent && (updateIngredientDto.waste_percent < 0 || updateIngredientDto.waste_percent > 100)) {
      throw new BadRequestException('Waste percentage must be between 0 and 100');
    }

    const newPurchasePrice = updateIngredientDto.purchase_price ?? ingredient.purchase_price;
    const newWastePercent = updateIngredientDto.waste_percent ?? ingredient.waste_percent;
    const newUnit = updateIngredientDto.unit ?? ingredient.unit;
    const newQuantity = updateIngredientDto.quantity ?? ingredient.quantity;

    // Check if existing stock is sufficient for new quantity
    const totalUsed = (await this.stockRepository.sum('remaining_quantity', { ingredient: { id } })) || 0;
    if (newQuantity < totalUsed) {
      throw new BadRequestException(`New quantity (${newQuantity}) cannot be less than used stock (${totalUsed})`);
    }

    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      newPurchasePrice,
      newWastePercent,
      newUnit,
      newQuantity,
    );

    Object.assign(ingredient, updateIngredientDto, {
      purchase_price: newPurchasePrice,
      waste_percent: newWastePercent,
      unit: newUnit,
      quantity: newQuantity,
      cost_per_ml: cost_per_ml ?? null,
      cost_per_gram: cost_per_gram ?? null,
      cost_per_unit: cost_per_unit ?? null,
    });

    // Update existing stock instead of creating new
    const stock = await this.stockRepository.findOne({ where: { ingredient: { id } }, order: { purchased_at: 'DESC' } });
    if (stock) {
      const usablePercentage = 1 - (newWastePercent / 100);
      stock.purchased_quantity = newQuantity;
      stock.unit = newUnit;
      stock.total_purchased_price = newPurchasePrice; // Corrected to use total_purchased_price
      stock.purchase_price_per_unit = newPurchasePrice / newQuantity; // Recalculate unit price
      stock.waste_percent = newWastePercent;
      stock.remaining_quantity = newQuantity * usablePercentage;
      await this.stockRepository.save(stock);
    }

    return this.ingredientRepository.save(ingredient);
  }

  /**
   * Deletes an ingredient and its stock batches.
   * @param id Ingredient ID
   * @throws NotFoundException if ingredient is not found
   */
  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.stockRepository.delete({ ingredient: { id } });
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
      tokens2.reduce((sum, t, i) => sum + ((i === tokens2.length - 1) ? lastTokenWeight : 1) * (weightMap[t] || 1), 0),
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
    return fs.promises.readFile(filePath, 'utf8').then(content => {
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
    if (waste_percent < 0 || waste_percent > 100) {
      throw new BadRequestException('Waste percentage must be between 0 and 100');
    }
    const usablePercentage = 1 - (waste_percent / 100);
    if (usablePercentage <= 0) {
      throw new BadRequestException('Waste percent results in zero or negative usable quantity.');
    }

    let totalQuantity = quantity || 1;
    let isMilliliters = unit.toLowerCase().includes('ml');
    let isLiters = unit.toLowerCase().includes('l');
    let isGrams = unit.toLowerCase().includes('g');
    let isKilograms = unit.toLowerCase().includes('kg');
    let isUnits = !isMilliliters && !isLiters && !isGrams && !isKilograms;

    if (isLiters) totalQuantity *= 1000; // Convert L to ml
    if (isKilograms) totalQuantity *= 1000; // Convert kg to g
    if (isMilliliters || isLiters) isMilliliters = true;
    if (isGrams || isKilograms) isGrams = true;

    const usableQuantity = totalQuantity * usablePercentage;
    const baseCost = purchase_price / usableQuantity;
    return {
      cost_per_ml: isMilliliters ? Number(baseCost.toFixed(4)) : undefined,
      cost_per_gram: isGrams ? Number(baseCost.toFixed(4)) : undefined,
      cost_per_unit: isUnits ? Number(baseCost.toFixed(4)) : undefined,
    };
  }
}