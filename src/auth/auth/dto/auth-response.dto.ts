// src/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token' 
  })
  accessToken: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: 'owner@coffee.shop' })
  email: string;

  @ApiProperty({ enum: ['owner', 'staff'], example: 'owner' })
  role: string;
}