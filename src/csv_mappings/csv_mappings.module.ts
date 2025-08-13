import { Module } from '@nestjs/common';
import { CsvMappingsService } from './csv_mappings.service';
import { CsvMappingsController } from './csv_mappings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvMappings } from './entities/csv-mappings.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CsvMappings, Sale, Product])],
  controllers: [CsvMappingsController],
  providers: [CsvMappingsService],
})
export class CsvMappingsModule {}
