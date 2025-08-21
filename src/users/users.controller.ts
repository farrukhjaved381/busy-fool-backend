import { Controller, Put, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
    // Ensure that the user can only update their own profile
    if (req.user && (req.user as any).sub !== id) {
      throw new UnauthorizedException('You are not authorized to update this profile.');
    }
    return this.usersService.update(id, updateUserDto);
  }
}
