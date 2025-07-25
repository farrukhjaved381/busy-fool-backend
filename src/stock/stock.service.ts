import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stock } from './entities/stock.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

/**
 * Service to manage stock-related operations.
 */
@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
  ) {}

  /**
   * Creates a new stock batch.
   * @param createStockDto Data for the new stock batch
   * @returns The created stock batch
   * @throws NotFoundException if ingredient is not found
   */
  async create(createStockDto: CreateStockDto): Promise<Stock> {
    const { ingredientId, purchased_quantity, unit, purchase_price, waste_percent } = createStockDto;
    const ingredient = await this.stockRepository.manager.findOne(Ingredient, { where: { id: ingredientId } });
    if (!ingredient) throw new NotFoundException(`Ingredient ${ingredientId} not found`);

    const usablePercentage = 1 - ((waste_percent ?? 0) / 100);
    const remainingQuantity = purchased_quantity * usablePercentage;

    const stock = this.stockRepository.create({
      ingredient,
      purchased_quantity,
      unit,
      purchase_price,
      waste_percent,
      remaining_quantity: remainingQuantity,
      wasted_quantity: 0,
    });
    return this.stockRepository.save(stock);
  }

  /**
   * Retrieves all stock batches.
   * @returns List of all stock batches
   */
  async findAll(): Promise<Stock[]> {
    return this.stockRepository.find({ relations: ['ingredient'] });
  }

  /**
   * Retrieves a stock batch by ID.
   * @param id Stock batch ID
   * @returns The stock batch
   * @throws NotFoundException if stock batch is not found
   */
  async findOne(id: string): Promise<Stock> {
    const stock = await this.stockRepository.findOne({ where: { id }, relations: ['ingredient'] });
    if (!stock) throw new NotFoundException(`Stock batch ${id} not found`);
    return stock;
  }

  /**
   * Updates a stock batch.
   * @param id Stock batch ID
   * @param updateStockDto Updated data
   * @returns The updated stock batch
   * @throws NotFoundException if stock batch is not found
   */
  async update(id: string, updateStockDto: any): Promise<Stock> {
    const stock = await this.findOne(id);
    Object.assign(stock, updateStockDto);
    return this.stockRepository.save(stock);
  }

  /**
   * Deletes a stock batch.
   * @param id Stock batch ID
   * @throws NotFoundException if stock batch is not found
   */
  async remove(id: string): Promise<void> {
    const stock = await this.findOne(id);
    await this.stockRepository.remove(stock);
  }
}