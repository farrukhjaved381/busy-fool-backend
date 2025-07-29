import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, Max, IsOptional } from 'class-validator';

export class CreateStockDto {
  @ApiProperty({ description: 'ID of the ingredient' })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ description: 'Quantity of the ingredient purchased' })
  @IsNumber()
  @Min(0.01)
  purchased_quantity: number;

  @ApiProperty({ description: 'Unit of measurement (e.g., ml, g, unit)' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ description: 'Price per unit of the purchased ingredient' })
  @IsNumber()
  @Min(0)
  purchase_price: number;

  @ApiProperty({ description: 'Percentage of waste expected (0-100)', required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  waste_percent?: number;
}