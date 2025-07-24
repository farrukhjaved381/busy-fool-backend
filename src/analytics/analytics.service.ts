import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity'; // Import Sale entity for date filtering

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Sale) // Inject Sale repository
    private saleRepository: Repository<Sale>,
  ) {}

  async getDashboard(startDate: Date, endDate: Date): Promise<any> {
    
    if (!startDate || !endDate || startDate > endDate) {
      throw new BadRequestException('Invalid date range. Start date must be before end date.');
    }

    try {
      // Fetch products with sales data within the date range
      const products = await this.productsRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.ingredients', 'ingredients')
        .leftJoinAndSelect('ingredients.ingredient', 'ingredient')
        .leftJoin('product.sales', 'sales') // Join with sales for date filtering
        .where('sales.date >= :startDate AND sales.date <= :endDate', { startDate, endDate })
        .orWhere('sales.date IS NULL') // Include products with no sales
        .groupBy('product.id') // Avoid duplicate products
        .getMany()
        .catch(err => {
          console.error('Database query failed:', err);
          throw new InternalServerErrorException('Failed to retrieve product data');
        });

      if (!products || products.length === 0) {
        console.log('No products found for the date range');
        return {
          revenue: '0.00',
          costs: '0.00',
          profit: '0.00',
          profitMargin: '0.00',
          losingMoney: [],
          winners: [],
          quickWins: [],
        };
      }

      // Calculate totals based on sales data if available
      const revenue = products.reduce((sum, p) => {
        const price = typeof p.sell_price === 'number' ? p.sell_price : 0;
        return sum + price;
      }, 0).toFixed(2);
      const costs = products.reduce((sum, p) => {
        const cost = typeof p.total_cost === 'number' ? p.total_cost : 0;
        return sum + cost;
      }, 0).toFixed(2);
      const profit = (parseFloat(revenue) - parseFloat(costs)).toFixed(2);
      const profitMargin = parseFloat(revenue) > 0 ? ((parseFloat(profit) / parseFloat(revenue)) * 100).toFixed(2) : '0.00';

      // Identify winners and losing money products
      const losingMoney = products
        .filter(p => p.status === 'losing money')
        .map(p => ({ name: p.name, margin_amount: (typeof p.margin_amount === 'number' ? p.margin_amount : 0).toFixed(2) }));
      const winners = products
        .filter(p => p.status === 'profitable')
        .sort((a, b) => (b.margin_amount || 0) - (a.margin_amount || 0))
        .slice(0, 3)
        .map(p => ({ name: p.name, margin_amount: (typeof p.margin_amount === 'number' ? p.margin_amount : 0).toFixed(2) }));
      const quickWins = losingMoney.map(p => ({
        name: p.name,
        suggestion: `Raise price by £${(Math.abs(parseFloat(p.margin_amount)) + 0.50).toFixed(2)}`,
      }));

      return {
        revenue,
        costs,
        profit,
        profitMargin,
        losingMoney,
        winners,
        quickWins,
      };
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('An error occurred while generating dashboard data');
    }
  }
}