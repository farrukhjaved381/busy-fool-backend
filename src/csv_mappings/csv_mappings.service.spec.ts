import { Test, TestingModule } from '@nestjs/testing';
import { CsvMappingsService } from './csv_mappings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CsvMappings } from './entities/csv-mappings.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';

describe('CsvMappingsService', () => {
  let service: CsvMappingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvMappingsService,
        {
          provide: getRepositoryToken(CsvMappings),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Sale),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CsvMappingsService>(CsvMappingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
