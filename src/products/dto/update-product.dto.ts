import { IsString, IsNumber, Min, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class IngredientDetail {
  @IsString()
  @ApiProperty({ description: 'Unique identifier of the ingredient', example: '123e4567-e89b-12d3-a456-426614174000' })
  ingredientId: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Quantity of the ingredient', example: 250 })
  quantity: number;

  @IsString()
  @ApiProperty({ description: 'Unit of measurement (e.g., ml, g)', example: 'ml' })
  unit: string;

  @IsOptional()
  @ApiProperty({ description: 'Whether the ingredient is optional', example: false, required: false })
  is_optional?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Name of the product', example: 'Updated Coffee Latte', required: false })
  name?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Category of the product', example: 'Beverage', required: false })
  category?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  @ApiProperty({ description: 'Selling price of the product', example: 5.00, required: false })
  sell_price?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => IngredientDetail)
  @ApiProperty({
    description: 'List of ingredients with their quantities and units',
    type: [IngredientDetail],
    example: [{ ingredientId: '123e4567-e89b-12d3-a456-426614174000', quantity: 250, unit: 'ml', is_optional: false }],
    required: false
  })
  ingredients?: IngredientDetail[];
}