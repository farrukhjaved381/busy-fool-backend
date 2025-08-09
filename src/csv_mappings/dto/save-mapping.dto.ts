import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class MappingItemDto {
  @ApiProperty()
  @IsString()
  busyfoolColumn: string;

  @ApiProperty()
  @IsString()
  posColumnName: string;
}

export class SaveMappingDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingItemDto)
  mappings: MappingItemDto[];
}
