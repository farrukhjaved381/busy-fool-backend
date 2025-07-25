import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
  import { Product } from './product.entity';
  import { Ingredient } from '../../ingredients/entities/ingredient.entity';
  import { ApiProperty } from '@nestjs/swagger';

  @Entity()
  export class ProductIngredient {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({ description: 'Unique identifier for the product-ingredient relation', example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ManyToOne(() => Product, product => product.ingredients)
    @JoinColumn()
    @ApiProperty({ description: 'Associated product', type: () => Product })
    product: Product;

    @ManyToOne(() => Ingredient, ingredient => ingredient.productIngredients)
    @JoinColumn()
    @ApiProperty({ description: 'Associated ingredient', type: () => Ingredient })
    ingredient: Ingredient;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    @ApiProperty({ description: 'Quantity used', example: 50, minimum: 0.01 })
    quantity: number;

    @Column({ length: 50, nullable: false })
    @ApiProperty({ description: 'Unit of measurement', example: 'ml', minLength: 1, maxLength: 50 })
    unit: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    @ApiProperty({ description: 'Line cost', example: 0.42, minimum: 0 })
    line_cost: number;

    @Column({ default: false })
    @ApiProperty({ description: 'Whether the ingredient is optional', example: false })
    is_optional: boolean;

    @ApiProperty({ description: 'Ingredient name', example: 'Oat Milk', readOnly: true })
    name: string;

    @ApiProperty({ description: 'Waste-adjusted cost per unit', example: 0.0084, readOnly: true })
    cost_per_unit: number;
  }