import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getManager } from 'typeorm';
import { Waste } from './entities/waste.entity';
import { CreateWasteDto } from './dto/create-waste.dto';
import { Stock } from '../stock/entities/stock.entity';
import { StockService } from '../stock/stock.service';

/**
 * Service to manage waste-related operations.
 */
@Injectable()
export class WasteService {
  constructor(
    @InjectRepository(Waste)
    private readonly wasteRepository: Repository<Waste>,
    private readonly stockService: StockService,
  ) {}

  /**
   * Records waste and updates stock levels within a transaction.
   * @param createWasteDto Data for the waste
   * @returns The created waste record
   * @throws NotFoundException if stock is not found
   * @throws BadRequestException if quantity exceeds available stock or is invalid
   */
  async create(createWasteDto: CreateWasteDto): Promise<Waste> {
    const { stockId, quantity, unit, reason } = createWasteDto;

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    // Use transaction to ensure atomicity
    const waste = await getManager().transaction(async transactionalEntityManager => {
      const stock = await transactionalEntityManager.findOne(Stock, { where: { id: stockId }, relations: ['ingredient'] });
      if (!stock) throw new NotFoundException(`Stock ${stockId} not found`);

      const convertedQuantity = await this.stockService.convertQuantity(quantity, unit, stock.unit);
      if (convertedQuantity > stock.remaining_quantity) {
        throw new BadRequestException(
          `Insufficient stock for waste recording. Available: ${stock.remaining_quantity.toFixed(2)} ${stock.unit}, Requested: ${convertedQuantity.toFixed(2)} ${stock.unit}`
        );
      }

      // Update stock
      stock.remaining_quantity -= convertedQuantity;
      stock.wasted_quantity += convertedQuantity;
      await transactionalEntityManager.save(Stock, stock);

      // Create waste record
      const newWaste = transactionalEntityManager.create(Waste, {
        stock: { id: stockId }, // Use stock ID for relation
        quantity: convertedQuantity,
        unit: stock.unit,
        reason,
      });
      return await transactionalEntityManager.save(Waste, newWaste);
    });

    return waste;
  }

  /**
   * Retrieves all waste records.
   * @returns List of all waste records
   */
  async findAll(): Promise<Waste[]> {
    return this.wasteRepository.find({ relations: ['stock', 'stock.ingredient'] });
  }
}