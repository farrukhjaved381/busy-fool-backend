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
import { CsvMappingsModule } from '../csv_mappings/csv_mappings.module';
import { CsvMappings } from '../csv_mappings/entities/csv-mappings.entity';

import { ImportSalesUnmatched } from './entities/import-sales.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Ingredient, ProductIngredient, Purchase, Waste, ImportSalesUnmatched, CsvMappings]),
    ProductsModule,
    UsersModule,
    StockModule,
    WasteModule, // Add this to import WasteRepository
    CsvMappingsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}