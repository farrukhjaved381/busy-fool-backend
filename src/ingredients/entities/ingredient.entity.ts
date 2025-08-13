import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  Index,
} from 'typeorm';
import { ProductIngredient } from '../../products/entities/product-ingredient.entity';
import { Stock } from '../../stock/entities/stock.entity';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/user.entity'; // Import User entity

@Entity()
@Index(['name', 'user'], { unique: true })
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    description: 'Unique identifier for the ingredient',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ManyToOne(() => User, (user) => user.ingredients, { onDelete: 'CASCADE' })
  user: User; // Add user relationship

  @Column({ length: 100, nullable: false })
  @ApiProperty({
    description: 'Name of the ingredient',
    example: 'Oat Milk',
    minLength: 1,
    maxLength: 100,
  })
  name: string;

  @Column({ length: 50, nullable: false })
  @ApiProperty({
    description: 'Unit of measurement (e.g., ml, g, unit)',
    example: 'ml',
    minLength: 1,
    maxLength: 50,
  })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  @ApiProperty({
    description: 'Total quantity purchased (for initial record)',
    example: 100,
    minimum: 0.01,
  })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  @ApiProperty({
    description: 'Purchase price for the total quantity',
    example: 0.84,
    minimum: 0.01,
  })
  purchase_price: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false })
  @ApiProperty({
    description: 'Waste percentage (0-100)',
    example: 10.0,
    minimum: 0,
    maximum: 100,
  })
  waste_percent: number;

  @Column({ type: 'float', nullable: true })
  @ApiProperty({
    description: 'Cost per milliliter (waste-adjusted)',
    example: 0.0084,
    required: false,
  })
  cost_per_ml: number | null;

  @Column({ type: 'float', nullable: true })
  @ApiProperty({
    description: 'Cost per gram (waste-adjusted)',
    example: 0.015,
    required: false,
  })
  cost_per_gram: number | null;

  @Column({ type: 'float', nullable: true })
  @ApiProperty({
    description: 'Cost per unit (waste-adjusted)',
    example: 1.5,
    required: false,
  })
  cost_per_unit: number | null;

  @Column({ length: 100, nullable: true })
  @ApiProperty({
    description: 'Supplier name',
    example: 'Dairy Co.',
    required: false,
    maxLength: 100,
  })
  supplier: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-07-25T10:00:00Z',
    readOnly: true,
  })
  created_at: Date;

  @OneToMany(() => ProductIngredient, (pi: ProductIngredient) => pi.ingredient)
  @ApiProperty({
    description: 'List of product-ingredient relations',
    type: () => [ProductIngredient],
    readOnly: true,
  })
  productIngredients: ProductIngredient[];

  @OneToMany(() => Stock, (stock: Stock) => stock.ingredient)
  @ApiProperty({
    description: 'List of stock batches',
    type: () => [Stock],
    readOnly: true,
  })
  stocks: Stock[];
}
