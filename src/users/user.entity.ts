// src/users/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  OWNER = 'owner',
  STAFF = 'staff',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the user' })
  id: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Name of the user' })
  name: string;

  @Column({ unique: true })
  @ApiProperty({ description: 'Email address of the user' })
  email: string;

  @Column()
  @ApiProperty({ description: 'Hashed password of the user' })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.OWNER })
  @ApiProperty({ description: 'Role of the user (owner or staff)', enum: UserRole })
  role: UserRole;

  @CreateDateColumn()
  @ApiProperty({ description: 'Date the user was created' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Date the user was last updated' })
  last_updated: Date;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }
}