import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportSalesDto {
  @IsString()
  @ApiProperty({ example: '6b3db133-0d67-4d01-967a-4816e5c4fd77', description: 'User ID' })
  userId: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return false;
  })
  @ApiProperty({ example: false, description: 'If false, runs preview without saving' })
  confirm: boolean;
}
