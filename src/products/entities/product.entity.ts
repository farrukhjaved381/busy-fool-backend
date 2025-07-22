import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProductIngredient } from './product-ingredient.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  category: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  sell_price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  total_cost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  margin_amount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  margin_percent: number;

  @Column({ nullable: true })
  status: string;

  @OneToMany(() => ProductIngredient, pi => pi.product, { cascade: true })
  ingredients: ProductIngredient[];
}
