import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, EntityManager } from 'typeorm';
import { classToPlain } from 'class-transformer';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { IngredientsService } from '../ingredients/ingredients.service';
import { StockService } from '../stock/stock.service';
import { Stock } from '../stock/entities/stock.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductIngredient) private readonly productIngredientRepository: Repository<ProductIngredient>,
    @InjectRepository(Stock) private readonly stockRepository: Repository<Stock>,
    private readonly ingredientsService: IngredientsService,
    @Inject(forwardRef(() => StockService)) private readonly stockService: StockService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    if (!createProductDto.name || !createProductDto.category || createProductDto.sell_price <= 0) {
      throw new BadRequestException('Name, category, and positive sell price are required');
    }

    let totalCost = 0;
    const productIngredients: ProductIngredient[] = [];

    for (const ingredientDto of createProductDto.ingredients || []) {
      if (!ingredientDto.ingredientId || ingredientDto.quantity <= 0 || !ingredientDto.unit) {
        throw new BadRequestException('Each ingredient must have a valid ID, positive quantity, and unit');
      }
      const ingredient = await this.ingredientsService.findOne(ingredientDto.ingredientId);
      if (!ingredient) throw new BadRequestException(`Ingredient ${ingredientDto.ingredientId} not found`);

      const trueCost = this.calculateTrueCost(ingredient, ingredientDto.unit);
      const lineCost = ingredientDto.quantity * trueCost;
      totalCost += lineCost;

      const stock = await this.getAvailableStock(ingredient, ingredientDto.unit, ingredientDto.quantity);
      if (!stock || stock.remaining_quantity <= 0) {
        throw new BadRequestException(`No available stock for ingredient ${ingredientDto.ingredientId} and unit ${ingredientDto.unit}.`);
      }
      const deductionInStockUnit = await this.convertQuantity(ingredientDto.quantity, ingredientDto.unit, stock.unit);
      if (stock.remaining_quantity < deductionInStockUnit) {
        throw new BadRequestException(`Insufficient stock. Required: ${deductionInStockUnit.toFixed(2)} ${stock.unit}, Available: ${stock.remaining_quantity.toFixed(2)} ${stock.unit}`);
      }
      stock.remaining_quantity = Math.max(0, stock.remaining_quantity - deductionInStockUnit);
      await this.updateStock(stock);

      const productIngredient = this.productIngredientRepository.create({
        ingredient,
        quantity: ingredientDto.quantity,
        unit: ingredientDto.unit,
        line_cost: lineCost,
        is_optional: ingredientDto.is_optional || false,
        name: ingredient.name,
        cost_per_unit: trueCost,
      });
      productIngredients.push(productIngredient);
    }

    const product = this.productRepository.create({
      name: createProductDto.name,
      category: createProductDto.category,
      sell_price: createProductDto.sell_price,
      total_cost: totalCost,
      margin_amount: createProductDto.sell_price - totalCost,
      margin_percent: this.calculateCappedMarginPercent(createProductDto.sell_price, totalCost),
      status: this.calculateStatus(createProductDto.sell_price - totalCost),
      ingredients: productIngredients,
    });

    const savedProduct = await this.productRepository.save(product);

    for (const productIngredient of productIngredients) {
      productIngredient.product = savedProduct;
      productIngredient.productId = savedProduct.id;
      await this.productIngredientRepository.save(productIngredient);
    }

    return classToPlain(savedProduct) as Product;
  }

  async createOrUpdateStock(ingredientId: string, createStockDto: { purchased_quantity: number; unit: string; purchase_price: number; waste_percent: number }): Promise<Stock> {
    if (!ingredientId || createStockDto.purchased_quantity <= 0 || !createStockDto.unit || createStockDto.purchase_price < 0 || createStockDto.waste_percent < 0 || createStockDto.waste_percent > 100) {
      throw new BadRequestException('Invalid stock data');
    }

    const ingredient = await this.ingredientsService.findOne(ingredientId);
    if (!ingredient) throw new BadRequestException(`Ingredient ${ingredientId} not found`);

    const existingStocks = await this.stockRepository.find({ where: { ingredient: { id: ingredientId }, remaining_quantity: MoreThan(0) } });
    if (existingStocks.length > 0) {
      const stockToUpdate = existingStocks[0];
      if (this.isCompatibleUnit(stockToUpdate.unit, createStockDto.unit)) {
        const newRemaining = stockToUpdate.remaining_quantity + createStockDto.purchased_quantity * (1 - createStockDto.waste_percent / 100);
        const totalPurchased = stockToUpdate.purchased_quantity + createStockDto.purchased_quantity;
        const totalPurchasedPrice = (stockToUpdate.total_purchased_price || 0) + createStockDto.purchase_price;
        const purchasePricePerUnit = totalPurchasedPrice / totalPurchased;

        stockToUpdate.remaining_quantity = newRemaining;
        stockToUpdate.total_purchased_price = totalPurchasedPrice;
        stockToUpdate.purchase_price_per_unit = purchasePricePerUnit;
        stockToUpdate.waste_percent = createStockDto.waste_percent;
        stockToUpdate.purchased_quantity = totalPurchased;
        await this.stockRepository.save(stockToUpdate);

        await this.updateIngredientCost(ingredientId);
        return stockToUpdate;
      }
    }

    const usableQuantity = createStockDto.purchased_quantity * (1 - createStockDto.waste_percent / 100);
    const purchasePricePerUnit = createStockDto.purchase_price / createStockDto.purchased_quantity;
    const newStock = this.stockRepository.create({
      ingredient: { id: ingredientId },
      purchased_quantity: createStockDto.purchased_quantity,
      unit: createStockDto.unit,
      total_purchased_price: createStockDto.purchase_price,
      purchase_price_per_unit: purchasePricePerUnit,
      waste_percent: createStockDto.waste_percent,
      remaining_quantity: usableQuantity,
      wasted_quantity: 0,
      purchased_at: new Date(),
    });
    const savedStock = await this.stockRepository.save(newStock);

    await this.updateIngredientCost(ingredientId);
    return savedStock;
  }

  async updateIngredientCost(ingredientId: string): Promise<void> {
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredientId } } });
    if (stocks.length === 0) return;

    const totalCost = stocks.reduce((sum: number, stock: Stock) => sum + (stock.purchase_price_per_unit * stock.purchased_quantity), 0);
    const totalQuantity = stocks.reduce((sum: number, stock: Stock) => sum + stock.purchased_quantity, 0);
    const newCostPerUnit = totalCost / totalQuantity;

    const ingredient = await this.ingredientsService.findOne(ingredientId);
    ingredient.cost_per_unit = newCostPerUnit;
    await this.ingredientsService.update(ingredientId, { cost_per_unit: newCostPerUnit });

    const products = await this.productRepository.find({ relations: ['ingredients', 'ingredients.ingredient'] });
    for (const product of products) {
      if (product.ingredients.some((pi: ProductIngredient) => pi.ingredient.id === ingredientId)) {
        let totalCost = 0;
        for (const pi of product.ingredients) {
          const trueCost = this.calculateTrueCost(pi.ingredient, pi.unit);
          totalCost += pi.quantity * trueCost;
        }
        product.total_cost = totalCost;
        product.margin_amount = product.sell_price - totalCost;
        product.margin_percent = this.calculateCappedMarginPercent(product.sell_price, totalCost);
        product.status = this.calculateStatus(product.margin_amount);
        await this.productRepository.save(product);
      }
    }
  }

  async findAll(): Promise<Product[]> {
    console.log('Fetching all products');
    return this.productRepository.find({ relations: ['ingredients', 'ingredients.ingredient'] });
  }

  async findOne(id: string): Promise<Product> {
    console.log('Finding product with ID:', id);
    const product = await this.productRepository.findOne({ where: { id }, relations: ['ingredients', 'ingredients.ingredient'] });
    if (!product) throw new NotFoundException(`Product with ID ${id} not found`);
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (updateProductDto.name) product.name = updateProductDto.name;
    if (updateProductDto.category) product.category = updateProductDto.category;
    if (updateProductDto.sell_price) {
      if (updateProductDto.sell_price <= 0) {
        throw new BadRequestException('Sell price must be positive');
      }
      product.sell_price = updateProductDto.sell_price;
    }

    let totalCost = 0;
    const productIngredients: ProductIngredient[] = [];

    if (updateProductDto.ingredients) {
      await this.entityManager.transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.delete(ProductIngredient, { product: { id } });

        for (const ingredientDto of updateProductDto.ingredients || []) {
          if (!ingredientDto.ingredientId || ingredientDto.quantity <= 0 || !ingredientDto.unit) {
            throw new BadRequestException('Each ingredient must have a valid ID, positive quantity, and unit');
          }
          const ingredient = await this.ingredientsService.findOne(ingredientDto.ingredientId);
          if (!ingredient) throw new BadRequestException(`Ingredient ${ingredientDto.ingredientId} not found`);

          const stockDeduction = ingredientDto.quantity;
          const stock = await this.getAvailableStock(ingredient, ingredientDto.unit, stockDeduction);
          if (!stock) {
            throw new BadRequestException(`Insufficient stock for ingredient ${ingredientDto.ingredientId} after update.`);
          }
          const deductionInStockUnit = await this.convertQuantity(stockDeduction, ingredientDto.unit, stock.unit);
          if (stock.remaining_quantity < deductionInStockUnit) {
            throw new BadRequestException(`Insufficient stock. Required: ${deductionInStockUnit.toFixed(2)} ${stock.unit}, Available: ${stock.remaining_quantity.toFixed(2)} ${stock.unit}`);
          }
          stock.remaining_quantity = Math.max(0, stock.remaining_quantity - deductionInStockUnit);
          await transactionalEntityManager.save(Stock, stock);

          const trueCost = this.calculateTrueCost(ingredient, ingredientDto.unit);
          const lineCost = Number((ingredientDto.quantity * trueCost).toFixed(2));
          totalCost += lineCost;

          const productIngredient = transactionalEntityManager.create(ProductIngredient, {
            product,
            ingredient,
            quantity: ingredientDto.quantity,
            unit: ingredientDto.unit,
            line_cost: lineCost,
            is_optional: ingredientDto.is_optional || false,
            name: ingredient.name,
            cost_per_unit: trueCost,
          });
          productIngredients.push(productIngredient);
        }

        product.ingredients = productIngredients;
        product.total_cost = Number(totalCost.toFixed(2));
      });
    } else {
      let totalCost = 0;
      for (const pi of product.ingredients) {
        const trueCost = this.calculateTrueCost(pi.ingredient, pi.unit);
        totalCost += pi.quantity * trueCost;
      }
      product.total_cost = Number(totalCost.toFixed(2));
    }

    if (product.sell_price <= 0 || product.total_cost < 0) {
      throw new BadRequestException('Invalid sell price or total cost');
    }
    product.margin_amount = Number((product.sell_price - product.total_cost).toFixed(2));
    product.margin_percent = this.calculateCappedMarginPercent(product.sell_price, product.total_cost);
    product.status = this.calculateStatus(product.margin_amount);

    const savedProduct = await this.productRepository.save(product);
    const refreshedProduct = await this.productRepository.findOneOrFail({ where: { id: savedProduct.id }, relations: ['ingredients'] });

    for (const productIngredient of refreshedProduct.ingredients) {
      productIngredient.product = refreshedProduct;
      productIngredient.productId = refreshedProduct.id;
      await this.productIngredientRepository.save(productIngredient);
    }

    return classToPlain(refreshedProduct) as Product;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productIngredientRepository.delete({ product: { id } });
    await this.productRepository.delete(id);
  }

  async whatIf(whatIfDto: WhatIfDto): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    if (!whatIfDto.productIds?.length || whatIfDto.priceAdjustment === undefined) {
      throw new BadRequestException('Product IDs and price adjustment are required');
    }

    const results = [];
    for (const productId of whatIfDto.productIds) {
      const product = await this.findOne(productId).catch(() => null);
      if (!product) continue;

      const sellPrice = Number(product.sell_price);
      const totalCost = Number(product.total_cost);
      const priceAdjustment = Number(whatIfDto.priceAdjustment);
      console.log(`whatIf: Product ${productId} - sell_price=${sellPrice}, total_cost=${totalCost}, priceAdjustment=${priceAdjustment}`);
      const originalMargin = Number((sellPrice - totalCost).toFixed(2));
      const newSellPrice = Number((sellPrice + priceAdjustment).toFixed(2));
      if (newSellPrice <= 0) continue;
      const newMarginAmount = Number((newSellPrice - totalCost).toFixed(2));
      console.log(`whatIf: originalMargin=${originalMargin}, newSellPrice=${newSellPrice}, newMargin=${newMarginAmount}`);
      const newStatus = this.calculateStatus(newMarginAmount);

      results.push({
        productId,
        newMargin: newMarginAmount,
        newStatus,
      });
    }
    return results;
  }

  async milkSwap(milkSwapDto: MilkSwapDto): Promise<{ originalMargin: number; newMargin: number; upchargeCovered: boolean }> {
    if (!milkSwapDto.productId || !milkSwapDto.originalIngredientId || !milkSwapDto.newIngredientId) {
      throw new BadRequestException('Product ID, original ingredient ID, and new ingredient ID are required');
    }

    const product = await this.findOne(milkSwapDto.productId);
    const sellPrice = Number(product.sell_price);
    const originalTotalCost = Number(product.total_cost || 0);
    const originalMarginAmount = Number((sellPrice - originalTotalCost).toFixed(2));
    console.log(`milkSwap: Product ${product.id} - sell_price=${sellPrice}, originalTotalCost=${originalTotalCost}, originalMargin=${originalMarginAmount}`);

    let newTotalCost = 0;
    for (const pi of product.ingredients) {
      let ingredient = pi.ingredient;
      if (pi.ingredient.id === milkSwapDto.originalIngredientId) {
        ingredient = await this.ingredientsService.findOne(milkSwapDto.newIngredientId);
        if (!ingredient) throw new NotFoundException(`Ingredient ${milkSwapDto.newIngredientId} not found`);
      }
      const lineCost = Number(this.calculateLineCost(ingredient, pi.quantity, pi.unit).toFixed(2));
      newTotalCost += lineCost;
      console.log(`milkSwap: Ingredient ${pi.ingredient.id} - quantity=${pi.quantity}, unit=${pi.unit}, lineCost=${lineCost}`);
    }
    newTotalCost = Number(newTotalCost.toFixed(2));

    const upcharge = Number(milkSwapDto.upcharge || 0);
    const adjustedSellPrice = Number((sellPrice + upcharge).toFixed(2));
    const newMarginAmount = Number((adjustedSellPrice - newTotalCost).toFixed(2));
    const upchargeCovered = adjustedSellPrice - newTotalCost >= 0;
    console.log(`milkSwap: newTotalCost=${newTotalCost}, newMargin=${newMarginAmount}, adjustedSellPrice=${adjustedSellPrice}, upchargeCovered=${upchargeCovered}`);

    return {
      originalMargin: originalMarginAmount,
      newMargin: newMarginAmount,
      upchargeCovered,
    };
  }

  async quickAction(id: string, quickActionDto: QuickActionDto): Promise<Product> {
    const product = await this.findOne(id);
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }

    product.sell_price = quickActionDto.new_sell_price;
    product.margin_amount = product.sell_price - (product.total_cost || 0);
    product.margin_percent = this.calculateCappedMarginPercent(product.sell_price, product.total_cost);
    product.status = this.calculateStatus(product.margin_amount);

    return this.productRepository.save(product);
  }

  private calculateLineCost(ingredient: Ingredient, quantity: number, unit: string): number {
    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      return quantity * (ingredient.cost_per_ml || 0);
    }
    if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      return quantity * (ingredient.cost_per_gram || 0);
    }
    return quantity * (ingredient.cost_per_unit || 0);
  }

  private calculateStatus(marginAmount: number): string {
    if (marginAmount > 0) return 'profitable';
    if (marginAmount === 0) return 'breaking even';
    return 'losing money';
  }

  private calculateTrueCost(ingredient: Ingredient, unit: string): number {
    const wastePercent = ingredient.waste_percent || 0;
    if (wastePercent < 0 || wastePercent > 100) {
      throw new BadRequestException('Waste percentage must be between 0 and 100');
    }
    const usablePercentage = 1 - (wastePercent / 100);
    if (usablePercentage <= 0) {
      throw new BadRequestException('Waste percent results in zero or negative usable quantity');
    }

    let baseCost = 0;
    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      baseCost = ingredient.cost_per_ml || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      baseCost = ingredient.cost_per_gram || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else if (unit.toLowerCase().includes('unit')) {
      baseCost = ingredient.cost_per_unit || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else {
      throw new BadRequestException('Unsupported unit. Use ml, L, g, kg, or unit');
    }
  }

  private async getAvailableStock(ingredient: Ingredient, requestedUnit: string, requestedQuantity: number): Promise<Stock> {
    console.log(`Checking stock for ingredient ${ingredient.id}, requested: ${requestedQuantity} ${requestedUnit}`);
    const ingredientWithStocks = await this.ingredientsService.findOne(ingredient.id);
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredient.id } }, order: { purchased_at: 'ASC' } });
    console.log(`Stocks found:`, stocks);
    for (const stock of stocks) {
      console.log(`Evaluating stock ${stock.id}: remaining ${stock.remaining_quantity} ${stock.unit}`);
      if (this.isCompatibleUnit(requestedUnit, stock.unit)) {
        const requestedInStockUnit = await this.convertQuantity(requestedQuantity, requestedUnit, stock.unit);
        console.log(`Converted request: ${requestedQuantity} ${requestedUnit} = ${requestedInStockUnit} ${stock.unit}`);
        if (stock.remaining_quantity <= 0 || isNaN(stock.remaining_quantity)) {
          console.log(`Stock ${stock.id} has no or invalid remaining quantity`);
          continue;
        }
        if (stock.remaining_quantity >= requestedInStockUnit) {
          console.log(`Stock ${stock.id} is sufficient`);
          return stock;
        } else {
          console.log(`Stock ${stock.id} insufficient: ${stock.remaining_quantity} < ${requestedInStockUnit}`);
        }
      } else {
        console.log(`Units ${requestedUnit} and ${stock.unit} are incompatible`);
      }
    }
    console.log(`No suitable stock found for ${ingredient.id}`);
    throw new BadRequestException(`No available stock for ingredient ${ingredient.id} and unit ${requestedUnit}.`);
  }

  private async updateStock(stock: Stock): Promise<Stock> {
    if (stock.remaining_quantity < 0 || isNaN(stock.remaining_quantity)) {
      throw new BadRequestException('Remaining quantity cannot be negative or NaN');
    }
    return this.stockRepository.save(stock);
  }

  async convertQuantity(quantity: any, fromUnit: string, toUnit: string): Promise<number> {
    const numQuantity = typeof quantity === 'number' ? quantity : parseFloat(quantity);
    if (isNaN(numQuantity)) throw new BadRequestException('Invalid quantity value');

    const fromLower = fromUnit.toLowerCase().replace(/s$/, '');
    const toLower = toUnit.toLowerCase().replace(/s$/, '');

    if (fromLower === toLower) return Number(numQuantity.toFixed(2));

    const conversionFactors: { [key: string]: number } = { ml: 1, l: 1000, g: 1, kg: 1000 };
    const fromFactor = conversionFactors[fromLower] || 1;
    const toFactor = conversionFactors[toLower] || 1;

    if (fromLower === 'unit' && toLower === 'unit') return Number(numQuantity.toFixed(2));
    if (fromFactor && toFactor) {
      const converted = (numQuantity * fromFactor) / toFactor;
      return Number(converted.toFixed(2));
    }
    throw new BadRequestException(`Incompatible units: ${fromUnit} and ${toUnit}`);
  }

  public isCompatibleUnit(unit1: string, unit2: string): boolean { // Changed to public
    const u1 = unit1.toLowerCase();
    const u2 = unit2.toLowerCase();
    return u1 === u2 ||
           (u1 === 'l' && u2 === 'ml') || (u1 === 'ml' && u2 === 'l') ||
           (u1 === 'kg' && u2 === 'g') || (u1 === 'g' && u2 === 'kg') ||
           (u1.includes('unit') && u2.includes('unit'));
  }

  private calculateCappedMarginPercent(sellPrice: number, totalCost: number): number {
    if (sellPrice <= 0) return 0;
    const marginPercent = ((sellPrice - totalCost) / sellPrice) * 100;
    return Math.min(Math.max(marginPercent, -999.99), 999.99);
  }

  async getMaxProducibleQuantity(productId: string): Promise<{ maxQuantity: number; stockUpdates: { ingredientId: string; remainingQuantity: number; unit: string }[] }> {
    const product = await this.findOne(productId);
    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
  
    let maxQuantity = Infinity;
    const stockUpdates: { [ingredientId: string]: { remainingQuantity: number; unit: string } } = {};
  
    for (const pi of product.ingredients) {
      const ingredientId = pi.ingredient.id;
      const totalAvailable = await this.stockService.getAvailableStock(ingredientId);
      const neededPerUnit = await this.convertQuantity(pi.quantity, pi.unit, 'L');
      if (neededPerUnit <= 0) throw new BadRequestException(`Invalid quantity for ingredient ${ingredientId}`);
  
      const availableForThisIngredient = totalAvailable / neededPerUnit;
      maxQuantity = Math.min(maxQuantity, Math.floor(availableForThisIngredient));
  
      const currentStock = await this.stockRepository.findOne({ where: { ingredient: { id: ingredientId } }, order: { purchased_at: 'ASC' } });
      if (currentStock) {
        const usedQuantity = maxQuantity * neededPerUnit; // Based on maxQuantity
        const originalRemaining = currentStock.remaining_quantity;
        const remaining = originalRemaining - usedQuantity;
        stockUpdates[ingredientId] = {
          remainingQuantity: Math.max(0, Number(remaining.toFixed(2))), // Ensure non-negative
          unit: currentStock.unit,
        };
      }
    }
  
    if (maxQuantity === Infinity || maxQuantity < 0) maxQuantity = 0;
    return { 
      maxQuantity, 
      stockUpdates: Object.entries(stockUpdates).map(([ingredientId, update]) => ({
        ingredientId,
        ...update
      }))
    };
  }
}