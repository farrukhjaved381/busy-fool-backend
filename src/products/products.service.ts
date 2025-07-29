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

  /**
   * Creates a new product with associated ingredients and calculates costs and margins.
   * @param createProductDto Data for the new product
   * @returns The created product
   * @throws BadRequestException if an ingredient is not found or input is invalid
   */
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
      if (!stock) {
        throw new BadRequestException(`No available stock for ingredient ${ingredientDto.ingredientId} and unit ${ingredientDto.unit}.`);
      }
      stock.remaining_quantity -= this.convertQuantity(ingredientDto.quantity, ingredientDto.unit, stock.unit);
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

  /**
   * Creates or updates stock for an ingredient.
   * @param ingredientId ID of the ingredient
   * @param createStockDto Data for the new stock
   * @returns The created or updated stock
   * @throws BadRequestException if input is invalid
   */
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

  /**
   * Updates the cost_per_unit of an ingredient based on weighted average of stock.
   * @param ingredientId ID of the ingredient
   */
  async updateIngredientCost(ingredientId: string): Promise<void> {
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredientId } } });
    if (stocks.length === 0) return;

    const totalCost = stocks.reduce((sum: number, stock: Stock) => sum + (stock.purchase_price_per_unit * stock.purchased_quantity), 0);
    const totalQuantity = stocks.reduce((sum: number, stock: Stock) => sum + stock.purchased_quantity, 0);
    const newCostPerUnit = totalCost / totalQuantity;

    const ingredient = await this.ingredientsService.findOne(ingredientId);
    ingredient.cost_per_unit = newCostPerUnit;
    await this.ingredientsService.update(ingredientId, { cost_per_unit: newCostPerUnit });

    // Recalculate affected products
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

  /**
   * Retrieves all products with their ingredients.
   * @returns List of products
   */
  async findAll(): Promise<Product[]> {
    console.log('Fetching all products'); // Debug log
    return this.productRepository.find({ relations: ['ingredients', 'ingredients.ingredient'] });
  }

  /**
   * Retrieves a product by ID with its ingredients.
   * @param id Product ID
   * @returns The product
   * @throws NotFoundException if product is not found
   */
  async findOne(id: string): Promise<Product> {
    console.log('Finding product with ID:', id); // Debug log
    const product = await this.productRepository.findOne({ where: { id }, relations: ['ingredients', 'ingredients.ingredient'] });
    if (!product) throw new NotFoundException(`Product with ID ${id} not found`);
    return product;
  }

  /**
   * Updates a product and its ingredients with margin recalculation.
   * @param id Product ID
   * @param updateProductDto Update data
   * @returns The updated product
   * @throws NotFoundException if product is not found
   * @throws BadRequestException if input is invalid or ingredient not found
   */
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    // Update basic fields
    if (updateProductDto.name) product.name = updateProductDto.name;
    if (updateProductDto.category) product.category = updateProductDto.category;
    if (updateProductDto.sell_price) {
      if (updateProductDto.sell_price <= 0) {
        throw new BadRequestException('Sell price must be positive');
      }
      product.sell_price = updateProductDto.sell_price;
    }

    // Handle ingredient updates within a transaction
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
          const deductionInStockUnit = this.convertQuantity(stockDeduction, ingredientDto.unit, stock.unit);
          if (stock.remaining_quantity < deductionInStockUnit) {
            throw new BadRequestException(`Insufficient stock. Required: ${deductionInStockUnit.toFixed(2)} ${stock.unit}, Available: ${stock.remaining_quantity.toFixed(2)} ${stock.unit}`);
          }
          stock.remaining_quantity -= deductionInStockUnit;
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
      // Recalculate total_cost if ingredients are not updated but sell_price is
      let totalCost = 0;
      for (const pi of product.ingredients) {
        const trueCost = this.calculateTrueCost(pi.ingredient, pi.unit);
        totalCost += pi.quantity * trueCost;
      }
      product.total_cost = Number(totalCost.toFixed(2));
    }

    // Recalculate margins and status with the latest values
    if (product.sell_price <= 0 || product.total_cost < 0) {
      throw new BadRequestException('Invalid sell price or total cost');
    }
    product.margin_amount = Number((product.sell_price - product.total_cost).toFixed(2));
    product.margin_percent = this.calculateCappedMarginPercent(product.sell_price, product.total_cost);
    product.status = this.calculateStatus(product.margin_amount);

    // Save the product and refresh the entity
    const savedProduct = await this.productRepository.save(product);
    const refreshedProduct = await this.productRepository.findOneOrFail({ where: { id: savedProduct.id }, relations: ['ingredients'] });

    // Update ingredients with the refreshed product reference
    for (const productIngredient of refreshedProduct.ingredients) {
      productIngredient.product = refreshedProduct;
      productIngredient.productId = refreshedProduct.id;
      await this.productIngredientRepository.save(productIngredient);
    }

    return classToPlain(refreshedProduct) as Product;
  }

  /**
   * Deletes a product and its associated ingredients.
   * @param id Product ID
   * @throws NotFoundException if product is not found
   */
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productIngredientRepository.delete({ product: { id } });
    await this.productRepository.delete(id);
  }

  /**
   * Simulates the impact of price changes on multiple products.
   * @param whatIfDto Price adjustment data
   * @returns Array of impact results
   */
  async whatIf(whatIfDto: WhatIfDto): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    if (!whatIfDto.productIds?.length || whatIfDto.priceAdjustment === undefined) {
      throw new BadRequestException('Product IDs and price adjustment are required');
    }

    const results = [];
    for (const productId of whatIfDto.productIds) {
      const product = await this.findOne(productId).catch(() => null);
      if (!product) continue;

      const newSellPrice = product.sell_price + whatIfDto.priceAdjustment;
      const newMarginAmount = newSellPrice - product.total_cost;
      const newMarginPercent = this.calculateCappedMarginPercent(newSellPrice, product.total_cost);
      const newStatus = this.calculateStatus(newMarginAmount);

      results.push({
        productId,
        newMargin: parseFloat(newMarginPercent.toFixed(2)),
        newStatus,
      });
    }
    return results;
  }

  /**
   * Calculates the margin impact of swapping an ingredient.
   * @param milkSwapDto Swap data
   * @returns Margin impact details
   * @throws NotFoundException if product or ingredient is not found
   * @throws BadRequestException if input is invalid
   */
  async milkSwap(milkSwapDto: MilkSwapDto): Promise<{ originalMargin: number; newMargin: number; upchargeCovered: boolean }> {
    if (!milkSwapDto.productId || !milkSwapDto.originalIngredientId || !milkSwapDto.newIngredientId) {
      throw new BadRequestException('Product ID, original ingredient ID, and new ingredient ID are required');
    }

    const product = await this.findOne(milkSwapDto.productId);
    const originalTotalCost = product.total_cost || 0;
    const originalMargin = this.calculateCappedMarginPercent(product.sell_price, originalTotalCost);

    let newTotalCost = 0;
    for (const pi of product.ingredients) {
      let ingredient = pi.ingredient;
      if (pi.ingredient.id === milkSwapDto.originalIngredientId) {
        ingredient = await this.ingredientsService.findOne(milkSwapDto.newIngredientId);
        if (!ingredient) throw new NotFoundException(`Ingredient ${milkSwapDto.newIngredientId} not found`);
      }
      newTotalCost += this.calculateLineCost(ingredient, pi.quantity, pi.unit);
    }

    const newMargin = this.calculateCappedMarginPercent(product.sell_price, newTotalCost);
    const upchargeCovered = milkSwapDto.upcharge 
      ? (product.sell_price + milkSwapDto.upcharge - newTotalCost) >= 0 
      : newMargin >= 0;

    return {
      originalMargin: parseFloat(originalMargin.toFixed(2)),
      newMargin: parseFloat(newMargin.toFixed(2)),
      upchargeCovered,
    };
  }

  /**
   * Applies a quick action (e.g., price change) to a product.
   * @param id Product ID
   * @param quickActionDto Action data
   * @returns Updated product
   * @throws NotFoundException if product is not found
   * @throws BadRequestException if new sell price is invalid
   */
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

  /**
   * Calculates the cost of an ingredient based on quantity and unit.
   * @param ingredient Ingredient data
   * @param quantity Quantity requested
   * @param unit Unit of measurement
   * @returns Line cost
   */
  private calculateLineCost(ingredient: Ingredient, quantity: number, unit: string): number {
    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      return quantity * (ingredient.cost_per_ml || 0);
    }
    if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      return quantity * (ingredient.cost_per_gram || 0);
    }
    return quantity * (ingredient.cost_per_unit || 0);
  }

  /**
   * Determines the financial status based on margin amount.
   * @param marginAmount Margin amount
   * @returns Status string
   */
  private calculateStatus(marginAmount: number): string {
    if (marginAmount > 0) return 'profitable';
    if (marginAmount === 0) return 'breaking even';
    return 'losing money';
  }

  /**
   * Calculates the true cost of an ingredient adjusted for waste, considering quantity and unit.
   * @param ingredient Ingredient data
   * @param unit Unit of measurement
   * @returns True cost per unit
   */
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
      return Number((baseCost / usablePercentage).toFixed(6)); // Cost per ml adjusted for waste
    } else if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      baseCost = ingredient.cost_per_gram || 0;
      return Number((baseCost / usablePercentage).toFixed(6)); // Cost per gram adjusted for waste
    } else if (unit.toLowerCase().includes('unit')) {
      baseCost = ingredient.cost_per_unit || 0;
      return Number((baseCost / usablePercentage).toFixed(6)); // Cost per unit adjusted for waste
    } else {
      throw new BadRequestException('Unsupported unit. Use ml, L, g, kg, or unit');
    }
  }

  /**
   * Retrieves the latest available stock batch for an ingredient with unit conversion.
   * @param ingredient Ingredient data
   * @param requestedUnit Unit requested by the product
   * @param requestedQuantity Quantity requested
   * @returns The stock batch with sufficient remaining quantity
   * @throws NotFoundException if no suitable stock is found
   */
  private async getAvailableStock(ingredient: Ingredient, requestedUnit: string, requestedQuantity: number): Promise<Stock> {
    console.log(`Checking stock for ingredient ${ingredient.id}, requested: ${requestedQuantity} ${requestedUnit}`);
    const ingredientWithStocks = await this.ingredientsService.findOne(ingredient.id); // Fetch ingredient
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredient.id } }, order: { purchased_at: 'ASC' } }); // Fetch stocks, oldest first
    console.log(`Stocks found:`, stocks);
    for (const stock of stocks) {
      console.log(`Evaluating stock ${stock.id}: remaining ${stock.remaining_quantity} ${stock.unit}`);
      if (this.isCompatibleUnit(requestedUnit, stock.unit)) {
        const requestedInStockUnit = this.convertQuantity(requestedQuantity, requestedUnit, stock.unit);
        console.log(`Converted request: ${requestedQuantity} ${requestedUnit} = ${requestedInStockUnit} ${stock.unit}`);
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
    throw new BadRequestException('No available stock for this ingredient and unit.');
  }

  /**
   * Updates a stock batch with new remaining quantity.
   * @param stock Stock batch to update
   * @returns Updated stock
   */
  private async updateStock(stock: Stock): Promise<Stock> {
    if (stock.remaining_quantity < 0) {
      throw new BadRequestException('Remaining quantity cannot be negative');
    }
    return this.stockRepository.save(stock);
  }

  /**
   * Converts a quantity between compatible units.
   * @param quantity Quantity to convert
   * @param fromUnit Source unit
   * @param toUnit Target unit
   * @returns Converted quantity
   * @throws BadRequestException if units are incompatible
   */
  private convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
    const fromLower = fromUnit.toLowerCase();
    const toLower = toUnit.toLowerCase();

    if (fromLower === toLower) return Number(quantity.toFixed(2));

    const conversionFactors: { [key: string]: number } = {
      ml: 1,
      l: 1000,
      g: 1,
      kg: 1000,
    };
    const fromFactor = conversionFactors[fromLower.replace(/s$/, '')] || 1;
    const toFactor = conversionFactors[toLower.replace(/s$/, '')] || 1;

    if (fromLower.includes('unit') && toLower.includes('unit')) return Number(quantity.toFixed(2));
    if (fromFactor && toFactor) {
      const converted = (quantity * fromFactor) / toFactor;
      return Number(converted.toFixed(2));
    }
    throw new BadRequestException(`Incompatible units: ${fromUnit} and ${toUnit}`);
  }

  /**
   * Checks if two units are compatible for conversion.
   * @param unit1 First unit
   * @param unit2 Second unit
   * @returns Boolean indicating compatibility
   */
  private isCompatibleUnit(unit1: string, unit2: string): boolean {
    const u1 = unit1.toLowerCase();
    const u2 = unit2.toLowerCase();
    return u1 === u2 || // Same unit (case-insensitive)
           (u1 === 'l' && u2 === 'ml') || (u1 === 'ml' && u2 === 'l') ||
           (u1 === 'kg' && u2 === 'g') || (u1 === 'g' && u2 === 'kg') ||
           (u1.includes('unit') && u2.includes('unit'));
  }

  /**
   * Calculates margin percent with a cap to prevent numeric overflow.
   * @param sellPrice Sell price of the product
   * @param totalCost Total cost of ingredients
   * @returns Capped margin percent
   */
  private calculateCappedMarginPercent(sellPrice: number, totalCost: number): number {
    if (sellPrice <= 0) return 0; // Avoid division by zero
    const marginPercent = ((sellPrice - totalCost) / sellPrice) * 100;
    return Math.min(Math.max(marginPercent, -999.99), 999.99); // Cap to fit NUMERIC(5,2)
  }
}