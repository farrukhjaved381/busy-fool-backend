import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { Ingredient } from './entities/ingredient.entity';
import { Stock } from '../stock/entities/stock.entity';
import { UsersModule } from '../users/users.module';
import { ProductIngredient } from '../products/entities/product-ingredient.entity';
import { Purchase } from '../purchases/entities/purchase.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, Stock, ProductIngredient, Purchase]),
    UsersModule,
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
