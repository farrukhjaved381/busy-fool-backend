import { IsString, IsNumber, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWasteDto {
  @IsString()
  @ApiProperty({ description: 'Stock ID', example: '095e2951-a0b6-4a53-a27e-1c92de554e96' })
  stockId: string;

  @IsNumber()
  @Min(0.01)
  @ApiProperty({ description: 'Quantity wasted', example: 5, minimum: 0.01 })
  quantity: number;

  @IsString()
  @Length(1, 50)
  @ApiProperty({ description: 'Unit of measurement', example: 'unit', minLength: 1, maxLength: 50 })
  unit: string;

  @IsString()
  @Length(1, 255)
  @ApiProperty({ description: 'Reason for waste', example: 'Spoilage', minLength: 1, maxLength: 255 })
  reason: string;
}