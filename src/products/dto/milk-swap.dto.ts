import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MilkSwapDto {
  @IsString()
  @ApiProperty({ description: 'ID of the product' })
  productId: string;

  @IsString()
  @ApiProperty({ description: 'ID of the original ingredient to swap' })
  originalIngredientId: string;

  @IsString()
  @ApiProperty({ description: 'ID of the new ingredient' })
  newIngredientId: string;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ description: 'Upcharge amount for the swap', required: false })
  upcharge?: number;
}
