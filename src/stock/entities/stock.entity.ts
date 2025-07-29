import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { Waste } from '../../waste/entities/waste.entity';

@Entity()
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ingredient, ingredient => ingredient.stocks)
  @JoinColumn()
  ingredient: Ingredient;

  @OneToMany(() => Waste, waste => waste.stock)
  wastes: Waste[];

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  purchased_quantity: number;

  @Column({ length: 50, nullable: false })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  total_purchased_price: number; // Total price for the purchased quantity

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: false })
  purchase_price_per_unit: number; // Price per unit (e.g., per ml, L, etc.)

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false })
  waste_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  remaining_quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false, default: 0 })
  wasted_quantity: number;

  @CreateDateColumn()
  purchased_at: Date;

  @CreateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}