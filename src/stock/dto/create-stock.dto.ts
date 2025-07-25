import { IsString, IsNumber, Min, IsOptional, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStockDto {
  @IsString()
  @ApiProperty({ description: 'Ingredient ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  ingredientId: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Purchased quantity', example: 100, minimum: 0.01 })
  purchased_quantity: number;

  @IsString()
  @ApiProperty({ description: 'Unit of measurement (e.g., ml, g, unit)', example: 'ml', minLength: 1, maxLength: 50 })
  unit: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Purchase price for the total quantity', example: 0.84, minimum: 0.01 })
  purchase_price: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @ApiProperty({ description: 'Waste percentage (0-100)', example: 10.0, required: false, minimum: 0, maximum: 100 })
  waste_percent?: number;
}