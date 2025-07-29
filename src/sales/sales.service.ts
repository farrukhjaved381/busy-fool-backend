import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, EntityManager } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { ProductIngredient } from '../products/entities/product-ingredient.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StockService } from '../stock/stock.service';
import { Waste } from '../waste/entities/waste.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private salesRepository: Repository<Sale>,
    @InjectRepository(Ingredient) private ingredientsRepository: Repository<Ingredient>,
    @InjectRepository(ProductIngredient) private productIngredientsRepository: Repository<ProductIngredient>,
    @InjectRepository(Purchase) private purchasesRepository: Repository<Purchase>,
    @InjectRepository(Waste) private wasteRepository: Repository<Waste>,
    private productsService: ProductsService,
    private usersService: UsersService,
    private readonly stockService: StockService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createSaleDto: CreateSaleDto, userId: string): Promise<Sale> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');
  
    if (!createSaleDto.productId) {
      throw new BadRequestException('Product ID is required for registered products');
    }
    const product = await this.productsService.findOne(createSaleDto.productId);
    if (!product) throw new NotFoundException(`Product ${createSaleDto.productId} not found`);
  
    if (createSaleDto.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
  
    const sale = await this.entityManager.transaction(async transactionalEntityManager => {
      const totalIngredientQuantities: Record<string, { quantity: number; unit: string }> = {};
      for (const pi of product.ingredients) {
        const ingredientId = pi.ingredient.id;
        const neededQuantity = pi.quantity * createSaleDto.quantity;
        totalIngredientQuantities[ingredientId] = totalIngredientQuantities[ingredientId] || { quantity: 0, unit: pi.unit };
        totalIngredientQuantities[ingredientId].quantity += neededQuantity;
        totalIngredientQuantities[ingredientId].unit = pi.unit;
        console.log(`Ingredient ${ingredientId}: Needed ${neededQuantity} ${pi.unit}, Total ${totalIngredientQuantities[ingredientId].quantity} ${pi.unit}`);
      }
  
      for (const [ingredientId, { quantity: neededQuantity, unit: requestedUnit }] of Object.entries(totalIngredientQuantities)) {
        const totalAvailable = await this.stockService.getAvailableStock(ingredientId);
        const neededInLiters = this.productsService.convertQuantity(neededQuantity, requestedUnit, 'L');
        console.log(`Checking stock for ${ingredientId}: Available ${totalAvailable}L, Needed ${neededInLiters}L`);
        if (totalAvailable < neededInLiters) {
          throw new BadRequestException(`Insufficient stock for ingredient ${ingredientId}. Available: ${totalAvailable.toFixed(2)}L, Needed: ${neededInLiters.toFixed(2)}L`);
        }
  
        let remainingToDeduct = neededQuantity;
        const stocks = await this.stockService.findAllByIngredientId(ingredientId);
        console.log(`Stocks found for ${ingredientId}:`, stocks);
  
        for (const stock of stocks) {
          if (remainingToDeduct <= 0) break;
          const stockRemainingInRequestedUnit = await this.productsService.convertQuantity(stock.remaining_quantity, 'L', requestedUnit);
          const deductAmountInRequestedUnit = Math.min(remainingToDeduct, stockRemainingInRequestedUnit);
          console.log(`Deducting ${deductAmountInRequestedUnit} ${requestedUnit} from stock ${stock.id}, Remaining to deduct ${remainingToDeduct} ${requestedUnit}`);
          stock.remaining_quantity -= this.productsService.convertQuantity(deductAmountInRequestedUnit, requestedUnit, 'L');
          if (stock.remaining_quantity < 0) {
            throw new BadRequestException(`Negative stock quantity detected for ${stock.id}`);
          }
          remainingToDeduct -= deductAmountInRequestedUnit;
          await transactionalEntityManager.save(stock);
          console.log(`Stock ${stock.id} updated to ${stock.remaining_quantity}L`);
        }
        if (remainingToDeduct > 0) {
          throw new BadRequestException(`Failed to deduct full quantity (${remainingToDeduct} ${requestedUnit}) for ingredient ${ingredientId}`);
        }
      }
  
      const sale = this.salesRepository.create({
        product,
        product_name: product.name,
        quantity: createSaleDto.quantity,
        total_amount: product.sell_price * createSaleDto.quantity,
        user,
      });
  
      await transactionalEntityManager.save(sale);
      return sale;
    });
  
    const savedSale = await this.salesRepository.findOne({ where: { id: sale.id }, relations: ['product', 'user'] });
    if (!savedSale) {
      throw new Error('Failed to retrieve saved sale');
    }
    return savedSale;
  }

  async findAll(): Promise<Sale[]> {
    return this.salesRepository.find({ relations: ['product', 'user'] });
  }

  async getDashboard(startDate: Date, endDate: Date) {
    const sales = await this.salesRepository.find({
      where: { sale_date: Between(startDate, endDate) },
      relations: ['product', 'product.ingredients', 'product.ingredients.ingredient'],
    });

    const revenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const costs = sales
      .filter(sale => sale.product)
      .reduce((sum, sale) => sum + (sale.product.total_cost || 0) * sale.quantity, 0);
    const profit = revenue - costs;

    const losingMoney = sales
      .filter(sale => sale.product && sale.product.status === 'losing money')
      .reduce((acc, sale) => {
        const existing = acc.find(item => item.name === sale.product.name);
        if (existing) {
          existing.quantity += sale.quantity;
          existing.loss += sale.quantity * sale.product.margin_amount;
        } else {
          acc.push({
            name: sale.product.name,
            quantity: sale.quantity,
            loss: sale.quantity * sale.product.margin_amount,
          });
        }
        return acc;
      }, [] as { name: string; quantity: number; loss: number }[]);

    const winners = sales
      .filter(sale => sale.product && sale.product.status === 'profitable')
      .reduce((acc, sale) => {
        const existing = acc.find(item => item.name === sale.product.name);
        if (existing) {
          existing.quantity += sale.quantity;
          existing.profit += sale.quantity * sale.product.margin_amount;
        } else {
          acc.push({
            name: sale.product.name,
            quantity: sale.quantity,
            profit: sale.quantity * sale.product.margin_amount,
          });
        }
        return acc;
      }, [] as { name: string; quantity: number; profit: number }[])
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 3);

    const quickWins = losingMoney.map(p => ({
      name: p.name,
      suggestion: `Raise price by £${(Math.abs(p.loss / p.quantity) + 0.50).toFixed(2)}`,
    }));

    return {
      revenue: revenue.toFixed(2),
      costs: costs.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : '0.00',
      losingMoney,
      winners,
      quickWins,
    };
  }

  async getMonthlyRealityCheck(startDate: Date, endDate: Date) {
    const sales = await this.salesRepository.find({
      where: { sale_date: Between(startDate, endDate) },
      relations: ['product', 'product.ingredients', 'product.ingredients.ingredient'],
    });

    const purchases = await this.purchasesRepository.find({
      where: { purchase_date: Between(startDate, endDate) },
      relations: ['ingredient'],
    });

    const wastes = await this.wasteRepository.find({
      where: { wasteDate: Between(startDate, endDate) },
      relations: ['stock', 'stock.ingredient'],
    });

    // Detect missing recipes
    const missingRecipes = sales
      .filter(sale => !sale.product && sale.product_name)
      .reduce((acc, sale) => {
        const existing = acc.find(item => item.name === sale.product_name);
        if (existing) {
          existing.quantity += sale.quantity;
        } else {
          acc.push({
            name: sale.product_name,
            quantity: sale.quantity,
          });
        }
        return acc;
      }, [] as { name: string; quantity: number }[]);

    // Calculate ingredient usage and waste
    const ingredientUsage = sales
      .filter(sale => sale.product)
      .reduce((acc, sale) => {
        sale.product.ingredients.forEach(pi => {
          const ingredient = pi.ingredient;
          const key = ingredient.id;
          if (!acc[key]) {
            acc[key] = {
              name: ingredient.name,
              unit: ingredient.unit,
              used: 0,
              purchased: 0,
              wasted: 0,
            };
          }
          acc[key].used += pi.quantity * sale.quantity;
        });
        return acc;
      }, {} as Record<string, { name: string; unit: string; used: number; purchased: number; wasted: number }>);

    purchases.forEach(purchase => {
      const key = purchase.ingredient.id;
      if (ingredientUsage[key]) {
        ingredientUsage[key].purchased += purchase.quantity;
      } else {
        ingredientUsage[key] = {
          name: purchase.ingredient.name,
          unit: purchase.ingredient.unit,
          used: 0,
          purchased: purchase.quantity,
          wasted: 0,
        };
      }
    });

    wastes.forEach(waste => {
      const key = waste.stock.ingredient.id;
      if (ingredientUsage[key]) {
        ingredientUsage[key].wasted += waste.quantity;
      } else {
        ingredientUsage[key] = {
          name: waste.stock.ingredient.name,
          unit: waste.stock.ingredient.unit,
          used: 0,
          purchased: waste.quantity,
          wasted: waste.quantity,
        };
      }
    });

    const wasteAlerts = Object.values(ingredientUsage)
      .filter(usage => (usage.used + usage.wasted) < usage.purchased * 0.9 || usage.wasted > 0)
      .map(usage => ({
        name: usage.name,
        purchased: usage.purchased.toFixed(2),
        used: usage.used.toFixed(2),
        wasted: usage.wasted.toFixed(2),
        unit: usage.unit,
        suggestion: 'Check for missing recipes, staff usage, or higher waste.',
      }));

    return {
      missingRecipes,
      wasteAlerts,
      suggestions: [
        ...missingRecipes.map(r => `Add recipe for ${r.name} (${r.quantity} sold)`),
        ...wasteAlerts.length > 0 ? ['Review recipes', 'Check staff drink logs', 'Verify waste percentages'] : [],
      ],
    };
  }
}