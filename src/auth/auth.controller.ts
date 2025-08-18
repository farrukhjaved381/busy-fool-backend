import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LogoutGuard } from './logout.guard';
import { User } from '../users/user.entity';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequestWithUser } from './interfaces/request-with-user.interface';
import * as fs from 'fs';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., email already registered or invalid data)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'securepassword123' },
        role: { type: 'string', enum: ['owner', 'staff'], example: 'owner' },
      },
      required: ['name', 'email', 'password', 'role'],
    },
  })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid credentials)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'securepassword123' },
      },
      required: ['email', 'password'],
    },
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: User,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Request() req: RequestWithUser) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., invalid data)' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe Updated', nullable: true },
        email: {
          type: 'string',
          example: 'john.doe.updated@example.com',
          nullable: true,
        },
        password: {
          type: 'string',
          example: 'newsecurepassword123',
          nullable: true,
        },
        profilePicture: {
          type: 'string',
          example: 'https://example.com/newpic.jpg',
          nullable: true,
        },
        phoneNumber: { type: 'string', example: '+9876543210', nullable: true },
        address: {
          type: 'string',
          example: '456 Tea Lane, Brewtown',
          nullable: true,
        },
        bio: { type: 'string', example: 'Tea lover and coder', nullable: true },
        dateOfBirth: {
          type: 'string',
          format: 'date',
          example: '1990-01-01',
          nullable: true,
        },
      },
      required: [],
    },
  })
  updateProfile(@Request() req: RequestWithUser, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateProfile(req.user.sub, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-profile-picture')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = '/tmp/uploads';
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadProfilePicture(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadProfilePicture(req.user.sub, file);
  }

  @UseGuards(LogoutGuard)
  @Post('logout')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout a user' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: RequestWithUser): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return this.authService.logout(req.user.sub);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if user exists.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., invalid email format)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'john.doe@example.com' },
      },
      required: ['email'],
    },
  })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);
    return {
      message:
        'If a user with that email exists, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a token' })
  @ApiResponse({
    status: 200,
    description: 'Password has been reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token, or invalid password.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'some_long_reset_token' },
        newPassword: { type: 'string', example: 'newSecurePassword123' },
      },
      required: ['token', 'newPassword'],
    },
  })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Password has been reset successfully.' };
  }
}
