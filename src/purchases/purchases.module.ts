import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { Purchase } from './entities/purchase.entity';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase]), IngredientsModule, UsersModule, AuthModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}