import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import ms from 'ms';
import { User } from '../users/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { hashToken, compareToken } from './token.helpers';
import { UrlService } from '../common/url.service';
import { CloudinaryService } from '../common/cloudinary.service';

// Type guard for valid duration string
function isValidDurationString(value: string): value is string {
  try {
    const msValue = ms(value);
    return !isNaN(msValue) && msValue > 0;
  } catch {
    return false;
  }
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
    private urlService: UrlService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<{ accessToken: string; refreshToken: string }> {
    const existingUser = await this.usersRepository.findOneBy({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const user = this.usersRepository.create(createUserDto);
    await this.usersRepository.save(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersRepository.findOneBy({
      email: loginDto.email,
    });
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
    };
  }

  private generateAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(user: User, replacedByTokenId: string | null = null): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await hashToken(rawToken);
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    if (!expiresIn) {
      throw new Error('JWT_REFRESH_EXPIRES_IN not configured');
    }

    if (!isValidDurationString(expiresIn)) {
      throw new Error('Invalid JWT_REFRESH_EXPIRES_IN value. Use format like "7d" or "1h"');
    }

    const expiresInMs = ms(expiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const refreshToken = this.refreshTokenRepository.create({
      user,
      userId: user.id,
      tokenHash,
      expiresAt,
      replacedByTokenId,
    });
    await this.refreshTokenRepository.save(refreshToken);
    return rawToken;
  }

  async rotateRefreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenRecords = await this.refreshTokenRepository.find({
      where: { revoked: false, expiresAt: MoreThan(new Date()) },
      relations: ['user'],
    });

    let tokenRecord: RefreshToken | undefined;
    for (const record of tokenRecords) {
      if (await compareToken(refreshToken, record.tokenHash)) {
        tokenRecord = record;
        break;
      }
    }

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = tokenRecord.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.revokeRefreshToken(tokenRecord.id);

    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user, tokenRecord.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Handle email update with case-insensitivity and trimming
    if (updateUserDto.email) {
      const newEmail = updateUserDto.email.toLowerCase().trim();
      if (newEmail !== user.email.toLowerCase().trim()) {
        const existingUser = await this.usersRepository.findOneBy({
          email: newEmail,
        });
        if (existingUser) {
          throw new BadRequestException('Email already registered');
        }
        user.email = newEmail; // Update user's email
      }
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Assign other properties, excluding email and password as they are handled above
    const { email, password, ...restOfDto } = updateUserDto;
    Object.assign(user, restOfDto);

    return this.usersRepository.save(user);
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Upload to Cloudinary
    const imageUrl = await this.cloudinaryService.uploadImage(file, 'profiles');
    user.profilePicture = imageUrl;
    return this.usersRepository.save(user);
  }

  async logout(userId: string, refreshTokenId: string): Promise<{ message: string }> {
    await this.revokeRefreshToken(refreshTokenId);
    return { message: 'Logged out successfully' };
  }

  private async revokeRefreshToken(id: string) {
    const refreshToken = await this.refreshTokenRepository.findOneBy({ id });
    if (refreshToken) {
      refreshToken.revoked = true;
      await this.refreshTokenRepository.save(refreshToken);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour expiration
    await this.usersRepository.save(user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    await this.mailService.sendMail(
      user.email,
      'Password Reset Request',
      `Please use the following link to reset your password: ${resetLink}`,
      `<p>Please use the following link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.usersRepository.save(user);
  }
}