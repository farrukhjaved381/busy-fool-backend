import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { ProductIngredient } from './entities/product-ingredient.entity';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { StockModule } from '../stock/stock.module';
import { Stock } from '../stock/entities/stock.entity';
import { UsersModule } from '../users/users.module';
import { Sale } from '../sales/entities/sale.entity';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductIngredient, Stock, Sale]),
    MulterModule.register({
      dest: process.env.VERCEL ? require('os').tmpdir() : './uploads',
    }),
    IngredientsModule,
    forwardRef(() => StockModule),
    forwardRef(() => SalesModule),
    UsersModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}
