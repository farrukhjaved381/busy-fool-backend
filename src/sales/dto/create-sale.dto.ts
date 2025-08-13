import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'ID of the product sold (optional for unregistered products)',
    required: false,
  })
  productId?: string;

  @IsString()
  @ApiProperty({ description: 'Name of the product sold' })
  product_name: string;

  @IsNumber()
  @Min(1)
  @ApiProperty({ description: 'Quantity sold' })
  quantity: number;

  // Removed total_amount from DTO to calculate server-side
}
