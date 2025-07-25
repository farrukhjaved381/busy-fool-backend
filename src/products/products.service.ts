import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { WhatIfDto } from './dto/what-if.dto';
import { MilkSwapDto } from './dto/milk-swap.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Stock } from '../stock/entities/stock.entity';

/**
 * Service to manage product-related operations including creation, updates, and analytics.
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductIngredient)
    private productIngredientsRepository: Repository<ProductIngredient>,
    private ingredientsService: IngredientsService,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
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

      const productIngredient = this.productIngredientsRepository.create({
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

    const product = this.productsRepository.create({
      name: createProductDto.name,
      category: createProductDto.category,
      sell_price: createProductDto.sell_price,
      total_cost: totalCost,
      margin_amount: createProductDto.sell_price - totalCost,
      margin_percent: createProductDto.sell_price > 0 ? ((createProductDto.sell_price - totalCost) / createProductDto.sell_price) * 100 : 0,
      status: this.calculateStatus(createProductDto.sell_price - totalCost),
      ingredients: productIngredients,
    });

    const savedProduct = await this.productsRepository.save(product);

    // Link product ingredients to the saved product
    for (const productIngredient of productIngredients) {
      productIngredient.product = savedProduct;
      await this.productIngredientsRepository.save(productIngredient);
    }

    return savedProduct;
  }

  /**
   * Retrieves all products with their ingredients.
   * @returns List of products
   */
  async findAll(): Promise<Product[]> {
    console.log('Fetching all products'); // Debug log
    return this.productsRepository.find({ relations: ['ingredients', 'ingredients.ingredient'] });
  }

  /**
   * Retrieves a product by ID with its ingredients.
   * @param id Product ID
   * @returns The product
   * @throws NotFoundException if product is not found
   */
  async findOne(id: string): Promise<Product> {
    console.log('Finding product with ID:', id); // Debug log
    const product = await this.productsRepository.findOne({ where: { id }, relations: ['ingredients', 'ingredients.ingredient'] });
    if (!product) throw new NotFoundException(`Product with ID ${id} not found`);
    return product;
  }

  /**
   * Updates a product and its ingredients.
   * @param id Product ID
   * @param updateProductDto Update data
   * @returns The updated product
   * @throws NotFoundException if product is not found
   * @throws BadRequestException if input is invalid or ingredient not found
   */
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (updateProductDto.name) product.name = updateProductDto.name;
    if (updateProductDto.category) product.category = updateProductDto.category;
    if (updateProductDto.sell_price) product.sell_price = updateProductDto.sell_price;

    if (updateProductDto.ingredients) {
      await this.productIngredientsRepository.delete({ product: { id } });
      let totalCost = 0;
      for (const ingredientDto of updateProductDto.ingredients) {
        if (!ingredientDto.ingredientId || ingredientDto.quantity <= 0 || !ingredientDto.unit) {
          throw new BadRequestException('Each ingredient must have a valid ID, positive quantity, and unit');
        }
        const ingredient = await this.ingredientsService.findOne(ingredientDto.ingredientId);
        if (!ingredient) throw new BadRequestException(`Ingredient ${ingredientDto.ingredientId} not found`);

        const lineCost = this.calculateLineCost(ingredient, ingredientDto.quantity, ingredientDto.unit);
        totalCost += lineCost;

        const productIngredient = this.productIngredientsRepository.create({
          product,
          ingredient,
          quantity: ingredientDto.quantity,
          unit: ingredientDto.unit,
          line_cost: lineCost,
          is_optional: ingredientDto.is_optional || false,
        });
        await this.productIngredientsRepository.save(productIngredient);
      }
      product.total_cost = totalCost;
      product.margin_amount = product.sell_price - totalCost;
      product.margin_percent = product.sell_price > 0 ? (product.margin_amount / product.sell_price) * 100 : 0;
      product.status = this.calculateStatus(product.margin_amount);
    } else {
      product.margin_amount = product.sell_price - product.total_cost;
      product.margin_percent = product.sell_price > 0 ? (product.margin_amount / product.sell_price) * 100 : 0;
      product.status = this.calculateStatus(product.margin_amount);
    }

    return this.productsRepository.save(product);
  }

  /**
   * Deletes a product and its associated ingredients.
   * @param id Product ID
   * @throws NotFoundException if product is not found
   */
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productIngredientsRepository.delete({ product: { id } });
    await this.productsRepository.delete(id);
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
      const newMarginPercent = newSellPrice > 0 ? (newMarginAmount / newSellPrice) * 100 : 0;
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
    const originalMargin = originalTotalCost > 0 ? ((product.sell_price - originalTotalCost) / product.sell_price) * 100 : 0;

    let newTotalCost = 0;
    for (const pi of product.ingredients) {
      let ingredient = pi.ingredient;
      if (pi.ingredient.id === milkSwapDto.originalIngredientId) {
        ingredient = await this.ingredientsService.findOne(milkSwapDto.newIngredientId);
        if (!ingredient) throw new NotFoundException(`Ingredient ${milkSwapDto.newIngredientId} not found`);
      }
      newTotalCost += this.calculateLineCost(ingredient, pi.quantity, pi.unit);
    }

    const newMargin = newTotalCost > 0 ? ((product.sell_price - newTotalCost) / product.sell_price) * 100 : 0;
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
    product.margin_percent = product.sell_price > 0 ? (product.margin_amount / product.sell_price) * 100 : 0;
    product.status = this.calculateStatus(product.margin_amount);

    return this.productsRepository.save(product);
  }

  /**
   * Calculates the cost of an ingredient based on quantity and unit.
   * @param ingredient Ingredient data
   * @param quantity Quantity used
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
    } else if (unit.toLowerCase().includes('g') || unit.toLowerCase().includes('kg')) {
      baseCost = ingredient.cost_per_gram || 0;
    } else if (unit.toLowerCase().includes('unit')) {
      baseCost = ingredient.cost_per_unit || 0;
    } else {
      throw new BadRequestException('Unsupported unit. Use ml, L, g, kg, or unit');
    }
    return baseCost / usablePercentage;
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
    const stocks = await this.stockRepository.find({ where: { ingredient: { id: ingredient.id } } }); // Fetch stocks manually
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

    if (fromLower === toLower) return quantity;

    if (fromLower === 'ml' && toLower === 'l') {
      return quantity / 1000; // ml to L
    } else if (fromLower === 'l' && toLower === 'ml') {
      return quantity * 1000; // L to ml
    } else if (fromLower === 'g' && toLower === 'kg') {
      return quantity / 1000; // g to kg
    } else if (fromLower === 'kg' && toLower === 'g') {
      return quantity * 1000; // kg to g
    } else if (fromLower.includes('unit') && toLower.includes('unit')) {
      return quantity;
    } else {
      throw new BadRequestException(`Incompatible units: ${fromUnit} and ${toUnit}`);
    }
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
}