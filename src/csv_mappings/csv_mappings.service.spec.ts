import { Test, TestingModule } from '@nestjs/testing';
import { CsvMappingsService } from './csv_mappings.service';

describe('CsvMappingsService', () => {
  let service: CsvMappingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvMappingsService],
    }).compile();

    service = module.get<CsvMappingsService>(CsvMappingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
