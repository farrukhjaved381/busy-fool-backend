import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { ProductIngredient } from '../products/entities/product-ingredient.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Waste } from '../waste/entities/waste.entity';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { StockModule } from '../stock/stock.module';
import { WasteModule } from '../waste/waste.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Ingredient, ProductIngredient, Purchase, Waste]),
    ProductsModule,
    UsersModule,
    StockModule,
    WasteModule, // Add this to import WasteRepository
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}