import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stock } from './entities/stock.entity';
import { IngredientsService } from '../ingredients/ingredients.service';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    private readonly ingredientsService: IngredientsService,
  ) {}

  async findAll(): Promise<Stock[]> {
    return this.stockRepository.find({ relations: ['ingredient'] });
  }

  async findOne(id: string): Promise<Stock> {
    const stock = await this.stockRepository.findOne({ where: { id }, relations: ['ingredient'] });
    if (!stock) throw new NotFoundException(`Stock batch ${id} not found`);
    return stock;
  }

  async findAllByIngredientId(ingredientId: string): Promise<Stock[]> {
    return this.stockRepository.find({ where: { ingredient: { id: ingredientId } }, relations: ['ingredient'], order: { purchased_at: 'ASC' } });
  }

  async convertQuantity(quantity: number, fromUnit: string, toUnit: string): Promise<number> {
    const fromLower = fromUnit.toLowerCase();
    const toLower = toUnit.toLowerCase();

    if (fromLower === toLower) return Number(quantity.toFixed(2));

    const conversionFactors: { [key: string]: number } = { ml: 1, l: 1000, g: 1, kg: 1000 };
    const fromFactor = conversionFactors[fromLower.replace(/s$/, '')] || 1;
    const toFactor = conversionFactors[toLower.replace(/s$/, '')] || 1;

    if (fromLower.includes('unit') && toLower.includes('unit')) return Number(quantity.toFixed(2));
    if (fromFactor && toFactor) {
      const converted = (quantity * fromFactor) / toFactor;
      return Number(converted.toFixed(2));
    }
    throw new BadRequestException(`Incompatible units: ${fromUnit} and ${toUnit}`);
  }

  async getAvailableStock(ingredientId: string): Promise<number> {
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredientId } } });
    return stocks.reduce((sum, stock) => sum + (Number(stock.remaining_quantity) ?? 0), 0); // ⬅ Fix here
  }
  

  isCompatibleUnit(unit1: string, unit2: string): boolean {
    const u1 = unit1.toLowerCase();
    const u2 = unit2.toLowerCase();
    return u1 === u2 || // Same unit (case-insensitive)
           (u1 === 'l' && u2 === 'ml') || (u1 === 'ml' && u2 === 'l') ||
           (u1 === 'kg' && u2 === 'g') || (u1 === 'g' && u2 === 'kg') ||
           (u1.includes('unit') && u2.includes('unit'));
  }

  async update(id: string, updateData: Partial<Stock>): Promise<Stock> {
    const stock = await this.findOne(id);
    Object.assign(stock, updateData);
    return this.stockRepository.save(stock);
  }

  async create(createData: Partial<Stock>): Promise<Stock> {
    const stock = this.stockRepository.create(createData);
    return this.stockRepository.save(stock);
  }
}