import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { ProductIngredient } from './product-ingredient.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the product' })
  id: string;

  @Column({ length: 100, nullable: false })
  @ApiProperty({ description: 'Name of the product', example: 'Coffee Latte' })
  name: string;

  @Column({ length: 50 })
  @ApiProperty({ description: 'Category of the product', example: 'Beverage' })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({ description: 'Selling price of the product', example: 4.50 })
  sell_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({ description: 'Total cost of the product', example: 2.50 })
  total_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @ApiProperty({ description: 'Margin amount', example: 2.00, required: false })
  margin_amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  @ApiProperty({ description: 'Margin percentage', example: 44.44, required: false })
  margin_percent: number;

  @Column({ length: 20 })
  @ApiProperty({ description: 'Status of the product', example: 'profitable' })
  status: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp', example: '2025-07-24T11:15:00Z' })
  created_at: Date;

  @OneToMany(() => ProductIngredient, pi => pi.product, { cascade: true, eager: true })
  @Expose()
  @ApiProperty({ description: 'List of product-ingredient relations', type: () => [ProductIngredient], readOnly: true })
  ingredients: ProductIngredient[];

  @OneToMany(() => Sale, sale => sale.product, { cascade: true })
  @ApiProperty({ description: 'List of sales for the product', type: () => [Sale] })
  sales: Sale[];
}