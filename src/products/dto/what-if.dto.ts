import { IsString, IsNumber, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WhatIfDto {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ description: 'Array of product IDs to simulate price changes for', type: [String] })
  productIds: string[];

  @IsNumber()
  @ApiProperty({ description: 'Price adjustment amount (positive or negative)' })
  priceAdjustment: number;
}