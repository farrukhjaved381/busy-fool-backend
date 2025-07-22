import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { IngredientsModule } from '../ingredients/ingredients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductIngredient]),
    IngredientsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
