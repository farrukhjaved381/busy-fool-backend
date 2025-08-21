// src/users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

import {
  IsString,
  IsOptional,
  IsDateString,
  IsUrl,
} from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL.' })
  profilePicture?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
