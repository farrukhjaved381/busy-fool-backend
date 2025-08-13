import { ApiProperty } from '@nestjs/swagger';

export class StockUpdateDto {
  @ApiProperty({
    description: 'ID of the ingredient',
    example: 'c885486e-4e7c-42f3-971c-5778f7e96e8d',
  })
  ingredientId: string;

  @ApiProperty({
    description: 'Remaining quantity after production',
    example: 5.45,
  })
  remainingQuantity: number;

  @ApiProperty({ description: 'Unit of measurement', example: 'L' })
  unit: string;
}

export class GetMaxProducibleQuantityResponseDto {
  @ApiProperty({
    description: 'Maximum number of products that can be produced',
    example: 9,
  })
  maxQuantity: number;

  @ApiProperty({
    type: [StockUpdateDto],
    description: 'Projected stock updates after production',
  })
  stockUpdates: StockUpdateDto[];
}
