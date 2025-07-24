import { IsString, IsNumber, Min, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class IngredientDetail {
  @IsString()
  @ApiProperty({ description: 'Unique identifier of the ingredient', example: '123e4567-e89b-12d3-a456-426614174000' })
  ingredientId: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Quantity of the ingredient', example: 200 })
  quantity: number;

  @IsString()
  @ApiProperty({ description: 'Unit of measurement (e.g., ml, g)', example: 'ml' })
  unit: string;

  @IsOptional()
  @ApiProperty({ description: 'Whether the ingredient is optional', example: false, required: false })
  is_optional?: boolean;
}

export class CreateProductDto {
  @IsString()
  @ApiProperty({ description: 'Name of the product', example: 'Coffee Latte' })
  name: string;

  @IsString()
  @ApiProperty({ description: 'Category of the product', example: 'Beverage' })
  category: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Selling price of the product', example: 4.50 })
  sell_price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDetail)
  @ApiProperty({
    description: 'List of ingredients with their quantities and units',
    type: [IngredientDetail],
    example: [{ ingredientId: '123e4567-e89b-12d3-a456-426614174000', quantity: 200, unit: 'ml', is_optional: false }]
  })
  ingredients: IngredientDetail[];
}