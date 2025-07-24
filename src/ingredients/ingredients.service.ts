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
  private readonly expectedFields: string[] = ['name', 'unit', 'purchase_price', 'waste_percent', 'cost_per_ml', 'cost_per_gram', 'cost_per_unit', 'supplier'];
  private readonly requiredFields: string[] = ['name', 'unit'];
  private readonly fieldTypes: Record<string, string> = {
    name: 'string',
    unit: 'string',
    purchase_price: 'number',
    waste_percent: 'number',
    cost_per_ml: 'number',
    cost_per_gram: 'number',
    cost_per_unit: 'number',
    supplier: 'string',
  };

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      createIngredientDto.purchase_price,
      createIngredientDto.waste_percent,
      createIngredientDto.unit
    );
    const ingredient = this.ingredientRepository.create({
      ...createIngredientDto,
      cost_per_ml,
      cost_per_gram,
      cost_per_unit,
    });
    return this.ingredientRepository.save(ingredient);
  }

  async bulkCreate(createIngredientDtos: CreateIngredientDto[]): Promise<Ingredient[]> {
    if (!createIngredientDtos.length) {
      throw new BadRequestException('No ingredients provided');
    }
    const ingredients = createIngredientDtos.map(dto => {
      const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
        dto.purchase_price,
        dto.waste_percent,
        dto.unit
      );
      return this.ingredientRepository.create({
        ...dto,
        cost_per_ml,
        cost_per_gram,
        cost_per_unit,
      });
    });
    return this.ingredientRepository.save(ingredients);
  }

  async validateCsv(file: Express.Multer.File): Promise<{
    suggestedMappings: Record<string, string>;
    unmappedColumns: string[];
    warnings: string[];
    isValid: boolean;
    expectedFields: string[];
    sampleMapping: Record<string, string>;
    sampleMappingStringified: string;
    note: string;
  }> {
    if (!file || !file.path) {
      throw new BadRequestException('No file uploaded');
    }

    const headers = await this.extractHeaders(file.path);
    const { suggestedMappings, unmappedColumns, warnings } = this.generateMappings(headers);
    const sampleMapping = this.generateSampleMapping(headers, suggestedMappings);

    return {
      suggestedMappings,
      unmappedColumns,
      warnings,
      isValid: this.requiredFields.every(field => Object.values(sampleMapping).includes(field)),
      expectedFields: this.expectedFields,
      sampleMapping,
      sampleMappingStringified: JSON.stringify(sampleMapping),
      note: 'Map all expected fields, prioritizing required ones (name, unit). Use "undefined" for unmapped fields. Provide a mapping object directly like shown in `sampleMapping` when calling /import-csv.',
    };
  }

  private async extractHeaders(filePath: string): Promise<string[]> {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const firstLine = fileContent.split('\n')[0].trim();
    return firstLine ? firstLine.split(',').map(header => header.trim()) : [];
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

  private generateSampleMapping(headers: string[], suggestedMappings: Record<string, string>): Record<string, string> {
    const sampleMapping: Record<string, string> = {};
    for (const header of headers) {
      if (/name/.test(header.toLowerCase())) {
        sampleMapping[header] = 'name';
      } else if (suggestedMappings[header]) {
        sampleMapping[header] = suggestedMappings[header];
      } else {
        let bestMatch = 'undefined';
        let maxSimilarity = 0;
        let bestDistance = Number.MAX_SAFE_INTEGER;
        for (const field of [...this.requiredFields, ...this.expectedFields.filter(f => !this.requiredFields.includes(f))]) {
          let similarity = this.calculateSimilarity(header.toLowerCase().replace(/^(my_|my|_full(name)?)$/, ''), field.toLowerCase());
          const distance = this.levenshteinDistance(header.toLowerCase(), field.toLowerCase());
          if (distance <= 2 && this.requiredFields.includes(field)) {
            similarity += 0.4;
          }
          if (
            (similarity > maxSimilarity && this.isValidMapping(header, field)) ||
            (similarity === maxSimilarity && distance < bestDistance)
          ) {
            maxSimilarity = similarity;
            bestMatch = field;
            bestDistance = distance;
          }
        }
        sampleMapping[header] = (maxSimilarity >= 0.5 || (bestDistance <= 2 && this.requiredFields.includes(bestMatch))) ? bestMatch : 'undefined';
      }
    }
    return sampleMapping;
  }

  private calculateSimilarity(s1: string, s2: string): number {
    const tokens1 = s1.split(/[_ ]/).filter(t => t.toLowerCase());
    const tokens2 = s2.split(/[_ ]/).filter(t => t.toLowerCase());
    let commonTokens = 0;
    const weightMap: Record<string, number> = {
      name: 1.0,
      unit: 0.55,
      purchase_price: 0.75,
      waste_percent: 0.75,
      cost_per_ml: 0.75,
      cost_per_gram: 0.75,
      cost_per_unit: 0.75,
      supplier: 0.75,
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
    return !(fieldType === 'number' && !headerTokens.some(t => ['price', 'cost', 'percent'].includes(t))) &&
      !(fieldType === 'string' && headerTokens.some(t => ['price', 'cost', 'percent'].includes(t)));
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

  async importCsv(file: Express.Multer.File, mapping?: Record<string, string>, defaultMapping?: Record<string, string>): Promise<{
    importedIngredients: Ingredient[];
    summary: {
      totalRows: number;
      successfullyImported: number;
      errors: string[];
      unmappedColumns: string[];
      processedMappings: Record<string, string>;
      note: string;
    };
  }> {
    if (!file || !file.path) {
      throw new BadRequestException('No file uploaded');
    }
    if (!mapping && !defaultMapping) {
      throw new BadRequestException('Mapping object is required to map CSV columns to database fields. See /validate-csv for suggestions.');
    }
  
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException('Uploaded file not found on server');
    }
  
    const usedMapping = mapping || defaultMapping!;
    const results: Ingredient[] = [];
    const unmappedColumns: string[] = [];
    let dataRows = 0; // Will count data rows only
    const errors: string[] = [];
    const processedMappings: Record<string, string> = {};
  
    const missingRequired = this.requiredFields.filter(f => !Object.values(usedMapping).some(v => v === f));
    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required field mappings: ${missingRequired.join(', ')}. Consider using suggested mappings with 'undefined' for optional fields.`);
    }
    const invalidMappings = Object.entries(usedMapping).filter(([_, field]) => !this.expectedFields.includes(field) && field !== 'undefined');
    if (invalidMappings.length > 0) {
      throw new BadRequestException(`Invalid field mappings: ${invalidMappings.map(([h, f]) => `${h} → ${f}`).join(', ')}`);
    }
  
    const headers = await this.extractHeaders(file.path);
    console.log('Extracted headers:', headers); // Debug log
  
    const parser = fs.createReadStream(file.path)
      .pipe(csv.parse({ columns: true, trim: true, skip_empty_lines: true }));
    for await (const row of parser) {
      if (Object.keys(row).length === 0) continue; // Skip empty rows
      dataRows++; // Increment for each data row
      console.log(`Processing data row ${dataRows}:`, row);
      try {
        const createDto: CreateIngredientDto = {
          name: 'Unknown',
          unit: 'Unknown',
          purchase_price: 0,
          waste_percent: 0,
          cost_per_ml: undefined,
          cost_per_gram: undefined,
          cost_per_unit: undefined,
          supplier: undefined,
        };
  
        for (const header of headers) {
          const mappedField = usedMapping[header];
          processedMappings[header] = mappedField || 'undefined';
          const value = row[header];
          if (!mappedField || mappedField === 'undefined') {
            unmappedColumns.push(header);
            continue;
          }
          switch (mappedField) {
            case 'name':
              createDto.name = value || 'Unknown';
              break;
            case 'unit':
              createDto.unit = value || 'Unknown';
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
            case 'cost_per_ml':
              createDto.cost_per_ml = parseFloat(value) || undefined;
              if (createDto.cost_per_ml && createDto.cost_per_ml > 1) {
                errors.push(`Row ${dataRows}: Suspicious cost_per_ml: ${value} (must be <= 1), using null`);
                createDto.cost_per_ml = undefined;
              }
              break;
            case 'cost_per_gram':
              createDto.cost_per_gram = parseFloat(value) || undefined;
              break;
            case 'cost_per_unit':
              createDto.cost_per_unit = parseFloat(value) || undefined;
              break;
            case 'supplier':
              createDto.supplier = value || undefined;
              break;
          }
        }
  
        // Calculate costs based on unit and waste
        const ingredient = this.ingredientRepository.create(createDto);
        const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
          createDto.purchase_price,
          createDto.waste_percent,
          createDto.unit
        );
        ingredient.cost_per_ml = cost_per_ml ?? null; // Use null for undefined values
        ingredient.cost_per_gram = cost_per_gram ?? null;
        ingredient.cost_per_unit = cost_per_unit ?? null;
  
        // Check for existing ingredient by name and unit
        const existingIngredient = await this.ingredientRepository.findOne({
          where: { name: createDto.name, unit: createDto.unit },
        });
  
        if (existingIngredient) {
          Object.assign(existingIngredient, ingredient);
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
        totalRows: dataRows + 1, // Add 1 for the header row
        successfullyImported: results.length,
        errors,
        unmappedColumns,
        processedMappings,
        note: mapping ? '' : 'Using default mapping from validate-csv.',
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
    const { cost_per_ml, cost_per_gram, cost_per_unit } = this.calculateCosts(
      updateIngredientDto.purchase_price || 0,
      updateIngredientDto.waste_percent || 0,
      updateIngredientDto.unit || ingredient.unit
    );
    Object.assign(ingredient, updateIngredientDto, {
      cost_per_ml,
      cost_per_gram,
      cost_per_unit,
    });
    return this.ingredientRepository.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.ingredientRepository.remove(ingredient);
  }

  public calculateCosts(purchase_price: number, waste_percent: number, unit: string): {
    cost_per_ml: number | undefined;
    cost_per_gram: number | undefined;
    cost_per_unit: number | undefined;
  } {
    const usablePercentage = 1 - (waste_percent / 100);
    if (usablePercentage <= 0) {
      throw new BadRequestException('Waste percent results in zero or negative usable quantity.');
    }

    let totalQuantity = 0;
    let isMilliliters = false;
    let isGrams = false;
    let isUnits = false;

    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      totalQuantity = unit.toLowerCase().includes('l') ? 1000 : parseFloat(unit); // Convert liters to ml
      isMilliliters = true;
    } else if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      totalQuantity = unit.toLowerCase().includes('kg') ? 1000 : parseFloat(unit); // Convert kg to g
      isGrams = true;
    } else if (unit.toLowerCase().includes('unit')) {
      totalQuantity = parseFloat(unit.replace(/unit/i, '').trim()) || 1; // Default to 1 unit if not specified
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