// src/users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  profilePicture?: string;
  phoneNumber?: string;
  address?: string;
  bio?: string;
  dateOfBirth?: Date;
}
