import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QuickActionDto {
  @IsNumber()
  @ApiProperty({ description: 'New sell price for the product' })
  new_sell_price: number;
}
