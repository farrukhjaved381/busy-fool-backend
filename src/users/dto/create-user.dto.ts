// src/users/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  MinLength,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'owner@coffee.shop', description: 'User email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'Minimum 8 characters',
    minLength: 8,
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: ['owner', 'staff'],
    default: 'owner',
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  @ApiProperty({
    description: 'Role of the user (owner or staff)',
    enum: UserRole,
    required: false,
  })
  role?: UserRole;
}
