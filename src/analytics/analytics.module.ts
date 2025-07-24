import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity'; // Ensure Sale entity is imported

@Module({
  imports: [TypeOrmModule.forFeature([Product, Sale])], // Include both repositories
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}