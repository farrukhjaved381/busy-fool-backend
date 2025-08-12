import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { Ingredient } from './entities/ingredient.entity';
import { Stock } from '../stock/entities/stock.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, Stock]), UsersModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}