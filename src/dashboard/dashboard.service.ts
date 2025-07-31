import { Injectable } from '@nestjs/common';
import { PurchasesService } from '../purchases/purchases.service';
import { ProductsService } from '../products/products.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { StockService } from '../stock/stock.service';
import { SalesService } from '../sales/sales.service';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Product } from '../products/entities/product.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Sale } from '../sales/entities/sale.entity';

@Injectable()
export class DashboardService {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly productsService: ProductsService,
    private readonly ingredientsService: IngredientsService,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
  ) {}

  async getDashboardData() {
    const purchases: Purchase[] = await this.purchasesService.findAll();
    const products: Product[] = await this.productsService.findAll();
    const ingredients: Ingredient[] = await this.ingredientsService.findAll();
    const stocks: Stock[] = await this.stockService.findAll();
    const sales: Sale[] = await this.salesService.findAll();

    // Sales
    const totalSales = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const salesCount = sales.length;

    // Purchases
    const totalPurchasesCost = stocks.reduce((sum, s) => sum + Number(s.total_purchased_price), 0);
    const purchaseCount = purchases.length; // Adjust if stock reflects all purchases

    // Profits
    const totalProductCost = products.reduce((sum, p) => sum + Number(p.total_cost), 0);
    const totalProfit = totalSales - totalProductCost;

    // Margins
    const totalMargin = products.reduce((sum, p) => sum + Number(p.margin_amount || 0), 0);
    const avgMarginPercent = products.length ? (totalMargin / products.reduce((sum, p) => sum + Number(p.sell_price || 0), 0) * 100) : 0;

    // Analytics
    const avgPurchasePrice = purchaseCount ? totalPurchasesCost / purchaseCount : 0;
    const totalStock = stocks.reduce((sum, s) => sum + Number(s.remaining_quantity || 0), 0);
    const lowStockIngredients = ingredients.filter(i => {
      const stock = stocks.find(s => s.ingredient && s.ingredient.id === i.id);
      return stock && Number(stock.remaining_quantity) < 0.5; // Adjusted threshold
    });

    // Latest Purchases
    const latestPurchases = purchases.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()).slice(0, 5);

    // Suggestions
    const suggestions = {
      stockManagement: lowStockIngredients.length ? `Restock ${lowStockIngredients.map(i => i.name).join(', ')}` : 'All stocks are sufficient.',
      priceOptimization: avgPurchasePrice > 100 ? 'Review high purchase prices for cost savings.' : 'Purchase prices are optimized.',
      salesBoost: salesCount < 5 ? 'Consider promoting low-selling products.' : 'Sales performance is strong.',
    };

    return {
      overview: {
        totalSales: Number(totalSales.toFixed(2)),
        totalPurchasesCost: Number(totalPurchasesCost.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        totalMargin: Number(totalMargin.toFixed(2)),
        avgMarginPercent: Number(avgMarginPercent.toFixed(2)),
      },
      analytics: {
        purchaseCount,
        salesCount,
        avgPurchasePrice: Number(avgPurchasePrice.toFixed(2)),
        totalStock: Number(totalStock.toFixed(2)),
        lowStockCount: lowStockIngredients.length,
      },
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        sellPrice: Number(p.sell_price),
        totalCost: Number(p.total_cost),
        margin: Number(p.margin_amount || 0),
        status: p.status,
      })),
      ingredients: ingredients.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        quantity: Number(i.quantity),
        purchasePrice: Number(i.purchase_price),
      })),
      stockBrief: stocks.map(s => ({
        id: s.id,
        ingredientId: s.ingredient ? s.ingredient.id : null,
        purchasedQuantity: Number(s.purchased_quantity),
        remainingQuantity: Number(s.remaining_quantity),
        unit: s.unit,
        totalPurchasedPrice: Number(s.total_purchased_price),
      })),
      latestPurchases: latestPurchases.map(p => ({
        id: p.id,
        ingredientId: p.ingredient ? p.ingredient.id : null,
        quantity: p.quantity,
        purchasePrice: Number(p.purchasePrice),
        totalCost: Number(p.total_cost),
        purchaseDate: p.purchase_date,
      })),
      suggestions,
    };
  }
}
