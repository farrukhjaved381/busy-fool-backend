import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseDto {
  @IsString()
  @ApiProperty({ description: 'ID of the ingredient purchased' })
  ingredientId: string;

  @IsNumber()
  @ApiProperty({ description: 'Quantity purchased' })
  quantity: number;

  @IsNumber()
  @ApiProperty({ description: 'Total purchase cost' })
  total_cost: number;
}