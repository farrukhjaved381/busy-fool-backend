import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateIngredientDto } from './create-ingredient.dto';

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {
  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({ description: 'New purchase price', example: 2.90, required: false })
  purchase_price?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @ApiProperty({ description: 'New waste percentage (0-100)', example: 12, required: false })
  waste_percent?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'New supplier name', example: 'Alpro', required: false })
  supplier?: string;
}