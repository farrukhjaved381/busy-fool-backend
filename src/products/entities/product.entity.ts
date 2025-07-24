import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProductIngredient } from './product-ingredient.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, nullable: false }) // Explicitly set nullable: false
  name: string;

  @Column({ length: 50 })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sell_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  margin_amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  margin_percent: number;

  @Column({ length: 20 })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @OneToMany(() => ProductIngredient, pi => pi.product, { cascade: true })
  ingredients: ProductIngredient[];

  @OneToMany(() => Sale, sale => sale.product, { cascade: true })
  sales: Sale[];
}