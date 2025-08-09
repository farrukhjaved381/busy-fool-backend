import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { StockModule } from '../stock/stock.module';
import { Stock } from '../stock/entities/stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductIngredient, Stock]),
    IngredientsModule,
    StockModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}