import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIngredientDto {
  @IsString()
  @ApiProperty({ description: 'Name of the ingredient', example: 'Oat Milk' })
  name: string;

  @IsString()
  @ApiProperty({ description: 'Unit of measurement (e.g., kg, L, unit)', example: 'L' })
  unit: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Quantity of the ingredient', example: 2 })
  quantity: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Purchase price of the ingredient', example: 2.53 })
  purchase_price: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ description: 'Waste percentage (0-100)', example: 10 })
  waste_percent: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @ApiProperty({ description: 'Cost per milliliter', example: 0.00281, required: false })
  cost_per_ml?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @ApiProperty({ description: 'Cost per gram', example: 0.0157, required: false })
  cost_per_gram?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @ApiProperty({ description: 'Cost per unit', example: 1.25, required: false })
  cost_per_unit?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Supplier name', example: 'Oatly', required: false })
  supplier?: string;
}