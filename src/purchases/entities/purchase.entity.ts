import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { User } from '../../users/user.entity';

@Entity()
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the purchase' })
  id: string;

  @ManyToOne(() => Ingredient, { eager: true, onDelete: 'CASCADE' })
  @ApiProperty({ description: 'Ingredient purchased' })
  ingredient: Ingredient;

  @ManyToOne(() => User, (user) => user.purchases, { onDelete: 'CASCADE' })
  user: User;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Quantity purchased' })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Price per unit of the purchase' })
  purchasePrice: number; // Added to track per-unit price

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Total cost of the purchase' })
  total_cost: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Date of the purchase' })
  purchase_date: Date;
}
