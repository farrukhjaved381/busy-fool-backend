
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

    // Convert quantity to ingredient's base unit for consistency
    const normalizedQuantity = await this.stockService.convertQuantity(quantity, unit, ingredient.unit);
    const totalPurchasedPrice = Number(purchasePrice.toFixed(2));
    const purchasePricePerUnit = Number((totalPurchasedPrice / normalizedQuantity).toFixed(4)); // Per unit of ingredient's base unit
    const wastePercent = ingredient.waste_percent || 0;
    const usablePercentage = 1 - (wastePercent / 100);
    const remainingQuantity = Number((normalizedQuantity * usablePercentage).toFixed(2));

    const purchase = this.purchaseRepository.create({
      ingredient,
      quantity: normalizedQuantity, // Store in base unit
      purchasePrice: purchasePricePerUnit, // Per unit of base unit
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
      const convertedQuantity = await this.stockService.convertQuantity(quantity, unit, stockToUpdate.unit);
      const newRemaining = Number((Number(stockToUpdate.remaining_quantity) + (convertedQuantity * usablePercentage)).toFixed(2));
      const totalPurchased = Number((Number(stockToUpdate.purchased_quantity) + convertedQuantity).toFixed(2));

      // Recalculate weighted average in base unit
      const existingTotalCost = Number(stockToUpdate.purchase_price_per_unit) * Number(stockToUpdate.purchased_quantity);
      const newTotalCost = totalPurchasedPrice;
      const totalQuantity = Number(stockToUpdate.purchased_quantity) + normalizedQuantity;
      const weightedPricePerUnit = Number(((existingTotalCost + newTotalCost) / totalQuantity).toFixed(4));

      const newTotalPurchasedPrice = Number((Number(stockToUpdate.total_purchased_price || 0) + totalPurchasedPrice).toFixed(2));

      await this.stockService.update(stockToUpdate.id, {
        remaining_quantity: newRemaining,
        purchased_quantity: totalPurchased,
        purchase_price_per_unit: weightedPricePerUnit,
        total_purchased_price: newTotalPurchasedPrice,
        waste_percent: wastePercent,
        updated_at: new Date(),
      });
    } else {
      await this.stockService.create({
        ingredient,
        purchased_quantity: normalizedQuantity,
        unit: ingredient.unit, // Use ingredient's base unit
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
