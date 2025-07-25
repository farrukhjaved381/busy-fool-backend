import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { Stock } from '../stock/entities/stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductIngredient, Stock]), // Include Stock in the forFeature array
    IngredientsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}