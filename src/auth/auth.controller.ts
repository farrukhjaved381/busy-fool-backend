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
  Res,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, AccessTokenResponseDto } from './dto/auth-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes, // Added ApiConsumes
} from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LogoutGuard } from './logout.guard';
import { User } from '../users/user.entity';
import { diskStorage } from 'multer';
import * as path from 'path'; // Changed import for path
import { RequestWithUser } from './interfaces/request-with-user.interface';
import * as fs from 'fs';
import { Response } from 'express';
import { setRefreshCookie, clearRefreshCookie } from './token.helpers';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

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
  async register(@Body() createUserDto: CreateUserDto, @Res({ passthrough: true }) res: Response, @Request() req: RequestWithUser) {
    const { accessToken, refreshToken } = await this.authService.register(createUserDto);
    setRefreshCookie(res, refreshToken, process.env.COOKIE_DOMAIN, req);
    return { accessToken, refreshToken };
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
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response, @Request() req: RequestWithUser) {
    const { accessToken, refreshToken } = await this.authService.login(loginDto);
    setRefreshCookie(res, refreshToken, process.env.COOKIE_DOMAIN, req);
    return { accessToken, refreshToken };
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
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profilePicture: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture file (JPG, PNG, GIF, WEBP - max 5MB)',
        },
      },
      required: ['profilePicture'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile picture uploaded successfully',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing or invalid JWT)',
  })
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.VERCEL ? require('os').tmpdir() : path.join(process.cwd(), 'uploads');
          if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const safeFilename = file.originalname.replace(/\s+/g, '_');
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(safeFilename)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed!'), false);
        }
      },
    }),
  )
  uploadProfilePicture(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Profile picture file is required');
    }
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
  async logout(@Request() req: RequestWithUser, @Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const refreshTokenId = req.cookies[process.env.COOKIE_NAME_REFRESH || 'busyfool_rtk'];
    await this.authService.logout(req.user.sub, refreshTokenId);
    clearRefreshCookie(res, process.env.COOKIE_DOMAIN);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or expired refresh token)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'your_long_lived_refresh_token', description: 'The refresh token obtained during login' },
      },
      required: ['refreshToken'],
    },
  })
  async refresh(@Request() req: RequestWithUser, @Res({ passthrough: true }) res: Response, @Body('refreshToken') bodyRefreshToken?: string) {
    const refreshToken = bodyRefreshToken || req.cookies[process.env.COOKIE_NAME_REFRESH || 'busyfool_rtk'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const { accessToken, refreshToken: newRefreshToken } = await this.authService.rotateRefreshToken(refreshToken);
    setRefreshCookie(res, newRefreshToken, process.env.COOKIE_DOMAIN, req);
    return { accessToken, refreshToken: newRefreshToken };
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

  @Get('profile-picture/:filename')
  @ApiOperation({
    summary: 'Get profile picture',
    description: 'Serves profile picture files.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile picture served successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile picture not found.',
  })
  async getProfilePicture(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const uploadDir = process.env.VERCEL ? tmpdir() : path.join(process.cwd(), 'uploads');
    const imagePath = path.join(uploadDir, filename);
    
    if (!existsSync(imagePath)) {
      throw new NotFoundException('Profile picture not found');
    }
    
    res.sendFile(imagePath);
  }
}
