import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
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
import { UsersService } from '../users/users.service'; // Import UsersService
import { Sale } from '../sales/entities/sale.entity';
import { UrlService } from '../common/url.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductIngredient)
    private readonly productIngredientRepository: Repository<ProductIngredient>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(Sale) private readonly salesRepository: Repository<Sale>,
    private readonly ingredientsService: IngredientsService,
    @Inject(forwardRef(() => StockService))
    private readonly stockService: StockService,
    private readonly entityManager: EntityManager,
    private readonly usersService: UsersService, // Inject UsersService
    private readonly urlService: UrlService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    userId: string,
    image?: Express.Multer.File,
  ): Promise<Product> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (
      !createProductDto.name ||
      !createProductDto.category ||
      createProductDto.sell_price <= 0
    ) {
      throw new BadRequestException(
        'Name, category, and positive sell price are required',
      );
    }

    let totalCost = 0;
    const productIngredients: ProductIngredient[] = [];

    for (const ingredientDto of createProductDto.ingredients || []) {
      if (
        !ingredientDto.ingredientId ||
        ingredientDto.quantity <= 0 ||
        !ingredientDto.unit
      ) {
        throw new BadRequestException(
          'Each ingredient must have a valid ID, positive quantity, and unit',
        );
      }
      const ingredient = await this.ingredientsService.findOne(
        ingredientDto.ingredientId,
        userId,
      );
      if (!ingredient)
        throw new BadRequestException(
          `Ingredient ${ingredientDto.ingredientId} not found`,
        );

      const trueCost = this.calculateTrueCost(ingredient, ingredientDto.unit);
      const lineCost = ingredientDto.quantity * trueCost;
      totalCost += lineCost;

      // Deduct stock from batches
      await this.deductStockFromBatches(
        ingredientDto.ingredientId,
        ingredientDto.quantity,
        ingredientDto.unit,
        userId,
      );

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
      margin_percent: this.calculateCappedMarginPercent(
        createProductDto.sell_price,
        totalCost,
      ),
      status: this.calculateStatus(createProductDto.sell_price - totalCost),
      ingredients: productIngredients,
      user: user,
      image: image ? this.urlService.getProductImageUrl(image.filename) : undefined,
    });

    const savedProduct = await this.productRepository.save(product);

    return classToPlain(savedProduct) as Product;
  }

  async createOrUpdateStock(
    ingredientId: string,
    createStockDto: {
      purchased_quantity: number;
      unit: string;
      purchase_price: number;
      waste_percent: number;
    },
    userId: string,
  ): Promise<Stock> {
    if (
      !ingredientId ||
      createStockDto.purchased_quantity <= 0 ||
      !createStockDto.unit ||
      createStockDto.purchase_price < 0 ||
      createStockDto.waste_percent < 0 ||
      createStockDto.waste_percent > 100
    ) {
      throw new BadRequestException('Invalid stock data');
    }

    const ingredient = await this.ingredientsService.findOne(
      ingredientId,
      userId,
    );
    if (!ingredient)
      throw new BadRequestException(`Ingredient ${ingredientId} not found`);

    const existingStocks = await this.stockRepository.find({
      where: {
        ingredient: { id: ingredientId },
        user: { id: userId },
        remaining_quantity: MoreThan(0),
      },
    });
    if (existingStocks.length > 0) {
      const stockToUpdate = existingStocks[0];
      if (this.isCompatibleUnit(stockToUpdate.unit, createStockDto.unit)) {
        const newRemaining =
          stockToUpdate.remaining_quantity +
          createStockDto.purchased_quantity *
            (1 - createStockDto.waste_percent / 100);
        const totalPurchased =
          stockToUpdate.purchased_quantity + createStockDto.purchased_quantity;
        const totalPurchasedPrice =
          (stockToUpdate.total_purchased_price || 0) +
          createStockDto.purchase_price;
        const purchasePricePerUnit = totalPurchasedPrice / totalPurchased;

        stockToUpdate.remaining_quantity = newRemaining;
        stockToUpdate.total_purchased_price = totalPurchasedPrice;
        stockToUpdate.purchase_price_per_unit = purchasePricePerUnit;
        stockToUpdate.waste_percent = createStockDto.waste_percent;
        stockToUpdate.purchased_quantity = totalPurchased;
        await this.stockRepository.save(stockToUpdate);

        await this.updateIngredientCost(ingredientId, userId);
        return stockToUpdate;
      }
    }

    const usableQuantity =
      createStockDto.purchased_quantity *
      (1 - createStockDto.waste_percent / 100);
    const purchasePricePerUnit =
      createStockDto.purchase_price / createStockDto.purchased_quantity;
    const newStock = this.stockRepository.create({
      ingredient: { id: ingredientId },
      user: { id: userId },
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

    await this.updateIngredientCost(ingredientId, userId);
    return savedStock;
  }

  async updateIngredientCost(
    ingredientId: string,
    userId: string,
  ): Promise<void> {
    const stocks = await this.stockRepository.find({
      where: { ingredient: { id: ingredientId } },
    });
    if (stocks.length === 0) return;

    const totalCost = stocks.reduce(
      (sum: number, stock: Stock) =>
        sum + stock.purchase_price_per_unit * stock.purchased_quantity,
      0,
    );
    const totalQuantity = stocks.reduce(
      (sum: number, stock: Stock) => sum + stock.purchased_quantity,
      0,
    );
    const newCostPerUnit = totalCost / totalQuantity;

    const ingredient = await this.ingredientsService.findOne(
      ingredientId,
      userId,
    );
    ingredient.cost_per_unit = newCostPerUnit;
    await this.ingredientsService.update(
      ingredientId,
      { cost_per_unit: newCostPerUnit },
      userId,
    );

    const products = await this.productRepository.find({
      relations: ['ingredients', 'ingredients.ingredient'],
    });
    for (const product of products) {
      if (
        product.ingredients.some(
          (pi: ProductIngredient) => pi.ingredient.id === ingredientId,
        )
      ) {
        let totalCost = 0;
        for (const pi of product.ingredients) {
          const trueCost = this.calculateTrueCost(pi.ingredient, pi.unit);
          totalCost += pi.quantity * trueCost;
        }
        product.total_cost = totalCost;
        product.margin_amount = product.sell_price - totalCost;
        product.margin_percent = this.calculateCappedMarginPercent(
          product.sell_price,
          totalCost,
        );
        product.status = this.calculateStatus(product.margin_amount);
        await this.productRepository.save(product);
      }
    }
  }

  async findAll(userId: string): Promise<Product[]> {
    // Modified to accept userId
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.ingredients', 'productIngredient')
      .leftJoinAndSelect('productIngredient.ingredient', 'ingredient')
      .where('product.user.id = :userId', { userId })
      .getMany();
    
    // Convert filenames to full URLs if they're just filenames
    products.forEach(product => {
      if (product.image && !product.image.startsWith('http')) {
        product.image = this.urlService.getProductImageUrl(product.image);
      }
    });
    
    return products;
  }

  async findAllByUser(userId: string): Promise<Product[]> {
    return this.findAll(userId); // Re-use the modified findAll
  }

  async findOne(id: string, userId: string): Promise<Product> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.ingredients', 'productIngredient')
      .leftJoinAndSelect('productIngredient.ingredient', 'ingredient')
      .where('product.id = :id', { id })
      .andWhere('product.user.id = :userId', { userId })
      .getOne();
    if (!product)
      throw new NotFoundException(
        `Product with ID ${id} not found for this user`,
      );
    return product;
  }

  async findByName(name: string, userId: string): Promise<Product | null> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.ingredients', 'productIngredient')
      .leftJoinAndSelect('productIngredient.ingredient', 'ingredient')
      .where('product.name = :name', { name })
      .andWhere('product.user.id = :userId', { userId })
      .getOne();
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
    image?: Express.Multer.File,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID ${id} not found for this user`,
      );
    }

    if (updateProductDto.name) product.name = updateProductDto.name;
    if (updateProductDto.category) product.category = updateProductDto.category;
    if (updateProductDto.sell_price) {
      if (updateProductDto.sell_price <= 0) {
        throw new BadRequestException('Sell price must be positive');
      }
      product.sell_price = updateProductDto.sell_price;
    }

    // Handle image update
    if (image) {
      // Delete old image if exists
      if (product.image) {
        const oldFilename = product.image.split('/').pop();
        if (oldFilename) {
          await this.deleteImageFile(oldFilename);
        }
      }
      product.image = this.urlService.getProductImageUrl(image.filename);
    }

    let totalCost = 0;
    const productIngredients: ProductIngredient[] = [];

    // Store old ingredients for delta calculation
    const oldProduct = await this.productRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['ingredients', 'ingredients.ingredient'], // Ensure ingredient details are loaded
    });

    const oldIngredientsMap = new Map<string, { quantity: number; unit: string }>();
    if (oldProduct && oldProduct.ingredients) {
      for (const pi of oldProduct.ingredients) {
        oldIngredientsMap.set(pi.ingredient.id, { quantity: pi.quantity, unit: pi.unit });
      }
    }

    if (updateProductDto.ingredients) {
      await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          const newIngredientsMap = new Map<string, { ingredientId: string; quantity: number; unit: string }>();
          for (const ingredientDto of updateProductDto.ingredients || []) {
            newIngredientsMap.set(ingredientDto.ingredientId, { ingredientId: ingredientDto.ingredientId, quantity: ingredientDto.quantity, unit: ingredientDto.unit });
          }

          // Calculate deltas and adjust stock
          const allIngredientIds = new Set([...oldIngredientsMap.keys(), ...newIngredientsMap.keys()]);

          for (const ingredientId of allIngredientIds) {
            const oldIngredient = oldIngredientsMap.get(ingredientId);
            const newIngredient = newIngredientsMap.get(ingredientId);

            let quantityDelta = 0;
            let unitToUse = '';

            if (oldIngredient && newIngredient) {
              // Ingredient exists in both old and new, calculate difference
              quantityDelta = newIngredient.quantity - oldIngredient.quantity;
              unitToUse = newIngredient.unit; // Use new unit for delta
            } else if (newIngredient) {
              // Ingredient is new, full deduction
              quantityDelta = newIngredient.quantity;
              unitToUse = newIngredient.unit;
            } else if (oldIngredient) {
              // Ingredient removed, full refund
              quantityDelta = -oldIngredient.quantity;
              unitToUse = oldIngredient.unit;
            }

            if (quantityDelta !== 0) {
              await this.adjustStock(
                ingredientId,
                quantityDelta,
                unitToUse,
                userId,
                transactionalEntityManager,
              );
            }
          }

          // Delete old product ingredients
          await transactionalEntityManager.delete(ProductIngredient, {
            product: { id },
          });

          // Create new product ingredients
          for (const ingredientDto of updateProductDto.ingredients || []) {
            const ingredient = await this.ingredientsService.findOne(
              ingredientDto.ingredientId,
              userId,
            );
            if (!ingredient)
              throw new BadRequestException(
                `Ingredient ${ingredientDto.ingredientId} not found`,
              );

            const trueCost = this.calculateTrueCost(
              ingredient,
              ingredientDto.unit,
            );
            const lineCost = Number(
              (ingredientDto.quantity * trueCost).toFixed(2),
            );
            totalCost += lineCost;

            const productIngredient = transactionalEntityManager.create(
              ProductIngredient,
              {
                product,
                ingredient,
                quantity: ingredientDto.quantity,
                unit: ingredientDto.unit,
                line_cost: lineCost,
                is_optional: ingredientDto.is_optional || false,
                name: ingredient.name,
                cost_per_unit: trueCost,
              },
            );
            productIngredients.push(productIngredient);
          }

          product.ingredients = productIngredients;
          product.total_cost = Number(totalCost.toFixed(2));
        },
      );
    } else {
      // If no ingredients are provided in updateProductDto, recalculate totalCost based on existing ingredients
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
    product.margin_amount = Number(
      (product.sell_price - product.total_cost).toFixed(2),
    );
    product.margin_percent = this.calculateCappedMarginPercent(
      product.sell_price,
      product.total_cost,
    );
    product.status = this.calculateStatus(product.margin_amount);

    const savedProduct = await this.productRepository.save(product);
    const refreshedProduct = await this.productRepository.findOneOrFail({
      where: { id: savedProduct.id },
      relations: ['ingredients'],
    });

    for (const productIngredient of refreshedProduct.ingredients) {
      productIngredient.product = refreshedProduct;
      productIngredient.productId = refreshedProduct.id;
      await this.productIngredientRepository.save(productIngredient);
    }

    return classToPlain(refreshedProduct) as Product;
  }

  private async deleteImageFile(filename: string): Promise<void> {
    try {
      const uploadDir = process.env.VERCEL ? join(require('os').tmpdir(), 'products') : join(process.cwd(), 'uploads', 'products');
      const filePath = join(uploadDir, filename);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting image file:', error);
      // Don't throw error as this is cleanup operation
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID ${id} not found for this user`,
      );
    }
    await this.productIngredientRepository.delete({ product: { id } });
    await this.productRepository.delete(id);
  }

  async whatIf(
    whatIfDto: WhatIfDto,
    userId: string,
  ): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    if (
      !whatIfDto.productIds?.length ||
      whatIfDto.priceAdjustment === undefined
    ) {
      throw new BadRequestException(
        'Product IDs and price adjustment are required',
      );
    }

    const results = [];
    for (const productId of whatIfDto.productIds) {
      const product = await this.findOne(productId, userId).catch(() => null); // Pass userId
      if (!product) continue;

      const sellPrice = Number(product.sell_price);
      const totalCost = Number(product.total_cost);
      const priceAdjustment = Number(whatIfDto.priceAdjustment);
      console.log(
        `whatIf: Product ${productId} - sell_price=${sellPrice}, total_cost=${totalCost}, priceAdjustment=${priceAdjustment}`,
      );
      const originalMargin = Number((sellPrice - totalCost).toFixed(2));
      const newSellPrice = Number((sellPrice + priceAdjustment).toFixed(2));
      if (newSellPrice <= 0) continue;
      const newMarginAmount = Number((newSellPrice - totalCost).toFixed(2));
      console.log(
        `whatIf: originalMargin=${originalMargin}, newSellPrice=${newSellPrice}, newMargin=${newMarginAmount}`,
      );
      const newStatus = this.calculateStatus(newMarginAmount);

      results.push({
        productId,
        newMargin: newMarginAmount,
        newStatus,
      });
    }
    return results;
  }

  async milkSwap(
    milkSwapDto: MilkSwapDto,
    userId: string,
  ): Promise<{
    originalMargin: number;
    newMargin: number;
    upchargeCovered: boolean;
  }> {
    if (
      !milkSwapDto.productId ||
      !milkSwapDto.originalIngredientId ||
      !milkSwapDto.newIngredientId
    ) {
      throw new BadRequestException(
        'Product ID, original ingredient ID, and new ingredient ID are required',
      );
    }

    const product = await this.findOne(milkSwapDto.productId, userId); // Pass userId
    const sellPrice = Number(product.sell_price);
    const originalTotalCost = Number(product.total_cost || 0);
    const originalMarginAmount = Number(
      (sellPrice - originalTotalCost).toFixed(2),
    );
    console.log(
      `milkSwap: Product ${product.id} - sell_price=${sellPrice}, originalTotalCost=${originalTotalCost}, originalMargin=${originalMarginAmount}`,
    );

    let newTotalCost = 0;
    for (const pi of product.ingredients) {
      let ingredient = pi.ingredient;
      if (pi.ingredient.id === milkSwapDto.originalIngredientId) {
        ingredient = await this.ingredientsService.findOne(
          milkSwapDto.newIngredientId,
          userId,
        );
        if (!ingredient)
          throw new NotFoundException(
            `Ingredient ${milkSwapDto.newIngredientId} not found`,
          );
      }
      const lineCost = Number(
        this.calculateLineCost(ingredient, pi.quantity, pi.unit).toFixed(2),
      );
      newTotalCost += lineCost;
      console.log(
        `milkSwap: Ingredient ${pi.ingredient.id} - quantity=${pi.quantity}, unit=${pi.unit}, lineCost=${lineCost}`,
      );
    }
    newTotalCost = Number(newTotalCost.toFixed(2));

    const upcharge = Number(milkSwapDto.upcharge || 0);
    const adjustedSellPrice = Number((sellPrice + upcharge).toFixed(2));
    const newMarginAmount = Number(
      (adjustedSellPrice - newTotalCost).toFixed(2),
    );
    const upchargeCovered = adjustedSellPrice - newTotalCost >= 0;
    console.log(
      `milkSwap: newTotalCost=${newTotalCost}, newMargin=${newMarginAmount}, adjustedSellPrice=${adjustedSellPrice}, upchargeCovered=${upchargeCovered}`,
    );

    return {
      originalMargin: originalMarginAmount,
      newMargin: newMarginAmount,
      upchargeCovered,
    };
  }

  async quickAction(
    id: string,
    quickActionDto: QuickActionDto,
    userId: string,
  ): Promise<Product> {
    const product = await this.findOne(id, userId); // Pass userId
    if (quickActionDto.new_sell_price <= 0) {
      throw new BadRequestException('New sell price must be positive');
    }

    product.sell_price = quickActionDto.new_sell_price;
    product.margin_amount = product.sell_price - (product.total_cost || 0);
    product.margin_percent = this.calculateCappedMarginPercent(
      product.sell_price,
      product.total_cost,
    );
    product.status = this.calculateStatus(product.margin_amount);

    return this.productRepository.save(product);
  }

  private calculateLineCost(
    ingredient: Ingredient,
    quantity: number,
    unit: string,
  ): number {
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
      throw new BadRequestException(
        'Waste percentage must be between 0 and 100',
      );
    }
    const usablePercentage = 1 - wastePercent / 100;
    if (usablePercentage <= 0) {
      throw new BadRequestException(
        'Waste percent results in zero or negative usable quantity',
      );
    }

    let baseCost = 0;
    if (unit.toLowerCase().includes('ml') || unit.toLowerCase().includes('l')) {
      baseCost = ingredient.cost_per_ml || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else if (
      unit.toLowerCase().includes('g') ||
      unit.toLowerCase().includes('kg')
    ) {
      baseCost = ingredient.cost_per_gram || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else if (unit.toLowerCase().includes('unit')) {
      baseCost = ingredient.cost_per_unit || 0;
      return Number((baseCost / usablePercentage).toFixed(6));
    } else {
      throw new BadRequestException(
        'Unsupported unit. Use ml, L, g, kg, or unit',
      );
    }
  }

  private async getAvailableStock(
    ingredient: Ingredient,
    requestedUnit: string,
    requestedQuantity: number,
    userId: string,
  ): Promise<Stock> {
    console.log(
      `Checking stock for ${ingredient.name}: ${requestedQuantity}${requestedUnit}`,
    );

    // Get stocks ONLY for this ingredient with remaining quantity > 0
    const stocks = await this.stockRepository.find({
      where: {
        ingredient: { id: ingredient.id },
        user: { id: userId },
        remaining_quantity: MoreThan(0),
      },
      relations: ['ingredient'],
      order: { purchased_at: 'ASC' },
    });

    if (!stocks || stocks.length === 0) {
      throw new BadRequestException(
        `No available stock for ingredient ${ingredient.name}`,
      );
    }

    // Convert requested quantity to base unit (kg or L)
    let requestedInBaseUnit = requestedQuantity;
    if (requestedUnit === 'g' && ingredient.unit === 'kg') {
      requestedInBaseUnit = requestedQuantity / 1000;
    } else if (requestedUnit === 'ml' && ingredient.unit === 'L') {
      requestedInBaseUnit = requestedQuantity / 1000;
    }

    console.log(`Requested in ${ingredient.unit}: ${requestedInBaseUnit}`);

    // Calculate total available in base unit
    let totalAvailable = 0;
    for (const stock of stocks) {
      let stockQuantity = Number(stock.remaining_quantity);
      if (stock.unit === ingredient.unit) {
        totalAvailable += stockQuantity;
      } else if (stock.unit === 'g' && ingredient.unit === 'kg') {
        totalAvailable += stockQuantity / 1000;
      } else if (stock.unit === 'ml' && ingredient.unit === 'L') {
        totalAvailable += stockQuantity / 1000;
      }
    }

    console.log(`Total available in ${ingredient.unit}: ${totalAvailable}`);

    // Check if we have enough stock
    if (totalAvailable < requestedInBaseUnit) {
      // Convert back to requested unit for error message
      let availableInRequestedUnit = totalAvailable;
      if (requestedUnit === 'g' && ingredient.unit === 'kg') {
        availableInRequestedUnit = totalAvailable * 1000;
      } else if (requestedUnit === 'ml' && ingredient.unit === 'L') {
        availableInRequestedUnit = totalAvailable * 1000;
      }

      throw new BadRequestException(
        `Insufficient stock for ${ingredient.name}. ` +
          `Available: ${availableInRequestedUnit.toFixed(2)}${requestedUnit}, ` +
          `Requested: ${requestedQuantity}${requestedUnit}`,
      );
    }

    // Find first stock with enough quantity
    for (const stock of stocks) {
      let stockInBaseUnit = Number(stock.remaining_quantity);
      if (stock.unit === 'g' && ingredient.unit === 'kg') {
        stockInBaseUnit = stockInBaseUnit / 1000;
      } else if (stock.unit === 'ml' && ingredient.unit === 'L') {
        stockInBaseUnit = stockInBaseUnit / 1000;
      }

      if (stockInBaseUnit >= requestedInBaseUnit) {
        return stock;
      }
    }

    // If no single stock has enough, return the first available one
    return stocks[0];
  }

  private async updateStock(stock: Stock): Promise<Stock> {
    if (stock.remaining_quantity < 0 || isNaN(stock.remaining_quantity)) {
      throw new BadRequestException(
        'Remaining quantity cannot be negative or NaN',
      );
    }
    return this.stockRepository.save(stock);
  }

  private async deductStockFromBatches(
    ingredientId: string,
    requestedQuantity: number,
    requestedUnit: string,
    userId: string,
  ): Promise<void> {
    const ingredient = await this.ingredientsService.findOne(
      ingredientId,
      userId,
    );
    if (!ingredient) {
      throw new BadRequestException(`Ingredient ${ingredientId} not found`);
    }

    console.log(
      `Deducting stock: ${requestedQuantity}${requestedUnit} of ${ingredient.name}`,
    );

    // Convert requested quantity to base unit
    let requestedInBaseUnit = requestedQuantity;
    if (requestedUnit === 'g' && ingredient.unit === 'kg') {
      requestedInBaseUnit = requestedQuantity / 1000;
    } else if (requestedUnit === 'ml' && ingredient.unit === 'L') {
      requestedInBaseUnit = requestedQuantity / 1000;
    } else if (requestedUnit !== ingredient.unit) {
      throw new BadRequestException(
        `Invalid unit ${requestedUnit} for ingredient ${ingredient.name}`,
      );
    }

    let remainingToDeduct = requestedInBaseUnit;

    // Get all available stock batches
    const stocks = await this.stockRepository.find({
      where: {
        ingredient: { id: ingredientId },
        user: { id: userId },
      },
      order: { purchased_at: 'ASC' },
    });

    // Manually filter for remaining_quantity > 0
    const availableStocks = stocks.filter(stock => Number(stock.remaining_quantity) > 0);

    if (!availableStocks || availableStocks.length === 0) {
      throw new BadRequestException(
        `No available stock for ${ingredient.name}`,
      );
    }

    // Deduct from each stock batch until we've deducted the full amount
    for (const stock of availableStocks) {
      if (remainingToDeduct <= 0) break;

      let stockQuantityInBaseUnit = stock.remaining_quantity;
      if (stock.unit !== ingredient.unit) {
        stockQuantityInBaseUnit = this.convertQuantity(
          stock.remaining_quantity,
          stock.unit,
          ingredient.unit,
        );
      }

      const deductionInBaseUnit = Math.min(
        remainingToDeduct,
        stockQuantityInBaseUnit,
      );

      const deductionInStockUnit = this.convertQuantity(
        deductionInBaseUnit,
        ingredient.unit,
        stock.unit,
      );

      stock.remaining_quantity = Math.max(
        0,
        stock.remaining_quantity - deductionInStockUnit,
      );

      await this.updateStock(stock);
      remainingToDeduct -= deductionInBaseUnit;
    }

    // Check if we were able to deduct the full amount
    if (remainingToDeduct > 0) {
      throw new BadRequestException(
        `Insufficient stock for ${ingredient.name}. Could not deduct ${requestedQuantity}${requestedUnit}`,
      );
    }

    console.log(
      `Successfully deducted ${requestedQuantity}${requestedUnit} from stock`,
    );
  }

  private async adjustStock(
    ingredientId: string,
    quantityDelta: number, // positive for deduction, negative for addition
    unit: string,
    userId: string,
    transactionalEntityManager: EntityManager, // Pass the entity manager for transaction
  ): Promise<void> {
    const ingredient = await this.ingredientsService.findOne(
      ingredientId,
      userId,
    );
    if (!ingredient) {
      throw new BadRequestException(`Ingredient ${ingredientId} not found`);
    }

    console.log(
      `Adjusting stock for ${ingredient.name}: ${quantityDelta}${unit}`,
    );

    // Convert quantityDelta to ingredient's base unit
    let deltaInIngredientBaseUnit = this.convertQuantity(quantityDelta, unit, ingredient.unit);

    // Get all stock batches for the ingredient
    const stocks = await transactionalEntityManager.find(Stock, {
      where: {
        ingredient: { id: ingredientId },
        user: { id: userId },
      },
      order: { purchased_at: 'ASC' },
    });

    if (deltaInIngredientBaseUnit > 0) { // Deduction
      let remainingToDeduct = deltaInIngredientBaseUnit;

      if (!stocks || stocks.length === 0) {
        throw new BadRequestException(
          `No available stock for ${ingredient.name}`,
        );
      }

      for (const stock of stocks) {
        if (remainingToDeduct <= 0) break;

        let stockQuantityInStockUnit = stock.remaining_quantity;
        let stockQuantityInIngredientBaseUnit = this.convertQuantity(
            stockQuantityInStockUnit,
            stock.unit,
            ingredient.unit
        );

        const deductionFromThisBatchInIngredientBaseUnit = Math.min(
          remainingToDeduct,
          stockQuantityInIngredientBaseUnit,
        );

        const deductionInStockUnit = this.convertQuantity(
          deductionFromThisBatchInIngredientBaseUnit,
          ingredient.unit,
          stock.unit,
        );

        stock.remaining_quantity = Math.max(
          0,
          stockQuantityInStockUnit - deductionInStockUnit,
        );

        await transactionalEntityManager.save(Stock, stock);
        remainingToDeduct -= deductionFromThisBatchInIngredientBaseUnit;
      }

      if (remainingToDeduct > 0) {
        throw new BadRequestException(
          `Insufficient stock for ${ingredient.name}. Could not deduct ${quantityDelta}${unit}`,
        );
      }
    } else if (deltaInIngredientBaseUnit < 0) { // Addition (refund)
      let remainingToAdd = Math.abs(deltaInIngredientBaseUnit);

      // Add to the most recent stock batch if available, otherwise create a new one
      let targetStock = stocks.length > 0 ? stocks[stocks.length - 1] : null; // Most recent

      if (!targetStock) {
        // Create a new stock entry for the refund
        targetStock = transactionalEntityManager.create(Stock, {
            ingredient: { id: ingredientId },
            user: { id: userId },
            purchased_quantity: 0, // This is a refund, not a new purchase
            unit: ingredient.unit, // Use ingredient's base unit for new stock
            total_purchased_price: 0,
            purchase_price_per_unit: ingredient.cost_per_unit || 0,
            waste_percent: ingredient.waste_percent || 0,
            remaining_quantity: 0,
            wasted_quantity: 0,
            purchased_at: new Date(),
        });
      }

      const addInStockUnit = this.convertQuantity(
        remainingToAdd,
        ingredient.unit,
        targetStock.unit,
      );

      targetStock.remaining_quantity += addInStockUnit;
      await transactionalEntityManager.save(Stock, targetStock);
    }
  }

  convertQuantity(quantity: any, fromUnit: string, toUnit: string): number {
    const numQuantity =
      typeof quantity === 'number' ? quantity : parseFloat(quantity);
    if (isNaN(numQuantity))
      throw new BadRequestException('Invalid quantity value');

    const fromLower = fromUnit.toLowerCase().replace(/s$/, '');
    const toLower = toUnit.toLowerCase().replace(/s$/, '');

    if (fromLower === toLower) return Number(numQuantity.toFixed(2));

    // Handle unit conversions first
    if (fromLower === 'unit' && toLower === 'unit')
      return Number(numQuantity.toFixed(2));
    
    // Don't convert between unit and other types
    if (fromLower === 'unit' || toLower === 'unit') {
      throw new BadRequestException(
        `Cannot convert between unit and ${fromLower === 'unit' ? toLower : fromLower}`,
      );
    }

    const conversionFactors: { [key: string]: number } = {
      ml: 1,
      l: 1000,
      g: 1,
      kg: 1000,
    };
    const fromFactor = conversionFactors[fromLower];
    const toFactor = conversionFactors[toLower];

    if (fromFactor && toFactor) {
      const converted = (numQuantity * fromFactor) / toFactor;
      return Number(converted.toFixed(2));
    }
    throw new BadRequestException(
      `Incompatible units: ${fromUnit} and ${toUnit}`,
    );
  }

  public isCompatibleUnit(unit1: string, unit2: string): boolean {
    // Changed to public
    const u1 = unit1.toLowerCase();
    const u2 = unit2.toLowerCase();
    return (
      u1 === u2 ||
      (u1 === 'l' && u2 === 'ml') ||
      (u1 === 'ml' && u2 === 'l') ||
      (u1 === 'kg' && u2 === 'g') ||
      (u1 === 'g' && u2 === 'kg') ||
      (u1.includes('unit') && u2.includes('unit'))
    );
  }

  private calculateCappedMarginPercent(
    sellPrice: number,
    totalCost: number,
  ): number {
    if (sellPrice <= 0) return 0;
    const marginPercent = ((sellPrice - totalCost) / sellPrice) * 100;
    return Math.min(Math.max(marginPercent, -999.99), 999.99);
  }

  async getMaxProducibleQuantity(
    productId: string,
    userId: string,
  ): Promise<{
    maxQuantity: number;
    stockUpdates: {
      ingredientId: string;
      remainingQuantity: number;
      unit: string;
    }[];
  }> {
    const product = await this.findOne(productId, userId); // Pass userId
    if (!product)
      throw new NotFoundException(
        `Product with ID ${productId} not found for this user`,
      );

    let maxQuantity = Infinity;
    const stockUpdates: {
      [ingredientId: string]: { remainingQuantity: number; unit: string };
    } = {};

    for (const pi of product.ingredients) {
      const ingredientId = pi.ingredient.id;
      const totalAvailable = await this.stockService.getAvailableStock(
        ingredientId,
        userId,
      );
      const neededPerUnit = this.convertQuantity(
        pi.quantity,
        pi.unit,
        pi.ingredient.unit,
      );
      if (neededPerUnit <= 0)
        throw new BadRequestException(
          `Invalid quantity for ingredient ${ingredientId}`,
        );

      const availableForThisIngredient = totalAvailable / neededPerUnit;
      maxQuantity = Math.min(
        maxQuantity,
        Math.floor(availableForThisIngredient),
      );

      const currentStock = await this.stockRepository.findOne({
        where: { ingredient: { id: ingredientId } },
        order: { purchased_at: 'ASC' },
      });
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
      stockUpdates: Object.entries(stockUpdates).map(
        ([ingredientId, update]) => ({
          ingredientId,
          ...update,
        }),
      ),
    };
  }

  async recalculateAllProductQuantities(): Promise<void> {
    const products = await this.productRepository.find();

    for (const product of products) {
      const totalQuantity = await this.salesRepository
        .createQueryBuilder('sale')
        .select('SUM(sale.quantity)', 'sum')
        .where('sale.productId = :productId', { productId: product.id })
        .getRawOne();

      product.quantity_sold = Number(totalQuantity.sum) || 0;
      await this.productRepository.save(product);
    }
  }
}
