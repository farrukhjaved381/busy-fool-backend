// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Patch, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../users/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., email already registered or invalid data)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'securepassword123' },
        role: { type: 'string', enum: ['owner', 'staff'], example: 'owner' }
      },
      required: ['name', 'email', 'password', 'role']
    }
  })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized (invalid credentials)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'securepassword123' }
      },
      required: ['email', 'password']
    }
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT') // Explicitly reference the 'JWT' scheme
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully', type: User })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth('JWT') // Explicitly reference the 'JWT' scheme
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully', type: User })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., invalid data)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe Updated', nullable: true },
        email: { type: 'string', example: 'john.doe.updated@example.com', nullable: true },
        password: { type: 'string', example: 'newsecurepassword123', nullable: true }
      },
      required: []
    }
  })
  updateProfile(@Request() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateProfile(req.user.sub, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth('JWT') // Explicitly reference the 'JWT' scheme
  @ApiOperation({ summary: 'Logout a user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized (missing or invalid JWT)' })
  @HttpCode(HttpStatus.OK)
  logout(@Request() req: any) {
    return this.authService.logout(req.user.sub);
  }
}