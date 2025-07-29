import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
  ) { }

  async getDashboard(startDate: Date, endDate: Date): Promise<any> {
    if (!startDate || !endDate || startDate > endDate) {
      throw new BadRequestException('Invalid date range. Start date must be before end date.');
    }

    try {
      // Fetch sales within the date range with product details
      const sales = await this.saleRepository
        .createQueryBuilder('sale')
        .leftJoinAndSelect('sale.product', 'product')
        .leftJoinAndSelect('product.ingredients', 'ingredients')
        .leftJoinAndSelect('ingredients.ingredient', 'ingredient')
        .where('sale.sale_date >= :startDate AND sale.sale_date <= :endDate', { startDate, endDate })
        .getMany();

      if (!sales || sales.length === 0) {
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

      // Calculate totals based on sales data
      const revenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const costs = sales.reduce((sum, sale) => {
        if (sale.product) {
          return sum + ((sale.product.total_cost || 0) * sale.quantity);
        }
        return sum;
      }, 0);
      const profit = (revenue - costs);
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;

      // Identify winners and losing money products
      // Replace the losingMoney and quickWins logic
      const losingMoney = sales
        .filter(sale => sale.product && sale.product.status === 'losing money')
        .reduce((acc, sale) => {
          const existing = acc.find(item => item.name === sale.product.name);
          if (existing) {
            existing.quantity += sale.quantity;
            existing.margin_amount += (sale.product.margin_amount || 0) * sale.quantity;
          } else {
            acc.push({
              name: sale.product.name,
              quantity: sale.quantity,
              margin_amount: (sale.product.margin_amount || 0) * sale.quantity,
            });
          }
          return acc;
        }, [] as { name: string; quantity: number; margin_amount: number }[]);

      const winners = sales
        .filter(sale => sale.product && sale.product.status === 'profitable')
        .reduce((acc, sale) => {
          const existing = acc.find(item => item.name === sale.product.name);
          if (existing) {
            existing.quantity += sale.quantity;
            existing.margin_amount += (sale.product.margin_amount || 0) * sale.quantity;
          } else {
            acc.push({
              name: sale.product.name,
              quantity: sale.quantity,
              margin_amount: (sale.product.margin_amount || 0) * sale.quantity,
            });
          }
          return acc;
        }, [] as { name: string; quantity: number; margin_amount: number }[])
        .sort((a, b) => b.margin_amount - a.margin_amount)
        .slice(0, 3)
        .map(p => ({ name: p.name, margin_amount: Number(p.margin_amount.toFixed(2)) }));

      const quickWins = losingMoney.map(p => ({
        name: p.name,
        suggestion: `Raise price by £${(Math.abs(p.margin_amount / p.quantity) + 0.50).toFixed(2)}`,
      }));

      return {
        revenue: revenue.toFixed(2),
        costs: costs.toFixed(2),
        profit: profit.toFixed(2),
        profitMargin: profitMargin.toFixed(2),
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