import { Test, TestingModule } from '@nestjs/testing';
import { CsvMappingsController } from './csv_mappings.controller';
import { CsvMappingsService } from './csv_mappings.service';

describe('CsvMappingsController', () => {
  let controller: CsvMappingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsvMappingsController],
      providers: [
        {
          provide: CsvMappingsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CsvMappingsController>(CsvMappingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
