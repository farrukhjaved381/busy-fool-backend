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
  private readonly expectedFields = ['name', 'unit', 'purchase_price', 'waste_percent', 'cost_per_ml', 'cost_per_gram', 'cost_per_unit', 'supplier'];
  private readonly requiredFields = ['name', 'unit'];
  private readonly fieldTypes: { [key: string]: string } = {
    'name': 'string',
    'unit': 'string',
    'purchase_price': 'number',
    'waste_percent': 'number',
    'cost_per_ml': 'number',
    'cost_per_gram': 'number',
    'cost_per_unit': 'number',
    'supplier': 'string'
  };

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

  async validateCsv(file: Express.Multer.File): Promise<any> {
    if (!file || !file.path) throw new BadRequestException('No file uploaded');

    const headers = await new Promise<string[]>((resolve, reject) => {
      const headerRows: string[] = [];
      fs.createReadStream(file.path)
        .pipe(csv.parse({ columns: false, trim: true }))
        .on('data', (row) => {
          if (headerRows.length === 0) headerRows.push(...row);
        })
        .on('end', () => resolve(headerRows))
        .on('error', reject);
    });

    const suggestedMappings: Record<string, string> = {};
    const unmappedColumns: string[] = [];
    const warnings: string[] = [];
    const uniqueWarnings = new Set<string>();

    headers.forEach(header => {
      let bestMatch = header;
      let maxSimilarity = 0;

      for (const field of this.expectedFields) {
        const similarity = this.calculateSimilarity(header, field);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = field;
        }
        if (similarity > 0.5 && this.requiredFields.includes(field) && !uniqueWarnings.has(`Possible match for ${field} in ${header} (${similarity.toFixed(2)})`)) {
          uniqueWarnings.add(`Possible match for ${field} in ${header} (${similarity.toFixed(2)})`);
        }
      }

      if (maxSimilarity > 0.6) {
        suggestedMappings[header] = bestMatch;
      } else {
        unmappedColumns.push(header);
        const typoSuggestions = this.expectedFields
          .filter(f => {
            const dist = this.levenshteinDistance(header.toLowerCase(), f.toLowerCase());
            const tokens1 = header.toLowerCase().split(/[_ ]/).filter(t => t);
            const tokens2 = f.toLowerCase().split(/[_ ]/).filter(t => t);
            const overlap = tokens1.filter(t => tokens2.includes(t)).length;
            return dist <= 3 && overlap > 0;
          })
          .map(f => `Possible typo correction: ${header} → ${f}`);
        if (typoSuggestions.length > 0) warnings.push(...typoSuggestions);
      }
    });

    warnings.push(...uniqueWarnings);

    const sampleMapping: Record<string, string> = {};
    headers.forEach(header => {
      if (suggestedMappings[header]) {
        sampleMapping[header] = suggestedMappings[header];
      } else {
        let bestMatch = 'undefined';
        let maxSimilarity = 0;
        for (const field of this.requiredFields.concat(this.expectedFields.filter(f => !this.requiredFields.includes(f)))) {
          const similarity = this.calculateSimilarity(header, field);
          if (similarity > maxSimilarity && this.isValidMapping(header, field)) {
            maxSimilarity = similarity;
            bestMatch = field;
          }
        }
        sampleMapping[header] = maxSimilarity > 0.5 ? bestMatch : 'undefined';
      }
    });

    const isValid = this.requiredFields.every(field => Object.values(suggestedMappings).includes(field));
    return {
      suggestedMappings,
      unmappedColumns,
      warnings: [...warnings],
      isValid,
      expectedFields: this.expectedFields,
      sampleMapping,
      sampleMappingStringified: JSON.stringify(sampleMapping),  // ✅ Added
      note: 'Map all expected fields, prioritizing required ones (name, unit). Use "undefined" for unmapped fields. Provide a mapping object directly like shown in `sampleMapping` when calling /import-csv.',
    };
    
  }

  private calculateSimilarity(s1: string, s2: string): number {
    const tokens1 = s1.toLowerCase().split(/[_ ]/).filter(t => t);
    const tokens2 = s2.toLowerCase().split(/[_ ]/).filter(t => t);
    let commonTokens = 0;
    const weightMap: { [key: string]: number } = { 'name': 2, 'unit': 2, 'price': 1.5, 'percent': 1.5, 'cost': 1.5, 'supplier': 1.5 };
    const lastTokenWeight = 2;
    tokens1.forEach((token1, index) => {
      tokens2.forEach((token2, j) => {
        if (token1 === token2 || (token1.length > 3 && token2.length > 3 && this.levenshteinDistance(token1, token2) <= 2)) {
          commonTokens += (index === tokens1.length - 1 || j === tokens2.length - 1) ? lastTokenWeight * (weightMap[token1] || 1) : (weightMap[token1] || 1);
        }
      });
    });
    const maxTokens = Math.max(tokens1.reduce((sum, t, i) => sum + ((i === tokens1.length - 1) ? lastTokenWeight : 1) * (weightMap[t] || 1), 0),
                              tokens2.reduce((sum, t, i) => sum + ((i === tokens2.length - 1) ? lastTokenWeight : 1) * (weightMap[t] || 1), 0));
    return maxTokens ? commonTokens / maxTokens : 1.0;
  }

  private isValidMapping(header: string, field: string): boolean {
    const headerTokens = header.toLowerCase().split(/[_ ]/).filter(t => t);
    const fieldType = this.fieldTypes[field];
    if (fieldType === 'number' && !headerTokens.some(t => ['price', 'cost', 'percent'].includes(t))) return false;
    if (fieldType === 'string' && headerTokens.some(t => ['price', 'cost', 'percent'].includes(t))) return false;
    return true;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s2.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[s2.length][s1.length];
  }

  async importCsv(file: Express.Multer.File, mapping?: Record<string, string>, defaultMapping?: Record<string, string>): Promise<any> {
    if (!file || !file.path) throw new BadRequestException('No file uploaded');
    if (!mapping && !defaultMapping) {
      throw new BadRequestException('Mapping object is required to map CSV columns to database fields. See /validate-csv for suggestions.');
    }

    if (!fs.existsSync(file.path)) {
      throw new BadRequestException('Uploaded file not found on server');
    }

    const usedMapping = mapping || defaultMapping!;
    this.logger.log(`Using mapping: ${JSON.stringify(usedMapping)} from ${mapping ? 'user input' : 'default'}`);

    const results: Ingredient[] = [];
    const unmappedColumns: string[] = [];
    let dataRows = 0;
    const errors: string[] = [];
    const processedMappings: Record<string, string> = {};

    // Validate mapping
    this.logger.log(`Validating mapping: ${JSON.stringify(usedMapping)}`);
    const headerSet = new Set(Object.keys(usedMapping));
    const missingRequired = this.requiredFields.filter(f => !Object.values(usedMapping).some(v => v === f));
    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required field mappings: ${missingRequired.join(', ')}`);
    }
    const invalidMappings = Object.entries(usedMapping).filter(([header, field]) => !this.expectedFields.includes(field) && field !== 'undefined');
    if (invalidMappings.length > 0) {
      throw new BadRequestException(`Invalid field mappings: ${invalidMappings.map(([h, f]) => `${h} → ${f}`).join(', ')}`);
    }

    const headers = await new Promise<string[]>((resolve, reject) => {
      const headerRows: string[] = [];
      fs.createReadStream(file.path)
        .pipe(csv.parse({ columns: false, trim: true }))
        .on('data', (row) => {
          if (headerRows.length === 0) headerRows.push(...row);
        })
        .on('end', () => resolve(headerRows))
        .on('error', reject);
    });

    const parser = fs.createReadStream(file.path)
      .pipe(csv.parse({ columns: true, trim: true, skip_empty_lines: true }));
    for await (const row of parser) {
      dataRows++;
      if (dataRows === 1) continue; // Skip header row
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

        headers.forEach((header) => {
          const mappedField = usedMapping[header];
          processedMappings[header] = mappedField || 'undefined';
          const value = row[header];
          if (!mappedField || mappedField === 'undefined') {
            if (!unmappedColumns.includes(header)) unmappedColumns.push(header);
            return;
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
                errors.push(`Row ${dataRows}: Invalid waste_percent: ${value}, using 0`);
                createDto.waste_percent = 0;
              }
              break;
            case 'cost_per_ml':
              createDto.cost_per_ml = parseFloat(value) || undefined;
              if (createDto.cost_per_ml && createDto.cost_per_ml > 1) {
                errors.push(`Row ${dataRows}: Suspicious cost_per_ml: ${value}, using null`);
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
        });

        const ingredient = this.ingredientRepository.create(createDto);
        const savedIngredient = await this.ingredientRepository.save(ingredient);
        results.push(savedIngredient);
      } catch (error) {
        errors.push(`Row ${dataRows}: ${error.message}`);
        this.logger.error(`Error processing row ${dataRows}: ${JSON.stringify(row)}`, error.stack);
      }
    }

    fs.unlinkSync(file.path); // Delete file after import
    this.logger.log(`Import completed: ${results.length} ingredients saved`);
    return {
      importedIngredients: results,
      summary: {
        totalRows: dataRows,
        successfullyImported: results.length,
        errors: errors,
        unmappedColumns: unmappedColumns,
        processedMappings: processedMappings,
        note: mapping ? '' : 'Using default mapping from validate-csv.'
      },
    };
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