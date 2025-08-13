import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PurchasesModule } from '../purchases/purchases.module';
import { ProductsModule } from '../products/products.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { StockModule } from '../stock/stock.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    PurchasesModule,
    ProductsModule,
    IngredientsModule,
    StockModule,
    SalesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
