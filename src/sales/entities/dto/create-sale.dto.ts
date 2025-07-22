import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'ID of the product sold (optional for unregistered products)', required: false })
  productId?: string;

  @IsString()
  @ApiProperty({ description: 'Name of the product sold' })
  product_name: string;

  @IsNumber()
  @ApiProperty({ description: 'Quantity sold' })
  quantity: number;

  @IsNumber()
  @ApiProperty({ description: 'Total sale amount' })
  total_amount: number;
}