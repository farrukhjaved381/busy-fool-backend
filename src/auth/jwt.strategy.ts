// src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in the environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
    console.log('JWT Strategy initialized with secret:', jwtSecret); // Debug log
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    console.log('Received payload from token:', payload); // Debug log
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      console.log('User not found for sub:', payload.sub); // Debug log
      throw new UnauthorizedException();
    }
    console.log('User validated:', user); // Debug log
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}