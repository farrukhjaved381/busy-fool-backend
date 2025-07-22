import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from './product.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity()
export class ProductIngredient {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the product-ingredient relation' })
  id: string;

  @ManyToOne(() => Product, (product) => product.ingredients)
  @ApiProperty({ description: 'Associated product', type: () => Product })
  product: Product;

  @ManyToOne(() => Ingredient)
  @ApiProperty({ description: 'Associated ingredient', type: () => Ingredient })
  ingredient: Ingredient;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Quantity of the ingredient used' })
  quantity: number;

  @Column()
  @ApiProperty({ description: 'Unit of measurement (e.g., ml, g)' })
  unit: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Cost of this ingredient for the product' })
  line_cost: number;

  @Column({ default: false })
  @ApiProperty({ description: 'Whether the ingredient is optional' })
  is_optional: boolean;
}