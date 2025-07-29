import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseDto {
  @IsString()
  @ApiProperty({ description: 'ID of the ingredient purchased' })
  ingredientId: string;

  @IsNumber()
  @ApiProperty({ description: 'Quantity purchased' })
  quantity: number;

  @IsString()
  @ApiProperty({ description: 'Unit of purchase' })
  unit: string;

  @IsNumber()
  @ApiProperty({ description: 'Price per unit of the purchase' })
  purchasePrice: number; // Renamed for clarity

  // Removed total_cost from DTO as it can be calculated
}