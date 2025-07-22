import { Injectable, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductIngredient)
    private productIngredientsRepository: Repository<ProductIngredient>,
    private ingredientsService: IngredientsService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      name: createProductDto.name,
      category: createProductDto.category,
      sell_price: createProductDto.sell_price,
      status: 'pending',
    });

    await this.productsRepository.save(product);

    let totalCost = 0;
    for (const ingredientDto of createProductDto.ingredients) {
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
    product.margin_percent = (product.margin_amount / product.sell_price) * 100;
    product.status = this.calculateStatus(product.margin_amount);
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({ relations: ['ingredients', 'ingredients.ingredient'] });
  }

  async findOne(id: string): Promise<Product> {
    return (await this.productsRepository.findOne({ where: { id }, relations: ['ingredients', 'ingredients.ingredient'] }))!;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (!product) throw new BadRequestException('Product not found');

    Object.assign(product, updateProductDto);
    if (updateProductDto.ingredients) {
      await this.productIngredientsRepository.delete({ product: { id } });
      let totalCost = 0;
      for (const ingredientDto of updateProductDto.ingredients) {
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
      product.margin_percent = (product.margin_amount / product.sell_price) * 100;
      product.status = this.calculateStatus(product.margin_amount);
    }
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    await this.productIngredientsRepository.delete({ product: { id } });
    await this.productsRepository.delete(id);
  }

  async whatIf(whatIfDto: WhatIfDto): Promise<{ productId: string; newMargin: number; newStatus: string }[]> {
    const results = [];
    for (const productId of whatIfDto.productIds) {
      const product = await this.findOne(productId);
      if (!product) continue;

      const newSellPrice = product.sell_price + whatIfDto.priceAdjustment;
      const newMarginAmount = newSellPrice - product.total_cost;
      const newMarginPercent = (newMarginAmount / newSellPrice) * 100;
      const newStatus = this.calculateStatus(newMarginAmount);

      results.push({
        productId,
        newMargin: newMarginPercent,
        newStatus,
      });
    }
    return results;
  }

  async getDashboard(startDate: Date, endDate: Date) {
    const products = await this.findAll();
    const revenue = products.reduce((sum, p) => sum + p.sell_price, 0);
    const costs = products.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    const profit = revenue - costs;
    const losingMoney = products
      .filter(p => p.status === 'losing money')
      .map(p => ({
        name: p.name,
        margin_amount: p.margin_amount,
      }));
    const winners = products
      .filter(p => p.status === 'profitable')
      .sort((a, b) => b.margin_amount - a.margin_amount)
      .slice(0, 3)
      .map(p => ({
        name: p.name,
        margin_amount: p.margin_amount,
      }));
    const quickWins = losingMoney.map(p => ({
      name: p.name,
      suggestion: `Raise price by £${(Math.abs(p.margin_amount) + 0.50).toFixed(2)}`,
    }));

    return {
      revenue: revenue.toFixed(2),
      costs: costs.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: ((profit / revenue) * 100).toFixed(2),
      losingMoney,
      winners,
      quickWins,
    };
  }

  async milkSwap(milkSwapDto: MilkSwapDto): Promise<{ originalMargin: number; newMargin: number; upchargeCovered: boolean }> {
    const product = await this.findOne(milkSwapDto.productId);
    if (!product) throw new BadRequestException('Product not found');

    const originalTotalCost = product.total_cost;
    const originalMargin = (product.sell_price - originalTotalCost) / product.sell_price * 100;

    let newTotalCost = 0;
    for (const pi of product.ingredients) {
      let ingredient = pi.ingredient;
      if (pi.ingredient.id === milkSwapDto.originalIngredientId) {
        ingredient = (await this.ingredientsService.findOne(milkSwapDto.newIngredientId))!;
        if (!ingredient) throw new BadRequestException(`Ingredient ${milkSwapDto.newIngredientId} not found`);
      }
      newTotalCost += this.calculateLineCost(ingredient, pi.quantity, pi.unit);
    }

    const newMargin = (product.sell_price - newTotalCost) / product.sell_price * 100;
    const upchargeCovered = milkSwapDto.upcharge ? (product.sell_price + milkSwapDto.upcharge - newTotalCost) >= 0 : newMargin >= 0;

    return {
      originalMargin: parseFloat(originalMargin.toFixed(2)),
      newMargin: parseFloat(newMargin.toFixed(2)),
      upchargeCovered,
    };
  }

  async quickAction(id: string, quickActionDto: QuickActionDto): Promise<Product> {
    const product = await this.findOne(id);
    if (!product) throw new BadRequestException('Product not found');

    product.sell_price = quickActionDto.new_sell_price;
    product.margin_amount = product.sell_price - product.total_cost;
    product.margin_percent = (product.margin_amount / product.sell_price) * 100;
    product.status = this.calculateStatus(product.margin_amount);

    return this.productsRepository.save(product);
  }

  private calculateLineCost(ingredient: Ingredient, quantity: number, unit: string): number {
    if (unit.includes('ml') || unit.includes('L')) return quantity * (ingredient.cost_per_ml || 0);
    if (unit.includes('g') || unit.includes('kg')) return quantity * (ingredient.cost_per_gram || 0);
    return quantity * (ingredient.cost_per_unit || 0);
  }

  private calculateStatus(marginAmount: number): string {
    if (marginAmount > 0) return 'profitable';
    if (marginAmount === 0) return 'breaking even';
    return 'losing money';
  }
}