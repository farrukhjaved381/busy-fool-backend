import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { IngredientsService } from '../ingredients/ingredients.service';
import { StockService } from '../stock/stock.service';
import { Stock } from '../stock/entities/stock.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    private stockService: StockService,
    private ingredientsService: IngredientsService,
    private usersService: UsersService,
  ) {}

  async create(createPurchaseDto: CreatePurchaseDto, userId: string): Promise<Purchase> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const { ingredientId, quantity, unit, purchasePrice } = createPurchaseDto;
    if (quantity <= 0 || purchasePrice < 0) throw new BadRequestException('Invalid quantity or price');

    const ingredient = await this.ingredientsService.findOne(ingredientId);
    if (!ingredient) throw new NotFoundException(`Ingredient ${ingredientId} not found`);

    const totalPurchasedPrice = Number((quantity * purchasePrice).toFixed(2));
    const purchasePricePerUnit = Number((purchasePrice).toFixed(4)); // Maintain precision for per-unit cost
    const wastePercent = ingredient.waste_percent || 0;
    const usablePercentage = 1 - (wastePercent / 100);
    const remainingQuantity = quantity * usablePercentage;

    const purchase = this.purchaseRepository.create({
      ingredient,
      quantity,
      purchasePrice: purchasePricePerUnit, // Store per-unit price
      total_cost: totalPurchasedPrice,
      user,
    });

    const savedPurchase = await this.purchaseRepository.save(purchase);

    // Create or update stock
    const existingStocks = await this.stockService.findAllByIngredientId(ingredientId);
    let stockToUpdate: Stock | undefined;
    for (const stock of existingStocks) {
      if (this.stockService.isCompatibleUnit(unit, stock.unit) && stock.remaining_quantity > 0) {
        stockToUpdate = stock;
        break;
      }
    }

    if (stockToUpdate) {
      const newRemaining = stockToUpdate.remaining_quantity + (quantity * (await this.stockService.convertQuantity(1, unit, stockToUpdate.unit)) * usablePercentage);
      const totalPurchased = stockToUpdate.purchased_quantity + quantity;
      const weightedPricePerUnit = ((stockToUpdate.purchase_price_per_unit * stockToUpdate.purchased_quantity) + (purchasePricePerUnit * quantity)) / totalPurchased;
      const newTotalPurchasedPrice = Number(stockToUpdate.total_purchased_price || 0) + totalPurchasedPrice;

      await this.stockService.update(stockToUpdate.id, {
        remaining_quantity: newRemaining,
        purchased_quantity: totalPurchased,
        purchase_price_per_unit: Number(weightedPricePerUnit.toFixed(4)),
        total_purchased_price: Number(newTotalPurchasedPrice.toFixed(2)),
        waste_percent: wastePercent,
        updated_at: new Date(),
      });
    } else {
      await this.stockService.create({
        ingredient,
        purchased_quantity: quantity,
        unit,
        purchase_price_per_unit: purchasePricePerUnit,
        total_purchased_price: totalPurchasedPrice,
        waste_percent: wastePercent,
        remaining_quantity: remainingQuantity,
        wasted_quantity: 0,
        purchased_at: new Date(),
      });
    }

    return savedPurchase;
  }

  async findAll(): Promise<Purchase[]> {
    return this.purchaseRepository.find({ relations: ['ingredient'] });
  }
}