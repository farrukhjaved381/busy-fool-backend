// src/users/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { Product } from '../products/entities/product.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Purchase } from '../purchases/entities/purchase.entity';

export enum UserRole {
  OWNER = 'owner',
  STAFF = 'staff',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the user' })
  id: string;

  @OneToMany(() => Product, (product) => product.user)
  @ApiHideProperty()
  products: Product[];

  @OneToMany(() => Ingredient, (ingredient) => ingredient.user)
  @ApiHideProperty()
  ingredients: Ingredient[];

  @OneToMany(() => Sale, (sale) => sale.user)
  @ApiHideProperty()
  sales: Sale[];

  @OneToMany(() => Stock, (stock) => stock.user)
  @ApiHideProperty()
  stocks: Stock[];

  @OneToMany(() => Purchase, (purchase) => purchase.user)
  @ApiHideProperty()
  purchases: Purchase[];

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
  @ApiProperty({
    description: 'Role of the user (owner or staff)',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ nullable: true })
  @ApiProperty({
    description: "URL or path to the user's profile picture",
    example: 'https://example.com/profile.jpg',
  })
  profilePicture: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Phone number of the user',
    example: '+1234567890',
  })
  phoneNumber: string;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({
    description: 'Address of the user',
    example: '123 Coffee St, Caffeine City',
  })
  address: string;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({
    description: 'Short bio or description about the user',
    example: 'Coffee enthusiast',
  })
  bio: string;

  @Column({ nullable: true, type: 'date' })
  @ApiProperty({
    description: 'Date of birth of the user',
    example: '1990-01-01',
  })
  dateOfBirth: Date;

  @CreateDateColumn()
  @ApiProperty({ description: 'Date the user was created' })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Date the user was last updated' })
  last_updated: Date;

  @Column({ nullable: true, type: 'varchar' })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date | null;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }
}
