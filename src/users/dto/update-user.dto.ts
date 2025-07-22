import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Updated name of the user', required: false })
  name?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Updated password of the user', required: false })
  password?: string;
}