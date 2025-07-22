import { Controller, Post, Body, Get, Patch, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../users/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered', type: AuthResponseDto })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 200, description: 'User logged in', type: AuthResponseDto })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile', type: User })
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile', type: User })
  updateProfile(@Request() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateProfile(req.user.sub, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout a user' })
  @ApiResponse({ status: 200, description: 'User logged out' })
  @HttpCode(HttpStatus.OK)
  logout(@Request() req: any) {
    return this.authService.logout(req.user.sub);
  }
}