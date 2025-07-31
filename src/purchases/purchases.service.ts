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
  
    // Use purchasePrice as total cost directly
    const totalPurchasedPrice = Number(purchasePrice.toFixed(2));
    const purchasePricePerUnit = Number((purchasePrice / quantity).toFixed(4)); // Per unit of purchased quantity
    const wastePercent = ingredient.waste_percent || 0;
    const usablePercentage = 1 - (wastePercent / 100);
    const normalizedQuantity = await this.stockService.convertQuantity(quantity, unit, ingredient.unit);
    const remainingQuantity = Number((normalizedQuantity * usablePercentage).toFixed(2));
  
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
      const convertedQuantity = Number(await this.stockService.convertQuantity(quantity, unit, stockToUpdate.unit));
      if (isNaN(convertedQuantity)) throw new BadRequestException(`Invalid conversion for quantity ${quantity} from ${unit} to ${stockToUpdate.unit}`);
      const newRemaining = Number((Number(stockToUpdate.remaining_quantity) + (convertedQuantity * usablePercentage)).toFixed(2));
      const totalPurchased = Number((Number(stockToUpdate.purchased_quantity) + convertedQuantity).toFixed(2));
      const weightedPricePerUnit = Number((((Number(stockToUpdate.purchase_price_per_unit) || 0) * Number(stockToUpdate.purchased_quantity)) + (purchasePricePerUnit * convertedQuantity / (quantity / normalizedQuantity))).toFixed(4));
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