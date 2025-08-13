import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
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
  ) {}

  async getDashboard(startDate: Date, endDate: Date): Promise<any> {
    if (!startDate || !endDate || startDate > endDate) {
      throw new BadRequestException(
        'Invalid date range. Start date must be before end date.',
      );
    }

    try {
      // Fetch sales within the date range with product details
      const sales = await this.saleRepository
        .createQueryBuilder('sale')
        .leftJoinAndSelect('sale.product', 'product')
        .leftJoinAndSelect('product.ingredients', 'ingredients')
        .leftJoinAndSelect('ingredients.ingredient', 'ingredient')
        .where(
          'DATE(sale.sale_date) >= :startDate AND DATE(sale.sale_date) <= :endDate',
          { startDate, endDate },
        )
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

      // Calculate totals with type safety
      const revenue = sales.reduce((sum, sale) => {
        const amount =
          typeof sale.total_amount === 'number'
            ? sale.total_amount
            : parseFloat(sale.total_amount) || 0;
        return sum + amount;
      }, 0);
      const costs = sales.reduce((sum, sale) => {
        if (sale.product) {
          const cost =
            typeof sale.product.total_cost === 'number'
              ? sale.product.total_cost
              : parseFloat(sale.product.total_cost) || 0;
          return (
            sum +
            cost *
              (typeof sale.quantity === 'number'
                ? sale.quantity
                : parseFloat(sale.quantity) || 0)
          );
        }
        return sum;
      }, 0);
      const profit = revenue - costs;
      const profitMargin =
        revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : '0.00';

      // Identify winners and losing money products
      const losingMoney = sales
        .filter(
          (sale) => sale.product && sale.product.status === 'losing money',
        )
        .reduce(
          (acc, sale) => {
            const existing = acc.find(
              (item) => item.name === sale.product.name,
            );
            if (existing) {
              existing.quantity +=
                typeof sale.quantity === 'number'
                  ? sale.quantity
                  : parseFloat(sale.quantity) || 0;
              existing.margin_amount +=
                (typeof sale.product.margin_amount === 'number'
                  ? sale.product.margin_amount
                  : parseFloat(sale.product.margin_amount) || 0) *
                (typeof sale.quantity === 'number'
                  ? sale.quantity
                  : parseFloat(sale.quantity) || 0);
            } else {
              acc.push({
                name: sale.product.name,
                quantity:
                  typeof sale.quantity === 'number'
                    ? sale.quantity
                    : parseFloat(sale.quantity) || 0,
                margin_amount:
                  (typeof sale.product.margin_amount === 'number'
                    ? sale.product.margin_amount
                    : parseFloat(sale.product.margin_amount) || 0) *
                  (typeof sale.quantity === 'number'
                    ? sale.quantity
                    : parseFloat(sale.quantity) || 0),
              });
            }
            return acc;
          },
          [] as { name: string; quantity: number; margin_amount: number }[],
        );

      const winners = sales
        .filter((sale) => sale.product && sale.product.status === 'profitable')
        .reduce(
          (acc, sale) => {
            const existing = acc.find(
              (item) => item.name === sale.product.name,
            );
            if (existing) {
              existing.quantity +=
                typeof sale.quantity === 'number'
                  ? sale.quantity
                  : parseFloat(sale.quantity) || 0;
              existing.margin_amount +=
                (typeof sale.product.margin_amount === 'number'
                  ? sale.product.margin_amount
                  : parseFloat(sale.product.margin_amount) || 0) *
                (typeof sale.quantity === 'number'
                  ? sale.quantity
                  : parseFloat(sale.quantity) || 0);
            } else {
              acc.push({
                name: sale.product.name,
                quantity:
                  typeof sale.quantity === 'number'
                    ? sale.quantity
                    : parseFloat(sale.quantity) || 0,
                margin_amount:
                  (typeof sale.product.margin_amount === 'number'
                    ? sale.product.margin_amount
                    : parseFloat(sale.product.margin_amount) || 0) *
                  (typeof sale.quantity === 'number'
                    ? sale.quantity
                    : parseFloat(sale.quantity) || 0),
              });
            }
            return acc;
          },
          [] as { name: string; quantity: number; margin_amount: number }[],
        )
        .sort((a, b) => b.margin_amount - a.margin_amount)
        .slice(0, 3)
        .map((p) => ({
          name: p.name,
          margin_amount: Number(p.margin_amount.toFixed(2)),
        }));

      const quickWins = losingMoney.map((p) => ({
        name: p.name,
        suggestion: `Raise price by £${(Math.abs(p.margin_amount / p.quantity) + 0.5).toFixed(2)}`,
      }));

      return {
        revenue: Number(revenue).toFixed(2),
        costs: Number(costs).toFixed(2),
        profit: Number(profit).toFixed(2),
        profitMargin: profitMargin,
        losingMoney,
        winners,
        quickWins,
      };
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'An error occurred while generating dashboard data',
      );
    }
  }
}
