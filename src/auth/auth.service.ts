import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersRepository.findOneBy({ email: createUserDto.email });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const user = this.usersRepository.create({
      ...createUserDto,
      // password: hashedPassword, // Remove manual hashing
    });
    await this.usersRepository.save(user);

    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      fullName: user.name ?? '',
      email: user.email,
      role: user.role,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findOneBy({ email: loginDto.email });
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      fullName: user.name ?? '',
      email: user.email,
      role: user.role,
    };
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

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async logout(userId: string): Promise<void> {
    // Invalidate token by storing it in a blacklist (implement Redis or DB-based blacklist if needed)
    // For simplicity, we're not implementing token blacklisting here, but you can extend this
    return;
  }
}